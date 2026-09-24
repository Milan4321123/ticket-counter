// Server-only: the numbers a SHOP owner asks for — what sells, on which days,
// at what times, and what goes in the same bag. Every figure counts confirmed
// (paid) orders only, test-mode excluded, the same rule as the rest of
// Insights (lib/analytics).
import { getDb } from './db';
import { getAvailability } from './inventory';
import { getEventTiers } from './events';
import { ratingsForItems } from './reviews';

export interface ItemDayGrid {
  /** 'YYYY-MM-DD', oldest first. */
  days: string[];
  rows: { tierKey: string; name: string; perDay: number[]; total: number }[];
  /** Largest single cell, for colour scaling. */
  max: number;
}

export interface ItemStat {
  tierKey: string;
  name: string;
  sold: number;
  revenueCents: number;
  /** Share of all revenue, 0..100. */
  share: number;
  /** Orders that contained this item. */
  orders: number;
  /** Units left, or null when unlimited. */
  left: number | null;
  /** Codes scanned / codes issued for this item, 0..100, or null with none issued. */
  collectedPct: number | null;
  rating: { average: number; count: number } | null;
}

export interface BasketStats {
  orders: number;
  averageCents: number;
  itemsPerOrder: number;
  /** % of orders with more than one kind of item. */
  multiPct: number;
  /** The pair of items most often bought together. */
  topPair: { a: string; b: string; count: number } | null;
}

export interface ShopInsights {
  grid: ItemDayGrid;
  items: ItemStat[];
  /** Orders per weekday (0 = Monday … 6 = Sunday) × hour (0..23). */
  heat: number[][];
  /** What the heat map counts: chosen collection times, or payment times. */
  heatBasis: 'slot' | 'paid';
  weekdayTotals: number[];
  basket: BasketStats;
}

const PAID = `o.status = 'paid' AND o.payment_mode != 'mock'`;

function lastDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function shopInsights(eventId: string): ShopInsights {
  const db = getDb();
  const tiers = getEventTiers(eventId);
  const nameOf = new Map(tiers.map((t) => [t.tierKey, t.name]));

  // ---- Items × days (last 14) ----
  const days = lastDays(14);
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const perDayRows = db
    .prepare(
      `SELECT oi.tier_id AS tierKey, date(COALESCE(o.paid_at, o.created_at)) AS day, SUM(oi.quantity) AS qty
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.event_id = ? AND ${PAID} AND date(COALESCE(o.paid_at, o.created_at)) >= ?
       GROUP BY oi.tier_id, day`
    )
    .all(eventId, days[0]) as { tierKey: string; day: string; qty: number }[];
  const gridMap = new Map<string, number[]>();
  for (const t of tiers) gridMap.set(t.tierKey, Array(days.length).fill(0));
  let max = 0;
  for (const r of perDayRows) {
    const row = gridMap.get(r.tierKey) ?? Array(days.length).fill(0);
    const i = dayIndex.get(r.day);
    if (i === undefined) continue;
    row[i] += r.qty;
    max = Math.max(max, row[i]);
    gridMap.set(r.tierKey, row);
  }
  const grid: ItemDayGrid = {
    days,
    rows: [...gridMap.entries()]
      .map(([tierKey, perDay]) => ({ tierKey, name: nameOf.get(tierKey) ?? tierKey, perDay, total: perDay.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total),
    max,
  };

  // ---- Per item ----
  const itemRows = db
    .prepare(
      `SELECT oi.tier_id AS tierKey, SUM(oi.quantity) AS sold, SUM(oi.quantity * oi.unit_price_cents) AS revenue,
              COUNT(DISTINCT o.id) AS orders
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.event_id = ? AND ${PAID}
       GROUP BY oi.tier_id`
    )
    .all(eventId) as { tierKey: string; sold: number; revenue: number; orders: number }[];
  const codeRows = db
    .prepare(
      `SELECT t.tier_id AS tierKey, COUNT(*) AS issued, SUM(CASE WHEN t.checked_in_at IS NOT NULL THEN 1 ELSE 0 END) AS scanned
       FROM tickets t JOIN orders o ON o.id = t.order_id
       WHERE o.event_id = ? AND o.status = 'paid'
       GROUP BY t.tier_id`
    )
    .all(eventId) as { tierKey: string; issued: number; scanned: number }[];
  const codes = new Map(codeRows.map((r) => [r.tierKey, r]));
  const avail = getAvailability(eventId);
  const ratings = ratingsForItems([eventId]);
  const totalRevenue = itemRows.reduce((n, r) => n + r.revenue, 0);
  const byKey = new Map(itemRows.map((r) => [r.tierKey, r]));
  const items: ItemStat[] = tiers
    .map((t) => {
      const r = byKey.get(t.tierKey);
      const c = codes.get(t.tierKey);
      const a = avail.tiers[t.tierKey];
      const rating = ratings.get(`${eventId}:${t.tierKey}`) ?? null;
      return {
        tierKey: t.tierKey,
        name: t.name,
        sold: r?.sold ?? 0,
        revenueCents: r?.revenue ?? 0,
        share: totalRevenue > 0 ? Math.round(((r?.revenue ?? 0) / totalRevenue) * 100) : 0,
        orders: r?.orders ?? 0,
        left: !a || a.unlimited ? null : a.remaining,
        collectedPct: c && c.issued > 0 ? Math.round((c.scanned / c.issued) * 100) : null,
        rating: rating ? { average: rating.average, count: rating.count } : null,
      };
    })
    .sort((a, b) => b.revenueCents - a.revenueCents);

  // ---- When: weekday × hour, by collection slot when there is one ----
  const whenRows = db
    .prepare(
      `SELECT o.pickup_slot AS slot, COALESCE(o.paid_at, o.created_at) AS paid
       FROM orders o WHERE o.event_id = ? AND ${PAID}`
    )
    .all(eventId) as { slot: string | null; paid: string }[];
  const withSlot = whenRows.filter((r) => r.slot).length;
  const heatBasis: 'slot' | 'paid' = withSlot >= Math.max(3, whenRows.length / 3) ? 'slot' : 'paid';
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  const weekdayTotals = Array(7).fill(0) as number[];
  const berlinParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', hourCycle: 'h23' });
  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (const r of whenRows) {
    let wd: number;
    let hour: number;
    if (heatBasis === 'slot') {
      if (!r.slot) continue;
      const d = new Date(`${r.slot.slice(0, 10)}T12:00:00Z`);
      wd = (d.getUTCDay() + 6) % 7;
      hour = Number(r.slot.slice(11, 13));
    } else {
      const parts = berlinParts.formatToParts(new Date(`${r.paid.replace(' ', 'T')}Z`));
      wd = WD.indexOf(parts.find((p) => p.type === 'weekday')?.value ?? 'Mon');
      hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    }
    if (wd < 0 || hour < 0 || hour > 23) continue;
    heat[wd][hour]++;
    weekdayTotals[wd]++;
  }

  // ---- Baskets ----
  const lines = db
    .prepare(
      `SELECT o.id AS orderId, o.total_cents AS total, oi.tier_id AS tierKey, oi.quantity
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE o.event_id = ? AND ${PAID}`
    )
    .all(eventId) as { orderId: string; total: number; tierKey: string; quantity: number }[];
  const orders = new Map<string, { total: number; keys: string[]; qty: number }>();
  for (const l of lines) {
    const o = orders.get(l.orderId) ?? { total: l.total, keys: [], qty: 0 };
    o.keys.push(l.tierKey);
    o.qty += l.quantity;
    orders.set(l.orderId, o);
  }
  const pairs = new Map<string, number>();
  for (const o of orders.values()) {
    const keys = [...new Set(o.keys)].sort();
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const k = `${keys[i]}|${keys[j]}`;
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
  }
  const top = [...pairs.entries()].sort((a, b) => b[1] - a[1])[0];
  const n = orders.size;
  const basket: BasketStats = {
    orders: n,
    averageCents: n ? Math.round([...orders.values()].reduce((s, o) => s + o.total, 0) / n) : 0,
    itemsPerOrder: n ? Math.round(([...orders.values()].reduce((s, o) => s + o.qty, 0) / n) * 10) / 10 : 0,
    multiPct: n ? Math.round(([...orders.values()].filter((o) => new Set(o.keys).size > 1).length / n) * 100) : 0,
    topPair: top && top[1] >= 2
      ? { a: nameOf.get(top[0].split('|')[0]) ?? top[0].split('|')[0], b: nameOf.get(top[0].split('|')[1]) ?? top[0].split('|')[1], count: top[1] }
      : null,
  };

  return { grid, items, heat, heatBasis, weekdayTotals, basket };
}
