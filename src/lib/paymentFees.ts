// What each way of getting paid costs the SELLER, per payment — client-safe.
//
// The platform charges nothing on any route. What is listed here is what the
// PROVIDER keeps out of each payment before it lands in the seller's own
// account, so a seller choosing between "bank transfer, free, confirm by hand"
// and "instant, provider keeps a cut" can see the trade in euros before they
// switch anything on.
//
// These are published list prices, hand-copied and dated. They are NOT read
// from the providers at runtime and they WILL drift: the date beside each one
// is the honest caveat, and the link is where the current figure lives. The
// panel that shows them says both. Update the numbers here, nowhere else.
//
// Sources checked 2026-09-24:
//   PayPal DE, "PayPal Checkout" domestic commercial rate — 2.99 % + €0.39
//     https://www.paypal.com/de/business/paypal-business-fees
//     (the older "Standardzahlung" rate of 2.49 % + €0.35 applies to money
//     sent to a PayPal.Me link or address, which is the manual route below)
//   Stripe DE, standard EEA cards — 1.5 % + €0.25, plus 19 % VAT on the fee
//     https://stripe.com/en-de/pricing
//     (international cards 3.25 % + €0.25; not modelled — most buyers here
//     pay with a German or EU card)

export type PaymentRoute = 'transfer' | 'paypalme' | 'paypal' | 'stripe';

export interface RouteFee {
  route: PaymentRoute;
  /** Short name for a table row. */
  label: string;
  /** Provider's percentage of the payment, e.g. 2.99. */
  percent: number;
  /** Provider's fixed part per payment, in cents. */
  fixedCents: number;
  /** VAT the provider adds ON TOP of its own fee (Stripe does; PayPal's is VAT-exempt). */
  vatPercentOnFee: number;
  /** Where the current figure is published. */
  source: string;
  /** ISO date the figure was last checked by hand. */
  checkedOn: string;
  /** How fast the seller can hand over the codes. */
  speed: string;
  /** What the seller has to DO per order. */
  effort: string;
}

export const ROUTE_FEES: readonly RouteFee[] = [
  {
    route: 'transfer',
    label: 'Bank transfer (Überweisung)',
    percent: 0,
    fixedCents: 0,
    vatPercentOnFee: 0,
    source: '',
    checkedOn: '2026-09-24',
    speed: 'Seconds with an instant transfer, otherwise 1–2 business days',
    effort: 'You confirm each payment on the Orders page once it shows on your statement',
  },
  {
    route: 'paypalme',
    label: 'PayPal.Me link (buyer sends money themselves)',
    percent: 2.49,
    fixedCents: 35,
    vatPercentOnFee: 0,
    source: 'https://www.paypal.com/de/business/paypal-business-fees',
    checkedOn: '2026-09-24',
    speed: 'Minutes',
    effort: 'You confirm each payment on the Orders page by matching the sender’s name',
  },
  {
    route: 'paypal',
    label: 'PayPal Checkout (instant)',
    percent: 2.99,
    fixedCents: 39,
    vatPercentOnFee: 0,
    source: 'https://www.paypal.com/de/business/paypal-business-fees',
    checkedOn: '2026-09-24',
    speed: 'Instant — codes go out the moment the buyer pays',
    effort: 'Nothing per order; needs a PayPal Business account and a REST app',
  },
  {
    route: 'stripe',
    label: 'Card via Stripe (instant)',
    percent: 1.5,
    fixedCents: 25,
    vatPercentOnFee: 19,
    source: 'https://stripe.com/en-de/pricing',
    checkedOn: '2026-09-24',
    speed: 'Instant — codes go out the moment the buyer pays',
    effort: 'Nothing per order; needs a Stripe account and a restricted API key',
  },
];

export function routeFee(route: PaymentRoute): RouteFee {
  const fee = ROUTE_FEES.find((f) => f.route === route);
  if (!fee) throw new Error(`Unknown payment route ${route}`);
  return fee;
}

/**
 * What the provider keeps out of one payment of `amountCents`, in cents,
 * rounded to the nearest cent the way the providers themselves round.
 */
export function providerCutCents(amountCents: number, fee: RouteFee): number {
  if (amountCents <= 0) return 0;
  const base = amountCents * (fee.percent / 100) + fee.fixedCents;
  const withVat = base * (1 + fee.vatPercentOnFee / 100);
  return Math.round(withVat);
}

/** What lands in the seller's account from one payment of `amountCents`. */
export function sellerNetCents(amountCents: number, fee: RouteFee): number {
  return Math.max(0, amountCents - providerCutCents(amountCents, fee));
}
