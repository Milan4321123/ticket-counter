'use client';

// A demo account's three businesses as big cards. On a phone they swipe with
// the site's card motion — the middle one centred, its neighbours peeking in
// dimmed on both sides (usePeekDim); on a wide screen all three sit in a row.
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { paintPeekDim, usePeekDim } from '@/components/usePeekDim';

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
  usePeekDim(track);

  // Open on the middle business, centred, so there is one to either side.
  useEffect(() => {
    const el = track.current;
    if (!el || el.scrollWidth <= el.clientWidth + 8) return;
    const mid = el.children[Math.floor(picks.length / 2)] as HTMLElement | undefined;
    if (!mid) return;
    const behavior = el.style.scrollBehavior;
    el.style.scrollBehavior = 'auto';
    el.scrollLeft = mid.offsetLeft - (el.clientWidth - mid.offsetWidth) / 2;
    el.style.scrollBehavior = behavior;
    paintPeekDim(el); // now, not a frame later — no dim flash on the centred card
  }, [picks.length]);

  return (
    <div className="dp-track" ref={track} role="region" aria-label="Pick a demo business">
      {picks.map((p) => (
        <Link key={p.id} href={`/portal/events/${p.id}`} className={`dp-card demo-pick-${p.tone}`}>
          <span className="dp-emoji" aria-hidden="true">
            {p.emoji}
          </span>
          <span className="dp-title">{p.title}</span>
          <span className="dp-who">{p.who}</span>
          <span className="dp-line">{p.line}</span>
          <span className="dp-go">Open →</span>
        </Link>
      ))}
    </div>
  );
}
