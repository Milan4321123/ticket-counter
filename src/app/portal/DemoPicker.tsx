'use client';

// A demo account's businesses as big cards that swipe exactly like the
// homepage's: endless (useInfiniteLoop), one centred with its neighbours
// peeking in dimmed on both sides (usePeekDim), a nudge the first time the
// row is seen, arrows for a mouse and dots for where you are.
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { useInfiniteLoop, usePeekDim, useSwipeNudge } from '@/components/usePeekDim';

export interface DemoPick {
  id: string;
  emoji: string;
  title: string;
  who: string;
  line: string;
  tone: string;
}

export default function DemoPicker({ picks }: { picks: DemoPick[] }) {
  const track = useRef<HTMLDivElement>(null);
  const n = picks.length;
  const loop = n >= 2;
  const [pos, setPos] = useState(0);

  useInfiniteLoop(track, loop ? n : 0, 0);
  // The centred card is the one "in view" — usePeekDim reports the first lit one.
  usePeekDim(track, setPos);
  useSwipeNudge(track, 70);

  /** Centre the card at physical index i. */
  const centre = useCallback((i: number) => {
    const el = track.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
  }, []);

  const current = n ? pos % n : 0;

  return (
    <div className="dp">
      <div className="dp-track" ref={track} role="region" aria-label="Pick a demo business">
        {(loop ? [0, 1, 2] : [0]).flatMap((copy) =>
          picks.map((p) => (
            <Link
              key={`${copy}-${p.id}`}
              href={`/portal/events/${p.id}`}
              className={`dp-card demo-pick-${p.tone}`}
              aria-hidden={loop && copy !== 1 ? true : undefined}
              tabIndex={loop && copy !== 1 ? -1 : undefined}
            >
              <span className="dp-emoji" aria-hidden="true">
                {p.emoji}
              </span>
              <span className="dp-title">{p.title}</span>
              <span className="dp-who">{p.who}</span>
              <span className="dp-line">{p.line}</span>
              <span className="dp-go">Open →</span>
            </Link>
          ))
        )}
      </div>
      {loop && (
        <>
          <button type="button" className="pk-arrow dp-prev" aria-label="Previous business" onClick={() => centre(pos - 1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
          <button type="button" className="pk-arrow dp-next" aria-label="Next business" onClick={() => centre(pos + 1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
          <div className="pk-dots" aria-hidden="true">
            {picks.map((p, k) => (
              <span key={p.id} className={`pk-dot${k === current ? ' pk-dot-on' : ''}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
