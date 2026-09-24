// Server-only: the numbers behind the live event-day screen
// (/portal/events/[id]/live). One small read, polled every few seconds.
import { getDb } from './db';
import { getEventTiers } from './events';

export interface LiveDoor {
  /** Tickets (or collection codes) that exist for PAID orders. */
  issued: number;
  /** Of those, scanned at the door / counter. */
  checkedIn: number;
  /** Scans per 5-minute bucket over the last hour, oldest first (12 buckets). */
  perFiveMin: number[];
  /** Newest scans first: who, which type, when (ISO, UTC). */
  recent: { name: string; tier: string; at: string }[];
  /** Per ticket type: issued vs scanned. */
  byTier: { name: string; issued: number; checkedIn: number }[];
  /** Paid orders and money confirmed today (UTC day). */
  todayOrders: number;
  todayCents: number;
  /** Seats still for sale across the listing. */
  remaining: number | null;
}

/** First name + initial: enough for the door to greet someone, not a guest list on a wall screen. */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || 'Guest';
}

export function liveDoor(eventId: string, totalCapacity: number): LiveDoor {
  const db = getDb();
  const tiers = new Map(getEventTiers(eventId).map((t) => [t.tierKey, t.name]));
  const rows = db
    .prepare(
      `SELECT t.tier_id AS tierId, t.checked_in_at AS at, o.buyer_name AS name
       FROM tickets t JOIN orders o ON o.id = t.order_id
       WHERE o.event_id = ? AND o.status = 'paid'`
    )
    .all(eventId) as { tierId: string; at: string | null; name: string }[];

  const issued = rows.length;
  const scanned = rows.filter((r) => r.at);
  const now = Date.now();
  const perFiveMin = Array.from({ length: 12 }, () => 0);
  for (const r of scanned) {
    const t = Date.parse(`${(r.at as string).replace(' ', 'T')}Z`);
    const bucket = 11 - Math.floor((now - t) / (5 * 60_000));
    if (bucket >= 0 && bucket < 12) perFiveMin[bucket]++;
  }
  const recent = scanned
    .sort((a, b) => (b.at as string).localeCompare(a.at as string))
    .slice(0, 8)
    .map((r) => ({ name: shortName(r.name), tier: tiers.get(r.tierId) ?? r.tierId, at: `${(r.at as string).replace(' ', 'T')}Z` }));

  const tierMap = new Map<string, { issued: number; checkedIn: number }>();
  for (const r of rows) {
    const e = tierMap.get(r.tierId) ?? { issued: 0, checkedIn: 0 };
    e.issued++;
    if (r.at) e.checkedIn++;
    tierMap.set(r.tierId, e);
  }

  const today = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN payment_mode != 'mock' THEN total_cents ELSE 0 END), 0) AS cents
       FROM orders WHERE event_id = ? AND status = 'paid' AND date(paid_at) = date('now')`
    )
    .get(eventId) as { n: number; cents: number };

  return {
    issued,
    checkedIn: scanned.length,
    perFiveMin,
    recent,
    byTier: [...tierMap.entries()].map(([k, v]) => ({ name: tiers.get(k) ?? k, ...v })),
    todayOrders: today.n,
    todayCents: today.cents,
    remaining: totalCapacity > 0 ? Math.max(0, totalCapacity - issued) : null,
  };
}
