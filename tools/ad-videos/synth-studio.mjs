// node synth-studio.mjs [ids…] → out/studio/<id>/audio.wav
//
// One soundtrack per studio ad, in the genre of its skin and the key of the ad:
//   blob → tech-house 120 · kinetic → trap 140 · paper → Nepali folk 6/8 ·
//   swiss → house 124 · neon → synthwave 100 · pov → lo-fi 84 · cinema → piano & strings 72.
// Each opens softer, drops on the second shot (kinetic hits from the start),
// and ends on a hit under the search bar. Every cue from studio/scripts.js
// cues() — word ticks, slams, pops, clicks, keys, chat dings, chimes — is laid
// on top, in the skin's flavour.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createKit } from './kit.mjs';

const require = createRequire(import.meta.url);
const STUDIO = require('./studio/scripts.js');
require('./studio/dashain-scripts.js');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : STUDIO.ADS.filter((a) => (process.env.SET ? a.set === process.env.SET : !a.set)).map((a) => a.id);

// Chords as [pad notes], roots; shifted by the ad's key.
const PROG = {
  minor: { pad: [[57, 60, 64, 69], [53, 57, 60, 65], [55, 60, 64, 67], [55, 59, 62, 67]], root: [45, 41, 48, 43] },   // Am F C G
  trap: { pad: [[62, 65, 69], [58, 62, 65], [55, 58, 62], [57, 61, 64]], root: [38, 34, 31, 33] },                 // Dm Bb Gm A
  folk: { pad: [[55, 59, 62, 67], [55, 60, 64, 67], [54, 57, 62, 66], [55, 59, 62, 67]], root: [43, 48, 50, 43] },  // G C D G
  lofi: { pad: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], root: [41, 40, 38, 36] },  // Fmaj7 Em7 Dm7 Cmaj7
  cinema: { pad: [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]], root: [36, 33, 29, 31] }, // C Am F G
};
const shift = (p, k) => ({ pad: p.pad.map((c) => c.map((m) => m + k)), root: p.root.map((m) => m + k) });

function piano(K, t0, m, len, g = 1, pan = 0) {
  const f = K.midi(m);
  K.add(K.MU, t0, len, (x) => {
    let s = 0;
    for (let h = 1; h <= 6; h++) s += Math.sin(K.TAU * f * h * (1 + 0.0004 * h * h) * x) * Math.exp(-x * (1.2 + h * 0.9)) / h;
    return s * Math.min(1, x / 0.004) * K.env(x, 0.003, len, 0.3);
  }, pan, 0.11 * g, 0.55);
}

const GENRES = {
  // Tech-house: soft intro, drop on shot 2, four-on-the-floor, offbeat bass, 16th plucks, bell hook.
  blob(K, ad, P, drop, end, kicks) {
    const { B, beat } = K;
    const HOOK = [[0, 76], [0.5, 79], [1, 81], [1.5, 79], [2, 76], [3, 74], [3.5, 76]];
    for (let b = 0; beat(b) < end; b++) {
      const t = beat(b), iB = b % 4, n = Math.floor(b / 4), ch = P.pad[n % 4], root = P.root[n % 4], full = t >= drop, breath = t >= drop - 0.5 && t < drop;
      if (iB === 0) ch.forEach((m, k) => K.saw(t, m, B * 4, { g: k ? 0.26 : 0.34, cut: full ? 2600 : 1400, att: 0.15, rel: 0.25, voices: k ? 2 : 3, send: 0.45, pan: (k - 1.5) * 0.3 }));
      const st = full ? 4 : 2, pat = [0, 2, 1, 3, 2, 1, 3, 2];
      for (let k = 0; k < st; k++) K.pluck(t + (k * B) / st, ch[pat[(iB * st + k) % 8]] + 12, full ? 0.75 : 0.9, k % 2 ? 0.45 : -0.45);
      if (!full) { if (iB === 1 || iB === 3) K.rim(t, 0.9); continue; }
      if (breath) continue;
      K.kick(t, 1.05); kicks.push(t);
      if (iB === 1 || iB === 3) K.clap(t, 1);
      K.hat(t + B / 2, true, 0.8, 0.25);
      for (let k = 0; k < 4; k++) K.shaker(t + (k * B) / 4, k === 2 ? 0.9 : 0.45);
      K.bass(t + B / 2, root, B * 0.42, 1); K.bass(t + B * 0.75, root + 12, B * 0.2, 0.45);
      if (iB === 0 && n % 2 === 0) for (const [o, m] of HOOK) K.fm(t + o * B, m + ad.key, 0.45, { g: 0.45, ratio: 3.5, index: 1.8, decay: 5, send: 0.4, pan: o % 1 ? 0.3 : -0.3 });
    }
  },
  // Trap: 808 slides, half-time clap, 8th hats with triplet rolls, a dark bell.
  kinetic(K, ad, P, drop, end, kicks) {
    const { B, beat } = K;
    const BELL = [[0, 74], [0.5, 77], [1, 81], [1.5, 79], [2, 77], [2.5, 74], [3, 76], [3.5, 77]];
    let last = null;
    for (let b = 0; beat(b) < end; b++) {
      const t = beat(b), iB = b % 4, n = Math.floor(b / 4), ch = P.pad[n % 4], root = P.root[n % 4];
      if (iB === 0) ch.forEach((m, k) => K.saw(t, m, B * 4, { g: k ? 0.4 : 0.55, cut: 1100, att: 0.08, rel: 0.2, voices: k ? 2 : 3, send: 0.35 }));
      if (iB === 0 || (iB === 1 && b % 8 === 5)) { const tk = t + (iB === 1 ? B * 0.5 : 0); K.kick(tk, 1.1); kicks.push(tk); }
      if (iB === 2) { K.clap(t, 1.2); K.snare(t, { g: 0.6 }); }
      if (iB === 0) { K.sub808(t, root, B * 1.4, { from: last, glide: 0.06 }); last = root; }
      if (iB === 3) { K.sub808(t + B * 0.5, root + 3, B * 0.5, { from: last, glide: 0.05 }); last = root + 3; }
      if (iB === 3 && b % 8 === 7) for (let k = 0; k < 6; k++) K.hat(t + (k * B) / 6, false, 0.5 + k * 0.1, 0.3);
      else for (let k = 0; k < 2; k++) K.hat(t + (k * B) / 2, false, k ? 0.6 : 0.9, 0.25);
      if (iB === 0 && n % 2 === 1) for (const [o, m] of BELL) K.fm(t + o * B, m + ad.key, 0.6, { g: 0.5, ratio: 3.5, index: 2.2, decay: 5, send: 0.4, pan: o % 1 ? 0.3 : -0.3 });
    }
  },
  // Nepali folk 6/8: harmonium, madal, shaker, a singing sarangi, bansuri answers.
  paper(K, ad, P, drop, end) {
    const E = 0.2, BAR = E * 6;
    const MEL = [[[0, 74, 2], [2, 76, 1], [3, 74, 1], [4, 71, 2], [6, 69, 1], [7, 71, 1], [8, 74, 2], [10, 71, 1], [11, 69, 1]], [[0, 67, 2], [2, 69, 1], [3, 71, 1], [4, 74, 2], [6, 76, 2], [8, 74, 1], [9, 71, 1], [10, 69, 2]]];
    for (let n = 0; n * BAR < end; n++) {
      const t = n * BAR, ch = P.pad[n % 4], root = P.root[n % 4], full = t >= drop;
      K.harmonium(t, ch, BAR + 0.1, { g: 0.9 });
      for (let e = 0; e < 6; e++) {
        const te = t + e * E;
        if (t >= 0.6) K.shaker(te, e % 3 === 0 ? 1 : 0.55, e % 2 ? 0.35 : -0.35);
        if (!full) continue;
        if (e === 0 || e === 3) K.madal(te, false, e === 0 ? 1 : 0.75);
        if (e === 2 || e === 4 || e === 5) K.madal(te, true, e === 5 ? 0.5 : 0.8);
      }
      if (full) { K.bass(t, root, E * 2.5, 0.9); K.bass(t + 3 * E, root + 7, E * 2, 0.7); }
      if (n % 2 === 0) for (const [o, m, l] of MEL[(n / 2) % 2]) if (t + o * E < end) K.sarangi(t + o * E, m + ad.key, l * E * 0.95, { g: 0.95 });
      if (full && n % 2 === 1) { K.flute(t + 3 * E, 79 + ad.key, 2, 0.5); K.flute(t + 5 * E, 81 + ad.key, 1, 0.45); }
    }
  },
  // House: four-on-the-floor, syncopated piano stabs, offbeat bass, plucks, filtered intro.
  swiss(K, ad, P, drop, end, kicks) {
    const { B, beat } = K;
    for (let b = 0; beat(b) < end; b++) {
      const t = beat(b), iB = b % 4, n = Math.floor(b / 4), ch = P.pad[n % 4], root = P.root[n % 4], full = t >= drop;
      for (const o of [0.5, 1.5, 2.75, 3.5]) if (iB === Math.floor(o)) K.stab(t + (o % 1) * B, ch, { g: full ? 1 : 0.7 });
      if (!full) continue;
      K.kick(t, 1); kicks.push(t);
      if (iB === 1 || iB === 3) K.clap(t, 1);
      K.hat(t + B / 2, true, 0.9, 0.2);
      for (let k = 0; k < 4; k++) K.shaker(t + (k * B) / 4, k === 2 ? 1 : 0.5);
      K.bass(t + B / 2, root, B * 0.45, 1); K.bass(t + B * 0.75, root + 12, B * 0.2, 0.5);
      for (let k = 0; k < 2; k++) K.pluck(t + (k * B) / 2, ch[(b * 2 + k) % 4] + 12, 0.7, k ? 0.4 : -0.4);
    }
  },
  // Synthwave: gated snare, 16th saw-bass arps, supersaw pad, saw lead, tom fills.
  neon(K, ad, P, drop, end, kicks) {
    const { B, beat } = K;
    const LEAD = [[[0, 76, 1], [1, 74, 0.5], [1.5, 72, 0.5], [2, 69, 1.5], [4, 72, 1], [5, 74, 0.5], [5.5, 76, 0.5], [6, 79, 2]], [[0, 81, 1], [1, 79, 0.5], [1.5, 76, 0.5], [2, 74, 1.5], [4, 72, 1], [5, 71, 0.5], [5.5, 69, 0.5], [6, 69, 2]]];
    for (let b = 0; beat(b) < end; b++) {
      const t = beat(b), iB = b % 4, n = Math.floor(b / 4), ch = P.pad[n % 4].slice(0, 3), root = P.root[n % 4], full = t >= drop;
      if (iB === 0) ch.forEach((m, k) => K.saw(t, m, B * 4, { g: 0.5, cut: (x) => 900 + 1400 * Math.min(1, x / 1.5), att: 0.25, rel: 0.3, voices: 3, detune: 0.01, send: 0.5, pan: (k - 1) * 0.5 }));
      for (let k = 0; k < 4; k++) K.saw(t + (k * B) / 4, root + (k % 2 ? 12 : 0), (B / 4) * 0.9, { g: 0.55, cut: 700 + 500 * (k % 2), att: 0.003, rel: 0.03, send: 0.05 });
      if (!full) continue;
      if (iB === 0 || iB === 2) { K.kick(t, 1); kicks.push(t); }
      if (iB === 1 || iB === 3) K.snare(t, { g: 0.9, gated: true, tone: 180 });
      for (let k = 0; k < 2; k++) K.hat(t + (k * B) / 2, false, k ? 0.5 : 0.8, 0.3);
      if (iB === 0 && n % 2 === 0) for (const [o, m, l] of LEAD[(n / 2) % 2]) if (t + o * B < end) K.saw(t + o * B, m + ad.key, l * B * 0.95, { g: 0.5, cut: 3200, att: 0.02, rel: 0.12, vib: 0.006, send: 0.45, sendBus: K.DL });
    }
    [0, 0.25, 0.5, 0.75].forEach((o, k) => K.tom(drop - B + o * B, 180 - k * 30, 0.9, (k - 1.5) * 0.3));
  },
  // Lo-fi: Rhodes 7ths, swung dusty drums, round bass, vinyl.
  pov(K, ad, P, drop, end, kicks) {
    const { B, beat } = K;
    K.vinyl(1);
    for (let b = 0; beat(b) < end; b++) {
      const t = beat(b), iB = b % 4, n = Math.floor(b / 4), ch = P.pad[n % 4], root = P.root[n % 4], full = t >= drop;
      if (iB === 0) ch.forEach((m, k) => K.rhodes(t + k * 0.02, m, B * 4, { g: 1.8 - k * 0.1, pan: k === 3 ? 0.2 : 0 }));
      if (iB === 2 && n % 2 === 1) { K.rhodes(t, ch[3] + 12, B * 0.9, { g: 1.4, pan: 0.3 }); K.rhodes(t + B * 0.75, ch[2] + 12, B * 1.2, { g: 1.2, pan: 0.3 }); }
      if (!full) { if (iB === 0) { K.kick(t, 0.5); kicks.push(t); } if (iB === 2) K.rim(t, 0.8); continue; }
      if (iB === 0 || (iB === 1 && n % 2) || (iB === 2 && b % 8 === 6)) { const tk = iB === 1 ? t + B * 0.75 : t; K.kick(tk, 0.8); kicks.push(tk); }
      if (iB === 1 || iB === 3) K.snare(t, { g: 0.55, tone: 170 });
      for (let k = 0; k < 2; k++) K.hat(t + k * (B / 2) + (k ? B * 0.12 : 0), false, k ? 0.45 : 0.7, 0.2);
      if (iB === 0) K.bass(t, root, B * 1.5, 0.5);
      if (iB === 2) K.bass(t + B * 0.5, root + 7, B, 0.4);
    }
  },
  // Cinema: slow piano arpeggios, strings swelling in, a low timpani roll into the logo.
  cinema(K, ad, P, drop, end) {
    const { B, beat } = K;
    for (let b = 0; beat(b) < end; b++) {
      const t = beat(b), iB = b % 4, n = Math.floor(b / 4), ch = P.pad[n % 4], root = P.root[n % 4];
      const swell = Math.min(1, t / (end * 0.7));
      if (iB === 0) {
        K.saw(t, root + 12, B * 4 + 0.3, { g: 0.25 + 0.3 * swell, cut: 1200 + 800 * swell, att: 0.8, rel: 0.6, voices: 4, detune: 0.008, send: 0.7 });
        ch.forEach((m, k) => K.saw(t, m + 12, B * 4 + 0.3, { g: (0.12 + 0.2 * swell), cut: 1500 + 900 * swell, att: 1.0, rel: 0.7, voices: 3, detune: 0.007, send: 0.7, pan: (k - 1.5) * 0.4 }));
        K.bass(t, root, B * 3.5, 0.35 + 0.3 * swell);
      }
      const arp = [0, 1, 2, 3, 2, 1];
      for (let k = 0; k < 2; k++) piano(K, t + (k * B) / 2, ch[arp[(iB * 2 + k) % 6]] + 12, 1.6, 0.9 - 0.1 * k, k ? 0.25 : -0.25);
      if (iB === 0 && n % 2 === 1) piano(K, t, ch[3] + 24, 2.2, 0.7, 0.35);
    }
    for (let k = 0; k < 14; k++) K.tom(drop - 1.2 + k * 0.085, 70, 0.25 + k * 0.04, 0);
  },
};

for (const id of ids) {
  const ad = STUDIO.byId[id];
  const sk = ad.skin, bpm = STUDIO.SKINS[sk].bpm;
  const pk = { blob: 'minor', kinetic: 'trap', paper: 'folk', swiss: 'minor', neon: 'minor', pov: 'lofi', cinema: 'cinema' }[sk];
  const P = shift(PROG[pk], ad.key);
  const K = createKit({ DUR: ad.TOTAL, BPM: sk === 'paper' ? 300 : bpm, G0: 0, chords: P.pad.map((pad, i) => ({ pad, bass: P.root[i] })) });
  const logo = ad.shots.find((s) => s.type === 'logo');
  const drop = sk === 'kinetic' ? 0 : sk === 'cinema' ? (logo ? logo.t : ad.shots[ad.shots.length - 1].t) : ad.shots[1].t;
  const end = ad.TOTAL - 1.25;
  const kicks = [];
  GENRES[sk](K, ad, P, drop, end, kicks);
  // Into the drop, and the end.
  if (drop > 0.8 && sk !== 'cinema') K.riser(Math.max(0, drop - 1.2), Math.min(1.2, drop), 0.8);
  if (sk === 'cinema') K.riser(Math.max(0, drop - 1.5), 1.5, 0.5);
  K.impact(end, sk === 'cinema' ? 0.8 : 1.1);
  if (sk !== 'cinema' && sk !== 'paper') { K.kick(end, 1.2); kicks.push(end); }
  const last = P.pad[0];
  if (sk === 'cinema') { last.forEach((m, k) => piano(K, end + k * 0.06, m + 12, 2.5, 0.9)); K.fm(end + 0.1, last[3] + 24, 1.4, { g: 0.5, ratio: 3.5, index: 1.5, decay: 2.5, send: 0.7 }); }
  else if (sk === 'paper') { K.harmonium(end, last, ad.TOTAL - end, { g: 1.2 }); K.fm(end, last[3] + 12, 1.6, { g: 0.7, ratio: 3.5, index: 2, decay: 2.5, send: 0.6 }); K.madal(end, false, 1.1); }
  else K.saw(end, last[0], ad.TOTAL - end, { g: 0.45, cut: 2200, voices: 3, att: 0.01, rel: 0.2, send: 0.7 });

  // Cues, in the skin's flavour.
  const soft = sk === 'cinema' ? 0.45 : 1;
  const tick = (t, i) => K.add(K.FX, t, 0.05, (x) => Math.sin(K.TAU * (2600 + (i % 4) * 180) * x) * Math.exp(-x * 90), ((i % 3) - 1) * 0.3, 0.06 * soft);
  const click = (t) => K.add(K.FX, t, 0.06, (x) => (K.noise() * 0.5 + Math.sin(K.TAU * 3200 * x)) * Math.exp(-x * 120) + Math.sin(K.TAU * 700 * x) * Math.exp(-x * 60) * 0.6, 0.1, 0.16);
  const key = (t, i) => K.add(K.FX, t, 0.04, (x) => Math.exp(-x * 110) * (K.noise() * 0.7 + Math.sin(K.TAU * (1900 + (i % 5) * 90) * x) * 0.5), ((i % 3) - 1) * 0.2, 0.07);
  const ding = (t, i) => [0, 0.07].forEach((d, k) => K.add(K.FX, t + d, 0.25, (x) => Math.sin(K.TAU * (k ? 1568 : 1175) * x) * Math.exp(-x * 14), ((i % 3) - 1) * 0.3, 0.07));
  for (const c of STUDIO.cues(ad)) {
    if (c.kind === 'whoosh') { if (sk !== 'cinema') K.whoosh(c.t, sk === 'kinetic' ? 1.1 : 0.9); }
    else if (c.kind === 'big') { K.whoosh(c.t + 0.1, 1.2); K.whoosh(c.t + 0.9, 1.3); }
    else if (c.kind === 'tick') tick(c.t, c.i);
    else if (c.kind === 'slam') { if (sk === 'kinetic') { K.impact(c.t, 0.45); K.sub808(c.t, P.root[0] + 12, 0.35, { g: 0.5 }); } else { K.impact(c.t, 0.4); } }
    else if (c.kind === 'pop') K.pop(c.t, c.i);
    else if (c.kind === 'click') click(c.t);
    else if (c.kind === 'type') key(c.t, c.i);
    else if (c.kind === 'ding') ding(c.t, c.i);
    else if (c.kind === 'chime') K.chime(c.t);
    else if (c.kind === 'hit') K.impact(c.t, c.t === 0 ? 0.55 : 0.7);
  }
  const dir = new URL(`./out/studio/${id}/`, import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  const r = K.mixdown(new URL('audio.wav', dir), { kicks, duckDepth: sk === 'pov' ? 0.35 : sk === 'cinema' || sk === 'paper' ? 0 : 0.5, verb: sk === 'cinema' ? 0.32 : sk === 'paper' ? 0.3 : 0.2, lofi: sk === 'pov' ? 0.45 : 0, delay: sk === 'paper' ? 1.5 : 0.75 });
  console.log(`${id.padEnd(30)} ${sk.padEnd(8)} peak ${r.peak.toFixed(2)}`);
}
