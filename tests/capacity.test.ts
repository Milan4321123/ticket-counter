/**
 * Capacity, seats-per-booking and claiming — lib/inventory.ts, lib/capacity.ts
 * and the claiming half of lib/orders.ts.
 *
 * This is the arithmetic that decides how many people can be in a room, so
 * every promise it makes is one a doorman has to keep on the night. Two units
 * of measure meet here and confusing them is the whole risk: a TIER is counted
 * in BOOKINGS ("10 tables"), the ROOM is counted in SEATS ("100 people"), and
 * seats_per_unit is the only bridge between them. Each test below names one
 * rule those modules' own comments state, so a failure reads as "this promise
 * broke" rather than "an assertion changed".
 *
 * Everything drives the real functions: getAvailability, claimInventory,
 * createOrder, finalizePaidOrder, expireOverdueTransferReservations,
 * setEventCapacity, ticketState. A test that recomputed the seat formula
 * itself would agree with a broken formula just as happily as a correct one.
 *
 * Where a rule is about a race, the race is actually run. better-sqlite3 is
 * synchronous, so there is no wall-clock interleaving to reproduce; what CAN
 * be reproduced exactly is the state the loser's transaction sees — two orders
 * created while seats were free, then claimed one after the other. That is the
 * real overselling window (the checkout's soft availability check happens
 * before the claim), and the assertion is that the loser fails CLOSED with
 * SoldOutError rather than that it lost by some number of milliseconds.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEvent, makeEventWithTier, makeOrder, makePaidOrder } from './helpers.ts';
import { getEventById, getEventTiers } from '../src/lib/events.ts';
import { claimInventory, getAvailability, SoldOutError } from '../src/lib/inventory.ts';
import { CapacityError, setEventCapacity } from '../src/lib/capacity.ts';
import {
  expireOverdueTransferReservations,
  freeTicketsForEmail,
  getOrder,
  heldUnpaidTicketsForEmail,
} from '../src/lib/orders.ts';
import { ticketState, tiersInSaleOrder } from '../src/lib/ticketState.ts';

/**
 * An order that has NOT claimed anything yet.
 *
 * createOrder claims immediately for 'transfer' and 'free'; 'mock' is the mode
 * that leaves the order 'pending', which is exactly the state two racing
 * buyers are in the instant before either of them reserves. Used to stage the
 * races below — the claim is then made explicitly, by the real claimInventory.
 */
function pendingOrder(eventId: string, items: { tierId: string; quantity: number }[], email?: string) {
  return makeOrder({ eventId, items, paymentMode: 'mock', buyerEmail: email });
}

/** The live state of one tier, straight from the real availability reader. */
function tierOf(eventId: string, tierKey: string) {
  return getAvailability(eventId).tiers[tierKey];
}

/**
 * Like assert.throws, but hands the error back.
 *
 * Several rules here are not only "it was refused" but "it was refused for the
 * RIGHT reason" — SoldOutError carries the tier that ran out (or nothing, when
 * it was the room), and CapacityError carries the sentence an admin reads. A
 * test that only checked something was thrown would pass while the room's
 * refusal was blamed on a tier that still had stock.
 */
function caught<E extends Error>(fn: () => unknown, type: new (...args: never[]) => E): E {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof type, `expected a ${type.name}, got ${String(e)}`);
    return e as E;
  }
  assert.fail(`expected a ${type.name}, but nothing was thrown`);
}

// ---------------------------------------------------------------------------
// seats_per_unit = 1 — the pre-bundle behaviour, exactly
// ---------------------------------------------------------------------------

test('an ordinary ticket takes one seat of the room and one unit of its tier — the pre-bundle behaviour, unchanged', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 100 }, { cap: 50, seatsPerUnit: 1 });

  const before = getAvailability(event.id);
  assert.equal(before.totalCap, 100, 'the room is stated in seats');
  assert.equal(before.totalSold, 0);
  assert.equal(before.totalRemaining, 100);
  assert.equal(before.tiers[tier.tierKey].sold, 0);
  assert.equal(before.tiers[tier.tierKey].remaining, 50, 'bounded by its own cap, not the bigger room');

  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 3 }] });

  const after = getAvailability(event.id);
  // Three tickets: three seats of the room, three units of the tier. With no
  // bundling in play the two counts are the same number, and that identity is
  // what "reduces exactly to the pre-bundle behaviour" means.
  assert.equal(after.totalSold, 3);
  assert.equal(after.totalRemaining, 97);
  assert.equal(after.tiers[tier.tierKey].sold, 3);
  assert.equal(after.tiers[tier.tierKey].remaining, 47);
  assert.equal(after.tiers[tier.tierKey].seatsPerUnit, 1);
});

test('with one seat per unit, a tier’s remaining is the smaller of its own cap and the whole room', () => {
  // Written as a table of literal answers rather than a formula: a test that
  // recomputed min(cap - sold, room - sold) would keep agreeing with the code
  // after somebody broke the weighting.
  const cases = [
    { room: 100, cap: 50, buy: 0, expected: 50, note: 'the tier cap binds' },
    { room: 10, cap: 50, buy: 0, expected: 10, note: 'the room binds' },
    { room: 10, cap: 50, buy: 4, expected: 6, note: 'the room binds, after a sale' },
    { room: 100, cap: 5, buy: 5, expected: 0, note: 'a tier sold out inside a room with space' },
    { room: 6, cap: 6, buy: 6, expected: 0, note: 'both exhausted at once' },
  ];
  for (const c of cases) {
    const { event, tier } = makeEventWithTier({ totalCapacity: c.room }, { cap: c.cap, seatsPerUnit: 1 });
    if (c.buy > 0) makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: c.buy }] });
    assert.equal(tierOf(event.id, tier.tierKey).remaining, c.expected, c.note);
  }
});

test('with one seat per unit, a paid order mints exactly one QR ticket per ticket bought', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 100 }, { cap: 50, seatsPerUnit: 1 });
  const { tickets } = makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 4 }] });
  assert.equal(tickets.length, 4);
  assert.equal(new Set(tickets.map((t) => t.code)).size, 4, 'four distinct codes');
});

// ---------------------------------------------------------------------------
// A Table of 8 — one booking, eight seats, eight tickets
// ---------------------------------------------------------------------------

test('a sold Table of 8 takes eight seats of the room but only one unit of its tier cap', () => {
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 80 },
    { name: 'Table of 8', cap: 10, seatsPerUnit: 8 }
  );

  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });

  const avail = getAvailability(event.id);
  assert.equal(avail.totalSold, 8, 'the room lost eight people');
  assert.equal(avail.totalRemaining, 72);
  assert.equal(avail.tiers[tier.tierKey].sold, 1, 'the tier lost one table');
  assert.equal(avail.tiers[tier.tierKey].cap, 10, 'the cap is still counted in tables');
  assert.equal(avail.tiers[tier.tierKey].remaining, 9, 'nine tables left');
});

test('a paid Table of 8 mints one QR ticket per seat, not one per booking', () => {
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 80 },
    { name: 'Table of 8', cap: 10, seatsPerUnit: 8 }
  );
  const { tickets } = makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 2 }] });
  // Each code admits ONE person for one scan, so two tables have to arrive as
  // sixteen codes or fourteen people are turned away at the door.
  assert.equal(tickets.length, 16);
  assert.equal(new Set(tickets.map((t) => t.code)).size, 16, 'sixteen distinct codes');
  assert.ok(tickets.every((t) => t.tierId === tier.tierKey), 'all of them belong to the table tier');
});

test('a table that no longer fits whole in the room is not offered — floor(seats left / seats per table)', () => {
  // 23 seats, tables of 8: two tables fit, the third does not, and 7 orphaned
  // seats are not "0.875 of a table available".
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 23 },
    { name: 'Table of 8', cap: 10, seatsPerUnit: 8 }
  );
  assert.equal(tierOf(event.id, tier.tierKey).remaining, 2, 'floor(23 / 8)');

  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 2 }] });

  const avail = getAvailability(event.id);
  assert.equal(avail.totalRemaining, 7, 'seven seats of room genuinely left');
  assert.equal(avail.tiers[tier.tierKey].remaining, 0, 'but no whole table fits in them');
  assert.equal(avail.tiers[tier.tierKey].sold, 2, 'and the tier cap of 10 is nowhere near spent');

  // And the refusal is real, not only cosmetic.
  assert.throws(
    () => claimInventory(pendingOrder(event.id, [{ tierId: tier.tierKey, quantity: 1 }]).id),
    SoldOutError
  );
});

test('the last whole table is still offered at the exact boundary', () => {
  // The mirror of the test above: 24 seats is exactly three tables, so the
  // third one must be buyable — a floor() applied one seat too eagerly would
  // strand a table the organizer can really seat.
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 24 },
    { name: 'Table of 8', cap: 10, seatsPerUnit: 8 }
  );
  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 2 }] });
  assert.equal(getAvailability(event.id).totalRemaining, 8);
  assert.equal(tierOf(event.id, tier.tierKey).remaining, 1, 'exactly one table still fits');

  const { tickets } = makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  assert.equal(tickets.length, 8);
  assert.equal(getAvailability(event.id).totalRemaining, 0, 'and the room is now exactly full');
});

test('an order is refused when its tiers each fit but their seats together do not', () => {
  // Both per-tier checks pass and only the SEAT total catches it. This is the
  // check that stops a mixed basket walking past a nearly-full room: 6 singles
  // (6 seats) plus 1 table of 5 (5 seats) is 11 people in a 10-person room.
  const event = makeEvent({
    totalCapacity: 10,
    maxPerOrder: 20,
    tiers: [
      { tierKey: 'single', cap: 100, seatsPerUnit: 1 },
      { tierKey: 'five', cap: 10, seatsPerUnit: 5 },
    ],
  });
  const avail = getAvailability(event.id);
  assert.equal(avail.tiers.single.remaining, 6 + 4, 'singles are bounded by the room');
  assert.equal(avail.tiers.five.remaining, 2, 'floor(10 / 5)');

  const order = pendingOrder(event.id, [
    { tierId: 'single', quantity: 6 },
    { tierId: 'five', quantity: 1 },
  ]);
  const err = caught(() => claimInventory(order.id), SoldOutError);
  assert.equal(err.tierId, undefined, 'the room refused it, not one of the tiers');
  assert.equal(getOrder(order.id)!.status, 'pending', 'and nothing was reserved');
});

// ---------------------------------------------------------------------------
// Races. Two orders staged while seats were free, then claimed in turn.
// ---------------------------------------------------------------------------

test('two buyers racing for the last table: exactly one wins and the other is refused', () => {
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 8 },
    { name: 'Table of 8', cap: 10, seatsPerUnit: 8 }
  );
  // Both orders exist before either claims — the window in which the checkout
  // has told both buyers the table is available.
  const first = pendingOrder(event.id, [{ tierId: tier.tierKey, quantity: 1 }]);
  const second = pendingOrder(event.id, [{ tierId: tier.tierKey, quantity: 1 }]);

  claimInventory(first.id);
  assert.throws(() => claimInventory(second.id), SoldOutError, 'the loser must fail closed');

  assert.equal(getOrder(first.id)!.status, 'claimed');
  assert.equal(getOrder(second.id)!.status, 'pending', 'the loser reserved nothing');
  const avail = getAvailability(event.id);
  assert.equal(avail.totalSold, 8, 'eight seats sold, not sixteen');
  assert.equal(avail.tiers[tier.tierKey].sold, 1, 'one table sold, not two');
});

test('two buyers racing for the last unit of a tier cap: exactly one wins', () => {
  // The ROOM has plenty of space here — only the tier's own cap is scarce, so
  // this is the tier check failing closed rather than the seat check.
  const { event, tier } = makeEventWithTier({ totalCapacity: 500 }, { cap: 1, seatsPerUnit: 1 });
  const first = pendingOrder(event.id, [{ tierId: tier.tierKey, quantity: 1 }]);
  const second = pendingOrder(event.id, [{ tierId: tier.tierKey, quantity: 1 }]);

  claimInventory(first.id);
  const err = caught(() => claimInventory(second.id), SoldOutError);
  assert.equal(err.tierId, tier.tierKey, 'the message names the tier that ran out');
  assert.equal(tierOf(event.id, tier.tierKey).sold, 1, 'the cap of 1 sold exactly once');
});

test('a race for the room’s last seats is refused even when every tier still has units left', () => {
  const event = makeEvent({
    totalCapacity: 10,
    maxPerOrder: 20,
    tiers: [
      { tierKey: 'single', cap: 100, seatsPerUnit: 1 },
      { tierKey: 'five', cap: 10, seatsPerUnit: 5 },
    ],
  });
  const first = pendingOrder(event.id, [{ tierId: 'single', quantity: 5 }]);
  const second = pendingOrder(event.id, [
    { tierId: 'single', quantity: 3 },
    { tierId: 'five', quantity: 1 },
  ]);

  claimInventory(first.id);
  // The loser's basket still passes BOTH tier checks against the live state —
  // 3 singles of 5 left, 1 table of 1 left — and is stopped only by the seats.
  const live = getAvailability(event.id);
  assert.equal(live.totalRemaining, 5);
  assert.ok(live.tiers.single.remaining >= 3);
  assert.ok(live.tiers.five.remaining >= 1);
  const err = caught(() => claimInventory(second.id), SoldOutError);
  assert.equal(err.tierId, undefined, 'refused by the room');
  assert.equal(getAvailability(event.id).totalSold, 5, 'the room never went over');
});

test('a refused claim leaves the winner’s reservation and the room untouched', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 4 }, { cap: 10, seatsPerUnit: 4 });
  const winner = pendingOrder(event.id, [{ tierId: tier.tierKey, quantity: 1 }]);
  const loser = pendingOrder(event.id, [{ tierId: tier.tierKey, quantity: 1 }]);
  claimInventory(winner.id);
  assert.throws(() => claimInventory(loser.id), SoldOutError);
  // The rolled-back transaction must not have nudged anything: a failed claim
  // that released the winner's seats would be worse than an oversell.
  assert.equal(getOrder(winner.id)!.status, 'claimed');
  assert.equal(getAvailability(event.id).totalSold, 4);
  assert.equal(getAvailability(event.id).totalRemaining, 0);
});

// ---------------------------------------------------------------------------
// The anti-hoarding ceiling's inputs — counted in SEATS
// ---------------------------------------------------------------------------

test('a first order from an address is holding nothing, so the anti-hoarding ceiling cannot refuse it', () => {
  // The ceiling is `alreadyHeld + wanted > ceiling` (api/orders). A buyer who
  // has never ordered must contribute a hard zero to that sum, or the very
  // first booking of a big tier could be turned away.
  const { event, tier } = makeEventWithTier({ totalCapacity: 200 }, { cap: 10, seatsPerUnit: 20 });
  assert.equal(heldUnpaidTicketsForEmail(event.id, 'nobody@example.test'), 0);
  assert.equal(freeTicketsForEmail(event.id, 'nobody@example.test'), 0);

  // And the biggest booking the event itself permits still goes through.
  const email = 'first-timer@example.test';
  const order = makeOrder({
    eventId: event.id,
    items: [{ tierId: tier.tierKey, quantity: 1 }],
    buyerEmail: email,
  });
  assert.equal(getOrder(order.id)!.status, 'claimed');
  assert.equal(heldUnpaidTicketsForEmail(event.id, email), 20, 'now holding a table of twenty');
});

test('an address holding an unpaid Table of 8 is holding eight seats, not one booking', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 80 }, { cap: 10, seatsPerUnit: 8 });
  const email = 'holder@example.test';
  makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 2 }], buyerEmail: email });
  // Two tables is sixteen people off the market. Counting bookings would let
  // one address quietly hold a room full of tables.
  assert.equal(heldUnpaidTicketsForEmail(event.id, email), 16);
  assert.equal(
    heldUnpaidTicketsForEmail(event.id, email.toUpperCase()),
    16,
    'the address is matched case-insensitively — capitalising it must not reset the allowance'
  );
  assert.equal(heldUnpaidTicketsForEmail(event.id, 'someone-else@example.test'), 0, 'and only that address');
});

test('a confirmed order stops counting against the unpaid ceiling', () => {
  // The ceiling is about seats held WITHOUT money. Once the money is in, the
  // seats are settled and must not go on penalising the buyer who paid.
  const { event, tier } = makeEventWithTier({ totalCapacity: 80 }, { cap: 10, seatsPerUnit: 8 });
  const email = 'paid-up@example.test';
  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], buyerEmail: email });
  assert.equal(heldUnpaidTicketsForEmail(event.id, email), 0);
  assert.equal(getAvailability(event.id).totalSold, 8, 'the seats are still gone, though');
});

test('free RSVPs count their seats against the address too', () => {
  // A free order finalizes to 'paid' instantly and nothing ever expires it, so
  // without its own seat-weighted counter one address could RSVP a whole free
  // event into "sold out".
  const { event, tier } = makeEventWithTier({ totalCapacity: 80 }, { cap: 10, priceCents: 0, seatsPerUnit: 8 });
  const email = 'rsvp@example.test';
  makePaidOrder({
    eventId: event.id,
    items: [{ tierId: tier.tierKey, quantity: 1 }],
    buyerEmail: email,
    paymentMode: 'free',
  });
  assert.equal(freeTicketsForEmail(event.id, email), 8, 'one free table is eight spots');
  assert.equal(heldUnpaidTicketsForEmail(event.id, email), 0, 'and it is not an unpaid hold');
});

// ---------------------------------------------------------------------------
// Expiry gives back exactly what was held
// ---------------------------------------------------------------------------

/**
 * Move an order's clock back. RAW SQL because there is no lib function for
 * time travel and the alternative is sleeping for a week: created_at is the
 * only input to the overdue window, and the sweep under test reads it live.
 */
function backdateOrder(orderId: string, days: number) {
  db().prepare(`UPDATE orders SET created_at = datetime('now', ?) WHERE id = ?`).run(`-${days} days`, orderId);
}

test('an expired reservation gives back exactly the seats it was holding', () => {
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 80, payWithinDays: 5 },
    { name: 'Table of 8', cap: 10, seatsPerUnit: 8 }
  );
  const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 2 }] });
  assert.equal(getAvailability(event.id).totalSold, 16, 'two tables held while the money travels');

  backdateOrder(order.id, 8); // payWithinDays 5 + 2 grace = overdue at 7
  assert.equal(expireOverdueTransferReservations(event.id), 1);

  const after = getAvailability(event.id);
  assert.equal(getOrder(order.id)!.status, 'cancelled');
  assert.equal(after.totalSold, 0, 'all sixteen seats came back — not two, and not none');
  assert.equal(after.totalRemaining, 80);
  assert.equal(after.tiers[tier.tierKey].sold, 0);
  assert.equal(after.tiers[tier.tierKey].remaining, 10, 'and both tier units are back on sale');
});

test('a reservation still inside its window keeps its seats', () => {
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 80, payWithinDays: 5 },
    { cap: 10, seatsPerUnit: 8 }
  );
  const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  backdateOrder(order.id, 6); // inside 5 + 2 days of grace
  assert.equal(expireOverdueTransferReservations(event.id), 0, 'nothing is overdue yet');
  assert.equal(getOrder(order.id)!.status, 'claimed');
  assert.equal(getAvailability(event.id).totalSold, 8, 'the seats stay held');
});

test('expiring one reservation releases nothing belonging to another', () => {
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 80, payWithinDays: 5 },
    { cap: 10, seatsPerUnit: 8 }
  );
  const stale = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  const fresh = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 3 }] });
  backdateOrder(stale.id, 9);

  assert.equal(expireOverdueTransferReservations(event.id), 1);
  assert.equal(getOrder(fresh.id)!.status, 'claimed');
  const after = getAvailability(event.id);
  assert.equal(after.totalSold, 24, 'exactly the stale order’s eight seats came back');
  assert.equal(after.tiers[tier.tierKey].sold, 3);
});

// ---------------------------------------------------------------------------
// Uncapped tiers, and an event row that still claims unlimited capacity
// ---------------------------------------------------------------------------

test('an uncapped tier is still bounded by the room, and stops claiming to be unlimited', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 12 }, { unlimited: true, cap: 0, seatsPerUnit: 1 });
  const avail = getAvailability(event.id);
  assert.equal(avail.tiers[tier.tierKey].unlimited, false, 'whatever is left in the room is a real number');
  assert.equal(avail.tiers[tier.tierKey].remaining, 12, 'and that number is the room');

  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 12 }] });
  assert.equal(tierOf(event.id, tier.tierKey).remaining, 0);
  assert.throws(
    () => claimInventory(pendingOrder(event.id, [{ tierId: tier.tierKey, quantity: 1 }]).id),
    SoldOutError,
    'an uncapped tier cannot sell past the room'
  );
});

test('an uncapped tier of tables is bounded by the whole tables the room can still hold', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 20 }, { unlimited: true, cap: 0, seatsPerUnit: 8 });
  assert.equal(tierOf(event.id, tier.tierKey).remaining, 2, 'floor(20 / 8) — not 20, and not unlimited');
  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 2 }] });
  const after = getAvailability(event.id);
  assert.equal(after.totalRemaining, 4, 'four seats of room left over');
  assert.equal(after.tiers[tier.tierKey].remaining, 0, 'and not one more table');
});

test('an event row still flagged capacity_unlimited is capped by the capacity it states', () => {
  // The column is dead (lib/db.ts forces it to 0 and nothing reads it) but it
  // still exists, and the rule is that a stray 1 in a restored dump must not
  // let an event sell past the number its fee was priced on.
  const { event, tier } = makeEventWithTier({ totalCapacity: 5 }, { cap: 100, seatsPerUnit: 1 });
  db().prepare(`UPDATE events SET capacity_unlimited = 1 WHERE id = ?`).run(event.id);

  const avail = getAvailability(event.id);
  assert.equal(avail.unlimited, false, 'the event does not report itself as uncapped');
  assert.equal(avail.totalCap, 5);
  assert.equal(avail.tiers[tier.tierKey].remaining, 5, 'the room, not the tier’s cap of 100');

  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 5 }] });
  assert.throws(
    () => claimInventory(pendingOrder(event.id, [{ tierId: tier.tierKey, quantity: 1 }]).id),
    SoldOutError,
    'the flag buys nobody an extra seat'
  );
});

// ---------------------------------------------------------------------------
// ticketState — what the badge, the button and the checkout all read
// ---------------------------------------------------------------------------

test('ticketState.remaining is in SEATS — one remaining table reads as eight people', () => {
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 24 },
    { name: 'Table of 8', cap: 10, seatsPerUnit: 8 }
  );
  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 2 }] });

  const state = ticketState(getEventById(event.id)!, getEventTiers(event.id), getAvailability(event.id));
  assert.equal(state.kind, 'on-sale');
  assert.equal(state.buyable, true);
  // The tier has ONE booking left; a visitor is told eight spots, because that
  // is how many people can still come.
  assert.equal(tierOf(event.id, tier.tierKey).remaining, 1);
  assert.equal(state.remaining, 8);
  assert.equal(state.badge, 'Only 8 left');
});

test('ticketState.remaining never overshoots the room when several tiers share the same headroom', () => {
  // Each tier's remaining is already clamped to the room, so summing them can
  // count the same free seats twice — 10 singles plus 2 tables of 5 would read
  // as 20 spots in a 10-person room.
  const event = makeEvent({
    totalCapacity: 10,
    tiers: [
      { tierKey: 'single', cap: 100, seatsPerUnit: 1 },
      { tierKey: 'five', cap: 100, seatsPerUnit: 5 },
    ],
  });
  const state = ticketState(getEventById(event.id)!, getEventTiers(event.id), getAvailability(event.id));
  assert.equal(state.remaining, 10, 'the room is the ceiling on the number a visitor is shown');
});

test('sold out is exact: on sale with the last table, sold out the moment it goes', () => {
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 16 },
    { name: 'Table of 8', cap: 10, seatsPerUnit: 8 }
  );
  const read = () => ticketState(getEventById(event.id)!, getEventTiers(event.id), getAvailability(event.id));

  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  assert.equal(read().kind, 'on-sale', 'one table left is not sold out');
  assert.equal(read().remaining, 8);

  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  const sold = read();
  assert.equal(sold.kind, 'sold-out');
  assert.equal(sold.buyable, false);
  assert.equal(sold.remaining, 0);
  assert.deepEqual(sold.soldOutNames, ['Table of 8']);
  assert.equal(sold.badge, 'Table of 8 sold out');
});

test('a room with only a part-table left reads as sold out, not as the seats it cannot sell', () => {
  // 23 seats, tables of 8: after two tables there are 7 real seats in the room
  // and nothing on sale that fits them. Advertising "Only 7 left" would send a
  // buyer to a checkout where nothing can be selected.
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 23 },
    { name: 'Table of 8', cap: 10, seatsPerUnit: 8 }
  );
  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 2 }] });

  const avail = getAvailability(event.id);
  assert.equal(avail.totalRemaining, 7, 'the room really does have seven seats');
  const state = ticketState(getEventById(event.id)!, getEventTiers(event.id), avail);
  assert.equal(state.kind, 'sold-out');
  assert.equal(state.remaining, 0, 'but none of them are buyable');
});

// ---------------------------------------------------------------------------
// lib/capacity.ts — the admin releasing more room
// ---------------------------------------------------------------------------

test('the room cannot be set below the seats already sold', () => {
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 80 },
    { name: 'Table of 8', cap: 10, seatsPerUnit: 8 }
  );
  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });

  // One BOOKING sold, eight SEATS sold. The refusal has to use the seats, or a
  // capacity of 7 would be accepted and the room would advertise a number it
  // cannot honour for people already holding tickets.
  assert.throws(() => setEventCapacity(event.id, 7, {}), CapacityError);
  const change = setEventCapacity(event.id, 8, {});
  assert.equal(change?.totalTo, 8, 'lowering to exactly the sold count is how you stop sales');
  assert.equal(getEventById(event.id)!.totalCapacity, 8);
});

test('a tier’s limit cannot be set below the bookings already sold, and says “bookings” for a bundled tier', () => {
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 80 },
    { name: 'Table of 8', cap: 10, seatsPerUnit: 8 }
  );
  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 2 }] });

  const err = caught(() => setEventCapacity(event.id, 80, { [tier.tierKey]: 1 }), CapacityError);
  // "2 tickets" would be a lie on this tier — sixteen people are sitting there.
  assert.match(err.message, /2 bookings/);
  assert.equal(getEventTiers(event.id)[0].cap, 10, 'and nothing was written');

  // Exactly the sold count is allowed, and counted in bookings.
  assert.equal(setEventCapacity(event.id, 80, { [tier.tierKey]: 2 })?.tiers[0].to, 2);
});

test('an ordinary tier’s refusal still says “tickets”', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 80 }, { cap: 10, seatsPerUnit: 1 });
  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 3 }] });
  const err = caught(() => setEventCapacity(event.id, 80, { [tier.tierKey]: 2 }), CapacityError);
  assert.match(err.message, /3 tickets/);
});

test('raising the room and the tier together puts the next table back on sale at once', () => {
  const { event, tier } = makeEventWithTier(
    { totalCapacity: 24 },
    { name: 'Table of 8', cap: 3, seatsPerUnit: 8 }
  );
  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 3 }] });
  assert.equal(getAvailability(event.id).tiers[tier.tierKey].remaining, 0, 'both limits reached at once');

  // Raising ONE of the two would look like it did nothing — that is the trap
  // lib/capacity.ts exists to close, so it always writes both.
  setEventCapacity(event.id, 32, { [tier.tierKey]: 4 });

  const after = getAvailability(event.id);
  assert.equal(after.totalRemaining, 8);
  assert.equal(after.tiers[tier.tierKey].remaining, 1, 'exactly one more table');
  const { tickets } = makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  assert.equal(tickets.length, 8, 'and it really sells');
});

test('a capacity change that moves nothing is not recorded as a change', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 50 }, { cap: 10, seatsPerUnit: 1 });
  assert.equal(setEventCapacity(event.id, 50, { [tier.tierKey]: 10 }), null);
});

// ---------------------------------------------------------------------------
// Deleted tiers — legacy rows whose seats_per_unit is gone
// ---------------------------------------------------------------------------

test('seats sold against a tier that was later deleted still occupy the room', () => {
  // The weight is gone with the row, so each unit counts as one seat — what
  // every order meant before bundles existed. What must NOT happen is the
  // seats vanishing and the room reopening for people it cannot hold.
  const { event, tier } = makeEventWithTier({ totalCapacity: 10 }, { cap: 10, seatsPerUnit: 1 });
  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 4 }] });
  db().prepare(`DELETE FROM event_tiers WHERE event_id = ? AND tier_key = ?`).run(event.id, tier.tierKey);

  const avail = getAvailability(event.id);
  assert.equal(avail.totalSold, 4, 'the four people are still coming');
  assert.equal(avail.totalRemaining, 6);
});

// ---------------------------------------------------------------------------
// Claiming, once
// ---------------------------------------------------------------------------

test('claiming an already-claimed order reserves nothing a second time', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 80 }, { cap: 10, seatsPerUnit: 8 });
  const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  assert.equal(getAvailability(event.id).totalSold, 8);
  claimInventory(order.id); // idempotent — a retried request must not double-book
  claimInventory(order.id);
  assert.equal(getAvailability(event.id).totalSold, 8, 'still one table, however often it is claimed');
});

test('a claim that cannot be honoured never mints a ticket', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 8 }, { cap: 10, seatsPerUnit: 8 });
  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  const doomed = pendingOrder(event.id, [{ tierId: tier.tierKey, quantity: 1 }]);
  assert.throws(() => claimInventory(doomed.id), SoldOutError);
  const minted = (
    db().prepare(`SELECT COUNT(*) AS n FROM tickets WHERE order_id = ?`).get(doomed.id) as { n: number }
  ).n;
  assert.equal(minted, 0, 'no QR code exists for a booking that was refused');
});

test('one tier selling out does not take the rest of the room with it', () => {
  // Tier caps do not have to add up to the room. A tier exhausted inside a
  // room with space must not read as an event with no seats.
  const event = makeEvent({
    totalCapacity: 50,
    tiers: [
      { tierKey: 'early', cap: 2, seatsPerUnit: 1, name: 'Early bird' },
      { tierKey: 'standard', cap: 40, seatsPerUnit: 1, name: 'Standard' },
    ],
  });
  makePaidOrder({ eventId: event.id, items: [{ tierId: 'early', quantity: 2 }] });

  const avail = getAvailability(event.id);
  assert.equal(avail.tiers.early.remaining, 0);
  assert.equal(avail.tiers.standard.remaining, 40);
  const state = ticketState(getEventById(event.id)!, getEventTiers(event.id), avail);
  assert.equal(state.kind, 'on-sale');
  assert.deepEqual(state.soldOutNames, ['Early bird'], 'named, so the badge can say which one went');
});

test('a payment still in flight keeps holding its seats', () => {
  // 'capturing' means money may be moving. Releasing the seats then would let
  // somebody else buy the chair out from under a buyer who is being charged.
  const { event, tier } = makeEventWithTier({ totalCapacity: 80 }, { cap: 10, seatsPerUnit: 8 });
  const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  // RAW SQL: beginCapture() is the real transition, but it belongs to the
  // PayPal path and this test is only about what the SEAT COUNT does with the
  // status once an order is in it.
  db().prepare(`UPDATE orders SET status = 'capturing' WHERE id = ?`).run(order.id);
  assert.equal(getAvailability(event.id).totalSold, 8, 'the eight seats are still off the market');
  assert.equal(getAvailability(event.id).tiers[tier.tierKey].sold, 1);
});

test('one order cannot name the same tier twice, so a claim can never check one basket line against another’s stock', () => {
  // claimInventory checks each order_items ROW against the tier's remaining
  // and only then sums the seats — so two rows for the same tier would each be
  // measured against the same stock and could pass together. The schema is
  // what makes that unreachable: order_items is keyed on (order_id, tier_id).
  // Pinned here because it is load-bearing for the claim's correctness and
  // lives nowhere near the code that relies on it.
  const { event, tier } = makeEventWithTier({ totalCapacity: 100, maxPerOrder: 20 }, { cap: 1, seatsPerUnit: 1 });
  assert.throws(
    () =>
      makeOrder({
        eventId: event.id,
        paymentMode: 'mock',
        items: [
          { tierId: tier.tierKey, quantity: 1 },
          { tierId: tier.tierKey, quantity: 1 },
        ],
      }),
    /PRIMARYKEY|UNIQUE|constraint/i
  );
});

/**
 * FAILING ON PURPOSE — a real defect, left red.
 *
 * lib/events.ts re-clamps seats_per_unit to 1..20 on EVERY read, and says
 * exactly why: "this number multiplies seat consumption and ticket minting, so
 * a hand-edited row must never be able to zero out (or explode) an event's
 * inventory arithmetic." getAvailability() and finalizePaidOrder() obey that,
 * because they read tiers through getEventTiers/getEventTier.
 *
 * The two anti-hoarding counters do not. heldUnpaidTicketsForEmail() and
 * freeTicketsForEmail() (lib/orders.ts) multiply by the raw column in SQL —
 * `COALESCE(et.seats_per_unit, 1)` — with no clamp. So on a row the clamp was
 * written for, the ceiling that is supposed to protect the room disagrees with
 * the room itself: a 0 makes every hold count as nothing (one address may then
 * hold the whole event), and a value above 20 inflates a single booking past
 * what the room ever counted (refusing buyers who are holding nothing).
 *
 * The fix belongs in the SQL, not here: clamp in the query
 * (MIN(20, MAX(1, ...))) or read the seats through getEventTiers, the way the
 * rest of the seat arithmetic does.
 */
test('a tier’s seats-per-booking is re-clamped wherever it is read, so the seat counters cannot disagree with the room', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 100 }, { cap: 10, seatsPerUnit: 8 });
  const email = 'clamped@example.test';
  makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], buyerEmail: email });
  assert.equal(heldUnpaidTicketsForEmail(event.id, email), 8, 'the honest row agrees, as it must');

  // RAW SQL on purpose: this is the corrupt/restored row the clamp exists for.
  // The portal's own writer already validates 1..20, so nothing else can put
  // these values here — which is precisely why the READERS have to.
  const setSeats = (n: number) =>
    db().prepare(`UPDATE event_tiers SET seats_per_unit = ? WHERE event_id = ?`).run(n, event.id);

  setSeats(0);
  assert.equal(getEventTiers(event.id)[0].seatsPerUnit, 1, 'the tier reader clamps 0 up to 1');
  assert.equal(getAvailability(event.id).totalSold, 1, 'and the room counts the booking as one seat');
  assert.equal(
    heldUnpaidTicketsForEmail(event.id, email),
    1,
    'so the ceiling must count one seat too — a 0 here lets one address hold the whole room'
  );

  setSeats(100);
  assert.equal(getEventTiers(event.id)[0].seatsPerUnit, 20, 'the tier reader clamps 100 down to 20');
  assert.equal(getAvailability(event.id).totalSold, 20, 'the room counts twenty seats');
  assert.equal(
    heldUnpaidTicketsForEmail(event.id, email),
    20,
    'so the ceiling must count twenty — 100 refuses buyers over seats the room never sold'
  );
});

// ---------------------------------------------------------------------------
// tiersInSaleOrder — what a buyer meets first
// ---------------------------------------------------------------------------

test('sold-out types sink below the ones still selling', () => {
  const event = makeEvent({
    totalCapacity: 100,
    tiers: [
      { tierKey: 'early', cap: 1 },
      { tierKey: 'standard', cap: 50 },
      { tierKey: 'door', cap: 50 },
    ],
  });
  // The early bird — created FIRST, so stored first — sells out.
  makePaidOrder({ eventId: event.id, items: [{ tierId: 'early', quantity: 1 }] });

  const order = tiersInSaleOrder(getEventTiers(event.id), getAvailability(event.id)).map(
    (t) => t.tierKey
  );
  assert.deepEqual(order, ['standard', 'door', 'early']);
});

test('the organizer’s own order survives inside each group', () => {
  const event = makeEvent({
    totalCapacity: 100,
    tiers: [
      { tierKey: 'early', cap: 1 },
      { tierKey: 'standard', cap: 50 },
      { tierKey: 'vip', cap: 1 },
      { tierKey: 'door', cap: 50 },
    ],
  });
  makePaidOrder({ eventId: event.id, items: [{ tierId: 'early', quantity: 1 }] });
  makePaidOrder({ eventId: event.id, items: [{ tierId: 'vip', quantity: 1 }] });

  const order = tiersInSaleOrder(getEventTiers(event.id), getAvailability(event.id)).map(
    (t) => t.tierKey
  );
  // Available in stored order, then the two gone ones in stored order.
  assert.deepEqual(order, ['standard', 'door', 'early', 'vip']);
});

test('announced types sit between what is buyable and what has gone', () => {
  const event = makeEvent({
    totalCapacity: 100,
    tiers: [
      { tierKey: 'early', cap: 1 },
      { tierKey: 'later', cap: 20, status: 'coming-soon' },
      { tierKey: 'standard', cap: 50 },
      { tierKey: 'secret', cap: 10, status: 'hidden' },
    ],
  });
  makePaidOrder({ eventId: event.id, items: [{ tierId: 'early', quantity: 1 }] });

  const order = tiersInSaleOrder(getEventTiers(event.id), getAvailability(event.id)).map(
    (t) => t.tierKey
  );
  assert.deepEqual(order, ['standard', 'later', 'early'], 'hidden types stay off the page');
});

test('without availability the list is stored order minus the hidden rows', () => {
  const event = makeEvent({
    totalCapacity: 100,
    tiers: [
      { tierKey: 'early', cap: 10 },
      { tierKey: 'secret', cap: 10, status: 'hidden' },
      { tierKey: 'standard', cap: 10 },
    ],
  });
  const order = tiersInSaleOrder(getEventTiers(event.id)).map((t) => t.tierKey);
  assert.deepEqual(order, ['early', 'standard']);
});
