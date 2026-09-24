import { NextResponse } from 'next/server';
import { getConnectionById, paypalCredentialsFor } from '@/lib/paymentConnections';
import { getOrder, markOrderFailed } from '@/lib/orders';
import { getPaypalOrder } from '@/lib/paypal';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import type { AbandonOrderResponse, ApiErrorResponse } from '@/lib/types';

function apiError(status: number, code: ApiErrorResponse['code'], error: string) {
  return NextResponse.json<ApiErrorResponse>({ error, code }, { status });
}

function done(released: boolean) {
  return NextResponse.json<AbandonOrderResponse>({ ok: true, released });
}

/**
 * "The buyer closed the payment window" — end an order that never started
 * paying, so what it was holding goes back.
 *
 * WHY this route has to exist: a PayPal checkout writes the local order in the
 * button's createOrder callback, BEFORE the buyer sees PayPal at all, and a
 * referral voucher applied at checkout is claimed in that same transaction
 * (it has to be — two checkouts racing for one code must not both win). If
 * the buyer then dismisses the PayPal window, nothing else in the system ever
 * touches that order again: it is 'pending' with a PayPal order id, which the
 * cleanup job refuses to delete and reconciliation leaves alone because PayPal
 * reports no approval. The voucher would sit on it forever, and the person who
 * earned it would be told their code has already been used — for a payment
 * they never made, with no expiry and no way to get it back.
 *
 * Money safety comes first, and the two halves are inseparable: the voucher is
 * only released BY ending the order (markOrderFailed), never on its own,
 * because a live order that kept a discounted total while its voucher went
 * back into circulation is precisely how one voucher comes to pay for two
 * orders. So this refuses to act on anything that could still take money:
 *
 *   - only 'pending' orders — a claimed/capturing/paid one is mid-payment or
 *     done, and a transfer reservation is a promise the organizer is waiting
 *     on;
 *   - and, for a PayPal order, only once PayPal itself says the buyer never
 *     approved it. Anything approved, completed, or simply unanswerable is
 *     left exactly as it was for reconciliation to resolve.
 *
 * No authentication, like the capture route beside it: the order id is a
 * random UUID, and the worst anyone holding one can do is cancel a payment
 * that had not started. The buyer's own retry writes a fresh order.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // A cheap write behind an unauthenticated id: the same per-IP ceiling the
    // rest of the order routes use, so a script cannot grind it.
    if (!rateLimit(`orders:abandon:${clientIp(req)}`, 30, 60_000)) {
      return apiError(429, 'INTERNAL', 'Too many requests — please wait a minute and try again.');
    }

    const order = getOrder(id);
    // Nothing to do, and nothing to say about whether that order exists.
    if (!order || order.status !== 'pending' || order.paymentMode === 'transfer') {
      return done(false);
    }

    if (order.paypalOrderId) {
      // Asked with the seller's own credentials this order was started with.
      const conn = order.paymentConnectionId ? getConnectionById(order.paymentConnectionId) : null;
      const creds = conn ? paypalCredentialsFor(conn) : null;
      if (!creds) return done(false);
      let paypalOrder;
      try {
        paypalOrder = await getPaypalOrder(creds, order.paypalOrderId);
      } catch (e) {
        // Cannot tell whether money is moving — the one answer that is never
        // safe to guess. Reconciliation will pick it up.
        console.error(`Abandon: could not ask PayPal about order ${id}:`, e);
        return done(false);
      }
      if (paypalOrder.status !== 'CREATED' && paypalOrder.status !== 'PAYER_ACTION_REQUIRED') {
        // APPROVED / COMPLETED / anything unfamiliar: a capture may exist or
        // may still land. Leave it alone.
        return done(false);
      }
    }

    // Ends the order and, with it, hands back any code and any discount it was
    // holding (see markOrderFailed -> releaseDiscountCodeForOrder).
    markOrderFailed(id, 'cancelled');
    return done(true);
  } catch (e) {
    console.error(`POST /api/orders/${id}/abandon failed:`, e);
    return apiError(500, 'INTERNAL', 'We could not cancel that order just now.');
  }
}
