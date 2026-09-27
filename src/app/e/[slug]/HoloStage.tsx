'use client';

import { useEffect, useRef } from 'react';
import type { HoloOptions } from './holoScene';

/**
 * Mounts the WebGL hero (holoScene) into the event hero. three.js is fetched
 * only here, only after the page is up, and never when "reduce motion" is on.
 * Until it is running — or if WebGL is unavailable — the CSS scene (HeroDepth)
 * is what shows; once the stage is live the hero gets .has-holo and the CSS
 * scene fades out under it.
 */
export default function HoloStage(props: Omit<HoloOptions, 'font'>) {
  const host = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(props);

  useEffect(() => {
    const el = host.current;
    const hero = el?.closest<HTMLElement>('.event-hero');
    if (!el || !hero) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    const opts = JSON.parse(key) as Omit<HoloOptions, 'font'>;
    const font = getComputedStyle(hero.querySelector('h1') ?? hero).fontFamily || 'system-ui, sans-serif';
    import('./holoScene')
      .then(({ startHolo }) => {
        if (cancelled) return;
        stop = startHolo(el, hero, { ...opts, font });
        if (stop) requestAnimationFrame(() => hero.classList.add('has-holo'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      hero.classList.remove('has-holo');
      stop?.();
    };
  }, [key]);

  return <div ref={host} className="holo" aria-hidden="true" />;
}
