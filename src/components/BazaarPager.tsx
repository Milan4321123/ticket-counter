'use client';

// "Top picks from the bazaar" on the homepage: goods in a grid three rows
// high that pages sideways — six on a phone screen (two columns of three),
// more on a wide one; a swipe (or the arrows) slides the next set in. The
// columns snap, so a swipe always lands on whole tiles.
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { useInfiniteLoop, usePeekDim, useSwipeNudge } from './usePeekDim';

export interface PagerItem {
  key: string;
  href: string;
  image: string | null;
  name: string;
  shop: string;
  price: string;
  /** "€9.45 with Subscribe & save", or ''. */
  subscribe: string;
  example: boolean;
}

export default function BazaarPager({ title, kicker, items, moreHref, moreLabel }: {
  title: string;
  kicker: string;
  items: PagerItem[];
  moreHref: string;
  moreLabel: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false, page: 0, pages: 1 });
  // Endless: whole columns only (three tiles each), laid out three times over;
  // the row keeps the visitor in the middle copy (useInfiniteLoop).
  const loop = items.length >= 6;
  const base = loop ? items.slice(0, Math.floor(items.length / 3) * 3) : items;

  /** Width of one column of tiles, how many make a page, and one copy's width. */
  const geometry = useCallback(() => {
    const el = track.current;
    if (!el || el.children.length === 0) return null;
    const a = el.children[0] as HTMLElement;
    const b = el.children[3] as HTMLElement | undefined;
    const step = b ? b.offsetLeft - a.offsetLeft : a.offsetWidth;
    const cols = Math.max(1, Math.floor(parseFloat(getComputedStyle(el).getPropertyValue('--bp-cols')) || 2));
    const totalCols = Math.ceil(base.length / 3);
    return { step, cols, copy: totalCols * step, pages: Math.max(1, Math.ceil(totalCols / cols)) };
  }, [base.length]);

  const measure = useCallback(() => {
    const el = track.current;
    const g = geometry();
    if (!el || !g) return;
    const x = loop ? ((el.scrollLeft % g.copy) + g.copy) % g.copy : el.scrollLeft;
    setEdge({
      start: !loop && el.scrollLeft < 8,
      end: !loop && el.scrollLeft + el.clientWidth >= el.scrollWidth - 8,
      page: Math.min(g.pages - 1, Math.round(x / (g.step * g.cols)) % g.pages),
      pages: g.pages,
    });
  }, [geometry, loop]);

  // Tiles swiping in from the edge dim and grow, like the event cards above.
  useInfiniteLoop(track, loop ? base.length : 0, 0);
  usePeekDim(track, measure);
  useSwipeNudge(track, 80);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    const g = geometry();
    if (el && g) el.scrollBy({ left: dir * g.step * g.cols, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <section className="section bp">
      <div className="container">
        <div className="bp-head">
          <div>
            <p className="feed-kicker">{kicker}</p>
            <h2 className="feed-section-title">{title}</h2>
          </div>
          <div className="bp-nav">
            <Link href={moreHref} className="bp-more">
              {moreLabel}
            </Link>
            <button type="button" className="bp-arrow" aria-label="Previous" disabled={edge.start} onClick={() => page(-1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 5-7 7 7 7" />
              </svg>
            </button>
            <button type="button" className="bp-arrow" aria-label="Next" disabled={edge.end} onClick={() => page(1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="bp-track" ref={track} role="region" aria-label={title} tabIndex={0}>
          {(loop ? [0, 1, 2] : [0]).flatMap((copy) =>
            base.map((it) => (
            <Link
              key={`${copy}-${it.key}`}
              href={it.href}
              className="bp-tile"
              aria-hidden={loop && copy !== 1 ? true : undefined}
              tabIndex={loop && copy !== 1 ? -1 : undefined}
            >
              <span className="bp-photo">
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" loading="lazy" draggable={false} />
                ) : (
                  <span className="bp-blank">{it.name.charAt(0)}</span>
                )}
                <span className="bp-price">{it.price}</span>
                {it.example ? <span className="bp-example">Example</span> : null}
              </span>
              <span className="bp-name">{it.name}</span>
              <span className="bp-shop">{it.shop}</span>
              {it.subscribe ? <span className="bp-sub">↻ {it.subscribe}</span> : null}
            </Link>
            ))
          )}
        </div>
        {edge.pages > 1 && (
          <div className="bp-dots" aria-hidden="true">
            {Array.from({ length: edge.pages }, (_, k) => (
              <span key={k} className={k === edge.page ? 'bp-dot-on' : undefined} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
