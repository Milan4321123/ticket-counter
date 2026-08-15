'use client';

import { useEffect, useRef, useState } from 'react';

export interface FeedVideoProps {
  src: string;
  /** Accessible name, e.g. "Dashain Night update video". */
  label: string;
}

function SoundOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9v6h4l5 4V5L8 9H4Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M17 9.5l4 5M21 9.5l-4 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function SoundOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9v6h4l5 4V5L8 9H4Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A video inside the Updates feed, behaving like a post on a social app: it
 * starts playing silently once half of it is on screen, pauses the moment it
 * scrolls away, and loops. Sound is never switched on for the visitor — the
 * small speaker button is the only way in, and if the browser refuses unmuted
 * playback we quietly drop back to silent.
 *
 * Anyone who asked for reduced motion gets no autoplay at all: just the first
 * frame and the normal controls.
 */
export default function FeedVideo({ src, label }: FeedVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  /** The speaker button only makes sense once JS is running the video. */
  const [live, setLive] = useState(false);

  useEffect(() => {
    // React does not reliably render `muted` into the server HTML, so pin it on
    // the element itself before anything can play out loud.
    const el = ref.current;
    if (el) el.muted = true;
    setLive(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Autoplay can still be refused (data saver, low-power mode). That
            // is fine — the controls are right there.
            void el.play().catch(() => undefined);
          } else if (!el.paused) {
            el.pause();
          }
        }
      },
      { threshold: [0, 0.5, 0.9] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** An explicit tap — the only moment sound is allowed to come on. */
  function toggleSound() {
    const el = ref.current;
    if (!el) return;
    if (!el.muted) {
      el.muted = true;
      setMuted(true);
      return;
    }
    el.muted = false;
    setMuted(false);
    void el.play().catch(() => {
      // Some browsers refuse unmuted playback outright — keep it silent
      // rather than leaving a stopped video behind.
      el.muted = true;
      setMuted(true);
      void el.play().catch(() => undefined);
    });
  }

  return (
    <div className="feed-video">
      <video
        ref={ref}
        className="feed-video-el"
        src={src}
        controls
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        // Native controls can unmute too — keep the button's icon honest.
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
      />
      {live && (
        <button
          type="button"
          className="feed-video-sound no-print"
          onClick={toggleSound}
          aria-pressed={!muted}
          aria-label={muted ? 'Turn the sound on' : 'Turn the sound off'}
        >
          {muted ? <SoundOffIcon /> : <SoundOnIcon />}
        </button>
      )}
    </div>
  );
}
