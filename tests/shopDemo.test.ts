/**
 * DHAKA & DAL (/work/shop) COUNTS RIGHT — AND ONLY COUNTS.
 *
 * The made-up shop's rules, without a browser: the seeded order history is
 * the same for everyone and really does rush before Dashain and Tihar; the
 * owner's KPI counts, the 7-day moving average, top products, category share
 * and the weekday × hour heatmap add up for 7 / 30 / 90 days; stock levels,
 * reorder thresholds and the restock reminder; the order status machine,
 * bulk moves and the pickup-code scan; slots, the cart, placing an order and
 * live orders; the product editor; CSV escaping; what comes back from
 * localStorage — and that no word in any language talks prices or money
 * beyond the two "hidden in this demo" notes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATS,
  CUSTOMER_COUNT,
  FESTIVALS,
  FLOW,
  HEAT_FROM,
  HEAT_TO,
  LIVE_CAP,
  LOYAL_MIN,
  MAX_QTY,
  PREP_MIN,
  RUSH_DAYS,
  SEED_PRODUCTS,
  addToCart,
  asRange,
  bulkMove,
  canMove,
  cartCount,
  categoryShare,
  cleanSaved,
  csvCell,
  customerRows,
  dailySeries,
  dayNum,
  draftProblems,
  emptySaved,
  festivalLift,
  festivalsBetween,
  fitCart,
  generateHistory,
  heatColumn,
  heatLevel,
  heatmap,
  isoOf,
  itemCount,
  kpis,
  liveDelay,
  liveOrder,
  localNow,
  lowStockCount,
  mergeOrders,
  movingAverage,
  nextReadyPickup,
  nextStatus,
  normCode,
  ordersOnDay,
  pickupCode,
  placeOrder,
  productFromDraft,
  qrText,
  removeProduct,
  restockList,
  scanCode,
  setCartQty,
  setStock,
  shelfBadge,
  slotsFor,
  stockLevel,
  suggestReorder,
  takeStock,
  toCsv,
  topProducts,
  upsertProduct,
  weekday,
  type Order,
  type Product,
} from '../src/app/work/shop/shop.ts';
import { CAT_NAMES, COPY, FRAME, PRODUCT_TEXT, count, customerName, num, sizeLabel, statusText, type Lang } from '../src/app/work/shop/content.ts';

const TODAY = dayNum('2026-11-03'); // a Tuesday, five days before Tihar 2026
const NOW = 15 * 60 + 20;
const HIST = generateHistory(TODAY, NOW);
const LANGS: Lang[] = ['en', 'de', 'ne'];

// ---------------------------------------------------------------- dates

test('calendar days: ISO round trip and weekdays (Monday = 0)', () => {
  assert.equal(isoOf(dayNum('2026-11-03')), '2026-11-03');
  assert.equal(isoOf(dayNum('2028-02-29')), '2028-02-29');
  assert.equal(weekday(dayNum('2026-11-02')), 0); // Monday
  assert.equal(weekday(dayNum('2026-11-07')), 5); // Saturday
  assert.equal(weekday(dayNum('2026-11-08')), 6); // Sunday
  const { today, nowMin } = localNow(new Date(2026, 10, 3, 9, 41));
  assert.equal(isoOf(today), '2026-11-03');
  assert.equal(nowMin, 9 * 60 + 41);
});

// ---------------------------------------------------------------- history

test('the history is deterministic: same day, same orders — for everyone', () => {
  const again = generateHistory(TODAY, NOW);
  assert.deepEqual(again, HIST);
  // A later look at the same past day sees the same orders on it.
  const later = generateHistory(TODAY + 5, 600);
  const day = TODAY - 3;
  assert.deepEqual(
    later.filter((o) => o.day === day),
    HIST.filter((o) => o.day === day)
  );
  for (const o of HIST) {
    assert.match(o.code, /^[ACDEFHJKMNPRTUVWXY3479]{4}$/, o.id);
    assert.ok(o.lines.length >= 1 && o.lines.length <= 4);
    assert.ok(new Set(o.lines.map((l) => l.p)).size === o.lines.length, 'a product once per order');
    for (const l of o.lines) {
      const p = SEED_PRODUCTS.find((x) => x.id === l.p);
      assert.ok(p && p.variants.some((v) => v.id === l.v), `${l.p}:${l.v} exists`);
      assert.ok(l.q >= 1 && l.q <= 3);
    }
    assert.match(o.cust, /^c\d+$/);
    assert.ok(Number(o.cust.slice(1)) < CUSTOMER_COUNT);
  }
  // Sorted by time.
  for (let i = 1; i < HIST.length; i++) assert.ok(HIST[i - 1].day < HIST[i].day || (HIST[i - 1].day === HIST[i].day && HIST[i - 1].min <= HIST[i].min));
});

test('today only holds what has come in; past days are collected; today is a mix', () => {
  const todays = HIST.filter((o) => o.day === TODAY);
  assert.ok(todays.length > 0);
  for (const o of todays) assert.ok(o.min <= NOW);
  for (const o of HIST) if (o.day < TODAY) assert.equal(o.status, 'collected');
  const all = generateHistory(TODAY, 1439).filter((o) => o.day === TODAY);
  assert.equal(all.length, ordersOnDay(TODAY));
  // Late at night, older orders have moved on; something is still open early on.
  assert.ok(todays.some((o) => o.status !== 'new'));
  const early = generateHistory(TODAY, 13 * 60).filter((o) => o.day === TODAY);
  assert.ok(early.length <= todays.length);
});

test('festival rush: busier in the two weeks before Dashain and Tihar, quiet on the day', () => {
  for (const f of FESTIVALS) {
    const d = dayNum(f.iso);
    assert.equal(festivalLift(d).mult, 0.55, `${f.id} ${f.iso} itself is quiet`);
    assert.ok(festivalLift(d - 1).mult > 2.5, `${f.iso}: the day before is the peak`);
    assert.equal(festivalLift(d - 1).fest, f.id);
    assert.ok(festivalLift(d - 1).mult > festivalLift(d - 7).mult);
    assert.ok(festivalLift(d - 7).mult > festivalLift(d - RUSH_DAYS).mult);
    assert.equal(festivalLift(d - 40).mult, 1);
  }
  // In the generated data: the week before Dashain 2026 against an ordinary September week.
  const dashain = dayNum('2026-10-20');
  const sum = (from: number, to: number) => HIST.filter((o) => o.day >= from && o.day <= to).length;
  const rush = sum(dashain - 7, dashain - 1);
  const calm = sum(dayNum('2026-09-14'), dayNum('2026-09-20'));
  assert.ok(rush > calm * 1.7, `rush ${rush} vs calm ${calm}`);
  // Puja things sell far more in the rush.
  const puja = (from: number, to: number) =>
    HIST.filter((o) => o.day >= from && o.day <= to)
      .flatMap((o) => o.lines)
      .filter((l) => SEED_PRODUCTS.find((p) => p.id === l.p)!.cat === 'puja')
      .reduce((s, l) => s + l.q, 0);
  assert.ok(puja(dashain - 7, dashain - 1) > 2 * puja(dayNum('2026-09-14'), dayNum('2026-09-20')));
});

test('Saturdays are busier than Sundays, on average', () => {
  let sat = 0;
  let sun = 0;
  for (let d = TODAY - 119; d <= TODAY; d++) {
    if (festivalLift(d).mult !== 1) continue;
    if (weekday(d) === 5) sat += ordersOnDay(d);
    if (weekday(d) === 6) sun += ordersOnDay(d);
  }
  assert.ok(sat > sun * 1.8, `sat ${sat} sun ${sun}`);
});

test('festivals in a window, for the chart notes', () => {
  const in30 = festivalsBetween(TODAY - 30, TODAY);
  assert.deepEqual(in30, [{ id: 'dashain', day: dayNum('2026-10-20') }]);
  assert.deepEqual(festivalsBetween(TODAY, TODAY + RUSH_DAYS), [{ id: 'tihar', day: dayNum('2026-11-08') }]);
  assert.equal(festivalsBetween(TODAY - 7, TODAY).length, 0);
});

// ---------------------------------------------------------------- the owner's numbers

test('moving average: trailing, null until the window is full', () => {
  assert.deepEqual(movingAverage([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  assert.deepEqual(movingAverage([7, 7, 7, 7, 7, 7, 7], 7), [null, null, null, null, null, null, 7]);
  assert.deepEqual(movingAverage([1, 2], 3), [null, null]);
  assert.deepEqual(movingAverage([1, 1, 2], 2), [null, 1, 1.5]);
});

test('daily series: one point per day of the range, ending today, averages from day one', () => {
  for (const r of [7, 30, 90] as const) {
    const s = dailySeries(HIST, TODAY, r);
    assert.equal(s.length, r);
    assert.equal(s[s.length - 1].day, TODAY);
    assert.equal(s[0].day, TODAY - r + 1);
    assert.ok(s.every((p) => p.avg !== null), 'the average looks back before the range');
    for (const p of s) assert.equal(p.n, HIST.filter((o) => o.day === p.day).length);
    // The average on the last day is the mean of the last seven counts.
    const last7 = dailySeries(HIST, TODAY, 7).map((p) => p.n);
    assert.equal(s[s.length - 1].avg, Math.round((last7.reduce((a, b) => a + b, 0) / 7) * 10) / 10);
  }
});

test('KPIs per range: counts only, and they follow the range', () => {
  const k7 = kpis(HIST, SEED_PRODUCTS, TODAY, NOW, 7);
  const k30 = kpis(HIST, SEED_PRODUCTS, TODAY, NOW, 30);
  const k90 = kpis(HIST, SEED_PRODUCTS, TODAY, NOW, 90);
  assert.equal(k7.ordersToday, HIST.filter((o) => o.day === TODAY).length);
  assert.equal(k30.ordersToday, k7.ordersToday, 'orders today do not depend on the range');
  assert.equal(k7.ordersLastWeek, HIST.filter((o) => o.day === TODAY - 7 && o.min <= NOW).length);
  const items = (r: number) => HIST.filter((o) => o.day > TODAY - r).reduce((s, o) => s + itemCount(o), 0);
  assert.equal(k7.itemsSold, items(7));
  assert.equal(k30.itemsSold, items(30));
  assert.equal(k90.itemsSold, items(90));
  assert.equal(k30.itemsPrev, items(60) - items(30));
  assert.ok(k7.itemsSold < k30.itemsSold && k30.itemsSold < k90.itemsSold);
  for (const k of [k7, k30, k90]) {
    assert.ok(k.returningPct >= 0 && k.returningPct <= 100);
    assert.equal(k.returningPct, Math.round((100 * k.returning) / k.customers));
    assert.equal(k.pickupsWaiting, HIST.filter((o) => o.kind === 'pickup' && o.status === 'ready').length);
    assert.equal(k.lowStock, lowStockCount(SEED_PRODUCTS));
    // No money in the shape at all.
    assert.deepEqual(Object.keys(k).filter((x) => /price|revenue|total|amount|eur|money|sum/i.test(x)), []);
  }
  // Longer ranges see more repeat customers.
  assert.ok(k90.returningPct >= k7.returningPct);
  assert.ok(k30.returningPct > 20 && k30.returningPct < 95, `returning ${k30.returningPct}`);
});

test('top products and category share add up', () => {
  const top = topProducts(HIST, TODAY, 30, 8);
  assert.equal(top.length, 8);
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].q >= top[i].q);
  const qOf = (p: string) => HIST.filter((o) => o.day > TODAY - 30).flatMap((o) => o.lines).filter((l) => l.p === p).reduce((s, l) => s + l.q, 0);
  for (const r of top) assert.equal(r.q, qOf(r.p));
  const share = categoryShare(HIST, SEED_PRODUCTS, TODAY, 30);
  assert.deepEqual([...share.map((s) => s.cat)].sort(), [...CATS].sort());
  const total = share.reduce((s, c) => s + c.q, 0);
  assert.equal(total, kpis(HIST, SEED_PRODUCTS, TODAY, NOW, 30).itemsSold);
  const pct = share.reduce((s, c) => s + c.pct, 0);
  assert.ok(pct >= 97 && pct <= 103, `shares add to ~100 (${pct})`);
  for (let i = 1; i < share.length; i++) assert.ok(share[i - 1].q >= share[i].q);
  assert.deepEqual(topProducts([], TODAY, 30), []);
  assert.ok(categoryShare([], SEED_PRODUCTS, TODAY, 30).every((c) => c.q === 0 && c.pct === 0));
});

test('heatmap: every order in the range in exactly one weekday × hour cell', () => {
  assert.equal(heatColumn(0), 0, 'midnight goes in the first column');
  assert.equal(heatColumn(HEAT_FROM * 60 + 59), 0);
  assert.equal(heatColumn((HEAT_FROM + 1) * 60), 1);
  assert.equal(heatColumn(23 * 60 + 59), HEAT_TO - HEAT_FROM);
  for (const r of [7, 30, 90]) {
    const { grid, max } = heatmap(HIST, TODAY, r);
    assert.equal(grid.length, 7);
    assert.ok(grid.every((row) => row.length === HEAT_TO - HEAT_FROM + 1));
    const sum = grid.flat().reduce((a, b) => a + b, 0);
    assert.equal(sum, HIST.filter((o) => o.day > TODAY - r).length);
    assert.equal(max, Math.max(...grid.flat()));
  }
  // A single order lands where it should.
  const o = { ...HIST[0], day: dayNum('2026-11-07'), min: 11 * 60 + 5 } as Order;
  const { grid } = heatmap([o], dayNum('2026-11-07'), 7);
  assert.equal(grid[5][11 - HEAT_FROM], 1);
  assert.equal(heatLevel(0, 10), 0);
  assert.equal(heatLevel(1, 10), 1);
  assert.equal(heatLevel(10, 10), 5);
  assert.equal(heatLevel(5, 0), 0);
});

test('customers: counts per customer, loyal = enough orders in 90 days', () => {
  const rows = customerRows(HIST, TODAY, 30);
  const n = new Set(HIST.filter((o) => o.day > TODAY - 30).map((o) => o.cust)).size;
  assert.equal(rows.length, n);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].orders >= rows[i].orders);
  for (const r of rows.slice(0, 10)) {
    const ninety = HIST.filter((o) => o.cust === r.cust && o.day > TODAY - 90).length;
    assert.equal(r.loyal, ninety >= LOYAL_MIN);
  }
  assert.ok(rows.some((r) => r.loyal) && rows.some((r) => !r.loyal));
  // Names: a first name and an initial — nothing else.
  for (const l of LANGS)
    for (const r of rows.slice(0, 30)) {
      const name = customerName(r.cust, l, COPY[l].you);
      assert.match(name, /^\S+ \S\.$/u, name);
      assert.doesNotMatch(name, /@|\d/);
    }
});

// ---------------------------------------------------------------- stock

test('stock levels, shelf badges and the low-stock count', () => {
  assert.equal(stockLevel({ stock: 0, threshold: 3 }), 'out');
  assert.equal(stockLevel({ stock: 3, threshold: 3 }), 'low');
  assert.equal(stockLevel({ stock: 4, threshold: 3 }), 'ok');
  assert.deepEqual(shelfBadge(0), { kind: 'out' });
  assert.deepEqual(shelfBadge(3), { kind: 'few', n: 3 });
  assert.deepEqual(shelfBadge(1), { kind: 'few', n: 1 });
  assert.equal(shelfBadge(4), null);
  const base = lowStockCount(SEED_PRODUCTS);
  assert.ok(base >= 3, 'the demo starts with a few things to reorder');
  // Editing stock below the threshold raises the count; raising it again lowers it.
  const p = SEED_PRODUCTS.find((x) => x.id === 'momomasala')!;
  const lower = setStock(SEED_PRODUCTS, p.id, p.variants[0].id, 2);
  assert.equal(lowStockCount(lower), base + 1);
  assert.equal(lowStockCount(setStock(lower, p.id, p.variants[0].id, 40)), base);
  assert.equal(setStock(SEED_PRODUCTS, p.id, p.variants[0].id, -5).find((x) => x.id === p.id)!.variants[0].stock, 0);
  assert.equal(setStock(SEED_PRODUCTS, p.id, p.variants[0].id, 1e9).find((x) => x.id === p.id)!.variants[0].stock, 9999);
  assert.equal(SEED_PRODUCTS.find((x) => x.id === p.id)!.variants[0].stock, 18, 'pure: the seed is untouched');
});

test('restock reminder: everything at or below its level, sold out first, then fewest days left', () => {
  const list = restockList(SEED_PRODUCTS, HIST, TODAY);
  assert.equal(list.length, lowStockCount(SEED_PRODUCTS));
  assert.equal(list[0].level, 'out');
  const rest = list.filter((r) => r.level !== 'out' && r.daysLeft !== null);
  for (let i = 1; i < rest.length; i++) assert.ok(rest[i - 1].daysLeft! <= rest[i].daysLeft!);
  for (const r of list) {
    assert.ok(r.suggest >= 1);
    assert.ok(r.stock + r.suggest >= r.threshold * 2);
  }
  assert.equal(suggestReorder(0, 4, 1), 14);
  assert.equal(suggestReorder(3, 4, 0), 5);
  assert.equal(suggestReorder(100, 4, 0), 1);
  // After restocking everything, the list is empty.
  let ps = SEED_PRODUCTS;
  for (const r of list) ps = setStock(ps, r.p, r.v, r.stock + r.suggest);
  assert.deepEqual(restockList(ps, HIST, TODAY), []);
  assert.equal(lowStockCount(ps), 0);
});

test('an order takes its items off the shelf, never below zero', () => {
  const ps = takeStock(SEED_PRODUCTS, [
    { p: 'lapsi', v: '250g', q: 5 },
    { p: 'dalmoth', v: '200g', q: 2 },
  ]);
  assert.equal(ps.find((p) => p.id === 'lapsi')!.variants[0].stock, 0);
  assert.equal(ps.find((p) => p.id === 'dalmoth')!.variants[0].stock, 22);
});

// ---------------------------------------------------------------- status machine, scan

test('status machine: one step forward at a time, never back', () => {
  assert.deepEqual(FLOW, ['new', 'packed', 'ready', 'collected']);
  assert.equal(nextStatus('new'), 'packed');
  assert.equal(nextStatus('packed'), 'ready');
  assert.equal(nextStatus('ready'), 'collected');
  assert.equal(nextStatus('collected'), null);
  assert.ok(canMove('new', 'packed'));
  assert.ok(!canMove('new', 'ready'), 'no skipping');
  assert.ok(!canMove('ready', 'packed'), 'no going back');
  assert.ok(!canMove('collected', 'new'));
});

function order(id: string, status: Order['status'], kind: Order['kind'] = 'pickup'): Order {
  return { id, code: pickupCode(id), day: TODAY, min: 600, cust: 'c1', kind, lines: [{ p: 'timur', v: '50g', q: 1 }], status, src: 'seed' };
}

test('bulk moves only what is at the step before', () => {
  const os = [order('a', 'new'), order('b', 'new'), order('c', 'packed'), order('d', 'collected')];
  assert.deepEqual(bulkMove(os, ['a', 'b', 'c', 'd'], 'packed'), { moved: ['a', 'b'], skipped: ['c', 'd'] });
  assert.deepEqual(bulkMove(os, ['a', 'c'], 'ready'), { moved: ['c'], skipped: ['a'] });
  assert.deepEqual(bulkMove(os, [], 'ready'), { moved: [], skipped: [] });
});

test('owner moves sit on top of the seeded orders, never backwards', () => {
  const h = [order('x', 'packed'), order('y', 'ready')];
  const merged = mergeOrders(h, [], { x: 'ready', y: 'packed' });
  assert.equal(merged.find((o) => o.id === 'x')!.status, 'ready');
  assert.equal(merged.find((o) => o.id === 'y')!.status, 'ready', 'a stale move does not undo the clock');
});

test('pickup codes: readable, stable, and the scan hands over only ready pickups', () => {
  assert.equal(pickupCode('abc'), pickupCode('abc'));
  assert.notEqual(pickupCode('abc'), pickupCode('abd'));
  assert.equal(normCode(' #k7q-m '), 'K7QM');
  const ready = order('r1', 'ready');
  const packed = order('p1', 'packed');
  const done = order('d1', 'collected');
  const os = [ready, packed, done];
  const ok = scanCode(os, ready.code.toLowerCase());
  assert.equal(ok.kind, 'collected');
  assert.equal(ok.kind === 'collected' && ok.order.status, 'collected');
  assert.equal(scanCode(os, qrText(ready.code)).kind, 'collected', 'the QR text scans too');
  assert.equal(scanCode(os, `#${packed.code}`).kind, 'not-ready');
  assert.equal(scanCode(os, done.code).kind, 'already');
  assert.equal(scanCode(os, 'ZZZZ').kind, 'unknown');
  assert.equal(scanCode(os, '').kind, 'unknown');
  assert.equal(nextReadyPickup([order('dl', 'ready', 'delivery'), packed, ready])!.id, 'r1');
  assert.equal(nextReadyPickup([packed]), null);
});

// ---------------------------------------------------------------- slots, cart, orders

test('slots: an hour to pack, closed on Sundays, deliveries Monday to Friday', () => {
  const tue = dayNum('2026-11-03');
  const s = slotsFor(tue, 11 * 60 + 30, 'pickup');
  assert.ok(s.length > 0);
  assert.ok(s.every((x) => x.day > tue || x.from * 60 >= 11 * 60 + 30 + PREP_MIN));
  assert.equal(s[0].day, tue);
  assert.equal(s[0].from, 14, '12:00 is too soon at 11:30');
  const sat = dayNum('2026-11-07');
  const fromSat = slotsFor(sat, 8 * 60, 'pickup');
  assert.ok(fromSat.every((x) => weekday(x.day) !== 6), 'no Sunday pickups');
  assert.ok(fromSat.filter((x) => x.day === sat).every((x) => x.to <= 18), 'Saturday closes at 18:00');
  const del = slotsFor(dayNum('2026-11-06'), 20 * 60, 'delivery');
  assert.ok(del.every((x) => weekday(x.day) <= 4), 'no weekend deliveries');
  assert.equal(del[0].day, dayNum('2026-11-09'), 'Friday evening → Monday');
  assert.ok(new Set(slotsFor(tue, 0, 'pickup').map((x) => x.day)).size <= 3);
});

test('cart: capped by the shelf and by MAX_QTY, zero removes, sold out cannot be added', () => {
  let c = addToCart([], SEED_PRODUCTS, 'timur', '50g', 2);
  assert.deepEqual(c, [{ p: 'timur', v: '50g', q: 2 }]);
  c = addToCart(c, SEED_PRODUCTS, 'timur', '50g', 50);
  assert.equal(c[0].q, MAX_QTY);
  c = addToCart(c, SEED_PRODUCTS, 'lapsi', '250g', 5);
  assert.equal(c.find((l) => l.p === 'lapsi')!.q, 2, 'only two on the shelf');
  assert.equal(addToCart([], SEED_PRODUCTS, 'khursani', '250g').length, 0, 'sold out');
  assert.equal(addToCart([], SEED_PRODUCTS, 'nope', 'x').length, 0);
  assert.equal(cartCount(c), MAX_QTY + 2);
  c = setCartQty(c, SEED_PRODUCTS, 'timur', '50g', 0);
  assert.deepEqual(c, [{ p: 'lapsi', v: '250g', q: 2 }]);
  // The shelf empties: the bag follows.
  assert.deepEqual(fitCart(c, setStock(SEED_PRODUCTS, 'lapsi', '250g', 1)), [{ p: 'lapsi', v: '250g', q: 1 }]);
  assert.deepEqual(fitCart(c, setStock(SEED_PRODUCTS, 'lapsi', '250g', 0)), []);
});

test('placing an order: New, a fresh code, the slot, a cleaned first name', () => {
  const slot = slotsFor(TODAY, NOW, 'pickup')[0];
  const o = placeOrder([{ p: 'topi', v: 'M', q: 1 }], slot, TODAY, NOW, 1, '  Sita<script> ');
  assert.equal(o.status, 'new');
  assert.equal(o.src, 'you');
  assert.equal(o.kind, 'pickup');
  assert.equal(o.name, 'Sitascript');
  assert.match(o.code, /^[A-Z0-9]{4}$/);
  assert.notEqual(placeOrder([{ p: 'topi', v: 'M', q: 1 }], slot, TODAY, NOW, 2).code, o.code);
  // It shows up for the owner and counts today.
  const all = mergeOrders(HIST, [o], {});
  assert.equal(kpis(all, SEED_PRODUCTS, TODAY, NOW, 7).ordersToday, kpis(HIST, SEED_PRODUCTS, TODAY, NOW, 7).ordersToday + 1);
  // Walk it through the flow and the scan.
  let cur = o;
  for (const s of ['packed', 'ready'] as const) {
    assert.ok(canMove(cur.status, s));
    cur = { ...cur, status: s };
  }
  assert.equal(scanCode([cur], cur.code).kind, 'collected');
});

test('live orders: only things on the shelf, a 20–45 s rhythm, a cap', () => {
  assert.ok(LIVE_CAP >= 3 && LIVE_CAP <= 10);
  for (let n = 0; n < LIVE_CAP; n++) {
    const d = liveDelay(n, 42);
    assert.ok(d >= 20000 && d < 45000);
    const o = liveOrder(n, 42, TODAY, NOW, SEED_PRODUCTS)!;
    assert.equal(o.status, 'new');
    assert.equal(o.src, 'live');
    for (const l of o.lines) {
      const v = SEED_PRODUCTS.find((p) => p.id === l.p)!.variants.find((x) => x.id === l.v)!;
      assert.ok(v.stock >= l.q, `${l.p} is on the shelf`);
    }
  }
  assert.deepEqual(liveOrder(1, 7, TODAY, NOW, SEED_PRODUCTS), liveOrder(1, 7, TODAY, NOW, SEED_PRODUCTS));
  const empty = SEED_PRODUCTS.map((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v, stock: 0 })) }));
  assert.equal(liveOrder(0, 1, TODAY, NOW, empty), null);
});

// ---------------------------------------------------------------- product editor

test('product editor: a draft becomes a product that shows in the shop', () => {
  const blank = { name: { en: '', de: '', ne: '' }, cat: 'snacks' as const, art: { kind: 'jar' as const, color: 'red' as const }, variants: [{ size: '', stock: 1, threshold: 1 }] };
  assert.deepEqual(draftProblems(blank), ['name', 'variants']);
  const d = { ...blank, name: { en: 'Gundruk', de: '', ne: 'गुन्द्रुक' }, variants: [{ size: '200 g', stock: 2, threshold: 3 }, { size: '', stock: 9, threshold: 1 }, { size: '200 g', stock: 5, threshold: 1 }] };
  assert.deepEqual(draftProblems(d), []);
  const p = productFromDraft(d, 'pnew');
  assert.deepEqual(p.name, { en: 'Gundruk', de: 'Gundruk', ne: 'गुन्द्रुक' });
  assert.equal(p.variants.length, 2, 'empty sizes dropped');
  assert.notEqual(p.variants[0].id, p.variants[1].id, 'same label, different ids');
  assert.equal(p.custom, true);
  const ps = upsertProduct(SEED_PRODUCTS, p);
  assert.equal(ps.length, SEED_PRODUCTS.length + 1);
  assert.equal(ps.findIndex((x) => x.id === 'pnew'), ps.findIndex((x) => x.cat === 'snacks'), 'top of its category');
  assert.equal(lowStockCount(ps), lowStockCount(SEED_PRODUCTS) + 1, 'its low size counts');
  const edited = upsertProduct(ps, { ...p, cat: 'achar' });
  assert.equal(edited.length, ps.length);
  assert.equal(edited.find((x) => x.id === 'pnew')!.cat, 'achar');
  assert.equal(removeProduct(edited, 'pnew').length, SEED_PRODUCTS.length);
  assert.equal(removeProduct(SEED_PRODUCTS, 'timur').length, SEED_PRODUCTS.length, 'seed products cannot be deleted');
  assert.equal(productFromDraft({ ...d, name: { en: 'x'.repeat(200), de: '', ne: '' } }, 'q').name!.en.length, 40);
});

// ---------------------------------------------------------------- CSV

test('CSV: quotes, commas, line breaks, formulas', () => {
  assert.equal(csvCell('Timur'), 'Timur');
  assert.equal(csvCell(12), '12');
  assert.equal(csvCell('Dhaka & Dal, Leipzig'), '"Dhaka & Dal, Leipzig"');
  assert.equal(csvCell('a "b"'), '"a ""b"""');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
  assert.equal(csvCell('x;y'), '"x;y"');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell('@a'), "'@a");
  assert.equal(csvCell(' pad'), '" pad"');
  assert.equal(csvCell('मसला'), 'मसला');
  assert.equal(csvCell(-3), '-3', 'a number is never a formula');
  assert.equal(toCsv([['a', 'b'], [1, 'c,d']]), 'a,b\r\n1,"c,d"\r\n');
});

// ---------------------------------------------------------------- saved state

test('saved state: anything odd falls back, good data survives', () => {
  assert.deepEqual(cleanSaved(null), emptySaved());
  assert.deepEqual(cleanSaved({ v: 2 }), emptySaved());
  assert.deepEqual(cleanSaved('x'), emptySaved());
  assert.equal(asRange(7), 7);
  assert.equal(asRange('90'), 30);
  const slot = slotsFor(TODAY, NOW, 'pickup')[0];
  const o = placeOrder([{ p: 'topi', v: 'M', q: 1 }], slot, TODAY, NOW, 1, 'Sita');
  const custom = productFromDraft({ name: { en: 'Gundruk', de: '', ne: '' }, cat: 'snacks', art: { kind: 'jar', color: 'red' }, variants: [{ size: '200 g', stock: 2, threshold: 3 }] }, 'pz');
  const raw = JSON.parse(
    JSON.stringify({
      v: 1,
      products: [custom, { id: 'bad' }, ...SEED_PRODUCTS.slice(0, 3)],
      extra: [o, { id: 'evil', status: 'teleported' }],
      moves: { '20261103-1': 'packed', x: 'flying' },
      cart: [{ p: 'timur', v: '50g', q: 99 }, { p: 1 }],
      range: 90,
      theme: 'light',
      sound: 'yes',
      seq: 3,
    })
  );
  const s = cleanSaved(raw);
  assert.equal(s.range, 90);
  assert.equal(s.theme, 'light');
  assert.equal(s.sound, false);
  assert.equal(s.seq, 3);
  assert.deepEqual(s.extra, [o]);
  assert.deepEqual(s.moves, { '20261103-1': 'packed' });
  assert.deepEqual(s.cart, [{ p: 'timur', v: '50g', q: MAX_QTY }]);
  assert.ok(s.products);
  assert.equal(s.products!.length, SEED_PRODUCTS.length + 1, 'missing seed products come back, the broken one goes');
  assert.equal(s.products![0].id, 'pz');
  assert.equal(s.products![0].custom, true);
  // A seed id can't pretend to be custom (and so be deleted).
  const fake = cleanSaved({ v: 1, products: [{ ...SEED_PRODUCTS[0], custom: true }] });
  assert.equal(fake.products!.find((p: Product) => p.id === SEED_PRODUCTS[0].id)!.custom, undefined);
});

// ---------------------------------------------------------------- words

test('every seed product has a name and a line in all three languages; sizes read well', () => {
  for (const p of SEED_PRODUCTS) {
    const tx = PRODUCT_TEXT[p.id];
    assert.ok(tx, p.id);
    for (const l of LANGS) {
      assert.ok(tx.name[l].trim() && tx.desc[l].trim(), `${p.id} ${l}`);
      for (const v of p.variants) assert.ok(sizeLabel(v.size, l).trim(), `${p.id} ${v.size} ${l}`);
    }
  }
  assert.equal(sizeLabel('250g', 'en'), '250 g');
  assert.equal(sizeLabel('6pcs', 'de'), '6 Stk.');
  assert.equal(sizeLabel('250g', 'ne'), '२५० ग्राम');
  assert.equal(sizeLabel('one', 'de'), 'Einheitsgröße');
  assert.equal(sizeLabel('a jar', 'en'), 'a jar');
  for (const c of CATS) for (const l of LANGS) assert.ok(CAT_NAMES[c][l]);
  assert.equal(count(1234, 'de'), '1.234');
  assert.equal(count(2.5, 'de'), '2,5');
  assert.equal(count(1234, 'ne'), '१,२३४');
  assert.equal(num(42, 'ne'), '४२');
  assert.equal(statusText(COPY.en, 'ready', 'delivery'), 'Out for delivery');
  assert.equal(statusText(COPY.en, 'ready', 'pickup'), 'Ready for pickup');
});

function strings(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') out.push(x);
  else if (typeof x === 'function') {
    try {
      const r = (x as (...a: string[]) => unknown)('7', '3', '5');
      if (typeof r === 'string') out.push(r);
    } catch {
      /* not a text function */
    }
  } else if (Array.isArray(x)) for (const y of x) strings(y, out);
  else if (x && typeof x === 'object') for (const y of Object.values(x)) strings(y, out);
  return out;
}

test('no money words in any language — only the two "hidden in this demo" notes', () => {
  const money = /€|\$\s?\d|\beur\b|\beuros?\b|\bprices?\b|\bpricing|\bfees?\b|\bcosts?\b|\bcheap|\brevenue|\bturnover|\bdiscount|\bquotes?\b|\brates?\b|\bpackages?\b|\bhire|\bpay(?!ment step)|\bpaid\b|\bcheckout total|preis|gebühr|\bkosten\b|\bkostet\b|umsatz|rabatt|\bangebot|\bpaket|rechnung|bezahl(?!schritt)|(?<!निः)शुल्क|मूल्य|रुपैयाँ|छुट|भुक्तानी(?!को चरण)|आम्दानी/i;
  const allowed = new Set([COPY.en.pricesHidden, COPY.de.pricesHidden, COPY.ne.pricesHidden]);
  const all = [...LANGS.flatMap((l) => strings(COPY[l])), ...LANGS.flatMap((l) => strings(FRAME[l])), ...strings(PRODUCT_TEXT), ...strings(CAT_NAMES)];
  assert.ok(all.length > 600, `${all.length} strings scanned`);
  const hits = all.filter((s) => money.test(s) && !allowed.has(s));
  assert.deepEqual(hits, []);
  assert.match(COPY.en.paymentHidden, /hidden in this demo/);
  assert.match(COPY.de.paymentHidden, /ausgeblendet/);
  assert.match(COPY.ne.paymentHidden, /लुकाइएको/);
});

test('every language has every line (German and Nepali are not English)', () => {
  const en = strings(COPY.en);
  for (const l of ['de', 'ne'] as Lang[]) {
    const other = strings(COPY[l]);
    assert.equal(other.length, en.length, l);
    const same = other.filter((s, i) => s === en[i] && /[a-z]{4,}/i.test(s) && !/^(OK|Status|Code|Snacks|Name \(|Dhaka|Topi|Diyo|Indigo|dhaka-dal|product|category|size|in_stock|reorder_at|status)/.test(s));
    assert.ok(same.length < 8, `${l} copies English: ${same.join(' | ')}`);
  }
});
