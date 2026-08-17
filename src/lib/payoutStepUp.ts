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
// asks for a check. There is nothing to redirect until money is already pointed
// somewhere, and challenging the very first IBAN would put a wall in front of
// every new organizer's setup while protecting nothing.
//
// WHAT THE CHECK IS is decided elsewhere, in api/portal/payout/method.ts — the
// authenticator where it is enrolled, the account password where it is not.
// This module only decides WHETHER one is needed and mints the proof that one
// happened, so it can stay a leaf: crypto, the database, and the signing key.
import crypto from 'crypto';
import { getSigningSecret } from './auth';

/**
 * How long a passed check keeps counting.
 *
 * Ten minutes, matching the admin and reset codes. Long enough to fix an IBAN
 * and the holder's name in two saves without proving yourself twice; short
 * enough that a token left behind on a shared machine is stale by the time
 * anyone finds it.
 */
export const STEP_UP_TTL_MS = 10 * 60_000;

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

  /**
   * Is this account ALREADY taking money somewhere?
   *
   * Asked of the whole account, not of the field being written, and that
   * distinction was a real hole. Judged per field, an account with an
   * established IBAN and no PayPal treated `{paypalAccount: "attacker@..."}` as
   * a first-time set and waved it through with no second factor — while the
   * checkout offers PayPal FIRST, labelled "Fastest", so the address added
   * without a challenge is the one buyers are steered to. Adding a destination
   * is not setting one up; it is a redirect with extra steps.
   *
   * An IBAN or a PayPal address, and deliberately NOT the account holder: a
   * name on its own is not somewhere money can go, and counting it would
   * challenge an organizer who typed their name, saved, and then reached for
   * the IBAN — the honest first-time setup this exemption exists for.
   */
  const anyDestinationEstablished =
    (current.bankIban ?? '').trim() !== '' || (current.paypalAccount ?? '').trim() !== '';

  for (const field of Object.keys(PAYOUT_FIELDS) as PayoutField[]) {
    if (!(field in patch)) continue;
    const next = patch[field];
    if (typeof next !== 'string') continue; // validation elsewhere rejects it
    const before = current[field] ?? '';
    if (comparable(before) === comparable(next)) continue; // no-op save
    changed.push(field);
  }

  return {
    changed,
    firstTimeOnly: changed.length > 0 && !anyDestinationEstablished,
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

