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
import { ANONYMOUS_BUYER_NAME } from './retention';

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

/**
 * What a buyer is called once lib/retention.ts has erased their details. The
 * erased row keeps a placeholder NAME and ADDRESS in the database so the
 * columns stay non-null; neither may ever reach a screen, so every read model
 * here degrades to this one label instead. It lives beside the placeholders it
 * replaces (lib/retention.ts) and is imported here, so the referrer summary,
 * the chain underneath it and the orders list can never anonymise people
 * differently.
 */
const ANONYMOUS_BUYER = ANONYMOUS_BUYER_NAME;

/**
 * One booking that arrived through somebody's link — a single link in the
 * chain, as opposed to the totals in ReferrerRow.
 */
export interface ReferredBookingRow {
  /** This listing's order, for a stable React key — never rendered. */
  orderId: string;
  /** The referred buyer's name, or the anonymous label once erased. */
  name: string;
  /** The day it was CONFIRMED ('YYYY-MM-DD'), falling back to when it was placed. */
  confirmedOn: string;
  /** What the booking was worth. */
  totalCents: number;
  /** Seats/items it brought — QR codes minted, one scan each. */
  units: number;
  /**
   * How many confirmed bookings THIS PERSON went on to bring to this same
   * listing — the depth of the chain, and 0 for almost everyone.
   *
   * Counted per BUYER, not per order: a repeat buyer's share link comes from
   * their newest order, so the friends they bring arrive carrying that order's
   * code while this row is some older order of theirs. Keying on one order's
   * code showed exactly the people who refer most as "0 onward". It is the sum
   * over every share_code that buyer owns with this seller, so both of their
   * rows in one chain always read the same number.
   *
   * 0 for a buyer the retention sweep has erased: their address is a shared
   * placeholder, and summing on it would merge every erased buyer into one
   * imaginary, very busy person.
   *
   * Visibility only. It changes nobody's reward: a voucher is earned for
   * DIRECT referrals and nothing else (see lib/referrals paidReferralSql), and
   * the page that shows this number says so.
   */
  broughtOnward: number;
}

/**
 * One referring BUYER: how many confirmed bookings their shared links brought
 * in — every code they own with this seller summed into one row, because a
 * repeat buyer mints a new share_code with every order and is still one person.
 */
export interface ReferrerRow {
  /** The referrer's display name, or 'a past guest' once retention erased them. */
  name: string;
  /** CONFIRMED bookings that arrived through their link. */
  referredOrders: number;
  /** Seats/items those orders brought — QR codes minted, one scan each. */
  referredSeats: number;
  /** WHO those bookings were, newest first — at most REFERRED_BOOKINGS_CAP of them. */
  bookings: ReferredBookingRow[];
  /**
   * Bookings this row's totals count but the list above does not show. Never
   * dropped silently: the page prints "and N more" so the table and the count
   * beside the name cannot look like they disagree.
   */
  moreBookings: number;
}

/**
 * The whole referral card for one listing: the referrers it lists, and how
 * many it had to leave out.
 *
 * An object rather than a bare array because the cap has to be SAYABLE. This
 * page is opened often and a popular listing can carry hundreds of referrers
 * with a booking each; rendering all of them (and every booking under each)
 * buries the summary an organizer came for and makes the DOM the slowest thing
 * on the page. Truncating without saying so would instead be a quiet lie about
 * who brought people.
 */
export interface ReferralChain {
  referrers: ReferrerRow[];
  /** Referrers the cap left out — 0 when the list is complete. */
  moreReferrers: number;
}

/** How many referrers one card lists, and how many bookings under each. */
export const REFERRER_LIST_CAP = 20;
export const REFERRED_BOOKINGS_CAP = 10;

/**
 * Who brought friends: confirmed bookings grouped by the referral code they
 * arrived with, resolved back to the referring buyer — and then to the PERSON,
 * so somebody who has bought twice is one row and not two.
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
 *
 * Each row also carries the CHAIN: the individual bookings behind its totals,
 * so the organizer can see who a referrer actually brought and not just how
 * many. Same listing, same rule, same anonymisation — it is the rows the
 * counts were summed from, not a second, looser query.
 *
 * FOUR queries, whatever the numbers, and none of them per code. Resolving
 * each referrer's name with its own lookup was an N+1 over orders.share_code
 * — a full table scan each, on a page organizers open constantly — so the
 * owners of every code on this listing are read in ONE grouped query, which
 * doubles as the ownership map the onward counts are summed over.
 */
export function topReferrers(eventId: string): ReferralChain {
  const db = getDb();
  // The seller this listing belongs to. A code is spendable across all of
  // their listings (see lib/referrals), so ownership is resolved at that
  // scope — and never one step wider: another seller's buyers are their own
  // business.
  const owner = db
    .prepare(`SELECT organizer_id AS organizerId FROM events WHERE id = ?`)
    .get(eventId) as { organizerId: string } | undefined;
  if (!owner) return { referrers: [], moreReferrers: 0 };

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
       ORDER BY referredOrders DESC, referredSeats DESC, code`
    )
    .all(eventId) as { code: string; referredOrders: number; referredSeats: number }[];

  // WHO owns each of those codes, in one query instead of one per code.
  // Grouped by the code so a duplicate can be SEEN rather than silently
  // resolved to whichever row came back first: `owners` is how many paid
  // orders of this seller carry it, and only exactly one names a person. The
  // aggregates over name/email/erased are read only in that case, where each
  // is simply that one row's value.
  const ownerRows = db
    .prepare(
      `SELECT r.share_code AS code,
              COUNT(*) AS owners,
              MIN(r.buyer_name) AS name,
              MIN(lower(r.buyer_email)) AS email,
              MAX(CASE WHEN r.buyer_erased_at IS NULL THEN 0 ELSE 1 END) AS erased
       FROM orders r
       JOIN events re ON re.id = r.event_id
       WHERE re.organizer_id = ?
         AND r.status = 'paid'
         AND r.share_code != ''
         AND r.share_code IN (
           SELECT o.referred_by FROM orders o
           WHERE o.event_id = ? AND ${confirmedReferralSql('o')}
             AND o.referred_by != ''
         )
       GROUP BY r.share_code`
    )
    .all(owner.organizerId, eventId) as {
    code: string;
    owners: number;
    name: string;
    email: string;
    erased: number;
  }[];
  const ownerByCode = new Map(ownerRows.map((r) => [r.code, r]));

  /** Exactly one un-erased paid order carries this code, so it names a person. */
  const identified = (code: string) => {
    const row = ownerByCode.get(code);
    return row && row.owners === 1 && !row.erased ? row : null;
  };

  // One row per PERSON, not per code. A repeat buyer mints a fresh share_code
  // with every order, so counting by code split one referrer into several
  // part-rows — and left the "and brought N of their own" note below unable to
  // agree with any of them. Their codes are summed into one row instead, which
  // is also what makes that note reconcilable: the number under a chain entry
  // is exactly the number beside that person's own row.
  //
  // A code with no identifiable owner — erased, vanished, duplicated, or
  // carrying a blank address — is its own row and joins nobody. Merging on a
  // shared erasure placeholder would build one imaginary, very busy person,
  // which is the thing the erasure rule exists to prevent.
  interface Group {
    key: string;
    codes: string[];
    name: string;
    email: string;
    referredOrders: number;
    referredSeats: number;
  }
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const person = identified(r.code);
    const email = person?.email || '';
    const key = email ? `email:${email}` : `code:${r.code}`;
    const g = groups.get(key) ?? {
      key,
      codes: [],
      name: person?.name?.trim() || ANONYMOUS_BUYER,
      email,
      referredOrders: 0,
      referredSeats: 0,
    };
    g.codes.push(r.code);
    g.referredOrders += r.referredOrders;
    g.referredSeats += r.referredSeats;
    groups.set(key, g);
  }
  // Biggest first, with the key as the last tiebreak so a cap cannot make the
  // list jump about between two loads that are actually identical.
  const ranked = [...groups.values()].sort(
    (a, b) =>
      b.referredOrders - a.referredOrders ||
      b.referredSeats - a.referredSeats ||
      a.key.localeCompare(b.key)
  );

  // How far the chain goes, PER PERSON — the same total their own row above
  // shows, read by address so a chain entry can find it.
  const onwardByPerson = new Map<string, number>();
  for (const g of ranked) {
    if (g.email) onwardByPerson.set(g.email, g.referredOrders);
  }

  // Only the referrers actually listed get their chain read: the rest are
  // reported as a count, so there is nothing to show under them.
  const listed = ranked.slice(0, REFERRER_LIST_CAP);
  const codes = listed.flatMap((g) => g.codes);

  // The chain itself: every confirmed booking that arrived through one of the
  // listed codes, one row each — the same rows the totals query summed, read
  // individually. Grouped by o.id so the LEFT JOIN onto tickets can count
  // seats without fanning the money out: one order, one row, whatever its
  // party size.
  const bookingRows = codes.length
    ? (db
        .prepare(
          `SELECT o.id AS orderId,
                  o.referred_by AS code,
                  o.buyer_name AS name,
                  lower(o.buyer_email) AS email,
                  o.buyer_erased_at AS erasedAt,
                  date(COALESCE(o.paid_at, o.created_at)) AS confirmedOn,
                  o.total_cents AS totalCents,
                  COUNT(t.code) AS units
           FROM orders o
           LEFT JOIN tickets t ON t.order_id = o.id
           WHERE o.event_id = ? AND ${confirmedReferralSql('o')}
             AND o.referred_by IN (${codes.map(() => '?').join(',')})
           GROUP BY o.id
           ORDER BY confirmedOn DESC, o.id`
        )
        .all(eventId, ...codes) as {
        orderId: string;
        code: string;
        name: string;
        email: string;
        erasedAt: string | null;
        confirmedOn: string;
        totalCents: number;
        units: number;
      }[])
    : [];

  // Which listed referrer each code belongs to, so one buyer's several codes
  // pour into ONE chain — in the order the query returned them, which is
  // newest first across all of them.
  const groupOfCode = new Map<string, string>();
  for (const g of listed) for (const code of g.codes) groupOfCode.set(code, g.key);

  const chainByGroup = new Map<string, ReferredBookingRow[]>();
  for (const b of bookingRows) {
    const key = groupOfCode.get(b.code);
    if (!key) continue;
    const list = chainByGroup.get(key) ?? [];
    chainByGroup.set(key, list);
    // Past the cap the row is counted (moreBookings, below) and not built —
    // the count beside the referrer's name still comes from the totals query,
    // so nothing about the arithmetic changes here.
    if (list.length >= REFERRED_BOOKINGS_CAP) continue;
    list.push({
      orderId: b.orderId,
      // Erased first: the sweep leaves a placeholder NAME behind, and printing
      // it would be worse than useless — it would look like a person.
      name: b.erasedAt ? ANONYMOUS_BUYER : b.name?.trim() || ANONYMOUS_BUYER,
      confirmedOn: b.confirmedOn,
      totalCents: b.totalCents,
      units: b.units,
      // The PERSON's onward total, not this one order's. An erased buyer has
      // no identity to sum on and stays at 0 — see ReferredBookingRow.
      broughtOnward: b.erasedAt || !b.email ? 0 : onwardByPerson.get(b.email) ?? 0,
    });
  }

  return {
    referrers: listed.map((g) => {
      const bookings = chainByGroup.get(g.key) ?? [];
      return {
        name: g.name,
        referredOrders: g.referredOrders,
        referredSeats: g.referredSeats,
        bookings,
        moreBookings: Math.max(0, g.referredOrders - bookings.length),
      };
    }),
    moreReferrers: ranked.length - listed.length,
  };
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
