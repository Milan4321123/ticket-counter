'use client';

// The greeting-card maker: pick a festival, a look and a wish, add a name and
// (optionally) a photo, and send it. The card is drawn on a canvas right here
// (components/greeting/drawCard) — the photo is read from the phone and never
// leaves it, which is also why there is no upload, no wait, and no server cost.
import { useEffect, useRef, useState } from 'react';
import { drawCard, type CardFonts } from '@/components/greeting/drawCard';
import type { CardFestival, CardLook } from '@/lib/greetingCards';

interface Props {
  festivals: CardFestival[];
  initialSlug: string;
  fonts: CardFonts;
  /** next/font class names, rendered once so their @font-face rules load. */
  fontClasses: string[];
  siteUrl: string;
}

const SIZES = {
  post: { w: 1080, h: 1350, label: 'Post · 4:5' },
  status: { w: 1080, h: 1920, label: 'Status · 9:16' },
} as const;
type SizeKey = keyof typeof SIZES;

interface LoadedPhoto {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/** The longest side a chosen photo is kept at — plenty for a 300 px circle. */
const PHOTO_MAX = 1200;
const OWN = -1;
/** Festivals shown before "More festivals…" — the ones on now and next. */
const SOON = 3;

export default function CardMaker({ festivals, initialSlug, fonts, fontClasses, siteUrl }: Props) {
  const [slug, setSlug] = useState(initialSlug);
  const fest = festivals.find((f) => f.slug === slug) ?? festivals[0];
  const [look, setLook] = useState<CardLook>(fest.looks[0].id);
  const [wishIdx, setWishIdx] = useState(0);
  const [ownNe, setOwnNe] = useState('');
  const [ownEn, setOwnEn] = useState('');
  const [from, setFrom] = useState('');
  const [size, setSize] = useState<SizeKey>('post');
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null);
  const [zoom, setZoom] = useState(1);
  const [focusX, setFocusX] = useState(0.5);
  const [focusY, setFocusY] = useState(0.4);
  const [fontsReady, setFontsReady] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [allFestivals, setAllFestivals] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const wish = wishIdx === OWN ? { ne: ownNe, en: ownEn } : (fest.wishes[wishIdx] ?? fest.wishes[0]);
  const kicker = look === 'bhaitika' ? `Bhai Tika ${fest.year}` : `Happy ${fest.name} ${fest.year}`;

  // The card's fonts must be loaded before the first real draw, or the canvas
  // paints in a fallback face and never repaints. Give up waiting after 3 s.
  useEffect(() => {
    let live = true;
    const sample = 'शुभकामना Happy 2026';
    const loads = [
      `400 64px ${fonts.display}`,
      `500 40px ${fonts.body}`,
      `700 40px ${fonts.body}`,
      `700 56px ${fonts.script}`,
    ].map((f) => document.fonts.load(f, sample).catch(() => []));
    const timer = setTimeout(() => live && setFontsReady(true), 3000);
    Promise.all(loads).then(() => live && setFontsReady(true));
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [fonts]);

  // Only a phone can hand a picture straight to WhatsApp; a desktop downloads.
  useEffect(() => {
    try {
      const probe = new File([new Blob(['x'], { type: 'image/jpeg' })], 'probe.jpg', { type: 'image/jpeg' });
      setCanShareFiles(Boolean(navigator.canShare?.({ files: [probe] })));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { w, h } = SIZES[size];
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const raf = requestAnimationFrame(() =>
      drawCard(ctx, {
        look,
        festival: fest.slug,
        width: w,
        height: h,
        kicker,
        greeting: wish.ne,
        message: wish.en,
        from,
        photo: photo
          ? {
              image: photo.canvas,
              width: photo.width,
              height: photo.height,
              zoom,
              focusX,
              focusY,
            }
          : null,
        fonts,
      })
    );
    return () => cancelAnimationFrame(raf);
  }, [look, fest.slug, size, kicker, wish.ne, wish.en, from, photo, zoom, focusX, focusY, fonts, fontsReady]);

  function chooseFestival(next: string) {
    const f = festivals.find((x) => x.slug === next);
    if (!f) return;
    setSlug(next);
    setLook(f.looks[0].id);
    setWishIdx(0);
  }

  function chooseLook(next: CardLook) {
    setLook(next);
    // The Bhai Tika look comes with its own wish, unless they wrote one.
    if (wishIdx !== OWN) {
      const bhai = fest.wishes.findIndex((w) => w.ne.includes('भाइटीका'));
      if (next === 'bhaitika' && bhai >= 0) setWishIdx(bhai);
      else if (next !== 'bhaitika' && wishIdx === bhai) setWishIdx(0);
    }
  }

  async function onPhoto(file: File | undefined) {
    setNote('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNote('That file is not a photo — pick a picture instead.');
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const s = Math.min(1, PHOTO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * s));
      c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      setPhoto({ canvas: c, width: c.width, height: c.height });
      setZoom(1);
      setFocusX(0.5);
      setFocusY(0.4);
    } catch {
      setNote('That photo could not be opened — try another one.');
    } finally {
      URL.revokeObjectURL(url);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function makeFile(): Promise<File | null> {
    const canvas = canvasRef.current;
    if (!canvas) return Promise.resolve(null);
    return new Promise((resolve) =>
      canvas.toBlob(
        (blob) =>
          resolve(
            blob
              ? new File([blob], `${fest.slug}-${fest.year}-card.jpg`, {
                  type: 'image/jpeg',
                })
              : null
          ),
        'image/jpeg',
        0.92
      )
    );
  }

  function download(file: File) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setNote('Saved. Now send it to the family group!');
  }

  async function send(mode: 'share' | 'download') {
    setBusy(true);
    setNote('');
    try {
      const file = await makeFile();
      if (!file) throw new Error('no picture');
      if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
        const text = `${wish.ne.trim() || fest.nameNe}\n\nMake your own ${fest.name} card, free: ${siteUrl}/card?f=${fest.slug}`;
        try {
          await navigator.share({ files: [file], text });
        } catch (e) {
          if ((e as Error)?.name !== 'AbortError') download(file);
        }
      } else {
        download(file);
      }
    } catch {
      setNote('The picture could not be made — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gc">
      {fontClasses.map((cls) => (
        <span key={cls} className={`${cls} gc-fontprobe`} aria-hidden="true">
          शुभ Aa
        </span>
      ))}

      <div className="gc-preview">
        <canvas
          ref={canvasRef}
          className={`gc-canvas gc-${size}`}
          width={SIZES[size].w}
          height={SIZES[size].h}
          role="img"
          aria-label={`Your ${fest.name} card: ${wish.ne} ${wish.en}${from ? ` — from ${from}` : ''}`}
        />
        <p className="muted small gc-private">
          🔒 Made on your phone. Your photo is never uploaded — nobody but you sees it until you send the card.
        </p>
      </div>

      <div className="gc-controls">
        {festivals.length > 1 && (
          <fieldset className="gc-group">
            <legend>Festival</legend>
            <div className="chip-row">
              {festivals
                .filter((f, i) => allFestivals || i < SOON || f.slug === fest.slug)
                .map((f) => (
                  <button
                    type="button"
                    key={f.slug}
                    className={`chip${f.slug === fest.slug ? ' chip-active' : ''}`}
                    aria-pressed={f.slug === fest.slug}
                    onClick={() => chooseFestival(f.slug)}
                  >
                    <span lang="ne">{f.nameNe}</span> {f.name}
                  </button>
                ))}
              {!allFestivals && festivals.length > SOON + 1 && (
                <button type="button" className="chip" onClick={() => setAllFestivals(true)}>
                  More festivals…
                </button>
              )}
            </div>
          </fieldset>
        )}

        <fieldset className="gc-group">
          <legend>Look</legend>
          <div className="chip-row">
            {fest.looks.map((l) => (
              <button
                type="button"
                key={l.id}
                className={`chip${l.id === look ? ' chip-active' : ''}`}
                aria-pressed={l.id === look}
                onClick={() => chooseLook(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="gc-group">
          <legend>Wish</legend>
          <div className="gc-wishes">
            {fest.wishes.map((w, i) => (
              <button
                type="button"
                key={`${w.ne}-${i}`}
                className={`gc-wish${i === wishIdx ? ' gc-wish-on' : ''}`}
                aria-pressed={i === wishIdx}
                onClick={() => setWishIdx(i)}
              >
                <strong lang="ne">{w.ne}</strong>
                <span>{w.en}</span>
              </button>
            ))}
            <button
              type="button"
              className={`gc-wish${wishIdx === OWN ? ' gc-wish-on' : ''}`}
              aria-pressed={wishIdx === OWN}
              onClick={() => {
                if (wishIdx !== OWN && !ownNe && !ownEn) {
                  setOwnNe(wish.ne);
                  setOwnEn(wish.en);
                }
                setWishIdx(OWN);
              }}
            >
              <strong>✏️ Write my own</strong>
              <span>In Nepali, English, or both</span>
            </button>
          </div>
          {wishIdx === OWN && (
            <div className="gc-own">
              <div className="field">
                <label htmlFor="gc-own-ne">Big line</label>
                <input
                  id="gc-own-ne"
                  className="input"
                  value={ownNe}
                  maxLength={80}
                  onChange={(e) => setOwnNe(e.target.value)}
                  placeholder="शुभ विजया दशमी!"
                />
              </div>
              <div className="field">
                <label htmlFor="gc-own-en">Small line</label>
                <textarea
                  id="gc-own-en"
                  className="input"
                  rows={2}
                  value={ownEn}
                  maxLength={160}
                  onChange={(e) => setOwnEn(e.target.value)}
                  placeholder="Wishing you and your family…"
                />
              </div>
            </div>
          )}
        </fieldset>

        <div className="field">
          <label htmlFor="gc-from">From — your name or family</label>
          <input
            id="gc-from"
            className="input"
            value={from}
            maxLength={48}
            autoComplete="name"
            onChange={(e) => setFrom(e.target.value)}
            placeholder="e.g. Shrestha Pariwar, Frankfurt"
          />
        </div>

        <fieldset className="gc-group">
          <legend>Photo (optional)</legend>
          <input
            ref={fileRef}
            id="gc-photo"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPhoto(e.target.files?.[0])}
          />
          <div className="gc-photo-row">
            <label htmlFor="gc-photo" className="btn btn-sm">
              {photo ? 'Change photo' : '📷 Add a photo'}
            </label>
            {photo && (
              <button type="button" className="btn btn-sm" onClick={() => setPhoto(null)}>
                Remove
              </button>
            )}
          </div>
          {photo && (
            <div className="gc-sliders">
              <label>
                <span>Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Left · right</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={focusX}
                  onChange={(e) => setFocusX(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Up · down</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={focusY}
                  onChange={(e) => setFocusY(Number(e.target.value))}
                />
              </label>
            </div>
          )}
        </fieldset>

        <fieldset className="gc-group">
          <legend>Size</legend>
          <div className="chip-row">
            {(Object.keys(SIZES) as SizeKey[]).map((k) => (
              <button
                type="button"
                key={k}
                className={`chip${k === size ? ' chip-active' : ''}`}
                aria-pressed={k === size}
                onClick={() => setSize(k)}
              >
                {SIZES[k].label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="gc-actions">
          {canShareFiles ? (
            <>
              <button type="button" className="btn btn-brand" disabled={busy} onClick={() => send('share')}>
                {busy ? 'Making…' : 'Send on WhatsApp & more'}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => send('download')}>
                Save picture
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-brand" disabled={busy} onClick={() => send('download')}>
              {busy ? 'Making…' : 'Download card'}
            </button>
          )}
        </div>
        {note && (
          <p className="gc-note" role="status">
            {note}
          </p>
        )}
        {!canShareFiles && (
          <p className="muted small">On a phone, the button sends the card straight to WhatsApp, Viber or Instagram.</p>
        )}
      </div>
    </div>
  );
}
