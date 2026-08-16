// Server-only: authenticator-app (TOTP, RFC 6238) support for admin login.
//
// This is the FREE, phone-based second factor: the admin scans a QR code once
// with Google Authenticator / Microsoft Authenticator / Authy, and thereafter
// the app shows a rotating 6-digit code. No SMS provider, no per-message cost.
//
// It is ADDITIVE: at the verify step the emailed code and (if set up) the
// authenticator code are BOTH accepted, so email always remains a fallback and
// the admin can never be locked out by a lost phone.
import crypto from 'crypto';
import QRCode from 'qrcode';
import { getDb } from './db';
import { getEventConfig } from './config';

const STEP_SECONDS = 30;
const DIGITS = 6;
// Accept the previous, current, and next window to tolerate clock drift.
const DRIFT_WINDOWS = 1;

const SECRET_KEY = 'admin_totp_secret';
const ENABLED_KEY = 'admin_totp_enabled';

// ---- base32 (RFC 4648, no padding) — the encoding authenticator apps expect --
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ---- HOTP/TOTP core (kept pure so it can be unit-tested against RFC vectors) --

/** RFC 4226 HOTP for a given counter, as a zero-padded DIGITS-length string. */
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter (safe for the ~1.8e9 windows we will ever see).
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}

/** TOTP code for the given secret bytes at a unix time (seconds). */
export function totpCode(secret: Buffer, unixSeconds: number): string {
  return hotp(secret, Math.floor(unixSeconds / STEP_SECONDS));
}

// ---- Secret storage + enrollment state (in the kv table) --------------------

function readKv(key: string): string | null {
  const row = getDb().prepare(`SELECT value FROM kv WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function writeKv(key: string, value: string): void {
  getDb()
    .prepare(`INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(key, value);
}

/** The base32 secret, creating a fresh random one on first use. */
export function getOrCreateTotpSecret(): string {
  const existing = readKv(SECRET_KEY);
  if (existing) return existing;
  const secret = base32Encode(crypto.randomBytes(20)); // 160-bit secret
  writeKv(SECRET_KEY, secret);
  return secret;
}

/** True once the admin has confirmed a code, i.e. authenticator login is live. */
export function isTotpEnrolled(): boolean {
  return readKv(ENABLED_KEY) === '1' && !!readKv(SECRET_KEY);
}

/** Mark authenticator login active (after the admin proves a working code). */
export function setTotpEnrolled(): void {
  writeKv(ENABLED_KEY, '1');
}

/** Turn authenticator login off and forget the secret (e.g. lost phone). */
export function disableTotp(): void {
  const db = getDb();
  db.prepare(`DELETE FROM kv WHERE key = ?`).run(SECRET_KEY);
  db.prepare(`DELETE FROM kv WHERE key = ?`).run(ENABLED_KEY);
}

/** otpauth:// URI that authenticator apps import from a QR code. */
export function totpAuthUri(secret: string): string {
  const cfg = getEventConfig();
  const issuer = cfg.eventName || 'Ticket Admin';
  // Read the admin email directly (not via otp.ts) to avoid a circular import.
  const account = (process.env.ADMIN_EMAIL || '').split(',')[0].trim() || 'admin';
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** PNG data URL of the enrollment QR (contains the secret — server-rendered only). */
export function totpQrDataUrl(secret: string): Promise<string> {
  return QRCode.toDataURL(totpAuthUri(secret), { width: 240, margin: 1 });
}

/**
 * Verify a submitted 6-digit code against the enrolled authenticator secret,
 * allowing ±1 time window for clock drift. Returns false when not enrolled.
 */
export function verifyTotp(rawCode: string): boolean {
  if (!isTotpEnrolled()) return false;
  const code = (rawCode || '').replace(/\D/g, '');
  if (code.length !== DIGITS) return false;
  const secretB32 = readKv(SECRET_KEY);
  if (!secretB32) return false;
  const secret = base32Decode(secretB32);
  const now = Math.floor(Date.now() / 1000);
  for (let w = -DRIFT_WINDOWS; w <= DRIFT_WINDOWS; w++) {
    const candidate = totpCode(secret, now + w * STEP_SECONDS);
    // Constant-time compare per window.
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) return true;
  }
  return false;
}

/**
 * Check a proposed code WITHOUT the enrolled flag — used during setup to confirm
 * the admin scanned correctly before we switch authenticator login on.
 */
export function verifyTotpAgainstSecret(secret: string, rawCode: string): boolean {
  const code = (rawCode || '').replace(/\D/g, '');
  if (code.length !== DIGITS) return false;
  const bytes = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000);
  for (let w = -DRIFT_WINDOWS; w <= DRIFT_WINDOWS; w++) {
    if (totpCode(bytes, now + w * STEP_SECONDS) === code) return true;
  }
  return false;
}
