'use client';

import { useEffect, useRef, useState } from 'react';

export interface EventSectionLink {
  /** Matches the id on the corresponding <section> further down the page. */
  id: string;
  label: string;
}

interface Props {
  sections: EventSectionLink[];
}

/**
 * The jump bar under the hero — one button per section this event actually has.
 *
 * Deliberately NOT tabs: every section stays on the page. Someone deciding
 * whether to spend money should still meet the photos and the FAQ by scrolling
 * even if they never press a button, and search engines and link previews read
 * the whole page. This only saves the scroll for people who know what they came
 * for.
 *
 * The buttons are real anchors, so they work before hydration and with JS off;
 * everything below is the polish on top (highlighting, and keeping the current
 * button in view on a phone).
 */
export default function SectionNav({ sections }: Props) {
  const [active, setActive] = useState('');
  const navRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const page = nav.closest<HTMLElement>('.event-page');
    const header = document.querySelector('.site-header');
    const ids = sections.map((s) => s.id);
    const targets = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    const onScreen = new Map<string, boolean>();
    let io: IntersectionObserver | null = null;
    let armedFor = NaN;

    const measure = () => {
      // The header is not a fixed height — below ~450px its sign-in button wraps
      // onto a second line and it grows by ~22px. Publishing the real height
      // keeps both the bar's sticky offset and the sections' scroll-margin
      // honest; the CSS default is only what applies before this first runs.
      // Unrounded on purpose: the header is 86.52px on a phone, and rounding up
      // opens a half-pixel slit between the two bars for the page to slide
      // through. Flush to the fraction, and the bars read as one.
      if (page && header) {
        page.style.setProperty('--event-nav-top', `${header.getBoundingClientRect().height}px`);
      }

      // A reading line just under the bar. The observed region runs from the top
      // of the screen down to it, so a section "counts" from the moment its
      // heading crosses that line — which is also exactly when the section
      // above it stops being the one you are reading.
      const covered = Math.round(parseFloat(getComputedStyle(nav).top) || 0) + nav.offsetHeight;
      const below = Math.max(0, Math.round(window.innerHeight - covered - 48));

      // Hiding the address bar on a phone counts as a resize on every change of
      // scroll direction, and rebuilding the observer each time would throw away
      // what it already knows for nothing.
      if (io && armedFor === below) return;
      armedFor = below;

      io?.disconnect();
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) onScreen.set(entry.target.id, entry.isIntersecting);
          // The LAST one past the line, not the first: the page bottom arrives
          // before the final section can climb to the top of the screen, so
          // "topmost" would leave the last button unlit however far you scroll
          // — including right after someone pressed it.
          for (let i = ids.length - 1; i >= 0; i--) {
            if (onScreen.get(ids[i])) {
              setActive(ids[i]);
              return;
            }
          }
        },
        { rootMargin: `0px 0px -${below}px 0px`, threshold: 0 }
      );
      for (const el of targets) io.observe(el);
    };

    measure();
    // The header grows a row when its button wraps; the reading line moves with
    // the window's height. Both change where the line belongs.
    const ro = new ResizeObserver(measure);
    if (header) ro.observe(header);
    window.addEventListener('resize', measure);

    return () => {
      io?.disconnect();
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sections]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || !active) return;
    const btn = row.querySelector<HTMLElement>(`.event-nav-btn[href="#${active}"]`);
    if (!btn) return;
    // On a phone the row is wider than the screen, so the highlighted button can
    // sit off it. Scrolling the row itself — never scrollIntoView, which would
    // drag the page along with it.
    row.scrollTo({ left: Math.max(0, btn.offsetLeft - (row.clientWidth - btn.offsetWidth) / 2) });
  }, [active]);

  return (
    <nav className="event-nav no-print" aria-label="On this page" ref={navRef}>
      <div className="container">
        <ul className="event-nav-row" ref={rowRef}>
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={`event-nav-btn${active === section.id ? ' is-active' : ''}`}
                // "location" rather than "true": this marks where on the page
                // the reader is, not a chosen item.
                aria-current={active === section.id ? 'location' : undefined}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
