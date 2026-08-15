// Server-only: erase buyers' personal details once their event is over.
//
// A buyer's name and email exist for exactly three jobs — issue the QR ticket,
// re-send it if it goes missing, and let the organizer match the bank transfer
// to the right reservation. Once the event has happened all three are done, so
// this sweep overwrites both fields IN PLACE after a retention window.
//
// Rows are never deleted. The organizer keeps their counts, their revenue and
// their check-in history, every ticket still reconciles to the order that
// minted it, and the payment reference (derived from the order id) still
// resolves — only the person behind the order stops being identifiable.
//
// Shaped exactly like the reminder sweep (lib/reminders.ts): it self-throttles,
// is safe to call as often as you like, is armed lazily from page loads, and
// swallows its own errors so it can never break a render.
import { getDb } from './db';

const DEFAULT_RETENTION_DAYS = 30;

/**
 * Days after an event's date before its buyers' names and emails are erased.
 *
 * The privacy copy (/privacy, the checkout notice) reads THIS constant rather
 * than repeating a number, so what the site promises and what the sweep does
 * cannot drift apart. Override with BUYER_RETENTION_DAYS; anything that is not
 * a sane whole number of days falls back to the default rather than silently
 * disabling erasure.
 */
export const BUYER_RETENTION_DAYS: number = (() => {
  const raw = Number(process.env.BUYER_RETENTION_DAYS);
  return Number.isInteger(raw) && raw >= 1 && raw <= 3650 ? raw : DEFAULT_RETENTION_DAYS;
})();

/**
 * What replaces the buyer's details. Both are fixed strings, so re-running the
 * sweep over an already-erased order writes nothing new; the address uses the
 * reserved .invalid TLD (RFC 2606), which can never be delivered to, so an
 * erased order cannot accidentally email a real person later.
 */
export const ERASED_BUYER_NAME = 'Erased after event';
export const ERASED_BUYER_EMAIL = 'erased@erased.invalid';

/** Rows touched per statement pass, so one sweep never loads a whole season. */
const BATCH_SIZE = 500;
/** Bound on one sweep's work; a large backlog simply finishes on later calls. */
const MAX_BATCHES = 20;
/** The window is measured in days — checking hourly is already generous. */
const SWEEP_MIN_INTERVAL_MS = 60 * 60_000;

let lastSweepAt = 0;
let sweeping = false;

declare global {
  // eslint-disable-next-line no-var
  var __retentionInterval: ReturnType<typeof setInterval> | undefined;
}

/**
 * Arm the recurring sweep once per server process, from the first sweep — the
 * same trick lib/reminders.ts uses. A site with visitors erases on time without
 * an instrumentation hook (which would drag SQLite into the Edge bundle), and a
 * site with no visitors has nothing arriving that needs erasing either.
 */
function ensureRetentionInterval(): void {
  if (global.__retentionInterval) return;
  global.__retentionInterval = setInterval(
    () => {
      runBuyerDataRetentionSweep();
    },
    6 * 60 * 60_000
  );
  // Never keep the process alive just for this.
  if (typeof global.__retentionInterval.unref === 'function') global.__retentionInterval.unref();
}

/**
 * Orders whose event finished more than BUYER_RETENTION_DAYS ago and whose
 * buyer has not been erased yet.
 *
 * Two deliberate exclusions:
 *  - an order with no event (orphaned) is dropped by the JOIN;
 *  - an event with no date is never swept, because there is nothing to count
 *    the window from. date() returns NULL for an unparseable value, and
 *    `NULL <= x` is never true, so junk in event_date fails closed too.
 */
const DUE_SQL = `
  SELECT o.id AS id
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE o.buyer_erased_at IS NULL
    AND e.event_date IS NOT NULL
    AND date(e.event_date) <= date('now', ?)
  ORDER BY o.created_at ASC
  LIMIT ${BATCH_SIZE}
`;

/**
 * Erase the buyer details of every order whose event is more than
 * BUYER_RETENTION_DAYS past. Idempotent (buyer_erased_at is the stamp that
 * retires a row from the query), batched, and it never throws — callers on a
 * page render can call it and ignore the result.
 *
 * Pass force to skip the throttle; tests and manual runs want that, page loads
 * do not.
 */
export function runBuyerDataRetentionSweep(force = false): { erased: number } {
  ensureRetentionInterval();
  const now = Date.now();
  if (sweeping || (!force && now - lastSweepAt < SWEEP_MIN_INTERVAL_MS)) return { erased: 0 };
  sweeping = true;
  lastSweepAt = now;
  try {
    const db = getDb();
    const cutoff = `-${BUYER_RETENTION_DAYS} days`;
    const findDue = db.prepare(DUE_SQL);
    const erase = db.prepare(
      `UPDATE orders
       SET buyer_name = ?, buyer_email = ?, buyer_erased_at = datetime('now')
       WHERE id = ? AND buyer_erased_at IS NULL`
    );
    const eraseBatch = db.transaction((ids: string[]) => {
      let n = 0;
      for (const id of ids) n += erase.run(ERASED_BUYER_NAME, ERASED_BUYER_EMAIL, id).changes;
      return n;
    });

    let erased = 0;
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const due = findDue.all(cutoff) as { id: string }[];
      if (due.length === 0) break;
      erased += eraseBatch(due.map((r) => r.id));
      if (due.length < BATCH_SIZE) break;
    }
    if (erased > 0) console.log(`Retention sweep: erased buyer details on ${erased} order(s).`);
    return { erased };
  } catch (e) {
    console.error('Buyer data retention sweep failed:', e);
    return { erased: 0 };
  } finally {
    sweeping = false;
  }
}
