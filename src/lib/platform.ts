// Server-only: platform-owner business settings — the per-event fee organizers
// pay, and the PLATFORM's own bank details (distinct from any event's bank
// details, which belong to organizers). Configured via environment variables.
import { formatMoney } from './money';

/** The flat part, paid to publish at all (€15.00). */
const DEFAULT_FEE_BASE_CENTS = 1500;

/** The per-ticket part, charged on the capacity the organizer states (€0.15). */
const DEFAULT_FEE_PER_TICKET_CENTS = 15;

/** Positive-integer env override, or the built-in default. */
function envCents(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function platformFeeBaseCents(): number {
  return envCents('PLATFORM_FEE_BASE_CENTS', DEFAULT_FEE_BASE_CENTS);
}

export function platformFeePerTicketCents(): number {
  return envCents('PLATFORM_FEE_PER_TICKET_CENTS', DEFAULT_FEE_PER_TICKET_CENTS);
}

/** Whole seats, ignoring anything a bad caller passes in. */
function seatsOf(capacity: number): number {
  return Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : 0;
}

/**
 * What ONE event costs its organizer: a flat fee to publish, plus a per-ticket
 * rate on the capacity they stated. 100 seats -> €30.00, 500 -> €90.00.
 *
 * WHY THE FLAT PART STAYS UP FRONT. It is what makes a draft into a commitment.
 * Building a page costs the platform real work — the design, the review, the
 * account — and a fee that scaled only with the room would let somebody take
 * all of that for a few euros by declaring a small one. It also means the
 * platform is paid something for every event it carries, including the ones
 * that never sell a ticket.
 *
 * WHY THE PER-TICKET PART IS PRICED ON CAPACITY RATHER THAN SALES. The platform
 * never touches ticket money — buyers pay organizers directly — so there is
 * nothing to deduct a per-sale fee FROM, and collecting one afterwards would
 * mean invoicing and chasing every organizer for small sums. Charging it on the
 * stated capacity turns the whole thing into ONE transfer, known before they
 * commit, with nothing left outstanding afterwards. The organizer prices the
 * room they booked; a room they do not fill is their risk, and always was.
 *
 * This is also why an event can no longer opt out of a capacity: the number is
 * what the fee is priced from, so an event able to sell past it would be one
 * where the fee and the tickets describe different events.
 *
 * Pure: same capacity and env in, same cents out.
 */
export function eventFeeCents(capacity: number): number {
  return platformFeeBaseCents() + seatsOf(capacity) * platformFeePerTicketCents();
}

/** One event's fee as money, e.g. '€90.00'. */
export function eventFeeAmount(capacity: number): string {
  return formatMoney(eventFeeCents(capacity), 'EUR');
}

/** The flat part as money, e.g. '€15.00'. */
export function platformFeeBaseAmount(): string {
  return formatMoney(platformFeeBaseCents(), 'EUR');
}

/** The per-ticket part as money, e.g. '€0.15'. */
export function platformFeePerTicketAmount(): string {
  return formatMoney(platformFeePerTicketCents(), 'EUR');
}

/**
 * Pricing where no event — and so no capacity — is known. States the rule
 * rather than a "from" price, because with a per-ticket part nobody ever pays
 * the flat fee alone and quoting it on its own would understate every real
 * event. Wherever an event IS known, quote its own amount instead
 * (eventFeeCents / quoteEventFee).
 */
export function platformFeeLabel(): string {
  return `${platformFeeBaseAmount()} + ${platformFeePerTicketAmount()} per ticket`;
}

/** The whole pricing rule in one line. */
export function platformFeeRule(): string {
  return `${platformFeeBaseAmount()} to publish, plus ${platformFeePerTicketAmount()} for every ticket your venue holds`;
}

/** One plain line telling an organizer where their own event's amount came from. */
export function eventFeeBasis(capacity: number): string {
  const seats = seatsOf(capacity);
  const perTicket = formatMoney(seats * platformFeePerTicketCents(), 'EUR');
  return (
    `${platformFeeBaseAmount()} to publish, plus ${platformFeePerTicketAmount()} × ${seats} tickets ` +
    `(${perTicket}) for the room you booked.`
  );
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
