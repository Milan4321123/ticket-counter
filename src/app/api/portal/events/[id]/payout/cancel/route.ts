import { NextResponse } from 'next/server';
import { cancelQueuedPayoutChange, markPayoutChangesCancelled, queuedPayoutChange } from '@/lib/payout';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../../auth';

export const dynamic = 'force-dynamic';

/**
 * Throw away a payout change that is still waiting.
 *
 * Deliberately NOT behind the step-up check that queuing one requires. Cancelling
 * only ever restores the account that is already in use, so the worst a stranger
 * can do with it is leave everything exactly as the organizer had it. Guarding it
 * would protect nothing and would stand in the way of the one person the waiting
 * period exists for: the owner who has just read the alarm, is not near their
 * authenticator, and has minutes to stop money moving.
 *
 * That asymmetry is the point — hard to move, easy to put back.
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

    if (!queuedPayoutChange(event)) {
      return NextResponse.json(
        { error: 'There is no pending payment change to cancel.' } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    // The record keeps the cancelled entry rather than deleting it: that an
    // attempt was made and stopped is exactly what somebody will want to see
    // later.
    markPayoutChangesCancelled(event.id);
    cancelQueuedPayoutChange(event.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`POST /api/portal/events/${id}/payout/cancel failed:`, e);
    return NextResponse.json(
      { error: 'Could not cancel that change. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
