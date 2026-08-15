import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listEventsForOrganizer, makeUniqueSlug, newId } from '@/lib/events';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi } from '../auth';

const MAX_EVENTS_PER_ORGANIZER = 50;

/** Create a new draft event for the signed-in organizer. Body: { name }. */
export async function POST(req: Request) {
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    let name = '';
    try {
      const body = (await readJsonLimited(req)) as { name?: unknown };
      if (typeof body?.name === 'string') name = body.name.trim();
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
    }
    if (!name) {
      return NextResponse.json(
        { error: 'Please give your event a name — you can change it any time.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    if (name.length > 120) {
      return NextResponse.json(
        { error: 'The event name can be at most 120 characters.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    if (listEventsForOrganizer(organizer.id).length >= MAX_EVENTS_PER_ORGANIZER) {
      return NextResponse.json(
        {
          error: `You already have ${MAX_EVENTS_PER_ORGANIZER} events. Contact the platform to raise the limit.`,
        } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    const eventId = newId();
    const slug = makeUniqueSlug(name);
    // A fresh draft with sensible defaults; the editor fills in the rest.
    // Sales start open so publishing later "just works" — nothing can be
    // bought before publish anyway, since only published events are public.
    getDb()
      .prepare(
        `INSERT INTO events (id, organizer_id, slug, status, name, currency, total_capacity, sales_open,
           max_per_order, pay_within_days)
         VALUES (?, ?, ?, 'draft', ?, 'EUR', 100, 1, 8, 5)`
      )
      .run(eventId, organizer.id, slug, name);

    return NextResponse.json({ ok: true, eventId });
  } catch (e) {
    console.error('POST /api/portal/events failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
