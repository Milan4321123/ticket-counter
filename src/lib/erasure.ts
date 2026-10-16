// Server-only: erasure and access ON REQUEST — the manual half of GDPR that
// the automatic sweeps in lib/retention.ts cannot do.
//
// Three jobs, each the whole of one legal duty:
//
//   1. erasePersonEverywhere(email) — "delete everything you hold about me"
//      (Art. 17). One address, every table it can appear in, one report of
//      what happened in each. The admin erase panel is its only caller.
//
//   2. collectPersonalData(email) — "tell me what you hold about me" / "give
//      me my data" (Art. 15 / 20). The SAME table list as (1), read instead of
//      written, so the export can never quietly miss a table the erasure
//      knows about. The signed-in customer's /account download is its caller.
//
//   3. deleteOrganizerPermanently(id) — the processor's duty to delete the
//      controller's data when the contract ends (Art. 28(3)(g)): an organizer
//      (a Verein, a shop) is the controller of its buyers' data and the
//      platform processes it for them. Every listing, every buyer row, every
//      file on disk, every organizer-scoped record, then the account itself.
//
// Orders are ANONYMISED, never deleted, by (1) — exactly the way the
// retention sweep does it (ERASE_ORDER_BUYER_SQL), because the seller's
// counts, money and check-in history are the seller's bookkeeping and have to
// keep adding up. (3) deletes them outright: when the seller goes, so do their
// books.
import { getDb } from './db';
import { eraseCustomerCards } from './cards';
import { communityExport } from './communityData';
import { customerAccountRow, deleteCustomersByEmail, getCustomerBasket } from './customers';
import { deleteEventCompletely, tablesWithColumn } from './events';
import { eraseMarketingConsent } from './marketing';
import { paymentReference } from './orders';
import {
  BUYER_RETENTION_DAYS,
  COMMUNITY_REPORT_RETENTION_DAYS,
  CONTACT_REQUEST_RETENTION_DAYS,
  CONVERSATION_RETENTION_DAYS,
  CUSTOMER_INACTIVE_DAYS,
  HELP_POST_RETENTION_DAYS,
  MEETUP_RETENTION_DAYS,
  ERASED_BUYER_EMAIL,
  ERASED_BUYER_NAME,
  ERASE_ORDER_BUYER_SQL,
  REFERRAL_VOUCHER_RETENTION_DAYS,
  SHOP_UNCOLLECTED_LONG_STOP_DAYS,
  SUBSCRIPTION_ENDED_RETENTION_DAYS,
  UNDATED_ORDER_RETENTION_DAYS,
  WAITLIST_NOTIFIED_RETENTION_DAYS,
  WAITLIST_SHOP_MAX_DAYS,
} from './retention';
import { anonymizeReviewsForOrder } from './reviews';

/** Statuses in which an unpaid order can still become paid (see lib/orders). */
const IN_FLIGHT = ['pending', 'claimed', 'capturing'] as const;

function normalise(email: string): string {
  return (email || '').trim();
}

// ---------------------------------------------------------------------------
// 1. Erase one person everywhere
// ---------------------------------------------------------------------------

/** An order the erasure deliberately left alone, and why — for the admin to act on. */
export interface OrderLeftAlone {
  orderId: string;
  reference: string;
  eventName: string;
  status: string;
  createdAt: string;
}

/** What erasePersonEverywhere did, table by table. Every number is rows touched. */
export interface PersonErasureReport {
  email: string;
  /** Orders whose buyer name, email, phone, payer name and note were erased. */
  orders: number;
  /**
   * Orders NOT touched because they can still become paid: erasing the buyer
   * would make a late transfer impossible to confirm (lib/orders refuses to
   * confirm an erased order, since the tickets could never be delivered).
   * The admin cancels these first, then runs the erasure again.
   */
  ordersInFlight: OrderLeftAlone[];
  /** Reviews that lost their author's name (the words stay, as with the sweep). */
  reviews: number;
  /** Subscribe & save standing orders deleted. */
  subscriptions: number;
  /** Customer accounts deleted, with their saved baskets and pending sign-in codes. */
  customers: number;
  baskets: number;
  loginCodes: number;
  /** Referral vouchers whose referrer address was erased (the codes keep working). */
  voucherEmails: number;
  contactRequests: number;
  waitlist: number;
  /** Questions this person asked that were never answered — deleted outright. */
  questionsDeleted: number;
  /** Answered (public) questions that lost their asker; the Q&A itself stays. */
  questionsAnonymised: number;
  /** Keep-me-posted consents AND suppression records, with their send log. */
  marketingConsents: number;
  customerCards: number;
  /** True when this address also owns an organizer account — not touched here. */
  organizerAccount: boolean;
}

/**
 * Erase everything held about one email address, across every table, in one
 * transaction — the button behind "erase my record entirely".
 *
 * Orders are the one place this is careful rather than blunt. A PAID or DEAD
 * order is anonymised exactly like the retention sweep does it (and its
 * reviews lose their byline), whatever its date: the person asked, the money
 * is settled, and the ticket codes still scan at the door without a name.
 * An order still AWAITING PAYMENT is left alone and reported instead: erasing
 * it would make the buyer's transfer, if it arrives, impossible to confirm —
 * the admin cancels it first and runs this again.
 *
 * Tickets hold no name of their own (only a code, a tier and a check-in
 * time), so there is nothing on them to erase.
 */
export function erasePersonEverywhere(rawEmail: string): PersonErasureReport {
  const email = normalise(rawEmail);
  if (!email || !email.includes('@')) throw new Error('An email address is needed.');
  const db = getDb();

  const report: PersonErasureReport = {
    email,
    orders: 0,
    ordersInFlight: [],
    reviews: 0,
    subscriptions: 0,
    customers: 0,
    baskets: 0,
    loginCodes: 0,
    voucherEmails: 0,
    contactRequests: 0,
    waitlist: 0,
    questionsDeleted: 0,
    questionsAnonymised: 0,
    marketingConsents: 0,
    customerCards: 0,
    organizerAccount: false,
  };

  db.transaction(() => {
    // --- Orders ---------------------------------------------------------
    const orders = db
      .prepare(
        `SELECT o.id, o.status, o.created_at AS createdAt, COALESCE(e.name, '') AS eventName
         FROM orders o LEFT JOIN events e ON e.id = o.event_id
         WHERE o.buyer_email = ? COLLATE NOCASE AND o.buyer_erased_at IS NULL`
      )
      .all(email) as { id: string; status: string; createdAt: string; eventName: string }[];
    const erase = db.prepare(ERASE_ORDER_BUYER_SQL);
    for (const o of orders) {
      if ((IN_FLIGHT as readonly string[]).includes(o.status)) {
        report.ordersInFlight.push({
          orderId: o.id,
          reference: paymentReference(o.id),
          eventName: o.eventName,
          status: o.status,
          createdAt: o.createdAt,
        });
        continue;
      }
      report.orders += erase.run(ERASED_BUYER_NAME, ERASED_BUYER_EMAIL, o.id).changes;
      report.reviews += anonymizeReviewsForOrder(o.id);
    }

    // --- Subscriptions: a standing order is the person's own instruction ----
    report.subscriptions = db.prepare(`DELETE FROM subscriptions WHERE buyer_email = ? COLLATE NOCASE`).run(email).changes;

    // --- Customer account, basket, sign-in codes ----------------------------
    const acc = deleteCustomersByEmail(email);
    report.customers = acc.customers;
    report.baskets = acc.baskets;
    report.loginCodes = acc.loginCodes;

    // --- Referral vouchers: the code stays spendable, the owner goes --------
    // Their referral COUNT goes with their orders above (countPaidReferrals
    // only counts un-erased referring orders), so dropping the address from
    // vouchers too keeps "earned minus held" balanced at zero.
    report.voucherEmails = db
      .prepare(`UPDATE referral_vouchers SET referrer_email = NULL WHERE referrer_email = ? COLLATE NOCASE`)
      .run(email).changes;

    // --- Contact form, waitlists --------------------------------------------
    report.contactRequests = db.prepare(`DELETE FROM contact_requests WHERE email = ? COLLATE NOCASE`).run(email).changes;
    report.waitlist = db.prepare(`DELETE FROM waitlist WHERE email = ? COLLATE NOCASE`).run(email).changes;

    // --- Questions: unanswered ones go entirely, answered ones lose the asker
    report.questionsDeleted = db
      .prepare(`DELETE FROM event_questions WHERE asker_email = ? COLLATE NOCASE AND status <> 'answered'`)
      .run(email).changes;
    report.questionsAnonymised = db
      .prepare(
        `UPDATE event_questions
         SET asker_name = ?, asker_email = ?, asker_erased_at = COALESCE(asker_erased_at, datetime('now'))
         WHERE asker_email = ? COLLATE NOCASE`
      )
      .run(ERASED_BUYER_NAME, ERASED_BUYER_EMAIL, email).changes;

    // --- The two records that outlive retention on purpose ------------------
    // (lib/marketing and lib/cards own their deletes; both are FK-safe.)
    report.marketingConsents = eraseMarketingConsent(email);
    report.customerCards = eraseCustomerCards(email);

    report.organizerAccount = Boolean(
      db.prepare(`SELECT 1 FROM organizers WHERE email = ? COLLATE NOCASE`).get(email)
    );
  })();

  return report;
}

// ---------------------------------------------------------------------------
// 2. Everything held about one person (Art. 15 / 20)
// ---------------------------------------------------------------------------

/** The retention rules, restated in the export so the person can read them beside their data. */
function retentionNotes(): Record<string, string> {
  return {
    orders: `Orders belong to the seller you bought from (they are the controller of that data). Your name, email, phone, payer name and order note are erased ${BUYER_RETENTION_DAYS} days after the event; for shops ${BUYER_RETENTION_DAYS} days after collection (at the latest ${SHOP_UNCOLLECTED_LONG_STOP_DAYS} days after payment); for listings without a date ${UNDATED_ORDER_RETENTION_DAYS} days after the order.`,
    account: `Your customer account is deleted after ${CUSTOMER_INACTIVE_DAYS} days without a sign-in, or when you delete it on /account.`,
    subscriptions: `A cancelled subscription is deleted ${SUBSCRIPTION_ENDED_RETENTION_DAYS} days after it ended.`,
    waitlist: `A waitlist address is deleted ${WAITLIST_NOTIFIED_RETENTION_DAYS} days after its one email, after the event, or ${WAITLIST_SHOP_MAX_DAYS} days after signing up for a shop.`,
    questions: `Unanswered questions are deleted, and your name/email on answered ones erased, ${BUYER_RETENTION_DAYS} days after the event.`,
    contactRequests: `Contact-form messages are deleted ${CONTACT_REQUEST_RETENTION_DAYS} days after they arrived.`,
    referralVouchers: `Your address on a spent voucher is erased ${REFERRAL_VOUCHER_RETENTION_DAYS} days after it was spent (later only while you still have an order with that seller, because your referral count depends on it).`,
    marketing: 'A confirmed keep-me-posted consent lasts until you unsubscribe or ask for erasure; an unsubscribe is kept as a do-not-email record.',
    community: `Community: a meetup with its participants and chat is deleted ${MEETUP_RETENTION_DAYS} days after it took place; a help post with its conversations ${HELP_POST_RETENTION_DAYS} days after it left the board; a conversation ${CONVERSATION_RETENTION_DAYS} days after its last message; a handled report ${COMMUNITY_REPORT_RETENTION_DAYS} days after the decision. Leaving the community or deleting your account deletes all of it at once.`,
  };
}

/**
 * Everything held about this email address, as plain JSON-able data.
 *
 * The caller must already have PROVEN the address (a signed-in customer's
 * account is a verified mailbox — lib/customers). Nothing here checks it: an
 * unverified address would be a way to read somebody else's orders, which is
 * exactly the hole lib/buyerAccount exists to close.
 *
 * Deliberately left out: the SELLER's data that sits on the same rows (their
 * payout account on an order, their internal ids) and secrets that are the
 * platform's, not the person's. Ticket codes, card codes and voucher codes
 * ARE included — they are the person's own.
 */
export function collectPersonalData(rawEmail: string) {
  const email = normalise(rawEmail);
  const db = getDb();

  const orderRows = (
    db
      .prepare(
        `SELECT o.id, o.status, o.created_at AS createdAt, o.paid_at AS paidAt,
                o.buyer_name AS buyerName, o.buyer_email AS buyerEmail, o.buyer_phone AS buyerPhone,
                o.payer_name AS payerName, o.order_note AS orderNote, o.pickup_slot AS pickupSlot,
                o.table_label AS tableLabel, o.item_choices AS itemChoices,
                o.total_cents AS totalCents, o.discount_cents AS discountCents, o.currency,
                o.payment_mode AS paymentMode, o.voucher_code AS discountCode,
                o.share_code AS shareCode, o.referred_by AS referredBy,
                e.name AS listing, e.slug AS listingSlug, e.kind AS listingKind,
                e.event_date AS eventDate, org.name AS seller
         FROM orders o
         LEFT JOIN events e ON e.id = o.event_id
         LEFT JOIN organizers org ON org.id = e.organizer_id
         WHERE o.buyer_email = ? COLLATE NOCASE AND o.buyer_erased_at IS NULL
         ORDER BY o.created_at DESC`
      )
      .all(email) as Record<string, unknown>[]
  );
  const orderIds = orderRows.map((o) => String(o.id));
  const orders = orderRows.map((o) => {
    const id = String(o.id);
    return {
      ...o,
      paymentReference: paymentReference(id),
      items: db
        .prepare(
          `SELECT oi.tier_id AS item, COALESCE(t.name, oi.tier_id) AS name, oi.quantity, oi.unit_price_cents AS unitPriceCents
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           LEFT JOIN event_tiers t ON t.event_id = o.event_id AND t.tier_key = oi.tier_id
           WHERE oi.order_id = ?`
        )
        .all(id),
      tickets: db
        .prepare(
          `SELECT code, tier_id AS item, created_at AS issuedAt, checked_in_at AS checkedInAt
           FROM tickets WHERE order_id = ? ORDER BY created_at`
        )
        .all(id),
    };
  });

  const reviews =
    orderIds.length === 0
      ? []
      : (db
          .prepare(
            `SELECT r.order_id AS orderId, e.name AS listing, r.tier_key AS item, r.rating, r.body,
                    r.author_name AS signedAs, r.status, r.created_at AS createdAt, r.updated_at AS updatedAt,
                    r.seller_reply AS sellerReply
             FROM item_reviews r LEFT JOIN events e ON e.id = r.event_id
             WHERE r.order_id IN (${orderIds.map(() => '?').join(',')})`
          )
          .all(...orderIds) as Record<string, unknown>[]);

  return {
    email,
    exportedAt: new Date().toISOString(),
    about: retentionNotes(),
    orders,
    reviews,
    subscriptions: db
      .prepare(
        `SELECT s.buyer_name AS name, s.buyer_email AS email, e.name AS listing, s.items, s.choices, s.note,
                s.every_days AS everyDays, s.discount_pct AS discountPct, s.next_on AS nextOn, s.status,
                s.status_note AS statusNote, s.orders_made AS ordersMade, s.created_at AS createdAt,
                s.updated_at AS updatedAt
         FROM subscriptions s LEFT JOIN events e ON e.id = s.event_id
         WHERE s.buyer_email = ? COLLATE NOCASE`
      )
      .all(email),
    customerCards: db
      .prepare(
        `SELECT org.name AS seller, c.email, c.card_code AS cardCode, c.created_at AS createdAt,
                c.last_seen_at AS lastSeenAt, c.closed_at AS closedAt
         FROM customer_cards c LEFT JOIN organizers org ON org.id = c.organizer_id
         WHERE c.email = ? COLLATE NOCASE`
      )
      .all(email),
    marketingConsents: db
      .prepare(
        `SELECT org.name AS seller, m.email, m.consented_at AS requestedAt, m.confirmed_at AS confirmedAt,
                m.unsubscribed_at AS unsubscribedAt,
                (SELECT COUNT(*) FROM marketing_sends s WHERE s.consent_id = m.id) AS announcementsSent
         FROM marketing_consents m LEFT JOIN organizers org ON org.id = m.organizer_id
         WHERE m.email = ? COLLATE NOCASE`
      )
      .all(email),
    waitlist: db
      .prepare(
        `SELECT e.name AS listing, w.email, w.created_at AS joinedAt, w.notified_at AS notifiedAt
         FROM waitlist w LEFT JOIN events e ON e.id = w.event_id
         WHERE w.email = ? COLLATE NOCASE`
      )
      .all(email),
    questions: db
      .prepare(
        `SELECT e.name AS listing, q.question, q.answer, q.status, q.asker_name AS name, q.asker_email AS email,
                q.asked_at AS askedAt, q.answered_at AS answeredAt
         FROM event_questions q LEFT JOIN events e ON e.id = q.event_id
         WHERE q.asker_email = ? COLLATE NOCASE`
      )
      .all(email),
    referralVouchers: db
      .prepare(
        `SELECT org.name AS seller, v.code, v.amount_cents AS amountCents, v.earned_at AS earnedAt,
                v.redeemed_at AS redeemedAt
         FROM referral_vouchers v LEFT JOIN organizers org ON org.id = v.organizer_id
         WHERE v.referrer_email = ? COLLATE NOCASE`
      )
      .all(email),
    contactRequests: db
      .prepare(
        `SELECT name, email, phone, organization, message, kind, status, created_at AS createdAt
         FROM contact_requests WHERE email = ? COLLATE NOCASE`
      )
      .all(email),
  };
}

/** The signed-in customer's whole export: their account and basket, everything under their address, and their community data. */
export function customerDataExport(customer: { id: string; email: string }) {
  return {
    account: customerAccountRow(customer.id),
    basket: getCustomerBasket(customer.id),
    ...collectPersonalData(customer.email),
    community: communityExport(getDb(), customer.id),
  };
}

// ---------------------------------------------------------------------------
// Contact inbox
// ---------------------------------------------------------------------------

/** Delete one contact-form request outright (admin inbox). False when it was already gone. */
export function deleteContactRequest(id: string): boolean {
  return getDb().prepare(`DELETE FROM contact_requests WHERE id = ?`).run(id).changes > 0;
}

// ---------------------------------------------------------------------------
// 3. Delete an organizer and everything they own (Art. 28(3)(g))
// ---------------------------------------------------------------------------

export interface OrganizerDeletionReport {
  organizerId: string;
  events: number;
  orders: number;
  tickets: number;
  media: number;
  reviews: number;
  waitlist: number;
  subscriptions: number;
  payoutChanges: number;
  marketingConsents: number;
  customerCards: number;
  promoCodes: number;
  referralVouchers: number;
  paymentConnections: number;
  contactRequests: number;
  /** Every other organizer-scoped row (sessions, reset codes, anything added later). */
  otherRows: number;
}

/** A refusal the admin can read as-is. */
export class OrganizerDeletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrganizerDeletionError';
  }
}

/**
 * The admin's "Delete organizer permanently": refused unless the account is
 * already DISABLED (so nobody is signed in and nothing is being sold while it
 * goes) and the admin typed the account's email address exactly. Both guards
 * live here rather than in the route, so no future caller can skip them.
 */
export function deleteOrganizerPermanently(organizerId: string, typedEmail: string): OrganizerDeletionReport {
  const row = getDb()
    .prepare(`SELECT email, status FROM organizers WHERE id = ?`)
    .get(organizerId) as { email: string; status: string } | undefined;
  if (!row) throw new OrganizerDeletionError('This organizer account no longer exists.');
  if (row.status !== 'disabled') {
    throw new OrganizerDeletionError('Disable the account first — only a disabled organizer can be deleted.');
  }
  if (normalise(typedEmail).toLowerCase() !== row.email.trim().toLowerCase()) {
    throw new OrganizerDeletionError('Type the organizer’s email address exactly to confirm.');
  }
  return purgeOrganizer(organizerId);
}

/**
 * Delete an organizer and every row and file they own. NO guards — callers
 * own the authorization (deleteOrganizerPermanently above; the demo sweep,
 * which checks is_demo first).
 *
 * Listings go one at a time through deleteEventCompletely — the single place
 * that knows how to take a listing apart (orders, tickets, reviews, waitlists,
 * subscriptions, media files, stall links, …). Then the organizer-scoped rows,
 * then the account, in one transaction. If a listing fails to delete, this
 * throws before the account is touched: the admin sees the error, the
 * account stays disabled, and a retry picks up where it stopped.
 */
export function purgeOrganizer(organizerId: string): OrganizerDeletionReport {
  const db = getDb();
  const report: OrganizerDeletionReport = {
    organizerId,
    events: 0,
    orders: 0,
    tickets: 0,
    media: 0,
    reviews: 0,
    waitlist: 0,
    subscriptions: 0,
    payoutChanges: 0,
    marketingConsents: 0,
    customerCards: 0,
    promoCodes: 0,
    referralVouchers: 0,
    paymentConnections: 0,
    contactRequests: 0,
    otherRows: 0,
  };

  const events = db.prepare(`SELECT id FROM events WHERE organizer_id = ?`).all(organizerId) as { id: string }[];
  for (const { id } of events) {
    const s = deleteEventCompletely(id);
    report.events += 1;
    report.orders += s.orders;
    report.tickets += s.tickets;
    report.media += s.media;
    report.reviews += s.reviews;
    report.waitlist += s.waitlist;
    report.subscriptions += s.subscriptions;
    report.payoutChanges += s.payoutChanges;
  }

  const has = (table: string) =>
    Boolean(db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table));

  db.transaction(() => {
    // The consent book is per organizer; its send log references it (FK).
    db.prepare(
      `DELETE FROM marketing_sends WHERE consent_id IN (SELECT id FROM marketing_consents WHERE organizer_id = ?)`
    ).run(organizerId);
    report.marketingConsents = db.prepare(`DELETE FROM marketing_consents WHERE organizer_id = ?`).run(organizerId).changes;
    report.customerCards = db.prepare(`DELETE FROM customer_cards WHERE organizer_id = ?`).run(organizerId).changes;
    report.promoCodes = db.prepare(`DELETE FROM promo_codes WHERE organizer_id = ?`).run(organizerId).changes;
    report.referralVouchers = db.prepare(`DELETE FROM referral_vouchers WHERE organizer_id = ?`).run(organizerId).changes;
    report.paymentConnections = db
      .prepare(`DELETE FROM organizer_payment_connections WHERE organizer_id = ?`)
      .run(organizerId).changes;
    report.payoutChanges += db.prepare(`DELETE FROM payout_changes WHERE organizer_id = ?`).run(organizerId).changes;
    // The application that created this account names the organizer's people
    // (name, email, phone, message) — it is their data, and goes with them.
    report.contactRequests = db.prepare(`DELETE FROM contact_requests WHERE organizer_id = ?`).run(organizerId).changes;

    // Sessions are signed cookies bound to the account row, so they die with
    // it; the stored codes (reset, sign-in, step-up) are deleted explicitly
    // anyway rather than trusting ON DELETE CASCADE alone.
    for (const table of ['organizer_password_reset', 'organizer_login_code', 'organizer_step_up']) {
      if (has(table)) report.otherRows += db.prepare(`DELETE FROM "${table}" WHERE organizer_id = ?`).run(organizerId).changes;
    }
    // The safety net: any other table with an organizer_id column — a
    // feature added later cannot leave rows behind for an account that no
    // longer exists. Table names come from sqlite_master, never from input.
    // `events` is skipped on purpose: a listing only ever goes through
    // deleteEventCompletely, and one that appeared since the loop above makes
    // the account delete below fail (foreign key) instead of half-deleting.
    for (const table of tablesWithColumn(db, 'organizer_id')) {
      if (table === 'organizers' || table === 'events') continue;
      report.otherRows += db.prepare(`DELETE FROM "${table}" WHERE organizer_id = ?`).run(organizerId).changes;
    }

    db.prepare(`DELETE FROM organizers WHERE id = ?`).run(organizerId);
  })();

  return report;
}
