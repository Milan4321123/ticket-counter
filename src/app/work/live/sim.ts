// The evening behind the /work/live dashboard, simulated. Pure and seeded: one
// call builds the whole night up front (every ticket, when it was sold, when it
// walks through which door, the odd screenshot scanned twice, the shout-outs),
// and the dashboard only moves a clock across it. So the same seed always gives
// the same evening, server and browser render the same first frame, and the
// tests can run the night start to finish in a few milliseconds.
//
// Everything is COUNTS of tickets and people — no money anywhere.

// ---------- the clock (seconds since midnight, on the night of the show) ----------

const H = 3600;
const M = 60;
export const START = 17 * H + 30 * M; // the dashboard opens before doors
export const DOORS = 18 * H;
export const SHOW = 19 * H;
/** Online sales close an hour before the show; after that it is the box office at the door. */
export const ONLINE_CLOSE = SHOW - H;
export const END = 24 * H;
/** Where a visitor's first look lands: doors open, the queue already building. */
export const FIRST_LOOK = 18 * H + 20 * M;

/** Simulated seconds per real second at 1× — the whole night is ~26 min at 1×, ~80 s at 20×. */
export const BASE_RATE = 15;
export const SPEEDS = [1, 5, 20] as const;
export type Speed = (typeof SPEEDS)[number];

export const CAPACITY = 650;
export const FEED_CAP = 30;
export const WALL_CAP = 12;
export const SHOUT_MAX = 90;

/** Arrivals chart: ten-minute bars from doors until 22:00. */
export const BIN_SEC = 10 * M;
export const BIN_FROM = DOORS;
export const BIN_COUNT = 24;
/** Entries-per-minute sparkline: the last 30 minutes. */
export const SPARK_MIN = 30;

export type TicketType = 'standard' | 'vip' | 'family';
export const TICKET_TYPES: TicketType[] = ['standard', 'vip', 'family'];
export type Door = 'A' | 'B';
export const DOORS_LIST: Door[] = ['A', 'B'];
export type Channel = 'pre' | 'online' | 'door';

export type Ticket = {
  code: string;
  type: TicketType;
  door: Door;
  channel: Channel;
  /** When it was bought (seconds since midnight; negative = before today). */
  sold: number;
  /** When it is scanned in, or Infinity for a no-show. */
  arrive: number;
};

export type Act = { id: 'opening' | 'deusi' | 'star' | 'party'; start: number; end: number };
export const PROGRAMME: Act[] = [
  { id: 'opening', start: 19 * H, end: 19 * H + 45 * M },
  { id: 'deusi', start: 19 * H + 55 * M, end: 20 * H + 40 * M },
  { id: 'star', start: 21 * H, end: 22 * H + 30 * M },
  { id: 'party', start: 22 * H + 40 * M, end: END },
];

export type Shout = {
  name: string;
  text: string;
  lang: 'en' | 'ne';
  /** Not before this time (it talks about an act). */
  after?: number;
};

/** What the guests write on the wall — made-up nicknames, warm, a bit of home. */
export const SHOUTS: Shout[] = [
  { name: 'MomoKing', text: 'Happy Tihar, Hamburg! Bhai Tika tomorrow, dance tonight 🪔', lang: 'en' },
  { name: 'Altona Didi', text: 'शुभ दीपावली सबैलाई! घर जस्तै लाग्यो आज 🙏', lang: 'ne' },
  { name: 'Bremen Bhai', text: 'Drove 2 hours for this. Worth it already!', lang: 'en' },
  { name: 'Sel Roti Fan', text: 'Who brought sel roti? Asking for the whole row 😄', lang: 'en' },
  { name: 'Kiel Kanchha', text: 'देउसी रे! भैलो रे! 🎶', lang: 'ne', after: 19 * H + 55 * M },
  { name: 'Hamburg Hajur Ama', text: 'My grandchildren are dancing. I am crying. Happy Tihar!', lang: 'en', after: 19 * H + 10 * M },
  { name: 'Lübeck Ladies', text: 'Front left corner — the loud ones are us 💃', lang: 'en' },
  { name: 'DalBhatPower', text: 'दाल भात पावर, २४ घण्टा! 💪', lang: 'ne' },
  { name: 'Student from Harburg', text: 'First Tihar away from home. Thank you for this night ❤️', lang: 'en' },
  { name: 'Pokhareli in HH', text: 'फेवा ताल त छैन, तर एल्बे पनि राम्रो छ 😄', lang: 'ne' },
  { name: 'Didi & Bhinaju', text: 'Anniversary + Tihar = best night out 🎉', lang: 'en' },
  { name: 'Marigold Mala', text: 'सयपत्रीको माला लगाएर आएँ 🌼', lang: 'ne' },
  { name: 'Kathmandu → Hamburg', text: 'Ten years here and this still feels like home.', lang: 'en' },
  { name: 'Table 7', text: 'Table 7 says namaste to table 8 🙏', lang: 'en' },
  { name: 'Momo Queen', text: 'Momo line is long but the momo are worth it', lang: 'en' },
  { name: 'Dharane Daju', text: 'धरानबाट हाम्बुर्गसम्म — जय होस्! 🔥', lang: 'ne' },
  { name: 'Little Laxmi', text: 'I am 9 and I did the Deusi song!!! 🎤', lang: 'en', after: 20 * H + 40 * M },
  { name: 'Uni Nepali Society', text: 'Our whole society is here. Group photo after the star! 📸', lang: 'en', after: 18 * H + 30 * M },
  { name: 'आमा र बुवा', text: 'छोराछोरी सँगै तिहार मनाउन पाउँदा खुसी लाग्यो', lang: 'ne' },
  { name: 'Night Shift Nurse', text: 'Came straight from work. Best decision. 🙌', lang: 'en' },
  { name: 'Altona Didi', text: 'Bhailo group, you were amazing!', lang: 'en', after: 20 * H + 40 * M },
  { name: 'Tihar Tiger', text: 'लक्ष्मी पूजा पछि सिधै यहाँ 🪔✨', lang: 'ne' },
  { name: 'Volunteer Crew', text: 'Thank you volunteers at Door A! Smooth entry 👏', lang: 'en', after: 18 * H + 30 * M },
  { name: 'Kukur Tihar Fan', text: 'Left the dog at home with a tika and a mala 🐕', lang: 'en' },
  { name: 'Himali Saathi', text: 'अर्को वर्ष फेरि भेटौँला! 🤗', lang: 'ne' },
  { name: 'Rostock Crew', text: 'Rostock in the house! 🙋', lang: 'en' },
];

// ---------- a seeded random source ----------

export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How many people reach the door in each minute after it opens (a relative weight). */
function arrivalWeight(min: number): number {
  if (min < 0) return 0;
  const burst = min < 3 ? 7 : 0; // the line that formed before doors
  const main = Math.exp(-((min - 40) ** 2) / (2 * 24 ** 2)); // peak around 18:40
  const star = 0.32 * Math.exp(-((min - 165) ** 2) / (2 * 14 ** 2)); // just before the star at 21:00
  const tail = min < 270 ? 0.04 : 0;
  return burst + main + star + tail;
}

/** Sample a minute after doors from the arrival curve, between `from` and `to` minutes. */
function sampler(from: number, to: number) {
  const cdf: number[] = [];
  let sum = 0;
  for (let m = from; m < to; m++) {
    sum += arrivalWeight(m);
    cdf.push(sum);
  }
  return (r: number, r2: number) => {
    const x = r * sum;
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return DOORS + (from + lo) * M + Math.floor(r2 * M);
  };
}

function pickType(r: number): TicketType {
  return r < 0.6 ? 'standard' : r < 0.75 ? 'vip' : 'family';
}

// ---------- the evening ----------

export type EventKind = 'in' | 'dup' | 'sale' | 'shout';
export type SchedEvent =
  | { at: number; kind: 'in'; t: number }
  | { at: number; kind: 'dup'; t: number; first: number }
  | { at: number; kind: 'sale'; t: number }
  | { at: number; kind: 'shout'; s: number };

export type Evening = {
  seed: number;
  tickets: Ticket[];
  /** Everything that happens after START, in time order (ticket indexes into `tickets`). */
  events: SchedEvent[];
  /** Each door's line: when people joined it and when they were scanned (both sorted). */
  lines: Record<Door, { join: number[]; scan: number[] }>;
};

const PRESOLD = 545;
const EARLIER_TODAY = 31; // bought online today before the dashboard opens
const ONLINE_NOW = 9; // bought online between 17:30 and the cutoff
const AT_DOOR = 38;
const NO_SHOW = 0.05;
const DUP_RATE = 0.025;

export function buildEvening(seed: number): Evening {
  const r = rng(seed);
  const tickets: Ticket[] = [];
  const walkIn = sampler(0, 300);
  const boxOffice = sampler(0, 210);

  const total = PRESOLD + EARLIER_TODAY + ONLINE_NOW + AT_DOOR;
  // Unique, shuffled ticket numbers so codes look like a real run of tickets.
  const nums = Array.from({ length: total }, (_, i) => 101 + i * 2 + Math.floor(r() * 2));
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }

  for (let i = 0; i < total; i++) {
    const type = pickType(r());
    const door: Door = r() < (type === 'vip' ? 0.3 : 0.56) ? 'A' : 'B';
    const block = 'ABCD'[Math.floor(r() * 4)];
    const code = `${block}-${String(nums[i]).padStart(4, '0')}`;
    let channel: Channel;
    let sold: number;
    let arrive: number;
    if (i < PRESOLD) {
      channel = 'pre';
      sold = -1;
      arrive = r() < NO_SHOW ? Infinity : walkIn(r(), r());
    } else if (i < PRESOLD + EARLIER_TODAY) {
      channel = 'online';
      sold = 8 * H + Math.floor(r() * (START - 8 * H));
      arrive = r() < NO_SHOW ? Infinity : walkIn(r(), r());
    } else if (i < PRESOLD + EARLIER_TODAY + ONLINE_NOW) {
      channel = 'online';
      sold = START + Math.floor(r() * (ONLINE_CLOSE - START));
      arrive = Math.max(sold + 20 * M, walkIn(r(), r()));
    } else {
      channel = 'door';
      sold = boxOffice(r(), r());
      arrive = sold + 30 + Math.floor(r() * 4 * M);
    }
    tickets.push({ code, type, door, channel, sold, arrive });
  }

  // `arrive` so far is when each person joins their door's line. The lane scans
  // one ticket every ~60/LANE_RATE seconds (some take longer: a phone that will
  // not unlock), so the scan time is when their turn comes — and the queue on
  // the dashboard is simply "joined, not scanned yet".
  const lines: Record<Door, { join: number[]; scan: number[] }> = { A: { join: [], scan: [] }, B: { join: [], scan: [] } };
  for (const d of DOORS_LIST) {
    const order = tickets
      .map((tk, i) => i)
      .filter((i) => tickets[i].door === d && Number.isFinite(tickets[i].arrive))
      .sort((a, b) => tickets[a].arrive - tickets[b].arrive);
    let free = DOORS;
    for (const i of order) {
      const tk = tickets[i];
      const join = tk.arrive;
      const scan = Math.max(join, free) + Math.round((60 / LANE_RATE[d]) * (0.55 + 0.9 * r()));
      free = scan;
      lines[d].join.push(join);
      tk.arrive = Math.min(scan, END - M);
      lines[d].scan.push(tk.arrive);
    }
  }

  const events: SchedEvent[] = [];
  tickets.forEach((tk, t) => {
    if (tk.sold >= START) events.push({ at: tk.sold, kind: 'sale', t });
    if (Number.isFinite(tk.arrive)) {
      events.push({ at: tk.arrive, kind: 'in', t });
      if (r() < DUP_RATE) {
        const again = tk.arrive + 60 + Math.floor(r() * 15 * M);
        if (again < END) events.push({ at: again, kind: 'dup', t, first: tk.arrive });
      }
    }
  });
  // Shout-outs: a steady trickle from doors to the end, cycling through the pool.
  // An entry that talks about an act waits for it; the ones it skips come round again.
  let at = START + 4 * M;
  let cur = 0;
  while (at < END) {
    for (let k = 0; k < SHOUTS.length; k++, cur++) {
      const i = cur % SHOUTS.length;
      if ((SHOUTS[i].after ?? 0) <= at) {
        events.push({ at, kind: 'shout', s: i });
        cur++;
        break;
      }
    }
    at += 3 * M + Math.floor(r() * 6 * M);
  }
  events.sort((a, b) => a.at - b.at);

  return { seed, tickets, events, lines };
}

/** Index of the first event strictly after time `t`. */
export function after(events: SchedEvent[], t: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].at <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ---------- doors: how long are the lines ----------

/** Scans one door lane manages per minute (Door B has the narrower entrance). */
export const LANE_RATE: Record<Door, number> = { A: 4, B: 3.6 };

/** How many values in a sorted array are <= x. */
function countUpTo(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** People waiting at each door at time `t`: in the line, not scanned yet. */
export function queues(ev: Evening, t: number): Record<Door, number> {
  const out = { A: 0, B: 0 } as Record<Door, number>;
  for (const d of DOORS_LIST) out[d] = countUpTo(ev.lines[d].join, t) - countUpTo(ev.lines[d].scan, t);
  return out;
}

export type LaneStatus = 'flowing' | 'busy' | 'long';
export function laneStatus(q: number): LaneStatus {
  return q < 8 ? 'flowing' : q < 20 ? 'busy' : 'long';
}
/** Minutes until the last person now in line is scanned. */
export function waitMin(q: number, d: Door): number {
  return Math.ceil(q / LANE_RATE[d]);
}

// ---------- the live state ----------

export type FeedItem =
  | { id: number; at: number; kind: 'in'; code: string; type: TicketType; door: Door; mine?: boolean }
  | { id: number; at: number; kind: 'dup'; code: string; type: TicketType; door: Door; first: number; mine?: boolean }
  | { id: number; at: number; kind: 'sale'; code: string; type: TicketType; channel: Channel }
  | { id: number; at: number; kind: 'none'; mine?: boolean };

export type WallPost = { id: number; name: string; text: string; lang: 'en' | 'ne'; mine?: boolean };

export type LiveState = {
  ev: Evening;
  t: number;
  speed: Speed;
  paused: boolean;
  feed: FeedItem[];
  wall: WallPost[];
  /** Tickets the visitor scanned by hand: ticket index → when. */
  scans: { t: number; at: number }[];
  /** The visitor's last scanned ticket (for "scan the same one again"). */
  last: number | null;
  /** "Already scanned" warnings the visitor caused. */
  myDups: number;
  nextId: number;
};

/** Per tick, at most this many check-ins reach the ticker (the counters still count all). */
const FEED_PER_TICK = 3;

function scannedByMe(s: Pick<LiveState, 'scans'>, t: number) {
  return s.scans.some((x) => x.t === t);
}

/** Turn the scheduled events in (from, to] into feed items and wall posts. */
function play(s: LiveState, from: number, to: number): LiveState {
  const { events, tickets } = s.ev;
  const lo = after(events, from);
  const hi = after(events, to);
  if (lo >= hi) return s;
  let nextId = s.nextId;
  const feed: FeedItem[] = [];
  const wall: WallPost[] = [];
  const ins: FeedItem[] = [];
  for (let i = lo; i < hi; i++) {
    const e = events[i];
    if (e.kind === 'shout') {
      const sh = SHOUTS[e.s];
      wall.push({ id: nextId++, name: sh.name, text: sh.text, lang: sh.lang });
      continue;
    }
    const tk = tickets[e.t];
    if (e.kind === 'in') {
      if (scannedByMe(s, e.t)) continue; // the visitor already let this one in
      ins.push({ id: nextId++, at: e.at, kind: 'in', code: tk.code, type: tk.type, door: tk.door });
    } else if (e.kind === 'dup') {
      feed.push({ id: nextId++, at: e.at, kind: 'dup', code: tk.code, type: tk.type, door: tk.door === 'A' ? 'B' : 'A', first: e.first });
    } else {
      feed.push({ id: nextId++, at: e.at, kind: 'sale', code: tk.code, type: tk.type, channel: tk.channel });
    }
  }
  const merged = [...feed, ...ins.slice(-FEED_PER_TICK)].sort((a, b) => a.at - b.at || a.id - b.id);
  return {
    ...s,
    nextId,
    feed: [...s.feed, ...merged].slice(-FEED_CAP),
    wall: wall.length ? [...s.wall, ...wall].slice(-WALL_CAP) : s.wall,
  };
}

export function initialState(seed = 7, at = FIRST_LOOK): LiveState {
  const s: LiveState = {
    ev: buildEvening(seed),
    t: START,
    speed: 5,
    paused: false,
    feed: [],
    wall: [],
    scans: [],
    last: null,
    myDups: 0,
    nextId: 1,
  };
  return { ...play(s, START - 1, at), t: at };
}

export type LiveAction =
  | { type: 'tick'; dt: number }
  | { type: 'speed'; speed: Speed }
  | { type: 'pause' }
  | { type: 'restart'; seed: number }
  | { type: 'scan' }
  | { type: 'rescan' }
  | { type: 'shout'; name: string; text: string; lang: 'en' | 'ne' };

export function reduce(s: LiveState, a: LiveAction): LiveState {
  switch (a.type) {
    case 'tick': {
      if (s.paused || s.t >= END) return s;
      const to = Math.min(END, s.t + (Math.max(0, a.dt) / 1000) * BASE_RATE * s.speed);
      return { ...play(s, s.t, to), t: to };
    }
    case 'speed':
      return { ...s, speed: a.speed, paused: false };
    case 'pause':
      return { ...s, paused: !s.paused };
    case 'restart':
      return { ...initialState(a.seed), speed: s.speed };
    case 'scan': {
      const t = nextAtDoor(s);
      if (t === null) return { ...s, feed: [...s.feed, { id: s.nextId, at: s.t, kind: 'none' as const, mine: true }].slice(-FEED_CAP), nextId: s.nextId + 1 };
      const tk = s.ev.tickets[t];
      const item: FeedItem = { id: s.nextId, at: s.t, kind: 'in', code: tk.code, type: tk.type, door: tk.door, mine: true };
      return {
        ...s,
        scans: [...s.scans, { t, at: s.t }],
        last: t,
        feed: [...s.feed, item].slice(-FEED_CAP),
        nextId: s.nextId + 1,
      };
    }
    case 'rescan': {
      if (s.last === null) return s;
      const tk = s.ev.tickets[s.last];
      const first = s.scans.find((x) => x.t === s.last)?.at ?? s.t;
      const item: FeedItem = { id: s.nextId, at: s.t, kind: 'dup', code: tk.code, type: tk.type, door: tk.door, first, mine: true };
      return { ...s, myDups: s.myDups + 1, feed: [...s.feed, item].slice(-FEED_CAP), nextId: s.nextId + 1 };
    }
    case 'shout':
      return {
        ...s,
        wall: [...s.wall, { id: s.nextId, name: a.name, text: a.text, lang: a.lang, mine: true }].slice(-WALL_CAP),
        nextId: s.nextId + 1,
      };
  }
}

/** The next ticket holder at the door: sold, not in yet, earliest planned arrival first (no-shows last). */
export function nextAtDoor(s: Pick<LiveState, 'ev' | 't' | 'scans'>): number | null {
  let best: number | null = null;
  s.ev.tickets.forEach((tk, i) => {
    if (tk.sold > s.t || tk.arrive <= s.t || scannedByMe(s, i)) return;
    if (best === null || tk.arrive < s.ev.tickets[best].arrive) best = i;
  });
  return best;
}

// ---------- what the tiles show ----------

export type Snapshot = {
  checkedIn: number;
  byType: Record<TicketType, number>;
  soldTotal: number;
  soldToday: number;
  soldOnline: number;
  soldDoor: number;
  onlineOpen: boolean;
  /** Entries in each of the last SPARK_MIN whole minutes (oldest first) … */
  perMin: number[];
  /** … and the current pace (entries in the last full minute). */
  pace: number;
  /** Arrivals per ten-minute bin from BIN_FROM; `current` is the bin `t` is in (-1 before doors). */
  bins: number[];
  current: number;
  queue: Record<Door, number>;
  dups: number;
  /** Index into PROGRAMME of the act on stage, or -1 (doors / changeover / not started). */
  onStage: number;
  /** Index into PROGRAMME of the next act, or -1 when the last one has started. */
  next: number;
  /** Seconds until the next act starts. */
  nextIn: number;
};

export function snapshot(s: LiveState): Snapshot {
  const { t, ev } = s;
  const mine = new Map(s.scans.map((x) => [x.t, x.at]));
  const byType: Record<TicketType, number> = { standard: 0, vip: 0, family: 0 };
  const perMin = new Array(SPARK_MIN).fill(0);
  const bins = new Array(BIN_COUNT).fill(0);
  const nowMin = Math.floor(t / M);
  let checkedIn = 0;
  let soldTotal = 0;
  let soldOnline = 0;
  let soldDoor = 0;
  ev.tickets.forEach((tk, i) => {
    if (tk.sold <= t) {
      soldTotal++;
      if (tk.sold >= 0) {
        if (tk.channel === 'door') soldDoor++;
        else soldOnline++;
      }
    }
    const at = mine.get(i) ?? tk.arrive;
    if (at > t) return;
    checkedIn++;
    byType[tk.type]++;
    const ago = nowMin - 1 - Math.floor(at / M); // 0 = the last full minute
    if (ago >= 0 && ago < SPARK_MIN) perMin[SPARK_MIN - 1 - ago]++;
    const b = Math.floor((at - BIN_FROM) / BIN_SEC);
    if (b >= 0 && b < BIN_COUNT) bins[b]++;
  });
  let dups = s.myDups;
  for (let i = 0, n = after(ev.events, t); i < n; i++) if (ev.events[i].kind === 'dup') dups++;

  const onStage = PROGRAMME.findIndex((a) => t >= a.start && t < a.end);
  const next = PROGRAMME.findIndex((a) => a.start > t);
  return {
    checkedIn,
    byType,
    soldTotal,
    soldToday: soldOnline + soldDoor,
    soldOnline,
    soldDoor,
    onlineOpen: t < ONLINE_CLOSE,
    perMin,
    pace: perMin[SPARK_MIN - 1],
    bins,
    current: t < BIN_FROM ? -1 : Math.floor((t - BIN_FROM) / BIN_SEC),
    queue: queues(ev, t),
    dups,
    onStage,
    next,
    nextIn: next >= 0 ? PROGRAMME[next].start - t : 0,
  };
}

// ---------- the shout-out guard ----------

/** Matched as whole words. */
const RUDE = [
  'fuck', 'fck', 'fuk', 'shit', 'bitch', 'cunt', 'asshole', 'bastard', 'dick', 'slut', 'whore', 'wanker', 'pussy',
  'scheisse', 'scheiße', 'arschloch', 'fotze', 'hurensohn', 'wichser',
  'muji', 'randi', 'machikne', 'chikne', 'lado', 'puti', 'geda', 'kukurko',
  'मुजी', 'रण्डी', 'रन्डी', 'मचिक्ने', 'चिक्ने', 'लाडो', 'पुती', 'गेडा',
];
/** Also caught inside a longer word ("bullshit", "fuckin"); none of these hides in an innocent word. */
const RUDE_STEMS = ['fuck', 'shit', 'bitch', 'cunt', 'asshole', 'wanker', 'wichser', 'arschloch', 'hurensohn', 'machikne', 'मुजी', 'रण्डी'];

export type ShoutCheck = { ok: true; text: string } | { ok: false; reason: 'empty' | 'long' | 'rude' | 'link' };

/** Is this fit for a hall screen? Trims, caps length, and keeps out swearing and links. */
export function checkShout(raw: string): ShoutCheck {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, reason: 'empty' };
  if ([...text].length > SHOUT_MAX) return { ok: false, reason: 'long' };
  if (/(https?:\/\/|www\.|\.(com|de|net|org|np)\b)/i.test(text)) return { ok: false, reason: 'link' };
  const plain = text
    .toLowerCase()
    .replace(/[0@4]/g, (c) => ({ '0': 'o', '@': 'a', '4': 'a' })[c] as string)
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[5$]/g, 's')
    .replace(/(.)\1{2,}/g, '$1');
  // Words, with runs of single letters ("f u c k", "f.u.c.k") joined back up.
  const words: string[] = [];
  let run = '';
  for (const w of plain.split(/[^\p{L}\p{M}]+/u).filter(Boolean)) {
    if ([...w].length === 1) {
      run += w;
      continue;
    }
    if (run) words.push(run);
    run = '';
    words.push(w);
  }
  if (run) words.push(run);
  for (const w of words) {
    if (RUDE.includes(w) || RUDE_STEMS.some((r) => w.includes(r))) return { ok: false, reason: 'rude' };
  }
  return { ok: true, text };
}

/** HH:MM (or HH:MM:SS) for seconds since midnight. */
export function clock(t: number, secs = false): string {
  const s = Math.max(0, Math.floor(t)) % (24 * H);
  const hh = String(Math.floor(s / H)).padStart(2, '0');
  const mm = String(Math.floor((s % H) / M)).padStart(2, '0');
  const ss = String(s % M).padStart(2, '0');
  return secs ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}
