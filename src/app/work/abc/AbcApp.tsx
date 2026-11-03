'use client';

// "Ka Kha Ga" — a kids' Nepali alphabet app, for children of Nepali families
// growing up in Europe (about 4 to 9) who speak German or English every day.
// The letter grid speaks a letter and its word on a tap (the device's own
// voice, or a look-and-say fallback), "Trace it" scores a finger-drawn letter
// against the real font glyph with 1–3 stars, three little games (balloons,
// picture matching, word building) fill Habre the red panda's sticker book,
// and a parent corner behind a press-and-hold shows progress, the helper
// language and a reset. Rules in abc.ts; this file only draws them.
//
// Child-safe by design: no account, no data collection, nothing sent, no
// purchases or ads. One localStorage key holds the progress and an optional
// first name. Everything here is already in the visitor's language, so it is
// all translate="no": the site's AutoTranslate never sends a word of it (or
// the child's name) anywhere.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Icon, Mascot, Pic, Sticker } from './art';
import {
  BRUSH,
  BUILD_PER_ROUND,
  CONSONANTS,
  FIND_PER_ROUND,
  GRID,
  LETTERS,
  MATCH_PER_ROUND,
  NAME_MAX,
  STICKERS,
  VOWELS,
  WIN_POINTS,
  aksharas,
  buildCorrect,
  buildRound,
  buildWord,
  cleanName,
  dayKey,
  findRound,
  fresh,
  highlightIndex,
  letter,
  letterIndex,
  lettersTraced,
  maskFromAlpha,
  matchRound,
  nextStickerIn,
  normalize,
  points,
  rasterize,
  recordTrace,
  recordWin,
  rng,
  sayLine,
  scoreTrace,
  shuffle,
  stickersUnlocked,
  streak,
  totalStars,
  traceHint,
  traceStars,
  type BuildTask,
  type FindQ,
  type GameId,
  type Lang,
  type Letter,
  type Mask,
  type Progress,
  type Pt,
  type Stars,
} from './abc';
import { COPY, LANGS, num, type Copy, type Tab } from './content';
import { Sfx, Speaker, type SpeechState } from './sound';

const STORE_KEY = 'mn-demo:abc';
const TABS: { id: Tab; icon: 'grid' | 'pencil' | 'balloon' | 'book' }[] = [
  { id: 'letters', icon: 'grid' },
  { id: 'trace', icon: 'pencil' },
  { id: 'games', icon: 'balloon' },
  { id: 'stickers', icon: 'book' },
];
const CARD_TINTS = ['#ffe6a7', '#ffd6e3', '#cdeefd', '#d7f5d0', '#e6dcff', '#ffe0c7'];
const INK = ['#1f6fd1', '#d6336c', '#0f8a5f', '#7048e8', '#e8590c'];

function loadRaw(): unknown {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveRaw(p: Progress) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    /* private window: the app still works, it just forgets on reload */
  }
}
function clearRaw() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}
const today = () => dayKey(new Date());

function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

// ---------- small pieces ----------

function StarRow({ n, size = 16, label }: { n: number; size?: number; label?: string }) {
  return (
    <span className="kk-starrow" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'is-on' : ''}>
          <Icon name="star" size={size} />
        </span>
      ))}
    </span>
  );
}

function Dev({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span lang="ne" className={className}>
      {children}
    </span>
  );
}

/** The example word with the letter's syllable picked out. */
function WordMarked({ l }: { l: Letter }) {
  const parts = aksharas(l.word);
  const at = highlightIndex(l);
  return (
    <Dev className="kk-word">
      {parts.map((a, i) => (
        <span key={i} className={i === at ? 'kk-word-hit' : undefined}>
          {a}
        </span>
      ))}
    </Dev>
  );
}

/** Dialogs go to <body> so they sit above the site header, with the app's font and colours. */
function Modal({
  title,
  onClose,
  children,
  labelId,
  closeLabel,
  className,
  fontClass,
  lang,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  labelId: string;
  closeLabel: string;
  className?: string;
  fontClass: string;
  lang: Lang;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div className={`kk-modal-wrap ${fontClass}${className ? ` ${className}` : ''}`} lang={lang} translate="no" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="kk-modal" role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1} ref={ref}>
        <div className="kk-modal-head">
          <h2 id={labelId}>{title}</h2>
          <button type="button" className="kk-icon-btn" onClick={onClose} aria-label={closeLabel}>
            <Icon name="close" />
          </button>
        </div>
        <div className="kk-modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/** A button that only opens after being held for two seconds (the parent gate). */
function HoldButton({ label, hint, onDone }: { label: string; hint: string; onDone: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const stop = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }, []);
  const start = useCallback(() => {
    if (timer.current !== null) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onDone();
    }, 2000);
  }, [onDone]);
  useEffect(() => stop, [stop]);
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault();
      start();
    }
  };
  const onKeyUp = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') stop();
  };
  return (
    <button
      type="button"
      className={`kk-hold${holding ? ' is-holding' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={stop}
      onContextMenu={(e) => e.preventDefault()}
      aria-describedby="kk-hold-hint"
    >
      <span className="kk-hold-ring" aria-hidden="true" />
      <Icon name="lock" size={18} />
      <span>{label}</span>
      <span id="kk-hold-hint" className="kk-hold-hint">
        {hint}
      </span>
    </button>
  );
}

// ---------- letter grid ----------

function LetterCard({ l, i, stars, onTap, said }: { l: Letter; i: number; stars: number; onTap: (l: Letter) => void; said: boolean }) {
  return (
    <li>
      <button
        type="button"
        className={`kk-card${said ? ' is-said' : ''}`}
        style={{ '--tint': CARD_TINTS[i % CARD_TINTS.length] } as CSSProperties}
        onClick={() => onTap(l)}
        data-letter={l.ch}
      >
        <Dev className="kk-card-ch">{l.ch}</Dev>
        <span className="kk-card-tr">{l.tr}</span>
        <Pic id={l.pic} size={42} className="kk-card-pic" />
        <Dev className="kk-card-word">{l.word}</Dev>
        {stars > 0 && <StarRow n={stars} size={12} />}
      </button>
    </li>
  );
}

function SpeechNote({ state, t }: { state: SpeechState; t: Copy }) {
  if (state === 'none') return <p className="kk-note kk-note-warn" role="status">{t.noVoice}</p>;
  if (state === 'unsupported') return <p className="kk-note kk-note-warn" role="status">{t.noSpeech}</p>;
  if (state === 'hi') return <p className="kk-note" role="status">{t.hiVoice}</p>;
  return null;
}

function LetterDetail({
  l,
  t,
  lang,
  stars,
  speech,
  onSay,
  onTrace,
  onMove,
  onClose,
  fontClass,
}: {
  fontClass: string;
  l: Letter;
  t: Copy;
  lang: Lang;
  stars: number;
  speech: SpeechState;
  onSay: (l: Letter) => void;
  onTrace: (l: Letter) => void;
  onMove: (dir: -1 | 1) => void;
  onClose: () => void;
}) {
  const visual = speech === 'none' || speech === 'unsupported';
  const meaning = lang === 'en' ? l.en : lang === 'de' ? l.de : '';
  return (
    <Modal title={<Dev>{l.ch}</Dev>} fontClass={fontClass} lang={lang} labelId="kk-detail-h" onClose={onClose} closeLabel={t.close} className="kk-detail-wrap">
      <div className="kk-detail">
        <div className="kk-detail-big" key={l.ch}>
          <Dev className={`kk-detail-ch${visual ? ' is-pulse' : ''}`}>{l.ch}</Dev>
          <span className="kk-detail-tr">{l.tr}</span>
        </div>
        <div className="kk-detail-pic">
          <Pic id={l.pic} size={112} label={meaning || l.word} />
        </div>
        <p className="kk-detail-word">
          <WordMarked l={l} />
          <span className="kk-detail-wtr">{l.wordTr}</span>
        </p>
        {meaning && <p className="kk-detail-mean">{t.meaning(meaning)}</p>}
        {l.inside && <p className="kk-note">{t.insideNote(l.ch)}</p>}
        {visual && (
          <p className="kk-say">
            {t.sayTogether} <strong>{l.tr}</strong> — <strong>{l.wordTr}</strong>
          </p>
        )}
        <SpeechNote state={speech} t={t} />
        <StarRow n={stars} size={22} label={t.starsOf(num(stars, lang))} />
        <div className="kk-detail-btns">
          <button type="button" className="kk-btn kk-btn-soft" onClick={() => onSay(l)}>
            <Icon name="speaker" /> {t.listen}
          </button>
          <button type="button" className="kk-btn kk-btn-main" onClick={() => onTrace(l)}>
            <Icon name="pencil" /> {t.traceIt}
          </button>
        </div>
        <div className="kk-detail-nav">
          <button type="button" className="kk-icon-btn kk-icon-big" onClick={() => onMove(-1)} aria-label={t.prev}>
            <Icon name="left" size={26} />
          </button>
          <button type="button" className="kk-icon-btn kk-icon-big" onClick={() => onMove(1)} aria-label={t.next}>
            <Icon name="right" size={26} />
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- tracing ----------

type Layout = { fs: number; x: number; y: number };

/** Fit the letter's real glyph into the square (as shares of its side). */
function glyphLayout(ch: string, family: string): Layout {
  const c = document.createElement('canvas');
  c.width = c.height = 400;
  const ctx = c.getContext('2d')!;
  const fs0 = 200;
  ctx.font = `800 ${fs0}px ${family}`;
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(ch);
  const left = m.actualBoundingBoxLeft || 0;
  const right = m.actualBoundingBoxRight || m.width;
  const asc = m.actualBoundingBoxAscent || fs0 * 0.7;
  const desc = m.actualBoundingBoxDescent || 0;
  const w = left + right;
  const h = asc + desc;
  const k = Math.min((0.74 * 400) / w, (0.74 * 400) / h);
  const fs = (fs0 * k) / 400;
  const x = (400 - w * k) / 2 / 400 + (left * k) / 400;
  const y = (400 - h * k) / 2 / 400 + (asc * k) / 400;
  return { fs, x, y };
}

function drawGlyph(ctx: CanvasRenderingContext2D, ch: string, family: string, side: number, lay: Layout) {
  ctx.font = `800 ${lay.fs * side}px ${family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(ch, lay.x * side, lay.y * side);
}

function guideMask(ch: string, family: string, lay: Layout): Mask {
  const c = document.createElement('canvas');
  c.width = c.height = GRID;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  drawGlyph(ctx, ch, family, GRID, lay);
  return maskFromAlpha(ctx.getImageData(0, 0, GRID, GRID).data, GRID, GRID);
}

type TraceResult = { stars: Stars; coverage: number; outside: number; hint: 'more' | 'inside' | 'great' };

function TracePad({
  l,
  family,
  t,
  lang,
  reduce,
  colour,
  onResult,
  onNext,
  sfx,
}: {
  l: Letter;
  family: string;
  t: Copy;
  lang: Lang;
  reduce: boolean;
  colour: string;
  onResult: (stars: Stars) => void;
  onNext: () => void;
  sfx: Sfx;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const [side, setSide] = useState(0);
  const [lay, setLay] = useState<Layout | null>(null);
  const mask = useRef<Mask | null>(null);
  const strokes = useRef<Pt[][]>([]);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [result, setResult] = useState<TraceResult | null>(null);
  const [showing, setShowing] = useState(false);
  const anim = useRef<number | null>(null);

  // The square's size follows the layout.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const on = () => setSide(Math.round(el.clientWidth));
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The real glyph, once the font is in.
  useEffect(() => {
    let live = true;
    setLay(null);
    setResult(null);
    strokes.current = [];
    setHasInk(false);
    const go = async () => {
      try {
        await document.fonts?.load(`800 100px ${family}`, l.ch);
      } catch {
        /* draw with whatever font is there */
      }
      if (!live) return;
      const lt = glyphLayout(l.ch, family);
      mask.current = guideMask(l.ch, family, lt);
      setLay(lt);
    };
    void go();
    return () => {
      live = false;
    };
  }, [l.ch, family]);

  const paintGuide = useCallback(
    (reveal: number | null) => {
      const c = guideRef.current;
      if (!c || !lay || !side) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== side * dpr) {
        c.width = side * dpr;
        c.height = side * dpr;
      }
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, side, side);
      // a writing line under the headline, like an exercise book
      ctx.strokeStyle = 'rgba(31, 111, 209, 0.16)';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      for (const f of [0.2, 0.8]) {
        ctx.beginPath();
        ctx.moveTo(10, side * f);
        ctx.lineTo(side - 10, side * f);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(43, 36, 64, 0.13)';
      drawGlyph(ctx, l.ch, family, side, lay);
      ctx.setLineDash([5, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(43, 36, 64, 0.5)';
      ctx.font = `800 ${lay.fs * side}px ${family}`;
      ctx.strokeText(l.ch, lay.x * side, lay.y * side);
      ctx.setLineDash([]);
      if (reveal !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, side * reveal, side);
        ctx.clip();
        ctx.fillStyle = colour;
        drawGlyph(ctx, l.ch, family, side, lay);
        ctx.restore();
        if (reveal < 1) {
          ctx.fillStyle = '#f5b70a';
          ctx.beginPath();
          ctx.arc(side * reveal, side * 0.12, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    [lay, side, l.ch, family, colour]
  );

  const paintInk = useCallback(() => {
    const c = inkRef.current;
    if (!c || !side) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== side * dpr) {
      c.width = side * dpr;
      c.height = side * dpr;
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, side, side);
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = BRUSH * 2 * side;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of strokes.current) {
      if (!s.length) continue;
      if (s.length === 1) {
        ctx.beginPath();
        ctx.arc(s[0].x * side, s[0].y * side, BRUSH * side, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(s[0].x * side, s[0].y * side);
      for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x * side, s[i].y * side);
      ctx.stroke();
    }
  }, [side, colour]);

  useEffect(() => {
    if (!showing) paintGuide(null);
    paintInk();
  }, [paintGuide, paintInk, showing]);

  useEffect(
    () => () => {
      if (anim.current !== null) cancelAnimationFrame(anim.current);
    },
    []
  );

  const pt = (e: ReactPointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (result || showing) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointers */
    }
    drawing.current = true;
    strokes.current.push([pt(e)]);
    setHasInk(true);
    paintInk();
  };
  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const s = strokes.current[strokes.current.length - 1];
    const p = pt(e);
    const last = s[s.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 0.004) return;
    s.push(p);
    paintInk();
  };
  const onUp = () => {
    drawing.current = false;
  };

  const clear = () => {
    strokes.current = [];
    setHasInk(false);
    setResult(null);
    paintInk();
  };

  const showMe = () => {
    if (!lay || showing) return;
    sfx.unlock();
    setShowing(true);
    const dur = reduce ? 0 : 1800;
    const t0 = performance.now();
    const frame = (now: number) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      paintGuide(k);
      if (k < 1) anim.current = requestAnimationFrame(frame);
      else
        window.setTimeout(() => {
          setShowing(false);
          anim.current = null;
        }, reduce ? 1600 : 700);
    };
    anim.current = requestAnimationFrame(frame);
  };

  const done = () => {
    if (!mask.current) return;
    sfx.unlock();
    const sc = scoreTrace(mask.current, rasterize(strokes.current, GRID, BRUSH));
    const stars = traceStars(sc);
    const r: TraceResult = { stars, coverage: sc.coverage, outside: sc.outside, hint: traceHint(sc) };
    setResult(r);
    if (stars > 0) sfx.stars(stars);
    else sfx.oops();
    onResult(stars);
  };

  const again = () => clear();

  return (
    <div className="kk-trace-pad">
      <div className="kk-trace-box" ref={boxRef} data-ready={lay ? '1' : undefined} data-letter={l.ch}>
        <canvas ref={guideRef} className="kk-trace-guide" aria-hidden="true" />
        <canvas
          ref={inkRef}
          className="kk-trace-ink"
          role="img"
          aria-label={t.drawHere(l.ch)}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
        />
        {result && (
          <div className={`kk-trace-result is-${result.stars}`} role="status">
            <span className="kk-result-stars">
              {[0, 1, 2].map((i) => (
                <span key={i} className={i < result.stars ? 'is-on' : ''} style={{ '--d': `${i * 0.16}s` } as CSSProperties}>
                  <Icon name="star" size={44} />
                </span>
              ))}
            </span>
            <strong>{t.traceResult[result.stars]}</strong>
            {result.stars < 3 && <span className="kk-result-hint">{result.hint === 'inside' ? t.hintInside : t.hintMore}</span>}
            <span className="kk-result-num">{t.coverage(num(Math.round(result.coverage * 100), lang), num(Math.round(result.outside * 100), lang))}</span>
            <span className="kk-result-btns">
              <button type="button" className="kk-btn kk-btn-soft" onClick={again}>
                {t.tryAgain}
              </button>
              <button type="button" className="kk-btn kk-btn-main" onClick={onNext}>
                {t.nextLetter} <Icon name="right" size={18} />
              </button>
            </span>
          </div>
        )}
      </div>
      <div className="kk-trace-btns">
        <button type="button" className="kk-btn kk-btn-soft" onClick={clear} disabled={!hasInk || showing}>
          {t.clear}
        </button>
        <button type="button" className="kk-btn kk-btn-soft" onClick={showMe} disabled={!lay || showing || Boolean(result)}>
          {t.showMe}
        </button>
        <button type="button" className="kk-btn kk-btn-main" onClick={done} disabled={!hasInk || !lay || showing || Boolean(result)} data-act="trace-done">
          {t.done}
        </button>
      </div>
    </div>
  );
}

// ---------- games ----------

function WinScreen({ t, lang, name, onAgain, onBack }: { t: Copy; lang: Lang; name: string; onAgain: () => void; onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="kk-win" role="status" tabIndex={-1} ref={ref} data-win="1">
      <div className="kk-confetti" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <Mascot size={130} pose="cheer" />
      <h3>{name ? t.wellDoneName(name) : t.wellDone}</h3>
      <p>{t.roundWon(num(WIN_POINTS, lang))}</p>
      <div className="kk-win-btns">
        <button type="button" className="kk-btn kk-btn-main" onClick={onAgain}>
          {t.playAgain}
        </button>
        <button type="button" className="kk-btn kk-btn-soft" onClick={onBack}>
          {t.otherGames}
        </button>
      </div>
    </div>
  );
}

function Dots({ at, of, t, lang }: { at: number; of: number; t: Copy; lang: Lang }) {
  return (
    <div className="kk-dots" role="img" aria-label={t.round(num(Math.min(at + 1, of), lang), num(of, lang))}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < at ? 'is-done' : i === at ? 'is-now' : ''} />
      ))}
    </div>
  );
}

const BALLOON_COLOURS = ['#e84393', '#1f7ae0', '#f2a900', '#0f9d6b'];

function FindGame({ t, lang, onWin, name, onBack, say, sfx }: GameProps) {
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const qs = useMemo<FindQ[]>(() => findRound(rng(seed)), [seed]);
  const [i, setI] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [popped, setPopped] = useState<string | null>(null);
  const [won, setWon] = useState(false);
  const q = qs[Math.min(i, qs.length - 1)];

  const pick = (ch: string) => {
    if (popped || won) return;
    sfx.unlock();
    if (ch === q.target) {
      sfx.pop();
      setPopped(ch);
      window.setTimeout(() => {
        setPopped(null);
        setWrong([]);
        if (i + 1 >= qs.length) {
          setWon(true);
          onWin('find');
        } else setI(i + 1);
      }, 520);
    } else {
      sfx.oops();
      setWrong((w) => (w.includes(ch) ? w : [...w, ch]));
    }
  };
  const again = () => {
    setSeed((s) => s + 1);
    setI(0);
    setWrong([]);
    setWon(false);
  };
  if (won) return <WinScreen t={t} lang={lang} name={name} onAgain={again} onBack={onBack} />;
  const l = letter(q.target)!;
  return (
    <div className="kk-game kk-find">
      <Dots at={i} of={FIND_PER_ROUND} t={t} lang={lang} />
      <div className="kk-find-ask">
        <p>{t.findAsk}</p>
        <Dev className="kk-find-target">{q.target}</Dev>
        <button type="button" className="kk-btn kk-btn-soft" onClick={() => say(l, true)}>
          <Icon name="speaker" /> {t.findListen}
        </button>
      </div>
      <ul className="kk-balloons" key={i}>
        {q.options.map((ch, k) => (
          <li key={ch} style={{ '--k': k, '--c': BALLOON_COLOURS[k] } as CSSProperties}>
            <button
              type="button"
              className={`kk-balloon${popped === ch ? ' is-popped' : ''}${wrong.includes(ch) ? ' is-wrong' : ''}`}
              onClick={() => pick(ch)}
              aria-label={ch}
              data-balloon={ch}
            >
              <Dev>{ch}</Dev>
              <span className="kk-balloon-string" aria-hidden="true" />
              {popped === ch && (
                <span className="kk-burst" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, j) => (
                    <i key={j} style={{ '--j': j } as CSSProperties} />
                  ))}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {wrong.length > 0 && <p className="kk-note">{t.wrongTry}</p>}
    </div>
  );
}

function MatchGame({ t, lang, onWin, name, onBack, sfx }: GameProps) {
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const letters = useMemo(() => matchRound(rng(seed)), [seed]);
  const pics = useMemo(() => shuffle(letters, rng(seed + 7)), [letters, seed]);
  const [sel, setSel] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [bad, setBad] = useState<string | null>(null);
  const [won, setWon] = useState(false);
  const drag = useRef<{ ch: string; x: number; y: number; moved: boolean; el: HTMLElement } | null>(null);
  const [dragXY, setDragXY] = useState<{ ch: string; dx: number; dy: number } | null>(null);

  const tryMatch = (ch: string, pic: string) => {
    sfx.unlock();
    if (ch === pic) {
      sfx.good();
      const next = [...done, ch];
      setDone(next);
      setSel(null);
      if (next.length >= MATCH_PER_ROUND)
        window.setTimeout(() => {
          setWon(true);
          onWin('match');
        }, 500);
    } else {
      sfx.oops();
      setBad(pic);
      window.setTimeout(() => setBad(null), 500);
    }
  };

  const down = (e: ReactPointerEvent<HTMLButtonElement>, ch: string) => {
    if (done.includes(ch)) return;
    drag.current = { ch, x: e.clientX, y: e.clientY, moved: false, el: e.currentTarget };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 8) d.moved = true;
    if (d.moved) setDragXY({ ch: d.ch, dx, dy });
  };
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragXY(null);
    if (!d) return;
    if (!d.moved) {
      sfx.unlock();
      sfx.tap();
      setSel((s) => (s === d.ch ? null : d.ch));
      return;
    }
    d.el.style.visibility = 'hidden';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    d.el.style.visibility = '';
    const target = under?.closest<HTMLElement>('[data-pic]');
    if (target?.dataset.pic && !done.includes(target.dataset.pic)) tryMatch(d.ch, target.dataset.pic);
  };

  const again = () => {
    setSeed((s) => s + 1);
    setDone([]);
    setSel(null);
    setWon(false);
  };
  if (won) return <WinScreen t={t} lang={lang} name={name} onAgain={again} onBack={onBack} />;
  return (
    <div className="kk-game kk-match">
      <Dots at={done.length} of={MATCH_PER_ROUND} t={t} lang={lang} />
      <p className="kk-game-ask">{t.matchAsk}</p>
      <p className="kk-note">{t.matchTapHint}</p>
      <ul className="kk-match-letters">
        {letters.map((ch) => (
          <li key={ch}>
            <button
              type="button"
              className={`kk-chip${sel === ch ? ' is-sel' : ''}${done.includes(ch) ? ' is-done' : ''}${dragXY?.ch === ch ? ' is-drag' : ''}`}
              style={dragXY?.ch === ch ? ({ transform: `translate(${dragXY.dx}px, ${dragXY.dy}px)` } as CSSProperties) : undefined}
              onPointerDown={(e) => down(e, ch)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={() => {
                drag.current = null;
                setDragXY(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSel((s) => (s === ch ? null : ch));
                }
              }}
              disabled={done.includes(ch)}
              aria-pressed={sel === ch}
              data-chip={ch}
            >
              <Dev>{ch}</Dev>
            </button>
          </li>
        ))}
      </ul>
      <ul className="kk-match-pics">
        {pics.map((ch) => {
          const l = letter(ch)!;
          const isDone = done.includes(ch);
          return (
            <li key={ch}>
              <button
                type="button"
                className={`kk-pic-target${isDone ? ' is-done' : ''}${bad === ch ? ' is-bad' : ''}`}
                data-pic={ch}
                onClick={() => sel && !isDone && tryMatch(sel, ch)}
                aria-label={`${l.word}${lang === 'en' ? ` (${l.en})` : lang === 'de' ? ` (${l.de})` : ''}`}
                disabled={isDone}
              >
                <Pic id={l.pic} size={76} />
                {isDone ? (
                  <span className="kk-pic-word">
                    <WordMarked l={l} />
                  </span>
                ) : (
                  <span className="kk-pic-slot" aria-hidden="true">
                    ?
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {done.length > 0 && done.length < MATCH_PER_ROUND && <p className="kk-note kk-note-ok">{t.matched}</p>}
    </div>
  );
}

function BuildGame({ t, lang, onWin, name, onBack, sayWord, sfx }: GameProps) {
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const tasks = useMemo<BuildTask[]>(() => buildRound(rng(seed)), [seed]);
  const [i, setI] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [state, setState] = useState<'play' | 'ok' | 'bad'>('play');
  const [won, setWon] = useState(false);
  const task = tasks[Math.min(i, tasks.length - 1)];
  const w = buildWord(task.word)!;

  const tapTile = (k: number) => {
    if (state !== 'play' || placed.includes(k)) return;
    sfx.unlock();
    sfx.tap();
    const next = [...placed, k];
    setPlaced(next);
    if (next.length === task.answer.length) {
      const ok = buildCorrect(
        task,
        next.map((j) => task.tiles[j])
      );
      if (ok) {
        sfx.good();
        sayWord(task.word);
        setState('ok');
        window.setTimeout(() => {
          setState('play');
          setPlaced([]);
          if (i + 1 >= tasks.length) {
            setWon(true);
            onWin('build');
          } else setI(i + 1);
        }, 1100);
      } else {
        sfx.oops();
        setState('bad');
        window.setTimeout(() => {
          setState('play');
          setPlaced([]);
        }, 1100);
      }
    }
  };
  const unplace = (slot: number) => {
    if (state !== 'play') return;
    setPlaced((p) => p.filter((_, j) => j !== slot));
  };
  const again = () => {
    setSeed((s) => s + 1);
    setI(0);
    setPlaced([]);
    setWon(false);
  };
  if (won) return <WinScreen t={t} lang={lang} name={name} onAgain={again} onBack={onBack} />;
  const meaning = lang === 'en' ? w.en : lang === 'de' ? w.de : '';
  return (
    <div className="kk-game kk-build">
      <Dots at={i} of={BUILD_PER_ROUND} t={t} lang={lang} />
      <div className="kk-build-ask">
        <Pic id={w.pic} size={96} label={meaning || w.word} />
        <div>
          <p className="kk-game-ask">{t.buildAsk}</p>
          <button type="button" className="kk-word-btn" onClick={() => sayWord(task.word)}>
            <Dev>{task.word}</Dev>
            <span>{w.tr}</span>
            <Icon name="speaker" size={18} />
          </button>
          {meaning && <p className="kk-detail-mean">{meaning}</p>}
        </div>
      </div>
      <ol className={`kk-slots is-${state}`} aria-label={t.buildAsk}>
        {task.answer.map((_, s) => {
          const k = placed[s];
          return (
            <li key={s}>
              {k !== undefined ? (
                <button type="button" className="kk-tile is-placed" onClick={() => unplace(s)} aria-label={`${task.tiles[k]} — ${t.buildUndo}`}>
                  <Dev>{task.tiles[k]}</Dev>
                </button>
              ) : (
                <span className="kk-slot-empty" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
      {state === 'bad' && (
        <p className="kk-note kk-note-warn" role="status">
          {t.buildWrong}
        </p>
      )}
      <ul className="kk-tiles">
        {task.tiles.map((tile, k) => (
          <li key={k}>
            <button type="button" className="kk-tile" onClick={() => tapTile(k)} disabled={placed.includes(k)} data-tile={tile}>
              <Dev>{tile}</Dev>
            </button>
          </li>
        ))}
      </ul>
      <p className="kk-note">{t.buildTapHint}</p>
    </div>
  );
}

type GameProps = {
  t: Copy;
  lang: Lang;
  name: string;
  onWin: (g: GameId) => void;
  onBack: () => void;
  say: (l: Letter, silent?: boolean) => void;
  sayWord: (w: string) => void;
  sfx: Sfx;
};

// ---------- the app ----------

export default function AbcApp({ initialLang, family, fontClass = '' }: { initialLang: Lang; family: string; fontClass?: string }) {
  const [p, setP] = useState<Progress>(() => fresh(initialLang));
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('letters');
  const [detail, setDetail] = useState<string | null>(null);
  const [traceCh, setTraceCh] = useState<string>('क');
  const [game, setGame] = useState<GameId | null>(null);
  const [parent, setParent] = useState(false);
  const [speech, setSpeech] = useState<SpeechState>('unknown');
  const [spoke, setSpoke] = useState<SpeechState | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [newSticker, setNewSticker] = useState<number | null>(null);
  const [resetArm, setResetArm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const router = useRouter();
  const speaker = useRef<Speaker | null>(null);
  const sfx = useRef(new Sfx());
  const pRef = useRef(p);
  pRef.current = p;
  const traceStripRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const lang = p.lang;
  const t = COPY[lang];

  const commit = useCallback((next: Progress) => {
    pRef.current = next;
    setP(next);
    saveRaw(next);
    // A new sticker waits a moment, so the stars or the win screen are seen first.
    const unlocked = stickersUnlocked(points(next));
    if (unlocked > next.seen) window.setTimeout(() => setNewSticker(unlocked - 1), 1600);
  }, []);

  // Start: stored progress, ?tab= and ?letter= for links.
  useEffect(() => {
    // The site's language (its EN · DE · ने switch) wins over what was stored.
    const st = { ...normalize(loadRaw(), initialLang), lang: initialLang };
    pRef.current = st;
    setP(st);
    sfx.current.muted = !st.sound;
    const q = new URLSearchParams(window.location.search);
    const qt = q.get('tab');
    if (qt && TABS.some((x) => x.id === qt)) setTab(qt as Tab);
    const ql = q.get('letter');
    if (ql && letter(ql)) setTraceCh(ql);
    const qg = q.get('game');
    if (qg === 'find' || qg === 'match' || qg === 'build') {
      setTab('games');
      setGame(qg);
    }
    setReady(true);
    const sp = new Speaker();
    speaker.current = sp;
    sp.start(setSpeech);
    const fx = sfx.current;
    return () => {
      sp.stop();
      fx.close();
    };
  }, [initialLang]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(id);
  }, [notice]);

  const sayRaw = useCallback(
    (text: string): SpeechState => {
      if (!pRef.current.sound) return speaker.current?.kind ?? 'unknown';
      const r = speaker.current?.say(text) ?? 'unsupported';
      setSpoke(r);
      return r;
    },
    []
  );
  const say = useCallback(
    (l: Letter) => {
      sfx.current.unlock();
      sayRaw(sayLine(l));
      setSaid(l.ch);
      window.setTimeout(() => setSaid((s) => (s === l.ch ? null : s)), 900);
    },
    [sayRaw]
  );
  const sayWord = useCallback((w: string) => void sayRaw(`${w}।`), [sayRaw]);

  const openLetter = (l: Letter) => {
    say(l);
    setDetail(l.ch);
  };
  const moveDetail = (dir: -1 | 1) => {
    if (!detail) return;
    const i = (letterIndex(detail) + dir + LETTERS.length) % LETTERS.length;
    const l = LETTERS[i];
    setDetail(l.ch);
    say(l);
  };

  const goTab = (x: Tab) => {
    setTab(x);
    if (x !== 'games') setGame(null);
    sfx.current.unlock();
    // Bring the new part up under the tab bar if the page was scrolled down.
    const m = mainRef.current;
    if (m && m.getBoundingClientRect().top < 0) m.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const traceLetter = (l: Letter) => {
    setDetail(null);
    setTraceCh(l.ch);
    setTab('trace');
    window.setTimeout(() => mainRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 30);
  };

  // Keep the chosen letter in view in the trace strip.
  useEffect(() => {
    if (tab !== 'trace') return;
    const strip = traceStripRef.current;
    const el = strip?.querySelector<HTMLElement>(`[data-strip="${CSS.escape(traceCh)}"]`);
    if (strip && el) strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
  }, [tab, traceCh, reduce]);

  const onTraced = (stars: Stars) => commit(recordTrace(pRef.current, traceCh, stars, today()));
  const nextTrace = () => {
    const i = (letterIndex(traceCh) + 1) % LETTERS.length;
    setTraceCh(LETTERS[i].ch);
  };
  const onWin = useCallback((g: GameId) => commit(recordWin(pRef.current, g, today())), [commit]);

  // The helper language is the site's language: set its cookie too, so the
  // frame, the header and the next visit agree, and refresh the server parts.
  const setLang = (l: Lang) => {
    commit({ ...pRef.current, lang: l });
    try {
      document.cookie = `lang=${l}; path=/; max-age=${365 * 24 * 3600}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
    } catch {
      /* ignore */
    }
    router.refresh();
  };
  const toggleSound = () => {
    const sound = !pRef.current.sound;
    sfx.current.muted = !sound;
    if (sound) sfx.current.unlock();
    else
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    commit({ ...pRef.current, sound });
  };
  const seeSticker = () => {
    setNewSticker(null);
    commit({ ...pRef.current, seen: stickersUnlocked(points(pRef.current)) });
  };
  const reset = () => {
    if (!resetArm) {
      setResetArm(true);
      return;
    }
    clearRaw();
    const f = { ...fresh(pRef.current.lang), sound: pRef.current.sound };
    pRef.current = f;
    setP(f);
    saveRaw(f);
    setResetArm(false);
    setNotice(t.resetDone);
  };

  const pts = points(p);
  const unlocked = stickersUnlocked(pts);
  const toNext = nextStickerIn(pts);
  const day = ready ? today() : '';
  const run = ready ? streak(p.days, day) : 0;
  const stars = totalStars(p);
  const detailL = detail ? letter(detail) : undefined;
  const traceL = letter(traceCh) ?? LETTERS[0];
  const colour = INK[letterIndex(traceCh) % INK.length];
  const speechShown = spoke;
  const prevAt = unlocked > 0 ? STICKERS[unlocked - 1].at : 0;
  const nextAt = STICKERS[unlocked]?.at;
  const meterPct = nextAt === undefined ? 100 : Math.round(((pts - prevAt) / (nextAt - prevAt)) * 100);

  const gameProps: GameProps = {
    t,
    lang,
    name: p.name,
    onWin,
    onBack: () => setGame(null),
    say: (l) => say(l),
    sayWord,
    sfx: sfx.current,
  };

  return (
    <div className={`kk ${fontClass}`} lang={lang} translate="no" data-ready={ready ? '1' : undefined}>
      <header className="kk-top">
        <div className="kk-brand">
          <Mascot size={64} pose="wave" label={t.mascot} className="kk-brand-mascot" />
          <div>
            <h1>
              <span lang="ne">क ख ग</span> <span className="kk-brand-latin">Ka Kha Ga</span>
            </h1>
            <p>{t.tagline}</p>
          </div>
        </div>
        <div className="kk-top-side">
          <span className="kk-pill kk-pill-star" title={t.starsLabel(num(stars, lang))}>
            <Icon name="star" size={18} />
            <span aria-hidden="true">{num(stars, lang)}</span>
            <span className="kk-sr">{t.starsLabel(num(stars, lang))}</span>
          </span>
          <span className="kk-pill kk-pill-flame" title={t.streakLabel(num(run, lang))}>
            <Icon name="flame" size={18} />
            <span aria-hidden="true">{num(run, lang)}</span>
            <span className="kk-sr">{t.streakLabel(num(run, lang))}</span>
          </span>
          <button type="button" className="kk-icon-btn" onClick={toggleSound} aria-pressed={p.sound} aria-label={p.sound ? t.soundOn : t.soundOff} title={p.sound ? t.soundOn : t.soundOff}>
            <Icon name={p.sound ? 'speaker' : 'mute'} />
          </button>
        </div>
      </header>

      <nav className="kk-tabs" aria-label={t.tabsLabel}>
        {TABS.map((x) => (
          <button key={x.id} type="button" className={tab === x.id ? 'is-on' : ''} aria-current={tab === x.id ? 'page' : undefined} onClick={() => goTab(x.id)} data-tab={x.id}>
            <Icon name={x.icon} size={24} />
            <span>{t.tabs[x.id]}</span>
            {x.id === 'stickers' && unlocked > p.seen && <span className="kk-tab-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>

      <div className="kk-main" ref={mainRef}>
        {tab === 'letters' && (
          <section aria-labelledby="kk-letters-h">
            <div className="kk-hello">
              <Mascot size={54} pose="stand" />
              <div>
                <h2 id="kk-letters-h">{p.name ? t.hello(p.name) : t.helloNobody}</h2>
                <p>{t.tapHint}</p>
              </div>
            </div>
            {speechShown && !detail && <SpeechNote state={speechShown} t={t} />}
            <h3 className="kk-group-h">{t.vowels}</h3>
            <ul className="kk-grid">
              {VOWELS.map((l, i) => (
                <LetterCard key={l.ch} l={l} i={i} stars={p.stars[l.ch] ?? 0} onTap={openLetter} said={said === l.ch} />
              ))}
            </ul>
            <h3 className="kk-group-h">{t.consonants}</h3>
            <ul className="kk-grid">
              {CONSONANTS.map((l, i) => (
                <LetterCard key={l.ch} l={l} i={i + 2} stars={p.stars[l.ch] ?? 0} onTap={openLetter} said={said === l.ch} />
              ))}
            </ul>
          </section>
        )}

        {tab === 'trace' && (
          <section aria-labelledby="kk-trace-h" className="kk-trace">
            <div className="kk-sec-head">
              <h2 id="kk-trace-h">{t.traceH}</h2>
              <p>{t.traceSub}</p>
            </div>
            <div className="kk-strip" ref={traceStripRef} role="group" aria-label={t.pickLetter}>
              {LETTERS.map((l) => (
                <button key={l.ch} type="button" className={l.ch === traceCh ? 'is-on' : ''} aria-pressed={l.ch === traceCh} onClick={() => setTraceCh(l.ch)} data-strip={l.ch}>
                  <Dev>{l.ch}</Dev>
                  {(p.stars[l.ch] ?? 0) > 0 && <StarRow n={p.stars[l.ch] ?? 0} size={9} />}
                </button>
              ))}
            </div>
            <div className="kk-trace-layout">
              <div className="kk-trace-side">
                <button type="button" className="kk-trace-card" onClick={() => say(traceL)} aria-label={`${traceL.ch} ${traceL.word} — ${t.listen}`}>
                  <Dev className="kk-trace-ch">{traceL.ch}</Dev>
                  <span className="kk-trace-mid">
                    <span className="kk-trace-tr">{traceL.tr}</span>
                    <WordMarked l={traceL} />
                  </span>
                  <Pic id={traceL.pic} size={56} className="kk-trace-pic" />
                  <span className="kk-trace-listen">
                    <Icon name="speaker" size={20} />
                    <span className="kk-trace-listen-l">{t.listen}</span>
                  </span>
                </button>
                <StarRow n={p.stars[traceCh] ?? 0} size={22} label={t.starsOf(num(p.stars[traceCh] ?? 0, lang))} />
              </div>
              <TracePad key={traceCh} l={traceL} family={family} t={t} lang={lang} reduce={reduce} colour={colour} onResult={onTraced} onNext={nextTrace} sfx={sfx.current} />
            </div>
          </section>
        )}

        {tab === 'games' && (
          <section aria-labelledby="kk-games-h" className="kk-games">
            {game ? (
              <>
                <div className="kk-game-head">
                  <button type="button" className="kk-btn kk-btn-soft kk-btn-sm" onClick={() => setGame(null)}>
                    <Icon name="back" size={18} /> {t.back}
                  </button>
                  <h2 id="kk-games-h">{t.games[game].name}</h2>
                </div>
                {game === 'find' && <FindGame {...gameProps} />}
                {game === 'match' && <MatchGame {...gameProps} />}
                {game === 'build' && <BuildGame {...gameProps} />}
              </>
            ) : (
              <>
                <div className="kk-sec-head">
                  <h2 id="kk-games-h">{t.gamesH}</h2>
                  <p>{t.gamesSub}</p>
                </div>
                <ul className="kk-game-list">
                  {(['find', 'match', 'build'] as GameId[]).map((g, i) => (
                    <li key={g}>
                      <button type="button" className={`kk-game-card kk-gcard-${g}`} onClick={() => setGame(g)} data-game={g}>
                        <span className="kk-gc-art" aria-hidden="true">
                          {g === 'find' ? (
                            <span className="kk-gc-balloons">
                              <Dev>क</Dev>
                              <Dev>ख</Dev>
                              <Dev>ग</Dev>
                            </span>
                          ) : g === 'match' ? (
                            <span className="kk-gc-match">
                              <Dev>घ</Dev>
                              <Pic id="house" size={52} />
                            </span>
                          ) : (
                            <span className="kk-gc-build">
                              <Dev>क</Dev>
                              <Dev>म</Dev>
                              <Dev>ल</Dev>
                            </span>
                          )}
                        </span>
                        <span className="kk-gc-text">
                          <strong>
                            {num(i + 1, lang)}. {t.games[g].name}
                          </strong>
                          <span>{t.games[g].how}</span>
                          {p.wins[g] > 0 && (
                            <span className="kk-gc-wins">
                              <Icon name="star" size={14} /> × {num(p.wins[g], lang)}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {tab === 'stickers' && (
          <section aria-labelledby="kk-stickers-h" className="kk-stickers">
            <div className="kk-sec-head">
              <h2 id="kk-stickers-h">{t.stickersH}</h2>
              <p>{t.stickersSub}</p>
            </div>
            <div className="kk-meter">
              <div className="kk-meter-bar" aria-hidden="true">
                <span style={{ width: `${meterPct}%` }} />
              </div>
              <p data-sticker-count={unlocked}>{toNext === null ? t.stickerFull : t.stickerNext(num(toNext, lang))}</p>
            </div>
            <ul className="kk-book">
              {STICKERS.map((s, i) => {
                const have = i < unlocked;
                return (
                  <li key={s.id} className={have ? 'is-have' : ''} data-sticker={s.id} data-have={have ? '1' : '0'}>
                    <Sticker id={s.id} locked={!have} size={104} label={have ? t.stickerNames[s.id] : t.locked} />
                    <span>{have ? t.stickerNames[s.id] : t.locked}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <footer className="kk-foot">
        <HoldButton label={t.parentBtn} hint={t.parentHold} onDone={() => setParent(true)} />
      </footer>

      {notice &&
        createPortal(
          <p className={`kk-toast ${fontClass}`} role="status" translate="no">
            {notice}
          </p>,
          document.body
        )}

      {detailL && (
        <LetterDetail
          l={detailL}
          t={t}
          lang={lang}
          stars={p.stars[detailL.ch] ?? 0}
          speech={spoke ?? 'unknown'}
          onSay={say}
          onTrace={traceLetter}
          onMove={moveDetail}
          onClose={() => setDetail(null)}
          fontClass={fontClass}
        />
      )}

      {newSticker !== null && !parent && (
        <Modal title={t.stickerNew} fontClass={fontClass} lang={lang} labelId="kk-new-h" onClose={seeSticker} closeLabel={t.close} className="kk-new-wrap">
          <div className="kk-new">
            <Sticker id={STICKERS[newSticker].id} size={180} label={t.stickerNames[STICKERS[newSticker].id]} />
            <strong>{t.stickerNames[STICKERS[newSticker].id]}</strong>
            <button
              type="button"
              className="kk-btn kk-btn-main"
              onClick={() => {
                sfx.current.fanfare();
                seeSticker();
                setGame(null);
                setTab('stickers');
              }}
            >
              <Icon name="book" /> {t.stickersH}
            </button>
          </div>
        </Modal>
      )}

      {parent && (
        <Modal title={t.parentH} fontClass={fontClass} lang={lang} labelId="kk-parent-h" onClose={() => (setParent(false), setResetArm(false))} closeLabel={t.close} className="kk-parent-wrap">
          <div className="kk-parent" data-parent="1">
            <p className="kk-note">{t.parentSub}</p>
            <label className="kk-field">
              <span>{t.childName}</span>
              <input
                type="text"
                value={p.name}
                maxLength={NAME_MAX}
                autoComplete="off"
                onChange={(e) => commit({ ...pRef.current, name: e.target.value.slice(0, NAME_MAX) })}
                onBlur={() => commit({ ...pRef.current, name: cleanName(pRef.current.name) })}
              />
              <small>{t.childNameHint}</small>
            </label>
            <fieldset className="kk-field">
              <legend>{t.helperLang}</legend>
              <div className="kk-langs kk-langs-big">
                {LANGS.map((x) => (
                  <button key={x.id} type="button" className={lang === x.id ? 'is-on' : ''} aria-pressed={lang === x.id} onClick={() => setLang(x.id)} lang={x.id}>
                    {x.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <h3>{t.progressH}</h3>
            <ul className="kk-stats">
              <li>{t.statLetters(num(lettersTraced(p), lang))}</li>
              <li>{t.statStars(num(stars, lang))}</li>
              <li>{t.statGames(num(p.wins.find + p.wins.match + p.wins.build, lang))}</li>
              <li>{t.statStickers(num(unlocked, lang))}</li>
              <li>{t.statStreak(num(run, lang))}</li>
            </ul>
            <h3>{t.letterTable}</h3>
            <ul className="kk-ptable">
              {LETTERS.map((l) => (
                <li key={l.ch} className={`is-${p.stars[l.ch] ?? 0}`}>
                  <Dev>{l.ch}</Dev>
                  <span>{num(p.stars[l.ch] ?? 0, lang)}</span>
                </li>
              ))}
            </ul>
            <label className="kk-switch">
              <input type="checkbox" checked={p.sound} onChange={toggleSound} />
              <span>{p.sound ? t.soundOn : t.soundOff}</span>
            </label>
            <p className="kk-note">
              {t.voiceH}: <strong>{t.voice[speech]}</strong>
            </p>
            <p className="kk-note">{t.privacy}</p>
            <h3>{t.resetH}</h3>
            <button type="button" className={`kk-btn kk-btn-danger${resetArm ? ' is-armed' : ''}`} onClick={reset} data-act="reset">
              {resetArm ? t.resetSure : t.resetBtn}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
