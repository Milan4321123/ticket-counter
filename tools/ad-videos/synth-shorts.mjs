// node synth-shorts.mjs 1 2 3 4 5 → out/dashain/shorts/v<n>/audio.wav
//
// One 15-second track per short, from the same kit as the long ad: an impact
// on the opening hit, the full groove with the flute hook under the hook
// scene, a lighter groove (16th plucks, a softer flute) under the phone, a
// riser and stop-time slams for DON'T · MISS · OUT!, a final drop and a last
// hit. Each short sits in its own key, and gets its own sounds: typing for
// short 2, the scanner's beep for short 3, a chime per ticket.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createKit } from './kit.mjs';

const require = createRequire(import.meta.url);
const X = require('./shorts.js');
const which = process.argv.slice(2).map(Number);

const HOOK_A = [[0, 69, 0.5], [1, 72, 0.5], [1.5, 74, 1], [2.5, 72, 0.5], [3, 69, 0.5], [3.5, 67, 0.5], [4, 65, 1], [5, 67, 0.5], [5.5, 69, 2]];
const HOOK_B = [[0, 67, 0.5], [1, 69, 0.5], [1.5, 72, 0.5], [2.5, 74, 0.5], [3, 76, 0.75], [3.75, 74, 0.25], [4, 72, 1], [5, 69, 0.5], [5.5, 67, 0.5], [6, 69, 2]];

for (const vn of which.length ? which : [1, 2, 3, 4, 5]) {
  const V = X.V[vn];
  const K = createKit({ DUR: X.TOTAL, BPM: X.BPM, G0: X.G0, transpose: V.transpose });
  const { B, BAR, beat, chordAt, CH } = K;
  const tr = V.transpose;
  const beatOf = (t) => (t - X.G0) / B;

  // Sections in beats: the hook until the phone comes up, then the phone,
  // the build (from bar 5), the final drop (bar 6) and the last hit.
  const PHONE = Math.round(beatOf(V.phone));
  const BUILD = 20, DROP = 24, LAST = 26;
  const full = (b) => (b >= 0 && b < PHONE) || (b >= DROP && b < LAST);
  const light = (b) => b >= PHONE && b < BUILD;

  // Before the first hit: a short reversed swell into it.
  K.riser(0, X.G0, 0.8);
  K.impact(X.G0, 1.1);
  const kicks = [];
  for (let b = 0; b < LAST; b++) {
    const t = beat(b), inBar = b % 4, c = chordAt(b);
    if (inBar === 0 && b < BUILD) K.pad(t, c.pad, BAR + 0.2, full(b) ? 0.9 : 0.8);
    if (b === DROP) K.pad(t, c.pad, BAR * 0.5 + 0.2, 1);
    if (full(b) || light(b)) {
      K.kick(t, full(b) ? 1 : 0.85); kicks.push(t);
      if (inBar === 1 || inBar === 3) K.clap(t, full(b) ? 1 : 0.7);
      for (let s = 0; s < 4; s++) K.hat(t + (s * B) / 4, false, s === 2 ? 1 : 0.55, s % 2 ? 0.3 : 0.15);
      if (full(b)) K.hat(t + B / 2, true, 0.8);
      // The madal pattern turns a little differently in each short.
      K.madal(t, false, inBar === 0 ? 1 : 0.6);
      K.madal(t + B * 0.5, true, 0.8);
      K.madal(t + B * (vn % 2 ? 0.75 : 0.25), true, 0.5);
      if (inBar === (vn + 1) % 4) K.madal(t + B * 0.5, false, 0.7);
      K.bass(t, c.bass, B * (inBar === 0 ? 1.4 : 0.45), full(b) ? 1 : 0.85);
      if (inBar === 1) K.bass(t + B * 0.5, c.bass, B * 0.4);
      if (inBar === 2) K.bass(t, c.bass + 12, B * 0.45);
      if (inBar === 3) K.bass(t + B * 0.5, c.bass + 7, B * 0.4);
      const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
      const steps = light(b) ? 4 : 2;
      for (let s = 0; s < steps; s++) {
        const k = inBar * steps + s;
        K.pluck(t + (s * B) / steps, c.pad[pattern[k % 8]] + 12, 0.85, k % 2 ? 0.45 : -0.45);
      }
    }
    // Flute: loud in the hook and the drop, softer under the phone.
    if (inBar === 0 && (full(b) || light(b)) && b % 8 === 0) {
      const phrase = (b / 8) % 2 === 0 ? HOOK_A : HOOK_B;
      for (const [o, m, l] of phrase) {
        const bb = b + o;
        if (bb >= BUILD && bb < DROP) continue;
        if (full(bb) || light(bb)) K.flute(t + o * B, m + tr, l, full(bb) ? 1 : 0.55);
      }
    }
  }
  // The build: a kick on bar 5, then silence but the riser, DON'T · MISS · OUT!
  K.kick(beat(BUILD)); K.impact(beat(BUILD), 0.45);
  K.riser(beat(BUILD) + 0.05, beat(DROP) - beat(BUILD) - 0.05, 0.9);
  X.ctaSlams.forEach((t, i) => { K.impact(t, i === 2 ? 1.2 : 0.8); K.kick(t, 1.2); });
  // The last hit, and the chord ringing out.
  K.impact(beat(LAST), 1.1);
  K.kick(beat(LAST), 1.1);
  K.pad(beat(LAST), CH[0].pad, X.TOTAL - beat(LAST), 1.2, 0.8);
  kicks.push(...X.ctaSlams, beat(LAST));

  // Sound effects.
  K.whoosh(V.phone, 1);
  K.whoosh(X.ctaStart + 0.05, 0.9);
  for (const [t] of V.taps) K.tap(t);
  (V.pops ?? []).forEach((t, i) => K.pop(t, i));
  if (V.typing) {
    const { text, a, b } = V.typing;
    for (let i = 0; i < text.length; i++) {
      const t = a + ((i + 0.5) * (b - a)) / text.length;
      K.add(K.FX, t, 0.05, (x) => Math.exp(-x * 90) * (K.noise() * 0.6 + Math.sin(K.TAU * 2400 * x)), (i % 3 - 1) * 0.2, 0.08);
    }
  }
  if (V.camera) {
    // The scanner: a short double beep when the code locks, a soft ding with the banner.
    [0, 0.09].forEach((d) => K.add(K.FX, V.camera.lock + d, 0.07, (x) => Math.sin(K.TAU * 1760 * x) * Math.exp(-x * 20), 0, 0.08));
    K.add(K.FX, V.camera.banner, 0.8, (x) => (Math.sin(K.TAU * 1318.5 * x) + 0.4 * Math.sin(K.TAU * 1975.5 * x)) * Math.exp(-x * 6), 0, 0.06, 0.4);
  }
  if (V.callout) K.pop(V.callout.at, 3);
  if (V.notes) V.notes.forEach(([t], i) => K.pop(t, i + 1));
  const n = V.tickets >= 4 ? 4 : 1;
  for (let i = 0; i < n; i++) K.chime(V.ticketAt + 0.2 + i * 0.12);

  const dir = new URL(`./out/dashain/shorts/v${vn}/`, import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  const { peak, drive } = K.mixdown(new URL('audio.wav', dir), { kicks });
  console.log(`v${vn} audio.wav · key ${tr >= 0 ? '+' : ''}${tr} · peak ${peak.toFixed(2)} drive ${drive.toFixed(2)}`);
}
