// Server-only: order + ticket persistence and lifecycle.
import crypto from 'crypto';
import { getDb } from './db';
import { getEventConfig, getPaymentMode, getTier } from './config';
import { claimInventory } from './inventory';
import { generateTicketCode, normalizeTicketCode } from './tickets';
import type { CheckinResponse } from './types';

export type OrderStatus = 'pending' | 'claimed' | 'capturing' | 'paid' | 'failed' | 'cancelled';
export type PaymentMethod = 'paypal' | 'mock' | 'transfer';

export interface OrderRow {
  id: string;
  paypalOrderId: string | null;
  status: OrderStatus;
  buyerName: string;
  buyerEmail: string;
  totalCents: number;
  currency: string;
  paymentMode: PaymentMethod;
  createdAt: string;
  paidAt: string | null;
  captureId: string | null;
}

/**
 * Short reference the buyer must put in their bank transfer's purpose line
 * ("Verwendungszweck") so the organizer can match money to orders. Derived
 * from the order id, so admin search finds it (the hex part matches the id).
 *
 * Orders containing any student ticket get an "S-" marker (TICKETS-S-XXXXXXXX
 * instead of TICKETS-XXXXXXXX) so student sales are recognizable directly on
 * the bank statement and in the admin panel.
 */
export function paymentReference(orderId: string): string {
  const hasStudent = getOrderItems(orderId).some((it) => getTier(it.tierId)?.studentOnly);
  return (hasStudent ? 'TICKETS-S-' : 'TICKETS-') + orderId.slice(0, 8).toUpperCase();
}

export interface OrderItemRow {
  orderId: string;
  tierId: string;
  quantity: number;
  unitPriceCents: number;
}

export interface TicketRow {
  code: string;
  orderId: string;
  tierId: string;
  createdAt: string;
  checkedInAt: string | null;
}

const ORDER_COLS = `
  id,
  paypal_order_id AS paypalOrderId,
  status,
  buyer_name AS buyerName,
  buyer_email AS buyerEmail,
  total_cents AS totalCents,
  currency,
  payment_mode AS paymentMode,
  created_at AS createdAt,
  paid_at AS paidAt,
  capture_id AS captureId
`;

const TICKET_COLS = `
  code,
  order_id AS orderId,
  tier_id AS tierId,
  created_at AS createdAt,
  checked_in_at AS checkedInAt
`;

/**
 * Create a local 'pending' order. Prices are ALWAYS looked up from the server
 * config here — never trust amounts sent by the browser.
 */
export function createOrder(params: {
  buyerName: string;
  buyerEmail: string;
  items: { tierId: string; quantity: number }[];
  currency: string;
  paymentMode: PaymentMethod;
}): OrderRow {
  const db = getDb();
  const id = crypto.randomUUID();

  const resolved = params.items.map((it) => {
    const tier = getTier(it.tierId);
    if (!tier) throw new Error(`Unknown ticket type: ${it.tierId}`);
    if (!Number.isInteger(it.quantity) || it.quantity < 1) {
      throw new Error(`Invalid quantity for ${it.tierId}`);
    }
    return { tierId: it.tierId, quantity: it.quantity, unitPriceCents: tier.priceCents };
  });
  const totalCents = resolved.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0);

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO orders (id, status, buyer_name, buyer_email, total_cents, currency, payment_mode)
       VALUES (?, 'pending', ?, ?, ?, ?, ?)`
    ).run(id, params.buyerName, params.buyerEmail, totalCents, params.currency, params.paymentMode);
    const ins = db.prepare(
      `INSERT INTO order_items (order_id, tier_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?)`
    );
    for (const it of resolved) ins.run(id, it.tierId, it.quantity, it.unitPriceCents);
  });
  tx();

  return getOrder(id)!;
}

export function getOrder(id: string): OrderRow | null {
  const db = getDb();
  return (db.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE id = ?`).get(id) as OrderRow) ?? null;
}

export function getOrderByPaypalId(paypalOrderId: string): OrderRow | null {
  const db = getDb();
  return (
    (db.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE paypal_order_id = ?`).get(paypalOrderId) as OrderRow) ?? null
  );
}

export function setPaypalOrderId(orderId: string, paypalOrderId: string): void {
  getDb().prepare(`UPDATE orders SET paypal_order_id = ? WHERE id = ?`).run(paypalOrderId, orderId);
}

export function getOrderItems(orderId: string): OrderItemRow[] {
  return getDb()
    .prepare(
      `SELECT order_id AS orderId, tier_id AS tierId, quantity, unit_price_cents AS unitPriceCents
       FROM order_items WHERE order_id = ?`
    )
    .all(orderId) as OrderItemRow[];
}

export function getTicketsForOrder(orderId: string): TicketRow[] {
  return getDb()
    .prepare(`SELECT ${TICKET_COLS} FROM tickets WHERE order_id = ? ORDER BY tier_id, code`)
    .all(orderId) as TicketRow[];
}

export function markOrderFailed(orderId: string, status: 'failed' | 'cancelled' = 'failed'): void {
  getDb()
    .prepare(`UPDATE orders SET status = ? WHERE id = ? AND status IN ('pending', 'claimed')`)
    .run(status, orderId);
}

/**
 * Mark a CLAIMED/CAPTURING order paid and mint its tickets. Idempotent:
 * calling again on a paid order just returns the existing tickets.
 */
export function finalizePaidOrder(orderId: string, captureId: string | null): TicketRow[] {
  const db = getDb();
  const tx = db.transaction(() => {
    const order = getOrder(orderId);
    if (!order) throw new Error('Order not found');
    if (order.status === 'paid') return;
    if (order.status !== 'claimed' && order.status !== 'capturing') {
      throw new Error(`Cannot finalize order in status '${order.status}' — claim inventory first`);
    }
    db.prepare(`UPDATE orders SET status = 'paid', paid_at = datetime('now'), capture_id = ? WHERE id = ?`).run(
      captureId,
      orderId
    );
    const ins = db.prepare(`INSERT INTO tickets (code, order_id, tier_id) VALUES (?, ?, ?)`);
    for (const it of getOrderItems(orderId)) {
      for (let i = 0; i < it.quantity; i++) {
        // Retry on the (astronomically unlikely) code collision.
        for (let attempt = 0; ; attempt++) {
          try {
            ins.run(generateTicketCode(), orderId, it.tierId);
            break;
          } catch (e) {
            if (attempt >= 5) throw e;
          }
        }
      }
    }
  });
  tx();
  return getTicketsForOrder(orderId);
}

export interface TicketWithOrder extends TicketRow {
  orderStatus: OrderStatus;
  buyerName: string;
  buyerEmail: string;
  paymentMode: PaymentMethod;
}

export function getTicketByCode(rawCode: string): TicketWithOrder | null {
  const code = normalizeTicketCode(rawCode);
  const row = getDb()
    .prepare(
      `SELECT t.code, t.order_id AS orderId, t.tier_id AS tierId, t.created_at AS createdAt,
              t.checked_in_at AS checkedInAt, o.status AS orderStatus,
              o.buyer_name AS buyerName, o.buyer_email AS buyerEmail,
              o.payment_mode AS paymentMode
       FROM tickets t JOIN orders o ON o.id = t.order_id
       WHERE t.code = ?`
    )
    .get(code) as TicketWithOrder | undefined;
  return row ?? null;
}

/** Atomic door check-in: each ticket can be used exactly once. */
export function checkInTicket(rawCode: string): CheckinResponse {
  const db = getDb();
  const tx = db.transaction((): CheckinResponse => {
    const row = getTicketByCode(rawCode);
    if (!row) return { result: 'not_found' };
    const tier = getTier(row.tierId);
    const ticket = {
      code: row.code,
      tierId: row.tierId,
      tierName: tier?.name ?? row.tierId,
      buyerName: row.buyerName,
      buyerEmail: row.buyerEmail,
      orderId: row.orderId,
    };
    if (row.orderStatus !== 'paid') return { result: 'not_paid', ticket };
    // Test-mode tickets must never admit anyone once real payments are on.
    if (row.paymentMode === 'mock' && getPaymentMode() !== 'mock') {
      return { result: 'mock_ticket', ticket };
    }
    if (row.checkedInAt) return { result: 'already_checked_in', checkedInAt: row.checkedInAt, ticket };
    db.prepare(`UPDATE tickets SET checked_in_at = datetime('now') WHERE code = ?`).run(row.code);
    return { result: 'ok', ticket };
  });
  return tx();
}

// ---------------- Admin queries ----------------

export interface OrderListRow extends OrderRow {
  itemsSummary: string; // e.g. "2× General Admission, 1× Student"
  ticketCount: number;
}

function withItemsSummary(rows: OrderRow[]): OrderListRow[] {
  return rows.map((o) => {
    const items = getOrderItems(o.id);
    const itemsSummary = items
      .map((it) => `${it.quantity}× ${getTier(it.tierId)?.name ?? it.tierId}`)
      .join(', ');
    const ticketCount = items.reduce((s, it) => s + it.quantity, 0);
    return { ...o, itemsSummary, ticketCount };
  });
}

export function listOrders(opts: { query?: string; limit?: number } = {}): OrderListRow[] {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 200, 1000);
  let rows: OrderRow[];
  if (opts.query && opts.query.trim()) {
    // Let admins paste a bank-transfer reference ("TICKETS-AB12CD34" or the
    // student form "TICKETS-S-AB12CD34") as-is — the hex part matches the
    // order id (LIKE is case-insensitive for ASCII).
    const q = `%${opts.query.trim().replace(/^TICKETS-(S-)?/i, '')}%`;
    rows = db
      .prepare(
        `SELECT ${ORDER_COLS} FROM orders
         WHERE buyer_name LIKE ? OR buyer_email LIKE ? OR id LIKE ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(q, q, q, limit) as OrderRow[];
  } else {
    rows = db.prepare(`SELECT ${ORDER_COLS} FROM orders ORDER BY created_at DESC LIMIT ?`).all(limit) as OrderRow[];
  }
  return withItemsSummary(rows);
}

export interface TierStats {
  tierId: string;
  name: string;
  sold: number;
  cap: number;
  revenueCents: number;
}

export interface Stats {
  ordersPaid: number;
  ticketsSold: number;
  /** Money CONFIRMED received (real payments only — test-mode excluded). */
  revenueCents: number;
  checkedIn: number;
  perTier: TierStats[];
  /** Reservations whose bank transfer is still on its way. */
  awaitingTransferOrders: number;
  awaitingTransferCents: number;
  awaitingTransferTickets: number;
  /** Test-mode (mock) data still in the database — purge before going live. */
  mockPaidOrders: number;
  mockTicketsSold: number;
  mockRevenueCents: number;
}

export function getStats(): Stats {
  const db = getDb();
  const paid = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS revenue
       FROM orders WHERE status = 'paid' AND payment_mode != 'mock'`
    )
    .get() as { n: number; revenue: number };
  const mock = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS revenue
       FROM orders WHERE status = 'paid' AND payment_mode = 'mock'`
    )
    .get() as { n: number; revenue: number };
  const mockTickets = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM tickets t JOIN orders o ON o.id = t.order_id
         WHERE o.status = 'paid' AND o.payment_mode = 'mock'`
      )
      .get() as { n: number }
  ).n;
  const ticketsSold = (
    db.prepare(`SELECT COUNT(*) AS n FROM tickets t JOIN orders o ON o.id = t.order_id WHERE o.status = 'paid'`).get() as {
      n: number;
    }
  ).n;
  const checkedIn = (
    db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE checked_in_at IS NOT NULL`).get() as { n: number }
  ).n;
  // Per tier: 'sold' counts every paid seat (mock included — they hold
  // capacity until purged); revenue counts REAL money only, matching the
  // dashboard's headline revenue.
  const perTierRows = db
    .prepare(
      `SELECT oi.tier_id AS tierId, COALESCE(SUM(oi.quantity), 0) AS sold,
              COALESCE(SUM(CASE WHEN o.payment_mode != 'mock' THEN oi.quantity * oi.unit_price_cents ELSE 0 END), 0) AS revenueCents
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status = 'paid'
       GROUP BY oi.tier_id`
    )
    .all() as { tierId: string; sold: number; revenueCents: number }[];
  const soldMap = new Map(perTierRows.map((r) => [r.tierId, r]));

  const perTier: TierStats[] = getEventConfig().tiers.map((t) => ({
    tierId: t.id,
    name: t.name,
    sold: soldMap.get(t.id)?.sold ?? 0,
    cap: t.cap,
    revenueCents: soldMap.get(t.id)?.revenueCents ?? 0,
  }));

  const awaiting = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS cents
       FROM orders WHERE status = 'claimed' AND payment_mode = 'transfer'`
    )
    .get() as { n: number; cents: number };
  const awaitingTickets = (
    db
      .prepare(
        `SELECT COALESCE(SUM(oi.quantity), 0) AS n
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'claimed' AND o.payment_mode = 'transfer'`
      )
      .get() as { n: number }
  ).n;

  return {
    ordersPaid: paid.n,
    ticketsSold,
    revenueCents: paid.revenue,
    checkedIn,
    perTier,
    awaitingTransferOrders: awaiting.n,
    awaitingTransferCents: awaiting.cents,
    awaitingTransferTickets: awaitingTickets,
    mockPaidOrders: mock.n,
    mockTicketsSold: mockTickets,
    mockRevenueCents: mock.revenue,
  };
}

// ---------------- Operational recovery ----------------

/**
 * Orders stuck holding inventory ('claimed'/'capturing') older than the given
 * age — typically a crash or network failure mid-payment. Resolved by
 * reconcileOrders() in lib/reconcile.ts.
 *
 * Bank-transfer orders are EXCLUDED: a 'claimed' transfer reservation holds
 * its seats for days on purpose while the buyer's Überweisung is on its way —
 * it is awaiting money, not stuck, and must never be auto-released here.
 * Overdue ones are expired by expireOverdueTransferReservations() instead.
 */
export function getStuckOrders(olderThanMinutes: number): OrderRow[] {
  return getDb()
    .prepare(
      `SELECT ${ORDER_COLS} FROM orders
       WHERE status IN ('claimed', 'capturing')
         AND payment_mode != 'transfer'
         AND created_at < datetime('now', ?)
       ORDER BY created_at ASC`
    )
    .all(`-${Math.max(1, Math.floor(olderThanMinutes))} minutes`) as OrderRow[];
}

/**
 * PayPal orders still 'pending' after a while: the buyer may have approved the
 * payment at PayPal and then lost their connection before our capture ran.
 * reconcileOrders() checks PayPal and recovers the sale if so.
 */
export function getStalePendingPaypalOrders(olderThanMinutes: number, limit = 50): OrderRow[] {
  return getDb()
    .prepare(
      `SELECT ${ORDER_COLS} FROM orders
       WHERE status = 'pending' AND payment_mode = 'paypal' AND paypal_order_id IS NOT NULL
         AND created_at < datetime('now', ?)
       ORDER BY created_at ASC LIMIT ?`
    )
    .all(`-${Math.max(1, Math.floor(olderThanMinutes))} minutes`, limit) as OrderRow[];
}

// ---------------- Bank-transfer (Überweisung) orders ----------------

/**
 * Transfer reservations awaiting the buyer's bank transfer, oldest first —
 * the organizer's to-confirm worklist.
 */
export function listAwaitingTransferOrders(): OrderListRow[] {
  const rows = getDb()
    .prepare(
      `SELECT ${ORDER_COLS} FROM orders
       WHERE status = 'claimed' AND payment_mode = 'transfer'
       ORDER BY created_at ASC`
    )
    .all() as OrderRow[];
  return withItemsSummary(rows);
}

/**
 * Cancel transfer reservations whose payment never arrived, releasing their
 * seats. Runs lazily from checkout/admin page loads. The cutoff is
 * payWithinDays + 2 grace days: buyers are told the shorter deadline, and the
 * grace absorbs weekends/slow banks so a transfer sent on the last day does
 * not die in transit. Returns the number of reservations expired.
 */
export function expireOverdueTransferReservations(): number {
  const days = (getEventConfig().bankTransfer?.payWithinDays ?? 5) + 2;
  return getDb()
    .prepare(
      `UPDATE orders SET status = 'cancelled'
       WHERE status = 'claimed' AND payment_mode = 'transfer'
         AND created_at < datetime('now', ?)`
    )
    .run(`-${days} days`).changes;
}

// Reservations expire on a multi-DAY timescale, so there is no reason to run
// the sweep on every page render. Page loads (homepage/checkout/admin) call the
// throttled version so a traffic spike doesn't fire a write-locking UPDATE on
// every request; the order-creation route still calls the exact version so a
// just-freed seat is always countable immediately.
let lastExpirySweep = 0;
const EXPIRY_SWEEP_MIN_INTERVAL_MS = 30_000;

export function expireOverdueTransferReservationsThrottled(): void {
  const now = Date.now();
  if (now - lastExpirySweep < EXPIRY_SWEEP_MIN_INTERVAL_MS) return;
  lastExpirySweep = now;
  try {
    expireOverdueTransferReservations();
  } catch (e) {
    console.error('Throttled transfer-expiry sweep failed:', e);
  }
}

/**
 * Admin confirmed the money arrived on the bank statement: finalize the order
 * and mint tickets. Idempotent for already-paid orders. If the reservation
 * had already expired (status 'cancelled') the seats are re-claimed first —
 * so a transfer that arrived late still gets its tickets while stock lasts;
 * when the event has sold out in the meantime this throws SoldOutError and
 * the buyer must be refunded instead.
 */
export function markTransferOrderPaid(orderId: string): TicketRow[] {
  const db = getDb();
  const order = getOrder(orderId);
  if (!order) throw new Error('Order not found');
  if (order.paymentMode !== 'transfer') {
    throw new Error('Only bank-transfer orders can be marked paid manually');
  }
  if (order.status === 'paid') return getTicketsForOrder(orderId);

  // The whole revive+finalize must be atomic: if the event has sold out since
  // the reservation expired, claimInventory throws SoldOutError and the
  // transaction rolls back, leaving the order in its ORIGINAL status
  // (typically 'cancelled') — never stranded in 'pending' where the cleanup
  // job would later delete the record of a buyer who really paid.
  const tx = db.transaction(() => {
    if (order.status === 'cancelled' || order.status === 'failed' || order.status === 'pending') {
      // Late payment on an expired/never-claimed reservation: try to take the
      // seats back. claimInventory re-checks caps and throws SoldOutError.
      db.prepare(`UPDATE orders SET status = 'pending' WHERE id = ?`).run(orderId);
      claimInventory(orderId); // pending -> claimed, or throws (rolls back)
    }
    finalizePaidOrder(orderId, paymentReference(orderId));
  });
  tx();
  return getTicketsForOrder(orderId);
}

/**
 * Delete abandoned pending orders (they hold no inventory). Returns count.
 * Only orders that provably involve no money are deleted: mock orders, or
 * orders where no PayPal order was ever created. A pending order WITH a
 * PayPal order id is kept forever — the buyer may have been charged there,
 * and reconciliation needs the row to recover or audit it.
 */
export function cleanupOldPendingOrders(olderThanHours = 24): number {
  const db = getDb();
  const tx = db.transaction(() => {
    // Never delete transfer orders: they always have paypal_order_id NULL, and
    // a buyer may have sent money we haven't reconciled yet. Only mock orders
    // or PayPal orders that never reached PayPal are safe to remove.
    const ids = db
      .prepare(
        `SELECT id FROM orders
         WHERE status = 'pending' AND created_at < datetime('now', ?)
           AND payment_mode != 'transfer'
           AND (payment_mode = 'mock' OR paypal_order_id IS NULL)`
      )
      .all(`-${Math.max(1, Math.floor(olderThanHours))} hours`) as { id: string }[];
    const delItems = db.prepare(`DELETE FROM order_items WHERE order_id = ?`);
    const delOrder = db.prepare(`DELETE FROM orders WHERE id = ?`);
    for (const { id } of ids) {
      delItems.run(id);
      delOrder.run(id);
    }
    return ids.length;
  });
  return tx();
}

/**
 * Delete ALL test-mode (mock) orders and their tickets. Run before going live
 * so test tickets can never be scanned at the door and stats are clean.
 */
export function purgeMockOrders(): { orders: number; tickets: number } {
  const db = getDb();
  const tx = db.transaction(() => {
    const ids = db.prepare(`SELECT id FROM orders WHERE payment_mode = 'mock'`).all() as { id: string }[];
    let tickets = 0;
    const delTickets = db.prepare(`DELETE FROM tickets WHERE order_id = ?`);
    const delItems = db.prepare(`DELETE FROM order_items WHERE order_id = ?`);
    const delOrder = db.prepare(`DELETE FROM orders WHERE id = ?`);
    for (const { id } of ids) {
      tickets += delTickets.run(id).changes;
      delItems.run(id);
      delOrder.run(id);
    }
    return { orders: ids.length, tickets };
  });
  return tx();
}
