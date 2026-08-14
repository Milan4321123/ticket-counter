import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { sendTicketEmail } from '@/lib/email';
import { SoldOutError } from '@/lib/inventory';
import { markTransferOrderPaid, paymentReference } from '@/lib/orders';
import type { ApiErrorResponse } from '@/lib/types';

/**
 * Admin confirmed a bank transfer arrived: finalize the order, mint tickets,
 * email them to the buyer.
 *
 * Safety: the request must include the LAST 4 CHARACTERS of the order's
 * payment reference, typed by the admin from the bank statement. A blind or
 * accidental click can never mark an order paid.
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
