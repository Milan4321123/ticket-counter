// node synth.mjs → out/audio.wav (30 s, original — no licensed music)
//
// A 128 bpm future-house track in E major (C#m – A – E – B) on the shared kit
// (../ad-videos/kit.mjs), cued by film.js. 16 bars = 30 s:
//   bar 0     dark open: a braam, a heartbeat, a clock, a riser into…
//   bar 1     the ticket landing (impact + shimmer), a half-time pulse
//   bars 2–3  the two tickets: the groove builds; the hologram shimmers in;
//             snare roll + reverse swell into a white flash
//   bar 4     "Program? Pasal? Restaurant?" — three slams, then the last one
//             chopped into 1/16 and 1/32 repeats, and a beat of silence
//   bars 5–9  DROP on the logo: four-on-the-floor, rolling bass, supersaw
//             stabs pumping under the kick, a bell hook; coins pour in the
//             money scene; devices thunk and boot; a tape stop ends it
//   bars 10–11 breakdown for "Custom app chahiyo?": pad, rhodes, bansuri;
//             then a snare roll, riser and filter sweep into…
//   bars 12–14 DROP 2 on "Kura garau." and the QR card
//   bar 15    the end hit, ringing out
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createKit } from '../ad-videos/kit.mjs';

const require = createRequire(import.meta.url);
const FILM = require('./film.js');
const { bar, beat } = FILM;
const sc = FILM.scene;

const CH = [[61, 64, 68, 73], [57, 61, 64, 69], [59, 64, 68, 71], [59, 63, 66, 71]];   // C#m A E B
const ROOT = [37, 33, 40, 35];
const K = createKit({ DUR: FILM.TOTAL, BPM: FILM.BPM, G0: 0, chords: CH.map((pad, i) => ({ pad, bass: ROOT[i] })) });
const { B } = K;
const TAU = K.TAU;

const yours = sc('yours'), drop1 = bar(5), tools = sc('tools'), custom = sc('custom'), drop2 = bar(12), endHit = bar(15);
const tapeStop = [tools.t + tools.tapeStop[0], tools.t + tools.tapeStop[1]];
const stutter = [yours.t + yours.glitch[0], yours.t + yours.glitch[1]];       // the chopped last slam
const gap1 = [yours.t + yours.gap[0], drop1];
const roll = [custom.t + custom.roll[0], custom.t + custom.roll[1]];
const gap2 = [roll[1], drop2];
const kicks = [];

// ---------------- designed sounds ----------------
// Braam: a huge detuned brass-like swell on a low note.
function braam(t, m, g = 1) {
  const cut = (x) => 260 + 2600 * Math.min(1, x / 0.06) * Math.exp(-x * 1.7);
  K.saw(t, m, 1.5, { g: 1.25 * g, voices: 5, detune: 0.02, cut, att: 0.015, rel: 0.45, send: 0.55 });
  K.saw(t, m - 12, 1.5, { g: 1.0 * g, voices: 3, detune: 0.012, cut, att: 0.015, rel: 0.45, send: 0.4 });
  K.add(K.DR, t, 1.6, (x) => Math.tanh(1.8 * Math.sin(TAU * K.midi(m - 24) * x)) * Math.exp(-x * 1.4), 0, 0.16 * g);
}
// A sub drop: a sine diving from 110 Hz to 32 Hz.
function subDrop(t, g = 1) {
  let ph = 0;
  K.add(K.DR, t, 1.3, (x) => { const f = 32 + 78 * Math.exp(-x * 3.2); ph += TAU * f / K.SR; return Math.tanh(2 * Math.sin(ph)) * Math.exp(-x * 1.6); }, 0, 0.42 * g);
}
// A crash cymbal: bright noise with a long tail.
function crash(t, g = 1) {
  let hp = 0, last = 0;
  K.add(K.FX, t, 2.2, (x) => { const n = K.noise(); hp = 0.96 * (hp + n - last); last = n; return hp * Math.exp(-x * 2.0) * (1 + 0.3 * Math.sin(TAU * 7 * x)); }, -0.2, 0.13 * g, 0.5);
  K.add(K.FX, t, 2.2, (x) => { const n = K.noise(); return n * 0.5 * Math.exp(-x * 2.4); }, 0.25, 0.05 * g, 0.4);
}
// A reverse swell that ends on `t1`: noise and a chord rising, cut off dead.
function swell(t1, len, g = 1) {
  let lp = 0;
  K.add(K.FX, t1 - len, len, (x) => { const k = x / len; lp += (0.02 + 0.5 * k * k) * (K.noise() - lp); return lp * Math.pow(k, 2.5); }, 0, 0.32 * g, 0.5);
  const c = K.chordAt(Math.round(t1 / B));
  c.pad.forEach((m, i) => K.add(K.FX, t1 - len, len, (x) => { const k = x / len; return Math.sin(TAU * K.midi(m + 12) * x) * Math.pow(k, 3); }, (i - 1.5) * 0.4, 0.045 * g, 0.6));
}
// A glittering run of bells up the pentatonic scale.
function shimmer(t, g = 1) {
  [76, 78, 80, 83, 85, 88, 90, 92].forEach((m, i) => K.fm(t + i * 0.042, m, 0.9, { g: 0.32 * g, ratio: 3.5, index: 1.6, decay: 4, send: 0.55, pan: ((i % 3) - 1) * 0.5 }));
  let hp = 0, last = 0;
  K.add(K.FX, t, 0.6, (x) => { const n = K.noise(); hp = 0.9 * (hp + n - last); last = n; return hp * Math.sin(Math.PI * x / 0.6); }, 0.2, 0.05 * g, 0.4);
}
const thunk = (t, i) => { K.tom(t, 92 + i * 14, 1.1, (i - 1) * 0.4); K.add(K.FX, t, 0.03, (x) => K.noise() * Math.exp(-x * 160), (i - 1) * 0.4, 0.16); };
const boot = (t, i) => K.add(K.FX, t, 0.16, (x) => Math.sin(TAU * (380 * x + 5200 * x * x)) * Math.exp(-x * 14), (i - 1) * 0.4, 0.07, 0.3);
const beep = (t) => K.add(K.FX, t, 0.18, (x) => Math.sign(Math.sin(TAU * 1760 * x)) * 0.4 * (x < 0.15 ? 1 : 0) * Math.exp(-x * 5), 0.3, 0.07, 0.15);
const tick = (t, i) => K.add(K.FX, t, 0.05, (x) => Math.sin(TAU * (2600 + (i % 4) * 180) * x) * Math.exp(-x * 90), ((i % 3) - 1) * 0.3, 0.055);
const key = (t, i) => K.add(K.FX, t, 0.04, (x) => Math.exp(-x * 110) * (K.noise() * 0.7 + Math.sin(TAU * (1900 + (i % 5) * 90) * x) * 0.5), ((i % 3) - 1) * 0.2, 0.07);
const heart = (t, g = 1) => { for (const [o, f] of [[0, 58], [0.17, 52]]) K.add(K.DR, t + o, 0.32, (x) => Math.sin(TAU * f * x * (1 + 0.6 * Math.exp(-x * 30))) * Math.exp(-x * 11), 0, 0.42 * g); };
// One slam: the hit of a big word.
function slam(t, m, g = 1) {
  K.impact(t, 0.7 * g); K.kick(t, 1.15 * g); kicks.push(t);
  K.sub808(t, m, 0.42, { g: 0.7 * g });
  K.stab(t, K.chordAt(Math.round(t / B)).pad.map((x) => x + 12), { g: 1.2 * g, len: 0.3 });
  let hp = 0, last = 0;
  K.add(K.FX, t, 0.25, (x) => { const n = K.noise(); hp = 0.85 * (hp + n - last); last = n; return hp * Math.exp(-x * 14); }, 0, 0.2 * g, 0.3);
}

// ---------------- the music, beat by beat ----------------
const HOOK = [[0, 80, 0.5], [0.5, 83, 0.5], [1, 85, 0.75], [2, 83, 0.5], [2.5, 80, 0.5], [3, 78, 0.75], [4, 80, 0.5], [4.5, 83, 0.5], [5, 88, 1], [6, 85, 0.5], [6.5, 83, 0.5], [7, 80, 0.75]];
const nb = Math.round(FILM.TOTAL / B);
for (let b = 0; b < nb; b++) {
  const t = beat(b), inBar = b % 4, n = Math.floor(b / 4), ch = CH[n % 4], root = ROOT[n % 4];
  if (t >= endHit - 0.001) break;
  const intro = n === 0, landing = n === 1, build = n === 2 || n === 3, slams = n === 4;
  const drop = (n >= 5 && n <= 9) || (n >= 12 && n <= 14), breakdown = n === 10 || n === 11;
  if (slams) continue;
  // Pads, one chord a bar: dark in the open, opening through the build, soft in the breakdown.
  if (inBar === 0 && !drop) {
    const cut = intro ? 650 : landing ? 900 : build ? (x) => (n === 2 ? 1100 : 1700) + x * 500 : 1500;
    const att = breakdown ? 0.35 : 0.12;
    K.saw(t, ch[0], B * 4, { g: build ? 0.3 : 0.36, cut, att, rel: 0.3, voices: 3, send: 0.5, pan: -0.4 });
    for (const m of ch.slice(1)) K.saw(t, m, B * 4, { g: 0.27, cut, att, rel: 0.3, voices: 2, send: 0.5, pan: 0.3 });
  }
  if (drop && inBar === 0) for (const m of ch) K.saw(t, m, B * 4, { g: 0.16, cut: 2200, att: 0.08, rel: 0.2, voices: 2, send: 0.5, pan: (m % 2 ? -0.3 : 0.3) });
  // A pumping sub under the drops (on the music bus, so the kick ducks it).
  if (drop && inBar === 0) { const f = K.midi(root); K.add(K.MU, t, B * 4, (x) => Math.tanh(1.4 * Math.sin(TAU * f * x)) * Math.min(1, x / 0.01) * Math.min(1, (B * 4 - x) / 0.05), 0, 0.2); }
  // The open: heartbeat and a clock.
  if (intro) { if (inBar % 2 === 0) heart(t, 0.9); K.hat(t, false, 0.5, 0.35); K.hat(t + B / 2, false, 0.35, -0.35); continue; }
  // Plucks: 8ths on the landing, 16ths through the build and drops, sparse in the breakdown.
  {
    const steps = landing ? 2 : breakdown ? 1 : 4, pat = [0, 2, 1, 3, 2, 1, 3, 2];
    for (let k = 0; k < steps; k++) K.pluck(t + (k * B) / steps, ch[pat[(inBar * steps + k) % 8]] + 12, landing ? 0.8 : breakdown ? 0.9 : 0.62, k % 2 ? 0.45 : -0.45);
  }
  if (landing) { if (inBar === 0 || inBar === 2) { K.kick(t, 0.9); kicks.push(t); } if (inBar === 1 || inBar === 3) K.rim(t, 1); if (inBar % 2 === 0) K.bass(t, root, B * 1.8, 0.7); continue; }
  if (breakdown) {
    if (n === 10) { if (inBar === 0) K.rhodes(t, ch[0] - 12, B * 4, { g: 1.1 }); if (inBar === 0) for (const m of ch.slice(1)) K.rhodes(t, m - 12, B * 4, { g: 0.8 }); K.shaker(t + B / 2, 0.6); if (inBar === 0) K.bass(t, root, B * 3.8, 0.6); }
    else { K.kick(t, 0.6 + 0.12 * inBar); kicks.push(t); K.bass(t + B / 2, root, B * 0.42, 0.7); }
    continue;
  }
  // The groove (build and drops).
  const g = build ? (n === 2 ? 0.6 : 0.75) : 1.25;
  const air = (t >= gap1[0] && t < gap1[1]) || (t >= gap2[0] && t < gap2[1]);
  if (air) continue;
  K.kick(t, g); kicks.push(t);
  if ((inBar === 1 || inBar === 3) && (n !== 2)) { K.clap(t, drop ? 1.1 : 0.8); if (drop) K.snare(t, { g: 0.45, gated: true }); }
  K.hat(t + B / 2, true, drop ? 0.85 : 0.6, 0.25);
  if (drop) for (let k = 0; k < 4; k++) K.shaker(t + (k * B) / 4, k === 2 ? 0.9 : 0.45);
  if (drop) { K.bass(t + B / 4, root, B * 0.2, 0.85); K.bass(t + B / 2, root, B * 0.22, 1.3); K.bass(t + B * 0.75, root + 12, B * 0.2, 0.7); }
  else K.bass(t + B / 2, root, B * 0.4, 0.75);
  // Supersaw stabs on the offbeats, pumping under the kick.
  if (drop) for (const m of ch) K.saw(t + B / 2, m + 12, 0.17, { g: 0.8, voices: 3, detune: 0.018, cut: 4200, att: 0.004, rel: 0.07, send: 0.25, pan: (m % 2 ? -0.35 : 0.35) });
  // The bell hook, every other bar of the drops (and doubled by the flute in drop 2).
  if (drop && inBar === 0 && n % 2 === 1) for (const [o, m, len] of HOOK) {
    K.fm(t + o * B, m, len + 0.4, { g: 0.42, ratio: 3.5, index: 1.8, decay: 4.5, send: 0.4, pan: o % 1 ? 0.3 : -0.3 });
    K.pluck(t + o * B, m - 12, 0.5, o % 1 ? -0.3 : 0.3);
    if (n >= 12) K.flute(t + o * B, m, len, 0.75);
  }
}

// ---------------- moments ----------------
braam(0, 25, 0.9);                       // the open (C#1)
K.riser(0.2, bar(1) - 0.2, 0.9);
K.impact(bar(1), 0.7); K.kick(bar(1), 1.0); kicks.push(bar(1)); subDrop(bar(1), 0.4);   // the ticket lands
shimmer(sc('hook').glint, 0.9);
K.stab(sc('hook').swap + 0.12, CH[1].map((m) => m + 12), { g: 0.9 });                     // "MartNepali ma."
shimmer(sc('two').t + sc('two').land[1], 0.6);                                              // Lisbon lands
shimmer(sc('two').t + sc('two').holo, 1.1);                                                 // the hologram
K.riser(sc('two').t + bar(1), bar(1), 1.1);
for (let t = bar(3) + beat(2); t < bar(4) - 0.06; t += B / 4) K.snare(t, { g: 0.35 + 0.65 * ((t - bar(3) - beat(2)) / beat(2)), tone: 200 + 120 * ((t - bar(3)) / bar(1)) });
swell(bar(4) - 0.06, 1.2, 1);
// The slams: "Program?" "Pasal?" "Restaurant?"
yours.at.forEach((a, i) => slam(yours.t + a, [37, 40, 42][i], 1));
// A rising sine over the chopped repeats.
K.add(K.FX, stutter[0], stutter[1] - stutter[0], (x) => Math.sin(TAU * (300 * x + 2400 * x * x)) * 0.5, 0, 0.06, 0.2);
// DROP 1 — the logo.
braam(drop1, 25, 1.0); K.impact(drop1, 0.8); subDrop(drop1, 0.6); crash(drop1, 1.1); K.kick(drop1, 1.1); kicks.push(drop1);
// The money scene: a slam for "0 %".
K.impact(sc('zero').t, 0.9); crash(sc('zero').t, 0.6); K.coin(sc('zero').t + 0.05, 1.5);
// Breakdown: the bansuri sings over the pad.
const FLUTE = [[0, 80, 1.5], [1.5, 83, 0.5], [2, 85, 1], [3, 83, 0.5], [3.5, 80, 0.5], [4, 78, 1.5], [5.5, 76, 0.5], [6, 78, 1.8]];
for (const [o, m, len] of FLUTE) K.flute(custom.t + o * B, m, len, 1.15);
crash(custom.t, 0.45);
// The build into drop 2: a snare roll 8ths → 16ths → 32nds, rising.
for (let t = roll[0]; t < roll[1]; ) { const k = (t - roll[0]) / (roll[1] - roll[0]); K.snare(t, { g: 0.3 + 0.7 * k, tone: 190 + 160 * k }); t += k < 0.4 ? B / 2 : k < 0.75 ? B / 4 : B / 8; }
K.riser(roll[0], drop2 - roll[0], 1.2);
swell(drop2, 1.0, 1.1);
// DROP 2 — "Kura garau."
braam(drop2, 25, 1.05); K.impact(drop2, 0.85); subDrop(drop2, 0.6); crash(drop2, 1.2); K.kick(drop2, 1.15); kicks.push(drop2);
K.impact(sc('cta').t, 0.6);
// The end.
K.impact(endHit, 0.85); K.kick(endHit, 1.15); kicks.push(endHit); subDrop(endHit, 0.55); crash(endHit, 0.9);
for (const m of [49, 56, 61, 64, 68]) K.saw(endHit, m, FILM.TOTAL - endHit - 0.2, { g: 0.32, cut: 2400, voices: 3, att: 0.01, rel: 0.6, send: 0.7, pan: (m % 2 ? -0.3 : 0.3) });
K.fm(endHit, 85, 1.6, { g: 0.6, ratio: 3.5, index: 2, decay: 2.6, send: 0.7 });
K.flute(endHit + 0.05, 80, 3.2, 0.8);

// ---------------- cues from the edit ----------------
for (const c of FILM.cues()) {
  if (c.kind === 'whoosh') K.whoosh(c.t, 0.9);
  else if (c.kind === 'tick') tick(c.t, c.i);
  else if (c.kind === 'pop') K.pop(c.t, c.i);
  else if (c.kind === 'type') key(c.t, c.i);
  else if (c.kind === 'chime') K.chime(c.t);
  else if (c.kind === 'thunk') thunk(c.t, c.i);
  else if (c.kind === 'boot') boot(c.t, c.i);
  else if (c.kind === 'beep') beep(c.t);
  else if (c.kind === 'coin') K.coin(c.t, 0.55 + (c.i % 3) * 0.2);
}

// ---------------- edits on the mix ----------------
// The chopped slam: the start of "Restaurant?" repeated in 1/16s, then 1/32s.
{
  const src = Math.floor((yours.t + yours.at[2]) * K.SR);
  const a = Math.floor(stutter[0] * K.SR), mid = Math.floor((stutter[0] + 2 * B / 4) * K.SR), z = Math.floor(stutter[1] * K.SR);
  for (const bus of [K.DR, K.MU, K.FX, K.RV]) for (const ch of bus) {
    const L1 = Math.floor((B / 4) * K.SR), L2 = Math.floor((B / 8) * K.SR);
    for (let i = a; i < z; i++) { const L = i < mid ? L1 : L2, base = i < mid ? a : mid; const j = (i - base) % L; ch[i] = ch[src + j] * Math.min(1, j / 40) * (1 - (i - a) / (z - a) * 0.25); }
  }
}
// A beat of nothing before each drop (the risers and swells keep going).
for (const [g0, g1] of [gap1, gap2]) {
  const a = Math.floor(g0 * K.SR), z = Math.floor(g1 * K.SR);
  for (const bus of [K.DR, K.MU]) for (const ch of bus) for (let i = a; i < z; i++) ch[i] = 0;
}

fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
const r = K.mixdown(new URL('./out/audio.wav', import.meta.url), { kicks, duckDepth: 0.6, verb: 0.22, tapeStop, sweep: [roll[0], drop2 - 0.08] });
console.log(`audio: peak ${r.peak.toFixed(2)} drive ${r.drive.toFixed(2)}`);
