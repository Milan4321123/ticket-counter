'use client';

// The shared swipe effect for every horizontal row on the site:
//
//   · attachPeekDim — every child of the track gets a --d between 0 (fully in
//     view) and 1 (hanging outside it), repainted on each scroll frame, so CSS
//     can dim and shrink whatever peeks in from an edge and brighten it as the
//     finger brings it in.
//   · attachNudge — the first time a row comes into view it slides a little and
//     settles back, so people see it moves. Once, never after a touch, never
//     with reduced motion.
//
// Plain functions, so server-rendered rows can use them too (see SwipeFx); the
// hooks below are the React spelling.
import { useCallback, useEffect, type RefObject } from 'react';

export function paintPeekDim(el: HTMLElement): number {
  const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
  const left = el.scrollLeft + pad - 2;
  const right = el.scrollLeft + el.clientWidth - pad + 2;
  let first = -1;
  Array.from(el.children).forEach((child, k) => {
    const c = child as HTMLElement;
    const out = Math.max(0, left - c.offsetLeft, c.offsetLeft + c.offsetWidth - right);
    const d = Math.min(1, out / Math.max(1, c.offsetWidth * 0.6));
    c.style.setProperty('--d', d.toFixed(3));
    if (first < 0 && d < 0.5) first = k;
  });
  return Math.max(0, first);
}

export function attachPeekDim(el: HTMLElement, onPaint?: (firstInView: number) => void): () => void {
  let raf = 0;
  const run = () => {
    const first = paintPeekDim(el);
    onPaint?.(first);
  };
  const onScroll = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(run);
  };
  run();
  el.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  return () => {
    el.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    cancelAnimationFrame(raf);
  };
}

export function attachNudge(el: HTMLElement, distance = 64): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  let touched = false;
  let raf = 0;
  let timer = 0;
  const markTouched = () => {
    touched = true;
  };
  el.addEventListener('pointerdown', markTouched, { passive: true });
  el.addEventListener('touchstart', markTouched, { passive: true });
  el.addEventListener('wheel', markTouched, { passive: true });

  const play = () => {
    if (touched || el.scrollWidth <= el.clientWidth + 8) return;
    const from = el.scrollLeft;
    const snap = el.style.scrollSnapType;
    const behavior = el.style.scrollBehavior;
    el.style.scrollSnapType = 'none';
    el.style.scrollBehavior = 'auto';
    const reach = Math.min(distance, el.scrollWidth - el.clientWidth - from);
    if (reach < 8) return;
    const start = performance.now();
    const out = 420;
    const back = 520;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const finish = () => {
      if (!touched) el.scrollLeft = from;
      el.style.scrollSnapType = snap;
      el.style.scrollBehavior = behavior;
    };
    const step = (now: number) => {
      if (touched) return finish();
      const t = now - start;
      if (t < out) el.scrollLeft = from + reach * ease(t / out);
      else if (t < out + 120) el.scrollLeft = from + reach;
      else if (t < out + 120 + back) el.scrollLeft = from + reach * (1 - ease((t - out - 120) / back));
      else return finish();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        // A beat after it arrives, so the eye is already on it.
        timer = window.setTimeout(play, 450);
      }
    },
    { threshold: 0.6 }
  );
  io.observe(el);
  return () => {
    io.disconnect();
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    el.removeEventListener('pointerdown', markTouched);
    el.removeEventListener('touchstart', markTouched);
    el.removeEventListener('wheel', markTouched);
  };
}

export function usePeekDim(track: RefObject<HTMLElement | null>, onPaint?: (firstInView: number) => void) {
  const stable = useCallback((first: number) => onPaint?.(first), [onPaint]);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    return attachPeekDim(el, stable);
  }, [track, stable]);
}

export function useSwipeNudge(track: RefObject<HTMLElement | null>, distance = 64) {
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    return attachNudge(el, distance);
  }, [track, distance]);
}

/**
 * An endless row. The track holds the cards THREE times over (the caller
 * renders them so); it opens on the middle copy at `start`, and whenever a
 * swipe settles in the first or last copy it jumps — invisibly, by exactly one
 * copy — back into the middle. The visitor can swipe either way forever.
 */
export function useInfiniteLoop(track: RefObject<HTMLElement | null>, count: number, start = 0) {
  useEffect(() => {
    const el = track.current;
    if (!el || count < 2 || el.children.length < count * 3) return;
    const pad = () => parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const copyWidth = () => {
      const a = el.children[0] as HTMLElement;
      const b = el.children[count] as HTMLElement;
      return a && b ? b.offsetLeft - a.offsetLeft : 0;
    };
    const jump = (to: number) => {
      const behavior = el.style.scrollBehavior;
      const snap = el.style.scrollSnapType;
      el.style.scrollBehavior = 'auto';
      el.style.scrollSnapType = 'none';
      el.scrollLeft = to;
      void el.offsetWidth; // apply before snap comes back
      el.style.scrollSnapType = snap;
      el.style.scrollBehavior = behavior;
    };
    const first = el.children[count + Math.max(0, start)] as HTMLElement | undefined;
    // Cards that snap to the centre (one-at-a-time rows) open centred.
    if (first) {
      const centred = getComputedStyle(first).scrollSnapAlign.includes('center');
      jump(centred ? first.offsetLeft - (el.clientWidth - first.offsetWidth) / 2 : first.offsetLeft - pad());
    }
    paintPeekDim(el);
    el.dispatchEvent(new Event('scroll'));

    let timer = 0;
    const settle = () => {
      const w = copyWidth();
      if (!w) return;
      const x = el.scrollLeft - ((el.children[0] as HTMLElement).offsetLeft - pad());
      if (x < w * 0.5) jump(el.scrollLeft + w);
      else if (x >= w * 1.5) jump(el.scrollLeft - w);
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 180);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.clearTimeout(timer);
    };
  }, [track, count, start]);
}
