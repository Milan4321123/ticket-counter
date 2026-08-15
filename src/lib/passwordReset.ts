// Server-only: one-time codes for the organizer "I forgot my password" flow.
//
// Flow: an organizer types the address they sign in with -> a 6-digit code is
// stored hashed with a 10-minute expiry and emailed to the address ON THE
// ACCOUNT -> the code comes back together with the new password, and the
// password is only set once the code checks out. The code is never returned by
// an API, never put in a URL, and never logged.
//
// Modelled on the admin OTP store (src/lib/otp.ts) — same hashing, expiry and
// attempt-counting shape — but with its own table, because admin_otp is the
// platform owner's login and must not share a lifetime with organizer resets.
//
// This module deliberately imports nothing but crypto + the database: that is
// what lets organizers.ts call burnOrganizerResetCodes() (on a password change,
// an admin reset, or an account being disabled) without an import cycle, and
// keeps the email stack out of every page that touches an organizer.
import crypto from 'crypto';
import { getDb } from './db';
import type { OtpVerdict } from './otp';

/** Same four outcomes the admin code check reports. */
export type ResetVerdict = OtpVerdict;

// Ten minutes, same as the admin code. Stated in the email and on the page, so
// all three have to move together if this ever changes.
const RESET_CODE_TTL_MS = 10 * 60_000;

// Lower than the admin's 6: the admin knows a code is waiting because they just
// typed the right password, while a reset code can be requested for any address
// by anyone, so the window for guessing one stays as narrow as is usable.
const MAX_ATTEMPTS = 5;

/**
 * The ONE answer to "send me a code", whatever the address turns out to be.
 *
 * Every branch of the request route returns this exact sentence — account
 * found, account missing, account disabled — so the page can never be used to
 * find out which addresses have accounts. If the platform owner later decides
 * clarity beats that privacy, this is the single line to change.
 */
export const RESET_REQUEST_NEUTRAL_MESSAGE =
  'If that address has an account, a code is on its way. Check your inbox — it can take a minute.';

/**
 * The ONE answer to a code that did not work: wrong, expired, out of attempts,
 * no such account, account disabled since. They are merged on purpose. Telling
 * "wrong code" apart from "no code outstanding" would say whether the address
 * has an account at all, which is exactly what the neutral request message
 * exists to hide.
 */
export const RESET_CODE_REJECTED_MESSAGE =
  'That code is not right, or it has expired. Check the newest email, or ask for a new code.';

/** Distinct prefix from the admin OTP's, so the two hashes can never collide. */
function hashCode(code: string): string {
  return crypto.createHash('sha256').update(`organizer-reset:${code}`).digest('hex');
}

/**
 * Generate, store (hashed) and return a fresh 6-digit code for this organizer.
 *
 * Any outstanding code for the same organizer is dropped first: only the newest
 * code ever works, so a code sitting in an older email cannot be replayed, and
 * asking for a new one can never widen the attempt budget.
 *
 * The caller is responsible for having checked that the organizer exists and is
 * active — this module never reads the organizers table.
 */
export function createOrganizerResetCode(organizerId: string): string {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM organizer_password_reset WHERE organizer_id = ?`).run(organizerId);
    db.prepare(
      `INSERT INTO organizer_password_reset (id, organizer_id, code_hash, expires_at, attempts)
       VALUES (?, ?, ?, ?, 0)`
    ).run(crypto.randomUUID(), organizerId, hashCode(code), Date.now() + RESET_CODE_TTL_MS);
  });
  tx();
  return code;
}

/**
 * Check a submitted code against this organizer's outstanding one.
 *
 * Single-use: a correct code is stamped used_at inside the same transaction
 * that reads it, so two racing submissions cannot both come back 'ok'. A wrong
 * code costs an attempt, and the last attempt burns the code.
 */
export function verifyOrganizerResetCode(organizerId: string, rawCode: string): ResetVerdict {
  const code = (rawCode || '').replace(/\D/g, '');
  const db = getDb();
  const tx = db.transaction((): ResetVerdict => {
    const row = db
      .prepare(
        `SELECT id, code_hash AS codeHash, expires_at AS expiresAt, attempts
           FROM organizer_password_reset
          WHERE organizer_id = ? AND used_at IS NULL
          ORDER BY expires_at DESC
          LIMIT 1`
      )
      .get(organizerId) as { id: string; codeHash: string; expiresAt: number; attempts: number } | undefined;
    if (!row || row.expiresAt <= Date.now()) return 'expired';
    if (row.attempts >= MAX_ATTEMPTS) return 'too_many';
    db.prepare(`UPDATE organizer_password_reset SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
    const ok =
      code.length === 6 &&
      crypto.timingSafeEqual(Buffer.from(hashCode(code), 'hex'), Buffer.from(row.codeHash, 'hex'));
    if (!ok) return row.attempts + 1 >= MAX_ATTEMPTS ? 'too_many' : 'wrong';
    db.prepare(`UPDATE organizer_password_reset SET used_at = datetime('now') WHERE id = ?`).run(row.id);
    return 'ok';
  });
  return tx();
}

/**
 * Throw away every reset code for an organizer — used one and unused ones.
 *
 * Called whenever the account's password or standing changes (a completed
 * reset, a password change in Settings, an admin-issued temporary password, an
 * account being disabled): after any of those, a code that was minted under the
 * old state must not still open the door.
 */
export function burnOrganizerResetCodes(organizerId: string): void {
  getDb().prepare(`DELETE FROM organizer_password_reset WHERE organizer_id = ?`).run(organizerId);
}
