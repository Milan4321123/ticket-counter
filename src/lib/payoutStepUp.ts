// Server-only: the second check in front of an organizer's PAYOUT ACCOUNT.
//
// WHY this exists.
//
// Every other field in the event editor is reversible. The payout account is
// not: it decides whose bank the buyers' money lands in, and a buyer who has
// already sent a transfer cannot un-send it. Until now, changing it needed
// nothing but a live session — the IBAN travelled in the same patch body as the
// bank's name. So anyone with a borrowed laptop, a session that was never
// signed out, or a shoulder-surfed password could point a selling event at
// their own account and simply wait. Nothing would look wrong: the event page,
// the checkout and the emails would all keep working, quoting the new IBAN.
//
// So the account that receives the money is now the one thing in the portal
// that asks "prove it is still you" a second time.
//
// WHAT COUNTS AS A CHANGE. Only the three fields that decide WHERE money goes —
// the IBAN, the account holder, and the PayPal address. The BIC and the bank's
// name are descriptive; they cannot redirect a payment, and gating them would
// buy nothing while making the form tiresome. A save that leaves the values
// alone is not a change either: the editor's forms POST every field they own,
// so re-saving the bank name must not demand a code.
//
// FIRST TIME IS FREE. Empty -> value asks for nothing; value -> different value
// asks for a code. There is nothing to redirect until money is already pointed
// somewhere, and requiring a code to set the very first IBAN would put a
// challenge in front of every new organizer's setup — over a mail path that,
// today, does not reliably reach Gmail.
//
// This module deliberately imports nothing but crypto, the database and the
// signing secret. Keeping the email stack out is what lets the routes decide
// HOW to challenge (authenticator, email, or password) without this file
// needing to know, and what stops a payout check from dragging nodemailer into
// every page that touches an organizer. See lib/passwordReset.ts, which is
// built the same way and for the same reason.
import crypto from 'crypto';
import { getSigningSecret } from './auth';
import { getDb } from './db';
import type { OtpVerdict } from './otp';

/** Same four outcomes the admin and reset code checks report. */
export type StepUpVerdict = OtpVerdict;

/**
 * How long a passed check keeps counting, and how long a code stays valid.
 *
 * Ten minutes for both, matching the admin and reset codes. Long enough to fix
 * an IBAN and the holder's name in two saves without a second code; short
 * enough that a token left behind on a shared machine is stale by the time
 * anyone finds it.
 */
export const STEP_UP_TTL_MS = 10 * 60_000;
const CODE_TTL_MS = 10 * 60_000;

/**
 * Five, matching the reset code rather than the admin's six. The code is worth
 * more than a login here — it is standing in front of the money — so the
 * guessing window stays as narrow as remains usable.
 */
const MAX_ATTEMPTS = 5;

/** Cookie carrying "this organizer re-proved themselves a moment ago". */
export const PAYOUT_STEP_UP_COOKIE = 'payout_step_up';

// ---------------- Which fields move money ----------------

/**
 * Patch field -> the column it writes and the name a human would call it.
 *
 * Anything not in this map is an ordinary event field. Adding a new way to be
 * paid means adding it HERE too, or it ships unguarded.
 */
export const PAYOUT_FIELDS = {
  bankIban: { column: 'bank_iban', label: 'your IBAN' },
  bankAccountHolder: { column: 'bank_account_holder', label: 'the account holder' },
  paypalAccount: { column: 'paypal_account', label: 'your PayPal address' },
} as const;

export type PayoutField = keyof typeof PAYOUT_FIELDS;

export function isPayoutField(name: string): name is PayoutField {
  return Object.prototype.hasOwnProperty.call(PAYOUT_FIELDS, name);
}

/**
 * The comparable form of a payout value.
 *
 * Spaces and case are how humans type these, not what the bank reads: an IBAN
 * pasted back with different grouping, or a holder's name re-typed in capitals,
 * is the SAME destination and must not trigger a challenge. Anything that
 * survives this and still differs is a genuinely different account.
 */
function comparable(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export interface PayoutChangeSummary {
  /** Fields whose destination genuinely moves — empty means no challenge. */
  changed: PayoutField[];
  /** True when every changed field was previously empty (first-time setup). */
  firstTimeOnly: boolean;
  /** Human labels of the changed fields, for the notification email. */
  labels: string[];
}

/**
 * Compare a patch against what the event holds today.
 *
 * `current` is keyed by patch-field name, not column name, so callers pass what
 * they already have from the event row. Only fields PRESENT in the patch are
 * considered — a patch that never mentions the IBAN can never be a change to
 * it, however the form was submitted.
 */
export function summarisePayoutChange(
  current: Record<PayoutField, string>,
  patch: Record<string, unknown>
): PayoutChangeSummary {
  const changed: PayoutField[] = [];
  let sawEstablished = false;

  for (const field of Object.keys(PAYOUT_FIELDS) as PayoutField[]) {
    if (!(field in patch)) continue;
    const next = patch[field];
    if (typeof next !== 'string') continue; // validation elsewhere rejects it
    const before = current[field] ?? '';
    if (comparable(before) === comparable(next)) continue; // no-op save
    changed.push(field);
    // Clearing an established destination counts too: emptying the IBAN is how
    // you force every buyer onto a PayPal address you just put in.
    if (before.trim() !== '') sawEstablished = true;
  }

  return {
    changed,
    firstTimeOnly: changed.length > 0 && !sawEstablished,
    labels: changed.map((f) => PAYOUT_FIELDS[f].label),
  };
}

/**
 * The one question the update route asks: does this patch need a fresh check?
 *
 * True only when a destination that was already set is being moved. See the
 * FIRST TIME IS FREE note at the top of this file.
 */
export function payoutChangeNeedsStepUp(
  current: Record<PayoutField, string>,
  patch: Record<string, unknown>
): boolean {
  const summary = summarisePayoutChange(current, patch);
  return summary.changed.length > 0 && !summary.firstTimeOnly;
}

// ---------------- The "I just proved it" token ----------------

function signStepUp(organizerId: string, exp: number, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`payout-step-up:${organizerId}:${exp}`).digest('hex');
}

/**
 * Token format: '<expiryUnixMs>.<hmacHex>'.
 *
 * Bound to ONE organizer id: a token minted by one account is not a step-up for
 * another, even though both are signed with the same platform secret.
 */
export function createStepUpToken(organizerId: string): string {
  const secret = getSigningSecret();
  if (!secret) throw new Error('Payout confirmation is not configured (set APP_SECRET)');
  const exp = Date.now() + STEP_UP_TTL_MS;
  return `${exp}.${signStepUp(organizerId, exp, secret)}`;
}

export function verifyStepUpToken(token: string | null | undefined, organizerId: string): boolean {
  if (!token || !organizerId) return false;
  const secret = getSigningSecret();
  if (!secret) return false;
  const [expStr, mac] = token.split('.');
  if (!expStr || !mac || !/^\d+$/.test(expStr)) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  const expected = signStepUp(organizerId, exp, secret);
  // Hash both sides so timingSafeEqual always gets equal-length buffers.
  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(mac).digest(),
    crypto.createHash('sha256').update(expected).digest()
  );
}

// ---------------- The emailed code ----------------

/** Distinct prefix, so a step-up hash can never collide with a reset one. */
function hashCode(code: string): string {
  return crypto.createHash('sha256').update(`organizer-step-up:${code}`).digest('hex');
}

/**
 * Generate, store (hashed) and return a fresh 6-digit code.
 *
 * Any outstanding code for the same organizer is dropped first: only the newest
 * one ever works, so a code in an older email cannot be replayed and asking
 * again can never widen the attempt budget.
 */
export function createPayoutStepUpCode(organizerId: string): string {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM organizer_step_up WHERE organizer_id = ?`).run(organizerId);
    db.prepare(
      `INSERT INTO organizer_step_up (id, organizer_id, code_hash, expires_at, attempts)
       VALUES (?, ?, ?, ?, 0)`
    ).run(crypto.randomUUID(), organizerId, hashCode(code), Date.now() + CODE_TTL_MS);
  });
  tx();
  return code;
}

/**
 * Check a submitted code. Single-use: a correct code is stamped used_at inside
 * the same transaction that reads it, so two racing submissions cannot both
 * come back 'ok'. A wrong code costs an attempt; the last one burns the code.
 */
export function verifyPayoutStepUpCode(organizerId: string, rawCode: string): StepUpVerdict {
  const code = (rawCode || '').replace(/\D/g, '');
  const db = getDb();
  const tx = db.transaction((): StepUpVerdict => {
    const row = db
      .prepare(
        `SELECT id, code_hash AS codeHash, expires_at AS expiresAt, attempts
           FROM organizer_step_up
          WHERE organizer_id = ? AND used_at IS NULL
          ORDER BY expires_at DESC
          LIMIT 1`
      )
      .get(organizerId) as { id: string; codeHash: string; expiresAt: number; attempts: number } | undefined;
    if (!row || row.expiresAt <= Date.now()) return 'expired';
    if (row.attempts >= MAX_ATTEMPTS) return 'too_many';
    db.prepare(`UPDATE organizer_step_up SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
    const ok =
      code.length === 6 &&
      crypto.timingSafeEqual(Buffer.from(hashCode(code), 'hex'), Buffer.from(row.codeHash, 'hex'));
    if (!ok) return row.attempts + 1 >= MAX_ATTEMPTS ? 'too_many' : 'wrong';
    db.prepare(`UPDATE organizer_step_up SET used_at = datetime('now') WHERE id = ?`).run(row.id);
    return 'ok';
  });
  return tx();
}

/**
 * Throw away every step-up code for an organizer.
 *
 * Called whenever the account's password or standing changes: a code minted
 * under the old state must not still be able to move the payout account.
 */
export function burnPayoutStepUpCodes(organizerId: string): void {
  getDb().prepare(`DELETE FROM organizer_step_up WHERE organizer_id = ?`).run(organizerId);
}

/**
 * The ONE answer to a code that did not work — wrong, expired, or out of
 * attempts. Merged so a failed guess never reveals whether a code is even
 * outstanding.
 */
export const STEP_UP_REJECTED_MESSAGE =
  'That code is not right, or it has expired. Check the newest email, or ask for a new one.';

/** Last four characters of a payout value — all a notification may ever show. */
export function maskPayoutValue(value: string): string {
  const compact = value.replace(/\s+/g, '');
  if (compact.length <= 4) return compact ? `••••${compact}` : '(removed)';
  return `••••${compact.slice(-4)}`;
}
