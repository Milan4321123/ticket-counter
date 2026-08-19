// Server-only: turning a payment payload into something a camera can read.
//
// Separate from lib/girocode.ts on purpose. That file decides WHAT a bank app
// should be told, which is a specification question with exact answers and no
// dependencies. This one decides how big to draw it, which is a question about
// phone cameras and kitchen lighting. Keeping them apart means the payload
// rules stay testable without a PNG encoder in the room.
//
// Separate from lib/tickets.ts for a plainer reason: a ticket code is nine
// characters and a GiroCode is up to 331 bytes. The same 260px image that
// renders a ticket comfortably would render a GiroCode as a dense smear.
import QRCode from 'qrcode';

/**
 * Why these numbers.
 *
 * A full GiroCode payload lands around QR version 13-14 — roughly 70 modules
 * across. At 260px, as ticket codes are drawn, that leaves under 4 physical
 * pixels per module, which phone cameras manage only in good light held still.
 * 320px buys back a comfortable margin without the code dominating the page.
 *
 * Error correction stays at the library default (M, ~15% recovery). The
 * temptation is to raise it to H for robustness, but higher correction means
 * more modules for the same data, which makes each one SMALLER at a fixed pixel
 * width — the opposite of what helps here. M is what the specification's own
 * guidance assumes, and these codes are read off a clean screen or a fresh
 * print, not off a creased poster.
 */
const QR_WIDTH = 320;

// Same memoization reasoning as lib/tickets.ts: the order page is force-dynamic,
// so without a cache every reload re-encodes an identical PNG. Keyed by the full
// payload, which already varies per order, and bounded so a stream of distinct
// orders cannot grow it without limit.
const cache = new Map<string, string>();
const CACHE_MAX = 2_000;

/**
 * PNG data URL of a QR code for a payment payload, or null if it cannot be drawn.
 *
 * Null rather than throwing, to match girocodePayload(): the caller is a page
 * that is already showing the IBAN, the amount and the reference in text. A QR
 * that fails to encode should cost the buyer a convenience, never the
 * instructions they actually need to pay.
 */
export async function paymentQrDataUrl(payload: string | null): Promise<string | null> {
  if (!payload) return null;

  const hit = cache.get(payload);
  if (hit) return hit;

  try {
    const dataUrl = await QRCode.toDataURL(payload, { width: QR_WIDTH, margin: 1 });
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(payload, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}
