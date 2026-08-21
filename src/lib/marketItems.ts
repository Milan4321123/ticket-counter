// Server-only: every sellable GOOD in the bazaar, flattened out of its shop.
//
// /market browses shop-first — shelves of shops, open one, then see what it
// sells. That is how a market square works and not at all how people shop
// online: they look for a THING ("sel roti", "timur", "dhaka topi") across
// every seller at once. /market/items is that view, and this is what it reads.
//
// Two jobs live here rather than in the page, and both for the same reason —
// the page is JSX and cannot be measured or tested without a renderer:
//
//   1. The read. It touches every published shop at once, so it must cost the
//      SAME number of statements whether the bazaar holds one shop or four
//      hundred. It does: four, always — see listShopItems().
//   2. The filtering and sorting, as pure functions over the rows already in
//      memory. No second trip to the database narrows a search, so a query
//      costs exactly what an unfiltered page costs.
import { categoryLabel } from './categories';
import { readListingName } from './exampleShop';
import { listPublishedEvents, tierPhoto } from './events';
import type { EventMediaRow, EventRow, EventTierRow } from './events';
import { loadFeedSnapshot } from './feedSnapshot';
import { ticketState, tierBadge, visibleTiers } from './ticketState';
import type { TierBadge } from './ticketState';

/** One thing one shop sells, with everything a tile needs already resolved. */
export interface ShopItem {
  shop: EventRow;
  tier: EventTierRow;
  /** This item's own picture, or null — already guarded against a dead id. */
  photo: EventMediaRow | null;
  /** The shop's name with the "(example shop)" mark taken off. */
  shopName: string;
  /** True when the shop is one the site publishes itself. See lib/exampleShop. */
  isExample: boolean;
  /** The shelf the SHOP sits on; '' when its seller picked none. */
  categoryKey: string;
  /** That shelf's label, or '' — never a raw key on a public tile. */
  categoryName: string;
  /**
   * The pill for this row, from the same tierBadge() the shop's own page and
   * the item page call. A grid that decided availability for itself is exactly
   * how "Available" comes to sit next to a page saying "Sold out".
   */
  badge: TierBadge;
  /** Whether a buyer could complete a purchase of this row right now. */
  buyable: boolean;
  /** The item's own page, which already renders all of this properly. */
  href: string;
  /**
   * Everything the search box looks in, lower-cased once at read time.
   *
   * Folded here rather than per keystroke-worth-of-request so a search over a
   * few thousand items is one pass of indexOf per token, and so there is one
   * answer to "what does search actually cover" instead of one per call site.
   */
  haystack: string;
}

/**
 * Every item on sale in the bazaar, ordered for browsing. FOUR statements,
 * whatever the size of the bazaar:
 *
 *   1  listPublishedEvents()  — the shops
 *   2  event_tiers            — every shop's items, in one IN (...)
 *   3  event_media            — every shop's photos, in one IN (...)
 *   4  order_items x orders   — what is already reserved, grouped
 *
 * (2–4 are loadFeedSnapshot, the same one-shot read the homepage feed and
 * /market already use. Reusing it means this page cannot drift from the tiles
 * beside it, and it is why nothing below ever calls a per-event reader: one
 * getAvailability() inside this loop would put the N+1 straight back.)
 *
 * Above ~500 shops the IN-lists are chunked (see lib/sqlIn), so the count then
 * grows one statement per 500 shops per table rather than per shop.
 *
 * Only what a shopper can actually be sold is here: published listings only
 * (listPublishedEvents), shops only (this is the goods view — an event's
 * ticket types are not merchandise and would swamp the grid every festival
 * season), and visible tiers only (a hidden row is off the seller's own page,
 * so it must not be reachable from a bazaar-wide one).
 */
export function listShopItems(): ShopItem[] {
  const shops = listPublishedEvents().filter((e) => e.kind === 'shop');
  const snapshot = loadFeedSnapshot(shops);

  const items: ShopItem[] = [];
  // The shop's position in listPublishedEvents order — a sort key below, kept
  // here so the sort never has to search the array to find it.
  const shopRank = new Map<string, number>();

  shops.forEach((shop, rank) => {
    shopRank.set(shop.id, rank);
    const tiers = snapshot.tiers.get(shop.id) ?? [];
    const photos = snapshot.photos.get(shop.id) ?? [];
    // getAvailabilityBulk keys an entry for every event it was handed, and it
    // was handed exactly these — so this is unreachable. It is a `continue`
    // rather than a `?? getAvailability(shop.id)` fallback on purpose: that
    // fallback is a per-shop query, which is the one thing this whole module
    // exists to avoid, and it would hide the bug instead of dropping a tile.
    const availability = snapshot.availability.get(shop.id);
    if (!availability) return;

    const state = ticketState(shop, tiers, availability);
    const { name: shopName, isExample } = readListingName(shop.name);
    const categoryKey = shop.category;
    const categoryName = categoryLabel(categoryKey);

    for (const tier of visibleTiers(tiers)) {
      const remaining = Math.max(0, availability.tiers[tier.tierKey]?.remaining ?? 0);
      items.push({
        shop,
        tier,
        photo: tierPhoto(tier, photos),
        shopName,
        isExample,
        categoryKey,
        categoryName,
        badge: tierBadge(state, tier, remaining, availability.showRemaining),
        // The SAME three conditions the item page and the shop's own card use,
        // in the same order: the listing's state, this row's status, its stock.
        buyable: state.buyable && tier.status === 'on-sale' && remaining > 0,
        href: `/e/${shop.slug}/item/${encodeURIComponent(tier.tierKey)}`,
        haystack: fold(
          [
            tier.name,
            tier.description,
            tier.details,
            // The STRIPPED shop name: with the mark left in, a search for
            // "shop" would return every example listing on the site and
            // nothing else, which is the opposite of helpful.
            shopName,
            shop.city,
          ].join(' \n ')
        ),
      });
    }
  });

  // Stable sort over the push order, which is already shop-by-shop and, within
  // a shop, the seller's own arrangement of their items. So the three keys
  // below are the whole order and nothing is left to chance:
  //
  //   1. Buyable first. A grid of goods is a list of things you can have, and
  //      "Sold out" and "Coming soon" belong under that, not scattered through
  //      it. Nothing is hidden — it moves.
  //   2. Real sellers before example shops. The examples are the site's own
  //      invention, published so a seller can see their own shop before they
  //      build it, and while the bazaar is young they can easily outnumber the
  //      real ones. A visitor who came to buy should meet somebody who can
  //      actually sell to them first.
  //   3. The shops in feed order (newest first, for undated listings), and
  //      each seller's own order within their shop.
  //
  // Deliberately NOT relevance: nothing here scores a match, and a search
  // filters this list rather than reordering it. The page says exactly that
  // rather than letting the order imply a ranking that does not exist.
  return items.sort(
    (a, b) =>
      Number(b.buyable) - Number(a.buyable) ||
      Number(a.isExample) - Number(b.isExample) ||
      (shopRank.get(a.shop.id) ?? 0) - (shopRank.get(b.shop.id) ?? 0)
  );
}

/** What the sort above is, in one sentence a visitor can read on the page. */
export const SORT_EXPLAINER =
  'In stock first, then real sellers before example shops, newest shops first — not a relevance ranking.';

/**
 * How both sides of the search are spelled before they are compared.
 *
 * Case-folding only, plus collapsing runs of whitespace. Nothing clever: no
 * stemming, no accent folding, no synonyms. Every one of those would find
 * matches a visitor cannot see the reason for, and the page would then be
 * claiming an understanding of Nepali food words that this does not have.
 */
function fold(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The search terms in a raw ?q=, or [] when there is nothing to search for. */
export function queryTerms(q: string): string[] {
  return fold(q).split(' ').filter(Boolean);
}

/**
 * The items matching every term — "momo berlin" means momo AND Berlin, which
 * is what a two-word search means to the person typing it. A term matches
 * anywhere in the item's name, its short line, its longer write-up, the shop's
 * name or the shop's town; the page says so in as many words.
 */
export function searchShopItems(items: ShopItem[], terms: string[]): ShopItem[] {
  if (terms.length === 0) return items;
  return items.filter((item) => terms.every((t) => item.haystack.includes(t)));
}

/** How many of these items sit on each shelf, for the filter's own counts. */
export function countByCategory(items: ShopItem[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) {
    if (!item.categoryKey) continue;
    out.set(item.categoryKey, (out.get(item.categoryKey) ?? 0) + 1);
  }
  return out;
}
