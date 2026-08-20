// Server-only: the sold-out waitlist — who to tell when space opens up again.
//
// A sold-out page used to be a dead end, and it is the one moment a visitor is
// most willing to leave an address: they wanted in and could not get in. The
// waitlist stores exactly that address, for exactly one job — a single "there
// is space again" email — and the notify sweep below is the machinery that
// keeps the promise. Nothing is reserved for anybody: everyone on the list is
// told at once and the freed spots go to whoever books first, which is also
// what the email says in so many words.
//
// Shaped exactly like the retention sweep (lib/retention.ts): it self-
// throttles, is safe to call as often as you like, is armed lazily from event
// page renders, and swallows its own errors so it can never break a render.
import crypto from 'crypto';
import { getDb } from './db';
import { sendWaitlistSpotsOpenEmail } from './email';
import { getEventById, getEventTiers } from './events';
import { getAvailability } from './inventory';
import { ticketState } from './ticketState';

/**
 * Put one address on one event's waitlist.
 *
 * Lowercased and trimmed BEFORE the write, so "Ana@x.de" and " ana@x.de" are
 * the same person to the UNIQUE(event_id, email) constraint. INSERT OR IGNORE
 * makes a repeat signup a silent no-op — the API deliberately reports both
 * outcomes as the same success, so the response can never be used to test
 * whether an address is already on somebody's list.
 */
export function joinWaitlist(eventId: string, email: string): void {
  getDb()
    .prepare(`INSERT OR IGNORE INTO waitlist (id, event_id, email) VALUES (?, ?, ?)`)
    .run(crypto.randomUUID(), eventId, email.trim().toLowerCase());
}

/** How many addresses one event's waitlist holds — the API's ceiling check. */
export function waitlistCount(eventId: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM waitlist WHERE event_id = ?`)
    .get(eventId) as { n: number };
  return row.n;
}

/**
 * Much shorter than the retention sweep's hour: seats usually free up when the
 * expiry sweep cancels an unpaid reservation, and an email that arrives hours
 * later tells people about spots that are already gone again. A minute keeps
 * the check effectively free on a hot page while staying prompt on a busy one.
 */
const SWEEP_MIN_INTERVAL_MS = 60_000;
/**
 * Bound on one sweep's sends — SMTP is the slow, serial part, and a render-
 * triggered sweep must never hold the event loop for a whole season's list.
 * A large backlog simply finishes on later calls; the notified_at claim below
 * is what makes resuming safe.
 */
const MAX_EMAILS_PER_SWEEP = 100;

let lastSweepAt = 0;
let sweeping = false;

declare global {
  // eslint-disable-next-line no-var
  var __waitlistInterval: ReturnType<typeof setInterval> | undefined;
}

/**
 * Arm the recurring sweep once per server process, from the first sweep — the
 * same trick lib/retention.ts uses. A site with visitors notifies promptly
 * without an instrumentation hook (which would drag SQLite into the Edge
 * bundle); a site with no visitors has nobody racing for the freed seats
 * anyway, so five minutes of interval is plenty.
 */
function ensureWaitlistInterval(): void {
  if (global.__waitlistInterval) return;
  global.__waitlistInterval = setInterval(
    () => {
      runWaitlistNotifySweep().catch((e) => console.error('Waitlist notify sweep failed:', e));
    },
    5 * 60_000
  );
  // Never keep the process alive just for this.
  if (typeof global.__waitlistInterval.unref === 'function') global.__waitlistInterval.unref();
}

/**
 * Email every unnotified waitlist entry of every event that can genuinely be
 * bought again. Self-throttled, bounded, idempotent per entry (notified_at is
 * the claim), and it never throws — the event page calls it on render and must
 * be able to ignore it completely.
 *
 * Pass force to skip the throttle; tests and manual runs want that, renders
 * do not.
 */
export async function runWaitlistNotifySweep(force = false): Promise<{ notified: number }> {
  ensureWaitlistInterval();
  const now = Date.now();
  if (sweeping || (!force && now - lastSweepAt < SWEEP_MIN_INTERVAL_MS)) return { notified: 0 };
  sweeping = true;
  lastSweepAt = now;
  try {
    const db = getDb();
    // Candidates only — published, selling, not past, holding at least one
    // never-notified entry. Availability is deliberately NOT decided in SQL:
    // it is derived (caps minus live orders, sellable tiers only), so each
    // candidate goes through the same getAvailability + ticketState pair the
    // page and the orders API use. Any cheaper answer here could disagree with
    // the button this email sends people to press.
    //
    // Past events are excluded because their seats can never mean anything
    // again; a shop has no date and rightly stays eligible — restocking is the
    // whole way a shop "frees up".
    const candidates = db
      .prepare(
        `SELECT DISTINCT e.id AS id
         FROM waitlist w
         JOIN events e ON e.id = w.event_id
         WHERE w.notified_at IS NULL
           AND e.status = 'published'
           AND e.sales_open = 1
           AND (e.event_date IS NULL OR date(e.event_date) >= date('now'))`
      )
      .all() as { id: string }[];

    const claim = db.prepare(
      `UPDATE waitlist SET notified_at = datetime('now') WHERE id = ? AND notified_at IS NULL`
    );
    // Give the claim back — see the send loop below for why a failed send must
    // not spend this address's one and only email.
    const release = db.prepare(
      `UPDATE waitlist SET notified_at = NULL WHERE id = ?`
    );

    // `attempted` bounds the WORK (sends tried, whatever they returned) while
    // `notified` counts only the mails that truly left. They were one counter
    // when a failure was indistinguishable from a success; separating them is
    // what keeps a run of failures from re-trying the same batch forever.
    let attempted = 0;
    let notified = 0;
    let failed = 0;
    for (const { id } of candidates) {
      if (attempted >= MAX_EMAILS_PER_SWEEP) break;
      const event = getEventById(id);
      if (!event) continue;
      // buyable, not merely "room left": a tier that is hidden, announced or
      // paused is not something the email's button can reach, and telling a
      // waitlist "you can buy now" about an event where nothing can be
      // selected would be this feature lying on its very first promise.
      const state = ticketState(event, getEventTiers(id), getAvailability(id));
      if (!state.buyable) continue;

      const entries = db
        .prepare(
          `SELECT id, email FROM waitlist
           WHERE event_id = ? AND notified_at IS NULL
           ORDER BY created_at ASC
           LIMIT ?`
        )
        .all(id, MAX_EMAILS_PER_SWEEP - attempted) as { id: string; email: string }[];

      for (const entry of entries) {
        // Stamped BEFORE the send, not after. The promise is at most one email
        // EVER, and a crash between send and stamp would break it in the loud
        // direction (a second email); a crash between stamp and send breaks it
        // in the quiet one (no email — the page itself still shows the spots).
        // The quiet failure is the one the promise survives. The WHERE guard
        // also makes an overlapping run skip entries this one already claimed.
        if (claim.run(entry.id).changes !== 1) continue;
        attempted++;
        const result = await sendWaitlistSpotsOpenEmail(entry.email, event);
        if (result.sent) {
          notified++;
          continue;
        }
        // The send RETURNING false is not the crash the ordering above guards
        // against: nothing was delivered, so releasing the claim costs nobody a
        // duplicate and keeps the entry eligible for the next sweep. Without
        // this, one SMTP outage burns every waiting address's single email on
        // nothing — permanently, because the candidate query only ever looks at
        // notified_at IS NULL and retention later deletes the row. Same reasoning
        // and same shape as the announce route's releaseAnnouncementSend().
        release.run(entry.id);
        failed++;
        console.error(
          `Waitlist notify for event ${id} to entry ${entry.id} not sent: ${result.reason ?? 'unknown'}`
        );
      }
    }

    // Only the mails that actually went out are reported as notified — the log
    // is how anyone finds out mail is broken, so it must not count failures.
    if (notified > 0 || failed > 0) {
      console.log(`Waitlist sweep: notified ${notified} address(es), ${failed} failed.`);
    }
    return { notified };
  } catch (e) {
    console.error('Waitlist notify sweep failed:', e);
    return { notified: 0 };
  } finally {
    sweeping = false;
  }
}
