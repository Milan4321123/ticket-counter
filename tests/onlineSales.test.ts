/**
 * Show night: online sales close before the start and the counter takes over
 * (lib/onlineSales.ts, its ticketState branch, and the orders route's refusal).
 *
 * The rule a buyer meets is "after the cutoff, Get tickets says buy at the
 * counter, and the website will not sell". Each test names one promise that
 * rule makes — when the cutoff falls, what wins when two switches disagree, and
 * that the refusal is enforced by the server rather than only drawn on the page.
 *
 * Times are fixed instants wherever the lib takes `at`, so nothing here depends
 * on when the suite happens to run. 24 Oct 2026 is still summer time in Germany
 * (CEST, UTC+2 — the clocks go back on the 25th), so 18:00 there is 16:00Z.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEventWithTier, makePaidOrder } from './helpers.ts';
import { POST } from '../src/app/api/orders/route.ts';
import { getEventById, getEventTiers, type EventRow } from '../src/lib/events.ts';
import { getAvailability } from '../src/lib/inventory.ts';
import { onlineRefusal, onlineSales, startFromText, wallClockLabel, type OnlineSalesInput } from '../src/lib/onlineSales.ts';
import { ticketState, tierBadge } from '../src/lib/ticketState.ts';

process.env.PAYMENT_MODE = 'transfer';

const SHOW_DAY = '2026-10-24';
/** An instant given as Berlin wall-clock time on SHOW_DAY (CEST, UTC+2). */
const berlin = (hhmm: string, date = SHOW_DAY) => new Date(`${date}T${hhmm}:00+02:00`);

function input(over: Partial<OnlineSalesInput> = {}): OnlineSalesInput {
  return {
    kind: 'event',
    eventDate: SHOW_DAY,
    dateDisplay: '',
    showTime: '19:00',
    onlineCloseMin: 60,
    onlineStopped: false,
    counterSales: true,
    counterNote: '',
    ...over,
  };
}

/** Writes the show-night columns straight onto an event, then reads it back through the real reader. */
function withOnline(event: EventRow, cols: Record<string, string | number | null>): EventRow {
  for (const [col, val] of Object.entries(cols)) {
    db().prepare(`UPDATE events SET ${col} = ? WHERE id = ?`).run(val, event.id);
  }
  return getEventById(event.id)!;
}

// ---------------------------------------------------------------------------
// When the cutoff falls
// ---------------------------------------------------------------------------

test('online sales close exactly the chosen time before the show — not a minute early', () => {
  assert.equal(onlineSales(input(), berlin('17:59')).closed, false);
  const at18 = onlineSales(input(), berlin('18:00'));
  assert.equal(at18.closed, true);
  assert.equal(at18.reason, 'clock');
  assert.deepEqual(at18.closesAt, { date: SHOW_DAY, time: '18:00' });
});

test('a cutoff before a show just after midnight falls on the evening before', () => {
  const s = onlineSales(input({ showTime: '00:30' }), berlin('22:00', '2026-10-23'));
  assert.deepEqual(s.closesAt, { date: '2026-10-23', time: '23:30' });
  assert.equal(s.closed, false);
  assert.equal(onlineSales(input({ showTime: '00:30' }), berlin('23:30', '2026-10-23')).closed, true);
});

test('"Never" keeps the website selling right up to the show, and the show still ends', () => {
  const never = input({ onlineCloseMin: null });
  assert.equal(onlineSales(never, berlin('19:30')).closed, false);
  assert.equal(onlineSales(never, berlin('19:30')).closesAt, null);
  // Six hours after the start the show is over, whatever the cutoff said.
  assert.equal(onlineSales(never, berlin('01:00', '2026-10-25')).over, true);
});

test('with no show time and no time in the date line, nothing closes on its own', () => {
  const s = onlineSales(input({ showTime: '' , dateDisplay: 'Saturday 24 October 2026' }), berlin('23:00'));
  assert.equal(s.closed, false);
  assert.equal(s.start, null);
});

test('a shop never closes this way — it has no show to start', () => {
  const s = onlineSales(input({ kind: 'shop', onlineStopped: true }), berlin('20:00'));
  assert.equal(s.closed, false);
});

// ---------------------------------------------------------------------------
// Older events: the start read out of the date line
// ---------------------------------------------------------------------------

test('the start is read from the date line, preferring the show over the doors', () => {
  assert.deepEqual(startFromText('Saturday 24 October 2026 · Doors 18:00'), { time: '18:00', source: 'doors' });
  assert.deepEqual(startFromText('Doors 6 PM · Show 7:30 PM'), { time: '19:30', source: 'text' });
  assert.deepEqual(startFromText('Einlass 18:00 · Beginn 19:00'), { time: '19:00', source: 'text' });
  assert.deepEqual(startFromText('Doors 6:00 PM'), { time: '18:00', source: 'doors' });
});

test('a year or a bare number in the date line is never mistaken for a time', () => {
  assert.equal(startFromText('Dashain Show 2026'), null);
  assert.equal(startFromText('Show 7'), null);
  assert.equal(startFromText(''), null);
});

test('the "Show starts" field wins over whatever the date line says', () => {
  const s = onlineSales(input({ showTime: '20:00', dateDisplay: 'Doors 18:00' }), berlin('12:00'));
  assert.deepEqual(s.start, { date: SHOW_DAY, time: '20:00', source: 'show' });
  assert.deepEqual(s.closesAt, { date: SHOW_DAY, time: '19:00' });
});

// ---------------------------------------------------------------------------
// The organizer's own button
// ---------------------------------------------------------------------------

test('"Stop online sales now" closes at once, hours before the automatic cutoff', () => {
  const s = onlineSales(input({ onlineStopped: true }), berlin('12:00'));
  assert.equal(s.closed, true);
  assert.equal(s.reason, 'stopped');
});

test('the refusal tells the buyer about the counter — or that there is none', () => {
  assert.match(onlineRefusal(input({ onlineStopped: true }), berlin('12:00'))!, /at the counter/);
  assert.doesNotMatch(onlineRefusal(input({ onlineStopped: true, counterSales: false }), berlin('12:00'))!, /counter/);
  assert.equal(onlineRefusal(input(), berlin('12:00')), null);
});

test('the cutoff reads as "today at 18:00" on the day, and as a date before it', () => {
  assert.equal(wallClockLabel({ date: SHOW_DAY, time: '18:00' }, berlin('09:00')), 'today at 18:00');
  assert.equal(wallClockLabel({ date: SHOW_DAY, time: '18:00' }, berlin('09:00', '2026-10-23')), 'tomorrow at 18:00');
  assert.equal(wallClockLabel({ date: SHOW_DAY, time: '18:00' }, berlin('09:00', '2026-10-20')), 'Sat 24 Oct at 18:00');
});

// ---------------------------------------------------------------------------
// What every buy button reads: ticketState
// ---------------------------------------------------------------------------

test('after the cutoff the page says "buy at the counter", and nothing is buyable online', () => {
  const { event } = makeEventWithTier({ eventDate: SHOW_DAY }, { cap: 50 });
  const ev = withOnline(event, { show_time: '19:00', online_close_min: 60 });
  const tiers = getEventTiers(ev.id);

  const before = ticketState(ev, tiers, getAvailability(ev.id), { now: berlin('17:00') });
  assert.equal(before.kind, 'on-sale');
  assert.equal(before.buyable, true);

  const after = ticketState(ev, tiers, getAvailability(ev.id), { now: berlin('18:30') });
  assert.equal(after.kind, 'online-closed');
  assert.equal(after.buyable, false);
  assert.equal(after.cta, 'Buy at the counter');
  assert.equal(tierBadge(after, tiers[0], 50, true).label, 'At the counter');
});

test('a sold-out show still says sold out on the night — no trip to a counter with nothing left', () => {
  const { event, tier } = makeEventWithTier({ eventDate: SHOW_DAY, totalCapacity: 2 }, { cap: 2 });
  makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 2 }] });
  const ev = withOnline(event, { show_time: '19:00', online_stopped: 1 });
  const state = ticketState(ev, getEventTiers(ev.id), getAvailability(ev.id), { now: berlin('18:30') });
  assert.equal(state.kind, 'sold-out');
});

test('the general "Sales open" switch still wins over the show-night handover', () => {
  const { event } = makeEventWithTier({ eventDate: SHOW_DAY, salesOpen: false });
  const ev = withOnline(event, { show_time: '19:00', online_stopped: 1 });
  assert.equal(ticketState(ev, getEventTiers(ev.id), getAvailability(ev.id), { now: berlin('18:30') }).kind, 'closed');
});

test('once the show is over the page reads Finished, not "buy at the counter"', () => {
  const { event } = makeEventWithTier({ eventDate: SHOW_DAY });
  const ev = withOnline(event, { show_time: '19:00' });
  const state = ticketState(ev, getEventTiers(ev.id), getAvailability(ev.id), { now: berlin('02:00', '2026-10-25') });
  assert.equal(state.kind, 'past');
});

test('every event starts with the one-hour default, the counter on, and nothing stopped', () => {
  const { event } = makeEventWithTier();
  assert.equal(event.onlineCloseMin, 60);
  assert.equal(event.counterSales, true);
  assert.equal(event.onlineStopped, false);
  assert.equal(event.showTime, '');
});

// ---------------------------------------------------------------------------
// The server refuses — a page left open is not a way round it
// ---------------------------------------------------------------------------

let ipSeq = 0;
async function order(eventId: string, tierId: string) {
  ipSeq += 1;
  const res = await POST(
    new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${ipSeq}` },
      body: JSON.stringify({
        eventId,
        buyerName: 'Test Buyer',
        buyerEmail: `online-${process.pid}-${ipSeq}@example.test`,
        items: [{ tierId, quantity: 1 }],
      }),
    })
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** Berlin wall clock `minutes` from now, as the date and 'HH:MM' an organizer would type. */
function berlinIn(minutes: number): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(Date.now() + minutes * 60_000));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

test('the orders route refuses once the organizer has stopped online sales', async () => {
  const { event, tier } = makeEventWithTier();
  withOnline(event, { online_stopped: 1 });
  const res = await order(event.id, tier.tierKey);
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'SALES_CLOSED');
  assert.match(String(res.body.error), /counter/);
});

test('the orders route refuses after the automatic cutoff, and sells before it', async () => {
  // Show in 30 minutes, online closes an hour before: the cutoff passed 30 minutes ago.
  const soon = berlinIn(30);
  const { event, tier } = makeEventWithTier({ eventDate: soon.date });
  withOnline(event, { show_time: soon.time, online_close_min: 60 });
  const closed = await order(event.id, tier.tierKey);
  assert.equal(closed.status, 403, JSON.stringify(closed.body));
  assert.equal(closed.body.code, 'SALES_CLOSED');

  // Same show, cutoff at the start: still 30 minutes to buy online.
  withOnline(event, { online_close_min: 0 });
  const open = await order(event.id, tier.tierKey);
  assert.equal(open.status, 200, JSON.stringify(open.body));
});
