// Server-only: Subscribe & save — a buyer's standing order with a shop.
//
// A shop can offer a percentage off orders that repeat (events.subscribe_pct).
// A buyer who ticks "repeat every N weeks" at checkout gets that discount on
// the first order and on every repeat. Each repeat is an ORDINARY order,
// created here on the day it is due: the stock is held, and the buyer is
// emailed the seller's own payment details exactly as for any bank-transfer
// order. Nothing is charged automatically and no money passes through the
// platform — the buyer pays the seller each time, and can skip, pause or
// cancel from the link in every email.
//
// A repeat is only placed while the previous one was paid: a standing order
// nobody pays must not keep holding a seller's stock (it pauses instead).
import crypto from 'crypto';
import { getDb } from './db';
import { getEventById, getEventTier, type EventRow } from './events';
import { createOrder, getOrder } from './orders';
import { SoldOutError } from './inventory';
import { paymentOptionsFor } from './paymentConnections';
import { parseSlotConfig, setOrderKitchenDetails } from './kitchen';
import { getBaseUrl } from './config';

/** How often a standing order can repeat, in days. */
export const SUBSCRIBE_EVERY_DAYS = [7, 14, 28] as const;
/** The discounts a seller can offer. 0 = Subscribe & save is off. */
export const SUBSCRIBE_PCT_CHOICES = [0, 5, 10, 15] as const;

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface SubscriptionRow {
  id: string;
  token: string;
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  items: { tierId: string; quantity: number }[];
  choices: Record<string, Record<string, string>> | null;
  note: string;
  everyDays: number;
  discountPct: number;
  /** 'YYYY-MM-DD' — when the next repeat order is placed. */
  nextOn: string;
  status: SubscriptionStatus;
  /** Why it is paused, in words for the buyer and the seller; '' otherwise. */
  statusNote: string;
  lastOrderId: string | null;
  ordersMade: number;
  createdAt: string;
}

const COLS = `id, token, event_id AS eventId, buyer_name AS buyerName, buyer_email AS buyerEmail,
  items, choices, note, every_days AS everyDays, discount_pct AS discountPct, next_on AS nextOn,
  status, status_note AS statusNote, last_order_id AS lastOrderId, orders_made AS ordersMade,
  created_at AS createdAt`;

function toRow(r: Record<string, unknown> | undefined): SubscriptionRow | null {
  if (!r) return null;
  let items: SubscriptionRow['items'] = [];
  let choices: SubscriptionRow['choices'] = null;
  try {
    items = JSON.parse(String(r.items));
  } catch {
    items = [];
  }
  try {
    choices = r.choices ? JSON.parse(String(r.choices)) : null;
  } catch {
    choices = null;
  }
  return { ...(r as unknown as SubscriptionRow), items, choices };
}

/** 'YYYY-MM-DD' of today plus `days`, in UTC. */
export function dayPlus(days: number, from: Date = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + days));
  return d.toISOString().slice(0, 10);
}

export function isValidEvery(n: unknown): n is (typeof SUBSCRIBE_EVERY_DAYS)[number] {
  return typeof n === 'number' && (SUBSCRIBE_EVERY_DAYS as readonly number[]).includes(n);
}

export function everyLabel(days: number): string {
  return days === 7 ? 'every week' : days % 7 === 0 ? `every ${days / 7} weeks` : `every ${days} days`;
}

/**
 * Whether this listing can take a standing order at all. A shop that offers a
 * discount, sells by a route a repeat can use (a repeat has no buyer at the
 * keyboard, so it is paid like a transfer order — bank or PayPal.me details
 * by email), and does not book dated collection slots (a slot picked for one
 * Tuesday means nothing three weeks later).
 */
export function subscriptionOffer(event: EventRow): { pct: number } | null {
  if (event.kind !== 'shop' || event.isDemo) return null;
  const pct = Math.floor(event.subscribePct || 0);
  if (pct <= 0) return null;
  if (parseSlotConfig(event.pickupSlots).enabled) return null;
  if (!paymentOptionsFor(event).transfer) return null;
  return { pct };
}

/** The same as subscriptionOffer, for the badge on a tile: no payment lookup. */
export function subscribeBadgePct(event: Pick<EventRow, 'kind' | 'subscribePct' | 'isDemo'>): number {
  return event.kind === 'shop' && !event.isDemo ? Math.max(0, Math.floor(event.subscribePct || 0)) : 0;
}

export function createSubscription(params: {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  items: { tierId: string; quantity: number }[];
  choices: Record<string, Record<string, string>> | null;
  note: string;
  everyDays: number;
  discountPct: number;
  firstOrderId: string;
}): SubscriptionRow {
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString('base64url');
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO subscriptions (id, token, event_id, buyer_name, buyer_email, items, choices, note, every_days,
                                  discount_pct, next_on, last_order_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      token,
      params.eventId,
      params.buyerName,
      params.buyerEmail,
      JSON.stringify(params.items),
      params.choices && Object.keys(params.choices).length ? JSON.stringify(params.choices) : null,
      params.note,
      params.everyDays,
      params.discountPct,
      dayPlus(params.everyDays),
      params.firstOrderId
    );
    db.prepare(`UPDATE orders SET subscription_id = ? WHERE id = ?`).run(id, params.firstOrderId);
  })();
  return getSubscription(id)!;
}

export function getSubscription(id: string): SubscriptionRow | null {
  return toRow(getDb().prepare(`SELECT ${COLS} FROM subscriptions WHERE id = ?`).get(id) as Record<string, unknown> | undefined);
}

export function getSubscriptionByToken(token: string): SubscriptionRow | null {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return toRow(getDb().prepare(`SELECT ${COLS} FROM subscriptions WHERE token = ?`).get(token) as Record<string, unknown> | undefined);
}

export function listSubscriptionsForEvent(eventId: string): SubscriptionRow[] {
  return (
    getDb()
      .prepare(`SELECT ${COLS} FROM subscriptions WHERE event_id = ? AND status != 'cancelled' ORDER BY status, next_on`)
      .all(eventId) as Record<string, unknown>[]
  ).map((r) => toRow(r)!);
}

/** Active standing orders per listing, for the seller's dashboard. */
export function activeSubscriptionCounts(eventIds: string[]): Map<string, number> {
  const out = new Map<string, number>();
  if (eventIds.length === 0) return out;
  const rows = getDb()
    .prepare(
      `SELECT event_id AS eventId, COUNT(*) AS n FROM subscriptions
       WHERE status = 'active' AND event_id IN (${eventIds.map(() => '?').join(',')}) GROUP BY event_id`
    )
    .all(...eventIds) as { eventId: string; n: number }[];
  for (const r of rows) out.set(r.eventId, r.n);
  return out;
}

export function subscriptionManageUrl(sub: Pick<SubscriptionRow, 'token'>): string {
  return `${getBaseUrl()}/subscription/${sub.token}`;
}

export type SubscriptionAction = 'skip' | 'pause' | 'resume' | 'cancel';

/** What the buyer's manage page can do. Returns the updated row, or an error in words. */
export function actOnSubscription(token: string, action: SubscriptionAction): SubscriptionRow | string {
  const sub = getSubscriptionByToken(token);
  if (!sub) return 'That subscription link is not valid.';
  if (sub.status === 'cancelled') return 'This subscription has already been cancelled.';
  const db = getDb();
  const set = (sql: string, ...args: unknown[]) =>
    db.prepare(`UPDATE subscriptions SET ${sql}, updated_at = datetime('now') WHERE id = ?`).run(...args, sub.id);
  if (action === 'skip') {
    if (sub.status !== 'active') return 'Resume the subscription first — a paused one has nothing to skip.';
    set('next_on = ?', dayPlus(sub.everyDays, new Date(`${sub.nextOn}T12:00:00Z`)));
  } else if (action === 'pause') {
    set(`status = 'paused', status_note = ?`, 'Paused by you.');
  } else if (action === 'resume') {
    const today = dayPlus(0);
    set(`status = 'active', status_note = '', next_on = ?`, sub.nextOn < today ? dayPlus(1) : sub.nextOn);
  } else if (action === 'cancel') {
    set(`status = 'cancelled', status_note = ?`, 'Cancelled by you.');
  }
  return getSubscription(sub.id)!;
}

// ---------------------------------------------------------------------------
// The sweep: place every repeat that is due.
// ---------------------------------------------------------------------------

const SWEEP_MIN_INTERVAL_MS = 15 * 60_000;

declare global {
  // eslint-disable-next-line no-var
  var __subscriptionSweep: { lastAt: number; running: boolean; interval?: ReturnType<typeof setInterval> } | undefined;
}

function pause(sub: SubscriptionRow, note: string): void {
  getDb()
    .prepare(`UPDATE subscriptions SET status = 'paused', status_note = ?, updated_at = datetime('now') WHERE id = ? AND status = 'active'`)
    .run(note, sub.id);
}

export interface RepeatResult {
  subscriptionId: string;
  outcome: 'ordered' | 'waiting-for-payment' | 'paused' | 'sold-out' | 'skipped';
  orderId?: string;
}

/**
 * Place ONE due repeat. Exported for tests; the sweep calls it per row.
 * The next date is moved forward FIRST, by a guarded update, so two sweeps
 * racing on the same row cannot both place an order.
 */
export function placeRepeat(sub: SubscriptionRow, today: string = dayPlus(0)): RepeatResult {
  const db = getDb();
  const base = { subscriptionId: sub.id };
  const event = getEventById(sub.eventId);
  if (!event || event.status !== 'published' || !event.salesOpen) {
    pause(sub, 'The shop is not taking orders right now.');
    return { ...base, outcome: 'paused' };
  }
  const offer = subscriptionOffer(event);
  if (!offer) {
    pause(sub, 'The shop no longer offers Subscribe & save.');
    return { ...base, outcome: 'paused' };
  }

  // The previous order decides whether a new one is placed.
  const last = sub.lastOrderId ? getOrder(sub.lastOrderId) : null;
  if (last && (last.status === 'claimed' || last.status === 'pending' || last.status === 'capturing')) {
    // Still unpaid: do not stack a second reservation on top of it. Try again
    // on the next cycle.
    db.prepare(`UPDATE subscriptions SET next_on = ?, updated_at = datetime('now') WHERE id = ? AND next_on = ?`).run(
      dayPlus(sub.everyDays, new Date(`${today}T12:00:00Z`)),
      sub.id,
      sub.nextOn
    );
    return { ...base, outcome: 'waiting-for-payment' };
  }
  if (last && (last.status === 'failed' || last.status === 'cancelled')) {
    pause(sub, 'The last order was never paid, so the next one was not placed.');
    return { ...base, outcome: 'paused' };
  }

  const claimed = db
    .prepare(`UPDATE subscriptions SET next_on = ?, updated_at = datetime('now') WHERE id = ? AND next_on = ? AND status = 'active'`)
    .run(dayPlus(sub.everyDays, new Date(`${today}T12:00:00Z`)), sub.id, sub.nextOn).changes;
  if (claimed === 0) return { ...base, outcome: 'skipped' };

  // Items the shop has since removed or stopped selling drop out; nothing left = pause.
  const items = sub.items.filter((it) => {
    const tier = getEventTier(event.id, it.tierId);
    return tier && tier.status !== 'hidden' && tier.status !== 'coming-soon';
  });
  if (items.length === 0) {
    pause(sub, 'The items in this subscription are no longer sold.');
    return { ...base, outcome: 'paused' };
  }

  try {
    const order = createOrder({
      eventId: event.id,
      buyerName: sub.buyerName,
      buyerEmail: sub.buyerEmail,
      items,
      paymentMode: 'transfer',
      // The percentage frozen at sign-up — a seller lowering the offer later
      // does not quietly raise an existing subscriber's price.
      subscriptionPct: sub.discountPct,
      subscriptionId: sub.id,
    });
    if (sub.choices || sub.note) {
      const choices = Object.fromEntries(Object.entries(sub.choices ?? {}).filter(([k]) => items.some((it) => it.tierId === k)));
      setOrderKitchenDetails(order.id, { pickupSlot: null, tableLabel: '', note: sub.note, choices });
    }
    db.prepare(
      `UPDATE subscriptions SET last_order_id = ?, orders_made = orders_made + 1, updated_at = datetime('now') WHERE id = ?`
    ).run(order.id, sub.id);
    return { ...base, outcome: 'ordered', orderId: order.id };
  } catch (e) {
    if (e instanceof SoldOutError) return { ...base, outcome: 'sold-out' };
    throw e;
  }
}

/**
 * Place every repeat that is due today or earlier. Self-throttling; arms its
 * own interval on first use, like the payment-reminder sweep (lib/reminders).
 */
export async function runSubscriptionSweep(force = false): Promise<RepeatResult[]> {
  const state = (global.__subscriptionSweep ??= { lastAt: 0, running: false });
  if (!state.interval) {
    state.interval = setInterval(() => {
      runSubscriptionSweep().catch((e) => console.error('Subscription sweep failed:', e));
    }, SWEEP_MIN_INTERVAL_MS);
    if (typeof state.interval.unref === 'function') state.interval.unref();
  }
  const now = Date.now();
  if (state.running || (!force && now - state.lastAt < SWEEP_MIN_INTERVAL_MS)) return [];
  state.running = true;
  state.lastAt = now;
  const results: RepeatResult[] = [];
  try {
    const today = dayPlus(0);
    const due = (
      getDb()
        .prepare(`SELECT ${COLS} FROM subscriptions WHERE status = 'active' AND next_on <= ? ORDER BY next_on LIMIT 200`)
        .all(today) as Record<string, unknown>[]
    ).map((r) => toRow(r)!);
    const { sendTransferInstructionsEmail, sendSubscriptionEmail } = await import('./email');
    for (const sub of due) {
      try {
        const result = placeRepeat(sub, today);
        results.push(result);
        if (result.outcome === 'ordered' && result.orderId) {
          const r = await sendTransferInstructionsEmail(result.orderId);
          if (!r.sent) console.log(`Repeat order ${result.orderId} instructions not sent: ${r.reason}`);
        } else if (result.outcome === 'paused' || result.outcome === 'sold-out') {
          await sendSubscriptionEmail(sub.id, result.outcome);
        }
      } catch (e) {
        console.error(`Subscription ${sub.id} repeat failed:`, e);
      }
    }
  } finally {
    state.running = false;
  }
  return results;
}
