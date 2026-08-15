import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { sendTicketEmail } from '@/lib/email';
import { getEventById, getEventTier } from '@/lib/events';
import { formatMoney } from '@/lib/money';
import { getOrderByPaymentReference, getOrderItems, getTicketsForOrder } from '@/lib/orders';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The platform owner's one remaining order action: re-send a buyer's tickets.
 *
 * It is keyed on the PAYMENT REFERENCE, not on a buyer, because the owner no
 * longer has a list of buyers to search — the reference is something the person
 * who wrote to support quoted from their own email or bank statement. Nothing
 * this route returns identifies anybody: the caller learns which event, how
 * many tickets and how much, and the mail goes to the address already stored on
 * the order, which is never sent back to the browser.
 *
 * Send only happens with { confirm: true }; the first call is a look-up so the
 * owner can check they have the right order before an email leaves.
 */

/** Slow down anyone trying to walk the reference space from an admin session. */
const LOOKUP_LIMIT = 20;
const LOOKUP_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
    }
    if (!rateLimit(`support-resend:${clientIp(req)}`, LOOKUP_LIMIT, LOOKUP_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Too many look-ups — please wait a minute.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    let reference = '';
    let confirm = false;
    try {
      const body = (await req.json()) as { reference?: unknown; confirm?: unknown };
      if (typeof body?.reference === 'string') reference = body.reference;
      confirm = body?.confirm === true;
    } catch {
      // handled by the empty-reference check below
    }

    const order = reference.trim() ? getOrderByPaymentReference(reference) : null;
    if (!order) {
      return NextResponse.json(
        {
          error:
            'No order matches that reference. Ask them to copy it exactly as it appears in their confirmation email (it looks like TICKETS-AB12CD34).',
        } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }
    if (order.buyerErasedAt) {
      return NextResponse.json(
        {
          error:
            'This event is long over and the buyer’s details have been erased, so there is no address left to send to.',
        } satisfies ApiErrorResponse,
        { status: 410 }
      );
    }
    if (order.status !== 'paid') {
      return NextResponse.json(
        {
          error:
            'That order has no tickets yet — its payment has not been confirmed. Only the organizer running the event can confirm it, because the money went to their bank account.',
        } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    const event = getEventById(order.eventId);
    const items = getOrderItems(order.id)
      .map((it) => `${it.quantity}× ${getEventTier(order.eventId, it.tierId)?.name ?? it.tierId}`)
      .join(', ');
    // Deliberately no buyer name and no buyer email — enough to recognise the
    // order, nothing that identifies the person who placed it.
    const summary = {
      eventName: event?.name ?? 'Unknown event',
      items,
      ticketCount: getTicketsForOrder(order.id).length,
      total: formatMoney(order.totalCents, order.currency),
      reservedOn: order.createdAt.slice(0, 10),
    };

    if (!confirm) return NextResponse.json({ ok: true, found: true, summary });

    const result = await sendTicketEmail(order.id);
    return NextResponse.json({ ok: true, found: true, summary, sent: result.sent, reason: result.reason ?? null });
  } catch (e) {
    console.error('POST /api/admin/support/resend failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
