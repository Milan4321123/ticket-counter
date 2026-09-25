'use client';

// The homepage's shared swipe effect: every child of a horizontal track gets a
// --d between 0 (fully in view) and 1 (hanging outside it), repainted on each
// scroll frame, so CSS can dim and shrink whatever is peeking in from an edge
// and brighten it as the finger brings it in. Used by the event carousel, the
// bazaar grid and the shops rail, so all three move the same way.
import { useCallback, useEffect, type RefObject } from 'react';

export function usePeekDim(track: RefObject<HTMLElement | null>, onPaint?: (firstInView: number) => void) {
  const paint = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const left = el.scrollLeft + pad - 2;
    const right = el.scrollLeft + el.clientWidth - pad + 2;
    let first = -1;
    Array.from(el.children).forEach((child, k) => {
      const c = child as HTMLElement;
      const out = Math.max(0, left - c.offsetLeft, c.offsetLeft + c.offsetWidth - right);
      const d = Math.min(1, out / (c.offsetWidth * 0.6));
      c.style.setProperty('--d', d.toFixed(3));
      if (first < 0 && d < 0.5) first = k;
    });
    onPaint?.(Math.max(0, first));
  }, [track, onPaint]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(paint);
    };
    paint();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [track, paint]);

  return paint;
}
