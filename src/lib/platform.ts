// Server-only: platform-owner business settings, configured via environment
// variables.
//
// There used to be a per-event fee here — a base amount plus a per-ticket rate
// on capacity, paid to the platform's own bank account before an event could be
// published. All of it is gone, deliberately: the platform is free while it
// grows. Publishing gates on nothing but the listing being complete, no money
// ever flows to the platform, and the organizer's own payout details remain the
// only bank account in the system. If pricing ever returns it should return as
// a decision, not as a leftover — which is why the machinery was deleted rather
// than zeroed.

/**
 * The platform's own name, from PLATFORM_NAME.
 *
 * THE one definition. It was copy-pasted as `process.env.PLATFORM_NAME ||
 * 'NepaliConcert'` in six files, and worse, the name was written out by hand in
 * page titles, an account-disabled message, two AI briefings and a FAQ answer —
 * so setting PLATFORM_NAME renamed some of the product and not the rest.
 */
export function platformNameFromEnv(): string {
  return (process.env.PLATFORM_NAME || '').trim() || 'MartNepali';
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

/**
 * Where replies should actually go, per audience.
 *
 * Defaults to the From address, which is right once the domain can receive mail.
 * It is overridable because sending and receiving are separate services and they
 * arrive at different times: a domain can be authenticated for SENDING within
 * minutes while having no mailbox at all, and in that window a Reply-To of
 * tickets@yourdomain bounces every reply a buyer sends. Point these at an inbox
 * that exists — a personal address is fine — until real mailboxes are in place,
 * then delete them.
 */
export function replyToBuyers(): string {
  return (process.env.EMAIL_REPLY_TO_BUYERS || '').trim() || bareAddress(emailFromBuyers());
}

export function replyToOrganizers(): string {
  return (process.env.EMAIL_REPLY_TO_ORGANIZERS || '').trim() || bareAddress(emailFromOrganizers());
}

/** Just the address part of a "Name <a@b.c>" header, for use as a Reply-To. */
export function bareAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

/**
 * Where people reach the team — shown on /contact, /privacy and /impressum and
 * used as the "to" address for contact-form enquiries. PLATFORM_CONTACT_EMAIL
 * overrides it; otherwise SUPPORT_EMAIL below.
 */
export function platformContactEmail(): string {
  const explicit = (process.env.PLATFORM_CONTACT_EMAIL || '').trim();
  if (explicit) return explicit;

  // Falls back to the platform's own support address on its own domain.
  //
  // It once fell back to the first ADMIN_EMAIL, which was backwards in the
  // worst way: that is the inbox that receives ADMIN SIGN-IN CODES, and this
  // function's value is printed on /contact, /privacy and /organizers — the
  // platform was publishing the single address most worth attacking. Later it
  // fell back to the organizer sending address, which in production was a
  // mailbox on eventsticketbuy.com: a domain whose registration lapsed, so
  // everything written to it vanished. The Impressum (§5 DDG) and the privacy
  // notice require an address that actually reaches the operator, so the
  // default is now a fixed one on the platform's own domain.
  return SUPPORT_EMAIL;
}

/**
 * The platform's public support address — Impressum, privacy requests,
 * /contact. It must be able to RECEIVE: martnepali.com needs MX records (or
 * a forwarding service) pointing somewhere a person reads.
 */
export const SUPPORT_EMAIL = 'support@martnepali.com';

/**
 * Short per-organizer reference, e.g. 'NEPCON-1A2B3C4D'.
 *
 * Born as the Verwendungszweck for the old account fee; it survives the fee's
 * removal because the admin activation flow uses its last four characters as
 * the type-to-confirm phrase, and existing pending signups already have it.
 */
export function signupReference(organizerId: string): string {
  return 'NEPCON-' + organizerId.slice(0, 8).toUpperCase();
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
 *   "MartNepali"        -> Mart | Nepali      (split at the camelCase seam)
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

  // One word: split at a lower-to-upper seam, e.g. MartNepali.
  const seam = /^(.*[a-z0-9])([A-Z].*)$/.exec(name);
  if (seam) return { head: seam[1], accent: seam[2] };

  return { head: name, accent: '' };
}
