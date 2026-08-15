// Server-only: platform-owner business settings — the per-event fee organizers
// pay, and the PLATFORM's own bank details (distinct from any event's bank
// details, which belong to organizers). Configured via environment variables.
import { formatMoney } from './money';

/** Charged per person the venue holds: 10 cents each, i.e. €1.00 per 10 tickets. */
const DEFAULT_FEE_PER_CUSTOMER_CENTS = 10;

/** Floor for small rooms — no event ever costs less than this (€15.00). */
const DEFAULT_FEE_MIN_CENTS = 1500;

/** Positive-integer env override, or the built-in default. */
function envCents(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function platformFeePerCustomerCents(): number {
  return envCents('PLATFORM_FEE_PER_CUSTOMER_CENTS', DEFAULT_FEE_PER_CUSTOMER_CENTS);
}

export function platformFeeMinCents(): number {
  return envCents('PLATFORM_FEE_MIN_CENTS', DEFAULT_FEE_MIN_CENTS);
}

/** Whole seats, ignoring anything a bad caller passes in. */
function seatsOf(capacity: number): number {
  return Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : 0;
}

/**
 * The capacity part of the fee, before the minimum applies. Rounded to whole
 * euros because this number goes on a bank transfer and "€33.70" helps nobody.
 */
function feeBeforeMinimum(capacity: number): number {
  return Math.round((seatsOf(capacity) * platformFeePerCustomerCents()) / 100) * 100;
}

/**
 * What ONE event costs its organizer: the venue capacity times the per-person
 * rate, never below the minimum. 500 seats -> €50.00, 100 seats -> the €15.00
 * floor. Pure: same capacity and env in, same cents out.
 */
export function eventFeeCents(capacity: number): number {
  return Math.max(platformFeeMinCents(), feeBeforeMinimum(capacity));
}

/** One event's fee as money, e.g. '€50.00'. */
export function eventFeeAmount(capacity: number): string {
  return formatMoney(eventFeeCents(capacity), 'EUR');
}

/** The floor as money, e.g. '€15.00' — the "from" price in generic copy. */
export function platformFeeMinAmount(): string {
  return formatMoney(platformFeeMinCents(), 'EUR');
}

/**
 * Pricing where no event — and so no capacity — is known, e.g. 'from €15.00 per
 * event'. Wherever an event IS known, quote its own amount instead
 * (eventFeeCents / quoteEventFee).
 */
export function platformFeeLabel(): string {
  return `from ${platformFeeMinAmount()} per event`;
}

/** The whole pricing rule in one line, e.g. '€1.00 per 10 tickets, minimum €15.00'. */
export function platformFeeRule(): string {
  const perTen = formatMoney(platformFeePerCustomerCents() * 10, 'EUR');
  return `${perTen} per 10 tickets, minimum ${platformFeeMinAmount()}`;
}

/** One plain line telling an organizer where their own event's amount came from. */
export function eventFeeBasis(capacity: number): string {
  const perTen = formatMoney(platformFeePerCustomerCents() * 10, 'EUR');
  const seats = seatsOf(capacity);
  return feeBeforeMinimum(seats) < platformFeeMinCents()
    ? `Your venue holds ${seats} — smaller rooms pay the ${platformFeeMinAmount()} minimum.`
    : `Your venue holds ${seats} — that is ${perTen} for every 10 tickets.`;
}

/**
 * Where organizers reach the team — shown on /contact and used as the "to"
 * address for custom-page enquiries. Falls back to the first ADMIN_EMAIL entry
 * (the inbox that already receives admin sign-in codes), then to a demo
 * address so the page never renders an empty mailto link.
 */
export function platformContactEmail(): string {
  const explicit = (process.env.PLATFORM_CONTACT_EMAIL || '').trim();
  if (explicit) return explicit;
  const firstAdmin = (process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return firstAdmin || 'hello@nepaliconcert.com';
}

export interface PlatformBank {
  accountHolder: string;
  iban: string;
  bic: string;
  bankName: string;
}

/** The platform owner's account for receiving fees. Null until configured. */
export function platformBank(): PlatformBank | null {
  const accountHolder = (process.env.PLATFORM_BANK_HOLDER || '').trim();
  const iban = (process.env.PLATFORM_BANK_IBAN || '').trim();
  if (!accountHolder || !iban) return null;
  return {
    accountHolder,
    iban,
    bic: (process.env.PLATFORM_BANK_BIC || '').trim(),
    bankName: (process.env.PLATFORM_BANK_NAME || '').trim(),
  };
}

/** Account-level reference for an organizer signup, e.g. 'NEPCON-1A2B3C4D'. */
export function signupReference(organizerId: string): string {
  return 'NEPCON-' + organizerId.slice(0, 8).toUpperCase();
}

/**
 * Verwendungszweck for ONE event's fee, e.g. 'EVENT-4BD6F584'. This is what the
 * organizer puts in the transfer's purpose line so the platform owner can match
 * the payment to the event it unlocks.
 */
export function eventFeeReference(eventId: string): string {
  return 'EVENT-' + eventId.slice(0, 8).toUpperCase();
}
