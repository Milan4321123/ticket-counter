'use client';

import { useEffect, useRef, useState } from 'react';
import type { StudioVideo } from '@/lib/studioVideos';

/**
 * The homepage showreel. Poster first and preload="none": nothing downloads on
 * a phone until someone presses play. On a wide screen (and only when the
 * visitor has not asked for less motion or less data) it starts muted and
 * loops quietly behind the hero; pressing the button restarts it with sound.
 * Playing it with sound pauses any other studio video (and vice versa — it
 * carries the same `stv-player` class StudioPlayer looks for).
 */
export default function Showreel({ video }: { video: StudioVideo }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [withSound, setWithSound] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const wide = window.matchMedia('(min-width: 960px)').matches;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!wide || calm || conn?.saveData) return;
    el.muted = true;
    el.loop = true;
    el.play().catch(() => {});
  }, []);

  const playWithSound = () => {
    const el = ref.current;
    if (!el) return;
    setWithSound(true);
    el.loop = false;
    el.muted = false;
    el.currentTime = 0;
    el.play().catch(() => {});
  };

  return (
    <div className={`sh-reel${withSound ? ' is-sound' : ''}`}>
      <video
        ref={ref}
        src={video.src}
        poster={video.poster}
        preload="none"
        playsInline
        muted
        controls={withSound}
        className="stv-player stv-wide sh-reel-video"
        aria-label={video.title}
        onPlay={(e) => {
          const me = e.currentTarget;
          if (me.muted) return;
          document.querySelectorAll<HTMLVideoElement>('video.stv-player').forEach((other) => {
            if (other !== me && !other.paused) other.pause();
          });
        }}
      />
      {!withSound && (
        <button type="button" className="sh-reel-play" onClick={playWithSound}>
          <span className="sh-reel-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7L8 5Z" />
            </svg>
          </span>
          <span>
            <strong>Watch the showreel</strong>
            <span>36 s · sound on</span>
          </span>
        </button>
      )}
    </div>
  );
}
