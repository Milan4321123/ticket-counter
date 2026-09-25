'use client';

// The homepage's row of story videos (lib/stories), customer's first: each
// card plays its first chapter silently while it is on screen — like a feed —
// and a tap opens the full player with sound, chapters and full screen.
import { useEffect, useRef, useState } from 'react';
import { STORIES, type Story } from '@/lib/stories';
import { StoryModal } from './StoryPlayer';

const ORDER: Story['id'][] = ['customer', 'restaurant', 'shop', 'event'];

export default function StoryDeck({ kicker, title }: { kicker: string; title: string }) {
  const stories = [...STORIES].sort((a, b) => rank(a) - rank(b));
  const [open, setOpen] = useState<Story | null>(null);
  if (!stories.length) return null;
  return (
    <section className="sd" aria-label={title}>
      <div className="container sd-head">
        <p className="feed-kicker">{kicker}</p>
        <h2 className="sd-title">{title}</h2>
      </div>
      <div className="sd-row">
        {stories.map((s) => (
          <DeckCard key={s.id} story={s} onOpen={() => setOpen(s)} />
        ))}
      </div>
      {open && <StoryModal story={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function rank(s: Story): number {
  const i = ORDER.indexOf(s.id);
  return i === -1 ? ORDER.length : i;
}

function DeckCard({ story, onOpen }: { story: Story; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  // The first chapter — past the title card — on a quiet loop.
  const from = story.chapters[0]?.start ?? 0;
  const to = story.chapters[1]?.end ?? from + 12;

  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          if (v.preload !== 'auto') v.preload = 'auto';
          if (v.currentTime < from || v.currentTime > to) v.currentTime = from;
          void v.play().catch(() => {});
        } else v.pause();
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [from, to]);

  return (
    <button type="button" className="sd-card" onClick={onOpen} aria-label={`Watch: ${story.title}`}>
      <span className="sd-media">
        <video
          ref={ref}
          src={story.src}
          poster={story.poster}
          muted
          playsInline
          preload="none"
          onTimeUpdate={(e) => {
            if (e.currentTarget.currentTime > to) e.currentTarget.currentTime = from;
          }}
        />
        <span className="sd-play" aria-hidden="true">
          ▶
        </span>
        <span className="sd-len">
          {Math.floor(story.length / 60)}:{String(story.length % 60).padStart(2, '0')}
        </span>
      </span>
      <span className="sd-text">
        <span className="sd-for">
          {story.icon} {story.forWho}
        </span>
        <strong>{story.title}</strong>
        <span className="sd-steps">{story.chapters.map((c) => c.chapter).slice(0, 4).join(' · ')}…</span>
      </span>
    </button>
  );
}
