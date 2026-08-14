// Ticket code generation + QR helpers. Server-only (crypto/qrcode).
import crypto from 'crypto';
import QRCode from 'qrcode';

// No easily-confused characters (I, L, O, 0, 1).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Random, unguessable ticket code like "K7KQ-M3XP". */
export function generateTicketCode(): string {
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Uppercases and re-formats user/scanner input ("k7kq m3xp" -> "K7KQ-M3XP"). */
export function normalizeTicketCode(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4)}`;
  return raw.trim().toUpperCase();
}

// QR generation is CPU-bound (PNG encode) and the /order and /ticket pages are
// force-dynamic, so without this every page load re-rendered the same image. A
// ticket code's QR never changes once minted, so we memoize it. The cache is
// bounded (FIFO eviction) so it can't grow without limit even if fed arbitrary
// codes (e.g. scanner-link QRs, which also flow through here).
const qrCache = new Map<string, string>();
const QR_CACHE_MAX = 5_000;

/** PNG data URL of a QR code containing the given text (cached by content). */
export async function ticketQrDataUrl(code: string): Promise<string> {
  const hit = qrCache.get(code);
  if (hit) return hit;
  const dataUrl = await QRCode.toDataURL(code, { width: 260, margin: 1 });
  if (qrCache.size >= QR_CACHE_MAX) {
    const oldest = qrCache.keys().next().value;
    if (oldest !== undefined) qrCache.delete(oldest);
  }
  qrCache.set(code, dataUrl);
  return dataUrl;
}
