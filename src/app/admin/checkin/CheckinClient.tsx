'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/lib/money';
import type { CheckinResponse, EventKind } from '@/lib/types';
import { vocabFor } from '@/lib/vocab';
import styles from './checkin.module.css';

type DetectedBarcode = { rawValue: string };

/**
 * The fallback for browsers without BarcodeDetector (iPhone Safari): each
 * poll draws the camera frame onto a small canvas and lets jsQR read it.
 * Loaded only when the camera opens, so the page itself stays light.
 */
async function jsQrDetector(): Promise<{ detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> }> {
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return {
    async detect(video: HTMLVideoElement) {
      if (!ctx || !video.videoWidth) return [];
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      return hit?.data ? [{ rawValue: hit.data }] : [];
    },
  };
}
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
  customer_card: 'Customer card',
};

const RESULT_BADGE: Record<CheckinResponse['result'], string> = {
  ok: 'badge-green',
  already_checked_in: 'badge-amber',
  not_found: 'badge-red',
  not_paid: 'badge-red',
  mock_ticket: 'badge-red',
  wrong_event: 'badge-red',
  // Neither good nor bad news — nothing was admitted or refused, somebody was
  // simply recognised.
  customer_card: 'badge-accent',
};

/**
 * The door scanner. Shows the holder's name on a valid scan, which is exactly
 * what door staff need and exactly why the PLATFORM OWNER no longer has a
 * check-in screen: this component is rendered only by the organizer's own
 * portal page and by /scan, both of which are scoped to a single event. The
 * folder is historical — there is no /admin/checkin route any more.
 *
 * It reads TWO kinds of code, not two scanners: a ticket, which is checked in,
 * and a customer card (lib/cards.ts), which is not — a card admits nobody and
 * is spent on nothing, it only says who is standing there. One box, because at
 * a counter there is one thing to do with whatever is held up: scan it. Which
 * kind arrived is decided server-side, and so is who may see a card at all —
 * see the `cards` prop and /api/admin/checkin.
 */
export default function CheckinClient({
  unauthorizedHref = '/portal/login',
  kind = 'event',
  cards = false,
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
  /**
   * Whether this scanner also reads CUSTOMER CARDS (lib/cards.ts). Purely
   * presentational — it changes the label and the hint, nothing else. The real
   * gate is in /api/admin/checkin, which answers a card lookup only to an
   * organizer's own session and never to a door-staff scanner cookie; passing
   * true from the wrong page would therefore reveal nothing, and passing
   * false from the right one only hides the invitation.
   *
   * Default false, so /scan — the tokenized link an organizer hands to door
   * staff — behaves exactly as it always did.
   */
  cards?: boolean;
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

  // Any phone with a camera: the browser's own QR detector where it has one
  // (Chrome, Android), otherwise jsQR reading the frames (iPhone Safari).
  useEffect(() => {
    setCameraSupported(typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia));
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
              // A card code is lowercase by design — uppercasing it in the log
              // would print something that is not the code anybody holds.
              code: data.card?.cardCode ?? data.ticket?.code ?? value.toUpperCase(),
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
      detectorRef.current = Ctor ? new Ctor({ formats: ['qr_code'] }) : await jsQrDetector();
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
            <label htmlFor="checkin-code">{cards ? `${v.Code} or card code` : `${v.Code} code`}</label>
            <input
              id="checkin-code"
              ref={inputRef}
              className={`input mono ${styles.codeInput}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              autoComplete="off"
              // A card code is lowercase; forcing capitals on the phone
              // keyboard would fight whoever is typing one in by hand.
              autoCapitalize={cards ? 'none' : 'characters'}
              spellCheck={false}
              placeholder={cards ? 'XXXX-XXXX or card-…' : 'XXXX-XXXX'}
              aria-label={cards ? `${v.Code} or customer card code` : `${v.Code} code`}
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
              {result.ticket?.buyerName ? <> · <span translate="no">{result.ticket.buyerName}</span></> : ''}
            </div>
            {result.ticket?.code && <div className={`mono small ${styles.resultDetail}`}>{result.ticket.code}</div>}
          </div>
        )}
        {!netError && result?.result === 'already_checked_in' && (
          <div key={resultKey} className={`notice notice-warn ${styles.result}`}>
            <div className={styles.resultTitle}>ALREADY USED</div>
            <div className={styles.resultDetail}>
              {isShop ? 'Collected' : 'Checked in'} at {result.checkedInAt} (UTC)
              {result.ticket?.buyerName ? <> · <span translate="no">{result.ticket.buyerName}</span></> : ''}
            </div>
            {result.ticket?.code && <div className={`mono small ${styles.resultDetail}`}>{result.ticket.code}</div>}
          </div>
        )}
        {/* A customer card, not a ticket: nothing was admitted and nothing was
            spent. It answers one question — who is this? — so the counter can
            greet a regular by name and honour a code they are holding. */}
        {!netError && result?.result === 'customer_card' && result.card && (
          <div key={resultKey} className={`notice ${styles.result}`}>
            <div className={styles.resultTitle}>
              CUSTOMER CARD{result.card.holderName ? <> — <span translate="no">{result.card.holderName}</span></> : ''}
            </div>
            <div className={styles.resultDetail}>
              {result.card.confirmedOrders}{' '}
              {result.card.confirmedOrders === 1 ? 'order' : 'orders'} with you · card held for{' '}
              {result.card.heldForDays} {result.card.heldForDays === 1 ? 'day' : 'days'}
              {result.card.lastSeenAt ? ` · last seen ${result.card.lastSeenAt} (UTC)` : ''}
            </div>
            <div className={`small ${styles.resultDetail}`} translate="no">{result.card.email}</div>
            {result.card.vouchers.length > 0 ? (
              <div className={styles.resultDetail}>
                Unspent codes:{' '}
                {result.card.vouchers
                  .map((voucher) => `${voucher.code} (${formatMoney(voucher.amountCents, result.card!.currency)} off)`)
                  .join(', ')}
              </div>
            ) : (
              <div className={`small ${styles.resultDetail}`}>No unspent codes.</div>
            )}
            <div className={`mono small ${styles.resultDetail}`}>{result.card.cardCode}</div>
            <div className={`small ${styles.resultDetail}`}>
              A card is not a {v.code} — nothing has been {v.redeemed} here.
            </div>
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
              {result.ticket?.buyerName ? <> (<span translate="no">{result.ticket.buyerName}</span>)</> : ''}.
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
              {result.ticket?.buyerName ? <> (<span translate="no">{result.ticket.buyerName}</span>)</> : ''}.
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
