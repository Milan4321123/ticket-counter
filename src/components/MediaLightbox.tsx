'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface LightboxItem {
  id: string;
  kind: 'photo' | 'video';
  src: string;
  alt: string;
}

export interface MediaLightboxProps {
  items: LightboxItem[];
  /** Index of the item on screen (controlled by the parent). */
  index: number;
  /** Called when the deck advances — the parent keeps the source of truth. */
  onIndex: (next: number) => void;
  onClose: () => void;
}

/** Release past this share of the card's width and the deck advances. */
const COMMIT_RATIO = 0.25;
/** …or flick faster than this (px per ms) with at least a little travel. */
const FLICK_VELOCITY = 0.45;
const FLICK_MIN_PX = 26;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: 1 | -1 }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

/**
 * Full-screen media viewer with a card-deck swipe: the card follows the finger
 * (translate + a little rotation), flies out when released past a quarter of
 * its width — or on a fast flick — and springs back otherwise.
 *
 * Rendered through a portal into <body>: `position: fixed` is trapped by any
 * ancestor with a transform/animation, and the event page is full of those.
 */
export default function MediaLightbox({ items, index, onIndex, onClose }: MediaLightboxProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const flingTimer = useRef<number | null>(null);
  /** True between a real drag and the click it produces, so releasing the card
      over the backdrop does not also close the viewer. */
  const didDrag = useRef(false);
  /** Live gesture state. Kept in a ref so a drag never re-renders React. */
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    t: number;
    active: boolean;
    locked: boolean;
  } | null>(null);

  const count = items.length;
  const item: LightboxItem | undefined = items[index];

  const go = useCallback(
    (dir: 1 | -1) => {
      const next = index + dir;
      if (next < 0 || next >= count) return;
      onIndex(next);
    },
    [index, count, onIndex]
  );

  // ---- card transform helpers (direct DOM writes: no re-render per frame) ----

  const springBack = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = prefersReducedMotion()
      ? 'none'
      : 'transform 0.32s var(--ease-out), opacity 0.32s ease';
    card.style.transform = 'translateX(0px) rotate(0deg)';
    card.style.opacity = '1';
  }, []);

  const fling = useCallback(
    (dir: 1 | -1) => {
      const card = cardRef.current;
      if (!card || prefersReducedMotion()) {
        go(dir);
        return;
      }
      card.style.transition = 'transform 0.24s cubic-bezier(0.3, 0, 0.2, 1), opacity 0.24s ease';
      card.style.transform = `translateX(${dir * -125}%) rotate(${dir * -11}deg)`;
      card.style.opacity = '0';
      if (flingTimer.current) window.clearTimeout(flingTimer.current);
      flingTimer.current = window.setTimeout(() => go(dir), 190);
    },
    [go]
  );

  // Every index change lands on a fresh, untransformed card.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = 'none';
    card.style.transform = 'translateX(0px) rotate(0deg)';
    card.style.opacity = '1';
  }, [index]);

  useEffect(
    () => () => {
      if (flingTimer.current) window.clearTimeout(flingTimer.current);
    },
    []
  );

  // ---- pointer drag ----

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (count < 2) return;
    // Native video controls and the overlay buttons keep their own gestures.
    if ((e.target as HTMLElement).closest('video, button, a')) return;
    didDrag.current = false;
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      active: true,
      locked: false,
    };
    const card = cardRef.current;
    if (card) card.style.transition = 'none';
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety — the move/up handlers work without it */
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const card = cardRef.current;
    if (!d || !d.active || d.id !== e.pointerId || !card) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.locked) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        // Mostly vertical: hand the gesture back to the browser.
        d.active = false;
        springBack();
        return;
      }
      d.locked = true;
      didDrag.current = true;
    }
    const width = card.clientWidth || 1;
    const ratio = Math.max(-1, Math.min(1, dx / width));
    card.style.transform = `translateX(${Math.round(dx)}px) rotate(${(ratio * 7).toFixed(2)}deg)`;
    card.style.opacity = String(1 - Math.abs(ratio) * 0.4);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    const card = cardRef.current;
    if (!d || !d.active || d.id !== e.pointerId || !card) return;
    const dx = e.clientX - d.x;
    const width = card.clientWidth || 1;
    const elapsed = Math.max(1, e.timeStamp - d.t);
    const velocity = Math.abs(dx) / elapsed;
    const dir: 1 | -1 = dx < 0 ? 1 : -1;
    const committed =
      Math.abs(dx) > width * COMMIT_RATIO ||
      (velocity > FLICK_VELOCITY && Math.abs(dx) > FLICK_MIN_PX);
    const target = index + dir;
    if (committed && target >= 0 && target < count) fling(dir);
    else springBack();
  }

  // ---- keyboard, body scroll lock, focus ----

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      // Arrow keys belong to a focused video (seeking) before they belong to us.
      if (document.activeElement instanceof HTMLVideoElement) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  useEffect(() => {
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    // Compensate for the scrollbar we are about to remove, so the page under
    // the overlay does not jump sideways.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, []);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  /** Keep Tab inside the dialog. */
  function onDialogKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], video[controls], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.getClientRects().length > 0);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /** Clicking any empty space around the media closes the viewer. */
  function onBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    if (e.target === e.currentTarget) onClose();
  }

  if (!item || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="mlb-root no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
      ref={dialogRef}
      onKeyDown={onDialogKeyDown}
      onClick={onBackdropClick}
    >
      <div className="mlb-bar">
        <span className="mlb-count" aria-live="polite">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          className="mlb-close"
          onClick={onClose}
          ref={closeRef}
          aria-label="Close the viewer"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mlb-stage" onClick={onBackdropClick}>
        <div
          className="mlb-card"
          ref={cardRef}
          onClick={onBackdropClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {item.kind === 'video' ? (
            <video
              key={`${item.id}-${index}`}
              className="mlb-media"
              src={item.src}
              controls
              autoPlay
              playsInline
              preload="metadata"
              aria-label={item.alt}
            />
          ) : (
            // Served by our own /api/media route — next/image is not needed here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${item.id}-${index}`}
              className="mlb-media"
              src={item.src}
              alt={item.alt}
              draggable={false}
            />
          )}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              className="mlb-nav mlb-prev"
              onClick={() => go(-1)}
              disabled={index === 0}
              aria-label="Previous"
            >
              <ChevronIcon dir={-1} />
            </button>
            <button
              type="button"
              className="mlb-nav mlb-next"
              onClick={() => go(1)}
              disabled={index === count - 1}
              aria-label="Next"
            >
              <ChevronIcon dir={1} />
            </button>
          </>
        )}
      </div>

      <p className="mlb-hint">
        {count > 1 ? 'Swipe or use the arrow keys · Esc to close' : 'Esc to close'}
      </p>
    </div>,
    document.body
  );
}
