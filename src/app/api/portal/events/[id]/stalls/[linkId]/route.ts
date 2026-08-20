import { NextResponse } from 'next/server';
import { sendStallDecisionEmail, sendStallRevokedEmail } from '@/lib/email';
import { getEventById, type EventRow } from '@/lib/events';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { getOrganizer } from '@/lib/organizers';
import { rateLimit } from '@/lib/ratelimit';
import { approveStallLink, declineStallLink, getStallLink, revokeStallLink } from '@/lib/stalls';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../../auth';

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
 * The HOST side of one stall link: { action: 'approve' | 'decline' | 'revoke' }.
 * [id] is the host event; the link must belong to it. The state machine in
 * lib/stalls.ts decides which transitions are legal — this route only names
 * the actor and reports the outcome.
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

    // The getEventQuestion pattern: the link id must belong to THIS event, so
    // a link id alone can never reach across tenants. A foreign id 404s
    // exactly like a missing one.
    const link = getStallLink(linkId);
    if (!link || link.hostEventId !== event.id) {
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

    const action = body.action;
    need(
      action === 'approve' || action === 'decline' || action === 'revoke',
      'That is not something you can do with a stall request.'
    );

    let done: boolean;
    if (action === 'approve') done = approveStallLink(organizerId, link.id);
    else if (action === 'decline') done = declineStallLink(organizerId, link.id);
    else done = revokeStallLink(organizerId, link.id);

    if (!done) {
      // The row exists but the transition was illegal — most likely a stale
      // panel (someone else already decided, or the shop withdrew meanwhile).
      return NextResponse.json(
        {
          error:
            action === 'revoke'
              ? 'That stall is not currently approved.'
              : 'That request is no longer waiting for a decision.',
        } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    // Tell the shop owner what was decided — unless they ARE the host (one
    // account running both sides gets no mail to itself). Awaited but
    // fail-soft: the decision is already committed, and their portal shows it.
    const shop = getEventById(link.shopEventId);
    const shopOrganizer =
      shop && shop.organizerId !== organizerId ? getOrganizer(shop.organizerId) : null;
    if (shop && shopOrganizer) {
      const contact = { name: shopOrganizer.name, email: shopOrganizer.email };
      if (action === 'revoke') await sendStallRevokedEmail(contact, event, shop);
      else await sendStallDecisionEmail(contact, event, shop, action === 'approve' ? 'approved' : 'declined');
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
    }
    console.error(`PATCH /api/portal/events/${id}/stalls/${linkId} failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
