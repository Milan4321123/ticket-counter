'use client';

// A demo account's businesses as big cards. On a phone they swipe endlessly
// with the site's card motion — one centred, its neighbours peeking in dimmed
// on both sides (usePeekDim + useInfiniteLoop); on a wide screen all of them
// sit in a row and the extra copies are hidden.
import Link from 'next/link';
import { useRef } from 'react';
import { useInfiniteLoop, usePeekDim } from '@/components/usePeekDim';

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
  const loop = picks.length >= 2;
  useInfiniteLoop(track, loop ? picks.length : 0, 0);
  usePeekDim(track);

  return (
    <div className="dp-track" ref={track} role="region" aria-label="Pick a demo business">
      {(loop ? [0, 1, 2] : [0]).flatMap((copy) =>
        picks.map((p) => (
          <Link
            key={`${copy}-${p.id}`}
            href={`/portal/events/${p.id}`}
            className={`dp-card demo-pick-${p.tone}${loop && copy !== 1 ? ' dp-clone' : ''}`}
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
  );
}
