// Server-only: erase buyers' personal details once their event is over.
//
// A buyer's name and email exist for exactly three jobs — issue the QR ticket,
// re-send it if it goes missing, and let the organizer match the bank transfer
// to the right reservation. Once the event has happened all three are done, so
// this sweep overwrites both fields IN PLACE after a retention window.
//
// Rows are never deleted. The organizer keeps their counts, their revenue and
// their check-in history, every ticket still reconciles to the order that
// minted it, and the payment reference (derived from the order id) still
// resolves — only the person behind the order stops being identifiable.
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
export function withAnonymizedBuyer<T extends { buyerName: string; buyerEmail: string; buyerErasedAt?: string | null }>(
  row: T
): T {
  if (!isErasedBuyer(row)) return row;
  return { ...row, buyerName: ANONYMOUS_BUYER_NAME, buyerEmail: '' };
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

/**
 * Orders due for erasure: the buyer has not been erased yet, and the thing
 * their details were needed for is genuinely over.
 *
 * WHAT STARTS THE CLOCK depends on the kind of listing, because the two kinds
 * end differently:
 *
 *  - an EVENT ends on its date, so the window counts from event_date. An event
 *    with no date is never swept — there is nothing to count from — which is
 *    why publishing now refuses an event without one: an unerasable buyer is
 *    a promise /privacy cannot keep. date() returns NULL for an unparseable
 *    value, and `NULL <= x` is never true, so junk in event_date fails closed.
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

/**
 * Erase the buyer details of every order whose event is more than
 * BUYER_RETENTION_DAYS past. Idempotent (buyer_erased_at is the stamp that
 * retires a row from the query), batched, and it never throws — callers on a
 * page render can call it and ignore the result.
 *
 * Pass force to skip the throttle; tests and manual runs want that, page loads
 * do not.
 */
export function runBuyerDataRetentionSweep(force = false): { erased: number } {
  ensureRetentionInterval();
  const now = Date.now();
  if (sweeping || (!force && now - lastSweepAt < SWEEP_MIN_INTERVAL_MS)) return { erased: 0 };
  sweeping = true;
  lastSweepAt = now;
  try {
    const db = getDb();
    const cutoff = `-${BUYER_RETENTION_DAYS} days`;
    const findDue = db.prepare(DUE_SQL);
    // The same cutoff three times: the event's date, a shop order's last
    // collection, and an unpaid shop order's expired payment window — see
    // DUE_SQL for why each clock starts where it does.
    const erase = db.prepare(
      `UPDATE orders
       SET buyer_name = ?, buyer_email = ?, buyer_erased_at = datetime('now')
       WHERE id = ? AND buyer_erased_at IS NULL`
    );
    const eraseBatch = db.transaction((ids: string[]) => {
      let n = 0;
      for (const id of ids) n += erase.run(ERASED_BUYER_NAME, ERASED_BUYER_EMAIL, id).changes;
      return n;
    });

    let erased = 0;
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const due = findDue.all(cutoff, cutoff, cutoff) as { id: string }[];
      if (due.length === 0) break;
      erased += eraseBatch(due.map((r) => r.id));
      if (due.length < BATCH_SIZE) break;
    }
    // Askers get the same expiry as buyers, and for the same reason: someone
    // who typed their address to hear one answer did not sign up to be on
    // record forever. The QUESTION and its ANSWER survive — they are public
    // Q&A on the event page and feed the assistant — only the person attached
    // to them stops being identifiable.
    //
    // Measured from the event date, exactly like orders, so both halves of the
    // promise on /privacy expire together rather than on two different clocks.
    // On a shop there is no event date, so a question's own age is the clock —
    // its answer was needed while the asker still cared, not forever.
    const eraseAskers = db.prepare(
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
         )`
    );
    const askersErased = eraseAskers.run(ERASED_BUYER_NAME, ERASED_BUYER_EMAIL, cutoff, cutoff).changes;

    // Waitlist addresses are DELETED rather than overwritten: unlike an order,
    // a waitlist row reconciles no money and mints no ticket — the email IS
    // the row, so keeping an emptied husk would preserve nothing.
    //
    // Three clocks, one per way a row stops having a job:
    //  - NOTIFIED rows: the single promised email has gone out, so the
    //    address's only job is done. WAITLIST_NOTIFIED_RETENTION_DAYS of grace
    //    covers "my mail bounced, what happened?" before the form's "deleted
    //    afterwards" promise comes due.
    //  - UNNOTIFIED rows on a past event: the notify sweep refuses events past
    //    their date, so this address can never earn its email — waiting longer
    //    changes nothing, and holding data that can never be used is exactly
    //    what this sweep exists to stop. A SHOP row deliberately stays: a shop
    //    can restock any day, so an unnotified shop address still has its job.
    //  - Anything on an event whose BUYERS are being erased (same cutoff as
    //    the orders above): whatever the other clocks say, someone who only
    //    typed an email must never outlive the people who actually paid.
    const waitlistDeleted = db
      .prepare(
        `DELETE FROM waitlist
         WHERE (notified_at IS NOT NULL
                AND date(notified_at) <= date('now', '-${WAITLIST_NOTIFIED_RETENTION_DAYS} days'))
            OR (notified_at IS NULL AND event_id IN (
                  SELECT id FROM events
                  WHERE kind != 'shop' AND event_date IS NOT NULL AND date(event_date) < date('now')
                ))
            OR event_id IN (
                  SELECT id FROM events
                  WHERE kind != 'shop' AND event_date IS NOT NULL AND date(event_date) <= date('now', ?)
                )`
      )
      .run(cutoff).changes;

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
    const pendingConsentsDeleted = db
      .prepare(
        `DELETE FROM marketing_consents
         WHERE confirmed_at IS NULL AND unsubscribed_at IS NULL
           AND date(consented_at) <= date('now', '-${BUYER_RETENTION_DAYS} days')`
      )
      .run().changes;
    if (pendingConsentsDeleted > 0) {
      console.log(`Retention sweep: deleted ${pendingConsentsDeleted} unconfirmed keep-me-posted request(s).`);
    }
    if (erased > 0) console.log(`Retention sweep: erased buyer details on ${erased} order(s).`);
    if (askersErased > 0) {
      console.log(`Retention sweep: erased the asker on ${askersErased} question(s).`);
    }
    if (waitlistDeleted > 0) {
      console.log(`Retention sweep: deleted ${waitlistDeleted} waitlist address(es).`);
    }
    return { erased };
  } catch (e) {
    console.error('Buyer data retention sweep failed:', e);
    return { erased: 0 };
  } finally {
    sweeping = false;
  }
}
