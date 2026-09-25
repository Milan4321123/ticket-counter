'use client';

// Server-rendered cards swiping like the homepage's rows: endless, one card
// centred with its neighbours peeking in dimmed, a nudge the first time,
// arrows for a mouse and dots (or "3 / 20" for long rows) for where you are.
// A single card is not a carousel: it just sits in the middle.
//
// Used for the seller's own listings (portal home) and a listing's tickets or
// items (/e/[slug]). The card width is the --lc-w custom property, so each
// place can size its cards; see .lc-* in globals.css.
import { Children, useCallback, useRef, useState, type ReactNode } from 'react';
import { useInfiniteLoop, usePeekDim, useSwipeNudge } from './usePeekDim';

const MAX_DOTS = 10;

export default function LoopCarousel({
  label,
  className = '',
  children,
}: {
  label: string;
  /** Extra classes on the wrapper — e.g. the card family's own descendant styles. */
  className?: string;
  children: ReactNode;
}) {
  const cards = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const n = cards.length;
  const loop = n >= 2;
  const [pos, setPos] = useState(0);

  useInfiniteLoop(track, loop ? n : 0, 0);
  usePeekDim(track, setPos);
  useSwipeNudge(track, 70);

  const centre = useCallback((i: number) => {
    const el = track.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
  }, []);

  const current = n ? pos % n : 0;

  return (
    <div className={`lc${loop ? '' : ' lc-single'}${className ? ` ${className}` : ''}`}>
      <div className="lc-track" ref={track} role="region" aria-label={label}>
        {(loop ? [0, 1, 2] : [0]).flatMap((copy) =>
          cards.map((card, k) => (
            <div key={`${copy}-${k}`} className="lc-slide" aria-hidden={loop && copy !== 1 ? true : undefined}>
              {card}
            </div>
          ))
        )}
      </div>
      {loop && (
        <>
          <button type="button" className="pk-arrow lc-prev" aria-label="Previous" onClick={() => centre(pos - 1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
          <button type="button" className="pk-arrow lc-next" aria-label="Next" onClick={() => centre(pos + 1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
          {n <= MAX_DOTS ? (
            <div className="pk-dots" aria-hidden="true">
              {cards.map((_, k) => (
                <span key={k} className={`pk-dot${k === current ? ' pk-dot-on' : ''}`} />
              ))}
            </div>
          ) : (
            <p className="lc-count" aria-hidden="true">
              {current + 1} / {n}
            </p>
          )}
        </>
      )}
    </div>
  );
}
