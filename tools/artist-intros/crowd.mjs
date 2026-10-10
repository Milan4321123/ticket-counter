// Live-show sounds on top of ../ad-videos/kit.mjs: the hall murmuring and
// roaring, applause, a whole crowd clapping on the beat, "wooo" cheers, a
// crowd shouting a count, stomps, a heartbeat, crash cymbals, a reverse swell
// and a distorted power-chord guitar. Everything is synthesized.
export function crowdKit(K) {
  const { SR, add, noise, midi, TAU, DR, MU, FX } = K;

  // RBJ biquads (band-pass with 0 dB peak, low-pass, high-pass)
  function biquad(type, f, Q = 0.707) {
    const w = (TAU * f) / SR, al = Math.sin(w) / (2 * Q), c = Math.cos(w);
    let b0, b1, b2;
    if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; }
    else if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
    const F = { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
    return (x) => { const y = F.b0 * x + F.b1 * F.x1 + F.b2 * F.x2 - F.a1 * F.y1 - F.a2 * F.y2; F.x2 = F.x1; F.x1 = x; F.y2 = F.y1; F.y1 = y; return y; };
  }
  const rnd = () => (noise() + 1) / 2;
  // a slowly wandering 0..1 value (for babble and swells)
  function wander(rate) { let v = 0.5, tgt = 0.5, k = 0; return () => { if (--k <= 0) { tgt = rnd(); k = Math.round(SR / rate * (0.5 + rnd())); } v += (tgt - v) * (rate * 4 / SR); return v; }; }

  // The hall: murmur when `level` is low, a roar when it is high. level(t) 0..1.
  function hall(t0, len, level, g = 1) {
    for (const pan of [-0.75, 0.75]) {
      const bands = [[350, 0.8, 0.9], [900, 1.1, 0.6], [2200, 1.6, 0.22], [3600, 2, 0.08]].map(([f, q, w]) => ({ f: biquad('bp', f, q), w, m: wander(3 + rnd() * 4) }));
      const roar = [biquad('bp', 700, 1.4), biquad('bp', 1250, 1.8)];
      add(FX, t0, len, (x, tt) => {
        const L = level(tt), n = noise();
        let s = 0;
        for (const b of bands) s += b.f(n) * b.w * (0.35 + 0.9 * b.m());
        const r = (roar[0](n) + 0.7 * roar[1](n)) * L * L * 1.0;
        return (s * (0.25 + 0.75 * L) + r) * Math.min(1, x / 0.4);
      }, pan, 0.55 * g, 0.25);
    }
  }

  // One clap of one person.
  function oneClap(t, g = 1, pan = 0) {
    const f = biquad('bp', 900 + rnd() * 1800, 1.2 + rnd()), d = 140 + rnd() * 120;
    add(FX, t, 0.04, (x) => f(noise()) * Math.exp(-x * d), pan, 0.5 * g, 0.35);
  }
  // Applause: claps at random times; density(t) in claps per second.
  function applause(t0, len, density, g = 1) {
    let t = t0;
    while (t < t0 + len) { const d = Math.max(1, density(t)); t += -Math.log(1 - rnd() * 0.999) / d; oneClap(t, g * (0.5 + rnd() * 0.6), noise() * 0.9); }
  }
  // The whole hall clapping on a beat: n people, a little early or late.
  function crowdClap(t, n = 40, g = 1, spread = 0.022) {
    for (let i = 0; i < n; i++) oneClap(t + (noise() + noise()) * spread, g * 0.9, noise() * 0.95);
  }

  // A voice going "wooo" (or "ahh", "eee"): a buzzy source through two formants.
  const VOWEL = { oo: [330, 820], ah: [760, 1220], ee: [300, 2250], oh: [520, 900], eh: [560, 1800] };
  function voice(t0, len, f0, f1, vowel = 'oo', pan = 0, g = 1) {
    const [F1, F2] = VOWEL[vowel], a = biquad('bp', F1, 5), b = biquad('bp', F2, 7), br = biquad('bp', F2, 2);
    let ph = 0; const vib = 4.5 + rnd() * 2;
    add(FX, t0, len, (x) => {
      const k = x / len, glide = k < 0.25 ? f0 + (f1 - f0) * Math.sin((k / 0.25) * Math.PI / 2) : f1 * (1 - 0.18 * Math.max(0, (k - 0.6) / 0.4));
      const f = glide * (1 + 0.012 * Math.sin(TAU * vib * x));
      ph += f / SR; ph -= Math.floor(ph);
      const src = 2 * ph - 1, n = noise();
      const e = Math.min(1, x / 0.08) * Math.min(1, (len - x) / 0.25);
      return (a(src) * 1.0 + b(src) * 0.6 + br(n) * 0.25) * e;
    }, pan, 0.35 * g, 0.4);
  }
  // A burst of cheering voices over [t0, t0+len].
  function cheer(t0, len, n = 20, g = 1, vowels = ['oo', 'ah', 'oh', 'ee']) {
    for (let i = 0; i < n; i++) {
      const st = t0 + rnd() * len * 0.5, d = 0.5 + rnd() * Math.max(0.4, len - (st - t0));
      const hi = rnd() < 0.45, base = hi ? 380 + rnd() * 260 : 170 + rnd() * 140;
      voice(st, d, base * 0.8, base * (1.15 + rnd() * 0.3), vowels[(rnd() * vowels.length) | 0], noise() * 0.9, g * (0.5 + rnd() * 0.5));
    }
  }
  // The crowd shouting a count ("THREE!"): short loud voices all at once.
  function shout(t, n = 26, g = 1, vowel = 'ee') {
    for (let i = 0; i < n; i++) {
      const hi = rnd() < 0.45, base = hi ? 420 + rnd() * 200 : 190 + rnd() * 110, st = t + (noise() + noise()) * 0.02;
      voice(st, 0.32 + rnd() * 0.18, base * 1.1, base * 1.2, vowel, noise() * 0.9, g * (0.6 + rnd() * 0.4));
    }
  }

  // A foot stomp on a wooden floor, heard in a big room.
  function stomp(t, g = 1) {
    const lp = biquad('lp', 380, 0.9);
    add(DR, t, 0.5, (x) => Math.sin(TAU * (48 * x + (60 / 14) * (1 - Math.exp(-x * 14)))) * Math.exp(-x * 9) + lp(noise()) * Math.exp(-x * 22) * 1.4, 0, 0.6 * g, 0.5);
  }
  function heartbeat(t, g = 1) {
    for (const [o, a] of [[0, 1], [0.27, 0.7]]) add(DR, t + o, 0.3, (x) => Math.sin(TAU * (42 * x + 1.4 * (1 - Math.exp(-x * 30)))) * Math.exp(-x * 14), 0, 0.55 * g * a, 0.1);
  }
  function crash(t, g = 1, len = 2.8) {
    const hp = biquad('hp', 4500, 0.7), bp = biquad('bp', 7000, 0.9);
    add(FX, t, len, (x) => { const n = noise(); return (hp(n) * 0.7 + bp(n) * 0.5) * Math.exp(-x * (2.2 / len) * 1.6) * (x < 0.004 ? x / 0.004 : 1); }, 0.15, 0.32 * g, 0.5);
  }
  // A swell that sucks in before a hit (reversed noise + low tone).
  function swell(tHit, len = 0.8, g = 1) {
    const lp = biquad('lp', 1800, 0.7);
    add(FX, tHit - len, len, (x) => { const k = x / len; return (lp(noise()) * 1.2 + Math.sin(TAU * 60 * x) * 0.4) * k * k * k; }, 0, 0.35 * g, 0.3);
  }

  // Distorted guitar power chord (root + fifth + octave), optionally palm-muted.
  function power(t, root, len, { g = 1, mute = false, pan = 0 } = {}) {
    const notes = [root, root + 7, root + 12];
    const lp = biquad('lp', mute ? 700 : 2600, 0.8), lp2 = biquad('lp', mute ? 900 : 3800, 0.6);
    const ph = notes.map(() => [rnd(), rnd()]);
    add(MU, t, len, (x) => {
      let s = 0;
      notes.forEach((m, i) => {
        const f = midi(m);
        for (const [k, det] of [[0, 0.997], [1, 1.004]]) { ph[i][k] += (f * det) / SR; ph[i][k] -= Math.floor(ph[i][k]); s += 2 * ph[i][k] - 1; }
      });
      const e = Math.min(1, x / 0.004) * (mute ? Math.exp(-x * 9) : Math.min(1, (len - x) / 0.12)) * (mute ? 1 : 0.8 + 0.2 * Math.exp(-x * 3));
      return lp2(lp(Math.tanh(s * 1.8))) * e;
    }, pan, 0.2 * g, mute ? 0.08 : 0.2);
  }

  // Lead guitar: one distorted note with vibrato, optionally bending up into the
  // note (`from`, semitones below) — for licks and solos.
  function lead(t, m, len, { g = 1, from = 0, pan = 0.15, vib = 1 } = {}) {
    const lp = biquad('lp', 3200, 0.9), lp2 = biquad('lp', 4200, 0.6);
    let p1 = rnd(), p2 = rnd();
    add(MU, t, len, (x) => {
      const bend = from ? Math.pow(2, (-from * Math.max(0, 1 - x / 0.09)) / 12) : 1;
      const v = 1 + 0.008 * vib * Math.sin(TAU * 5.5 * x) * Math.min(1, x / 0.2);
      const f = midi(m) * bend * v;
      p1 += f / SR; p1 -= Math.floor(p1); p2 += (f * 1.005) / SR; p2 -= Math.floor(p2);
      const e = Math.min(1, x / 0.004) * Math.min(1, (len - x) / 0.06) * (0.75 + 0.25 * Math.exp(-x * 4));
      return lp2(lp(Math.tanh((2 * p1 - 1 + 2 * p2 - 1) * 2.6))) * e;
    }, pan, 0.16 * g, 0.3, K.DL);
  }
  // Bass guitar: round low note with a pick click; `slideTo` glides it.
  function bassGtr(t, m, len, { g = 1, slideTo = null } = {}) {
    const lp = biquad('lp', 900, 0.8); let ph = 0;
    add(MU, t, len, (x) => {
      const k = slideTo == null ? 0 : Math.min(1, x / len);
      const f = midi(m + (slideTo == null ? 0 : (slideTo - m) * k * k));
      ph += f / SR; ph -= Math.floor(ph);
      const s = Math.sin(TAU * ph) + 0.45 * Math.sin(2 * TAU * ph) + 0.25 * (2 * ph - 1);
      const e = Math.min(1, x / 0.003) * Math.min(1, (len - x) / 0.04) * (0.7 + 0.3 * Math.exp(-x * 6));
      return lp(Math.tanh(s * 1.4)) * e + (x < 0.006 ? noise() * 0.3 * (1 - x / 0.006) : 0);
    }, 0, 0.42 * g, 0.03);
  }
  // Organ: drawbar sines (16', 8', 4', 2 2/3') with a little Leslie wobble.
  function organ(t, notes, len, { g = 1, pan = -0.2 } = {}) {
    notes.forEach((m, k) => {
      const f = midi(m);
      add(MU, t, len, (x) => {
        const w = 1 + 0.004 * Math.sin(TAU * 6.2 * x + k);
        const s = 0.6 * Math.sin(TAU * f * 0.5 * w * x) + Math.sin(TAU * f * w * x) + 0.6 * Math.sin(TAU * f * 2 * w * x) + 0.35 * Math.sin(TAU * f * 3 * w * x);
        return s * Math.min(1, x / 0.01) * Math.min(1, (len - x) / 0.05);
      }, pan + (k - (notes.length - 1) / 2) * 0.2, 0.045 * g, 0.35);
    });
  }
  // Drumsticks clicked together for the count-in.
  function sticks(t, g = 1) {
    const bp = biquad('bp', 2600, 3);
    add(DR, t, 0.06, (x) => (bp(noise()) * 2 + Math.sin(TAU * 1900 * x) * 0.6) * Math.exp(-x * 90), 0.2, 0.45 * g, 0.3);
  }

  // An amp switching on: a thump, then mains hum with its buzz.
  function ampOn(t, len, g = 1) {
    add(DR, t, 0.25, (x) => Math.sin(TAU * 55 * x) * Math.exp(-x * 18) + noise() * 0.4 * Math.exp(-x * 60), 0, 0.5 * g, 0.2);
    add(FX, t, len, (x) => { const s = Math.sin(TAU * 50 * x) + 0.5 * Math.sin(TAU * 100 * x) + 0.25 * Math.tanh(4 * Math.sin(TAU * 150 * x)); return s * Math.min(1, x / 0.05) * Math.min(1, (len - x) / 0.3); }, 0, 0.06 * g, 0.1);
  }
  // Guitar feedback: a pure note swelling up with a slow vibrato.
  function feedback(t, m, len, g = 1) {
    const f = midi(m);
    add(MU, t, len, (x) => { const k = x / len; return Math.tanh(1.5 * Math.sin(TAU * f * x * (1 + 0.004 * Math.sin(TAU * 5 * x) * k))) * k * k * Math.min(1, (len - x) / 0.05); }, 0.2, 0.12 * g, 0.4);
  }

  // A choir: several voices per note through vowel formants, slow to bloom.
  function choir(t, notes, len, { vowel = 'ah', g = 1, n = 3, att = 0.35, rel = 0.6 } = {}) {
    const [F1, F2] = VOWEL[vowel];
    notes.forEach((m, k) => {
      for (let v = 0; v < n; v++) {
        const f = midi(m) * (1 + (rnd() - 0.5) * 0.012), a = biquad('bp', F1, 4), b = biquad('bp', F2, 5), lp = biquad('lp', 3200, 0.7);
        let ph = rnd(); const vib = 4.6 + rnd() * 1.4, vd = 0.004 + rnd() * 0.004, st = rnd() * 0.05;
        add(MU, t + st, len, (x) => {
          ph += (f * (1 + vd * Math.sin(TAU * vib * x) * Math.min(1, x / 0.4))) / SR; ph -= Math.floor(ph);
          const src = lp(2 * ph - 1) + 0.12 * noise();
          return (a(src) * 1.1 + b(src) * 0.7) * Math.min(1, x / att) * Math.max(0, Math.min(1, (len - st - x) / rel));
        }, (k - (notes.length - 1) / 2) * 0.35 + (rnd() - 0.5) * 0.3, 0.1 * g, 0.55);
      }
    });
  }
  // The hall singing a note: men an octave down, everyone a little off pitch and
  // time, sliding up into the note — it should sound like a crowd, not a synth.
  function sing(t, m, len, { n = 26, g = 1, vowel = 'oh' } = {}) {
    const [F1, F2] = VOWEL[vowel];
    for (let i = 0; i < n; i++) {
      const male = rnd() < 0.55, f = midi(m - (male ? 12 : 0)) * Math.pow(2, ((rnd() - 0.5) * 0.4) / 12), st = t + (rnd() - 0.4) * 0.07;
      const a = biquad('bp', F1 * (male ? 0.92 : 1.08), 4), b = biquad('bp', F2 * (male ? 0.92 : 1.1), 5), br = biquad('bp', 1400, 1.5);
      let ph = rnd(); const vib = 4 + rnd() * 2.5, vd = 0.003 + rnd() * 0.01, d = len * (0.85 + rnd() * 0.2);
      add(FX, st, d, (x) => {
        const scoop = Math.pow(2, (-0.9 * Math.exp(-x * 14)) / 12);
        ph += (f * scoop * (1 + vd * Math.sin(TAU * vib * x))) / SR; ph -= Math.floor(ph);
        const src = 2 * ph - 1;
        return (a(src) + 0.6 * b(src) + 0.35 * br(noise())) * Math.min(1, x / 0.05) * Math.max(0, Math.min(1, (d - x) / 0.12));
      }, (rnd() - 0.5) * 1.6, 0.11 * g, 0.5);
    }
  }
  // Synth brass: detuned saws through a low-pass that opens on the attack.
  function brass(t, notes, len, { g = 1, pan = 0 } = {}) {
    notes.forEach((m, k) => {
      for (const det of [-0.006, 0, 0.007]) {
        const f = midi(m) * (1 + det); let ph = rnd(), l1 = 0, l2 = 0;
        add(MU, t, len, (x) => {
          ph += f / SR; ph -= Math.floor(ph);
          const fc = 500 + 3600 * Math.min(1, x / 0.03) * Math.exp(-x * 5) + 900, a = 1 - Math.exp((-TAU * fc) / SR);
          l1 += a * (2 * ph - 1 - l1); l2 += a * (l1 - l2);
          return l2 * Math.min(1, x / 0.02) * (0.75 + 0.25 * Math.exp(-x * 6)) * Math.max(0, Math.min(1, (len - x) / 0.08));
        }, pan + (k - (notes.length - 1) / 2) * 0.3, 0.085 * g, 0.35);
      }
    });
  }
  // Timpani: a tuned drum with a long ring.
  function timpani(t, m, g = 1) {
    const f = midi(m), lp = biquad('lp', 900, 0.7);
    add(DR, t, 1.6, (x) => (Math.sin(TAU * f * x * (1 + 0.04 * Math.exp(-x * 12))) + 0.5 * Math.sin(TAU * f * 1.5 * x) * Math.exp(-x * 5) + lp(noise()) * Math.exp(-x * 30) * 0.8) * Math.exp(-x * 2.6), 0, 0.42 * g, 0.5);
  }
  // Magic dust: glassy bell pings on the D major pentatonic, thick at first.
  function sparkle(t, len, { g = 1, per = 14 } = {}) {
    const NOTES = [86, 88, 90, 93, 95, 98, 100, 102];
    const n = Math.round(len * per);
    for (let i = 0; i < n; i++) {
      const k = rnd(), tt = t + len * k * k;
      K.fm(tt, NOTES[(rnd() * NOTES.length) | 0], 0.7, { g: 0.22 * g * (1 - 0.6 * k), ratio: 3.5, index: 1.4, decay: 6, send: 0.6, pan: (rnd() - 0.5) * 1.6 });
    }
  }
  // A firework: the rocket's whistle, the bang, the crackle.
  function firework(t, { g = 1, rocket = true, pan = 0 } = {}) {
    if (rocket) {
      const bp = biquad('bp', 3200, 2);
      add(FX, t - 0.62, 0.62, (x) => { const k = x / 0.62; return (Math.sin(TAU * (900 * x + (1500 * x * x) / 0.62)) * 0.45 + bp(noise()) * 0.7) * k * k; }, pan, 0.1 * g, 0.3);
    }
    const lp = biquad('lp', 1600, 0.8);
    add(FX, t, 1.6, (x) => lp(noise()) * Math.exp(-x * 8) * 1.4 + Math.sin(TAU * (36 * x + (55 / 5) * (1 - Math.exp(-x * 5)))) * Math.exp(-x * 3.2), pan, 0.42 * g, 0.7);
    for (let tt = t + 0.18; tt < t + 1.6; tt += 0.008 + rnd() * 0.05 * (1 + (tt - t))) {
      const hp = biquad('hp', 2600, 0.8);
      add(FX, tt, 0.012, (x) => hp(noise()) * (1 - x / 0.012), Math.max(-1, Math.min(1, pan + (rnd() - 0.5) * 0.9)), 0.22 * g * (1 - (tt - t) / 1.7), 0.45);
    }
  }

  return { choir, sing, brass, timpani, sparkle, firework, ampOn, feedback, biquad, hall, oneClap, applause, crowdClap, voice, cheer, shout, stomp, heartbeat, crash, swell, power, lead, bassGtr, organ, sticks };
}
