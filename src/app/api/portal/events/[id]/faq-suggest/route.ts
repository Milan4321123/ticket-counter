import { NextResponse } from 'next/server';
import { takeAiQuota } from '@/lib/aiQuota';
import { aiAssistantEnabled, suggestEventFaqs } from '@/lib/ai';
import { getEventFaqs, getEventTiers } from '@/lib/events';
import { formatMoney } from '@/lib/money';
import { rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../auth';

// Every run costs real money or free-tier quota, so one organizer cannot sit
// on the button. The global bucket is the backstop for a whole platform's
// worth of organizers pressing it at once.
const SUGGESTIONS_PER_WINDOW = 6;
const WINDOW_MS = 10 * 60_000;
const GLOBAL_PER_WINDOW = 60;

/**
 * "Suggest FAQ answers": drafts question/answer pairs from the event's own
 * details plus the organizer's notes for the assistant. The suggestions are
 * only RETURNED — the organizer reviews and edits them, and nothing reaches
 * the FAQ until they save it through the normal FAQ route.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // An archived event cannot be edited, so there is nothing to spend the
    // quota on here either.
    if (event.status === 'archived') {
      return NextResponse.json(
        {
          error: 'This event has been archived by the platform and can no longer be changed.',
        } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    if (!aiAssistantEnabled()) {
      return NextResponse.json(
        {
          error: 'The AI assistant is not switched on for this server — write your FAQ entries by hand instead.',
        } satisfies ApiErrorResponse,
        { status: 503 }
      );
    }

    if (!rateLimit(`portal-faq-suggest:${organizer.id}`, SUGGESTIONS_PER_WINDOW, WINDOW_MS)) {
      return NextResponse.json(
        {
          error: 'That is a lot of suggestions in a short time — please wait a few minutes and try again.',
        } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }
    if (!rateLimit('portal-faq-suggest:all', GLOBAL_PER_WINDOW, WINDOW_MS)) {
      return NextResponse.json(
        { error: 'The AI is very busy right now — please try again in a few minutes.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    if (!takeAiQuota([{ key: `faq:org:${organizer.id}`, perDay: 20 }, { key: 'faq:all', perDay: 500 }])) {
      return NextResponse.json(
        { error: 'That is the limit of AI suggestions for today — write your FAQ below, or try again tomorrow.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    const result = await suggestEventFaqs({
      eventName: event.name,
      artist: event.artist,
      description: event.description,
      dateDisplay: event.dateDisplay || event.eventDate || '',
      venueName: event.venueName,
      address: event.address,
      city: event.city,
      payWithinDays: event.payWithinDays,
      tiers: getEventTiers(event.id).map((t) => ({
        name: t.name,
        priceDisplay: formatMoney(t.priceCents, event.currency),
        studentOnly: t.studentOnly,
        description: t.description,
      })),
      organizerNotes: event.assistantContext,
      existingQuestions: getEventFaqs(event.id).map((f) => f.question),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error } satisfies ApiErrorResponse, { status: 502 });
    }
    return NextResponse.json({ ok: true, faqs: result.faqs });
  } catch (e) {
    console.error(`POST /api/portal/events/${id}/faq-suggest failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
