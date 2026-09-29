// Server-only: referral REWARDS — turning the referral counting that already
// existed into something an organizer can thank people for.
//
// The counting half is old news and lives in lib/orders.ts: every paid order
// mints a random share_code, and an order that arrived through somebody's
// share link stores that code in referred_by. This file adds the reward half.
//
// WHAT A VOUCHER IS, and what it is not: a DISCOUNT THE ORGANIZER GRANTS ON
// THEIR OWN PRICES. The buyer transfers less money to the organizer, and that
// is the whole of it. The platform is free, never holds, moves, funds, or
// takes a cut of any of this money, and owes nobody anything — nothing here
// may ever be read as the platform paying for a reward.
//
// Deliberately imports lib/db and lib/ticketState and nothing else at runtime
// (ticketState is pure and reaches no further than lib/vocab). lib/orders.ts
// calls INTO this module (to claim and release vouchers while an order is being
// written), so a static import of lib/email.ts here would close the loop
// orders -> referrals -> email -> orders at module-load time; the one function
// that emails reaches for it with a dynamic import instead.
import crypto from 'crypto';
import { getDb } from './db';
import type { EventTierRow } from './events';
import { visibleTiers } from './ticketState';

// ---------------- What counts as a referral (the ONE rule) ----------------

/**
 * A referral that really happened, as a SQL fragment over an `orders` row
 * (pass the alias it is joined under). This is the COUNTING rule — what
 * Insights reports about who brought whom:
 *   - status 'paid'          — a reservation is a promise, not a booking;
 *   - payment_mode != 'mock' — test-mode orders are not real bookings.
 *
 * Deliberately says nothing about money: a free listing's RSVPs are bookings
 * somebody's link genuinely brought in, and an organizer running one must not
 * lose their referral analytics because nobody paid anything.
 */
export function confirmedReferralSql(alias = 'o'): string {
  return `${alias}.status = 'paid' AND ${alias}.payment_mode != 'mock'`;
}

/**
 * The single definition of a referral that has actually been PAID FOR — the
 * REWARD rule, and a strictly narrower thing than the one above. On top of
 * "this booking really happened" it demands two things somebody could
 * otherwise mint rewards out of:
 *   - total_cents > 0        — a free RSVP was never "actually paid";
 *   - voucher_code = ''      — a booking that a CODE paid part of never funds
 *                              the next voucher.
 *
 * That second condition is the whole of "a voucher cannot breed the next one",
 * and it has to be about the CODE, not the leftover total: two addresses with
 * a 40.00 voucher against a 50.00 ticket would otherwise pay 10.00, count the
 * order as a referral, earn the next 40.00 voucher, and run that loop for as
 * long as the organizer let them.
 *
 * It covers an ORGANIZER'S OWN PROMO CODE too, and by construction rather than
 * by luck: a promo is recorded in the same orders.voucher_code column as a
 * voucher (one code per order — see lib/promos.ts), so "part-paid by a code"
 * is one test here, not two that could drift apart. An organizer who hands out
 * a 90%-off code has not thereby created a machine for minting vouchers.
 *
 * Every reward counter — the progress a referrer reads on their order page and
 * the count that decides when a voucher is issued — goes through this one
 * fragment or the predicate below, so the two can never quietly disagree about
 * who earned what.
 */
export function paidReferralSql(alias = 'o'): string {
  return `${confirmedReferralSql(alias)} AND ${alias}.total_cents > 0 AND COALESCE(${alias}.voucher_code, '') = ''`;
}

/** The same rule in TypeScript, for a row already in hand. */
export function countsAsPaidReferral(order: {
  status: string;
  paymentMode: string;
  totalCents: number;
  voucherCode: string;
}): boolean {
  return (
    order.status === 'paid' &&
    order.paymentMode !== 'mock' &&
    order.totalCents > 0 &&
    !(order.voucherCode || '').trim()
  );
}

/**
 * Could a referral to THIS listing ever earn a voucher? The ONE test behind
 * every surface that advertises the offer — the public listing page and the
 * buyer's own order page — so the two cannot advertise different things.
 *
 * Rewards are an ACCOUNT setting, but the promise is read on one listing at a
 * time, and paidReferralSql only counts a booking that was actually paid for.
 * So on a listing where a buyer cannot spend money, no link shared from it can
 * ever qualify, and the offer must not appear at all.
 *
 * Reads the tiers a BUYER can see — the same visible set the page prices
 * itself from (see ticketState visibleTiers/fromPriceCents) — and not every
 * row in the table. A hidden tier is not on the page, cannot be put in a
 * basket, and is often exactly the leftover of last season's paid ticket kept
 * for next time; counting it made a free RSVP listing advertise a thank-you no
 * booking on it could earn. A merely announced tier does count: it is a real,
 * priced thing this listing will sell, and blinking the offer out until the
 * early bird opens would take the offer away precisely while people are
 * sharing the page.
 */
export function referralRewardsReachable(tiers: EventTierRow[]): boolean {
  return visibleTiers(tiers).some((t) => t.priceCents > 0);
}

// ---------------- The organizer's setting ----------------

/** Referrals per voucher — a ceiling, not a target; above this it is not a thank-you. */
export const REFERRAL_THRESHOLD_MAX = 100;
/** Below a euro a "reward" is an insult; above 500 it is probably a typo. */
export const REFERRAL_REWARD_MIN_CENTS = 100;
export const REFERRAL_REWARD_MAX_CENTS = 50_000;

export interface ReferralRewardSettings {
  /** How many confirmed paid referrals earn one voucher. 0 = rewards off. */
  threshold: number;
  /** What one voucher is worth, in cents. 0 = rewards off. */
  rewardCents: number;
  /** Both set: this organizer is rewarding referrals right now. */
  enabled: boolean;
  /**
   * When the CURRENT promise started — referrals older than this earn nothing.
   * Null only for accounts that never switched rewards on. See
   * setReferralRewardSettings for when it moves, and why it has to.
   */
  since: string | null;
}

export const REWARDS_OFF: ReferralRewardSettings = {
  threshold: 0,
  rewardCents: 0,
  enabled: false,
  since: null,
};

export function getReferralRewardSettings(organizerId: string): ReferralRewardSettings {
  const row = getDb()
    .prepare(
      `SELECT referral_threshold AS threshold, referral_reward_cents AS rewardCents,
              referral_rewards_since AS since
       FROM organizers WHERE id = ?`
    )
    .get(organizerId) as { threshold: number; rewardCents: number; since: string | null } | undefined;
  if (!row) return REWARDS_OFF;
  const threshold = Math.max(0, Math.floor(row.threshold || 0));
  const rewardCents = Math.max(0, Math.floor(row.rewardCents || 0));
  return { threshold, rewardCents, enabled: threshold > 0 && rewardCents > 0, since: row.since || null };
}

/**
 * The friendly refusal for a settings pair, or null when it is fine.
 *
 * Zero/zero is the way OFF and always allowed. Half a pair is refused rather
 * than silently completed: a threshold with nothing behind it promises people
 * a reward that never arrives, and a reward nobody can reach is a number in a
 * database. Neither is something to guess at on the organizer's behalf.
 */
export function validateReferralRewardSettings(threshold: number, rewardCents: number): string | null {
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > REFERRAL_THRESHOLD_MAX) {
    return `The number of referrals must be a whole number between 1 and ${REFERRAL_THRESHOLD_MAX} — or 0 to switch rewards off.`;
  }
  if (!Number.isInteger(rewardCents) || rewardCents < 0 || rewardCents > REFERRAL_REWARD_MAX_CENTS) {
    return 'That reward amount does not look right — please enter an amount between 1.00 and 500.00.';
  }
  if (threshold === 0 && rewardCents === 0) return null; // off
  if (threshold === 0) {
    return 'Say how many referrals earn a voucher — or clear the amount too, to switch rewards off.';
  }
  if (rewardCents === 0) {
    return 'Say what one voucher is worth — or set the number of referrals to 0, to switch rewards off.';
  }
  if (rewardCents < REFERRAL_REWARD_MIN_CENTS) {
    return 'A voucher has to be worth at least 1.00 to be worth giving.';
  }
  return null;
}

/**
 * Save the pair — and, when the promise itself changed, restart the clock the
 * counting runs from.
 *
 * WHY a clock exists at all: the number of vouchers somebody should hold is
 * DERIVED from their referral count, so without one, switching rewards on
 * would immediately owe a year of past referrals — an organizer with twenty
 * long-standing referrers could turn on "5 referrals = 10.00" and find
 * themselves granting hundreds of euros of discounts for bookings that
 * happened before they promised anything. The clock makes the promise mean
 * what it says: from today.
 *
 * It moves in exactly two cases:
 *   - OFF -> ON: the promise is new, so nothing before it counts;
 *   - the threshold is LOWERED while on: the same retroactive burst, in
 *     miniature (40 referrals at 10-per-voucher becomes 20 vouchers at
 *     2-per-voucher, all at once).
 * Raising the threshold, or changing only what a voucher is worth, leaves it
 * alone: nobody is owed a pile by either, and restarting the count would take
 * away progress people already made. Vouchers already earned are never
 * touched by any of it — see countVouchersFor, which reads the same window, so
 * the count and the vouchers held against it always describe the same period.
 */
export function setReferralRewardSettings(organizerId: string, threshold: number, rewardCents: number): void {
  const next = { threshold: Math.max(0, Math.floor(threshold)), rewardCents: Math.max(0, Math.floor(rewardCents)) };
  const current = getReferralRewardSettings(organizerId);
  const willBeEnabled = next.threshold > 0 && next.rewardCents > 0;
  const restartClock =
    willBeEnabled && (!current.enabled || !current.since || next.threshold < current.threshold);
  getDb()
    .prepare(
      `UPDATE organizers
       SET referral_threshold = ?, referral_reward_cents = ?
           ${restartClock ? `, referral_rewards_since = datetime('now')` : ''}
       WHERE id = ?`
    )
    .run(next.threshold, next.rewardCents, organizerId);
}

/**
 * The currency a voucher is worth, taken from the organizer's own listings.
 *
 * The voucher row stores cents and no currency: it is spendable on any of ONE
 * organizer's listings, and an organizer sells in one currency in practice.
 * Reading it from their listings (rather than adding a column that could drift
 * from the events it is spent on) keeps the number and its symbol together.
 */
export function organizerCurrency(organizerId: string): string {
  const row = getDb()
    .prepare(`SELECT currency FROM events WHERE organizer_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(organizerId) as { currency: string } | undefined;
  return row?.currency || 'EUR';
}

// ---------------- Who earns: share code -> referrer ----------------

/**
 * The person who owns a referral code: lowercased email of the buyer whose
 * paid order minted that share_code on ANY of this organizer's listings, or
 * null.
 *
 * Scoped to the ORGANIZER, not to one event, because that is the scope the
 * accrual below already runs at — and the scope the orders API resolves a
 * typed-in code at (getPaidOrderByReferralCode). A code earned at last
 * month's listing has to name its owner at this month's one, or the reward
 * would silently stop at the calendar. Never crosses an organizer boundary:
 * somebody else's referrals are somebody else's business.
 *
 * Null — nobody accrues — in three cases, all of them on purpose:
 *   - no such code, or it names an unpaid order (same rule the orders API
 *     validated the code under, so the two can never disagree);
 *   - two orders share the code (astronomically unlikely, and a coin toss
 *     between two people is worse than nobody);
 *   - the referrer's details have been ERASED by lib/retention.ts after the
 *     event. Their address is now a shared placeholder, so accruing would
 *     credit one imaginary very busy person. An erased referrer simply stops
 *     accruing; vouchers they already hold keep working, because a voucher
 *     stands on its own code and nothing about it needs to know who they were.
 */
export function referrerEmailForCode(organizerId: string, code: string): string | null {
  const key = (code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(key)) return null;
  const rows = getDb()
    .prepare(
      `SELECT o.buyer_email AS email, o.buyer_erased_at AS erasedAt
       FROM orders o JOIN events e ON e.id = o.event_id
       WHERE o.share_code = ? AND e.organizer_id = ? AND o.status = 'paid' LIMIT 2`
    )
    .all(key, organizerId) as { email: string; erasedAt: string | null }[];
  if (rows.length !== 1 || rows[0].erasedAt) return null;
  const email = (rows[0].email || '').trim().toLowerCase();
  return email || null;
}

/**
 * How many genuinely paid orders this person's links have brought THIS
 * organizer, across ALL of that organizer's listings.
 *
 * Account-level on purpose: the setting is the organizer's, so the tally is
 * too — somebody who brought two friends to one event and three to the next
 * has brought five, and being reset by the calendar would make the promise a
 * lie. Never crosses an organizer boundary: another organizer's referrals are
 * their own business and buy nothing here.
 *
 * EXISTS rather than a JOIN because share_code has no uniqueness constraint —
 * a join would count a referred order twice if two rows ever shared a code.
 *
 * The referring order is matched across the SAME ORGANIZER's listings, not
 * within one event: a code is spendable at any of their checkouts (see
 * getPaidOrderByReferralCode), so it has to be countable there too — matching
 * per event would credit nobody for exactly the bookings the wider rule was
 * added to allow.
 *
 * `since` is the organizer's reward clock (see setReferralRewardSettings):
 * only bookings confirmed on or after the day the current promise started
 * count towards it. Pass null to count all of them — nobody's reward depends
 * on that reading, it is there for callers that want the lifetime number.
 */
export function countPaidReferrals(
  organizerId: string,
  referrerEmail: string,
  since: string | null = null
): number {
  const email = (referrerEmail || '').trim().toLowerCase();
  if (!email) return 0;
  // paid_at is stamped when the booking was confirmed; created_at covers the
  // rows old enough to predate that column rather than counting them for free.
  const window = since ? `AND COALESCE(o.paid_at, o.created_at) >= ?` : '';
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n
       FROM orders o
       JOIN events e ON e.id = o.event_id
       WHERE e.organizer_id = ?
         AND o.referred_by != ''
         AND ${paidReferralSql('o')}
         ${window}
         AND EXISTS (
           SELECT 1 FROM orders r JOIN events re ON re.id = r.event_id
           WHERE r.share_code = o.referred_by
             AND re.organizer_id = e.organizer_id
             AND r.status = 'paid'
             AND r.buyer_erased_at IS NULL
             AND lower(r.buyer_email) = ?
         )`
    )
    .get(...(since ? [organizerId, since, email] : [organizerId, email])) as { n: number };
  return row.n;
}

// ---------------- Vouchers ----------------

export interface VoucherRow {
  id: string;
  organizerId: string;
  referrerEmail: string;
  code: string;
  amountCents: number;
  earnedAt: string;
  redeemedAt: string | null;
  redeemedOrderId: string | null;
}

const VOUCHER_COLS = `
  id,
  organizer_id AS organizerId,
  referrer_email AS referrerEmail,
  code,
  amount_cents AS amountCents,
  earned_at AS earnedAt,
  redeemed_at AS redeemedAt,
  redeemed_order_id AS redeemedOrderId
`;

// No easily-confused characters (I, L, O, 0, 1) — the same alphabet ticket
// codes use, because this is read off a screen and typed into a box by hand.
const VOUCHER_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * A random, unguessable voucher code like "THANKS-K7KQM3XP".
 *
 * Deliberately unlike the other two codes a buyer ever sees: a ticket code is
 * "K7KQ-M3XP" and a payment reference is "TICKETS-XXXXXXXX". Nobody should
 * have to work out which of the three they are holding, and the payment
 * reference in particular is treated by the support flow as weak proof of
 * owning an order — so a code people paste around must not resemble it.
 */
function generateVoucherCode(): string {
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += VOUCHER_ALPHABET[bytes[i] % VOUCHER_ALPHABET.length];
  return `THANKS-${s}`;
}

/** Forgiving reader for whatever the buyer typed; '' when it is not a code. */
export function normalizeVoucherCode(raw: string): string {
  const s = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = s.startsWith('THANKS') ? s.slice(6) : s;
  return /^[A-Z0-9]{8}$/.test(body) ? `THANKS-${body}` : '';
}

/** A friendly refusal the buyer may read as-is. */
export class VoucherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoucherError';
  }
}

/**
 * ONE refusal for every way a code can fail to be spendable here: no such
 * code, another seller's code, or a code that has already been spent.
 *
 * Deliberately one message and not three. This runs behind an endpoint anyone
 * can call, unauthenticated, with nothing but a code — a code is a bearer
 * token, so anybody holding one can spend it, and an answer that distinguished
 * "never existed" from "exists here and is spent" would confirm both that the
 * code is real and which seller it belongs to. It names every reason at once
 * so a buyer with a genuine problem still knows what to check.
 *
 * Exported so lib/promos can RECOGNISE it: one checkout box takes either kind
 * of code, and a refusal that reads differently for a spent voucher than for
 * anything else is the very oracle this constant exists to avoid.
 */
export const VOUCHER_NOT_USABLE =
  'We could not use that voucher here. Vouchers only work on listings from the seller who gave them to you, and each one works once.';

/**
 * What a voucher cannot do: pay for something that costs nothing. Exported so
 * the checkout API refuses in exactly these words before an order is written,
 * and the buyer never reads two different explanations of one rule.
 */
export const VOUCHER_NOTHING_TO_DISCOUNT =
  'There is nothing for this voucher to take off — this order is already free. Remove the voucher and it stays yours for next time.';

/**
 * The voucher this code names, if it is spendable on THIS organizer's
 * listings. Throws a VoucherError the buyer can read — never a silent ignore,
 * because somebody who typed a code and saw nothing happen has been charged
 * full price without being told why.
 *
 * Scoped hard to one organizer: a voucher is one seller's discount on one
 * seller's prices, and spending it at somebody else's checkout would be
 * charging a stranger for a thank-you they never offered.
 */
export function requireRedeemableVoucher(organizerId: string, rawCode: string): VoucherRow {
  const code = normalizeVoucherCode(rawCode);
  if (!code) {
    // Shape only — this one says nothing about any code that exists.
    throw new VoucherError('That voucher code does not look right — please check it and try again.');
  }
  const row = getDb()
    .prepare(`SELECT ${VOUCHER_COLS} FROM referral_vouchers WHERE code = ?`)
    .get(code) as VoucherRow | undefined;
  if (!row || row.organizerId !== organizerId || row.redeemedAt) {
    throw new VoucherError(VOUCHER_NOT_USABLE);
  }
  return row;
}

/**
 * Take this voucher off the given order's total, atomically.
 *
 * Called from INSIDE createOrder's transaction: the UPDATE only touches a row
 * that is still unredeemed, so two checkouts racing for the same code cannot
 * both win — the loser claims zero rows, this throws, and the whole order
 * (including its seats) rolls back rather than existing with a discount it
 * never actually took.
 *
 * Returns the discount in cents, never more than the order is worth: a
 * voucher bigger than the basket simply covers it. No change is given back,
 * and no remainder is carried forward — it is a discount, not a balance.
 *
 * A basket worth NOTHING is refused rather than discounted by 0.00. A mixed
 * listing can put a free tier next to a paid one, so "voucher applied" and
 * "total: free" can genuinely appear on one screen — and spending a voucher
 * there would burn the whole reward for no benefit at all, on an order that
 * finalizes as paid the same second and can therefore never hand it back.
 * Anybody who came across a code could do it to somebody else in one request.
 */
export function claimVoucherForOrder(
  organizerId: string,
  rawCode: string,
  orderId: string,
  itemsTotalCents: number
): { code: string; discountCents: number } {
  const voucher = requireRedeemableVoucher(organizerId, rawCode);
  if (itemsTotalCents <= 0) throw new VoucherError(VOUCHER_NOTHING_TO_DISCOUNT);
  const changes = getDb()
    .prepare(
      `UPDATE referral_vouchers
       SET redeemed_at = datetime('now'), redeemed_order_id = ?
       WHERE id = ? AND redeemed_at IS NULL`
    )
    .run(orderId, voucher.id).changes;
  if (changes !== 1) {
    throw new VoucherError('That voucher was just used somewhere else — please try again without it.');
  }
  return { code: voucher.code, discountCents: Math.max(0, Math.min(voucher.amountCents, itemsTotalCents)) };
}

/**
 * Give a voucher back when the order that held it never became a sale — an
 * expired reservation, a cancellation, a failed payment, an abandoned payment
 * window.
 *
 * Somebody who earned a reward, spent it on a booking they then abandoned, and
 * lost the reward for it would have been punished for changing their mind. The
 * voucher goes back to unredeemed and works again; a PAID order's voucher is
 * never touched here, because that one really was spent — the same guard, in
 * the same words, as its twin releasePromoForOrder in lib/promos.ts, and the
 * exception for a TEST order is the same one for the same reason: purgeMockOrders
 * deletes the row outright, and a deleted test booking must not go on holding a
 * real reward.
 *
 * The order LOSES THE DISCOUNT in the same breath, and that half is not
 * cosmetic — it is what stops one voucher paying for two orders. An expired
 * reservation that kept a 20.00 discount on its total while the voucher went
 * back into the buyer's pocket could be spent again elsewhere and then
 * confirmed late by the organizer, who would be honouring the same 20.00
 * twice. So the two move together, in one transaction: the voucher is the
 * buyer's again, and this order is back at its full list price. If the
 * organizer later confirms a late transfer against it, they do so looking at
 * what it is actually worth.
 */
export function releaseVoucherForOrder(orderId: string): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const order = db
      .prepare(`SELECT status, payment_mode AS paymentMode FROM orders WHERE id = ?`)
      .get(orderId) as { status: string; paymentMode: string } | undefined;
    // The one row this must never touch, guarded before anything moves —
    // releasePromoForOrder guards its own counter in the same place with the
    // same test. No caller reaches a paid order today; the next release path
    // added (a refund, a chargeback, an organizer un-confirming a transfer)
    // would otherwise hand a genuinely spent reward back while the order's row
    // went on naming the code, a disagreement nothing downstream can see.
    // A purged order (no row at all) still gets its voucher back: there is no
    // sale left to have spent it.
    if (order && order.status === 'paid' && order.paymentMode !== 'mock') return;
    db.prepare(
      `UPDATE referral_vouchers
       SET redeemed_at = NULL, redeemed_order_id = NULL
       WHERE redeemed_order_id = ?`
    ).run(orderId);
    // The order's own columns are reset WHATEVER the voucher UPDATE did. An
    // early return on "no rows changed" left a cancelled order carrying a
    // discounted total and the name of a code it no longer holds — which is
    // both a lie on the order page and the precondition the reclaim path
    // reads as "this redemption was already counted". Whatever the counter
    // says, this order is back at its full list price.
    // Back to the items total — the same sum createOrder priced from the
    // tiers, re-read from the order's own lines so a later price change cannot
    // rewrite what this buyer was quoted. Never on a paid order: that money
    // has landed and its record is not ours to edit.
    const items = db
      .prepare(
        `SELECT COALESCE(SUM(quantity * unit_price_cents), 0) AS n
         FROM order_items WHERE order_id = ?`
      )
      .get(orderId) as { n: number };
    db.prepare(
      `UPDATE orders SET voucher_code = '', discount_cents = 0, total_cents = ?
       WHERE id = ? AND status != 'paid'`
    ).run(items.n, orderId);
  });
  tx();
}

/** Unspent vouchers this person holds with this organizer, newest first. */
export function listUnredeemedVouchers(organizerId: string, referrerEmail: string): VoucherRow[] {
  const email = (referrerEmail || '').trim().toLowerCase();
  if (!email) return [];
  return getDb()
    .prepare(
      `SELECT ${VOUCHER_COLS} FROM referral_vouchers
       WHERE organizer_id = ? AND lower(referrer_email) = ? AND redeemed_at IS NULL
       ORDER BY earned_at DESC`
    )
    .all(organizerId, email) as VoucherRow[];
}

/**
 * Vouchers this person has been given under the CURRENT promise.
 *
 * Windowed by the same clock as countPaidReferrals on purpose: the issuing
 * side compares "how many they should have" against "how many they have", and
 * counting a lifetime of vouchers against a restarted count would leave
 * somebody who earned five under an old deal unable to earn a sixth. Both
 * sides move together, or neither does.
 *
 * RETENTION: lib/retention.ts erases referrer_email on SPENT vouchers — but
 * only once this person has no un-erased paid order left with the organizer.
 * Until then their referrals still count, and a voucher that stopped counting
 * here would be issued a second time. After it, countPaidReferrals is zero for
 * every referral they ever made, so nothing this function returns can matter.
 */
function countVouchersFor(organizerId: string, referrerEmail: string, since: string | null): number {
  const window = since ? `AND earned_at >= ?` : '';
  const args = since ? [organizerId, referrerEmail, since] : [organizerId, referrerEmail];
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM referral_vouchers
       WHERE organizer_id = ? AND lower(referrer_email) = ? ${window}`
    )
    .get(...args) as { n: number };
  return row.n;
}

// ---------------- Issuing ----------------

/**
 * Bring this referrer's vouchers up to what their referral count has earned,
 * and return only the NEW ones.
 *
 * Idempotent and race-safe by construction: it does not add one voucher per
 * paid order, it DERIVES how many should exist from the count
 * (floor(referrals / threshold)) and inserts only the shortfall, inside one
 * transaction. A hook that fires twice for the same order — a retried confirm,
 * a reconcile pass crossing a capture — therefore issues nothing the second
 * time, and ten referrals against a threshold of five can only ever be two
 * vouchers, however many times this runs.
 *
 * The amount is the organizer's CURRENT reward, frozen onto the row: what
 * future referrals are worth is theirs to change, what somebody already earned
 * is not.
 */
function issueVouchersForPaidOrder(orderId: string): { vouchers: VoucherRow[]; eventId: string } {
  const db = getDb();
  const order = db
    .prepare(
      `SELECT o.id, o.event_id AS eventId, o.referred_by AS referredBy, o.status,
              o.payment_mode AS paymentMode, o.total_cents AS totalCents,
              o.voucher_code AS voucherCode,
              e.organizer_id AS organizerId
       FROM orders o JOIN events e ON e.id = o.event_id
       WHERE o.id = ?`
    )
    .get(orderId) as
    | {
        id: string;
        eventId: string;
        referredBy: string;
        status: string;
        paymentMode: string;
        totalCents: number;
        voucherCode: string;
        organizerId: string;
      }
    | undefined;
  if (!order || !order.referredBy) return { vouchers: [], eventId: '' };
  // An order that does not itself count changes nobody's total — nothing to do.
  if (!countsAsPaidReferral(order)) return { vouchers: [], eventId: order.eventId };

  const settings = getReferralRewardSettings(order.organizerId);
  if (!settings.enabled) return { vouchers: [], eventId: order.eventId };

  // By ORGANIZER: the code may have been minted at any of their listings, and
  // the accrual below counts across all of them anyway.
  const referrerEmail = referrerEmailForCode(order.organizerId, order.referredBy);
  if (!referrerEmail) return { vouchers: [], eventId: order.eventId };

  const tx = db.transaction(() => {
    // Both counts read the SAME window (see setReferralRewardSettings): what
    // this promise has earned them, against what this promise has given them.
    // Mixing a windowed count with a lifetime one would either owe people a
    // pile for referrals that predate the promise, or refuse them a reward
    // they have just earned.
    const earnedCount = countPaidReferrals(order.organizerId, referrerEmail, settings.since);
    const shouldHave = Math.floor(earnedCount / settings.threshold);
    const shortfall = shouldHave - countVouchersFor(order.organizerId, referrerEmail, settings.since);
    const made: VoucherRow[] = [];
    const ins = db.prepare(
      `INSERT INTO referral_vouchers (id, organizer_id, referrer_email, code, amount_cents)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < shortfall; i++) {
      const id = crypto.randomUUID();
      // Retry on the (astronomically unlikely) code collision, exactly as
      // ticket minting does.
      for (let attempt = 0; ; attempt++) {
        try {
          ins.run(id, order.organizerId, referrerEmail, generateVoucherCode(), settings.rewardCents);
          break;
        } catch (e) {
          if (attempt >= 5) throw e;
        }
      }
      made.push(db.prepare(`SELECT ${VOUCHER_COLS} FROM referral_vouchers WHERE id = ?`).get(id) as VoucherRow);
    }
    return made;
  });
  return { vouchers: tx(), eventId: order.eventId };
}

/**
 * The hook every "an order just became paid" path calls: issue whatever this
 * order's referrer has now earned, and tell them.
 *
 * FAIL-SOFT, deliberately and completely. This runs immediately after a
 * payment has been confirmed and tickets have been minted; a problem with a
 * thank-you must never turn that into an error the buyer or the organizer
 * sees. Everything is logged and swallowed.
 */
export function awardReferralVouchers(orderId: string): void {
  try {
    const { vouchers, eventId } = issueVouchersForPaidOrder(orderId);
    for (const voucher of vouchers) {
      // Dynamic import: see the note at the top of this file — a static one
      // would make orders -> referrals -> email -> orders a load-time cycle.
      void import('./email')
        .then((m) => m.sendReferralRewardEmail(voucher.id, eventId))
        .then((r) => console.log(`Referral reward email for voucher ${voucher.id}:`, r))
        .catch((e) => console.error(`Referral reward email for voucher ${voucher.id} threw unexpectedly:`, e));
    }
  } catch (e) {
    console.error(`Issuing referral vouchers for order ${orderId} failed:`, e);
  }
}

/** A voucher by id, for the email that announces it. */
export function getVoucher(id: string): VoucherRow | null {
  return (
    (getDb().prepare(`SELECT ${VOUCHER_COLS} FROM referral_vouchers WHERE id = ?`).get(id) as VoucherRow) ?? null
  );
}

// ---------------- Read models ----------------

/** What one referrer sees on their own order page. */
export interface ReferralProgress {
  /** The organizer's setting, so the caller can show nothing when it is off. */
  settings: ReferralRewardSettings;
  /**
   * Confirmed paid referrals across this organizer's listings, counted since
   * the current promise started (settings.since) — never a lifetime number the
   * vouchers below would contradict.
   */
  paidReferrals: number;
  /** How many more until the next voucher (0 only when rewards are off). */
  toNextReward: number;
  /** Unspent vouchers they are holding right now. */
  vouchers: VoucherRow[];
  currency: string;
}

export function referralProgressFor(organizerId: string, referrerEmail: string): ReferralProgress {
  const settings = getReferralRewardSettings(organizerId);
  const currency = organizerCurrency(organizerId);
  if (!settings.enabled) {
    return { settings, paidReferrals: 0, toNextReward: 0, vouchers: [], currency };
  }
  // The same window the issuing side counts in, so the number somebody reads
  // here can never contradict the vouchers listed underneath it.
  const paidReferrals = countPaidReferrals(organizerId, referrerEmail, settings.since);
  const toNextReward = settings.threshold - (paidReferrals % settings.threshold);
  return {
    settings,
    paidReferrals,
    toNextReward,
    vouchers: listUnredeemedVouchers(organizerId, referrerEmail),
    currency,
  };
}

/** What the organizer sees in Insights: how much thanking has actually happened. */
export interface VoucherTotals {
  earned: number;
  earnedCents: number;
  redeemed: number;
  redeemedCents: number;
}

export function voucherTotalsForOrganizer(organizerId: string): VoucherTotals {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS earned,
              COALESCE(SUM(amount_cents), 0) AS earnedCents,
              COALESCE(SUM(CASE WHEN redeemed_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS redeemed,
              COALESCE(SUM(CASE WHEN redeemed_at IS NOT NULL THEN amount_cents ELSE 0 END), 0) AS redeemedCents
       FROM referral_vouchers WHERE organizer_id = ?`
    )
    .get(organizerId) as VoucherTotals;
  return row;
}
