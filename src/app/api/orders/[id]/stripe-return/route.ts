import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import { getOrder } from '@/lib/orders';
import { settleStripeOrder } from '@/lib/stripeOrders';

export const dynamic = 'force-dynamic';

/**
 * Where Stripe sends the buyer after its hosted Checkout page.
 *
 * Nothing in the URL is trusted: the session id is only compared with the one
 * this order was started with, and whether money moved is asked of Stripe
 * directly (lib/stripeOrders) with the seller's own key. Then the buyer lands
 * on their order page, which shows codes if they paid and the way back to the
 * payment page if they did not.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = getBaseUrl();
  const order = getOrder(id);
  if (!order) return NextResponse.redirect(`${base}/`, 303);

  const sessionId = new URL(req.url).searchParams.get('session_id') ?? '';
  if (order.paymentMode === 'stripe' && order.stripeSessionId && sessionId === order.stripeSessionId) {
    try {
      await settleStripeOrder(order.id);
    } catch (e) {
      console.error(`Stripe return for order ${id} failed:`, e);
    }
  }
  return NextResponse.redirect(`${base}/order/${order.id}`, 303);
}
