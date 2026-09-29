// Server-only: erase buyers' personal details once their event is over.
//
// A buyer's name and email exist for exactly three jobs — issue the QR ticket,
// re-send it if it goes missing, and let the organizer match the bank transfer
// to the right reservation. Once the event has happened all three are done, so
// this sweep overwrites them IN PLACE after a retention window.
//
// Order rows are never deleted. The organizer keeps their counts, their
// revenue and their check-in history, every ticket still reconciles to the
// order that minted it, and the payment reference (derived from the order id)
// still resolves — only the person behind the order stops being identifiable.
//
// The same sweep enforces every OTHER storage limit the site promises (the
// constants below, each quoted by /privacy): waitlists, unanswered questions,
// ended subscriptions, idle customer accounts, old contact requests and spent
// vouchers' referrer addresses. One machine, one cadence, one place to look.
//
// Shaped exactly like the reminder sweep (lib/reminders.ts): it self-throttles,
// is safe to call as often as you like, is armed lazily from page loads, and
// swallows its own errors so it can never break a render.
import { getDb } from './db';

const DEFAULT_RETENTION_DAYS = 30;

/**
 * Days after an event's date before its buyers' names and emails are erased.
 *
 * The privacy copy (/privacy, the checkout notice) reads THIS constant rather
 * than repeating a number, so what the site promises and what the sweep does
 * cannot drift apart. Override with BUYER_RETENTION_DAYS; anything that is not
 * a sane whole number of days falls back to the default rather than silently
 * disabling erasure.
 */
export const BUYER_RETENTION_DAYS: number = (() => {
  const raw = Number(process.env.BUYER_RETENTION_DAYS);
  return Number.isInteger(raw) && raw >= 1 && raw <= 3650 ? raw : DEFAULT_RETENTION_DAYS;
})();

/**
 * What replaces the buyer's details. Both are fixed strings, so re-running the
 * sweep over an already-erased order writes nothing new; the address uses the
 * reserved .invalid TLD (RFC 2606), which can never be delivered to, so an
 * erased order cannot accidentally email a real person later.
 */
export const ERASED_BUYER_NAME = 'Erased after event';
export const ERASED_BUYER_EMAIL = 'erased@erased.invalid';

/**
 * What an erased buyer is called on a SCREEN.
 *
 * The two placeholders above exist to keep the columns non-null; neither may
 * ever be rendered, because in a "Buyer" column they read as a person's name
 * and address rather than as the absence of one. So every read model that
 * prints a buyer degrades to this one label instead — one constant shared with
 * lib/analytics.ts, so two screens can never anonymise the same person
 * differently. There is deliberately no anonymous EMAIL: no address exists any
 * more, and printing one that looks deliverable is worse than a blank.
 */
export const ANONYMOUS_BUYER_NAME = 'a past guest';

/**
 * True once this order's buyer has been erased.
 *
 * Reads the stamp when the caller selected it, and falls back to the
 * placeholder strings themselves when it did not: the rule is that those two
 * values never reach a screen, so a read model that forgot to select
 * buyer_erased_at must not be the reason one does.
 */
export function isErasedBuyer(row: {
  buyerName?: string;
  buyerEmail?: string;
  buyerErasedAt?: string | null;
}): boolean {
  return Boolean(row.buyerErasedAt) || row.buyerName === ERASED_BUYER_NAME || row.buyerEmail === ERASED_BUYER_EMAIL;
}

/**
 * Degrade one row's buyer fields to the anonymous label, leaving every other
 * field exactly as it was — the counts, the money and the tickets are the
 * seller's arithmetic and survive erasure untouched.
 *
 * Applied in the READ MODELS (lib/orders.ts's list and scan paths) rather than
 * on each page, because a new screen that prints a buyer gets written far more
 * often than this file gets read — the one place it cannot be forgotten.
 *
 * NOT applied to getOrder and the other write-model reads: the payment and
 * delivery machinery has to see the real (undeliverable) address in order to
 * refuse to use it — lib/email.ts and markTransferOrderPaid both do exactly
 * that, and handing them 'a past guest' would hide the erasure from the only
 * code that must notice it.
 */
export function withAnonymizedBuyer<
  T extends {
    buyerName: string;
    buyerEmail: string;
    buyerErasedAt?: string | null;
    payerName?: string;
    buyerPhone?: string;
    orderNote?: string;
  },
>(row: T): T {
  if (!isErasedBuyer(row)) return row;
  const out: T = { ...row, buyerName: ANONYMOUS_BUYER_NAME, buyerEmail: '' };
  // The other person-identifying fields go blank too, when the row carries
  // them. The sweep blanks them in the database as well (ERASE_ORDER_BUYER_SQL
  // below), but orders erased before it did still hold them until the next
  // sweep's scrub reaches them — and a screen must not be the place they show.
  if (typeof row.payerName === 'string') out.payerName = '';
  if (typeof row.buyerPhone === 'string') out.buyerPhone = '';
  if (typeof row.orderNote === 'string') out.orderNote = '';
  return out;
}

/**
 * The one statement that erases the person behind an order, shared by the
 * sweep below and the "erase everything about me" path (lib/erasure.ts), so
 * the two can never disagree about what erasing an order means.
 *
 * Everything that names or describes the buyer goes:
 *   - buyer_name / buyer_email → the fixed placeholders above;
 *   - buyer_phone → '';
 *   - payer_name → '' — whose name the money arrived under is a person too
 *     (often a relative), and it was only ever needed to match the transfer;
 *   - order_note → '' — the free-text kitchen note ("no nuts, my son is
 *     allergic") is exactly the kind of health detail that must not outlive
 *     the order it was written for.
 * What stays is the seller's arithmetic: items, totals, tickets, check-ins,
 * the payment reference. Tickets carry no holder name of their own.
 *
 * Parameters: (ERASED_BUYER_NAME, ERASED_BUYER_EMAIL, orderId).
 */
export const ERASE_ORDER_BUYER_SQL = `
  UPDATE orders
  SET buyer_name = ?, buyer_email = ?, buyer_phone = '', payer_name = '', order_note = '',
      buyer_erased_at = datetime('now')
  WHERE id = ? AND buyer_erased_at IS NULL`;

/** Erase one order's buyer in place (see ERASE_ORDER_BUYER_SQL). 1 when it changed, 0 when already erased. */
export function eraseOrderBuyer(orderId: string): number {
  return getDb().prepare(ERASE_ORDER_BUYER_SQL).run(ERASED_BUYER_NAME, ERASED_BUYER_EMAIL, orderId).changes;
}

/** Rows touched per statement pass, so one sweep never loads a whole season. */
const BATCH_SIZE = 500;
/** Bound on one sweep's work; a large backlog simply finishes on later calls. */
const MAX_BATCHES = 20;
/** The window is measured in days — checking hourly is already generous. */
const SWEEP_MIN_INTERVAL_MS = 60 * 60_000;

let lastSweepAt = 0;
let sweeping = false;

declare global {
  // eslint-disable-next-line no-var
  var __retentionInterval: ReturnType<typeof setInterval> | undefined;
}

/**
 * Arm the recurring sweep once per server process, from the first sweep — the
 * same trick lib/reminders.ts uses. A site with visitors erases on time without
 * an instrumentation hook (which would drag SQLite into the Edge bundle), and a
 * site with no visitors has nothing arriving that needs erasing either.
 */
function ensureRetentionInterval(): void {
  if (global.__retentionInterval) return;
  global.__retentionInterval = setInterval(
    () => {
      runBuyerDataRetentionSweep();
    },
    6 * 60 * 60_000
  );
  // Never keep the process alive just for this.
  if (typeof global.__retentionInterval.unref === 'function') global.__retentionInterval.unref();
}

/**
 * How long an unpaid transfer reservation stays payable past its stated
 * window before the expiry sweep cancels it — the same two days of grace
 * expireOverdueTransferReservations (lib/orders.ts) gives, restated here so
 * erasure can never fire on an order that sweep still considers alive.
 */
const PAYMENT_WINDOW_GRACE_DAYS = 2;

/**
 * The long-stop for a PAID shop order that is never collected: whatever
 * pickup_info promised, buyer details do not outlive this. Mirrored in the
 * /privacy copy — change one, change both.
 */
export const SHOP_UNCOLLECTED_LONG_STOP_DAYS = 365;

/**
 * Days a NOTIFIED waitlist address survives its one email before it is
 * deleted. The signup form promised "one email, then your address is deleted",
 * so this is a grace period, not a retention window: long enough that someone
 * whose mail bounced can write in and be told what happened, short enough that
 * the promise stays recognisably true. The waitlist email and /privacy both
 * read THIS constant, so what the site says and what the sweep does cannot
 * drift apart.
 */
export const WAITLIST_NOTIFIED_RETENTION_DAYS = 14;

/*
 * The remaining storage limits (Art. 5(1)(e) GDPR), each quoted by /privacy so
 * the page and the sweeps cannot drift apart. Change one, and the page follows.
 */

/** A customer account nobody has signed in to for this long is deleted. */
export const CUSTOMER_INACTIVE_DAYS = 730;

/** A cancelled or ended subscription is deleted this long after it ended. */
export const SUBSCRIPTION_ENDED_RETENTION_DAYS = 30;

/** Contact-form requests are deleted this long after they arrived. */
export const CONTACT_REQUEST_RETENTION_DAYS = 365;

/** A shop waitlist entry that never got its email is deleted after this long. */
export const WAITLIST_SHOP_MAX_DAYS = 180;

/**
 * An order whose listing has no date (an organizer cleared it) is erased this
 * long after it was placed — the fallback clock, so no buyer lives forever.
 */
export const UNDATED_ORDER_RETENTION_DAYS = 365;

/** A referral voucher's referrer email is erased this long after the voucher is spent or dead. */
export const REFERRAL_VOUCHER_RETENTION_DAYS = 30;

/** Database backups older than this are deleted (scripts/backup.mjs mirrors it). */
export const BACKUP_RETENTION_DAYS = 30;

/**
 * Orders due for erasure: the buyer has not been erased yet, and the thing
 * their details were needed for is genuinely over.
 *
 * WHAT STARTS THE CLOCK depends on the kind of listing, because the two kinds
 * end differently:
 *
 *  - an EVENT ends on its date, so the window counts from event_date.
 *
 *  - an EVENT WITH NO USABLE DATE (never had one, or an organizer unpublished
 *    and cleared it, or junk that date() cannot parse) falls back to the
 *    order's own age: UNDATED_ORDER_RETENTION_DAYS after it was placed. That
 *    is the long-stop that makes "no buyer lives forever" true whatever the
 *    listing's settings say. The in-flight guard is the same one the shop
 *    clause uses: an unpaid order is only erased once it has left the payable
 *    states AND its payment window is long over — a late transfer must still
 *    find a buyer to deliver to.
 *
 *  - a SHOP never "happens", so each order carries its own clock — and the
 *    clock must not start while the buyer's details still have a job to do:
 *      · a PAID order counts from the moment its LAST code is collected, not
 *        from payment. pickup_info is free text and nothing bounds it to the
 *        retention window, so "paid + N days" would erase the buyer of a
 *        six-weeks-out pre-order while their goods sat unclaimed — killing
 *        the re-send path and the organizer's ability to check who is
 *        collecting. Paid but never fully collected keeps the details until
 *        the long-stop above, then erases anyway: an uncollected order from
 *        last year is a bookkeeping row, not a live pickup.
 *      · an UNPAID order is erased only once it can no longer become paid:
 *        it must have left the payable states, AND its stated payment window
 *        (pay_within_days + the expiry sweep's grace) must be over by the
 *        retention margin. Counting bare created_at would erase a buyer whose
 *        transfer was still legitimately in flight — and lib/orders'
 *        markTransferOrderPaid deliberately revives late payments, which is
 *        exactly the door this clause must not shut early.
 *
 * An order with no event at all (orphaned) is dropped by the JOIN.
 */
const DUE_SQL = `
  SELECT o.id AS id
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE o.buyer_erased_at IS NULL
    AND (
      (e.kind != 'shop' AND e.event_date IS NOT NULL AND date(e.event_date) <= date('now', ?))
      -- No usable date: the fallback clock, counted from the order itself.
      OR (
        e.kind != 'shop'
        AND date(e.event_date) IS NULL
        AND (
          (o.paid_at IS NOT NULL AND date(o.created_at) <= date('now', '-${UNDATED_ORDER_RETENTION_DAYS} days'))
          OR (
            o.paid_at IS NULL
            AND o.status NOT IN ('claimed', 'pending', 'capturing')
            AND date(o.created_at,
                     '+' || (e.pay_within_days + ${PAYMENT_WINDOW_GRACE_DAYS}) || ' days')
                <= date('now', '-${UNDATED_ORDER_RETENTION_DAYS} days')
          )
        )
      )
      OR (
        e.kind = 'shop'
        AND (
          -- Paid and every code collected: N days after the last collection.
          (
            o.paid_at IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM tickets t WHERE t.order_id = o.id AND t.checked_in_at IS NULL
            )
            AND date(COALESCE(
              (SELECT MAX(t2.checked_in_at) FROM tickets t2 WHERE t2.order_id = o.id),
              o.paid_at
            )) <= date('now', ?)
          )
          -- Paid, never (fully) collected: the long-stop.
          OR (
            o.paid_at IS NOT NULL
            AND date(o.paid_at) <= date('now', '-${SHOP_UNCOLLECTED_LONG_STOP_DAYS} days')
          )
          -- Never paid: only once no longer payable, N days past the window.
          OR (
            o.paid_at IS NULL
            AND o.status NOT IN ('claimed', 'pending', 'capturing')
            AND date(o.created_at,
                     '+' || (e.pay_within_days + ${PAYMENT_WINDOW_GRACE_DAYS}) || ' days')
                <= date('now', ?)
          )
        )
      )
    )
  ORDER BY o.created_at ASC
  LIMIT ${BATCH_SIZE}
`;

/** What one sweep did, step by step. Every count is rows touched this run. */
export interface RetentionSweepResult {
  /** Orders whose buyer was erased. */
  erased: number;
  /** Already-erased orders whose payer name / note / phone were scrubbed late. */
  scrubbed: number;
  /** Questions nobody answered, deleted outright. */
  questionsDeleted: number;
  /** Answered questions that lost their asker. */
  askersErased: number;
  /** Reviews that lost their author's name. */
  reviewsAnonymized: number;
  /** Waitlist addresses deleted. */
  waitlistDeleted: number;
  /** Unconfirmed keep-me-posted requests deleted. */
  pendingConsentsDeleted: number;
  /** Cancelled / ended subscriptions deleted. */
  subscriptionsDeleted: number;
  /** Customer accounts deleted for inactivity. */
  customersDeleted: number;
  /** Expired customer sign-in codes deleted. */
  loginCodesDeleted: number;
  /** Contact-form requests deleted. */
  contactRequestsDeleted: number;
  /** Spent referral vouchers whose referrer address was erased. */
  voucherEmailsErased: number;
  /** Names of the steps that threw this run (each is logged; the rest still ran). */
  failed: string[];
}

function emptyResult(): RetentionSweepResult {
  return {
    erased: 0,
    scrubbed: 0,
    questionsDeleted: 0,
    askersErased: 0,
    reviewsAnonymized: 0,
    waitlistDeleted: 0,
    pendingConsentsDeleted: 0,
    subscriptionsDeleted: 0,
    customersDeleted: 0,
    loginCodesDeleted: 0,
    contactRequestsDeleted: 0,
    voucherEmailsErased: 0,
    failed: [],
  };
}

/**
 * Enforce every storage limit the site promises (Art. 5(1)(e) GDPR), in one
 * sweep: buyers after their event, askers, reviews' bylines, waitlists,
 * unconfirmed consents, ended subscriptions, idle customer accounts, old
 * contact requests and spent vouchers' referrer addresses. Idempotent (every
 * step's WHERE clause retires the rows it has handled), batched where a
 * backlog can be large, and it never throws — callers on a page render can
 * call it and ignore the result.
 *
 * Each step runs in its OWN try/catch: one table's problem (a lock, a
 * migration that has not landed yet) must never be the reason another table's
 * promise goes unkept. A failed step is logged and named in `failed`, and
 * simply runs again on the next sweep.
 *
 * Pass force to skip the throttle; tests and manual runs want that, page loads
 * do not.
 */
export function runBuyerDataRetentionSweep(force = false): RetentionSweepResult {
  const result = emptyResult();
  try {
    ensureRetentionInterval();
  } catch (e) {
    console.error('Retention sweep: could not arm the interval:', e);
  }
  const now = Date.now();
  if (sweeping || (!force && now - lastSweepAt < SWEEP_MIN_INTERVAL_MS)) return result;
  sweeping = true;
  lastSweepAt = now;

  const step = (name: string, run: () => void) => {
    try {
      run();
    } catch (e) {
      result.failed.push(name);
      console.error(`Retention sweep step "${name}" failed:`, e);
    }
  };

  try {
    const db = getDb();
    const cutoff = `-${BUYER_RETENTION_DAYS} days`;

    step('orders', () => {
      const findDue = db.prepare(DUE_SQL);
      // The same cutoff three times: the event's date, a shop order's last
      // collection, and an unpaid shop order's expired payment window — see
      // DUE_SQL for why each clock starts where it does.
      const erase = db.prepare(ERASE_ORDER_BUYER_SQL);
      const eraseBatch = db.transaction((ids: string[]) => {
        let n = 0;
        for (const id of ids) n += erase.run(ERASED_BUYER_NAME, ERASED_BUYER_EMAIL, id).changes;
        return n;
      });
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const due = findDue.all(cutoff, cutoff, cutoff) as { id: string }[];
        if (due.length === 0) break;
        result.erased += eraseBatch(due.map((r) => r.id));
        if (due.length < BATCH_SIZE) break;
      }
    });

    // Orders erased before the payer name, the phone and the free-text note
    // were part of "erasing an order" still carry them. Self-healing, like the
    // review step below: anything already stamped erased loses them here.
    step('order-scrub', () => {
      result.scrubbed = db
        .prepare(
          `UPDATE orders SET buyer_phone = '', payer_name = '', order_note = ''
           WHERE buyer_erased_at IS NOT NULL
             AND (buyer_phone <> '' OR payer_name <> '' OR order_note <> '')`
        )
        .run().changes;
    });

    // A question nobody answered never became public Q&A, so nothing about it
    // is worth keeping once its event is over: the question text AND the
    // person go together. Same clocks as the askers below — the event's date
    // plus BUYER_RETENTION_DAYS; on a shop, the question's own age; on an
    // event with no usable date, the undated fallback.
    step('unanswered-questions', () => {
      result.questionsDeleted = db
        .prepare(
          `DELETE FROM event_questions
           WHERE status <> 'answered'
             AND (
               event_id IN (
                 SELECT id FROM events
                 WHERE kind != 'shop' AND event_date IS NOT NULL AND date(event_date) <= date('now', ?)
               )
               OR (
                 date(asked_at) <= date('now', ?)
                 AND event_id IN (SELECT id FROM events WHERE kind = 'shop')
               )
               OR (
                 date(asked_at) <= date('now', '-${UNDATED_ORDER_RETENTION_DAYS} days')
                 AND event_id IN (SELECT id FROM events WHERE kind != 'shop' AND date(event_date) IS NULL)
               )
             )`
        )
        .run(cutoff, cutoff).changes;
    });

    // Askers get the same expiry as buyers, and for the same reason: someone
    // who typed their address to hear one answer did not sign up to be on
    // record forever. The QUESTION and its ANSWER survive — they are public
    // Q&A on the event page and feed the assistant — only the person attached
    // to them stops being identifiable.
    //
    // Measured from the event date, exactly like orders, so both halves of the
    // promise on /privacy expire together rather than on two different clocks.
    // On a shop there is no event date, so a question's own age is the clock —
    // its answer was needed while the asker still cared, not forever. On an
    // event with no usable date, the same undated fallback orders get.
    step('askers', () => {
      result.askersErased = db
        .prepare(
          `UPDATE event_questions
           SET asker_name = ?, asker_email = ?, asker_erased_at = datetime('now')
           WHERE asker_erased_at IS NULL
             AND (asker_name <> '' OR asker_email <> '')
             AND (
               event_id IN (
                 SELECT id FROM events
                 WHERE kind != 'shop' AND event_date IS NOT NULL AND date(event_date) <= date('now', ?)
               )
               OR (
                 date(asked_at) <= date('now', ?)
                 AND event_id IN (SELECT id FROM events WHERE kind = 'shop')
               )
               OR (
                 date(asked_at) <= date('now', '-${UNDATED_ORDER_RETENTION_DAYS} days')
                 AND event_id IN (SELECT id FROM events WHERE kind != 'shop' AND date(event_date) IS NULL)
               )
             )`
        )
        .run(ERASED_BUYER_NAME, ERASED_BUYER_EMAIL, cutoff, cutoff).changes;
    });

    // A review keeps its WORDS and loses its AUTHOR, which is the same split
    // the questions above take and for the same reason: what somebody wrote is
    // about the goods, not about themselves. "Hotter than I expected, and the
    // jar arrived intact" is still the truest thing on that item's page a year
    // later, and the next shopper is owed it whether or not the person who
    // wrote it can still be named. Deleting the row instead would also quietly
    // improve the seller's score every time a buyer was erased, which is a
    // privacy sweep silently editing somebody's ratings.
    //
    // Driven off buyer_erased_at rather than off the batch just erased above,
    // so it is self-healing: a review written between two sweeps on an order
    // that was already erased (the buyer's emailed link outlives the sweep)
    // gets caught on the next pass rather than keeping a name forever. The
    // `<>` makes it idempotent — an already-anonymous row matches nothing.
    //
    // Spelled out here rather than calling lib/reviews.anonymizeReviewsForOrder
    // in a loop: that function is the single-order path for an explicit "erase
    // everything about me" request, and importing it would make lib/reviews and
    // this file import each other (reviews reads ANONYMOUS_BUYER_NAME from
    // here). One statement over the whole backlog is also what the rest of this
    // sweep does.
    step('reviews', () => {
      result.reviewsAnonymized = db
        .prepare(
          `UPDATE item_reviews
           SET author_name = ?
           WHERE author_name <> ?
             AND order_id IN (SELECT id FROM orders WHERE buyer_erased_at IS NOT NULL)`
        )
        .run(ANONYMOUS_BUYER_NAME, ANONYMOUS_BUYER_NAME).changes;
    });

    // Waitlist addresses are DELETED rather than overwritten: unlike an order,
    // a waitlist row reconciles no money and mints no ticket — the email IS
    // the row, so keeping an emptied husk would preserve nothing.
    //
    // Four clocks, one per way a row stops having a job:
    //  - NOTIFIED rows: the single promised email has gone out, so the
    //    address's only job is done. WAITLIST_NOTIFIED_RETENTION_DAYS of grace
    //    covers "my mail bounced, what happened?" before the form's "deleted
    //    afterwards" promise comes due.
    //  - UNNOTIFIED rows on a past event: the notify sweep refuses events past
    //    their date, so this address can never earn its email — waiting longer
    //    changes nothing, and holding data that can never be used is exactly
    //    what this sweep exists to stop.
    //  - UNNOTIFIED rows on a SHOP (or an event with no usable date): a shop
    //    can restock any day, so the address keeps its job for a while — but
    //    not forever. WAITLIST_SHOP_MAX_DAYS after signing up it goes, email
    //    or no email.
    //  - Anything on an event whose BUYERS are being erased (same cutoff as
    //    the orders above): whatever the other clocks say, someone who only
    //    typed an email must never outlive the people who actually paid.
    step('waitlist', () => {
      result.waitlistDeleted = db
        .prepare(
          `DELETE FROM waitlist
           WHERE (notified_at IS NOT NULL
                  AND date(notified_at) <= date('now', '-${WAITLIST_NOTIFIED_RETENTION_DAYS} days'))
              OR (notified_at IS NULL AND event_id IN (
                    SELECT id FROM events
                    WHERE kind != 'shop' AND event_date IS NOT NULL AND date(event_date) < date('now')
                  ))
              OR (notified_at IS NULL
                  AND date(created_at) <= date('now', '-${WAITLIST_SHOP_MAX_DAYS} days')
                  AND event_id IN (
                    SELECT id FROM events WHERE kind = 'shop' OR date(event_date) IS NULL
                  ))
              OR event_id IN (
                    SELECT id FROM events
                    WHERE kind != 'shop' AND event_date IS NOT NULL AND date(event_date) <= date('now', ?)
                  )`
        )
        .run(cutoff).changes;
    });

    // Deliberately NOT swept: CONFIRMED marketing_consents (lib/marketing.ts).
    // A buyer who ticked the optional "keep me posted" box at checkout and
    // pressed the confirm button in their inbox asked for their address to
    // OUTLIVE this erasure — that confirmed consent is its own lawful basis
    // with its own lifecycle (it ends when they unsubscribe, or on an explicit
    // deletion request), and /privacy promises exactly that. Adding those rows
    // to this sweep would not be a privacy fix; it would break a subscription
    // the buyer explicitly created. The consent row also never points back at
    // an identifiable order once this sweep has run: source_order_id keeps
    // resolving to an order whose buyer fields are already overwritten.
    //
    // What IS swept: pending requests that were never confirmed. An address
    // whose owner did not press the button may be a typo or someone else's
    // entirely, so it must not sit in a marketing table forever — once the
    // confirmation email is stale (the buyer retention window is generous;
    // real confirms happen within minutes) the request is deleted outright.
    // Suppression records (unsubscribed_at set) are kept regardless: they are
    // what stops a re-add, and /privacy promises they persist.
    //
    // A request that was confirmed once, unsubscribed and then asked for again
    // can carry marketing_sends rows from its first life, and those reference
    // the consent (foreign key) — so they go first, in the same transaction,
    // or the delete would throw.
    step('pending-consents', () => {
      const stale = `confirmed_at IS NULL AND unsubscribed_at IS NULL
             AND date(consented_at) <= date('now', '-${BUYER_RETENTION_DAYS} days')`;
      db.transaction(() => {
        db.prepare(`DELETE FROM marketing_sends WHERE consent_id IN (SELECT id FROM marketing_consents WHERE ${stale})`).run();
        result.pendingConsentsDeleted = db.prepare(`DELETE FROM marketing_consents WHERE ${stale}`).run().changes;
      })();
    });

    // A standing order that has ENDED keeps a name, an address and a kitchen
    // note for nothing. "Ended" is: cancelled (by the buyer, from the link in
    // every email), SUBSCRIPTION_ENDED_RETENTION_DAYS after the cancellation —
    // updated_at is stamped by the cancel itself and nothing touches a
    // cancelled row afterwards — or its listing no longer exists at all.
    // A PAUSED subscription is not ended: the buyer can resume it with one
    // click, and a sweep that took that away would be cancelling for them.
    step('subscriptions', () => {
      result.subscriptionsDeleted = db
        .prepare(
          `DELETE FROM subscriptions
           WHERE (status = 'cancelled'
                  AND date(updated_at) <= date('now', '-${SUBSCRIPTION_ENDED_RETENTION_DAYS} days'))
              OR event_id NOT IN (SELECT id FROM events)`
        )
        .run().changes;
    });

    // Customer accounts are a convenience the buyer chose (lib/customers.ts):
    // nobody who has not signed in for CUSTOMER_INACTIVE_DAYS is using it.
    // "Signed in" is last_login_at — stamped by every code or Google sign-in —
    // falling back to created_at for rows that never recorded one. The basket
    // goes with the account, in the same transaction. Orders are NOT touched:
    // they are the sellers' records and have their own clock above.
    //
    // Sign-in codes are ten-minute secrets keyed by an address somebody typed;
    // once expired they are useless, and an address that never finished
    // signing in is not a customer at all.
    step('customers', () => {
      const idle = `date(COALESCE(last_login_at, created_at)) <= date('now', '-${CUSTOMER_INACTIVE_DAYS} days')`;
      db.transaction(() => {
        db.prepare(`DELETE FROM customer_baskets WHERE customer_id IN (SELECT id FROM customers WHERE ${idle})`).run();
        result.customersDeleted = db.prepare(`DELETE FROM customers WHERE ${idle}`).run().changes;
        // Baskets whose account is already gone (deleted by its owner or by an
        // older build) have nobody left to read them.
        db.prepare(`DELETE FROM customer_baskets WHERE customer_id NOT IN (SELECT id FROM customers)`).run();
      })();
      result.loginCodesDeleted = db
        .prepare(`DELETE FROM customer_login_codes WHERE expires_at < ?`)
        .run(Date.now()).changes;
    });

    // Contact-form requests were a conversation. A year on, it is over — the
    // account was approved or not, the design was made or not — and the name,
    // address, phone and message go.
    step('contact-requests', () => {
      result.contactRequestsDeleted = db
        .prepare(
          `DELETE FROM contact_requests
           WHERE date(created_at) <= date('now', '-${CONTACT_REQUEST_RETENTION_DAYS} days')`
        )
        .run().changes;
    });

    // A referral voucher names the person who earned it so that (a) they can
    // see it on their order page and (b) lib/referrals can count how many they
    // have already been given. Once the voucher is SPENT on a paid order (or
    // the order it was spent on no longer exists at all), (a) is over — and
    // after REFERRAL_VOUCHER_RETENTION_DAYS the address goes.
    //
    // (b) is money, and it sets the one extra condition: the referrer must
    // have no un-erased PAID order left with this seller. lib/referrals issues
    // "vouchers earned minus vouchers held, by address"; while the referrer
    // still has a live order, their referrals still count, and a voucher that
    // stopped counting as theirs would be re-issued — the seller would owe the
    // same thank-you twice. Once every order of theirs is erased, their
    // referrals can never count again (countPaidReferrals requires an
    // un-erased referring order), so dropping the address can no longer change
    // any balance. That makes the real clock "30 days after it was spent, or
    // when their last order with that seller is erased, whichever is later".
    step('voucher-emails', () => {
      result.voucherEmailsErased = db
        .prepare(
          `UPDATE referral_vouchers
           SET referrer_email = NULL
           WHERE referrer_email IS NOT NULL
             AND redeemed_at IS NOT NULL
             AND date(redeemed_at) <= date('now', '-${REFERRAL_VOUCHER_RETENTION_DAYS} days')
             AND (
               NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = referral_vouchers.redeemed_order_id)
               OR EXISTS (
                 SELECT 1 FROM orders o
                 WHERE o.id = referral_vouchers.redeemed_order_id
                   AND o.status = 'paid'
                   AND date(COALESCE(o.paid_at, referral_vouchers.redeemed_at))
                       <= date('now', '-${REFERRAL_VOUCHER_RETENTION_DAYS} days')
               )
             )
             AND NOT EXISTS (
               SELECT 1 FROM orders r JOIN events re ON re.id = r.event_id
               WHERE re.organizer_id = referral_vouchers.organizer_id
                 AND r.status = 'paid'
                 AND r.buyer_erased_at IS NULL
                 AND lower(r.buyer_email) = lower(referral_vouchers.referrer_email)
             )`
        )
        .run().changes;
    });

    const said: [number, string][] = [
      [result.erased, 'erased buyer details on %d order(s)'],
      [result.scrubbed, 'scrubbed payer name / note / phone from %d already-erased order(s)'],
      [result.questionsDeleted, 'deleted %d unanswered question(s)'],
      [result.askersErased, 'erased the asker on %d question(s)'],
      [result.reviewsAnonymized, "took the author's name off %d review(s)"],
      [result.waitlistDeleted, 'deleted %d waitlist address(es)'],
      [result.pendingConsentsDeleted, 'deleted %d unconfirmed keep-me-posted request(s)'],
      [result.subscriptionsDeleted, 'deleted %d ended subscription(s)'],
      [result.customersDeleted, 'deleted %d inactive customer account(s)'],
      [result.loginCodesDeleted, 'deleted %d expired sign-in code(s)'],
      [result.contactRequestsDeleted, 'deleted %d old contact request(s)'],
      [result.voucherEmailsErased, "erased the referrer's address on %d spent voucher(s)"],
    ];
    for (const [n, text] of said) {
      if (n > 0) console.log(`Retention sweep: ${text.replace('%d', String(n))}.`);
    }
    return result;
  } catch (e) {
    console.error('Buyer data retention sweep failed:', e);
    return result;
  } finally {
    sweeping = false;
  }
}
