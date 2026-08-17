// Server-only: platform-owner business settings — the per-event fee organizers
// pay, and the PLATFORM's own bank details (distinct from any event's bank
// details, which belong to organizers). Configured via environment variables.
import { formatMoney } from './money';

/**
 * The platform's own name, from PLATFORM_NAME.
 *
 * THE one definition. It was copy-pasted as `process.env.PLATFORM_NAME ||
 * 'NepaliConcert'` in six files, and worse, the name was written out by hand in
 * page titles, an account-disabled message, two AI briefings and a FAQ answer —
 * so setting PLATFORM_NAME renamed some of the product and not the rest.
 */
export function platformNameFromEnv(): string {
  return (process.env.PLATFORM_NAME || '').trim() || 'NepaliConcert';
}

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
 * The address BUYERS see, and reply to.
 *
 * Ticket deliveries, payment instructions, reminders, answered questions —
 * everything sent to somebody who bought a ticket. A buyer replying to their
 * ticket email should reach whoever answers "where do I collect", not the desk
 * that handles organizer accounts and payout security.
 *
 * Falls back to EMAIL_FROM so a deployment that never sets it keeps working
 * exactly as before.
 */
export function emailFromBuyers(): string {
  return (process.env.EMAIL_FROM_BUYERS || '').trim() || process.env.EMAIL_FROM || '';
}

/**
 * The address ORGANIZERS and the platform owner see, and reply to.
 *
 * Account credentials, sign-in codes, fee instructions, sign-in alerts, payout
 * alarms. Kept apart from the buyer address for two reasons that both matter.
 *
 * One is triage: a buyer asking about a ticket and an organizer whose payout
 * account has just moved need different people and different urgency, and one
 * inbox mixes them.
 *
 * The other is that the second is a security channel. The payout alarm and the
 * sign-in alert only work if the organizer reads them, and a reply address that
 * also receives every buyer's "is my ticket coming?" is an address whose alarms
 * get skimmed.
 */
export function emailFromOrganizers(): string {
  return (process.env.EMAIL_FROM_ORGANIZERS || '').trim() || process.env.EMAIL_FROM || '';
}

/** Just the address part of a "Name <a@b.c>" header, for use as a Reply-To. */
export function bareAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
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

  // Falls back to the ORGANIZER sending address, then to EMAIL_FROM, and then to
  // nothing at all.
  //
  // It used to fall back to the first ADMIN_EMAIL, which was backwards in the
  // worst way: that is the inbox that receives ADMIN SIGN-IN CODES, and this
  // function's value is printed on /contact, /privacy and /organizers. The
  // platform was publishing the single address most worth attacking, and
  // pointing at it as the place to write — so anyone deciding to phish the owner
  // was told which mailbox to aim at, on a public page, by us.
  //
  // The old 'hello@nepaliconcert.com' last resort was no better: a domain
  // nobody here owns, so mail to it disappears while looking like it worked.
  // Empty is the honest answer, and every caller already handles it — the pages
  // hide the line and sendContactRequestToTeam refuses rather than guessing.
  const organizerFrom = bareAddress(emailFromOrganizers());
  return organizerFrom || '';
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

/** Alias kept for readability at call sites that read as prose. */
export const platformName = platformNameFromEnv;

/**
 * The brand split into the plain part and the accented part, for the two-tone
 * wordmark used in the header, the footer and every email masthead.
 *
 * This used to be hardcoded twice over. The email did `/^(Nepali)(.+)$/` and
 * fell back to flat white for any other name; the site's Logo component did not
 * read PLATFORM_NAME AT ALL — it printed "Nepali" and "Concert" as two literal
 * spans, so renaming the platform changed the emails and left the logo on every
 * page still saying the old name.
 *
 * The rule now works for any name:
 *   "NepaliConcert"     -> Nepali | Concert   (split at the camelCase seam)
 *   "Events Ticket Buy" -> Events Ticket | Buy (accent the last word)
 *   "Nachtkasse"        -> Nachtkasse |        (nothing to accent; stays plain)
 *
 * Accenting the LAST word is the right default because that is how a wordmark
 * reads — the eye lands on the end — and it keeps the existing look for the
 * current name without naming it in code.
 */
export function platformWordmark(): { head: string; accent: string } {
  const name = platformNameFromEnv().trim();

  // Several words: accent the final one.
  const words = name.split(/\s+/);
  if (words.length > 1) {
    const accent = words[words.length - 1];
    return { head: words.slice(0, -1).join(' ') + ' ', accent };
  }

  // One word: split at a lower-to-upper seam, e.g. NepaliConcert.
  const seam = /^(.*[a-z0-9])([A-Z].*)$/.exec(name);
  if (seam) return { head: seam[1], accent: seam[2] };

  return { head: name, accent: '' };
}
