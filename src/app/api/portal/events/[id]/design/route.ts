import { NextResponse } from 'next/server';
import { aiDesignerEnabled, generatePageDesign } from '@/lib/ai';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../auth';

// Each generation calls a paid AI service — keep one organizer from burning
// through the budget in a loop.
const GENERATIONS_PER_WINDOW = 10;
const WINDOW_MS = 10 * 60_000;

/**
 * "Generate with AI": turns the organizer's wishes + the event's facts into a
 * constrained page-design spec. The result is returned for REVIEW — the
 * organizer still saves it through the normal event update route.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    const owned = requireOwnedEvent(organizer, id);
    if (owned.failure) return owned.failure;
    const { event } = owned;

    if (!aiDesignerEnabled()) {
      return NextResponse.json(
        { error: 'AI design is not switched on for this server — use the manual picker instead.' } satisfies ApiErrorResponse,
        { status: 503 }
      );
    }

    if (!rateLimit(`portal-design:${organizer.id}`, GENERATIONS_PER_WINDOW, WINDOW_MS)) {
      return NextResponse.json(
        { error: 'That is a lot of designs in a short time — please wait a few minutes and try again.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    let notes = '';
    try {
      const body = (await readJsonLimited(req)) as { notes?: unknown };
      if (typeof body?.notes === 'string') notes = body.notes.trim().slice(0, 2000);
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      // Missing/malformed body is fine — the AI can work from the event facts alone.
    }

    const result = await generatePageDesign({
      eventName: event.name,
      artist: event.artist,
      description: event.description,
      venueName: event.venueName,
      city: event.city,
      dateDisplay: event.dateDisplay || event.eventDate || '',
      organizerNotes: notes,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error } satisfies ApiErrorResponse, { status: 502 });
    }
    return NextResponse.json({ ok: true, design: result.design });
  } catch (e) {
    console.error(`POST /api/portal/events/${id}/design failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
