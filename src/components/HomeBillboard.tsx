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

export default function HomeBillboard({ slides }: { slides: BillboardSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const touched = useRef(0);
  const n = slides.length;

  // Dim and shrink each card by how far it hangs outside the visible window:
  // fully in view = lit, peeking in from an edge = dimmed. Works for one or
  // two cards in view alike. Written straight to style — no React render per
  // scroll frame.
  const paint = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const left = el.scrollLeft + pad - 2;
    const right = el.scrollLeft + el.clientWidth - pad + 2;
    let first = -1;
    Array.from(el.children).forEach((child, k) => {
      const c = child as HTMLElement;
      const out = Math.max(0, left - c.offsetLeft, c.offsetLeft + c.offsetWidth - right);
      const d = Math.min(1, out / (c.offsetWidth * 0.6));
      c.style.setProperty('--d', d.toFixed(3));
      if (first < 0 && d < 0.5) first = k;
    });
    setCurrent(Math.max(0, first));
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(paint);
    };
    paint();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [paint]);

  const goTo = useCallback(
    (k: number) => {
      const el = track.current;
      if (!el) return;
      const target = el.children[((k % n) + n) % n] as HTMLElement | undefined;
      if (!target) return;
      const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
      el.scrollTo({ left: target.offsetLeft - pad, behavior: 'smooth' });
    },
    [n]
  );

  /** One card along — or back to the start once the last one is in view. */
  const next = useCallback(() => {
    const el = track.current;
    if (el && el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) goTo(0);
    else goTo(current + 1);
  }, [current, goTo]);

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
        {slides.map((s, k) => (
          <Link
            key={s.id}
            href={s.href}
            className={`pk-card${s.art ? ' pk-product' : ''}`}
            aria-roledescription="slide"
            aria-label={`${k + 1} of ${n}: ${s.title}`}
            draggable={false}
          >
            {s.image ? (
              <picture>
                {s.imageTall ? <source media="(max-width: 720px)" srcSet={s.imageTall} /> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="pk-img" src={s.image} alt="" loading={k < 3 ? 'eager' : 'lazy'} draggable={false} />
              </picture>
            ) : (
              <span className="pk-img pk-img-blank" />
            )}
            {s.art ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="pk-art" src={s.art} alt="" loading={k < 3 ? 'eager' : 'lazy'} draggable={false} />
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
        ))}
      </div>
      {n > 1 && (
        <>
          <button
            type="button"
            className="pk-arrow pk-prev"
            aria-label="Previous"
            onClick={() => {
              hold();
              goTo(current - 1);
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
