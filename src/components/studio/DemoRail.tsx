'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The scrolling row under the homepage's "Try a live demo" heading. The cards
 * (`children`, server-rendered <li>s) sit in a scroll-snap row; on a phone you
 * swipe, on a desktop the two arrows in the heading move it one card at a
 * time. The arrows are always in the markup (no layout shift) and only switch
 * between enabled and disabled once the row has measured itself.
 */
export default function DemoRail({
  head,
  prevLabel,
  nextLabel,
  label,
  children,
}: {
  head: ReactNode;
  prevLabel: string;
  nextLabel: string;
  label: string;
  children: ReactNode;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const go = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector('li');
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const step = card ? card.getBoundingClientRect().width + gap : el.clientWidth * 0.8;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * step, behavior: still ? 'auto' : 'smooth' });
  };

  return (
    <div className="sh-dr">
      <div className="sh-dr-head">
        {head}
        <div className="sh-dr-arrows">
          <button type="button" className="sh-dr-arrow" aria-label={prevLabel} disabled={atStart} onClick={() => go(-1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
          <button type="button" className="sh-dr-arrow" aria-label={nextLabel} disabled={atEnd} onClick={() => go(1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      <ul className="sh-dr-track" ref={track} aria-label={label}>
        {children}
      </ul>
    </div>
  );
}
