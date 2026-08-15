import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { getEventById } from '@/lib/events';
import { releaseClaim } from '@/lib/inventory';
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

/**
 * The organizer (or platform admin) cancels an awaiting-transfer reservation
 * (buyer changed their mind / will never pay), releasing its seats. Only
 * transfer orders still in 'claimed' can be cancelled — never anything that
 * may involve PayPal money.
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
