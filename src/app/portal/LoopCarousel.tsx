'use client';

// Server-rendered cards (the seller's own events and shops) swiping exactly
// like the demo businesses above them (DemoPicker): endless, one centred with
// its neighbours peeking in dimmed, a nudge the first time, arrows for a mouse
// and dots for where you are. A single card just sits in the middle.
import { Children, useCallback, useRef, useState, type ReactNode } from 'react';
import { useInfiniteLoop, usePeekDim, useSwipeNudge } from '@/components/usePeekDim';

export default function LoopCarousel({ label, children }: { label: string; children: ReactNode }) {
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
    <div className="dp lc">
      <div className="dp-track lc-track" ref={track} role="region" aria-label={label}>
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
          <button type="button" className="pk-arrow dp-prev" aria-label="Previous" onClick={() => centre(pos - 1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
          <button type="button" className="pk-arrow dp-next" aria-label="Next" onClick={() => centre(pos + 1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
          <div className="pk-dots" aria-hidden="true">
            {cards.map((_, k) => (
              <span key={k} className={`pk-dot${k === current ? ' pk-dot-on' : ''}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
