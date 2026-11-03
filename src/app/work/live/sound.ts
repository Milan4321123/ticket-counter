// The door scanner's beeps, made on the spot with Web Audio — no audio files.
// Only the visitor's own taps on the scan buttons ever make a sound.

export class ScanBeep {
  private ctx: AudioContext | null = null;

  /** Call inside a click handler: browsers only allow audio after a tap. */
  private wake(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private tone(freq: number, at: number, dur: number, wave: OscillatorType, vol: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.setValueAtTime(vol, t0 + dur - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  /** A clean "accepted" beep: short, high, two notes up. */
  ok() {
    if (!this.wake()) return;
    this.tone(1568, 0, 0.09, 'square', 0.07);
    this.tone(2093, 0.1, 0.12, 'square', 0.07);
  }

  /** "Already scanned": two low buzzes. */
  dup() {
    if (!this.wake()) return;
    this.tone(220, 0, 0.16, 'sawtooth', 0.09);
    this.tone(196, 0.2, 0.22, 'sawtooth', 0.09);
  }

  close() {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
