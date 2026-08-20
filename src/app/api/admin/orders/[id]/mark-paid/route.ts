import { NextResponse } from 'next/server';
import { sendTicketEmail } from '@/lib/email';
import { getEventById } from '@/lib/events';
import { SoldOutError } from '@/lib/inventory';
import { currentOrganizer } from '@/lib/organizers';
import {
  expectedSenderNames,
  getOrder,
  markTransferOrderPaid,
  paymentReference,
  senderNameMatches,
} from '@/lib/orders';
import { awardReferralVouchers } from '@/lib/referrals';
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

    // Two ways to prove you are looking at the right payment, because there are
    // two ways money actually arrives.
    //
    // A bank transfer carries the reference — the GiroCode fills it in for the
    // buyer — so the last 4 characters read off a statement are a real check.
    // PayPal carries no reference at all: a PayPal.Me link has nowhere to put
    // one, so the money lands as a name and an amount and nothing else. An
    // organizer in that position used to have to copy the reference off THIS
    // page, which checked nothing and taught them the box was a formality.
    //
    // So the sender's name counts too. Neither route is authentication — that
    // was settled by the session and the ownership check above; both are a
    // speed bump so a stray click cannot issue tickets. The point is that the
    // speed bump asks about something the organizer can actually see.
    let confirmation = '';
    try {
      const body = (await req.json()) as { referenceConfirmation?: unknown; senderConfirmation?: unknown };
      if (typeof body?.referenceConfirmation === 'string') confirmation = body.referenceConfirmation;
      else if (typeof body?.senderConfirmation === 'string') confirmation = body.senderConfirmation;
    } catch {
      // handled below
    }

    const order = getOrder(id);
    if (!order) {
      return NextResponse.json({ error: 'We could not find that order.' } satisfies ApiErrorResponse, { status: 404 });
    }

    const expected = paymentReference(id).slice(-4).toUpperCase();
    const byReference = confirmation.trim().toUpperCase() === expected;
    const bySender = senderNameMatches(confirmation, order);
    if (!byReference && !bySender) {
      const names = expectedSenderNames(order);
      return NextResponse.json(
        {
          error:
            'That does not match this order. Type either the last 4 characters of the payment reference, or ' +
            `the name the money came from${names.length ? ` (${names.join(' or ')})` : ''} — whichever your ` +
            'statement shows.',
        } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    const tickets = markTransferOrderPaid(id, byReference ? 'reference' : 'sender');
    // The money has arrived, so a referral that brought this buyer has now
    // genuinely been paid for. Fail-soft inside: whatever happens to a
    // thank-you, the organizer's confirmation must still succeed.
    awardReferralVouchers(id);
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
