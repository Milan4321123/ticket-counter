/**
 * THE MOMO TRUCK DEMO (/work/momo) KEEPS ITS PROMISES.
 *
 * The customer's phone (map, schedule, order ahead, pickup number, stamp card)
 * and the crew's queue board are two drawings of one state
 * (src/app/work/momo/truck.ts). These pin pickup-slot capacity and allocation,
 * the queue position, the route with its ETAs, the stamp card, the order life
 * cycle, the simulation's caps, reading back stored state — and the rule that
 * no money appears anywhere, in any of the three languages.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SLOT_CAP,
  FILLINGS,
  LEAD_MIN,
  MAX_MINE_ACTIVE,
  MAX_ORDERS,
  MAX_PLATES,
  MAX_SIM_ACTIVE,
  MAX_STEP,
  MIN,
  PLACES,
  SIM_SPEED,
  SLOT_CAP_MAX,
  SLOT_CAP_MIN,
  SLOT_MIN,
  STAMPS_PER_BADGE,
  STEAMER_PLATES,
  STEAM_ROOM,
  WEEK,
  advance,
  aheadOf,
  bookedPlates,
  canOrder,
  clockLabel,
  driveMin,
  firstFit,
  legPoint,
  moveNext,
  nearInfo,
  nextWorkDay,
  normalize,
  nowServing,
  openTimeAt,
  parseCode,
  pickupCode,
  placeOrder,
  queue,
  route,
  scan,
  seedState,
  setNear,
  setPaused,
  setSlotCap,
  setAutoCrew,
  slotsFor,
  steamerLoad,
  stopStatus,
  tick,
  today,
  toggleNotify,
  toggleSoldOut,
  truckPos,
  type Line,
  type State,
} from '../src/app/work/momo/truck.ts';
import { COPY, FRAME, type Lang } from '../src/app/work/momo/content.ts';

const CHICKEN: Line[] = [{ filling: 'chicken', style: 'jhol', qty: 2 }];

/** Runs the clock forward by simulated minutes, a real second at a time. */
function run(s: State, simMinutes: number): { state: State; events: ReturnType<typeof tick>['events'] } {
  const events: ReturnType<typeof tick>['events'] = [];
  let st = s;
  const steps = Math.ceil((simMinutes * MIN) / (1000 * SIM_SPEED));
  for (let i = 0; i < steps; i++) {
    const r = tick(st, 1000);
    st = r.state;
    events.push(...r.events);
  }
  return { state: st, events };
}

function quiet(s: State): State {
  // No other customers: a paused truck stops the simulated orders but not the crew.
  return { ...s, orders: [], paused: false, seed: 7 };
}

test('the day opens on Friday at the Rhine, minutes before opening, with pre-orders', () => {
  const s = seedState();
  assert.equal(s.day, 4);
  assert.equal(route(s)[0].place, 'mz-rhein');
  assert.equal(clockLabel(s.now), '11:24');
  assert.deepEqual(stopStatus(s, 0), { kind: 'opens', at: 11.5 * 60 * MIN });
  assert.equal(s.orders.length, 6);
  assert.ok(s.orders.every((o) => !o.mine && o.status === 'placed'));
  assert.equal(s.orders[0].id, 31);
});

test('pickup slots: start after the lead time, every 10 minutes, and fill up by plates', () => {
  let s = quiet(seedState());
  s = { ...s, now: 12 * 60 * MIN + 3 * MIN, openAt: 11.5 * 60 * MIN };
  const slots = slotsFor(s);
  // 12:03 + 5 min lead → the first slot is 12:10.
  assert.equal(slots[0].start, 12 * 60 + 10);
  assert.ok(slots.every((x, i) => i === 0 || x.start - slots[i - 1].start === SLOT_MIN));
  assert.ok(slots[0].start * MIN >= s.now + LEAD_MIN * MIN);
  // The last slot ends at closing time.
  assert.ok(slots[slots.length - 1].start + SLOT_MIN <= route(s)[0].closes);
  assert.equal(slots[0].cap, DEFAULT_SLOT_CAP);

  // Fill the 12:10 slot: 2 + 2 + 2 + 2 + 2 = 10 plates.
  for (let i = 0; i < 2; i++) {
    const r = placeOrder({ ...s, orders: s.orders.map((o) => ({ ...o, mine: false })) }, { lines: CHICKEN, achar: 3, slot: 12 * 60 + 10 });
    assert.ok(r.ok, r.reason);
    s = { ...r.state, orders: r.state.orders.map((o) => ({ ...o, mine: false })) };
  }
  assert.equal(bookedPlates(s, s.trip, 12 * 60 + 10), 4);
  const big: Line[] = [{ filling: 'veg', style: 'steamed', qty: 6 }];
  let r = placeOrder(s, { lines: big, achar: 1, slot: 12 * 60 + 10 });
  assert.ok(r.ok);
  s = { ...r.state, orders: r.state.orders.map((o) => ({ ...o, mine: false })) };
  const after = slotsFor(s);
  assert.equal(after[0].left, 0);
  assert.equal(after[0].full, true);
  r = placeOrder(s, { lines: CHICKEN, achar: 1, slot: 12 * 60 + 10 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'full');
  // firstFit skips the full slot.
  assert.equal(firstFit(after, 2)!.start, 12 * 60 + 20);
  // The crew lowers the slot size: the same bookings now overflow nothing new can join.
  const small = setSlotCap(s, 6);
  assert.equal(slotsFor(small)[1].left, 6);
  assert.equal(setSlotCap(s, 999).slotCap, SLOT_CAP_MAX);
  assert.equal(setSlotCap(s, 1).slotCap, SLOT_CAP_MIN);
});

test('placing an order checks everything, and the visitor may have two on the way', () => {
  let s = quiet(seedState());
  s = { ...s, now: 12 * 60 * MIN, openAt: 11.5 * 60 * MIN };
  const slot = slotsFor(s)[0].start;
  assert.equal(placeOrder(s, { lines: [], achar: 2, slot }).reason, 'empty');
  assert.equal(placeOrder(s, { lines: [{ filling: 'veg', style: 'fried', qty: MAX_PLATES + 1 }], achar: 2, slot }).reason, 'too-many');
  assert.equal(placeOrder(s, { lines: CHICKEN, achar: 2, slot: 3 }).reason, 'no-slot');
  assert.equal(placeOrder(setPaused(s, true), { lines: CHICKEN, achar: 2, slot }).reason, 'paused');
  assert.equal(placeOrder(toggleSoldOut(s, 'chicken'), { lines: CHICKEN, achar: 2, slot }).reason, 'sold-out');
  let all = s;
  for (const f of FILLINGS) all = toggleSoldOut(all, f);
  assert.equal(canOrder(all), 'sold-out');
  assert.equal(stopStatus(all, 0).kind, 'soldout');

  for (let i = 0; i < MAX_MINE_ACTIVE; i++) {
    const r = placeOrder(s, { lines: CHICKEN, achar: 2, slot: slotsFor(s)[2].start });
    assert.ok(r.ok);
    s = r.state;
  }
  assert.equal(placeOrder(s, { lines: CHICKEN, achar: 2, slot: slotsFor(s)[3].start }).reason, 'busy');
  // Same filling and style in two lines become one line.
  const r = placeOrder(quiet(s), { lines: [{ filling: 'veg', style: 'fried', qty: 1 }, { filling: 'veg', style: 'fried', qty: 2 }], achar: 2, slot });
  assert.deepEqual(r.state.orders.find((o) => o.id === r.id)!.lines, [{ filling: 'veg', style: 'fried', qty: 3 }]);
});

test('the queue: by slot then number, and the position counts down as orders are picked up', () => {
  let s = seedState();
  s = { ...s, now: 11.5 * 60 * MIN + 2 * MIN, seed: 3 };
  const r = placeOrder(setPaused(s, false), { lines: CHICKEN, achar: 4, slot: 11 * 60 + 50 });
  assert.ok(r.ok);
  s = r.state;
  const mine = r.id!;
  // Six pre-orders at 11:30 and 11:40 come first.
  assert.equal(aheadOf(s, mine), 6);
  assert.deepEqual(
    queue(s).map((o) => o.id),
    [...queue(s)].sort((a, b) => a.slot - b.slot || a.id - b.id).map((o) => o.id)
  );
  // Hand out the first order by hand: one fewer ahead.
  const first = queue(s)[0];
  for (let i = 0; i < 3; i++) s = advance(s, first.id).state;
  assert.equal(s.orders.find((o) => o.id === first.id)!.status, 'picked');
  assert.equal(aheadOf(s, mine), 5);

  // Let the simulated crew work (no new customers): the count reaches zero.
  s = setPaused(s, true);
  let seen = aheadOf(s, mine);
  for (let m = 0; m < 60 && aheadOf(s, mine) > 0; m++) {
    s = run(s, 1).state;
    const now = aheadOf(s, mine);
    assert.ok(now <= seen, 'the queue position never goes up');
    seen = now;
  }
  assert.equal(aheadOf(s, mine), 0);
});

test('order life cycle: placed → steaming → ready → picked, steamers have room for 30 plates', () => {
  let s = quiet(seedState());
  s = setAutoCrew({ ...s, now: 11.5 * 60 * MIN }, false);
  const slots = slotsFor(s);
  const ids: number[] = [];
  // Five sim-style orders of 6 plates = 30 plates.
  for (let i = 0; i < 6; i++) {
    const r = placeOrder(s, { lines: [{ filling: 'veg', style: 'steamed', qty: 6 }], achar: 1, slot: slots[i].start });
    assert.ok(r.ok, r.reason);
    s = { ...r.state, orders: r.state.orders.map((o) => ({ ...o, mine: false })) };
    ids.push(r.id!);
  }
  for (let i = 0; i < 5; i++) {
    const r = advance(s, ids[i]);
    assert.ok(r.ok, r.reason);
    s = r.state;
  }
  assert.deepEqual(steamerLoad(s), [STEAMER_PLATES, STEAMER_PLATES, STEAMER_PLATES]);
  const full = advance(s, ids[5]);
  assert.equal(full.ok, false);
  assert.equal(full.reason, 'steamers-full');
  assert.equal(STEAM_ROOM, 30);

  // Ready → the "now serving" number is the first ready one.
  s = advance(s, ids[1]).state;
  s = advance(s, ids[0]).state;
  assert.equal(nowServing(s).serving, ids[0]);
  assert.deepEqual(nowServing(s).ready, [ids[0], ids[1]]);
  assert.equal(steamerLoad(s).reduce((a, b) => a + b), 18);
  s = advance(s, ids[0]).state;
  assert.equal(s.orders.find((o) => o.id === ids[0])!.status, 'picked');
  assert.equal(advance(s, ids[0]).ok, false);
});

test('scanning a pickup code hands over a ready order, and only that', () => {
  assert.equal(pickupCode(42), 'MOMO-GAADI-42');
  assert.equal(parseCode('MOMO-GAADI-42'), 42);
  assert.equal(parseCode(' 42 '), 42);
  assert.equal(parseCode('#7'), 7);
  assert.equal(parseCode('hello'), null);
  let s = quiet(seedState());
  s = setAutoCrew({ ...s, now: 11.5 * 60 * MIN }, false);
  const r = placeOrder(s, { lines: CHICKEN, achar: 2, slot: slotsFor(s)[0].start });
  s = r.state;
  const id = r.id!;
  assert.equal(scan(s, pickupCode(id)).result, 'not-ready');
  s = advance(s, id).state;
  s = advance(s, id).state;
  const h = scan(s, pickupCode(id));
  assert.equal(h.result, 'handed');
  assert.equal(h.state.orders.find((o) => o.id === id)!.status, 'picked');
  assert.equal(scan(h.state, pickupCode(id)).result, 'already');
  assert.equal(scan(h.state, pickupCode(999)).result, 'unknown');
});

test('stamp card: one stamp per pickup of your own order, eight give a Momo Master badge', () => {
  let s = quiet(seedState());
  s = setAutoCrew({ ...s, now: 11.5 * 60 * MIN, stamps: STAMPS_PER_BADGE - 2, badges: 0 }, false);
  const events: string[] = [];
  for (let i = 0; i < 2; i++) {
    const r = placeOrder(s, { lines: CHICKEN, achar: 2, slot: slotsFor(s)[0].start });
    s = r.state;
    for (let k = 0; k < 3; k++) {
      const m = advance(s, r.id!);
      s = m.state;
      events.push(...m.events.map((e) => e.kind));
    }
  }
  assert.equal(s.stamps, 0);
  assert.equal(s.badges, 1);
  assert.ok(events.includes('stamp'));
  assert.ok(events.includes('badge'));
  // A simulated customer's pickup adds nothing to the visitor's card.
  const before = s.stamps;
  const o = queue(s).find((x) => !x.mine && x.status !== 'picked');
  if (o) for (let k = 0; k < 3; k++) s = advance(s, o.id).state;
  assert.equal(s.stamps, before);
});

test('the route: the truck leaves at closing time, drives along its curve and opens on arrival', () => {
  let s = quiet(seedState());
  s = setPaused(s, true);
  const r = route(s);
  // Planned opening times for the stops after this one follow the plan.
  assert.equal(openTimeAt(s, 1), r[1].opens * MIN);
  assert.equal(openTimeAt(s, 2), r[2].opens * MIN);
  const pos0 = truckPos(s);
  assert.equal(pos0.x, PLACES['mz-rhein'].x);
  assert.equal(pos0.moving, false);

  // Run to just after closing at the first stop.
  const toClose = (r[0].closes * MIN - s.now) / MIN + 1;
  const ran = run(s, toClose);
  s = ran.state;
  assert.ok(s.drive, 'driving after closing time');
  assert.ok(ran.events.some((e) => e.kind === 'departed'));
  assert.equal(stopStatus(s, 0).kind, 'left');
  const st = stopStatus(s, 1);
  assert.equal(st.kind, 'driving');
  // Halfway: the truck is between the two stops on the curve.
  const mid = run(s, driveMin('mz-rhein', 'wi-markt') / 2).state;
  const p = truckPos(mid);
  assert.equal(p.moving, true);
  assert.ok(p.frac > 0.3 && p.frac < 0.7);
  const half = legPoint('mz-rhein', 'wi-markt', p.frac);
  assert.ok(Math.abs(half.x - p.x) < 0.01 && Math.abs(half.y - p.y) < 0.01);
  // Arrive: it waits for the planned opening (it is early), then opens.
  s = run(s, driveMin('mz-rhein', 'wi-markt') + 1).state;
  assert.equal(s.drive, null);
  assert.equal(s.idx, 1);
  assert.equal(s.trip, 2);
  assert.equal(stopStatus(s, 1).kind, s.now < r[1].opens * MIN ? 'opens' : 'open');
});

test('"Move to next stop": early departure opens on arrival; the visitor’s own order must be handed out first', () => {
  let s = quiet(seedState());
  s = { ...s, now: 12 * 60 * MIN };
  const r = placeOrder(s, { lines: CHICKEN, achar: 2, slot: slotsFor(s)[0].start });
  s = r.state;
  const blocked = moveNext(s);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'mine-waiting');
  // Hand it out.
  s = setAutoCrew(s, false);
  for (let k = 0; k < 3; k++) s = advance(s, r.id!).state;
  // A simulated order still in the queue is handed out as the truck leaves.
  const sim = placeOrder(s, { lines: CHICKEN, achar: 2, slot: slotsFor(s)[1].start });
  s = { ...sim.state, orders: sim.state.orders.map((o) => (o.id === sim.id ? { ...o, mine: false } : o)) };
  const m = moveNext(s);
  assert.ok(m.ok);
  s = m.state;
  assert.equal(s.orders.find((o) => o.id === sim.id)!.status, 'picked');
  assert.ok(s.drive && s.drive.early);
  // ETA: arrival = now + drive time, and it opens right then.
  const eta = s.now + driveMin('mz-rhein', 'wi-markt') * MIN;
  assert.deepEqual(stopStatus(s, 1), { kind: 'driving', eta });
  assert.equal(openTimeAt(s, 1), eta);
  assert.equal(moveNext(s).reason, 'driving');
  // While driving, orders go to the next stop, with slots from the arrival.
  const ahead = slotsFor(s);
  assert.ok(ahead[0].start * MIN >= eta);
  const pre = placeOrder(s, { lines: CHICKEN, achar: 2, slot: ahead[0].start });
  assert.ok(pre.ok);
  assert.equal(pre.state.orders.find((o) => o.id === pre.id)!.trip, s.trip + 1);
  s = run(pre.state, driveMin('mz-rhein', 'wi-markt') + 0.2).state;
  assert.equal(s.idx, 1);
  assert.equal(stopStatus(s, 1).kind, 'open');
  // The pre-order is in this stop's queue now.
  assert.ok(queue(s).some((o) => o.id === pre.id));
});

test('the last stop closes the day; the next day starts on its own route', () => {
  let s = quiet(seedState());
  s = { ...s, idx: 2, trip: 3, openAt: WEEK[4][2].opens * MIN, now: WEEK[4][2].opens * MIN + 5 * MIN };
  let m = moveNext(s);
  assert.ok(m.ok);
  s = m.state;
  assert.equal(s.done, true);
  assert.equal(stopStatus(s, 2).kind, 'closed');
  assert.equal(canOrder(s), 'closed');
  assert.deepEqual(slotsFor(s), []);
  m = moveNext(s);
  assert.ok(m.ok);
  assert.equal(m.state.day, 5);
  assert.equal(m.state.idx, 0);
  assert.equal(m.state.done, false);
  assert.ok(m.events.some((e) => e.kind === 'newday'));
  // Sunday → Tuesday: Monday is the rest day.
  assert.equal(nextWorkDay(6), 1);
  assert.equal(WEEK[0].length, 0);
});

test('"I\'m near this stop" and arrival notes', () => {
  let s = quiet(seedState());
  s = setNear(s, 'da-markt');
  const n = nearInfo(s)!;
  assert.equal(n.today, true);
  assert.equal(n.k, 2);
  assert.equal(n.at, openTimeAt(s, 2));
  s = setNear(s, 'da-garten');
  const later = nearInfo(s)!;
  assert.equal(later.today, false);
  assert.equal(later.day, 5);
  assert.equal(setNear(s, 'nowhere' as never).near, null);

  s = toggleNotify(setPaused(s, true), 'wi-markt');
  assert.deepEqual(s.notify, ['wi-markt']);
  const m = moveNext(s);
  const arrived = run(m.state, driveMin('mz-rhein', 'wi-markt') + 1).events.find((e) => e.kind === 'arrived');
  assert.deepEqual(arrived, { kind: 'arrived', place: 'wi-markt', notify: true });
  assert.deepEqual(toggleNotify(s, 'wi-markt').notify, []);
});

test('the simulated customers are capped and the board stays small over whole days', () => {
  let s = seedState('en', 99);
  s = setAutoCrew(s, false); // nobody hands anything out: orders pile up to the cap
  for (let m = 0; m < 120; m++) {
    s = run(s, 1).state;
    const active = s.orders.filter((o) => !o.mine && o.status !== 'picked').length;
    assert.ok(active <= MAX_SIM_ACTIVE, `active ${active}`);
  }
  // Slots never take more than their capacity.
  for (const x of slotsFor(s)) assert.ok(x.booked <= x.cap);
  s = setAutoCrew(s, true);
  for (let m = 0; m < 3 * 24 * 60; m += 30) {
    s = run(s, 30).state;
    assert.ok(s.orders.length <= MAX_ORDERS);
  }
  assert.ok(today(s).orders >= 0);
});

test('a tick never jumps more than a minute, and the day stands still without real time', () => {
  const s = seedState();
  assert.equal(tick(s, 0).state, s);
  assert.equal(tick(s, 60 * 60 * 1000).state.now - s.now, MAX_STEP);
  assert.equal(tick(s, 1000).state.now - s.now, 1000 * SIM_SPEED);
});

test('counts for the crew: orders per slot at this stop and plates by filling', () => {
  const s = seedState();
  const td = today(s);
  assert.equal(td.orders, 6);
  assert.equal(td.plates, 9);
  assert.equal(td.byFilling.chicken, 4);
  assert.deepEqual(
    td.perSlot.map((x) => x.orders),
    [3, 3]
  );
});

test('stored state is read back defensively', () => {
  const s = run(seedState(), 30).state;
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))), s);
  assert.deepEqual(normalize(null, 'de'), seedState('de'));
  assert.deepEqual(normalize({ v: 2 }), seedState());
  assert.deepEqual(normalize({ ...s, day: 0 }), seedState(), 'a rest day cannot be today');
  assert.deepEqual(normalize({ ...s, idx: 9 }), seedState());
  const odd = normalize({ ...s, slotCap: 1e9, stamps: 99, soldOut: ['chicken', 'pizza'], notify: ['x', 'mz-rhein'], near: 'x', orders: [{ id: 1 }, ...s.orders] });
  assert.equal(odd.slotCap, SLOT_CAP_MAX);
  assert.equal(odd.stamps, STAMPS_PER_BADGE - 1);
  assert.deepEqual(odd.soldOut, ['chicken']);
  assert.deepEqual(odd.notify, ['mz-rhein']);
  assert.equal(odd.near, null);
  assert.equal(odd.orders.length, s.orders.length);
});

// ---------------- words ----------------

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') {
    const r = (v as (...a: string[]) => unknown)('7', '7', '7');
    if (typeof r === 'string') out.push(r);
  } else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

test('every word the demo can show is free of money, in all three languages', () => {
  const MONEY =
    /€|\$|\beur\b|euro|\bprices?\b|\bfees?\b|\bcosts?\b|\bpay|\bpaid\b|\bcash|\bquotes?\b|\brates?\b|\bpackages?\b|\bhire|\btips?\b|\bfree\b|discount|\bdeal\b|voucher|coupon|\bredeem|on the house|trinkgeld|\biban\b|\bbank|\btotal|preis|gebühr|kosten|gratis|rabatt|gutschein|einlös|zahlung|zahlen|bezahl|honorar|konto|summe|शुल्क|मूल्य|भुक्तानी|पैसा|रुपैयाँ|दाम|टिप|छुट|निःशुल्क|सित्तै/i;
  for (const lang of ['en', 'de', 'ne'] as Lang[]) {
    const { pricesHidden, ...rest } = COPY[lang];
    for (const s of strings(rest)) assert.doesNotMatch(s, MONEY, `${lang}: ${s}`);
    // The one note that says prices are hidden is the only place the word appears.
    assert.ok(pricesHidden.length > 0);
    const { free, ...frame } = FRAME[lang];
    for (const s of strings(frame)) assert.doesNotMatch(s, MONEY, `${lang} frame: ${s}`);
    assert.ok(free.length > 0);
  }
});

test('all three languages carry the same content', () => {
  const shape = (v: unknown): unknown =>
    Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
  assert.deepEqual(shape(COPY.de), shape(COPY.en));
  assert.deepEqual(shape(COPY.ne), shape(COPY.en));
  assert.deepEqual(shape(FRAME.de), shape(FRAME.en));
  assert.deepEqual(shape(FRAME.ne), shape(FRAME.en));
  for (const lang of ['en', 'de', 'ne'] as Lang[]) {
    for (const p of Object.keys(PLACES)) assert.ok(COPY[lang].places[p as keyof typeof PLACES]);
  }
});
