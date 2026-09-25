'use client';

// Plays a story video (lib/stories) in a full-screen player: the whole story,
// or — from a tool button's "▶ See how" — just that tool's chapters, stopping
// at the end with "Watch the whole story". The chapter list beside it jumps
// anywhere. Opened by a tap, so it may play with sound straight away.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { storyById, type Story } from '@/lib/stories';

export default function StoryPlayer({
  storyId,
  start,
  end,
  label,
  variant = 'chip',
}: {
  storyId: string;
  /** Seconds: play only this stretch (a tool's chapters). */
  start?: number;
  end?: number;
  label?: string;
  variant?: 'chip' | 'mini' | 'card' | 'inline';
}) {
  const story = storyById(storyId);
  const [open, setOpen] = useState(false);
  if (!story) return null;
  const clipLen = start !== undefined && end !== undefined ? Math.round(end - start) : story.length;

  return (
    <>
      {variant === 'card' ? (
        <button type="button" className="sp-card" onClick={() => setOpen(true)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={story.poster} alt="" loading="lazy" />
          <span className="sp-card-play" aria-hidden="true">
            ▶
          </span>
          <span className="sp-card-text">
            <span className="sp-card-for">
              {story.icon} {story.forWho}
            </span>
            <strong>{story.title}</strong>
            <span className="sp-card-len">
              {Math.floor(story.length / 60)}:{String(story.length % 60).padStart(2, '0')} · {story.chapters.length} steps
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          className={variant === 'mini' ? 'sp-mini' : variant === 'inline' ? 'sp-inline' : 'sp-chip'}
          onClick={(e) => {
            // Inside a tool card that is itself a link: only the video opens.
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label={`See how: ${label ?? story.title}`}
        >
          <span aria-hidden="true">▶</span> {variant === 'mini' ? `${clipLen}s` : label ?? 'See how'}
        </button>
      )}
      {open && <Player story={story} start={start} end={end} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The full-screen player on its own — for a card that is itself the trigger (StoryDeck). */
export function StoryModal({ story, onClose }: { story: Story; onClose: () => void }) {
  return <Player story={story} onClose={onClose} />;
}

function Player({ story, start, end, onClose }: { story: Story; start?: number; end?: number; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [limit, setLimit] = useState<number | null>(end ?? null);
  const [stopped, setStopped] = useState(false);
  const [now, setNow] = useState(start ?? 0);
  const [ended, setEnded] = useState(false);
  // The closing card (last ~7 s): its buttons are drawn in the video, so real
  // ones are laid over it here.
  const atEnd = ended || now >= story.length - 6.5;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const jump = (t: number, until: number | null) => {
    const v = ref.current;
    if (!v) return;
    setLimit(until);
    setStopped(false);
    v.currentTime = t;
    void v.play().catch(() => {});
  };

  const current = story.chapters.findIndex((c) => now >= c.start && now < c.end);

  return createPortal(
    <div className="sp-modal" role="dialog" aria-modal="true" aria-label={story.title} onClick={onClose}>
      <div className="sp-box" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sp-x" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <div className="sp-stage">
          <video
            ref={ref}
            src={story.src}
            poster={story.poster}
            autoPlay
            controls
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => {
              if (start !== undefined) e.currentTarget.currentTime = start;
            }}
            onEnded={() => setEnded(true)}
            onPlay={() => setEnded(false)}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              setNow(t);
              if (limit !== null && t >= limit) {
                e.currentTarget.pause();
                setStopped(true);
                setLimit(null);
              }
            }}
          />
          {atEnd && !stopped && (
            <div className="sp-cta">
              {story.audience === 'buyer' ? (
                <>
                  <Link href="/#events" className="btn btn-brand" onClick={onClose}>
                    🎟 Upcoming events
                  </Link>
                  <Link href="/market" className="btn" onClick={onClose}>
                    🛍 The bazaar
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/organizers" className="btn btn-brand" onClick={onClose}>
                    ▶ Try it free
                  </Link>
                  <a href="mailto:support@eventsticketbuy.com?subject=A%20video%20for%20my%20page" className="btn">
                    🎬 Want a video like this?
                  </a>
                </>
              )}
            </div>
          )}
          {stopped && (
            <div className="sp-end">
              <button type="button" className="btn btn-brand" onClick={() => jump(0, null)}>
                ▶ Watch the whole story
              </button>
              <button type="button" className="btn" onClick={() => jump(start ?? 0, end ?? null)}>
                ↺ Again
              </button>
            </div>
          )}
        </div>
        <ol className="sp-chapters">
          {story.chapters.map((c, i) => (
            <li key={c.id}>
              <button type="button" className={i === current ? 'is-now' : ''} onClick={() => jump(c.start + 0.05, null)}>
                <span className="sp-n">{i + 1}</span>
                <span>{c.chapter}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>,
    document.body
  );
}
