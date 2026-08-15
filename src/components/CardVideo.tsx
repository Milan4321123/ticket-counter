'use client';

import { useEffect, useRef, useState } from 'react';

export interface CardVideoProps {
  src: string;
  /** A still to show until the clip paints, and wherever it cannot play. */
  poster?: string;
  /** Accessible name, e.g. "Dashain Night 2026". */
  label: string;
}

/**
 * The looping clip on a feed tile, when the organizer's cover is a video.
 *
 * Silent, controlless and decorative — the tile is a link to the event, so the
 * clip must never behave like a player. Three rules keep a feed of these cheap
 * and calm rather than a wall of thrashing video:
 *
 *  - It only plays while the tile is actually on screen (IntersectionObserver),
 *    and pauses the moment it leaves. Ten autoplaying clips would otherwise all
 *    decode at once on a phone.
 *  - `preload="metadata"` — the browser fetches enough to know the dimensions,
 *    not the whole file, so a feed does not pull tens of megabytes on load.
 *  - `pointer-events: none`, so taps land on the card's link underneath. A video
 *    element swallows clicks otherwise and the tile stops being clickable.
 *
 * Falls back to the poster image when playback fails or the visitor asked for
 * reduced motion, so the tile always shows something.
 */
export default function CardVideo({ src, poster, label }: CardVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [broken, setBroken] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // A blocked autoplay (battery saver, data saver) is normal and not
            // worth surfacing — the poster underneath already covers it.
            void el.play().catch(() => {});
          } else {
            el.pause();
          }
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  // An undecodable file falls back to the poster when there is one; with none,
  // the tile shows nothing rather than a broken-image icon.
  if (broken) {
    if (!poster) return null;
    // Served by our own /api/media route — next/image is not needed here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={poster} alt={`${label} poster`} className="event-card-shot" />;
  }

  // Reduced motion: keep the SAME picture, just still. Swapping to a different
  // image would be the very flip this component exists to avoid — the video's
  // own first frame is what the tile should show, simply not moving.
  if (reduced) {
    return (
      <video
        className="event-card-shot event-card-clip"
        src={src}
        poster={poster}
        muted
        playsInline
        preload="metadata"
        aria-label={label}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <video
      ref={ref}
      className="event-card-shot event-card-clip"
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label}
      onError={() => setBroken(true)}
    />
  );
}
