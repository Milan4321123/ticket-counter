'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Tap the mic, talk, and the words appear.
 *
 * This used to drive the browser's built-in Web Speech API. That was free and
 * needed no server, but it only exists in Chrome — so on iOS, where most of
 * these organizers actually are, the mic simply never appeared — it gave up at
 * the first long pause, and it had no idea what it was listening to, so the
 * Nepali names and food that are the entire subject of these events came out
 * as nonsense.
 *
 * Now it records, and sends the recording to be transcribed by a model that has
 * been told what it is about to hear (see lib/transcribe). The trade is real
 * and worth stating: you no longer see words appear as you speak, and you wait
 * a couple of seconds at the end. In exchange it works in every browser that
 * can record, it lets you think mid-sentence, and it gets "Dashain" right.
 *
 * The recording is held in memory, sent once, and never written down anywhere.
 */

/** Nothing longer than this is recorded — see the auto-stop in tick(). */
const MAX_SECONDS = 60;

/**
 * What we send. Every browser records in its own container — Chrome makes
 * WebM/Opus, Safari makes MP4/AAC — and rather than gamble on which of those
 * the model accepts today, the audio is decoded and re-encoded to plain WAV
 * before it leaves. WAV is explicitly supported, and 16 kHz mono is the shape
 * speech recognition wants anyway: it is a fraction of the size of the 48 kHz
 * stereo the browser hands us, and carries every bit of the speech.
 */
const TARGET_SAMPLE_RATE = 16_000;

type Phase = 'idle' | 'recording' | 'working';

interface Props {
  /**
   * Called once, with everything that was said in this recording. Capture your
   * existing text in `onStart` and render `base + text` — unchanged from the
   * previous implementation, so callers did not have to move.
   */
  onText: (text: string) => void;
  /** Fires when recording begins — snapshot your current value here. */
  onStart?: () => void;
  /** Accessible label for the mic button. */
  label?: string;
  /** Optional helper text shown next to the mic. */
  hint?: string;
}

/**
 * Whether the server can transcribe at all (GET /api/transcribe). It cannot
 * without a Gemini key, and it may not on Gemini's unpaid tier — a voice is
 * personal data (lib/transcribe). Asked once per page load, shared by every
 * mic on the page; any failure counts as "no".
 */
let serverCheck: Promise<boolean> | null = null;
function serverTranscribes(): Promise<boolean> {
  serverCheck ??= fetch('/api/transcribe', { method: 'GET', cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { available?: unknown } | null) => d?.available === true)
    .catch(() => false);
  return serverCheck;
}

/** True when this browser can record at all. */
function canRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== 'undefined'
  );
}

/**
 * Whether a mic should be shown at all: this browser can record AND the server
 * can transcribe. False on the server render and until the check lands, so
 * the first client render agrees with the server. Also for decorative mics
 * elsewhere (the Ask pill), which must not promise voice input that is off.
 */
export function useVoiceTyping(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    if (canRecord()) {
      void serverTranscribes().then((yes) => {
        if (yes && live) setOk(true);
      });
    }
    return () => {
      live = false;
    };
  }, []);
  return ok;
}

/**
 * Decode whatever the browser recorded, resample it to 16 kHz mono, and write a
 * WAV file around it.
 *
 * decodeAudioData is the trick that makes this browser-agnostic: a browser can
 * always decode the format it just produced, so we never have to know what that
 * format was.
 */
async function toWav(blob: Blob): Promise<Blob> {
  const bytes = await blob.arrayBuffer();

  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const decoder = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(bytes.slice(0));
  } finally {
    // Safari leaks audio contexts aggressively; a recorder used a dozen times
    // in one editing session would otherwise run the tab out of them.
    void decoder.close();
  }

  // Mix to mono at the target rate in one pass. OfflineAudioContext does the
  // resampling properly (it is the same code the browser uses for playback),
  // which naive sample-dropping does not — that produces the metallic aliasing
  // that makes a recognizer mishear.
  const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  const samples = rendered.getChannelData(0);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    // Clamp before scaling: rendering can overshoot ±1 slightly, and letting
    // that wrap around turns a loud syllable into a burst of noise.
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/** Base64 without the data: prefix, in chunks so a long clip cannot blow the stack. */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export default function SpeechInput({ onText, onStart, label, hint }: Props) {
  const available = useVoiceTyping();
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const onTextRef = useRef(onText);
  const onStartRef = useRef(onStart);
  onTextRef.current = onText;
  onStartRef.current = onStart;

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.state === 'recording' && recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function releaseMic() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  async function send(blob: Blob) {
    setPhase('working');
    try {
      const wav = await toWav(blob);
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audio: await toBase64(wav), mime: 'audio/wav' }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; text?: string; error?: string }
        | null;

      if (cancelledRef.current) return;
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'That did not come through — please try again, or type it in.');
        return;
      }
      const text = (data.text ?? '').trim();
      if (!text) {
        setError('We did not catch any speech there — try again a bit closer to the mic.');
        return;
      }
      onTextRef.current(text);
    } catch {
      if (!cancelledRef.current) {
        setError('That did not come through — please try again, or type it in.');
      }
    } finally {
      if (!cancelledRef.current) setPhase('idle');
    }
  }

  function stop() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'recording') return;
    // Flip the button immediately; onstop arrives a beat later.
    setPhase('working');
    rec.stop();
  }

/**
 * Ask for the microphone, with a plain retry.
 *
 * The processing constraints below are worth having — a phone in a noisy hall
 * needs all of them — but they are a REQUEST, and some browsers and some audio
 * drivers reject the whole call rather than ignoring a constraint they cannot
 * honour. Asking again for a bare microphone turns that dead end into a working
 * recording with slightly worse noise handling, which is the right trade.
 */
async function requestMic(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        // The browser's own cleanup is better than anything done afterwards.
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    // Only retry the failures that are about the CONSTRAINTS. A refused
    // permission is refused however politely it is asked again, and retrying
    // it would just show the visitor a second prompt for no reason.
    if (name === 'OverconstrainedError' || name === 'NotFoundError' || name === 'TypeError') {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }
    throw e;
  }
}

/**
 * Say what actually went wrong.
 *
 * This used to be one catch-all that always read "check the permission for this
 * site in your browser" — which is unhelpful when the cause is a microphone
 * already held by another app, or a browser that blocked it by policy rather
 * than by choice. Someone following that advice finds the permission already
 * granted and concludes the site is broken.
 *
 * getUserMedia names its failures, so each one gets the sentence that resolves
 * it. Brave gets a mention by name in the permission case: its Shields can
 * block the microphone independently of the site permission, so the setting
 * people are told to check will often look correct.
 */
function micErrorMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return (
        'The browser blocked the microphone. Tap the padlock in the address bar and allow the ' +
        'microphone for this site — in Brave, also check the Shields icon, which can block it ' +
        'even when the site permission looks fine.'
      );
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was found on this device. Plug one in, or type your notes instead.';
    case 'NotReadableError':
    case 'TrackStartError':
      return (
        'Something else is using the microphone — a call, or another tab. Close it and try again.'
      );
    case 'SecurityError':
      return 'Recording needs a secure (https) connection. Open this page over https and try again.';
    case 'AbortError':
      return 'The microphone stopped before it started. Please try again.';
    default:
      return 'We could not use the microphone. Please try again, or type it in.';
  }
}

  async function start() {
    if (phase !== 'idle') return;
    setError(null);

    let stream: MediaStream;
    try {
      stream = await requestMic();
    } catch (e) {
      setError(micErrorMessage(e));
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setError('This browser cannot record audio — please type instead.');
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      chunksRef.current = [];
      releaseMic();
      // A tap that caught nothing is not worth a round trip.
      if (blob.size < 2_000) {
        setPhase('idle');
        setError('That was too short to hear — hold the mic on while you talk.');
        return;
      }
      void send(blob);
    };
    recorder.onerror = () => {
      releaseMic();
      setPhase('idle');
      setError('The recording stopped unexpectedly. Please try again.');
    };

    streamRef.current = stream;
    recorderRef.current = recorder;
    onStartRef.current?.();
    setSeconds(0);
    setPhase('recording');
    recorder.start();

    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        // Stop rather than let someone talk for ten minutes into a request that
        // would be rejected for size at the other end.
        if (next >= MAX_SECONDS) stop();
        return next;
      });
    }, 1000);
  }

  // Renders nothing where recording or transcription is impossible, so callers
  // can mount it unconditionally next to a textarea that still works.
  if (!available) return null;

  const busy = phase === 'working';
  const recording = phase === 'recording';

  return (
    <>
      <button
        type="button"
        className={`mic-btn${recording ? ' mic-btn-live' : ''}`}
        onClick={() => (recording ? stop() : void start())}
        disabled={busy}
        aria-pressed={recording}
        aria-label={
          recording ? 'Stop recording' : busy ? 'Turning your words into text' : (label ?? 'Speak instead of typing')
        }
        title={recording ? 'Stop and write it out' : (label ?? 'Speak instead of typing')}
      >
        {busy ? (
          <span className="spinner" aria-hidden="true" />
        ) : (
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
        )}
      </button>

      {/* One live region for all three states, so a screen reader hears the
          progress instead of watching a button change colour silently. */}
      <span className="speech-hint" role="status" aria-live="polite">
        {recording
          ? `Listening… ${seconds}s — tap the mic again when you are done`
          : busy
            ? 'Writing out what you said…'
            : error
              ? error
              : (hint ?? '')}
      </span>
    </>
  );
}
