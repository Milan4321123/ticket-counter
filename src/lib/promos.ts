// Server-only: PROMO CODES — the codes an organizer mints themselves and
// hands out (an early-bird code, a code for a sponsor, a code for a WhatsApp
// group), next to the referral vouchers lib/referrals.ts issues automatically.
//
// WHAT A PROMO CODE IS, and what it is not: exactly what a voucher is — A
// DISCOUNT THE SELLER GRANTS ON THEIR OWN PRICES. The buyer transfers less
// money to the seller, and that is the whole of it. The platform is free,
// never holds, moves, funds or takes a cut of any of it, and owes nobody
// anything.
//
// THE BUYER MUST NOT HAVE TO KNOW WHICH KIND OF CODE THEY HOLD. There is one
// box at checkout, one preview endpoint and one claim inside the order's
// transaction; this module is where the two kinds meet, which is why it
// imports lib/referrals rather than the other way round. lib/referrals stays
// ignorant of promos, so nothing about the reward system had to learn a second
// concept.
//
// ONE CODE PER ORDER. orders.voucher_code + orders.discount_cents remain the
// single record of "what code paid part of this", whichever kind it was —
// which is also why the reward rule (paidReferralSql) keeps covering promos
// for free: a promo-discounted order does not fund the next voucher either.
import crypto from 'crypto';
import { getDb } from './db';
import { discountCentsFor } from './money';
import {
  claimVoucherForOrder,
  normalizeVoucherCode,
  requireRedeemableVoucher,
  releaseVoucherForOrder,
  REFERRAL_REWARD_MAX_CENTS,
  REFERRAL_REWARD_MIN_CENTS,
  VOUCHER_NOT_USABLE,
  VoucherError,
  type VoucherRow,
} from './referrals';

export type PromoKind = 'fixed' | 'percent';

export interface PromoRow {
  id: string;
  organizerId: string;
  code: string;
  kind: PromoKind;
  amountCents: number;
  percent: number;
  /** NULL = every listing of this organizer's; otherwise just that one. */
  eventId: string | null;
  /** 0 = unlimited. */
  maxRedemptions: number;
  redeemedCount: number;
  /** NULL = never expires; otherwise an ISO date, inclusive of that day. */
  expiresOn: string | null;
  active: number;
  createdAt: string;
}

const PROMO_COLS = `
  id,
  organizer_id AS organizerId,
  code,
  kind,
  amount_cents AS amountCents,
  percent,
  event_id AS eventId,
  max_redemptions AS maxRedemptions,
  redeemed_count AS redeemedCount,
  expires_on AS expiresOn,
  active,
  created_at AS createdAt
`;

// ---------------- The code itself ----------------

/**
 * The shape an organizer may type: readable, short, no spaces.
 *
 * FIVE characters is the floor, not three, because this code is checked by an
 * unauthenticated endpoint that answers yes or no to a guess: "VIP" is a space
 * of 37^3, which a script walks in seconds, while five is 37^5 — and the
 * global ceilings on /api/orders/voucher and /api/orders/referral hold the
 * guessing rate down to the point where even that is hopeless. No organizer
 * code can already be shorter: the feature is unreleased, so there is no
 * minted code anywhere that this floor could retroactively invalidate.
 */
export const PROMO_CODE_SHAPE = /^[A-Z0-9-]{5,24}$/;

// No easily-confused characters (I, L, O, 0, 1) — the same alphabet ticket
// codes and vouchers use, because this is read off a screen, put on a poster,
// and typed into a box by hand.
const PROMO_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Would this code be read as one of the referral vouchers?
 *
 * normalizeVoucherCode is FORGIVING: it throws dashes away and re-prefixes any
 * 8-character body, so the promo "ABCD2345" and the voucher "THANKS-ABCD2345"
 * normalise to the same string. Reserving the literal THANKS- prefix was never
 * enough — the collision is in the normalisation, not in the prefix.
 *
 * So the test is the normaliser itself: anything it would turn into a voucher
 * code is refused at MINTING, which is what makes "one typed code means one
 * kind of code" a property of the data rather than of a lookup order. The
 * resolution order below is promo-first as a second lock on the same door.
 */
function looksLikeVoucherCode(code: string): boolean {
  return normalizeVoucherCode(code) !== '';
}

/** Forgiving reader for whatever was typed; '' when it is not a usable code. */
export function normalizePromoCode(raw: string): string {
  const s = (raw || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return PROMO_CODE_SHAPE.test(s) ? s : '';
}

/**
 * A random code for the organizer who would rather not invent one.
 *
 * NINE characters, not eight: an 8-character body is exactly what
 * normalizeVoucherCode reads as a voucher, so a generator that made eight
 * would hand the organizer a code its own validation refuses.
 */
export const GENERATED_PROMO_CODE_LENGTH = 9;

export function generatePromoCode(): string {
  const bytes = crypto.randomBytes(GENERATED_PROMO_CODE_LENGTH);
  let s = '';
  for (let i = 0; i < GENERATED_PROMO_CODE_LENGTH; i++) {
    s += PROMO_ALPHABET[bytes[i] % PROMO_ALPHABET.length];
  }
  return s;
}

/** A friendly refusal for the organizer, never for a buyer. */
export class PromoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromoError';
  }
}

// ---------------- What a buyer reads when a code does not work ----------------

/**
 * ONE refusal for every way a code can fail to be usable here: no such code,
 * another seller's code, a voucher already spent, a promo switched off,
 * expired, or at its limit.
 *
 * Deliberately one message and not six, for the same reason lib/referrals
 * gives one for vouchers: this runs behind an endpoint anyone can call,
 * unauthenticated, with nothing but a code. A code is a bearer token, and an
 * answer that distinguished "never existed" from "exists here and is used up"
 * would confirm both that the code is real and whose it is. It names every
 * reason at once so a buyer with a genuine problem still knows what to check.
 */
export const CODE_NOT_USABLE =
  'We could not use that code here. Codes only work on listings from the seller who gave them out — ' +
  'a thank-you voucher works once, and a seller’s own code can be limited to one listing, run out, or expire.';

/** Shape only — says nothing about any code that exists. */
export const CODE_MALFORMED = 'That code does not look right — please check it and try again.';

/** The promo twin of VOUCHER_NOTHING_TO_DISCOUNT: nothing to take off. */
export const PROMO_NOTHING_TO_DISCOUNT =
  'There is nothing for this code to take off — this order is already free. Remove the code and nothing is lost.';

// ---------------- The organizer's own codes ----------------

/** Percent codes are a share of the order; 0 and >100 are not discounts. */
export const PROMO_PERCENT_MIN = 1;
export const PROMO_PERCENT_MAX = 100;

export interface PromoInput {
  code: string;
  kind: PromoKind;
  /** 'fixed' only, in cents. */
  amountCents: number;
  /** 'percent' only, 1..100. */
  percent: number;
  /** '' = all of this organizer's listings. */
  eventId: string;
  /** 0 = unlimited. */
  maxRedemptions: number;
  /** '' = never expires, otherwise 'YYYY-MM-DD'. */
  expiresOn: string;
}

/**
 * The friendly refusal for one set of promo settings, or null when it is fine.
 *
 * The money bounds are the SAME ones a referral reward is held to
 * (lib/referrals): both are the seller's own discount on the seller's own
 * price, and two different ideas of "a sane amount" would be one idea with a
 * bug in it.
 */
export function validatePromoInput(input: PromoInput): string | null {
  const code = normalizePromoCode(input.code);
  if (!code) {
    return 'A code is 5 to 24 characters, letters, numbers and dashes only — for example DASHAIN10.';
  }
  if (looksLikeVoucherCode(code)) {
    // Says the actual rule (exactly eight letters or numbers, dashes not
    // counted), because "cannot start with THANKS-" was only ever half of it
    // and an organizer refused for a reason they cannot see just tries again.
    return (
      'That code would read as one of the thank-you vouchers your referrers earn, so a buyer typing ' +
      'it could get either. Vouchers are eight letters or numbers (with or without THANKS- in front) — ' +
      'make yours any other length, for example DASHAIN10.'
    );
  }
  if (input.kind !== 'fixed' && input.kind !== 'percent') {
    return 'Choose whether the code takes off an amount or a percentage.';
  }
  if (input.kind === 'percent') {
    if (
      !Number.isInteger(input.percent) ||
      input.percent < PROMO_PERCENT_MIN ||
      input.percent > PROMO_PERCENT_MAX
    ) {
      return `A percentage has to be a whole number between ${PROMO_PERCENT_MIN} and ${PROMO_PERCENT_MAX}.`;
    }
  } else {
    if (
      !Number.isInteger(input.amountCents) ||
      input.amountCents < REFERRAL_REWARD_MIN_CENTS ||
      input.amountCents > REFERRAL_REWARD_MAX_CENTS
    ) {
      return 'That amount does not look right — please enter an amount between 1.00 and 500.00.';
    }
  }
  if (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions < 0 || input.maxRedemptions > 100_000) {
    return 'The limit has to be a whole number — or 0 for no limit at all.';
  }
  if (input.expiresOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn)) {
      return 'Enter the expiry date as a date, or leave it empty so the code never expires.';
    }
    // Compared as text in the same style the listings compare event dates:
    // ISO dates sort chronologically, and SQLite's date('now') is the same
    // shape, so the check here and the one at redemption agree.
    const today = new Date().toISOString().slice(0, 10);
    if (input.expiresOn < today) {
      return 'That expiry date has already passed — pick today or a later day.';
    }
  }
  return null;
}

/** Every code this organizer has ever minted, newest first. */
export function listPromoCodes(organizerId: string): PromoRow[] {
  return getDb()
    .prepare(`SELECT ${PROMO_COLS} FROM promo_codes WHERE organizer_id = ? ORDER BY created_at DESC`)
    .all(organizerId) as PromoRow[];
}

export function getPromoCode(organizerId: string, id: string): PromoRow | null {
  return (
    (getDb()
      .prepare(`SELECT ${PROMO_COLS} FROM promo_codes WHERE id = ? AND organizer_id = ?`)
      .get(id, organizerId) as PromoRow) ?? null
  );
}

/**
 * Mint one code. Throws a PromoError the organizer may read as-is.
 *
 * The collision is caught from the UNIQUE(organizer_id, code) constraint
 * rather than checked first: two tabs saving the same code at the same moment
 * is the case a pre-check cannot cover, and the constraint can never be wrong.
 * A code is unique PER ORGANIZER, so another seller already using DASHAIN10 is
 * none of this organizer's business.
 */
export function createPromoCode(organizerId: string, input: PromoInput): PromoRow {
  const problem = validatePromoInput(input);
  if (problem) throw new PromoError(problem);
  const code = normalizePromoCode(input.code);

  // A code may only be scoped to a listing this organizer actually owns —
  // otherwise "scoped to one listing" would be a way to point at somebody
  // else's.
  const eventId = input.eventId.trim();
  if (eventId) {
    const owned = getDb()
      .prepare(`SELECT 1 AS n FROM events WHERE id = ? AND organizer_id = ?`)
      .get(eventId, organizerId) as { n: number } | undefined;
    if (!owned) throw new PromoError('We could not find that listing on your account.');
  }

  const id = crypto.randomUUID();
  try {
    getDb()
      .prepare(
        `INSERT INTO promo_codes (id, organizer_id, code, kind, amount_cents, percent, event_id,
                                  max_redemptions, expires_on)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        organizerId,
        code,
        input.kind,
        input.kind === 'fixed' ? input.amountCents : 0,
        input.kind === 'percent' ? input.percent : 0,
        eventId || null,
        input.maxRedemptions,
        input.expiresOn || null
      );
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message.includes('UNIQUE')) {
      throw new PromoError(`You already have a code called ${code}. Pick a different one, or deactivate that one first.`);
    }
    throw e;
  }
  return getPromoCode(organizerId, id)!;
}

/**
 * Switch a code on or off. There is no delete on purpose: a code that has been
 * redeemed is part of the record of what the seller gave away, and deleting it
 * would quietly rewrite that history (and orphan the redeemed_count the
 * released-order paths still decrement). Deactivating stops it being usable,
 * which is the only thing anybody actually needs.
 */
export function setPromoActive(organizerId: string, id: string, active: boolean): boolean {
  return (
    getDb()
      .prepare(`UPDATE promo_codes SET active = ? WHERE id = ? AND organizer_id = ?`)
      .run(active ? 1 : 0, id, organizerId).changes === 1
  );
}

// ---------------- Redemption: resolving whatever the buyer typed ----------------

/** What one code resolves to — the two kinds, in the one shape callers need. */
export interface DiscountCodePreview {
  /** The normalised code to send back with the order. */
  code: string;
  /** Which kind it turned out to be — for the copy, never for the arithmetic. */
  source: 'voucher' | 'promo';
  kind: PromoKind;
  /** 'fixed' only; 0 for a percentage. */
  amountCents: number;
  /** 'percent' only; 0 for a flat amount. */
  percent: number;
}

/**
 * Is this THIS seller's referral voucher? Scoped to the organizer on purpose:
 * a promo code that happened to look like somebody else's voucher must still
 * be redeemable here, and the one refusal above covers the rest either way.
 */
function isOwnVoucherCode(organizerId: string, code: string): boolean {
  const row = getDb()
    .prepare(`SELECT 1 AS n FROM referral_vouchers WHERE code = ? AND organizer_id = ?`)
    .get(code, organizerId) as { n: number } | undefined;
  return Boolean(row);
}

/**
 * Does this seller have a code of this name AT ALL — switched off, expired and
 * spent ones included?
 *
 * This, and not findLivePromo, is what decides WHICH KIND a typed code is:
 * a promo that exists but is no longer usable must refuse as a promo, never
 * quietly fall through and spend a voucher that happens to normalise the same
 * way. Existence is the question; usability is the next one.
 */
function ownsPromoCode(organizerId: string, code: string): boolean {
  const row = getDb()
    .prepare(`SELECT 1 AS n FROM promo_codes WHERE organizer_id = ? AND code = ?`)
    .get(organizerId, code) as { n: number } | undefined;
  return Boolean(row);
}

/**
 * ONE refusal, whatever lib/referrals called it.
 *
 * requireRedeemableVoucher answers "this voucher is spent" in its own words,
 * which on an unauthenticated endpoint is an oracle: two different refusals
 * tell a stranger holding a guessed code that it is REAL and whose it is. The
 * refusals that are about this order rather than about the code (nothing to
 * discount, lost a race) are left alone — they say nothing a guesser can use.
 */
function asOneRefusal(e: unknown): never {
  if (e instanceof VoucherError && e.message === VOUCHER_NOT_USABLE) {
    throw new VoucherError(CODE_NOT_USABLE);
  }
  throw e;
}

/**
 * The organizer's promo code that is LIVE for this listing right now, or null.
 *
 * Every condition a promo has to meet, in one place: switched on, not expired,
 * still under its cap, and scoped either to this listing or to the whole
 * account. Dates are compared with date() like the listings compare event
 * dates, and the expiry day itself still counts — a code that says it expires
 * on the 20th works all of the 20th.
 */
export function findLivePromo(organizerId: string, eventId: string, code: string): PromoRow | null {
  const key = normalizePromoCode(code);
  if (!key) return null;
  return (
    (getDb()
      .prepare(
        `SELECT ${PROMO_COLS} FROM promo_codes
         WHERE organizer_id = ? AND code = ?
           AND active = 1
           AND (expires_on IS NULL OR date(expires_on) >= date('now'))
           AND (max_redemptions = 0 OR redeemed_count < max_redemptions)
           AND (event_id IS NULL OR event_id = ?)`
      )
      .get(organizerId, key, eventId) as PromoRow) ?? null
  );
}

/**
 * "Does this code work here, and what does it take off?" — a PREVIEW that
 * decides nothing. Throws a VoucherError the buyer may read as-is; never a
 * silent ignore, because somebody who typed a code and saw nothing happen has
 * been charged full price without being told why.
 *
 * PROMOS ARE RESOLVED FIRST, and that order is load-bearing — the same order
 * claimDiscountCodeForOrder uses, so the preview and the money can never
 * disagree about which kind of code was typed. normalizeVoucherCode strips
 * dashes and re-prefixes any 8-character body, so "ABCD2345" and
 * "THANKS-ABCD2345" arrive here as one string; looking vouchers up first meant
 * a seller's own promo could spend somebody's reward instead of counting
 * itself. Minting now refuses any code that normalises into the voucher
 * namespace at all (looksLikeVoucherCode), so the two sets are disjoint by
 * construction; this order is the second lock, and it errs towards the code
 * the SELLER minted rather than towards a stranger's reward.
 */
export function previewDiscountCode(
  listing: { id: string; organizerId: string },
  rawCode: string
): DiscountCodePreview {
  const promoCode = normalizePromoCode(rawCode);
  if (promoCode && ownsPromoCode(listing.organizerId, promoCode)) {
    const promo = findLivePromo(listing.organizerId, listing.id, promoCode);
    if (!promo) throw new VoucherError(CODE_NOT_USABLE);
    return {
      code: promo.code,
      source: 'promo',
      kind: promo.kind,
      amountCents: promo.amountCents,
      percent: promo.percent,
    };
  }

  const voucherCode = normalizeVoucherCode(rawCode);
  if (voucherCode && isOwnVoucherCode(listing.organizerId, voucherCode)) {
    try {
      const voucher: VoucherRow = requireRedeemableVoucher(listing.organizerId, voucherCode);
      return { code: voucher.code, source: 'voucher', kind: 'fixed', amountCents: voucher.amountCents, percent: 0 };
    } catch (e) {
      asOneRefusal(e);
    }
  }

  // Shape only — this branch says nothing about any code that exists.
  if (!promoCode && !voucherCode) throw new VoucherError(CODE_MALFORMED);
  throw new VoucherError(CODE_NOT_USABLE);
}

/**
 * Take whatever code the buyer typed off this order's total, atomically —
 * either a referral voucher or one of the organizer's promo codes.
 *
 * Called from INSIDE createOrder's transaction, and race-safe by the same
 * discipline claimVoucherForOrder uses: the UPDATE that counts the redemption
 * only touches a row that is still redeemable, so two checkouts racing for the
 * last redemption of a capped code cannot both win — the loser changes zero
 * rows, this throws, and the whole order rolls back rather than existing with
 * a discount it never actually took.
 *
 * Returns the discount in cents, never more than the order is worth.
 */
export function claimDiscountCodeForOrder(
  listing: { id: string; organizerId: string },
  rawCode: string,
  orderId: string,
  itemsTotalCents: number
): { code: string; discountCents: number } {
  // Promos first, in the SAME order previewDiscountCode resolves in — see the
  // comment there for why the order is load-bearing.
  const promoCode = normalizePromoCode(rawCode);
  if (promoCode && ownsPromoCode(listing.organizerId, promoCode)) {
    const promo = findLivePromo(listing.organizerId, listing.id, promoCode);
    if (!promo) throw new VoucherError(CODE_NOT_USABLE);
    // A basket worth NOTHING is refused rather than discounted by 0.00 — the
    // same rule vouchers follow, so one mixed listing cannot produce two
    // different answers depending on which kind of code was typed.
    if (itemsTotalCents <= 0) throw new VoucherError(PROMO_NOTHING_TO_DISCOUNT);

    if (!countPromoRedemption(promo.id)) {
      throw new VoucherError('That code just reached its limit — please try again without it.');
    }
    return { code: promo.code, discountCents: discountCentsFor(promo, itemsTotalCents) };
  }

  const voucherCode = normalizeVoucherCode(rawCode);
  if (voucherCode && isOwnVoucherCode(listing.organizerId, voucherCode)) {
    // The voucher half is lib/referrals' own business, untouched — only its
    // "already spent" wording is collapsed into the one refusal, because the
    // orders route is as unauthenticated as the preview endpoint is.
    try {
      return claimVoucherForOrder(listing.organizerId, voucherCode, orderId, itemsTotalCents);
    } catch (e) {
      asOneRefusal(e);
    }
  }

  if (!promoCode && !voucherCode) throw new VoucherError(CODE_MALFORMED);
  throw new VoucherError(CODE_NOT_USABLE);
}

/**
 * The conditional increment that IS the cap.
 *
 * Every rule is re-tested in the WHERE, not read first and trusted: between a
 * preview and this line the code may have been switched off, expired, or had
 * its last redemption taken by somebody else. Zero rows changed means it is no
 * longer redeemable, and the caller must abort the order.
 */
function countPromoRedemption(promoId: string): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE promo_codes SET redeemed_count = redeemed_count + 1
         WHERE id = ?
           AND active = 1
           AND (expires_on IS NULL OR date(expires_on) >= date('now'))
           AND (max_redemptions = 0 OR redeemed_count < max_redemptions)`
      )
      .run(promoId).changes === 1
  );
}

// ---------------- Release ----------------

/**
 * Give back whatever code an order was holding when it never became a sale —
 * an expired reservation, a cancellation, a failed payment, an abandoned
 * payment window, a purged test order.
 *
 * THE ONLY release entry point the rest of the codebase calls, so a promo can
 * never be released on fewer paths than a voucher: whatever the wiring of
 * releaseVoucherForOrder was, this sits exactly on top of it.
 *
 * A cap must never be eaten by an order nobody paid — somebody who reserved
 * with the last early-bird code and then abandoned the payment has to leave
 * that code as they found it, or the seller silently gave away one fewer
 * discount than they promised.
 */
export function releaseDiscountCodeForOrder(orderId: string): void {
  // PROMOS FIRST. The promo half has to read orders.voucher_code to know which
  // counter to credit, and releaseVoucherForOrder clears that column — running
  // it first would leave a promo's cap spent on a cancelled order for ever.
  // The voucher half is keyed on referral_vouchers.redeemed_order_id instead,
  // so it does not care that the column is already empty by the time it runs.
  releasePromoForOrder(orderId);
  releaseVoucherForOrder(orderId);
}

/**
 * The promo half of the release above. A no-op when the order carried nothing
 * at all.
 *
 * IDEMPOTENT BY CONSTRUCTION: the decrement and the clearing of the order's
 * own record of the code commit TOGETHER, on every branch, so a second call
 * finds no code named on the order and gives nothing back. Neither half may
 * ever be skipped while the other happens —
 *   - decrement without clearing is how three calls credited three
 *     redemptions back for one order (a paid test order used to slip past the
 *     status != 'paid' guard on the clearing UPDATE, over and over);
 *   - clearing without decrementing loses a redemption the seller promised;
 *   - and an order left holding a discounted total whose code is free again is
 *     how one discount comes to be honoured twice, because the reclaim path
 *     reads exactly that as "already counted".
 * So the clearing runs whatever the counter did — a counter already at zero is
 * a counter with nothing to give back, not a reason to leave the order stale.
 *
 * A PAID order is never touched: that redemption really happened. The one
 * exception is a TEST order, which purgeMockOrders deletes outright — a test
 * booking must not go on holding one of a real code's redemptions after the
 * row that recorded it is gone. Rewriting a test order's total on the way out
 * costs nothing: no money ever landed on it and it is about to be deleted.
 * releaseVoucherForOrder hands a purged test order's voucher back for exactly
 * the same reason.
 */
function releasePromoForOrder(orderId: string): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const order = db
      .prepare(
        `SELECT o.voucher_code AS code, o.status, o.payment_mode AS paymentMode,
                e.organizer_id AS organizerId
         FROM orders o JOIN events e ON e.id = o.event_id
         WHERE o.id = ?`
      )
      .get(orderId) as
      | { code: string; status: string; paymentMode: string; organizerId: string }
      | undefined;
    if (!order || !order.code) return;
    if (order.status === 'paid' && order.paymentMode !== 'mock') return;
    db.prepare(
      `UPDATE promo_codes SET redeemed_count = redeemed_count - 1
       WHERE organizer_id = ? AND code = ? AND redeemed_count > 0`
    ).run(order.organizerId, order.code);
    // Back to the items total, from the order's own lines — exactly what
    // releaseVoucherForOrder does. The row was already ruled out above unless
    // it is unpaid or a test order, so this needs no status guard of its own:
    // adding one back is what let the decrement repeat.
    const items = db
      .prepare(
        `SELECT COALESCE(SUM(quantity * unit_price_cents), 0) AS n
         FROM order_items WHERE order_id = ?`
      )
      .get(orderId) as { n: number };
    db.prepare(
      `UPDATE orders SET voucher_code = '', discount_cents = 0, total_cents = ? WHERE id = ?`
    ).run(items.n, orderId);
  });
  tx();
}

/**
 * Take the code back for an order that turns out to have been paid after all
 * (a bank transfer confirmed after the reservation expired).
 *
 * True means the order may keep its discount. False means the code has
 * provably been used up elsewhere in the meantime — the caller strips the
 * discount and confirms anyway, because the money that arrived is real.
 *
 * Runs INSIDE the caller's transaction, so it opens none of its own.
 */
export function reclaimDiscountCodeForOrder(orderId: string, code: string): boolean {
  const db = getDb();
  const isVoucher = db.prepare(`SELECT 1 AS n FROM referral_vouchers WHERE code = ?`).get(code) as
    | { n: number }
    | undefined;
  if (isVoucher) {
    // Re-claiming its own voucher is a no-op that must still count as success
    // (redeemed_order_id is already this order), hence the second arm.
    return (
      db
        .prepare(
          `UPDATE referral_vouchers
           SET redeemed_at = datetime('now'), redeemed_order_id = ?
           WHERE code = ? AND (redeemed_at IS NULL OR redeemed_order_id = ?)`
        )
        .run(orderId, code, orderId).changes === 1
    );
  }
  // A promo keeps no per-order row — the ORDER is the record. So a still-named
  // code with a discount still on it means the redemption was never given back
  // (releasing does both together, in one transaction): there is nothing to
  // reclaim, and counting it a second time would charge the code twice for one
  // order. This is the promo twin of the voucher's "re-claiming its own is a
  // no-op that still counts as success" above.
  const held = db
    .prepare(`SELECT discount_cents AS discountCents FROM orders WHERE id = ? AND voucher_code = ?`)
    .get(orderId, code) as { discountCents: number } | undefined;
  if (held && held.discountCents > 0) return true;

  const promo = db
    .prepare(
      `SELECT p.id AS id
       FROM promo_codes p
       JOIN orders o ON o.id = ?
       JOIN events e ON e.id = o.event_id
       WHERE p.organizer_id = e.organizer_id AND p.code = ?`
    )
    .get(orderId, code) as { id: string } | undefined;
  // No such code at all: nothing to reclaim, and nothing to strip either —
  // the order's own record of the discount is all there ever was.
  if (!promo) return true;
  return countPromoRedemption(promo.id);
}

// ---------------- Read models ----------------

/** What the organizer sees in Insights: how much their own codes were used. */
export interface PromoTotals {
  /** Codes minted, and how many are usable right now. */
  minted: number;
  live: number;
  /** Redemptions counted across every code. */
  redeemed: number;
}

export function promoTotalsForOrganizer(organizerId: string): PromoTotals {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS minted,
              COALESCE(SUM(CASE WHEN active = 1
                                 AND (expires_on IS NULL OR date(expires_on) >= date('now'))
                                 AND (max_redemptions = 0 OR redeemed_count < max_redemptions)
                            THEN 1 ELSE 0 END), 0) AS live,
              COALESCE(SUM(redeemed_count), 0) AS redeemed
       FROM promo_codes WHERE organizer_id = ?`
    )
    .get(organizerId) as PromoTotals;
}

/**
 * What this organizer's own codes took off THIS listing, from the orders
 * themselves rather than from the counters.
 *
 * Reads confirmed orders only, so it is the money side of the story: a
 * redeemed_count includes reservations still waiting on a transfer, while this
 * is what a buyer actually paid less. Matched through orders.voucher_code —
 * the single record of what part-paid an order — with the promo table telling
 * the two kinds apart.
 */
export interface PromoUsage {
  orders: number;
  discountCents: number;
}

export function promoUsageForEvent(eventId: string): PromoUsage {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(o.discount_cents), 0) AS discountCents
       FROM orders o
       JOIN events e ON e.id = o.event_id
       WHERE o.event_id = ?
         AND o.status = 'paid'
         AND o.payment_mode != 'mock'
         AND o.voucher_code != ''
         AND EXISTS (
           SELECT 1 FROM promo_codes p
           WHERE p.organizer_id = e.organizer_id AND p.code = o.voucher_code
         )`
    )
    .get(eventId) as PromoUsage;
}
