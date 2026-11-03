// Changa Chet! — the rules of the rooftop kite fight as plain functions: no
// DOM, no canvas, no clock. The page steps this 60 times a second (fixed step)
// and draws whatever is in the state; tests/kiteGame.test.ts plays it here.
//
// The world is H = 1000 units tall and W units wide (W follows the canvas
// shape and is fixed for a round). y grows downwards; an angle `a` is the way
// a kite's nose points: 0 = straight up, +π/2 = right (clockwise).
//
// How a fighter kite flies (and so how this one does): while you PULL, the
// string is tight and the kite darts the way its nose points and holds that
// heading; while the string is SLACK, the kite slowly spins and drifts with
// the wind. Steering is timing: let it turn, pull when it points where you
// want to go. Crossing your string over someone else's and pulling saws
// through theirs — "Chet!". They do the same to you.

export const H = 1000;
/** Kites cannot sink below this (the rooftops start a little lower). */
export const FLOOR = 800;
export const KITE_R = 28;
export const ROUND_S = 75;
export const LIVES = 3;
export const COMBO_S = 8;
export const DT = 1 / 60;

export const PHYS = {
  pullSpeed: 430,
  /** How fast the velocity turns into the pull (1/s). */
  pullResp: 5,
  /** How fast a slack kite gives in to the wind (1/s). */
  slackResp: 1.6,
  sink: 38,
  spin: 2.6,
  calmSpin: 1.9,
  maxLen: 1080,
  margin: 26,
  top: 40,
} as const;

export type Vec = { x: number; y: number };
export type Pattern = 'stripes' | 'eye' | 'sunmoon' | 'mandala';
export const PATTERNS: Pattern[] = ['stripes', 'eye', 'sunmoon', 'mandala'];
export type KiteLook = { main: string; accent: string; pattern: Pattern };

export type Kite = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Heading: 0 = nose up, clockwise positive. */
  a: number;
  /** Current spin (rad/s); slack kites spin up to ±spinRate. */
  spin: number;
  /** +1 clockwise, -1 counter-clockwise when slack. */
  spinDir: 1 | -1;
  spinRate: number;
  pulling: boolean;
  /** 0..1, how tight the string looks (smoothed pull). */
  tension: number;
  /** 0..1 string strength; at 0 the string is cut. */
  strength: number;
  anchor: Vec;
  look: KiteLook;
};

export type Mode = 'launch' | 'hover' | 'hunt';

export type Opp = Kite & {
  id: number;
  name: string;
  slot: number;
  mode: Mode;
  modeT: number;
  tx: number;
  ty: number;
  /** Seconds the strings have been crossed with yours. */
  contactT: number;
  /** Seconds left of an all-out pull once crossed. */
  duelT: number;
  /** How hard their string resists yours (grows with difficulty). */
  tough: number;
};

export type Loose = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  spin: number;
  look: KiteLook;
  age: number;
  /** Your own lost kite is not a prize. */
  prize: boolean;
};

export type Bird = { id: number; x: number; y: number; vx: number; phase: number; hit: boolean };
export type Wire = { pts: Vec[] };

export type Phase = 'playing' | 'over';
export type OverReason = 'time' | 'lives';

export type GameEvent =
  | { type: 'chet'; x: number; y: number; name: string; points: number; combo: number }
  | { type: 'lost'; x: number; y: number; by: string | null; lives: number }
  | { type: 'loot'; x: number; y: number; points: number }
  | { type: 'hit'; x: number; y: number; cause: 'bird' | 'wire' }
  | { type: 'gust'; dir: -1 | 1 }
  | { type: 'contact'; x: number; y: number }
  | { type: 'spawn'; name: string }
  | { type: 'respawn' }
  | { type: 'over'; reason: OverReason; bonus: number };

export type GameState = {
  W: number;
  seed: number;
  t: number;
  roundLen: number;
  phase: Phase;
  overReason: OverReason | null;
  overT: number;
  calm: boolean;
  score: number;
  cuts: number;
  loots: number;
  combo: number;
  comboT: number;
  bestCombo: number;
  lives: number;
  player: Kite;
  /** False while a new kite is on its way up after a cut. */
  flying: boolean;
  respawnT: number;
  /** Seconds the new kite cannot be cut. */
  safeT: number;
  hurtT: number;
  sinceDamage: number;
  opps: Opp[];
  loose: Loose[];
  birds: Bird[];
  wires: Wire[];
  wind: number;
  windTarget: number;
  gustT: number;
  birdT: number;
  spawnT: number;
  nextId: number;
  names: string[];
  usedNames: number;
  /** Where strings cross right now (for sparks). */
  contacts: Vec[];
};

export type Input = { pull: boolean };

// ---------- geometry ----------

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Wrap an angle into (-π, π]. */
export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r <= -Math.PI) r += Math.PI * 2;
  if (r > Math.PI) r -= Math.PI * 2;
  return r;
}

/** Unit vector a kite with heading `a` flies along. */
export function dirOf(a: number): Vec {
  return { x: Math.sin(a), y: -Math.cos(a) };
}

/** The heading that points from `from` to `to`. */
export function headingTo(from: Vec, to: Vec): number {
  return Math.atan2(to.x - from.x, -(to.y - from.y));
}

function orient(a: Vec, b: Vec, c: Vec) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/**
 * Where segment p1–p2 crosses segment p3–p4, or null. Touching counts;
 * collinear overlaps return the first shared point. This is the whole
 * "are the strings crossed?" test.
 */
export function segmentsIntersect(p1: Vec, p2: Vec, p3: Vec, p4: Vec): Vec | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const den = d1x * d2y - d1y * d2x;
  const EPS = 1e-9;
  if (Math.abs(den) < EPS) {
    // Parallel: only collinear overlaps meet.
    if (Math.abs(orient(p1, p2, p3)) > EPS) return null;
    const len2 = d1x * d1x + d1y * d1y;
    if (len2 < EPS) return Math.hypot(p1.x - p3.x, p1.y - p3.y) < EPS ? { ...p1 } : null;
    const proj = (p: Vec) => ((p.x - p1.x) * d1x + (p.y - p1.y) * d1y) / len2;
    const t0 = proj(p3);
    const t1 = proj(p4);
    const lo = Math.max(0, Math.min(t0, t1));
    const hi = Math.min(1, Math.max(t0, t1));
    if (lo > hi + EPS) return null;
    return { x: p1.x + d1x * lo, y: p1.y + d1y * lo };
  }
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { x: p1.x + d1x * t, y: p1.y + d1y * t };
}

/** Shortest distance from point p to segment a–b. */
export function pointSegDist(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

// ---------- randomness (seeded, so a seed replays the same round) ----------

export function rand(s: { seed: number }): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (s: { seed: number }, lo: number, hi: number) => lo + (hi - lo) * rand(s);

// ---------- the town ----------

/** Rooftop spots for the other flyers, as a share of W (two stand just off-screen). */
export const SLOTS: { fx: number; y: number }[] = [
  { fx: 0.12, y: 852 },
  { fx: 0.88, y: 848 },
  { fx: 0.3, y: 866 },
  { fx: 0.7, y: 862 },
  { fx: -0.03, y: 872 },
  { fx: 1.03, y: 870 },
];
export const PLAYER_SLOT = { fx: 0.5, y: 858 };

export function anchorAt(fx: number, y: number, W: number): Vec {
  return { x: Math.round(fx * W), y };
}

/** Two sagging power lines between poles: one low on the left, one higher on the right. */
export function makeWires(W: number): Wire[] {
  const line = (x0: number, x1: number, y: number, sag: number): Wire => {
    const pts: Vec[] = [];
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      pts.push({ x: x0 + (x1 - x0) * f, y: y + sag * 4 * f * (1 - f) });
    }
    return { pts };
  };
  return [line(W * 0.02, W * 0.36, 706, 34), line(W * 0.66, W * 0.98, 628, 30)];
}

export function wireDist(p: Vec, w: Wire): number {
  let best = Infinity;
  for (let i = 1; i < w.pts.length; i++) best = Math.min(best, pointSegDist(p, w.pts[i - 1], w.pts[i]));
  return best;
}

// ---------- difficulty ----------

/** 0 at the start of the round, 1 at the end. */
export function difficulty(s: Pick<GameState, 't' | 'roundLen'>): number {
  return clamp(s.t / s.roundLen, 0, 1);
}
export function maxOpponents(d: number): number {
  return Math.min(5, 2 + Math.floor(d * 3.6));
}
/** How fast a pulling opponent saws through your string (strength per second). */
export function oppCutRate(d: number, calm: boolean): number {
  return (0.3 + 0.5 * d) * (calm ? 0.75 : 1);
}
/** How fast you saw through theirs while pulling, before their toughness. */
export const CUT_RATE = 1.25;
export const POINTS = { cut: 100, loot: 50, kiteHome: 150 } as const;

/** Points for a cut at this combo (1 = first cut, capped at ×9). */
export function cutPoints(combo: number): number {
  return POINTS.cut * clamp(Math.round(combo), 1, 9);
}

// ---------- the kite ----------

export function makeKite(anchor: Vec, look: KiteLook, at?: Partial<Kite>): Kite {
  return {
    x: anchor.x,
    y: anchor.y - 70,
    vx: 0,
    vy: 0,
    a: 0,
    spin: 0,
    spinDir: 1,
    spinRate: PHYS.spin,
    pulling: false,
    tension: 0.4,
    strength: 1,
    anchor,
    look,
    ...at,
  };
}

/**
 * One physics step for any kite. Pull: velocity eases to pullSpeed along the
 * nose and the spin dies away. Slack: velocity eases to the wind drift plus a
 * slow sink, and the kite spins up. Then the string length and the sky's
 * edges hold it in.
 */
export function stepKite(k: Kite, pull: boolean, wind: number, dt: number, W: number): void {
  k.pulling = pull;
  if (pull) {
    const d = dirOf(k.a);
    const f = Math.min(1, dt * PHYS.pullResp);
    k.vx += (d.x * PHYS.pullSpeed + wind * 0.15 - k.vx) * f;
    k.vy += (d.y * PHYS.pullSpeed - k.vy) * f;
    k.spin *= Math.exp(-dt * 9);
  } else {
    const f = Math.min(1, dt * PHYS.slackResp);
    k.vx += (wind * 0.75 - k.vx) * f;
    k.vy += (PHYS.sink - k.vy) * f;
    k.spin += (k.spinDir * k.spinRate - k.spin) * Math.min(1, dt * 4);
  }
  k.tension += ((pull ? 1 : 0.25) - k.tension) * Math.min(1, dt * 6);
  k.a = wrapAngle(k.a + k.spin * dt);
  k.x += k.vx * dt;
  k.y += k.vy * dt;

  // The string only reaches so far.
  const dx = k.x - k.anchor.x;
  const dy = k.y - k.anchor.y;
  const len = Math.hypot(dx, dy);
  if (len > PHYS.maxLen) {
    const f = PHYS.maxLen / len;
    k.x = k.anchor.x + dx * f;
    k.y = k.anchor.y + dy * f;
    // Lose the outward part of the velocity.
    const nx = dx / len;
    const ny = dy / len;
    const out = k.vx * nx + k.vy * ny;
    if (out > 0) {
      k.vx -= out * nx;
      k.vy -= out * ny;
    }
  }
  // The edges of the sky and the rooftops.
  if (k.x < PHYS.margin) {
    k.x = PHYS.margin;
    if (k.vx < 0) k.vx = 0;
  } else if (k.x > W - PHYS.margin) {
    k.x = W - PHYS.margin;
    if (k.vx > 0) k.vx = 0;
  }
  if (k.y < PHYS.top) {
    k.y = PHYS.top;
    if (k.vy < 0) k.vy = 0;
  } else if (k.y > FLOOR) {
    k.y = FLOOR;
    if (k.vy > 0) k.vy = 0;
  }
}

export function speed(k: { vx: number; vy: number }) {
  return Math.hypot(k.vx, k.vy);
}

// ---------- a new round ----------

export const OPP_COLORS = ['#e23d3d', '#1f7ae0', '#f2b705', '#14a37f', '#8e44ad', '#ff7a1a', '#e84393', '#0f9bb5', '#2d3436', '#f5f0e6'];

export function randomLook(s: { seed: number }): KiteLook {
  const main = OPP_COLORS[Math.floor(rand(s) * OPP_COLORS.length)];
  let accent = OPP_COLORS[Math.floor(rand(s) * OPP_COLORS.length)];
  if (accent === main) accent = main === '#f5f0e6' ? '#2d3436' : '#f5f0e6';
  return { main, accent, pattern: PATTERNS[Math.floor(rand(s) * PATTERNS.length)] };
}

export type NewGame = { W: number; seed: number; look: KiteLook; names: string[]; calm?: boolean; roundLen?: number };

export function newGame({ W, seed, look, names, calm = false, roundLen = ROUND_S }: NewGame): GameState {
  const anchor = anchorAt(PLAYER_SLOT.fx, PLAYER_SLOT.y, W);
  const s: GameState = {
    W,
    seed: seed | 0,
    t: 0,
    roundLen,
    phase: 'playing',
    overReason: null,
    overT: 0,
    calm,
    score: 0,
    cuts: 0,
    loots: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    lives: LIVES,
    player: makeKite(anchor, look, { y: 560, x: anchor.x, a: 0, spinRate: calm ? PHYS.calmSpin : PHYS.spin }),
    flying: true,
    respawnT: 0,
    safeT: 2,
    hurtT: 0,
    sinceDamage: 99,
    opps: [],
    loose: [],
    birds: [],
    wires: makeWires(W),
    wind: 0,
    windTarget: 0,
    gustT: 4,
    birdT: 7,
    spawnT: 3,
    nextId: 1,
    names: names.length ? names : ['Rooftop'],
    usedNames: 0,
    contacts: [],
  };
  s.wind = s.windTarget = (rand(s) < 0.5 ? -1 : 1) * between(s, 25, 45);
  // Two kites are already up when you arrive.
  spawnOpp(s, 0, { x: W * 0.22, y: 330 });
  spawnOpp(s, 1, { x: W * 0.8, y: 280 });
  return s;
}

/** A seeded shuffle (any integer seed, negative too) — who is on which roof this round. */
export function shuffle<T>(xs: readonly T[], seed: number): T[] {
  const a = [...xs];
  const st = { seed: seed | 0 };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(st) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function freeSlot(s: GameState): number {
  const used = new Set(s.opps.map((o) => o.slot));
  const free = SLOTS.map((_, i) => i).filter((i) => !used.has(i));
  if (!free.length) return -1;
  return free[Math.floor(rand(s) * free.length)];
}

function nextName(s: GameState): string {
  const n = s.names[s.usedNames % s.names.length];
  s.usedNames += 1;
  return n;
}

export function spawnOpp(s: GameState, slot: number, at?: Vec): Opp {
  const sl = SLOTS[slot];
  const anchor = anchorAt(sl.fx, sl.y, s.W);
  const d = difficulty(s);
  const k = makeKite(anchor, randomLook(s), {
    x: at?.x ?? clamp(anchor.x, 60, s.W - 60),
    y: at?.y ?? FLOOR - 10,
    a: at ? between(s, -1, 1) : 0,
    spinDir: rand(s) < 0.5 ? 1 : -1,
    spinRate: (s.calm ? PHYS.calmSpin : PHYS.spin) * between(s, 0.85, 1.1),
  });
  const o: Opp = {
    ...k,
    id: s.nextId++,
    name: nextName(s),
    slot,
    mode: at ? 'hover' : 'launch',
    modeT: at ? between(s, 1, 3) : 1.4,
    tx: k.x,
    ty: 300,
    contactT: 0,
    duelT: 0,
    tough: 0.8 + 0.6 * d,
  };
  if (at) retarget(s, o);
  s.opps.push(o);
  return o;
}

function retarget(s: GameState, o: Opp) {
  const d = difficulty(s);
  const hunt = s.flying && rand(s) < 0.22 + 0.5 * d;
  o.mode = hunt ? 'hunt' : 'hover';
  o.modeT = hunt ? between(s, 2.5, 4.5) : between(s, 1.8, 3.6);
  if (!hunt) {
    o.tx = clamp(o.anchor.x + between(s, -320, 320), 80, s.W - 80);
    o.ty = between(s, 140, 560);
  }
}

/** Aim for a point just past the middle of your string, on the far side. */
function huntTarget(s: GameState, o: Opp): Vec {
  const p = s.player;
  const ax = p.anchor.x;
  const ay = p.anchor.y;
  const sx = p.x - ax;
  const sy = p.y - ay;
  const len = Math.hypot(sx, sy) || 1;
  const mx = ax + sx * 0.62;
  const my = ay + sy * 0.62;
  const nx = -sy / len;
  const ny = sx / len;
  const side = Math.sign(sx * (o.y - ay) - sy * (o.x - ax)) || 1;
  return { x: clamp(mx - nx * side * 150, 60, s.W - 60), y: clamp(my - ny * side * 150, 80, FLOOR - 60) };
}

/** The other flyers use the same kite as you: they wait for the nose to come round, then pull. */
function oppBrain(s: GameState, o: Opp, dt: number): boolean {
  const d = difficulty(s);
  o.modeT -= dt;
  if (o.mode === 'launch') {
    if (o.modeT <= 0) retarget(s, o);
    return Math.abs(wrapAngle(o.a)) < 0.8;
  }
  if (o.duelT > 0) {
    o.duelT -= dt;
    return true;
  }
  if (o.modeT <= 0) retarget(s, o);
  if (o.mode === 'hunt') {
    if (!s.flying) o.mode = 'hover';
    else {
      const h = huntTarget(s, o);
      o.tx = h.x;
      o.ty = h.y;
    }
  }
  // Crossed with you: after a moment they lean in and saw.
  if (o.contactT > 0.8 - 0.45 * d && rand(s) < (0.35 + 0.45 * d) * dt * 5) {
    o.duelT = between(s, 0.5, 0.9 + 0.5 * d);
    return true;
  }
  // Keep off the rooftops.
  if (o.y > FLOOR - 90 && Math.abs(wrapAngle(o.a)) < 0.7) return true;
  const want = headingTo(o, { x: o.tx, y: o.ty });
  const dist = Math.hypot(o.tx - o.x, o.ty - o.y);
  return dist > 50 && Math.abs(wrapAngle(want - o.a)) < 0.32;
}

function cutLoose(s: GameState, k: Kite, prize: boolean): Loose {
  const l: Loose = {
    id: s.nextId++,
    x: k.x,
    y: k.y,
    vx: s.wind * 0.8 + k.vx * 0.3,
    vy: -40,
    a: k.a,
    spin: (k.spinDir || 1) * 4,
    look: k.look,
    age: 0,
    prize,
  };
  s.loose.push(l);
  return l;
}

function damagePlayer(s: GameState, amount: number) {
  s.player.strength = Math.max(0, s.player.strength - amount);
  s.sinceDamage = 0;
}

function losePlayer(s: GameState, by: string | null, ev: GameEvent[]) {
  const p = s.player;
  cutLoose(s, p, false);
  s.lives -= 1;
  s.combo = 0;
  s.comboT = 0;
  s.flying = false;
  s.respawnT = 1.5;
  ev.push({ type: 'lost', x: p.x, y: p.y, by, lives: s.lives });
  if (s.lives <= 0) endRound(s, 'lives', ev);
}

function endRound(s: GameState, reason: OverReason, ev: GameEvent[]) {
  if (s.phase === 'over') return;
  const bonus = reason === 'time' ? s.lives * POINTS.kiteHome : 0;
  s.score += bonus;
  s.phase = 'over';
  s.overReason = reason;
  s.overT = 0;
  s.contacts = [];
  ev.push({ type: 'over', reason, bonus });
}

// ---------- one step of the whole fight ----------

export function step(s: GameState, input: Input, dt: number = DT): GameEvent[] {
  const ev: GameEvent[] = [];
  const W = s.W;
  const playing = s.phase === 'playing';
  if (!playing) s.overT += dt;
  else s.t += dt;
  const d = difficulty(s);

  // Wind: a new gust every few seconds, stronger later on.
  s.gustT -= dt;
  if (s.gustT <= 0) {
    const flip = rand(s) < 0.55;
    const dir = (flip ? -Math.sign(s.windTarget || 1) : Math.sign(s.windTarget || 1)) as -1 | 1;
    s.windTarget = dir * between(s, 25, 45 + 75 * d);
    s.gustT = between(s, 6, 11);
    if (playing) ev.push({ type: 'gust', dir });
  }
  s.wind += (s.windTarget - s.wind) * Math.min(1, dt * 0.8);

  // Your kite.
  const p = s.player;
  if (s.flying) {
    stepKite(p, playing && input.pull, s.wind, dt, W);
    if (s.safeT > 0) s.safeT -= dt;
    if (s.hurtT > 0) s.hurtT -= dt;
  } else if (playing) {
    s.respawnT -= dt;
    if (s.respawnT <= 0) {
      Object.assign(p, makeKite(p.anchor, p.look, { spinRate: p.spinRate, y: p.anchor.y - 60, a: 0, vy: -200 }));
      s.flying = true;
      s.safeT = 2;
      s.hurtT = 0;
      s.sinceDamage = 99;
      ev.push({ type: 'respawn' });
    }
  }

  // The others.
  for (const o of s.opps) stepKite(o, oppBrain(s, o, dt), s.wind, dt, W);

  // Crossed strings.
  s.contacts = [];
  if (playing && s.flying) {
    const pA = p.anchor;
    const pullFactor = 0.7 + 0.5 * Math.min(1, speed(p) / PHYS.pullSpeed);
    let touched = false;
    for (const o of s.opps) {
      const x = segmentsIntersect(pA, p, o.anchor, o);
      if (!x) {
        o.contactT = 0;
        continue;
      }
      if (o.contactT === 0) ev.push({ type: 'contact', x: x.x, y: x.y });
      o.contactT += dt;
      s.contacts.push(x);
      if (p.pulling) o.strength -= (dt * CUT_RATE * pullFactor) / o.tough;
      if (o.pulling && s.safeT <= 0) {
        damagePlayer(s, dt * oppCutRate(d, s.calm));
        touched = true;
      }
    }
    // Their strings snap first: the one who saws, wins ties.
    for (const o of s.opps) {
      if (o.strength > 0) continue;
      s.combo = s.comboT > 0 ? s.combo + 1 : 1;
      s.comboT = COMBO_S;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      const pts = cutPoints(s.combo);
      s.score += pts;
      s.cuts += 1;
      cutLoose(s, o, true);
      ev.push({ type: 'chet', x: o.x, y: o.y, name: o.name, points: pts, combo: s.combo });
    }
    s.opps = s.opps.filter((o) => o.strength > 0);
    if (s.player.strength <= 0) {
      const by = touched ? (s.opps.find((o) => o.contactT > 0 && o.pulling)?.name ?? null) : null;
      losePlayer(s, by, ev);
    }
  }

  // Combo clock.
  if (s.comboT > 0) {
    s.comboT -= dt;
    if (s.comboT <= 0) {
      s.comboT = 0;
      s.combo = 0;
    }
  }

  // Power lines and birds.
  if (playing && s.flying && s.hurtT <= 0) {
    for (const w of s.wires) {
      if (wireDist(p, w) < KITE_R * 0.8) {
        damagePlayer(s, 0.25);
        p.vy = -280;
        p.vx = p.x < W / 2 ? 120 : -120;
        p.spin = p.spinDir * 6;
        s.hurtT = 1;
        ev.push({ type: 'hit', x: p.x, y: p.y, cause: 'wire' });
        if (p.strength <= 0) losePlayer(s, null, ev);
        break;
      }
    }
  }
  s.birdT -= dt;
  if (s.birdT <= 0 && playing) {
    const fromLeft = rand(s) < 0.5;
    const y0 = between(s, 140, 600);
    const n = 3 + Math.floor(rand(s) * 3);
    const v = between(s, 120, 170 + 60 * d) * (fromLeft ? 1 : -1);
    for (let i = 0; i < n; i++) {
      s.birds.push({
        id: s.nextId++,
        x: (fromLeft ? -40 : W + 40) - Math.sign(v) * i * 46,
        y: y0 + (i % 2 ? 22 : -10) * (i > 0 ? 1 : 0),
        vx: v,
        phase: rand(s) * 6,
        hit: false,
      });
    }
    s.birdT = between(s, 9, 14) - 5 * d;
  }
  for (const b of s.birds) {
    b.x += b.vx * dt;
    b.y += Math.sin(s.t * 2 + b.phase) * 12 * dt;
    if (playing && s.flying && !b.hit && s.hurtT <= 0 && Math.hypot(b.x - p.x, b.y - p.y) < KITE_R + 10) {
      b.hit = true;
      damagePlayer(s, 0.15);
      p.spin = p.spinDir * 7;
      p.vx += b.vx * 0.6;
      s.hurtT = 0.8;
      ev.push({ type: 'hit', x: p.x, y: p.y, cause: 'bird' });
      if (p.strength <= 0) losePlayer(s, null, ev);
    }
  }
  s.birds = s.birds.filter((b) => b.x > -400 && b.x < W + 400);

  // String heals slowly when nothing touches it.
  s.sinceDamage += dt;
  if (s.flying && s.sinceDamage > 1.2) s.player.strength = Math.min(1, s.player.strength + 0.12 * dt);

  // Loose kites flutter down with the wind; fly into one to keep it.
  for (const l of s.loose) {
    l.age += dt;
    l.vx += (s.wind * 0.9 - l.vx) * Math.min(1, dt * 0.8);
    l.vy += (46 - l.vy) * Math.min(1, dt * 1.2);
    l.x += (l.vx + Math.sin(l.age * 3 + l.id) * 30) * dt;
    l.y += l.vy * dt;
    l.a = wrapAngle(l.a + l.spin * dt * (0.6 + 0.4 * Math.sin(l.age * 2)));
  }
  if (playing && s.flying) {
    for (const l of s.loose) {
      if (!l.prize || l.age < 0.4) continue;
      if (Math.hypot(l.x - p.x, l.y - p.y) < KITE_R * 1.7) {
        l.prize = false;
        l.age = 1e6; // gone below
        s.score += POINTS.loot;
        s.loots += 1;
        ev.push({ type: 'loot', x: l.x, y: l.y, points: POINTS.loot });
      }
    }
  }
  s.loose = s.loose.filter((l) => l.age < 1e5 && l.y < H + 60 && l.x > -120 && l.x < W + 120);

  // New flyers climb up from the roofs, more of them as the round goes on.
  if (s.phase === 'playing') {
    s.spawnT -= dt;
    if (s.spawnT <= 0 && s.opps.length < maxOpponents(d)) {
      const slot = freeSlot(s);
      if (slot >= 0) {
        const o = spawnOpp(s, slot);
        ev.push({ type: 'spawn', name: o.name });
      }
      s.spawnT = between(s, 2.2, 4) - 1.2 * d;
    }
    if (s.t >= s.roundLen) endRound(s, 'time', ev);
  }
  return ev;
}

/** Remaining seconds, rounded up for the clock. */
export function timeLeft(s: Pick<GameState, 't' | 'roundLen'>): number {
  return Math.max(0, Math.ceil(s.roundLen - s.t));
}

/** A tidy best score: only ever goes up, ignores junk. */
export function nextBest(prev: unknown, score: number): number {
  const p = typeof prev === 'number' && Number.isFinite(prev) && prev > 0 ? Math.floor(prev) : 0;
  return Math.max(p, Math.max(0, Math.floor(score)));
}

/**
 * The cover picture: a sky full of kites with your string across one of
 * theirs and that string about to go. One more pulling step gives the "Chet!".
 */
export function stageCover(s: GameState): void {
  const W = s.W;
  s.t = s.roundLen * 0.55;
  s.opps = [];
  const spots: Vec[] = [
    { x: W * 0.16, y: 250 },
    { x: W * 0.33, y: 470 },
    { x: W * 0.8, y: 210 },
    { x: W * 0.66, y: 420 },
    { x: W * 0.93, y: 520 },
  ];
  SLOTS.slice(0, 5).forEach((_, i) => spawnOpp(s, i, spots[i]));
  for (const o of s.opps) o.mode = 'hover';
  const p = s.player;
  // Your kite sits just past the string of the flyer on slot 3 (right roof).
  const victim = s.opps.find((o) => o.slot === 3)!;
  victim.x = W * 0.62;
  victim.y = 300;
  p.x = W * 0.72;
  p.y = 330;
  p.a = -0.9;
  p.vx = -300;
  p.vy = -200;
  victim.strength = 0.01;
  s.score = 1450;
  s.cuts = 6;
  s.combo = 2;
  s.comboT = 3;
  s.lives = 2;
  s.player.strength = 0.72;
  const loot: Loose = { id: s.nextId++, x: W * 0.45, y: 180, vx: 20, vy: 20, a: 0.6, spin: 3, look: randomLook(s), age: 1, prize: true };
  s.loose.push(loot);
  s.birds.push({ id: s.nextId++, x: W * 0.28, y: 140, vx: 140, phase: 0, hit: false }, { id: s.nextId++, x: W * 0.24, y: 160, vx: 140, phase: 1, hit: false });
}
