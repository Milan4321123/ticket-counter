'use client';

// The homepage's opening carousel: the next events and some bazaar goods as
// cards in a row, two at once. The cards in view are lit; the next one peeks
// in from the edge, dimmed and slightly smaller, and brightens as a swipe
// brings it in — the dimming follows the finger, not a timer. Native
// scroll-snap does the swiping (so it feels like the phone's own scrolling);
// arrows and dots do the same for a mouse, and it advances by itself until
// somebody touches it. Reduced motion: no auto-advance, no scaling.
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteLoop, usePeekDim, useSwipeNudge } from './usePeekDim';

export interface BillboardSlide {
  id: string;
  href: string;
  image: string | null;
  /** The same picture in portrait (4:5), for the phone layout. */
  imageTall?: string | null;
  /** A product picture to show framed in front of the (blurred) backdrop. */
  art: string | null;
  kicker: string;
  title: string;
  facts: string;
  cta: string;
  price: string;
}

const INTERVAL_MS = 5000;

export default function HomeBillboard({ slides, startAt = 0 }: { slides: BillboardSlide[]; startAt?: number }) {
  const track = useRef<HTMLDivElement>(null);
  /** Which card (in the whole track, all three copies) is first in view. */
  const [pos, setPos] = useState(0);
  const touched = useRef(0);
  const n = slides.length;
  // Endless: the slides are laid out three times and the row keeps the
  // visitor in the middle copy (useInfiniteLoop), opening on `startAt`.
  const loop = n >= 2;
  const copies = loop ? 3 : 1;
  const current = n ? pos % n : 0;

  useInfiniteLoop(track, loop ? n : 0, startAt);
  // Lit when in view, dimmed while peeking in from an edge (usePeekDim).
  usePeekDim(track, setPos);
  useSwipeNudge(track);

  /** Scroll so the card at physical index `i` leads the view. */
  const scrollToIndex = useCallback((i: number) => {
    const el = track.current;
    const target = el?.children[i] as HTMLElement | undefined;
    if (!el || !target) return;
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    el.scrollTo({ left: target.offsetLeft - pad, behavior: 'smooth' });
  }, []);

  /** To slide k — via whichever copy of it is nearest. */
  const goTo = useCallback(
    (k: number) => {
      if (!n) return;
      const options = Array.from({ length: copies }, (_, c) => c * n + k);
      const nearest = options.reduce((best, i) => (Math.abs(i - pos) < Math.abs(best - pos) ? i : best), options[0]);
      scrollToIndex(nearest);
    },
    [n, copies, pos, scrollToIndex]
  );

  const next = useCallback(() => {
    if (loop) scrollToIndex(pos + 1);
    else goTo((current + 1) % Math.max(n, 1));
  }, [loop, pos, current, n, goTo, scrollToIndex]);
  const prev = useCallback(() => {
    if (loop) scrollToIndex(Math.max(0, pos - 1));
    else goTo((current - 1 + n) % Math.max(n, 1));
  }, [loop, pos, current, n, goTo, scrollToIndex]);

  // Advance by itself, but never within a few seconds of the visitor's own touch.
  useEffect(() => {
    if (n < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      if (Date.now() - touched.current < 8000) return;
      if (document.hidden) return;
      next();
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, [n, next]);

  if (n === 0) return null;
  const hold = () => {
    touched.current = Date.now();
  };

  return (
    <section className="pk" aria-roledescription="carousel" aria-label="Featured">
      <div className="pk-track" ref={track} onPointerDown={hold} onWheel={hold} onTouchStart={hold} onMouseMove={hold}>
        {Array.from({ length: copies }, (_, copy) =>
          slides.map((s, k) => (
          <Link
            key={`${copy}-${s.id}`}
            href={s.href}
            className={`pk-card${s.art ? ' pk-product' : ''}`}
            aria-roledescription="slide"
            aria-label={`${k + 1} of ${n}: ${s.title}`}
            // The first and last copies are there only for the endless swipe.
            aria-hidden={loop && copy !== 1 ? true : undefined}
            tabIndex={loop && copy !== 1 ? -1 : undefined}
            draggable={false}
          >
            {s.image ? (
              <picture>
                {s.imageTall ? <source media="(max-width: 720px)" srcSet={s.imageTall} /> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="pk-img" src={s.image} alt="" loading={copy === (loop ? 1 : 0) && k < 3 ? 'eager' : 'lazy'} draggable={false} />
              </picture>
            ) : (
              <span className="pk-img pk-img-blank" />
            )}
            {s.art ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="pk-art" src={s.art} alt="" loading={copy === (loop ? 1 : 0) && k < 3 ? 'eager' : 'lazy'} draggable={false} />
            ) : null}
            <span className="pk-shade" />
            <span className="pk-body">
              <span className="pk-kicker">{s.kicker}</span>
              <span className="pk-title">{s.title}</span>
              {s.facts ? <span className="pk-facts">{s.facts}</span> : null}
              <span className="pk-foot">
                {s.price ? <span className="pk-price">{s.price}</span> : null}
                <span className="pk-cta">{s.cta} →</span>
              </span>
            </span>
          </Link>
          ))
        )}
      </div>
      {n > 1 && (
        <>
          <button
            type="button"
            className="pk-arrow pk-prev"
            aria-label="Previous"
            onClick={() => {
              hold();
              prev();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            className="pk-arrow pk-next"
            aria-label="Next"
            onClick={() => {
              hold();
              next();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
          <div className="pk-dots" role="tablist" aria-label="Choose a slide">
            {slides.map((s, k) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={k === current}
                aria-label={s.title}
                className={`pk-dot${k === current ? ' pk-dot-on' : ''}`}
                onClick={() => {
                  hold();
                  goTo(k);
                }}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
