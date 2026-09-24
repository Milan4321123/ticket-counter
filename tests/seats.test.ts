// Reserved seating (lib/seats): the map, the picks, and one seat per order.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  holdSeats,
  normaliseSeatMap,
  rowLabel,
  SeatTakenError,
  seatCountsByTier,
  seatSummary,
  sectionSeats,
  syncSeatedCaps,
  takenSeats,
  tierOfSeat,
  validateSeatPicks,
} from '../src/lib/seats.ts';
import { getEventTiers } from '../src/lib/events.ts';
import { createOrder, markOrderFailed } from '../src/lib/orders.ts';
import { db, makeEvent } from './helpers.ts';

process.env.PAYMENT_MODE = 'transfer';

const MAP = {
  enabled: true,
  stageLabel: 'Stage',
  sections: [
    { id: 'VIP', name: 'VIP', tierKey: 'vip', rows: 1, seatsPerRow: 4, firstRow: 'A', aislesAfter: [2], blocked: ['VIP-A-4'] },
    { id: 'STD', name: 'Standard', tierKey: 'std', rows: 2, seatsPerRow: 5, firstRow: 'B', aislesAfter: [], blocked: [] },
  ],
};

function seatedEvent() {
  const event = makeEvent({
    tiers: [
      { tierKey: 'vip', priceCents: 4000, cap: 99 },
      { tierKey: 'std', priceCents: 2000, cap: 99 },
      { tierKey: 'table', priceCents: 10000, cap: 5, seatsPerUnit: 4 },
    ],
  });
  const map = normaliseSeatMap(MAP, ['vip', 'std'])!;
  db().prepare(`UPDATE events SET seat_map = ? WHERE id = ?`).run(JSON.stringify(map), event.id);
  syncSeatedCaps(event.id, map, getEventTiers(event.id));
  return { event, map };
}

describe('the seat map', () => {
  it('lays out rows (skipping I and O), blocks seats, and sets caps from seat counts', () => {
    assert.equal(rowLabel('H', 1), 'J');
    const { event, map } = seatedEvent();
    assert.deepEqual(sectionSeats(map.sections[0]).map((s) => s.id), ['VIP-A-1', 'VIP-A-2', 'VIP-A-3']);
    assert.deepEqual(Object.fromEntries(seatCountsByTier(map)), { vip: 3, std: 10 });
    const caps = Object.fromEntries(getEventTiers(event.id).map((t) => [t.tierKey, t.cap]));
    assert.deepEqual(caps, { vip: 3, std: 10, table: 5 });
    assert.equal(tierOfSeat(map, 'STD-C-5'), 'std');
    assert.equal(tierOfSeat(map, 'VIP-A-4'), null, 'a blocked seat is not for sale');
    assert.equal(normaliseSeatMap({ sections: [{ id: 'X', tierKey: 'nope', rows: 1, seatsPerRow: 1 }] }, ['vip']), null);
  });

  it('checks picks against quantities, the map, and what is taken', () => {
    const { event, map } = seatedEvent();
    const items = [{ tierId: 'std', quantity: 2 }];
    assert.deepEqual(validateSeatPicks(event.id, map, items, ['STD-B-1', 'STD-B-2']), ['STD-B-1', 'STD-B-2']);
    assert.match(String(validateSeatPicks(event.id, map, items, ['STD-B-1'])), /every ticket/);
    assert.match(String(validateSeatPicks(event.id, map, items, ['STD-B-1', 'VIP-A-1'])), /every ticket/);
    assert.match(String(validateSeatPicks(event.id, map, items, ['STD-B-1', 'STD-Z-9'])), /does not exist/);
    assert.deepEqual(validateSeatPicks(event.id, map, [{ tierId: 'table', quantity: 1 }], []), [], 'unseated types need no seats');
  });

  it('sells each seat once, and frees it when the order dies', () => {
    const { event, map } = seatedEvent();
    const first = createOrder({ eventId: event.id, buyerName: 'A', buyerEmail: 'a@x.de', items: [{ tierId: 'std', quantity: 1 }], paymentMode: 'transfer' });
    holdSeats(event.id, first.id, ['STD-B-3']);
    assert.equal(takenSeats(event.id).get('STD-B-3'), 'held');

    const second = createOrder({ eventId: event.id, buyerName: 'B', buyerEmail: 'b@x.de', items: [{ tierId: 'std', quantity: 1 }], paymentMode: 'transfer' });
    assert.throws(() => holdSeats(event.id, second.id, ['STD-B-3']), SeatTakenError);
    assert.match(String(validateSeatPicks(event.id, map, [{ tierId: 'std', quantity: 1 }], ['STD-B-3'])), /just taken/);

    markOrderFailed(first.id, 'cancelled');
    assert.equal(takenSeats(event.id).has('STD-B-3'), false, 'a dead order holds nothing');
    holdSeats(event.id, second.id, ['STD-B-3']);
    assert.equal(takenSeats(event.id).get('STD-B-3'), 'held');
  });

  it('reads seats back in order', () => {
    const { map } = seatedEvent();
    assert.equal(seatSummary(['STD-B-10', 'STD-B-9', 'STD-B-8'], map), 'Standard: row B, seats 8–10');
    assert.equal(seatSummary(['VIP-A-3', 'VIP-A-1'], map), 'VIP: row A, seats 1, 3');
  });
});
