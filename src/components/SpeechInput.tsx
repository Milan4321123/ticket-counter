'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Minimal Web Speech API surface. lib.dom does not ship SpeechRecognition
 * types, so we declare just the sliver we use and read the constructor off
 * window via a cast (no global augmentation, no extra deps).
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Props {
  /**
   * Called on every recognition update with the FULL transcript of the
   * current listening session (final + interim), so interim words refine
   * in place instead of stacking up. Capture your existing text in
   * `onStart` and render `base + text`.
   */
  onText: (text: string) => void;
  /** Fires right before listening begins — snapshot your current value here. */
  onStart?: () => void;
  /** BCP-47 language tag; defaults to the browser's own language. */
  lang?: string;
  /** Accessible label for the mic button. */
  label?: string;
  /** Optional helper text shown next to the mic (hidden when unsupported). */
  hint?: string;
}

/**
 * A mic toggle powered by the browser's built-in Web Speech API — free,
 * on-device/browser, no server round-trips. Renders nothing at all when the
 * browser has no speech recognition, so callers can mount it unconditionally.
 */
export default function SpeechInput({ onText, onStart, lang, label, hint }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Keep the latest callbacks without re-wiring the recognizer mid-session.
  const onTextRef = useRef(onText);
  const onStartRef = useRef(onStart);
  onTextRef.current = onText;
  onStartRef.current = onStart;

  useEffect(() => {
    // Detected in an effect so the server render matches the first client
    // render (window does not exist during SSR).
    setSupported(getRecognitionCtor() !== null);
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  function stop() {
    recRef.current?.stop();
    // onend arrives async — flip the visual state immediately.
    setListening(false);
  }

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    if (lang) rec.lang = lang;
    rec.onresult = (event) => {
      // Rebuild the whole session transcript every time: idempotent, and
      // interim guesses correct themselves instead of duplicating.
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0]?.transcript ?? '';
      }
      onTextRef.current(text.replace(/\s+/g, ' ').trim());
    };
    rec.onend = () => {
      if (recRef.current === rec) {
        recRef.current = null;
        setListening(false);
      }
    };
    rec.onerror = () => {
      // 'no-speech', mic permission denied, etc. — onend follows and cleans up.
      rec.stop();
    };
    onStartRef.current?.();
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
    }
  }

  if (!supported) return null;

  return (
    <>
      <button
        type="button"
        className={`mic-btn${listening ? ' mic-btn-live' : ''}`}
        onClick={() => (listening ? stop() : start())}
        aria-pressed={listening}
        aria-label={listening ? 'Stop listening' : (label ?? 'Speak instead of typing')}
        title={listening ? 'Stop listening' : (label ?? 'Speak instead of typing')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
          <path
            d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {hint ? <span className="speech-hint">{hint}</span> : null}
    </>
  );
}
