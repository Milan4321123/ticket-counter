// Server-only: the wish list — "I would buy this" on things that cannot be
// bought (yet). Tapped on an example shop's goods (the site's own demo
// bazaar, which never takes an order), on a "Coming soon" ticket or dish, or at
// the end of a checkout that cannot take payment. Each wish is one row per
// item per device, so the count means "this many people want it", and it is
// what the admin (every item) and the seller (their own items) are shown.
//
// Nothing personal is kept: the device is a random token the visitor's own
// browser made up (components/WishButton), stored here only as a keyed hash
// that is DIFFERENT FOR EVERY ITEM (deviceKey below). No name, no email, no IP
// — and no way to tell from the table that two wishes came from one browser.
import crypto from 'node:crypto';
import { getSigningSecret } from './auth';
import { getDb } from './db';
import { readListingName } from './exampleShop';
import type { EventRow, EventTierRow } from './events';

let ready = false;
function db() {
  const d = getDb();
  if (!ready) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS item_wishes (
        event_id TEXT NOT NULL,
        tier_key TEXT NOT NULL,
        device TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (event_id, tier_key, device)
      );
      CREATE INDEX IF NOT EXISTS item_wishes_event ON item_wishes (event_id);
    `);
    ready = true;
    unlinkLegacyDevices(d);
  }
  return d;
}

// ---------------------------------------------------------------------------
// The device column
//
// It used to hold sha256('wish:' + token) — the SAME value on every item one
// browser wished for, so the table quietly recorded "this device wanted these
// twelve things", a browsing profile keyed by a stable pseudonym. Now it is
//
//     HMAC(key, eventId | tierKey | sha256('wish:' + token))
//
// keyed from APP_SECRET (which lives in the environment, not in this
// database): one browser's wishes on two items share nothing, and without the
// key the rows cannot even be tested against a known token.
//
// Why the old hash is the HMAC's input rather than the raw token: it makes the
// migration exact. An old row holds precisely that inner hash, so it can be
// rewritten to its new value in place, without the token — and "has this
// device already wished this item" keeps answering correctly for everybody
// who wished before the change. No reset. Old rows are 32 hex characters and
// new ones 64, which is how the migration tells them apart and why it is safe
// to run on every start.
//
// Rotating APP_SECRET changes every key and so resets the dedup (a returning
// device could wish once more per item); the counts themselves are unaffected.
// ---------------------------------------------------------------------------

const LEGACY_LEN = 32;

/** The inner, unkeyed digest — exactly what the column held before. */
function legacyDigest(token: string): string {
  return crypto.createHash('sha256').update(`wish:${token}`).digest('hex').slice(0, LEGACY_LEN);
}

let cachedKey: Buffer | null = null;
function wishKey(): Buffer {
  if (cachedKey) return cachedKey;
  let secret = getSigningSecret();
  if (!secret) {
    // Development without APP_SECRET (production refuses to run without one).
    // A random key kept in kv, so dedup survives a restart. Weaker — it sits in
    // the same database — but a local database is not what this protects.
    const d = getDb();
    d.prepare(`INSERT INTO kv (key, value) VALUES ('dev_wish_key', ?) ON CONFLICT(key) DO NOTHING`).run(
      crypto.randomBytes(32).toString('hex')
    );
    secret = (d.prepare(`SELECT value FROM kv WHERE key = 'dev_wish_key'`).get() as { value: string }).value;
  }
  cachedKey = Buffer.from(crypto.hkdfSync('sha256', secret, 'martnepali:wishes', 'item-device', 32));
  return cachedKey;
}

function itemDevice(eventId: string, tierKey: string, inner: string): string {
  return crypto.createHmac('sha256', wishKey()).update(`${eventId}\n${tierKey}\n${inner}`).digest('hex');
}

/**
 * This browser's pseudonym FOR THIS ITEM, as stored: never the token itself,
 * and never the same value on two items. Null for a token that is not one of
 * ours.
 */
export function deviceKey(token: string, eventId: string, tierKey: string): string | null {
  if (!/^[a-z0-9]{16,64}$/i.test(token)) return null;
  return itemDevice(eventId, tierKey, legacyDigest(token));
}

/** Rewrite rows still holding the old cross-item hash. Idempotent. */
function unlinkLegacyDevices(d: ReturnType<typeof getDb>): void {
  const old = d
    .prepare(`SELECT event_id AS eventId, tier_key AS tierKey, device FROM item_wishes WHERE length(device) = ?`)
    .all(LEGACY_LEN) as { eventId: string; tierKey: string; device: string }[];
  if (!old.length) return;
  // OR IGNORE: should a new-format row for the same device and item already
  // exist, the old one is a duplicate of it and is simply dropped below.
  const move = d.prepare(
    `UPDATE OR IGNORE item_wishes SET device = ? WHERE event_id = ? AND tier_key = ? AND device = ?`
  );
  const drop = d.prepare(`DELETE FROM item_wishes WHERE event_id = ? AND tier_key = ? AND device = ?`);
  d.transaction(() => {
    for (const r of old) {
      if (move.run(itemDevice(r.eventId, r.tierKey, r.device), r.eventId, r.tierKey, r.device).changes === 0) {
        drop.run(r.eventId, r.tierKey, r.device);
      }
    }
  })();
}

/** Why an item is wished for rather than bought — for the labels on the lists. */
export type WishReason = 'example' | 'coming-soon' | 'not-selling' | 'on-sale';

export function wishReason(event: EventRow, tier: EventTierRow): WishReason {
  if (readListingName(event.name).isExample) return 'example';
  if (tier.status === 'coming-soon') return 'coming-soon';
  if (!event.salesOpen) return 'not-selling';
  return 'on-sale';
}

/** Only published, real (not try-it-yourself demo) listings, and visible items. */
export function canWish(event: EventRow | null, tier: EventTierRow | null): boolean {
  return Boolean(event && tier && event.status === 'published' && !event.isDemo && tier.status !== 'hidden');
}

export function setWish(eventId: string, tierKey: string, device: string, on: boolean): number {
  const d = db();
  if (on) d.prepare(`INSERT OR IGNORE INTO item_wishes (event_id, tier_key, device) VALUES (?, ?, ?)`).run(eventId, tierKey, device);
  else d.prepare(`DELETE FROM item_wishes WHERE event_id = ? AND tier_key = ? AND device = ?`).run(eventId, tierKey, device);
  return wishCount(eventId, tierKey);
}

export function wishCount(eventId: string, tierKey: string): number {
  const row = db().prepare(`SELECT COUNT(*) AS n FROM item_wishes WHERE event_id = ? AND tier_key = ?`).get(eventId, tierKey) as { n: number };
  return row.n;
}

export function hasWished(eventId: string, tierKey: string, device: string): boolean {
  return Boolean(db().prepare(`SELECT 1 FROM item_wishes WHERE event_id = ? AND tier_key = ? AND device = ?`).get(eventId, tierKey, device));
}

/** tierKey → how many want it, for one listing. */
export function wishCountsFor(eventId: string): Map<string, number> {
  const rows = db()
    .prepare(`SELECT tier_key AS tierKey, COUNT(*) AS n FROM item_wishes WHERE event_id = ? GROUP BY tier_key`)
    .all(eventId) as { tierKey: string; n: number }[];
  return new Map(rows.map((r) => [r.tierKey, r.n]));
}

export interface WishTotal {
  eventId: string;
  tierKey: string;
  eventName: string;
  eventSlug: string;
  tierName: string;
  tierStatus: string;
  priceCents: number;
  currency: string;
  organizerId: string | null;
  isDemo: boolean;
  salesOpen: boolean;
  wishes: number;
  last: string;
}

/** Every wished-for item, most wanted first — the admin's view, or one seller's. */
export function listWishTotals(organizerId?: string): WishTotal[] {
  const rows = db()
    .prepare(
      `SELECT w.event_id AS eventId, w.tier_key AS tierKey, COUNT(*) AS wishes, MAX(w.created_at) AS last,
              e.name AS eventName, e.slug AS eventSlug, e.organizer_id AS organizerId, e.currency AS currency,
              COALESCE(o.is_demo, 0) AS isDemo, e.sales_open AS salesOpen,
              t.name AS tierName, t.status AS tierStatus, t.price_cents AS priceCents
         FROM item_wishes w
         JOIN events e ON e.id = w.event_id
         JOIN event_tiers t ON t.event_id = w.event_id AND t.tier_key = w.tier_key
         LEFT JOIN organizers o ON o.id = e.organizer_id
        ${organizerId ? 'WHERE e.organizer_id = ?' : ''}
        GROUP BY w.event_id, w.tier_key
        ORDER BY wishes DESC, last DESC
        LIMIT 500`
    )
    .all(...(organizerId ? [organizerId] : [])) as (Omit<WishTotal, 'isDemo' | 'salesOpen'> & { isDemo: number; salesOpen: number })[];
  return rows.map((r) => ({ ...r, isDemo: Boolean(r.isDemo), salesOpen: Boolean(r.salesOpen) }));
}
