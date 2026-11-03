'use client';

import { useRef, useState } from 'react';
import type { StudioVideo } from '@/lib/studioVideos';

/**
 * One video from the studio list. Nothing loads until play is pressed
 * (preload="none" + a poster), and starting one pauses any other studio video
 * on the page, so two soundtracks never play over each other.
 *
 * Until it is first pressed the poster stays clean — one big play button
 * instead of the browser's control bar with its "0:00" over every card — and
 * the native controls appear once it plays.
 */
export default function StudioPlayer({ video }: { video: StudioVideo }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const start = () => {
    const el = ref.current;
    if (!el) return;
    setStarted(true);
    el.play().catch(() => {});
  };

  return (
    <div className={`stv-frame${video.wide ? ' stv-frame-wide' : ''}`}>
      <video
        ref={ref}
        src={video.src}
        poster={video.poster}
        controls={started}
        preload="none"
        playsInline
        muted={video.loop}
        loop={video.loop}
        className={`stv-player${video.wide ? ' stv-wide' : ''}`}
        aria-label={video.title}
        onPlay={(e) => {
          const me = e.currentTarget;
          setStarted(true);
          document.querySelectorAll<HTMLVideoElement>('video.stv-player').forEach((other) => {
            if (other !== me && !other.paused) other.pause();
          });
        }}
      />
      {!started && (
        <button type="button" className="stv-play" onClick={start} aria-label={`Play: ${video.title}`}>
          <span className="stv-play-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7L8 5Z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
