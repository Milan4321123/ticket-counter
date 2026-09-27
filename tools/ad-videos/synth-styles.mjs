// node synth-styles.mjs hype warm pov reasons neon → out/dashain/styles/<id>/audio.wav
//
// Five 15-second tracks in five genres, all made from scratch with kit.mjs
// and cut to the edit in styles/specs.js:
//   hype    — trap, 140 bpm: 808 slides, hi-hat rolls, a dark bell hook, stop-time slams
//   warm    — Nepali folk in 6/8: madal, shaker, harmonium, a singing sarangi, bansuri answers
//   pov     — lo-fi hip-hop, 84 bpm: Rhodes 7ths, swung dusty drums, vinyl, a tape stop on the meme
//   reasons — house, 124 bpm: four-on-the-floor, piano stabs, offbeat bass, a filter-swept intro
//   neon    — synthwave, 100 bpm: gated snare, 16th saw-bass arps, supersaw pad, saw lead, tom fills
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createKit } from './kit.mjs';

const require = createRequire(import.meta.url);
const { S } = require('./styles/specs.js');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(S);

function out(id) {
  const dir = new URL(`./out/dashain/styles/${id}/`, import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  return new URL('audio.wav', dir);
}
// Sound effects every track shares: taps, whooshes on cuts, the ticket's chime.
function sfx(K, s, cuts = []) {
  for (const [t] of s.taps || []) K.tap(t);
  for (const t of cuts) K.whoosh(t, 0.9);
  if (s.ticketAt) K.chime(s.ticketAt + 0.15);
}

const SONGS = {
  hype(s) {
    const K = createKit({ DUR: s.TOTAL, BPM: s.BPM, G0: s.G0, chords: [
      { pad: [62, 65, 69], bass: 38 }, { pad: [58, 62, 65], bass: 34 }, { pad: [55, 58, 62], bass: 31 }, { pad: [57, 61, 64], bass: 33 }] });
    const { B, beat, chordAt } = K;
    const kicks = [];
    const BELL = [[[0, 74], [0.5, 77], [1, 81], [1.5, 79], [2, 77], [2.5, 74], [3, 76], [3.5, 77]], [[0, 74], [0.5, 77], [1, 81], [1.5, 84], [2, 82], [2.5, 81], [3, 77], [3.5, 76]]];
    K.riser(0, s.G0, 1.2);
    const groove = (b) => (b >= 0 && b < 8) || (b >= 9.5 && b < 24) || (b >= 28 && b < 32);
    let last808 = null;
    for (let b = 0; b < 32; b++) {
      const t = beat(b), inBar = b % 4, c = chordAt(b);
      if (b < 8) { K.impact(t, b === 0 || b === 4 ? 1 : 0.35); }   // a hit on every word
      if (!groove(b) && !(b >= 8 && b < 9.5)) continue;
      if (b >= 8 && b < 9.5) { if (b === 8) { K.sub808(t, c.bass + 12, B * 1.4, { from: c.bass + 19, glide: 0.25, g: 0.9 }); K.riser(t, beat(9.5) - t, 0.8); } continue; }
      if (inBar === 0) { K.saw(t, c.pad[0], B * 4, { g: 0.55, cut: 1100, att: 0.08, rel: 0.2, voices: 3, send: 0.35 }); for (const m of c.pad.slice(1)) K.saw(t, m, B * 4, { g: 0.4, cut: 1100, att: 0.08, rel: 0.2, voices: 2, send: 0.35 }); }
      // Kick on 1 and the "and" of 2; clap on 3 (half-time).
      if (inBar === 0 || (inBar === 1 && b % 8 === 5)) { K.kick(t + (inBar === 1 ? B * 0.5 : 0), 1.1); kicks.push(t + (inBar === 1 ? B * 0.5 : 0)); }
      if (inBar === 2) { K.clap(t, 1.2); K.snare(t, { g: 0.6 }); }
      // 808: the root, sliding up a third and back.
      if (inBar === 0) { K.sub808(t, c.bass, B * 1.4, { from: last808, glide: 0.06 }); last808 = c.bass; }
      if (inBar === 1 && b % 8 === 5) { K.sub808(t + B * 0.5, c.bass + 3, B * 0.9, { from: c.bass, glide: 0.07 }); last808 = c.bass + 3; }
      if (inBar === 3) { K.sub808(t + B * 0.5, c.bass, B * 0.5, { from: last808, glide: 0.05 }); last808 = c.bass; }
      // Hats: 8ths, with a triplet roll at the end of every other bar.
      if (inBar === 3 && b % 8 === 7) for (let k = 0; k < 6; k++) K.hat(t + (k * B) / 6, false, 0.5 + k * 0.1, 0.3);
      else for (let k = 0; k < 2; k++) K.hat(t + (k * B) / 2, false, k ? 0.6 : 0.9, 0.25);
      if (inBar === 3 && b % 8 === 3) K.hat(t + B * 0.5, true, 0.7);
      // The bell hook (hook, phone and end card).
      if (inBar === 0) for (const [o, m] of BELL[Math.floor(b / 4) % 2]) K.fm(t + o * B, m, 0.6, { g: 0.55, ratio: 3.5, index: 2.2, decay: 5, send: 0.4, pan: (o % 1 ? 0.3 : -0.3) });
    }
    // Urgency: a snare roll into the slams.
    for (let k = 0; k < 16; k++) K.snare(beat(22) + (k * B * 2) / 16, { g: 0.35 + 0.5 * (k / 16) });
    K.riser(beat(22), beat(24) - beat(22), 1);
    K.impact(s.urgency[0] + B, 0.8);   // the SOLD OUT stamp
    s.slams.forEach((t, i) => { K.impact(t, 1.1); K.kick(t, 1.3); K.sub808(t, 38 - i * 2, B * 0.9, { g: 1 }); kicks.push(t); });
    K.whoosh(beat(27.3), 1);
    K.impact(s.finalHit, 1.2); K.kick(s.finalHit, 1.3); K.sub808(s.finalHit, 38, 1.2, { g: 1 });
    sfx(K, s, [s.linkAt, s.phone, s.urgency[0], s.endCard]);
    K.tap(s.linkTap);
    return K.mixdown(out('hype'), { kicks, duckDepth: 0.6, verb: 0.16 });
  },

  warm(s) {
    const E = s.B, BAR = E * 6;
    const K = createKit({ DUR: s.TOTAL, BPM: s.BPM, G0: s.G0 });
    const bar = (n) => s.G0 + n * BAR;
    // G major: G – C – D – G | G – Em – C – D.
    const CH = [[55, 59, 62, 67], [55, 60, 64, 67], [54, 57, 62, 66], [55, 59, 62, 67], [55, 59, 62, 67], [52, 55, 59, 64], [55, 60, 64, 67], [54, 57, 62, 66]];
    const ROOT = [43, 48, 50, 43, 43, 40, 48, 50];
    const MEL = [
      [[0, 74, 2], [2, 76, 1], [3, 74, 1], [4, 71, 2], [6, 69, 1], [7, 71, 1], [8, 74, 2], [10, 71, 1], [11, 69, 1]],
      [[0, 67, 2], [2, 69, 1], [3, 71, 1], [4, 74, 2], [6, 76, 2], [8, 74, 1], [9, 71, 1], [10, 69, 2]],
    ];
    const invite = s.invite, cta = s.cta;
    const NB = Math.ceil((s.TOTAL - s.G0) / BAR);
    for (let n = 0; n < NB; n++) {
      const t = bar(n);
      if (t > s.finalHit - 0.01) break;
      const ch = CH[n % 8], full = t >= invite - 0.01, big = t >= cta - 0.01;
      K.harmonium(t, ch, BAR + 0.1, { g: big ? 1.1 : 0.9 });
      // Madal: dhin · ta · dhin ta ta, shaker on every eighth.
      for (let e = 0; e < 6; e++) {
        const te = t + e * E;
        if (t >= 1.4) K.shaker(te, e % 3 === 0 ? 1 : 0.55, e % 2 ? 0.35 : -0.35);
        if (!full) continue;
        if (e === 0 || e === 3) K.madal(te, false, e === 0 ? 1 : 0.75);
        if (e === 2 || e === 4 || e === 5) K.madal(te, true, e === 5 ? 0.5 : 0.8);
      }
      if (full) { K.bass(t, ROOT[n % 8], E * 2.5, 0.9); K.bass(t + 3 * E, ROOT[n % 8] + 7, E * 2, 0.7); }
      // Sarangi sings the tune (two bars per phrase); the flute answers in the gaps.
      if (n % 2 === 0) for (const [o, m, l] of MEL[(n / 2) % 2]) K.sarangi(t + o * E, m, l * E * 0.95, { g: t >= 11 ? 1.1 : 0.95 });
      if (full && n % 2 === 1) { K.flute(t + 3 * E, 79, 2, 0.5); K.flute(t + 5 * E, 81, 1, 0.45); }
      if (big) { K.tom(t + 4.5 * E, 110, 0.6, -0.3); K.tom(t + 5 * E, 90, 0.7, 0.3); K.tom(t + 5.5 * E, 75, 0.8, 0); }
    }
    // The last chord, with a bell.
    K.harmonium(s.finalHit, [55, 59, 62, 67, 71], s.TOTAL - s.finalHit, { g: 1.2 });
    K.bass(s.finalHit, 43, 0.8, 1);
    K.fm(s.finalHit, 79, 1.6, { g: 0.7, ratio: 3.5, index: 2, decay: 2.5, send: 0.6 });
    K.madal(s.finalHit, false, 1.1);
    sfx(K, s, [invite, s.phone, cta]);
    for (let i = 1; i < 4; i++) K.chime(s.ticketAt + 0.15 + i * 0.15);
    K.pop(s.total.at, 2);
    return K.mixdown(out('warm'), { kicks: [], verb: 0.3, delay: 1.5 });
  },

  pov(s) {
    const K = createKit({ DUR: s.TOTAL, BPM: s.BPM, G0: s.G0 });
    const { B, beat } = K;
    const CH = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
    const ROOT = [41, 40, 38, 36];
    const [ts0, ts1] = s.tapeStop;
    const kicks = [];
    K.vinyl(1);
    // The opening (before the grid's first bar): the Cmaj7 and a soft kick/rim.
    { const ch = CH[3];
      ch.forEach((m, i) => K.rhodes(0.05 + i * 0.02, m, beat(Math.ceil(-s.G0 / B) + 3) - 0.05, { g: 1.8 - i * 0.1 }));
      for (let t = 0.05; t < beat(3); t += B * 2) { K.kick(t, 0.5); kicks.push(t); K.rim(t + B, 0.8); } }
    // Beat numbers: the drop (the phone) is on a bar line.
    const b0 = Math.ceil((0 - s.G0) / B), bEnd = Math.floor((s.TOTAL - s.G0) / B);
    for (let b = b0 - 1; b <= bEnd; b++) {
      const t = beat(b);
      if (t < -0.01 || (t >= ts1 - 0.01 && t < s.phone - 0.01)) continue;
      const inBar = ((b % 4) + 4) % 4, n = Math.floor(b / 4), ch = CH[((n % 4) + 4) % 4];
      const intro = t < ts1;
      if (inBar === 0) {
        K.rhodes(t, ch[0], B * 4, { g: 1.8 }); K.rhodes(t + 0.02, ch[1], B * 4, { g: 1.7 });
        K.rhodes(t + 0.04, ch[2], B * 4, { g: 1.6 }); K.rhodes(t + 0.06, ch[3], B * 4, { g: 1.5, pan: 0.2 });
      }
      // A little top-line on the Rhodes, every other bar.
      if (inBar === 2 && n % 2 === 1) { K.rhodes(t, ch[3] + 12, B * 0.9, { g: 1.4, pan: 0.3 }); K.rhodes(t + B * 0.75, ch[2] + 12, B * 1.2, { g: 1.2, pan: 0.3 }); }
      const swing = B * 0.12;
      if (intro) { if (inBar === 0) { K.kick(t, 0.5); kicks.push(t); } if (inBar === 2) K.rim(t, 0.8); continue; }
      if (inBar === 0 || (inBar === 1 && n % 2) || inBar === 2 && b % 8 === 6) { const tk = inBar === 1 ? t + B * 0.75 : t; K.kick(tk, 0.8); kicks.push(tk); }
      if (inBar === 1 || inBar === 3) K.snare(t, { g: 0.55, tone: 170 });
      for (let k = 0; k < 2; k++) K.hat(t + k * (B / 2) + (k ? swing : 0), false, k ? 0.45 : 0.7, 0.2);
      if (inBar === 0) K.bass(t, ROOT[((n % 4) + 4) % 4], B * 1.5, 0.5);
      if (inBar === 2) K.bass(t + B * 0.5, ROOT[((n % 4) + 4) % 4] + 7, B * 1.0, 0.4);
    }
    // Typing, caption pops, the ticket.
    const ty = s.typing;
    for (let i = 0; i < ty.text.length; i++) {
      const t = ty.a + ((i + 0.5) * (ty.b - ty.a)) / ty.text.length;
      K.add(K.FX, t, 0.05, (x) => Math.exp(-x * 90) * (K.noise() * 0.6 + Math.sin(K.TAU * 2400 * x)), ((i % 3) - 1) * 0.2, 0.08);
    }
    for (const [t] of s.captions) K.pop(t, 1);
    K.pop(0.25, 0); K.pop(s.meme, 3);
    [0.15, 0.4, 0.7, 1.0, 1.4].forEach((d, i) => K.pop(s.endCard + d, i));
    sfx(K, s, [s.phone, s.endCard]);
    return K.mixdown(out('pov'), { kicks, lofi: 0.45, tapeStop: s.tapeStop, verb: 0.25, duckDepth: 0.35 });
  },

  reasons(s) {
    const K = createKit({ DUR: s.TOTAL, BPM: s.BPM, G0: s.G0 });
    const { B, beat } = K;
    const CH = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 60, 64, 67], [55, 59, 62, 67]];
    const ROOT = [45, 41, 48, 43];
    const kicks = [];
    const drop = 2, stepsB = 12.5, build = 23, cta = 24, fin = 30;
    for (let b = 0; b < fin; b++) {
      const t = beat(b), inBar = b % 4, n = Math.floor(b / 4), ch = CH[n % 4];
      const full = (b >= drop && b < stepsB) || (b >= cta && b < fin);
      const steps = b >= stepsB && b < build;
      // Piano stabs: syncopated, filtered in the intro.
      if (b < drop || full) for (const o of [0.5, 1.5, 2.75, 3.5]) if (inBar === Math.floor(o)) K.stab(t + (o % 1) * B, ch, { g: b < drop ? 0.7 : 1 });
      if (full || steps) {
        K.kick(t, 1); kicks.push(t);
        if (inBar === 1 || inBar === 3) K.clap(t, 1);
        K.hat(t + B / 2, true, 0.9, 0.2);
        for (let k = 0; k < 4; k++) K.shaker(t + (k * B) / 4, k === 2 ? 1 : 0.5);
        K.bass(t + B / 2, ROOT[n % 4], B * 0.45, 1); K.bass(t + B * 0.75, ROOT[n % 4] + 12, B * 0.2, 0.5);
      }
      if (steps) for (let k = 0; k < 2; k++) K.pluck(t + (k * B) / 2, ch[(b * 2 + k) % 4] + 12, 0.8, k ? 0.4 : -0.4);
      if (b >= cta && inBar === 0) for (const [o, m] of [[0, 76], [0.75, 79], [1.5, 81], [2.5, 79], [3, 76]]) K.fm(t + o * B, m, 0.5, { g: 0.5, ratio: 1, index: 1.2, decay: 4 });
    }
    K.riser(0, beat(drop), 0.8);
    K.impact(beat(drop), 0.9);
    for (let k = 0; k < 8; k++) K.snare(beat(build) + (k * B) / 8, { g: 0.3 + 0.6 * k / 8 });
    K.riser(beat(build - 2), beat(cta) - beat(build - 2), 0.9);
    K.impact(beat(cta), 1); K.kick(beat(cta), 1.2);
    K.impact(s.finalHit, 1.1); K.kick(s.finalHit, 1.2); K.stab(s.finalHit, CH[0], { g: 1.3, len: 1.2 });
    for (const t of s.reasons) K.pop(t, 2);
    s.ticks.forEach((t, i) => K.pop(t, i));
    sfx(K, s, [...s.reasons, s.steps, s.cta]);
    return K.mixdown(out('reasons'), { kicks, sweep: [0, beat(drop)], duckDepth: 0.5, verb: 0.18 });
  },

  neon(s) {
    const K = createKit({ DUR: s.TOTAL, BPM: s.BPM, G0: s.G0 });
    const { B, beat } = K;
    const CH = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
    const ROOT = [45, 41, 48, 43];
    const LEAD = [[[0, 76, 1], [1, 74, 0.5], [1.5, 72, 0.5], [2, 69, 1.5], [4, 72, 1], [5, 74, 0.5], [5.5, 76, 0.5], [6, 79, 2]],
      [[0, 81, 1], [1, 79, 0.5], [1.5, 76, 0.5], [2, 74, 1.5], [4, 72, 1], [5, 71, 0.5], [5.5, 69, 0.5], [6, 69, 2]]];
    const kicks = [];
    const cta = 19, fin = 24;
    K.riser(0, s.G0 + B, 0.6);
    for (let b = 0; b < fin; b++) {
      const t = beat(b), inBar = b % 4, n = Math.floor(b / 4), ch = CH[n % 4], root = ROOT[n % 4];
      const drums = b >= 2;
      if (inBar === 0) for (const [k, m] of ch.entries()) K.saw(t, m, B * 4, { g: 0.5, cut: (x) => 900 + 1400 * Math.min(1, x / 1.5), att: 0.25, rel: 0.3, voices: 3, detune: 0.01, send: 0.5, pan: (k - 1) * 0.5 });
      // The arp bass: 16ths, root and octave.
      for (let k = 0; k < 4; k++) K.saw(t + (k * B) / 4, root + (k % 2 ? 12 : 0) - 12, B / 4 * 0.9, { g: 0.55, cut: 700 + 500 * (k % 2), att: 0.003, rel: 0.03, send: 0.05 });
      if (drums) {
        if (inBar === 0 || inBar === 2) { K.kick(t, 1); kicks.push(t); }
        if (inBar === 1 || inBar === 3) K.snare(t, { g: 0.9, gated: true, tone: 180 });
        for (let k = 0; k < 2; k++) K.hat(t + (k * B) / 2, false, k ? 0.5 : 0.8, 0.3);
      }
      // The lead: in the billboard + phone (bars 1–4) and the finale.
      if (inBar === 0 && ((b >= 4 && b < 16) || b >= cta + 1) && n % 2 === 0) {
        for (const [o, m, l] of LEAD[(n / 2) % 2]) if (b + o < fin) K.saw(t + o * B, m, l * B * 0.95, { g: 0.55, cut: 3200, att: 0.02, rel: 0.12, vib: 0.006, send: 0.45, sendBus: K.DL });
      }
    }
    // Tom fills: into the billboard and into the finale.
    for (const b0 of [3, cta - 1]) [0, 0.25, 0.5, 0.75].forEach((o, k) => K.tom(beat(b0) + o * B, 180 - k * 30, 0.9, (k - 1.5) * 0.3));
    K.impact(beat(cta), 1);
    K.impact(s.finalHit, 1.1); K.kick(s.finalHit, 1.2);
    K.saw(s.finalHit, 57, s.TOTAL - s.finalHit, { g: 0.6, cut: 1800, voices: 3, att: 0.01, rel: 0.2, send: 0.7 });
    // The scanner.
    [0, 0.09].forEach((d) => K.add(K.FX, s.camera.lock + d, 0.07, (x) => Math.sin(K.TAU * 1760 * x) * Math.exp(-x * 20), 0, 0.08));
    K.add(K.FX, s.camera.banner, 0.8, (x) => (Math.sin(K.TAU * 1318.5 * x) + 0.4 * Math.sin(K.TAU * 1975.5 * x)) * Math.exp(-x * 6), 0, 0.06, 0.4);
    // Neon hum on each sign.
    for (const t of [...s.signs, s.billboard + 0.1, s.cta + 0.05, s.cta + 0.35]) K.add(K.FX, t, 0.45, (x) => Math.sin(K.TAU * 100 * x) * (Math.floor(x * 20) % 3 ? 1 : 0.2) * Math.exp(-x * 3), 0, 0.05);
    sfx(K, s, [s.billboard, s.phone, s.cta]);
    return K.mixdown(out('neon'), { kicks, verb: 0.3, duckDepth: 0.45 });
  },
};

for (const id of ids) {
  const r = SONGS[id](S[id]);
  console.log(`${id}: peak ${r.peak.toFixed(2)} drive ${r.drive.toFixed(2)}`);
}
