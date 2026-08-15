'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** The organizer's cover clip. */
  src: string;
  /** Still frame shown before the first decoded frame — and instead of the
   *  clip whenever it cannot play. */
  poster?: string;
}

/**
 * The decorative cover video behind the hero. It is a client component for two
 * reasons only: a clip the browser cannot decode has to get out of the way so
 * the still frame underneath shows instead of a black rectangle, and a visitor
 * who asked for less motion must not have it running — CSS hides it for them,
 * but a hidden autoplaying video keeps buffering and playing.
 */
export default function HeroCoverVideo({ src, poster }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.removeAttribute('autoplay');
    el.pause();
  }, []);

  if (failed) return null;

  return (
    <video
      ref={ref}
      className="event-hero-video"
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      tabIndex={-1}
      onError={() => setFailed(true)}
    />
  );
}
