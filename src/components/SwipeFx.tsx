'use client';

// Gives server-rendered horizontal rows the site's swipe effect (usePeekDim):
// every element matching `selector` that actually scrolls sideways gets the
// edge dimming and the one-time nudge. Renders nothing.
import { useEffect } from 'react';
import { attachNudge, attachPeekDim } from './usePeekDim';

export default function SwipeFx({ selector }: { selector: string }) {
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      el.classList.add('swipe-fx');
      cleanups.push(attachPeekDim(el), attachNudge(el, 56));
    });
    return () => cleanups.forEach((fn) => fn());
  }, [selector]);
  return null;
}
