// Server-only: seat availability + atomic inventory claims (prevents overselling).
//
// Order lifecycle around money:
//   pending   -> created, nothing reserved
//   claimed   -> seats reserved, payment about to be attempted
//   capturing -> a capture request owns this order (also used as a "hold" state
//                when a payment outcome is ambiguous and needs reconciliation)
//   paid      -> money verified, tickets minted
//   failed / cancelled -> terminal, seats released
import { getDb } from './db';
import { getEventConfig } from './config';

export interface TierAvailability {
  tierId: string;
  cap: number;
  sold: number; // claimed + capturing + paid
  remaining: number;
}

export interface Availability {
  totalCap: number;
  totalSold: number;
  totalRemaining: number;
  tiers: Record<string, TierAvailability>;
}

export class SoldOutError extends Error {
  constructor(public tierId?: string) {
    super(tierId ? `Not enough "${tierId}" tickets remaining` : 'Not enough tickets remaining');
    this.name = 'SoldOutError';
  }
}

/** Statuses that hold seats. 'capturing' still holds — money may be moving. */
const RESERVING_STATUSES = "('claimed', 'capturing', 'paid')";

export function getAvailability(): Availability {
  const db = getDb();
  const cfg = getEventConfig();
  const rows = db
    .prepare(
      `SELECT oi.tier_id AS tierId, COALESCE(SUM(oi.quantity), 0) AS sold
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status IN ${RESERVING_STATUSES}
       GROUP BY oi.tier_id`
    )
    .all() as { tierId: string; sold: number }[];

  const soldByTier = new Map(rows.map((r) => [r.tierId, r.sold]));
  const tiers: Record<string, TierAvailability> = {};
  let totalSold = 0;
  for (const t of cfg.tiers) {
    const sold = soldByTier.get(t.id) ?? 0;
    totalSold += sold;
    tiers[t.id] = { tierId: t.id, cap: t.cap, sold, remaining: Math.max(0, t.cap - sold) };
  }

  const totalRemaining = Math.max(0, cfg.totalCapacity - totalSold);
  // A tier can never have more remaining than the event as a whole.
  for (const t of Object.values(tiers)) t.remaining = Math.min(t.remaining, totalRemaining);

  return { totalCap: cfg.totalCapacity, totalSold, totalRemaining, tiers };
}

// Short-lived cache for the DISPLAY path only. The homepage and checkout page
// are server-rendered on every request and each calls availability; during an
// on-sale spike (hundreds of loads/second) recomputing the aggregate every
// time needlessly blocks the single Node thread. A ~1s stale "tickets left"
// count is invisible to buyers, and it is NEVER used to decide a reservation —
// claimInventory() below always reads live, transactional data. So this cache
// cannot cause overselling.
let availCache: { at: number; value: Availability } | null = null;
const AVAIL_CACHE_MS = 1000;

export function getAvailabilityCached(): Availability {
  const now = Date.now();
  if (availCache && now - availCache.at < AVAIL_CACHE_MS) return availCache.value;
  const value = getAvailability();
  availCache = { at: now, value };
  return value;
}

/**
 * Atomically reserve the order's tickets against tier + total caps.
 * Call this BEFORE capturing payment; if it throws SoldOutError the buyer
 * has not been charged. Idempotent for orders already claimed/capturing.
 */
export function claimInventory(orderId: string): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const order = db.prepare(`SELECT status FROM orders WHERE id = ?`).get(orderId) as
      | { status: string }
      | undefined;
    if (!order) throw new Error('Order not found');
    if (order.status === 'claimed' || order.status === 'capturing') return; // already reserved
    if (order.status !== 'pending') {
      throw new Error(`Order is not claimable (status: ${order.status})`);
    }

    const items = db
      .prepare(`SELECT tier_id AS tierId, quantity FROM order_items WHERE order_id = ?`)
      .all(orderId) as { tierId: string; quantity: number }[];

    const avail = getAvailability();
    let totalQty = 0;
    for (const it of items) {
      totalQty += it.quantity;
      const tier = avail.tiers[it.tierId];
      if (!tier || tier.remaining < it.quantity) throw new SoldOutError(it.tierId);
    }
    if (avail.totalRemaining < totalQty) throw new SoldOutError();

    db.prepare(`UPDATE orders SET status = 'claimed' WHERE id = ?`).run(orderId);
  });
  tx();
}

/**
 * Atomically take exclusive ownership of the capture step (claimed -> capturing).
 * Returns false when another request already owns it — the caller must NOT
 * proceed to capture, and must NOT release the other request's claim.
 */
export function beginCapture(orderId: string): boolean {
  const db = getDb();
  const res = db.prepare(`UPDATE orders SET status = 'capturing' WHERE id = ? AND status = 'claimed'`).run(orderId);
  return res.changes === 1;
}

/** Release a claim/capture hold so the seats go back on sale. */
export function releaseClaim(orderId: string, toStatus: 'pending' | 'failed' | 'cancelled' = 'failed'): void {
  const db = getDb();
  db.prepare(`UPDATE orders SET status = ? WHERE id = ? AND status IN ('claimed', 'capturing')`).run(
    toStatus,
    orderId
  );
}
