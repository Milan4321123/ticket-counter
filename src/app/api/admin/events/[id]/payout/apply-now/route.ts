import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { getEventById } from '@/lib/events';
import { applyQueuedPayoutNow, queuedChangeKeepsDestination, queuedPayoutChange } from '@/lib/payout';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The platform owner lets a queued payout change take effect now.
 *
 * Only for a change that keeps the same IBAN and PayPal — a misspelled holder
 * name, a wrong BIC. The day of waiting is there to stop money being
 * redirected, and that check stays in force for everything else: a new account
 * waits the full day whoever asks. Confirm with the organizer by phone before
 * pressing this.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json(
        { error: 'Please sign in to the admin area first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    const event = getEventById(id);
    if (!event) {
      return NextResponse.json(
        { error: 'That event no longer exists.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }

    if (!queuedPayoutChange(event)) {
      return NextResponse.json(
        { error: 'There is no pending payment change on this event.' } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }
    if (!queuedChangeKeepsDestination(event)) {
      return NextResponse.json(
        {
          error: 'This change moves the money to a different IBAN or PayPal, so it has to wait the full day.',
        } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    const ordersUpdated = applyQueuedPayoutNow(event.id, event, event.organizerId);
    return NextResponse.json({ ok: true, ordersUpdated });
  } catch (e) {
    console.error(`POST /api/admin/events/${id}/payout/apply-now failed:`, e);
    return NextResponse.json(
      { error: 'Could not apply the change. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
