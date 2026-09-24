import { NextResponse } from 'next/server';
import { getPaymentMode } from '@/lib/config';
import { getEventById } from '@/lib/events';
import { beginCapture, claimInventory, releaseClaim, SoldOutError } from '@/lib/inventory';
import { finalizePaidOrder, getOrder, getTicketsForOrder, markOrderFailed } from '@/lib/orders';
import {
  capturePaypalOrder,
  extractCaptureDetails,
  getPaypalOrder,
  InstrumentDeclinedError,
  type PaypalCaptureResponse,
} from '@/lib/paypal';
import { reconcileStuckOrder } from '@/lib/reconcile';
import { getConnectionById, paypalCredentialsFor } from '@/lib/paymentConnections';
import { settleStripeOrder } from '@/lib/stripeOrders';
import { awardReferralVouchers } from '@/lib/referrals';
import { sendTicketEmail } from '@/lib/email';
import type { ApiErrorResponse, CaptureOrderResponse } from '@/lib/types';

function apiError(status: number, code: ApiErrorResponse['code'], error: string) {
  return NextResponse.json<ApiErrorResponse>({ error, code }, { status });
}

function paidResponse(orderId: string): NextResponse {
  const response: CaptureOrderResponse = {
    orderId,
    status: 'paid',
    ticketCodes: getTicketsForOrder(orderId).map((t) => t.code),
  };
  return NextResponse.json(response);
}

const UNCLEAR_PAYMENT_MSG =
  'We could not confirm your payment status. If you completed the payment, your tickets will appear ' +
  'on your order page shortly — keep this page open and refresh in a minute, or contact the organizer.';

async function finalizeAndRespond(orderId: string, captureId: string): Promise<NextResponse> {
  const tickets = finalizePaidOrder(orderId, captureId);

  // The money is in and the codes are minted — so if this order came through
  // somebody's share link, that referrer may just have earned their reward.
  // Fail-soft inside: a voucher problem must never turn a completed payment
  // into an error the buyer sees.
  awardReferralVouchers(orderId);

  // Email is best-effort; the buyer always sees tickets on the site.
  try {
    const emailResult = await sendTicketEmail(orderId);
    console.log(`Ticket email for order ${orderId}:`, emailResult);
  } catch (e) {
    // Contractually sendTicketEmail never throws, but a paid order must
    // never turn into an error response at this point.
    console.error(`Ticket email for order ${orderId} threw unexpectedly:`, e);
  }

  const response: CaptureOrderResponse = {
    orderId,
    status: 'paid',
    ticketCodes: tickets.map((t) => t.code),
  };
  return NextResponse.json(response);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    let order = getOrder(id);
    if (!order) {
      return apiError(404, 'NOT_FOUND', 'We could not find that order.');
    }

    // Bank-transfer orders are never captured here — they are confirmed by the
    // organizer once the money arrives. This route only handles PayPal/mock.
    // (Without this guard a stray POST would claim/mint against a transfer
    // reservation and could resell or destroy the buyer's held seats.)
    if (order.paymentMode === 'transfer') {
      if (order.status === 'paid') return paidResponse(id);
      return apiError(
        409,
        'PAYMENT_FAILED',
        'This order is paid by bank transfer — the organizer confirms it once your transfer arrives.'
      );
    }

    // Idempotent: capturing an already-paid order just returns its tickets.
    if (order.status === 'paid') {
      return paidResponse(id);
    }

    // A Stripe order is settled by ASKING Stripe, not by capturing: the buyer
    // paid (or did not) on Stripe's own page. lib/stripeOrders owns the rules.
    if (order.paymentMode === 'stripe') {
      const outcome = await settleStripeOrder(id);
      switch (outcome) {
        case 'paid':
          return paidResponse(id);
        case 'unpaid':
          return apiError(
            402,
            'PAYMENT_FAILED',
            'Your card payment has not been completed yet — finish it on the payment page, or start a new order. You have not been charged.'
          );
        case 'expired':
          return apiError(
            402,
            'PAYMENT_FAILED',
            'The payment page expired and you have not been charged — please start a new order.'
          );
        default:
          return apiError(500, 'PAYMENT_FAILED', UNCLEAR_PAYMENT_MSG);
      }
    }

    // Another request owns the capture — or a previous attempt crashed. For a
    // stale hold (>10 min), resolve it against PayPal right now so the buyer
    // isn't stuck; for a fresh one, just ask them to wait.
    if (order.status === 'capturing') {
      const ageMs = Date.now() - Date.parse(order.createdAt.replace(' ', 'T') + 'Z');
      if (Number.isFinite(ageMs) && ageMs > 10 * 60 * 1000) {
        await reconcileStuckOrder(order);
        order = getOrder(id)!;
        if (order.status === 'paid') return paidResponse(id);
        if (order.status === 'failed' || order.status === 'cancelled') {
          return apiError(402, 'PAYMENT_FAILED', 'The payment did not complete and you have not been charged — please start a new order.');
        }
      }
      return apiError(409, 'PAYMENT_FAILED', 'Your payment is still being processed — refresh this page in a minute.');
    }

    if (order.status !== 'pending' && order.status !== 'claimed') {
      return apiError(409, 'PAYMENT_FAILED', 'This order can no longer be completed — please start a new order.');
    }

    // Atomically reserve the seats BEFORE money moves.
    try {
      claimInventory(id);
    } catch (e) {
      if (e instanceof SoldOutError) {
        markOrderFailed(id, 'cancelled');
        return apiError(409, 'SOLD_OUT', 'Sold out before your payment completed — you have NOT been charged.');
      }
      throw e;
    }

    // Exactly one request may run the capture; everyone else backs off without
    // touching the owner's claim.
    if (!beginCapture(id)) {
      return apiError(409, 'PAYMENT_FAILED', 'Your payment is already being processed — refresh this page in a minute.');
    }

    if (order.paymentMode === 'mock') {
      // Mock orders must never finalize once real payments are switched on —
      // except on a try-it-yourself demo listing (lib/demo.ts), whose ONLY
      // route is the simulated payment and which cannot take real money.
      const listing = getEventById(order.eventId);
      if (getPaymentMode() !== 'mock' && !listing?.isDemo) {
        releaseClaim(id, 'cancelled');
        return apiError(409, 'PAYMENT_FAILED', 'Test-mode orders can no longer be completed — please start a new order.');
      }
      return await finalizeAndRespond(id, 'MOCK-' + order.id.slice(0, 8));
    }

    if (!order.paypalOrderId) {
      console.error(`Order ${id} is a PayPal order but has no PayPal order id`);
      releaseClaim(id, 'failed');
      return apiError(500, 'PAYMENT_FAILED', 'Payment could not be started — please start a new order. You have not been charged.');
    }

    // The SELLER'S credentials this order was started with. Without them we
    // cannot ask PayPal anything — and the buyer may already have approved, so
    // the seats stay held ('capturing') for a human rather than being released
    // on a guess.
    const conn = order.paymentConnectionId ? getConnectionById(order.paymentConnectionId) : null;
    const creds = conn ? paypalCredentialsFor(conn) : null;
    if (!creds) {
      console.error(`Order ${id}: PayPal connection ${order.paymentConnectionId} is gone; holding`);
      return apiError(500, 'PAYMENT_FAILED', UNCLEAR_PAYMENT_MSG);
    }

    let captureResponse: PaypalCaptureResponse;
    try {
      captureResponse = await capturePaypalOrder(creds, order.paypalOrderId);
    } catch (e) {
      if (e instanceof InstrumentDeclinedError) {
        // Retryable: put the order back to pending so the buyer can try another method.
        releaseClaim(id, 'pending');
        return apiError(402, 'PAYMENT_FAILED', 'Your payment method was declined — please try another.');
      }

      // Ambiguous outcome: the capture may have gone through even though the
      // response was lost. Ask PayPal what actually happened BEFORE deciding —
      // never mark a possibly-charged buyer as failed.
      console.error(`PayPal capture for order ${id} errored, reconciling:`, e);
      try {
        const paypalOrder = await getPaypalOrder(creds, order.paypalOrderId);
        const capture = extractCaptureDetails(paypalOrder);
        const expectedValue = (order.totalCents / 100).toFixed(2);
        if (
          paypalOrder.status === 'COMPLETED' &&
          capture.captureId &&
          (capture.status === 'COMPLETED' || capture.status === 'PENDING') &&
          capture.amountValue === expectedValue &&
          capture.currencyCode === order.currency
        ) {
          // The money DID move (or will settle) — finalize normally.
          return await finalizeAndRespond(id, capture.captureId);
        }
        if (paypalOrder.status === 'APPROVED') {
          // Approved does NOT prove the lost capture is dead — it may still
          // commit. Re-attempt (idempotent via PayPal-Request-Id) instead of
          // releasing and falsely promising "not charged".
          try {
            const retry = await capturePaypalOrder(creds, order.paypalOrderId);
            const d2 = extractCaptureDetails(retry);
            if (
              (d2.status === 'COMPLETED' || d2.status === 'PENDING') &&
              d2.captureId &&
              d2.amountValue === expectedValue &&
              d2.currencyCode === order.currency
            ) {
              return await finalizeAndRespond(id, d2.captureId);
            }
            console.error(`Order ${id}: retry capture returned unexpected details`, d2);
            return apiError(500, 'PAYMENT_FAILED', UNCLEAR_PAYMENT_MSG);
          } catch (retryErr) {
            if (retryErr instanceof InstrumentDeclinedError) {
              releaseClaim(id, 'pending');
              return apiError(402, 'PAYMENT_FAILED', 'Your payment method was declined — please try another.');
            }
            console.error(`Order ${id}: retry capture also failed:`, retryErr);
            return apiError(500, 'PAYMENT_FAILED', UNCLEAR_PAYMENT_MSG);
          }
        }
        if (
          paypalOrder.status === 'CREATED' ||
          paypalOrder.status === 'SAVED' ||
          paypalOrder.status === 'VOIDED' ||
          paypalOrder.status === 'PAYER_ACTION_REQUIRED'
        ) {
          // The buyer never approved (or the order is void): no capture can
          // exist or land — safe to release and retry.
          releaseClaim(id, 'pending');
          return apiError(402, 'PAYMENT_FAILED', 'The payment did not complete — you have not been charged. Please try again.');
        }
        // COMPLETED with an unclean capture (declined/refunded/mismatched), or
        // an unknown status: hold the seats ('capturing') for reconciliation.
        console.error(`Order ${id}: unclear PayPal state after capture error`, paypalOrder.status, capture);
        return apiError(500, 'PAYMENT_FAILED', UNCLEAR_PAYMENT_MSG);
      } catch (reconcileErr) {
        console.error(`Order ${id}: PayPal unreachable during reconciliation:`, reconcileErr);
        return apiError(500, 'PAYMENT_FAILED', UNCLEAR_PAYMENT_MSG);
      }
    }

    // Verify what PayPal actually captured before minting tickets.
    // PENDING is a real success case (e.g. eCheck): the capture exists and the
    // funds settle later — the buyer gets their tickets.
    const details = extractCaptureDetails(captureResponse);
    const expectedValue = (order.totalCents / 100).toFixed(2);
    if (
      (details.status !== 'COMPLETED' && details.status !== 'PENDING') ||
      !details.captureId ||
      details.amountValue !== expectedValue ||
      details.currencyCode !== order.currency
    ) {
      // A capture response we cannot verify: money may have moved, so hold the
      // seats in 'capturing' for reconciliation — never release blindly.
      console.error(
        `PayPal capture verification failed for order ${id}: ` +
          `status=${details.status} captureId=${details.captureId} ` +
          `amount=${details.amountValue} ${details.currencyCode} ` +
          `expected=${expectedValue} ${order.currency}`,
        JSON.stringify(captureResponse)
      );
      return apiError(500, 'PAYMENT_FAILED', UNCLEAR_PAYMENT_MSG);
    }

    return await finalizeAndRespond(id, details.captureId);
  } catch (e) {
    console.error(`POST /api/orders/${id}/capture failed:`, e);
    return apiError(
      500,
      'INTERNAL',
      'Something went wrong. You have not been charged unless PayPal shows a completed payment.'
    );
  }
}
