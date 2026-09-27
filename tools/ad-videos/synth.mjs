// node synth.mjs → out/dashain/audio.wav
//
// The ad's soundtrack, made from scratch (no licensed music): a festive
// 112 bpm track in D minor — a bansuri-like flute hook, madal-style hand
// drums over a modern kick/clap/hat groove, an 808 bass that pumps against the
// kick, plucked arpeggios (Karplus–Strong) and a wide pad. It follows the edit
// (timeline.js): a riser into the date slam, a lighter groove under the
// organizer, the full hook under the programmes, a breakdown on "your ticket",
// a drop on the event, a stop-time build for DON'T · MISS · OUT! and a final
// drop. Sound effects sit on top: whooshes on cuts, taps, pops, coins, the
// ticket's chime.
import { createRequire } from 'node:module';
import { createKit } from './kit.mjs';

const require = createRequire(import.meta.url);
const TL = require('./timeline.js');
const DUR = TL.TOTAL;
const OUT = new URL('./out/dashain/', import.meta.url);
const K = createKit({ DUR, BPM: TL.BPM, G0: TL.G0 });
const { B, BAR, beat, chordAt, CH } = K;
const { kick, clap, hat, madal, snareHit, bass, pad, pluck, flute, riser, impact, whoosh, tap, pop, coin, chime } = K;
const G0 = TL.G0;
const at = (id) => TL.scenes.find((s) => s.id === id).start;

// ---------------- Arrangement ----------------
// Sections by beat number (beat 0 = the date slam at G0).
const SEC = {
  hook: [0, 8],          // full drop
  org: [8, 20],          // light groove
  prog: [20, 50],        // full + flute hook
  brk: [50, 56],         // breakdown into the event
  event: [56, 66],       // drop + hook
  buy: [66, 92],         // groove, no flute (taps are the lead)
  build: [92, 96],       // stop-time: DON'T · MISS · OUT!
  fin: [96, 104],        // final drop
};
const inSec = (b, ...names) => names.some((n) => b >= SEC[n][0] && b < SEC[n][1]);
const LAST = 104; // the final hit

// ---------------- The song ----------------
// Intro: a reversed swell and a riser into the date slam.
pad(0, CH[0].pad, G0 + 0.05, 0.9, 0.4);
riser(0.1, G0 - 0.1, 1.1);
impact(G0, 1.1);

// Flute hook: two phrases, two bars each (beats, midi, length in beats).
const HOOK_A = [[0, 69, 0.5], [1, 72, 0.5], [1.5, 74, 1], [2.5, 72, 0.5], [3, 69, 0.5], [3.5, 67, 0.5], [4, 65, 1], [5, 67, 0.5], [5.5, 69, 2]];
const HOOK_B = [[0, 67, 0.5], [1, 69, 0.5], [1.5, 72, 0.5], [2.5, 74, 0.5], [3, 76, 0.75], [3.75, 74, 0.25], [4, 72, 1], [5, 69, 0.5], [5.5, 67, 0.5], [6, 69, 2]];
const fluteOn = (b) => inSec(b, 'hook', 'prog', 'event', 'fin') || (b >= 12 && b < 20); // the org tagline gets it too

const kicks = [];
for (let b = 0; b < LAST; b++) {
  const t = beat(b);
  const inBar = b % 4;
  const full = inSec(b, 'hook', 'prog', 'event', 'fin');
  const light = inSec(b, 'org', 'buy');
  const brk = inSec(b, 'brk');
  const build = inSec(b, 'build');
  const c = chordAt(b);

  // Pad: every bar.
  if (inBar === 0 && !build) pad(t, c.pad, BAR + 0.2, brk ? 1.2 : full ? 0.9 : 0.8, brk ? 0.3 : 1);

  // Drums.
  if (full || light) {
    kick(t, full ? 1 : 0.85); kicks.push(t);
    if (inBar === 1 || inBar === 3) clap(t, full ? 1 : 0.7);
    for (let s = 0; s < 4; s++) hat(t + (s * B) / 4, false, s === 2 ? 1 : 0.55, s % 2 ? 0.3 : 0.15);
    if (full) hat(t + B / 2, true, 0.8);
    // Madal pattern: dhin on 1, ta-ta on the "and"s, a dhin pickup into 4.
    madal(t, false, inBar === 0 ? 1 : 0.6);
    madal(t + B * 0.5, true, 0.8);
    madal(t + B * 0.75, true, 0.5);
    if (inBar === 2) madal(t + B * 0.5, false, 0.7);
  }
  if (brk) {
    // A heartbeat: two soft kicks per bar, then a snare roll into the event.
    if (inBar === 0) { kick(t, 0.6); kick(t + B * 0.35, 0.45); }
    if (b >= SEC.brk[1] - 2) for (let k = 0; k < 8; k++) snareHit(t + (k * B) / 8, 0.4 + 0.6 * ((b - (SEC.brk[1] - 2)) * 8 + k) / 16);
  }

  // Bass.
  if (full || light) {
    bass(t, c.bass, B * (inBar === 0 ? 1.4 : 0.45), full ? 1 : 0.85);
    if (inBar === 1) bass(t + B * 0.5, c.bass, B * 0.4);
    if (inBar === 2) bass(t, c.bass + 12, B * 0.45);
    if (inBar === 3) bass(t + B * 0.5, c.bass + 7, B * 0.4);
  }

  // Plucked arpeggio, 8ths (16ths in the buy section, where it carries the tune).
  if (full || light || brk) {
    const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
    const steps = inSec(b, 'buy') ? 4 : 2;
    for (let s = 0; s < steps; s++) {
      const k = inBar * steps + s;
      pluck(t + (s * B) / steps, c.pad[pattern[k % 8]] + (brk ? 0 : 12), brk ? 0.7 : 0.9, k % 2 ? 0.45 : -0.45);
    }
  }

  // Flute hook on bar starts, phrase A on even bars, B on odd.
  if (inBar === 0 && fluteOn(b) && (Math.floor(b / 4) % 2 === 0)) {
    const phrase = Math.floor(b / 8) % 2 === 0 ? HOOK_A : HOOK_B;
    for (const [o, m, l] of phrase) if (fluteOn(b + o)) flute(t + o * B, m, l, 1);
  }
}

// Breakdown riser into the event drop, and the buy section's build.
riser(beat(SEC.brk[0] + 1), beat(SEC.brk[1]) - beat(SEC.brk[0] + 1), 1);
impact(beat(SEC.event[0]), 0.8);
riser(beat(SEC.build[0] - 4), beat(SEC.build[0]) - beat(SEC.build[0] - 4), 0.7);
// Stop-time: DON'T (beat 94) · MISS (95) · OUT! (96, the final drop).
kick(beat(92)); impact(beat(92), 0.5);
TL.ctaSlams.forEach((t, i) => { impact(t, i === 2 ? 1.2 : 0.8); kick(t, 1.2); });
riser(beat(92) + 0.05, beat(96) - beat(92) - 0.05, 0.9);
// The final hit.
impact(beat(LAST), 1.1);
kick(beat(LAST), 1.1);
pad(beat(LAST), CH[0].pad, DUR - beat(LAST), 1.2, 0.8);

// ---------------- Sound effects ----------------
for (const t of TL.whooshes) whoosh(t, 1);
for (const t of TL.taps) tap(t);
TL.pops.forEach((t, i) => pop(t, i));
coin(at('euro') + 0.75, 1.6);
for (let k = 0; k < 24; k += 2) coin(at('euro') + 1.6 + k * 0.045 + 0.28, 0.6);
chime(TL.chime);

// ---------------- Mix ----------------
const { peak, drive } = K.mixdown(new URL('audio.wav', OUT), {
  kicks: kicks.concat(TL.ctaSlams),
  sweep: [beat(SEC.brk[0]), beat(SEC.brk[1])],
});
console.log('audio.wav', DUR, 's, peak', peak.toFixed(2), 'drive', drive.toFixed(2));
