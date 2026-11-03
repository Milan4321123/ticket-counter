// The rules of "Dhaka & Dal" (/work/shop), a made-up Nepali grocery and crafts
// shop in Leipzig — without a browser, so tests/shopDemo.test.ts can pin them:
//
// - a seeded, deterministic order history (the same day always has the same
//   orders, whoever looks), busier on Saturdays, quiet on Sundays and with
//   real spikes in the two weeks before Dashain and Tihar;
// - the owner's numbers for 7 / 30 / 90 days: KPI counts, orders per day
//   with a 7-day moving average, top products, a weekday × hour heatmap,
//   category share, customers and their order counts;
// - stock: levels, reorder thresholds, the restock reminder, the storefront's
//   "only 3 left";
// - the order status machine New → Packed → Ready → Collected, bulk moves and
//   the pickup-code scan;
// - pickup / delivery slots, the cart, placing an order, simulated live orders;
// - CSV with proper escaping, and what comes back from localStorage.
//
// COUNTS ONLY. There is no price, total, revenue or payment anywhere in this
// shop: the operator of the studio is a student, the demo shows what the
// software does, not what anything is worth. Words live in content.ts.

export type Lang = 'en' | 'de' | 'ne';
export type L = Record<Lang, string>;

export const STORE_KEY = 'mn-demo:shop';

// ---------------------------------------------------------------- catalogue

export type CatId = 'spices' | 'lentils' | 'achar' | 'snacks' | 'crafts' | 'puja';
export const CATS: CatId[] = ['spices', 'lentils', 'achar', 'snacks', 'crafts', 'puja'];

export type ArtKind = 'jar' | 'packet' | 'sack' | 'box' | 'topi' | 'shawl' | 'bowl' | 'flags' | 'book' | 'diyo' | 'incense' | 'garland';
export const ART_KINDS: ArtKind[] = ['jar', 'packet', 'sack', 'box', 'topi', 'shawl', 'bowl', 'flags', 'book', 'diyo', 'incense', 'garland'];
export type ArtColor = 'red' | 'saffron' | 'turmeric' | 'green' | 'olive' | 'brown' | 'maroon' | 'cream' | 'indigo' | 'plum';
export const ART_COLORS: ArtColor[] = ['red', 'saffron', 'turmeric', 'green', 'olive', 'brown', 'maroon', 'cream', 'indigo', 'plum'];
export type Art = { kind: ArtKind; color: ArtColor };

/**
 * One size of a product. `size` is a code the words file turns into a label
 * ("250g" → "250 g" / "२५० g", "6pcs" → "6 Stk.", "M", "one" → "One size");
 * a size typed in the product editor is shown as typed.
 */
export type Variant = { id: string; size: string; stock: number; threshold: number };

export type Product = {
  id: string;
  cat: CatId;
  art: Art;
  variants: Variant[];
  /** How often it sells, relative (the history generator's weight). */
  weight: number;
  /** Set for products added or renamed in the editor; seed products take their name from content.ts. */
  name?: L;
  /** Added in the product editor (can be deleted again). */
  custom?: boolean;
};

const v = (id: string, stock: number, threshold: number, size = id): Variant => ({ id, size, stock, threshold });

export const SEED_PRODUCTS: Product[] = [
  // spices & masala
  { id: 'momomasala', cat: 'spices', art: { kind: 'packet', color: 'red' }, weight: 8, variants: [v('50g', 18, 8), v('100g', 12, 6)] },
  { id: 'timur', cat: 'spices', art: { kind: 'packet', color: 'olive' }, weight: 5, variants: [v('50g', 14, 6), v('100g', 9, 5)] },
  { id: 'jimbu', cat: 'spices', art: { kind: 'packet', color: 'green' }, weight: 3, variants: [v('20g', 4, 5)] },
  { id: 'garam', cat: 'spices', art: { kind: 'packet', color: 'brown' }, weight: 6, variants: [v('100g', 22, 8), v('250g', 10, 5)] },
  { id: 'besar', cat: 'spices', art: { kind: 'packet', color: 'turmeric' }, weight: 4, variants: [v('100g', 16, 6), v('250g', 7, 4)] },
  // lentils & rice
  { id: 'masoor', cat: 'lentils', art: { kind: 'sack', color: 'saffron' }, weight: 7, variants: [v('500g', 20, 8), v('1kg', 14, 6)] },
  { id: 'moong', cat: 'lentils', art: { kind: 'sack', color: 'green' }, weight: 4, variants: [v('500g', 11, 6), v('1kg', 6, 4)] },
  { id: 'kalodal', cat: 'lentils', art: { kind: 'sack', color: 'plum' }, weight: 5, variants: [v('500g', 9, 6), v('1kg', 3, 4)] },
  { id: 'rice', cat: 'lentils', art: { kind: 'sack', color: 'cream' }, weight: 6, variants: [v('1kg', 15, 6), v('5kg', 5, 3)] },
  { id: 'chiura', cat: 'lentils', art: { kind: 'packet', color: 'cream' }, weight: 5, variants: [v('500g', 13, 6)] },
  // pickles / achar
  { id: 'mula', cat: 'achar', art: { kind: 'jar', color: 'saffron' }, weight: 6, variants: [v('250g', 12, 5), v('500g', 5, 3)] },
  { id: 'golbheda', cat: 'achar', art: { kind: 'jar', color: 'red' }, weight: 5, variants: [v('250g', 14, 5), v('500g', 8, 4)] },
  { id: 'lapsi', cat: 'achar', art: { kind: 'jar', color: 'maroon' }, weight: 4, variants: [v('250g', 2, 4)] },
  { id: 'khursani', cat: 'achar', art: { kind: 'jar', color: 'green' }, weight: 4, variants: [v('250g', 0, 4)] },
  // snacks
  { id: 'dalmoth', cat: 'snacks', art: { kind: 'packet', color: 'saffron' }, weight: 7, variants: [v('200g', 24, 10), v('400g', 12, 6)] },
  { id: 'chhurpi', cat: 'snacks', art: { kind: 'box', color: 'cream' }, weight: 5, variants: [v('100g', 10, 5)] },
  { id: 'bhuja', cat: 'snacks', art: { kind: 'packet', color: 'turmeric' }, weight: 4, variants: [v('200g', 15, 6)] },
  { id: 'selroti', cat: 'snacks', art: { kind: 'packet', color: 'brown' }, weight: 3, variants: [v('500g', 8, 4)] },
  // dhaka topi & crafts
  { id: 'topi', cat: 'crafts', art: { kind: 'topi', color: 'maroon' }, weight: 4, variants: [v('S', 6, 3), v('M', 3, 3), v('L', 5, 3)] },
  { id: 'shawl', cat: 'crafts', art: { kind: 'shawl', color: 'red' }, weight: 2, variants: [v('one', 4, 2)] },
  { id: 'bowl', cat: 'crafts', art: { kind: 'bowl', color: 'brown' }, weight: 2, variants: [v('small', 5, 2), v('medium', 2, 2)] },
  { id: 'flags', cat: 'crafts', art: { kind: 'flags', color: 'indigo' }, weight: 3, variants: [v('5m', 12, 4), v('10m', 6, 3)] },
  { id: 'notebook', cat: 'crafts', art: { kind: 'book', color: 'olive' }, weight: 2, variants: [v('A6', 10, 4), v('A5', 7, 3)] },
  // puja items
  { id: 'diyo', cat: 'puja', art: { kind: 'diyo', color: 'saffron' }, weight: 5, variants: [v('6pcs', 20, 8), v('12pcs', 9, 5)] },
  { id: 'dhup', cat: 'puja', art: { kind: 'incense', color: 'plum' }, weight: 6, variants: [v('20pcs', 26, 10), v('50pcs', 11, 5)] },
  { id: 'abir', cat: 'puja', art: { kind: 'box', color: 'red' }, weight: 4, variants: [v('50g', 14, 6)] },
  { id: 'jamara', cat: 'puja', art: { kind: 'packet', color: 'olive' }, weight: 2, variants: [v('100g', 8, 4)] },
  { id: 'batti', cat: 'puja', art: { kind: 'box', color: 'cream' }, weight: 3, variants: [v('100pcs', 18, 6)] },
  { id: 'mala', cat: 'puja', art: { kind: 'garland', color: 'saffron' }, weight: 3, variants: [v('1pcs', 9, 4), v('3pcs', 4, 3)] },
];

export const SEED_IDS = new Set(SEED_PRODUCTS.map((p) => p.id));

export function productById(products: Product[], id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
export function variantOf(products: Product[], pid: string, vid: string): Variant | undefined {
  return productById(products, pid)?.variants.find((x) => x.id === vid);
}
export function totalStock(p: Product): number {
  return p.variants.reduce((s, x) => s + x.stock, 0);
}

// ---------------------------------------------------------------- dates, random

/** 'YYYY-MM-DD' → days since 1970-01-01 (calendar days, no time zone). */
export function dayNum(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
export function isoOf(day: number): string {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}
/** 0 = Monday … 6 = Sunday. 1970-01-01 was a Thursday. */
export function weekday(day: number): number {
  return (((day + 3) % 7) + 7) % 7;
}
/** The visitor's own calendar day and minute of the day. */
export function localNow(d: Date): { today: number; nowMin: number } {
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { today: dayNum(iso), nowMin: d.getHours() * 60 + d.getMinutes() };
}

/** FNV-1a, 32 bit. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
/** mulberry32: a small seeded generator, numbers in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick<T>(r: () => number, items: T[], weights: number[]): T {
  const sum = weights.reduce((s, w) => s + w, 0);
  let x = r() * sum;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x < 0) return items[i];
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------- festivals

export type FestId = 'dashain' | 'tihar';
/**
 * The main day of each festival (Vijaya Dashami, Laxmi Puja) as it falls in
 * Europe — they follow the lunar calendar, so they move every year. Close
 * enough for a demo; a real shop would read them from its own calendar.
 */
export const FESTIVALS: { id: FestId; iso: string }[] = [
  { id: 'dashain', iso: '2025-10-02' },
  { id: 'tihar', iso: '2025-10-21' },
  { id: 'dashain', iso: '2026-10-20' },
  { id: 'tihar', iso: '2026-11-08' },
  { id: 'dashain', iso: '2027-10-09' },
  { id: 'tihar', iso: '2027-10-29' },
  { id: 'dashain', iso: '2028-09-27' },
  { id: 'tihar', iso: '2028-10-17' },
  { id: 'dashain', iso: '2029-10-16' },
  { id: 'tihar', iso: '2029-11-05' },
  { id: 'dashain', iso: '2030-10-06' },
  { id: 'tihar', iso: '2030-10-26' },
];
/** How many days before a festival the rush starts. */
export const RUSH_DAYS = 14;

/**
 * How busy a day is because of a festival: rising over the two weeks before
 * (people stock up — up to ~2.9× the day before), quiet on the day itself
 * (they are celebrating) and the two days after.
 */
export function festivalLift(day: number): { mult: number; fest: FestId | null } {
  let best = 1;
  let fest: FestId | null = null;
  let low = 1;
  for (const f of FESTIVALS) {
    const d = dayNum(f.iso) - day;
    if (d >= 1 && d <= RUSH_DAYS) {
      const m = 1 + 1.9 * Math.pow((RUSH_DAYS + 1 - d) / RUSH_DAYS, 1.6);
      if (m > best) {
        best = m;
        fest = f.id;
      }
    } else if (d === 0) low = Math.min(low, 0.55);
    else if (d === -1 || d === -2) low = Math.min(low, 0.7);
  }
  return best > 1 ? { mult: best, fest } : { mult: low, fest: null };
}

/** What sells more before each festival: puja things and topi before Dashain; diyo, wicks and snacks before Tihar. */
const FEST_CAT: Record<FestId, Partial<Record<CatId, number>>> = {
  dashain: { puja: 2.6, crafts: 2.4, spices: 1.3 },
  tihar: { puja: 3.2, snacks: 2.2, lentils: 1.2 },
};

/** Festivals whose main day lies in the window (from, to], for the chart's notes. */
export function festivalsBetween(from: number, to: number): { id: FestId; day: number }[] {
  return FESTIVALS.map((f) => ({ id: f.id, day: dayNum(f.iso) })).filter((f) => f.day > from && f.day <= to);
}

// ---------------------------------------------------------------- orders

export type Status = 'new' | 'packed' | 'ready' | 'collected';
export const FLOW: Status[] = ['new', 'packed', 'ready', 'collected'];
export type Kind = 'pickup' | 'delivery';
export type Line = { p: string; v: string; q: number };
export type Slot = { kind: Kind; day: number; from: number; to: number };
export type Order = {
  id: string;
  /** What the customer shows at the counter (and what the QR holds). */
  code: string;
  day: number;
  /** Minute of the day it came in. */
  min: number;
  /** A made-up customer (c0 … c239), or 'you' for the visitor's own orders. */
  cust: string;
  kind: Kind;
  lines: Line[];
  status: Status;
  src: 'seed' | 'live' | 'you';
  slot?: Slot;
  /** The first name the visitor typed at checkout (theirs only, stays on the device). */
  name?: string;
};

export const CUSTOMER_COUNT = 240;
/** A customer with this many orders in the last 90 days gets the "loyal" badge. */
export const LOYAL_MIN = 5;

/** Base orders on an ordinary Monday-to-Friday day. */
const BASE = 9;
/** Monday … Sunday. Saturdays are the big shop; on Sundays the shop is closed and only online orders come in. */
const WEEKDAY_MULT = [0.85, 0.9, 1, 1.05, 1.25, 1.5, 0.55];
const HOURS_WEEK = [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 7, 6, 4, 4, 5, 7, 8, 7, 5, 3, 2, 1];
const HOURS_SAT = [0, 0, 0, 0, 0, 0, 0, 1, 3, 6, 9, 10, 8, 6, 5, 4, 4, 3, 3, 3, 2, 2, 1, 0];
const HOURS_SUN = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 3, 3, 3, 3, 4, 5, 6, 7, 6, 4, 2, 1];
const HOUR_IDS = Array.from({ length: 24 }, (_, i) => i);
const CUST_IDS = Array.from({ length: CUSTOMER_COUNT }, (_, i) => `c${i}`);
/** A few regulars order often, most customers now and then (a Zipf-like spread). */
const CUST_W = CUST_IDS.map((_, i) => 1 / Math.pow(i + 3, 1.05));

const CODE_ABC = 'ACDEFHJKMNPRTUVWXY3479';
/** Four letters a person can read out without mixing up O/0 or I/1. */
export function pickupCode(id: string): string {
  let h = hash(`code:${id}`);
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += CODE_ABC[h % CODE_ABC.length];
    h = (Math.floor(h / CODE_ABC.length) ^ hash(`${id}:${i}`)) >>> 0;
  }
  return s;
}
/** "#k7q m", " K7QM " → "K7QM". */
export function normCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** How many orders a day gets — the same number for the same day, always. */
export function ordersOnDay(day: number): number {
  const r = rng(hash(`count:${day}`));
  const m = WEEKDAY_MULT[weekday(day)] * festivalLift(day).mult * (0.8 + 0.4 * r());
  return Math.max(0, Math.round(BASE * m));
}

function linesFor(r: () => number, day: number, products: Product[]): Line[] {
  const { fest } = festivalLift(day);
  const boost = fest ? FEST_CAT[fest] : {};
  const nLines = pick(r, [1, 2, 3, 4], [35, 35, 20, 10]);
  const lines: Line[] = [];
  const pool = products.filter((p) => p.variants.length);
  for (let i = 0; i < nLines && pool.length; i++) {
    const p = pick(
      r,
      pool,
      pool.map((x) => x.weight * (boost[x.cat] ?? 1))
    );
    pool.splice(pool.indexOf(p), 1);
    const vr = p.variants[Math.floor(r() * p.variants.length)];
    lines.push({ p: p.id, v: vr.id, q: pick(r, [1, 2, 3], [70, 22, 8]) });
  }
  return lines;
}

/**
 * Where a seeded order of today stands at `nowMin`: the older it is, the
 * further along — some pickups wait at the counter for hours.
 */
export function seedStatus(r: number, age: number, kind: Kind): Status {
  if (age < 25) return 'new';
  if (age < 70) return r < 0.6 ? 'new' : 'packed';
  if (age < 140) return r < 0.5 ? 'packed' : 'ready';
  if (kind === 'pickup' && r < 0.35) return 'ready';
  return 'collected';
}

/** One seeded order — the i-th of its day — and the draw that decides where it stands today. */
export function seedOrder(day: number, i: number, products: Product[] = SEED_PRODUCTS): { order: Order; r: number } {
  const id = `${isoOf(day).replace(/-/g, '')}-${i + 1}`;
  const r = rng(hash(`order:${id}`));
  const wd = weekday(day);
  const hour = pick(r, HOUR_IDS, wd === 5 ? HOURS_SAT : wd === 6 ? HOURS_SUN : HOURS_WEEK);
  const min = hour * 60 + Math.floor(r() * 60);
  const cust = pick(r, CUST_IDS, CUST_W);
  const kind: Kind = r() < 0.7 ? 'pickup' : 'delivery';
  const lines = linesFor(r, day, products);
  return { order: { id, code: pickupCode(id), day, min, cust, kind, lines, status: 'collected', src: 'seed' }, r: r() };
}

/**
 * The shop's order history: every seeded order of the `days` days up to and
 * including `today` — on `today` only those that have come in by `nowMin`,
 * each with where it stands now. Past days are all collected. Sorted by time.
 * Pure and deterministic: same arguments, same orders.
 */
export function generateHistory(today: number, nowMin: number, days = 120, products: Product[] = SEED_PRODUCTS): Order[] {
  const out: Order[] = [];
  for (let day = today - days + 1; day <= today; day++) {
    const n = ordersOnDay(day);
    for (let i = 0; i < n; i++) {
      const { order: o, r } = seedOrder(day, i, products);
      if (day === today) {
        if (o.min > nowMin) continue;
        o.status = seedStatus(r, nowMin - o.min, o.kind);
      }
      out.push(o);
    }
  }
  return out.sort(byTime);
}

export function byTime(a: Order, b: Order): number {
  return a.day - b.day || a.min - b.min || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * The orders as the owner sees them: the seeded history, the visitor's own and
 * the live ones, with the owner's status moves on top. A move never goes back:
 * if the seeded clock has moved an order further along, that wins.
 */
export function mergeOrders(history: Order[], extra: Order[], moves: Record<string, Status>): Order[] {
  const all = [...history, ...extra].map((o) => {
    const m = moves[o.id];
    return m && FLOW.indexOf(m) > FLOW.indexOf(o.status) ? { ...o, status: m } : o;
  });
  return all.sort(byTime);
}

// ---------------------------------------------------------------- status machine

export function nextStatus(s: Status): Status | null {
  const i = FLOW.indexOf(s);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
}
/** Only one step forward at a time — an order is packed before it is ready, ready before it is collected. */
export function canMove(from: Status, to: Status): boolean {
  return nextStatus(from) === to;
}

/** Move the chosen orders to `to`, where that is their next step; the rest are skipped and counted. */
export function bulkMove(orders: Order[], ids: string[], to: Status): { moved: string[]; skipped: string[] } {
  const want = new Set(ids);
  const moved: string[] = [];
  const skipped: string[] = [];
  for (const o of orders) {
    if (!want.has(o.id)) continue;
    (canMove(o.status, to) ? moved : skipped).push(o.id);
  }
  return { moved, skipped };
}

export type ScanResult =
  | { kind: 'collected'; order: Order }
  | { kind: 'not-ready'; order: Order }
  | { kind: 'already'; order: Order }
  | { kind: 'unknown' };

/** What the pickup QR holds. */
export function qrText(code: string): string {
  return `MNSHOP-${code}`;
}

/** The counter scans (or types) a pickup code. Only a ready order can be handed over. */
export function scanCode(orders: Order[], raw: string): ScanResult {
  let code = normCode(raw);
  // The QR holds "MNSHOP-K7QM"; a person types "K7QM" or "#K7QM".
  if (code.length > 4 && code.startsWith('MNSHOP')) code = code.slice(6);
  if (code.length !== 4) return { kind: 'unknown' };
  // Newest first: a code could in theory repeat across months.
  for (let i = orders.length - 1; i >= 0; i--) {
    const o = orders[i];
    if (o.code !== code) continue;
    if (o.status === 'ready') return { kind: 'collected', order: { ...o, status: 'collected' } };
    if (o.status === 'collected') return { kind: 'already', order: o };
    return { kind: 'not-ready', order: o };
  }
  return { kind: 'unknown' };
}

/** The pickup waiting longest at the counter — what "scan the next code" picks up. */
export function nextReadyPickup(orders: Order[]): Order | null {
  return orders.find((o) => o.status === 'ready' && o.kind === 'pickup') ?? null;
}

// ---------------------------------------------------------------- the owner's numbers

export type Range = 7 | 30 | 90;
export const RANGES: Range[] = [7, 30, 90];
export function asRange(x: unknown): Range {
  return x === 7 || x === 90 ? x : 30;
}

export function inRange(o: Order, today: number, range: number): boolean {
  return o.day > today - range && o.day <= today;
}
export function itemCount(o: Order): number {
  return o.lines.reduce((s, l) => s + l.q, 0);
}

export type Kpis = {
  ordersToday: number;
  /** The same weekday a week ago, up to the same time — a fair comparison. */
  ordersLastWeek: number;
  itemsSold: number;
  itemsPrev: number;
  /** Of the customers who ordered in the range, the share who ordered more than once in it. */
  returningPct: number;
  returning: number;
  customers: number;
  pickupsWaiting: number;
  openOrders: number;
  lowStock: number;
};

export function kpis(orders: Order[], products: Product[], today: number, nowMin: number, range: Range): Kpis {
  const ordersToday = orders.filter((o) => o.day === today).length;
  const ordersLastWeek = orders.filter((o) => o.day === today - 7 && o.min <= nowMin).length;
  let itemsSold = 0;
  let itemsPrev = 0;
  const per = new Map<string, number>();
  for (const o of orders) {
    if (inRange(o, today, range)) {
      itemsSold += itemCount(o);
      per.set(o.cust, (per.get(o.cust) ?? 0) + 1);
    } else if (inRange(o, today - range, range)) itemsPrev += itemCount(o);
  }
  let returning = 0;
  for (const n of per.values()) if (n >= 2) returning++;
  return {
    ordersToday,
    ordersLastWeek,
    itemsSold,
    itemsPrev,
    returningPct: per.size ? Math.round((100 * returning) / per.size) : 0,
    returning,
    customers: per.size,
    pickupsWaiting: orders.filter((o) => o.kind === 'pickup' && o.status === 'ready').length,
    openOrders: orders.filter((o) => o.status !== 'collected').length,
    lowStock: lowStockCount(products),
  };
}


/** Trailing moving average: null until a full window is there, then rounded to 0.1. */
export function movingAverage(values: number[], window = 7): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? Math.round((sum / window) * 10) / 10 : null);
  }
  return out;
}

export type DayPoint = { day: number; n: number; avg: number | null };
/** Orders per day over the range, with the 7-day average (which looks back before the range, so it starts on day one). */
export function dailySeries(orders: Order[], today: number, range: number, window = 7): DayPoint[] {
  const from = today - range - window + 2;
  const counts = new Array(today - from + 1).fill(0);
  for (const o of orders) if (o.day >= from && o.day <= today) counts[o.day - from]++;
  const avg = movingAverage(counts, window);
  return counts.map((n, i) => ({ day: from + i, n, avg: avg[i] })).slice(window - 1);
}

/** Items sold per product over the range, most first (ties by id), top k. */
export function topProducts(orders: Order[], today: number, range: number, k = 8): { p: string; q: number }[] {
  const m = new Map<string, number>();
  for (const o of orders) if (inRange(o, today, range)) for (const l of o.lines) m.set(l.p, (m.get(l.p) ?? 0) + l.q);
  return [...m.entries()]
    .map(([p, q]) => ({ p, q }))
    .sort((a, b) => b.q - a.q || (a.p < b.p ? -1 : 1))
    .slice(0, k);
}

/** Items per category over the range, biggest first, with whole-number shares. */
export function categoryShare(orders: Order[], products: Product[], today: number, range: number): { cat: CatId; q: number; pct: number }[] {
  const m = new Map<CatId, number>(CATS.map((c) => [c, 0]));
  let total = 0;
  for (const o of orders) {
    if (!inRange(o, today, range)) continue;
    for (const l of o.lines) {
      const cat = productById(products, l.p)?.cat ?? productById(SEED_PRODUCTS, l.p)?.cat;
      if (!cat) continue;
      m.set(cat, (m.get(cat) ?? 0) + l.q);
      total += l.q;
    }
  }
  return CATS.map((cat) => ({ cat, q: m.get(cat)!, pct: total ? Math.round((100 * m.get(cat)!) / total) : 0 })).sort(
    (a, b) => b.q - a.q || CATS.indexOf(a.cat) - CATS.indexOf(b.cat)
  );
}

/** The heatmap's hour columns: 7 … 22, where 7 also holds anything earlier and 22 anything later. */
export const HEAT_FROM = 7;
export const HEAT_TO = 22;
export function heatColumn(min: number): number {
  const h = Math.floor(min / 60);
  return Math.min(HEAT_TO, Math.max(HEAT_FROM, h)) - HEAT_FROM;
}
/** Orders by weekday (rows, Monday first) × hour (columns) over the range. */
export function heatmap(orders: Order[], today: number, range: number): { grid: number[][]; max: number } {
  const cols = HEAT_TO - HEAT_FROM + 1;
  const grid = Array.from({ length: 7 }, () => new Array(cols).fill(0));
  let max = 0;
  for (const o of orders) {
    if (!inRange(o, today, range)) continue;
    const row = grid[weekday(o.day)];
    const c = heatColumn(o.min);
    row[c]++;
    if (row[c] > max) max = row[c];
  }
  return { grid, max };
}
/** Which of `steps` colour classes a count falls in (0 = none at all). */
export function heatLevel(n: number, max: number, steps = 6): number {
  if (n <= 0 || max <= 0) return 0;
  return Math.max(1, Math.min(steps - 1, Math.ceil((n / max) * (steps - 1))));
}

export type CustomerRow = { cust: string; orders: number; items: number; last: number; loyal: boolean };
/** Customers who ordered in the range, most orders first. Loyal = LOYAL_MIN+ orders in the last 90 days. */
export function customerRows(orders: Order[], today: number, range: number): CustomerRow[] {
  const m = new Map<string, CustomerRow>();
  const ninety = new Map<string, number>();
  for (const o of orders) {
    if (inRange(o, today, 90)) ninety.set(o.cust, (ninety.get(o.cust) ?? 0) + 1);
    if (!inRange(o, today, range)) continue;
    const r = m.get(o.cust) ?? { cust: o.cust, orders: 0, items: 0, last: o.day, loyal: false };
    r.orders++;
    r.items += itemCount(o);
    r.last = Math.max(r.last, o.day);
    m.set(o.cust, r);
  }
  for (const r of m.values()) r.loyal = (ninety.get(r.cust) ?? 0) >= LOYAL_MIN;
  return [...m.values()].sort((a, b) => b.orders - a.orders || b.last - a.last || (a.cust < b.cust ? -1 : 1));
}

// ---------------------------------------------------------------- stock

export type Level = 'ok' | 'low' | 'out';
export function stockLevel(x: { stock: number; threshold: number }): Level {
  return x.stock <= 0 ? 'out' : x.stock <= x.threshold ? 'low' : 'ok';
}
/** Product sizes at or below their reorder threshold (sold out included). */
export function lowStockCount(products: Product[]): number {
  let n = 0;
  for (const p of products) for (const x of p.variants) if (stockLevel(x) !== 'ok') n++;
  return n;
}
/** What the storefront says: sold out, "only n left" from 3 down, or nothing. */
export const FEW_LEFT = 3;
export function shelfBadge(stock: number): { kind: 'out' } | { kind: 'few'; n: number } | null {
  if (stock <= 0) return { kind: 'out' };
  if (stock <= FEW_LEFT) return { kind: 'few', n: stock };
  return null;
}

/** Units sold per day, per product size, averaged over the last `days` days. */
export function salesPerDay(orders: Order[], today: number, days = 30): Map<string, number> {
  const m = new Map<string, number>();
  for (const o of orders) if (inRange(o, today, days)) for (const l of o.lines) m.set(`${l.p}:${l.v}`, (m.get(`${l.p}:${l.v}`) ?? 0) + l.q);
  for (const [k, q] of m) m.set(k, q / days);
  return m;
}

export type Restock = { p: string; v: string; stock: number; threshold: number; perDay: number; daysLeft: number | null; suggest: number; level: Level };
/** How many to reorder: enough for two weeks at the current pace, and at least twice the threshold. */
export const COVER_DAYS = 14;
export function suggestReorder(stock: number, threshold: number, perDay: number): number {
  return Math.max(1, Math.max(threshold * 2, Math.ceil(perDay * COVER_DAYS)) - stock);
}
/** The restock reminder: every size at or below its threshold, sold out first, then fewest days left. */
export function restockList(products: Product[], orders: Order[], today: number): Restock[] {
  const pace = salesPerDay(orders, today);
  const out: Restock[] = [];
  for (const p of products)
    for (const x of p.variants) {
      const level = stockLevel(x);
      if (level === 'ok') continue;
      const perDay = Math.round((pace.get(`${p.id}:${x.id}`) ?? 0) * 100) / 100;
      out.push({
        p: p.id,
        v: x.id,
        stock: x.stock,
        threshold: x.threshold,
        perDay,
        daysLeft: perDay > 0 ? Math.floor(x.stock / perDay) : null,
        suggest: suggestReorder(x.stock, x.threshold, perDay),
        level,
      });
    }
  const rank = (r: Restock) => (r.level === 'out' ? -1 : r.daysLeft ?? 9999);
  return out.sort((a, b) => rank(a) - rank(b) || (a.p < b.p ? -1 : 1));
}

export const MAX_STOCK = 9999;
export function clampStock(n: unknown): number {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? Math.min(MAX_STOCK, Math.max(0, x)) : 0;
}
export function setStock(products: Product[], pid: string, vid: string, stock: number): Product[] {
  return products.map((p) => (p.id !== pid ? p : { ...p, variants: p.variants.map((x) => (x.id === vid ? { ...x, stock: clampStock(stock) } : x)) }));
}
export function setThreshold(products: Product[], pid: string, vid: string, threshold: number): Product[] {
  return products.map((p) => (p.id !== pid ? p : { ...p, variants: p.variants.map((x) => (x.id === vid ? { ...x, threshold: clampStock(threshold) } : x)) }));
}
/** An order takes its items off the shelf (never below zero). */
export function takeStock(products: Product[], lines: Line[]): Product[] {
  let out = products;
  for (const l of lines) {
    const x = variantOf(out, l.p, l.v);
    if (x) out = setStock(out, l.p, l.v, x.stock - l.q);
  }
  return out;
}

// ---------------------------------------------------------------- cart, slots, placing an order

export type CartLine = Line;
export const MAX_QTY = 9;

export function inCart(cart: CartLine[], pid: string, vid: string): number {
  return cart.find((l) => l.p === pid && l.v === vid)?.q ?? 0;
}
/** Set a line's quantity — capped by what is on the shelf and MAX_QTY; 0 removes it. */
export function setCartQty(cart: CartLine[], products: Product[], pid: string, vid: string, q: number): CartLine[] {
  const x = variantOf(products, pid, vid);
  const cap = Math.min(MAX_QTY, x ? x.stock : 0);
  const n = Math.max(0, Math.min(cap, Math.floor(q)));
  const rest = cart.filter((l) => !(l.p === pid && l.v === vid));
  if (n === 0) return rest;
  const i = cart.findIndex((l) => l.p === pid && l.v === vid);
  if (i < 0) return [...cart, { p: pid, v: vid, q: n }];
  const copy = [...cart];
  copy[i] = { p: pid, v: vid, q: n };
  return copy;
}
export function addToCart(cart: CartLine[], products: Product[], pid: string, vid: string, q = 1): CartLine[] {
  return setCartQty(cart, products, pid, vid, inCart(cart, pid, vid) + q);
}
export function cartCount(cart: CartLine[]): number {
  return cart.reduce((s, l) => s + l.q, 0);
}
/** Drop lines whose product or size is gone and trim to what is on the shelf. */
export function fitCart(cart: CartLine[], products: Product[]): CartLine[] {
  let out: CartLine[] = [];
  for (const l of cart) out = setCartQty(out, products, l.p, l.v, l.q);
  return out;
}

/** Pickup at the counter: Monday to Saturday (Saturday until 18:00); the shop is closed on Sundays. */
const PICKUP_WINDOWS: [number, number][] = [
  [10, 12],
  [12, 14],
  [14, 16],
  [16, 18],
  [18, 20],
];
/** Local delivery by bike in the evening, Monday to Friday. */
const DELIVERY_WINDOWS: [number, number][] = [
  [17, 19],
  [19, 21],
];
/** Packing takes an hour: a slot has to start at least this long after now. */
export const PREP_MIN = 60;

export function slotsFor(today: number, nowMin: number, kind: Kind, days = 3): Slot[] {
  const out: Slot[] = [];
  for (let day = today; out.length < 12 && day < today + 7; day++) {
    const wd = weekday(day);
    if (wd === 6) continue;
    if (kind === 'delivery' && wd === 5) continue;
    const wins = kind === 'pickup' ? PICKUP_WINDOWS.filter(([, to]) => wd !== 5 || to <= 18) : DELIVERY_WINDOWS;
    const open = wins.filter(([from]) => day > today || from * 60 >= nowMin + PREP_MIN);
    for (const [from, to] of open) out.push({ kind, day, from, to });
    if (new Set(out.map((s) => s.day)).size >= days) break;
  }
  return out;
}
export function slotId(s: Slot): string {
  return `${s.kind}:${s.day}:${s.from}`;
}

/** The visitor's order from the cart: always New, with a fresh code. */
export function placeOrder(cart: CartLine[], slot: Slot, today: number, nowMin: number, seq: number, name = ''): Order {
  const id = `you-${today}-${seq}`;
  return {
    id,
    code: pickupCode(id),
    day: today,
    min: nowMin,
    cust: 'you',
    kind: slot.kind,
    lines: cart.map((l) => ({ ...l })),
    status: 'new',
    src: 'you',
    slot,
    name: cleanName(name),
  };
}
export function cleanName(s: unknown): string {
  return typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30) : '';
}

/** Simulated live orders: at most this many per visit, one every 20–45 s, only while the tab is visible. */
export const LIVE_CAP = 6;
export function liveDelay(n: number, seed: number): number {
  return 20000 + Math.floor(rng(hash(`delay:${seed}:${n}`))() * 25000);
}
/** A live order: a seeded customer, things that are actually on the shelf. Null when the shelf is empty. */
export function liveOrder(n: number, seed: number, today: number, nowMin: number, products: Product[]): Order | null {
  const r = rng(hash(`live:${seed}:${n}`));
  const onShelf = products.map((p) => ({ ...p, variants: p.variants.filter((x) => x.stock > 0) })).filter((p) => p.variants.length);
  if (!onShelf.length) return null;
  const lines = linesFor(r, today, onShelf).map((l) => ({ ...l, q: Math.min(l.q, variantOf(onShelf, l.p, l.v)!.stock) }));
  const id = `live-${today}-${seed}-${n}`;
  return {
    id,
    code: pickupCode(id),
    day: today,
    min: nowMin,
    cust: pick(r, CUST_IDS, CUST_W),
    kind: r() < 0.7 ? 'pickup' : 'delivery',
    lines,
    status: 'new',
    src: 'live',
  };
}

// ---------------------------------------------------------------- product editor

export const NAME_MAX = 40;
export const SIZE_MAX = 12;
export type Draft = { name: L; cat: CatId; art: Art; variants: { size: string; stock: number; threshold: number }[] };

export function draftProblems(d: Draft): ('name' | 'variants')[] {
  const out: ('name' | 'variants')[] = [];
  if (!d.name.en.trim() && !d.name.de.trim() && !d.name.ne.trim()) out.push('name');
  if (!d.variants.some((x) => x.size.trim())) out.push('variants');
  return out;
}

/** A draft from the editor → a product (an empty name in one language falls back to another). */
export function productFromDraft(d: Draft, id: string): Product {
  const clean = (s: string) => s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
  const en = clean(d.name.en) || clean(d.name.de) || clean(d.name.ne);
  const de = clean(d.name.de) || en;
  const ne = clean(d.name.ne) || en;
  const seen = new Set<string>();
  const variants: Variant[] = [];
  for (const x of d.variants) {
    const size = clean(x.size).slice(0, SIZE_MAX);
    if (!size) continue;
    let vid = size.toLowerCase().replace(/[^a-z0-9]+/g, '') || `v${variants.length + 1}`;
    while (seen.has(vid)) vid += 'x';
    seen.add(vid);
    variants.push({ id: vid, size, stock: clampStock(x.stock), threshold: clampStock(x.threshold) });
  }
  return { id, cat: d.cat, art: d.art, variants: variants.slice(0, 6), weight: 3, name: { en, de, ne }, custom: !SEED_IDS.has(id) };
}

/** Save a product: replace the one with its id, or add it at the top of its category. */
export function upsertProduct(products: Product[], p: Product): Product[] {
  const i = products.findIndex((x) => x.id === p.id);
  if (i >= 0) {
    const copy = [...products];
    copy[i] = p;
    return copy;
  }
  const at = products.findIndex((x) => x.cat === p.cat);
  const copy = [...products];
  copy.splice(at < 0 ? copy.length : at, 0, p);
  return copy;
}
export function removeProduct(products: Product[], id: string): Product[] {
  return products.filter((p) => !(p.id === id && p.custom));
}

// ---------------------------------------------------------------- CSV

/**
 * One CSV cell: quoted when it holds a comma, semicolon, quote or line break
 * (quotes doubled); a leading = + - @ or tab gets a ' so a spreadsheet does not
 * run it as a formula.
 */
export function csvCell(x: string | number): string {
  let s = typeof x === 'number' ? (Number.isFinite(x) ? String(x) : '') : String(x ?? '');
  if (typeof x !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------- saved state

export type View = 'shop' | 'owner';
export type Tab = 'overview' | 'orders' | 'stock' | 'customers' | 'products';
export const TABS: Tab[] = ['overview', 'orders', 'stock', 'customers', 'products'];
export type Theme = 'dark' | 'light';

export type Saved = {
  v: 1;
  /** null = the seed catalogue untouched. */
  products: Product[] | null;
  /** The visitor's own orders and the live ones (newest last, capped). */
  extra: Order[];
  /** Owner's status moves on seeded orders. */
  moves: Record<string, Status>;
  cart: CartLine[];
  range: Range;
  theme: Theme;
  sound: boolean;
  seq: number;
};
export const EXTRA_MAX = 60;

export function emptySaved(): Saved {
  return { v: 1, products: null, extra: [], moves: {}, cart: [], range: 30, theme: 'dark', sound: false, seq: 0 };
}

const isStr = (x: unknown): x is string => typeof x === 'string';
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isL = (x: unknown): x is L => !!x && typeof x === 'object' && ['en', 'de', 'ne'].every((k) => isStr((x as Record<string, unknown>)[k]));

function cleanProduct(x: unknown): Product | null {
  if (!x || typeof x !== 'object') return null;
  const p = x as Record<string, unknown>;
  if (!isStr(p.id) || !CATS.includes(p.cat as CatId) || !Array.isArray(p.variants)) return null;
  const art = p.art as Record<string, unknown> | undefined;
  const kind = ART_KINDS.includes(art?.kind as ArtKind) ? (art!.kind as ArtKind) : 'packet';
  const color = ART_COLORS.includes(art?.color as ArtColor) ? (art!.color as ArtColor) : 'saffron';
  const variants: Variant[] = [];
  for (const y of p.variants.slice(0, 6)) {
    const w = y as Record<string, unknown>;
    if (!w || !isStr(w.id) || !isStr(w.size)) continue;
    variants.push({ id: w.id.slice(0, 20), size: w.size.slice(0, SIZE_MAX), stock: clampStock(w.stock), threshold: clampStock(w.threshold) });
  }
  if (!variants.length) return null;
  const out: Product = { id: p.id.slice(0, 40), cat: p.cat as CatId, art: { kind, color }, variants, weight: isNum(p.weight) ? Math.max(0.1, Math.min(20, p.weight)) : 3 };
  if (isL(p.name)) out.name = { en: p.name.en.slice(0, NAME_MAX), de: p.name.de.slice(0, NAME_MAX), ne: p.name.ne.slice(0, NAME_MAX) };
  if (p.custom === true && !SEED_IDS.has(out.id)) out.custom = true;
  if (out.custom && !out.name) return null;
  return out;
}

function cleanLines(x: unknown): Line[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((l) => l && isStr(l.p) && isStr(l.v) && isNum(l.q))
    .map((l) => ({ p: l.p as string, v: l.v as string, q: Math.max(1, Math.min(MAX_QTY, Math.floor(l.q as number))) }))
    .slice(0, 20);
}

function cleanOrder(x: unknown): Order | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (!isStr(o.id) || !isStr(o.code) || !isNum(o.day) || !isNum(o.min) || !isStr(o.cust)) return null;
  if (!FLOW.includes(o.status as Status) || (o.kind !== 'pickup' && o.kind !== 'delivery') || (o.src !== 'live' && o.src !== 'you')) return null;
  const lines = cleanLines(o.lines);
  if (!lines.length) return null;
  const out: Order = { id: o.id, code: normCode(o.code).slice(0, 4), day: o.day, min: Math.max(0, Math.min(1439, o.min)), cust: o.cust, kind: o.kind, lines, status: o.status as Status, src: o.src };
  const s = o.slot as Record<string, unknown> | undefined;
  if (s && (s.kind === 'pickup' || s.kind === 'delivery') && isNum(s.day) && isNum(s.from) && isNum(s.to)) out.slot = { kind: s.kind, day: s.day, from: s.from, to: s.to };
  const name = cleanName(o.name);
  if (name) out.name = name;
  return out;
}

/** Whatever comes back from localStorage → a valid Saved (anything odd falls back to the default). */
export function cleanSaved(raw: unknown): Saved {
  const e = emptySaved();
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return e;
  const r = raw as Record<string, unknown>;
  let products: Product[] | null = null;
  if (Array.isArray(r.products)) {
    const ps = r.products.map(cleanProduct).filter((p): p is Product => !!p);
    const ids = new Set<string>();
    products = ps.filter((p) => (ids.has(p.id) ? false : (ids.add(p.id), true))).slice(0, 80);
    // A seed product can be edited but not lost.
    for (const s of SEED_PRODUCTS) if (!ids.has(s.id)) products.push(s);
  }
  const extra = Array.isArray(r.extra) ? r.extra.map(cleanOrder).filter((o): o is Order => !!o).slice(-EXTRA_MAX) : [];
  const moves: Record<string, Status> = {};
  if (r.moves && typeof r.moves === 'object')
    for (const [k, s] of Object.entries(r.moves as Record<string, unknown>).slice(0, 2000)) if (FLOW.includes(s as Status)) moves[k] = s as Status;
  return {
    v: 1,
    products,
    extra,
    moves,
    cart: cleanLines(r.cart),
    range: asRange(r.range),
    theme: r.theme === 'light' ? 'light' : 'dark',
    sound: r.sound === true,
    seq: isNum(r.seq) ? Math.max(0, Math.floor(r.seq)) : 0,
  };
}
