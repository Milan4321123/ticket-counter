// Server-only: order + ticket persistence and lifecycle. Every order belongs
// to ONE event (orders.event_id); prices and tier names always come from that
// event's rows in event_tiers — never from the browser.
import crypto from 'crypto';
import { getSigningSecret } from './auth';
import { getDb } from './db';
import { getBaseUrl, getPaymentMode } from './config';
import { getEventById, getEventTier, getEventTiers, seatsPerUnitSql } from './events';
import { claimInventory } from './inventory';
import { effectivePayout } from './payout';
import {
  claimDiscountCodeForOrder,
  reclaimDiscountCodeForOrder,
  releaseDiscountCodeForOrder,
} from './promos';
import { withAnonymizedBuyer } from './retention';
import { chunkIds } from './sqlIn';
import { generateTicketCode, normalizeTicketCode } from './tickets';
import type { CheckinResponse } from './types';

export type OrderStatus = 'pending' | 'claimed' | 'capturing' | 'paid' | 'failed' | 'cancelled';
/**
 * 'free' is an order whose total is zero — an RSVP. It exists as its own mode
 * (rather than riding on 'transfer') so nothing ever asks the buyer to send
 * €0.00, no reminder chases a payment that does not exist, and the books can
 * tell a seat that was given away from one that was sold.
 */
export type PaymentMethod = 'paypal' | 'mock' | 'transfer' | 'free';

export interface OrderRow {
  id: string;
  eventId: string;
  paypalOrderId: string | null;
  status: OrderStatus;
  buyerName: string;
  buyerEmail: string;
  /**
   * Whose name the money will actually arrive under, when the buyer said it
   * would not be their own — a partner's account, a parent's, a shared one.
   * '' on almost every order, and on everything written before it existed.
   */
  payerName: string;
  /** How the organizer matched the payment: 'reference' | 'sender' | ''. */
  confirmedVia: string;
  totalCents: number;
  currency: string;
  paymentMode: PaymentMethod;
  createdAt: string;
  paidAt: string | null;
  captureId: string | null;
  /**
   * When buyerName/buyerEmail were overwritten because the event is long past
   * (lib/retention.ts). Non-null means the two fields above are placeholders,
   * not a person — nothing may be emailed to them.
   */
  buyerErasedAt: string | null;
  /**
   * The payout account this order was TOLD to pay, frozen when it was created.
   *
   * A receipt, not a pointer: the order page and its emails read these, so an
   * organizer changing the event's IBAN afterwards can never rewrite the
   * instructions a buyer already holds. '' on orders written before the
   * snapshot existed — lib/payout.ts falls those back to the event.
   */
  payoutHolder: string;
  payoutIban: string;
  payoutBic: string;
  payoutBankName: string;
  payoutPaypal: string;
  /**
   * The referral code of the paid order whose share link brought this buyer —
   * that order's share_code — or '' for everyone else. Analysis only
   * (Insights' "Top referrers"): no reward, no money.
   */
  referredBy: string;
  /**
   * This order's own referral code — the ?ref= its share links broadcast —
   * minted at creation. '' only on orders written before the column existed;
   * those share nothing rather than falling back to the id prefix (see
   * referralCode below for why).
   */
  shareCode: string;
  /**
   * The code the buyer redeemed here, or '' — by far the usual case. Either a
   * referral voucher (lib/referrals.ts) or one of the seller's own promo codes
   * (lib/promos.ts): the column is named for the older of the two, and stays
   * the SINGLE record of what part-paid this order, because only one code may.
   * Either way it is the seller's own discount on the seller's own price.
   */
  voucherCode: string;
  /**
   * What that code took off. A RECORD, not a second subtraction: totalCents
   * below is already the final amount owed.
   */
  discountCents: number;
}

/**
 * Short reference the buyer must put in their bank transfer's purpose line
 * ("Verwendungszweck") so the organizer can match money to orders. Derived
 * from the order id, so admin search finds it (the hex part matches the id).
 *
 * Orders containing any student ticket get an "S-" marker (TICKETS-S-XXXXXXXX
 * instead of TICKETS-XXXXXXXX) so student sales are recognizable directly on
 * the bank statement and in the admin panel. Whether a tier is student-only
 * comes from the ORDER'S EVENT (event_tiers).
 */
/**
 * The names this order's money could plausibly arrive under: whoever bought it,
 * and whoever they said would actually be paying.
 */
export function expectedSenderNames(order: Pick<OrderRow, 'buyerName' | 'payerName'>): string[] {
  return [order.buyerName, order.payerName].map((n) => (n || '').trim()).filter(Boolean);
}

/** Lowercase word list, punctuation and accents-as-typed left behind. */
function nameWords(name: string): string[] {
  return (name || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/**
 * Does what the organizer typed name the person this money came from?
 *
 * Bank statements and PayPal almost never print a name the way the buyer typed
 * it: "Ramesh Thapa" arrives as "THAPA RAMESH", "Thapa, Ramesh", or buried in
 * "RAMESH THAPA KUMAR". Comparing strings would reject all three and send the
 * organizer back to hunt for a reference that, on PayPal, may never have
 * existed. So this compares WORDS: every word typed has to be one of the words
 * on the order, in any order and any case.
 *
 * Deliberately forgiving, because of what this check actually is. It is a
 * speed bump against a mis-click issuing tickets — the organizer is already
 * signed in, already owns this event, and is reading their own bank statement.
 * It is not authentication, and pretending otherwise would only mean rejecting
 * honest people over a comma.
 *
 * What it must still refuse is an empty box, a stray keystroke, and a name that
 * belongs to some other order — hence a real word of at least three letters.
 */
export function senderNameMatches(
  typed: string,
  order: Pick<OrderRow, 'buyerName' | 'payerName'>
): boolean {
  const words = nameWords(typed);
  if (words.length === 0) return false;
  if (!words.some((w) => w.length >= 3)) return false;

  return expectedSenderNames(order).some((name) => {
    const expected = new Set(nameWords(name));
    return expected.size > 0 && words.every((w) => expected.has(w));
  });
}

/**
 * The reference itself, for a caller that already knows whether the order
 * holds a student-only ticket.
 *
 * Split out because working that flag out costs three reads (the order, its
 * items, each item's tier) and a screen listing a month of orders already has
 * all three in hand — the statements page was spending them again per line.
 * paymentReference() below is this same function plus those reads.
 */
export function paymentReferenceOf(orderId: string, hasStudentItem: boolean): string {
  return (hasStudentItem ? 'TICKETS-S-' : 'TICKETS-') + orderId.slice(0, 8).toUpperCase();
}

export function paymentReference(orderId: string): string {
  const order = getOrder(orderId);
  const hasStudent = order
    ? getOrderItems(orderId).some((it) => getEventTier(order.eventId, it.tierId)?.studentOnly)
    : false;
  return paymentReferenceOf(orderId, hasStudent);
}

/**
 * The order a payment reference points at, or null.
 *
 * The inverse of paymentReference(): the reference carries the first 8 hex
 * characters of the order id, so a buyer who quotes their reference identifies
 * their own order without anyone having to look them up by name. That is what
 * lets the platform's support backstop work at all now that the owner cannot
 * see a list of buyers.
 *
 * Fails closed: junk, a truncated reference, or the (practically impossible)
 * case of two ids sharing a prefix all return null rather than a guess.
 */
export function getOrderByPaymentReference(reference: string): OrderRow | null {
  const key = reference.trim().replace(/^TICKETS-(S-)?/i, '').replace(/[^0-9a-fA-F]/g, '');
  if (key.length !== 8) return null;
  const rows = getDb()
    .prepare(`SELECT ${ORDER_COLS} FROM orders WHERE id LIKE ? || '%' LIMIT 2`)
    .all(key.toLowerCase()) as OrderRow[];
  return rows.length === 1 ? rows[0] : null;
}

// ---------------------------------------------------------------------------
// The order access token: the ONE proof that the reader owns the mailbox.
//
// An order's id protects the ORDER — it is a random UUID, and whoever created
// the order knows it. It proves nothing about the ADDRESS on that order,
// because POST /api/orders only format-checks buyer_email: anybody may type
// anybody's address into a checkout and be handed the new order id in the
// response. So buyer_email is an unverified claim, and nothing keyed off it —
// the referral vouchers that address holds, the customer card code that opens
// its whole history with a seller — may be unlocked by the order id alone.
//
// This token is what closes that gap. It is minted for one order, it travels
// ONLY inside emails sent TO the address on that order, and holding it is
// therefore evidence of reading that mailbox. Same HMAC discipline as the
// unsubscribe/confirm links in lib/marketing.ts and the scan tokens in
// lib/auth.ts, constant-time compare included.
//
// It must NEVER be handed out at order creation (the post-checkout redirect
// carries no token on purpose): an attacker creates orders too, so a token
// given to whoever made the order proves exactly what the order id already
// proved — nothing.
//
// No expiry, deliberately. It unlocks nothing that can spend money and nothing
// the ticket email did not already put in that inbox, and a buyer who
// bookmarks the link from their confirmation email should still find their
// vouchers there next season.
//
// What we accept by putting it in the QUERY STRING, stated rather than left
// implicit. A non-expiring bearer capability in a URL is copied verbatim into
// reverse-proxy and CDN access logs, browser history, and any Referer a future
// cross-origin request might carry. A URL FRAGMENT would avoid all three —
// which is exactly how ScanClient keeps the scan key out of them (see
// app/scan/ScanClient.tsx) — but a fragment never leaves the browser, and this
// page is a server component that must decide what to RENDER before any client
// JS runs. Query string is the only place the server can read it from. The
// residual exposure is bounded by what the token unlocks (the vouchers and card
// already mailed to that same inbox, nothing spendable), and next.config.mjs
// keeps /order/* out of shared caches and search indexes.
//
// Two consequences worth knowing before touching either end:
//   - Rotating APP_SECRET silently invalidates every buyer link ever mailed.
//     The signature is over the order id alone with no key id, so old tokens do
//     not fail loudly — they simply stop verifying, for everyone, at once.
//   - An invalid, missing, or stale token DEGRADES, it does not error: the
//     order page still renders in full and the two account-level panels are
//     replaced by the explainer that says the link lives in the buyer's email
//     (app/order/[id]/page.tsx). So a rotation shows up as panels quietly going
//     missing across the whole site, not as a stack of 403s in the logs.
// ---------------------------------------------------------------------------

/** Constant-time compare (hash both sides so lengths always match). */
function safeEqualHex(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function signOrderAccess(orderId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`order:${orderId}`).digest('hex');
}

/**
 * The token for one order, or null on a deployment with no signing secret —
 * in which case the emails simply link to the plain order page and the
 * account-level panels stay shut. Failing closed is the only safe direction:
 * an unsigned deployment that showed the panels anyway would be the bug.
 */
export function orderAccessToken(orderId: string): string | null {
  const secret = getSigningSecret();
  if (!secret || !orderId) return null;
  return signOrderAccess(orderId, secret);
}

/** Does this token prove the holder was mailed about THIS order? */
export function verifyOrderAccessToken(orderId: string, token: string | null | undefined): boolean {
  if (!token || !orderId) return false;
  const expected = orderAccessToken(orderId);
  if (!expected) return false;
  return safeEqualHex(token, expected);
}

/**
 * The order-page link an email to the BUYER'S OWN ADDRESS may carry: with the
 * token, so opening it from the inbox shows the rewards and card panels.
 *
 * Only for mail addressed to order.buyer_email. Anything shown to a reader who
 * has not proved that mailbox — the post-checkout redirect, an organizer's
 * copy, a support reply — must use the bare `/order/<id>` path instead.
 */
export function orderUrlForBuyerEmail(orderId: string): string {
  const base = `${getBaseUrl()}/order/${orderId}`;
  const token = orderAccessToken(orderId);
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

// Referral share codes match what the orders API accepts (/^[A-Z0-9]{8}$/).
// Unlike ticket codes they ride inside URLs rather than being read aloud, so
// the full alphabet costs nothing and buys entropy.
const SHARE_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Random, unguessable referral share code like "Q7KX2M9A". */
function generateShareCode(): string {
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += SHARE_CODE_ALPHABET[bytes[i] % SHARE_CODE_ALPHABET.length];
  return s;
}

/**
 * The code a buyer shares — the order's stored share_code — or null when the
 * order predates the column.
 *
 * This used to be the first 8 chars of the order id, i.e. byte-for-byte the
 * payment reference's short id (TICKETS-XXXXXXXX). But that reference is a
 * quasi-authenticator: the admin support flow treats a buyer quoting it as
 * weak proof they own the order, and a code designed to be broadcast into
 * WhatsApp groups must be a DIFFERENT secret — otherwise every share hands
 * strangers the proof. Pre-migration orders therefore get NO referral code
 * (null, share links carry no ref) rather than any fallback to the id prefix.
 */
export function referralCode(order: Pick<OrderRow, 'shareCode'>): string | null {
  return order.shareCode || null;
}

/**
 * The PAID order a referral code points at — anywhere in the SAME SELLER's
 * listings as the one being bought — or null.
 *
 * Scoped to the ORGANIZER, not to one event, because the reward system already
 * accrues per (organizer, referrer) across all of their listings: a code
 * earned at last month's event and typed in at this month's one has to find
 * its owner, or the code would silently do nothing at exactly the moment it
 * was meant to work. Never wider than that — another seller's referrals are
 * their own business and buy nothing here.
 *
 * The strict half of the referral feature is unchanged: the code arrives from
 * a URL or a box anyone can type into, so only the exact 8-char form is
 * accepted, orders from before share_code existed (share_code = '') never
 * match, and it must resolve to EXACTLY ONE paid order — junk, another
 * seller's order, an unpaid reservation, or the (astronomically unlikely)
 * duplicated code all fail closed to null, and the caller stores '' instead.
 */
export function getPaidOrderByReferralCode(eventId: string, code: string): OrderRow | null {
  const key = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(key)) return null;
  const rows = getDb()
    .prepare(
      `SELECT ${ORDER_COLS} FROM orders
       WHERE share_code = ? AND share_code != '' AND status = 'paid'
         AND event_id IN (
           SELECT id FROM events
           WHERE organizer_id = (SELECT organizer_id FROM events WHERE id = ?)
         )
       LIMIT 2`
    )
    .all(key, eventId) as OrderRow[];
  return rows.length === 1 ? rows[0] : null;
}

export interface OrderItemRow {
  orderId: string;
  tierId: string;
  quantity: number;
  unitPriceCents: number;
}

export interface TicketRow {
  code: string;
  orderId: string;
  tierId: string;
  createdAt: string;
  checkedInAt: string | null;
}

const ORDER_COLS = `
  id,
  event_id AS eventId,
  paypal_order_id AS paypalOrderId,
  status,
  buyer_name AS buyerName,
  buyer_email AS buyerEmail,
  payer_name AS payerName,
  confirmed_via AS confirmedVia,
  total_cents AS totalCents,
  currency,
  payment_mode AS paymentMode,
  created_at AS createdAt,
  paid_at AS paidAt,
  capture_id AS captureId,
  buyer_erased_at AS buyerErasedAt,
  payout_holder AS payoutHolder,
  payout_iban AS payoutIban,
  payout_bic AS payoutBic,
  payout_bank_name AS payoutBankName,
  payout_paypal AS payoutPaypal,
  referred_by AS referredBy,
  share_code AS shareCode,
  voucher_code AS voucherCode,
  discount_cents AS discountCents
`;

const TICKET_COLS = `
  code,
  order_id AS orderId,
  tier_id AS tierId,
  created_at AS createdAt,
  checked_in_at AS checkedInAt
`;

/**
 * How many tickets this email is already holding UNPAID on this event.
 *
 * Counts tickets rather than orders: two reservations of eight seats is the
 * problem, not the fact that there were two of them. 'claimed' is the only
 * status that holds seats without money having arrived — 'paid' is settled and
 * cancelled/expired have already released theirs.
 *
 * Deliberately reads the database rather than the in-memory limiter: this is a
 * question about state that outlives a process, and a restart must not hand
 * everyone a fresh allowance.
 *
 * Weighted by seats_per_unit because the cap is on PEOPLE'S SEATS, not
 * bookings: two held "Table of 8" bookings are sixteen seats off the market,
 * and counting them as two would let one address hold a room with tables.
 *
 * Re-clamped to 1..20 inside the sum (seatsPerUnitSql), the same clamp
 * getEventTiers applies on read: the ceiling and the room have to be counting
 * the same seats, or a corrupt 0 makes every hold weigh nothing here while
 * still weighing one seat there.
 */
export function heldUnpaidTicketsForEmail(eventId: string, buyerEmail: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(oi.quantity * ${seatsPerUnitSql('et')}), 0) AS n
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN event_tiers et ON et.event_id = o.event_id AND et.tier_key = oi.tier_id
        WHERE o.event_id = ?
          AND o.status = 'claimed'
          AND o.payment_mode = 'transfer'
          AND LOWER(o.buyer_email) = LOWER(?)`
    )
    .get(eventId, buyerEmail) as { n: number };
  return row.n;
}

/**
 * Seats this address has already RSVP'd for free on this event.
 *
 * The transfer ceiling above counts unpaid holds, because for a paid event
 * the unpaid hold is the abuse surface — money settles the rest. A free order
 * has no unpaid phase at all: it finalizes to 'paid' in the same request and
 * there is no expiry, no reminder, and (so far) no release path. Without its
 * own counter, one address could quietly RSVP a whole free event into
 * "sold out" and nothing would ever claw the seats back. Counted from the
 * database for the same reason as its sibling: a restart must not hand
 * anyone a fresh allowance.
 */
export function freeTicketsForEmail(eventId: string, buyerEmail: string): number {
  // Weighted by seats_per_unit for the same reason as the transfer counter
  // above, and clamped for the same reason too: the ceiling protects seats, and
  // one free bundled booking sits on several of them.
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(oi.quantity * ${seatsPerUnitSql('et')}), 0) AS n
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN event_tiers et ON et.event_id = o.event_id AND et.tier_key = oi.tier_id
        WHERE o.event_id = ?
          AND o.status = 'paid'
          AND o.payment_mode = 'free'
          AND LOWER(o.buyer_email) = LOWER(?)`
    )
    .get(eventId, buyerEmail) as { n: number };
  return row.n;
}

/**
 * Create a local order for an event. Prices are ALWAYS looked up from the
 * event's tiers here — never trust amounts sent by the browser. The currency
 * is the event's currency.
 *
 * Bank-transfer orders reserve their seats IMMEDIATELY (created 'pending',
 * then claimed in the same call): the buyer's transfer takes days and the
 * seats must hold until the organizer confirms the money or the reservation
 * expires. If the claim fails the order is cancelled and SoldOutError
 * propagates — the caller can tell the buyer nothing was reserved.
 */
export function createOrder(params: {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  /** Optional: whose name the payment will show up under, if not the buyer's. */
  payerName?: string;
  /**
   * Optional: an ALREADY-VALIDATED referral code (see the orders API — this
   * function trusts its caller checked it names a paid order of this event
   * that is not the buyer's own). '' or absent means unreferred.
   */
  referredBy?: string;
  /**
   * Optional: a discount code the buyer typed at checkout — either a referral
   * voucher or one of the seller's own promo codes; the buyer never has to
   * know which they hold. UNLIKE referredBy this is NOT trusted from the
   * caller — it is resolved, validated and claimed inside this function's
   * transaction, because it moves money and a check made anywhere else could
   * go stale between there and here.
   *
   * ONE code per order: it lands in orders.voucher_code either way, which is
   * the single record of what part-paid this order.
   */
  voucherCode?: string;
  items: { tierId: string; quantity: number }[];
  paymentMode: PaymentMethod;
}): OrderRow {
  const db = getDb();
  const id = crypto.randomUUID();

  const event = getEventById(params.eventId);
  if (!event) throw new Error('Unknown event');

  const resolved = params.items.map((it) => {
    const tier = getEventTier(event.id, it.tierId);
    if (!tier) throw new Error(`Unknown ticket type: ${it.tierId}`);
    if (!Number.isInteger(it.quantity) || it.quantity < 1) {
      throw new Error(`Invalid quantity for ${it.tierId}`);
    }
    return { tierId: it.tierId, quantity: it.quantity, unitPriceCents: tier.priceCents };
  });
  const itemsTotalCents = resolved.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0);
  const wantsVoucher = Boolean((params.voucherCode ?? '').trim());

  // Freeze where this buyer is being sent, now, before anything can move it.
  // effectivePayout() rather than the raw columns: a payout change whose waiting
  // period has already elapsed is the real account, even if the row has not been
  // tidied up yet.
  const payout = effectivePayout(event);

  const tx = db.transaction(() => {
    // The code is checked and SPENT in the same transaction that writes the
    // order it discounts. Two checkouts racing for one code therefore cannot
    // both win: the loser's claim touches no row — an already-redeemed
    // voucher, or a promo already at its cap — claimDiscountCodeForOrder
    // throws, and this whole insert rolls back, so no order exists holding a
    // discount it never actually took. A VoucherError propagates to the
    // caller, which turns it into a message the buyer reads BEFORE they have
    // committed to anything.
    let voucherCode = '';
    let discountCents = 0;
    if (wantsVoucher) {
      const claimed = claimDiscountCodeForOrder(
        { id: event.id, organizerId: event.organizerId },
        params.voucherCode ?? '',
        id,
        itemsTotalCents
      );
      voucherCode = claimed.code;
      discountCents = claimed.discountCents;
    }
    // What the buyer OWES. Never negative, and no change is given for a code
    // worth more than the basket — claimDiscountCodeForOrder already capped
    // the discount at the items total.
    const totalCents = Math.max(0, itemsTotalCents - discountCents);

    db.prepare(
      `INSERT INTO orders (id, event_id, status, buyer_name, buyer_email, payer_name, total_cents, currency,
                           payment_mode, payout_holder, payout_iban, payout_bic, payout_bank_name, payout_paypal,
                           referred_by, share_code, voucher_code, discount_cents)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      event.id,
      params.buyerName,
      params.buyerEmail,
      (params.payerName ?? '').trim(),
      totalCents,
      event.currency,
      params.paymentMode,
      payout.holder,
      payout.iban,
      payout.bic,
      payout.bankName,
      payout.paypal,
      (params.referredBy ?? '').trim(),
      // Minted here, once, so the code the buyer will broadcast never has to
      // be derived from anything a payment or support flow also relies on.
      generateShareCode(),
      voucherCode,
      discountCents
    );
    const ins = db.prepare(
      `INSERT INTO order_items (order_id, tier_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?)`
    );
    for (const it of resolved) ins.run(id, it.tierId, it.quantity, it.unitPriceCents);
  });
  tx();

  // Transfer orders hold seats while the money travels; free orders hold them
  // for the instant before finalizePaidOrder mints the codes. Either way the
  // claim happens here, atomically, or the order dies cleanly as 'cancelled'.
  if (params.paymentMode === 'transfer' || params.paymentMode === 'free') {
    try {
      claimInventory(id); // pending -> claimed, or throws SoldOutError
    } catch (e) {
      markOrderFailed(id, 'cancelled');
      throw e;
    }
  }

  return getOrder(id)!;
}

export function getOrder(id: string): OrderRow | null {
  const db = getDb();
  return (db.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE id = ?`).get(id) as OrderRow) ?? null;
}

export function getOrderByPaypalId(paypalOrderId: string): OrderRow | null {
  const db = getDb();
  return (
    (db.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE paypal_order_id = ?`).get(paypalOrderId) as OrderRow) ?? null
  );
}

export function setPaypalOrderId(orderId: string, paypalOrderId: string): void {
  getDb().prepare(`UPDATE orders SET paypal_order_id = ? WHERE id = ?`).run(paypalOrderId, orderId);
}

const ORDER_ITEM_COLS = `order_id AS orderId, tier_id AS tierId, quantity, unit_price_cents AS unitPriceCents`;

export function getOrderItems(orderId: string): OrderItemRow[] {
  return getDb()
    .prepare(`SELECT ${ORDER_ITEM_COLS} FROM order_items WHERE order_id = ?`)
    .all(orderId) as OrderItemRow[];
}

/**
 * Items for MANY orders in one statement, keyed by order id — the batch
 * companion to getOrderItems, for screens that already hold a page of orders
 * and used to ask for each one's lines separately.
 *
 * ORDER BY is spelled out rather than left to the planner: the single-order
 * reader above comes back in (order_id, tier_id) order because that is the
 * UNIQUE index it searches, and a summary line built from this map has to read
 * "2× Table, 1× Standard" in that same sequence or the same order would print
 * differently depending on which reader fetched it.
 *
 * Orders with no items are simply absent; callers default to an empty list.
 */
export function getOrderItemsBulk(orderIds: string[]): Map<string, OrderItemRow[]> {
  const out = new Map<string, OrderItemRow[]>();
  for (const batch of chunkIds(orderIds)) {
    const rows = getDb()
      .prepare(
        `SELECT ${ORDER_ITEM_COLS} FROM order_items
         WHERE order_id IN (${batch.map(() => '?').join(',')})
         ORDER BY order_id, tier_id`
      )
      .all(...batch) as OrderItemRow[];
    for (const r of rows) {
      const list = out.get(r.orderId);
      if (list) list.push(r);
      else out.set(r.orderId, [r]);
    }
  }
  return out;
}

export function getTicketsForOrder(orderId: string): TicketRow[] {
  return getDb()
    .prepare(`SELECT ${TICKET_COLS} FROM tickets WHERE order_id = ? ORDER BY tier_id, code`)
    .all(orderId) as TicketRow[];
}

export function markOrderFailed(orderId: string, status: 'failed' | 'cancelled' = 'failed'): void {
  const changes = getDb()
    .prepare(`UPDATE orders SET status = ? WHERE id = ? AND status IN ('pending', 'claimed')`)
    .run(status, orderId).changes;
  // An order that dies gives back whatever code it was holding: a reward was
  // earned by bringing friends, not by finishing this particular booking, and
  // a promo's cap must not be eaten by a sale that never happened.
  if (changes > 0) releaseDiscountCodeForOrder(orderId);
}

/**
 * Mark a CLAIMED/CAPTURING order paid and mint its tickets. Idempotent:
 * calling again on a paid order just returns the existing tickets.
 */
export function finalizePaidOrder(orderId: string, captureId: string | null): TicketRow[] {
  const db = getDb();
  const tx = db.transaction(() => {
    const order = getOrder(orderId);
    if (!order) throw new Error('Order not found');
    if (order.status === 'paid') return;
    if (order.status !== 'claimed' && order.status !== 'capturing') {
      throw new Error(`Cannot finalize order in status '${order.status}' — claim inventory first`);
    }
    db.prepare(`UPDATE orders SET status = 'paid', paid_at = datetime('now'), capture_id = ? WHERE id = ?`).run(
      captureId,
      orderId
    );
    const ins = db.prepare(`INSERT INTO tickets (code, order_id, tier_id) VALUES (?, ?, ?)`);
    for (const it of getOrderItems(orderId)) {
      // One QR ticket per PERSON, not per booking: a paid "2× Table of 8"
      // mints sixteen codes, each still admitting one person for one scan.
      // Missing tier (legacy deleted-tier data) falls back to one, which is
      // what every order meant before bundles existed.
      const seatsPerUnit = getEventTier(order.eventId, it.tierId)?.seatsPerUnit ?? 1;
      for (let i = 0; i < it.quantity * seatsPerUnit; i++) {
        // Retry on the (astronomically unlikely) code collision.
        for (let attempt = 0; ; attempt++) {
          try {
            ins.run(generateTicketCode(), orderId, it.tierId);
            break;
          } catch (e) {
            if (attempt >= 5) throw e;
          }
        }
      }
    }
  });
  tx();
  return getTicketsForOrder(orderId);
}

export interface TicketWithOrder extends TicketRow {
  eventId: string;
  orderStatus: OrderStatus;
  buyerName: string;
  buyerEmail: string;
  /** Set once lib/retention.ts erased the buyer — see below. */
  buyerErasedAt: string | null;
  paymentMode: PaymentMethod;
}

/**
 * The ticket and who it belongs to — a READ MODEL: every caller (the counter's
 * scan, the ticket page's "Ticket holder" line) puts the buyer on a screen, so
 * an erased row comes back as the anonymous label rather than as the
 * placeholder the sweep wrote. The stamp itself is kept on the row so a caller
 * can still tell "nobody to name" from "no name given".
 */
export function getTicketByCode(rawCode: string): TicketWithOrder | null {
  const code = normalizeTicketCode(rawCode);
  const row = getDb()
    .prepare(
      `SELECT t.code, t.order_id AS orderId, t.tier_id AS tierId, t.created_at AS createdAt,
              t.checked_in_at AS checkedInAt, o.event_id AS eventId, o.status AS orderStatus,
              o.buyer_name AS buyerName, o.buyer_email AS buyerEmail,
              o.buyer_erased_at AS buyerErasedAt,
              o.payment_mode AS paymentMode
       FROM tickets t JOIN orders o ON o.id = t.order_id
       WHERE t.code = ?`
    )
    .get(code) as TicketWithOrder | undefined;
  return row ? withAnonymizedBuyer(row) : null;
}

/**
 * Atomic door check-in: each ticket can be used exactly once.
 *
 * When `scope.eventId` is set (event-scoped scanner links), a valid ticket
 * that belongs to a DIFFERENT event is refused with 'wrong_event' — and no
 * ticket details are returned, so one event's door staff never see another
 * event's buyer data.
 */
export function checkInTicket(rawCode: string, scope?: { eventId?: string }): CheckinResponse {
  const db = getDb();
  const tx = db.transaction((): CheckinResponse => {
    const row = getTicketByCode(rawCode);
    if (!row) return { result: 'not_found' };
    if (scope?.eventId && row.eventId !== scope.eventId) {
      return { result: 'wrong_event' };
    }
    const tier = getEventTier(row.eventId, row.tierId);
    const ticket = {
      code: row.code,
      tierId: row.tierId,
      tierName: tier?.name ?? row.tierId,
      buyerName: row.buyerName,
      buyerEmail: row.buyerEmail,
      orderId: row.orderId,
    };
    if (row.orderStatus !== 'paid') return { result: 'not_paid', ticket };
    // Test-mode tickets must never admit anyone once real payments are on.
    if (row.paymentMode === 'mock' && getPaymentMode() !== 'mock') {
      return { result: 'mock_ticket', ticket };
    }
    if (row.checkedInAt) return { result: 'already_checked_in', checkedInAt: row.checkedInAt, ticket };
    db.prepare(`UPDATE tickets SET checked_in_at = datetime('now') WHERE code = ?`).run(row.code);
    return { result: 'ok', ticket };
  });
  return tx();
}

// ---------------- Admin/portal queries ----------------

export interface OrderListRow extends OrderRow {
  itemsSummary: string; // e.g. "2× General Admission, 1× Student"
  ticketCount: number;
}

/**
 * The list read model behind every orders screen and the CSV export. Buyers
 * are anonymised on the way out (an erased row prints 'a past guest', never
 * the placeholder that keeps its columns non-null) — this is the choke point
 * both listOrders and listAwaitingTransferOrders already pass through, so a
 * new orders screen inherits the rule instead of having to remember it.
 */
function withItemsSummary(rows: OrderRow[]): OrderListRow[] {
  return rows.map((row) => {
    const o = withAnonymizedBuyer(row);
    const items = getOrderItems(o.id);
    const itemsSummary = items
      .map((it) => `${it.quantity}× ${getEventTier(o.eventId, it.tierId)?.name ?? it.tierId}`)
      .join(', ');
    // Counts QR TICKETS (people), not bookings — every surface showing this
    // labels it as codes/tickets, and a "2× Table of 8" order is 16 of them.
    const ticketCount = items.reduce(
      (s, it) => s + it.quantity * (getEventTier(o.eventId, it.tierId)?.seatsPerUnit ?? 1),
      0
    );
    return { ...o, itemsSummary, ticketCount };
  });
}

/** Admin/portal order filter buckets (the chips on the orders pages). */
export type OrderFilter = 'all' | 'awaiting' | 'paid' | 'closed';

const FILTER_SQL: Record<Exclude<OrderFilter, 'all'>, string> = {
  awaiting: `status = 'claimed' AND payment_mode = 'transfer'`,
  paid: `status = 'paid'`,
  closed: `status IN ('cancelled', 'failed')`,
};

export function listOrders(
  opts: { eventId?: string; organizerId?: string; query?: string; limit?: number; filter?: OrderFilter } = {}
): OrderListRow[] {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 200, 1000);
  const conditions: string[] = [];
  const args: (string | number)[] = [];
  if (opts.eventId) {
    conditions.push(`event_id = ?`);
    args.push(opts.eventId);
  }
  if (opts.organizerId) {
    conditions.push(`event_id IN (SELECT id FROM events WHERE organizer_id = ?)`);
    args.push(opts.organizerId);
  }
  if (opts.query && opts.query.trim()) {
    // Let organizers paste a bank-transfer reference ("TICKETS-AB12CD34" or the
    // student form "TICKETS-S-AB12CD34") as-is — the hex part matches the
    // order id (LIKE is case-insensitive for ASCII).
    const q = `%${opts.query.trim().replace(/^TICKETS-(S-)?/i, '')}%`;
    conditions.push(`(buyer_name LIKE ? OR buyer_email LIKE ? OR id LIKE ?)`);
    args.push(q, q, q);
  }
  if (opts.filter && opts.filter !== 'all') {
    conditions.push(`(${FILTER_SQL[opts.filter]})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT ${ORDER_COLS} FROM orders ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...args, limit) as OrderRow[];
  return withItemsSummary(rows);
}

/** How many orders fall in each filter bucket (for the chip labels). */
export function countOrdersByFilter(
  query?: string,
  scope: { eventId?: string; organizerId?: string } = {}
): Record<OrderFilter, number> {
  const db = getDb();
  const conditions: string[] = [];
  const args: string[] = [];
  if (scope.eventId) {
    conditions.push(`event_id = ?`);
    args.push(scope.eventId);
  }
  if (scope.organizerId) {
    conditions.push(`event_id IN (SELECT id FROM events WHERE organizer_id = ?)`);
    args.push(scope.organizerId);
  }
  if (query && query.trim()) {
    const q = `%${query.trim().replace(/^TICKETS-(S-)?/i, '')}%`;
    conditions.push(`(buyer_name LIKE ? OR buyer_email LIKE ? OR id LIKE ?)`);
    args.push(q, q, q);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const row = db
    .prepare(
      `SELECT COUNT(*) AS all_n,
              COALESCE(SUM(CASE WHEN ${FILTER_SQL.awaiting} THEN 1 ELSE 0 END), 0) AS awaiting_n,
              COALESCE(SUM(CASE WHEN ${FILTER_SQL.paid} THEN 1 ELSE 0 END), 0) AS paid_n,
              COALESCE(SUM(CASE WHEN ${FILTER_SQL.closed} THEN 1 ELSE 0 END), 0) AS closed_n
       FROM orders ${where}`
    )
    .get(...args) as { all_n: number; awaiting_n: number; paid_n: number; closed_n: number };
  return { all: row.all_n, awaiting: row.awaiting_n, paid: row.paid_n, closed: row.closed_n };
}

export interface TierStats {
  tierId: string;
  name: string;
  /**
   * UNITS of the tier sold (bookings), matching `cap`, which is also in
   * units — a "Table of 8" tier reads "3 sold of 10 tables" here, never 24.
   * Attendance-style numbers (Stats.ticketsSold, checkedIn) count PEOPLE.
   */
  sold: number;
  cap: number;
  revenueCents: number;
}

export interface Stats {
  ordersPaid: number;
  /**
   * QR tickets minted on paid orders — PEOPLE, since each admits one. A paid
   * "Table of 8" booking counts 8 here, which is what makes the portal's
   * "sold / capacity" meters honest (capacity is seats).
   */
  ticketsSold: number;
  /** Money CONFIRMED received (real payments only — test-mode excluded). */
  revenueCents: number;
  checkedIn: number;
  /** Per-tier breakdown. Only meaningful for a single event ([] platform-wide). */
  perTier: TierStats[];
  /** Reservations whose bank transfer is still on its way. */
  awaitingTransferOrders: number;
  awaitingTransferCents: number;
  awaitingTransferTickets: number;
  /** Test-mode (mock) data still in the database — purge before going live. */
  mockPaidOrders: number;
  mockTicketsSold: number;
  mockRevenueCents: number;
}

/** Everything in Stats except perTier, which is read per event (see below). */
export type EventTotals = Omit<Stats, 'perTier'>;

const EMPTY_EVENT_TOTALS: EventTotals = {
  ordersPaid: 0,
  ticketsSold: 0,
  revenueCents: 0,
  checkedIn: 0,
  awaitingTransferOrders: 0,
  awaitingTransferCents: 0,
  awaitingTransferTickets: 0,
  mockPaidOrders: 0,
  mockTicketsSold: 0,
  mockRevenueCents: 0,
};

/**
 * Every headline number for MANY events in ONE statement, keyed by event id.
 *
 * This used to be seven separate single-row aggregates per event, which made
 * the organizer's dashboard cost eleven statements per listing it showed
 * (measured: 220 for a 20-event account). The numbers are cheap; asking for
 * them one event at a time was the expense.
 *
 * The three branches are UNION ALLed rather than joined because they count
 * DIFFERENT rows: one order has many tickets and many item lines, so joining
 * orders to both at once would multiply every money column by the fan-out.
 * Each branch therefore emits one row per row of its own table, zero in every
 * column it knows nothing about, and the outer GROUP BY adds them up.
 *
 * The id list is bound with NAMED parameters because it appears three times —
 * repeating a name costs one bound variable, repeating a `?` costs three, and
 * the batch size in lib/sqlIn is chosen against the one-variable-per-id rule.
 *
 * Events with no orders at all are simply absent; read through getStats() or
 * default to EMPTY_EVENT_TOTALS.
 */
export function getEventTotalsBulk(eventIds: string[]): Map<string, EventTotals> {
  const out = new Map<string, EventTotals>();
  for (const batch of chunkIds(eventIds)) {
    const names = batch.map((_, i) => `@e${i}`).join(',');
    const params = Object.fromEntries(batch.map((id, i) => [`e${i}`, id]));
    const rows = getDb()
      .prepare(
        `SELECT eventId,
                SUM(ordersPaid) AS ordersPaid, SUM(revenueCents) AS revenueCents,
                SUM(mockOrders) AS mockPaidOrders, SUM(mockRevenueCents) AS mockRevenueCents,
                SUM(awaitingOrders) AS awaitingTransferOrders, SUM(awaitingCents) AS awaitingTransferCents,
                SUM(ticketsSold) AS ticketsSold, SUM(mockTickets) AS mockTicketsSold,
                SUM(checkedIn) AS checkedIn, SUM(awaitingSeats) AS awaitingTransferTickets
         FROM (
           -- Money and order counts: one row per order.
           SELECT o.event_id AS eventId,
                  CASE WHEN o.status = 'paid' AND o.payment_mode != 'mock' THEN 1 ELSE 0 END AS ordersPaid,
                  CASE WHEN o.status = 'paid' AND o.payment_mode != 'mock' THEN o.total_cents ELSE 0 END AS revenueCents,
                  CASE WHEN o.status = 'paid' AND o.payment_mode = 'mock' THEN 1 ELSE 0 END AS mockOrders,
                  CASE WHEN o.status = 'paid' AND o.payment_mode = 'mock' THEN o.total_cents ELSE 0 END AS mockRevenueCents,
                  CASE WHEN o.status = 'claimed' AND o.payment_mode = 'transfer' THEN 1 ELSE 0 END AS awaitingOrders,
                  CASE WHEN o.status = 'claimed' AND o.payment_mode = 'transfer' THEN o.total_cents ELSE 0 END AS awaitingCents,
                  0 AS ticketsSold, 0 AS mockTickets, 0 AS checkedIn, 0 AS awaitingSeats
           FROM orders o WHERE o.event_id IN (${names})
           UNION ALL
           -- People: one row per minted ticket. checkedIn deliberately ignores
           -- order status — a scanned code was scanned.
           SELECT o.event_id, 0, 0, 0, 0, 0, 0,
                  CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END,
                  CASE WHEN o.status = 'paid' AND o.payment_mode = 'mock' THEN 1 ELSE 0 END,
                  CASE WHEN t.checked_in_at IS NOT NULL THEN 1 ELSE 0 END,
                  0
           FROM tickets t JOIN orders o ON o.id = t.order_id WHERE o.event_id IN (${names})
           UNION ALL
           -- Seats still on their way, in PEOPLE: a waiting "2× Table of 8"
           -- reservation is 16 tickets, not 2. No tickets are minted until the
           -- money lands, so these are counted from the booking and clamped by
           -- the same expression lib/inventory.ts consumes seats with.
           SELECT o.event_id, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  oi.quantity * ${seatsPerUnitSql('et')}
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
                LEFT JOIN event_tiers et ON et.event_id = o.event_id AND et.tier_key = oi.tier_id
           WHERE o.status = 'claimed' AND o.payment_mode = 'transfer' AND o.event_id IN (${names})
         )
         GROUP BY eventId`
      )
      .all(params) as (EventTotals & { eventId: string })[];
    for (const r of rows) {
      const { eventId, ...totals } = r;
      out.set(eventId, totals);
    }
  }
  return out;
}

/** One event's totals, or all zeros when it has never sold anything. */
export function totalsFor(totals: Map<string, EventTotals>, eventId: string): EventTotals {
  return totals.get(eventId) ?? EMPTY_EVENT_TOTALS;
}

/**
 * Per tier: 'sold' counts every paid seat (mock included — they hold capacity
 * until purged); revenue counts REAL money only, matching the headline revenue.
 */
function perTierStats(eventId: string): TierStats[] {
  const perTierRows = getDb()
    .prepare(
      `SELECT oi.tier_id AS tierId, COALESCE(SUM(oi.quantity), 0) AS sold,
              COALESCE(SUM(CASE WHEN o.payment_mode != 'mock' THEN oi.quantity * oi.unit_price_cents ELSE 0 END), 0) AS revenueCents
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status = 'paid' AND o.event_id = ?
       GROUP BY oi.tier_id`
    )
    .all(eventId) as { tierId: string; sold: number; revenueCents: number }[];
  const soldMap = new Map(perTierRows.map((r) => [r.tierId, r]));
  return getEventTiers(eventId).map((t) => ({
    tierId: t.tierKey,
    name: t.name,
    sold: soldMap.get(t.tierKey)?.sold ?? 0,
    cap: t.cap,
    revenueCents: soldMap.get(t.tierKey)?.revenueCents ?? 0,
  }));
}

/**
 * Sales stats for one event (pass its id) or the whole platform (omit it).
 * Platform-wide numbers sum across events; perTier is [] there because tier
 * keys are only unique within an event.
 *
 * The single-event case reads its totals through getEventTotalsBulk so that
 * one event's numbers and a dashboard full of them cannot drift apart — there
 * is one definition of "paid", "mock" and "awaiting", and it is up there.
 */
export function getStats(eventId?: string): Stats {
  if (eventId) {
    return {
      ...(getEventTotalsBulk([eventId]).get(eventId) ?? EMPTY_EVENT_TOTALS),
      perTier: perTierStats(eventId),
    };
  }

  const db = getDb();
  const paid = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS revenue
       FROM orders WHERE status = 'paid' AND payment_mode != 'mock'`
    )
    .get() as { n: number; revenue: number };
  const mock = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS revenue
       FROM orders WHERE status = 'paid' AND payment_mode = 'mock'`
    )
    .get() as { n: number; revenue: number };
  const mockTickets = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM tickets t JOIN orders o ON o.id = t.order_id
         WHERE o.status = 'paid' AND o.payment_mode = 'mock'`
      )
      .get() as { n: number }
  ).n;
  const ticketsSold = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM tickets t JOIN orders o ON o.id = t.order_id
         WHERE o.status = 'paid'`
      )
      .get() as { n: number }
  ).n;
  const checkedIn = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM tickets t JOIN orders o ON o.id = t.order_id
         WHERE t.checked_in_at IS NOT NULL`
      )
      .get() as { n: number }
  ).n;
  const awaiting = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS cents
       FROM orders WHERE status = 'claimed' AND payment_mode = 'transfer'`
    )
    .get() as { n: number; cents: number };
  const awaitingTickets = (
    db
      .prepare(
        `SELECT COALESCE(SUM(oi.quantity * ${seatsPerUnitSql('et')}), 0) AS n
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         LEFT JOIN event_tiers et ON et.event_id = o.event_id AND et.tier_key = oi.tier_id
         WHERE o.status = 'claimed' AND o.payment_mode = 'transfer'`
      )
      .get() as { n: number }
  ).n;

  return {
    ordersPaid: paid.n,
    ticketsSold,
    revenueCents: paid.revenue,
    checkedIn,
    perTier: [],
    awaitingTransferOrders: awaiting.n,
    awaitingTransferCents: awaiting.cents,
    awaitingTransferTickets: awaitingTickets,
    mockPaidOrders: mock.n,
    mockTicketsSold: mockTickets,
    mockRevenueCents: mock.revenue,
  };
}

/** Per-event stats (same shape as getStats — the event scoping made explicit). */
export function getEventStats(eventId: string): Stats {
  return getStats(eventId);
}

/**
 * One event's sales, counted rather than listed.
 *
 * Every field here is an aggregate ON PURPOSE: this is what the PLATFORM owner
 * is allowed to see about an event he does not run. He needs to know the
 * business is working — how many sold, how much money moved, how many walked
 * through the door — and none of that requires knowing who bought. The buyers
 * themselves belong to the organizer, who sees them in their own portal.
 */
export interface EventSalesSummary {
  ordersPaid: number;
  ticketsSold: number;
  revenueCents: number;
  checkedIn: number;
  awaitingOrders: number;
  awaitingCents: number;
}

const EMPTY_SALES_SUMMARY: EventSalesSummary = {
  ordersPaid: 0,
  ticketsSold: 0,
  revenueCents: 0,
  checkedIn: 0,
  awaitingOrders: 0,
  awaitingCents: 0,
};

/**
 * Sales totals for every event on the platform, keyed by event id — two
 * grouped queries rather than one per event, so the admin overview stays a
 * couple of statements however many events exist. Counting rules match
 * getStats(): revenue is real money only, ticketsSold counts every paid seat
 * (test-mode ones hold capacity until purged).
 *
 * Events with no orders are simply absent; read through summaryFor().
 */
export function listEventSalesSummaries(): Map<string, EventSalesSummary> {
  const db = getDb();
  const byEvent = new Map<string, EventSalesSummary>();
  const entry = (eventId: string): EventSalesSummary => {
    let row = byEvent.get(eventId);
    if (!row) {
      row = { ...EMPTY_SALES_SUMMARY };
      byEvent.set(eventId, row);
    }
    return row;
  };

  const orderRows = db
    .prepare(
      `SELECT event_id AS eventId,
              COALESCE(SUM(CASE WHEN status = 'paid' AND payment_mode != 'mock' THEN 1 ELSE 0 END), 0) AS ordersPaid,
              COALESCE(SUM(CASE WHEN status = 'paid' AND payment_mode != 'mock' THEN total_cents ELSE 0 END), 0) AS revenueCents,
              COALESCE(SUM(CASE WHEN ${FILTER_SQL.awaiting} THEN 1 ELSE 0 END), 0) AS awaitingOrders,
              COALESCE(SUM(CASE WHEN ${FILTER_SQL.awaiting} THEN total_cents ELSE 0 END), 0) AS awaitingCents
       FROM orders WHERE event_id IS NOT NULL GROUP BY event_id`
    )
    .all() as { eventId: string; ordersPaid: number; revenueCents: number; awaitingOrders: number; awaitingCents: number }[];
  for (const r of orderRows) {
    const row = entry(r.eventId);
    row.ordersPaid = r.ordersPaid;
    row.revenueCents = r.revenueCents;
    row.awaitingOrders = r.awaitingOrders;
    row.awaitingCents = r.awaitingCents;
  }

  const ticketRows = db
    .prepare(
      `SELECT o.event_id AS eventId,
              COALESCE(SUM(CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END), 0) AS ticketsSold,
              COALESCE(SUM(CASE WHEN t.checked_in_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS checkedIn
       FROM tickets t JOIN orders o ON o.id = t.order_id
       WHERE o.event_id IS NOT NULL GROUP BY o.event_id`
    )
    .all() as { eventId: string; ticketsSold: number; checkedIn: number }[];
  for (const r of ticketRows) {
    const row = entry(r.eventId);
    row.ticketsSold = r.ticketsSold;
    row.checkedIn = r.checkedIn;
  }

  return byEvent;
}

/** An event's totals, or an all-zero summary when it has never sold anything. */
export function summaryFor(
  summaries: Map<string, EventSalesSummary>,
  eventId: string
): EventSalesSummary {
  return summaries.get(eventId) ?? EMPTY_SALES_SUMMARY;
}

// ---------------- Operational recovery ----------------

/**
 * Orders stuck holding inventory ('claimed'/'capturing') older than the given
 * age — typically a crash or network failure mid-payment. Resolved by
 * reconcileOrders() in lib/reconcile.ts.
 *
 * Bank-transfer orders are EXCLUDED: a 'claimed' transfer reservation holds
 * its seats for days on purpose while the buyer's Überweisung is on its way —
 * it is awaiting money, not stuck, and must never be auto-released here.
 * Overdue ones are expired by expireOverdueTransferReservations() instead.
 */
export function getStuckOrders(olderThanMinutes: number): OrderRow[] {
  return getDb()
    .prepare(
      `SELECT ${ORDER_COLS} FROM orders
       WHERE status IN ('claimed', 'capturing')
         AND payment_mode != 'transfer'
         AND created_at < datetime('now', ?)
       ORDER BY created_at ASC`
    )
    .all(`-${Math.max(1, Math.floor(olderThanMinutes))} minutes`) as OrderRow[];
}

/**
 * PayPal orders still 'pending' after a while: the buyer may have approved the
 * payment at PayPal and then lost their connection before our capture ran.
 * reconcileOrders() checks PayPal and recovers the sale if so.
 */
export function getStalePendingPaypalOrders(olderThanMinutes: number, limit = 50): OrderRow[] {
  return getDb()
    .prepare(
      `SELECT ${ORDER_COLS} FROM orders
       WHERE status = 'pending' AND payment_mode = 'paypal' AND paypal_order_id IS NOT NULL
         AND created_at < datetime('now', ?)
       ORDER BY created_at ASC LIMIT ?`
    )
    .all(`-${Math.max(1, Math.floor(olderThanMinutes))} minutes`, limit) as OrderRow[];
}

// ---------------- Bank-transfer (Überweisung) orders ----------------

/**
 * Transfer reservations awaiting the buyer's bank transfer, oldest first —
 * the organizer's to-confirm worklist. Scoped to one event when eventId is
 * given, platform-wide otherwise.
 */
export function listAwaitingTransferOrders(eventId?: string): OrderListRow[] {
  const scope = eventId ? `AND event_id = ?` : '';
  const args: string[] = eventId ? [eventId] : [];
  const rows = getDb()
    .prepare(
      `SELECT ${ORDER_COLS} FROM orders
       WHERE status = 'claimed' AND payment_mode = 'transfer' ${scope}
       ORDER BY created_at ASC`
    )
    .all(...args) as OrderRow[];
  return withItemsSummary(rows);
}

/**
 * Cancel transfer reservations whose payment never arrived, releasing their
 * seats. Runs lazily from checkout/admin page loads. The cutoff is each
 * EVENT'S payWithinDays + 2 grace days: buyers are told the shorter deadline,
 * and the grace absorbs weekends/slow banks so a transfer sent on the last day
 * does not die in transit. Scoped to one event when eventId is given.
 * Returns the number of reservations expired.
 */
export function expireOverdueTransferReservations(eventId?: string): number {
  const db = getDb();
  const scope = eventId ? `AND event_id = ?` : '';
  const args: string[] = eventId ? [eventId] : [];
  const OVERDUE = `status = 'claimed' AND payment_mode = 'transfer' ${scope}
         AND created_at < datetime('now',
           '-' || (COALESCE((SELECT e.pay_within_days FROM events e WHERE e.id = orders.event_id), 5) + 2) || ' days')`;
  // The ids are read first so the codes those reservations were holding can be
  // handed back in the same transaction — a buyer whose transfer never arrived
  // loses their seats, which is the point, but must not also lose a reward
  // they earned by bringing friends, and a promo's cap must not be spent on a
  // booking nobody paid for. One transaction, so a crash between the two
  // cannot strand a code on a cancelled order. The release also puts the
  // cancelled order back to its full price (see releaseDiscountCodeForOrder),
  // so a transfer that turns up late is confirmed against what the order is
  // really worth and the discount — available again — is never honoured twice.
  const tx = db.transaction(() => {
    const ids = db.prepare(`SELECT id FROM orders WHERE ${OVERDUE}`).all(...args) as { id: string }[];
    if (ids.length === 0) return 0;
    const expired = db.prepare(`UPDATE orders SET status = 'cancelled' WHERE ${OVERDUE}`).run(...args).changes;
    for (const { id } of ids) releaseDiscountCodeForOrder(id);
    return expired;
  });
  return tx();
}

// Reservations expire on a multi-DAY timescale, so there is no reason to run
// the sweep on every page render. Page loads (homepage/checkout/admin) call the
// throttled version so a traffic spike doesn't fire a write-locking UPDATE on
// every request; the order-creation route still calls the exact version so a
// just-freed seat is always countable immediately.
let lastExpirySweep = 0;
const EXPIRY_SWEEP_MIN_INTERVAL_MS = 30_000;

export function expireOverdueTransferReservationsThrottled(): void {
  const now = Date.now();
  if (now - lastExpirySweep < EXPIRY_SWEEP_MIN_INTERVAL_MS) return;
  lastExpirySweep = now;
  try {
    expireOverdueTransferReservations();
  } catch (e) {
    console.error('Throttled transfer-expiry sweep failed:', e);
  }
}

/**
 * The organizer confirmed the money arrived on their bank statement: finalize
 * the order and mint tickets. Idempotent for already-paid orders. If the
 * reservation had already expired (status 'cancelled') the seats are
 * re-claimed first — so a transfer that arrived late still gets its tickets
 * while stock lasts; when the event has sold out in the meantime this throws
 * SoldOutError and the buyer must be refunded instead.
 */
export function markTransferOrderPaid(
  orderId: string,
  /** How the organizer matched it — kept so a disputed order can be asked. */
  confirmedVia: 'reference' | 'sender' = 'reference'
): TicketRow[] {
  const db = getDb();
  const order = getOrder(orderId);
  if (!order) throw new Error('Order not found');
  if (order.paymentMode !== 'transfer') {
    throw new Error('Only bank-transfer orders can be marked paid manually');
  }
  if (order.status === 'paid') return getTicketsForOrder(orderId);
  // The retention sweep has already erased who this was. Minting tickets now
  // would send them to erased@erased.invalid — the buyer who actually paid
  // could never receive or be told anything. Refuse loudly instead: the money
  // is real, but the resolution is a refund via the bank statement, not a
  // ticket nobody can deliver.
  if (order.buyerErasedAt) {
    throw new Error(
      'This order is too old to confirm — the buyer’s contact details have been erased under the privacy policy, so tickets could no longer be delivered. Refund the transfer instead.'
    );
  }

  // The whole revive+finalize must be atomic: if the event has sold out since
  // the reservation expired, claimInventory throws SoldOutError and the
  // transaction rolls back, leaving the order in its ORIGINAL status
  // (typically 'cancelled') — never stranded in 'pending' where the cleanup
  // job would later delete the record of a buyer who really paid.
  const tx = db.transaction(() => {
    if (order.status === 'cancelled' || order.status === 'failed' || order.status === 'pending') {
      // Late payment on an expired/never-claimed reservation: try to take the
      // seats back. claimInventory re-checks caps and throws SoldOutError.
      db.prepare(`UPDATE orders SET status = 'pending' WHERE id = ?`).run(orderId);
      claimInventory(orderId); // pending -> claimed, or throws (rolls back)
      // The seats came back; the code the order was holding has to as well.
      //
      // Normally there is nothing to do here: releaseDiscountCodeForOrder
      // hands the voucher (or the promo's redemption) back AND takes the
      // discount off this order at the same moment, so an expired reservation
      // is already back at its full list price and carries no code. This runs
      // for the orders that still hold one — and it must, because a discounted
      // total whose code belongs to somebody else again is exactly how one
      // discount comes to pay for two orders.
      //
      // If it cannot be re-claimed the code has provably been used up
      // elsewhere — the voucher spent on another order, or the promo's last
      // redemption taken — so it cannot be spent on this one either: the
      // discount comes off, the order goes back to what it is worth, and the
      // confirmation goes ahead. The money that arrived is real and
      // withholding tickets would punish a buyer who paid. What the organizer
      // then sees on the order is a total larger than the transfer, which is
      // the ordinary underpayment they already know how to handle, instead of
      // a discount silently granted twice and a line in a log nobody reads.
      if (order.voucherCode) {
        const reclaimed = reclaimDiscountCodeForOrder(orderId, order.voucherCode);
        if (!reclaimed) {
          const items = db
            .prepare(
              `SELECT COALESCE(SUM(quantity * unit_price_cents), 0) AS n
               FROM order_items WHERE order_id = ?`
            )
            .get(orderId) as { n: number };
          db.prepare(
            `UPDATE orders SET voucher_code = '', discount_cents = 0, total_cents = ? WHERE id = ?`
          ).run(items.n, orderId);
          console.error(
            `Order ${orderId} was confirmed paid with code ${order.voucherCode}, but that code had ` +
              `already been used up elsewhere — the discount has been removed and this order is back ` +
              `at its full price of ${items.n} cents. If the buyer transferred the discounted ` +
              `amount, the difference is still outstanding.`
          );
        }
      }
    }
    db.prepare(`UPDATE orders SET confirmed_via = ? WHERE id = ?`).run(confirmedVia, orderId);
    finalizePaidOrder(orderId, paymentReference(orderId));
  });
  tx();
  return getTicketsForOrder(orderId);
}

/**
 * Delete abandoned pending orders (they hold no inventory). Returns count.
 * Only orders that provably involve no money are deleted: mock orders, or
 * orders where no PayPal order was ever created. A pending order WITH a
 * PayPal order id is kept forever — the buyer may have been charged there,
 * and reconciliation needs the row to recover or audit it.
 */
export function cleanupOldPendingOrders(olderThanHours = 24): number {
  const db = getDb();
  const tx = db.transaction(() => {
    // Never delete transfer orders: they always have paypal_order_id NULL, and
    // a buyer may have sent money we haven't reconciled yet. Only mock orders
    // or PayPal orders that never reached PayPal are safe to remove.
    const ids = db
      .prepare(
        `SELECT id FROM orders
         WHERE status = 'pending' AND created_at < datetime('now', ?)
           AND payment_mode != 'transfer'
           AND (payment_mode = 'mock' OR paypal_order_id IS NULL)`
      )
      .all(`-${Math.max(1, Math.floor(olderThanHours))} hours`) as { id: string }[];
    const delItems = db.prepare(`DELETE FROM order_items WHERE order_id = ?`);
    const delOrder = db.prepare(`DELETE FROM orders WHERE id = ?`);
    for (const { id } of ids) {
      // Hand back any voucher first: deleting the order would otherwise leave
      // the voucher redeemed against a row that no longer exists — burnt for
      // good, on an order that never became a sale.
      releaseDiscountCodeForOrder(id);
      delItems.run(id);
      delOrder.run(id);
    }
    return ids.length;
  });
  return tx();
}

/**
 * Delete ALL test-mode (mock) orders and their tickets. Run before going live
 * so test tickets can never be scanned at the door and stats are clean.
 */
export function purgeMockOrders(): { orders: number; tickets: number } {
  const db = getDb();
  const tx = db.transaction(() => {
    const ids = db.prepare(`SELECT id FROM orders WHERE payment_mode = 'mock'`).all() as { id: string }[];
    let tickets = 0;
    const delTickets = db.prepare(`DELETE FROM tickets WHERE order_id = ?`);
    const delItems = db.prepare(`DELETE FROM order_items WHERE order_id = ?`);
    const delOrder = db.prepare(`DELETE FROM orders WHERE id = ?`);
    for (const { id } of ids) {
      // Same reason as the cleanup above — a purged test order must not take a
      // real voucher with it.
      releaseDiscountCodeForOrder(id);
      tickets += delTickets.run(id).changes;
      delItems.run(id);
      delOrder.run(id);
    }
    return { orders: ids.length, tickets };
  });
  return tx();
}
