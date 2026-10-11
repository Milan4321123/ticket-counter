// What counts as a PayPal link, and nothing else.
//
// Split out of lib/events so the ORGANIZER'S EDITOR can ask the same question
// the buyer's page will answer. It used to live server-side only, which meant
// the editor could not tell someone whether what they had just typed would
// become a button or a line of text — they found out by publishing and looking.
//
// Safe on the client: pure string work, no database, no server-only imports.

/**
 * A PayPal.Me address and nothing else.
 *
 * Deliberately narrow. This field is free text an organizer types, and whatever
 * comes out of here is rendered as an href on a public page carrying the
 * platform's name — so an organizer who pastes a link to a lookalike payment
 * page must get plain text, not a trusted-looking "Pay here" button in front of
 * a buyer who arrived from our feed.
 */
const PAYPAL_LINK_RE = /^https:\/\/(?:www\.)?(?:paypal\.me|paypal\.com\/paypalme)\/[A-Za-z0-9._-]{1,64}\/?$/i;

/**
 * The link inside the QR code the PayPal app shows under "Your code"
 * (paypal.com/qrcodes/…). Organizers who only have that code — a screenshot
 * in their gallery — can hand it over as is; the editor reads the link out of
 * the picture in the browser. Same narrowness as above: PayPal's own host and
 * path only, so nothing else ever becomes a "Pay" button.
 */
const PAYPAL_QR_LINK_RE = /^https:\/\/(?:www\.)?paypal\.com\/qrcodes\/[A-Za-z0-9/_-]{1,160}(?:\?[A-Za-z0-9=&._%-]{0,200})?$/i;

/**
 * True for a PayPal.Me link (which can carry an amount) as opposed to a
 * PayPal app QR link (which cannot — the buyer types the amount in PayPal).
 */
export function isPaypalMeLink(link: string): boolean {
  return PAYPAL_LINK_RE.test(link);
}

/**
 * The clickable URL for what an organizer typed, or null when there is none:
 * a PayPal.Me link or a PayPal app QR link.
 *
 * "paypal.me/myband" without the scheme is what people actually paste, so it is
 * completed rather than rejected. An email address returns null — not because
 * we disapprove of it, but because PayPal has no URL that means "pay this
 * address": a mailto: would open a mail client, which is not paying anybody.
 */
export function paypalLinkFor(raw: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const withScheme = /^(?:www\.)?paypal\.(?:me|com)\//i.test(trimmed)
    ? `https://${trimmed.replace(/^www\./i, '')}`
    : trimmed;
  const qr = /^(?:www\.)?paypal\.com\/qrcodes\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
  if (PAYPAL_QR_LINK_RE.test(qr)) return qr;
  return PAYPAL_LINK_RE.test(withScheme) ? withScheme : null;
}
