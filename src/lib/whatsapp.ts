// An organizer's WhatsApp number, and the link that opens a chat with it.
//
// The number is typed by an organizer and ends up inside an href on a public
// page, so it is never stored or rendered as it was given. normalize() keeps
// DIGITS and nothing else, which is what makes the result safe: whatever was
// typed, what comes back can only ever be a wa.me path — no scheme of someone
// else's choosing, no host, no extra query, nothing that survives a stray
// quote. Everything downstream builds on the normalised form, never the raw
// input, so there is no path where the two can diverge.

/**
 * Digits only, with `00` international prefixes folded away.
 *
 * A single leading `0` is deliberately NOT stripped: that is a national trunk
 * prefix (German 0170…, UK 07…) and dropping it would silently produce a
 * different, reachable number belonging to somebody else. It fails validation
 * instead, and the organizer is asked for their country code.
 */
export function normalizeWhatsApp(raw: string): string {
  return (raw ?? '').replace(/\D+/g, '').replace(/^00/, '');
}

/**
 * E.164: a country code that cannot start with 0, and 8–15 digits in total.
 *
 * The lower bound is what rules out a half-typed number and a national one
 * missing its country code; the upper bound is the standard's own ceiling.
 */
export function isValidWhatsApp(raw: string): boolean {
  return WHATSAPP_DIGITS.test(normalizeWhatsApp(raw));
}

/** Country code first, 8–15 digits — tested against ALREADY normalised input. */
const WHATSAPP_DIGITS = /^[1-9]\d{7,14}$/;

/**
 * The chat link, or null when the number is not usable.
 *
 * Returning null rather than a broken URL is the point: every caller has to
 * decide what to do without one, so a bad number cannot reach a page as a
 * link that goes nowhere.
 */
export function whatsappUrl(raw: string, message?: string): string | null {
  const digits = normalizeWhatsApp(raw);
  // Tested against `digits` DIRECTLY, not through isValidWhatsApp, which
  // normalises again. normalize() strips one leading "00" per call, so
  // "0000441234567890" passed a check on "441234567890" while the href carried
  // "00441234567890" — a link WhatsApp rejects, which is the exact thing the
  // null return exists to prevent.
  if (!WHATSAPP_DIGITS.test(digits)) return null;
  const text = (message ?? '').trim();
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}

/**
 * A share link with NO number: wa.me/?text=… opens WhatsApp's own contact
 * picker, so the buyer chooses which group or friend hears about the event.
 *
 * This is the growth loop in one href. Every buyer who has just reserved is
 * standing in exactly the WhatsApp groups the event's next buyers are in, and
 * a pre-written message turns "I should tell people" into one tap. The text
 * is composed server-side from the event's own name and URL — nothing user-
 * typed rides along, so encodeURIComponent is the only escaping needed.
 */
export function whatsappShareUrl(text: string): string | null {
  const t = (text ?? '').trim();
  return t ? `https://wa.me/?text=${encodeURIComponent(t)}` : null;
}

/** `+49 170 1234567` — the number as a human reads it back, for display. */
export function formatWhatsApp(raw: string): string {
  const digits = normalizeWhatsApp(raw);
  return digits ? `+${digits}` : '';
}
