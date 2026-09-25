// node synth.mjs restaurant → out/restaurant/audio.wav
// Same soundtrack as the pitch video (tools/pitch-video/synth.mjs), plus a
// soft bell at the start of every chapter and the kitchen's two-note chime
// when a new order lands.
//
// The pitch video's soundtrack, made from scratch (no licensed music):
// a warm four-chord loop (C – G – Am – F, 100 bpm) with pad, bass, a soft
// beat, a plucked arpeggio, plus a tap sound on every finger tap and a soft
// whoosh on every screen change. Writes audio.wav (44.1 kHz, stereo, 16-bit).
import fs from 'node:fs';

const SR = 44100;
const ID = process.argv[2];
const DIR = new URL(`./out/${ID}/`, import.meta.url);
const TL = JSON.parse(fs.readFileSync(new URL('timeline.json', DIR), 'utf8'));
const DUR = TL.TOTAL;
const N = Math.ceil(DUR * SR);
const L = new Float32Array(N), R = new Float32Array(N);

const BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4;
const OUTRO_AT = TL.TOTAL - TL.OUTRO;
const MUSIC_START = 0.0, DRUMS_START = TL.INTRO - 0.5, DRUMS_END = OUTRO_AT, OUTRO = OUTRO_AT;
const TAPS = TL.taps.map((x) => x.t);
const CUTS = [TL.INTRO - 0.5, ...TL.navs, ...(TL.sceneCut ? [TL.sceneCut - 0.5, TL.sceneCut] : []), OUTRO_AT - 0.2];
const THINK = TL.caps.find((c) => c.until);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
// C, G, Am, F — as MIDI chords (pad voicing) and bass roots.
const CHORDS = [
  { pad: [60, 64, 67, 72], bass: 36 },
  { pad: [59, 62, 67, 71], bass: 43 },
  { pad: [57, 60, 64, 69], bass: 45 },
  { pad: [57, 60, 65, 69], bass: 41 },
];

function add(t0, len, fn, pan = 0, gain = 1) {
  const s0 = Math.max(0, Math.floor(t0 * SR)), s1 = Math.min(N, Math.floor((t0 + len) * SR));
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2;
  const gr = gain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
  for (let i = s0; i < s1; i++) {
    const v = fn((i - s0) / SR, i / SR);
    L[i] += v * gl;
    R[i] += v * gr;
  }
}
const env = (t, a, len, rel) => (t < a ? t / a : t > len - rel ? Math.max(0, (len - t) / rel) : 1);
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

// ---- Pad: soft detuned sines + a little triangle, one chord per bar ----
for (let bar = 0; bar * BAR < DUR; bar++) {
  const t0 = MUSIC_START + bar * BAR;
  // The outro holds the home chord (C) to the end.
  const ch = t0 >= OUTRO - 0.01 ? CHORDS[0] : CHORDS[bar % 4];
  const len = t0 >= OUTRO - 0.01 ? DUR - t0 : BAR + 0.3;
  ch.pad.forEach((m, k) => {
    const f = midi(m);
    add(t0, len, (t) => {
      const e = env(t, 0.35, len, 0.6);
      const tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t));
      return e * (0.5 * Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 1.004 * t) + 0.12 * tri);
    }, (k - 1.5) * 0.35, 0.028);
  });
  if (t0 >= OUTRO - 0.01) break;
}

// ---- Bass: root on beats 1 and 3 ----
for (let t = DRUMS_START; t < DRUMS_END; t += BEAT * 2) {
  const bar = Math.floor((t - MUSIC_START) / BAR);
  const f = midi(CHORDS[bar % 4].bass);
  add(t, BEAT * 1.8, (x) => Math.exp(-x * 2.2) * Math.min(1, x / 0.01) * (Math.sin(2 * Math.PI * f * x) + 0.25 * Math.sin(4 * Math.PI * f * x)), 0, 0.16);
}

// ---- Drums: kick on every beat, hat on the off-beats, clap on 2 and 4 ----
for (let b = 0, t = DRUMS_START; t < DRUMS_END; b++, t += BEAT) {
  add(t, 0.32, (x) => {
    const f = 50 + 90 * Math.exp(-x * 30);
    return Math.exp(-x * 11) * Math.sin(2 * Math.PI * f * x * (1 + 0.5 * Math.exp(-x * 30)));
  }, 0, 0.24);
  let hp = 0, last = 0;
  add(t + BEAT / 2, 0.06, (x) => {
    const n = noise();
    hp = 0.92 * (hp + n - last); last = n;
    return Math.exp(-x * 70) * hp;
  }, 0.3, 0.05);
  if (b % 2 === 1) {
    add(t, 0.15, (x) => Math.exp(-x * 28) * noise() * (1 + 0.6 * Math.sin(2 * Math.PI * 1200 * x)), -0.2, 0.05);
  }
}

// ---- Pluck arpeggio: chord tones an octave up, 8th notes ----
for (let k = 0, t = 3.6; t < DRUMS_END; k++, t += BEAT / 2) {
  const bar = Math.floor((t - MUSIC_START) / BAR);
  const tones = CHORDS[bar % 4].pad;
  const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
  const f = midi(tones[pattern[k % 8]] + 12);
  add(t, 0.5, (x) => Math.exp(-x * 7) * (Math.sin(2 * Math.PI * f * x) + 0.35 * Math.sin(4 * Math.PI * f * x) * Math.exp(-x * 12)), (k % 2 ? 0.4 : -0.4), 0.045);
}

// ---- Taps: a soft "tick" + a low pop ----
for (const t of TAPS) {
  add(t - 0.01, 0.12, (x) => Math.exp(-x * 60) * Math.sin(2 * Math.PI * 1900 * x) + 0.8 * Math.exp(-x * 35) * Math.sin(2 * Math.PI * 320 * x), 0.15, 0.22);
}

// ---- Whoosh on each screen change: noise swelling and falling ----
for (const t of CUTS) {
  let lp = 0;
  add(t - 0.12, 0.45, (x) => {
    const k = 0.05 + 0.5 * Math.sin(Math.PI * Math.min(1, x / 0.45));
    lp += k * (noise() - lp);
    return Math.sin(Math.PI * Math.min(1, x / 0.45)) * lp;
  }, (Math.random() - 0.5) * 0.6, 0.11);
}

// ---- The AI thinking: a quiet rising sparkle ----
if (THINK) {
  const len = THINK.until - THINK.t;
  const notes = [84, 88, 91, 96, 91, 88, 93, 96, 100];
  notes.forEach((m, k) => {
    const f = midi(m);
    add(THINK.t + (k * len) / notes.length, 0.35, (x) => Math.exp(-x * 9) * Math.sin(2 * Math.PI * f * x), k % 2 ? 0.5 : -0.5, 0.05);
  });
}

// ---- A soft bell at every chapter; the order chime when an order lands ----
for (const c of TL.chapters ?? []) {
  const notes = /order|bestell/i.test(c.id + c.kicker) && c.id !== 'order' ? [88, 93] : [91];
  notes.forEach((m, k) => {
    const f = midi(m);
    add(c.start + k * 0.18, 1.2, (x) => Math.exp(-x * 4) * (Math.sin(2 * Math.PI * f * x) + 0.3 * Math.sin(2 * Math.PI * f * 2.01 * x) * Math.exp(-x * 6)), 0.2, notes.length > 1 ? 0.09 : 0.05);
  });
}

// ---- Master: fade in/out and a soft limiter ----
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.8) * Math.min(1, (DUR - t) / 2.5);
  const l = Math.tanh(L[i] * 1.4) * fade * 0.9, r = Math.tanh(R[i] * 1.4) * fade * 0.9;
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
fs.writeFileSync(new URL('audio.wav', DIR), buf);
console.log('audio.wav', DUR, 's');
