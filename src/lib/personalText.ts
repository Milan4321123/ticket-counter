// Shared, client-safe (no Node imports): does a piece of text carry somebody's
// contact details or one of this site's private codes?
//
// Used wherever text leaves for a third party that has no business with it:
// the page translator (components/AutoTranslate in the browser, and again on
// the server in /api/translate — defence in depth, because the browser side
// can be bypassed), and the /contact chat, which strips addresses and numbers
// out of what the visitor typed before the model sees it (lib/creatorChat).
//
// Names cannot be recognised by a pattern; those are kept out by marking the
// element translate="no" / data-private where it is rendered. This file
// catches what has a SHAPE: an email address, a phone number, an IBAN, and
// the codes the site mints (ticket codes, payment references, share codes,
// order ids, card and link tokens). A false positive only means a string stays
// in English — the cheap side to err on.

const EMAIL_SRC = String.raw`[^\s@<>()\[\]"',;:]+@[^\s@<>()\[\]"',;:]+\.[a-z]{2,}`;
const EMAIL = new RegExp(EMAIL_SRC, 'i');
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,}/i;
/** A run of digits with the separators people write phone numbers with — not dots or colons (dates, times). */
const PHONE_RUN = /\+?\(?\d[\d \t()/-]{5,}\d/g;
/** Payment reference, e.g. TICKETS-AB12CD34 / TICKETS-S-AB12CD34 (lib/orders). */
const PAYMENT_REF = /\bTICKETS-(?:S-)?[0-9A-F]{8}\b/i;
/** Ticket / collection code, e.g. K7KQ-M3XP — lib/tickets' alphabet has no I, L, O, 0, 1. */
const TICKET_CODE = /\b[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}\b/;
/** An order / request id. */
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

/** Phone numbers written in `text`, as written. */
export function findPhones(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(PHONE_RUN)) {
    const run = m[0].trim();
    const digits = run.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(run)) continue; // an ISO date (and time)
    // "+49 …", "(0)6151 …", "0176 …" — or long enough to be a number with no
    // prefix at all (Nepali mobiles: 98XXXXXXXX). Short runs that start with
    // another digit are a street number and a postcode, or a year range.
    if (!/^[+(0]/.test(run) && digits.length < 9) continue;
    out.push(run);
  }
  return out;
}

/** Email addresses in `text`. */
export function findEmails(text: string): string[] {
  return text.match(new RegExp(EMAIL_SRC, 'gi')) ?? [];
}

/** One word of the text that looks like a code the site minted, not a word. */
function codeLikeToken(token: string): boolean {
  const letters = /[A-Za-z]/.test(token);
  const digits = /\d/.test(token);
  if (!letters || !digits) return false;
  // Link and card tokens, basket ids: long, random, mixed.
  if (token.length >= 16) return true;
  // Share codes, generated promo / voucher codes: Q7KX2M9A. Letters and digits
  // interleaved at least twice — "COVID19", "DASHAIN2026" or "100EUR" are not.
  if (token.length >= 6 && /^[A-Z0-9]+$/.test(token)) {
    const switches = token.match(/(?<=[A-Z])(?=\d)|(?<=\d)(?=[A-Z])/g)?.length ?? 0;
    return switches >= 2;
  }
  return false;
}

/** True when `text` contains an email address, a phone number, an IBAN or a site code. */
export function looksPersonal(text: string): boolean {
  if (EMAIL.test(text) || IBAN.test(text)) return true;
  if (PAYMENT_REF.test(text) || TICKET_CODE.test(text) || UUID.test(text)) return true;
  if (findPhones(text).length > 0) return true;
  return text.split(/[^A-Za-z0-9_-]+/).some((t) => t.split(/[-_]/).some(codeLikeToken) || codeLikeToken(t));
}

/**
 * `text` with every email address replaced by [email] and every phone number
 * by [phone] — and what was taken out, so the caller can still use it locally.
 */
export function redactContact(text: string): { text: string; emails: string[]; phones: string[] } {
  const emails = findEmails(text);
  let out = text.replace(new RegExp(EMAIL_SRC, 'gi'), '[email]');
  const phones = findPhones(out);
  for (const p of phones) out = out.split(p).join('[phone]');
  return { text: out, emails, phones };
}
