// A horizontal row of goods — "Fresh on the shelves", "More from this shop",
// "Others on this shelf". Server component: the tiles are server-rendered and
// the scrolling is the browser's own.
//
// No JavaScript is involved in the scroll at all. A flex track with overflow-x
// and scroll-snap means a swipe on a phone, a trackpad flick, shift+wheel and
// the arrow keys all work before anything has hydrated, and they keep working
// if nothing ever does. (The event feed's rail adds a pair of arrow buttons on
// top of exactly this and has to be a client component for it; a row of goods
// does not earn that, and buying the arrows would cost every bazaar page a
// bundle it currently does not load.) The track is focusable so the arrow keys
// have something to act on, which is what makes it keyboard-reachable at all.
import Link from 'next/link';
import ItemTile from '@/components/ItemTile';
import type { ShopItem } from '@/lib/marketItems';

export interface ItemRailProps {
  /** The row's heading, and the name a screen reader hears for the region. */
  title: string;
  items: ShopItem[];
  /** Where "see all of these" goes, when there is such a page. */
  href?: string;
  hrefLabel?: string;
  /** One line saying what put these items together, when that is not obvious. */
  note?: string;
}

/**
 * Three is the floor, and it is a rule about honesty rather than about layout.
 *
 * A rail is a claim: it says "here is a SET of things that go together". Two
 * tiles under "Best rated" is not a set, it is the only two items anybody has
 * reviewed, dressed up as a selection — and on a wide screen it renders as a
 * scroll row with a hole in it, which reads as something failing to load. The
 * page that asked for the rail gets nothing back and lays out whatever it has
 * without it.
 */
const MIN_ITEMS = 3;

export default function ItemRail({ title, items, href, hrefLabel, note }: ItemRailProps) {
  if (items.length < MIN_ITEMS) return null;

  return (
    <section className="bz-rail">
      <div className="bz-rail-head">
        <h2 className="bz-rail-title">{title}</h2>
        {href && (
          <Link className="bz-rail-link" href={href}>
            {hrefLabel ?? 'See all'} &rarr;
          </Link>
        )}
      </div>
      {note && (
        <p className="muted small" style={{ margin: '0 0 10px' }}>
          {note}
        </p>
      )}
      {/* role="region" + a name, because a scrollable box that a keyboard can
          land in has to announce what it is when it is landed in. */}
      <div className="bz-rail-track" role="region" aria-label={title} tabIndex={0}>
        {items.map((item) => (
          <ItemTile key={`${item.shop.id}:${item.tier.tierKey}`} item={item} compact />
        ))}
      </div>
    </section>
  );
}
