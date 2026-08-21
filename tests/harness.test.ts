/**
 * The harness testing itself.
 *
 * Fixtures rot silently: a builder that stops reaching the real lib function,
 * or a "fresh" database that quietly carries rows over from the last file,
 * turns every suite built on it into a suite that passes for the wrong reason.
 * These checks fail loudly when that happens.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

import { db, makeEvent, makeEventWithTier, makeOrganizer, makePaidOrder, makeOrder, makePromo, makeTier } from './helpers.ts';
import { getAvailability } from '../src/lib/inventory.ts';
import { getEventTiers } from '../src/lib/events.ts';
import { getOrderItems, getTicketsForOrder } from '../src/lib/orders.ts';
import { effectivePayout } from '../src/lib/payout.ts';
import { previewDiscountCode } from '../src/lib/promos.ts';
import { discountCentsFor } from '../src/lib/money.ts';

test('the database is a throwaway, not the real one', () => {
  const file = db().name;
  assert.ok(
    path.resolve(file).includes('ticket-counter-test-'),
    `expected a temp database, got ${file}`
  );
  assert.ok(!path.resolve(file).includes(`${path.sep}ticket counter${path.sep}data`), 'must not be the repo database');
  assert.equal(path.dirname(file), process.env.DATA_DIR);
  assert.ok(path.resolve(process.cwd()).startsWith(path.resolve(os.tmpdir())) ||
            path.resolve(process.cwd()).startsWith('/private'), 'cwd is inside the sandbox');
});

test('the platform starts EMPTY — real migrations ran, nothing was seeded', () => {
  // The migration imports event.config.json as a first event when a database
  // has none. tests/register.mjs moves cwd out of the repo precisely so that
  // does not happen; if this ever fails, every suite is starting with a stray
  // published event it did not ask for.
  const count = (t: string) => (db().prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  assert.equal(count('organizers'), 0);
  assert.equal(count('events'), 0);
  assert.equal(count('orders'), 0);
  assert.equal(count('promo_codes'), 0, 'a table only the later migrations create');
});

test('makeOrganizer goes through the real createOrganizer', () => {
  const o = makeOrganizer({ name: 'Kathmandu Nights' });
  assert.equal(o.name, 'Kathmandu Nights');
  assert.equal(o.status, 'active');
  assert.equal(o.hasPassword, true, 'the real constructor sets an initial password');
  assert.equal(o.mustChangePassword, true, 'which the organizer must replace at first login');
  assert.notEqual(makeOrganizer().email, makeOrganizer().email, 'fixtures do not collide');
});

test('makeEvent writes a row the real readers understand', () => {
  const event = makeEvent({ kind: 'shop', name: 'Momo Stall', totalCapacity: 42 });
  assert.equal(event.kind, 'shop');
  assert.equal(event.name, 'Momo Stall');
  assert.equal(event.totalCapacity, 42);
  assert.equal(event.currency, 'EUR');
  assert.equal(event.salesOpen, true);
});

test('makeEvent({payout}) lands where lib/payout reads it', () => {
  const event = makeEvent({
    payout: { bankAccountHolder: 'Asha Rai', bankIban: 'DE02120300000000202051', paypalAccount: 'asha@example.test' },
  });
  const account = effectivePayout(event);
  assert.equal(account.holder, 'Asha Rai');
  assert.equal(account.iban, 'DE02120300000000202051');
  assert.equal(account.paypal, 'asha@example.test');
});

test('makeTier feeds the real availability calculation', () => {
  const event = makeEvent({ totalCapacity: 100 });
  makeTier(event.id, { tierKey: 'early', name: 'Early bird', priceCents: 1500, cap: 10 }, 0);
  makeTier(event.id, { tierKey: 'table', name: 'Table of 8', priceCents: 9000, cap: 3, seatsPerUnit: 8 }, 1);

  const tiers = getEventTiers(event.id);
  assert.deepEqual(tiers.map((t) => t.tierKey), ['early', 'table']);
  assert.equal(tiers[1].seatsPerUnit, 8);

  const avail = getAvailability(event.id);
  assert.equal(avail.tiers['early'].remaining, 10);
  assert.equal(avail.tiers['table'].remaining, 3);
  assert.equal(avail.totalRemaining, 100);
});

test('makePaidOrder runs the whole real path: create, reserve, settle', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 50 }, { priceCents: 2000, cap: 20 });
  const { order, tickets } = makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 3 }] });

  assert.equal(order.status, 'paid');
  assert.equal(order.totalCents, 6000, 'priced from the tier, not from the fixture');
  assert.ok(order.paidAt, 'finalizePaidOrder stamped it');
  assert.equal(tickets.length, 3, 'one QR ticket per person');
  assert.equal(getTicketsForOrder(order.id).length, 3);
  assert.deepEqual(getOrderItems(order.id).map((i) => i.quantity), [3]);

  const avail = getAvailability(event.id);
  assert.equal(avail.tiers[tier.tierKey].remaining, 17, 'a paid order really consumed inventory');
});

test('makePaidOrder mints one ticket per SEAT for a bundled tier', () => {
  const { event, tier } = makeEventWithTier({ totalCapacity: 80 }, { priceCents: 9000, cap: 5, seatsPerUnit: 8 });
  const { tickets } = makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 2 }] });
  assert.equal(tickets.length, 16, 'two tables of eight admit sixteen people');
  assert.equal(getAvailability(event.id).totalRemaining, 80 - 16, 'the room is counted in seats');
});

test('makeOrder reserves seats for a transfer, but not for a PayPal checkout', () => {
  // createOrder claims inventory itself for 'transfer' and 'free' — the seats
  // are held while the money travels. A PayPal order stays pending until the
  // capture step claims it. The fixture does not paper over the difference.
  const transfer = makeEventWithTier({}, { cap: 5 });
  const held = makeOrder({
    eventId: transfer.event.id,
    items: [{ tierId: transfer.tier.tierKey, quantity: 2 }],
    paymentMode: 'transfer',
  });
  assert.equal(held.status, 'claimed');
  assert.equal(getAvailability(transfer.event.id).tiers[transfer.tier.tierKey].remaining, 3);

  const paypal = makeEventWithTier({}, { cap: 5 });
  const pending = makeOrder({
    eventId: paypal.event.id,
    items: [{ tierId: paypal.tier.tierKey, quantity: 2 }],
    paymentMode: 'paypal',
  });
  assert.equal(pending.status, 'pending');
  assert.equal(getAvailability(paypal.event.id).tiers[paypal.tier.tierKey].remaining, 5, 'nothing reserved yet');
});

test('makePromo produces a code the real checkout preview accepts', () => {
  const organizer = makeOrganizer();
  const event = makeEvent({ organizerId: organizer.id });
  const promo = makePromo(organizer.id, { code: 'DASHAIN10', kind: 'percent', percent: 10 });
  assert.equal(promo.code, 'DASHAIN10');

  const preview = previewDiscountCode({ id: event.id, organizerId: organizer.id }, 'dashain 10');
  assert.equal(preview.code, 'DASHAIN10', 'the preview is forgiving about how it was typed');
  assert.equal(preview.source, 'promo');
  // The preview quotes the code, not an amount; the checkout puts the two
  // together with the same arithmetic the order will use.
  assert.equal(discountCentsFor(preview, 1999), 200, 'the same rounding lib/money does');
});

test('a discount code claimed by makePaidOrder is really spent', () => {
  const organizer = makeOrganizer();
  const { event, tier } = makeEventWithTier({ organizerId: organizer.id }, { priceCents: 2000, cap: 10 });
  makePromo(organizer.id, { code: 'ONCEONLY1', kind: 'fixed', percent: 0, amountCents: 500, maxRedemptions: 1 });

  const { order } = makePaidOrder({
    eventId: event.id,
    items: [{ tierId: tier.tierKey, quantity: 1 }],
    voucherCode: 'ONCEONLY1',
  });
  assert.equal(order.discountCents, 500);
  assert.equal(order.totalCents, 1500);
  assert.equal(order.voucherCode, 'ONCEONLY1');

  assert.throws(
    () =>
      makePaidOrder({
        eventId: event.id,
        items: [{ tierId: tier.tierKey, quantity: 1 }],
        voucherCode: 'ONCEONLY1',
      }),
    /code/i,
    'the cap of one was really enforced'
  );
});
