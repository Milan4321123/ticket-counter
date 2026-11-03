// The rules behind the /work/momo demo — a made-up Nepali momo truck, "Momo
// Gaadi", touring Mainz, Wiesbaden and Darmstadt. Pure functions over one plain
// state object: the customer's phone (map, schedule, order ahead, pickup
// number, stamp card) and the crew's queue board are two drawings of the same
// data and stay in step by themselves.
//
// Time is a simulated day clock that runs SIM_SPEED times faster than real
// time, so a plate steams in under a minute and the truck crosses the map in a
// minute or two; it stands still while the page is hidden. The truck follows
// the day's route from stop to stop (it leaves at closing time, or when the
// crew taps "Move to next stop"), other customers order ahead on their own —
// capped so the board looks busy but never floods — and a seeded random number
// keeps every run reproducible (tests/momoTruck.test.ts plays whole days).
//
// Different from the restaurant demo on purpose: no tables and no waiter — a
// street-food truck on the move, pickup slots with a capacity, a pickup number
// and a queue. No prices, amounts or payments exist anywhere in here; the
// loyalty card gives a "Momo Master" badge, never anything with a value.

export type Lang = 'en' | 'de' | 'ne';
export type Filling = 'chicken' | 'veg' | 'paneer' | 'vegan';
export type Style = 'steamed' | 'fried' | 'jhol' | 'chilli';
/** 1 mild · 2 medium · 3 hot · 4 dalle (Nepali hot). */
export type Achar = 1 | 2 | 3 | 4;
export type Status = 'placed' | 'steaming' | 'ready' | 'picked';
export type Town = 'mainz' | 'wiesbaden' | 'darmstadt';
export type PlaceId = 'mz-rhein' | 'mz-markt' | 'wi-markt' | 'wi-kurpark' | 'da-markt' | 'da-garten';

export const FILLINGS: Filling[] = ['chicken', 'veg', 'paneer', 'vegan'];
export const STYLES: Style[] = ['steamed', 'fried', 'jhol', 'chilli'];
export const ACHARS: Achar[] = [1, 2, 3, 4];
export const STATUSES: Status[] = ['placed', 'steaming', 'ready', 'picked'];

export const MIN = 60_000;
/** One real second is SIM_SPEED simulated seconds. */
export const SIM_SPEED = 12;
/** The longest jump one tick may make, so a sleeping tab does not fast-forward the day. */
export const MAX_STEP = MIN;
export const SLOT_MIN = 10;
/** The earliest pickup slot starts at least this many minutes from now. */
export const LEAD_MIN = 5;
/** Slots offered at once (two hours). */
export const MAX_SLOTS = 12;
export const STEAMERS = 3;
export const STEAMER_PLATES = 10;
export const STEAM_ROOM = STEAMERS * STEAMER_PLATES;
/** Plates one 10-minute slot can take, by default and as the crew may set it. */
export const DEFAULT_SLOT_CAP = 10;
export const SLOT_CAP_MIN = 4;
export const SLOT_CAP_MAX = 30;
export const MAX_PLATES = 6;
export const MAX_LINES = 4;
/** The visitor may have this many orders on their way at once. */
export const MAX_MINE_ACTIVE = 2;
/** Simulated customers never keep more than this many orders open at once… */
export const MAX_SIM_ACTIVE = 14;
/** …and the board never keeps more than this many orders in memory. */
export const MAX_ORDERS = 90;
/** Simulated customers order about this often per simulated minute while the truck is open. */
export const SIM_RATE = 0.42;
export const STAMPS_PER_BADGE = 8;
/** The crew starts steaming this many minutes before the truck opens. */
export const PREP_BEFORE_OPEN = 10;
/** A finished day starts the next one this long after the last stop closed. */
export const NEXT_DAY_AFTER = 30;
export const FIRST_NUMBER = 31;

// ---------------- the map and the week ----------------

export type Place = { id: PlaceId; town: Town; x: number; y: number };

/** Map coordinates on a 360 × 300 drawing (north up). */
export const PLACES: Record<PlaceId, Place> = {
  'wi-kurpark': { id: 'wi-kurpark', town: 'wiesbaden', x: 132, y: 52 },
  'wi-markt': { id: 'wi-markt', town: 'wiesbaden', x: 94, y: 74 },
  'mz-rhein': { id: 'mz-rhein', town: 'mainz', x: 118, y: 148 },
  'mz-markt': { id: 'mz-markt', town: 'mainz', x: 82, y: 170 },
  'da-garten': { id: 'da-garten', town: 'darmstadt', x: 292, y: 206 },
  'da-markt': { id: 'da-markt', town: 'darmstadt', x: 270, y: 236 },
};
export const PLACE_IDS = Object.keys(PLACES) as PlaceId[];

export type Visit = { place: PlaceId; opens: number; closes: number };

const hm = (h: number, m = 0) => h * 60 + m;

/** Monday … Sunday. An empty day is the crew's rest day. */
export const WEEK: Visit[][] = [
  [],
  [
    { place: 'da-markt', opens: hm(11, 30), closes: hm(14) },
    { place: 'da-garten', opens: hm(17), closes: hm(21) },
  ],
  [
    { place: 'mz-markt', opens: hm(11), closes: hm(14) },
    { place: 'mz-rhein', opens: hm(16, 30), closes: hm(21) },
  ],
  [
    { place: 'wi-kurpark', opens: hm(11, 30), closes: hm(14) },
    { place: 'wi-markt', opens: hm(16), closes: hm(20, 30) },
  ],
  [
    { place: 'mz-rhein', opens: hm(11, 30), closes: hm(14) },
    { place: 'wi-markt', opens: hm(14, 30), closes: hm(17) },
    { place: 'da-markt', opens: hm(17, 30), closes: hm(21) },
  ],
  [
    { place: 'da-markt', opens: hm(10), closes: hm(15) },
    { place: 'da-garten', opens: hm(16), closes: hm(21, 30) },
  ],
  [{ place: 'mz-rhein', opens: hm(12), closes: hm(19) }],
];

export const DEFAULT_DAY = 4; // Friday: three towns in one day

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Minutes on the road between two stops (from the drawing's distance). */
export function driveMin(a: PlaceId, b: PlaceId): number {
  return Math.max(8, Math.min(30, Math.round(dist(PLACES[a], PLACES[b]) / 6)));
}

/** A gentle curve from a to b: a quadratic Bézier bent to the right of the way. */
export function legControl(a: PlaceId, b: PlaceId): { x: number; y: number } {
  const p = PLACES[a];
  const q = PLACES[b];
  const mx = (p.x + q.x) / 2;
  const my = (p.y + q.y) / 2;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  return { x: mx - dy * 0.18, y: my + dx * 0.18 };
}

export function legPoint(a: PlaceId, b: PlaceId, t: number): { x: number; y: number; angle: number } {
  const u = Math.max(0, Math.min(1, t));
  const p = PLACES[a];
  const q = PLACES[b];
  const c = legControl(a, b);
  const x = (1 - u) * (1 - u) * p.x + 2 * (1 - u) * u * c.x + u * u * q.x;
  const y = (1 - u) * (1 - u) * p.y + 2 * (1 - u) * u * c.y + u * u * q.y;
  const tx = 2 * (1 - u) * (c.x - p.x) + 2 * u * (q.x - c.x);
  const ty = 2 * (1 - u) * (c.y - p.y) + 2 * u * (q.y - c.y);
  return { x, y, angle: (Math.atan2(ty, tx) * 180) / Math.PI };
}

export function legPath(a: PlaceId, b: PlaceId): string {
  const p = PLACES[a];
  const q = PLACES[b];
  const c = legControl(a, b);
  const r = (n: number) => Math.round(n * 10) / 10;
  return `M${r(p.x)} ${r(p.y)} Q${r(c.x)} ${r(c.y)} ${r(q.x)} ${r(q.y)}`;
}

export function clockLabel(ms: number): string {
  const m = Math.floor(ms / MIN);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export const minLabel = (m: number) => clockLabel(m * MIN);

// ---------------- state ----------------

export type Line = { filling: Filling; style: Style; qty: number };

export type Order = {
  id: number;
  /** Which stop it is for: the state's `trip` counter at that stop. */
  trip: number;
  /** Pickup slot start, minutes after midnight. */
  slot: number;
  lines: Line[];
  achar: Achar;
  status: Status;
  mine: boolean;
  /** Simulated ms since midnight. */
  at: number;
  steamAt?: number;
  readyAt?: number;
  pickedAt?: number;
  /** When a simulated customer collects a ready order (0 = never by itself). */
  dueAt: number;
};

export type Drive = { from: number; to: number; at: number; until: number; early: boolean };

export type Stats = { orders: number; plates: Record<Filling, number>; stops: number };

export type State = {
  v: 1;
  lang: Lang;
  seed: number;
  /** 0 = Monday … 6 = Sunday. */
  day: number;
  /** Simulated ms since midnight. */
  now: number;
  /** Index of the stop the truck is at (or left from, while driving) in WEEK[day]. */
  idx: number;
  /** Counts every stop the truck reaches; orders carry the one they are for. */
  trip: number;
  /** When the truck opened (or opens) at the current stop. */
  openAt: number;
  drive: Drive | null;
  /** The last stop of the day has closed. */
  done: boolean;
  paused: boolean;
  soldOut: Filling[];
  slotCap: number;
  /** The simulated crew helpers steam and hand out by themselves. */
  autoCrew: boolean;
  nextId: number;
  orders: Order[];
  stamps: number;
  badges: number;
  notify: PlaceId[];
  /** The visitor said "I'm near this stop". */
  near: PlaceId | null;
  /** Phone notifications were allowed after a tap (else in-page toasts only). */
  push: boolean;
  /** Visitor orders whose "ready" screen has been shown. */
  cheered: number[];
  stats: Stats;
};

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

const emptyStats = (): Stats => ({ orders: 0, plates: { chicken: 0, veg: 0, paneer: 0, vegan: 0 }, stops: 0 });

export function route(s: { day: number }): Visit[] {
  return WEEK[((s.day % 7) + 7) % 7];
}
export function visit(s: State): Visit | undefined {
  return route(s)[s.idx];
}

export function plates(o: { lines: Line[] }): number {
  return o.lines.reduce((a, l) => a + l.qty, 0);
}

/** Minutes in the steamer: the slowest style in the order. */
export function steamMin(o: { lines: Line[] }): number {
  const per: Record<Style, number> = { steamed: 8, jhol: 9, fried: 11, chilli: 12 };
  return o.lines.reduce((m, l) => Math.max(m, per[l.style]), 8);
}

export const isActive = (o: Order) => o.status !== 'picked';

// ---------------- where the truck is ----------------

/** The stop new orders are for, or null when nothing can be ordered (day over). */
export function orderTrip(s: State): { trip: number; idx: number; openAt: number; closes: number } | null {
  if (s.done) return null;
  const r = route(s);
  if (s.drive) {
    const v = r[s.drive.to];
    return v ? { trip: s.trip + 1, idx: s.drive.to, openAt: openOnArrival(s.drive, v), closes: v.closes * MIN } : null;
  }
  const v = r[s.idx];
  return v ? { trip: s.trip, idx: s.idx, openAt: s.openAt, closes: v.closes * MIN } : null;
}

function openOnArrival(d: Drive, v: Visit): number {
  return d.early ? d.until : Math.max(d.until, v.opens * MIN);
}

export type TruckPos = { x: number; y: number; angle: number; moving: boolean; frac: number };

export function truckPos(s: State): TruckPos {
  const r = route(s);
  if (s.drive) {
    const a = r[s.drive.from].place;
    const b = r[s.drive.to].place;
    const frac = Math.max(0, Math.min(1, (s.now - s.drive.at) / Math.max(1, s.drive.until - s.drive.at)));
    const p = legPoint(a, b, frac);
    return { ...p, moving: true, frac };
  }
  const v = r[s.idx] ?? r[0];
  const p = v ? PLACES[v.place] : { x: 180, y: 150 };
  return { x: p.x, y: p.y, angle: 0, moving: false, frac: 0 };
}

export function allSoldOut(s: State): boolean {
  return FILLINGS.every((f) => s.soldOut.includes(f));
}

export type StopStatus =
  | { kind: 'left' }
  | { kind: 'open'; until: number }
  | { kind: 'opens'; at: number }
  | { kind: 'soldout' }
  | { kind: 'closed' }
  | { kind: 'driving'; eta: number }
  | { kind: 'later'; at: number };

/**
 * When the truck will open at stop k of today's route (simulated ms since
 * midnight), following the plan: it leaves each stop at closing time, drives,
 * and opens at the planned time or on arrival, whichever is later. Null for a
 * stop it has already left, or when the day is over.
 */
export function openTimeAt(s: State, k: number): number | null {
  const r = route(s);
  if (s.done || k < 0 || k >= r.length) return null;
  let at: number; // the stop we know the opening of
  let open: number;
  if (s.drive) {
    if (k < s.drive.to) return null;
    at = s.drive.to;
    open = openOnArrival(s.drive, r[at]);
  } else {
    if (k < s.idx) return null;
    at = s.idx;
    open = s.openAt;
  }
  if (k === at) return open;
  let leave = Math.max(open, r[at].closes * MIN, s.now);
  for (let j = at; j < k; j++) {
    const arrive = leave + driveMin(r[j].place, r[j + 1].place) * MIN;
    open = Math.max(arrive, r[j + 1].opens * MIN);
    leave = Math.max(open, r[j + 1].closes * MIN);
  }
  return open;
}

export function stopStatus(s: State, k: number): StopStatus {
  const r = route(s);
  const v = r[k];
  if (!v) return { kind: 'left' };
  if (s.done) return k === r.length - 1 ? { kind: 'closed' } : { kind: 'left' };
  if (s.drive) {
    if (k < s.drive.to) return { kind: 'left' };
    if (k === s.drive.to) return { kind: 'driving', eta: s.drive.until };
    return { kind: 'later', at: openTimeAt(s, k)! };
  }
  if (k < s.idx) return { kind: 'left' };
  if (k === s.idx) {
    if (allSoldOut(s)) return { kind: 'soldout' };
    if (s.now < s.openAt) return { kind: 'opens', at: s.openAt };
    return { kind: 'open', until: v.closes * MIN };
  }
  return { kind: 'later', at: openTimeAt(s, k)! };
}

/** The visitor's stop: when the truck is (next) there — today, or the next day it comes. */
export function nearInfo(s: State): { today: boolean; k: number; at: number | null; day: number } | null {
  if (!s.near) return null;
  const r = route(s);
  for (let k = 0; k < r.length; k++) {
    if (r[k].place !== s.near) continue;
    const st = stopStatus(s, k);
    if (st.kind === 'left' || st.kind === 'closed') continue;
    return { today: true, k, at: st.kind === 'open' ? s.now : st.kind === 'driving' ? st.eta : st.kind === 'opens' || st.kind === 'later' ? st.at : null, day: s.day };
  }
  for (let d = 1; d <= 7; d++) {
    const day = (s.day + d) % 7;
    const k = WEEK[day].findIndex((v) => v.place === s.near);
    if (k >= 0) return { today: false, k, at: WEEK[day][k].opens * MIN, day };
  }
  return null;
}

// ---------------- pickup slots ----------------

export type Slot = { start: number; booked: number; cap: number; left: number; full: boolean };

const ceilTo = (m: number, step: number) => Math.ceil(m / step) * step;

/** The pickup slots on offer for the stop new orders go to (start = minutes after midnight). */
export function slotsFor(s: State): Slot[] {
  const t = orderTrip(s);
  if (!t) return [];
  const from = ceilTo(Math.max(t.openAt, s.now + LEAD_MIN * MIN) / MIN, SLOT_MIN);
  const last = Math.floor(t.closes / MIN) - SLOT_MIN;
  const out: Slot[] = [];
  for (let m = from; m <= last && out.length < MAX_SLOTS; m += SLOT_MIN) {
    const booked = bookedPlates(s, t.trip, m);
    const left = Math.max(0, s.slotCap - booked);
    out.push({ start: m, booked, cap: s.slotCap, left, full: left <= 0 });
  }
  return out;
}

export function bookedPlates(s: State, trip: number, slot: number): number {
  let n = 0;
  for (const o of s.orders) if (o.trip === trip && o.slot === slot) n += plates(o);
  return n;
}

/** The first slot with room for this many plates, or null. */
export function firstFit(slots: Slot[], need: number): Slot | null {
  return slots.find((x) => x.left >= need) ?? null;
}

// ---------------- the queue ----------------

/** Orders for one stop in the order the crew hands them out: by slot, then by number. */
export function queue(s: State, trip = s.trip): Order[] {
  return s.orders.filter((o) => o.trip === trip).sort((a, b) => a.slot - b.slot || a.id - b.id);
}

/** How many orders are still ahead of this one (not yet picked up). */
export function aheadOf(s: State, id: number): number {
  const o = s.orders.find((x) => x.id === id);
  if (!o || o.status === 'picked') return 0;
  let n = 0;
  for (const x of s.orders) {
    if (x.trip !== o.trip || x.id === o.id || x.status === 'picked') continue;
    if (x.slot < o.slot || (x.slot === o.slot && x.id < o.id)) n++;
  }
  return n;
}

export function steamingPlates(s: State): number {
  let n = 0;
  for (const o of s.orders) if (o.status === 'steaming' && o.trip === s.trip) n += plates(o);
  return n;
}

/** How full each of the three steamers is (plates), filled one after the other. */
export function steamerLoad(s: State): number[] {
  let n = steamingPlates(s);
  return Array.from({ length: STEAMERS }, () => {
    const x = Math.min(STEAMER_PLATES, n);
    n -= x;
    return x;
  });
}

export function nowServing(s: State): { serving: number | null; ready: number[]; steaming: number[] } {
  const q = queue(s).filter((o) => o.status !== 'picked' && o.status !== 'placed');
  const ready = q.filter((o) => o.status === 'ready').map((o) => o.id);
  const steaming = q.filter((o) => o.status === 'steaming').map((o) => o.id);
  return { serving: ready.length ? ready[0] : null, ready, steaming };
}

export function mineActive(s: State): Order[] {
  return s.orders.filter((o) => o.mine && isActive(o));
}
export function myLatest(s: State): Order | null {
  const mine = s.orders.filter((o) => o.mine);
  const active = mine.filter(isActive);
  if (active.length) return active.sort((a, b) => a.id - b.id)[0];
  return mine.length ? mine[mine.length - 1] : null;
}

// ---------------- moving an order on ----------------

export type Event =
  | { kind: 'order'; id: number }
  | { kind: 'steaming'; id: number; mine: boolean }
  | { kind: 'ready'; id: number; mine: boolean }
  | { kind: 'picked'; id: number; mine: boolean }
  | { kind: 'stamp'; stamps: number }
  | { kind: 'badge'; badges: number }
  | { kind: 'arrived'; place: PlaceId; notify: boolean }
  | { kind: 'departed'; place: PlaceId }
  | { kind: 'closed' }
  | { kind: 'newday'; day: number };

export type Move = { state: State; ok: boolean; reason?: 'unknown' | 'steamers-full' | 'not-here' | 'done'; events: Event[] };

/** In place on a draft; the caller checks steamer room first. */
function step(s: State, o: Order, events: Event[]): Status | null {
  const i = STATUSES.indexOf(o.status);
  if (i < 0 || i >= STATUSES.length - 1) return null;
  const next = STATUSES[i + 1];
  o.status = next;
  if (next === 'steaming') {
    o.steamAt = s.now;
    events.push({ kind: 'steaming', id: o.id, mine: o.mine });
  }
  if (next === 'ready') {
    o.readyAt = s.now;
    o.dueAt = o.mine ? 0 : s.now + rint(s, 1, 4) * MIN;
    events.push({ kind: 'ready', id: o.id, mine: o.mine });
  }
  if (next === 'picked') {
    o.pickedAt = s.now;
    events.push({ kind: 'picked', id: o.id, mine: o.mine });
    if (o.mine) {
      s.stamps += 1;
      if (s.stamps >= STAMPS_PER_BADGE) {
        s.stamps = 0;
        s.badges += 1;
        events.push({ kind: 'badge', badges: s.badges });
      } else events.push({ kind: 'stamp', stamps: s.stamps });
    }
  }
  return next;
}

/** A tap on the crew board: placed → steaming → ready → picked up. */
export function advance(state: State, id: number): Move {
  const o0 = state.orders.find((x) => x.id === id);
  if (!o0 || o0.status === 'picked') return { state, ok: false, reason: 'unknown', events: [] };
  if (o0.trip !== state.trip || state.drive) return { state, ok: false, reason: 'not-here', events: [] };
  if (o0.status === 'placed' && steamingPlates(state) + plates(o0) > STEAM_ROOM) return { state, ok: false, reason: 'steamers-full', events: [] };
  const s = clone(state);
  const o = s.orders.find((x) => x.id === id)!;
  const events: Event[] = [];
  step(s, o, events);
  return { state: s, ok: true, events };
}

/** What a pickup QR code says. */
export function pickupCode(id: number): string {
  return `MOMO-GAADI-${id}`;
}
export function parseCode(text: string): number | null {
  const m = /^\s*(?:MOMO-GAADI-)?#?(\d{1,5})\s*$/i.exec(text);
  return m ? Number(m[1]) : null;
}

export type ScanResult = Move & { result: 'handed' | 'not-ready' | 'already' | 'unknown'; id: number | null };

/** The crew scans a customer's pickup code at the window. */
export function scan(state: State, text: string): ScanResult {
  const id = parseCode(text);
  const o = id == null ? undefined : state.orders.find((x) => x.id === id);
  if (!o || o.trip !== state.trip) return { state, ok: false, events: [], result: 'unknown', id };
  if (o.status === 'picked') return { state, ok: false, events: [], result: 'already', id };
  if (o.status !== 'ready') return { state, ok: false, events: [], result: 'not-ready', id };
  const r = advance(state, o.id);
  return { ...r, result: r.ok ? 'handed' : 'unknown', id };
}

// ---------------- ordering ahead ----------------

export type OrderInput = { lines: Line[]; achar: Achar; slot: number };
export type PlaceResult = {
  state: State;
  ok: boolean;
  id?: number;
  reason?: 'closed' | 'paused' | 'empty' | 'too-many' | 'sold-out' | 'no-slot' | 'full' | 'busy';
};

export function cleanLines(lines: Line[]): Line[] {
  const out: Line[] = [];
  for (const l of lines) {
    if (!l || !FILLINGS.includes(l.filling) || !STYLES.includes(l.style)) continue;
    const q = Math.floor(Number(l.qty));
    if (!(q > 0)) continue;
    const same = out.find((x) => x.filling === l.filling && x.style === l.style);
    if (same) same.qty += q;
    else out.push({ filling: l.filling, style: l.style, qty: q });
  }
  return out;
}

export function canOrder(s: State): PlaceResult['reason'] | null {
  if (!orderTrip(s)) return 'closed';
  if (s.paused) return 'paused';
  if (allSoldOut(s)) return 'sold-out';
  return null;
}

/** The visitor orders ahead for pickup. */
export function placeOrder(state: State, input: OrderInput): PlaceResult {
  const why = canOrder(state);
  if (why) return { state, ok: false, reason: why };
  if (mineActive(state).length >= MAX_MINE_ACTIVE) return { state, ok: false, reason: 'busy' };
  const lines = cleanLines(input.lines);
  if (!lines.length) return { state, ok: false, reason: 'empty' };
  if (lines.length > MAX_LINES || plates({ lines }) > MAX_PLATES) return { state, ok: false, reason: 'too-many' };
  if (lines.some((l) => state.soldOut.includes(l.filling))) return { state, ok: false, reason: 'sold-out' };
  const slot = slotsFor(state).find((x) => x.start === input.slot);
  if (!slot) return { state, ok: false, reason: 'no-slot' };
  if (slot.left < plates({ lines })) return { state, ok: false, reason: 'full' };
  const s = clone(state);
  const achar: Achar = ACHARS.includes(input.achar) ? input.achar : 2;
  const id = addOrder(s, lines, achar, slot.start, true);
  return { state: s, ok: true, id };
}

function addOrder(s: State, lines: Line[], achar: Achar, slot: number, mine: boolean): number {
  const t = orderTrip(s)!;
  const id = s.nextId++;
  s.orders.push({ id, trip: t.trip, slot, lines, achar, status: 'placed', mine, at: s.now, dueAt: 0 });
  s.stats.orders += 1;
  for (const l of lines) s.stats.plates[l.filling] += l.qty;
  prune(s);
  return id;
}

/** Keeps the board small: picked-up orders of earlier stops go first, then the oldest picked up. */
function prune(s: State) {
  s.orders = s.orders.filter((o) => isActive(o) || o.trip >= s.trip - 1 || o.mine);
  if (s.orders.length <= MAX_ORDERS) return;
  const drop = s.orders
    .filter((o) => !isActive(o))
    .sort((a, b) => Number(a.mine) - Number(b.mine) || a.id - b.id)
    .slice(0, s.orders.length - MAX_ORDERS)
    .map((o) => o.id);
  s.orders = s.orders.filter((o) => !drop.includes(o.id));
}

/** Simulated customers: a random small order in the first slot with room (sometimes a later one). */
function simOrder(s: State): number | null {
  if (canOrder(s)) return null;
  const active = s.orders.filter((o) => !o.mine && isActive(o)).length;
  if (active >= MAX_SIM_ACTIVE) return null;
  const open = FILLINGS.filter((f) => !s.soldOut.includes(f));
  const lines: Line[] = [];
  const n = rnd(s) < 0.7 ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const f = rnd(s) < 0.45 && open.includes('chicken') ? 'chicken' : pick(s, open);
    const st = pick(s, ['steamed', 'steamed', 'jhol', 'fried', 'chilli'] as Style[]);
    lines.push({ filling: f, style: st, qty: rnd(s) < 0.6 ? 1 : 2 });
  }
  const clean = cleanLines(lines);
  const need = plates({ lines: clean });
  const slots = slotsFor(s).filter((x) => x.left >= need);
  if (!slots.length) return null;
  const slot = rnd(s) < 0.72 ? slots[0] : slots[Math.min(slots.length - 1, rint(s, 1, 3))];
  return addOrder(s, clean, pick(s, ACHARS), slot.start, false);
}

// ---------------- the crew's switches ----------------

export function setPaused(state: State, paused: boolean): State {
  return { ...state, paused };
}
export function toggleSoldOut(state: State, f: Filling): State {
  if (!FILLINGS.includes(f)) return state;
  const soldOut = state.soldOut.includes(f) ? state.soldOut.filter((x) => x !== f) : [...state.soldOut, f];
  return { ...state, soldOut };
}
export function setSlotCap(state: State, n: number): State {
  const cap = Math.max(SLOT_CAP_MIN, Math.min(SLOT_CAP_MAX, Math.round(Number(n) || DEFAULT_SLOT_CAP)));
  return { ...state, slotCap: cap };
}
export function setAutoCrew(state: State, on: boolean): State {
  return { ...state, autoCrew: on };
}
export function toggleNotify(state: State, p: PlaceId): State {
  if (!PLACES[p]) return state;
  const notify = state.notify.includes(p) ? state.notify.filter((x) => x !== p) : [...state.notify, p];
  return { ...state, notify };
}
export function setNear(state: State, p: PlaceId | null): State {
  return { ...state, near: p && PLACES[p] ? p : null };
}
export function setPush(state: State, on: boolean): State {
  return { ...state, push: on };
}
export function cheer(state: State, id: number): State {
  return state.cheered.includes(id) ? state : { ...state, cheered: [...state.cheered.slice(-20), id] };
}

export type MoveNext = { state: State; ok: boolean; reason?: 'mine-waiting' | 'driving'; events: Event[] };

/**
 * "Move to next stop": the simulated customers' open orders are handed out,
 * the truck leaves and drives on. At the last stop it closes for the day; when
 * the day is over it starts the next day's route. The visitor's own order is
 * never dropped — hand it out (scan it) first.
 */
export function moveNext(state: State): MoveNext {
  if (state.drive) return { state, ok: false, reason: 'driving', events: [] };
  if (state.done) {
    const s = clone(state);
    const events: Event[] = [];
    startDay(s, nextWorkDay(s.day), events);
    return { state: s, ok: true, events };
  }
  if (mineActive(state).some((o) => o.trip === state.trip)) return { state, ok: false, reason: 'mine-waiting', events: [] };
  const s = clone(state);
  const events: Event[] = [];
  depart(s, events, true);
  return { state: s, ok: true, events };
}

function handOutSim(s: State, events: Event[]) {
  for (const o of s.orders) {
    if (o.trip !== s.trip || o.mine || !isActive(o)) continue;
    o.status = 'picked';
    o.pickedAt = s.now;
    events.push({ kind: 'picked', id: o.id, mine: false });
  }
}

function depart(s: State, events: Event[], early: boolean) {
  const r = route(s);
  handOutSim(s, events);
  const here = r[s.idx];
  events.push({ kind: 'departed', place: here.place });
  if (s.idx >= r.length - 1) {
    s.done = true;
    events.push({ kind: 'closed' });
    return;
  }
  const until = s.now + driveMin(here.place, r[s.idx + 1].place) * MIN;
  s.drive = { from: s.idx, to: s.idx + 1, at: s.now, until, early: early && s.now < here.closes * MIN };
}

function arrive(s: State, events: Event[]) {
  const d = s.drive!;
  const v = route(s)[d.to];
  s.openAt = openOnArrival(d, v);
  s.idx = d.to;
  s.trip += 1;
  s.drive = null;
  s.stats.stops += 1;
  events.push({ kind: 'arrived', place: v.place, notify: s.notify.includes(v.place) });
}

export function nextWorkDay(day: number): number {
  for (let d = 1; d <= 7; d++) if (WEEK[(day + d) % 7].length) return (day + d) % 7;
  return day;
}

function startDay(s: State, day: number, events: Event[]) {
  const first = WEEK[day][0];
  s.day = day;
  s.idx = 0;
  s.trip += 1;
  s.done = false;
  s.drive = null;
  s.now = first.opens * MIN - 12 * MIN;
  s.openAt = first.opens * MIN;
  s.soldOut = [];
  s.stats = emptyStats();
  s.stats.stops = 1;
  s.orders = s.orders.filter((o) => o.mine && !isActive(o));
  events.push({ kind: 'newday', day });
  events.push({ kind: 'arrived', place: first.place, notify: s.notify.includes(first.place) });
}

// ---------------- the clock runs ----------------

export type Tick = { state: State; events: Event[] };

/** Moves the day on by `realMs` of real time (capped), and lets the truck, the crew and the other customers act. */
export function tick(state: State, realMs: number): Tick {
  const dt = Math.max(0, Math.min(MAX_STEP, Math.round(realMs * SIM_SPEED)));
  if (!dt) return { state, events: [] };
  const s = clone(state);
  const events: Event[] = [];
  s.now += dt;

  // A finished day: the next one starts a little later.
  if (s.done) {
    const last = route(s)[route(s).length - 1];
    if (s.now >= (last.closes + NEXT_DAY_AFTER) * MIN) startDay(s, nextWorkDay(s.day), events);
    return { state: s, events };
  }

  // On the road: arrive.
  if (s.drive && s.now >= s.drive.until) arrive(s, events);

  if (!s.drive) {
    const v = visit(s)!;
    // Closing time: leave once the visitor's own order is out (the others are handed out).
    if (s.now >= v.closes * MIN && !mineActive(s).some((o) => o.trip === s.trip)) {
      depart(s, events, false);
    } else if (s.autoCrew) crewWork(s, events);
  }

  // Other customers order ahead.
  if (!s.paused && rnd(s) < (SIM_RATE * dt) / MIN * (s.drive ? 0.5 : 1)) {
    const id = simOrder(s);
    if (id != null) events.push({ kind: 'order', id });
  }
  // Simulated customers collect their ready orders (the visitor's waits for a scan).
  if (!s.drive && s.autoCrew) {
    for (const o of queue(s)) if (o.status === 'ready' && !o.mine && o.dueAt && s.now >= o.dueAt) step(s, o, events);
  }
  return { state: s, events };
}

/** The simulated crew: start steaming in queue order when there is room, take done plates out. */
function crewWork(s: State, events: Event[]) {
  if (s.now < s.openAt - PREP_BEFORE_OPEN * MIN) return;
  const q = queue(s);
  for (const o of q) if (o.status === 'steaming' && s.now >= (o.steamAt ?? s.now) + steamMin(o) * MIN) step(s, o, events);
  for (const o of q) {
    if (o.status !== 'placed') continue;
    if (s.now < (o.slot - steamMin(o) - 2) * MIN) break;
    if (steamingPlates(s) + plates(o) > STEAM_ROOM) break;
    step(s, o, events);
  }
}

// ---------------- counts for the crew ----------------

export function today(s: State): { orders: number; plates: number; byFilling: Record<Filling, number>; stops: number; perSlot: { slot: number; orders: number; plates: number }[] } {
  const per = new Map<number, { orders: number; plates: number }>();
  const t = orderTrip(s)?.trip ?? s.trip;
  for (const o of s.orders) {
    if (o.trip !== (s.drive ? t : s.trip)) continue;
    const x = per.get(o.slot) ?? { orders: 0, plates: 0 };
    x.orders += 1;
    x.plates += plates(o);
    per.set(o.slot, x);
  }
  const perSlot = [...per.entries()].sort((a, b) => a[0] - b[0]).map(([slot, x]) => ({ slot, ...x }));
  const total = FILLINGS.reduce((a, f) => a + s.stats.plates[f], 0);
  return { orders: s.stats.orders, plates: total, byFilling: { ...s.stats.plates }, stops: s.stats.stops, perSlot };
}

// ---------------- a fresh day and reading back stored state ----------------

export function seedState(lang: Lang = 'en', seed = 20261106): State {
  const day = DEFAULT_DAY;
  const first = WEEK[day][0];
  const s: State = {
    v: 1,
    lang,
    seed,
    day,
    now: first.opens * MIN - 6 * MIN,
    idx: 0,
    trip: 1,
    openAt: first.opens * MIN,
    drive: null,
    done: false,
    paused: false,
    soldOut: [],
    slotCap: DEFAULT_SLOT_CAP,
    autoCrew: true,
    nextId: FIRST_NUMBER,
    orders: [],
    stamps: 5,
    badges: 0,
    notify: [],
    near: null,
    push: false,
    cheered: [],
    stats: emptyStats(),
  };
  s.stats.stops = 1;
  // Pre-orders from the morning: the first two slots already have customers.
  const pre: [Filling, Style, number, number][] = [
    ['chicken', 'steamed', 2, 0],
    ['veg', 'jhol', 1, 0],
    ['chicken', 'chilli', 1, 0],
    ['paneer', 'fried', 2, 10],
    ['chicken', 'jhol', 1, 10],
    ['vegan', 'steamed', 2, 10],
  ];
  for (const [f, st, q, off] of pre) addOrder(s, [{ filling: f, style: st, qty: q }], ((s.nextId % 4) + 1) as Achar, first.opens + off, false);
  return s;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Reads stored state back defensively: anything odd starts a fresh day. */
export function normalize(raw: unknown, lang: Lang = 'en'): State {
  const fresh = seedState(lang);
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Partial<State>;
  if (r.v !== 1) return fresh;
  const day = isNum(r.day) && r.day >= 0 && r.day <= 6 && WEEK[r.day].length ? Math.floor(r.day) : null;
  if (day == null || !isNum(r.now) || !isNum(r.idx) || !isNum(r.trip) || !isNum(r.openAt) || !isNum(r.nextId)) return fresh;
  const rt = WEEK[day];
  if (r.idx < 0 || r.idx >= rt.length) return fresh;
  let drive: Drive | null = null;
  if (r.drive) {
    const d = r.drive;
    if (!isNum(d.from) || !isNum(d.to) || d.to !== d.from + 1 || d.to >= rt.length || d.from !== r.idx || !isNum(d.at) || !isNum(d.until)) return fresh;
    drive = { from: d.from, to: d.to, at: d.at, until: d.until, early: Boolean(d.early) };
  }
  const orders: Order[] = [];
  for (const o of Array.isArray(r.orders) ? r.orders.slice(-MAX_ORDERS) : []) {
    if (!o || !isNum(o.id) || !isNum(o.trip) || !isNum(o.slot) || !STATUSES.includes(o.status)) continue;
    const lines = cleanLines(Array.isArray(o.lines) ? o.lines : []);
    if (!lines.length) continue;
    const clean: Order = {
      id: o.id,
      trip: o.trip,
      slot: o.slot,
      lines,
      achar: ACHARS.includes(o.achar) ? o.achar : 2,
      status: o.status,
      mine: Boolean(o.mine),
      at: isNum(o.at) ? o.at : 0,
      dueAt: isNum(o.dueAt) ? o.dueAt : 0,
    };
    if (isNum(o.steamAt)) clean.steamAt = o.steamAt;
    if (isNum(o.readyAt)) clean.readyAt = o.readyAt;
    if (isNum(o.pickedAt)) clean.pickedAt = o.pickedAt;
    orders.push(clean);
  }
  const stats = emptyStats();
  if (r.stats && typeof r.stats === 'object') {
    stats.orders = isNum(r.stats.orders) ? r.stats.orders : 0;
    stats.stops = isNum(r.stats.stops) ? r.stats.stops : 1;
    for (const f of FILLINGS) stats.plates[f] = isNum(r.stats.plates?.[f]) ? r.stats.plates[f] : 0;
  }
  const langOk: Lang = r.lang === 'en' || r.lang === 'de' || r.lang === 'ne' ? r.lang : lang;
  return {
    v: 1,
    lang: langOk,
    seed: isNum(r.seed) ? r.seed | 0 : fresh.seed,
    day,
    now: r.now,
    idx: r.idx,
    trip: r.trip,
    openAt: r.openAt,
    drive,
    done: Boolean(r.done),
    paused: Boolean(r.paused),
    soldOut: Array.isArray(r.soldOut) ? FILLINGS.filter((f) => r.soldOut!.includes(f)) : [],
    slotCap: isNum(r.slotCap) ? Math.max(SLOT_CAP_MIN, Math.min(SLOT_CAP_MAX, Math.round(r.slotCap))) : DEFAULT_SLOT_CAP,
    autoCrew: r.autoCrew !== false,
    nextId: Math.max(r.nextId, ...orders.map((o) => o.id + 1), FIRST_NUMBER),
    orders,
    stamps: isNum(r.stamps) ? Math.max(0, Math.min(STAMPS_PER_BADGE - 1, Math.floor(r.stamps))) : 0,
    badges: isNum(r.badges) ? Math.max(0, Math.min(999, Math.floor(r.badges))) : 0,
    notify: Array.isArray(r.notify) ? PLACE_IDS.filter((p) => r.notify!.includes(p)) : [],
    near: r.near && PLACES[r.near] ? r.near : null,
    push: Boolean(r.push),
    cheered: Array.isArray(r.cheered) ? r.cheered.filter(isNum).slice(-20) : [],
    stats,
  };
}
