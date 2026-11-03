// The sound of "Dui Kinara Radio": one small Web Audio engine that plays the
// live stream (a madal-style beat, a drone and a pentatonic flute line,
// with a jingle sting between segments — radio.ts decides every note from
// the wall clock, so everyone "tuned in" hears the same bar) or a podcast
// episode (a soft music bed with a chime at each chapter, seekable, at 1×,
// 1.25× or 1.5×). No samples, no recordings, no stream from anywhere.
//
// Nothing runs until RadioEngine.create() is called from a tap. Paused means
// the AudioContext is suspended; the page closes it altogether after a while
// in the background (RadioApp.tsx).

import {
  EP_INTRO_SEC,
  STING_SEC,
  barEvents,
  barSec,
  episodeStyle,
  liveSegment,
  segmentStyle,
  stingEvents,
  type Ev,
  type ShowId,
  type Style,
} from './radio';

export type LiveSource = { kind: 'live'; showAt: (ms: number) => ShowId };
export type EpisodeSource = { kind: 'ep'; id: string; dur: number; chapters: number[] };
export type Source = LiveSource | EpisodeSource;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class RadioEngine {
  readonly ctx: AudioContext;
  readonly analyser: AnalyserNode;
  private out: GainNode;
  private input: GainNode;
  private echoIn: GainNode;
  private noise: AudioBuffer;
  private crackle: AudioBufferSourceNode | null = null;
  private crackleGain: GainNode;
  private droneGain: GainNode;
  private drones: OscillatorNode[] = [];
  private droneKey = '';
  private bus: GainNode | null = null;
  private src: Source | null = null;
  private style: Style | null = null;
  private anchorCtx = 0;
  private anchorPos = 0;
  private rate = 1;
  private cursor = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private horizon = 0.4;
  private ended = false;
  private pausedAt: number | null = null;
  onEnd: (() => void) | null = null;

  private constructor(ctx: AudioContext) {
    this.ctx = ctx;
    // bus(es) → input → lo-fi lowpass → compressor → analyser → volume → speakers
    this.input = ctx.createGain();
    const lofi = ctx.createBiquadFilter();
    lofi.type = 'lowpass';
    lofi.frequency.value = 5200;
    lofi.Q.value = 0.4;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.82;
    this.out = ctx.createGain();
    this.out.gain.value = 0.8;
    this.input.connect(lofi).connect(comp).connect(this.analyser).connect(this.out).connect(ctx.destination);

    // A cheap tape echo instead of a reverb: delay + feedback through a lowpass.
    this.echoIn = ctx.createGain();
    this.echoIn.gain.value = 0.22;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.33;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2200;
    this.echoIn.connect(delay);
    delay.connect(damp).connect(fb).connect(delay);
    damp.connect(this.input);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    this.crackleGain = ctx.createGain();
    this.crackleGain.gain.value = 0;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    this.crackleGain.connect(hp).connect(this.input);

    // The drone runs as long as something plays; its pitch follows the tune.
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.droneGain.connect(this.input);
    for (const [ratio, g] of [
      [1, 1],
      [1.5, 0.5],
      [2, 0.28],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 110 * ratio;
      o.detune.value = (Math.random() - 0.5) * 8;
      const gain = ctx.createGain();
      gain.gain.value = g;
      o.connect(gain).connect(this.droneGain);
      o.start();
      this.drones.push(o);
    }
  }

  /** Call from a tap only. Null where Web Audio is missing. */
  static create(): RadioEngine | null {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) return null;
    try {
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* older Safari */
    }
    try {
      return new RadioEngine(new AC({ latencyHint: 'playback' }));
    } catch {
      return null;
    }
  }

  get source(): Source | null {
    return this.src;
  }

  get playing(): boolean {
    return this.timer !== null && this.ctx.state === 'running';
  }

  /** Seconds into the episode; for live, wall-clock seconds. */
  get position(): number {
    if (!this.src) return 0;
    if (this.pausedAt !== null) return this.pausedAt;
    const p = this.anchorPos + Math.max(0, this.ctx.currentTime - this.anchorCtx) * this.rate;
    return this.src.kind === 'ep' ? Math.min(this.src.dur, p) : p;
  }

  setVolume(v: number) {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) ** 1.6, t, 0.05);
  }

  /** In the background, schedule further ahead (timers there tick slowly). */
  setBackground(bg: boolean) {
    this.horizon = bg ? 1.6 : 0.4;
  }

  playLive(showAt: (ms: number) => ShowId) {
    this.src = { kind: 'live', showAt };
    this.rate = 1;
    this.droneKey = '';
    this.restartAt(Date.now() / 1000);
    this.crackleOn(true);
    this.go();
  }

  playEpisode(src: Omit<EpisodeSource, 'kind'>, from: number, rate: number) {
    this.src = { kind: 'ep', ...src };
    this.style = episodeStyle(src.id);
    this.rate = rate;
    this.droneKey = '';
    this.restartAt(Math.max(0, Math.min(src.dur - 0.5, from)));
    this.crackleOn(false);
    this.go();
  }

  seek(pos: number) {
    if (!this.src || this.src.kind !== 'ep') return;
    const p = Math.max(0, Math.min(this.src.dur - 0.5, pos));
    if (this.pausedAt !== null) {
      this.pausedAt = p;
      return;
    }
    this.restartAt(p);
    this.tick();
  }

  setRate(r: number) {
    if (!this.src || this.src.kind !== 'ep' || r === this.rate) return;
    const p = this.position;
    this.rate = r;
    if (this.pausedAt === null) {
      this.restartAt(p);
      this.tick();
    }
  }

  pause() {
    if (!this.src) return;
    this.pausedAt = this.position;
    this.stopTimer();
    this.fadeOutBus();
    void this.ctx.suspend();
  }

  /** Carry on: live jumps to "now", an episode to where it was paused. */
  resume() {
    if (!this.src) return;
    const p = this.src.kind === 'live' ? Date.now() / 1000 : (this.pausedAt ?? this.position);
    this.pausedAt = null;
    this.restartAt(p);
    this.go();
  }

  stop() {
    this.stopTimer();
    this.fadeOutBus();
    this.crackleOn(false);
    this.droneTo(null, this.ctx.currentTime);
    this.src = null;
    this.pausedAt = null;
    void this.ctx.suspend();
  }

  close() {
    this.stopTimer();
    void this.ctx.close();
  }

  // ---------- scheduling ----------

  private go() {
    this.pausedAt = null;
    if (this.ctx.state !== 'running') void this.ctx.resume();
    if (!this.timer) this.timer = setInterval(() => this.tick(), 90);
    this.tick();
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private restartAt(pos: number) {
    this.fadeOutBus();
    const bus = this.ctx.createGain();
    bus.connect(this.input);
    bus.connect(this.echoIn);
    this.bus = bus;
    this.anchorPos = pos;
    this.anchorCtx = this.ctx.currentTime + 0.06;
    this.cursor = pos;
    this.ended = false;
    this.droneKey = '';
  }

  private fadeOutBus() {
    const bus = this.bus;
    if (!bus) return;
    const t = this.ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + 0.08);
    setTimeout(() => {
      try {
        bus.disconnect();
      } catch {
        /* already gone */
      }
    }, 500);
    this.bus = null;
  }

  /** Context time of a source time. */
  private at(t: number): number {
    return this.anchorCtx + (t - this.anchorPos) / this.rate;
  }

  private tick() {
    const src = this.src;
    if (!src || !this.bus) return;
    const end = this.position + this.horizon * this.rate;
    let guard = 0;
    while (this.cursor < end && guard++ < 64) {
      if (src.kind === 'live') this.stepLive(src);
      else if (!this.stepEpisode(src)) break;
    }
    if (src.kind === 'ep' && !this.ended && this.position >= src.dur - 0.05) {
      this.ended = true;
      this.stopTimer();
      this.droneTo(null, this.ctx.currentTime);
      this.onEnd?.();
    }
  }

  private stepLive(src: LiveSource) {
    const c = this.cursor;
    const seg = liveSegment(c * 1000);
    const segStart = seg.startMs / 1000;
    const segEnd = seg.endMs / 1000;
    const style = segmentStyle(seg.index, src.showAt(seg.startMs));
    this.style = style;
    const key = `live${seg.index}`;
    if (this.droneKey !== key) {
      this.droneKey = key;
      this.droneTo(style, this.at(Math.max(c, segStart + STING_SEC * 0.6)));
    }
    const stingEnd = segStart + STING_SEC;
    if (c < stingEnd) {
      if (c <= segStart + 0.3) for (const e of stingEvents(style.root + 12)) this.play(e, segStart + e.at, 1);
      this.cursor = stingEnd;
      return;
    }
    const bs = barSec(style);
    const k = Math.floor((c - stingEnd) / bs + 1e-9);
    const barStart = stingEnd + k * bs;
    if (barStart + bs > segEnd - 0.15) {
      this.cursor = segEnd;
      return;
    }
    for (const e of barEvents(style, k)) {
      const t = barStart + e.at;
      if (t >= c - 1e-6) this.play(e, t, 1);
    }
    this.cursor = barStart + bs;
  }

  /** False once the episode has nothing more to schedule. */
  private stepEpisode(src: EpisodeSource): boolean {
    const style = this.style!;
    const c = this.cursor;
    if (c >= src.dur - 2) return false;
    if (this.droneKey !== src.id) {
      this.droneKey = src.id;
      this.droneTo(style, this.at(c));
    }
    if (c < EP_INTRO_SEC) {
      if (c <= 0.3) for (const e of stingEvents(style.root + 12)) this.play(e, e.at, this.rate);
      this.cursor = EP_INTRO_SEC;
      return true;
    }
    const bs = barSec(style);
    const k = Math.floor((c - EP_INTRO_SEC) / bs + 1e-9);
    const barStart = EP_INTRO_SEC + k * bs;
    const barEnd = barStart + bs;
    for (const e of barEvents(style, k)) {
      const t = barStart + e.at;
      if (t >= c - 1e-6 && t < src.dur - 2.5) this.play(e, t, this.rate);
    }
    // A chapter starts in this bar: ring the chime there.
    for (const ch of src.chapters) {
      if (ch > 0 && ch >= c && ch >= barStart && ch < barEnd) {
        for (const e of stingEvents(style.root + 12).slice(-3)) this.play(e, ch + e.at, this.rate);
      }
    }
    this.cursor = barEnd;
    return true;
  }

  private play(e: Ev, t: number, rate: number) {
    const when = Math.max(this.ctx.currentTime, this.at(t));
    const dur = e.dur / rate;
    switch (e.kind) {
      case 'lead':
        return this.flute(hz(e.midi), when, dur, e.vel);
      case 'bass':
        return this.bassNote(hz(e.midi), when, dur, e.vel);
      case 'pad':
        return this.pad(hz(e.midi), when, dur);
      case 'dhin':
        return this.dhin(when, e.vel);
      case 'ta':
        return this.ta(when, e.vel, 1);
      case 'tick':
        return this.ta(when, e.vel, 0.45);
      case 'chime':
        return this.chime(when, e.vel);
      case 'bell':
        return this.bell(hz(e.midi), when, e.vel);
    }
  }

  private droneTo(style: Style | null, t: number) {
    const g = this.droneGain.gain;
    g.cancelScheduledValues(t);
    if (!style) {
      g.setTargetAtTime(0, t, 0.2);
      return;
    }
    const f = hz(style.root - 12);
    for (const [i, o] of this.drones.entries()) o.frequency.setTargetAtTime(f * [1, 1.5, 2][i], t, 0.4);
    g.setTargetAtTime(style.pad ? 0.05 : 0.038, t, 0.6);
  }

  private crackleOn(on: boolean) {
    const t = this.ctx.currentTime;
    if (on && !this.crackle) {
      // Sparse clicks and a little hiss, looped: the "radio" in the sound.
      const len = this.ctx.sampleRate * 3;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.05 + (Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 0.9 : 0);
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.connect(this.crackleGain);
      s.start();
      this.crackle = s;
      this.crackleGain.gain.setTargetAtTime(0.1, t, 0.3);
    } else if (!on && this.crackle) {
      const s = this.crackle;
      this.crackle = null;
      this.crackleGain.gain.setTargetAtTime(0, t, 0.1);
      try {
        s.stop(t + 0.5);
      } catch {
        /* already stopped */
      }
    }
  }

  // ---------- voices ----------

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
    const len = Math.max(0.12, dur * 0.9);
    const out = this.env(t, 0.13 * vel, 0.05, len - 0.05, 0.18);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.connect(out);
    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    const sine = ctx.createOscillator();
    sine.type = 'sine';
    const tg = ctx.createGain();
    tg.gain.value = 0.55;
    tri.connect(tg).connect(lp);
    sine.connect(lp);
    for (const o of [tri, sine]) {
      o.frequency.setValueAtTime(f * 0.972, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    }
    if (len > 0.35) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.45, len));
      lfo.connect(depth);
      depth.connect(tri.frequency);
      depth.connect(sine.frequency);
      lfo.start(t);
      lfo.stop(t + len + 0.25);
    }
    tri.start(t);
    sine.start(t);
    tri.stop(t + len + 0.3);
    sine.stop(t + len + 0.3);
  }

  private bassNote(f: number, t: number, dur: number, vel: number) {
    const ctx = this.ctx;
    const out = this.env(t, 0.2 * vel, 0.02, dur * 0.6, 0.22);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 480;
    lp.connect(out);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.35);
  }

  private pad(f: number, t: number, dur: number) {
    const ctx = this.ctx;
    const out = this.env(t, 0.05, Math.min(0.8, dur * 0.3), dur * 0.5, dur * 0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(out);
    for (const [ratio, det] of [
      [1, -7],
      [1.5, 6],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * ratio;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur * 1.25 + 0.2);
    }
  }

  private dhin(t: number, vel: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(66, t + 0.16);
    o.connect(this.env(t, 0.7 * vel, 0.004, 0.02, 0.3));
    o.start(t);
    o.stop(t + 0.42);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    n.connect(lp).connect(this.env(t, 0.1 * vel, 0.002, 0.005, 0.05));
    n.start(t, Math.random() * 0.5, 0.1);
  }

  private ta(t: number, vel: number, amount: number) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2300;
    bp.Q.value = 1.6;
    n.connect(bp).connect(this.env(t, 0.28 * vel * amount, 0.002, 0.004, 0.07));
    n.start(t, Math.random() * 0.5, 0.12);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(540, t);
    o.frequency.exponentialRampToValueAtTime(410, t + 0.08);
    o.connect(this.env(t, 0.2 * vel * amount, 0.002, 0.005, 0.1));
    o.start(t);
    o.stop(t + 0.16);
  }

  private chime(t: number, vel: number) {
    const ctx = this.ctx;
    const out = this.env(t, 0.045 * vel, 0.003, 0.02, 1.3);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    hp.connect(out);
    for (const r of [1, 2.76, 5.4]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 1180 * r;
      o.connect(hp);
      o.start(t);
      o.stop(t + 1.4);
    }
  }

  private bell(f: number, t: number, vel: number) {
    const ctx = this.ctx;
    const out = this.env(t, 0.09 * vel, 0.004, 0.03, 1.1);
    for (const [r, g] of [
      [1, 1],
      [2.01, 0.35],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * r;
      const gg = ctx.createGain();
      gg.gain.value = g;
      o.connect(gg).connect(out);
      o.start(t);
      o.stop(t + 1.25);
    }
  }
}
