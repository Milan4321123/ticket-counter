// Game-show sounds made on the spot with the Web Audio API — no audio files.
// Nothing can play until unlock() runs inside a tap (browsers require that, and
// so do we: a page should not start beeping on its own), and mute silences all.

type Wave = OscillatorType;

export class QuizSfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  muted = false;

  /** Call from a click/tap handler. Creates (or wakes) the audio context. */
  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.42;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  get ready() {
    return Boolean(this.ctx && this.out && !this.muted && this.ctx.state === 'running');
  }

  close() {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.out = null;
  }

  private tone(freq: number, at: number, dur: number, wave: Wave = 'sine', vol = 0.3, slideTo?: number) {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out) return;
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(at: number, dur: number, vol: number, freq: number) {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(out);
    src.start(ctx.currentTime + at);
  }

  /** Clock tick; brighter and louder in the last seconds. */
  tick(urgent: boolean) {
    if (!this.ready) return;
    this.noise(0, 0.03, urgent ? 0.5 : 0.22, urgent ? 3200 : 2200);
    if (urgent) this.tone(1320, 0, 0.06, 'square', 0.05);
  }

  /** Someone walked into the lobby. */
  pop() {
    if (!this.ready) return;
    this.tone(520, 0, 0.12, 'sine', 0.18, 880);
  }

  /** A tap on an answer button. */
  tap() {
    if (!this.ready) return;
    this.tone(660, 0, 0.08, 'triangle', 0.2);
  }

  /** Question on screen. */
  whoosh() {
    if (!this.ready) return;
    this.noise(0, 0.35, 0.25, 900);
    this.tone(220, 0, 0.35, 'sine', 0.12, 440);
  }

  correct() {
    if (!this.ready) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, i * 0.085, 0.32, 'triangle', 0.22));
  }

  wrong() {
    if (!this.ready) return;
    this.tone(220, 0, 0.28, 'sawtooth', 0.09, 160);
    this.tone(165, 0.22, 0.42, 'sawtooth', 0.09, 110);
  }

  /** Reveal when you did not answer: a neutral chime. */
  chime() {
    if (!this.ready) return;
    this.tone(880, 0, 0.5, 'sine', 0.14);
    this.tone(1318.5, 0.08, 0.5, 'sine', 0.08);
  }

  /** Rows sliding on the leaderboard. */
  swish() {
    if (!this.ready) return;
    this.noise(0, 0.5, 0.12, 1500);
  }

  fanfare() {
    if (!this.ready) return;
    const n = [
      [392, 0, 0.16],
      [392, 0.17, 0.16],
      [392, 0.34, 0.16],
      [523.25, 0.52, 0.5],
      [659.25, 1.04, 0.22],
      [587.33, 1.27, 0.22],
      [659.25, 1.5, 0.22],
      [783.99, 1.74, 0.9],
    ] as const;
    for (const [f, at, d] of n) {
      this.tone(f, at, d + 0.08, 'sawtooth', 0.07);
      this.tone(f * 2, at, d + 0.08, 'triangle', 0.08);
    }
    this.tone(130.81, 0.52, 1.0, 'triangle', 0.18);
    this.tone(196, 1.74, 1.0, 'triangle', 0.18);
    for (let i = 0; i < 6; i++) this.noise(1.74 + i * 0.05, 0.3, 0.12, 5000);
  }
}
