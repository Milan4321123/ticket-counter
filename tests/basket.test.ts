// The cross-seller basket (lib/basket): only what needs nothing but a quantity.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { basketLineFor } from '../src/lib/basket.ts';
import { getEventById, getEventTiers } from '../src/lib/events.ts';
import { db, makeEvent } from './helpers.ts';

process.env.PAYMENT_MODE = 'transfer';

function first(id: string) {
  return { event: getEventById(id)!, tier: getEventTiers(id)[0] };
}

describe('what can go in the basket', () => {
  it('a plain shop item or ticket, with its seller and price', () => {
    const s = makeEvent({ kind: 'shop', tiers: [{ tierKey: 'tea', priceCents: 900, cap: 20 }] });
    const { event, tier } = first(s.id);
    const line = basketLineFor(event, tier, 'Asha', null)!;
    assert.equal(line.key, `${s.id}:tea`);
    assert.equal(line.priceCents, 900);
    assert.equal(line.seller, 'Asha');
    assert.equal(line.max, event.maxPerOrder);
  });

  it('not when the checkout needs more than a quantity', () => {
    const slots = makeEvent({ kind: 'shop', tiers: [{ tierKey: 'momo', priceCents: 900, cap: 20 }] });
    db().prepare(`UPDATE events SET pickup_slots = ? WHERE id = ?`).run(JSON.stringify({ enabled: true, days: [1], start: '10:00', end: '12:00', stepMin: 30, perSlot: 2, leadMin: 0, daysAhead: 2 }), slots.id);
    assert.equal(basketLineFor(first(slots.id).event, first(slots.id).tier, 'A', null), null, 'collection times');

    const choices = makeEvent({ kind: 'shop', tiers: [{ tierKey: 'momo', priceCents: 900, cap: 20 }] });
    db().prepare(`UPDATE event_tiers SET choices = ? WHERE event_id = ?`).run(JSON.stringify([{ name: 'Spice', options: ['Mild', 'Hot'] }]), choices.id);
    assert.equal(basketLineFor(first(choices.id).event, first(choices.id).tier, 'A', null), null, 'item choices');

    const free = makeEvent({ kind: 'event', tiers: [{ tierKey: 'rsvp', priceCents: 0, cap: 20 }] });
    assert.equal(basketLineFor(first(free.id).event, first(free.id).tier, 'A', null), null, 'free RSVPs');
  });

  it('not when the seller takes no bank transfer', () => {
    const s = makeEvent({ kind: 'shop', tiers: [{ tierKey: 'tea', priceCents: 900, cap: 20 }] });
    db().prepare(`UPDATE events SET pay_transfer = 0 WHERE id = ?`).run(s.id);
    assert.equal(basketLineFor(first(s.id).event, first(s.id).tier, 'A', null), null);
  });
});

describe('basket runs', async () => {
  const { addOrderToBasketRun, basketRunOrderIds, createBasketRun, basketRunPath } = await import('../src/lib/basket.ts');

  it('collect the orders of one checkout, once each', () => {
    const run = createBasketRun();
    assert.match(run, /^[A-Za-z0-9_-]{24,64}$/);
    assert.deepEqual(basketRunOrderIds(run), []);
    assert.equal(addOrderToBasketRun(run, 'order-a'), true);
    assert.equal(addOrderToBasketRun(run, 'order-b'), true);
    assert.equal(addOrderToBasketRun(run, 'order-a'), true);
    assert.deepEqual(basketRunOrderIds(run), ['order-a', 'order-b']);
    assert.equal(basketRunPath(run), `/basket/done?run=${run}`);
  });

  it('refuse made-up or malformed runs', () => {
    assert.equal(basketRunOrderIds('A'.repeat(32)), null, 'unknown');
    assert.equal(basketRunOrderIds('../../etc'), null, 'malformed');
    assert.equal(addOrderToBasketRun('A'.repeat(32), 'order-x'), false);
  });

  it('stop at twenty orders', () => {
    const run = createBasketRun();
    for (let i = 0; i < 20; i++) assert.equal(addOrderToBasketRun(run, `o${i}`), true);
    assert.equal(addOrderToBasketRun(run, 'one-too-many'), false);
  });
});
