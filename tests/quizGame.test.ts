/**
 * THE QUIZ DEMO PLAYS TO THE END.
 *
 * /work/quiz is a client-only game: one reducer ticked ten times a second. A
 * stuck phase there is a demo that silently stops in front of a visitor, so the
 * whole game is played here on the game clock alone — lobby, ten rounds,
 * podium, restart — and the rules a visitor would notice are pinned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from '../src/app/work/quiz/content.ts';
import { QUESTION_MS, YOU, initialState, me, points, reduce, type QuizState } from '../src/app/work/quiz/game.ts';

function run(s: QuizState, ms: number): QuizState {
  for (let t = 0; t < ms; t += 100) s = reduce(s, { type: 'tick', dt: 100 });
  return s;
}

test('every question has four answers in both languages and a valid right answer', () => {
  assert.ok(QUESTIONS.length >= 8 && QUESTIONS.length <= 10);
  for (const q of QUESTIONS) {
    assert.equal(q.en.a.length, 4);
    assert.equal(q.ne.a.length, 4);
    assert.ok(q.correct >= 0 && q.correct < 4);
    assert.ok(/[ऀ-ॿ]/.test(q.ne.q), 'the नेपाली question is in Devanagari');
  }
});

test('the simulated room walks in on its own and Start seats everyone', () => {
  let s = initialState(42);
  assert.equal(s.players.filter((p) => p.joined).length, 0);
  s = run(s, 4000);
  const early = s.players.filter((p) => p.joined).length;
  assert.ok(early > 0 && early < s.players.length);
  s = reduce(s, { type: 'join', name: 'Tester', avatar: '🐯' });
  s = reduce(s, { type: 'start', guestName: 'Guest' });
  assert.equal(s.phase, 'ready');
  assert.ok(s.players.every((p) => p.joined));
  assert.equal(me(s)?.name, 'Tester');
});

test('a whole game reaches the podium on the clock alone, and Restart goes back to the lobby', () => {
  let s = reduce(initialState(7), { type: 'start', guestName: 'Guest' });
  assert.equal(me(s)?.name, 'Guest', 'starting without joining seats the visitor as a guest');
  let rounds = 0;
  for (let guard = 0; guard < 4000 && s.phase !== 'podium'; guard++) {
    if (s.phase === 'question' && !s.answers[YOU]) {
      s = run(s, 2000);
      if (s.phase === 'question') {
        s = reduce(s, { type: 'answer', choice: QUESTIONS[s.q].correct });
        rounds++;
      }
    }
    s = run(s, 100);
  }
  assert.equal(s.phase, 'podium');
  assert.equal(rounds, QUESTIONS.length);
  const you = me(s)!;
  // Always right at ~2 s: near the top of the ten, and every round paid out.
  assert.ok(you.score >= QUESTIONS.length * points(2200));
  const bots = s.players.filter((p) => p.bot);
  assert.ok(bots.every((p) => Number.isFinite(p.score)), 'no NaN scores');
  assert.ok(bots.filter((p) => p.score > 0).length >= bots.length - 1, 'the simulated room answers, and gets some right');
  assert.ok(bots.every((p) => p.score < QUESTIONS.length * 1000), 'and nobody is perfect');
  const ranks = s.players.map((p) => p.rank).sort((a, b) => a - b);
  assert.deepEqual(ranks, s.players.map((_, i) => i), 'places are 0…n-1, no ties in the ranking');

  s = reduce(s, { type: 'restart', seed: 99 });
  assert.equal(s.phase, 'lobby');
  assert.equal(me(s)?.name, 'Guest', 'the visitor stays seated for the next round');
  assert.ok(s.players.every((p) => p.score === 0));
});

test('Pause freezes the countdown and Next skips ahead', () => {
  let s = reduce(initialState(3), { type: 'start', guestName: 'Guest' });
  s = reduce(s, { type: 'next' });
  assert.equal(s.phase, 'question');
  s = run(s, 1000);
  s = reduce(s, { type: 'pause' });
  const frozen = s.t;
  s = run(s, QUESTION_MS * 2);
  assert.equal(s.t, frozen);
  assert.equal(s.phase, 'question');
  s = reduce(s, { type: 'answer', choice: 0 });
  assert.equal(s.answers[YOU], undefined, 'no answering while paused');
  s = reduce(s, { type: 'pause' });
  s = reduce(s, { type: 'next' });
  assert.equal(s.phase, 'reveal');
});

test('the simulated players answer at believable times', () => {
  for (let seed = 1; seed < 40; seed++) {
    let s = reduce(initialState(seed), { type: 'start', guestName: 'Guest' });
    s = reduce(s, { type: 'next' });
    const plans = Object.values(s.plans);
    assert.equal(plans.length, 9);
    for (const a of plans) {
      if (!a) continue;
      assert.ok(Number.isFinite(a.ms) && a.ms >= 1500 && a.ms < QUESTION_MS, `answer at ${a.ms} ms`);
      assert.ok(a.choice >= 0 && a.choice < 4);
    }
    assert.ok(plans.filter(Boolean).length >= 6, 'most of the room answers');
  }
});

test('faster right answers score more; a wrong one scores nothing', () => {
  assert.equal(points(0), 1000);
  assert.equal(points(QUESTION_MS), 500);
  assert.ok(points(3000) > points(9000));
  let s = reduce(initialState(5), { type: 'start', guestName: 'Guest' });
  s = reduce(s, { type: 'next' });
  s = reduce(s, { type: 'answer', choice: (QUESTIONS[0].correct + 1) % 4 });
  s = reduce(s, { type: 'next' });
  assert.equal(me(s)?.gain, 0);
});
