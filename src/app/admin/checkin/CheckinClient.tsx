'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CheckinResponse, EventKind } from '@/lib/types';
import { vocabFor } from '@/lib/vocab';
import styles from './checkin.module.css';

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

interface LogEntry {
  code: string;
  result: CheckinResponse['result'];
  at: string;
}

const RESULT_LABEL: Record<CheckinResponse['result'], string> = {
  ok: 'Valid',
  already_checked_in: 'Already used',
  not_found: 'Not found',
  not_paid: 'Not paid',
  mock_ticket: 'Test code',
  wrong_event: 'Wrong listing',
};

const RESULT_BADGE: Record<CheckinResponse['result'], string> = {
  ok: 'badge-green',
  already_checked_in: 'badge-amber',
  not_found: 'badge-red',
  not_paid: 'badge-red',
  mock_ticket: 'badge-red',
  wrong_event: 'badge-red',
};

/**
 * The door scanner. Shows the holder's name on a valid scan, which is exactly
 * what door staff need and exactly why the PLATFORM OWNER no longer has a
 * check-in screen: this component is rendered only by the organizer's own
 * portal page and by /scan, both of which are scoped to a single event. The
 * folder is historical — there is no /admin/checkin route any more.
 */
export default function CheckinClient({
  unauthorizedHref = '/portal/login',
  kind = 'event',
}: {
  /** Where to send the user when the session is no longer valid (401). */
  unauthorizedHref?: string;
  /**
   * What is being scanned. The scan itself is identical either way — same
   * endpoint, same one-use rule — but "VALID — welcome!" is the wrong thing to
   * shout at someone collecting a bag of momos. Defaults to 'event' so a caller
   * that has not been taught about kinds behaves exactly as it always did.
   */
  kind?: EventKind;
}) {
  const v = vocabFor(kind);
  const isShop = kind === 'shop';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const timerRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const detectingRef = useRef(false);

  useEffect(() => {
    setCameraSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window);
  }, []);

  const stopCamera = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    detectorRef.current = null;
    setScanning(false);
  }, []);

  // Clean up the camera stream on unmount.
  useEffect(() => () => stopCamera(), [stopCamera]);

  const submit = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNetError(null);
    try {
      const res = await fetch('/api/admin/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: value }),
      });
      if (res.status === 401) {
        window.location.href = unauthorizedHref;
        return;
      }
      const data = (await res.json().catch(() => null)) as CheckinResponse | null;
      if (!data || !data.result) {
        setNetError('Something went wrong. Please try again.');
      } else {
        setResult(data);
        setLog((prev) =>
          [
            {
              code: data.ticket?.code ?? value.toUpperCase(),
              result: data.result,
              at: new Date().toLocaleTimeString(),
            },
            ...prev,
          ].slice(0, 8)
        );
      }
    } catch {
      setNetError('Could not reach the server. Please check your connection and try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
      // Barcode scanners type the code and press Enter — always be ready for
      // the next scan: clear the input and put focus back.
      setCode('');
      inputRef.current?.focus();
    }
  }, [unauthorizedHref]);

  const startCamera = useCallback(async () => {
    setCameraNote(null);
    try {
      const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!Ctor) throw new Error('unsupported');
      detectorRef.current = new Ctor({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
    } catch {
      stopCamera();
      setCameraNote('Camera scanning not supported here — type the code instead.');
    }
  }, [stopCamera]);

  // When scanning turns on (and the <video> exists), attach the stream and
  // start the detection loop.
  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch(() => {
      /* autoplay hiccups are fine; the poll below waits for readiness */
    });

    timerRef.current = window.setInterval(async () => {
      const v = videoRef.current;
      const detector = detectorRef.current;
      if (!v || !detector || v.readyState < 2 || detectingRef.current) return;
      detectingRef.current = true;
      try {
        const found = await detector.detect(v);
        const rawValue = found[0]?.rawValue;
        if (rawValue) {
          stopCamera();
          void submit(rawValue);
        }
      } catch {
        // Ignore per-frame detection errors and keep polling.
      } finally {
        detectingRef.current = false;
      }
    }, 300);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scanning, stopCamera, submit]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit(code);
  }

  // Re-mounts the result notice on each new scan so its entrance animation
  // replays (visual only — the log entry timestamp changes per scan).
  const resultKey = log[0] ? `${log[0].code}-${log[0].at}` : 'result';

  return (
    <div>
      <div className="card">
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="checkin-code">{v.Code} code</label>
            <input
              id="checkin-code"
              ref={inputRef}
              className={`input mono ${styles.codeInput}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              aria-label={`${v.Code} code`}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !code.trim()}>
            {busy ? <span className="spinner" aria-hidden /> : null}
            {busy ? 'Checking…' : isShop ? 'Mark collected' : 'Check in'}
          </button>
        </form>

        <div style={{ marginTop: 14 }}>
          {cameraSupported && !scanning && (
            <button type="button" className="btn btn-block" onClick={startCamera}>
              Scan with camera
            </button>
          )}
          {scanning && (
            <div>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
              <button type="button" className="btn btn-block" style={{ marginTop: 10 }} onClick={stopCamera}>
                Stop camera
              </button>
            </div>
          )}
          {cameraNote && <p className="muted small" style={{ margin: '10px 0 0' }}>{cameraNote}</p>}
          {!cameraSupported && !cameraNote && (
            <p className="muted small" style={{ margin: '10px 0 0' }}>
              Camera scanning not supported here — type the code instead.
            </p>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }} aria-live="polite">
        {netError && <div className="notice notice-error">{netError}</div>}
        {!netError && result?.result === 'ok' && (
          <div key={resultKey} className={`notice notice-success ${styles.result}`}>
            <div className={styles.resultTitle}>{isShop ? 'VALID — hand it over!' : 'VALID — welcome!'}</div>
            <div className={styles.resultDetail}>
              {result.ticket?.tierName}
              {result.ticket?.buyerName ? ` · ${result.ticket.buyerName}` : ''}
            </div>
            {result.ticket?.code && <div className={`mono small ${styles.resultDetail}`}>{result.ticket.code}</div>}
          </div>
        )}
        {!netError && result?.result === 'already_checked_in' && (
          <div key={resultKey} className={`notice notice-warn ${styles.result}`}>
            <div className={styles.resultTitle}>ALREADY USED</div>
            <div className={styles.resultDetail}>
              {isShop ? 'Collected' : 'Checked in'} at {result.checkedInAt} (UTC)
              {result.ticket?.buyerName ? ` · ${result.ticket.buyerName}` : ''}
            </div>
            {result.ticket?.code && <div className={`mono small ${styles.resultDetail}`}>{result.ticket.code}</div>}
          </div>
        )}
        {!netError && result?.result === 'not_found' && (
          <div key={resultKey} className={`notice notice-error ${styles.result}`}>
            <div className={styles.resultTitle}>{v.Code} not found</div>
            <div className={styles.resultDetail}>Double-check the code and try again.</div>
          </div>
        )}
        {!netError && result?.result === 'not_paid' && (
          <div key={resultKey} className={`notice notice-error ${styles.result}`}>
            <div className={styles.resultTitle}>Order not paid</div>
            <div className={styles.resultDetail}>
              This {v.code} belongs to an unpaid order
              {result.ticket?.buyerName ? ` (${result.ticket.buyerName})` : ''}.
            </div>
          </div>
        )}
        {!netError && result?.result === 'wrong_event' && (
          <div className={`notice notice-error ${styles.result}`}>
            <div className={styles.resultTitle}>Somewhere else</div>
            <div className={styles.resultDetail}>
              This {v.code} belongs to a different listing — it is not valid at {v.where}.
            </div>
          </div>
        )}
        {!netError && result?.result === 'mock_ticket' && (
          <div key={resultKey} className={`notice notice-error ${styles.result}`}>
            <div className={styles.resultTitle}>
              TEST {v.code} — {isShop ? 'do not hand over' : 'do not admit'}
            </div>
            <div className={styles.resultDetail}>
              This {v.code} came from test mode; no real payment was made
              {result.ticket?.buyerName ? ` (${result.ticket.buyerName})` : ''}.
            </div>
          </div>
        )}
      </div>

      {log.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Recent scans</div>
          <div>
            {log.map((entry, i) => (
              <div key={`${entry.code}-${entry.at}-${i}`} className={styles.logRow}>
                <span className="mono">{entry.code}</span>
                <span className="muted small">{entry.at}</span>
                <span className={`badge ${RESULT_BADGE[entry.result]}`}>{RESULT_LABEL[entry.result]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
