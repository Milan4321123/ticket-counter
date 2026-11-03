// The quiz as a pure state machine: one reducer that the page ticks ten times a
// second. Everything in the room — the other players joining, when they answer
// and whether they get it right — is decided here from a seed, so the same seed
// plays the same game and nothing has to talk to a server.
//
// Time is GAME time (t, in ms): it only runs while the game is not paused, so
// Pause freezes the countdown, the simulated players and the auto-advance alike.

import { BOTS, MY_HUE, QUESTIONS } from './content';

export type Phase = 'lobby' | 'ready' | 'question' | 'reveal' | 'board' | 'podium';

export const READY_MS = 2600;
export const QUESTION_MS = 15000;
export const REVEAL_MS = 5200;
export const BOARD_MS = 5600;
/** Leaderboard: rows hold their old places this long, then slide. */
export const BOARD_SLIDE_AT = 700;
export const YOU = 'you';

export type Answer = { choice: number; ms: number };

export type Player = {
  id: string;
  name: string;
  avatar: string;
  hue: number;
  bot: boolean;
  skill: number;
  /** Lobby time at which a simulated player walks in. */
  joinAt: number;
  joined: boolean;
  score: number;
  prevScore: number;
  /** 0-based place now and before the last question. */
  rank: number;
  prevRank: number;
  /** Points from the last question (0 when wrong or silent). */
  gain: number;
};

export type QuizState = {
  phase: Phase;
  /** Current question index. */
  q: number;
  /** Game clock and the moment the current phase began. */
  t: number;
  at: number;
  paused: boolean;
  seed: number;
  room: string;
  players: Player[];
  /** Answers to the current question, by player id. */
  answers: Record<string, Answer>;
  /** When each simulated player will answer this question (null = never). */
  plans: Record<string, Answer | null>;
};

export type QuizAction =
  | { type: 'tick'; dt: number }
  | { type: 'join'; name: string; avatar: string }
  | { type: 'start'; guestName: string }
  | { type: 'answer'; choice: number }
  | { type: 'next' }
  | { type: 'pause' }
  | { type: 'restart'; seed: number; keepYou?: boolean };

/** A small deterministic hash → [0, 1): the same seed and keys always give the same number. */
export function rand(seed: number, ...keys: number[]): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const k of keys) {
    h = Math.imul(h ^ (k + 0x7f4a7c15), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

export function roomCode(seed: number): string {
  const n = 100000 + Math.floor(rand(seed, 991) * 900000);
  const s = String(n);
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}

/** Points for a right answer: 1000 for an instant one, sliding to 500 at the buzzer. */
export function points(ms: number): number {
  const f = Math.min(1, Math.max(0, ms / QUESTION_MS));
  return Math.round(1000 - 500 * f);
}

function bots(seed: number): Player[] {
  return BOTS.map((b, i) => ({
    id: b.id,
    name: b.name,
    avatar: b.avatar,
    hue: b.hue,
    bot: true,
    skill: b.skill,
    joinAt: 900 + i * 1050 + Math.floor(rand(seed, i, 7) * 500),
    joined: false,
    score: 0,
    prevScore: 0,
    rank: i + 1,
    prevRank: i + 1,
    gain: 0,
  }));
}

function makeYou(name: string, avatar: string): Player {
  return {
    id: YOU,
    name,
    avatar,
    hue: MY_HUE,
    bot: false,
    skill: 1,
    joinAt: 0,
    joined: true,
    score: 0,
    prevScore: 0,
    rank: 0,
    prevRank: 0,
    gain: 0,
  };
}

export function initialState(seed = 20261103, you?: Player | null): QuizState {
  const room = bots(seed);
  const players = you ? [{ ...makeYou(you.name, you.avatar) }, ...room] : room;
  players.forEach((p, i) => {
    p.rank = i;
    p.prevRank = i;
  });
  return { phase: 'lobby', q: 0, t: 0, at: 0, paused: false, seed, room: roomCode(seed), players, answers: {}, plans: {} };
}

export const elapsed = (s: QuizState) => s.t - s.at;
export const me = (s: QuizState) => s.players.find((p) => p.id === YOU) ?? null;
export const joinedPlayers = (s: QuizState) => s.players.filter((p) => p.joined);

/** When and what each simulated player answers: good players are quicker and right more often. */
function plan(s: QuizState): Record<string, Answer | null> {
  const qn = QUESTIONS[s.q];
  const out: Record<string, Answer | null> = {};
  s.players.forEach((p, i) => {
    if (!p.bot) return;
    const r = (k: number) => rand(s.seed, s.q, i, k);
    if (r(1) < 0.05) {
      out[p.id] = null; // stared at the momos and missed it
      return;
    }
    const pRight = Math.min(0.95, Math.max(0.12, p.skill - qn.difficulty * 0.45 + 0.12));
    const right = r(2) < pRight;
    let choice = qn.correct;
    if (!right) {
      const wrong = [0, 1, 2, 3].filter((c) => c !== qn.correct);
      choice = wrong[Math.floor(r(3) * wrong.length)];
    }
    const spread = 12000 * (1.2 - p.skill) + qn.difficulty * 4500;
    const ms = Math.round(2000 + Math.pow(r(4), 1.15) * spread);
    out[p.id] = { choice, ms: Math.min(QUESTION_MS - 300, ms) };
  });
  return out;
}

function ranked(players: Player[]): Player[] {
  // Ties keep the old order, so nobody jumps for nothing.
  const order = [...players].sort((a, b) => b.score - a.score || a.rank - b.rank);
  const place = new Map(order.map((p, i) => [p.id, i]));
  return players.map((p) => ({ ...p, prevRank: p.rank, rank: place.get(p.id) ?? p.rank }));
}

function score(s: QuizState): Player[] {
  const right = QUESTIONS[s.q].correct;
  const scored = s.players.map((p) => {
    const a = s.answers[p.id];
    const gain = p.joined && a && a.choice === right ? points(a.ms) : 0;
    return { ...p, prevScore: p.score, score: p.score + gain, gain };
  });
  return ranked(scored);
}

function enter(s: QuizState, phase: Phase): QuizState {
  const next: QuizState = { ...s, phase, at: s.t };
  if (phase === 'question') {
    next.answers = {};
    next.plans = plan(next);
  }
  if (phase === 'reveal') next.players = score(s);
  return next;
}

function advance(s: QuizState): QuizState {
  switch (s.phase) {
    case 'lobby':
      return s;
    case 'ready':
      return enter(s, 'question');
    case 'question':
      return enter(s, 'reveal');
    case 'reveal':
      return enter(s, 'board');
    case 'board':
      return s.q + 1 < QUESTIONS.length ? enter({ ...s, q: s.q + 1 }, 'ready') : enter(s, 'podium');
    case 'podium':
      return s;
  }
}

function everyoneAnswered(s: QuizState): number | null {
  let last = 0;
  for (const p of s.players) {
    if (!p.joined) continue;
    const a = s.answers[p.id];
    if (a) last = Math.max(last, a.ms);
    else if (p.bot && s.plans[p.id] === null) continue;
    else return null;
  }
  return last;
}

function tick(s0: QuizState, dt: number): QuizState {
  if (s0.paused || s0.phase === 'podium') return s0;
  let s: QuizState = { ...s0, t: s0.t + dt };
  const e = elapsed(s);

  switch (s.phase) {
    case 'lobby': {
      if (s.players.some((p) => p.bot && !p.joined && p.joinAt <= e)) {
        s.players = s.players.map((p) => (p.bot && !p.joined && p.joinAt <= e ? { ...p, joined: true } : p));
      }
      return s;
    }
    case 'ready':
      return e >= READY_MS ? advance(s) : s;
    case 'question': {
      let answers = s.answers;
      for (const [id, a] of Object.entries(s.plans)) {
        if (a && a.ms <= e && !answers[id]) answers = { ...answers, [id]: a };
      }
      if (answers !== s.answers) s = { ...s, answers };
      const last = everyoneAnswered(s);
      if (e >= QUESTION_MS || (last !== null && e >= last + 700)) return advance(s);
      return s;
    }
    case 'reveal':
      return e >= REVEAL_MS ? advance(s) : s;
    case 'board':
      return e >= BOARD_MS ? advance(s) : s;
  }
  return s;
}

export function reduce(s: QuizState, a: QuizAction): QuizState {
  switch (a.type) {
    case 'tick':
      return tick(s, a.dt);
    case 'join': {
      if (s.phase !== 'lobby') return s;
      const you = makeYou(a.name, a.avatar);
      const others = s.players.filter((p) => p.id !== YOU);
      const players = [you, ...others].map((p, i) => ({ ...p, rank: i, prevRank: i }));
      return { ...s, players };
    }
    case 'start': {
      if (s.phase !== 'lobby') return s;
      let players = s.players.map((p) => ({ ...p, joined: true }));
      if (!players.some((p) => p.id === YOU)) players = [makeYou(a.guestName, '🐯'), ...players];
      players = players.map((p, i) => ({ ...p, rank: i, prevRank: i, score: 0, prevScore: 0, gain: 0 }));
      return enter({ ...s, players, q: 0, paused: false }, 'ready');
    }
    case 'answer': {
      if (s.phase !== 'question' || s.paused || s.answers[YOU] || !me(s)) return s;
      const ms = Math.min(QUESTION_MS, elapsed(s));
      return { ...s, answers: { ...s.answers, [YOU]: { choice: a.choice, ms } } };
    }
    case 'next':
      if (s.phase === 'lobby') return s;
      return advance({ ...s, paused: false });
    case 'pause':
      if (s.phase === 'lobby' || s.phase === 'podium') return s;
      return { ...s, paused: !s.paused };
    case 'restart': {
      const you = a.keepYou === false ? null : me(s);
      return initialState(a.seed, you);
    }
  }
}
