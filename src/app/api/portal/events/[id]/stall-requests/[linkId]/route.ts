import { NextResponse } from 'next/server';
import type { EventRow } from '@/lib/events';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';
import { getStallLink, setStallPickupInfo, withdrawStallLink } from '@/lib/stalls';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../../auth';

const MAX_PICKUP_INFO = 300;

/** Friendly validation failure — message goes straight to the UI. */
class ValidationError extends Error {}

function need(cond: boolean, message: string): asserts cond {
  if (!cond) throw new ValidationError(message);
}

/**
 * Same guard chain as every other portal event route: signed-in organizer,
 * active plan, owns the event, event not archived.
 */
async function guardedEvent(
  id: string
): Promise<{ event: EventRow; organizerId: string; failure: null } | { event: null; organizerId: null; failure: NextResponse }> {
  const auth = await requireOrganizerApi();
  if (auth.failure) return { event: null, organizerId: null, failure: auth.failure };
  const { organizer } = auth;

  const blocked = planGate(organizer);
  if (blocked) return { event: null, organizerId: null, failure: blocked };

  const owned = requireOwnedEvent(organizer, id);
  if (owned.failure) return { event: null, organizerId: null, failure: owned.failure };

  need(
    owned.event.status !== 'archived',
    'This listing has been archived by the platform and can no longer be changed.'
  );
  return { event: owned.event, organizerId: organizer.id, failure: null };
}

/**
 * The SHOP side of one stall link: { action: 'withdraw' } pulls out of a
 * pending or approved stall; { stallPickupInfo } edits the per-event
 * collection note. [id] is the shop; the link must belong to it.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const { id, linkId } = await params;
  try {
    const guarded = await guardedEvent(id);
    if (guarded.failure) return guarded.failure;
    const { event, organizerId } = guarded;

    if (!rateLimit(`stall-action:${organizerId}`, 60, 60 * 60_000)) {
      return NextResponse.json(
        { error: 'Too many changes at once — please wait a moment.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    // The getEventQuestion pattern: the link id must belong to THIS shop, so a
    // link id alone can never reach across tenants. A foreign id 404s exactly
    // like a missing one.
    const link = getStallLink(linkId);
    if (!link || link.shopEventId !== event.id) {
      return NextResponse.json(
        { error: 'We could not find that stall request.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await readJsonLimited(req, 64 * 1024);
      need(Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed), 'Nothing to save.');
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError || e instanceof ValidationError) throw e;
      throw new ValidationError('Nothing to save.');
    }

    if (body.action === 'withdraw') {
      const withdrawn = withdrawStallLink(organizerId, link.id);
      if (!withdrawn) {
        return NextResponse.json(
          { error: 'That request has already ended.' } satisfies ApiErrorResponse,
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    need(typeof body.stallPickupInfo === 'string', 'Nothing to save.');
    const text = body.stallPickupInfo.trim();
    need(text.length <= MAX_PICKUP_INFO, `The collection note can be at most ${MAX_PICKUP_INFO} characters.`);

    const saved = setStallPickupInfo(organizerId, link.id, text);
    if (!saved) {
      return NextResponse.json(
        { error: 'We could not find that stall request.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
    }
    console.error(`PATCH /api/portal/events/${id}/stall-requests/${linkId} failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
