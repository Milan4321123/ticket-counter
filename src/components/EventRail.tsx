'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface EventRailProps {
  /** Accessible name for the scrollable region, e.g. "Happening soon". */
  label: string;
  /** The tiles. Rendered on the server and passed straight through. */
  children: React.ReactNode;
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One horizontal row of event tiles — the browse page's main unit.
 *
 * The scrolling itself is the browser's own: a flex row with `overflow-x` and
 * scroll snapping. That is deliberate — it means a swipe on a phone, a
 * trackpad flick, a shift+wheel, and the arrow keys all work with no
 * JavaScript involved, and the row still scrolls if this component never
 * hydrates. The only thing the script adds is the pair of arrows, which is
 * also the only part that is safe to lose.
 *
 * The arrows page by a viewport-width at a time, and hide themselves at the
 * ends (and entirely when the row does not overflow) — an arrow that cannot
 * move anything is worse than no arrow, because it invites a click that does
 * nothing.
 */
export default function EventRail({ label, children }: EventRailProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // A pixel of slack: browsers report fractional scroll offsets at high zoom
    // and on retina, so an exact comparison leaves the end arrow enabled on a
    // row that is already as far right as it goes.
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 1);
    setCanNext(max > 1 && el.scrollLeft < max - 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    // Tiles are images that arrive after paint and the row reflows on rotate,
    // so "does this overflow?" has to be re-asked rather than measured once.
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [sync]);

  const page = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    // Just short of a full width, so the tile at the edge stays half in view
    // and the row reads as continuous rather than as separate pages.
    el.scrollBy({ left: dir * el.clientWidth * 0.86, behavior: 'smooth' });
  };

  return (
    <div className="rail">
      <div className="rail-viewport">
        <div
          ref={trackRef}
          className="rail-track"
          role="region"
          aria-label={label}
          tabIndex={0}
        >
          {children}
        </div>

        <button
          type="button"
          className="rail-nav rail-nav-prev"
          onClick={() => page(-1)}
          disabled={!canPrev}
          aria-hidden={!canPrev}
          tabIndex={canPrev ? 0 : -1}
          aria-label={`Scroll ${label} left`}
        >
          <span className="rail-nav-disc" aria-hidden="true">
            <Chevron direction="left" />
          </span>
        </button>
        <button
          type="button"
          className="rail-nav rail-nav-next"
          onClick={() => page(1)}
          disabled={!canNext}
          aria-hidden={!canNext}
          tabIndex={canNext ? 0 : -1}
          aria-label={`Scroll ${label} right`}
        >
          <span className="rail-nav-disc" aria-hidden="true">
            <Chevron direction="right" />
          </span>
        </button>
      </div>
    </div>
  );
}
