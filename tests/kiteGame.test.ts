/**
 * CHANGA CHET! PLAYS FAIR AND PLAYS TO THE END.
 *
 * /work/kite is a canvas game whose rules live in one pure module (kite.ts):
 * string crossing is segment intersection, the kite is a tiny physics step,
 * and the round is stepped at 60 Hz. These pin the geometry, the way a kite
 * flies, cutting and being cut, loot, hazards, the clock, the difficulty ramp
 * and that a whole round always ends — plus that no word in any language
 * talks money.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DT,
  FLOOR,
  H,
  LIVES,
  PHYS,
  POINTS,
  cutPoints,
  difficulty,
  dirOf,
  headingTo,
  makeKite,
  maxOpponents,
  newGame,
  nextBest,
  pointSegDist,
  segmentsIntersect,
  shuffle,
  stageCover,
  step,
  stepKite,
  timeLeft,
  wrapAngle,
  type GameEvent,
  type GameState,
  type KiteLook,
} from '../src/app/work/kite/kite.ts';
import { COPY, FLYERS, num, clock } from '../src/app/work/kite/content.ts';

const LOOK: KiteLook = { main: '#e23d3d', accent: '#1f7ae0', pattern: 'sunmoon' };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

function game(seed = 1, W = 1000): GameState {
  return newGame({ W, seed, look: LOOK, names: FLYERS.en });
}
function run(s: GameState, sec: number, pull: boolean | ((t: number) => boolean) = false): GameEvent[] {
  const all: GameEvent[] = [];
  const n = Math.round(sec / DT);
  for (let i = 0; i < n; i++) all.push(...step(s, { pull: typeof pull === 'function' ? pull(s.t) : pull }, DT));
  return all;
}

// ---------- geometry ----------

test('segments that cross meet where they cross', () => {
  const x = segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
  assert.ok(x);
  assert.ok(near(x.x, 5) && near(x.y, 5));
});

test('apart, parallel and end-touching segments', () => {
  assert.equal(segmentsIntersect({ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 6, y: 0 }, { x: 10, y: -4 }), null, 'apart');
  assert.equal(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 }), null, 'parallel');
  const touch = segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 });
  assert.ok(touch && near(touch.x, 10) && near(touch.y, 0), 'touching ends count');
  const overlap = segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 });
  assert.ok(overlap && near(overlap.x, 5), 'collinear overlap');
  assert.equal(segmentsIntersect({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 9, y: 0 }), null, 'collinear gap');
  // Lines that would cross only if extended.
  assert.equal(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 10 }, { x: 4, y: 6 }), null);
});

test('point-to-segment distance, angles and headings', () => {
  assert.ok(near(pointSegDist({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 3));
  assert.ok(near(pointSegDist({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5));
  assert.ok(near(wrapAngle(3 * Math.PI), Math.PI));
  assert.ok(near(wrapAngle(-3 * Math.PI / 2), Math.PI / 2));
  const up = dirOf(0);
  assert.ok(near(up.x, 0) && near(up.y, -1), 'heading 0 is up (y grows down)');
  const right = dirOf(Math.PI / 2);
  assert.ok(near(right.x, 1) && near(right.y, 0));
  assert.ok(near(headingTo({ x: 0, y: 0 }, { x: 0, y: -5 }), 0));
  assert.ok(near(headingTo({ x: 0, y: 0 }, { x: 5, y: 0 }), Math.PI / 2));
});

// ---------- the kite ----------

test('pulling darts the kite along its nose and stops the spin', () => {
  const k = makeKite({ x: 500, y: 860 }, LOOK, { x: 500, y: 600, a: Math.PI / 2 });
  for (let i = 0; i < 60; i++) stepKite(k, true, 0, DT, 1000);
  assert.ok(k.x > 700, `went right: ${k.x}`);
  assert.ok(Math.abs(k.y - 600) < 1, 'stayed level');
  assert.ok(near(wrapAngle(k.a), Math.PI / 2), 'held its heading');
  const spinning = makeKite({ x: 500, y: 860 }, LOOK, { x: 500, y: 600, a: 0, spin: 2.6 });
  for (let i = 0; i < 30; i++) stepKite(spinning, true, 0, DT, 1000);
  assert.ok(Math.abs(spinning.spin) < 0.05, 'spin died away');
  assert.ok(Math.abs(spinning.a) < 0.35, 'and it only turned a little on the way');
});

test('a slack kite spins and drifts with the wind', () => {
  const k = makeKite({ x: 500, y: 860 }, LOOK, { x: 500, y: 400, a: 0 });
  const a0 = k.a;
  for (let i = 0; i < 120; i++) stepKite(k, false, 80, DT, 1000);
  assert.ok(k.x > 540, 'drifted downwind');
  assert.ok(k.y > 400, 'sank a little');
  assert.notEqual(k.a, a0, 'turned');
  assert.ok(near(k.spin, k.spinRate, 0.05));
});

test('the string and the sky hold the kite in', () => {
  const k = makeKite({ x: 500, y: 860 }, LOOK, { x: 500, y: 300, a: 0 });
  for (let i = 0; i < 600; i++) stepKite(k, true, 0, DT, 1000);
  assert.ok(Math.hypot(k.x - 500, k.y - 860) <= PHYS.maxLen + 1e-6);
  assert.ok(k.y >= PHYS.top);
  const d = makeKite({ x: 500, y: 860 }, LOOK, { x: 500, y: 600, a: Math.PI });
  for (let i = 0; i < 300; i++) stepKite(d, true, 0, DT, 1000);
  assert.ok(d.y <= FLOOR, 'never sinks into the roofs');
  const side = makeKite({ x: 500, y: 860 }, LOOK, { x: 900, y: 500, a: Math.PI / 2 });
  for (let i = 0; i < 300; i++) stepKite(side, true, 0, DT, 1000);
  assert.ok(side.x <= 1000 - PHYS.margin + 1e-6);
});

// ---------- cutting ----------

/** Put your kite past one opponent's string, theirs slack, yours pulling. */
function crossed(seed = 3): GameState {
  const s = game(seed);
  s.opps = s.opps.slice(0, 1);
  const o = s.opps[0];
  o.anchor = { x: 100, y: 860 };
  o.x = 700;
  o.y = 300;
  o.mode = 'hover';
  o.tx = 700;
  o.ty = 300;
  o.modeT = 99;
  o.a = Math.PI; // pointing down, so its brain will not pull towards (700, 300)
  o.spinRate = 0;
  o.spin = 0;
  s.player.x = 300;
  s.player.y = 300;
  s.player.a = 0;
  s.birdT = 99;
  s.gustT = 99;
  s.spawnT = 99;
  s.safeT = 0;
  return s;
}

test('crossing strings while pulling cuts theirs: Chet!', () => {
  const s = crossed();
  const name = s.opps[0].name;
  const ev = run(s, 1.2, true);
  const chet = ev.find((e) => e.type === 'chet');
  assert.ok(chet, 'a cut happened');
  assert.equal(chet.type === 'chet' && chet.name, name);
  assert.equal(s.cuts, 1);
  assert.equal(s.score, POINTS.cut);
  assert.equal(s.opps.length, 0);
  assert.ok(s.loose.some((l) => l.prize), 'their kite flutters away as a prize');
  assert.ok(ev.some((e) => e.type === 'contact'));
});

test('crossed but slack does not cut', () => {
  const s = crossed();
  run(s, 0.4, false);
  assert.equal(s.cuts, 0);
  assert.ok(s.opps[0].contactT > 0, 'still crossed');
});

test('quick cuts build a combo, and the combo runs out', () => {
  assert.equal(cutPoints(1), 100);
  assert.equal(cutPoints(3), 300);
  assert.equal(cutPoints(50), 900, 'capped');
  const s = crossed();
  run(s, 1.2, true);
  assert.equal(s.combo, 1);
  // A second opponent crossed the same way.
  const b = crossed(4).opps[0];
  b.id = 999;
  s.opps.push(b);
  s.player.x = 300;
  s.player.y = 300;
  s.player.a = 0;
  run(s, 1.2, true);
  assert.equal(s.cuts, 2);
  assert.equal(s.combo, 2);
  assert.equal(s.score, 100 + 200);
  assert.equal(s.bestCombo, 2);
  s.opps = [];
  run(s, 9, false);
  assert.equal(s.combo, 0, 'combo resets after a quiet spell');
});

test('an opponent pulling across your string saws it — and three lost kites end the round', () => {
  const s = crossed();
  s.opps[0].tough = 1e9; // you cannot win this one
  s.opps[0].duelT = 1e9; // they pull all the time
  let losses = 0;
  for (let i = 0; i < 6000 && s.phase === 'playing'; i++) {
    const ev = step(s, { pull: false }, DT);
    for (const e of ev) if (e.type === 'lost') losses++;
    // Put the new kite straight back across their string.
    if (s.flying && s.safeT <= 0 && s.opps[0] && !s.opps[0].contactT) {
      s.player.x = 300;
      s.player.y = 300;
      s.opps[0].x = 700;
      s.opps[0].y = 300;
    }
  }
  assert.equal(losses, LIVES);
  assert.equal(s.lives, 0);
  assert.equal(s.phase, 'over');
  assert.equal(s.overReason, 'lives');
});

test('a fresh kite cannot be cut straight away', () => {
  const s = crossed();
  s.safeT = 2;
  s.opps[0].tough = 1e9;
  s.opps[0].duelT = 1e9;
  run(s, 1.5, false);
  assert.equal(s.player.strength, 1);
});

// ---------- loot, hazards ----------

test('fly into a falling kite to catch it', () => {
  const s = crossed();
  run(s, 1.2, true);
  const l = s.loose.find((x) => x.prize)!;
  l.age = 1;
  s.player.x = l.x;
  s.player.y = l.y;
  const before = s.score;
  const ev = run(s, DT, false);
  assert.ok(ev.some((e) => e.type === 'loot'));
  assert.equal(s.score, before + POINTS.loot);
  assert.equal(s.loots, 1);
  assert.ok(!s.loose.some((x) => x.id === l.id));
});

test('power lines and birds hurt the string', () => {
  const s = game(5);
  s.opps = [];
  s.birdT = 99;
  const w = s.wires[0].pts[3];
  s.player.x = w.x;
  s.player.y = w.y;
  const ev = run(s, DT, false);
  assert.ok(ev.some((e) => e.type === 'hit' && e.cause === 'wire'));
  assert.ok(s.player.strength <= 0.75 + 1e-9);
  assert.ok(s.player.vy < 0, 'bounced up');

  const b = game(6);
  b.opps = [];
  b.birdT = 99;
  b.player.x = 500;
  b.player.y = 300;
  b.birds.push({ id: 1, x: 500, y: 300, vx: 0, phase: 0, hit: false });
  const ev2 = run(b, DT, false);
  assert.ok(ev2.some((e) => e.type === 'hit' && e.cause === 'bird'));
  assert.ok(b.player.strength <= 0.85 + 1e-9);
});

// ---------- clock and difficulty ----------

test('the round ends on time with a bonus for every kite still up', () => {
  const s = game(7);
  s.opps = [];
  s.spawnT = 1e9;
  s.birdT = 1e9;
  s.player.y = 300;
  assert.equal(timeLeft(s), 75);
  run(s, 30.5);
  assert.equal(timeLeft(s), 45);
  const ev = run(s, 45);
  const over = ev.find((e) => e.type === 'over');
  assert.ok(over && over.type === 'over' && over.reason === 'time');
  assert.equal(s.phase, 'over');
  assert.equal(s.score, LIVES * POINTS.kiteHome);
  assert.equal(timeLeft(s), 0);
  const t = s.t;
  run(s, 2);
  assert.equal(s.t, t, 'the clock stops at the end');
  assert.ok(s.overT > 1.9);
});

test('more and keener opponents as the round goes on', () => {
  assert.equal(maxOpponents(0), 2);
  assert.ok(maxOpponents(0.5) > maxOpponents(0));
  assert.equal(maxOpponents(1), 5);
  const s = game(8);
  s.safeT = 1e9; // nobody can cut you, so the round runs its full length
  s.wires = [];
  s.birdT = 1e9;
  assert.equal(s.opps.length, 2);
  assert.equal(difficulty(s), 0);
  let most = 0;
  for (let i = 0; i < Math.round(70 / DT) && s.phase === 'playing'; i++) {
    step(s, { pull: false }, DT);
    most = Math.max(most, s.opps.length);
    assert.ok(s.opps.length <= maxOpponents(difficulty(s)));
  }
  assert.ok(most >= 4, `the sky filled up (${most})`);
});

// ---------- whole rounds ----------

function playRandom(seed: number) {
  const s = game(seed, 760);
  let pull = false;
  let flip = 0;
  let r = seed;
  for (let i = 0; i < Math.round(80 / DT); i++) {
    if (--flip <= 0) {
      r = (r * 16807) % 2147483647;
      pull = r % 3 !== 0;
      flip = 10 + (r % 40);
    }
    step(s, { pull }, DT);
    for (const k of [s.player, ...s.opps]) assert.ok(Number.isFinite(k.x) && Number.isFinite(k.y) && Number.isFinite(k.a), 'no NaN');
  }
  return s;
}

test('a round with random play always ends, and the same seed plays the same round', () => {
  for (const seed of [11, 12, 13, 14]) {
    const s = playRandom(seed);
    assert.equal(s.phase, 'over', `seed ${seed}`);
    assert.ok(s.score >= 0);
    assert.ok(s.t <= s.roundLen + DT);
  }
  const a = playRandom(21);
  const b = playRandom(21);
  assert.equal(a.score, b.score);
  assert.equal(a.cuts, b.cuts);
  assert.equal(a.player.x, b.player.x);
});

test('the cover scene cuts a string on the first pull', () => {
  const s = game(9, 1500);
  stageCover(s);
  assert.equal(s.opps.length, 5);
  const ev = step(s, { pull: true }, DT);
  assert.ok(ev.some((e) => e.type === 'chet'));
});

test('the flyers are shuffled for any seed, negative ones too, and nobody goes missing', () => {
  for (const seed of [0, 1, -1, -987654321, 2147483647, Date.now() | 0]) {
    const out = shuffle(FLYERS.en, seed);
    assert.equal(out.length, FLYERS.en.length);
    assert.deepEqual([...out].sort(), [...FLYERS.en].sort(), `seed ${seed}`);
    assert.ok(out.every((n) => typeof n === 'string'));
  }
  assert.deepEqual(shuffle(FLYERS.en, 5), shuffle(FLYERS.en, 5));
  const s = newGame({ W: 1000, seed: -42, look: LOOK, names: shuffle(FLYERS.en, -42) });
  run(s, 20);
  assert.ok(s.opps.every((o) => typeof o.name === 'string' && o.name.length > 0));
});

test('best score only goes up and ignores junk', () => {
  assert.equal(nextBest(null, 300), 300);
  assert.equal(nextBest(500, 300), 500);
  assert.equal(nextBest(500, 900), 900);
  assert.equal(nextBest('abc', 120.7), 120);
  assert.equal(nextBest(-5, -10), 0);
  assert.equal(nextBest(Number.NaN, 0), 0);
});

// ---------- words ----------

test('every language has every word, numbers in Devanagari for नेपाली', () => {
  const keys = Object.keys(COPY.en).sort();
  for (const l of ['de', 'ne'] as const) assert.deepEqual(Object.keys(COPY[l]).sort(), keys, l);
  assert.equal(FLYERS.ne.length, FLYERS.en.length);
  assert.match(COPY.ne.chet, /[ऀ-ॿ]/);
  assert.equal(num(1234, 'en'), '1,234');
  assert.equal(num(1234, 'de'), '1.234');
  assert.equal(num(1234, 'ne'), '१,२३४');
  assert.equal(clock(65, 'en'), '1:05');
  assert.equal(clock(65, 'ne'), '१:०५');
});

test('no money, coins, purchases or hire wording in any language', () => {
  const bad = /€|\$|\bprice|\bpreis|\bcost|kosten|\bbuy\b|kaufen|\bcoins?\b|münze|\bshop\b|\bpurchase|\bquote|\bpackage|\bpaket|\bhire\b|\bfee\b|पैसा|मूल्य|रुपैयाँ|सिक्का|किन्नु/i;
  const strings: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') strings.push(v);
    else if (typeof v === 'function') {
      const out = (v as (...a: unknown[]) => unknown)('X', 'Y');
      if (typeof out === 'string') strings.push(out);
      const out2 = (v as (...a: unknown[]) => unknown)(null, 'Y');
      if (typeof out2 === 'string') strings.push(out2);
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(COPY);
  for (let i = 0; i < 9; i++) for (const l of ['en', 'de', 'ne'] as const) strings.push(COPY[l].colourName(i));
  assert.ok(strings.length > 150);
  for (const s of strings) assert.doesNotMatch(s, bad, s);
  // The world is 1000 units tall; keep the test honest about that.
  assert.equal(H, 1000);
});
