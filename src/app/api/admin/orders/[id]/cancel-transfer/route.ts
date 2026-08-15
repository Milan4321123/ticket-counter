import { NextResponse } from 'next/server';
import { getEventById } from '@/lib/events';
import { releaseClaim } from '@/lib/inventory';
import { currentOrganizer } from '@/lib/organizers';
import { getOrder } from '@/lib/orders';
import type { ApiErrorResponse } from '@/lib/types';

/**
 * ONLY the organizer who owns the order's event — the platform owner has no
 * business putting someone else's seats back on sale, and no longer has the
 * buyer list that made this reachable in the first place.
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
 * The organizer cancels an awaiting-transfer reservation (buyer changed their
 * mind / will never pay), releasing its seats. Only transfer orders still in
 * 'claimed' can be cancelled — never anything that may involve PayPal money.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!(await mayManageOrder(id))) {
      return NextResponse.json(
        { error: 'Please sign in first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    const order = getOrder(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' } satisfies ApiErrorResponse, { status: 404 });
    }
    if (order.paymentMode !== 'transfer' || order.status !== 'claimed') {
      return NextResponse.json(
        { error: 'Only bank-transfer reservations that are awaiting payment can be cancelled.' } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    releaseClaim(id, 'cancelled');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`POST /api/admin/orders/${id}/cancel-transfer failed:`, e);
    return NextResponse.json(
      { error: 'Could not cancel the reservation.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
