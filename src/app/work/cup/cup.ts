// The rules behind the /work/cup demo: "Himal Cup 2027", a made-up futsal
// tournament for Nepali community clubs in Germany. Eight invented teams, two
// groups of four, semi-finals, a match for third place and a final, on two
// pitches in one hall. Pure and seeded: the same seed always plays the same
// tournament, however the time is chopped into ticks — the page only moves the
// hall clock and draws what this file says. tests/futsalCup.test.ts pins the
// standings with every tie-breaker, the bracket, the penalty shoot-out, the
// referee's buttons and undo, and the simulation's determinism.
//
// Teams, players and the tournament are invented. Nothing here is about money:
// no entry fees, prizes with a value, bets or odds — a trophy and medals only.

export type Lang = 'en' | 'de' | 'ne';
export type TeamId = 'euk' | 'yfc' | 'gsm' | 'llh' | 'arf' | 'sss' | 'lfd' | 'hto';
export type GroupId = 'A' | 'B';
export type Side = 'home' | 'away';
export type Stage = 'group' | 'sf' | 'third' | 'final';
export type Status = 'scheduled' | 'live' | 'ht' | 'ft';
export type Motif = 'peak' | 'star' | 'sun' | 'moon';
export type Pattern = 'split' | 'stripe' | 'chevron' | 'plain';
export type Pos = 'GK' | 'DF' | 'WG' | 'PV';
export type EventKind = 'goal' | 'yellow' | 'red' | 'sub';
export type Speed = 1 | 10 | 60;

export const SPEEDS: Speed[] = [1, 10, 60];
export const DEFAULT_SPEED: Speed = 10;

// ---------- time (seconds since midnight on the tournament day) ----------

export const MIN = 60;
export const HALF_SEC = 12 * MIN; // futsal community format: 2 × 12 minutes
export const MATCH_SEC = 2 * HALF_SEC;
export const HT_SEC = 3 * MIN;
export const DAY_START = 10 * 3600;
export const SLOT_SEC = 30 * MIN;
/** The longest jump one tick may make (a tab coming back from the background). */
export const MAX_STEP_SEC = 5 * MIN;
/** At most this many referee / sim events per match — keeps stored state small. */
export const MAX_EVENTS = 60;
export const MAX_REGISTERED = 4;

export function clockLabel(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
/** The match clock as "mm:ss" (game time, counting up through both halves). */
export function matchClock(m: Match): string {
  const c = Math.max(0, Math.floor(m.clock));
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}
/** The football-style minute of a moment in the match: 0:00–0:59 is 1'. */
export function minuteOf(clock: number): number {
  return Math.min(MATCH_SEC / MIN, Math.floor(Math.max(0, clock - 1) / 60) + 1);
}

// ---------- teams and players (all made up) ----------

export type Player = { no: number; name: string; pos: Pos };
export type Team = {
  id: TeamId;
  name: string;
  short: string;
  city: string;
  group: GroupId;
  colors: [string, string];
  motif: Motif;
  pattern: Pattern;
  /** 1 (plucky) … 5 (favourites) — only nudges the simulation. */
  str: number;
};

export const TEAMS: Record<TeamId, Team> = {
  euk: { id: 'euk', name: 'Everest United Köln', short: 'EUK', city: 'Köln', group: 'A', colors: ['#c8102e', '#ffffff'], motif: 'peak', pattern: 'split', str: 4 },
  yfc: { id: 'yfc', name: 'Yeti FC Berlin', short: 'YFC', city: 'Berlin', group: 'A', colors: ['#1d4ed8', '#e0f2fe'], motif: 'star', pattern: 'stripe', str: 4 },
  gsm: { id: 'gsm', name: 'Gorkhali Stars München', short: 'GSM', city: 'München', group: 'A', colors: ['#111827', '#facc15'], motif: 'star', pattern: 'chevron', str: 3 },
  llh: { id: 'llh', name: 'Lumbini Lions Hamburg', short: 'LLH', city: 'Hamburg', group: 'A', colors: ['#ea580c', '#1f2937'], motif: 'sun', pattern: 'plain', str: 2 },
  arf: { id: 'arf', name: 'Annapurna Rovers Frankfurt', short: 'ARF', city: 'Frankfurt', group: 'B', colors: ['#15803d', '#fef9c3'], motif: 'peak', pattern: 'chevron', str: 4 },
  sss: { id: 'sss', name: 'Sagarmatha SC Stuttgart', short: 'SSC', city: 'Stuttgart', group: 'B', colors: ['#7c3aed', '#f5f3ff'], motif: 'moon', pattern: 'split', str: 3 },
  lfd: { id: 'lfd', name: 'Laligurans FC Düsseldorf', short: 'LFD', city: 'Düsseldorf', group: 'B', colors: ['#be185d', '#fde68a'], motif: 'sun', pattern: 'stripe', str: 2 },
  hto: { id: 'hto', name: 'Himal Tigers Offenbach', short: 'HTO', city: 'Offenbach', group: 'B', colors: ['#0e7490', '#fef08a'], motif: 'moon', pattern: 'plain', str: 3 },
};
export const TEAM_IDS = Object.keys(TEAMS) as TeamId[];
export const GROUPS: Record<GroupId, TeamId[]> = {
  A: ['euk', 'yfc', 'gsm', 'llh'],
  B: ['arf', 'sss', 'lfd', 'hto'],
};

const FIRST = [
  'Aashish', 'Bibek', 'Sujan', 'Roshan', 'Prabin', 'Kiran', 'Nabin', 'Sagar', 'Anish', 'Bikash', 'Dipesh', 'Suman', 'Rajan',
  'Sandesh', 'Manish', 'Pratik', 'Saroj', 'Nischal', 'Ujjwal', 'Bishal', 'Ramesh', 'Sunil', 'Arjun', 'Hemant', 'Kushal',
  'Rohit', 'Sanjay', 'Bijay', 'Amrit', 'Pawan', 'Niraj', 'Tenzing', 'Pemba', 'Lhakpa', 'Dorje', 'Sonam', 'Ngima', 'Mingma',
  'Kaji', 'Yubraj', 'Samir', 'Rabin', 'Dinesh', 'Ganesh', 'Laxman', 'Bhim', 'Sudip', 'Avinash', 'Ishan', 'Jeevan', 'Krish',
  'Ravi', 'Subash', 'Tilak', 'Umesh', 'Bimal', 'Chiran', 'Dawa', 'Nima', 'Pasang', 'Sabin', 'Rupesh', 'Prem', 'Hari',
];
const INITIAL = 'GTRSKLMBPDAHNC';
const SHIRTS: [number, Pos][] = [
  [1, 'GK'],
  [4, 'DF'],
  [5, 'DF'],
  [7, 'WG'],
  [10, 'WG'],
  [8, 'WG'],
  [9, 'PV'],
  [11, 'PV'],
  [12, 'GK'],
];
/** Each team's made-up squad: first name and an initial, never a real person. */
export const SQUADS: Record<TeamId, Player[]> = Object.fromEntries(
  TEAM_IDS.map((id, ti) => [
    id,
    SHIRTS.map(([no, pos], i) => ({
      no,
      pos,
      name: `${FIRST[(ti * 9 + i * 7) % FIRST.length]} ${INITIAL[(ti * 5 + i * 3) % INITIAL.length]}.`,
    })),
  ])
) as Record<TeamId, Player[]>;

export function player(team: TeamId, no: number): Player | undefined {
  return SQUADS[team].find((p) => p.no === no);
}

/** Up to three letters for a crest: "Everest United Köln" → "EUK", "Yeti FC Berlin" → "YB". */
export function crestInitials(name: string): string {
  const words = name
    .normalize('NFC')
    .split(/[\s\-·.,/&]+/)
    .filter((w) => w && !/^(fc|sc|sv|fk|ev|e\.v|club|the|de|der|die)$/i.test(w));
  const first = (w: string) => Array.from(w)[0] ?? '';
  if (words.length === 0) return '?';
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
  return words
    .slice(0, 3)
    .map(first)
    .join('')
    .toUpperCase();
}

// ---------- matches ----------

export type MatchEvent = {
  id: number;
  kind: EventKind;
  side: Side;
  /** Shirt number; for a sub, the player coming off. */
  no: number;
  /** For a sub: the player coming on. */
  no2?: number;
  /** The match minute (1'–24'). */
  min: number;
  /** A red card that came from a second yellow. */
  second?: boolean;
  by: 'sim' | 'ref';
};

export type Pens = { home: boolean[]; away: boolean[] };

export type Match = {
  id: string;
  stage: Stage;
  group?: GroupId;
  pitch: 1 | 2;
  kickoff: number;
  home: TeamId | null;
  away: TeamId | null;
  status: Status;
  half: 1 | 2;
  /** Game seconds played (0 … 1440, can run on when the referee is late with the whistle). */
  clock: number;
  /** Seconds left in the half-time break. */
  htLeft: number;
  events: MatchEvent[];
  pens?: Pens;
  /** The referee desk has taken this match over: no simulated events or whistles. */
  manual: boolean;
  endedAt?: number;
};

type Fixture = { id: string; stage: Stage; group?: GroupId; pitch: 1 | 2; kickoff: number; home?: TeamId; away?: TeamId };

/** Round-robin order for a group of four: 1–2 & 3–4, 1–3 & 2–4, 1–4 & 2–3. */
const RR: [number, number][][] = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
];

export function fixtures(): Fixture[] {
  const out: Fixture[] = [];
  let slot = 0;
  for (let round = 0; round < 3; round++) {
    for (const g of ['A', 'B'] as GroupId[]) {
      RR[round].forEach(([h, a], i) => {
        out.push({
          id: `${g}${round * 2 + i + 1}`,
          stage: 'group',
          group: g,
          pitch: (i + 1) as 1 | 2,
          kickoff: DAY_START + slot * SLOT_SEC,
          home: GROUPS[g][h],
          away: GROUPS[g][a],
        });
      });
      slot++;
    }
  }
  out.push({ id: 'SF1', stage: 'sf', pitch: 1, kickoff: DAY_START + slot * SLOT_SEC });
  out.push({ id: 'SF2', stage: 'sf', pitch: 2, kickoff: DAY_START + slot * SLOT_SEC });
  slot++;
  out.push({ id: '3P', stage: 'third', pitch: 2, kickoff: DAY_START + slot * SLOT_SEC });
  slot++;
  out.push({ id: 'F', stage: 'final', pitch: 1, kickoff: DAY_START + slot * SLOT_SEC });
  return out;
}
export const MATCH_IDS = fixtures().map((f) => f.id);

function freshMatch(f: Fixture): Match {
  return {
    id: f.id,
    stage: f.stage,
    group: f.group,
    pitch: f.pitch,
    kickoff: f.kickoff,
    home: f.home ?? null,
    away: f.away ?? null,
    status: 'scheduled',
    half: 1,
    clock: 0,
    htLeft: 0,
    events: [],
    manual: false,
  };
}

export function score(m: Match): [number, number] {
  let h = 0;
  let a = 0;
  for (const e of m.events) if (e.kind === 'goal') e.side === 'home' ? h++ : a++;
  return [h, a];
}
export const isOn = (m: Match) => m.status === 'live' || m.status === 'ht';
export const isKo = (m: Match) => m.stage !== 'group';

// ---------- penalty shoot-out ----------

/**
 * Who has won a shoot-out so far, or null while it goes on. Kicks alternate,
 * home first. Best of five — over early once one side cannot be caught — then
 * sudden death, decided only after both sides have taken the same number.
 */
export function shootoutWinner(p: Pens): Side | null {
  const hg = p.home.filter(Boolean).length;
  const ag = p.away.filter(Boolean).length;
  const hn = p.home.length;
  const an = p.away.length;
  if (hn <= 5 && an <= 5) {
    const hLeft = 5 - hn;
    const aLeft = 5 - an;
    if (hg > ag + aLeft) return 'home';
    if (ag > hg + hLeft) return 'away';
    if (hn < 5 || an < 5) return null;
  }
  if (hn === an && hg !== ag) return hg > ag ? 'home' : 'away';
  return null;
}

/** Plays a whole shoot-out with the given scoring chances (clamped so it always ends). */
export function simulateShootout(rand: () => number, pHome: number, pAway: number): Pens {
  const ph = Math.min(0.95, Math.max(0.05, pHome));
  const pa = Math.min(0.95, Math.max(0.05, pAway));
  const p: Pens = { home: [], away: [] };
  for (let i = 0; i < 80; i++) {
    const homeTurn = p.home.length === p.away.length;
    if (homeTurn) p.home.push(rand() < ph);
    else p.away.push(rand() < pa);
    if (shootoutWinner(p)) return p;
  }
  // 40 rounds level: practically impossible — the away side's next kick misses.
  if (p.home.length > p.away.length) p.away.push(false);
  else {
    p.home.push(true);
    p.away.push(false);
  }
  return p;
}
const penChance = (t: TeamId | null) => 0.7 + 0.025 * ((t ? TEAMS[t].str : 3) - 3);

/** The side that went through / won, once a match is over. */
export function winnerSide(m: Match): Side | null {
  if (m.status !== 'ft') return null;
  const [h, a] = score(m);
  if (h !== a) return h > a ? 'home' : 'away';
  return m.pens ? shootoutWinner(m.pens) : null;
}
export function winner(m: Match): TeamId | null {
  const s = winnerSide(m);
  return s ? m[s] : null;
}
export function loser(m: Match): TeamId | null {
  const s = winnerSide(m);
  return s ? m[s === 'home' ? 'away' : 'home'] : null;
}

// ---------- standings ----------

export type Row = {
  team: TeamId;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  /** Fair-play points: yellow 1, red 3 (a second yellow counts as the red only). */
  fp: number;
  /** Playing right now — the row counts the live score. */
  live: boolean;
  /** What separated this team from the one directly below, when points, GD and GF did not. */
  by?: 'h2h' | 'fairplay' | 'lots';
};

export type StandingsOpts = { includeLive?: boolean; lots?: TeamId[] };

function tally(teams: TeamId[], matches: Match[], includeLive: boolean): Map<TeamId, Row> {
  const rows = new Map<TeamId, Row>();
  for (const t of teams) rows.set(t, { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, fp: 0, live: false });
  for (const m of matches) {
    if (!m.home || !m.away) continue;
    const counts = m.status === 'ft' || (includeLive && isOn(m));
    const h = rows.get(m.home);
    const a = rows.get(m.away);
    if (!h || !a) continue;
    for (const e of m.events) {
      const r = e.side === 'home' ? h : a;
      if (e.kind === 'yellow') r.fp += 1;
      if (e.kind === 'red') r.fp += e.second ? 2 : 3;
    }
    if (!counts) continue;
    if (isOn(m)) h.live = a.live = true;
    const [hg, ag] = score(m);
    h.p++;
    a.p++;
    h.gf += hg;
    h.ga += ag;
    a.gf += ag;
    a.ga += hg;
    if (hg > ag) {
      h.w++;
      a.l++;
      h.pts += 3;
    } else if (hg < ag) {
      a.w++;
      h.l++;
      a.pts += 3;
    } else {
      h.d++;
      a.d++;
      h.pts++;
      a.pts++;
    }
  }
  for (const r of rows.values()) r.gd = r.gf - r.ga;
  return rows;
}

const key3 = (r: Row) => [r.pts, r.gd, r.gf];
function cmp3(a: Row, b: Row) {
  const x = key3(a);
  const y = key3(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i];
  return 0;
}
/** Splits an ordered list into runs of rows that compare equal. */
function runs<T>(xs: T[], eq: (a: T, b: T) => boolean): T[][] {
  const out: T[][] = [];
  for (const x of xs) {
    const last = out[out.length - 1];
    if (last && eq(last[0], x)) last.push(x);
    else out.push([x]);
  }
  return out;
}

/**
 * The group table: points → goal difference → goals scored → head-to-head
 * (points, GD, goals in the games between the tied teams, applied again to any
 * smaller group still level) → fair play (fewer card points) → drawing of lots
 * (`lots`, a fixed order made from the tournament's seed).
 */
export function standings(teams: TeamId[], matches: Match[], opts: StandingsOpts = {}): Row[] {
  const includeLive = opts.includeLive ?? true;
  const lots = opts.lots ?? teams;
  const rows = tally(teams, matches, includeLive);
  const all = [...rows.values()].sort(cmp3);
  const out: Row[] = [];
  for (const run of runs(all, (a, b) => cmp3(a, b) === 0)) out.push(...breakTie(run, matches, includeLive, lots));
  return out;
}

function breakTie(tied: Row[], matches: Match[], includeLive: boolean, lots: TeamId[]): Row[] {
  if (tied.length < 2) return tied;
  const ids = tied.map((r) => r.team);
  const between = matches.filter((m) => m.home && m.away && ids.includes(m.home) && ids.includes(m.away));
  const mini = tally(ids, between, includeLive);
  const sorted = [...tied].sort((a, b) => cmp3(mini.get(a.team)!, mini.get(b.team)!));
  const groups = runs(sorted, (a, b) => cmp3(mini.get(a.team)!, mini.get(b.team)!) === 0);
  if (groups.length > 1) {
    const out: Row[] = [];
    groups.forEach((g, i) => {
      const done = breakTie(g, matches, includeLive, lots);
      // The last of this run is separated from the next run by head-to-head.
      if (i < groups.length - 1) done[done.length - 1] = { ...done[done.length - 1], by: done[done.length - 1].by ?? 'h2h' };
      out.push(...done);
    });
    return out;
  }
  // Head-to-head cannot separate them: fair play, then the drawing of lots.
  const fp = [...tied].sort((a, b) => a.fp - b.fp);
  const fpRuns = runs(fp, (a, b) => a.fp === b.fp);
  const out: Row[] = [];
  fpRuns.forEach((g, i) => {
    const byLots = [...g].sort((a, b) => lots.indexOf(a.team) - lots.indexOf(b.team));
    const marked = byLots.map((r, j) => (j < byLots.length - 1 ? { ...r, by: 'lots' as const } : r));
    if (i < fpRuns.length - 1) marked[marked.length - 1] = { ...marked[marked.length - 1], by: 'fairplay' };
    out.push(...marked);
  });
  return out;
}

export function groupMatches(s: { matches: Match[] }, g: GroupId): Match[] {
  return s.matches.filter((m) => m.stage === 'group' && m.group === g);
}
export function groupDone(s: { matches: Match[] }, g: GroupId): boolean {
  return groupMatches(s, g).every((m) => m.status === 'ft');
}
export function table(s: State, g: GroupId, includeLive = true): Row[] {
  return standings(GROUPS[g], groupMatches(s, g), { includeLive, lots: lotsOrder(s.seed) });
}

/** A fixed "drawing of lots" order for the eight teams, made from the seed. */
export function lotsOrder(seed: number): TeamId[] {
  const r = rng(seed ^ 0x5eed);
  return [...TEAM_IDS].map((t) => [t, r()] as const).sort((a, b) => a[1] - b[1]).map(([t]) => t);
}

// ---------- the bracket ----------

/** Where each knockout team comes from. */
export const BRACKET: Record<'SF1' | 'SF2' | '3P' | 'F', { home: string; away: string }> = {
  SF1: { home: 'A1', away: 'B2' },
  SF2: { home: 'B1', away: 'A2' },
  '3P': { home: 'L:SF1', away: 'L:SF2' },
  F: { home: 'W:SF1', away: 'W:SF2' },
};

/** Fills knockout places whose source is decided. Teams, once set, never change. */
export function fillBracket(s: State): State {
  let changed = false;
  const byId = new Map(s.matches.map((m) => [m.id, m]));
  const resolve = (src: string): TeamId | null => {
    if (src[0] === 'A' || src[0] === 'B') {
      const g = src[0] as GroupId;
      if (!groupDone(s, g)) return null;
      return table(s, g)[Number(src[1]) - 1]?.team ?? null;
    }
    const m = byId.get(src.slice(2));
    if (!m) return null;
    return src[0] === 'W' ? winner(m) : loser(m);
  };
  const matches = s.matches.map((m) => {
    if (m.stage === 'group') return m;
    const b = BRACKET[m.id as keyof typeof BRACKET];
    if (!b || (m.home && m.away)) return m;
    const home = m.home ?? resolve(b.home);
    const away = m.away ?? resolve(b.away);
    if (home === m.home && away === m.away) return m;
    changed = true;
    return { ...m, home, away };
  });
  return changed ? { ...s, matches } : s;
}

export function champion(s: State): TeamId | null {
  const f = s.matches.find((m) => m.id === 'F');
  return f ? winner(f) : null;
}

// ---------- the seeded random numbers ----------

/** mulberry32 — small, fast and the same everywhere. */
export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A stateful generator whose position lives in the stored state. */
function stepper(state: number) {
  const r = { s: state | 0 };
  const next = () => {
    r.s = (r.s + 0x6d2b79f5) | 0;
    let t = r.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { r, next };
}

// ---------- registrations (stay in this browser) ----------

export const REG_COLORS = ['#c8102e', '#1d4ed8', '#15803d', '#7c3aed', '#ea580c', '#0e7490', '#111827', '#facc15', '#ffffff', '#be185d'];
export const MOTIFS: Motif[] = ['peak', 'star', 'sun', 'moon'];
export type Registration = { id: number; name: string; captain: string; colors: [string, string]; motif: Motif; at: number };
export type RegInput = { name: string; captain: string; colors: [string, string]; motif: Motif };
export type RegError = 'nameShort' | 'nameLong' | 'nameTaken' | 'captainShort' | 'captainLong' | 'colorsSame' | 'full';
export const NAME_MAX = 32;
export const CAPTAIN_MAX = 20;

const letters = (s: string) => (s.match(/\p{L}/gu) ?? []).length;
const tidy = (s: string) => s.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();

export function validateRegistration(input: RegInput, existing: Registration[]): RegError[] {
  const errs: RegError[] = [];
  const name = tidy(input.name);
  const captain = tidy(input.captain);
  if (letters(name) < 2) errs.push('nameShort');
  if (Array.from(name).length > NAME_MAX) errs.push('nameLong');
  const lower = name.toLowerCase();
  if (lower && (TEAM_IDS.some((t) => TEAMS[t].name.toLowerCase() === lower) || existing.some((r) => r.name.toLowerCase() === lower))) errs.push('nameTaken');
  if (letters(captain) < 2) errs.push('captainShort');
  if (Array.from(captain).length > CAPTAIN_MAX) errs.push('captainLong');
  if (input.colors[0].toLowerCase() === input.colors[1].toLowerCase()) errs.push('colorsSame');
  if (existing.length >= MAX_REGISTERED) errs.push('full');
  return errs;
}

export function register(s: State, input: RegInput): { state: State; errors: RegError[] } {
  const errors = validateRegistration(input, s.registered);
  if (errors.length) return { state: s, errors };
  const reg: Registration = {
    id: (s.registered.reduce((mx, r) => Math.max(mx, r.id), 0) || 0) + 1,
    name: tidy(input.name),
    captain: tidy(input.captain),
    colors: [input.colors[0], input.colors[1]],
    motif: input.motif,
    at: s.now,
  };
  return { state: { ...s, registered: [...s.registered, reg] }, errors: [] };
}

// ---------- the whole state ----------

export type State = {
  v: 1;
  seed: number;
  rng: number;
  now: number;
  /** Real milliseconds not yet turned into a game second. */
  carry: number;
  speed: Speed;
  paused: boolean;
  matches: Match[];
  follow: TeamId | null;
  lang: Lang;
  registered: Registration[];
  nextEv: number;
};

export function fresh(seed: number, lang: Lang = 'en'): State {
  return {
    v: 1,
    seed: seed >>> 0,
    rng: seed | 0,
    now: DAY_START - 20,
    carry: 0,
    speed: DEFAULT_SPEED,
    paused: false,
    matches: fixtures().map(freshMatch),
    follow: null,
    lang,
    registered: [],
    nextEv: 1,
  };
}

/** Things the page may want to say out loud (toasts) after a step. */
export type Note =
  | { kind: 'kickoff'; match: string }
  | { kind: 'goal'; match: string; side: Side; team: TeamId; no: number; min: number; score: [number, number] }
  | { kind: 'card'; match: string; side: Side; team: TeamId; no: number; color: 'yellow' | 'red' }
  | { kind: 'ht'; match: string }
  | { kind: 'ft'; match: string }
  | { kind: 'champion'; team: TeamId };

// ---------- applying and undoing events ----------

export function applyEvent(m: Match, e: MatchEvent): Match {
  if (m.events.length >= MAX_EVENTS) return m;
  return { ...m, events: [...m.events, e] };
}
/** Takes back the last event of the match (a goal, card or sub); the score follows. */
export function undoEvent(m: Match): Match {
  if (!m.events.length) return m;
  return { ...m, events: m.events.slice(0, -1) };
}
/** Takes back the last goal of one side (the referee's "−" button). */
export function removeLastGoal(m: Match, side: Side): Match {
  for (let i = m.events.length - 1; i >= 0; i--) {
    const e = m.events[i];
    if (e.kind === 'goal' && e.side === side) return { ...m, events: [...m.events.slice(0, i), ...m.events.slice(i + 1)] };
  }
  return m;
}
export function sentOff(m: Match, side: Side): number[] {
  return m.events.filter((e) => e.kind === 'red' && e.side === side).map((e) => e.no);
}
/** A yellow for a player already booked in this match becomes a red ("second yellow"). */
export function cardEvent(m: Match, side: Side, no: number, color: 'yellow' | 'red', id: number, by: 'sim' | 'ref'): MatchEvent {
  const booked = m.events.some((e) => e.kind === 'yellow' && e.side === side && e.no === no);
  if (color === 'yellow' && booked) return { id, kind: 'red', side, no, min: minuteOf(m.clock), second: true, by };
  return { id, kind: color, side, no, min: minuteOf(m.clock), by };
}

function finish(m: Match, now: number, next: () => number): Match {
  const [h, a] = score(m);
  let pens = m.pens;
  if (isKo(m) && h === a && !pens) pens = simulateShootout(next, penChance(m.home), penChance(m.away));
  return { ...m, status: 'ft', endedAt: now, pens };
}

function pitchBusy(matches: Match[], pitch: 1 | 2, except: string) {
  return matches.some((x) => x.id !== except && x.pitch === pitch && isOn(x));
}

// ---------- the simulation ----------

const GOAL_W: Record<Pos, number> = { GK: 0.03, DF: 0.55, WG: 1.2, PV: 1.7 };

function pick(next: () => number, ps: Player[], w: (p: Player) => number): Player {
  const total = ps.reduce((t, p) => t + w(p), 0);
  let x = next() * total;
  for (const p of ps) {
    x -= w(p);
    if (x <= 0) return p;
  }
  return ps[ps.length - 1];
}

/** One simulated minute of one match: goals, cards and subs for both sides. */
function simMinute(m: Match, next: () => number, ev: () => number, notes: Note[]): Match {
  let cur = m;
  for (const side of ['home', 'away'] as Side[]) {
    const team = cur[side]!;
    const other = cur[side === 'home' ? 'away' : 'home']!;
    const str = TEAMS[team].str - TEAMS[other].str;
    const reds = sentOff(cur, side).length - sentOff(cur, side === 'home' ? 'away' : 'home').length;
    const pGoal = Math.max(0.03, 0.085 + 0.012 * str - 0.03 * reds + (cur.half === 2 ? 0.01 : 0));
    // Always three draws per side per minute, so the sequence never depends on what happened.
    const rGoal = next();
    const rCard = next();
    const rSub = next();
    const off = sentOff(cur, side);
    const squad = SQUADS[team].filter((p) => !off.includes(p.no));
    const min = minuteOf(cur.clock);
    if (rGoal < pGoal) {
      const scorer = pick(next, squad, (p) => GOAL_W[p.pos]);
      cur = applyEvent(cur, { id: ev(), kind: 'goal', side, no: scorer.no, min, by: 'sim' });
      notes.push({ kind: 'goal', match: cur.id, side, team, no: scorer.no, min, score: score(cur) });
    }
    if (rCard < 0.017) {
      const who = pick(next, squad, (p) => (p.pos === 'GK' ? 0.2 : 1));
      const color = rCard < 0.0022 ? 'red' : 'yellow';
      const e = cardEvent(cur, side, who.no, color, ev(), 'sim');
      cur = applyEvent(cur, e);
      notes.push({ kind: 'card', match: cur.id, side, team, no: who.no, color: e.kind === 'red' ? 'red' : 'yellow' });
    } else if (rSub < 0.04) {
      const field = squad.filter((p) => p.pos !== 'GK');
      const out = pick(next, field, () => 1);
      const rest = field.filter((p) => p.no !== out.no);
      if (rest.length) {
        const inn = pick(next, rest, () => 1);
        cur = applyEvent(cur, { id: ev(), kind: 'sub', side, no: out.no, no2: inn.no, min, by: 'sim' });
      }
    }
  }
  return cur;
}

/** One game second for the whole hall. Mutates nothing it was given. */
function second(s: State, next: () => number, ev: () => number, notes: Note[]): State {
  const now = s.now + 1;
  let matches = s.matches;
  const set = (i: number, m: Match) => {
    if (matches === s.matches) matches = [...s.matches];
    matches[i] = m;
  };
  for (let i = 0; i < matches.length; i++) {
    let m = matches[i];
    if (m.status === 'scheduled') {
      if (!m.manual && m.home && m.away && now >= m.kickoff && !pitchBusy(matches, m.pitch, m.id)) {
        set(i, { ...m, status: 'live', half: 1, clock: 0 });
        notes.push({ kind: 'kickoff', match: m.id });
      }
      continue;
    }
    if (m.status === 'live') {
      // A referee who forgets the whistle: the clock stops ten minutes past the end of the half.
      if (m.manual && m.clock >= (m.half === 1 ? HALF_SEC : MATCH_SEC) + 10 * MIN) continue;
      m = { ...m, clock: m.clock + 1 };
      if (!m.manual && m.clock % MIN === 0) m = simMinute(m, next, ev, notes);
      if (!m.manual && m.half === 1 && m.clock >= HALF_SEC) {
        m = { ...m, status: 'ht', htLeft: HT_SEC };
        notes.push({ kind: 'ht', match: m.id });
      } else if (!m.manual && m.half === 2 && m.clock >= MATCH_SEC) {
        m = finish(m, now, next);
        notes.push({ kind: 'ft', match: m.id });
      }
      set(i, m);
      continue;
    }
    if (m.status === 'ht' && !m.manual) {
      const left = m.htLeft - 1;
      set(i, left <= 0 ? { ...m, status: 'live', half: 2, clock: HALF_SEC, htLeft: 0 } : { ...m, htLeft: left });
    }
  }
  return matches === s.matches ? { ...s, now } : { ...s, now, matches };
}

/**
 * Advances the hall clock by whole game seconds. Each second is played in the
 * same order whatever the step size, so `advance(s, 600)` and six hundred
 * `advance(s, 1)` give the same tournament.
 */
export function advance(s: State, secs: number): { state: State; notes: Note[] } {
  const n = Math.max(0, Math.floor(secs));
  const notes: Note[] = [];
  if (!n || champion(s)) return { state: s, notes };
  const { r, next } = stepper(s.rng);
  let nextEv = s.nextEv;
  const ev = () => nextEv++;
  let cur = s;
  const before = champion(s);
  for (let k = 0; k < n; k++) {
    const had = notes.length;
    cur = second(cur, next, ev, notes);
    // Fill the bracket as soon as a place is decided, so the next match can kick off.
    if (notes.slice(had).some((x) => x.kind === 'ft')) cur = fillBracket(cur);
    if (champion(cur)) break;
  }
  cur = fillBracket({ ...cur, rng: r.s, nextEv });
  const champ = champion(cur);
  if (champ && !before) notes.push({ kind: 'champion', team: champ });
  return { state: cur, notes };
}

/** Real time → game time at the chosen speed (paused or hidden: nothing). */
export function tick(s: State, realMs: number): { state: State; notes: Note[] } {
  if (s.paused || realMs <= 0 || champion(s)) return { state: s, notes: [] };
  const total = s.carry + Math.min(realMs, 2000) * s.speed;
  const secs = Math.min(MAX_STEP_SEC, Math.floor(total / 1000));
  const carry = secs === MAX_STEP_SEC ? 0 : total - secs * 1000;
  const r = advance({ ...s, carry }, secs);
  return { state: r.state === s ? { ...s, carry } : { ...r.state, carry }, notes: r.notes };
}

export function setSpeed(s: State, speed: Speed): State {
  return SPEEDS.includes(speed) ? { ...s, speed } : s;
}
export function setPaused(s: State, paused: boolean): State {
  return { ...s, paused };
}
export function setFollow(s: State, team: TeamId | null): State {
  return { ...s, follow: team && TEAMS[team] ? team : null };
}

// ---------- the referee desk ----------

export type RefAction =
  | { kind: 'start' }
  | { kind: 'ht' }
  | { kind: 'second' }
  | { kind: 'ft' }
  | { kind: 'goal'; side: Side; no: number }
  | { kind: 'card'; side: Side; no: number; color: 'yellow' | 'red' }
  | { kind: 'minus'; side: Side }
  | { kind: 'undo' }
  | { kind: 'auto' };

export type RefResult = { state: State; notes: Note[]; ok: boolean };

/** What the referee desk may do with a match right now. */
export function refCan(s: State, m: Match) {
  const teams = !!(m.home && m.away);
  return {
    start: m.status === 'scheduled' && teams && !pitchBusy(s.matches, m.pitch, m.id) && !champion(s),
    ht: m.status === 'live' && m.half === 1,
    second: m.status === 'ht',
    ft: m.status === 'live' && m.half === 2,
    goal: m.status === 'live',
    card: isOn(m),
    undo: isOn(m) && m.events.length > 0,
    auto: m.manual && m.status !== 'ft',
  };
}

/** One press on the referee desk. Every press takes the match over from the simulation, except "auto". */
export function refAct(s: State, id: string, a: RefAction): RefResult {
  const i = s.matches.findIndex((m) => m.id === id);
  if (i < 0) return { state: s, notes: [], ok: false };
  const m0 = s.matches[i];
  const can = refCan(s, m0);
  const notes: Note[] = [];
  const { r, next } = stepper(s.rng);
  let nextEv = s.nextEv;
  let m: Match = { ...m0, manual: a.kind === 'auto' ? false : true };
  switch (a.kind) {
    case 'start':
      if (!can.start) return { state: s, notes, ok: false };
      m = { ...m, status: 'live', half: 1, clock: 0 };
      notes.push({ kind: 'kickoff', match: id });
      break;
    case 'ht':
      if (!can.ht) return { state: s, notes, ok: false };
      m = { ...m, status: 'ht', htLeft: HT_SEC, clock: Math.max(m.clock, 1) };
      notes.push({ kind: 'ht', match: id });
      break;
    case 'second':
      if (!can.second) return { state: s, notes, ok: false };
      m = { ...m, status: 'live', half: 2, clock: Math.max(m.clock, HALF_SEC), htLeft: 0 };
      break;
    case 'ft':
      if (!can.ft) return { state: s, notes, ok: false };
      m = finish(m, s.now, next);
      notes.push({ kind: 'ft', match: id });
      break;
    case 'goal': {
      if (!can.goal || !player(m[a.side]!, a.no) || sentOff(m, a.side).includes(a.no)) return { state: s, notes, ok: false };
      const min = minuteOf(m.clock);
      m = applyEvent(m, { id: nextEv++, kind: 'goal', side: a.side, no: a.no, min, by: 'ref' });
      notes.push({ kind: 'goal', match: id, side: a.side, team: m[a.side]!, no: a.no, min, score: score(m) });
      break;
    }
    case 'card': {
      if (!can.card || !player(m[a.side]!, a.no) || sentOff(m, a.side).includes(a.no)) return { state: s, notes, ok: false };
      const e = cardEvent(m, a.side, a.no, a.color, nextEv++, 'ref');
      m = applyEvent(m, e);
      notes.push({ kind: 'card', match: id, side: a.side, team: m[a.side]!, no: a.no, color: e.kind === 'red' ? 'red' : 'yellow' });
      break;
    }
    case 'minus':
      if (!can.goal) return { state: s, notes, ok: false };
      m = removeLastGoal(m, a.side);
      break;
    case 'undo':
      if (!can.undo) return { state: s, notes, ok: false };
      m = undoEvent(m);
      break;
    case 'auto':
      if (!can.auto) return { state: s, notes, ok: false };
      break;
  }
  const matches = [...s.matches];
  matches[i] = m;
  let state: State = { ...s, matches, rng: r.s, nextEv };
  const before = champion(s);
  state = fillBracket(state);
  const champ = champion(state);
  if (champ && !before) notes.push({ kind: 'champion', team: champ });
  return { state, notes, ok: true };
}

// ---------- reading the day ----------

export function liveMatches(s: State): Match[] {
  return s.matches.filter(isOn).sort((a, b) => a.pitch - b.pitch);
}
export function upcoming(s: State, n = 3): Match[] {
  return s.matches.filter((m) => m.status === 'scheduled').slice(0, n);
}
export function finished(s: State): Match[] {
  return s.matches.filter((m) => m.status === 'ft');
}
export function matchesOf(s: State, team: TeamId): Match[] {
  return s.matches.filter((m) => m.home === team || m.away === team);
}
/** Kick-off slots in order, each with its matches by pitch. */
export function slots(s: State): { kickoff: number; matches: Match[] }[] {
  const out: { kickoff: number; matches: Match[] }[] = [];
  for (const m of s.matches) {
    const last = out[out.length - 1];
    if (last && last.kickoff === m.kickoff) last.matches.push(m);
    else out.push({ kickoff: m.kickoff, matches: [m] });
  }
  for (const x of out) x.matches.sort((a, b) => a.pitch - b.pitch);
  return out;
}

export type Scorer = { team: TeamId; no: number; goals: number };
export function topScorers(s: State, n = 10): Scorer[] {
  const map = new Map<string, Scorer>();
  for (const m of s.matches)
    for (const e of m.events) {
      if (e.kind !== 'goal') continue;
      const team = m[e.side];
      if (!team) continue;
      const k = `${team}:${e.no}`;
      const cur = map.get(k) ?? { team, no: e.no, goals: 0 };
      cur.goals++;
      map.set(k, cur);
    }
  return [...map.values()]
    .sort((a, b) => b.goals - a.goals || TEAM_IDS.indexOf(a.team) - TEAM_IDS.indexOf(b.team) || a.no - b.no)
    .slice(0, n);
}

export type FairRow = { team: TeamId; yellow: number; red: number; points: number };
/** Fair play, best first: yellow 1, straight red 3, second yellow 2 more (on top of the yellow). */
export function fairPlay(s: State): FairRow[] {
  const rows = new Map<TeamId, FairRow>(TEAM_IDS.map((t) => [t, { team: t, yellow: 0, red: 0, points: 0 }]));
  for (const m of s.matches)
    for (const e of m.events) {
      const team = m[e.side];
      if (!team) continue;
      const r = rows.get(team)!;
      if (e.kind === 'yellow') {
        r.yellow++;
        r.points += 1;
      }
      if (e.kind === 'red') {
        r.red++;
        r.points += e.second ? 2 : 3;
      }
    }
  return [...rows.values()].sort((a, b) => a.points - b.points || TEAM_IDS.indexOf(a.team) - TEAM_IDS.indexOf(b.team));
}

// ---------- reading back what the browser stored ----------

const isTeam = (x: unknown): x is TeamId => typeof x === 'string' && (TEAM_IDS as string[]).includes(x);
const isSide = (x: unknown): x is Side => x === 'home' || x === 'away';
const isInt = (x: unknown, lo: number, hi: number) => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;
const COLOR = /^#[0-9a-f]{6}$/i;

function cleanEvent(x: unknown): MatchEvent | null {
  if (!x || typeof x !== 'object') return null;
  const e = x as Record<string, unknown>;
  if (!['goal', 'yellow', 'red', 'sub'].includes(e.kind as string) || !isSide(e.side) || !isInt(e.no, 1, 99) || !isInt(e.min, 0, 99) || !isInt(e.id, 0, 1e9))
    return null;
  return {
    id: e.id as number,
    kind: e.kind as EventKind,
    side: e.side,
    no: e.no as number,
    no2: isInt(e.no2, 1, 99) ? (e.no2 as number) : undefined,
    min: e.min as number,
    second: e.second === true ? true : undefined,
    by: e.by === 'ref' ? 'ref' : 'sim',
  };
}
function cleanPens(x: unknown): Pens | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const p = x as Record<string, unknown>;
  const ok = (a: unknown) => Array.isArray(a) && a.length <= 41 && a.every((b) => typeof b === 'boolean');
  if (!ok(p.home) || !ok(p.away)) return undefined;
  const pens = { home: p.home as boolean[], away: p.away as boolean[] };
  return shootoutWinner(pens) ? pens : undefined;
}

/** Stored state, checked field by field; anything odd and the demo starts fresh. */
export function normalize(raw: unknown, lang: Lang, seed: number): State {
  const base = fresh(seed, lang);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !Array.isArray(r.matches) || r.matches.length !== base.matches.length) return base;
  if (!isInt(r.seed, 0, 2 ** 32 - 1) || !isInt(r.now, 0, 48 * 3600)) return base;
  const matches: Match[] = [];
  for (let i = 0; i < base.matches.length; i++) {
    const b = base.matches[i];
    const x = r.matches[i] as Record<string, unknown> | null;
    if (!x || typeof x !== 'object' || x.id !== b.id) return base;
    const status = (['scheduled', 'live', 'ht', 'ft'] as Status[]).includes(x.status as Status) ? (x.status as Status) : null;
    if (!status) return base;
    const home = b.home ?? (isTeam(x.home) ? x.home : null);
    const away = b.away ?? (isTeam(x.away) ? x.away : null);
    if (status !== 'scheduled' && (!home || !away)) return base;
    const events = Array.isArray(x.events) ? x.events.slice(0, MAX_EVENTS).map(cleanEvent) : [];
    if (events.some((e) => !e)) return base;
    const m: Match = {
      ...b,
      home,
      away,
      status,
      half: x.half === 2 ? 2 : 1,
      clock: isInt(x.clock, 0, 4 * MATCH_SEC) ? (x.clock as number) : 0,
      htLeft: isInt(x.htLeft, 0, HT_SEC) ? (x.htLeft as number) : 0,
      events: events as MatchEvent[],
      manual: x.manual === true,
      endedAt: isInt(x.endedAt, 0, 48 * 3600) ? (x.endedAt as number) : undefined,
    };
    if (status === 'ft' && isKo(m)) {
      const [h, a] = score(m);
      if (h === a) {
        m.pens = cleanPens(x.pens);
        if (!m.pens) return base;
      }
    }
    matches.push(m);
  }
  const registered: Registration[] = [];
  if (Array.isArray(r.registered))
    for (const x of r.registered.slice(0, MAX_REGISTERED) as Record<string, unknown>[]) {
      if (!x || typeof x !== 'object') continue;
      const colors = Array.isArray(x.colors) && x.colors.length === 2 && x.colors.every((c) => typeof c === 'string' && COLOR.test(c)) ? (x.colors as [string, string]) : null;
      if (typeof x.name !== 'string' || typeof x.captain !== 'string' || !colors || !MOTIFS.includes(x.motif as Motif) || !isInt(x.id, 1, 1e6)) continue;
      registered.push({ id: x.id as number, name: tidy(x.name).slice(0, NAME_MAX * 2), captain: tidy(x.captain).slice(0, CAPTAIN_MAX * 2), colors, motif: x.motif as Motif, at: isInt(x.at, 0, 48 * 3600) ? (x.at as number) : 0 });
    }
  const maxEv = matches.reduce((mx, m) => m.events.reduce((y, e) => Math.max(y, e.id), mx), 0);
  return fillBracket({
    v: 1,
    seed: r.seed as number,
    rng: isInt(r.rng, -(2 ** 31), 2 ** 31 - 1) ? (r.rng as number) : base.rng,
    now: r.now as number,
    carry: 0,
    speed: SPEEDS.includes(r.speed as Speed) ? (r.speed as Speed) : DEFAULT_SPEED,
    paused: r.paused === true,
    matches,
    follow: isTeam(r.follow) ? r.follow : null,
    lang: r.lang === 'de' || r.lang === 'ne' || r.lang === 'en' ? r.lang : lang,
    registered,
    nextEv: Math.max(maxEv + 1, isInt(r.nextEv, 1, 1e9) ? (r.nextEv as number) : 1),
  });
}
