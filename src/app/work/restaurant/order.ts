// The rules behind the /work/restaurant demo — QR table ordering for a made-up
// Nepali restaurant ("Himalayan Chulo", Köln). Pure functions over one plain
// state object, so the guest phone, the kitchen board and the waiter's floor
// plan are three drawings of the same data and stay in step by themselves.
//
// Time is a simulated service clock: the evening runs SIM_SPEED times faster
// than real time so a dish cooks in about a minute, and it stands still while
// the page is closed. The other eleven tables are simulated guests who sit
// down, order, eat, ask for the bill and leave — capped so the board looks busy
// but never floods. A seeded random number keeps every run reproducible
// (tests/restaurantDemo.test.ts plays whole evenings on it).
//
// No prices, amounts or payments exist anywhere in here: the "bill" is an
// itemised order summary without money (see the money test).

export type Lang = 'en' | 'de' | 'ne';
export type Station = 'momo' | 'curry' | 'bar';
export type Cat = 'momo' | 'thali' | 'chowmein' | 'newari' | 'drinks' | 'desserts';
export type Style = 'steamed' | 'fried' | 'jhol' | 'chilli';
export type Spice = 1 | 2 | 3;
export type ArtKind =
  | 'momo'
  | 'thali'
  | 'noodles'
  | 'thukpa'
  | 'newari'
  | 'choila'
  | 'bara'
  | 'chatamari'
  | 'tea'
  | 'lassi'
  | 'lime'
  | 'juju'
  | 'selroti'
  | 'kheer';

export type Dish = {
  id: string;
  cat: Cat;
  station: Station;
  /** The Nepali name in Devanagari and in Roman letters — kept in every language. */
  ne: string;
  roman: string;
  veg: boolean;
  vegan: boolean;
  /** 0 = not spicy, 3 = very. */
  spicy: 0 | 1 | 2 | 3;
  /** German menu allergen letters (A gluten, C egg, F soy, G milk, H nuts, I celery, K sesame). */
  allergens: string;
  /** Minutes on the stove (simulated). */
  prep: number;
  styles?: boolean;
  spice?: boolean;
  achar?: boolean;
  art: ArtKind;
  /** Tint for the drawing. */
  hue: number;
  popular?: boolean;
};

export const CATS: Cat[] = ['momo', 'thali', 'chowmein', 'newari', 'drinks', 'desserts'];
export const STATIONS: Station[] = ['momo', 'curry', 'bar'];
export const STYLES: Style[] = ['steamed', 'fried', 'jhol', 'chilli'];
export const ALLERGEN_LETTERS = ['A', 'C', 'F', 'G', 'H', 'I', 'K'] as const;

export const DISHES: Dish[] = [
  { id: 'veg-momo', cat: 'momo', station: 'momo', ne: 'तरकारी मःम', roman: 'Tarkari Momo', veg: true, vegan: false, spicy: 1, allergens: 'AGK', prep: 10, styles: true, spice: true, achar: true, art: 'momo', hue: 120, popular: true },
  { id: 'chicken-momo', cat: 'momo', station: 'momo', ne: 'कुखुराको मःम', roman: 'Kukhura Momo', veg: false, vegan: false, spicy: 1, allergens: 'AK', prep: 10, styles: true, spice: true, achar: true, art: 'momo', hue: 35, popular: true },
  { id: 'buff-momo', cat: 'momo', station: 'momo', ne: 'बफ मःम', roman: 'Buff Momo', veg: false, vegan: false, spicy: 2, allergens: 'AK', prep: 11, styles: true, spice: true, achar: true, art: 'momo', hue: 15 },
  { id: 'tofu-momo', cat: 'momo', station: 'momo', ne: 'टोफु मःम', roman: 'Tofu Momo', veg: true, vegan: true, spicy: 1, allergens: 'AFK', prep: 10, styles: true, spice: true, achar: true, art: 'momo', hue: 160 },
  { id: 'dal-bhat', cat: 'thali', station: 'curry', ne: 'दाल भात तरकारी', roman: 'Dal Bhat Tarkari', veg: true, vegan: true, spicy: 1, allergens: '', prep: 8, spice: true, achar: true, art: 'thali', hue: 45, popular: true },
  { id: 'khasi-thali', cat: 'thali', station: 'curry', ne: 'खसीको मासु थाली', roman: 'Khasi ko Masu Thali', veg: false, vegan: false, spicy: 2, allergens: 'G', prep: 12, spice: true, achar: true, art: 'thali', hue: 8 },
  { id: 'kukhura-thali', cat: 'thali', station: 'curry', ne: 'कुखुराको थाली', roman: 'Kukhura Thali', veg: false, vegan: false, spicy: 2, allergens: 'G', prep: 12, spice: true, achar: true, art: 'thali', hue: 28 },
  { id: 'veg-chowmein', cat: 'chowmein', station: 'curry', ne: 'तरकारी चाउमिन', roman: 'Tarkari Chowmein', veg: true, vegan: true, spicy: 1, allergens: 'AF', prep: 7, spice: true, art: 'noodles', hue: 95 },
  { id: 'chicken-chowmein', cat: 'chowmein', station: 'curry', ne: 'कुखुराको चाउमिन', roman: 'Kukhura Chowmein', veg: false, vegan: false, spicy: 1, allergens: 'ACF', prep: 8, spice: true, art: 'noodles', hue: 32, popular: true },
  { id: 'thukpa', cat: 'chowmein', station: 'curry', ne: 'थुक्पा', roman: 'Thukpa', veg: false, vegan: false, spicy: 2, allergens: 'AI', prep: 9, spice: true, art: 'thukpa', hue: 20 },
  { id: 'samay-baji', cat: 'newari', station: 'curry', ne: 'समय बजि', roman: 'Samay Baji', veg: false, vegan: false, spicy: 2, allergens: 'CFK', prep: 9, achar: true, art: 'newari', hue: 40, popular: true },
  { id: 'choila', cat: 'newari', station: 'curry', ne: 'छोयला', roman: 'Choila', veg: false, vegan: false, spicy: 3, allergens: 'K', prep: 8, art: 'choila', hue: 5 },
  { id: 'bara', cat: 'newari', station: 'curry', ne: 'बारा', roman: 'Bara', veg: true, vegan: true, spicy: 0, allergens: '', prep: 7, achar: true, art: 'bara', hue: 38 },
  { id: 'chatamari', cat: 'newari', station: 'curry', ne: 'चतामरी', roman: 'Chatamari', veg: true, vegan: false, spicy: 0, allergens: 'C', prep: 9, art: 'chatamari', hue: 50 },
  { id: 'masala-chiya', cat: 'drinks', station: 'bar', ne: 'मसला चिया', roman: 'Masala Chiya', veg: true, vegan: false, spicy: 0, allergens: 'G', prep: 3, art: 'tea', hue: 28, popular: true },
  { id: 'aduwa-chiya', cat: 'drinks', station: 'bar', ne: 'अदुवा चिया', roman: 'Aduwa Chiya', veg: true, vegan: true, spicy: 0, allergens: '', prep: 3, art: 'tea', hue: 45 },
  { id: 'mango-lassi', cat: 'drinks', station: 'bar', ne: 'आँपको लस्सी', roman: 'Aanp ko Lassi', veg: true, vegan: false, spicy: 0, allergens: 'G', prep: 2, art: 'lassi', hue: 38 },
  { id: 'nimbu-pani', cat: 'drinks', station: 'bar', ne: 'निबुपानी', roman: 'Nimbu Pani', veg: true, vegan: true, spicy: 0, allergens: '', prep: 2, art: 'lime', hue: 90 },
  { id: 'juju-dhau', cat: 'desserts', station: 'bar', ne: 'जुजु धौ', roman: 'Juju Dhau', veg: true, vegan: false, spicy: 0, allergens: 'G', prep: 2, art: 'juju', hue: 30 },
  { id: 'sel-roti', cat: 'desserts', station: 'bar', ne: 'सेल रोटी', roman: 'Sel Roti', veg: true, vegan: true, spicy: 0, allergens: '', prep: 4, art: 'selroti', hue: 32 },
  { id: 'kheer', cat: 'desserts', station: 'bar', ne: 'खीर', roman: 'Kheer', veg: true, vegan: false, spicy: 0, allergens: 'GH', prep: 2, art: 'kheer', hue: 42 },
];

const BY_ID = new Map(DISHES.map((d) => [d.id, d]));
export function dishById(id: string): Dish | undefined {
  return BY_ID.get(id);
}

// ---------------- state ----------------

export type Choice = { style?: Style; spice?: Spice; achar?: boolean };
export type Line = { dish: string; qty: number } & Choice;
export type Status = 'received' | 'cooking' | 'ready' | 'served';
export const STATUSES: Status[] = ['received', 'cooking', 'ready', 'served'];

export type Order = {
  id: number;
  table: number;
  lines: Line[];
  status: Status;
  /** Simulated ms since the doors opened. */
  at: number;
  cookingAt?: number;
  readyAt?: number;
  servedAt?: number;
  /** When the simulated kitchen / waiter moves it on by itself (0 = never). */
  dueAt: number;
};

export type Table = {
  n: number;
  seats: number;
  seatedAt: number | null;
  guests: number;
  billAt: number | null;
  callAt: number | null;
  callAckAt: number | null;
  /** When the simulated guests at this table do their next thing. */
  nextAt: number;
};

export type Stats = { orders: number; dishes: Record<string, number>; prepSum: number; prepN: number };

export type State = {
  v: 1;
  lang: Lang;
  seed: number;
  /** Simulated ms since the doors opened at OPEN_AT. */
  now: number;
  nextId: number;
  guestTable: number;
  soldOut: string[];
  cart: Line[];
  orders: Order[];
  tables: Table[];
  stats: Stats;
  /** Counts the guest's visits: a cleared table starts a new one. */
  visit: number;
};

export type TableStatus = 'free' | 'ordering' | 'waiting' | 'eating' | 'bill';

export const MIN = 60_000;
/** One real second is SIM_SPEED simulated seconds. */
export const SIM_SPEED = 8;
/** The longest jump one tick may make, so a sleeping tab does not fast-forward the evening. */
export const MAX_STEP = MIN;
/** The doors open at 17:00 (minutes after midnight). */
export const OPEN_AT = 17 * 60;
export const TABLE_COUNT = 12;
export const SEATS = [2, 4, 4, 2, 6, 4, 4, 2, 2, 4, 6, 4];
export const DEFAULT_GUEST_TABLE = 7;

/** The simulated guests never keep more than this many orders in the kitchen. */
export const MAX_ACTIVE = 12;
/** …nor sit at more than this many tables at once. */
export const MAX_SEATED = 10;
/** The visitor's own table: at most this many orders still on their way. */
export const MAX_GUEST_ACTIVE = 4;
export const MAX_CART_LINES = 20;
export const MAX_QTY = 9;
/** A waiter answers a call by themselves after this long. */
export const CALL_AUTO_ACK = 3 * MIN;
/** …and the "on the way" note goes away this long after. */
export const CALL_CLEAR = 2 * MIN;
/** Kitchen timer colours, minutes in a column: [amber from, red from]. */
export const LIMITS = { received: [3, 6], ready: [3, 6] } as const;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** mulberry32 on the state's seed — reproducible "randomness". */
export function rnd(s: State): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rint(s: State, lo: number, hi: number): number {
  return lo + Math.floor(rnd(s) * (hi - lo + 1));
}
function pick<T>(s: State, list: T[]): T {
  return list[Math.floor(rnd(s) * list.length)];
}

export function clockLabel(now: number): string {
  const m = OPEN_AT + Math.floor(now / MIN);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function minsSince(now: number, t: number | undefined | null): number {
  return t == null ? 0 : Math.max(0, Math.floor((now - t) / MIN));
}

export function prepFor(o: { lines: Line[] }): number {
  let m = 2;
  for (const l of o.lines) m = Math.max(m, dishById(l.dish)?.prep ?? 2);
  return m;
}

export function sameChoice(a: Line, b: Line): boolean {
  return a.dish === b.dish && a.style === b.style && a.spice === b.spice && Boolean(a.achar) === Boolean(b.achar);
}

export function isSoldOut(s: State, dishId: string): boolean {
  return s.soldOut.includes(dishId);
}

export function tableOrders(s: State, n: number): Order[] {
  return s.orders.filter((o) => o.table === n);
}
export function activeOrders(s: State): Order[] {
  return s.orders.filter((o) => o.status !== 'served');
}

export function tableStatus(s: State, n: number): TableStatus {
  const t = s.tables.find((x) => x.n === n);
  if (!t || t.seatedAt == null) return 'free';
  if (t.billAt != null) return 'bill';
  const mine = tableOrders(s, n);
  if (mine.some((o) => o.status !== 'served')) return 'waiting';
  if (mine.length) return 'eating';
  return 'ordering';
}

export function callActive(t: Table): boolean {
  return t.callAt != null && t.callAckAt == null;
}

/** Kitchen timer for a ticket: minutes in its column and whether that is too long. */
export function ticketClock(o: Order, now: number): { mins: number; level: '' | 'warn' | 'late' } {
  if (o.status === 'served') return { mins: 0, level: '' };
  if (o.status === 'cooking') {
    const mins = minsSince(now, o.cookingAt);
    const p = prepFor(o);
    return { mins, level: mins >= p + 4 ? 'late' : mins >= p ? 'warn' : '' };
  }
  const from = o.status === 'received' ? o.at : o.readyAt;
  const mins = minsSince(now, from);
  const [warn, late] = LIMITS[o.status];
  return { mins, level: mins >= late ? 'late' : mins >= warn ? 'warn' : '' };
}

/** How far along the guest's order is (0–1) and about how many minutes are left. */
export function progress(o: Order, now: number): { frac: number; left: number } {
  const p = prepFor(o);
  if (o.status === 'received') return { frac: 0.12, left: p + 1 };
  if (o.status === 'cooking') {
    const done = Math.min(1, (now - (o.cookingAt ?? now)) / (p * MIN));
    return { frac: 0.25 + 0.5 * done, left: Math.max(1, Math.ceil(p - (now - (o.cookingAt ?? now)) / MIN)) };
  }
  if (o.status === 'ready') return { frac: 0.88, left: 1 };
  return { frac: 1, left: 0 };
}

// ---------------- moving an order on ----------------

function dueAfter(s: State, o: Order, status: Status): number {
  if (status === 'received') return s.now + rint(s, 1, 4) * MIN;
  if (status === 'cooking') return s.now + Math.max(2, prepFor(o) + rint(s, -2, 5)) * MIN;
  if (status === 'ready') return s.now + rint(s, 1, 4) * MIN;
  return 0;
}

/** received → cooking → ready → served, in place on a draft. */
function step(s: State, o: Order): Status | null {
  const i = STATUSES.indexOf(o.status);
  if (i < 0 || i >= STATUSES.length - 1) return null;
  const next = STATUSES[i + 1];
  o.status = next;
  if (next === 'cooking') o.cookingAt = s.now;
  if (next === 'ready') {
    o.readyAt = s.now;
    s.stats.prepSum += s.now - o.at;
    s.stats.prepN += 1;
  }
  if (next === 'served') o.servedAt = s.now;
  o.dueAt = dueAfter(s, o, next);
  if (next === 'served') {
    const t = s.tables.find((x) => x.n === o.table);
    // Everything is on the table: the simulated guests eat for a while.
    if (t && t.n !== s.guestTable && !s.orders.some((x) => x.table === t.n && x.status !== 'served')) t.nextAt = s.now + rint(s, 5, 10) * MIN;
  }
  return next;
}

/** Tap on the kitchen board (or "serve" on the waiter's list). */
export function advance(state: State, id: number): State {
  const s = clone(state);
  const o = s.orders.find((x) => x.id === id);
  if (!o || !step(s, o)) return state;
  return s;
}

// ---------------- the guest at their table ----------------

export type AddResult = { state: State; ok: boolean; reason?: 'sold-out' | 'full' | 'unknown' };

export function cleanChoice(d: Dish, c: Choice): Choice {
  const out: Choice = {};
  if (d.styles) out.style = c.style && STYLES.includes(c.style) ? c.style : 'steamed';
  if (d.spice) out.spice = c.spice === 1 || c.spice === 2 || c.spice === 3 ? c.spice : (Math.max(1, d.spicy) as Spice);
  if (d.achar && c.achar) out.achar = true;
  return out;
}

export function addToCart(state: State, dishId: string, qty: number, choice: Choice = {}): AddResult {
  const d = dishById(dishId);
  if (!d) return { state, ok: false, reason: 'unknown' };
  if (isSoldOut(state, dishId)) return { state, ok: false, reason: 'sold-out' };
  const q = Math.max(1, Math.min(MAX_QTY, Math.floor(qty) || 1));
  const s = clone(state);
  const line: Line = { dish: dishId, qty: q, ...cleanChoice(d, choice) };
  const same = s.cart.find((l) => sameChoice(l, line));
  if (same) same.qty = Math.min(MAX_QTY, same.qty + q);
  else {
    if (s.cart.length >= MAX_CART_LINES) return { state, ok: false, reason: 'full' };
    s.cart.push(line);
  }
  return { state: s, ok: true };
}

export function setCartQty(state: State, index: number, qty: number): State {
  if (!state.cart[index]) return state;
  const s = clone(state);
  const q = Math.min(MAX_QTY, Math.floor(qty));
  if (q <= 0) s.cart.splice(index, 1);
  else s.cart[index].qty = q;
  return s;
}

export function cartCount(s: State): number {
  return s.cart.reduce((n, l) => n + l.qty, 0);
}

export type SendResult = { state: State; ok: boolean; reason?: 'empty' | 'sold-out' | 'busy'; id?: number };

function placeOrder(s: State, table: number, lines: Line[]): Order {
  const o: Order = { id: s.nextId++, table, lines, status: 'received', at: s.now, dueAt: 0 };
  o.dueAt = dueAfter(s, o, 'received');
  s.orders.push(o);
  s.stats.orders += 1;
  for (const l of lines) s.stats.dishes[l.dish] = (s.stats.dishes[l.dish] ?? 0) + l.qty;
  trimOrders(s);
  return o;
}

/** "Send to kitchen": the cart becomes an order for the guest's table. */
export function sendCart(state: State): SendResult {
  if (!state.cart.length) return { state, ok: false, reason: 'empty' };
  if (state.cart.some((l) => isSoldOut(state, l.dish))) return { state, ok: false, reason: 'sold-out' };
  if (tableOrders(state, state.guestTable).filter((o) => o.status !== 'served').length >= MAX_GUEST_ACTIVE) return { state, ok: false, reason: 'busy' };
  const s = clone(state);
  const t = s.tables.find((x) => x.n === s.guestTable)!;
  if (t.seatedAt == null) t.seatedAt = s.now;
  t.billAt = null;
  const o = placeOrder(s, s.guestTable, s.cart);
  s.cart = [];
  return { state: s, ok: true, id: o.id };
}

/** Drop sold-out dishes from the cart (after the kitchen ran out). */
export function dropSoldOut(state: State): State {
  if (!state.cart.some((l) => isSoldOut(state, l.dish))) return state;
  const s = clone(state);
  s.cart = s.cart.filter((l) => !isSoldOut(s, l.dish));
  return s;
}

export function callWaiter(state: State, n: number = state.guestTable): State {
  const t = state.tables.find((x) => x.n === n);
  if (!t || callActive(t)) return state;
  const s = clone(state);
  const d = s.tables.find((x) => x.n === n)!;
  d.callAt = s.now;
  d.callAckAt = null;
  if (d.seatedAt == null) d.seatedAt = s.now;
  return s;
}

export function askBill(state: State, n: number = state.guestTable): State {
  const t = state.tables.find((x) => x.n === n);
  if (!t || t.billAt != null || !tableOrders(state, n).length) return state;
  const s = clone(state);
  s.tables.find((x) => x.n === n)!.billAt = s.now;
  return s;
}

export function ackCall(state: State, n: number): State {
  const t = state.tables.find((x) => x.n === n);
  if (!t || !callActive(t)) return state;
  const s = clone(state);
  s.tables.find((x) => x.n === n)!.callAckAt = s.now;
  return s;
}

/** The guests have left: the table is free again (the visitor's own table starts a new visit). */
export function clearTable(state: State, n: number): State {
  const t = state.tables.find((x) => x.n === n);
  if (!t || t.seatedAt == null) return state;
  const s = clone(state);
  s.orders = s.orders.filter((o) => o.table !== n);
  const d = s.tables.find((x) => x.n === n)!;
  d.billAt = null;
  d.callAt = null;
  d.callAckAt = null;
  if (n === s.guestTable) {
    d.seatedAt = s.now;
    s.cart = [];
    s.visit += 1;
  } else {
    d.seatedAt = null;
    d.nextAt = s.now + rint(s, 1, 4) * MIN;
  }
  return s;
}

export type SummaryLine = Line & { served: number };

/** "Your order summary": everything this table ordered, the same dish and options added up. No prices. */
export function orderSummary(s: State, n: number = s.guestTable): SummaryLine[] {
  const out: SummaryLine[] = [];
  for (const o of tableOrders(s, n)) {
    for (const l of o.lines) {
      const same = out.find((x) => sameChoice(x, l));
      const served = o.status === 'served' ? l.qty : 0;
      if (same) {
        same.qty += l.qty;
        same.served += served;
      } else out.push({ ...l, served });
    }
  }
  return out;
}

/** Scanning another table's QR code: the visitor now sits there. */
export function switchGuestTable(state: State, n: number): State {
  if (!Number.isInteger(n) || n < 1 || n > TABLE_COUNT || n === state.guestTable) return state;
  const s = clone(state);
  const old = s.tables.find((x) => x.n === s.guestTable)!;
  // The old table goes back to the simulated guests (as if the visitor had left).
  s.orders = s.orders.filter((o) => o.table !== old.n);
  Object.assign(old, { seatedAt: null, billAt: null, callAt: null, callAckAt: null, nextAt: s.now + 2 * MIN });
  const t = s.tables.find((x) => x.n === n)!;
  s.orders = s.orders.filter((o) => o.table !== n);
  Object.assign(t, { seatedAt: s.now, guests: Math.min(2, t.seats), billAt: null, callAt: null, callAckAt: null });
  s.guestTable = n;
  s.cart = [];
  s.visit += 1;
  return s;
}

// ---------------- the owner ----------------

export function toggleSoldOut(state: State, dishId: string): State {
  if (!dishById(dishId)) return state;
  const s = clone(state);
  s.soldOut = s.soldOut.includes(dishId) ? s.soldOut.filter((x) => x !== dishId) : [...s.soldOut, dishId];
  return s;
}

export type Today = { orders: number; dishes: number; avgPrep: number; top: { dish: string; count: number }[] };

/** Today's counts for the owner — counts only, no money. */
export function today(s: State, topN = 5): Today {
  const entries = Object.entries(s.stats.dishes).filter(([id, n]) => dishById(id) && n > 0);
  const dishes = entries.reduce((n, [, c]) => n + c, 0);
  const top = entries
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([dish, count]) => ({ dish, count }));
  return { orders: s.stats.orders, dishes, avgPrep: s.stats.prepN ? Math.round(s.stats.prepSum / s.stats.prepN / MIN) : 0, top };
}

// ---------------- the simulated evening ----------------

export type SimEvent =
  | { kind: 'order'; id: number; table: number }
  | { kind: 'status'; id: number; table: number; status: Status }
  | { kind: 'call'; table: number }
  | { kind: 'bill'; table: number }
  | { kind: 'left'; table: number };

function randomLines(s: State, guests: number, small: boolean): Line[] {
  const free = DISHES.filter((d) => !isSoldOut(s, d.id));
  const mains = free.filter((d) => d.cat !== 'drinks' && d.cat !== 'desserts');
  const momo = mains.filter((d) => d.cat === 'momo');
  const sides = free.filter((d) => d.cat === 'drinks' || d.cat === 'desserts');
  const lines: Line[] = [];
  const add = (d: Dish | undefined, qty = 1) => {
    if (!d) return;
    const l: Line = { dish: d.id, qty, ...cleanChoice(d, { style: pick(s, STYLES), spice: rint(s, 1, 3) as Spice, achar: rnd(s) < 0.3 }) };
    const same = lines.find((x) => sameChoice(x, l));
    if (same) same.qty = Math.min(MAX_QTY, same.qty + qty);
    else lines.push(l);
  };
  if (small) {
    add(pick(s, sides), rint(s, 1, Math.max(1, guests)));
  } else {
    const n = Math.max(1, Math.min(4, guests));
    for (let i = 0; i < n; i++) add(momo.length && rnd(s) < 0.45 ? pick(s, momo) : pick(s, mains));
    if (rnd(s) < 0.6 && sides.length) add(pick(s, sides.filter((d) => d.cat === 'drinks').length ? sides.filter((d) => d.cat === 'drinks') : sides), rint(s, 1, Math.max(1, guests)));
  }
  return lines;
}

/** Keep the order list small: served orders of tables that have long gone are already removed on leaving. */
function trimOrders(s: State) {
  const LIMIT = 60;
  if (s.orders.length <= LIMIT) return;
  const served = s.orders.filter((o) => o.status === 'served').sort((a, b) => a.at - b.at);
  const drop = new Set(served.slice(0, s.orders.length - LIMIT).map((o) => o.id));
  s.orders = s.orders.filter((o) => !drop.has(o.id));
}

/**
 * Run the evening forward by `realMs` of real time. Returns the new state and
 * what happened (new orders, status changes, calls), for toasts and sounds.
 */
export function tick(state: State, realMs: number): { state: State; events: SimEvent[] } {
  const dt = Math.max(0, Math.min(MAX_STEP, Math.round(realMs * SIM_SPEED)));
  if (!dt) return { state, events: [] };
  const s = clone(state);
  const events: SimEvent[] = [];
  s.now += dt;

  // The kitchen and the waiter move orders on when they are due.
  for (const o of [...s.orders].sort((a, b) => a.dueAt - b.dueAt)) {
    if (o.status === 'served' || !o.dueAt || o.dueAt > s.now) continue;
    const st = step(s, o);
    if (st) events.push({ kind: 'status', id: o.id, table: o.table, status: st });
  }

  // Waiters answer calls; the note clears a little later.
  for (const t of s.tables) {
    if (callActive(t) && s.now - (t.callAt ?? 0) >= CALL_AUTO_ACK) t.callAckAt = s.now;
    if (t.callAckAt != null && s.now - t.callAckAt >= CALL_CLEAR) {
      t.callAt = null;
      t.callAckAt = null;
    }
  }

  // The other tables' guests.
  for (const t of s.tables) {
    if (t.n === s.guestTable || t.nextAt > s.now) continue;
    const status = tableStatus(s, t.n);
    const seated = s.tables.filter((x) => x.n !== s.guestTable && x.seatedAt != null).length;
    const active = activeOrders(s).length;
    if (status === 'free') {
      if (seated < MAX_SEATED) {
        t.seatedAt = s.now;
        t.guests = rint(s, 1, t.seats);
        t.nextAt = s.now + rint(s, 1, 3) * MIN;
      } else t.nextAt = s.now + 2 * MIN;
    } else if (status === 'ordering') {
      if (active < MAX_ACTIVE) {
        const o = placeOrder(s, t.n, randomLines(s, t.guests, false));
        events.push({ kind: 'order', id: o.id, table: t.n });
        t.nextAt = s.now + MIN;
      } else t.nextAt = s.now + MIN;
    } else if (status === 'waiting') {
      if (t.callAt == null && rnd(s) < 0.05) {
        t.callAt = s.now;
        t.callAckAt = null;
        events.push({ kind: 'call', table: t.n });
      }
      t.nextAt = s.now + MIN;
    } else if (status === 'eating') {
      if (tableOrders(s, t.n).length < 2 && active < MAX_ACTIVE && rnd(s) < 0.35) {
        const o = placeOrder(s, t.n, randomLines(s, t.guests, true));
        events.push({ kind: 'order', id: o.id, table: t.n });
        t.nextAt = s.now + MIN;
      } else {
        t.billAt = s.now;
        events.push({ kind: 'bill', table: t.n });
        t.nextAt = s.now + rint(s, 2, 4) * MIN;
      }
    } else if (status === 'bill') {
      s.orders = s.orders.filter((o) => o.table !== t.n);
      Object.assign(t, { seatedAt: null, billAt: null, callAt: null, callAckAt: null, nextAt: s.now + rint(s, 1, 4) * MIN });
      events.push({ kind: 'left', table: t.n });
    }
  }
  return { state: s, events };
}

// ---------------- the evening as it starts (mid-service) ----------------

const L = (dish: string, qty = 1, c: Choice = {}): Line => ({ dish, qty, ...cleanChoice(dishById(dish)!, c) });

export function seedState(lang: Lang = 'en'): State {
  const now = 107 * MIN; // 18:47
  const ago = (m: number) => now - m * MIN;
  const tables: Table[] = SEATS.map((seats, i) => ({ n: i + 1, seats, seatedAt: null, guests: 0, billAt: null, callAt: null, callAckAt: null, nextAt: now + (i % 4) * MIN }));
  const sit = (n: number, guests: number, since: number, extra: Partial<Table> = {}) => Object.assign(tables[n - 1], { seatedAt: ago(since), guests, ...extra });
  sit(1, 2, 40, { nextAt: now + 4 * MIN });
  sit(2, 3, 9, { nextAt: now + MIN });
  sit(3, 4, 18, { nextAt: now + MIN });
  sit(5, 6, 25, { nextAt: now + MIN });
  sit(6, 3, 55, { billAt: ago(1), nextAt: now + 2 * MIN });
  sit(7, 2, 1, { nextAt: now + 60 * MIN });
  sit(8, 2, 1, { nextAt: now + 2 * MIN });
  sit(10, 4, 35, { callAt: ago(0.5), nextAt: now + 6 * MIN });
  sit(11, 5, 22, { nextAt: now + MIN });
  sit(12, 3, 12, { nextAt: now + MIN });
  const orders: Order[] = [
    { id: 131, table: 1, status: 'served', at: ago(34), cookingAt: ago(31), readyAt: ago(22), servedAt: ago(20), dueAt: 0, lines: [L('chicken-momo', 1, { style: 'jhol', spice: 2 }), L('dal-bhat', 1, { spice: 1, achar: true }), L('masala-chiya', 2)] },
    { id: 134, table: 6, status: 'served', at: ago(46), cookingAt: ago(44), readyAt: ago(33), servedAt: ago(31), dueAt: 0, lines: [L('khasi-thali', 2, { spice: 2 }), L('bara', 1), L('mango-lassi', 3)] },
    { id: 136, table: 10, status: 'served', at: ago(28), cookingAt: ago(26), readyAt: ago(15), servedAt: ago(13), dueAt: 0, lines: [L('samay-baji', 2), L('buff-momo', 2, { style: 'chilli', spice: 3 }), L('nimbu-pani', 4)] },
    { id: 137, table: 5, status: 'ready', at: ago(19), cookingAt: ago(16), readyAt: ago(2), dueAt: now + 2 * MIN, lines: [L('veg-momo', 2, { style: 'fried' }), L('chicken-momo', 2, { style: 'steamed', achar: true }), L('thukpa', 1, { spice: 3 }), L('kukhura-thali', 1)] },
    { id: 138, table: 11, status: 'cooking', at: ago(16), cookingAt: ago(13), dueAt: now + 2 * MIN, lines: [L('khasi-thali', 2, { spice: 3 }), L('choila', 1), L('chatamari', 1), L('aduwa-chiya', 3)] },
    { id: 139, table: 3, status: 'cooking', at: ago(9), cookingAt: ago(6), dueAt: now + 4 * MIN, lines: [L('tofu-momo', 2, { style: 'jhol', spice: 2 }), L('veg-chowmein', 1), L('mango-lassi', 2)] },
    { id: 140, table: 12, status: 'received', at: ago(4), dueAt: now + MIN, lines: [L('chicken-chowmein', 2, { spice: 2 }), L('buff-momo', 1, { style: 'steamed', achar: true })] },
    { id: 141, table: 2, status: 'received', at: ago(1), dueAt: now + 3 * MIN, lines: [L('dal-bhat', 2, { spice: 2, achar: true }), L('juju-dhau', 1), L('masala-chiya', 1)] },
  ];
  const dishes: Record<string, number> = {
    'chicken-momo': 19,
    'veg-momo': 14,
    'buff-momo': 9,
    'tofu-momo': 5,
    'dal-bhat': 12,
    'khasi-thali': 8,
    'kukhura-thali': 6,
    'veg-chowmein': 4,
    'chicken-chowmein': 7,
    thukpa: 5,
    'samay-baji': 6,
    choila: 4,
    bara: 5,
    chatamari: 2,
    'masala-chiya': 16,
    'aduwa-chiya': 6,
    'mango-lassi': 11,
    'nimbu-pani': 9,
    'juju-dhau': 5,
    'sel-roti': 3,
    kheer: 2,
  };
  return {
    v: 1,
    lang,
    seed: 20261103,
    now,
    nextId: 142,
    guestTable: DEFAULT_GUEST_TABLE,
    soldOut: ['chatamari'],
    cart: [],
    orders,
    tables,
    stats: { orders: 33, dishes, prepSum: 33 * 11 * MIN, prepN: 33 },
    visit: 1,
  };
}

// ---------------- reading back what localStorage held ----------------

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const LANGS: Lang[] = ['en', 'de', 'ne'];

function cleanLine(v: unknown): Line | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const d = typeof r.dish === 'string' ? dishById(r.dish) : undefined;
  if (!d || !isNum(r.qty)) return null;
  const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(r.qty)));
  return { dish: d.id, qty, ...cleanChoice(d, { style: r.style as Style, spice: r.spice as Spice, achar: r.achar === true }) };
}

/** Whatever was stored → a state the app can draw, or a fresh evening. */
export function normalize(raw: unknown, lang: Lang = 'en'): State {
  const fresh = seedState(lang);
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !isNum(r.now) || !Array.isArray(r.tables) || !Array.isArray(r.orders)) return fresh;
  const s: State = { ...fresh, lang: LANGS.includes(r.lang as Lang) ? (r.lang as Lang) : lang };
  s.now = Math.max(0, r.now);
  s.seed = isNum(r.seed) ? r.seed | 0 : fresh.seed;
  s.guestTable = isNum(r.guestTable) && r.guestTable >= 1 && r.guestTable <= TABLE_COUNT ? Math.floor(r.guestTable) : DEFAULT_GUEST_TABLE;
  s.visit = isNum(r.visit) ? Math.max(1, Math.floor(r.visit)) : 1;
  s.soldOut = Array.isArray(r.soldOut) ? [...new Set(r.soldOut.filter((x): x is string => typeof x === 'string' && Boolean(dishById(x))))] : [];
  s.cart = (Array.isArray(r.cart) ? r.cart : []).map(cleanLine).filter((l): l is Line => l !== null).slice(0, MAX_CART_LINES);
  s.tables = SEATS.map((seats, i) => {
    const t = (r.tables as unknown[]).find((x) => x && typeof x === 'object' && (x as Table).n === i + 1) as Partial<Table> | undefined;
    const num = (v: unknown) => (isNum(v) ? v : null);
    return {
      n: i + 1,
      seats,
      seatedAt: num(t?.seatedAt),
      guests: isNum(t?.guests) ? Math.max(0, Math.min(seats, Math.floor(t.guests))) : 0,
      billAt: num(t?.billAt),
      callAt: num(t?.callAt),
      callAckAt: num(t?.callAckAt),
      nextAt: isNum(t?.nextAt) ? t.nextAt : s.now,
    };
  });
  const seen = new Set<number>();
  s.orders = [];
  for (const x of r.orders as unknown[]) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (!isNum(o.id) || seen.has(o.id) || !isNum(o.table) || o.table < 1 || o.table > TABLE_COUNT || !isNum(o.at)) continue;
    if (!STATUSES.includes(o.status as Status)) continue;
    const lines = (Array.isArray(o.lines) ? o.lines : []).map(cleanLine).filter((l): l is Line => l !== null);
    if (!lines.length) continue;
    seen.add(o.id);
    const order: Order = { id: o.id, table: Math.floor(o.table), lines, status: o.status as Status, at: o.at, dueAt: isNum(o.dueAt) ? o.dueAt : 0 };
    if (isNum(o.cookingAt)) order.cookingAt = o.cookingAt;
    if (isNum(o.readyAt)) order.readyAt = o.readyAt;
    if (isNum(o.servedAt)) order.servedAt = o.servedAt;
    s.orders.push(order);
  }
  trimOrders(s);
  s.nextId = Math.max(isNum(r.nextId) ? Math.floor(r.nextId) : 0, ...s.orders.map((o) => o.id + 1), fresh.nextId);
  const st = r.stats as Partial<Stats> | undefined;
  if (st && isNum(st.orders) && isNum(st.prepSum) && isNum(st.prepN) && st.dishes && typeof st.dishes === 'object') {
    const dishes: Record<string, number> = {};
    for (const [k, v] of Object.entries(st.dishes)) if (dishById(k) && isNum(v) && v > 0) dishes[k] = Math.floor(v);
    s.stats = { orders: Math.max(0, Math.floor(st.orders)), dishes, prepSum: Math.max(0, st.prepSum), prepN: Math.max(0, Math.floor(st.prepN)) };
  }
  const g = s.tables[s.guestTable - 1];
  if (g.seatedAt == null) g.seatedAt = s.now;
  return s;
}
