// node synth.mjs → out/audio.wav
//
// The Datenschutz ad's soundtrack, synthesized (no licensed music) with the
// shared kit from tools/ad-videos. Calm-confident rather than hype — this ad
// is about trust: D major at 120 bpm, I – V – vi – IV.
//
//   0–4    hook: soft pad, plucks, rimshots; a tick under each word
//   4–8    logo: half-time kick and bass come in; the DSGVO stamp lands on 6.0
//          with an impact and a bell chord
//   8–32   the eight items: full four-on-the-floor groove; every tick is a bell
//          one step higher up the scale, so the list sounds like it is
//          climbing to done
//   31–32  a bar of breath and a riser into the recap
//   32–37  recap: eight quick pitched pops, then a bright chord on "8/8"
//   37–44  outro: lighter groove, final hit under the logo, a ringing chord
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createKit } from '../ad-videos/kit.mjs';

const require = createRequire(import.meta.url);
const SPEC = require('./spec.js');
const { T, TOTAL, BPM } = SPEC;

const CH = [
  { pad: [62, 66, 69, 74], bass: 38 }, // D
  { pad: [61, 64, 69, 73], bass: 45 }, // A
  { pad: [59, 62, 66, 71], bass: 47 }, // Bm
  { pad: [59, 62, 67, 71], bass: 43 }, // G
];
const K = createKit({ DUR: TOTAL, BPM, G0: 0, chords: CH });
const { B, beat } = K;
const SCALE = [74, 76, 78, 79, 81, 83, 85, 86]; // D major, one step per tick

const kicks = [];
const breathFrom = T.recap - 1, breathTo = T.recap;
const endHit = T.end - 2.2;
const nb = Math.floor(TOTAL / B);
for (let b = 0; b < nb; b++) {
  const t = beat(b), inBar = b % 4, n = Math.floor(b / 4), ch = CH[n % 4];
  if (t >= endHit - 0.01) break;
  const hook = t < T.logo, logo = t >= T.logo && t < T.items, items = t >= T.items && t < T.recap;
  const recap = t >= T.recap && t < T.outro, outro = t >= T.outro;
  const breath = t >= breathFrom && t < breathTo;
  const bright = items || recap;
  // Pad: one chord a bar, opening up once the list starts.
  if (inBar === 0) {
    K.saw(t, ch.pad[0], B * 4, { g: 0.32, cut: bright ? 2400 : 1200, att: 0.2, rel: 0.3, voices: 3, send: 0.5, pan: -0.35 });
    for (const m of ch.pad.slice(1)) K.saw(t, m, B * 4, { g: 0.24, cut: bright ? 2400 : 1200, att: 0.2, rel: 0.3, voices: 2, send: 0.5, pan: 0.3 });
  }
  // Plucks: 8ths under the hook and outro, 16ths through the list.
  const steps = bright ? 4 : 2, pat = [0, 2, 1, 3, 2, 1, 3, 2];
  for (let k = 0; k < steps; k++) K.pluck(t + (k * B) / steps, ch.pad[pat[(inBar * steps + k) % 8]] + 12, bright ? 0.7 : 0.85, k % 2 ? 0.45 : -0.45);
  if (hook) { if (inBar === 1 || inBar === 3) K.rim(t, 0.8); continue; }
  if (breath) continue;
  if (logo) {
    if (inBar === 0 || inBar === 2) { K.kick(t, 0.85); kicks.push(t); }
    if (inBar === 2) K.clap(t, 0.6);
    K.bass(t + B / 2, ch.bass, B * 0.42, 0.7);
    continue;
  }
  K.kick(t, bright ? 1.0 : 0.8); kicks.push(t);
  if ((inBar === 1 || inBar === 3) && !outro) K.clap(t, bright ? 0.9 : 0.6);
  K.hat(t + B / 2, bright, bright ? 0.75 : 0.55, 0.25);
  if (bright) for (let k = 0; k < 4; k++) K.shaker(t + (k * B) / 4, k === 2 ? 0.8 : 0.4);
  K.bass(t + B / 2, ch.bass, B * 0.42, bright ? 1 : 0.8);
  if (bright) K.bass(t + B * 0.75, ch.bass + 12, B * 0.2, 0.4);
}

// Big moments.
K.riser(T.logo - 1.0, 1.0, 0.6);
K.riser(breathFrom, 1.0, 0.9);
K.riser(T.outro - 1.0, 1.0, 0.5);
K.impact(endHit, 1.1); K.kick(endHit, 1.2); kicks.push(endHit);
for (const m of CH[0].pad) K.saw(endHit, m, TOTAL - endHit, { g: 0.3, cut: 2200, voices: 3, att: 0.01, rel: 1.2, send: 0.7 });
K.fm(endHit, 86, 1.8, { g: 0.55, ratio: 3.5, index: 2, decay: 2.5, send: 0.6 });

const bell = (t, m, g = 0.55) => K.fm(t, m, 1.2, { g, ratio: 3.5, index: 1.6, decay: 4.5, send: 0.45 });
const tick = (t, i) => K.add(K.FX, t, 0.05, (x) => Math.sin(K.TAU * (2400 + (i % 4) * 160) * x) * Math.exp(-x * 90), ((i % 3) - 1) * 0.3, 0.05);
for (const c of SPEC.cues()) {
  if (c.kind === 'word') tick(c.t, Math.round(c.t * 10));
  else if (c.kind === 'whoosh') K.whoosh(c.t, 0.8);
  else if (c.kind === 'pop') { K.pop(c.t, c.i); if (c.t > T.recap) bell(c.t, SCALE[c.i % SCALE.length], 0.3); }
  else if (c.kind === 'stamp') { K.impact(c.t, 0.9); [74, 78, 81, 86].forEach((m, k) => bell(c.t + k * 0.04, m, 0.4)); }
  else if (c.kind === 'tick') { bell(c.t, SCALE[c.i]); bell(c.t + 0.09, SCALE[c.i] + 12, 0.25); K.chime(c.t + 0.02); }
  else if (c.kind === 'chord') { K.chime(c.t); [62, 66, 69, 74, 78].forEach((m, k) => bell(c.t + k * 0.05, m + 12, 0.35)); }
  else if (c.kind === 'hit') { /* the end hit is drawn above, with the final chord */ }
}

const dir = new URL('./out/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const r = K.mixdown(new URL('audio.wav', dir), { kicks, duckDepth: 0.45, verb: 0.22 });
console.log(`audio: peak ${r.peak.toFixed(2)} drive ${r.drive.toFixed(2)} → out/audio.wav`);
