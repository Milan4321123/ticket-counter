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

/**
 * A one-time "this moves" nudge: the first time a swipeable row comes into
 * view, it slides a little to the left and settles back, so a visitor sees
 * there is more to the right without being told. Real scrolling (snap paused
 * for the moment), so the edge-dimming plays along. Never after the visitor
 * has touched the row, never with reduced motion, once per row per page.
 */
export function useSwipeNudge(track: RefObject<HTMLElement | null>, distance = 64) {
  useEffect(() => {
    const el = track.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let touched = false;
    let raf = 0;
    const markTouched = () => {
      touched = true;
    };
    el.addEventListener('pointerdown', markTouched, { passive: true });
    el.addEventListener('touchstart', markTouched, { passive: true });
    el.addEventListener('wheel', markTouched, { passive: true });

    const play = () => {
      if (touched || el.scrollLeft > 4 || el.scrollWidth <= el.clientWidth + 8) return;
      const snap = el.style.scrollSnapType;
      const behavior = el.style.scrollBehavior;
      el.style.scrollSnapType = 'none';
      el.style.scrollBehavior = 'auto';
      const start = performance.now();
      const out = 420;
      const back = 520;
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const step = (now: number) => {
        if (touched) return finish();
        const t = now - start;
        if (t < out) el.scrollLeft = distance * ease(t / out);
        else if (t < out + 120) el.scrollLeft = distance;
        else if (t < out + 120 + back) el.scrollLeft = distance * (1 - ease((t - out - 120) / back));
        else return finish();
        raf = requestAnimationFrame(step);
      };
      const finish = () => {
        if (!touched) el.scrollLeft = 0;
        el.style.scrollSnapType = snap;
        el.style.scrollBehavior = behavior;
      };
      raf = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          // A beat after it arrives, so the eye is already on it.
          setTimeout(play, 450);
        }
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', markTouched);
      el.removeEventListener('touchstart', markTouched);
      el.removeEventListener('wheel', markTouched);
    };
  }, [track, distance]);
}
