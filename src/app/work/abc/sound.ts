// Sound for "Ka Kha Ga": the letters are spoken by the device's own speech
// voice (Web Speech API), and the little pops and chimes are made on the spot
// with Web Audio — no recordings, nothing fetched. Nothing makes a sound until
// a child taps, and the parent corner (or the header button) can switch it
// off. Voices that run on a speech server are never used (see pickVoice).

import { pickVoice, type VoiceKind } from './abc';

export type SpeechState = VoiceKind | 'unsupported' | 'unknown';

export class Speaker {
  private voice: SpeechSynthesisVoice | null = null;
  kind: SpeechState = 'unknown';
  private onChange: ((k: SpeechState) => void) | null = null;
  private listen = () => this.refresh();

  start(onChange: (k: SpeechState) => void) {
    this.onChange = onChange;
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      this.set('unsupported');
      return;
    }
    try {
      window.speechSynthesis.addEventListener?.('voiceschanged', this.listen);
    } catch {
      /* old browsers: the first refresh below is all we get */
    }
    this.refresh();
  }

  stop() {
    try {
      window.speechSynthesis?.removeEventListener?.('voiceschanged', this.listen);
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    this.onChange = null;
  }

  private set(k: SpeechState) {
    this.kind = k;
    this.onChange?.(k);
  }

  private refresh() {
    try {
      const { voice, kind } = pickVoice(window.speechSynthesis.getVoices());
      this.voice = voice;
      this.set(kind);
    } catch {
      this.voice = null;
      this.set('unsupported');
    }
  }

  /** Speak (only ever called from a tap). Returns what happened, so the page can show the fallback. */
  say(text: string): SpeechState {
    if (this.kind === 'unsupported') return 'unsupported';
    try {
      // Voices can arrive late on some browsers — look once more on the tap.
      if (!this.voice) this.refresh();
      if (!this.voice) return this.kind === 'unknown' ? 'none' : this.kind;
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = this.voice;
      u.lang = this.voice.lang;
      u.rate = 0.78;
      u.pitch = 1.08;
      synth.speak(u);
      return this.kind;
    } catch {
      return 'none';
    }
  }
}

export class Sfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  muted = false;

  unlock() {
    if (typeof window === 'undefined' || this.muted) return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.25;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  close() {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.out = null;
  }

  private tone(freq: number, at: number, dur: number, wave: OscillatorType = 'sine', vol = 0.2, slideTo?: number) {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out || this.muted || ctx.state !== 'running') return;
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

  pop() {
    this.tone(900, 0, 0.09, 'triangle', 0.22, 180);
    this.tone(1500, 0.02, 0.06, 'sine', 0.08);
  }
  good() {
    this.tone(660, 0, 0.12, 'triangle', 0.16);
    this.tone(990, 0.09, 0.18, 'triangle', 0.14);
  }
  oops() {
    this.tone(320, 0, 0.16, 'sine', 0.12, 240);
  }
  tap() {
    this.tone(520, 0, 0.05, 'sine', 0.08);
  }
  stars(n: number) {
    for (let i = 0; i < n; i++) this.tone(880 * Math.pow(1.26, i), i * 0.16, 0.22, 'triangle', 0.15);
  }
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.11, i === 3 ? 0.4 : 0.14, 'triangle', 0.15));
  }
}
