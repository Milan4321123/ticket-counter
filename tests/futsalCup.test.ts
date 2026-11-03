/**
 * THE FUTSAL CUP DEMO (/work/cup) KEEPS ITS PROMISES.
 *
 * The fans' match centre, the tables, the bracket, the referee desk and the
 * hall TV are all drawings of one state (src/app/work/cup/cup.ts). These pin
 * the standings with every tie-breaker (points → GD → goals → head-to-head,
 * re-applied to smaller groups → fair play → lots), the bracket filling in,
 * the penalty shoot-out (best of five, then sudden death), applying and undoing
 * match events from the referee desk, the simulation's determinism with a seed
 * — and the rule that no money, bets or odds appear anywhere, in any language.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUPS,
  HALF_SEC,
  MATCH_IDS,
  MATCH_SEC,
  SQUADS,
  TEAMS,
  TEAM_IDS,
  advance,
  applyEvent,
  cardEvent,
  champion,
  crestInitials,
  fairPlay,
  fillBracket,
  fixtures,
  fresh,
  groupDone,
  minuteOf,
  normalize,
  refAct,
  refCan,
  register,
  removeLastGoal,
  score,
  shootoutWinner,
  simulateShootout,
  standings,
  table,
  tick,
  topScorers,
  undoEvent,
  validateRegistration,
  winner,
  type Match,
  type MatchEvent,
  type Side,
  type State,
  type TeamId,
} from '../src/app/work/cup/cup.ts';
import { COPY, FRAME, type Lang } from '../src/app/work/cup/content.ts';

// ---------- helpers ----------

let evId = 1;
/** A finished match with the given score (goals by #9), between two teams. */
function played(home: TeamId, away: TeamId, h: number, a: number, extra: MatchEvent[] = []): Match {
  const events: MatchEvent[] = [];
  for (let i = 0; i < h; i++) events.push({ id: evId++, kind: 'goal', side: 'home', no: 9, min: 5 + i, by: 'sim' });
  for (let i = 0; i < a; i++) events.push({ id: evId++, kind: 'goal', side: 'away', no: 9, min: 6 + i, by: 'sim' });
  return {
    id: `T${evId++}`,
    stage: 'group',
    group: 'A',
    pitch: 1,
    kickoff: 0,
    home,
    away,
    status: 'ft',
    half: 2,
    clock: MATCH_SEC,
    htLeft: 0,
    events: [...events, ...extra],
    manual: false,
  };
}
const ids = (rows: { team: TeamId }[]) => rows.map((r) => r.team);
const [T1, T2, T3, T4] = GROUPS.A; // euk, yfc, gsm, llh

/** Plays the whole tournament with a seed in steps of `step` game seconds. */
function runAll(seed: number, step: number): State {
  let s = fresh(seed);
  for (let i = 0; i < 100_000 && !champion(s); i++) s = advance(s, step).state;
  return s;
}
function liveState(seed = 7): { s: State; m: Match } {
  let s = fresh(seed);
  while (!s.matches.some((m) => m.status === 'live')) s = advance(s, 1).state;
  return { s, m: s.matches.find((m) => m.status === 'live')! };
}

// ---------- the schedule ----------

test('two groups of four play a round robin, then semis, 3rd place and the final on two pitches', () => {
  const f = fixtures();
  assert.equal(f.length, 16);
  assert.deepEqual(MATCH_IDS.slice(-4), ['SF1', 'SF2', '3P', 'F']);
  for (const g of ['A', 'B'] as const) {
    const gm = f.filter((x) => x.group === g);
    assert.equal(gm.length, 6);
    const pairs = new Set(gm.map((x) => [x.home, x.away].sort().join('-')));
    assert.equal(pairs.size, 6, `${g}: every pair meets exactly once`);
  }
  // No team plays twice in the same slot, and a slot never puts two matches on one pitch.
  const bySlot = new Map<number, typeof f>();
  for (const x of f) bySlot.set(x.kickoff, [...(bySlot.get(x.kickoff) ?? []), x]);
  for (const [, xs] of bySlot) {
    const teams = xs.flatMap((x) => [x.home, x.away]).filter(Boolean);
    assert.equal(new Set(teams).size, teams.length);
    assert.equal(new Set(xs.map((x) => x.pitch)).size, xs.length);
  }
  assert.ok(f.find((x) => x.id === 'F')!.kickoff > f.find((x) => x.id === '3P')!.kickoff, 'the final is the last match');
});

test('teams and players are made up, with a squad each and crest initials', () => {
  assert.equal(TEAM_IDS.length, 8);
  for (const t of TEAM_IDS) {
    assert.ok(SQUADS[t].length >= 8);
    assert.equal(new Set(SQUADS[t].map((p) => p.no)).size, SQUADS[t].length, `${t}: shirt numbers are unique`);
    for (const p of SQUADS[t]) assert.match(p.name, /^\p{L}+ \p{Lu}\.$/u, 'first name and an initial only');
  }
  assert.equal(crestInitials('Everest United Köln'), 'EUK');
  assert.equal(crestInitials('Yeti FC Berlin'), 'YB');
  assert.equal(crestInitials('Lalitpur'), 'LA');
  assert.equal(crestInitials('   '), '?');
  assert.equal(crestInitials('हिमाल टाइगर्स'), 'हट');
});

// ---------- standings and tie-breakers ----------

test('the table counts P W D L GF GA GD Pts and sorts by points, goal difference, goals', () => {
  const ms = [played(T1, T2, 3, 0), played(T3, T4, 1, 1), played(T1, T3, 0, 1), played(T2, T4, 2, 2)];
  const rows = standings(GROUPS.A, ms);
  const r1 = rows.find((r) => r.team === T1)!;
  assert.deepEqual([r1.p, r1.w, r1.d, r1.l, r1.gf, r1.ga, r1.gd, r1.pts], [2, 1, 0, 1, 3, 1, 2, 3]);
  // T3: draw + win = 4, T1: 3, T4: two draws = 2, T2: 1.
  assert.deepEqual(ids(rows), [T3, T1, T4, T2]);
  assert.deepEqual(
    rows.map((r) => r.pts),
    [4, 3, 2, 1]
  );
});

test('goals scored separate teams level on points and goal difference', () => {
  // T1 and T2 both: one win, one loss, GD 0 — T2 scored more.
  const ms = [played(T1, T3, 1, 0), played(T4, T1, 1, 0), played(T2, T3, 3, 2), played(T4, T2, 3, 2)];
  const rows = standings(GROUPS.A, ms);
  assert.ok(ids(rows).indexOf(T2) < ids(rows).indexOf(T1));
  assert.equal(rows.find((r) => r.team === T2)!.by, undefined, 'not a tie-breaker, just goals scored');
});

test('head-to-head decides two teams level on points, goal difference and goals', () => {
  const ms = [
    played(T1, T2, 2, 1),
    played(T1, T3, 0, 1),
    played(T1, T4, 1, 1),
    played(T2, T3, 1, 0),
    played(T2, T4, 1, 1),
    played(T3, T4, 0, 0),
  ];
  // T1 and T2: 4 points, GD 0, 3 goals each — T1 beat T2.
  const rows = standings([T2, T1, T3, T4], ms);
  assert.deepEqual(ids(rows), [T1, T2, T3, T4]);
  assert.equal(rows[0].by, 'h2h');
});

test('a three-way tie uses the mini-table of the games between them', () => {
  const ms = [
    played(T1, T2, 3, 0),
    played(T3, T1, 1, 0),
    played(T2, T3, 1, 0),
    played(T1, T4, 4, 3),
    played(T2, T4, 6, 1),
    played(T3, T4, 6, 3),
  ];
  const rows = standings(GROUPS.A, ms);
  for (const t of [T1, T2, T3]) {
    const r = rows.find((x) => x.team === t)!;
    assert.deepEqual([r.pts, r.gd, r.gf], [6, 3, 7], `${t} is level overall`);
  }
  // Mini-table: T1 +2, T3 0, T2 −2.
  assert.deepEqual(ids(rows), [T1, T3, T2, T4]);
});

test('head-to-head is applied again to the teams still level after the first pass', () => {
  const ms = [
    played(T1, T2, 1, 0),
    played(T3, T1, 1, 0),
    played(T2, T3, 2, 1),
    played(T1, T4, 2, 1),
    played(T2, T4, 1, 0),
    played(T3, T4, 1, 0),
  ];
  // All three: 6 points, GD +1, 3 goals. Mini-table: T1 GD 0 / 1 goal, T2 and T3 GD 0 / 2 goals.
  // T1 drops to third of them; between T2 and T3 alone, T2 won 2–1.
  const rows = standings([T3, T2, T1, T4], ms);
  assert.deepEqual(ids(rows), [T2, T3, T1, T4]);
  assert.equal(rows[0].by, 'h2h');
  assert.equal(rows[1].by, 'h2h');
});

test('fair play, then the drawing of lots, when head-to-head cannot separate', () => {
  const booked: MatchEvent[] = [{ id: 9001, kind: 'yellow', side: 'home', no: 4, min: 3, by: 'sim' }];
  const ms = [played(T1, T2, 1, 1, booked), played(T1, T3, 2, 0), played(T2, T3, 2, 0)];
  // T1 and T2 identical, drew each other; T1 has a yellow card.
  const rows = standings([T1, T2, T3, T4], ms, { includeLive: true });
  assert.deepEqual(ids(rows).slice(0, 2), [T2, T1]);
  assert.equal(rows[0].by, 'fairplay');
  // Without cards: the drawing of lots, a fixed order.
  const clean = [played(T1, T2, 1, 1), played(T1, T3, 2, 0), played(T2, T3, 2, 0)];
  assert.deepEqual(ids(standings([T1, T2, T3, T4], clean, { lots: [T2, T1, T3, T4] })).slice(0, 2), [T2, T1]);
  assert.deepEqual(ids(standings([T1, T2, T3, T4], clean, { lots: [T1, T2, T3, T4] })).slice(0, 2), [T1, T2]);
  assert.equal(standings([T1, T2, T3, T4], clean, { lots: [T1, T2, T3, T4] })[0].by, 'lots');
});

test('a live match counts in the table (and is flagged), unless asked not to', () => {
  const m: Match = { ...played(T1, T2, 2, 0), status: 'live', half: 2, clock: 900 };
  const live = standings(GROUPS.A, [m]);
  assert.equal(live[0].team, T1);
  assert.equal(live[0].live, true);
  assert.equal(live[0].pts, 3);
  const settled = standings(GROUPS.A, [m], { includeLive: false });
  assert.ok(settled.every((r) => r.p === 0));
});

// ---------- penalty shoot-out ----------

test('a shoot-out is best of five, over as soon as one side cannot be caught', () => {
  assert.equal(shootoutWinner({ home: [true, true, true], away: [false, false] }), null, 'away can still reach three');
  assert.equal(shootoutWinner({ home: [true, true, true], away: [false, false, false] }), 'home');
  assert.equal(shootoutWinner({ home: [false, false, false], away: [true, true, true] }), 'away');
  // Home misses its fourth, away has scored all four — 3 vs 4 with one kick each left? home 3/4 , away 4/4: away still needs … home can reach 4.
  assert.equal(shootoutWinner({ home: [true, true, true, false], away: [true, true, true, true] }), null);
  assert.equal(shootoutWinner({ home: [true, true, true, false, false], away: [true, true, true, true] }), 'away');
  // 5–5 or 4–4 after five each: sudden death.
  assert.equal(shootoutWinner({ home: [true, true, true, true, false], away: [true, true, true, true, false] }), null);
});

test('sudden death is decided only after both sides have kicked in the round', () => {
  const five = [true, true, true, true, true];
  assert.equal(shootoutWinner({ home: [...five, true], away: [...five] }), null, 'away still to kick');
  assert.equal(shootoutWinner({ home: [...five, true], away: [...five, true] }), null);
  assert.equal(shootoutWinner({ home: [...five, true, false], away: [...five, true, true] }), 'away');
  assert.equal(shootoutWinner({ home: [...five, false, false, true], away: [...five, false, false, false] }), 'home');
});

test('a simulated shoot-out always ends with a winner, and stops the moment it is decided', () => {
  for (let seed = 1; seed < 300; seed++) {
    let a = seed;
    const r = () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const p = simulateShootout(r, 0.75, 0.7);
    const w = shootoutWinner(p);
    assert.ok(w, `seed ${seed}`);
    // Taking back the last kick undoes the decision.
    const shorter = p.home.length > p.away.length ? { home: p.home.slice(0, -1), away: p.away } : { home: p.home, away: p.away.slice(0, -1) };
    assert.equal(shootoutWinner(shorter), null, `seed ${seed}: decided on the last kick`);
  }
  // Even with sure-fire kickers it ends.
  assert.ok(shootoutWinner(simulateShootout(() => 0, 1, 1)));
});

// ---------- events, the referee desk and undo ----------

test('applying and undoing events moves the score; a second yellow becomes a red', () => {
  let m = played(T1, T2, 0, 0);
  m = { ...m, status: 'live', clock: 125 };
  m = applyEvent(m, { id: 1, kind: 'goal', side: 'home', no: 9, min: minuteOf(m.clock), by: 'ref' });
  m = applyEvent(m, { id: 2, kind: 'goal', side: 'away', no: 7, min: 3, by: 'ref' });
  m = applyEvent(m, { id: 3, kind: 'goal', side: 'home', no: 10, min: 3, by: 'ref' });
  assert.deepEqual(score(m), [2, 1]);
  assert.equal(m.events[0].min, 3, '2:05 played is the 3rd minute');
  assert.deepEqual(score(removeLastGoal(m, 'away')), [2, 0]);
  assert.deepEqual(score(removeLastGoal(m, 'home')), [1, 1]);
  assert.equal(removeLastGoal(m, 'home').events.find((e) => e.side === 'home')!.no, 9, 'the latest home goal goes');
  assert.deepEqual(score(undoEvent(m)), [1, 1]);
  assert.deepEqual(score(undoEvent(undoEvent(undoEvent(undoEvent(m))))), [0, 0]);
  const y = cardEvent(m, 'away', 4, 'yellow', 10, 'ref');
  assert.equal(y.kind, 'yellow');
  const m2 = applyEvent(m, y);
  const second = cardEvent(m2, 'away', 4, 'yellow', 11, 'ref');
  assert.equal(second.kind, 'red');
  assert.equal(second.second, true);
});

test('the referee desk takes a match over, scores, books, undoes — and the table follows', () => {
  const { s, m } = liveState(11);
  const g = m.group!;
  const before = table(s, g);
  const homeRow = () => (st: State) => table(st, g).find((r) => r.team === m.home)!;
  assert.ok(m.home && m.away);
  const r1 = refAct(s, m.id, { kind: 'goal', side: 'home', no: 9 });
  assert.ok(r1.ok);
  const m1 = r1.state.matches.find((x) => x.id === m.id)!;
  assert.equal(m1.manual, true, 'the desk has the whistle');
  assert.deepEqual(score(m1), [score(m)[0] + 1, score(m)[1]]);
  assert.equal(homeRow()(r1.state).gf, before.find((r) => r.team === m.home)!.gf + 1, 'the live table counts it');
  assert.ok(r1.notes.some((n) => n.kind === 'goal' && n.team === m.home && n.no === 9));
  // A card, then undo takes back the card; another undo takes back the goal.
  const r2 = refAct(r1.state, m.id, { kind: 'card', side: 'away', no: 4, color: 'yellow' });
  assert.equal(fairPlay(r2.state).find((x) => x.team === m.away)!.yellow, fairPlay(r1.state).find((x) => x.team === m.away)!.yellow + 1);
  const r3 = refAct(r2.state, m.id, { kind: 'undo' });
  const r4 = refAct(r3.state, m.id, { kind: 'undo' });
  assert.deepEqual(score(r4.state.matches.find((x) => x.id === m.id)!), score(m));
  // A player who does not exist, or was sent off, cannot score.
  assert.equal(refAct(s, m.id, { kind: 'goal', side: 'home', no: 77 }).ok, false);
  const red = refAct(s, m.id, { kind: 'card', side: 'home', no: 9, color: 'red' });
  assert.equal(refAct(red.state, m.id, { kind: 'goal', side: 'home', no: 9 }).ok, false);
});

test('a match the desk has taken over gets no simulated events and waits for the whistle', () => {
  const { s, m } = liveState(5);
  const taken = refAct(s, m.id, { kind: 'goal', side: 'away', no: 7 }).state;
  const later = advance(taken, 30 * 60).state;
  const lm = later.matches.find((x) => x.id === m.id)!;
  assert.equal(lm.status, 'live', 'no automatic half-time or full-time');
  assert.equal(lm.events.length, taken.matches.find((x) => x.id === m.id)!.events.length);
  // Whistles in order: half-time, second half, full-time.
  assert.equal(refAct(later, m.id, { kind: 'ft' }).ok, false, 'not in the first half');
  const ht = refAct(later, m.id, { kind: 'ht' }).state;
  assert.equal(ht.matches.find((x) => x.id === m.id)!.status, 'ht');
  const sh = refAct(ht, m.id, { kind: 'second' }).state;
  assert.equal(sh.matches.find((x) => x.id === m.id)!.half, 2);
  const ft = refAct(sh, m.id, { kind: 'ft' });
  assert.equal(ft.state.matches.find((x) => x.id === m.id)!.status, 'ft');
  assert.ok(ft.notes.some((n) => n.kind === 'ft'));
  // Once over, it is closed for the desk.
  const can = refCan(ft.state, ft.state.matches.find((x) => x.id === m.id)!);
  assert.equal(can.goal || can.card || can.undo, false);
  // "Hand back" lets the simulation run it again.
  const back = refAct(taken, m.id, { kind: 'auto' }).state;
  assert.equal(back.matches.find((x) => x.id === m.id)!.manual, false);
});

test('the desk can kick off a match early, but not on a busy pitch or without its teams', () => {
  const s = fresh(3);
  const a1 = s.matches.find((m) => m.id === 'A1')!;
  const r = refAct(s, 'A1', { kind: 'start' });
  assert.ok(r.ok);
  assert.equal(r.state.matches.find((m) => m.id === 'A1')!.status, 'live');
  // A3 is on pitch 1 too.
  const a3 = r.state.matches.find((m) => m.id === 'A3')!;
  assert.equal(a3.pitch, a1.pitch);
  assert.equal(refAct(r.state, 'A3', { kind: 'start' }).ok, false);
  assert.equal(refAct(s, 'SF1', { kind: 'start' }).ok, false, 'semi-final teams are not known yet');
});

// ---------- the bracket ----------

test('the bracket fills in from the final tables, and a drawn knockout goes to penalties', () => {
  let s = fresh(42);
  while (!(groupDone(s, 'A') && groupDone(s, 'B'))) s = advance(s, 60).state;
  s = fillBracket(s);
  const sf1 = s.matches.find((m) => m.id === 'SF1')!;
  const sf2 = s.matches.find((m) => m.id === 'SF2')!;
  const A = table(s, 'A');
  const B = table(s, 'B');
  assert.deepEqual([sf1.home, sf1.away], [A[0].team, B[1].team]);
  assert.deepEqual([sf2.home, sf2.away], [B[0].team, A[1].team]);
  assert.equal(s.matches.find((m) => m.id === 'F')!.home, null, 'the final waits for the semis');

  // Draw a semi by hand: full-time at 1–1 brings a shoot-out with a winner.
  while (!s.matches.find((m) => m.id === 'SF1')!.home || s.matches.find((m) => m.id === 'SF1')!.status === 'scheduled') s = advance(s, 1).state;
  let st = s;
  const id = 'SF1';
  const m0 = st.matches.find((m) => m.id === id)!;
  // Take it over and wipe whatever the simulation scored, then 1–1.
  for (let i = 0; i < m0.events.length; i++) st = refAct(st, id, { kind: 'undo' }).state;
  st = refAct(st, id, { kind: 'goal', side: 'home', no: 9 }).state;
  st = refAct(st, id, { kind: 'goal', side: 'away', no: 10 }).state;
  if (st.matches.find((m) => m.id === id)!.status === 'ht') st = refAct(st, id, { kind: 'second' }).state;
  if (st.matches.find((m) => m.id === id)!.half === 1) st = refAct(refAct(st, id, { kind: 'ht' }).state, id, { kind: 'second' }).state;
  st = refAct(st, id, { kind: 'ft' }).state;
  const done = st.matches.find((m) => m.id === id)!;
  assert.deepEqual(score(done), [1, 1]);
  assert.ok(done.pens && shootoutWinner(done.pens));
  const w = winner(done)!;
  assert.ok(w === done.home || w === done.away);
  assert.equal(st.matches.find((m) => m.id === 'F')!.home, w, 'the winner goes to the final');
  assert.equal(st.matches.find((m) => m.id === '3P')!.home, w === done.home ? done.away : done.home, 'the loser plays for third');
});

test('the whole day runs to a champion who won the final', () => {
  const s = runAll(2027, 60);
  const c = champion(s);
  assert.ok(c);
  const f = s.matches.find((m) => m.id === 'F')!;
  assert.equal(winner(f), c);
  assert.ok(s.matches.every((m) => m.status === 'ft'));
  // Further time changes nothing.
  assert.equal(advance(s, 600).state, s);
  // Scorers add up to the goals.
  const goals = s.matches.reduce((t, m) => t + score(m)[0] + score(m)[1], 0);
  assert.equal(topScorers(s, 999).reduce((t, x) => t + x.goals, 0), goals);
});

// ---------- determinism ----------

test('the same seed plays the same tournament, however time is chopped up', () => {
  const a = runAll(99, 1);
  const b = runAll(99, 997);
  const c = runAll(99, 60);
  const sig = (s: State) => JSON.stringify(s.matches.map((m) => [m.id, m.home, m.away, m.events.map((e) => [e.kind, e.side, e.no, e.min]), m.pens]));
  assert.equal(sig(a), sig(b));
  assert.equal(sig(a), sig(c));
  assert.equal(champion(a), champion(b));
  assert.notEqual(sig(runAll(100, 60)), sig(a), 'another seed, another day');
});

test('tick turns real time into game time at the chosen speed, and pausing stops it', () => {
  const s = fresh(1);
  assert.equal(tick({ ...s, speed: 1 }, 1000).state.now, s.now + 1);
  assert.equal(tick({ ...s, speed: 10 }, 1000).state.now, s.now + 10);
  assert.equal(tick({ ...s, speed: 60 }, 1000).state.now, s.now + 60);
  // 250 ms at 1× four times is one second, carried across ticks.
  let x: State = { ...s, speed: 1 };
  for (let i = 0; i < 4; i++) x = tick(x, 250).state;
  assert.equal(x.now, s.now + 1);
  assert.equal(tick({ ...s, paused: true }, 5000).state.now, s.now);
  // A tab coming back after an hour does not jump the day.
  assert.ok(tick({ ...s, speed: 60 }, 3_600_000).state.now - s.now <= 300);
});

test('the simulation plays futsal-like scores: halves, half-time, full-time', () => {
  let s = fresh(8);
  while (s.matches[0].status !== 'ft') s = advance(s, 30).state;
  const m = s.matches[0];
  assert.ok(m.clock >= MATCH_SEC);
  assert.ok(m.events.every((e) => e.min >= 1 && e.min <= MATCH_SEC / 60));
  assert.ok(HALF_SEC * 2 === MATCH_SEC);
  const s2 = runAll(5, 120);
  const goals = s2.matches.map((x) => score(x)[0] + score(x)[1]);
  const avg = goals.reduce((a, b) => a + b, 0) / goals.length;
  assert.ok(avg > 1.5 && avg < 9, `average ${avg}`);
});

// ---------- registration and stored state ----------

test('registration checks the form and keeps at most four teams', () => {
  let s = fresh(1);
  const ok = { name: 'Machhapuchhre FC Mainz', captain: 'Sushil', colors: ['#1d4ed8', '#facc15'] as [string, string], motif: 'peak' as const };
  assert.deepEqual(validateRegistration({ ...ok, name: ' ' }, []), ['nameShort']);
  assert.ok(validateRegistration({ ...ok, name: 'x'.repeat(40) }, []).includes('nameLong'));
  assert.ok(validateRegistration({ ...ok, name: 'yeti fc berlin' }, []).includes('nameTaken'));
  assert.ok(validateRegistration({ ...ok, captain: '' }, []).includes('captainShort'));
  assert.ok(validateRegistration({ ...ok, colors: ['#ffffff', '#FFFFFF'] }, []).includes('colorsSame'));
  for (let i = 0; i < 4; i++) {
    const r = register(s, { ...ok, name: `Team ${'ABCD'[i]}` });
    assert.deepEqual(r.errors, []);
    s = r.state;
  }
  assert.equal(s.registered.length, 4);
  assert.ok(register(s, { ...ok, name: 'Team E' }).errors.includes('full'));
  assert.ok(register(s, { ...ok, name: 'team a' }).errors.includes('nameTaken'));
  assert.equal(register(fresh(1), { ...ok, name: '  Lalitpur   Lions <b> ' }).state.registered[0].name, 'Lalitpur Lions b');
});

test('stored state comes back as it was, and anything odd starts fresh', () => {
  let s = fresh(31);
  s = advance(s, 50 * 60).state;
  s = register(s, { name: 'Pokhara Peaks', captain: 'Anu', colors: ['#15803d', '#ffffff'], motif: 'sun' }).state;
  s = { ...s, follow: 'yfc', speed: 60, lang: 'ne' };
  const back = normalize(JSON.parse(JSON.stringify(s)), 'en', 1);
  const plain = (x: State) => JSON.parse(JSON.stringify({ ...x, carry: 0 }));
  assert.deepEqual(plain(back), plain(s));
  assert.equal(normalize(null, 'de', 5).lang, 'de');
  assert.equal(normalize({ v: 2 }, 'en', 5).seed, 5);
  const broken = JSON.parse(JSON.stringify(s));
  broken.matches[3].events.push({ kind: 'goal', side: 'sideways', no: 9, min: 1, id: 1 });
  assert.equal(normalize(broken, 'en', 5).seed, 5, 'a bad event resets the demo');
  const odd = JSON.parse(JSON.stringify(s));
  odd.follow = 'fc-somewhere';
  odd.speed = 1000;
  const o = normalize(odd, 'en', 5);
  assert.equal(o.follow, null);
  assert.equal(o.speed, 10);
});

// ---------- words ----------

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') {
    const r = (v as (...a: unknown[]) => unknown)('7', '7', '7');
    if (typeof r === 'string') out.push(r);
    const r2 = (v as (...a: unknown[]) => unknown)('A', 1);
    if (typeof r2 === 'string') out.push(r2);
  } else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

const MONEY =
  /€|\$|\beur\b|euro|\bprices?\b|\bprize|\bfees?\b|\bcosts?\b|\bpay|\bpaid\b|\bcash|\bquotes?\b|\brates?\b|\bpackages?\b|\bhire|\btips?\b|\bfree\b|discount|\bdeal\b|voucher|coupon|\bbets?\b|betting|\bodds\b|wager|bookmak|jackpot|\bstakes?\b|gambl|\bentry\b|startgeld|preis|gebühr|kosten|gratis|rabatt|gutschein|zahlung|zahlen|bezahl|honorar|konto|summe|\bwett(e|en)\b|\btipp|quote|prämie|einsatz|शुल्क|मूल्य|भुक्तानी|पैसा|रुपैयाँ|दाम|टिप|छुट|निःशुल्क|सित्तै|बाजी|जुवा|सट्टा|नगद|इनाम|राशि/i;

test('no money, prizes, bets or odds anywhere, in all three languages', () => {
  for (const lang of ['en', 'de', 'ne'] as Lang[]) {
    for (const s of strings(COPY[lang])) assert.doesNotMatch(s, MONEY, `${lang}: ${s}`);
    const { free, ...frame } = FRAME[lang];
    for (const s of strings(frame)) assert.doesNotMatch(s, MONEY, `${lang} frame: ${s}`);
    // The frame's one honest line about being free is the only place that idea appears.
    assert.ok(free.length > 0);
  }
  for (const t of TEAM_IDS) assert.doesNotMatch(`${TEAMS[t].name} ${TEAMS[t].city}`, MONEY);
});

test('all three languages carry the same content', () => {
  const shape = (v: unknown): unknown =>
    Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
  assert.deepEqual(shape(COPY.de), shape(COPY.en));
  assert.deepEqual(shape(COPY.ne), shape(COPY.en));
  assert.deepEqual(shape(FRAME.de), shape(FRAME.en));
  assert.deepEqual(shape(FRAME.ne), shape(FRAME.en));
});

// Silence "unused" for helper types kept for readability.
void (null as unknown as Side);
