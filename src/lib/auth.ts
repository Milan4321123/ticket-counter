// Server-only: admin session auth via an HMAC-signed cookie.
// Do NOT import from 'use client' components (uses node:crypto + next/headers).
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getDb } from './db';

export const COOKIE_NAME = 'admin_session';
/** Short-lived cookie between "password ok" and "one-time code verified". */
export const PREAUTH_COOKIE_NAME = 'admin_preauth';
/** Cookie for door-staff scanner access (check-in only, no admin pages). */
export const SCAN_COOKIE_NAME = 'scan_session';

/** Session lifetime: 12 hours. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/** How long the password step stays valid while waiting for the OTP. */
export const PREAUTH_TTL_MS = 10 * 60 * 1000;

/**
 * Secret used to sign session/preauth/scanner tokens.
 *
 * SECURITY: the signing secret is NEVER derived from ADMIN_PASSWORD — doing so
 * would let anyone who knows the password forge a session cookie and bypass the
 * emailed one-time code entirely (the exact attack the OTP defends against).
 *  - Production: APP_SECRET is required (adminPasswordProblem() fails closed if
 *    it is missing), so this returns it.
 *  - Development: for convenience we mint a random secret once and persist it in
 *    the kv table, independent of the password. It survives restarts but is not
 *    reconstructible from anything the user types.
 */
function getSecret(): string | null {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  if (process.env.NODE_ENV === 'production') return null; // must be explicit in prod
  if (!process.env.ADMIN_PASSWORD) return null; // admin disabled anyway
  const db = getDb();
  const row = db.prepare(`SELECT value FROM kv WHERE key = 'dev_app_secret'`).get() as
    | { value: string }
    | undefined;
  if (row) return row.value;
  const generated = crypto.randomBytes(32).toString('hex');
  db.prepare(`INSERT INTO kv (key, value) VALUES ('dev_app_secret', ?) ON CONFLICT(key) DO NOTHING`).run(generated);
  const stored = db.prepare(`SELECT value FROM kv WHERE key = 'dev_app_secret'`).get() as { value: string };
  return stored.value;
}

/** Shared signing secret for other token kinds (organizer sessions, etc.). */
export function getSigningSecret(): string | null {
  return getSecret();
}

/** Placeholder passwords that must never protect a real deployment. */
const FORBIDDEN_PASSWORDS = new Set(['change-me', 'changeme', 'password', 'admin', 'admin123', '12345678']);

/**
 * Non-null when the admin auth config is unusable in production.
 * In development anything goes (convenience); in production we fail closed
 * rather than run an admin area behind 'change-me' or with a password-derived
 * signing key.
 */
export function adminPasswordProblem(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return 'ADMIN_PASSWORD is not set.';
  if (process.env.NODE_ENV !== 'production') return null;
  // In production the token-signing key MUST be an independent secret, never
  // reconstructible from the password.
  if (!process.env.APP_SECRET || process.env.APP_SECRET.length < 16) {
    return 'APP_SECRET must be set to a long random string in production (it signs admin sessions).';
  }
  if (FORBIDDEN_PASSWORDS.has(pw.toLowerCase())) {
    return 'ADMIN_PASSWORD is a placeholder — set a real password before going live.';
  }
  if (pw.length < 10) {
    return 'ADMIN_PASSWORD must be at least 10 characters in production.';
  }
  return null;
}

export function adminEnabled(): boolean {
  return adminPasswordProblem() === null;
}

/** Constant-time string comparison (hash both sides so lengths always match). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Admin-session revocation epoch. Admin session tokens are otherwise stateless
 * (a signed expiry), so without this a stolen token would stay valid for its
 * full 12h life even after the admin logs out or changes their password.
 * Bumping this epoch invalidates EVERY outstanding admin session at once —
 * "sign out everywhere". Logout bumps it, so clicking log out truly ends the
 * session on all devices, and a stolen cookie dies the moment you log out.
 */
export function readAdminSessionEpoch(): number {
  const row = getDb().prepare(`SELECT value FROM kv WHERE key = 'admin_session_epoch'`).get() as
    | { value: string }
    | undefined;
  const n = row ? Number(row.value) : 1;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function bumpAdminSessionEpoch(): number {
  const next = readAdminSessionEpoch() + 1;
  getDb()
    .prepare(
      `INSERT INTO kv (key, value) VALUES ('admin_session_epoch', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(String(next));
  return next;
}

function sign(exp: number, epoch: number, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`admin:${exp}:${epoch}`).digest('hex');
}

/** Token format: '<expiryUnixMs>.<epoch>.<hmacHex>'. */
export function createSessionToken(): string {
  const secret = getSecret();
  if (!secret) throw new Error('Admin auth is not configured (set ADMIN_PASSWORD)');
  const exp = Date.now() + SESSION_TTL_MS;
  const epoch = readAdminSessionEpoch();
  return `${exp}.${epoch}.${sign(exp, epoch, secret)}`;
}

export function verifySessionToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;

  const [expStr, epochStr, mac] = token.split('.');
  if (!expStr || !epochStr || !mac || !/^\d+$/.test(expStr) || !/^\d+$/.test(epochStr)) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  if (Number(epochStr) !== readAdminSessionEpoch()) return false; // revoked by logout / rotation
  return safeEqual(mac, sign(exp, Number(epochStr), secret));
}

/** Constant-time password check against ADMIN_PASSWORD. */
export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof password !== 'string') return false;
  return safeEqual(password, expected);
}

/** True when the current request carries a valid admin session cookie. */
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value ?? null);
}

// ---------------- Pre-auth (password passed, OTP outstanding) ----------------

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** Token format: '<expiryUnixMs>.<hmacHex>' over 'preauth:<exp>'. */
export function createPreauthToken(): string {
  const secret = getSecret();
  if (!secret) throw new Error('Admin auth is not configured (set ADMIN_PASSWORD)');
  const exp = Date.now() + PREAUTH_TTL_MS;
  return `${exp}.${signPayload(`preauth:${exp}`, secret)}`;
}

export function verifyPreauthToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;
  const [expStr, mac] = token.split('.');
  if (!expStr || !mac || !/^\d+$/.test(expStr)) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  return safeEqual(mac, signPayload(`preauth:${exp}`, secret));
}

export async function isPreauthRequest(): Promise<boolean> {
  const store = await cookies();
  return verifyPreauthToken(store.get(PREAUTH_COOKIE_NAME)?.value ?? null);
}

// ---------------- Door-scanner access tokens ----------------
//
// The admin or an organizer generates a scanner LINK whose key is a signed
// token carrying an epoch number. Opening the link stores the token in a
// cookie; the check-in API accepts it for scanning only. Epochs are PER
// EVENT (kv key 'scan_epoch:<eventId>'), so revoking one event's scanner
// links never logs out the door staff of every other event on the platform.

function readScanEpoch(eventId: string): number {
  const row = getDb().prepare(`SELECT value FROM kv WHERE key = ?`).get(`scan_epoch:${eventId}`) as
    | { value: string }
    | undefined;
  const n = row ? Number(row.value) : 1;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Invalidate every scanner link/cookie ever issued for ONE event. */
export function bumpScanEpoch(eventId: string): number {
  const next = readScanEpoch(eventId) + 1;
  getDb()
    .prepare(`INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(`scan_epoch:${eventId}`, String(next));
  return next;
}

/**
 * Token format: '<expiryUnixMs>.<epoch>.<eventId>.<hmacHex>' over
 * 'scan:<exp>:<epoch>:<eventId>'. Scanner links are EVENT-SCOPED: door staff
 * of one event can never check in tickets for another.
 */
export function createScanToken(eventId: string, validHours: number): string {
  const secret = getSecret();
  if (!secret) throw new Error('Admin auth is not configured (set ADMIN_PASSWORD)');
  if (!eventId || eventId.includes('.')) throw new Error('Invalid event id for scan token');
  const hours = Math.min(Math.max(validHours, 1), 24 * 7);
  const exp = Date.now() + hours * 60 * 60 * 1000;
  const epoch = readScanEpoch(eventId);
  return `${exp}.${epoch}.${eventId}.${signPayload(`scan:${exp}:${epoch}:${eventId}`, secret)}`;
}

/** The event this scanner token grants check-in access to, or null. */
export function verifyScanToken(token: string | null | undefined): { eventId: string } | null {
  if (!token) return null;
  const secret = getSecret();
  if (!secret) return null;
  const [expStr, epochStr, eventId, mac] = token.split('.');
  if (!expStr || !epochStr || !eventId || !mac || !/^\d+$/.test(expStr) || !/^\d+$/.test(epochStr)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  if (Number(epochStr) !== readScanEpoch(eventId)) return null; // revoked for this event
  if (!safeEqual(mac, signPayload(`scan:${exp}:${epochStr}:${eventId}`, secret))) return null;
  return { eventId };
}

/** Remaining lifetime of a (valid) scan token, for cookie maxAge. */
export function scanTokenRemainingSeconds(token: string): number {
  const exp = Number(token.split('.')[0]);
  return Math.max(60, Math.floor((exp - Date.now()) / 1000));
}

/**
 * Who may use the check-in API on this request: the platform admin (any
 * event), an event-scoped scanner cookie, or nobody. Organizer sessions are
 * handled separately by the check-in route (ownership must be checked against
 * the ticket's event).
 */
export async function isScanRequest(): Promise<{ kind: 'admin' } | { kind: 'scan'; eventId: string } | null> {
  if (await isAdminRequest()) return { kind: 'admin' };
  const store = await cookies();
  const scan = verifyScanToken(store.get(SCAN_COOKIE_NAME)?.value ?? null);
  return scan ? { kind: 'scan', eventId: scan.eventId } : null;
}
