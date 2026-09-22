'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface EventCarouselProps {
  /** Accessible name for the region, e.g. "Featured events". */
  label: string;
  /** How many slides are inside — drives the dots and the arrow bounds. */
  count: number;
  /** One <div className="ecar-slide"> per featured event, rendered upstream. */
  children: React.ReactNode;
}

/** Honors reduced-motion for the scrolls the arrows and dots trigger. */
function scrollBehavior(): ScrollBehavior {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'auto';
  }
  return 'smooth';
}

function Chevron({ dir }: { dir: 1 | -1 }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={dir === 1 ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The swipeable billboard at the top of the browse page — several events, one
 * at a time, at full width.
 *
 * Built like the event page's gallery rail rather than as a bespoke slider: the
 * movement IS the browser's own horizontal scroll with snapping, so a thumb
 * swipe gets native momentum and rubber-banding, a trackpad flick works, and
 * the whole thing still swipes with JavaScript off. The script only adds the
 * arrows, the dots, and the keyboard bindings — the parts that are safe to
 * lose. An IntersectionObserver marks the centred slide instead of a scroll
 * math loop, which is what keeps the dots exact during a fast flick.
 *
 * No auto-advance. A hero that moves on its own steals the thing someone was
 * reading, and there is no way to ask it to wait.
 */
export default function EventCarousel({ label, count, children }: EventCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === 'undefined') return;
    const slides = Array.from(track.querySelectorAll<HTMLElement>('.ecar-slide'));
    if (slides.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // A slide fills the whole rail, so only one can ever clear 0.6 —
          // no two-dots-lit flicker while a swipe is still in flight.
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setActive(Number((entry.target as HTMLElement).dataset.index ?? '0'));
          }
        }
      },
      { root: track, threshold: [0.3, 0.6, 0.9] }
    );
    slides.forEach((slide) => observer.observe(slide));
    setLive(true);
    return () => observer.disconnect();
  }, [count]);

  const goTo = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.max(0, Math.min(count - 1, i));
      const slide = track.querySelectorAll<HTMLElement>('.ecar-slide')[clamped];
      if (!slide) return;
      // Centre it in the rail; scroll-snap tidies up the last few pixels.
      const left =
        slide.offsetLeft - track.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
      track.scrollTo({ left: Math.max(0, left), behavior: scrollBehavior() });
      setActive(clamped);
    },
    [count]
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
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

  // One featured event needs no controls — and a single dot beneath a lone
  // billboard reads as a control that is broken rather than unnecessary.
  const many = count > 1;

  return (
    <div className={`ecar${live ? ' is-live' : ''}`}>
      <div className="ecar-viewport">
        <div
          ref={trackRef}
          className="ecar-track"
          role="region"
          aria-label={label}
          aria-roledescription="carousel"
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          {children}
        </div>

        {many && (
          <>
            <button
              type="button"
              className="ecar-nav ecar-nav-prev"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              aria-label={`Previous of ${count} featured events`}
            >
              <span className="ecar-nav-disc" aria-hidden="true">
                <Chevron dir={-1} />
              </span>
            </button>
            <button
              type="button"
              className="ecar-nav ecar-nav-next"
              onClick={() => goTo(active + 1)}
              disabled={active === count - 1}
              aria-label={`Next of ${count} featured events`}
            >
              <span className="ecar-nav-disc" aria-hidden="true">
                <Chevron dir={1} />
              </span>
            </button>
          </>
        )}
      </div>

      {many && (
        <div className="ecar-dots" role="tablist" aria-label={`${label} — choose one`}>
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              className={`ecar-dot${i === active ? ' is-active' : ''}`}
              aria-selected={i === active}
              aria-label={`Featured event ${i + 1} of ${count}`}
              onClick={() => goTo(i)}
            />
          ))}
          <span className="ecar-count" aria-hidden="true">
            {active + 1} / {count}
          </span>
        </div>
      )}

      {/* Say that there is more, in words.
          Dots are a progress indicator, not an instruction — they tell you
          where you are once you already know you can move, and a visitor who
          has never swiped this rail reads three dots as decoration. The arrows
          only appear on a pointer device, so on a phone there was nothing at
          all saying another event existed. Naming the gesture is what turns a
          static-looking card into something you try. */}
      {count > 1 && (
        <p className="ecar-hint">
          <span aria-hidden="true">←</span>
          Swipe or drag sideways for {count - 1} more event{count - 1 === 1 ? '' : 's'}
          <span aria-hidden="true">→</span>
        </p>
      )}
    </div>
  );
}
