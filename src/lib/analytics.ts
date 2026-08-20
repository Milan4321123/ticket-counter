// Server-only: read-model queries behind the organizer INSIGHTS page.
//
// Everything here is a rearrangement of data other modules already own —
// lib/orders.ts defines what "paid" and "awaiting" MEAN (its getStats feeds
// the tiles directly), this file only slices the same rows by day, by payment
// method, and by buyer. New queries live here rather than in lib/orders.ts so
// the order machinery never grows read paths it does not itself need.
//
// PRIVACY: every function takes the event (and, where buyers from other
// listings are involved, the organizer) explicitly, and no query ever crosses
// an organizer boundary — an organizer sees only buyers of their OWN listings.
// Erased buyers (lib/retention.ts overwrote their details) are excluded from
// anything that names a person: an erased row still counts money and tickets
// in the stats, but it no longer identifies anyone, and grouping the shared
// placeholder address would invent a single very busy "buyer".
import { getDb } from './db';
import { confirmedReferralSql } from './referrals';

/** One calendar day of confirmed money — real payments only, like getStats. */
export interface DailySales {
  /** 'YYYY-MM-DD' (UTC, matching the datetime('now') stamps in the DB). */
  day: string;
  /** Money confirmed on this day (paid orders, test-mode excluded). */
  revenueCents: number;
  /** Orders confirmed on this day. */
  ordersPaid: number;
}

/**
 * Confirmed revenue grouped by the day the money was CONFIRMED (paid_at) —
 * not the day the order was placed, because until the organizer confirms a
 * transfer there is no money to chart. Orders from before paid_at existed
 * fall back to created_at rather than vanishing.
 */
export function salesByDay(eventId: string): DailySales[] {
  return getDb()
    .prepare(
      `SELECT date(COALESCE(paid_at, created_at)) AS day,
              COALESCE(SUM(total_cents), 0) AS revenueCents,
              COUNT(*) AS ordersPaid
       FROM orders
       WHERE event_id = ? AND status = 'paid' AND payment_mode != 'mock'
       GROUP BY day
       ORDER BY day ASC`
    )
    .all(eventId) as DailySales[];
}

/** Paid orders by how the buyer paid. At most three real methods exist. */
export interface PaymentSplit {
  transfer: number;
  paypal: number;
  free: number;
}

/**
 * How this listing's confirmed orders were paid. Test-mode ('mock') orders
 * are excluded exactly as they are from revenue — they are not a way anyone
 * actually paid.
 */
export function paymentSplit(eventId: string): PaymentSplit {
  const rows = getDb()
    .prepare(
      `SELECT payment_mode AS mode, COUNT(*) AS n
       FROM orders
       WHERE event_id = ? AND status = 'paid' AND payment_mode != 'mock'
       GROUP BY payment_mode`
    )
    .all(eventId) as { mode: string; n: number }[];
  const split: PaymentSplit = { transfer: 0, paypal: 0, free: 0 };
  for (const r of rows) {
    if (r.mode === 'transfer' || r.mode === 'paypal' || r.mode === 'free') split[r.mode] += r.n;
  }
  return split;
}

/** One buyer of this listing, aggregated across all their paid orders. */
export interface BuyerRow {
  name: string;
  email: string;
  /** Paid orders (bookings), not seats. */
  orders: number;
  /** QR codes minted for them — seats or items, one scan each. */
  units: number;
  totalPaidCents: number;
  /** How many of their codes have been scanned. */
  checkedIn: number;
}

/**
 * This listing's buyers, biggest spender first. Built from PAID orders only —
 * a reservation is not a guest yet — and only from rows whose buyer details
 * still exist (see the privacy note at the top of this file).
 *
 * Two grouped queries merged in JS rather than one JOIN: joining tickets onto
 * orders fans each order out to one row per ticket, which would multiply
 * SUM(total_cents) by the party size.
 */
export function listBuyers(eventId: string): BuyerRow[] {
  const db = getDb();
  // The same buyer can type Anna@… once and anna@… the next time; lower()
  // folds those into one person, the same way the organizers table treats
  // email case.
  const orderRows = db
    .prepare(
      `SELECT lower(buyer_email) AS key,
              MAX(buyer_email) AS email,
              MAX(buyer_name) AS name,
              COUNT(*) AS orders,
              COALESCE(SUM(total_cents), 0) AS totalPaidCents
       FROM orders
       WHERE event_id = ? AND status = 'paid' AND payment_mode != 'mock' AND buyer_erased_at IS NULL
       GROUP BY key
       ORDER BY totalPaidCents DESC, orders DESC`
    )
    .all(eventId) as { key: string; email: string; name: string; orders: number; totalPaidCents: number }[];

  const ticketRows = db
    .prepare(
      `SELECT lower(o.buyer_email) AS key,
              COUNT(*) AS units,
              COALESCE(SUM(CASE WHEN t.checked_in_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS checkedIn
       FROM tickets t
       JOIN orders o ON o.id = t.order_id
       WHERE o.event_id = ? AND o.status = 'paid' AND o.payment_mode != 'mock' AND o.buyer_erased_at IS NULL
       GROUP BY key`
    )
    .all(eventId) as { key: string; units: number; checkedIn: number }[];
  const ticketsByBuyer = new Map(ticketRows.map((r) => [r.key, r]));

  return orderRows.map((r) => ({
    name: r.name,
    email: r.email,
    orders: r.orders,
    units: ticketsByBuyer.get(r.key)?.units ?? 0,
    totalPaidCents: r.totalPaidCents,
    checkedIn: ticketsByBuyer.get(r.key)?.checkedIn ?? 0,
  }));
}

/**
 * How many of this listing's buyers also bought from one of THIS organizer's
 * OTHER listings — the "came before" count. Scoped hard to the one organizer
 * on both sides of the match: the inner EXISTS joins through events on
 * organizer_id, so another organizer's buyer list can never leak into the
 * number. Erased rows are excluded on both sides — after erasure every old
 * buyer shares one placeholder address, which would match everyone.
 *
 * Within the data that still exists, by design: buyers of long-past listings
 * have been erased, so this undercounts loyalty rather than over-keeping data.
 */
export function returningBuyerCount(eventId: string, organizerId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(DISTINCT lower(o.buyer_email)) AS n
       FROM orders o
       WHERE o.event_id = ? AND o.status = 'paid' AND o.payment_mode != 'mock' AND o.buyer_erased_at IS NULL
         AND EXISTS (
           SELECT 1
           FROM orders p
           JOIN events e ON e.id = p.event_id
           WHERE e.organizer_id = ?
             AND p.event_id != o.event_id
             AND p.status = 'paid'
             AND p.buyer_erased_at IS NULL
             AND lower(p.buyer_email) = lower(o.buyer_email)
         )`
    )
    .get(eventId, organizerId) as { n: number };
  return row.n;
}

/** One referring buyer: how many confirmed bookings their shared link brought in. */
export interface ReferrerRow {
  /** The referrer's display name, or 'a past guest' once retention erased them. */
  name: string;
  /** CONFIRMED bookings that arrived through their link. */
  referredOrders: number;
  /** Seats/items those orders brought — QR codes minted, one scan each. */
  referredSeats: number;
}

/**
 * Who brought friends: confirmed bookings grouped by the referral code they
 * arrived with, resolved back to the referring buyer's name.
 *
 * Counts what REALLY HAPPENED — confirmed, not test-mode — using the shared
 * fragment in lib/referrals.ts rather than a rule invented here. Deliberately
 * the wider of the two rules that file exports: the narrower one decides who
 * has EARNED a voucher and additionally throws out free reservations and
 * bookings a voucher paid part of, which is right for money and wrong for
 * this table. A free RSVP listing's referrals are real referrals, and an
 * organizer running one must not open Insights to an empty card because
 * nobody paid anything.
 *
 * The referring order is looked up the same way the orders API validated the
 * code (the share_code of a paid order of ANY listing belonging to the SAME
 * SELLER — a random code of its own, never the payment reference's short id,
 * which support treats as weak proof of ownership), so the two can never
 * disagree about who a code belongs to. Per seller and not per event because
 * that is where a code is spendable: somebody who bought at last month's
 * listing and brought a friend to this one is the same referrer, and matching
 * per event would print them as 'a past guest'. A referrer whose buyer details the
 * retention sweep has erased still shows their COUNT — the seats they brought
 * are the organizer's arithmetic — but as 'a past guest', because the person
 * is no longer identifiable and must stay that way.
 */
export function topReferrers(eventId: string): ReferrerRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT o.referred_by AS code,
              COUNT(DISTINCT o.id) AS referredOrders,
              COUNT(t.code) AS referredSeats
       FROM orders o
       LEFT JOIN tickets t ON t.order_id = o.id
       WHERE o.event_id = ? AND ${confirmedReferralSql('o')}
         AND o.referred_by != ''
       GROUP BY o.referred_by
       ORDER BY referredOrders DESC, referredSeats DESC`
    )
    .all(eventId) as { code: string; referredOrders: number; referredSeats: number }[];

  const nameOf = db.prepare(
    `SELECT buyer_name AS name, buyer_erased_at AS erasedAt
     FROM orders
     WHERE share_code = ? AND share_code != '' AND status = 'paid'
       AND event_id IN (
         SELECT id FROM events
         WHERE organizer_id = (SELECT organizer_id FROM events WHERE id = ?)
       )
     LIMIT 2`
  );
  return rows.map((r) => {
    const referrers = nameOf.all(r.code, eventId) as {
      name: string;
      erasedAt: string | null;
    }[];
    // Exactly one un-erased match names a person; anything else — erased,
    // vanished, a code from before share_code existed, or the (astronomically
    // unlikely) duplicated code — stays a guest.
    const referrer = referrers.length === 1 && !referrers[0].erasedAt ? referrers[0] : null;
    return {
      name: referrer?.name?.trim() || 'a past guest',
      referredOrders: r.referredOrders,
      referredSeats: r.referredSeats,
    };
  });
}

/**
 * People currently WAITING on this listing's waitlist — signed up and not yet
 * sent their one "there is space again" email. Notified rows are excluded:
 * their email has gone out, so they are no longer waiting on anything.
 */
export function waitlistWaitingCount(eventId: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM waitlist WHERE event_id = ? AND notified_at IS NULL`)
    .get(eventId) as { n: number };
  return row.n;
}
