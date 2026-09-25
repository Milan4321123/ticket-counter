'use client';

// The shops on the homepage: a row of shop cards — cover, name, city, how many
// goods — that swipes with the same dim-at-the-edge motion as the event cards
// and the bazaar grid (usePeekDim).
import Link from 'next/link';
import { useRef } from 'react';
import { useInfiniteLoop, usePeekDim, useSwipeNudge } from './usePeekDim';

export interface ShopCardData {
  id: string;
  href: string;
  image: string | null;
  name: string;
  place: string;
  items: number;
  example: boolean;
}

export default function ShopRail({ kicker, title, shops, moreHref, moreLabel, itemsLabel, startAt = 0 }: {
  kicker: string;
  title: string;
  shops: ShopCardData[];
  moreHref: string;
  moreLabel: string;
  /** "{n} items" in the page's language. */
  itemsLabel: string;
  /** Which card the row opens on (the middle, so it swipes both ways). */
  startAt?: number;
}) {
  const track = useRef<HTMLDivElement>(null);
  // Endless: the cards are laid out three times (below) and the row keeps
  // the visitor in the middle copy.
  const loop = shops.length >= 2;
  useInfiniteLoop(track, loop ? shops.length : 0, startAt);
  usePeekDim(track);
  useSwipeNudge(track);

  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    const card = el?.children[0] as HTMLElement | undefined;
    if (el && card) el.scrollBy({ left: dir * (card.offsetWidth + 12) * 2, behavior: 'smooth' });
  };

  if (shops.length === 0) return null;

  return (
    <section className="section sr">
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
            <button type="button" className="bp-arrow" aria-label="Previous" onClick={() => scroll(-1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 5-7 7 7 7" />
              </svg>
            </button>
            <button type="button" className="bp-arrow" aria-label="Next" onClick={() => scroll(1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="sr-track" ref={track} role="region" aria-label={title} tabIndex={0}>
        {(loop ? [0, 1, 2] : [0]).flatMap((copy) =>
          shops.map((s) => (
          <Link
            key={`${copy}-${s.id}`}
            href={s.href}
            className="sr-card"
            aria-hidden={loop && copy !== 1 ? true : undefined}
            tabIndex={loop && copy !== 1 ? -1 : undefined}
          >
            <span className="sr-cover">
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt="" loading="lazy" draggable={false} />
              ) : (
                <span className="sr-blank">{s.name.charAt(0)}</span>
              )}
              {s.example ? <span className="bp-example">Example</span> : null}
            </span>
            <span className="sr-body">
              <span className="sr-name">{s.name}</span>
              <span className="sr-meta">
                {[s.place, itemsLabel.replace('{n}', String(s.items))].filter(Boolean).join(' · ')}
              </span>
            </span>
          </Link>
          ))
        )}
      </div>
    </section>
  );
}
