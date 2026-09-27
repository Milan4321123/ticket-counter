// The soundtrack kit shared by the ads: buses, a seeded noise source, the
// instruments (kick, clap, hats, madal, 808 bass, pad, Karplus–Strong pluck,
// bansuri-like flute), the effects (riser, impact, whoosh, tap, pop, coin,
// chime) and the mixdown (sidechain, filter sweep, ping-pong delay, reverb,
// soft clip → 16-bit WAV). synth.mjs (the long ad) and synth-shorts.mjs use it.
import fs from 'node:fs';

export function createKit({ DUR, BPM, G0, transpose = 0, chords = null }) {
  const SR = 44100;
  const N = Math.ceil(DUR * SR);
  const B = 60 / BPM, BAR = B * 4;
  const beat = (b) => G0 + b * B;

  // Buses: drums (dry, drive the sidechain), music (ducked by the kick),
  // fx (dry effects), and a reverb send.
  const mk = () => [new Float32Array(N), new Float32Array(N)];
  const DR = mk(), MU = mk(), FX = mk(), RV = mk(), DL = mk();

  let seed = 99;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const TAU = Math.PI * 2;

  function add(bus, t0, len, fn, pan = 0, gain = 1, send = 0, sendBus = RV) {
    const s0 = Math.max(0, Math.floor(t0 * SR)), s1 = Math.min(N, Math.floor((t0 + len) * SR));
    const gl = gain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2;
    const gr = gain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    for (let i = s0; i < s1; i++) {
      const v = fn((i - s0) / SR, i / SR);
      bus[0][i] += v * gl; bus[1][i] += v * gr;
      if (send) { sendBus[0][i] += v * gl * send; sendBus[1][i] += v * gr * send; }
    }
  }
  const env = (t, a, len, r) => (t < a ? t / a : t > len - r ? Math.max(0, (len - t) / r) : 1);

  // D minor (shifted by `transpose`): Dm – Bb – C – Am, one chord a bar.
  const CH = [
    { pad: [62, 65, 69, 74], bass: 38 },
    { pad: [58, 62, 65, 70], bass: 34 },
    { pad: [60, 64, 67, 72], bass: 36 },
    { pad: [57, 60, 64, 69], bass: 33 },
  ].map((c) => ({ pad: c.pad.map((m) => m + transpose), bass: c.bass + transpose }));
  if (chords) CH.splice(0, 4, ...chords);
  const chordAt = (b) => CH[((Math.floor(b / 4) % 4) + 4) % 4];

  // ---------------- Instruments ----------------
  function kick(t0, g = 1) {
    add(DR, t0, 0.45, (x) => {
      const f = 42 + 110 * Math.exp(-x * 28);
      const ph = TAU * (42 * x + (110 / 28) * (1 - Math.exp(-x * 28)));
      return (Math.sin(ph) * Math.exp(-x * 7.5) + 0.35 * Math.exp(-x * 300) * noise()) * (f > 0 ? 1 : 0);
    }, 0, 0.55 * g);
  }
  function clap(t0, g = 1) {
    let bp = 0, lp = 0;
    add(DR, t0, 0.35, (x) => {
      const n = noise();
      lp += 0.35 * (n - lp); bp = n - lp; // crude high-pass
      const bursts = x < 0.03 ? (Math.floor(x / 0.01) % 2 === 0 ? 1 : 0.3) : 1;
      return bp * bursts * Math.exp(-x * 16);
    }, 0.05, 0.22 * g, 0.25);
  }
  function hat(t0, open = false, g = 1, pan = 0.25) {
    let hp = 0, last = 0;
    add(DR, t0, open ? 0.25 : 0.06, (x) => {
      const n = noise(); hp = 0.9 * (hp + n - last); last = n;
      return hp * Math.exp(-x * (open ? 14 : 75));
    }, pan, (open ? 0.07 : 0.06) * g);
  }
  // Madal-like hand drum: "dhin" (low, bending down) and "ta" (high, dry).
  function madal(t0, high, g = 1) {
    const f0 = high ? 330 : 150, f1 = high ? 280 : 105;
    add(DR, t0, high ? 0.18 : 0.4, (x) => {
      const f = f1 + (f0 - f1) * Math.exp(-x * 30);
      return (Math.sin(TAU * f * x) + 0.4 * Math.sin(TAU * f * 1.51 * x) * Math.exp(-x * 20)) * Math.exp(-x * (high ? 22 : 9)) + 0.25 * noise() * Math.exp(-x * 120);
    }, high ? 0.35 : -0.3, 0.2 * g, 0.12);
  }
  function snareHit(t0, g = 1) {
    add(DR, t0, 0.2, (x) => (0.7 * noise() + 0.5 * Math.sin(TAU * 190 * x)) * Math.exp(-x * 22), 0, 0.16 * g, 0.2);
  }
  function bass(t0, m, len, g = 1) {
    const f = midi(m);
    add(MU, t0, len, (x) => {
      const e = env(x, 0.006, len, 0.06);
      const s = Math.sin(TAU * f * x) + 0.18 * Math.sin(TAU * 2 * f * x) + 0.08 * Math.sin(TAU * 3 * f * x);
      return Math.tanh(1.6 * s) * e;
    }, 0, 0.3 * g);
  }
  function pad(t0, notes, len, g = 1, bright = 1) {
    notes.forEach((m, k) => {
      const f = midi(m);
      add(MU, t0, len, (x) => {
        const e = env(x, 0.25, len, 0.5);
        let s = 0;
        for (let h = 1; h <= 5; h++) {
          const a = Math.pow(1 / h, 1.4 - 0.5 * bright);
          s += a * (Math.sin(TAU * f * h * x) + Math.sin(TAU * f * 1.006 * h * x + 1.3));
        }
        return e * s * 0.5;
      }, (k - 1.5) * 0.45, 0.018 * g, 0.5);
    });
  }
  // Karplus–Strong pluck.
  function pluck(t0, m, g = 1, pan = 0) {
    const f = midi(m), L = Math.max(2, Math.round(SR / f));
    const buf = new Float32Array(L);
    for (let i = 0; i < L; i++) buf[i] = noise();
    let idx = 0;
    add(MU, t0, 0.9, () => {
      const a = buf[idx], b = buf[(idx + 1) % L];
      buf[idx] = 0.497 * (a + b);
      idx = (idx + 1) % L;
      return a;
    }, pan, 0.13 * g, 0.25, DL);
  }
  // Bansuri-like flute: breathy sine with a scoop into the note and vibrato.
  function flute(t0, m, lenB, g = 1) {
    const f = midi(m), len = lenB * B + 0.12;
    let lp = 0;
    add(MU, t0, len, (x) => {
      const scoop = Math.pow(2, (-0.6 * Math.exp(-x * 40)) / 12);
      const vib = 1 + 0.006 * Math.sin(TAU * 5.4 * x) * Math.min(1, x / 0.25);
      const ph = TAU * f * x * scoop * vib;
      const n = noise(); lp += 0.08 * (n - lp);
      const e = env(x, 0.035, len, 0.1);
      return e * (Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.06 * Math.sin(3 * ph) + 0.9 * lp);
    }, -0.08, 0.13 * g, 0.35, DL);
  }

  // ---------------- Effects ----------------
  function riser(t0, len, g = 1) {
    let lp = 0;
    add(FX, t0, len, (x) => {
      const k = x / len;
      const cut = 0.01 + 0.4 * k * k;
      lp += cut * (noise() - lp);
      const tone = Math.sin(TAU * (200 * x + 600 * x * x / len)) * 0.25;
      return (lp * 1.4 + tone) * k * k;
    }, 0, 0.22 * g, 0.4);
  }
  function impact(t0, g = 1) {
    add(FX, t0, 2.2, (x) => Math.sin(TAU * (30 * x + (40 / 6) * (1 - Math.exp(-x * 6)))) * Math.exp(-x * 2.2), 0, 0.5 * g);
    let hp = 0, last = 0;
    add(FX, t0, 1.8, (x) => { const n = noise(); hp = 0.97 * (hp + n - last); last = n; return hp * Math.exp(-x * 3.2); }, 0, 0.14 * g, 0.6);
    // A chord stab on top.
    const c = chordAt(Math.round((t0 - G0) / B));
    c.pad.forEach((m, k) => add(FX, t0, 1.2, (x) => {
      const f = midi(m + 12);
      let s = 0; for (let h = 1; h <= 4; h++) s += Math.sin(TAU * f * h * x) / h;
      return s * Math.exp(-x * 3);
    }, (k - 1.5) * 0.5, 0.05 * g, 0.5));
  }
  function whoosh(t0, g = 1) {
    let lp = 0;
    const pan = noise() * 0.6;
    add(FX, t0 - 0.2, 0.55, (x) => {
      const s = Math.sin(Math.PI * Math.min(1, x / 0.55));
      lp += (0.03 + 0.45 * s) * (noise() - lp);
      return s * s * lp;
    }, pan, 0.2 * g, 0.2);
  }
  function tap(t0) {
    add(FX, t0, 0.1, (x) => Math.exp(-x * 70) * Math.sin(TAU * 1800 * x) + 0.9 * Math.exp(-x * 40) * Math.sin(TAU * 300 * x), 0.1, 0.22);
  }
  function pop(t0, i = 0) {
    const f0 = 520 + (i % 5) * 90;
    add(FX, t0, 0.12, (x) => Math.sin(TAU * (f0 * x + 2600 * x * x)) * Math.exp(-x * 30), ((i % 3) - 1) * 0.4, 0.09, 0.2);
  }
  function coin(t0, g = 1) {
    const parts = [2093, 3322, 5163, 6645];
    add(FX, t0, 0.6, (x) => parts.reduce((s, f, k) => s + Math.sin(TAU * f * x) * Math.exp(-x * (8 + k * 5)) / (k + 1), 0), noise() * 0.5, 0.06 * g, 0.3);
  }
  function chime(t0) {
    [81, 85, 88, 93].forEach((m, k) => add(FX, t0 + k * 0.07, 1.4, (x) => {
      const f = midi(m);
      return (Math.sin(TAU * f * x) + 0.3 * Math.sin(TAU * f * 2.76 * x) * Math.exp(-x * 8)) * Math.exp(-x * 3.5);
    }, (k - 1.5) * 0.3, 0.07, 0.5));
  }


  // ---------------- More instruments (the styled shorts) ----------------
  // A band-limited sawtooth (or square, odd harmonics only), summed from
  // harmonics under a soft low-pass. `cut` is Hz or a function of time in the
  // note; `voices` detune copies for a supersaw.
  function saw(t0, m, len, { g = 1, pan = 0, cut = 3000, att = 0.01, rel = 0.08, voices = 1, detune = 0.012, square = false, send = 0.2, sendBus = RV, bus = MU, vib = 0 } = {}) {
    const f = typeof m === 'number' && m < 200 ? midi(m) : m;
    const maxH = Math.min(40, Math.floor(16000 / f));
    const vs = Array.from({ length: voices }, (_, v) => 1 + (voices > 1 ? (v / (voices - 1) - 0.5) * 2 * detune : 0));
    const ph0 = vs.map((_, v) => v * 1.7);
    add(bus, t0, len + rel, (x) => {
      const c = typeof cut === 'function' ? cut(x) : cut;
      const e = env(x, att, len + rel, rel);
      const vb = 1 + vib * Math.sin(TAU * 5.5 * x) * Math.min(1, x / 0.3);
      let s = 0;
      for (let v = 0; v < voices; v++) {
        const ff = f * vs[v] * vb;
        for (let h = 1; h <= maxH; h += square ? 2 : 1) {
          const hf = ff * h;
          if (hf > 18000) break;
          const lp = 1 / Math.sqrt(1 + Math.pow(hf / c, 4));
          if (lp < 0.003) break;
          s += (Math.sin(TAU * hf * x + ph0[v] * h) / h) * lp;
        }
      }
      return (s / Math.sqrt(voices)) * e;
    }, pan, 0.1 * g, send, sendBus);
  }
  // FM: a bell (ratio 3.5) or an electric piano (ratio 1 with a bright tine).
  function fm(t0, m, len, { g = 1, pan = 0, ratio = 3.5, index = 3, decay = 3, send = 0.3, sendBus = RV, bus = MU } = {}) {
    const f = midi(m);
    add(bus, t0, len, (x) => {
      const I = index * Math.exp(-x * decay);
      return Math.sin(TAU * f * x + I * Math.sin(TAU * f * ratio * x)) * Math.exp(-x * decay * 0.35) * env(x, 0.004, len, 0.08);
    }, pan, 0.12 * g, send, sendBus);
  }
  function rhodes(t0, m, len, { g = 1, pan = 0 } = {}) {
    const f = midi(m);
    add(MU, t0, len, (x) => {
      const I = 1.6 * Math.exp(-x * 2.5) + 0.3;
      const trem = 1 + 0.12 * Math.sin(TAU * 4.8 * x);
      const body = Math.sin(TAU * f * x + I * Math.sin(TAU * f * x));
      const tine = 0.25 * Math.sin(TAU * f * 14 * x) * Math.exp(-x * 30);
      return (body + tine) * Math.exp(-x * 0.9) * trem * env(x, 0.005, len, 0.25);
    }, pan, 0.075 * g, 0.35);
  }
  // A trap 808: a long sine with a glide from the previous note and some drive.
  function sub808(t0, m, len, { g = 1, from = null, glide = 0.08 } = {}) {
    const f1 = midi(m), f0 = from ? midi(from) : f1;
    let ph = 0;
    add(DR, t0, len, (x) => {
      const f = x < glide ? f0 + (f1 - f0) * (x / glide) : f1;
      ph += TAU * f / SR;
      const click = x < 0.01 ? Math.sin(TAU * 180 * x) * (1 - x / 0.01) : 0;
      return Math.tanh(2.2 * Math.sin(ph)) * env(x, 0.003, len, 0.12) + click * 0.5;
    }, 0, 0.3 * g);
  }
  // Snare: noise + body. `gated` adds the 80s gated-reverb tail.
  function snare(t0, { g = 1, gated = false, tone = 190, pan = 0 } = {}) {
    let lp = 0;
    add(DR, t0, gated ? 0.34 : 0.22, (x) => {
      const n = noise(); lp += 0.6 * (n - lp);
      const body = Math.sin(TAU * tone * x) * Math.exp(-x * 25);
      const tail = gated ? (x < 0.28 ? 0.55 : Math.max(0, 1 - (x - 0.28) / 0.06) * 0.55) * (n - lp * 0.4) : 0;
      return (0.8 * (n - lp * 0.5) * Math.exp(-x * 18) + 0.6 * body + tail);
    }, pan, 0.2 * g, gated ? 0.5 : 0.2);
  }
  function rim(t0, g = 1) {
    add(DR, t0, 0.06, (x) => (Math.sin(TAU * 1700 * x) * 0.6 + noise() * 0.4) * Math.exp(-x * 80), 0.1, 0.12 * g, 0.15);
  }
  function tom(t0, f, g = 1, pan = 0) {
    add(DR, t0, 0.5, (x) => Math.sin(TAU * (f * 0.7 * x + (f * 0.3 / 12) * (1 - Math.exp(-x * 12)))) * Math.exp(-x * 7), pan, 0.28 * g, 0.4);
  }
  function shaker(t0, g = 1, pan = 0.3) {
    let hp = 0, last = 0;
    add(DR, t0, 0.09, (x) => { const n = noise(); hp = 0.8 * (hp + n - last); last = n; return hp * Math.sin(Math.PI * Math.min(1, x / 0.09)) ; }, pan, 0.05 * g);
  }
  // Harmonium: reedy odd-heavy harmonics with a slow bellows swell.
  function harmonium(t0, notes, len, { g = 1 } = {}) {
    notes.forEach((m, k) => {
      const f = midi(m);
      add(MU, t0, len, (x) => {
        let s = 0;
        for (let h = 1; h <= 9; h++) s += Math.sin(TAU * f * h * x + h) * (h % 2 ? 1 / h : 0.45 / h);
        return s * env(x, 0.12, len, 0.2) * (1 + 0.08 * Math.sin(TAU * 1.3 * x));
      }, (k - (notes.length - 1) / 2) * 0.4, 0.03 * g, 0.4);
    });
  }
  // Sarangi-ish: a bowed, singing saw with a slide into the note and vibrato.
  function sarangi(t0, m, len, { g = 1, from = null, pan = 0.1 } = {}) {
    const f1 = midi(m), f0 = from ? midi(from) : f1 * Math.pow(2, -0.7 / 12);
    let ph = 0, lp = 0;
    add(MU, t0, len + 0.15, (x) => {
      const slide = Math.min(1, x / 0.12);
      const vib = 1 + 0.009 * Math.sin(TAU * 6 * x) * Math.min(1, Math.max(0, (x - 0.15) / 0.3));
      const f = (f0 + (f1 - f0) * (1 - Math.pow(1 - slide, 2))) * vib;
      ph += f / SR;
      let s = 0;
      for (let h = 1; h <= 12; h++) s += Math.sin(TAU * h * ph) / h * (h === 3 || h === 4 ? 1.6 : 1);
      const n = noise(); lp += 0.05 * (n - lp);
      return (s * 0.9 + lp * 0.6) * env(x, 0.07, len + 0.15, 0.15);
    }, pan, 0.07 * g, 0.4, DL);
  }
  // House piano stab: bright, quick decay, a little detuned.
  function stab(t0, notes, { g = 1, len = 0.35 } = {}) {
    notes.forEach((m, k) => {
      const f = midi(m);
      add(MU, t0, len, (x) => {
        let s = 0;
        for (let h = 1; h <= 8; h++) s += Math.sin(TAU * f * h * 1.0015 * x) * Math.exp(-x * (5 + h * 2)) / h;
        return s * env(x, 0.002, len, 0.05);
      }, (k - (notes.length - 1) / 2) * 0.35, 0.06 * g, 0.3);
    });
  }
  // Vinyl: a hiss bed and random crackles over the whole track.
  function vinyl(g = 1) {
    let lp = 0;
    add(FX, 0, DUR, () => { const n = noise(); lp += 0.08 * (n - lp); return lp * 0.25 + (Math.random() < 0.0009 ? noise() * 3 : 0); }, 0, 0.05 * g);
  }

  /**
   * Mixes the buses into `out` (a WAV path or file URL). `kicks` duck the
   * music; `sweep` = [t0, t1] low-passes the music, opening towards t1.
   */
  function mixdown(out, { kicks = [], sweep = null, tapeStop = null, lofi = 0, delay = 0.75, verb = 0.22, duckDepth = 0.55 } = {}) {
    // Sidechain: the music ducks under every kick.
    const duck = new Float32Array(N).fill(1);
    for (const t of kicks) {
      const s0 = Math.floor(t * SR);
      for (let i = 0; i < 0.3 * SR && s0 + i < N; i++) duck[s0 + i] = Math.min(duck[s0 + i], 1 - duckDepth * Math.exp(-i / SR / 0.09));
    }
    // A filter sweep: the music is low-passed, opening up towards the drop.
    const lpState = [0, 0];
    const [brk0, brk1] = sweep ?? [-1, -1];
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      if (t >= brk0 && t < brk1) {
        const k = (t - brk0) / (brk1 - brk0);
        const a = 0.04 + 0.5 * k * k;
        for (const c of [0, 1]) { lpState[c] += a * (MU[c][i] - lpState[c]); MU[c][i] = lpState[c]; }
      } else { lpState[0] = MU[0][i]; lpState[1] = MU[1][i]; }
      MU[0][i] *= duck[i]; MU[1][i] *= duck[i];
    }
    // Ping-pong delay (dotted eighth) for the flute and plucks → also into the reverb.
    {
      const d = Math.round(B * delay * SR);
      for (let i = d; i < N; i++) {
        DL[0][i] += DL[1][i - d] * 0.4;
        DL[1][i] += DL[0][i - d] * 0.4;
      }
      for (let i = 0; i < N; i++) { MU[0][i] += DL[1][i] * 0.35; MU[1][i] += DL[0][i] * 0.35; RV[0][i] += DL[0][i] * 0.2; RV[1][i] += DL[1][i] * 0.2; }
    }
    // Reverb: four combs and two all-passes per side (Schroeder), different per side.
    function reverb(x, combs, aps) {
      const y = new Float32Array(N);
      for (const [len, fb] of combs) {
        const buf = new Float32Array(len); let idx = 0, damp = 0;
        for (let i = 0; i < N; i++) {
          const o = buf[idx];
          damp = o * 0.65 + damp * 0.35;
          buf[idx] = x[i] + damp * fb;
          y[i] += o;
          idx = (idx + 1) % len;
        }
      }
      for (const len of aps) {
        const buf = new Float32Array(len); let idx = 0;
        for (let i = 0; i < N; i++) {
          const b = buf[idx], v = y[i] + b * 0.5;
          y[i] = b - v * 0.5; buf[idx] = v;
          idx = (idx + 1) % len;
        }
      }
      return y;
    }
    const rvL = reverb(RV[0], [[1557, 0.84], [1617, 0.84], [1491, 0.84], [1422, 0.84]], [556, 441]);
    const rvR = reverb(RV[1], [[1580, 0.84], [1640, 0.84], [1514, 0.84], [1445, 0.84]], [579, 464]);

    const L = new Float32Array(N), R = new Float32Array(N);
    let peak = 0;
    for (let i = 0; i < N; i++) {
      // (Effects join after the tape stop / lo-fi; without those, the sum
      // keeps the long ad's original order so its soundtrack is unchanged.)
      const fxNow = !tapeStop && !lofi;
      L[i] = DR[0][i] + MU[0][i] + (fxNow ? FX[0][i] : 0) + rvL[i] * verb;
      R[i] = DR[1][i] + MU[1][i] + (fxNow ? FX[1][i] : 0) + rvR[i] * verb;
    }
    // Tape stop: the music slows to a halt over [t0, t1] (the effects keep going).
    if (tapeStop) {
      const s0 = Math.floor(tapeStop[0] * SR), s1 = Math.floor(tapeStop[1] * SR), n = s1 - s0;
      const srcL = L.slice(s0, s1), srcR = R.slice(s0, s1);
      for (let i = 0; i < n; i++) {
        const pos = i - (0.5 * i * i) / n;
        const j = Math.floor(pos), fr = pos - j;
        const k = 1 - i / n;
        L[s0 + i] = (srcL[j] * (1 - fr) + (srcL[j + 1] ?? 0) * fr) * Math.min(1, k * 3);
        R[s0 + i] = (srcR[j] * (1 - fr) + (srcR[j + 1] ?? 0) * fr) * Math.min(1, k * 3);
      }
    }
    // Lo-fi: a gentle low-pass over the music (0..1 = how dark).
    if (lofi) {
      const a = 1 - lofi * 0.85; let l = 0, r = 0;
      for (let i = 0; i < N; i++) { l += a * (L[i] - l); r += a * (R[i] - r); L[i] = l; R[i] = r; }
    }
    for (let i = 0; i < N; i++) {
      if (tapeStop || lofi) { L[i] += FX[0][i]; R[i] += FX[1][i]; }
      peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    }
    const drive = 1.5 / Math.max(0.2, peak);
    const buf = Buffer.alloc(44 + N * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
    buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
    buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
    buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      const fade = Math.min(1, t / 0.05) * Math.min(1, (DUR - t) / 0.6);
      const l = Math.tanh(L[i] * drive) * fade * 0.92, r = Math.tanh(R[i] * drive) * fade * 0.92;
      buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
      buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
    }
    fs.writeFileSync(out, buf);
    return { peak, drive };
  }

  return {
    SR, N, B, BAR, beat, CH, chordAt, add, env, noise, midi, TAU,
    DR, MU, FX, RV, DL,
    kick, clap, hat, madal, snareHit, bass, pad, pluck, flute,
    riser, impact, whoosh, tap, pop, coin, chime, mixdown,
    saw, fm, rhodes, sub808, snare, rim, tom, shaker, harmonium, sarangi, stab, vinyl,
  };
}
