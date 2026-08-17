import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { sendEventLiveEmail } from '@/lib/email';
import { getEventById, markEventFeePaid } from '@/lib/events';
import { getOrganizer } from '@/lib/organizers';
import { eventFeeReference } from '@/lib/platform';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The platform owner confirms that ONE event's fee arrived on their account,
 * which unlocks publishing for it. Deliberately two-step, exactly like
 * confirming a buyer's transfer: the admin types the LAST 4 characters of the
 * event's Verwendungszweck (EVENT-XXXXXXXX) as read off the bank statement, so
 * a stray click can never unlock an unpaid event.
 *
 * Body: { referenceConfirmation: string }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    if (event.feeStatus === 'paid') {
      return NextResponse.json(
        { error: 'This event’s fee is already marked as paid.' } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    let body: { referenceConfirmation?: unknown } | null = null;
    try {
      body = (await req.json()) as { referenceConfirmation?: unknown };
    } catch {
      // handled by the check below
    }
    const confirmation = typeof body?.referenceConfirmation === 'string' ? body.referenceConfirmation : '';
    const expected = eventFeeReference(event.id).slice(-4).toUpperCase();
    if (confirmation.trim().toUpperCase() !== expected) {
      return NextResponse.json(
        {
          error:
            'The characters you typed do not match this event’s payment reference. Read the last 4 characters of the reference from your bank statement and try again.',
        } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    if (!markEventFeePaid(event.id)) {
      return NextResponse.json(
        { error: 'This event’s fee is already marked as paid.' } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    // Tell the organizer their event can go live now. Never blocks the confirm.
    let emailSent = false;
    let emailReason: string | undefined;
    const organizer = getOrganizer(event.organizerId);
    if (organizer) {
      const mail = await sendEventLiveEmail(
        { name: organizer.name, email: organizer.email },
        { id: event.id, name: event.name }
      );
      emailSent = mail.sent;
      emailReason = mail.reason;
      console.log(`Admin confirmed fee for event ${event.id}; publish-unlocked email:`, mail);
    }

    return NextResponse.json({ ok: true, emailSent, emailReason });
  } catch (e) {
    console.error(`POST /api/admin/events/${id}/fee failed:`, e);
    return NextResponse.json(
      { error: 'Could not confirm the fee. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
