// Server-only: read-model queries behind the seller's monthly STATEMENTS page.
//
// A statement is bookkeeping, not analytics: the ledger of money that arrived
// in the seller's OWN accounts (the platform never touches any of it), sliced
// by calendar month so it can be handed to a tax advisor as-is.
//
// Deliberately built WITHOUT buyer names or emails. A bookkeeping record has
// to stay valid for years, and lib/retention.ts erases buyer details long
// before that — so every field here comes from columns the erasure sweep never
// touches: amounts, payment references, dates, tier names and payment routes.
// A statement printed today and one printed after erasure are identical.
import { getDb } from './db';
import { asEventKind, getEventTiersBulk, type EventKind, type EventTierRow } from './events';
import { getOrderItemsBulk, paymentReferenceOf } from './orders';

/** 'YYYY-MM', the only shape a month travels in. */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isStatementMonth(value: string): boolean {
  return MONTH_RE.test(value);
}

/** One confirmed order on the statement. No people — see the header comment. */
export interface StatementLine {
  orderId: string;
  /** The bank-transfer purpose line / support reference, e.g. TICKETS-AB12CD34. */
  reference: string;
  /** UTC datetime the money was CONFIRMED (paid_at; legacy rows fall back to created_at). */
  confirmedAt: string;
  /** What was bought, e.g. "2× Table of 8" — tier names, never buyers. */
  itemsSummary: string;
  amountCents: number;
  /** How the money travelled: straight to the seller's bank, PayPal, or nothing (free). */
  paymentRoute: 'transfer' | 'paypal' | 'free';
}

/** One listing's month of activity: only listings with confirmed orders appear. */
export interface StatementSection {
  eventId: string;
  eventName: string;
  kind: EventKind;
  currency: string;
  lines: StatementLine[];
  subtotalCents: number;
}

export interface MonthlyStatement {
  /** 'YYYY-MM'. */
  month: string;
  sections: StatementSection[];
  /**
   * Account totals per currency. Almost always a single entry, but currency is
   * per-listing, so two listings in different currencies must never be summed
   * into one meaningless number.
   */
  totals: { currency: string; cents: number }[];
}

/**
 * The months the seller can pick from: every month from their first order
 * (any status — an unpaid month is still a month they were trading) up to the
 * current one, newest first. An account with no orders yet gets just the
 * current month, so the page always has something honest to show.
 */
export function statementMonths(organizerId: string): string[] {
  const row = getDb()
    .prepare(
      `SELECT MIN(o.created_at) AS first
       FROM orders o JOIN events e ON e.id = o.event_id
       WHERE e.organizer_id = ? AND o.payment_mode != 'mock'`
    )
    .get(organizerId) as { first: string | null };

  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth(); // 0-based
  let firstY = y;
  let firstM = m;
  const match = row.first ? /^(\d{4})-(\d{2})/.exec(row.first) : null;
  if (match) {
    firstY = Number(match[1]);
    firstM = Number(match[2]) - 1;
  }

  const months: string[] = [];
  // Capped at ten years of months — a select longer than that stopped being a
  // select, and by then the seller has a better archive than a dropdown.
  while ((y > firstY || (y === firstY && m >= firstM)) && months.length < 120) {
    months.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return months.length ? months : [`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`];
}

/**
 * The month the page opens on: the last FULL month, because that is the one a
 * bookkeeper closes — the running month is still being written. Falls back to
 * the newest available month for accounts younger than one month.
 */
export function defaultStatementMonth(months: string[]): string {
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastFull = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
  return months.includes(lastFull) ? lastFull : months[0];
}

/**
 * The month as a half-open [from, until) pair of stored-datetime prefixes.
 *
 * The predicate used to be strftime('%Y-%m', COALESCE(paid_at, created_at)) = ?,
 * which SQLite cannot answer from an index or a range: it has to compute the
 * function for every candidate row. Timestamps here are written by
 * datetime('now') — 'YYYY-MM-DD HH:MM:SS', a format that sorts as text exactly
 * as it does in time — so a plain string comparison selects the same rows, and
 * a half-open upper bound needs no thought about month lengths or leap days.
 */
function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return [`${month}-01`, `${next}-01`];
}

/** '2026-08' -> 'August 2026', for headers and filenames' human twin. */
export function formatStatementMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The whole account's confirmed money for one month, grouped per listing.
 *
 * Confirmed means PAID: keyed by the month the money was confirmed (paid_at) —
 * not the month the order was placed — because until confirmation there is
 * nothing to book. Test-mode (mock) orders are excluded exactly as they are
 * from every revenue number. Orders from before paid_at existed fall back to
 * created_at rather than vanishing from the books.
 */
export function monthlyStatement(organizerId: string, month: string): MonthlyStatement {
  if (!isStatementMonth(month)) return { month, sections: [], totals: [] };
  const [from, until] = monthRange(month);

  // CROSS JOIN is the optimizer hint, not a different join: SQLite honours the
  // written order for one, and without it the planner drove this from `orders`
  // — scanning every paid order on the PLATFORM to find one seller's month
  // (EXPLAIN QUERY PLAN: "SEARCH o USING INDEX idx_orders_status_mode"). Driven
  // from the organizer's own events it touches only their rows. The listing's
  // name, kind and currency come back on the same rows, so a section no longer
  // costs a lookup of an event this query already read.
  const rows = getDb()
    .prepare(
      `SELECT o.id, e.id AS eventId, e.name AS eventName, e.kind AS kind, e.currency AS currency,
              COALESCE(o.paid_at, o.created_at) AS confirmedAt,
              o.total_cents AS amountCents, o.payment_mode AS paymentRoute
       FROM events e CROSS JOIN orders o ON o.event_id = e.id
       WHERE e.organizer_id = ?
         AND o.status = 'paid' AND o.payment_mode != 'mock'
         AND COALESCE(o.paid_at, o.created_at) >= ?
         AND COALESCE(o.paid_at, o.created_at) < ?
       ORDER BY e.name COLLATE NOCASE, confirmedAt ASC`
    )
    .all(organizerId, from, until) as {
    id: string;
    eventId: string;
    eventName: string;
    kind: string | null;
    currency: string;
    confirmedAt: string;
    amountCents: number;
    paymentRoute: StatementLine['paymentRoute'];
  }[];

  // Two more statements for the whole month's item lines and ticket types,
  // instead of four reads per line — each line needed its items, each item's
  // tier for the name, and then the order, its items and its tiers AGAIN
  // inside paymentReference() to decide on the student prefix.
  const itemsByOrder = getOrderItemsBulk(rows.map((r) => r.id));
  const tiersByEvent = getEventTiersBulk([...new Set(rows.map((r) => r.eventId))]);
  // '<eventId>:<tierKey>' is unambiguous because an event id is a UUID and
  // never contains a colon, while a tier key (organizer-typed) may.
  const tiers = new Map<string, EventTierRow>();
  for (const [eventId, list] of tiersByEvent) {
    for (const t of list) tiers.set(`${eventId}:${t.tierKey}`, t);
  }

  const sections: StatementSection[] = [];
  let current: StatementSection | null = null;
  for (const r of rows) {
    if (!current || current.eventId !== r.eventId) {
      current = {
        eventId: r.eventId,
        eventName: r.eventName,
        // Normalized exactly as getEventById would: rows written before the
        // column existed read NULL, and NULL has always meant an event.
        kind: asEventKind(r.kind),
        currency: r.currency,
        lines: [],
        subtotalCents: 0,
      };
      sections.push(current);
    }
    const items = itemsByOrder.get(r.id) ?? [];
    // A tier deleted since the sale is simply absent from the map — the same
    // miss getEventTier() used to answer with null, and it still degrades the
    // same way in both places below: the key stands in for the name, and the
    // reference reads as a non-student one.
    const tierOf = (tierId: string) => tiers.get(`${r.eventId}:${tierId}`);
    // Tier names, not buyers: the same "2× Table of 8" the orders list shows.
    const itemsSummary = items
      .map((it) => `${it.quantity}× ${tierOf(it.tierId)?.name ?? it.tierId}`)
      .join(', ');
    current.lines.push({
      orderId: r.id,
      reference: paymentReferenceOf(r.id, items.some((it) => tierOf(it.tierId)?.studentOnly)),
      confirmedAt: r.confirmedAt,
      itemsSummary,
      amountCents: r.amountCents,
      paymentRoute: r.paymentRoute,
    });
    current.subtotalCents += r.amountCents;
  }

  const totals: { currency: string; cents: number }[] = [];
  for (const s of sections) {
    const t = totals.find((x) => x.currency === s.currency);
    if (t) t.cents += s.subtotalCents;
    else totals.push({ currency: s.currency, cents: s.subtotalCents });
  }

  return { month, sections, totals };
}

/** The words the page and the CSV agree on for each payment route. */
export const PAYMENT_ROUTE_LABEL: Record<StatementLine['paymentRoute'], string> = {
  transfer: 'Bank transfer',
  paypal: 'PayPal',
  free: 'Free',
};
