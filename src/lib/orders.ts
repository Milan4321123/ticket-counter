// Server-only: order + ticket persistence and lifecycle. Every order belongs
// to ONE event (orders.event_id); prices and tier names always come from that
// event's rows in event_tiers — never from the browser.
import crypto from 'crypto';
import { getDb } from './db';
import { getPaymentMode } from './config';
import { getEventById, getEventTier, getEventTiers } from './events';
import { claimInventory } from './inventory';
import { effectivePayout } from './payout';
import { generateTicketCode, normalizeTicketCode } from './tickets';
import type { CheckinResponse } from './types';

export type OrderStatus = 'pending' | 'claimed' | 'capturing' | 'paid' | 'failed' | 'cancelled';
export type PaymentMethod = 'paypal' | 'mock' | 'transfer';

export interface OrderRow {
  id: string;
  eventId: string;
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
  /**
   * When buyerName/buyerEmail were overwritten because the event is long past
   * (lib/retention.ts). Non-null means the two fields above are placeholders,
   * not a person — nothing may be emailed to them.
   */
  buyerErasedAt: string | null;
  /**
   * The payout account this order was TOLD to pay, frozen when it was created.
   *
   * A receipt, not a pointer: the order page and its emails read these, so an
   * organizer changing the event's IBAN afterwards can never rewrite the
   * instructions a buyer already holds. '' on orders written before the
   * snapshot existed — lib/payout.ts falls those back to the event.
   */
  payoutHolder: string;
  payoutIban: string;
  payoutBic: string;
  payoutBankName: string;
  payoutPaypal: string;
}

/**
 * Short reference the buyer must put in their bank transfer's purpose line
 * ("Verwendungszweck") so the organizer can match money to orders. Derived
 * from the order id, so admin search finds it (the hex part matches the id).
 *
 * Orders containing any student ticket get an "S-" marker (TICKETS-S-XXXXXXXX
 * instead of TICKETS-XXXXXXXX) so student sales are recognizable directly on
 * the bank statement and in the admin panel. Whether a tier is student-only
 * comes from the ORDER'S EVENT (event_tiers).
 */
export function paymentReference(orderId: string): string {
  const order = getOrder(orderId);
  const hasStudent = order
    ? getOrderItems(orderId).some((it) => getEventTier(order.eventId, it.tierId)?.studentOnly)
    : false;
  return (hasStudent ? 'TICKETS-S-' : 'TICKETS-') + orderId.slice(0, 8).toUpperCase();
}

/**
 * The order a payment reference points at, or null.
 *
 * The inverse of paymentReference(): the reference carries the first 8 hex
 * characters of the order id, so a buyer who quotes their reference identifies
 * their own order without anyone having to look them up by name. That is what
 * lets the platform's support backstop work at all now that the owner cannot
 * see a list of buyers.
 *
 * Fails closed: junk, a truncated reference, or the (practically impossible)
 * case of two ids sharing a prefix all return null rather than a guess.
 */
export function getOrderByPaymentReference(reference: string): OrderRow | null {
  const key = reference.trim().replace(/^TICKETS-(S-)?/i, '').replace(/[^0-9a-fA-F]/g, '');
  if (key.length !== 8) return null;
  const rows = getDb()
    .prepare(`SELECT ${ORDER_COLS} FROM orders WHERE id LIKE ? || '%' LIMIT 2`)
    .all(key.toLowerCase()) as OrderRow[];
  return rows.length === 1 ? rows[0] : null;
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
  event_id AS eventId,
  paypal_order_id AS paypalOrderId,
  status,
  buyer_name AS buyerName,
  buyer_email AS buyerEmail,
  total_cents AS totalCents,
  currency,
  payment_mode AS paymentMode,
  created_at AS createdAt,
  paid_at AS paidAt,
  capture_id AS captureId,
  buyer_erased_at AS buyerErasedAt,
  payout_holder AS payoutHolder,
  payout_iban AS payoutIban,
  payout_bic AS payoutBic,
  payout_bank_name AS payoutBankName,
  payout_paypal AS payoutPaypal
`;

const TICKET_COLS = `
  code,
  order_id AS orderId,
  tier_id AS tierId,
  created_at AS createdAt,
  checked_in_at AS checkedInAt
`;

/**
 * How many tickets this email is already holding UNPAID on this event.
 *
 * Counts tickets rather than orders: two reservations of eight seats is the
 * problem, not the fact that there were two of them. 'claimed' is the only
 * status that holds seats without money having arrived — 'paid' is settled and
 * cancelled/expired have already released theirs.
 *
 * Deliberately reads the database rather than the in-memory limiter: this is a
 * question about state that outlives a process, and a restart must not hand
 * everyone a fresh allowance.
 */
export function heldUnpaidTicketsForEmail(eventId: string, buyerEmail: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(oi.quantity), 0) AS n
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
        WHERE o.event_id = ?
          AND o.status = 'claimed'
          AND o.payment_mode = 'transfer'
          AND LOWER(o.buyer_email) = LOWER(?)`
    )
    .get(eventId, buyerEmail) as { n: number };
  return row.n;
}

/**
 * Create a local order for an event. Prices are ALWAYS looked up from the
 * event's tiers here — never trust amounts sent by the browser. The currency
 * is the event's currency.
 *
 * Bank-transfer orders reserve their seats IMMEDIATELY (created 'pending',
 * then claimed in the same call): the buyer's transfer takes days and the
 * seats must hold until the organizer confirms the money or the reservation
 * expires. If the claim fails the order is cancelled and SoldOutError
 * propagates — the caller can tell the buyer nothing was reserved.
 */
export function createOrder(params: {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  items: { tierId: string; quantity: number }[];
  paymentMode: PaymentMethod;
}): OrderRow {
  const db = getDb();
  const id = crypto.randomUUID();

  const event = getEventById(params.eventId);
  if (!event) throw new Error('Unknown event');

  const resolved = params.items.map((it) => {
    const tier = getEventTier(event.id, it.tierId);
    if (!tier) throw new Error(`Unknown ticket type: ${it.tierId}`);
    if (!Number.isInteger(it.quantity) || it.quantity < 1) {
      throw new Error(`Invalid quantity for ${it.tierId}`);
    }
    return { tierId: it.tierId, quantity: it.quantity, unitPriceCents: tier.priceCents };
  });
  const totalCents = resolved.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0);

  // Freeze where this buyer is being sent, now, before anything can move it.
  // effectivePayout() rather than the raw columns: a payout change whose waiting
  // period has already elapsed is the real account, even if the row has not been
  // tidied up yet.
  const payout = effectivePayout(event);

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO orders (id, event_id, status, buyer_name, buyer_email, total_cents, currency, payment_mode,
                           payout_holder, payout_iban, payout_bic, payout_bank_name, payout_paypal)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      event.id,
      params.buyerName,
      params.buyerEmail,
      totalCents,
      event.currency,
      params.paymentMode,
      payout.holder,
      payout.iban,
      payout.bic,
      payout.bankName,
      payout.paypal
    );
    const ins = db.prepare(
      `INSERT INTO order_items (order_id, tier_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?)`
    );
    for (const it of resolved) ins.run(id, it.tierId, it.quantity, it.unitPriceCents);
  });
  tx();

  if (params.paymentMode === 'transfer') {
    try {
      claimInventory(id); // pending -> claimed, or throws SoldOutError
    } catch (e) {
      markOrderFailed(id, 'cancelled');
      throw e;
    }
  }

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
  eventId: string;
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
              t.checked_in_at AS checkedInAt, o.event_id AS eventId, o.status AS orderStatus,
              o.buyer_name AS buyerName, o.buyer_email AS buyerEmail,
              o.payment_mode AS paymentMode
       FROM tickets t JOIN orders o ON o.id = t.order_id
       WHERE t.code = ?`
    )
    .get(code) as TicketWithOrder | undefined;
  return row ?? null;
}

/**
 * Atomic door check-in: each ticket can be used exactly once.
 *
 * When `scope.eventId` is set (event-scoped scanner links), a valid ticket
 * that belongs to a DIFFERENT event is refused with 'wrong_event' — and no
 * ticket details are returned, so one event's door staff never see another
 * event's buyer data.
 */
export function checkInTicket(rawCode: string, scope?: { eventId?: string }): CheckinResponse {
  const db = getDb();
  const tx = db.transaction((): CheckinResponse => {
    const row = getTicketByCode(rawCode);
    if (!row) return { result: 'not_found' };
    if (scope?.eventId && row.eventId !== scope.eventId) {
      return { result: 'wrong_event' };
    }
    const tier = getEventTier(row.eventId, row.tierId);
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

// ---------------- Admin/portal queries ----------------

export interface OrderListRow extends OrderRow {
  itemsSummary: string; // e.g. "2× General Admission, 1× Student"
  ticketCount: number;
}

function withItemsSummary(rows: OrderRow[]): OrderListRow[] {
  return rows.map((o) => {
    const items = getOrderItems(o.id);
    const itemsSummary = items
      .map((it) => `${it.quantity}× ${getEventTier(o.eventId, it.tierId)?.name ?? it.tierId}`)
      .join(', ');
    const ticketCount = items.reduce((s, it) => s + it.quantity, 0);
    return { ...o, itemsSummary, ticketCount };
  });
}

/** Admin/portal order filter buckets (the chips on the orders pages). */
export type OrderFilter = 'all' | 'awaiting' | 'paid' | 'closed';

const FILTER_SQL: Record<Exclude<OrderFilter, 'all'>, string> = {
  awaiting: `status = 'claimed' AND payment_mode = 'transfer'`,
  paid: `status = 'paid'`,
  closed: `status IN ('cancelled', 'failed')`,
};

export function listOrders(
  opts: { eventId?: string; organizerId?: string; query?: string; limit?: number; filter?: OrderFilter } = {}
): OrderListRow[] {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 200, 1000);
  const conditions: string[] = [];
  const args: (string | number)[] = [];
  if (opts.eventId) {
    conditions.push(`event_id = ?`);
    args.push(opts.eventId);
  }
  if (opts.organizerId) {
    conditions.push(`event_id IN (SELECT id FROM events WHERE organizer_id = ?)`);
    args.push(opts.organizerId);
  }
  if (opts.query && opts.query.trim()) {
    // Let organizers paste a bank-transfer reference ("TICKETS-AB12CD34" or the
    // student form "TICKETS-S-AB12CD34") as-is — the hex part matches the
    // order id (LIKE is case-insensitive for ASCII).
    const q = `%${opts.query.trim().replace(/^TICKETS-(S-)?/i, '')}%`;
    conditions.push(`(buyer_name LIKE ? OR buyer_email LIKE ? OR id LIKE ?)`);
    args.push(q, q, q);
  }
  if (opts.filter && opts.filter !== 'all') {
    conditions.push(`(${FILTER_SQL[opts.filter]})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT ${ORDER_COLS} FROM orders ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...args, limit) as OrderRow[];
  return withItemsSummary(rows);
}

/** How many orders fall in each filter bucket (for the chip labels). */
export function countOrdersByFilter(
  query?: string,
  scope: { eventId?: string; organizerId?: string } = {}
): Record<OrderFilter, number> {
  const db = getDb();
  const conditions: string[] = [];
  const args: string[] = [];
  if (scope.eventId) {
    conditions.push(`event_id = ?`);
    args.push(scope.eventId);
  }
  if (scope.organizerId) {
    conditions.push(`event_id IN (SELECT id FROM events WHERE organizer_id = ?)`);
    args.push(scope.organizerId);
  }
  if (query && query.trim()) {
    const q = `%${query.trim().replace(/^TICKETS-(S-)?/i, '')}%`;
    conditions.push(`(buyer_name LIKE ? OR buyer_email LIKE ? OR id LIKE ?)`);
    args.push(q, q, q);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const row = db
    .prepare(
      `SELECT COUNT(*) AS all_n,
              COALESCE(SUM(CASE WHEN ${FILTER_SQL.awaiting} THEN 1 ELSE 0 END), 0) AS awaiting_n,
              COALESCE(SUM(CASE WHEN ${FILTER_SQL.paid} THEN 1 ELSE 0 END), 0) AS paid_n,
              COALESCE(SUM(CASE WHEN ${FILTER_SQL.closed} THEN 1 ELSE 0 END), 0) AS closed_n
       FROM orders ${where}`
    )
    .get(...args) as { all_n: number; awaiting_n: number; paid_n: number; closed_n: number };
  return { all: row.all_n, awaiting: row.awaiting_n, paid: row.paid_n, closed: row.closed_n };
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
  /** Per-tier breakdown. Only meaningful for a single event ([] platform-wide). */
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

/**
 * Sales stats for one event (pass its id) or the whole platform (omit it).
 * Platform-wide numbers sum across events; perTier is [] there because tier
 * keys are only unique within an event.
 */
export function getStats(eventId?: string): Stats {
  const db = getDb();
  const scope = eventId ? `AND event_id = ?` : '';
  const scopeArgs: string[] = eventId ? [eventId] : [];
  const ticketScope = eventId ? `AND o.event_id = ?` : '';

  const paid = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS revenue
       FROM orders WHERE status = 'paid' AND payment_mode != 'mock' ${scope}`
    )
    .get(...scopeArgs) as { n: number; revenue: number };
  const mock = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS revenue
       FROM orders WHERE status = 'paid' AND payment_mode = 'mock' ${scope}`
    )
    .get(...scopeArgs) as { n: number; revenue: number };
  const mockTickets = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM tickets t JOIN orders o ON o.id = t.order_id
         WHERE o.status = 'paid' AND o.payment_mode = 'mock' ${ticketScope}`
      )
      .get(...scopeArgs) as { n: number }
  ).n;
  const ticketsSold = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM tickets t JOIN orders o ON o.id = t.order_id
         WHERE o.status = 'paid' ${ticketScope}`
      )
      .get(...scopeArgs) as { n: number }
  ).n;
  const checkedIn = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM tickets t JOIN orders o ON o.id = t.order_id
         WHERE t.checked_in_at IS NOT NULL ${ticketScope}`
      )
      .get(...scopeArgs) as { n: number }
  ).n;

  // Per tier: 'sold' counts every paid seat (mock included — they hold
  // capacity until purged); revenue counts REAL money only, matching the
  // headline revenue.
  let perTier: TierStats[] = [];
  if (eventId) {
    const perTierRows = db
      .prepare(
        `SELECT oi.tier_id AS tierId, COALESCE(SUM(oi.quantity), 0) AS sold,
                COALESCE(SUM(CASE WHEN o.payment_mode != 'mock' THEN oi.quantity * oi.unit_price_cents ELSE 0 END), 0) AS revenueCents
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'paid' AND o.event_id = ?
         GROUP BY oi.tier_id`
      )
      .all(eventId) as { tierId: string; sold: number; revenueCents: number }[];
    const soldMap = new Map(perTierRows.map((r) => [r.tierId, r]));
    perTier = getEventTiers(eventId).map((t) => ({
      tierId: t.tierKey,
      name: t.name,
      sold: soldMap.get(t.tierKey)?.sold ?? 0,
      cap: t.cap,
      revenueCents: soldMap.get(t.tierKey)?.revenueCents ?? 0,
    }));
  }

  const awaiting = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS cents
       FROM orders WHERE status = 'claimed' AND payment_mode = 'transfer' ${scope}`
    )
    .get(...scopeArgs) as { n: number; cents: number };
  const awaitingTickets = (
    db
      .prepare(
        `SELECT COALESCE(SUM(oi.quantity), 0) AS n
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'claimed' AND o.payment_mode = 'transfer' ${ticketScope}`
      )
      .get(...scopeArgs) as { n: number }
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

/** Per-event stats (same shape as getStats — the event scoping made explicit). */
export function getEventStats(eventId: string): Stats {
  return getStats(eventId);
}

/**
 * One event's sales, counted rather than listed.
 *
 * Every field here is an aggregate ON PURPOSE: this is what the PLATFORM owner
 * is allowed to see about an event he does not run. He needs to know the
 * business is working — how many sold, how much money moved, how many walked
 * through the door — and none of that requires knowing who bought. The buyers
 * themselves belong to the organizer, who sees them in their own portal.
 */
export interface EventSalesSummary {
  ordersPaid: number;
  ticketsSold: number;
  revenueCents: number;
  checkedIn: number;
  awaitingOrders: number;
  awaitingCents: number;
}

const EMPTY_SALES_SUMMARY: EventSalesSummary = {
  ordersPaid: 0,
  ticketsSold: 0,
  revenueCents: 0,
  checkedIn: 0,
  awaitingOrders: 0,
  awaitingCents: 0,
};

/**
 * Sales totals for every event on the platform, keyed by event id — two
 * grouped queries rather than one per event, so the admin overview stays a
 * couple of statements however many events exist. Counting rules match
 * getStats(): revenue is real money only, ticketsSold counts every paid seat
 * (test-mode ones hold capacity until purged).
 *
 * Events with no orders are simply absent; read through summaryFor().
 */
export function listEventSalesSummaries(): Map<string, EventSalesSummary> {
  const db = getDb();
  const byEvent = new Map<string, EventSalesSummary>();
  const entry = (eventId: string): EventSalesSummary => {
    let row = byEvent.get(eventId);
    if (!row) {
      row = { ...EMPTY_SALES_SUMMARY };
      byEvent.set(eventId, row);
    }
    return row;
  };

  const orderRows = db
    .prepare(
      `SELECT event_id AS eventId,
              COALESCE(SUM(CASE WHEN status = 'paid' AND payment_mode != 'mock' THEN 1 ELSE 0 END), 0) AS ordersPaid,
              COALESCE(SUM(CASE WHEN status = 'paid' AND payment_mode != 'mock' THEN total_cents ELSE 0 END), 0) AS revenueCents,
              COALESCE(SUM(CASE WHEN ${FILTER_SQL.awaiting} THEN 1 ELSE 0 END), 0) AS awaitingOrders,
              COALESCE(SUM(CASE WHEN ${FILTER_SQL.awaiting} THEN total_cents ELSE 0 END), 0) AS awaitingCents
       FROM orders WHERE event_id IS NOT NULL GROUP BY event_id`
    )
    .all() as { eventId: string; ordersPaid: number; revenueCents: number; awaitingOrders: number; awaitingCents: number }[];
  for (const r of orderRows) {
    const row = entry(r.eventId);
    row.ordersPaid = r.ordersPaid;
    row.revenueCents = r.revenueCents;
    row.awaitingOrders = r.awaitingOrders;
    row.awaitingCents = r.awaitingCents;
  }

  const ticketRows = db
    .prepare(
      `SELECT o.event_id AS eventId,
              COALESCE(SUM(CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END), 0) AS ticketsSold,
              COALESCE(SUM(CASE WHEN t.checked_in_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS checkedIn
       FROM tickets t JOIN orders o ON o.id = t.order_id
       WHERE o.event_id IS NOT NULL GROUP BY o.event_id`
    )
    .all() as { eventId: string; ticketsSold: number; checkedIn: number }[];
  for (const r of ticketRows) {
    const row = entry(r.eventId);
    row.ticketsSold = r.ticketsSold;
    row.checkedIn = r.checkedIn;
  }

  return byEvent;
}

/** An event's totals, or an all-zero summary when it has never sold anything. */
export function summaryFor(
  summaries: Map<string, EventSalesSummary>,
  eventId: string
): EventSalesSummary {
  return summaries.get(eventId) ?? EMPTY_SALES_SUMMARY;
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
 * the organizer's to-confirm worklist. Scoped to one event when eventId is
 * given, platform-wide otherwise.
 */
export function listAwaitingTransferOrders(eventId?: string): OrderListRow[] {
  const scope = eventId ? `AND event_id = ?` : '';
  const args: string[] = eventId ? [eventId] : [];
  const rows = getDb()
    .prepare(
      `SELECT ${ORDER_COLS} FROM orders
       WHERE status = 'claimed' AND payment_mode = 'transfer' ${scope}
       ORDER BY created_at ASC`
    )
    .all(...args) as OrderRow[];
  return withItemsSummary(rows);
}

/**
 * Cancel transfer reservations whose payment never arrived, releasing their
 * seats. Runs lazily from checkout/admin page loads. The cutoff is each
 * EVENT'S payWithinDays + 2 grace days: buyers are told the shorter deadline,
 * and the grace absorbs weekends/slow banks so a transfer sent on the last day
 * does not die in transit. Scoped to one event when eventId is given.
 * Returns the number of reservations expired.
 */
export function expireOverdueTransferReservations(eventId?: string): number {
  const scope = eventId ? `AND event_id = ?` : '';
  const args: string[] = eventId ? [eventId] : [];
  return getDb()
    .prepare(
      `UPDATE orders SET status = 'cancelled'
       WHERE status = 'claimed' AND payment_mode = 'transfer' ${scope}
         AND created_at < datetime('now',
           '-' || (COALESCE((SELECT e.pay_within_days FROM events e WHERE e.id = orders.event_id), 5) + 2) || ' days')`
    )
    .run(...args).changes;
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
 * The organizer confirmed the money arrived on their bank statement: finalize
 * the order and mint tickets. Idempotent for already-paid orders. If the
 * reservation had already expired (status 'cancelled') the seats are
 * re-claimed first — so a transfer that arrived late still gets its tickets
 * while stock lasts; when the event has sold out in the meantime this throws
 * SoldOutError and the buyer must be refunded instead.
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
