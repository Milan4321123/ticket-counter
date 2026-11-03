// The demo artist's "songs": short ORIGINAL melodies composed on the spot from
// a seed and played live with the Web Audio API — a madal-style drum (a low
// "dhin" and a slapped "ta"), a bansuri-style lead (triangle + sine with breath
// and vibrato), a tanpura-like drone, a bass and a small jhyamta chime. No
// samples, no recordings, no dependencies.
//
// Nothing here runs until DemoSynth.create() is called from a tap, so the page
// never makes a sound on its own.

import type { TrackId } from './content';

export type TrackDef = {
  id: TrackId;
  bpm: number;
  /** Eighth-note steps per bar: 8 (4/4) or 6 (6/8). */
  meter: 6 | 8;
  /** MIDI note of the home pitch. */
  root: number;
  /** The scale as semitones above the root (pentatonic). */
  scale: number[];
  seed: number;
  /** Bar roots per 4-bar phrase, as semitones above the root. */
  roots: [number[], number[]];
  /** Lead timbre — a softer sine-ish flute or a brighter one. */
  bright: number;
  /** Colours for the cover art and the visualizer. */
  hue: [string, string];
};

export const TRACKS: TrackDef[] = [
  { id: 'kuhiro', bpm: 76, meter: 8, root: 62, scale: [0, 3, 5, 7, 10], seed: 11, roots: [[0, 0, 5, 0], [-2, -2, 3, 0]], bright: 0.25, hue: ['#7aa8ff', '#2c2a6b'] },
  { id: 'saanjh', bpm: 112, meter: 6, root: 64, scale: [0, 2, 4, 7, 9], seed: 27, roots: [[0, 7, 0, 7], [-3, 2, 7, 0]], bright: 0.5, hue: ['#ffb347', '#6b2a3a'] },
  { id: 'taara', bpm: 84, meter: 8, root: 60, scale: [0, 2, 4, 7, 9], seed: 5, roots: [[0, -3, -5, 0], [-7, -5, -3, 0]], bright: 0.35, hue: ['#c69bff', '#1d1b4f'] },
  { id: 'ghar', bpm: 128, meter: 6, root: 62, scale: [0, 2, 5, 7, 9], seed: 42, roots: [[0, 5, 7, 0], [5, 7, 5, 0]], bright: 0.6, hue: ['#ff6f91', '#3b1450'] },
];

type Kind = 'lead' | 'bass' | 'drone' | 'dhin' | 'ta' | 'tick' | 'chime';

type Ev = { at: number; dur: number; kind: Kind; midi: number; vel: number };

type Song = { events: Ev[]; length: number };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CELLS: Record<6 | 8, number[][]> = {
  8: [
    [2, 2, 4],
    [1, 1, 2, 4],
    [3, 1, 2, 2],
    [2, 1, 1, 4],
    [4, 2, 2],
    [2, 2, 2, 2],
    [3, 3, 2],
  ],
  6: [
    [2, 1, 3],
    [3, 3],
    [1, 1, 1, 3],
    [2, 2, 2],
    [3, 2, 1],
    [2, 1, 2, 1],
  ],
};

// Madal patterns, one character per eighth: D = dhin (low), t = ta, k = soft tick.
const GROOVES: Record<6 | 8, { light: string; full: string; fill: string }> = {
  8: { light: 'D...t...', full: 'D.tkD.tk', fill: 'DtktDDtt' },
  6: { light: 'D..t..', full: 'D.tDt.', fill: 'DttDtt' },
};

/** Compose a whole song for one track: intro, A, A′, B, A, outro. */
export function compose(def: TrackDef): Song {
  const rand = mulberry32(def.seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const m = def.meter;
  const deg = (d: number) => {
    // Scale degree (may be negative or above one octave) → semitones.
    const n = def.scale.length;
    const oct = Math.floor(d / n);
    return def.scale[((d % n) + n) % n] + 12 * oct;
  };

  // A phrase is two bars of melody, ending on a steady note.
  const phrase = (low: number, high: number, start: number, endOn: number[]) => {
    const notes: { at: number; dur: number; d: number }[] = [];
    let d = start;
    for (let bar = 0; bar < 2; bar++) {
      const cell = pick(CELLS[m]);
      let at = bar * m;
      cell.forEach((len, i) => {
        const last = bar === 1 && i === cell.length - 1;
        if (last) d = pick(endOn);
        else {
          const r = rand();
          const stepBy = r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.94 ? -2 : 0;
          d = Math.max(low, Math.min(high, d + stepBy));
        }
        // A short rest now and then lets the flute breathe.
        if (!(rand() < 0.12 && !last && i > 0)) notes.push({ at, dur: len, d });
        at += len;
      });
    }
    return notes;
  };

  const a1 = phrase(2, 8, 5, [5, 7]);
  const a2 = phrase(2, 8, 6, [5]);
  const b1 = phrase(5, 10, 8, [7, 8]);
  const b2 = phrase(4, 9, 7, [5]);
  const sectionA = [...a1, ...a2.map((n) => ({ ...n, at: n.at + 2 * m }))];
  const sectionB = [...b1, ...b2.map((n) => ({ ...n, at: n.at + 2 * m }))];

  type Section = { bars: number; melody: typeof sectionA | null; roots: number[]; groove: 'light' | 'full' | 'none'; chime?: boolean };
  const plan: Section[] = [
    { bars: 2, melody: null, roots: [0, 0], groove: 'light' },
    { bars: 4, melody: sectionA, roots: def.roots[0], groove: 'light' },
    { bars: 4, melody: sectionA, roots: def.roots[0], groove: 'full' },
    { bars: 4, melody: sectionB, roots: def.roots[1], groove: 'full', chime: true },
    { bars: 4, melody: sectionA, roots: def.roots[0], groove: 'full' },
    { bars: 2, melody: null, roots: [0, 0], groove: 'none', chime: true },
  ];

  const events: Ev[] = [];
  let bar0 = 0;
  for (const [si, s] of plan.entries()) {
    const base = bar0 * m;
    if (s.melody) {
      for (const n of s.melody) {
        events.push({ at: base + n.at, dur: n.dur, kind: 'lead', midi: def.root + deg(n.d), vel: 0.9 - (n.dur < 2 ? 0.15 : 0) });
      }
    }
    for (let b = 0; b < s.bars; b++) {
      const at = base + b * m;
      const r = s.roots[b % s.roots.length];
      events.push({ at, dur: m, kind: 'drone', midi: def.root - 12, vel: 1 });
      if (si > 0 && si < plan.length - 1) {
        events.push({ at, dur: m * 0.5, kind: 'bass', midi: def.root - 24 + r, vel: 1 });
        events.push({ at: at + m / 2 + (m === 6 ? 1 : 0), dur: m * 0.4, kind: 'bass', midi: def.root - 24 + r + (rand() < 0.3 ? 7 : 0), vel: 0.7 });
      }
      if (s.chime && b % 2 === 0) events.push({ at, dur: m, kind: 'chime', midi: 0, vel: 1 });
      if (s.groove !== 'none') {
        const lastOfPhrase = (b + 1) % 4 === 0 && s.groove === 'full';
        const pat = lastOfPhrase ? GROOVES[m].fill : GROOVES[m][s.groove];
        [...pat].forEach((c, i) => {
          if (c === 'D') events.push({ at: at + i, dur: 1, kind: 'dhin', midi: 0, vel: i === 0 ? 1 : 0.8 });
          else if (c === 't') events.push({ at: at + i, dur: 1, kind: 'ta', midi: 0, vel: i % 2 ? 0.7 : 0.9 });
          else if (c === 'k') events.push({ at: at + i, dur: 1, kind: 'tick', midi: 0, vel: 0.5 });
        });
      }
    }
    bar0 += s.bars;
  }
  // The last note of the song rings out over the outro.
  const finalAt = (bar0 - 2) * m;
  events.push({ at: finalAt, dur: m * 2 - 1, kind: 'lead', midi: def.root + 12, vel: 0.8 });

  const step = 60 / def.bpm / 2;
  const scaled = events.map((e) => ({ ...e, at: e.at * step, dur: e.dur * step })).sort((x, y) => x.at - y.at);
  return { events: scaled, length: bar0 * m * step + 1.2 };
}

const SONGS = new Map<TrackId, Song>();
function songFor(def: TrackDef): Song {
  let s = SONGS.get(def.id);
  if (!s) {
    s = compose(def);
    SONGS.set(def.id, s);
  }
  return s;
}

/** Song length in seconds — usable before any audio exists (for the track list). */
export function trackLength(def: TrackDef): number {
  return songFor(def).length;
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

type Ctx = AudioContext;

export class DemoSynth {
  readonly ctx: Ctx;
  readonly analyser: AnalyserNode;
  private master: GainNode;
  private reverb: ConvolverNode;
  private noise: AudioBuffer;
  private bus: GainNode | null = null;
  private wet: GainNode | null = null;
  private def: TrackDef | null = null;
  private song: Song | null = null;
  private next = 0;
  /** ctx time at which the song's 0 s happened. */
  private zero = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private ended = false;
  onEnd: (() => void) | null = null;

  private constructor(ctx: Ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.2;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.master.connect(comp);
    comp.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    // A small hall: a stereo impulse of fading noise.
    this.reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb.buffer = ir;
    this.reverb.connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  /** Call from a tap/click handler only. Returns null where Web Audio is missing. */
  static create(): DemoSynth | null {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) return null;
    // iPhone: play through the silent switch where Safari allows it.
    try {
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* older Safari */
    }
    try {
      return new DemoSynth(new AC({ latencyHint: 'playback' }));
    } catch {
      return null;
    }
  }

  get duration(): number {
    return this.song?.length ?? 0;
  }

  /** Seconds into the current song. */
  get position(): number {
    if (!this.song) return 0;
    return Math.max(0, Math.min(this.song.length, this.ctx.currentTime - this.zero));
  }

  get playing(): boolean {
    return this.ctx.state === 'running' && this.timer !== null;
  }

  /** Start a song (from `offset` seconds) and play. */
  load(def: TrackDef, offset = 0) {
    this.def = def;
    this.song = songFor(def);
    this.seekTo(offset);
    this.play();
  }

  /** Jump within the current song; whatever was already scheduled fades away. */
  seekTo(offset: number) {
    if (!this.song) return;
    this.fadeOutBus();
    const bus = this.ctx.createGain();
    const wet = this.ctx.createGain();
    wet.gain.value = 0.32;
    bus.connect(this.master);
    bus.connect(wet);
    wet.connect(this.reverb);
    this.bus = bus;
    this.wet = wet;
    const at = Math.max(0, Math.min(this.song.length - 0.05, offset));
    this.zero = this.ctx.currentTime + 0.05 - at;
    this.next = this.song.events.findIndex((e) => e.at >= at);
    if (this.next < 0) this.next = this.song.events.length;
    this.ended = false;
    if (this.timer) this.tick();
  }

  play() {
    if (this.ctx.state !== 'running') void this.ctx.resume();
    if (!this.timer) this.timer = setInterval(() => this.tick(), 30);
    this.tick();
  }

  pause() {
    this.stopTimer();
    void this.ctx.suspend();
  }

  close() {
    this.stopTimer();
    void this.ctx.close();
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private fadeOutBus() {
    const bus = this.bus;
    const wet = this.wet;
    if (!bus) return;
    const t = this.ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + 0.08);
    setTimeout(() => {
      try {
        bus.disconnect();
        wet?.disconnect();
      } catch {
        /* already gone */
      }
    }, 400);
    this.bus = null;
    this.wet = null;
  }

  private tick() {
    const song = this.song;
    if (!song || !this.bus) return;
    const horizon = this.ctx.currentTime - this.zero + 0.18;
    while (this.next < song.events.length && song.events[this.next].at < horizon) {
      const e = song.events[this.next++];
      const when = Math.max(this.ctx.currentTime, this.zero + e.at);
      this.voice(e, when);
    }
    if (!this.ended && this.position >= song.length - 0.02) {
      this.ended = true;
      this.stopTimer();
      this.onEnd?.();
    }
  }

  // ---------- voices ----------

  private voice(e: Ev, t: number) {
    switch (e.kind) {
      case 'lead':
        return this.flute(hz(e.midi), t, e.dur, e.vel);
      case 'bass':
        return this.bass(hz(e.midi), t, e.dur, e.vel);
      case 'drone':
        return this.drone(hz(e.midi), t, e.dur);
      case 'dhin':
        return this.dhin(t, e.vel);
      case 'ta':
        return this.ta(t, e.vel, 1);
      case 'tick':
        return this.ta(t, e.vel, 0.45);
      case 'chime':
        return this.chime(t);
    }
  }

  private env(t: number, peak: number, a: number, hold: number, r: number) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + Math.max(0, hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + Math.max(0, hold) + r);
    g.connect(this.bus!);
    return g;
  }

  private flute(f: number, t: number, dur: number, vel: number) {
    const ctx = this.ctx;
    const bright = this.def?.bright ?? 0.4;
    const len = Math.max(0.12, dur * 0.92);
    const out = this.env(t, 0.16 * vel, 0.05, len - 0.05, 0.16);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800 + bright * 2600;
    lp.connect(out);
    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    const sine = ctx.createOscillator();
    sine.type = 'sine';
    const triGain = ctx.createGain();
    triGain.gain.value = 0.35 + bright * 0.5;
    tri.connect(triGain).connect(lp);
    sine.connect(lp);
    // Meend: the note slides up into place, then a gentle vibrato blooms.
    for (const o of [tri, sine]) {
      o.frequency.setValueAtTime(f * 0.972, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    }
    if (len > 0.3) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.3;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.45, len));
      lfo.connect(depth);
      depth.connect(tri.frequency);
      depth.connect(sine.frequency);
      lfo.start(t);
      lfo.stop(t + len + 0.25);
    }
    // Breath: a puff of filtered noise at the start of each note.
    const br = ctx.createBufferSource();
    br.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2.2;
    bp.Q.value = 1.2;
    const bg = this.env(t, 0.035 * vel, 0.02, 0.04, 0.12);
    br.connect(bp).connect(bg);
    br.start(t, Math.random() * 0.5, 0.3);
    tri.start(t);
    sine.start(t);
    tri.stop(t + len + 0.3);
    sine.stop(t + len + 0.3);
  }

  private bass(f: number, t: number, dur: number, vel: number) {
    const ctx = this.ctx;
    const out = this.env(t, 0.22 * vel, 0.02, dur * 0.6, 0.25);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    lp.connect(out);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.4);
  }

  private drone(f: number, t: number, dur: number) {
    const ctx = this.ctx;
    const out = this.env(t, 0.045, 0.25, dur * 0.7, dur * 0.6);
    for (const [ratio, gain] of [
      [1, 1],
      [1.5, 0.6],
      [2, 0.35],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * ratio;
      o.detune.value = (Math.random() - 0.5) * 6;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur * 1.4 + 0.3);
    }
  }

  private dhin(t: number, vel: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(68, t + 0.16);
    const out = this.env(t, 0.75 * vel, 0.004, 0.02, 0.32);
    o.connect(out);
    o.start(t);
    o.stop(t + 0.45);
    // The slap of the palm on the skin.
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const ng = this.env(t, 0.12 * vel, 0.002, 0.005, 0.05);
    n.connect(lp).connect(ng);
    n.start(t, Math.random() * 0.5, 0.1);
  }

  private ta(t: number, vel: number, amount: number) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 1.6;
    const ng = this.env(t, 0.32 * vel * amount, 0.002, 0.004, 0.07);
    n.connect(bp).connect(ng);
    n.start(t, Math.random() * 0.5, 0.12);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(560, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.08);
    const og = this.env(t, 0.22 * vel * amount, 0.002, 0.005, 0.1);
    o.connect(og);
    o.start(t);
    o.stop(t + 0.16);
  }

  private chime(t: number) {
    const ctx = this.ctx;
    const out = this.env(t, 0.05, 0.003, 0.02, 1.4);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    hp.connect(out);
    for (const r of [1, 2.76, 5.4, 8.93]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 1180 * r;
      o.connect(hp);
      o.start(t);
      o.stop(t + 1.6);
    }
  }
}
