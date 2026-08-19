// Server-only: the "keep me posted" consent book and its announcement audience.
//
// A buyer can tick an OPTIONAL box at checkout asking ONE organizer to tell
// them about future listings. That tick is a separate lawful basis from the
// ticket purchase, so it lives in its own table (marketing_consents) with its
// own lifecycle: it survives the after-event buyer erasure BECAUSE the buyer
// asked for it, and it dies the moment they unsubscribe — see /privacy, which
// promises exactly what this module does.
//
// Consent is DOUBLE opt-in: the checkout tick only records a pending request
// and triggers one confirmation email; nothing is marketed to the address
// until its owner presses the confirm button on the page that email links to.
// Anyone can type any address into a checkout, so the tick alone proves
// nothing — only the click from inside the mailbox does (the standard German
// email-marketing bar, BGH I ZR 164/09).
//
// Three hard rules every reader of this file must keep true:
//  1. The platform sends marketing ONLY to addresses whose row says they
//     CONFIRMED from their own inbox and have not unsubscribed. There is no
//     other list.
//  2. An unsubscribed row is kept as a suppression record (never re-emailed,
//     never silently revived by stale data) and is deleted entirely only on
//     an explicit request. Nothing lifts a suppression except a NEW confirmed
//     click from the mailbox — no checkout field, no UPSERT, no re-import.
//  3. The row stores the address and nothing else about the person: no name
//     (announcements open "Hi," on purpose), and the source order reference
//     is cleared on unsubscribe because suppression needs only the address.
import crypto from 'crypto';
import { getSigningSecret } from './auth';
import { getBaseUrl } from './config';
import { getDb } from './db';

export interface MarketingConsentRow {
  id: string;
  organizerId: string;
  email: string;
  consentedAt: string;
  confirmedAt: string | null;
  sourceOrderId: string | null;
  unsubscribedAt: string | null;
}

const CONSENT_COLS = `
  id,
  organizer_id AS organizerId,
  email,
  consented_at AS consentedAt,
  confirmed_at AS confirmedAt,
  source_order_id AS sourceOrderId,
  unsubscribed_at AS unsubscribedAt
`;

/** The one row (or none) this organizer holds about this address. */
export function getMarketingConsent(organizerId: string, email: string): MarketingConsentRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT ${CONSENT_COLS} FROM marketing_consents
         WHERE organizer_id = ? AND email = ? COLLATE NOCASE`
      )
      .get(organizerId, email.trim()) as MarketingConsentRow | undefined) ?? null
  );
}

/**
 * Record one buyer's REQUEST to hear from one organizer — the first half of
 * double opt-in. The UPSERT refreshes consented_at (which is what stamps the
 * confirmation token, so only the NEWEST confirmation link works) and the
 * order that carried the tick, and deliberately touches NOTHING else: it can
 * neither confirm a subscription nor clear unsubscribed_at, so a typed-in or
 * hostile address gets at most one more confirmation email, never marketing.
 *
 * Returns 'already-active' when the address is confirmed and not unsubscribed
 * (no email needed — they are on the list), else 'confirmation-needed' so the
 * caller sends the confirmation email. Never throws to its caller's face:
 * checkout must not fail because a consent row could not be written, so the
 * orders API wraps this in its own try/catch.
 */
export function requestMarketingConsent(params: {
  organizerId: string;
  email: string;
  sourceOrderId: string;
}): 'already-active' | 'confirmation-needed' {
  const existing = getMarketingConsent(params.organizerId, params.email);
  if (existing && existing.confirmedAt && !existing.unsubscribedAt) return 'already-active';
  getDb()
    .prepare(
      `INSERT INTO marketing_consents (id, organizer_id, email, source_order_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(organizer_id, email) DO UPDATE SET
         consented_at = datetime('now'),
         source_order_id = excluded.source_order_id`
    )
    .run(crypto.randomUUID(), params.organizerId, params.email.trim(), params.sourceOrderId);
  return 'confirmation-needed';
}

/**
 * The second half of double opt-in: the owner pressed the confirm button on
 * the page the confirmation email linked to. Only THIS may set confirmed_at,
 * and only this may lift a suppression — and even then only when the request
 * being confirmed is NEWER than the unsubscribe, so a confirmation link from
 * before someone unsubscribed can never quietly resubscribe them.
 *
 * `consentedAtStamp` is the consented_at value baked into the signed token:
 * requiring it to still match the row means every new tick of the box retires
 * all earlier confirmation links. Returns true when the row became (or was
 * re-made) active.
 */
export function confirmMarketingConsent(
  organizerId: string,
  email: string,
  consentedAtStamp: string
): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE marketing_consents
         SET confirmed_at = datetime('now'), unsubscribed_at = NULL
         WHERE organizer_id = ? AND email = ? COLLATE NOCASE
           AND consented_at = ?
           AND (unsubscribed_at IS NULL OR consented_at > unsubscribed_at)`
      )
      .run(organizerId, email.trim(), consentedAtStamp).changes === 1
  );
}

/** Active subscribers of one organizer: confirmed and not unsubscribed. */
export function activeConsentCount(organizerId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM marketing_consents
       WHERE organizer_id = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL`
    )
    .get(organizerId) as { n: number };
  return row.n;
}

/**
 * Who an announcement about this event would actually reach: the organizer's
 * confirmed, not-unsubscribed addresses, MINUS anyone marketing_sends says has
 * already been announced-to for this event. The card in the portal shows this
 * count, and the announce route walks exactly this list — the same query on
 * purpose, so the number promised is the number sent.
 */
export function listAnnouncementAudience(organizerId: string, eventId: string): MarketingConsentRow[] {
  return getDb()
    .prepare(
      `SELECT ${CONSENT_COLS} FROM marketing_consents
       WHERE organizer_id = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
         AND id NOT IN (SELECT consent_id FROM marketing_sends WHERE event_id = ?)
       ORDER BY consented_at ASC`
    )
    .all(organizerId, eventId) as MarketingConsentRow[];
}

/**
 * Claim the one send this consent gets for this event. INSERT OR IGNORE
 * against the UNIQUE pair: true means "this call owns the send", false means
 * somebody already announced this event to this subscriber. Claimed BEFORE
 * the email goes out so two racing button presses can never double-email —
 * and when the send then FAILS, the claimer must call releaseAnnouncementSend,
 * or the failure would silently burn the subscriber's one email for the event.
 */
export function claimAnnouncementSend(consentId: string, eventId: string): boolean {
  return (
    getDb()
      .prepare(`INSERT OR IGNORE INTO marketing_sends (consent_id, event_id) VALUES (?, ?)`)
      .run(consentId, eventId).changes === 1
  );
}

/**
 * Give back a claim whose send FAILED, so the subscriber stays eligible for a
 * retry — which is exactly what the portal tells the organizer. Only ever
 * called by the claim's owner in the same loop iteration, so it cannot free
 * a send that actually went out.
 */
export function releaseAnnouncementSend(consentId: string, eventId: string): void {
  getDb()
    .prepare(`DELETE FROM marketing_sends WHERE consent_id = ? AND event_id = ?`)
    .run(consentId, eventId);
}

// ---------------------------------------------------------------------------
// Signed tokens: unsubscribe and confirm.
//
// Both links work with no sign-in and cannot be forged or enumerated because
// the MAC covers the organizer and the address under APP_SECRET — same HMAC
// discipline as the scan tokens in lib/auth.ts, constant-time compare
// included. The unsubscribe token never expires (an unsubscribe request is
// never too late); the confirm token additionally bakes in the consented_at
// stamp of the request it confirms, so a newer tick retires older links.
// ---------------------------------------------------------------------------

/** Constant-time string comparison (hash both sides so lengths always match). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function signUnsubscribe(organizerId: string, email: string, secret: string): string {
  // The address is lowercased into the MAC so the token survives however the
  // email's casing is stored or retyped — it names a mailbox, not a string.
  return crypto
    .createHmac('sha256', secret)
    .update(`unsub:${organizerId}:${email.trim().toLowerCase()}`)
    .digest('hex');
}

/**
 * Token format: '<organizerId>.<base64url(email)>.<hmacHex>'. The email rides
 * inside the token (base64url keeps it dot- and URL-safe) so the unsubscribe
 * page needs no database lookup to know WHO is unsubscribing from WHOM —
 * the MAC is what makes the pair trustworthy.
 */
export function unsubscribeToken(organizerId: string, email: string): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const encoded = Buffer.from(email.trim(), 'utf8').toString('base64url');
  return `${organizerId}.${encoded}.${signUnsubscribe(organizerId, email, secret)}`;
}

/** The (organizer, email) pair a valid token names, or null for anything else. */
export function verifyUnsubscribeToken(token: string | null | undefined): {
  organizerId: string;
  email: string;
} | null {
  if (!token) return null;
  const secret = getSigningSecret();
  if (!secret) return null;
  const [organizerId, encoded, mac] = token.split('.');
  if (!organizerId || !encoded || !mac) return null;
  let email: string;
  try {
    email = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!email.trim()) return null;
  if (!safeEqual(mac, signUnsubscribe(organizerId, email, secret))) return null;
  return { organizerId, email: email.trim() };
}

/**
 * The visible link an announcement email carries: a page that unsubscribes on
 * one button press, never on the bare page load — mail scanners prefetch every
 * link, and a prefetch must not destroy a consent. Null only if unsigned.
 */
export function unsubscribeUrl(organizerId: string, email: string): string | null {
  const token = unsubscribeToken(organizerId, email);
  return token ? `${getBaseUrl()}/unsubscribe?token=${encodeURIComponent(token)}` : null;
}

/**
 * The RFC 8058 one-click endpoint for the List-Unsubscribe header: mail
 * clients POST here when the reader presses THEIR unsubscribe button. A POST
 * is safe from prefetchers by definition, so this one acts immediately.
 */
export function oneClickUnsubscribeUrl(organizerId: string, email: string): string | null {
  const token = unsubscribeToken(organizerId, email);
  return token ? `${getBaseUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}` : null;
}

function signConfirm(organizerId: string, email: string, stamp: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`confirm:${organizerId}:${email.trim().toLowerCase()}:${stamp}`)
    .digest('hex');
}

/**
 * Confirm-token format: '<organizerId>.<base64url(email)>.<base64url(stamp)>.<hmacHex>'
 * where stamp is the consented_at of the request being confirmed — MACed so a
 * link can only ever confirm the exact request it was mailed for.
 */
export function verifyConfirmToken(token: string | null | undefined): {
  organizerId: string;
  email: string;
  consentedAt: string;
} | null {
  if (!token) return null;
  const secret = getSigningSecret();
  if (!secret) return null;
  const [organizerId, encodedEmail, encodedStamp, mac] = token.split('.');
  if (!organizerId || !encodedEmail || !encodedStamp || !mac) return null;
  let email: string;
  let stamp: string;
  try {
    email = Buffer.from(encodedEmail, 'base64url').toString('utf8');
    stamp = Buffer.from(encodedStamp, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!email.trim() || !stamp) return null;
  if (!safeEqual(mac, signConfirm(organizerId, email, stamp, secret))) return null;
  return { organizerId, email: email.trim(), consentedAt: stamp };
}

/**
 * The link the confirmation email carries, for the address's CURRENT pending
 * request. Reads the row's consented_at so the token names exactly the request
 * on file; null when there is no row to confirm or the deployment is unsigned
 * (no link means no email goes out — see sendMarketingConfirmationEmail).
 */
export function confirmSubscriptionUrl(organizerId: string, email: string): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const row = getMarketingConsent(organizerId, email);
  if (!row) return null;
  const encodedEmail = Buffer.from(email.trim(), 'utf8').toString('base64url');
  const encodedStamp = Buffer.from(row.consentedAt, 'utf8').toString('base64url');
  const token = `${organizerId}.${encodedEmail}.${encodedStamp}.${signConfirm(organizerId, email, row.consentedAt, secret)}`;
  return `${getBaseUrl()}/subscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Stamp the consent unsubscribed. The row STAYS — it is now the suppression
 * record that stops this address ever being re-added by anything but the
 * owner's own confirmed re-consent. The source order reference is cleared in
 * the same breath: suppression needs only the address, so keeping anything
 * more would break the minimization /privacy promises. Idempotent: an
 * already-unsubscribed row keeps its original stamp, so clicking an old link
 * twice rewrites no history.
 */
export function markUnsubscribed(organizerId: string, email: string): void {
  getDb()
    .prepare(
      `UPDATE marketing_consents
       SET unsubscribed_at = datetime('now'), source_order_id = NULL
       WHERE organizer_id = ? AND email = ? COLLATE NOCASE AND unsubscribed_at IS NULL`
    )
    .run(organizerId, email.trim());
}

/**
 * Erase EVERY trace of an address from the consent book, across ALL
 * organizers — the "erased entirely on request" that /privacy and the
 * unsubscribe page promise about the do-not-email record (GDPR Art. 17).
 *
 * The marketing_sends rows must go FIRST, and in the same transaction:
 * marketing_sends.consent_id REFERENCES marketing_consents(id) and the
 * database runs with foreign_keys=ON, so a bare DELETE of a consent that was
 * ever announced-to throws — which is exactly how the legal promise would
 * quietly become undeliverable if this helper did not exist. Losing the sends
 * rows is harmless here: their only job is stopping a second announcement to
 * a consent that is about to stop existing.
 *
 * Spans every organizer because the person is asking the PLATFORM to forget
 * them, not one mailing list. Returns how many consent rows were erased so
 * the caller can tell "forgotten" from "was never on file".
 */
export function eraseMarketingConsent(email: string): number {
  const db = getDb();
  const tx = db.transaction(() => {
    const rows = db
      .prepare(`SELECT id FROM marketing_consents WHERE email = ? COLLATE NOCASE`)
      .all(email.trim()) as { id: string }[];
    const delSends = db.prepare(`DELETE FROM marketing_sends WHERE consent_id = ?`);
    const delConsent = db.prepare(`DELETE FROM marketing_consents WHERE id = ?`);
    for (const { id } of rows) {
      delSends.run(id);
      delConsent.run(id);
    }
    return rows.length;
  });
  return tx();
}
