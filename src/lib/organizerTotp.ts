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
import { base32Encode, verifyTotpAgainstSecret } from './totp';

const DIGITS = 6;
const STEP_SECONDS = 30;

function platformName(): string {
  return process.env.PLATFORM_NAME || 'NepaliConcert';
}

interface TotpRow {
  secret: string | null;
  enabled: number;
}

function readRow(organizerId: string): TotpRow | null {
  return (
    (getDb()
      .prepare(`SELECT totp_secret AS secret, totp_enabled AS enabled FROM organizers WHERE id = ?`)
      .get(organizerId) as TotpRow | undefined) ?? null
  );
}

/** True once this organizer has confirmed a code — i.e. login now demands one. */
export function organizerTotpEnabled(organizerId: string): boolean {
  const row = readRow(organizerId);
  return Boolean(row && row.enabled === 1 && row.secret);
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
  if (!verifyTotpAgainstSecret(row.secret, rawCode)) return false;
  getDb().prepare(`UPDATE organizers SET totp_enabled = 1 WHERE id = ?`).run(organizerId);
  return true;
}

/** Turn it off and forget the secret — the "I lost my phone" path. */
export function disableOrganizerTotp(organizerId: string): void {
  getDb().prepare(`UPDATE organizers SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?`).run(organizerId);
}

/**
 * Verify a code at login. False whenever the account is not enrolled: callers
 * must check organizerTotpEnabled() first and never treat "not enrolled" as a
 * successful second factor.
 */
export function verifyOrganizerTotp(organizerId: string, rawCode: string): boolean {
  const row = readRow(organizerId);
  if (!row?.secret || row.enabled !== 1) return false;
  return verifyTotpAgainstSecret(row.secret, rawCode);
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
