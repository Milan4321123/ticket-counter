// Server-only: "check your bank account" reminders for organizers.
//
// Organizers can't watch their bank app all day. When transfer reservations
// are waiting for money, the platform emails the organizer a digest at up to
// three configurable moments ("first / second / third timer", in days after a
// reservation was made). Each awaiting order tracks how many reminders it has
// triggered (orders.reminder_stage), so a reservation never nags twice for
// the same stage, and confirmed/expired orders naturally drop out.
//
// The sweep runs from a background interval (see src/instrumentation.ts) and
// lazily whenever the portal dashboard loads.
import { getDb } from './db';
import { sendBuyerPaymentReminderEmail, sendTransferReminderEmail, type ReminderOrderSummary } from './email';

/**
 * Days after reserving before a buyer whose transfer hasn't been confirmed
 * gets ONE friendly reminder. Deliberately shorter than the shortest sensible
 * pay-within window so it lands while there is still time to act.
 */
const BUYER_REMINDER_DAYS = 4;

/** Parse '2,4,6' -> [2,4,6]; ascending, deduped, 1..30 days, max 3 timers. */
export function parseReminderDays(raw: string | null | undefined): number[] {
  const days = (raw || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 30);
  return [...new Set(days)].sort((a, b) => a - b).slice(0, 3);
}

/**
 * Recommended timers: bank transfers usually land in 1-2 business days, so
 * check at day 2, mid-window, and right after the pay-within deadline.
 */
export function recommendedReminderDays(payWithinDays: number): number[] {
  const deadline = Math.min(Math.max(payWithinDays, 2), 30);
  const mid = Math.max(2, Math.round(deadline * 0.75));
  return [...new Set([2, mid, Math.min(deadline + 1, 30)])].sort((a, b) => a - b).slice(0, 3);
}

export function getReminderSettings(organizerId: string): { enabled: boolean; days: number[] } {
  const row = getDb()
    .prepare(`SELECT reminder_days AS days, reminders_enabled AS enabled FROM organizers WHERE id = ?`)
    .get(organizerId) as { days: string; enabled: number } | undefined;
  if (!row) return { enabled: false, days: [] };
  return { enabled: Boolean(row.enabled), days: parseReminderDays(row.days) };
}

export function setReminderSettings(organizerId: string, enabled: boolean, days: number[]): void {
  const clean = parseReminderDays(days.join(','));
  getDb()
    .prepare(`UPDATE organizers SET reminders_enabled = ?, reminder_days = ? WHERE id = ?`)
    .run(enabled ? 1 : 0, clean.join(','), organizerId);
}

interface AwaitingRow {
  orderId: string;
  organizerId: string;
  organizerEmail: string;
  organizerName: string;
  reminderDays: string;
  remindersEnabled: number;
  eventName: string;
  buyerName: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  reminderStage: number;
}

const SWEEP_MIN_INTERVAL_MS = 10 * 60_000;
let lastSweepAt = 0;
let sweeping = false;

declare global {
  // eslint-disable-next-line no-var
  var __reminderInterval: ReturnType<typeof setInterval> | undefined;
}

/**
 * Arm the recurring sweep once per server process. Called from the first
 * sweep (the portal dashboard and buyer traffic both trigger sweeps), so any
 * activity keeps reminders flowing on a long-running server without needing
 * an instrumentation hook (which would drag SQLite into the Edge bundle).
 */
function ensureReminderInterval(): void {
  if (global.__reminderInterval) return;
  global.__reminderInterval = setInterval(() => {
    runTransferReminderSweep().catch((e) => console.error('Reminder sweep failed:', e));
  }, 15 * 60_000);
  // Never keep the process alive just for reminders.
  if (typeof global.__reminderInterval.unref === 'function') global.__reminderInterval.unref();
}

/**
 * Send due reminder digests. One email per organizer per sweep, covering ALL
 * their awaiting transfers, sent only when at least one order crossed its
 * next timer. Safe to call often (self-throttles) and idempotent per stage.
 */
export async function runTransferReminderSweep(force = false): Promise<{ emailed: number }> {
  ensureReminderInterval();
  const now = Date.now();
  if (sweeping || (!force && now - lastSweepAt < SWEEP_MIN_INTERVAL_MS)) return { emailed: 0 };
  sweeping = true;
  lastSweepAt = now;
  try {
    const rows = getDb()
      .prepare(
        `SELECT o.id AS orderId, org.id AS organizerId, org.email AS organizerEmail,
                org.name AS organizerName, org.reminder_days AS reminderDays,
                org.reminders_enabled AS remindersEnabled,
                e.name AS eventName, o.buyer_name AS buyerName, o.total_cents AS totalCents,
                o.currency, o.created_at AS createdAt, o.reminder_stage AS reminderStage
         FROM orders o
         JOIN events e ON e.id = o.event_id
         JOIN organizers org ON org.id = e.organizer_id
         WHERE o.status = 'claimed' AND o.payment_mode = 'transfer'
           AND org.status = 'active' AND org.reminders_enabled = 1`
      )
      .all() as AwaitingRow[];

    // Group by organizer; find orders whose age crossed their next timer.
    const byOrganizer = new Map<string, { rows: AwaitingRow[]; due: AwaitingRow[] }>();
    for (const row of rows) {
      const days = parseReminderDays(row.reminderDays);
      if (days.length === 0) continue;
      let entry = byOrganizer.get(row.organizerId);
      if (!entry) {
        entry = { rows: [], due: [] };
        byOrganizer.set(row.organizerId, entry);
      }
      entry.rows.push(row);
      const ageDays = (Date.now() - Date.parse(row.createdAt.replace(' ', 'T') + 'Z')) / 86_400_000;
      if (row.reminderStage < days.length && ageDays >= days[row.reminderStage]) {
        entry.due.push(row);
      }
    }

    let emailed = 0;
    for (const [, entry] of byOrganizer) {
      if (entry.due.length === 0) continue;
      const first = entry.rows[0];
      const summaries: ReminderOrderSummary[] = entry.rows.map((r) => ({
        orderId: r.orderId,
        eventName: r.eventName,
        buyerName: r.buyerName,
        totalCents: r.totalCents,
        currency: r.currency,
        createdAt: r.createdAt,
      }));
      const result = await sendTransferReminderEmail(
        { email: first.organizerEmail, name: first.organizerName },
        summaries
      );
      if (result.sent) {
        emailed++;
        const bump = getDb().prepare(`UPDATE orders SET reminder_stage = reminder_stage + 1 WHERE id = ?`);
        for (const dueRow of entry.due) bump.run(dueRow.orderId);
      }
    }
    emailed += await sweepBuyerReminders();
    return { emailed };
  } catch (e) {
    console.error('Transfer reminder sweep failed:', e);
    return { emailed: 0 };
  } finally {
    sweeping = false;
  }
}

/**
 * One friendly nudge per buyer whose bank transfer still isn't confirmed after
 * BUYER_REMINDER_DAYS. The email reassures anyone who has already paid that
 * nothing is wrong, and repeats the amount, IBAN and reference for anyone who
 * hasn't. Stamped in buyer_reminder_sent_at so it can never send twice, and it
 * naturally stops once the organizer confirms the payment or the reservation
 * expires (both leave the 'claimed' state).
 *
 * Orders whose buyer details were erased after the event (lib/retention.ts) are
 * skipped: there is no longer an address to write to, and a long-past event has
 * nothing left to remind anyone about.
 */
async function sweepBuyerReminders(): Promise<number> {
  const db = getDb();
  const due = db
    .prepare(
      `SELECT o.id AS orderId
       FROM orders o
       JOIN events e ON e.id = o.event_id
       WHERE o.status = 'claimed'
         AND o.payment_mode = 'transfer'
         AND o.buyer_reminder_sent_at IS NULL
         AND o.buyer_erased_at IS NULL
         AND o.created_at < datetime('now', ?)
       ORDER BY o.created_at ASC
       LIMIT 100`
    )
    .all(`-${BUYER_REMINDER_DAYS} days`) as { orderId: string }[];

  let sent = 0;
  const stamp = db.prepare(`UPDATE orders SET buyer_reminder_sent_at = datetime('now') WHERE id = ?`);
  for (const row of due) {
    const result = await sendBuyerPaymentReminderEmail(row.orderId);
    // Stamp ONLY on a genuine send, exactly as the organizer digest above bumps
    // reminder_stage only when result.sent is true. buyer_reminder_sent_at means
    // "this buyer has been reminded", and it is the record of a mail that
    // exists — never of one that was attempted. Stamping on any other outcome
    // spent the whole awaiting book's single reminder the moment mail was off
    // ('email-not-configured') or an organizer was mid-IBAN-edit
    // ('transfer-not-configured'), neither of which is permanent.
    if (result.sent) {
      stamp.run(row.orderId);
      sent++;
    } else {
      // No new state needed to stop an unsendable order looping: the query
      // above already excludes erased buyers (buyer_erased_at IS NULL), and any
      // other permanent case leaves the 'claimed' + 'transfer' window on its
      // own — expireOverdueTransferReservations() cancels a reservation
      // pay_within_days + 2 after it was made, which drops it out of `due`.
      console.error(`Buyer payment reminder for order ${row.orderId} not sent: ${result.reason ?? 'unknown'}`);
    }
  }
  return sent;
}
