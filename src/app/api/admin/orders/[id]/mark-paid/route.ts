import { NextResponse } from 'next/server';
import { sendTicketEmail } from '@/lib/email';
import { getEventById } from '@/lib/events';
import { SoldOutError } from '@/lib/inventory';
import { currentOrganizer } from '@/lib/organizers';
import { getOrder, markTransferOrderPaid, paymentReference } from '@/lib/orders';
import type { ApiErrorResponse } from '@/lib/types';

/**
 * ONLY the organizer who owns the order's event.
 *
 * The platform owner used to be allowed here too. He isn't any more, and not
 * merely for privacy: the buyer's money lands in the ORGANIZER'S bank account,
 * so the platform owner can never actually see a transfer arrive, and an action
 * whose whole meaning is "I watched this money turn up" belongs to the only
 * person who can watch it.
 */
async function mayManageOrder(orderId: string): Promise<boolean> {
  const organizer = await currentOrganizer();
  if (!organizer) return false;
  const order = getOrder(orderId);
  if (!order) return false;
  const event = getEventById(order.eventId);
  return Boolean(event && event.organizerId === organizer.id);
}

/**
 * The organizer confirmed a bank transfer arrived: finalize the order, mint
 * tickets, email them to the buyer.
 *
 * Safety: the request must include the LAST 4 CHARACTERS of the order's
 * payment reference, typed from the bank statement. A blind or accidental
 * click can never mark an order paid.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!(await mayManageOrder(id))) {
      return NextResponse.json(
        { error: 'Please sign in first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    let confirmation = '';
    try {
      const body = (await req.json()) as { referenceConfirmation?: unknown };
      if (typeof body?.referenceConfirmation === 'string') confirmation = body.referenceConfirmation;
    } catch {
      // handled below
    }
    const expected = paymentReference(id).slice(-4).toUpperCase();
    if (confirmation.trim().toUpperCase() !== expected) {
      return NextResponse.json(
        {
          error:
            'The characters you typed do not match this order’s payment reference. Read the last 4 characters of the reference from your bank statement and try again.',
        } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    const tickets = markTransferOrderPaid(id);
    const email = await sendTicketEmail(id);
    return NextResponse.json({ ok: true, ticketCount: tickets.length, emailSent: email.sent });
  } catch (e) {
    if (e instanceof SoldOutError) {
      return NextResponse.json(
        {
          error:
            'The event sold out while this reservation was expired — the seats are gone. Please refund the buyer.',
        } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }
    console.error(`POST /api/admin/orders/${id}/mark-paid failed:`, e);
    return NextResponse.json(
      { error: 'Could not mark the order as paid. Please refresh and try again.' } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }
}
