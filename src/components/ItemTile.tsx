// One good, as a tile — the unit every grid and every rail in the bazaar is
// built out of. Server component: everything it prints was resolved once, for
// the whole page, by listShopItems().
//
// It began life inside /market/items as a local component and moved here when
// the department pages, the rails and the saved page all needed the same thing.
// The move is the point: a tile that exists twice is a tile that will one day
// say "Available" on one page and "Sold out" on another, and — more seriously —
// name the seller on one page and not on the other.
//
// Denser than the card it grew out of. A market stall is read price-first: the
// figure is the biggest thing in the body, the name sits under it, and the
// picture does the rest. Nothing that is not a fact about THIS row is on it.
import { MixedScript } from '@/components/Np';
import Link from 'next/link';
import Stars, { ratingLabel } from '@/components/Stars';
import { mediaUrl } from '@/lib/events';
import type { ShopItem } from '@/lib/marketItems';
import { formatMoney, subscribeDiscountCents } from '@/lib/money';
import { vocabFor } from '@/lib/vocab';

export interface ItemTileProps {
  item: ShopItem;
  /**
   * The narrow version, for rails and sidebars: the shelf badge and the
   * sentence explaining what an example shop is are dropped, because a rail is
   * already under a heading that says which shelf it is and its tiles are half
   * the width of a grid's. Nothing a buyer must not miss is ever dropped — the
   * price, the seller, the availability and the Example shop mark are on both.
   */
  compact?: boolean;
}

export default function ItemTile({ item, compact = false }: ItemTileProps) {
  const v = vocabFor('shop');
  const { tier } = item;
  const priceLabel = item.priceCents === 0 ? 'Free' : formatMoney(item.priceCents, item.currency);

  /**
   * The stock line, and the one rule behind it: this tile never publishes a
   * number the seller chose not to publish.
   *
   * tierBadge() is the single thing on the site that decides what a row's
   * availability may SAY, and it prints "Only N left" exactly when the seller
   * left the stock counter switched on and the row is genuinely down to its
   * last few. So the counter's setting is read back off the badge rather than
   * from a second field of its own: a field could disagree with the badge on
   * the same tile, and this cannot.
   *
   * Five, not the badge's own twenty-five, because on a dense grid the line is
   * a nudge and a nudge about twenty-four jars of achar is noise.
   */
  const countIsPublic = item.badge.label.startsWith('Only ');
  const low = countIsPublic && !item.unlimited && item.remaining > 0 && item.remaining <= 5;
  const stock = !item.buyable ? null : low ? `Only ${item.remaining} left` : 'In stock';

  /**
   * Availability appears ONCE per tile, and which half of the tile it lands in
   * depends on what it says.
   *
   * A row a shopper can have gets the green line beside its price, the way a
   * shop shelf does — that is the dense reading order, and a green "Available"
   * pill over the picture as well would be the same fact twice in two different
   * words. A row they cannot have keeps the pill: "Sold out", "Coming soon" and
   * "Sales closed" have to be visible before the price is, or the tile spends
   * the shopper's attention on a thing that is not for sale.
   */
  const showBadge = !item.buyable;

  // The whole tile is one link with a spoken name of its own. Without it a
  // screen reader announces a picture, a price, five graphics, a name and two
  // small lines as unlabelled fragments of a single link — and the seller, who
  // must be named wherever the price is, is one of those fragments.
  const spoken = [
    tier.name,
    priceLabel,
    item.rating ? ratingLabel(item.rating) : '',
    `${item.isExample ? 'an example shop by' : 'sold by'} ${item.shopName}${
      item.city ? `, ${item.city}` : ''
    }`,
    stock ?? item.badge.label,
  ]
    .filter(Boolean)
    .join(' — ');

  const subscribePct = item.shop.kind === 'shop' && !item.shop.isDemo ? item.shop.subscribePct || 0 : 0;
  return (
    <Link href={item.href} className="bz-tile" aria-label={spoken}>
      <div className="bz-tile-media">
        {item.photo ? (
          /* The 'card' variant — the same 800x1000 render the shop's own grid
             and the item page serve, so a cross-shop grid costs no new
             derivative on disk and the picture is already cached by the time a
             shopper taps through. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="bz-tile-photo"
            src={mediaUrl(item.photo.id, 'card', null)}
            alt={`${tier.name} — ${item.shopName}`}
            loading="lazy"
          />
        ) : (
          /* On a SHOP grid a missing photo cannot be left as a shapeless card
             the way it is on an event page: the tiles beside it are pictures,
             and one that simply starts with text reads as a broken image. The
             item's initial on the accent wash — the same treatment the item
             page gives a photo-less row — reads as a decision instead. */
          <div className="bz-tile-blank" aria-hidden="true">
            <span>{tier.name.trim().charAt(0).toUpperCase() || v.Unit.charAt(0)}</span>
          </div>
        )}

        <div className="bz-tile-badges">
          {showBadge && <span className={item.badge.className}>{item.badge.label}</span>}
          {/* The example mark, as loud as the availability beside it. The
              shop's listing name carries "(example shop)", but on this tile the
              name is a small line under the price — a visitor scanning forty
              pictures of food would read the price, the item name, and nothing
              else. A visitor must never mistake an invented seller for a real
              one, so the fact gets a pill of its own, and the sentence under
              the tile says what it means. */}
          {item.isExample && <span className="badge badge-amber">Example shop</span>}
          {!compact && item.categoryName && (
            <span className="badge badge-accent">{item.categoryName}</span>
          )}
        </div>
      </div>

      <div className="bz-tile-body">
        {/* Price first and biggest. On a market stall it is the first thing
            written on the card, and a shopper comparing twelve tiles is
            comparing prices before they are reading names. */}
        <div className="bz-tile-price">{priceLabel}</div>
        {/* Subscribe & save (lib/subscriptions): the repeat price, right under
            the one-off price it is compared with. */}
        {subscribePct > 0 && item.priceCents > 0 && (
          <div className="bz-tile-sub">
            <span aria-hidden="true">↻</span>{' '}
            {formatMoney(item.priceCents - subscribeDiscountCents(subscribePct, item.priceCents), item.currency)} with
            Subscribe &amp; save
          </div>
        )}
        {/* Same sentence the shop's own card prints: the price above is per
            bundle, not per item, and a shopper comparing tiles must know that
            before they compare anything. Hence directly under the figure. */}
        {tier.seatsPerUnit > 1 && (
          <div className="bz-tile-unit">
            Includes {tier.seatsPerUnit} {v.units}.
          </div>
        )}
        <div className="bz-tile-name">
          {/* Devanagari inside a seller's own name for a thing, marked as
              Nepali so a screen reader does not read it as English. */}
          <MixedScript>{tier.name}</MixedScript>
        </div>

        {/* Nothing at all until somebody who bought this has said something —
            see Stars. An unrated item leaves a gap rather than five grey
            outlines that read as a bad score. */}
        <Stars rating={item.rating} size="sm" />

        {stock && <div className={low ? 'bz-tile-low' : 'bz-tile-stock'}>{stock}</div>}

        {/* Whose it is — the disclosed seller, named wherever a price is shown.
            Not decoration: a buyer page that does not name the seller is what
            turns the whole order value into this platform's turnover. */}
        <div className="bz-tile-seller">
          {item.isExample ? 'An example shop by ' : 'Sold by '}
          <strong>{item.shopName}</strong>
          {item.city ? ` · ${item.city}` : ''}
        </div>
        {item.isExample && !compact && (
          <div className="bz-tile-seller">
            Published by us to show sellers what their own shop could look like — there is nothing
            here to collect, and checkout will refuse an order.
          </div>
        )}
      </div>
    </Link>
  );
}
