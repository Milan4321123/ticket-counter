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
import { getEventById, getEventTiers, getPrimaryEvent } from './events';
import { releaseVoucherForOrder } from './referrals';

export interface TierAvailability {
  tierId: string;
  /** In UNITS of this tier — a "Table of 8" tier with cap 10 sells 10 tables. */
  cap: number;
  /** Units sold: claimed + capturing + paid. */
  sold: number;
  /**
   * Units still sellable — bounded by the tier's own cap AND by how many whole
   * bookings still fit in the room's remaining SEATS (weighted by
   * seatsPerUnit). UNLIMITED_REMAINING when uncapped — always check
   * `unlimited` before showing this.
   */
  remaining: number;
  unlimited: boolean;
  /** Seats one sold unit consumes (and QR tickets it mints). 1 normally. */
  seatsPerUnit: number;
}

export interface Availability {
  /** SEATS — people the room holds, not bookings. */
  totalCap: number;
  /** SEATS consumed: every sold unit weighted by its tier's seatsPerUnit. */
  totalSold: number;
  /** SEATS still free in the room. */
  totalRemaining: number;
  /**
   * Always false — every event now states a capacity and the room is the
   * ceiling. Kept so the many display sites that branch on it keep compiling
   * and keep reading honestly; `showRemaining` is what hides the number now.
   */
  unlimited: boolean;
  /**
   * False when the organizer has turned the countdown off. Reservations still
   * respect every cap — this hides the NUMBER, it does not sell more tickets.
   */
  showRemaining: boolean;
  tiers: Record<string, TierAvailability>;
}

/**
 * The stand-in "remaining" for anything uncapped.
 *
 * Infinity would be the honest value but does not survive JSON — it becomes
 * null on the way to the checkout client and every comparison then silently
 * flips. A large finite number keeps all the existing arithmetic (Math.min,
 * `< quantity`, `<= 50`) working untouched, and every place that could PRINT a
 * count is gated on `unlimited` first, so this number is never shown.
 */
export const UNLIMITED_REMAINING = 1_000_000_000;

export class SoldOutError extends Error {
  constructor(public tierId?: string) {
    super(tierId ? `Not enough "${tierId}" tickets remaining` : 'Not enough tickets remaining');
    this.name = 'SoldOutError';
  }
}

/** Statuses that hold seats. 'capturing' still holds — money may be moving. */
const RESERVING_STATUSES = "('claimed', 'capturing', 'paid')";

const EMPTY_AVAILABILITY: Availability = {
  totalCap: 0,
  totalSold: 0,
  totalRemaining: 0,
  unlimited: false,
  showRemaining: true,
  tiers: {},
};

/** Live seat availability for ONE event (caps from events + event_tiers). */
export function getAvailability(eventId: string): Availability {
  const db = getDb();
  const event = getEventById(eventId);
  if (!event) throw new Error('Unknown event');
  const eventTiers = getEventTiers(eventId);
  const rows = db
    .prepare(
      `SELECT oi.tier_id AS tierId, COALESCE(SUM(oi.quantity), 0) AS sold
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status IN ${RESERVING_STATUSES} AND o.event_id = ?
       GROUP BY oi.tier_id`
    )
    .all(eventId) as { tierId: string; sold: number }[];

  const soldByTier = new Map(rows.map((r) => [r.tierId, r.sold]));
  const tiers: Record<string, TierAvailability> = {};
  // The tier's sold/cap/remaining stay in UNITS of that tier; the ROOM is
  // counted in SEATS, so each sold unit weighs seatsPerUnit against it — a
  // sold "Table of 8" is one unit of its tier and eight seats of the room.
  let totalSold = 0;
  for (const t of eventTiers) {
    const sold = soldByTier.get(t.tierKey) ?? 0;
    totalSold += sold * t.seatsPerUnit;
    tiers[t.tierKey] = {
      tierId: t.tierKey,
      cap: t.cap,
      sold,
      remaining: t.unlimited ? UNLIMITED_REMAINING : Math.max(0, t.cap - sold),
      unlimited: t.unlimited,
      seatsPerUnit: t.seatsPerUnit,
    };
  }
  // Seats sold against tiers that were later deleted still occupy capacity.
  // Their seats_per_unit is gone with the row, so each unit weighs one seat —
  // the meaning every tier had before bundles existed (and tiers with orders
  // cannot be deleted anymore, so this is legacy data only).
  for (const [tierId, sold] of soldByTier) {
    if (!tiers[tierId]) totalSold += sold;
  }

  // Every event states a capacity, so the room is always the ceiling. Events
  // used to be able to opt out of one entirely, which meant an organizer paid a
  // fee priced on the number they typed and could then sell past it without
  // limit — the fee and the tickets stopped describing the same event. A tier
  // can still be uncapped; it simply inherits the room's ceiling.
  const totalRemaining = Math.max(0, event.totalCapacity - totalSold);
  for (const t of Object.values(tiers)) {
    // A tier's next unit only exists if a WHOLE booking still fits in the
    // room — a table of 8 with 5 seats left is sold out, not "0.6 available".
    t.remaining = Math.min(t.remaining, Math.floor(totalRemaining / t.seatsPerUnit));
    // An uncapped TIER is not an uncapped event: whatever is left in the room is
    // left for it, and that is a real number, so it stops claiming otherwise.
    t.unlimited = false;
  }

  return {
    totalCap: event.totalCapacity,
    totalSold,
    totalRemaining,
    unlimited: false,
    showRemaining: event.showRemaining,
    tiers,
  };
}

// Short-lived cache for the DISPLAY path only. Event pages and checkout are
// server-rendered on every request and each calls availability; during an
// on-sale spike (hundreds of loads/second) recomputing the aggregate every
// time needlessly blocks the single Node thread. A ~1s stale "tickets left"
// count is invisible to buyers, and it is NEVER used to decide a reservation —
// claimInventory() below always reads live, transactional data. So this cache
// cannot cause overselling.
const availCache = new Map<string, { at: number; value: Availability }>();
const AVAIL_CACHE_MS = 1000;

/**
 * Cached availability for display. Omitting eventId is the legacy single-event
 * path: it uses the primary (oldest) event, and reports everything as sold out
 * when the platform has no events at all rather than crashing the page.
 */
export function getAvailabilityCached(eventId?: string): Availability {
  const id = eventId ?? getPrimaryEvent()?.id;
  if (!id) return EMPTY_AVAILABILITY;
  const now = Date.now();
  const hit = availCache.get(id);
  if (hit && now - hit.at < AVAIL_CACHE_MS) return hit.value;
  const value = getAvailability(id);
  availCache.set(id, { at: now, value });
  return value;
}

/**
 * Atomically reserve the order's tickets against its event's tier + total
 * caps. Call this BEFORE capturing payment; if it throws SoldOutError the
 * buyer has not been charged. Idempotent for orders already claimed/capturing.
 */
export function claimInventory(orderId: string): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const order = db.prepare(`SELECT status, event_id AS eventId FROM orders WHERE id = ?`).get(orderId) as
      | { status: string; eventId: string | null }
      | undefined;
    if (!order) throw new Error('Order not found');
    if (order.status === 'claimed' || order.status === 'capturing') return; // already reserved
    if (order.status !== 'pending') {
      throw new Error(`Order is not claimable (status: ${order.status})`);
    }
    if (!order.eventId) throw new Error('Order has no event');

    const items = db
      .prepare(`SELECT tier_id AS tierId, quantity FROM order_items WHERE order_id = ?`)
      .all(orderId) as { tierId: string; quantity: number }[];

    const avail = getAvailability(order.eventId);
    // The room check is in SEATS: a booking of a bundled tier ("Table of 8")
    // consumes seatsPerUnit seats, and comparing raw quantities against the
    // seat count would let tables oversell the room.
    let totalSeats = 0;
    for (const it of items) {
      const tier = avail.tiers[it.tierId];
      if (!tier || tier.remaining < it.quantity) throw new SoldOutError(it.tierId);
      totalSeats += it.quantity * tier.seatsPerUnit;
    }
    if (avail.totalRemaining < totalSeats) throw new SoldOutError();

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
  const changes = db
    .prepare(`UPDATE orders SET status = ? WHERE id = ? AND status IN ('claimed', 'capturing')`)
    .run(toStatus, orderId).changes;
  // A reservation that ends for good gives back any referral voucher it was
  // holding, so a buyer who never paid does not lose a reward they earned.
  // NOT for 'pending': that order is still alive and about to try again — the
  // voucher belongs to it until it either becomes a sale or dies.
  if (changes > 0 && toStatus !== 'pending') releaseVoucherForOrder(orderId);
}
