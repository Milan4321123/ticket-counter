'use client';

// The logo's flag waves with SVG animation (components/Logo), which CSS's
// prefers-reduced-motion cannot stop — so for visitors who asked for less
// motion, this pauses every logo on the page (and any that appear later).
import { useEffect } from 'react';

export default function LogoMotion() {
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      document.querySelectorAll<SVGSVGElement>('svg.logo-mark').forEach((svg) => {
        if (still.matches) {
          svg.pauseAnimations();
          svg.setCurrentTime(0);
        } else svg.unpauseAnimations();
      });
    };
    apply();
    still.addEventListener('change', apply);
    const seen = new MutationObserver(() => still.matches && apply());
    seen.observe(document.body, { childList: true, subtree: true });
    return () => {
      still.removeEventListener('change', apply);
      seen.disconnect();
    };
  }, []);
  return null;
}
