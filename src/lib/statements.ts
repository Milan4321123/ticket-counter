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
import { getEventById, getEventTier, type EventKind } from './events';
import { getOrderItems, paymentReference } from './orders';

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

  const rows = getDb()
    .prepare(
      `SELECT o.id, o.event_id AS eventId,
              COALESCE(o.paid_at, o.created_at) AS confirmedAt,
              o.total_cents AS amountCents, o.payment_mode AS paymentRoute
       FROM orders o JOIN events e ON e.id = o.event_id
       WHERE e.organizer_id = ?
         AND o.status = 'paid' AND o.payment_mode != 'mock'
         AND strftime('%Y-%m', COALESCE(o.paid_at, o.created_at)) = ?
       ORDER BY e.name COLLATE NOCASE, confirmedAt ASC`
    )
    .all(organizerId, month) as {
    id: string;
    eventId: string;
    confirmedAt: string;
    amountCents: number;
    paymentRoute: StatementLine['paymentRoute'];
  }[];

  const sections: StatementSection[] = [];
  let current: StatementSection | null = null;
  for (const r of rows) {
    if (!current || current.eventId !== r.eventId) {
      const event = getEventById(r.eventId);
      if (!event) continue; // a listing deleted mid-query; its rows are gone with it
      current = {
        eventId: event.id,
        eventName: event.name,
        kind: event.kind,
        currency: event.currency,
        lines: [],
        subtotalCents: 0,
      };
      sections.push(current);
    }
    // Tier names, not buyers: the same "2× Table of 8" the orders list shows.
    // A tier deleted since keeps its key as the honest leftover.
    const itemsSummary = getOrderItems(r.id)
      .map((it) => `${it.quantity}× ${getEventTier(r.eventId, it.tierId)?.name ?? it.tierId}`)
      .join(', ');
    current.lines.push({
      orderId: r.id,
      reference: paymentReference(r.id),
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
