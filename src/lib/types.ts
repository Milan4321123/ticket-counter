// Shared API request/response shapes. Safe for both server and client imports.

/**
 * What a listing IS. The machinery underneath — page, priced types with a cap,
 * order, QR, scan — is shared; the kind decides the words around it (lib/vocab)
 * and which fields publishing insists on.
 *
 *   event — happens once, at a venue, on a date. Sells tickets, scanned at the door.
 *   shop  — sells items to collect. No date and no venue: pickupInfo says where
 *           and when instead, and the QR is a collection code.
 *
 * Lives here rather than in lib/events so the client may import it too.
 */
export type EventKind = 'event' | 'shop';

/** Anything unrecognised reads as an event — the kind that predates the column. */
export function asEventKind(value: unknown): EventKind {
  return value === 'shop' ? 'shop' : 'event';
}

export function isShop(listing: { kind: EventKind }): boolean {
  return listing.kind === 'shop';
}

export interface CreateOrderRequest {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  /**
   * Optional: whose name the money will arrive under, when it is not the
   * buyer's own — a partner's account, a parent's, a shared one. Lets the
   * seller match a payment that carries no reference, which is the normal case
   * on PayPal.
   */
  payerName?: string;
  /**
   * Optional: the buyer TICKED the "keep me posted" box — an action, never a
   * default. True records a per-organizer marketing consent (lib/marketing);
   * anything else records nothing. Checkout never blocks on it either way.
   */
  marketingOptIn?: boolean;
  /**
   * Optional: a referral code — either the one the buyer arrived with in
   * ?ref=, or the one they typed into the "someone referred you" box. It
   * CREDITS the person who shared it and changes nothing about this buyer's
   * price. The server validates it hard and stores '' for anything that does
   * not name a paid order of the same SELLER by somebody else.
   */
  ref?: string;
  /**
   * Optional: a discount code the buyer typed at checkout — either a referral
   * voucher (lib/referrals.ts) or one of the seller's own promo codes
   * (lib/promos.ts). Either way the SELLER'S own discount on the seller's own
   * price, and only one may apply to an order. The server re-validates and
   * claims it while the order is written, and refuses the order with a
   * readable message rather than quietly charging full price.
   */
  voucherCode?: string;
  items: { tierId: string; quantity: number }[];
  /**
   * Optional: which of the listing's offered routes the buyer picked —
   * 'transfer' (reserve, pay the seller directly, seller confirms), 'paypal'
   * (PayPal Checkout on the seller's own account) or 'stripe' (card, on the
   * seller's own Stripe account). The server refuses a route the listing does
   * not offer; absent means the listing's default.
   */
  payVia?: 'transfer' | 'paypal' | 'stripe' | 'mock';
  /**
   * The total the checkout DISPLAYED, in cents. Purely a guard: the server
   * always prices from its own tiers, and refuses (409) when the two disagree
   * — an organizer repricing mid-checkout must not silently charge a buyer a
   * different amount than the page showed, nor turn a free RSVP into a bill.
   */
  expectedTotalCents?: number;
}

export interface CreateOrderResponse {
  orderId: string; // local order id (uuid) — used for capture + the order page URL
  /** 'free' = a zero-total RSVP: already paid, tickets already minted. */
  mode: 'paypal' | 'stripe' | 'mock' | 'transfer' | 'free';
  paypalOrderId: string | null; // set when mode === 'paypal'; return this from createOrder() in the PayPal JS SDK
  /** Where to send the browser next, when mode === 'stripe' (the hosted Checkout page). */
  redirectUrl: string | null;
  /** The FINAL amount owed — items minus any voucher discount. */
  totalCents: number;
  /** What a redeemed voucher took off, 0 on almost every order. */
  discountCents: number;
  currency: string;
}

/**
 * POST /api/orders/voucher — "does this code work here, and for how much?"
 * Takes either kind of discount code; the buyer never has to know which they
 * are holding.
 */
export interface VoucherCheckRequest {
  eventId: string;
  code: string;
}

export interface VoucherCheckResponse {
  ok: true;
  /** The normalised code to send back with the order. */
  code: string;
  /**
   * Which kind it turned out to be — for the wording only. 'voucher' is one
   * the seller's referral rewards issued; 'promo' is one the seller minted and
   * handed out themselves.
   */
  source: 'voucher' | 'promo';
  /** 'fixed' takes off an amount; 'percent' takes off a share of the items. */
  kind: 'fixed' | 'percent';
  /** 'fixed' only; 0 for a percentage. */
  amountCents: number;
  /** 'percent' only; 0 for a flat amount. */
  percent: number;
  currency: string;
  /** Who is giving the discount — the buyer copy has to name them. */
  sellerName: string;
}

/**
 * POST /api/orders/referral — "is this referral code one somebody can be
 * credited for?"
 *
 * A SEPARATE thing from the voucher check above, and the checkout says so: a
 * referral code credits the person who shared it and takes nothing off this
 * buyer's price. Checked before the order is placed only so a mistyped code is
 * refused out loud instead of silently crediting nobody.
 */
export interface ReferralCheckRequest {
  eventId: string;
  code: string;
}

export interface ReferralCheckResponse {
  ok: true;
  /** The normalised code to send with the order. */
  code: string;
  /** Whose listing the credit goes to — the copy names the seller. */
  sellerName: string;
}

export interface CaptureOrderResponse {
  orderId: string;
  status: 'paid';
  ticketCodes: string[];
}

/**
 * The answer to "the buyer closed the payment window". `released` says whether
 * the order was actually ended — false is a perfectly normal answer (it was
 * already finished, or PayPal says money may still be moving), and the
 * checkout treats both the same way.
 */
export interface AbandonOrderResponse {
  ok: true;
  released: boolean;
}

export interface ApiErrorResponse {
  error: string; // human-readable, safe to show the buyer
  code?: 'VALIDATION' | 'SOLD_OUT' | 'SALES_CLOSED' | 'PAYMENT_FAILED' | 'NOT_FOUND' | 'INTERNAL';
}

export interface CheckinRequest {
  code: string;
}

export interface CheckinTicketInfo {
  code: string;
  tierId: string;
  tierName: string;
  buyerName: string;
  buyerEmail: string;
  orderId: string;
}

/**
 * A CUSTOMER CARD held up at the counter — the second kind of code the
 * check-in scanner recognises (lib/cards.ts). Nothing here is checked in or
 * spent: a card is not a ticket, it just says who is standing there.
 *
 * Only ever sent to an ORGANIZER's own session. A tokenized door-staff scanner
 * never receives one, because a door is handed a scanner to verify codes, not
 * to read a customer's standing with the seller.
 */
export interface CheckinCardInfo {
  cardCode: string;
  /** Read from their own orders — the card row stores no name. '' when unknown. */
  holderName: string;
  email: string;
  confirmedOrders: number;
  heldForDays: number;
  lastSeenAt: string | null;
  /** Unspent discount codes the seller could honour on the spot. */
  vouchers: { code: string; amountCents: number }[];
  currency: string;
}

export interface CheckinResponse {
  result:
    | 'ok'
    | 'already_checked_in'
    | 'not_found'
    | 'not_paid'
    | 'mock_ticket'
    | 'wrong_event'
    // Not a ticket at all: a customer card, answered with `card` below.
    | 'customer_card';
  checkedInAt?: string; // set for 'already_checked_in'
  ticket?: CheckinTicketInfo;
  card?: CheckinCardInfo; // set for 'customer_card'
}
