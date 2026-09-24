import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getEventTiers } from '@/lib/events';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { normaliseSeatMap, sectionSeats, syncSeatedCaps, takenSeats } from '@/lib/seats';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../auth';

export const dynamic = 'force-dynamic';

function bad(error: string, status = 400) {
  return NextResponse.json({ error } satisfies ApiErrorResponse, { status });
}

/**
 * Save an event's seat map (lib/seats). Refuses a map that would delete a
 * seat somebody already holds, and a section sold as a bundled type (a "Table
 * of 8" is a booking, not a seat).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireOrganizerApi();
  if (auth.failure) return auth.failure;
  const blocked = planGate(auth.organizer);
  if (blocked) return blocked;
  const owned = requireOwnedEvent(auth.organizer, id);
  if (owned.failure) return owned.failure;
  const event = owned.event;
  if (event.kind !== 'event') return bad('Seating is for events.');

  let body: { map?: unknown };
  try {
    body = ((await readJsonLimited(req)) ?? {}) as typeof body;
  } catch (e) {
    return bad(e instanceof BodyTooLargeError ? 'That request was too large.' : 'Nothing to save.', e instanceof BodyTooLargeError ? 413 : 400);
  }

  const tiers = getEventTiers(event.id);
  const map = normaliseSeatMap(body.map, tiers.filter((t) => t.seatsPerUnit === 1).map((t) => t.tierKey));
  if (!map) return bad('Add at least one section with rows, seats and a ticket type.');

  const onMap = new Set(map.sections.flatMap((s) => sectionSeats(s).map((x) => x.id)));
  const lost = [...takenSeats(event.id).keys()].filter((seat) => !onMap.has(seat));
  if (lost.length > 0) {
    return bad(
      `${lost.length} seat${lost.length === 1 ? ' is' : 's are'} already booked but would disappear with this layout (${lost
        .slice(0, 4)
        .join(', ')}${lost.length > 4 ? '…' : ''}). Keep those seats in the map.`
    );
  }

  const db = getDb();
  db.transaction(() => {
    db.prepare(`UPDATE events SET seat_map = ? WHERE id = ?`).run(JSON.stringify(map), event.id);
    syncSeatedCaps(event.id, map, tiers);
  })();
  return NextResponse.json({ ok: true });
}
