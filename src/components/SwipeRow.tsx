'use client';

// A sideways-swiping row for server-rendered cards (children), with the site's
// swipe motion — edge dimming and a one-time nudge (usePeekDim) — plus arrows
// for a mouse and page dots. The layout (how many rows, how wide a card) is
// the className's CSS; this only moves it.
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { usePeekDim, useSwipeNudge } from './usePeekDim';

export default function SwipeRow({ className, label, children }: { className: string; label: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ start: true, end: false, page: 0, pages: 1 });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const pages = Math.max(1, Math.round(el.scrollWidth / el.clientWidth));
    setState({
      start: el.scrollLeft < 8,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8,
      page: Math.min(pages - 1, Math.round(el.scrollLeft / el.clientWidth)),
      pages,
    });
  }, []);
  usePeekDim(track, measure);
  useSwipeNudge(track, 72);

  const go = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  return (
    <div className="swrow">
      <div className="swrow-arrows" aria-hidden={state.pages <= 1}>
        <button type="button" className="bp-arrow" aria-label="Previous" disabled={state.start} onClick={() => go(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </button>
        <button type="button" className="bp-arrow" aria-label="Next" disabled={state.end} onClick={() => go(1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      </div>
      <div ref={track} className={className} role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
      {state.pages > 1 && (
        <div className="bp-dots" aria-hidden="true">
          {Array.from({ length: Math.min(state.pages, 12) }, (_, k) => (
            <span key={k} className={k === Math.min(state.page, 11) ? 'bp-dot-on' : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
