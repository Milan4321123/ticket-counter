import { NextResponse } from 'next/server';
import { demoAddress, listingOpenTo } from '@/lib/demo';
import { getBaseUrl } from '@/lib/config';
import { getEventById, getEventTier, getEventTiers, type EventRow } from '@/lib/events';
import { readsAsComingSoon } from '@/lib/ticketState';
import { getAvailability, SoldOutError } from '@/lib/inventory';
import {
  anyPaymentRoute,
  getConnectionById,
  paymentOptionsFor,
  paypalCredentialsFor,
  resolvePaymentRoute,
  stripeCredentialsFor,
} from '@/lib/paymentConnections';
import { createStripeCheckoutSession } from '@/lib/stripe';
import {
  cleanTableLabel,
  parseSlotConfig,
  setOrderKitchenDetails,
  slotIsBookable,
  validatePicks,
  type KitchenDetails,
} from '@/lib/kitchen';
import { holdSeats, parseSeatMap, SeatTakenError, validateSeatPicks } from '@/lib/seats';
import { armStripeSweep } from '@/lib/stripeOrders';
import {
  createOrder,
  expireOverdueTransferReservations,
  finalizePaidOrder,
  freeTicketsForEmail,
  getPaidOrderByReferralCode,
  heldUnpaidTicketsForEmail,
  markOrderFailed,
  paymentReference,
  cleanPhone,
  setOrderPaymentConnection,
  setOrderPhone,
  setPaypalOrderId,
  setStripeSession,
  type PaymentMethod,
} from '@/lib/orders';
import { requestMarketingConsent } from '@/lib/marketing';
import { discountCentsFor } from '@/lib/money';
import { previewDiscountCode, PROMO_NOTHING_TO_DISCOUNT } from '@/lib/promos';
import { VOUCHER_NOTHING_TO_DISCOUNT, VoucherError } from '@/lib/referrals';
import { createPaypalOrder } from '@/lib/paypal';
import { sendMarketingConfirmationEmail, sendSubscriptionEmail, sendTicketEmail, sendTransferInstructionsEmail } from '@/lib/email';
import { createSubscription, isValidEvery, subscriptionOffer } from '@/lib/subscriptions';
import { addOrderToBasketRun, BASKET_RUN_RE, basketRunPath } from '@/lib/basket';
import { subscribeDiscountCents } from '@/lib/money';
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
    if (!event || !(await listingOpenTo(event))) {
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
    // A try-it-yourself demo listing (lib/demo.ts): whatever address was typed,
    // the order gets one nobody can receive mail at, so a demo can never be
    // used to send tickets, reminders or confirmations to a real inbox.
    if (event.isDemo) validated.buyerEmail = demoAddress('buyer');

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

    // A discount code the buyer typed at checkout — a referral voucher or one
    // of the seller's own promo codes; both are the SELLER'S own discount on
    // the seller's own price, and only one may apply to an order. Previewed
    // here for ONE reason — to know which flow this order takes, because a
    // total a code brings to zero is an RSVP and nobody may be asked to
    // transfer 0.00. The authoritative check and the claim happen inside
    // createOrder's transaction; a refusal there reaches the buyer as the same
    // message, before anything is committed.
    const rawVoucher = (raw as Partial<CreateOrderRequest>).voucherCode;
    const typedCode = (typeof rawVoucher === 'string' ? rawVoucher : '').trim();
    let voucherCode = '';
    let discountCents = 0;
    if (typedCode) {
      try {
        const preview = previewDiscountCode({ id: event.id, organizerId: event.organizerId }, typedCode);
        voucherCode = preview.code;
        // A basket worth nothing has nothing to discount. Refused here, in the
        // same words createOrder would refuse it in, because spending a
        // voucher for 0.00 destroys the whole reward on an order that
        // finalizes as paid in this very request and can never hand it back —
        // and anybody who came across a code could do that to its owner in one
        // request. A promo is not destroyed the same way, but it would still
        // burn one of a capped code's redemptions for nothing. A mixed listing
        // (a free tier beside paid ones) makes this a basket the buyer can
        // genuinely arrive at by changing their mind.
        if (orderTotalCents <= 0) {
          return apiError(
            400,
            'VALIDATION',
            preview.source === 'voucher' ? VOUCHER_NOTHING_TO_DISCOUNT : PROMO_NOTHING_TO_DISCOUNT
          );
        }
        // The SAME function the checkout previewed with and createOrder claims
        // with: never more than the basket is worth, never negative, and a
        // percentage rounded in the buyer's favour. No change and no credit is
        // given for the remainder — it is a discount.
        discountCents = discountCentsFor(preview, orderTotalCents);
      } catch (e) {
        if (e instanceof VoucherError) return apiError(400, 'VALIDATION', e.message);
        throw e;
      }
    }
    // Subscribe & save (lib/subscriptions): the shop's own repeat discount, in
    // place of a code — only one discount may part-pay an order.
    let subscribe: { everyDays: number; pct: number } | null = null;
    const rawEvery = (raw as Partial<CreateOrderRequest>).subscribeEvery;
    if (rawEvery !== undefined && rawEvery !== null && rawEvery !== 0) {
      const offer = subscriptionOffer(event);
      const body = raw as Partial<CreateOrderRequest>;
      if (!offer || !isValidEvery(rawEvery) || (typeof body.table === 'string' && body.table.trim())) {
        return apiError(400, 'VALIDATION', 'Subscribe & save is not offered for this order.');
      }
      if (typedCode) {
        return apiError(400, 'VALIDATION', 'A discount code cannot be combined with Subscribe & save — please use one or the other.');
      }
      if (orderTotalCents > 0) {
        subscribe = { everyDays: rawEvery, pct: offer.pct };
        discountCents = subscribeDiscountCents(offer.pct, orderTotalCents);
      }
    }
    // What the buyer will actually owe once the discount is off.
    const payableCents = Math.max(0, orderTotalCents - discountCents);
    const isFree = payableCents === 0;
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
    // Deliberately compared against the ITEMS total, before any voucher: this
    // guard is about PRICES changing under the buyer, and a voucher is not a
    // price. The checkout sends the same subtotal for the same reason.
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
    // ---- Which way is this buyer paying? --------------------------------
    //
    // The listing's own offer (lib/paymentConnections) is the only authority:
    // a route the seller has not switched on, or has nothing behind, is
    // refused even if the request names it. A zero total is an RSVP and pays
    // by no route at all.
    const options = paymentOptionsFor(event);
    let mode: PaymentMethod;
    if (isFree) {
      mode = 'free';
    } else {
      const route = resolvePaymentRoute(options, (raw as Partial<CreateOrderRequest>).payVia);
      if (!route) {
        return anyPaymentRoute(options)
          ? apiError(400, 'VALIDATION', 'That way of paying is not offered for this listing — please choose another.')
          : apiError(500, 'INTERNAL', 'Payment is not configured yet — please try again later or contact the organizer.');
      }
      mode = route;
    }

    if (mode === 'transfer' || isFree) {
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

    // Referral code, validated hard before it may be stored. It arrives either
    // from a shared URL anyone can edit or from the box the buyer typed it
    // into, so the rule fails closed to '': it must be exactly 8 chars of
    // [A-Z0-9] after uppercasing, it must name a PAID order of ANY listing
    // belonging to THIS SELLER, and that order's buyer must not be this buyer
    // (self-referral counts nothing, and is refused here rather than at the
    // check endpoint, which does not know who is buying).
    //
    // It CREDITS the person who shared it and takes nothing off this buyer's
    // price — a different thing entirely from the discount code above, which
    // is why the two are separate fields at checkout.
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
    // ---- Restaurant pack (lib/kitchen): slot, table, choices, note ---------
    //
    // Checked BEFORE the order is written, so a full slot or a missing choice
    // is refused with nothing reserved. None of it changes the price.
    let kitchen: KitchenDetails | null = null;
    if (event.kind === 'shop') {
      const body = raw as Partial<CreateOrderRequest>;
      const tableLabel = event.tableCount > 0 ? cleanTableLabel(body.table) : '';
      const slotsOn = parseSlotConfig(event.pickupSlots).enabled;
      let pickupSlot: string | null = null;
      if (slotsOn && !tableLabel) {
        const wanted = typeof body.pickupSlot === 'string' ? body.pickupSlot : '';
        if (!wanted) {
          return apiError(
            400,
            'VALIDATION',
            parseSlotConfig(event.pickupSlots).purpose === 'appointment'
              ? 'Please choose a time for your appointment.'
              : 'Please choose when you will collect your order.'
          );
        }
        if (!slotIsBookable(event, wanted)) {
          return apiError(409, 'VALIDATION', 'That time has just been taken — please choose another one.');
        }
        pickupSlot = wanted;
      }
      const picks = validatePicks(event.id, validated.items.map((it) => it.tierId), body.choices);
      if (typeof picks === 'string') return apiError(400, 'VALIDATION', picks);
      const note =
        typeof body.note === 'string'
          ? body.note.replace(/[\u0000-\u0009\u000B-\u001F\u007F]+/g, ' ').trim().slice(0, 300)
          : '';
      kitchen = { pickupSlot, tableLabel, note, choices: picks };
    }

    // ---- Reserved seating (lib/seats) ------------------------------------
    // The seats must match the quantities exactly and be free right now; the
    // hold itself happens just after the order is written, atomically.
    let seatPicks: string[] = [];
    const seatMap = event.kind === 'event' ? parseSeatMap(event.seatMap) : null;
    if (seatMap?.enabled) {
      const checked = validateSeatPicks(event.id, seatMap, validated.items, (raw as Partial<CreateOrderRequest>).seats);
      if (typeof checked === 'string') return apiError(409, 'VALIDATION', checked);
      seatPicks = checked;
    }

    let order;
    try {
      order = createOrder({
        eventId: event.id,
        buyerName: validated.buyerName,
        buyerEmail: validated.buyerEmail,
        payerName: validated.payerName,
        referredBy,
        voucherCode,
        items: validated.items,
        paymentMode: mode,
        subscriptionPct: subscribe?.pct,
      });
    } catch (e) {
      if (e instanceof SoldOutError) {
        return apiError(409, 'SOLD_OUT', 'Those tickets were taken just before you — please adjust your order.');
      }
      // Somebody else spent the voucher in the seconds since the preview above
      // — the order rolled back rather than existing without the discount it
      // was shown. Say so plainly instead of silently charging full price.
      if (e instanceof VoucherError) return apiError(409, 'VALIDATION', e.message);
      throw e;
    }

    // Part of a basket checkout: join its run, so the payments page — and a
    // buyer coming back from a seller's card page — finds every order.
    const rawRun = (raw as Partial<CreateOrderRequest>).basketRun;
    const basketRun = typeof rawRun === 'string' && BASKET_RUN_RE.test(rawRun) && addOrderToBasketRun(rawRun, order.id) ? rawRun : null;

    if (kitchen) setOrderKitchenDetails(order.id, kitchen);
    setOrderPhone(order.id, cleanPhone((raw as { phone?: unknown }).phone));
    if (seatPicks.length > 0) {
      try {
        holdSeats(event.id, order.id, seatPicks);
      } catch (e) {
        // Somebody else's order took one of these seats in the last moment.
        // Nothing has been paid: end this order, give its places back.
        markOrderFailed(order.id, 'cancelled');
        if (e instanceof SeatTakenError) return apiError(409, 'SOLD_OUT', e.message);
        throw e;
      }
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

    // ---- Instant routes: start the payment on the SELLER'S account ------
    //
    // Both use the connection paymentOptionsFor resolved a moment ago, and pin
    // its id to the order, so the capture/settle step later runs against the
    // same credentials even if the seller swaps their app in between.
    let paypalOrderId: string | null = null;
    let redirectUrl: string | null = null;

    if (mode === 'paypal') {
      const conn = options.paypal ? getConnectionById(options.paypal.connectionId) : null;
      const creds = conn ? paypalCredentialsFor(conn) : null;
      if (!conn || !creds) {
        markOrderFailed(order.id);
        return apiError(500, 'INTERNAL', 'Payment is not configured yet — please try again later or contact the organizer.');
      }
      try {
        setOrderPaymentConnection(order.id, conn.id);
        paypalOrderId = await createPaypalOrder(creds, {
          totalCents: order.totalCents,
          currency: order.currency,
          referenceId: order.id,
          description: `${paymentReference(order.id)} — ${event.name}`.slice(0, 127),
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

    if (mode === 'stripe') {
      const conn = options.stripe ? getConnectionById(options.stripe.connectionId) : null;
      const creds = conn ? stripeCredentialsFor(conn) : null;
      if (!conn || !creds) {
        markOrderFailed(order.id, 'cancelled');
        return apiError(500, 'INTERNAL', 'Payment is not configured yet — please try again later or contact the organizer.');
      }
      try {
        setOrderPaymentConnection(order.id, conn.id);
        const base = getBaseUrl();
        const reference = paymentReference(order.id);
        const session = await createStripeCheckoutSession(creds, {
          orderId: order.id,
          totalCents: order.totalCents,
          currency: order.currency,
          itemName: event.name,
          itemDescription: `${validated.items.reduce((n, it) => n + it.quantity, 0)} × ${event.kind === 'shop' ? 'item' : 'ticket'} · ${reference}`,
          buyerEmail: validated.buyerEmail,
          // Stripe fills in {CHECKOUT_SESSION_ID} itself; the return route
          // verifies the session before anything is minted.
          // From a basket: back to its payments page, which offers the next.
          successUrl: `${base}/api/orders/${order.id}/stripe-return?session_id={CHECKOUT_SESSION_ID}${basketRun ? `&run=${basketRun}` : ''}`,
          cancelUrl: basketRun ? `${base}${basketRunPath(basketRun)}` : `${base}/order/${order.id}?stripe=cancelled`,
          paymentReference: reference,
        });
        setStripeSession(order.id, session.id, session.url);
        redirectUrl = session.url;
        // Somebody has to look again if this buyer never comes back.
        armStripeSweep();
        if (!redirectUrl) throw new Error('Stripe session has no url');
      } catch (e) {
        console.error(`Creating Stripe session for local order ${order.id} failed:`, e);
        // The seats were claimed by createOrder; nothing was charged.
        markOrderFailed(order.id, 'cancelled');
        return apiError(
          502,
          'PAYMENT_FAILED',
          'We could not start the card payment. You have not been charged — please try again in a moment.'
        );
      }
    }

    // The standing order starts once its first order exists and its payment
    // could be started. A first order that is then never paid pauses it on
    // the first repeat (lib/subscriptions placeRepeat), so nothing piles up.
    if (subscribe) {
      try {
        const sub = createSubscription({
          eventId: event.id,
          buyerName: validated.buyerName,
          buyerEmail: validated.buyerEmail,
          items: validated.items,
          choices: kitchen?.choices ?? null,
          note: kitchen?.note ?? '',
          everyDays: subscribe.everyDays,
          discountPct: subscribe.pct,
          firstOrderId: order.id,
        });
        void sendSubscriptionEmail(sub.id, 'started')
          .then((r) => console.log(`Subscription email for order ${order.id}:`, r))
          .catch((e) => console.error(`Subscription email for order ${order.id} threw unexpectedly:`, e));
      } catch (e) {
        console.error(`Starting the subscription for order ${order.id} failed:`, e);
      }
    }

    const response: CreateOrderResponse = {
      orderId: order.id,
      mode,
      paypalOrderId,
      redirectUrl,
      totalCents: order.totalCents,
      discountCents: order.discountCents,
      currency: order.currency,
    };
    return NextResponse.json(response);
  } catch (e) {
    console.error('POST /api/orders failed:', e);
    return apiError(
      500,
      'INTERNAL',
      'Something went wrong. You have not been charged unless PayPal or your card statement shows a completed payment.'
    );
  }
}
