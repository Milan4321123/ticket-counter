import { NextResponse } from 'next/server';
import { getPaymentMode, hasPaypalCredentials } from '@/lib/config';
import { getEventById, getEventTier, type EventRow } from '@/lib/events';
import { getAvailability, SoldOutError } from '@/lib/inventory';
import { effectivePayout } from '@/lib/payout';
import { heldUnpaidTicketsForEmail, createOrder, expireOverdueTransferReservations, markOrderFailed, setPaypalOrderId } from '@/lib/orders';
import { createPaypalOrder } from '@/lib/paypal';
import { sendTransferInstructionsEmail } from '@/lib/email';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import type { ApiErrorResponse, CreateOrderRequest, CreateOrderResponse } from '@/lib/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function apiError(status: number, code: ApiErrorResponse['code'], error: string) {
  return NextResponse.json<ApiErrorResponse>({ error, code }, { status });
}

interface ValidatedOrder {
  buyerName: string;
  buyerEmail: string;
  items: { tierId: string; quantity: number }[];
  totalQuantity: number;
}

function validateBody(raw: unknown, event: EventRow): ValidatedOrder | string {
  if (!raw || typeof raw !== 'object') return 'Please fill in your details and try again.';
  const body = raw as Partial<CreateOrderRequest>;
  const maxTicketsPerOrder = event.maxPerOrder;

  // Strip control characters (newlines, tabs, NUL, etc.) and collapse runs of
  // whitespace so the name is always single-line wherever it is later rendered
  // — plaintext emails, admin lists, ticket pages. Prevents a crafted name from
  // injecting extra lines into the payment-instructions email body.
  const buyerName =
    typeof body.buyerName === 'string'
      ? body.buyerName.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
  if (buyerName.length < 1 || buyerName.length > 120) {
    return 'Please enter your name (up to 120 characters).';
  }

  const buyerEmail = typeof body.buyerEmail === 'string' ? body.buyerEmail.trim() : '';
  if (buyerEmail.length === 0 || buyerEmail.length > 200 || !EMAIL_RE.test(buyerEmail)) {
    return 'Please enter a valid email address — your tickets will be sent there.';
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return 'Please select at least one ticket.';
  }

  const items: { tierId: string; quantity: number }[] = [];
  const seenTiers = new Set<string>();
  let totalQuantity = 0;
  for (const it of body.items) {
    if (!it || typeof it !== 'object' || typeof it.tierId !== 'string') {
      return 'Please select at least one ticket.';
    }
    const tier = getEventTier(event.id, it.tierId);
    if (!tier) return 'One of the selected ticket types is not available.';
    // Announced, not on sale. The checkout does not offer these rows, but the
    // browser is not the guard — a request naming the tier directly has to be
    // refused here, or "coming soon" would be a label rather than a rule.
    if (tier.comingSoon) return `“${tier.name}” is not on sale yet.`;
    if (seenTiers.has(it.tierId)) return 'Each ticket type can only appear once in an order.';
    seenTiers.add(it.tierId);
    if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > maxTicketsPerOrder) {
      return `Ticket quantities must be between 1 and ${maxTicketsPerOrder}.`;
    }
    totalQuantity += it.quantity;
    items.push({ tierId: it.tierId, quantity: it.quantity });
  }
  if (totalQuantity > maxTicketsPerOrder) {
    return `You can buy at most ${maxTicketsPerOrder} tickets per order.`;
  }

  return { buyerName, buyerEmail, items, totalQuantity };
}

export async function POST(req: Request) {
  try {
    // Keep scripted floods from burying real buyers (and burning PayPal API
    // quota). Per-IP first; the global bucket is only consumed AFTER
    // validation so garbage requests cannot exhaust it for real buyers.
    if (!rateLimit(`orders:${clientIp(req)}`, 10, 60_000)) {
      return apiError(429, 'INTERNAL', 'Too many attempts — please wait a minute and try again.');
    }

    let raw: unknown;
    try {
      raw = await readJsonLimited(req);
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return apiError(413, 'VALIDATION', 'That request was too large.');
      }
      return apiError(400, 'VALIDATION', 'Please fill in your details and try again.');
    }

    // Which event is being bought? Only published events with open sales sell.
    const eventId =
      raw && typeof raw === 'object' && typeof (raw as Partial<CreateOrderRequest>).eventId === 'string'
        ? (raw as CreateOrderRequest).eventId
        : '';
    const event = eventId ? getEventById(eventId) : null;
    if (!event || event.status !== 'published') {
      return apiError(404, 'NOT_FOUND', 'We could not find that event — it may no longer be available.');
    }
    if (!event.salesOpen) {
      return apiError(403, 'SALES_CLOSED', 'Ticket sales are currently closed for this event.');
    }

    const validated = validateBody(raw, event);
    if (typeof validated === 'string') {
      return apiError(400, 'VALIDATION', validated);
    }

    // Global backstop against distributed/spoofed-IP floods. 300 valid order
    // creations per minute is far above any human peak.
    if (!rateLimit('orders:all', 300, 60_000)) {
      return apiError(429, 'INTERNAL', 'The site is very busy right now — please try again in a minute.');
    }

    // A slower per-IP ceiling behind the burst one above.
    //
    // Ten a minute stops a flood but still allows six hundred an hour, and the
    // damage here is not request volume — it is seats held. A transfer
    // reservation claims its seats immediately and only releases them after
    // pay_within_days + 2, so a scripted caller could reserve an entire event
    // in minutes and keep it sold out for a week without ever sending a cent.
    // 120, not 30. clientIp() is the single public address a proxy saw, which a
    // whole university, office or mobile carrier shares — and a busy on-sale
    // behind one CGNAT address would have met a 30/hour cap and turned real
    // buyers away. The seat ceiling below is the actual defence; this is only a
    // backstop against one host hammering the endpoint.
    if (!rateLimit(`orders:hour:${clientIp(req)}`, 120, 60 * 60_000)) {
      return apiError(429, 'INTERNAL', 'You have reserved a lot of tickets recently — please try again later.');
    }

    // Free any seats held by this event's transfer reservations whose payment
    // never came.
    expireOverdueTransferReservations(event.id);

    // How many seats this address is ALREADY sitting on, unpaid.
    //
    // Rate limits bound how fast orders arrive; they say nothing about how many
    // seats one party is holding. A transfer reservation claims its seats the
    // moment it is made and releases them only after pay_within_days + 2, so
    // the scarce thing being consumed is the room, not the request budget.
    //
    // Counted AFTER the expiry sweep above so seats that have already lapsed do
    // not count against the buyer, and from the database rather than a
    // limiter — a restart must not hand everyone a fresh allowance.
    //
    // The ceiling is deliberately generous: a family booking twice, or someone
    // who reserved, hesitated, and came back for more, should never meet it.
    // What it stops is one party quietly holding a whole room. It is not a
    // complete answer on its own — a script can vary the address — but it turns
    // "reserve the event from one script" into "keep hundreds of distinct
    // mailboxes alive", and it costs a real buyer nothing.
    if (getPaymentMode() === 'transfer') {
      const alreadyHeld = heldUnpaidTicketsForEmail(event.id, validated.buyerEmail);
      const wanted = validated.totalQuantity;
      // Also bounded by the room. Derived only from maxPerOrder, the ceiling
      // could exceed a small event's whole capacity — a 12-seat event with a
      // per-order limit of 6 gave a ceiling of 18, so one address could still
      // hold every seat and the cap never fired at all. A quarter of the room
      // is the most any single buyer has a reason to hold at once.
      const ceiling = Math.max(1, Math.min(Math.max(event.maxPerOrder * 3, 12), Math.ceil(event.totalCapacity / 4)));
      if (alreadyHeld + wanted > ceiling) {
        return apiError(
          409,
          'VALIDATION',
          `You already have ${alreadyHeld} ticket${alreadyHeld === 1 ? '' : 's'} reserved for this event that ` +
            `the organizer has not confirmed as paid yet. A transfer can take a day or two to show up — please ` +
            `wait for those to be confirmed, or ask the organizer to release them, before reserving more.`
        );
      }
    }

    // Soft availability check (the hard, atomic check happens at claim time).
    const avail = getAvailability(event.id);
    for (const it of validated.items) {
      const tierAvail = avail.tiers[it.tierId];
      const tierName = getEventTier(event.id, it.tierId)?.name ?? it.tierId;
      if (!tierAvail || tierAvail.remaining < it.quantity) {
        const remaining = tierAvail?.remaining ?? 0;
        const msg =
          remaining > 0
            ? `Only ${remaining} ${tierName} ticket${remaining === 1 ? '' : 's'} left — please adjust your order.`
            : `${tierName} tickets are sold out.`;
        return apiError(409, 'SOLD_OUT', msg);
      }
    }
    if (avail.totalRemaining < validated.totalQuantity) {
      const msg =
        avail.totalRemaining > 0
          ? `Only ${avail.totalRemaining} ticket${avail.totalRemaining === 1 ? '' : 's'} left for this event — please adjust your order.`
          : 'This event is sold out.';
      return apiError(409, 'SOLD_OUT', msg);
    }

    const mode = getPaymentMode();
    if (mode === 'paypal' && !hasPaypalCredentials()) {
      return apiError(500, 'INTERNAL', 'Payment is not configured yet — please try again later or contact the organizer.');
    }
    // Bank details live on the EVENT: buyers transfer straight to the organizer.
    // effectivePayout(), not the raw columns, so a change still inside its
    // waiting period is not treated as the account yet — createOrder freezes
    // the same answer onto the order a moment later.
    const payout = effectivePayout(event);
    if (mode === 'transfer' && (!payout.iban.trim() || !payout.holder.trim())) {
      return apiError(500, 'INTERNAL', 'Payment is not configured yet — please try again later or contact the organizer.');
    }

    // For transfer orders createOrder also reserves the seats immediately —
    // the buyer's bank transfer takes days, and the reservation must hold
    // until the organizer confirms the money (or it expires via
    // expireOverdueTransferReservations).
    let order;
    try {
      order = createOrder({
        eventId: event.id,
        buyerName: validated.buyerName,
        buyerEmail: validated.buyerEmail,
        items: validated.items,
        paymentMode: mode,
      });
    } catch (e) {
      if (e instanceof SoldOutError) {
        return apiError(409, 'SOLD_OUT', 'Those tickets were taken just before you — please adjust your order.');
      }
      throw e;
    }

    if (mode === 'transfer') {
      // Fire-and-forget: NEVER block the reservation response on SMTP. The seats
      // are already claimed above and the order page shows the same bank details,
      // so the buyer must not wait for (or be failed by) a slow email server.
      // On Render this runs a persistent Node process, so the send completes in
      // the background after the response is sent.
      void sendTransferInstructionsEmail(order.id)
        .then((emailResult) => console.log(`Transfer instructions email for order ${order.id}:`, emailResult))
        .catch((e) => console.error(`Transfer instructions email for order ${order.id} threw unexpectedly:`, e));
    }

    let paypalOrderId: string | null = null;
    if (mode === 'paypal') {
      try {
        paypalOrderId = await createPaypalOrder({
          totalCents: order.totalCents,
          currency: order.currency,
          referenceId: order.id,
          description: event.name,
        });
        setPaypalOrderId(order.id, paypalOrderId);
      } catch (e) {
        console.error(`Creating PayPal order for local order ${order.id} failed:`, e);
        markOrderFailed(order.id);
        return apiError(
          502,
          'PAYMENT_FAILED',
          'We could not start the PayPal payment. You have not been charged — please try again in a moment.'
        );
      }
    }

    const response: CreateOrderResponse = {
      orderId: order.id,
      mode,
      paypalOrderId,
      totalCents: order.totalCents,
      currency: order.currency,
    };
    return NextResponse.json(response);
  } catch (e) {
    console.error('POST /api/orders failed:', e);
    return apiError(
      500,
      'INTERNAL',
      'Something went wrong. You have not been charged unless PayPal shows a completed payment.'
    );
  }
}
