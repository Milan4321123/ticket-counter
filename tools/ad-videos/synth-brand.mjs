// node synth-brand.mjs customer seller restaurant organizer general → out/brand/<ad>/audio.wav
//
// A bright tech-promo track at 120 bpm (like the reference ad): it opens soft
// (pad, plucks, snaps) under the first words, the kick comes in with the giant
// word, a riser pulls into the logo where the full groove drops (four-on-the-
// floor, offbeat bass, 16th plucks, a bell hook), and it ends on a hit under
// the search bar. On top: a tick for every word, pops for cards, mouse clicks,
// keystrokes, chimes and whooshes, all from brand/ads.js cues().
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createKit } from './kit.mjs';

const require = createRequire(import.meta.url);
const BRAND = require('./brand/ads.js');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BRAND.AD);

for (const id of ids) {
  const ad = BRAND.AD[id];
  const tr = ad.key;
  // vi – IV – I – V (A minor / C major, moved to the ad's key).
  const CH = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 60, 64, 67], [55, 59, 62, 67]].map((c) => c.map((m) => m + tr));
  const ROOT = [45, 41, 48, 43].map((m) => m + tr);
  const K = createKit({ DUR: ad.TOTAL, BPM: BRAND.BPM, G0: 0, chords: CH.map((pad, i) => ({ pad, bass: ROOT[i] })) });
  const { B, beat } = K;
  const shot = (type) => ad.shots.find((s) => s.type === type);
  const logo = shot('logo'), outro = shot('outro');
  const kickIn = (shot('giant') || ad.shots[1]).t;      // the kick arrives with the second shot
  const drop = logo.t;
  const endHit = ad.TOTAL - 1.3;
  const kicks = [];
  const nb = Math.floor(ad.TOTAL / B);
  const HOOK = [[0, 76], [0.5, 79], [1, 81], [1.5, 79], [2, 76], [3, 74], [3.5, 76]];
  for (let b = 0; b < nb; b++) {
    const t = beat(b), inBar = b % 4, n = Math.floor(b / 4), ch = CH[n % 4], root = ROOT[n % 4];
    if (t >= endHit - 0.01) break;
    const intro = t < kickIn, pre = t >= kickIn && t < drop, full = t >= drop;
    const breath = t >= drop - 1.0 && t < drop;          // the riser's bar: drums drop out
    if (inBar === 0) K.saw(t, ch[0], B * 4, { g: 0.35, cut: full ? 2600 : 1400, att: 0.15, rel: 0.25, voices: 3, send: 0.45, pan: -0.4 });
    if (inBar === 0) for (const m of ch.slice(1)) K.saw(t, m, B * 4, { g: 0.28, cut: full ? 2600 : 1400, att: 0.15, rel: 0.25, voices: 2, send: 0.45, pan: 0.3 });
    // Plucks: 8ths in the intro, 16ths once it drops.
    const steps = full ? 4 : 2, pat = [0, 2, 1, 3, 2, 1, 3, 2];
    for (let k = 0; k < steps; k++) K.pluck(t + (k * B) / steps, ch[pat[(inBar * steps + k) % 8]] + 12, full ? 0.75 : 0.9, k % 2 ? 0.45 : -0.45);
    if (intro) { if (inBar === 1 || inBar === 3) K.rim(t, 0.9); continue; }
    if (breath) continue;
    K.kick(t, full ? 1.05 : 0.85); kicks.push(t);
    if (inBar === 1 || inBar === 3) K.clap(t, full ? 1 : 0.7);
    K.hat(t + B / 2, full, full ? 0.8 : 0.6, 0.25);
    if (full) for (let k = 0; k < 4; k++) K.shaker(t + (k * B) / 4, k === 2 ? 0.9 : 0.45);
    K.bass(t + B / 2, root, B * 0.42, pre ? 0.7 : 1);
    if (full) K.bass(t + B * 0.75, root + 12, B * 0.2, 0.45);
    // The bell hook: every other bar after the drop, and over the outro.
    if (full && inBar === 0 && (n % 2 === 0 || t >= outro.t)) for (const [o, m] of HOOK) K.fm(t + o * B, m + tr, 0.45, { g: 0.45, ratio: 3.5, index: 1.8, decay: 5, send: 0.4, pan: o % 1 ? 0.3 : -0.3 });
  }
  K.riser(drop - 1.5, 1.5, 1);
  K.impact(drop + BRAND.TIMES.logo.mark, 1.1);
  K.riser(outro.t - 1.0, 1.0, 0.6);
  K.impact(endHit, 1.1); K.kick(endHit, 1.2); kicks.push(endHit);
  K.saw(endHit, CH[2][0], ad.TOTAL - endHit, { g: 0.45, cut: 2200, voices: 3, att: 0.01, rel: 0.2, send: 0.7 });
  K.fm(endHit, 84 + tr, 1.2, { g: 0.6, ratio: 3.5, index: 2, decay: 3, send: 0.6 });

  // Cues.
  const tick = (t, i) => K.add(K.FX, t, 0.05, (x) => Math.sin(K.TAU * (2600 + (i % 4) * 180) * x) * Math.exp(-x * 90), ((i % 3) - 1) * 0.3, 0.06);
  const click = (t) => K.add(K.FX, t, 0.06, (x) => (K.noise() * 0.5 + Math.sin(K.TAU * 3200 * x)) * Math.exp(-x * 120) + Math.sin(K.TAU * 700 * x) * Math.exp(-x * 60) * 0.6, 0.1, 0.16);
  const key = (t, i) => K.add(K.FX, t, 0.04, (x) => Math.exp(-x * 110) * (K.noise() * 0.7 + Math.sin(K.TAU * (1900 + (i % 5) * 90) * x) * 0.5), ((i % 3) - 1) * 0.2, 0.07);
  for (const c of BRAND.cues(ad)) {
    if (c.kind === 'whoosh') K.whoosh(c.t, 0.9);
    else if (c.kind === 'big') { K.whoosh(c.t + 0.1, 1.2); K.whoosh(c.t + 0.9, 1.3); K.add(K.FX, c.t + 0.75, 0.9, (x) => Math.sin(K.TAU * (60 * x + (140 / 5) * (1 - Math.exp(-x * 5)))) * Math.exp(-x * 3), 0, 0.35); }
    else if (c.kind === 'tick') tick(c.t, c.i);
    else if (c.kind === 'pop') K.pop(c.t, c.i);
    else if (c.kind === 'click') click(c.t);
    else if (c.kind === 'type') key(c.t, c.i);
    else if (c.kind === 'chime') K.chime(c.t);
    else if (c.kind === 'hit') K.impact(c.t, c.t === 0 ? 0.6 : 0.7);
  }
  const dir = new URL(`./out/brand/${id}/`, import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  const r = K.mixdown(new URL('audio.wav', dir), { kicks, duckDepth: 0.5, verb: 0.2 });
  console.log(`${id}: peak ${r.peak.toFixed(2)} drive ${r.drive.toFixed(2)}`);
}
