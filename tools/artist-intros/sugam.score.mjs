// Sugam Pokhrel's main-guest walk-on sound (original, synthesized). Run: node synth.mjs sugam → out/sugam/audio.wav
//
// A stadium anthem in D major, 128 bpm, built so the hall can join in:
//  open    — a choir and a low drone, timpani, each hit title whooshing past, a
//            riser; "MAIN GUEST" lands on brass, choir and a boom
//  lights  — magic-dust sparkle as the particles find his face, the bansuri plays
//            the chant gently, the crowd goes "ooh" as the phone lights come up
//  clap    — the kick comes in and the claps speed up ½ → ¼ → ⅛ → 1/16 over a
//            rising riser, then a sixteenth of silence
//  drop    — four-on-the-floor, supersaw D–A–Bm–G, brass, and the whole hall singing
//            WHOA-OH-OH-OH (the chant), doubled by the bansuri
//  call    — a breakdown: brass hits for "SUGAM!", the crowd shouting "POKHREL!"
//  count   — timpani, booms and shouts for 3 · 2 · 1, a riser, half a beat of silence
//  reveal  — the biggest hit, fireworks, the chant again with the full band, madal
//            and bansuri, and a last D chord ringing under the cheering
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createKit } from '../ad-videos/kit.mjs';
import { crowdKit } from './crowd.mjs';

const require = createRequire(import.meta.url);
const id = 'sugam';
const A = require(`./${id}.js`);
const S = A.scenes, B = A.B, at = A.at, R = A.reveal.t, OUT = A.reveal.bandOut, END = A.TOTAL;
const CH = { D: [62, 66, 69], A: [61, 64, 69], Bm: [62, 66, 71], G: [62, 67, 71] };
const ROOT = { D: 38, A: 33, Bm: 35, G: 31 };
const PROG = ['D', 'A', 'Bm', 'G'];                       // a chord every two beats in the drops
const K = createKit({ DUR: END, BPM: A.BPM, G0: 0, chords: PROG.map((c) => ({ pad: CH[c], bass: ROOT[c] })) });
const C = crowdKit(K);
const kicks = [];
const kick = (t, g = 1) => { K.kick(t, g); kicks.push(t); };
const ramp = (t, a, b, v0, v1) => (t <= a ? v0 : t >= b ? v1 : v0 + (v1 - v0) * (t - a) / (b - a));
const pad = (t, name, len, { g = 0.3, cut = 1800, oct = 0 } = {}) => CH[name].forEach((m, k) => K.saw(t, m + oct, len, { g, cut, att: 0.08, rel: 0.25, voices: 3, send: 0.5, pan: (k - 1) * 0.45 }));
const chant = (t0, notes, { crowd = 30, g = 1, flute = true, lead = true } = {}) => {
  for (const [b, m, l] of notes) {
    const t = t0 + b * B, len = l * B;
    C.sing(t, m, len * 0.95, { n: crowd, g: 1.7 * g, vowel: 'oh' });
    if (flute) K.flute(t, m + 12, l * 0.95, 0.95 * g);
    if (lead) K.saw(t, m, len * 0.92, { g: 0.17 * g, cut: 2600, voices: 2, att: 0.01, rel: 0.06, send: 0.3, square: true });
  }
};
const countT = A.count.map((c) => c.t), shoutsC = A.call.shouts.filter((s) => s.who === 'crowd').map((s) => s.t), shoutsS = A.call.shouts.filter((s) => s.who === 'stage').map((s) => s.t);

// ---------------- the hall ----------------
C.hall(0, END, (t) => {
  if (t < S.lights[0]) return 0.3;
  if (t < S.clap[0]) return 0.42;
  if (t < S.drop[0]) return ramp(t, S.clap[0], S.drop[0], 0.45, 0.72);
  if (t < S.call[0]) return 0.82;
  if (t < S.count[0]) { let v = 0.55; for (const c of shoutsC) { const d = t - c; if (d >= 0 && d < 0.5) v = Math.max(v, 1 - d * 0.5); } return v; }
  if (t < A.blackout) { let v = 0.72; for (const c of countT) { const d = t - c; if (d >= 0 && d < 0.6) v = Math.max(v, 1 - d * 0.4); } return v; }
  if (t < R) return 0.35;                                // the hall holds its breath
  return Math.max(0.55, ramp(t, R, END - 0.4, 1.0, 0.6)) * Math.min(1, (END - t) / 0.4);
}, 1.0);
C.applause(0.3, S.lights[0] - 0.3, () => 3, 0.6);
C.applause(S.lights[0], S.clap[0] - S.lights[0], () => 10, 0.6);
C.applause(S.drop[0], S.call[0] - S.drop[0], () => 120, 0.6);
C.applause(S.count[0], A.blackout - S.count[0], () => 150, 0.65);
C.applause(R, END - R - 0.3, (t) => ramp(t, R, END, 600, 220), 0.6);
for (const t of [0.9, 2.6]) C.voice(t, 0.9, 400, 540, 'oo', t > 1 ? 0.6 : -0.6, 0.6);
C.cheer(at(13), 1.6, 22, 0.85, ['oo']);                  // "ooh" as the phone lights come up
C.cheer(at(28), at(32) - at(28), 20, 0.9);
C.cheer(S.drop[0], 2.4, 36, 1.0);
C.cheer(R, 3.4, 60, 1.15);
C.cheer(R + 3.2, END - R - 3.5, 26, 0.85);

// ---------------- 1 · warp through the hits ----------------
K.sub808(0, 26, S.lights[0] - 0.05, { g: 0.42 });
[['Bm', 0], ['G', 4], ['A', 8]].forEach(([c, b]) => {
  const t = at(b), len = at(b + 4) - t;
  C.choir(t, CH[c].map((m) => m - 12), len, { vowel: 'oo', g: 0.9, att: 0.6 });
  pad(t, c, len, { g: 0.22, cut: 700, oct: -12 });
});
A.passes.forEach((t, i) => K.whoosh(t, 0.55 + 0.25 * (i % 2)));
K.riser(0.4, at(8) - 0.4, 0.8);
C.timpani(at(1), 38, 1.1); C.timpani(at(2), 45, 1.0);
for (let k = 0; k < 8; k++) C.timpani(at(6) + k * B / 4, 38 + (k % 2) * 7, 0.45 + k * 0.08);   // the roll into MAIN GUEST
K.impact(at(8), 1.25); kick(at(8), 1.2); K.sub808(at(8), 26, 1.6, { g: 1.1, from: 38 });
C.brass(at(8), [62, 66, 69, 74], 1.1, { g: 1.3 }); C.choir(at(8), [62, 66, 69, 74], 1.5, { vowel: 'ah', g: 1.2, att: 0.03 });
C.crash(at(8), 1.0, 2.6);
C.choir(at(9), [57, 61, 64, 69], at(12) - at(9) - 0.05, { vowel: 'ah', g: 1.0, att: 0.9 });
K.riser(at(9), at(12) - at(9), 1.3); C.swell(at(12), 0.6, 1.2);

// ---------------- 2 · phone lights up ----------------
K.impact(at(12), 1.0); C.crash(at(12), 0.9, 2.4);
C.choir(at(12), [62, 66, 69, 74], 1.8, { vowel: 'ah', g: 1.1, att: 0.05 });
C.sparkle(at(12), 2.4, { g: 1.1, per: 18 });
[['D', 12], ['A', 16]].forEach(([c, b]) => {
  const t = at(b), len = at(b + 4) - t;
  pad(t, c, len, { g: 0.24, cut: 1100 });
  C.choir(t + 0.3, CH[c].map((m) => m - 12), len - 0.3, { vowel: 'oo', g: 0.7, att: 0.8 });
  for (let k = 0; k < 4; k++) K.rhodes(t + k * B, CH[c][k % 3] + 12, B * 0.9, { g: 0.8 });
  K.bass(t, ROOT[c], len * 0.9, 0.7);
});
for (let b = 14; b < 20; b++) kick(at(b), 0.5);
for (let b = 16; b < 20; b += 0.5) K.shaker(at(b), 0.5);
for (const [o, m, l] of A.chant) K.flute(at(12) + o * B, m + 12, l * 0.95, 1.05);   // the chant, gently, on bansuri
A.lights.chips.forEach((c) => K.chime(c.t));

// ---------------- 3 · clap with us — faster — FASTER ----------------
[['Bm', 20], ['G', 24], ['A', 28]].forEach(([c, b], i) => {
  const t = at(b), len = Math.min(at(b + 4), at(31.75)) - t;
  pad(t, c, len, { g: 0.32, cut: [900, 1500, 2400][i] });
  for (let k = 0; k < (b + 4 > 31.75 ? 7 : 8); k++) K.bass(t + k * B / 2, ROOT[c], B * 0.4, 0.95 + 0.12 * i);
});
for (let b = 20; b < 31.75; b++) { kick(at(b), 1.0 + 0.3 * (b - 20) / 12); if (b >= 24) K.hat(at(b) + B / 2, false, 0.8); }
for (let b = 28; b < 31.75; b += 0.25) K.hat(at(b), false, 0.55);
A.claps.forEach((t, i) => {
  C.crowdClap(t, 44 + i * 3, 2.5 + i * 0.05);
  K.clap(t, 1.8 + i * 0.03);
  if (i >= 10) K.snare(t, { g: 0.7 + (i - 10) * 0.1 });
});
K.riser(at(24), at(31.75) - at(24), 2.3);
{ const len = at(31.75) - at(28); CH.A.forEach((m, k) => K.saw(at(28), m + 12, len, { g: 0.5, cut: (x) => 300 + 6500 * Math.pow(x / len, 2), voices: 3, att: 0.05, rel: 0.02, send: 0.3, pan: (k - 1) * 0.4 })); }

// ---------------- 4 · HANDS UP — the chant ----------------
const groove = (b0, b1, { full = 1 } = {}) => {
  for (let b = b0; b < b1; b++) {
    const t = at(b), inBar = b % 4, c = PROG[Math.floor((b - b0) / 2) % 4];
    kick(t, 1.15 * full);
    if (inBar === 1 || inBar === 3) { K.clap(t, 1.1); C.crowdClap(t, 26, 1.1); }
    K.hat(t + B / 2, true, 0.85);
    for (let k = 0; k < 4; k++) K.shaker(t + (k * B) / 4, k === 2 ? 0.85 : 0.4);
    K.bass(t + B / 2, ROOT[c], B * 0.42, 1.05); K.bass(t + B * 0.75, ROOT[c] + 12, B * 0.2, 0.5);
    if ((b - b0) % 2 === 0) {
      CH[c].forEach((m, k) => K.saw(t, m, 2 * B - 0.02, { g: 0.3, cut: 3200, voices: 3, att: 0.01, rel: 0.15, send: 0.45, pan: (k - 1) * 0.45 }));
      C.brass(t, CH[c].map((m) => m + 12), 0.24, { g: 0.9 });
    }
  }
};
K.impact(S.drop[0], 1.4); K.sub808(S.drop[0], 26, 1.8, { g: 1.2, from: 50, glide: 0.12 }); C.crash(S.drop[0], 1.2, 2.8);
groove(32, 40);
chant(S.drop[0], A.chant, { crowd: 30 });
for (let k = 0; k < 4; k++) K.tom(at(39.5) + k * B / 8, 170 - k * 25, 1.0, -0.4 + k * 0.27);

// ---------------- 5 · when I say SUGAM, you say POKHREL ----------------
for (let b = 40; b < 44; b++) { kick(at(b), 0.95); if (b % 2 === 1) { K.clap(at(b), 1.0); C.crowdClap(at(b), 26, 1.0); } K.hat(at(b) + B / 2, false, 0.7); }
K.sub808(at(40), 26, at(44) - at(40), { g: 0.5 });
pad(at(40), 'D', at(44) - at(40) - 0.05, { g: 0.22, cut: 900 });
C.timpani(at(40), 38, 1.1); C.timpani(at(42), 45, 1.1);
shoutsS.forEach((t, i) => { C.brass(t, [62, 66, 69, 74], 0.42, { g: 1.5 }); C.brass(t + B * 0.5, [62, 66, 69, 74], 0.2, { g: 1.0 }); K.impact(t, 0.8); kick(t, 1.1); C.choir(t, [62, 69, 74], 0.4, { vowel: 'ah', g: 1.1, att: 0.02, rel: 0.1 }); });
shoutsC.forEach((t, i) => { C.shout(t, 44, 1.45 + i * 0.15, 'oh'); C.crash(t, 0.9, 1.4); kick(t, 1.2); K.sub808(t, 26, 0.5, { g: 0.8 }); });

// ---------------- 6 · 3 · 2 · 1 ----------------
countT.forEach((t, i) => {
  K.impact(t, 1.0 + i * 0.15); kick(t, 1.2);
  C.timpani(t, [45, 47, 49][i], 1.3); K.sub808(t, [33, 35, 37][i], 0.9, { g: 1.0 });
  C.crash(t, 0.7 + i * 0.12, 1.2);
  C.shout(t + 0.03, 34, 1.15, ['ee', 'oo', 'ah'][i]);
  C.choir(t, CH.A.map((m) => m + 2 * i), 2 * B - 0.1, { vowel: 'ah', g: 0.9, att: 0.04, rel: 0.2 });
  for (let k = 0; k < 4; k++) C.timpani(t + B + k * B / 4, 38, 0.4 + k * 0.12 + i * 0.1);
});
K.riser(S.count[0], A.blackout - S.count[0] - 0.02, 1.8);
{ const t0 = at(52), len = A.blackout - t0 - 0.02; [57, 61, 64, 69].forEach((m, k) => K.saw(t0, m + 12, len, { g: 0.45, cut: (x) => 400 + 7000 * Math.pow(x / len, 2), voices: 3, att: 0.03, rel: 0.02, send: 0.3, pan: (k - 1.5) * 0.4 })); }
C.swell(A.blackout, 0.35, 1.5);

// ---------------- 7 · lights on ----------------
K.impact(R, 1.2); kick(R, 1.3);
K.sub808(R, 26, 2.4, { g: 1.0, from: 50, glide: 0.12 });
C.crash(R, 1.4, 3.6);
C.choir(R, [50, 57, 62, 66, 69, 74], 2.6, { vowel: 'ah', g: 1.3, att: 0.02, rel: 0.8 });
C.brass(R, [62, 66, 69, 74], 0.9, { g: 1.2 });
C.sparkle(R, 2.0, { g: 1.0, per: 16 });
A.reveal.shells.forEach(([b, x, , , rocket]) => C.firework(at(b), { g: rocket === false ? 0.45 : 0.75, rocket: rocket !== false, pan: (x - 960) / 960 }));
groove(54, 66, { full: 1.05 });
chant(R, A.chant, { crowd: 44, g: 1.15 });
chant(R + 8 * B, A.chant.slice(0, 4), { crowd: 44, g: 1.15 });
// madal on top: dhin on the beat, ta-ta after it
for (let b = 54; b < 66; b++) { const t = at(b); K.madal(t, false, 0.95); K.madal(t + B / 2, true, 0.85); K.madal(t + B * 0.75, true, 0.6); }
for (let k = 0; k < 4; k++) K.tom(OUT - B + k * B / 4, 170 - k * 28, 1.1, -0.45 + k * 0.3);
// the last chord rings out under the cheering, for the band to take over
K.impact(OUT, 1.2); kick(OUT, 1.3); C.crash(OUT, 1.3, 3.2);
pad(OUT, 'D', END - OUT, { g: 0.42, cut: 2600 }); pad(OUT, 'D', END - OUT, { g: 0.25, cut: 1200, oct: -12 });
C.choir(OUT, [50, 57, 62, 66, 69, 74], END - OUT, { vowel: 'ah', g: 1.0, att: 0.03, rel: 1.2 });
K.flute(OUT, 86, (END - OUT) / B - 0.5, 1.0);
K.sub808(OUT, 26, END - OUT - 0.2, { g: 0.8 });

const dir = new URL(`./out/${id}/`, import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const r = K.mixdown(new URL('audio.wav', dir), { kicks, duckDepth: 0.35, verb: 0.3 });
console.log(`${id}: peak ${r.peak.toFixed(2)} drive ${r.drive.toFixed(2)}`);
