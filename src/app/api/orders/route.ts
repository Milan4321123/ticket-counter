import { NextResponse } from 'next/server';
import { getPaymentMode, hasPaypalCredentials } from '@/lib/config';
import { getEventById, getEventTier, getEventTiers, paypalPayee, type EventRow } from '@/lib/events';
import { readsAsComingSoon } from '@/lib/ticketState';
import { getAvailability, SoldOutError } from '@/lib/inventory';
import { effectivePayout } from '@/lib/payout';
import {
  createOrder,
  expireOverdueTransferReservations,
  finalizePaidOrder,
  freeTicketsForEmail,
  getPaidOrderByReferralCode,
  heldUnpaidTicketsForEmail,
  markOrderFailed,
  setPaypalOrderId,
  type PaymentMethod,
} from '@/lib/orders';
import { requestMarketingConsent } from '@/lib/marketing';
import { createPaypalOrder } from '@/lib/paypal';
import { sendMarketingConfirmationEmail, sendTicketEmail, sendTransferInstructionsEmail } from '@/lib/email';
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
  /** Optional: whose name the payment will show up under. '' when not given. */
  payerName: string;
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

  // Optional, and sanitised exactly like the buyer's own name — it lands in the
  // same emails and the same organizer-facing lists.
  const payerName =
    typeof body.payerName === 'string'
      ? body.payerName.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
  if (payerName.length > 120) {
    return 'That payer name is too long (up to 120 characters).';
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
    if (tier.status === 'coming-soon') return `“${tier.name}” is not on sale yet.`;
    if (tier.status === 'hidden') return `“${tier.name}” is not on offer for this event.`;
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

  return { buyerName, buyerEmail, payerName, items, totalQuantity };
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
      // Refused either way — only the wording follows the organizer's choice,
      // so a buyer who got this far is not told sales ended on an event that
      // has not opened yet.
      return apiError(
        403,
        'SALES_CLOSED',
        readsAsComingSoon(getEventTiers(event.id))
          ? 'Tickets for this event are not on sale yet.'
          : 'Ticket sales are currently closed for this event.'
      );
    }

    const validated = validateBody(raw, event);
    if (typeof validated === 'string') {
      return apiError(400, 'VALIDATION', validated);
    }

    // Per-ADDRESS throttle, independent of IP. The free path sends a branded
    // email with QR attachments to whatever address is typed, instantly and
    // unauthenticated — without this, one script rotating IPs could use the
    // platform as a mail cannon against a single inbox. Five in fifteen
    // minutes never touches a real buyer (even one fixing a typo twice).
    if (!rateLimit(`orders:email:${validated.buyerEmail.toLowerCase()}`, 5, 15 * 60_000)) {
      return apiError(
        429,
        'INTERNAL',
        'Several orders were just placed with this email address — please wait a few minutes and try again.'
      );
    }

    // Priced HERE, from the tiers, exactly as createOrder prices it again —
    // never from the browser. A zero total is an RSVP: mode 'free', finalized
    // in this same request, and it bypasses the payment-config checks below
    // because an event that charges nothing has nothing to configure.
    const orderTotalCents = validated.items.reduce((sum, it) => {
      const tier = getEventTier(event.id, it.tierId);
      return sum + (tier ? tier.priceCents : 0) * it.quantity;
    }, 0);
    const isFree = orderTotalCents === 0;
    // Seats this order occupies — quantities count BOOKINGS, and a bundled
    // tier ("Table of 8") puts several people in the room per booking. Every
    // comparison against the room or the per-address ceiling uses this.
    const orderSeats = validated.items.reduce((sum, it) => {
      return sum + it.quantity * (getEventTier(event.id, it.tierId)?.seatsPerUnit ?? 1);
    }, 0);

    // The browser states the total it SHOWED the buyer. On mismatch, refuse
    // before anything is claimed: an organizer repricing a tier mid-checkout
    // must not silently turn "free" into a €50 transfer order — or the
    // reverse — behind the buyer's back.
    const expected = (raw as Partial<CreateOrderRequest>).expectedTotalCents;
    if (typeof expected === 'number' && Number.isFinite(expected) && Math.round(expected) !== orderTotalCents) {
      return apiError(
        409,
        'VALIDATION',
        'Prices for this event were just updated — please review your order and try again.'
      );
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
    if (getPaymentMode() === 'transfer' || isFree) {
      // Both counters together: unpaid transfer holds AND already-RSVP'd free
      // seats. A free order finalizes instantly, so without its own count one
      // address could RSVP a free event into "sold out" with nothing ever
      // expiring the seats back — see freeTicketsForEmail.
      const alreadyHeld =
        heldUnpaidTicketsForEmail(event.id, validated.buyerEmail) +
        (isFree ? freeTicketsForEmail(event.id, validated.buyerEmail) : 0);
      // In SEATS, like the two counters above: the ceiling protects the room,
      // and one bundled booking sits on several seats of it.
      const wanted = orderSeats;
      // The ceiling is in SEATS too, so maxPerOrder (which counts BOOKINGS)
      // has to be weighted before it can shape one: a per-order limit of 8 on
      // an event selling tables of 8 permits a 64-seat order, and a ceiling
      // still derived from the bare 8 would refuse orders the checkout itself
      // offers.
      const maxSeatsPerOrder =
        event.maxPerOrder * getEventTiers(event.id).reduce((m, t) => Math.max(m, t.seatsPerUnit), 1);
      // Also bounded by the room. Derived only from the per-order limit, the
      // ceiling could exceed a small event's whole capacity — a 12-seat event
      // with a per-order limit of 6 gave a ceiling of 18, so one address could
      // still hold every seat and the cap never fired at all. A quarter of the
      // room is the most any single buyer has a reason to hold at once — but
      // the floor is one full order, or a "Table of 20" tier in a small room
      // could never sell its first booking at all (the room-level check below
      // still refuses anything that genuinely does not fit).
      const ceiling = Math.max(
        maxSeatsPerOrder,
        Math.min(Math.max(maxSeatsPerOrder * 3, 12), Math.ceil(event.totalCapacity / 4))
      );
      if (alreadyHeld + wanted > ceiling) {
        return apiError(
          409,
          'VALIDATION',
          isFree
            ? `This email address already has ${alreadyHeld} spot${alreadyHeld === 1 ? '' : 's'} reserved for ` +
              `this event. If you are booking for a bigger group, ask the others to reserve with their own ` +
              `email addresses — it keeps spots from being held in one name.`
            : `You already have ${alreadyHeld} ticket${alreadyHeld === 1 ? '' : 's'} reserved for this event that ` +
              `the organizer has not confirmed as paid yet. A transfer can take a day or two to show up — please ` +
              `wait for those to be confirmed, or ask the organizer to release them, before reserving more.`
        );
      }
    }

    // Soft availability check (the hard, atomic check happens at claim time).
    const avail = getAvailability(event.id);
    for (const it of validated.items) {
      const tierAvail = avail.tiers[it.tierId];
      const tier = getEventTier(event.id, it.tierId);
      const tierName = tier?.name ?? it.tierId;
      if (!tierAvail || tierAvail.remaining < it.quantity) {
        const remaining = tierAvail?.remaining ?? 0;
        // A tier's remaining counts BOOKINGS of it, not people — "2 Table of 8
        // tickets left" would read as 2 seats when it means 2 whole tables.
        const noun = (tier?.seatsPerUnit ?? 1) > 1 ? 'booking' : 'ticket';
        const msg =
          remaining > 0
            ? `Only ${remaining} ${tierName} ${noun}${remaining === 1 ? '' : 's'} left — please adjust your order.`
            : `${tierName} ${noun}s are sold out.`;
        return apiError(409, 'SOLD_OUT', msg);
      }
    }
    // The room is counted in SEATS, so the order weighs in seats too — raw
    // booking counts would let table orders slip past a nearly-full room here
    // (the atomic claim would still refuse them, but with a worse message).
    if (avail.totalRemaining < orderSeats) {
      const msg =
        avail.totalRemaining > 0
          ? `Only ${avail.totalRemaining} ticket${avail.totalRemaining === 1 ? '' : 's'} left for this event — please adjust your order.`
          : 'This event is sold out.';
      return apiError(409, 'SOLD_OUT', msg);
    }

    const mode: PaymentMethod = isFree ? 'free' : getPaymentMode();
    if (mode === 'paypal' && !hasPaypalCredentials()) {
      return apiError(500, 'INTERNAL', 'Payment is not configured yet — please try again later or contact the organizer.');
    }
    // Bank details live on the EVENT: buyers transfer straight to the organizer.
    // effectivePayout(), not the raw columns, so a change still inside its
    // waiting period is not treated as the account yet — createOrder freezes
    // the same answer onto the order a moment later.
    const payout = effectivePayout(event);
    // SOME route has to exist — but a complete bank account is not the only one.
    // PayPal is a full route on its own here (the organizer's own address, the
    // same reference, the same confirm-by-hand step), and the checkout page has
    // always offered it that way. This guard still demanded an IBAN, so a
    // PayPal-only organizer got a working "Reserve — pay by PayPal" button and a
    // 500 behind it: they could not sell at all. Both halves of the bank account
    // are still required together — a holder with no IBAN is not a route.
    const hasBankRoute = Boolean(payout.iban.trim() && payout.holder.trim());
    const hasPaypalRoute = paypalPayee({ paypalAccount: payout.paypal }) !== null;
    if (mode === 'transfer' && !hasBankRoute && !hasPaypalRoute) {
      return apiError(500, 'INTERNAL', 'Payment is not configured yet — please try again later or contact the organizer.');
    }

    // Referral code, validated hard before it may be stored. The code arrives
    // from a shared URL anyone can edit, so the rule fails closed to '': it
    // must be exactly 8 chars of [A-Z0-9] after uppercasing, it must name a
    // PAID order of THIS event, and that order's buyer must not be this buyer
    // (self-referral counts nothing). Analysis only — no reward rides on it,
    // which is why '' is always a safe answer.
    let referredBy = '';
    const rawRef = (raw as Partial<CreateOrderRequest>).ref;
    if (typeof rawRef === 'string') {
      const code = rawRef.trim().toUpperCase();
      if (/^[A-Z0-9]{8}$/.test(code)) {
        const referrer = getPaidOrderByReferralCode(event.id, code);
        if (
          referrer &&
          referrer.buyerEmail.trim().toLowerCase() !== validated.buyerEmail.trim().toLowerCase()
        ) {
          referredBy = code;
        }
      }
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
        payerName: validated.payerName,
        referredBy,
        items: validated.items,
        paymentMode: mode,
      });
    } catch (e) {
      if (e instanceof SoldOutError) {
        return apiError(409, 'SOLD_OUT', 'Those tickets were taken just before you — please adjust your order.');
      }
      throw e;
    }

    // The OPTIONAL "keep me posted" tick. Strictly `=== true`: absence, null,
    // or anything a script sends that is not the literal tick records nothing —
    // consent is an action, never a default. The tick alone only files a
    // PENDING request; the subscription exists once the address's owner presses
    // the button in the confirmation email (double opt-in — anyone can type
    // any address in here, so the tick must never subscribe by itself). And it
    // must never block checkout: a consent row that cannot be written is a
    // logged error, not a lost sale, and the confirmation email is
    // fire-and-forget like every other send in this route.
    if ((raw as Partial<CreateOrderRequest>).marketingOptIn === true) {
      try {
        const consent = requestMarketingConsent({
          organizerId: event.organizerId,
          email: validated.buyerEmail,
          sourceOrderId: order.id,
        });
        if (consent === 'confirmation-needed') {
          void sendMarketingConfirmationEmail(validated.buyerEmail, event.organizerId)
            .then((r) => console.log(`Marketing confirmation email for order ${order.id}:`, r))
            .catch((e) => console.error(`Marketing confirmation email for order ${order.id} threw unexpectedly:`, e));
        }
      } catch (e) {
        console.error(`Recording marketing consent request for order ${order.id} failed:`, e);
      }
    }

    if (mode === 'free') {
      // Nothing to wait for: no money is coming, so the order is finalized in
      // the same request — codes minted, status 'paid' — and the buyer lands
      // on an order page that already shows their tickets. The email is
      // fire-and-forget for the same reason the transfer one is: the page,
      // not the inbox, is the delivery that must not fail.
      finalizePaidOrder(order.id, null);
      void sendTicketEmail(order.id)
        .then((emailResult) => console.log(`Ticket email for free order ${order.id}:`, emailResult))
        .catch((e) => console.error(`Ticket email for free order ${order.id} threw unexpectedly:`, e));
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
