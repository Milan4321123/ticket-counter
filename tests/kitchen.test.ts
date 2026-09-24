// The restaurant pack (lib/kitchen): slots, choices, tables and the board.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  availableSlots,
  choicesFromText,
  choicesToText,
  cleanTableLabel,
  listKitchenTickets,
  normaliseSlotConfig,
  parseChoices,
  setKitchenStatus,
  setOrderKitchenDetails,
  shopNow,
  slotIsBookable,
  validatePicks,
} from '../src/lib/kitchen.ts';
import { getEventById, getEventTiers } from '../src/lib/events.ts';
import { createOrder, finalizePaidOrder } from '../src/lib/orders.ts';
import { db, makeEvent } from './helpers.ts';

process.env.PAYMENT_MODE = 'transfer';

function shopWithSlots(perSlot = 2) {
  const shop = makeEvent({ kind: 'shop', tiers: [{ tierKey: 'momo', priceCents: 900, cap: 100 }, { tierKey: 'roti', priceCents: 700, cap: 100 }] });
  db()
    .prepare(`UPDATE events SET pickup_slots = ? WHERE id = ?`)
    .run(JSON.stringify({ enabled: true, days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:30', stepMin: 30, perSlot, leadMin: 0, daysAhead: 2 }), shop.id);
  db()
    .prepare(`UPDATE event_tiers SET choices = ? WHERE event_id = ? AND tier_key = 'momo'`)
    .run(JSON.stringify([{ name: 'Spice', options: ['Mild', 'Hot'] }]), shop.id);
  return getEventById(shop.id)!;
}

describe('collection slots', () => {
  it('offers slots only when switched on, and fills them up', () => {
    const off = makeEvent({ kind: 'shop' });
    assert.deepEqual(availableSlots(off), []);

    const shop = shopWithSlots(2);
    const days = availableSlots(shop);
    assert.ok(days.length >= 1);
    const tomorrow = days.find((d) => d.label === 'Tomorrow')!;
    const slot = tomorrow.slots[0].value;
    assert.match(slot, /^\d{4}-\d{2}-\d{2}T00:00$/);
    assert.equal(slotIsBookable(shop, slot), true);

    for (let i = 0; i < 2; i++) {
      const order = createOrder({ eventId: shop.id, buyerName: 'B', buyerEmail: `b${i}@x.de`, items: [{ tierId: 'roti', quantity: 1 }], paymentMode: 'transfer' });
      setOrderKitchenDetails(order.id, { pickupSlot: slot, tableLabel: '', note: '', choices: {} });
    }
    assert.equal(slotIsBookable(shop, slot), false, 'a full slot cannot be booked');
    assert.equal(slotIsBookable(shop, '2000-01-01T12:00'), false, 'a made-up slot is refused');
  });

  it('refuses a config that closes before it opens, and keeps sane values', () => {
    assert.equal(normaliseSlotConfig({ start: '18:00', end: '10:00' }), null);
    const c = normaliseSlotConfig({ enabled: true, days: [9, 1, 1], stepMin: 7, perSlot: -3 })!;
    assert.deepEqual(c.days, [1]);
    assert.equal(c.stepMin, 30);
    assert.equal(c.perSlot, 6);
  });

  it('reads the wall clock in Germany', () => {
    // 2026-01-15 23:30 UTC is already 00:30 on the 16th in Berlin (CET, +1).
    const t = shopNow(new Date('2026-01-15T23:30:00Z'));
    assert.equal(t.date, '2026-01-16');
    assert.equal(t.min, 30);
  });
});

describe('item choices', () => {
  it('parses the editor text and round-trips it', () => {
    const groups = choicesFromText('Spice: Mild, Medium, Hot\nDip: Tomato, Sesame');
    assert.ok(Array.isArray(groups));
    assert.equal(choicesToText(groups as never), 'Spice: Mild, Medium, Hot\nDip: Tomato, Sesame');
    assert.match(String(choicesFromText('Spice Mild Hot')), /Name: option/);
    assert.match(String(choicesFromText('Spice: Mild')), /at least two/);
    assert.deepEqual(parseChoices('not json'), []);
  });

  it('requires one real option per group, and drops anything else', () => {
    const shop = shopWithSlots();
    assert.match(String(validatePicks(shop.id, ['momo'], {})), /choose spice/i);
    assert.match(String(validatePicks(shop.id, ['momo'], { momo: { Spice: 'Nuclear' } })), /choose spice/i);
    assert.deepEqual(validatePicks(shop.id, ['momo', 'roti'], { momo: { Spice: 'Hot', Extra: 'x' }, roti: { a: 'b' } }), {
      momo: { Spice: 'Hot' },
    });
  });
});

describe('tables and the kitchen board', () => {
  it('keeps table labels short and plain', () => {
    assert.equal(cleanTableLabel('12'), '12');
    assert.equal(cleanTableLabel('Patio 3'), 'Patio 3');
    assert.equal(cleanTableLabel('<script>'), '');
    assert.equal(cleanTableLabel(['1']), '');
  });

  it('shows paid orders only, and moves them through the stages', () => {
    const shop = shopWithSlots();
    const unpaid = createOrder({ eventId: shop.id, buyerName: 'Unpaid', buyerEmail: 'u@x.de', items: [{ tierId: 'roti', quantity: 1 }], paymentMode: 'transfer' });
    const paid = createOrder({ eventId: shop.id, buyerName: 'Paid', buyerEmail: 'p@x.de', items: [{ tierId: 'momo', quantity: 2 }], paymentMode: 'transfer' });
    setOrderKitchenDetails(paid.id, { pickupSlot: null, tableLabel: '4', note: 'no onion', choices: { momo: { Spice: 'Hot' } } });
    finalizePaidOrder(paid.id, null);

    let board = listKitchenTickets(getEventById(shop.id)!, getEventTiers(shop.id));
    assert.deepEqual(board.map((t) => t.buyerName), ['Paid']);
    assert.equal(board[0].status, 'new');
    assert.equal(board[0].tableLabel, '4');
    assert.equal(board[0].items[0].picks, 'Hot');

    assert.equal(setKitchenStatus(shop.id, paid.id, 'ready'), true);
    assert.equal(setKitchenStatus(shop.id, unpaid.id, 'ready'), false, 'an unpaid order never moves');
    const other = makeEvent({ kind: 'shop' });
    assert.equal(setKitchenStatus(other.id, paid.id, 'cooking'), false, 'nor does another shop’s order');
    board = listKitchenTickets(getEventById(shop.id)!, getEventTiers(shop.id));
    assert.equal(board[0].status, 'ready');
  });
});
