import { NextResponse } from 'next/server';
import { sendStallRequestEmail } from '@/lib/email';
import { getEventById, type EventRow } from '@/lib/events';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { getOrganizer } from '@/lib/organizers';
import { rateLimit } from '@/lib/ratelimit';
import { requestStallLink, StallActionError } from '@/lib/stalls';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../auth';

const MAX_MESSAGE = 500;

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
 * The SHOP owner asks a host event for a stall: { hostEventId, message? }.
 * [id] is the shop. All rules — kinds, published-both-sides, upcoming date,
 * re-request etiquette, same-owner auto-approve — live in requestStallLink,
 * never here, so the state machine has exactly one home.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const guarded = await guardedEvent(id);
    if (guarded.failure) return guarded.failure;
    const { event, organizerId } = guarded;

    // Asking a host is emailing a stranger (PR 2 wires the mail) — cap it like
    // the other outbound-adjacent portal POSTs.
    if (!rateLimit(`stall-request:${organizerId}`, 10, 60 * 60_000)) {
      return NextResponse.json(
        { error: 'You have sent a lot of requests just now — please wait a while.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await readJsonLimited(req, 64 * 1024);
      need(Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed), 'Nothing to send.');
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError || e instanceof ValidationError) throw e;
      throw new ValidationError('Nothing to send.');
    }

    need(typeof body.hostEventId === 'string' && body.hostEventId.length > 0, 'Which event is this for?');
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    need(message.length <= MAX_MESSAGE, `The message can be at most ${MAX_MESSAGE} characters.`);

    const link = requestStallLink(organizerId, event.id, body.hostEventId, message);

    // Tell the host someone is asking — unless the request auto-approved
    // because one account runs both sides, where the mail would be the
    // organizer writing to themselves. Awaited but fail-soft: the row is
    // already written, and the host also sees it in their portal.
    if (link.status === 'requested') {
      const host = getEventById(link.hostEventId);
      const hostOrganizer = host ? getOrganizer(host.organizerId) : null;
      if (host && hostOrganizer) {
        await sendStallRequestEmail(
          { name: hostOrganizer.name, email: hostOrganizer.email },
          host,
          event,
          message
        );
      }
    }
    return NextResponse.json({ ok: true, link });
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
    }
    // The state machine's own refusals read exactly like validation to the UI.
    if (e instanceof ValidationError || e instanceof StallActionError) {
      return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
    }
    console.error(`POST /api/portal/events/${id}/stall-requests failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
