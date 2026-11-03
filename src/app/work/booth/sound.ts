// The booth's two sounds, made on the spot with the Web Audio API — no
// recordings: a soft beep for each countdown number and a shutter "click-
// shhk". Nothing is created until unlock() runs inside a tap; quiet on purpose.

export class BoothSfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
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
      this.out.gain.value = 0.3;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  private get live() {
    return this.ctx && this.out && !this.muted ? { ctx: this.ctx, out: this.out } : null;
  }

  beep(high = false) {
    const a = this.live;
    if (!a) return;
    const t0 = a.ctx.currentTime;
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(high ? 1320 : 880, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    o.connect(g).connect(a.out);
    o.start(t0);
    o.stop(t0 + 0.2);
  }

  shutter() {
    const a = this.live;
    if (!a) return;
    const t0 = a.ctx.currentTime;
    const len = Math.floor(a.ctx.sampleRate * 0.18);
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // two clicks (mirror up, mirror down) over a short hiss
      const click = (t < 0.04 ? 1 - t / 0.04 : 0) + (t > 0.55 && t < 0.6 ? 1 - (t - 0.55) / 0.05 : 0);
      d[i] = (Math.random() * 2 - 1) * (0.35 * (1 - t) + click * 0.9);
    }
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    const f = a.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1400;
    const g = a.ctx.createGain();
    g.gain.value = 0.6;
    src.connect(f).connect(g).connect(a.out);
    src.start(t0);
  }

  close() {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.out = null;
  }
}
