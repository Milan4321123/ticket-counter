'use client';

// The homepage's opening: one big picture at a time, Netflix-style — the next
// events and a couple of shops, crossfading every few seconds with a slow zoom,
// a title, a line of facts and one button. Swipe or tap the dots to move; it
// pauses on hover and respects reduced motion.
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface BillboardSlide {
  id: string;
  href: string;
  image: string | null;
  /** A product picture to show framed in front of the (blurred) backdrop. */
  art: string | null;
  kicker: string;
  title: string;
  facts: string;
  cta: string;
  price: string;
}

const INTERVAL_MS = 6000;

export default function HomeBillboard({ slides }: { slides: BillboardSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = slides.length;
  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);
  // Pictures load as their turn comes (the current slide and the next one),
  // not all eight up front — and once loaded they stay.
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0, 1]));
  useEffect(() => {
    setLoaded((prev) => {
      const next = (i + 1) % Math.max(n, 1);
      if (prev.has(i) && prev.has(next)) return prev;
      return new Set([...prev, i, next]);
    });
  }, [i, n]);

  useEffect(() => {
    if (n < 2 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => go(i + 1), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [i, n, paused, go]);

  if (n === 0) return null;

  return (
    <section
      className="bb"
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        setPaused(false);
        if (start === null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1);
      }}
    >
      {slides.map((s, k) => (
        <div
          key={s.id}
          className={`bb-slide${s.art ? ' bb-product' : ''}${k === i ? ' bb-on' : ''}`}
          aria-hidden={k !== i}
          role="group"
          aria-roledescription="slide"
          aria-label={`${k + 1} of ${n}: ${s.title}`}
        >
          {s.image && loaded.has(k) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="bb-img" src={s.image} alt="" fetchPriority={k === 0 ? 'high' : 'auto'} />
          ) : (
            <div className="bb-img bb-img-blank" />
          )}
          {s.art && loaded.has(k) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="bb-art" src={s.art} alt="" />
          ) : null}
          <div className="bb-shade" />
          <div className="container bb-body">
            <p className="bb-kicker">{s.kicker}</p>
            <h2 className="bb-title">{s.title}</h2>
            <p className="bb-facts">
              {s.facts}
              {s.price ? <span className="bb-price">{s.price}</span> : null}
            </p>
            <Link href={s.href} className="btn btn-brand btn-lg bb-cta" tabIndex={k === i ? 0 : -1}>
              {s.cta}
            </Link>
          </div>
        </div>
      ))}
      {n > 1 && (
        <div className="container bb-dots" role="tablist" aria-label="Choose a slide">
          {slides.map((s, k) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={s.title}
              className={`bb-dot${k === i ? ' bb-dot-on' : ''}`}
              onClick={() => go(k)}
            >
              <span style={k === i && !paused ? { animationDuration: `${INTERVAL_MS}ms` } : undefined} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
