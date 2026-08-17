// Server-only: authenticator-app (TOTP) second factor for ORGANIZERS.
//
// The platform admin has had an authenticator for a while — see lib/totp.ts.
// This is the same mechanism per organizer account, and it deliberately reuses
// that file's crypto rather than reimplementing RFC 6238 a second time: one
// implementation, one place for a bug to live.
//
// WHY an authenticator and not an emailed login code.
//
// An emailed code is the obvious second factor and it is the wrong one here.
// It can only ever be as reliable as outbound mail, and on this platform mail
// to some providers is silently dropped. A login code on a broken mail path
// does not protect an account — it locks its owner out of it, permanently and
// with no way back in. An authenticator needs no network at all: the phone and
// the server agree on a clock and a shared secret, and that is the whole
// protocol. It also costs nothing to run.
//
// Enrolment is OPT-IN and two-step: a secret is generated and shown as a QR
// code, and it only becomes live once the organizer has typed a working code
// back. Nobody is ever locked out by a phone that turned out not to be set up
// correctly, because a secret that was never confirmed never guards anything.
import crypto from 'crypto';
import QRCode from 'qrcode';
import { getDb } from './db';
import { base32Encode, totpStepFor, verifyTotpAgainstSecret } from './totp';

const DIGITS = 6;
const STEP_SECONDS = 30;

function platformName(): string {
  return process.env.PLATFORM_NAME || 'NepaliConcert';
}

interface TotpRow {
  secret: string | null;
  enabled: number;
  /** Highest 30-second step already spent by this account. */
  lastStep: number;
}

function readRow(organizerId: string): TotpRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT totp_secret AS secret, totp_enabled AS enabled,
                COALESCE(totp_last_step, 0) AS lastStep
           FROM organizers WHERE id = ?`
      )
      .get(organizerId) as TotpRow | undefined) ?? null
  );
}

/** True once this organizer has confirmed a code — i.e. login now demands one. */
export function organizerTotpEnabled(organizerId: string): boolean {
  const row = readRow(organizerId);
  return Boolean(row && row.enabled === 1 && row.secret);
}

/**
 * True when a secret was generated but never confirmed.
 *
 * This state is invisible from the outside and easy to reach: scan the QR, get
 * interrupted, close the tab. Sign-in carries on asking for nothing, which is
 * correct — an unconfirmed secret must never guard anything — but it looks
 * exactly like an authenticator that does not work. Settings uses this to say
 * plainly that the setup is unfinished.
 */
export function organizerTotpPending(organizerId: string): boolean {
  const row = readRow(organizerId);
  return Boolean(row && row.enabled !== 1 && row.secret);
}

/**
 * A secret to enrol with, creating one on first use.
 *
 * Calling this again before confirming REPLACES the pending secret, which is
 * what someone who abandoned a half-finished setup expects when they start
 * again. It refuses to touch an already-enrolled account: regenerating there
 * would silently invalidate the authenticator that is currently working.
 */
export function startOrganizerTotpEnrolment(organizerId: string): string {
  const row = readRow(organizerId);
  if (!row) throw new Error('Unknown organizer');
  if (row.enabled === 1 && row.secret) return row.secret;
  const secret = base32Encode(crypto.randomBytes(20)); // 160-bit
  getDb().prepare(`UPDATE organizers SET totp_secret = ?, totp_enabled = 0 WHERE id = ?`).run(secret, organizerId);
  return secret;
}

/**
 * Finish enrolment: the code must verify against the pending secret before the
 * second factor is switched on. Returns false without changing anything if it
 * does not, so a mistyped or mis-scanned setup simply does not take effect.
 */
export function confirmOrganizerTotp(organizerId: string, rawCode: string): boolean {
  const row = readRow(organizerId);
  if (!row?.secret) return false;
  // The step is CONSUMED here too, and the earlier reasoning for leaving it
  // stateless was wrong. It is true that confirming grants nothing by itself —
  // the session is already signed in. But it leaves totp_last_step at 0 while
  // totp_enabled flips to 1, so for the remaining minute or so of that code's
  // validity it is still spendable at the two places that DO grant something:
  // the login second factor and the payout step-up. Somebody who watched the
  // setup being done, over a shoulder or on a shared screen, could use the very
  // code they saw typed.
  //
  // The cost is one thirty-second wait, once, at the end of setup — the same
  // wait already accepted everywhere else.
  const step = totpStepFor(row.secret, rawCode);
  if (step < 0) return false;
  getDb()
    .prepare(`UPDATE organizers SET totp_enabled = 1, totp_last_step = ? WHERE id = ?`)
    .run(step, organizerId);
  return true;
}

/** Turn it off and forget the secret — the "I lost my phone" path. */
export function disableOrganizerTotp(organizerId: string): void {
  // Clear the spent-step marker too, so a future enrolment starts clean rather
  // than inheriting a high-water mark from a secret that no longer exists.
  getDb()
    .prepare(`UPDATE organizers SET totp_secret = NULL, totp_enabled = 0, totp_last_step = 0 WHERE id = ?`)
    .run(organizerId);
}

/**
 * Verify a code at login. False whenever the account is not enrolled: callers
 * must check organizerTotpEnabled() first and never treat "not enrolled" as a
 * successful second factor.
 */
/**
 * Why a code was refused, so the caller can say something true.
 *
 * 'reused' is the one that matters: it is what an organizer meets by signing in
 * and going straight to their bank details, because the code their app is
 * showing is still the one the sign-in just spent. Reporting that as "not
 * right" invites them to retype the same digits, fail again, and burn the
 * attempt budget on their way to concluding the feature is broken.
 */
export type OrganizerTotpVerdict = 'ok' | 'reused' | 'wrong';

export function organizerTotpVerdict(organizerId: string, rawCode: string): OrganizerTotpVerdict {
  const row = readRow(organizerId);
  if (!row?.secret || row.enabled !== 1) return 'wrong';
  const step = totpStepFor(row.secret, rawCode);
  if (step < 0) return 'wrong';
  const changed = getDb()
    .prepare(
      `UPDATE organizers SET totp_last_step = ?
        WHERE id = ? AND COALESCE(totp_last_step, 0) < ?`
    )
    .run(step, organizerId, step).changes;
  return changed > 0 ? 'ok' : 'reused';
}

export function verifyOrganizerTotp(organizerId: string, rawCode: string): boolean {
  const row = readRow(organizerId);
  if (!row?.secret || row.enabled !== 1) return false;

  // SINGLE USE. A code stays arithmetically valid for about ninety seconds —
  // the current step plus one either side for clock drift — so without this the
  // same six digits could be spent more than once. That is not theoretical
  // here: an authenticator code is what signs an organizer in AND what releases
  // a payout change, so one code read over a shoulder, or replayed from a
  // phished login page, satisfied both.
  //
  // Remembering the highest step already spent makes a code good exactly once.
  // The write is conditional on the stored value in the same statement, so two
  // requests racing with the same code cannot both come back true: the second
  // UPDATE matches no row and is refused.
  return organizerTotpVerdict(organizerId, rawCode) === 'ok';
}

/** otpauth:// URI an authenticator app imports. Labelled per account. */
export function organizerTotpAuthUri(secret: string, email: string): string {
  const issuer = platformName();
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * PNG data URL of the enrolment QR. Contains the secret, so it is rendered
 * server-side into an already-authenticated page and never served from a URL
 * anyone could request.
 */
export function organizerTotpQrDataUrl(secret: string, email: string): Promise<string> {
  return QRCode.toDataURL(organizerTotpAuthUri(secret, email), { width: 240, margin: 1 });
}

/** The secret in typed-out form, for someone who cannot scan a QR code. */
export function formatSecretForTyping(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? [secret]).join(' ');
}
