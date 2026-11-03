/**
 * THE QR TABLE ORDERING DEMO (/work/restaurant) KEEPS ITS PROMISES.
 *
 * The guest phone, kitchen board and waiter's floor plan are three drawings of
 * one state (src/app/work/restaurant/order.ts). These pin the order life cycle,
 * sold-out dishes, the simulated evening's caps, reading back stored state —
 * and the rule that no money appears anywhere, in any of the three languages.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DISHES,
  MAX_ACTIVE,
  MAX_CART_LINES,
  MAX_GUEST_ACTIVE,
  MAX_QTY,
  MAX_SEATED,
  MAX_STEP,
  MIN,
  SIM_SPEED,
  TABLE_COUNT,
  activeOrders,
  addToCart,
  advance,
  askBill,
  ackCall,
  callActive,
  callWaiter,
  cartCount,
  clearTable,
  clockLabel,
  dropSoldOut,
  normalize,
  orderSummary,
  progress,
  seedState,
  sendCart,
  setCartQty,
  switchGuestTable,
  tableStatus,
  tick,
  ticketClock,
  today,
  toggleSoldOut,
  type State,
} from '../src/app/work/restaurant/order.ts';
import { COPY, type Lang } from '../src/app/work/restaurant/content.ts';

function ordered(s: State): { state: State; id: number } {
  let r = addToCart(s, 'chicken-momo', 2, { style: 'jhol', spice: 3, achar: true });
  assert.ok(r.ok);
  r = addToCart(r.state, 'masala-chiya', 1);
  const sent = sendCart(r.state);
  assert.ok(sent.ok);
  return { state: sent.state, id: sent.id! };
}

test('the evening opens mid-service with every kind of table', () => {
  const s = seedState();
  assert.equal(clockLabel(s.now), '18:47');
  assert.equal(s.tables.length, TABLE_COUNT);
  const kinds = new Set(s.tables.map((t) => tableStatus(s, t.n)));
  for (const k of ['free', 'ordering', 'waiting', 'eating', 'bill']) assert.ok(kinds.has(k as never), k);
  assert.ok(s.tables.some(callActive), 'someone is calling a waiter');
  assert.equal(tableStatus(s, s.guestTable), 'ordering');
  const cols = new Set(activeOrders(s).map((o) => o.status));
  assert.deepEqual([...cols].sort(), ['cooking', 'ready', 'received']);
});

test('cart: options are kept, the same choice adds up, quantities are capped', () => {
  const s = seedState();
  let r = addToCart(s, 'veg-momo', 1, { style: 'fried', spice: 2 });
  r = addToCart(r.state, 'veg-momo', 1, { style: 'fried', spice: 2 });
  assert.equal(r.state.cart.length, 1);
  assert.equal(r.state.cart[0].qty, 2);
  r = addToCart(r.state, 'veg-momo', 1, { style: 'steamed', spice: 2 });
  assert.equal(r.state.cart.length, 2, 'another style is another line');
  r = addToCart(r.state, 'veg-momo', 50, { style: 'steamed', spice: 2 });
  assert.equal(r.state.cart[1].qty, MAX_QTY);
  // Options a dish does not have are dropped; missing ones get defaults.
  r = addToCart(r.state, 'mango-lassi', 1, { style: 'fried', spice: 3, achar: true });
  assert.deepEqual(r.state.cart[2], { dish: 'mango-lassi', qty: 1 });
  r = addToCart(r.state, 'buff-momo', 1);
  assert.equal(r.state.cart[3].style, 'steamed');
  assert.equal(r.state.cart[3].spice, 2);
  assert.equal(cartCount(r.state), 2 + MAX_QTY + 1 + 1);
  const less = setCartQty(r.state, 0, 0);
  assert.equal(less.cart.length, 3);
  assert.equal(addToCart(s, 'pizza', 1).reason, 'unknown');
  let full = s;
  for (const d of DISHES) for (const spice of [1, 2, 3] as const) full = addToCart(full, d.id, 1, { spice, style: 'fried' }).state;
  assert.equal(full.cart.length, MAX_CART_LINES);
  assert.equal(addToCart(full, 'veg-momo', 1, { spice: 1, style: 'fried' }).ok, true, 'adding to an existing line still works');
  assert.equal(addToCart(full, 'kheer', 1).reason, 'full');
});

test('an order goes received → cooking → ready → served, on the board and the guest tracker', () => {
  const { state, id } = ordered(seedState());
  assert.equal(state.cart.length, 0);
  const o = () => s.orders.find((x) => x.id === id)!;
  let s = state;
  assert.equal(o().status, 'received');
  assert.equal(tableStatus(s, s.guestTable), 'waiting');
  assert.equal(progress(o(), s.now).frac, 0.12);
  s = advance(s, id);
  assert.equal(o().status, 'cooking');
  assert.ok(progress(o(), s.now).frac >= 0.25);
  s = advance(s, id);
  assert.equal(o().status, 'ready');
  s = advance(s, id);
  assert.equal(o().status, 'served');
  assert.equal(advance(s, id), s, 'served is the end');
  assert.equal(progress(o(), s.now).frac, 1);
  assert.equal(tableStatus(s, s.guestTable), 'eating');
  assert.equal(advance(s, 99999), s, 'an unknown ticket changes nothing');
});

test('kitchen timers turn amber, then red', () => {
  const { state, id } = ordered(seedState());
  const o = state.orders.find((x) => x.id === id)!;
  assert.equal(ticketClock(o, o.at).level, '');
  assert.equal(ticketClock(o, o.at + 3 * MIN).level, 'warn');
  assert.equal(ticketClock(o, o.at + 6 * MIN).level, 'late');
  const cooking = { ...o, status: 'cooking' as const, cookingAt: o.at };
  assert.equal(ticketClock(cooking, o.at + 9 * MIN).level, '');
  assert.equal(ticketClock(cooking, o.at + 10 * MIN).level, 'warn', 'momo take 10 minutes');
  assert.equal(ticketClock(cooking, o.at + 14 * MIN).level, 'late');
});

test('the simulated kitchen moves the guest order along by itself, too', () => {
  let { state: s, id } = ordered(seedState());
  for (let i = 0; i < 200 && s.orders.find((x) => x.id === id)?.status !== 'served'; i++) s = tick(s, 1000).state;
  assert.equal(s.orders.find((x) => x.id === id)?.status, 'served');
});

test('sold out greys a dish out, blocks it and keeps the simulated guests off it', () => {
  let s = seedState();
  assert.ok(s.soldOut.includes('chatamari'));
  s = toggleSoldOut(s, 'chatamari');
  assert.ok(!s.soldOut.includes('chatamari'), 'back on the menu');
  let r = addToCart(s, 'dal-bhat', 1);
  s = toggleSoldOut(r.state, 'dal-bhat');
  assert.equal(addToCart(s, 'dal-bhat', 1).reason, 'sold-out');
  assert.equal(sendCart(s).reason, 'sold-out', 'a cart with a sold-out dish is not sent');
  s = dropSoldOut(s);
  assert.equal(s.cart.length, 0);
  assert.equal(toggleSoldOut(s, 'nope'), s);
  // Sell out every main but one: the other tables only order what is left.
  for (const d of DISHES) if (d.id !== 'bara' && d.cat !== 'drinks' && d.cat !== 'desserts' && !s.soldOut.includes(d.id)) s = toggleSoldOut(s, d.id);
  const before = new Set(s.orders.map((o) => o.id));
  for (let i = 0; i < 1500; i++) s = tick(s, 1000).state;
  const fresh = s.orders.filter((o) => !before.has(o.id) && o.table !== s.guestTable);
  assert.ok(fresh.length > 0);
  for (const o of fresh) for (const l of o.lines) assert.ok(!s.soldOut.includes(l.dish), l.dish);
});

test('the simulated evening stays busy but within its caps, and the clock is clamped', () => {
  let s = seedState();
  const t0 = s.now;
  s = tick(s, 3_600_000).state;
  assert.equal(s.now - t0, MAX_STEP, 'a sleeping tab does not fast-forward the evening');
  s = tick(s, 1000).state;
  assert.equal(s.now - t0, MAX_STEP + 1000 * SIM_SPEED);
  let maxActive = 0;
  let orders = 0;
  for (let i = 0; i < 4000; i++) {
    const r = tick(s, 1000);
    s = r.state;
    orders += r.events.filter((e) => e.kind === 'order').length;
    const simActive = activeOrders(s).filter((o) => o.table !== s.guestTable).length;
    maxActive = Math.max(maxActive, simActive);
    assert.ok(simActive <= MAX_ACTIVE + 1, `active ${simActive}`);
    assert.ok(s.tables.filter((t) => t.n !== s.guestTable && t.seatedAt != null).length <= MAX_SEATED);
    assert.ok(s.orders.length <= 60);
  }
  assert.ok(orders >= 20, `a busy evening (${orders} orders)`);
  assert.ok(maxActive >= 4, 'the board fills up');
  const kinds = new Set<string>();
  for (let i = 0; i < 600; i++) {
    s = tick(s, 1000).state;
    for (const t of s.tables) kinds.add(tableStatus(s, t.n));
  }
  assert.ok(kinds.has('free') && kinds.has('eating') && kinds.has('waiting'));
  assert.ok(today(s).orders >= 33 + orders);
});

test('the guest can call a waiter and ask for the bill; the waiter answers and clears the table', () => {
  let { state: s } = ordered(seedState());
  const n = s.guestTable;
  s = callWaiter(s);
  const t = () => s.tables.find((x) => x.n === n)!;
  assert.ok(callActive(t()));
  assert.equal(callWaiter(s), s, 'calling twice changes nothing');
  s = ackCall(s, n);
  assert.ok(!callActive(t()));
  assert.ok(t().callAckAt != null, 'the guest sees "on the way"');
  s = askBill(s);
  assert.equal(tableStatus(s, n), 'bill');
  const summary = orderSummary(s);
  assert.deepEqual(
    summary.map((l) => [l.dish, l.qty]),
    [
      ['chicken-momo', 2],
      ['masala-chiya', 1],
    ]
  );
  assert.equal(JSON.stringify(summary).match(/price|€|total|amount/i), null, 'the summary carries no money');
  s = clearTable(s, n);
  assert.equal(s.orders.filter((o) => o.table === n).length, 0);
  assert.equal(tableStatus(s, n), 'ordering', 'the guest is still at the table, a new visit');
  assert.equal(s.visit, 2);
  // A calling guest with no answer gets one from the simulated waiter.
  s = callWaiter(s);
  for (let i = 0; i < 30; i++) s = tick(s, 1000).state;
  assert.ok(!callActive(t()));
  const s0 = seedState();
  assert.equal(askBill(s0), s0, 'no bill to ask for without an order');
});

test('the guest cannot flood the kitchen', () => {
  let s = seedState();
  for (let i = 0; i < MAX_GUEST_ACTIVE; i++) s = ordered(s).state;
  const r = addToCart(s, 'bara', 1);
  assert.equal(sendCart(r.state).reason, 'busy');
  assert.equal(sendCart(seedState()).reason, 'empty');
});

test('scanning another table moves the visitor there', () => {
  let { state: s } = ordered(seedState());
  s = switchGuestTable(s, 4);
  assert.equal(s.guestTable, 4);
  assert.equal(tableStatus(s, 4), 'ordering');
  assert.equal(tableStatus(s, 7), 'free', 'the old table goes back to the simulation');
  assert.equal(s.orders.filter((o) => o.table === 7).length, 0);
  assert.equal(switchGuestTable(s, 13), s);
  assert.equal(switchGuestTable(s, 0), s);
});

test('stored state is read back safely', () => {
  const s = ordered(seedState()).state;
  const back = normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back, s);
  assert.deepEqual(normalize(null, 'de'), seedState('de'));
  assert.deepEqual(normalize({ v: 2 }), seedState());
  const messy = normalize({
    ...s,
    lang: 'fr',
    guestTable: 99,
    soldOut: ['kheer', 'kheer', 'pizza', 3],
    cart: [{ dish: 'kheer', qty: 400 }, { dish: 'nope', qty: 1 }, null],
    orders: [...s.orders, { id: 1, table: 50, at: 0, status: 'cooking', lines: [{ dish: 'kheer', qty: 1 }] }, { id: 2, table: 1, at: 0, status: 'weird', lines: [] }],
    stats: { orders: 'x' },
  });
  assert.equal(messy.lang, 'en');
  assert.equal(messy.guestTable, 7);
  assert.deepEqual(messy.soldOut, ['kheer']);
  assert.deepEqual(messy.cart, [{ dish: 'kheer', qty: MAX_QTY }]);
  assert.equal(messy.orders.length, s.orders.length);
  assert.equal(messy.stats.orders, seedState().stats.orders);
});

// ---------------- words ----------------

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') {
    const r = (v as (...a: string[]) => unknown)('7', '7', '7', '7');
    if (typeof r === 'string') out.push(r);
  } else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

test('every word the demo can show is free of money, in all three languages', () => {
  const MONEY =
    /€|\$|\beur\b|euro|\bprices?\b|\bfees?\b|\bcosts?\b|\bpay|\bpaid\b|\bquotes?\b|\brates?\b|\bpackages?\b|\bhire|\btips?\b|trinkgeld|\biban\b|\bbank|\btotal|preis|gebühr|kosten|zahlung|zahlen|bezahl|honorar|konto|summe|शुल्क|मूल्य|भुक्तानी|पैसा|रुपैयाँ|दाम|टिप/i;
  for (const lang of ['en', 'de', 'ne'] as Lang[]) {
    const { pricesHidden, ...rest } = COPY[lang];
    for (const s of strings(rest)) assert.doesNotMatch(s, MONEY, `${lang}: ${s}`);
    // The one note that says prices are hidden is the only place the word appears.
    assert.ok(pricesHidden.length > 0);
  }
  for (const d of DISHES) assert.doesNotMatch(`${d.roman} ${d.ne}`, MONEY);
});

test('all three languages carry the same content, and every dish is described', () => {
  const shape = (v: unknown): unknown =>
    Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
  assert.deepEqual(shape(COPY.de), shape(COPY.en));
  assert.deepEqual(shape(COPY.ne), shape(COPY.en));
  for (const lang of ['en', 'de', 'ne'] as Lang[]) {
    for (const d of DISHES) assert.ok(COPY[lang].dishes[d.id]?.desc, `${lang} ${d.id}`);
    assert.equal(Object.keys(COPY[lang].dishes).length, DISHES.length);
  }
});
