import { NextResponse } from 'next/server';
import { getPaymentMode } from '@/lib/config';
import { getEventBySlug, getEventTiers, getPrimaryEvent, type EventRow } from '@/lib/events';
import { getAvailabilityCached } from '@/lib/inventory';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Browser-safe slice of one event (no bank details, no organizer info). */
function publicEventConfig(event: EventRow) {
  return {
    eventId: event.id,
    slug: event.slug,
    eventName: event.name,
    artist: event.artist,
    description: event.description,
    dateDisplay: event.dateDisplay,
    venue: [event.venueName, event.city].filter(Boolean).join(', '),
    currency: event.currency,
    salesOpen: event.salesOpen,
    maxTicketsPerOrder: event.maxPerOrder,
    tiers: getEventTiers(event.id).map((t) => ({
      id: t.tierKey,
      name: t.name,
      priceCents: t.priceCents,
      studentOnly: t.studentOnly,
      description: t.description,
    })),
  };
}

/**
 * Public config + live availability for one event: ?event=<slug>. Without the
 * parameter it falls back to the primary (oldest) event so legacy single-event
 * pages keep working.
 */
export async function GET(req: Request) {
  try {
    const slug = new URL(req.url).searchParams.get('event');
    const event = slug ? getEventBySlug(slug) : getPrimaryEvent();
    // Only published events are ever exposed — including via the no-slug
    // legacy fallback (a draft/archived primary event must stay private).
    if (!event || event.status !== 'published') {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'We could not find that event — it may no longer be available.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      config: publicEventConfig(event),
      availability: getAvailabilityCached(event.id),
      mode: getPaymentMode(),
      // The platform holds no PayPal credentials any more — each seller's own
      // app is offered on the checkout page for their own listing only.
      paypalClientId: null,
    });
  } catch (e) {
    console.error('GET /api/config failed:', e);
    return NextResponse.json<ApiErrorResponse>(
      { error: 'Something went wrong loading the event details. Please refresh and try again.', code: 'INTERNAL' },
      { status: 500 }
    );
  }
}
