import { NextResponse } from 'next/server';
import { sendTicketEmail } from '@/lib/email';
import { getEventById } from '@/lib/events';
import { currentOrganizer } from '@/lib/organizers';
import { getOrder } from '@/lib/orders';
import type { ApiErrorResponse } from '@/lib/types';

/**
 * ONLY the organizer who owns the order's event. This route is reached from a
 * row in the organizer's own orders table, so it takes an order id; the
 * platform owner has no such table any more and re-sends through
 * /api/admin/support/resend instead, which is keyed on the payment reference a
 * buyer quotes and shows him nobody's name.
 */
async function mayManageOrder(orderId: string): Promise<boolean> {
  const organizer = await currentOrganizer();
  if (!organizer) return false;
  const order = getOrder(orderId);
  if (!order) return false;
  const event = getEventById(order.eventId);
  return Boolean(event && event.organizerId === organizer.id);
}

/** Re-send the buyer's ticket email (the owning organizer only). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await mayManageOrder(id))) {
      return NextResponse.json(
        { error: 'Please sign in first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    const result = await sendTicketEmail(id);
    return NextResponse.json(result);
  } catch {
    // sendTicketEmail is documented as never throwing, but stay safe anyway.
    return NextResponse.json({ sent: false, reason: 'The email could not be sent. Please try again.' });
  }
}
