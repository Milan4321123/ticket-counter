// Binay Karki's walk-on sound (original, synthesized). Run: node synth.mjs binay → out/binay/audio.wav
//
// Fast hard rock, D minor, 150 bpm. Lights down: an amp switches on and hums,
// a guitar feeds back and one open D chord rings out, the floor tom rolls in.
// Shout HEY!: a driving rock beat with eighth-note chugs, and the whole hall
// shouting HEY! on 2 and 4 while the story is told. AIR GUITAR!: the drums go
// double-time and the guitar shreds up the pentatonic and bends the last note.
// 3 · 2 · 1 on B♭, C and A, then the lights: crash, boom, a galloping riff with
// madal on top, and the last chord feeding back under the cheering.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createKit } from '../ad-videos/kit.mjs';
import { crowdKit } from './crowd.mjs';

const require = createRequire(import.meta.url);
const id = 'binay';
const A = require(`./${id}.js`);
const S = A.scenes, B = A.B, BAR = 4 * B, R = A.reveal.t, OUT = A.reveal.bandOut, END = A.TOTAL;
// Dm – B♭ – C – A, a chord a bar
const CH = [[62, 65, 69], [58, 62, 65], [60, 64, 67], [57, 61, 64]];
const ROOT = [38, 34, 36, 33];
const K = createKit({ DUR: END, BPM: A.BPM, G0: 0, chords: CH.map((pad, i) => ({ pad, bass: ROOT[i] })) });
const C = crowdKit(K);
const kicks = [];
const kick = (t, g = 1) => { K.kick(t, g); kicks.push(t); };
const ramp = (t, a, b, v0, v1) => (t <= a ? v0 : t >= b ? v1 : v0 + (v1 - v0) * (t - a) / (b - a));
const barOf = (t) => Math.floor(t / BAR + 1e-6);

// ---------------- the hall ----------------
const countT = A.count.map((c) => c.t);
C.hall(0, END, (t) => {
  if (t < S.hey[0]) return 0.42;
  if (t < S.air[0]) return ramp(t, S.hey[0], S.air[0], 0.5, 0.65);
  if (t < S.count[0]) return ramp(t, S.air[0], S.count[0], 0.65, 0.85);
  if (t < R) { let v = 0.75; for (const c of countT) { const d = t - c; if (d >= 0 && d < 0.6) v = Math.max(v, 1 - d * 0.4); } return v; }
  return Math.max(0.55, ramp(t, R, END - 0.4, 1.0, 0.6)) * Math.min(1, (END - t) / 0.4);
}, 1.0);
C.applause(0.3, S.hey[0] - 0.3, () => 5, 0.7);
C.applause(S.air[0], S.count[0] - S.air[0], (t) => ramp(t, S.air[0], S.count[0], 60, 300), 0.6);
C.applause(S.count[0], R - S.count[0], () => 170, 0.7);
C.applause(R, END - R - 0.3, (t) => ramp(t, R, END, 450, 200), 0.6);
for (const t of [0.9, 2.3]) C.voice(t, 0.8, 420, 560, 'oo', t > 1 ? 0.6 : -0.6, 0.7);
C.cheer(A.strum + 0.1, 1.2, 10, 0.8);
C.cheer(S.air[0], S.count[0] - S.air[0], 30, 0.95);
C.cheer(R, 3.2, 50, 1.0);
C.cheer(R + 3, END - R - 3.3, 24, 0.8);

// ---------------- 1 · the amp hums on ----------------
C.ampOn(0.15, S.hey[0] - 0.15, 1.2);
C.feedback(0.5, 86, A.strum - 0.5, 1.1);
C.power(A.strum, 38, S.hey[0] - A.strum - 0.05, { g: 1.15 });
C.crash(A.strum, 0.7, 2.0); K.sub808(A.strum, 26, 1.2, { g: 0.8 });
for (let t = A.strum + 2 * B, k = 0; t < S.hey[0] - 1e-6; t += B / 2, k++) K.tom(t, 95, 0.6 + k * 0.12, -0.2);
for (let k = 0; k < 4; k++) K.snare(S.hey[0] - B + k * B / 4, { g: 0.6 + k * 0.15 });

// ---------------- 2 · shout HEY! ----------------
for (let t = S.hey[0]; t < S.air[0] - 1e-6; t += B) {
  const b = Math.round((t - S.hey[0]) / B), inBar = b % 4, ci = barOf(t - S.hey[0]) % 4, root = ROOT[ci];
  if (inBar === 0 || inBar === 2) kick(t, 0.95);
  if (inBar === 1) kick(t + B / 2, 0.8);
  if (inBar === 1 || inBar === 3) K.snare(t, { g: 0.95, gated: true });
  K.hat(t, false, 0.8); K.hat(t + B / 2, false, 0.6);
  if (inBar === 0 && t >= A.hey.lines[0].t) C.crash(t, 0.5, 1.2);
  // eighth-note chugs, the downbeat rings open
  C.power(t, root, inBar === 0 ? B - 0.02 : B / 2 - 0.02, { g: inBar === 0 ? 0.8 : 0.55, mute: inBar !== 0 });
  if (inBar !== 0) C.power(t + B / 2, root, B / 2 - 0.02, { g: 0.48, mute: true });
  K.bass(t, root, B * 0.45, 1.0); K.bass(t + B / 2, root, B * 0.4, 0.85);
  if (inBar === 0) CH[ci].forEach((m, k) => K.saw(t, m, BAR - 0.02, { g: 0.18, cut: 1600, voices: 2, att: 0.05, send: 0.4, pan: (k - 1) * 0.4 }));
}
A.heys.forEach((t, i) => {
  C.shout(t, 34, 0.95 + i * 0.04, 'eh');
  C.crowdClap(t, 24, 1.2);
  K.clap(t, 1.1);
});
for (let k = 0; k < 4; k++) K.tom(S.air[0] - B + k * B / 4, 170 - k * 25, 1.1, -0.4 + k * 0.27);

// ---------------- 3 · air guitar ----------------
{
  // the drums go double-time
  for (let t = S.air[0]; t < S.count[0] - 1e-6; t += B / 2) {
    const k = Math.round((t - S.air[0]) / (B / 2));
    kick(t, k % 2 === 0 ? 1.1 : 0.8);
    if (k % 4 === 2) K.snare(t, { g: 1.15, gated: true });
    K.hat(t, true, 0.7);
  }
  C.crash(S.air[0], 1.0, 2.0);
  // a sustained power chord a bar under the solo, hit again on every beat
  [38, 36].forEach((r, i) => { C.power(S.air[0] + i * BAR, r, BAR - 0.03, { g: 0.85 }); });
  // the shred: sixteenths up and down the D minor pentatonic, then a bend
  const PENT = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86];
  const shape = [0, 1, 2, 1, 2, 3, 4, 3, 4, 5, 6, 5, 6, 7, 8, 7, 8, 9, 10, 9, 8, 7, 8, 9, 10, 9, 10];
  shape.forEach((ix, i) => C.lead(S.air[0] + i * B / 4, PENT[ix], B / 4 - 0.008, { g: 2.0, vib: 0 }));
  const bendAt = S.air[0] + shape.length * B / 4;
  C.lead(bendAt, 86, S.count[0] - bendAt - 0.02, { g: 2.3, from: 2, vib: 2 });
}

// ---------------- 4 · 3 · 2 · 1 ----------------
const HIT = [34, 36, 33];                            // B♭ – C – A: the A pulls into D minor
countT.forEach((t, i) => {
  K.impact(t, 1.0 + i * 0.12); kick(t, 1.2);
  K.sub808(t, [22, 24, 21][i], 0.75, { g: 1.0, from: 38 });
  C.crash(t, 0.7 + i * 0.1, 1.0);
  C.shout(t + 0.03, 30, 1.1, ['ee', 'oo', 'ah'][i]);
  C.power(t, HIT[i], 2 * B - 0.04, { g: 1.05 });
  K.snare(t + B, { g: 0.8 + i * 0.15 });
});
for (let k = 0; k < 8; k++) K.snare(R - B + k * B / 8, { g: 0.6 + k * 0.08 });
K.riser(countT[0], R - countT[0], 1.3);

// ---------------- 5 · lights on ----------------
K.impact(R, 1.45); kick(R, 1.35);
K.sub808(R, 26, 2.0, { g: 1.25, from: 38, glide: 0.1 });
C.crash(R, 1.3, 3.0);
const RIFF_ROOTS = [38, 34, 36];                     // D – B♭ – C, a bar each
for (let t = R; t < OUT - 1e-6; t += B) {
  const b = Math.round((t - R) / B), inBar = b % 4, root = RIFF_ROOTS[Math.floor(b / 4) % 3];
  // the gallop: an eighth and two sixteenths on every beat
  C.power(t, root, B / 2 - 0.02, { g: 1.05, mute: inBar !== 0 });
  C.power(t + B / 2, root, B / 4 - 0.01, { g: 0.75, mute: true }); C.power(t + 3 * B / 4, root, B / 4 - 0.01, { g: 0.75, mute: true });
  kick(t, 1.1); kick(t + B / 2, 0.6); kick(t + 3 * B / 4, 0.6);
  if (inBar === 1 || inBar === 3) K.snare(t, { g: 1.15, gated: true });
  if (inBar === 0) C.crash(t, 0.55, 1.4);
  K.hat(t + B / 2, true, 0.6);
  K.bass(t, root, B * 0.45, 1.05); K.bass(t + B / 2, root, B * 0.4, 0.85);
  // madal on top: dhin on the beat, ta-ta after it
  K.madal(t, false, 0.9); K.madal(t + B / 2, true, 0.8); K.madal(t + 3 * B / 4, true, 0.55);
}
// the lead sings a line over the riff
for (const [o, m, l, from] of [[0, 74, 1, 2], [1, 77, 0.5], [1.5, 79, 0.5], [2, 81, 1.5, 2], [4, 82, 1, 1], [5, 81, 0.5], [5.5, 79, 0.5], [6, 77, 2], [8, 79, 1], [9, 81, 1], [10, 84, 2, 2]]) C.lead(R + o * B, m, l * B - 0.02, { g: 1.3, from: from || 0, vib: 1.2 });
for (let k = 0; k < 4; k++) K.tom(OUT - B + k * B / 4, 170 - k * 28, 1.0, -0.45 + k * 0.3);
C.crash(OUT, 1.2, 3.4); K.impact(OUT, 1.0); kick(OUT, 1.2);
C.power(OUT, 38, END - OUT - 0.1, { g: 1.35 });
C.feedback(OUT + 0.3, 86, END - OUT - 0.5, 0.9);

const dir = new URL(`./out/${id}/`, import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const r = K.mixdown(new URL('audio.wav', dir), { kicks, duckDepth: 0.35, verb: 0.3 });
console.log(`${id}: peak ${r.peak.toFixed(2)} drive ${r.drive.toFixed(2)}`);
