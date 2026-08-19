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
   * Optional: the ?ref= referral code the buyer arrived with. The server
   * validates it hard and stores '' for anything that does not name a paid
   * order of the same event by somebody else.
   */
  ref?: string;
  items: { tierId: string; quantity: number }[];
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
  mode: 'paypal' | 'mock' | 'transfer' | 'free';
  paypalOrderId: string | null; // set when mode === 'paypal'; return this from createOrder() in the PayPal JS SDK
  totalCents: number;
  currency: string;
}

export interface CaptureOrderResponse {
  orderId: string;
  status: 'paid';
  ticketCodes: string[];
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

export interface CheckinResponse {
  result: 'ok' | 'already_checked_in' | 'not_found' | 'not_paid' | 'mock_ticket' | 'wrong_event';
  checkedInAt?: string; // set for 'already_checked_in'
  ticket?: CheckinTicketInfo;
}
