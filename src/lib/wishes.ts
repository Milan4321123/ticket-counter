// Server-only: the wish list — "I would buy this" on things that cannot be
// bought (yet). Tapped on an example shop's goods (the site's own demo
// bazaar, which never takes an order), on a "Coming soon" ticket or dish, or at
// the end of a checkout that cannot take payment. Each wish is one row per
// item per device, so the count means "this many people want it", and it is
// what the admin (every item) and the seller (their own items) are shown.
//
// Nothing personal is kept: the device is a random token the visitor's own
// browser made up (components/WishButton), stored here only as a hash. No
// name, no email, no IP.
import crypto from 'node:crypto';
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
  }
  return d;
}

/** A browser's own random token, as stored: never the token itself. */
export function deviceKey(token: string): string | null {
  if (!/^[a-z0-9]{16,64}$/i.test(token)) return null;
  return crypto.createHash('sha256').update(`wish:${token}`).digest('hex').slice(0, 32);
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
