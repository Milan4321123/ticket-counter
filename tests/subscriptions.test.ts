// Subscribe & save (lib/subscriptions): the discount, the repeats, the stops.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  actOnSubscription,
  createSubscription,
  getSubscription,
  placeRepeat,
  subscriptionOffer,
} from '../src/lib/subscriptions.ts';
import { getEventById } from '../src/lib/events.ts';
import { createOrder, finalizePaidOrder, getOrder, markOrderFailed } from '../src/lib/orders.ts';
import { subscribeDiscountCents } from '../src/lib/money.ts';
import { db, makeEvent } from './helpers.ts';

process.env.PAYMENT_MODE = 'transfer';

function shop(pct = 10) {
  const s = makeEvent({ kind: 'shop', tiers: [{ tierKey: 'tea', priceCents: 1250, cap: 100 }] });
  db().prepare(`UPDATE events SET subscribe_pct = ? WHERE id = ?`).run(pct, s.id);
  return getEventById(s.id)!;
}

function subscribe(eventId: string, pct = 10) {
  const first = createOrder({
    eventId,
    buyerName: 'Sita',
    buyerEmail: 'sita@example.de',
    items: [{ tierId: 'tea', quantity: 2 }],
    paymentMode: 'transfer',
    subscriptionPct: pct,
  });
  const sub = createSubscription({
    eventId,
    buyerName: 'Sita',
    buyerEmail: 'sita@example.de',
    items: [{ tierId: 'tea', quantity: 2 }],
    choices: null,
    note: '',
    everyDays: 14,
    discountPct: pct,
    firstOrderId: first.id,
  });
  return { first, sub };
}

describe('Subscribe & save', () => {
  it('takes the percentage off, rounded in the buyer’s favour, and links the order', () => {
    assert.equal(subscribeDiscountCents(10, 2500), 250);
    assert.equal(subscribeDiscountCents(15, 999), 150);
    const s = shop(10);
    const { first, sub } = subscribe(s.id);
    assert.equal(first.discountCents, 250);
    assert.equal(first.totalCents, 2250);
    assert.equal(getOrder(first.id)!.subscriptionId, sub.id);
  });

  it('is only offered by a shop that switched it on', () => {
    assert.equal(subscriptionOffer(shop(0)), null);
    assert.deepEqual(subscriptionOffer(shop(10)), { pct: 10 });
    assert.equal(subscriptionOffer(makeEvent({ kind: 'event' })), null);
  });

  it('never combines with a discount code', () => {
    const s = shop(10);
    assert.throws(
      () =>
        createOrder({
          eventId: s.id,
          buyerName: 'A',
          buyerEmail: 'a@example.de',
          items: [{ tierId: 'tea', quantity: 1 }],
          paymentMode: 'transfer',
          subscriptionPct: 10,
          voucherCode: 'ANYCODE1',
        }),
      /cannot be combined/
    );
  });

  it('places a repeat only once the last order was paid, at the frozen percentage', () => {
    const s = shop(10);
    const { first, sub } = subscribe(s.id);
    const today = sub.nextOn;

    // Unpaid: no second reservation on top — just moves on a cycle.
    assert.equal(placeRepeat(getSubscription(sub.id)!, today).outcome, 'waiting-for-payment');
    assert.ok(getSubscription(sub.id)!.nextOn > today);

    finalizePaidOrder(first.id, null);
    // The seller lowering the offer later does not change this subscriber's price.
    db().prepare(`UPDATE events SET subscribe_pct = 5 WHERE id = ?`).run(s.id);
    const due = getSubscription(sub.id)!;
    const r = placeRepeat(due, due.nextOn);
    assert.equal(r.outcome, 'ordered');
    const repeat = getOrder(r.orderId!)!;
    assert.equal(repeat.discountCents, 250);
    assert.equal(repeat.paymentMode, 'transfer');
    assert.equal(repeat.status, 'claimed', 'the items are held');
    assert.equal(getSubscription(sub.id)!.ordersMade, 2);

    // The same due date cannot be placed twice.
    assert.equal(placeRepeat(due, due.nextOn).outcome, 'skipped');
  });

  it('pauses when the last order was never paid, or the shop turns it off', () => {
    const s = shop(10);
    const { first, sub } = subscribe(s.id);
    markOrderFailed(first.id, 'cancelled');
    assert.equal(placeRepeat(getSubscription(sub.id)!, sub.nextOn).outcome, 'paused');
    assert.equal(getSubscription(sub.id)!.status, 'paused');

    const s2 = shop(10);
    const b = subscribe(s2.id);
    finalizePaidOrder(b.first.id, null);
    db().prepare(`UPDATE events SET subscribe_pct = 0 WHERE id = ?`).run(s2.id);
    assert.equal(placeRepeat(getSubscription(b.sub.id)!, b.sub.nextOn).outcome, 'paused');
  });

  it('lets the buyer skip, pause, resume and cancel with the token', () => {
    const s = shop(10);
    const { sub } = subscribe(s.id);
    const skipped = actOnSubscription(sub.token, 'skip');
    assert.ok(typeof skipped !== 'string' && skipped.nextOn > sub.nextOn);
    assert.equal((actOnSubscription(sub.token, 'pause') as { status: string }).status, 'paused');
    assert.equal((actOnSubscription(sub.token, 'resume') as { status: string }).status, 'active');
    assert.equal((actOnSubscription(sub.token, 'cancel') as { status: string }).status, 'cancelled');
    assert.equal(typeof actOnSubscription(sub.token, 'resume'), 'string', 'a cancelled one stays cancelled');
    assert.equal(typeof actOnSubscription('not-a-real-token-at-all-xx', 'skip'), 'string');
  });
});
