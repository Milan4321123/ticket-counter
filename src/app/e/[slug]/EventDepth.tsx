'use client';

import { useEffect, useRef } from 'react';
import './depth.css';

/**
 * The page's motion, driven by the scroll (depth.css holds every look).
 *
 * mode "3d" — an EVENT page:
 *   - the hero recedes into the screen as it scrolls away, its cover drifts
 *     slower than the page, and the floating scene (HeroDepth) follows the
 *     mouse at its own depths;
 *   - the tickets are dealt out of one stack into their places as the section
 *     scrolls in, roll gently as they pass the middle of the screen, and tilt
 *     under the mouse with a light sweeping across them;
 *   - every later section folds up into place the first time it comes in.
 *
 * mode "flat" — a SHOP page. 3D is in the way when somebody is comparing
 * goods, so a shop only gets the calm half: the cover's slow drift, sections
 * rising into place, and goods tiles arriving one after another. Every item
 * stays exactly where the grid put it.
 *
 * Nothing here decides what is shown. Without JavaScript, or with "reduce
 * motion" switched on, this does nothing at all and the page is the same page,
 * standing still. Content is only ever hidden (for its entrance) when it is
 * below the fold at load, so nothing on the first screen can flash.
 */
export default function EventDepth({ mode }: { mode: '3d' | 'flat' }) {
  const progress = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = document.querySelector<HTMLElement>('.event-page');
    if (!page) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    page.dataset.depth = mode;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hero = page.querySelector<HTMLElement>('.event-hero');
    const offs: (() => void)[] = [];
    const on = (target: EventTarget, type: string, fn: (e: PointerEvent) => void, opts?: AddEventListenerOptions) => {
      const listener = fn as EventListener;
      target.addEventListener(type, listener, opts);
      offs.push(() => target.removeEventListener(type, listener, opts));
    };

    // ---------------- Entrances (both modes) ----------------
    //
    // A section's children rise in one after another; a shop's tiles do the
    // same, row by row. One-shot: once in, they stay put.
    const entered = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.classList.remove('dz-pre');
          el.classList.add('dz-in');
          entered.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    const below = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.9;
    const prepared: HTMLElement[] = [];
    const prepare = (el: HTMLElement) => {
      el.classList.add('dz-pre');
      prepared.push(el);
      entered.observe(el);
    };

    for (const box of page.querySelectorAll<HTMLElement>('.event-section > .container')) {
      // The sales section's cards have their own entrance; its container stays.
      if (box.parentElement?.id === 'tickets' || !below(box)) continue;
      [...box.children].forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(Math.min(i, 6))));
      prepare(box);
    }
    if (mode === 'flat') {
      const tiles = [...page.querySelectorAll<HTMLElement>('#tickets .goods-grid .tier-card')];
      tiles.forEach((tile, i) => {
        if (!below(tile)) return;
        tile.style.setProperty('--i', String(i % 3));
        prepare(tile);
      });
    }

    // ---------------- Scroll and pointer (3D) ----------------
    const grid = mode === '3d' ? page.querySelector<HTMLElement>('#tickets .tier-grid-2') : null;
    const dealing = Boolean(grid && !grid.classList.contains('tier-page'));
    const cards = mode === '3d' ? [...page.querySelectorAll<HTMLElement>('#tickets .tier-grid-2 .tier-card')] : [];
    const tilt = new Map<HTMLElement, { x: number; y: number }>();
    const last = new Map<HTMLElement, string>();
    const dealt = new Set<HTMLElement>();
    const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    let raf = 0;
    const frame = () => {
      raf = 0;
      const vh = window.innerHeight || 1;

      if (hero) {
        const r = hero.getBoundingClientRect();
        if (r.bottom > -40) {
          const hp = clamp(-r.top / Math.max(r.height, 1));
          hero.style.setProperty('--hp', hp.toFixed(4));
          // The text only starts to leave once most of the hero is gone — on a
          // phone the title sits in its lower half and is still being read.
          hero.style.setProperty('--hq', clamp((hp - 0.3) / 0.7).toFixed(4));
        }
      }

      const doc = document.documentElement;
      const max = doc.scrollHeight - vh;
      progress.current?.style.setProperty('--sp', (max > 0 ? clamp(window.scrollY / max) : 0).toFixed(4));

      if (!cards.length) return;
      // How far the grid has come up the screen: 0 as its top enters at the
      // bottom, 1 once it is a little above the middle.
      const gTop = grid ? grid.getBoundingClientRect().top : 0;
      const q = dealing ? clamp((vh * 0.96 - gTop) / (vh * 0.42)) : 1;
      if (grid) grid.style.setProperty('--deal', q.toFixed(3));
      const lastStart = Math.min(0.1 * (cards.length - 1), 0.36);

      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) return;
        const col = i % 2;
        const row = Math.floor(i / 2);
        const start = Math.min(i * 0.1, 0.36);
        const e = ease(clamp((q - start) / (1 - lastStart)));
        const k = 1 - e;
        // Rolls a few degrees as it passes the middle of the screen.
        const roll = clamp((r.top + r.height / 2 - vh / 2) / vh, -0.7, 0.7) * -7;
        const t = tilt.get(card);
        // Out of one stack in the middle: each column starts pulled inward.
        const dx = (col === 0 ? 1 : -1) * r.width * 0.42 * k;
        const tf =
          `translate3d(${dx.toFixed(1)}px, ${(k * (70 + row * 36)).toFixed(1)}px, ${(k * -300 + (t ? 26 : 0)).toFixed(1)}px) ` +
          `rotateX(${(k * 40 + roll + (t ? t.x : 0)).toFixed(2)}deg) ` +
          `rotateY(${(k * (col ? -30 : 30) + (t ? t.y : 0)).toFixed(2)}deg) ` +
          `rotateZ(${(k * (col ? 8 : -8)).toFixed(2)}deg)`;
        if (last.get(card) !== tf) {
          card.style.transform = tf;
          last.set(card, tf);
        }
        // The foil's rainbow slides as the ticket rolls or turns.
        card.style.setProperty('--foil', clamp(0.5 + roll / 14 + (t ? t.y / 30 : 0)).toFixed(3));
        card.style.opacity = e < 1 ? clamp(0.1 + e * 1.4).toFixed(3) : '';
        if (e >= 1 && !dealt.has(card)) {
          dealt.add(card);
          card.classList.add('is-dealt');
        }
      });
    };
    const ask = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    on(window, 'scroll', ask, { passive: true });
    on(window, 'resize', ask, { passive: true });
    frame();

    if (fine && hero && mode === '3d') {
      on(hero, 'pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        hero.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      });
      on(hero, 'pointerleave', () => {
        hero.style.setProperty('--mx', '0');
        hero.style.setProperty('--my', '0');
      });
    }

    if (fine) {
      for (const card of cards) {
        on(card, 'pointermove', (e) => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          tilt.set(card, { x: (0.5 - py) * 14, y: (px - 0.5) * 16 });
          card.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
          card.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
          card.classList.add('is-tilt');
          ask();
        });
        on(card, 'pointerleave', () => {
          tilt.delete(card);
          card.classList.remove('is-tilt');
          ask();
        });
      }
    }

    return () => {
      offs.forEach((off) => off());
      if (raf) cancelAnimationFrame(raf);
      entered.disconnect();
      for (const el of prepared) el.classList.remove('dz-pre', 'dz-in');
      for (const card of cards) {
        card.style.transform = '';
        card.style.opacity = '';
        card.classList.remove('is-tilt', 'is-dealt');
      }
      delete page.dataset.depth;
    };
  }, [mode]);

  // A thin line of light across the top that fills as the page is read.
  return mode === '3d' ? <div ref={progress} className="dz-progress" aria-hidden="true" /> : null;
}
