// Bajagaja's walk-on sound (original, synthesized). Run: node synth.mjs bajagaja → out/bajagaja/audio.wav
//
// A band coming on, not an ad. A minor, 120 bpm, funk-rock. Lights down: the
// hall murmurs, a lone bass guitar walks the riff, the drummer clicks his
// sticks "1, 2, 3, 4!". Clap along: the kit kicks in, the whole hall claps on 2
// and 4, offbeat guitar chops and an organ join as the story goes from one man
// to a band. The roll call: each instrument gets one bar to itself — a guitar
// lick with a bend, a bass slide and slaps, an organ run, a drum fill — and the
// crowd cheers each one. 3 · 2 · 1 on full-band hits (F, G, E), then the lights:
// crash, boom, the groove with a sarangi line on top, and a last chord ringing
// under the cheering for the band to take over.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createKit } from '../ad-videos/kit.mjs';
import { crowdKit } from './crowd.mjs';

const require = createRequire(import.meta.url);
const id = 'bajagaja';
const A = require(`./${id}.js`);
const S = A.scenes, B = A.B, BAR = 4 * B, R = A.reveal.t, OUT = A.reveal.bandOut, END = A.TOTAL;
// Am – F – C – G, a chord a bar
const CH = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 60, 64, 67], [55, 59, 62, 67]];
const ROOT = [33, 29, 36, 31];
const K = createKit({ DUR: END, BPM: A.BPM, G0: 0, chords: CH.map((pad, i) => ({ pad, bass: ROOT[i] })) });
const C = crowdKit(K);
const kicks = [];
const kick = (t, g = 1) => { K.kick(t, g); kicks.push(t); };
const ramp = (t, a, b, v0, v1) => (t <= a ? v0 : t >= b ? v1 : v0 + (v1 - v0) * (t - a) / (b - a));
const barOf = (t) => Math.floor(t / BAR + 1e-6);
// the bass riff, one bar: [beat, semitones over the chord root, length in beats]
const RIFF = [[0, 0, 0.75], [1, 0, 0.4], [1.5, 3, 0.4], [2, 5, 0.75], [3, 7, 0.4], [3.5, 10, 0.4]];
const riffBar = (t0, root, g = 1) => { for (const [b, st, l] of RIFF) C.bassGtr(t0 + b * B, root + st, l * B, { g }); };

// ---------------- the hall ----------------
const countT = A.count.map((c) => c.t), rollT = A.roll.map((r) => r.t);
const spike = (t, list, v0, k = 0.4) => { let v = v0; for (const c of list) { const d = t - c; if (d >= 0.1 && d < 1) v = Math.max(v, v0 + 0.25 - (d - 0.1) * k); } return v; };
C.hall(0, END, (t) => {
  if (t < S.clap[0]) return 0.42;
  if (t < S.roll[0]) return ramp(t, S.clap[0], S.roll[0], 0.45, 0.6);
  if (t < S.count[0]) return spike(t, rollT, ramp(t, S.roll[0], S.count[0], 0.6, 0.72));
  if (t < R) return spike(t, countT, 0.75, 0.3);
  return Math.max(0.55, ramp(t, R, END - 0.4, 1.0, 0.6)) * Math.min(1, (END - t) / 0.4);
}, 1.0);
C.applause(0.3, S.clap[0] - 0.3, () => 5, 0.7);
C.applause(S.roll[0], S.count[0] - S.roll[0], () => 60, 0.6);
C.applause(S.count[0], R - S.count[0], () => 160, 0.7);
C.applause(R, END - R - 0.3, (t) => ramp(t, R, END, 450, 200), 0.6);
for (const t of [0.8, 2.2]) C.voice(t, 0.9, 400, 540, 'oo', t > 1 ? 0.6 : -0.6, 0.7);
for (let t = S.clap[0]; t < S.roll[0]; t += 1.1) C.cheer(t, 0.9, 2, 0.6);
rollT.forEach((t) => C.cheer(t + 0.35, 0.7, 12, 0.85));
C.cheer(R, 3.2, 50, 1.0);
C.cheer(R + 3, END - R - 3.3, 24, 0.8);

// ---------------- 1 · lights down, sticks count in ----------------
riffBar(0, ROOT[0], 0.9); riffBar(BAR, ROOT[0], 0.95);
CH[0].forEach((m, k) => K.saw(0, m - 12, S.clap[0], { g: 0.32, cut: 450, att: 1.2, rel: 0.2, voices: 3, send: 0.6, pan: (k - 1.5) * 0.4 }));
A.sticks.forEach((t, i) => C.sticks(t, 1.2 + (i === 3 ? 0.3 : 0)));
for (let t = 0; t < A.sticks[0] - 1e-6; t += B) K.hat(t, false, 0.5);

// ---------------- 2 · clap on 2 & 4 ----------------
for (let t = S.clap[0]; t < S.roll[0] - 1e-6; t += B) {
  const b = Math.round((t - S.clap[0]) / B), inBar = b % 4, ci = barOf(t) % 4;
  kick(t, 1.0);
  K.hat(t + B / 2, t >= A.clap.lines[1].t, 0.85);
  if (inBar === 0) riffBar(t, ROOT[ci]);
  // offbeat guitar chops from the first story line, organ from the second
  if (t >= A.clap.lines[0].t) C.power(t + B / 2, ROOT[ci] + 12, B * 0.35, { g: 0.6, mute: true });
  if (t >= A.clap.lines[1].t && inBar === 0) C.organ(t, CH[ci], BAR - 0.02, { g: 0.9 });
  if (t >= A.clap.lines[2].t) for (let k = 0; k < 4; k++) K.shaker(t + (k * B) / 4, k === 2 ? 0.8 : 0.4);
}
A.claps.forEach((t, i) => {
  C.crowdClap(t, Math.round(28 + i * 6), 1.9 + i * 0.06);
  K.clap(t, 1.7); K.snare(t, { g: 1.1 });
});
for (let k = 0; k < 4; k++) K.snare(S.roll[0] - B + k * B / 4, { g: 0.6 + k * 0.15 });

// ---------------- 3 · baja 01–04 ----------------
for (let t = S.roll[0]; t < S.count[0] - 1e-6; t += B) { kick(t, 0.7); K.hat(t + B / 2, false, 0.6); }
{ // GUITAR: a run up the A minor pentatonic, then a bend into the top A
  const t0 = A.roll[0].t, run = [69, 72, 74, 76, 79];
  run.forEach((m, i) => C.lead(t0 + i * B / 4, m, B / 4 - 0.01, { g: 1.7 }));
  C.lead(t0 + 5 * B / 4, 81, 2 * B - 5 * B / 4 + 0.35, { g: 1.9, from: 2, vib: 1.6 });
  C.crash(t0, 0.7, 1.4);
}
{ // BASS: a slide down into the low A, then slaps
  const t0 = A.roll[1].t;
  C.bassGtr(t0, 45, B, { g: 1.9, slideTo: 33 });
  [33, 45, 33, 45].forEach((m, i) => C.bassGtr(t0 + B + i * B / 4, m, B / 4 - 0.02, { g: 1.8 }));
  K.sub808(t0 + B * 0.9, 33, 0.6, { g: 0.7 });
}
{ // KEYS: an organ run up two octaves, then the chord
  const t0 = A.roll[2].t, arp = [57, 60, 64, 69, 72, 76, 81, 84];
  arp.forEach((m, i) => C.organ(t0 + i * B / 8, [m], B / 8 + 0.04, { g: 2.4 }));
  C.organ(t0 + B, [57, 64, 69, 72, 76], B - 0.03, { g: 1.9 });
  K.rhodes(t0 + B, 69, B, { g: 0.6 });
}
{ // DRUMS: a fill around the kit into the count
  const t0 = A.roll[3].t;
  for (let k = 0; k < 4; k++) K.snare(t0 + k * B / 4, { g: 1.3 + k * 0.1 });
  [180, 150, 120, 95].forEach((f, k) => { K.tom(t0 + B + k * B / 4, f, 1.8, -0.5 + k * 0.33); K.tom(t0 + B + k * B / 4 + B / 8, f * 0.95, 1.4, -0.5 + k * 0.33); });
  C.crash(t0, 0.6, 1.0);
}

// ---------------- 4 · 3 · 2 · 1 ----------------
const HIT = [41, 43, 40];                            // F – G – E: the last one pulls into A minor
countT.forEach((t, i) => {
  K.impact(t, 1.0 + i * 0.12); kick(t, 1.2);
  K.sub808(t, 29 + [0, 2, -1][i], 0.9, { g: 1.0, from: 41 });
  C.crash(t, 0.7 + i * 0.1, 1.2);
  C.shout(t + 0.03, 30, 1.1, ['ee', 'oo', 'ah'][i]);
  C.power(t, HIT[i], 2 * B - 0.05, { g: 1.0 });
  C.organ(t, [HIT[i] + 12, HIT[i] + 19, HIT[i] + 24], 2 * B - 0.05, { g: 1.0 });
  K.snare(t + B, { g: 0.7 + i * 0.15 }); K.snare(t + B * 1.5, { g: 0.8 + i * 0.15 });
});
for (let k = 0; k < 8; k++) K.snare(R - B + k * B / 8, { g: 0.6 + k * 0.08 });
K.riser(countT[2] - 0.2, R - countT[2] + 0.2, 1.2);

// ---------------- 5 · lights on ----------------
K.impact(R, 1.45); kick(R, 1.35);
K.sub808(R, 33, 2.0, { g: 1.25, from: 45, glide: 0.1 });
C.crash(R, 1.3, 3.0);
const GTR = [[0, 0, 1], [1.5, 3, 0.5], [2, 5, 1], [3.5, 7, 0.5], [4, 0, 1], [5, 3, 1]];   // A5 C5 D5 E5 riff
for (const [b, st, l] of GTR) C.power(R + b * B, 45 + st, l * B - 0.03, { g: 1.1 });
for (let b = 0; b < 6; b++) {
  const t = R + b * B;
  kick(t, b % 2 === 0 ? 1.2 : 0.75); if (b % 2 === 0) kick(t + B * 0.75, 0.7);
  if (b % 2 === 1) K.snare(t, { g: 1.15, gated: true });
  K.hat(t, false, 0.8); K.hat(t + B / 2, true, 0.8);
  for (let k = 0; k < 4; k++) K.shaker(t + (k * B) / 4, k === 2 ? 0.8 : 0.4);
}
riffBar(R, ROOT[0], 1.1); for (const [b, st, l] of RIFF.filter(([b]) => b < 2)) C.bassGtr(R + BAR + b * B, ROOT[1] + st, l * B, { g: 1.1 });
C.organ(R, CH[0].map((m) => m + 12), BAR - 0.02, { g: 0.9 }); C.organ(R + BAR, CH[1].map((m) => m + 12), OUT - R - BAR, { g: 0.9 });
// the sarangi line over the groove
for (const [o, m, l, from] of [[0, 81, 1, 79], [1, 84, 0.5], [1.5, 86, 0.5], [2, 88, 1.5, 86], [3.5, 86, 0.5], [4, 84, 0.5], [4.5, 81, 1.5, 79]]) K.sarangi(R + o * B, m, l * B, { g: 1.2, from });
// a tom fill into the last chord, which rings out under the cheering
for (let k = 0; k < 4; k++) K.tom(OUT - B + k * B / 4, 170 - k * 28, 1.0, -0.45 + k * 0.3);
C.crash(OUT, 1.2, 3.4); K.impact(OUT, 1.0); kick(OUT, 1.2);
C.power(OUT, 45, END - OUT - 0.1, { g: 1.0 });
C.organ(OUT, [57, 64, 69, 72, 76], END - OUT - 0.15, { g: 1.1 });
K.sarangi(OUT, 88, END - OUT - 0.4, { g: 1.0, from: 86 });

const dir = new URL(`./out/${id}/`, import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const r = K.mixdown(new URL('audio.wav', dir), { kicks, duckDepth: 0.35, verb: 0.3 });
console.log(`${id}: peak ${r.peak.toFixed(2)} drive ${r.drive.toFixed(2)}`);
