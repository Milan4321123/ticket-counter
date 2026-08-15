import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { sendTicketEmail } from '@/lib/email';
import { getEventById } from '@/lib/events';
import { currentOrganizer } from '@/lib/organizers';
import { getOrder } from '@/lib/orders';
import type { ApiErrorResponse } from '@/lib/types';

/** Platform admin, or the organizer who owns the order's event. */
async function mayManageOrder(orderId: string): Promise<boolean> {
  if (await isAdminRequest()) return true;
  const organizer = await currentOrganizer();
  if (!organizer) return false;
  const order = getOrder(orderId);
  if (!order) return false;
  const event = getEventById(order.eventId);
  return Boolean(event && event.organizerId === organizer.id);
}

/** Re-send the buyer's ticket email (admin or the owning organizer). */
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
