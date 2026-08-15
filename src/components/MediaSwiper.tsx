'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MediaLightbox from './MediaLightbox';

export interface MediaSwiperItem {
  id: string;
  kind: 'photo' | 'video';
  src: string;
  alt: string;
}

export interface MediaSwiperProps {
  items: MediaSwiperItem[];
  /** Accessible name for the rail, e.g. "Dashain Night gallery". */
  label?: string;
}

/** Honors reduced-motion for the programmatic scrolls the arrows/dots trigger. */
function scrollBehavior(): ScrollBehavior {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'auto';
  }
  return 'smooth';
}

function ChevronIcon({ dir }: { dir: 1 | -1 }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={dir === 1 ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.2c0-.9 1-1.5 1.8-1l9 6.3c.7.5.7 1.5 0 2l-9 6.3c-.8.5-1.8 0-1.8-1V5.2Z" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Edge-to-edge media rail: photos and videos on one horizontal scroll-snap
 * track, so a touch swipe is the browser's own (momentum, rubber-banding and
 * snapping all come for free). An IntersectionObserver — not a scroll math
 * loop — marks the centred slide, which drives the dots, the neighbour
 * scale/fade, and pausing any video that swipes out of view.
 *
 * Tapping a slide opens the full-screen card-deck viewer.
 */
export default function MediaSwiper({ items, label = 'Gallery' }: MediaSwiperProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const [active, setActive] = useState(0);
  const [scrollable, setScrollable] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  /** The neighbour dimming only switches on once the observer is watching, so
      a no-JS render shows every slide at full strength. */
  const [live, setLive] = useState(false);

  const count = items.length;

  // Centred slide + out-of-view video pausing, straight from the browser.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === 'undefined') return;
    const slides = Array.from(track.querySelectorAll<HTMLElement>('.mswipe-slide'));
    if (slides.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const i = Number((entry.target as HTMLElement).dataset.index ?? '0');
          // Slides are at most 84% of the rail, so only one can ever clear
          // 0.75 — no two-slides-active flicker while a swipe is in flight.
          if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
            setActive(i);
          } else if (entry.intersectionRatio < 0.4) {
            const video = entry.target.querySelector('video');
            if (video && !video.paused) video.pause();
          }
        }
      },
      { root: track, threshold: [0.25, 0.5, 0.75, 0.95] }
    );
    slides.forEach((slide) => observer.observe(slide));
    setLive(true);
    return () => observer.disconnect();
  }, [count]);

  // Arrows and dots only make sense once the rail actually overflows.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setScrollable(track.scrollWidth - track.clientWidth > 8);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [count]);

  // Never let a rail video keep playing under the full-screen viewer.
  useEffect(() => {
    if (lightbox === null) return;
    videoRefs.current.forEach((video) => {
      if (!video.paused) video.pause();
    });
  }, [lightbox]);

  const goTo = useCallback(
    (i: number, behavior?: ScrollBehavior) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.max(0, Math.min(count - 1, i));
      const slide = track.querySelectorAll<HTMLElement>('.mswipe-slide')[clamped];
      if (!slide) return;
      // Centre the slide inside the rail; scroll-snap tidies up the last pixels.
      const left =
        slide.offsetLeft - track.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
      track.scrollTo({ left: Math.max(0, left), behavior: behavior ?? scrollBehavior() });
      setActive(clamped);
    },
    [count]
  );

  function onTrackKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // A focused video owns the arrow keys (seeking) — do not steal them.
    if (e.target instanceof HTMLVideoElement) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(active + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(active - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(count - 1);
    }
  }

  /** Inline play from the overlay — an explicit tap, so sound is allowed. */
  function playInline(id: string) {
    const video = videoRefs.current.get(id);
    if (!video) return;
    video.muted = false;
    void video.play().catch(() => {
      // Some browsers still refuse unmuted playback: fall back to silent.
      video.muted = true;
      void video.play().catch(() => undefined);
    });
  }

  function closeLightbox(lastIndex: number) {
    setLightbox(null);
    // Leave the rail where the viewer left off.
    goTo(lastIndex, 'auto');
  }

  if (count === 0) return null;

  return (
    <div
      className={live ? 'mswipe is-live' : 'mswipe'}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div className="mswipe-viewport">
        <div
          className="mswipe-track"
          ref={trackRef}
          tabIndex={0}
          onKeyDown={onTrackKeyDown}
          aria-label={`${count} item${count === 1 ? '' : 's'} — swipe, or use the arrow keys`}
        >
          {items.map((item, i) => (
            <figure
              className={i === active ? 'mswipe-slide is-active' : 'mswipe-slide'}
              key={`${item.id}-${i}`}
              data-index={i}
            >
              <div className="mswipe-card">
                {item.kind === 'video' ? (
                  <>
                    <video
                      className="mswipe-media"
                      ref={(el) => {
                        if (el) videoRefs.current.set(item.id, el);
                        else videoRefs.current.delete(item.id);
                      }}
                      src={item.src}
                      controls
                      muted
                      playsInline
                      preload="metadata"
                      aria-label={item.alt}
                      onPlay={() => setPlayingId(item.id)}
                      onPause={() => setPlayingId((p) => (p === item.id ? null : p))}
                      onEnded={() => setPlayingId((p) => (p === item.id ? null : p))}
                    />
                    <span className="mswipe-kind" aria-hidden="true">
                      Video
                    </span>
                    {playingId !== item.id && (
                      <button
                        type="button"
                        className="mswipe-play"
                        onClick={() => playInline(item.id)}
                        aria-label={`Play ${item.alt}`}
                      >
                        <PlayIcon />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {/* Served by our own /api/media route — next/image is not needed here. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="mswipe-media"
                      src={item.src}
                      alt={item.alt}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      draggable={false}
                    />
                    <button
                      type="button"
                      className="mswipe-hit"
                      onClick={() => setLightbox(i)}
                      aria-label={`Open ${item.alt} full screen`}
                    />
                  </>
                )}
                {/* Photos already have the full-cover hit button, so their
                    expand badge is decoration; on videos it is the way in. */}
                <button
                  type="button"
                  className="mswipe-zoom no-print"
                  onClick={() => setLightbox(i)}
                  aria-label={`Open ${item.alt} full screen`}
                  aria-hidden={item.kind === 'photo'}
                  tabIndex={item.kind === 'photo' ? -1 : undefined}
                >
                  <ExpandIcon />
                </button>
              </div>
            </figure>
          ))}
        </div>

        {count > 1 && scrollable && (
          <>
            <button
              type="button"
              className="mswipe-arrow mswipe-arrow-prev no-print"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              aria-label="Previous item"
            >
              <ChevronIcon dir={-1} />
            </button>
            <button
              type="button"
              className="mswipe-arrow mswipe-arrow-next no-print"
              onClick={() => goTo(active + 1)}
              disabled={active === count - 1}
              aria-label="Next item"
            >
              <ChevronIcon dir={1} />
            </button>
          </>
        )}
      </div>

      {count > 1 && scrollable && (
        <div className="mswipe-dots no-print" role="group" aria-label="Jump to item">
          {items.map((item, i) => (
            <button
              key={`dot-${item.id}-${i}`}
              type="button"
              className={i === active ? 'mswipe-dot is-on' : 'mswipe-dot'}
              aria-label={`Go to item ${i + 1} of ${count}`}
              aria-current={i === active}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}

      {lightbox !== null && (
        <MediaLightbox
          items={items}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => closeLightbox(lightbox)}
        />
      )}
    </div>
  );
}
