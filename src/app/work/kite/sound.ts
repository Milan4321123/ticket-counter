// Rooftop sounds made on the spot with the Web Audio API — no recordings.
// The "Wo-ho!" is a little synthesized crowd: a few buzzy voices sliding up
// and down through vowel filters, plus a breath of noise. Nothing plays until
// unlock() runs inside a tap, and mute silences everything. Kept quiet on
// purpose: it is a page someone may open on a bus.

export class KiteSfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private lastSaw = 0;
  muted = false;

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
      this.out.gain.value = 0.32;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  get ready() {
    return Boolean(this.ctx && this.out && !this.muted && this.ctx.state === 'running');
  }

  suspend() {
    if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => {});
  }

  close() {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.out = null;
  }

  private tone(freq: number, at: number, dur: number, wave: OscillatorType = 'sine', vol = 0.2, slideTo?: number) {
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
    o.stop(t0 + dur + 0.03);
  }

  private noise(at: number, dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass', q = 1) {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(out);
    src.start(ctx.currentTime + at);
  }

  /** One voice of the cheer: "wo" sliding up, then "ho" falling away. */
  private voice(at: number, f0: number, vol: number) {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out) return;
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 0.85, t0);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.18, t0 + 0.22);
    o.frequency.setValueAtTime(f0 * 1.32, t0 + 0.3);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.92, t0 + 0.85);
    // Two vowel formants: "w-o" opens from 300 to 520 Hz, "o" sits round.
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 6;
    f1.frequency.setValueAtTime(300, t0);
    f1.frequency.linearRampToValueAtTime(520, t0 + 0.2);
    f1.frequency.setValueAtTime(460, t0 + 0.3);
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = 7;
    f2.frequency.setValueAtTime(700, t0);
    f2.frequency.linearRampToValueAtTime(900, t0 + 0.2);
    f2.frequency.setValueAtTime(820, t0 + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t0 + 0.26);
    g.gain.exponentialRampToValueAtTime(vol * 1.1, t0 + 0.34);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95);
    o.connect(f1).connect(g);
    o.connect(f2).connect(g);
    g.connect(out);
    o.start(t0);
    o.stop(t0 + 1);
  }

  /** "Wo-ho!" from the neighbouring roofs. Bigger for a bigger combo. */
  woho(combo = 1) {
    if (!this.ready) return;
    const n = Math.min(7, 3 + combo);
    for (let i = 0; i < n; i++) this.voice(Math.random() * 0.09, 150 + Math.random() * 190, 0.22);
    this.noise(0.05, 0.7, 0.05, 1400, 'bandpass', 0.6);
  }

  /** The other string snaps. */
  snap() {
    if (!this.ready) return;
    this.noise(0, 0.07, 0.35, 3800, 'highpass');
    this.tone(1500, 0, 0.18, 'triangle', 0.12, 520);
  }

  /** Strings grinding while crossed (rate-limited). */
  saw(now: number) {
    if (!this.ready || now - this.lastSaw < 110) return;
    this.lastSaw = now;
    this.noise(0, 0.06, 0.08, 2600 + Math.random() * 600, 'bandpass', 3);
  }

  lost() {
    if (!this.ready) return;
    this.noise(0, 0.08, 0.25, 3000, 'highpass');
    this.tone(440, 0.05, 0.7, 'triangle', 0.12, 120);
  }

  loot() {
    if (!this.ready) return;
    this.tone(880, 0, 0.25, 'sine', 0.14);
    this.tone(1320, 0.09, 0.35, 'sine', 0.12);
  }

  hit() {
    if (!this.ready) return;
    this.tone(140, 0, 0.18, 'sine', 0.22, 70);
    this.noise(0, 0.12, 0.12, 600);
  }

  gust() {
    if (!this.ready) return;
    this.noise(0, 1.1, 0.07, 500, 'lowpass', 0.7);
  }

  start() {
    if (!this.ready) return;
    [392, 523.25, 659.25].forEach((f, i) => this.tone(f, i * 0.09, 0.22, 'triangle', 0.12));
  }

  over(good: boolean) {
    if (!this.ready) return;
    const notes = good ? [523.25, 659.25, 783.99, 1046.5] : [392, 349.23, 293.66];
    notes.forEach((f, i) => this.tone(f, i * 0.12, 0.4, 'triangle', 0.12));
  }
}
