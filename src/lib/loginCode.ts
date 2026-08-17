// Server-only: the emailed second factor at ORGANIZER sign-in.
//
// Who it is for. An organizer with an authenticator already has a stronger
// second factor and never sees this — that path is unchanged. This exists for
// everyone who has not enrolled one, who until now signed in on a password
// alone. A password is the thing that leaks: reused on another site, phished,
// read over a shoulder. A code sent to the account's own address is something
// the person holding a leaked password usually does not have.
//
// WHY IT MUST NOT BE ABLE TO LOCK ANYONE OUT. Mail from this platform is not
// reliably delivered yet — until the sending domain is authenticated, messages
// to some providers are silently dropped. A second factor that cannot be
// delivered does not protect an account, it destroys access to it, and it would
// do so to every organizer at once, with nobody able to sign in and fix it.
//
// So the login route treats a code it could not SEND as a code that was never
// required: the organizer signs in as they do today, and is told plainly that
// the check was skipped. That is a deliberate fail-open, and it is not a
// weakening of anything — it is exactly today's behaviour, kept as the floor,
// with a real second factor added on top for everyone whose mail works. What it
// must never become is a silent fail-open, which is why the response says so
// and the reason is logged.
//
// Modelled on lib/passwordReset.ts — same hashing, expiry and attempt shape,
// its own table, and nothing imported but crypto and the database so it stays
// clear of the email stack.
import crypto from 'crypto';
import { getDb } from './db';
import type { OtpVerdict } from './otp';

export type LoginCodeVerdict = OtpVerdict;

/** Ten minutes, matching the admin and reset codes. Stated in the email. */
const LOGIN_CODE_TTL_MS = 10 * 60_000;

/**
 * Five wrong guesses and the code is dead.
 *
 * A six-digit code is a million possibilities, which is only meaningful while
 * the number of tries is small. The rate limiter on the route bounds how fast
 * they can be made; this bounds how many exist at all for a given code.
 */
const MAX_ATTEMPTS = 5;

/** Distinct prefix, so a login-code hash can never collide with a reset one. */
function hashCode(code: string): string {
  return crypto.createHash('sha256').update(`organizer-login:${code}`).digest('hex');
}

/**
 * Generate, store (hashed) and return a fresh 6-digit code.
 *
 * Any outstanding code for the same organizer is dropped first: only the newest
 * one ever works, so a code sitting in an older email cannot be replayed, and
 * asking for another can never widen the attempt budget.
 */
export function createOrganizerLoginCode(organizerId: string): string {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM organizer_login_code WHERE organizer_id = ?`).run(organizerId);
    db.prepare(
      `INSERT INTO organizer_login_code (id, organizer_id, code_hash, expires_at, attempts)
       VALUES (?, ?, ?, ?, 0)`
    ).run(crypto.randomUUID(), organizerId, hashCode(code), Date.now() + LOGIN_CODE_TTL_MS);
  });
  tx();
  return code;
}

/**
 * True when a still-valid, unexhausted code is already outstanding.
 *
 * The login route uses this to avoid minting and sending a new code every time
 * the password is submitted: without it, anyone who knows the password could
 * script sign-in to flood the organizer's inbox and reset the attempt guard on
 * every call. While a fresh code is out, the organizer already has what they
 * need.
 */
export function freshLoginCodeOutstanding(organizerId: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT expires_at AS expiresAt, attempts FROM organizer_login_code
        WHERE organizer_id = ? AND used_at IS NULL
        ORDER BY expires_at DESC LIMIT 1`
    )
    .get(organizerId) as { expiresAt: number; attempts: number } | undefined;
  return Boolean(row && row.expiresAt > Date.now() && row.attempts < MAX_ATTEMPTS);
}

/**
 * Check a submitted code. Single-use: a correct one is stamped used_at inside
 * the same transaction that reads it, so two racing submissions cannot both
 * come back 'ok'. A wrong code costs an attempt; the last one burns it.
 */
export function verifyOrganizerLoginCode(organizerId: string, rawCode: string): LoginCodeVerdict {
  const code = (rawCode || '').replace(/\D/g, '');
  const db = getDb();
  const tx = db.transaction((): LoginCodeVerdict => {
    const row = db
      .prepare(
        `SELECT id, code_hash AS codeHash, expires_at AS expiresAt, attempts
           FROM organizer_login_code
          WHERE organizer_id = ? AND used_at IS NULL
          ORDER BY expires_at DESC
          LIMIT 1`
      )
      .get(organizerId) as { id: string; codeHash: string; expiresAt: number; attempts: number } | undefined;
    if (!row || row.expiresAt <= Date.now()) return 'expired';
    if (row.attempts >= MAX_ATTEMPTS) return 'too_many';
    db.prepare(`UPDATE organizer_login_code SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
    const ok =
      code.length === 6 &&
      crypto.timingSafeEqual(Buffer.from(hashCode(code), 'hex'), Buffer.from(row.codeHash, 'hex'));
    if (!ok) return row.attempts + 1 >= MAX_ATTEMPTS ? 'too_many' : 'wrong';
    db.prepare(`UPDATE organizer_login_code SET used_at = datetime('now') WHERE id = ?`).run(row.id);
    return 'ok';
  });
  return tx();
}

/** Drop every login code for an organizer (password change, account disabled). */
export function burnOrganizerLoginCodes(organizerId: string): void {
  getDb().prepare(`DELETE FROM organizer_login_code WHERE organizer_id = ?`).run(organizerId);
}

/**
 * The ONE answer to a code that did not work — wrong, expired, or out of
 * attempts, merged so a failed guess never reveals whether a code is even
 * outstanding.
 */
export const LOGIN_CODE_REJECTED_MESSAGE =
  'That code is not right, or it has expired. Check the newest email, or start again to get a new one.';
