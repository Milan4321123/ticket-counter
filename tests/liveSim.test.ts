/**
 * THE LIVE DASHBOARD DEMO RUNS THE WHOLE NIGHT.
 *
 * /work/live is client-only: one seeded evening (sim.ts) and a reducer that
 * moves its clock ten times a second. A number that runs past capacity, a
 * ticker that grows without end or a wall that lets swearing onto the hall
 * screen would all happen in front of a visitor, so the night is played here
 * start to finish on the clock alone and the rules a visitor would notice are
 * pinned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPACITY,
  END,
  FEED_CAP,
  FIRST_LOOK,
  PROGRAMME,
  SHOUTS,
  WALL_CAP,
  buildEvening,
  checkShout,
  initialState,
  nextAtDoor,
  reduce,
  snapshot,
  type LiveState,
} from '../src/app/work/live/sim.ts';

function runAt(s: LiveState, speed: 1 | 5 | 20, ms: number): LiveState {
  s = reduce(s, { type: 'speed', speed });
  for (let t = 0; t < ms; t += 100) s = reduce(s, { type: 'tick', dt: 100 });
  return s;
}

test('the same seed is the same evening (server and browser draw the same first frame)', () => {
  assert.deepEqual(initialState(7), initialState(7));
  assert.notDeepEqual(buildEvening(7).tickets, buildEvening(8).tickets);
  const codes = buildEvening(7).tickets.map((t) => t.code);
  assert.equal(new Set(codes).size, codes.length, 'ticket codes are unique');
});

test('the first look is already busy: people in, a line at the doors, posts on the wall', () => {
  const s = initialState(7);
  const n = snapshot(s);
  assert.equal(s.t, FIRST_LOOK);
  assert.ok(n.checkedIn > 50);
  assert.ok(n.queue.A + n.queue.B > 0);
  assert.ok(s.feed.length > 0 && s.wall.length > 0);
});

test('at 20× the whole night plays out in under two minutes and stays within bounds', () => {
  let s = initialState(11);
  s = reduce(s, { type: 'speed', speed: 20 });
  let ms = 0;
  let prevIn = 0;
  let maxQueue = 0;
  const seenActs = new Set<number>();
  while (s.t < END) {
    s = reduce(s, { type: 'tick', dt: 100 });
    ms += 100;
    const n = snapshot(s);
    assert.ok(n.checkedIn >= prevIn, 'check-ins never go down');
    assert.ok(n.checkedIn <= n.soldTotal && n.soldTotal <= CAPACITY, 'never more in than sold, never more sold than capacity');
    assert.ok(s.feed.length <= FEED_CAP && s.wall.length <= WALL_CAP, 'ticker and wall stay capped');
    maxQueue = Math.max(maxQueue, n.queue.A, n.queue.B);
    if (n.onStage >= 0) seenActs.add(n.onStage);
    prevIn = n.checkedIn;
    assert.ok(ms < 120_000, 'the night ends');
  }
  const end = snapshot(s);
  assert.equal(seenActs.size, PROGRAMME.length, 'every act gets its turn on stage');
  assert.ok(maxQueue >= 20, 'the doors get a real queue at some point');
  assert.equal(end.queue.A + end.queue.B, 0, 'and it clears');
  assert.ok(end.checkedIn > end.soldTotal * 0.9, 'most ticket holders turn up');
  assert.ok(end.checkedIn < end.soldTotal, 'and a few do not');
  assert.ok(end.dups > 0, 'someone tries a screenshot twice');
  assert.equal(end.bins.reduce((a, b) => a + b, 0) <= end.checkedIn, true);
  // The end is a resting state.
  assert.deepEqual(reduce(s, { type: 'tick', dt: 100 }), s);
});

test('pause freezes the clock, speed resumes it, restart goes back to the first look', () => {
  let s = initialState(3);
  s = reduce(s, { type: 'pause' });
  assert.equal(reduce(s, { type: 'tick', dt: 1000 }).t, s.t);
  s = runAt(s, 1, 1000); // picking a speed plays again
  assert.ok(s.t > FIRST_LOOK && s.t < FIRST_LOOK + 20);
  const r = reduce(s, { type: 'restart', seed: 99 });
  assert.equal(r.t, FIRST_LOOK);
  assert.equal(r.scans.length, 0);
});

test('a scanned ticket gets in once; the same one again is a warning, not a second entry', () => {
  let s = initialState(5);
  const before = snapshot(s).checkedIn;
  const next = nextAtDoor(s);
  assert.notEqual(next, null);
  s = reduce(s, { type: 'scan' });
  assert.equal(snapshot(s).checkedIn, before + 1);
  assert.equal(s.last, next);
  const dupsBefore = snapshot(s).dups;
  s = reduce(s, { type: 'rescan' });
  assert.equal(snapshot(s).checkedIn, before + 1, 'no second entry');
  assert.equal(snapshot(s).dups, dupsBefore + 1);
  const last = s.feed[s.feed.length - 1];
  assert.equal(last.kind, 'dup');
  // Later, that ticket's own planned arrival does not count it again.
  s = runAt(s, 20, 120_000);
  const n = snapshot(s);
  assert.ok(n.checkedIn <= n.soldTotal);
  assert.ok(!s.feed.some((f) => f.kind === 'in' && !f.mine && f.code === s.ev.tickets[next!].code));
});

test('scanning every last ticket holder ends with "everyone is in", never past the tickets sold', () => {
  let s = runAt(initialState(5), 20, 120_000);
  for (let i = 0; i < 80; i++) s = reduce(s, { type: 'scan' });
  const n = snapshot(s);
  assert.equal(n.checkedIn, n.soldTotal);
  assert.equal(s.feed[s.feed.length - 1].kind, 'none');
});

test('shout-outs about an act never appear before it', () => {
  const ev = buildEvening(7);
  for (const e of ev.events) if (e.kind === 'shout') assert.ok((SHOUTS[e.s].after ?? 0) <= e.at);
});

test('the shout-out wall keeps the hall screen friendly', () => {
  assert.deepEqual(checkShout('  Happy   Tihar! '), { ok: true, text: 'Happy Tihar!' });
  assert.equal(checkShout('शुभ दीपावली 🪔').ok, true);
  assert.equal(checkShout('A grand idea, who reads this?').ok, true, 'no false alarms inside innocent words');
  assert.equal(checkShout('Computing students say hi').ok, true);
  for (const bad of ['what the fuck', 'F u c k this', 'bullshit', 'sh1t show', 'muji', 'तँ मुजी']) {
    assert.deepEqual(checkShout(bad), { ok: false, reason: 'rude' }, bad);
  }
  assert.deepEqual(checkShout('   '), { ok: false, reason: 'empty' });
  assert.deepEqual(checkShout('x'.repeat(91)), { ok: false, reason: 'long' });
  assert.deepEqual(checkShout('visit www.example.com'), { ok: false, reason: 'link' });
  let s = initialState(1);
  for (let i = 0; i < 40; i++) s = reduce(s, { type: 'shout', name: 'Me', text: `hi ${i}`, lang: 'en' });
  assert.equal(s.wall.length, WALL_CAP);
  assert.equal(s.wall[s.wall.length - 1].text, 'hi 39');
});
