'use client';

import type { StudioVideo } from '@/lib/studioVideos';

/**
 * One video from the studio list. Nothing loads until play is pressed
 * (preload="none" + a poster), and starting one pauses any other studio video
 * on the page, so two soundtracks never play over each other.
 */
export default function StudioPlayer({ video }: { video: StudioVideo }) {
  return (
    <video
      src={video.src}
      poster={video.poster}
      controls
      preload="none"
      playsInline
      muted={video.loop}
      loop={video.loop}
      className={`stv-player${video.wide ? ' stv-wide' : ''}`}
      aria-label={video.title}
      onPlay={(e) => {
        const me = e.currentTarget;
        document.querySelectorAll<HTMLVideoElement>('video.stv-player').forEach((other) => {
          if (other !== me && !other.paused) other.pause();
        });
      }}
    />
  );
}
