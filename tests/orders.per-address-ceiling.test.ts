/**
 * POST /api/orders — the per-address anti-hoarding ceiling.
 *
 * The one rule in this repo that stops a single party quietly holding a whole
 * room. A transfer reservation claims its seats the instant it is made and only
 * releases them after pay_within_days + 2, so seats — not requests — are the
 * scarce thing, and the rate limiters above it say nothing about how many a
 * buyer is sitting on. Turn this check off and every other test in the suite
 * still passes while one email address reserves an event into "sold out" for a
 * week without sending a cent.
 *
 * WHY THIS FILE DRIVES A ROUTE HANDLER, against tests/README.md's boundary:
 * the ceiling exists nowhere else. There is no lib function to call — the
 * arithmetic, the seat weighting and the refusal are written inline in the
 * handler, and a test that recomputed the formula here would agree with a
 * broken formula just as happily as a correct one (README's own words). So the
 * exported POST is called in-process, with a plain Request. No server, no
 * socket, no network: SMTP is unset in the sandbox so every send short-circuits
 * to 'email-not-configured', and PAYMENT_MODE below keeps PayPal out of it.
 *
 * Each test states the ceiling it expects in the same terms the handler derives
 * it, then asserts against the ACTUAL responses:
 *
 *   ceiling = max(maxSeatsPerOrder,
 *                 min(max(maxSeatsPerOrder * 3, 12), ceil(totalCapacity / 4)))
 *
 * with maxSeatsPerOrder = maxPerOrder × the largest seats_per_unit on sale.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { POST } from '../src/app/api/orders/route.ts';
import { freeTicketsForEmail, heldUnpaidTicketsForEmail } from '../src/lib/orders.ts';
import { makeEventWithTier } from './helpers.ts';

// The ceiling only guards the transfer and free paths — a mode that settles in
// the same request holds nothing overnight. getPaymentMode() reads this on
// every call, so setting it in the module body (which ESM runs after the
// imports above) is early enough: no request has been made yet.
process.env.PAYMENT_MODE = 'transfer';

let ipSeq = 0;

/**
 * One checkout request.
 *
 * A fresh x-forwarded-for per CALLER, not per request: clientIp() takes the
 * last entry, and the per-IP limiters (10/minute, 120/hour) would otherwise
 * start refusing for the wrong reason halfway through a test and make a green
 * ceiling look like a working one.
 */
async function order(
  eventId: string,
  email: string,
  items: { tierId: string; quantity: number }[],
  ip: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await POST(
    new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ eventId, buyerName: 'Test Buyer', buyerEmail: email, items }),
    })
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** A caller: one address, one address's IP, for the life of one test. */
function buyer(name: string) {
  ipSeq += 1;
  return { email: `${name}-${process.pid}-${ipSeq}@example.test`, ip: `203.0.113.${ipSeq}` };
}

// ---------------------------------------------------------------------------
// A first order is never the thing this rule refuses
// ---------------------------------------------------------------------------

test('a legitimate first order goes through, even when it fills a quarter of a small room', async () => {
  // 20 seats, tables of 8, two tables per order. A quarter of the room is 5
  // seats — less than a single booking — so the ceiling's floor of one full
  // order is the only thing that lets this event sell its first table at all.
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 20, maxPerOrder: 2 },
    { priceCents: 2000, cap: 5, seatsPerUnit: 8 }
  );
  const me = buyer('first');

  const res = await order(event.id, me.email, [{ tierId: tier.tierKey, quantity: 2 }], me.ip);
  assert.equal(res.status, 200, `refused a first order: ${JSON.stringify(res.body)}`);
  assert.ok(typeof res.body.orderId === 'string');
  // 16 SEATS held by one booking-pair — the counter agrees with the ceiling
  // about the unit, which is the other half of the rule working.
  assert.equal(heldUnpaidTicketsForEmail(event.id, me.email), 16);
});

// ---------------------------------------------------------------------------
// The boundary: up to the ceiling, and not one seat past it
// ---------------------------------------------------------------------------

test('an address may hold exactly the ceiling, and the very next seat is refused', async () => {
  // maxSeatsPerOrder = 5 × 1 = 5; ceil(80/4) = 20; min(max(15, 12), 20) = 15.
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 80, maxPerOrder: 5 },
    { priceCents: 1000, cap: 60 }
  );
  const me = buyer('boundary');
  const ceiling = 15;

  // Three ordinary repeat orders. None of these is abuse — a family booking
  // twice, someone coming back for more — and the rule must not touch them.
  for (const expected of [5, 10, 15]) {
    const res = await order(event.id, me.email, [{ tierId: tier.tierKey, quantity: 5 }], me.ip);
    assert.equal(res.status, 200, `refused at ${expected} seats: ${JSON.stringify(res.body)}`);
    assert.equal(heldUnpaidTicketsForEmail(event.id, me.email), expected);
  }
  assert.equal(heldUnpaidTicketsForEmail(event.id, me.email), ceiling);

  // One more seat is one past the ceiling. This is the assertion the surviving
  // mutation walked through: with the check removed the response is a cheerful
  // 200 and the address keeps taking the room.
  const over = await order(event.id, me.email, [{ tierId: tier.tierKey, quantity: 1 }], me.ip);
  assert.equal(over.status, 409, `expected a refusal, got ${JSON.stringify(over.body)}`);
  assert.equal(over.body.code, 'VALIDATION');
  // Refused for the RIGHT reason: the message names what they are already
  // holding, so it cannot be a sold-out message in disguise (the room still has
  // 65 seats free).
  assert.match(String(over.body.error), /already have 15 tickets reserved/);
  // And nothing was reserved by the refused attempt.
  assert.equal(heldUnpaidTicketsForEmail(event.id, me.email), ceiling);
});

test('the ceiling is per ADDRESS — another buyer is unaffected by the first one hitting it', async () => {
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 80, maxPerOrder: 5 },
    { priceCents: 1000, cap: 60 }
  );
  const hoarder = buyer('hoarder');
  const neighbour = buyer('neighbour');

  for (let i = 0; i < 3; i += 1) {
    const res = await order(event.id, hoarder.email, [{ tierId: tier.tierKey, quantity: 5 }], hoarder.ip);
    assert.equal(res.status, 200);
  }
  const refused = await order(event.id, hoarder.email, [{ tierId: tier.tierKey, quantity: 1 }], hoarder.ip);
  assert.equal(refused.status, 409);

  // The whole point of a per-address rule rather than a per-event one: real
  // buyers keep buying while one party is told to stop.
  const ok = await order(event.id, neighbour.email, [{ tierId: tier.tierKey, quantity: 5 }], neighbour.ip);
  assert.equal(ok.status, 200, `a different address was refused: ${JSON.stringify(ok.body)}`);
  assert.equal(heldUnpaidTicketsForEmail(event.id, neighbour.email), 5);
});

// ---------------------------------------------------------------------------
// Counted in SEATS, so a bundle weighs what it actually occupies
// ---------------------------------------------------------------------------

test('bundled bookings count as their seats, not as bookings', async () => {
  // maxSeatsPerOrder = 2 × 8 = 16; ceil(100/4) = 25; min(max(48, 12), 25) = 25.
  // So the ceiling is 25 SEATS — but only 3 BOOKINGS.
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 100, maxPerOrder: 2 },
    { priceCents: 5000, cap: 12, seatsPerUnit: 8 }
  );
  const me = buyer('tables');

  const first = await order(event.id, me.email, [{ tierId: tier.tierKey, quantity: 2 }], me.ip);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(heldUnpaidTicketsForEmail(event.id, me.email), 16);

  // Two more tables: 4 bookings against a ceiling of 25 would sail through, and
  // 32 seats against 25 must not. This is the assertion that pins the UNIT —
  // the room is people, and a table sits eight of them.
  const second = await order(event.id, me.email, [{ tierId: tier.tierKey, quantity: 2 }], me.ip);
  assert.equal(second.status, 409, `bundle counted as bookings: ${JSON.stringify(second.body)}`);
  assert.equal(second.body.code, 'VALIDATION');
  assert.match(String(second.body.error), /already have 16 tickets reserved/);

  // One table (8 seats) still fits under 25 — the refusal above was arithmetic
  // about seats, not a blanket "one order per address".
  const third = await order(event.id, me.email, [{ tierId: tier.tierKey, quantity: 1 }], me.ip);
  assert.equal(third.status, 200, JSON.stringify(third.body));
  assert.equal(heldUnpaidTicketsForEmail(event.id, me.email), 24);
});

// ---------------------------------------------------------------------------
// Free events, where nothing ever expires the seats back
// ---------------------------------------------------------------------------

test('free RSVPs are held to the same ceiling, and told so in their own words', async () => {
  // A free order finalizes to 'paid' in the same request: there is no unpaid
  // hold to expire, so without its own counter one address could RSVP a whole
  // free event into "sold out" permanently.
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 80, maxPerOrder: 5 },
    { priceCents: 0, cap: 60 }
  );
  const me = buyer('rsvp');

  for (const expected of [5, 10, 15]) {
    const res = await order(event.id, me.email, [{ tierId: tier.tierKey, quantity: 5 }], me.ip);
    assert.equal(res.status, 200, `refused at ${expected} spots: ${JSON.stringify(res.body)}`);
    assert.equal(freeTicketsForEmail(event.id, me.email), expected);
  }

  const over = await order(event.id, me.email, [{ tierId: tier.tierKey, quantity: 1 }], me.ip);
  assert.equal(over.status, 409, `expected a refusal, got ${JSON.stringify(over.body)}`);
  assert.equal(over.body.code, 'VALIDATION');
  // The RSVP wording, not the transfer one: nobody is waiting on a payment
  // here, and a message about unconfirmed transfers would be a lie.
  assert.match(String(over.body.error), /already has 15 spots reserved/);
  assert.equal(freeTicketsForEmail(event.id, me.email), 15);
});
