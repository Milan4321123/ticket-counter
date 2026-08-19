// Server-only: the platform owner releasing more tickets for someone else's
// event.
//
// Two numbers decide whether a ticket can be sold, and the LOWER one wins:
// events.total_capacity caps the whole event, and each event_tiers.cap caps one
// ticket type. Raising only one of them looks like it did nothing — the event
// stays sold out — which is exactly the trap this module exists to close: it
// always writes both, in one transaction, from one screen.
//
// Every change is recorded. An admin editing an organizer's inventory is
// someone reaching into another business's stock, and "who released those 60
// tickets and when" has to be answerable afterwards.
import { getDb } from './db';
import { getEventById, getEventTiers } from './events';
import { getAvailability } from './inventory';

/** One admin capacity change, as stored in the log. */
export interface CapacityChange {
  /** UTC 'YYYY-MM-DD HH:MM:SS', from SQLite. */
  at: string;
  totalFrom: number;
  totalTo: number;
  /** Only the tiers whose cap actually moved. */
  tiers: { tierKey: string; from: number; to: number }[];
}

/** Refused changes carry a message meant for the admin's screen. */
export class CapacityError extends Error {}

const LOG_KEY = (eventId: string) => `capacity_log:${eventId}`;
/** Enough to answer "what happened here", not so many that the row bloats. */
const MAX_LOG_ENTRIES = 25;

/** This event's capacity history, newest first. Never throws on bad JSON. */
export function readCapacityLog(eventId: string): CapacityChange[] {
  const row = getDb().prepare(`SELECT value FROM kv WHERE key = ?`).get(LOG_KEY(eventId)) as
    | { value: string }
    | undefined;
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? (parsed as CapacityChange[]) : [];
  } catch {
    // A hand-edited or truncated row must not take the admin screen down with
    // it — an unreadable history is a missing history, not an error.
    return [];
  }
}

/**
 * Set an event's total capacity and its ticket-type limits together.
 *
 * Refuses to put any limit BELOW what is already sold: those seats are real
 * orders, some of them paid, and a cap under the sold count would either
 * silently strand buyers or leave the event advertising a number it cannot
 * honour. Lowering to exactly the sold count is allowed — that is how you stop
 * sales without cancelling anything.
 *
 * Returns the change that was written, or null when nothing actually moved.
 */
export function setEventCapacity(
  eventId: string,
  totalCapacity: number,
  tierCaps: Record<string, number>
): CapacityChange | null {
  const event = getEventById(eventId);
  if (!event) throw new CapacityError('That event no longer exists.');

  const tiers = getEventTiers(eventId);
  const availability = getAvailability(eventId);

  if (!Number.isInteger(totalCapacity) || totalCapacity < 0 || totalCapacity > 200000) {
    throw new CapacityError('The total capacity must be a whole number between 0 and 200000.');
  }
  if (totalCapacity < availability.totalSold) {
    throw new CapacityError(
      `This event has already sold ${availability.totalSold} tickets, so the total capacity cannot be set below that.`
    );
  }

  const tierChanges: CapacityChange['tiers'] = [];
  for (const tier of tiers) {
    const next = tierCaps[tier.tierKey];
    if (next === undefined) continue;
    if (!Number.isInteger(next) || next < 0 || next > 200000) {
      throw new CapacityError(`The limit for “${tier.name}” must be a whole number between 0 and 200000.`);
    }
    const sold = availability.tiers[tier.tierKey]?.sold ?? 0;
    if (next < sold) {
      throw new CapacityError(
        `“${tier.name}” has already sold ${sold} tickets, so its limit cannot be set below that.`
      );
    }
    if (next !== tier.cap) tierChanges.push({ tierKey: tier.tierKey, from: tier.cap, to: next });
  }

  if (totalCapacity === event.totalCapacity && tierChanges.length === 0) return null;

  const db = getDb();
  const now = db.prepare(`SELECT datetime('now') AS now`).get() as { now: string };
  const change: CapacityChange = {
    at: now.now,
    totalFrom: event.totalCapacity,
    totalTo: totalCapacity,
    tiers: tierChanges,
  };

  // Both numbers and the record of them move together, or none of them do.
  const tx = db.transaction(() => {
    db.prepare(`UPDATE events SET total_capacity = ? WHERE id = ?`).run(totalCapacity, eventId);
    const upd = db.prepare(`UPDATE event_tiers SET cap = ? WHERE event_id = ? AND tier_key = ?`);
    for (const t of tierChanges) upd.run(t.to, eventId, t.tierKey);

    const log = [change, ...readCapacityLog(eventId)].slice(0, MAX_LOG_ENTRIES);
    db.prepare(
      `INSERT INTO kv (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(LOG_KEY(eventId), JSON.stringify(log));
  });
  tx();

  return change;
}
