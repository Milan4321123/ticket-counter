'use client';

// The homepage's opening carousel: the next events and some bazaar goods as
// big cards in a row. The card in the middle is lit; its neighbours peek in
// from both sides, dimmed and slightly smaller, and brighten as a swipe brings
// them to the middle — the dimming follows the finger, not a timer. Native
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

  // Dim and shrink each card by its distance from the middle, every frame the
  // track scrolls. Written straight to style — no React render per frame.
  const paint = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    Array.from(el.children).forEach((child, k) => {
      const c = child as HTMLElement;
      const center = c.offsetLeft + c.offsetWidth / 2;
      const d = Math.min(1, Math.abs(center - mid) / c.offsetWidth);
      c.style.setProperty('--d', d.toFixed(3));
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    setCurrent(best);
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
      el.scrollTo({ left: target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2, behavior: 'smooth' });
    },
    [n]
  );

  // Advance by itself, but never within a few seconds of the visitor's own touch.
  useEffect(() => {
    if (n < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      if (Date.now() - touched.current < 8000) return;
      if (document.hidden) return;
      goTo(current + 1);
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, [current, n, goTo]);

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
              goTo(current + 1);
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
