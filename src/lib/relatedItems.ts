// Server-only: the three "you might also want" blocks under an item — "More
// from this shop", "Others on this shelf", and "Often bought together".
//
// Two of the three never touch the database, on purpose. An item page that
// wants related goods already holds the whole bazaar in memory: listShopItems()
// reads every published shop, its items, its photos and what is left of each in
// four statements whatever the size of the market (see lib/marketItems). Asking
// separately for "the other things this shop sells" would put a per-page query
// back onto the one module built to avoid exactly that, and it would read at a
// different instant — so a rail could offer an item as available underneath a
// grid that had just called it sold out. They are therefore pure functions over
// the array the caller is already holding: the same rows, the same stock, the
// same moment, and testable without a database at all.
//
// The third one cannot be anything but a read. Nothing in the shape of a shop
// records which goods people put in a basket together; only the orders do. It
// is one statement, and because it is the only sentence on the page that makes
// a claim about OTHER PEOPLE'S behaviour, it is also the one with a floor under
// it. See boughtTogether.
import { getDb } from './db';
import type { ShopItem } from './marketItems';

/**
 * How many items a rail may carry.
 *
 * Twelve rather than three or four: the rails scroll sideways, so one more tile
 * costs a flick of the thumb and a few hundred bytes rather than half a phone
 * screen, and a shop with fifteen kinds of achar deserves better than being
 * summarised as three of them. There is a cap at all because "everything this
 * seller stocks" is a page-weight decision on a big shop, not a browsing
 * feature — past a dozen nobody is browsing, they are scrolling.
 */
const MAX_RELATED = 12;

/** Clamp a caller's `max` to something an array slice and a SQL LIMIT accept. */
function cap(max: number): number {
  return Math.max(0, Math.floor(max));
}

/**
 * Two rows are the same item when they are the same tier of the same shop.
 *
 * Compared on the pair rather than on `href`, because href is a string built
 * out of the two and identity should not depend on how it happens to be
 * spelled or escaped. Tier keys are unique only WITHIN a shop, so the shop has
 * to be half of the comparison — two sellers both keying an item "momo" is not
 * unusual, it is the norm.
 */
function isSameItem(a: ShopItem, b: ShopItem): boolean {
  return a.shop.id === b.shop.id && a.tier.tierKey === b.tier.tierKey;
}

/**
 * The order every rail here is in: things a shopper can actually buy today
 * first, then real sellers before the site's own example shops, and otherwise
 * exactly the order the caller handed in.
 *
 * These are the first two keys listShopItems() sorts the whole bazaar by, and
 * they are here for the reasons written there — a row of goods is a row of
 * things you can have, and a visitor who came to buy should meet somebody who
 * can actually sell to them before they meet a shop the site invented to show
 * sellers what a shop looks like.
 *
 * They are re-applied rather than inherited because a rail is built from
 * whichever array the page is holding, and that array may already have been
 * sorted by price or rating for the grid above. Inheriting would mean the
 * rails silently stopped keeping their promise the day somebody added a sort
 * control to the page. Restating the keys keeps it true either way; the sort is
 * stable, so items that tie keep the caller's own sequence and no third,
 * accidental ordering creeps in.
 *
 * Nothing is dropped for being sold out. A shopper looking at one jar of pickle
 * still wants to know the same seller makes gundruk, even in the week it has
 * run out — it moves down the rail, and its own tile says so.
 */
function railOrder(items: ShopItem[]): ShopItem[] {
  return items
    .slice()
    .sort((a, b) => Number(b.buyable) - Number(a.buyable) || Number(a.isExample) - Number(b.isExample));
}

/**
 * The rest of this seller's shelf — every other item the same shop has on
 * offer, the item itself excluded.
 *
 * Excluding it is not tidiness. A rail that opens with the exact tile the
 * visitor is already reading, at a different size and with the same price on
 * it, reads as a second product rather than as a suggestion, and it is the
 * fastest way to make four "related" tiles turn out to be one item three times.
 */
export function moreFromShop(all: ShopItem[], item: ShopItem, max = MAX_RELATED): ShopItem[] {
  const mine = all.filter((other) => other.shop.id === item.shop.id && !isSameItem(other, item));
  return railOrder(mine).slice(0, cap(max));
}

/**
 * The same shelf at OTHER shops — the cross-seller rail, and the only place in
 * the bazaar where a shopper is handed a competitor.
 *
 * That is deliberate: the platform takes no cut and ranks nobody, so there is
 * nothing to protect by hiding the seller down the road who also makes sel
 * roti. Somebody who wants sel roti on Saturday is better served by seeing all
 * of them, and a seller whose shop is filed under a shelf that visitor never
 * opened is better served by appearing on it.
 *
 * This shop's own items are excluded rather than merely demoted, because
 * "More from this shop" is the rail directly above it and the same tile in both
 * would make two rails look like one long one.
 */
export function othersOnShelf(all: ShopItem[], item: ShopItem, max = MAX_RELATED): ShopItem[] {
  // A shop whose seller has picked no shelf carries categoryKey ''. Matching on
  // that would gather up everything else nobody has filed either and put it
  // under a heading claiming these things belong together. They do not — they
  // have nothing in common except an empty column — so an unfiled item simply
  // gets no shelf rail.
  if (!item.categoryKey) return [];
  const neighbours = all.filter(
    (other) => other.categoryKey === item.categoryKey && other.shop.id !== item.shop.id
  );
  return railOrder(neighbours).slice(0, cap(max));
}

/** One other item that keeps turning up in the same baskets as this one. */
export interface TogetherRow {
  /** The other item's tier key, within the same shop. */
  tierKey: string;
  /** How many separate PAID orders held both. Never fewer than two. */
  orders: number;
}

/**
 * What people who bought this item actually bought alongside it, in one
 * statement.
 *
 * The shape of the question: take every paid order of this shop that contains
 * this item, and count the OTHER items in those same orders. `order_items` is
 * joined to itself for that — once as the basket's proof that this item was in
 * it, once for everything else in the basket — through `orders` so the order's
 * status and its shop can be checked. The primary key on (order_id, tier_id)
 * means the first join matches at most one row per order, so nothing fans out
 * and a basket cannot vote twice.
 *
 * Three conditions, each load-bearing:
 *
 *   - `o.status = 'paid'`. A pending or cancelled order is somebody who thought
 *     about it, which is not what the page says happened. Only money that
 *     actually arrived counts as a purchase.
 *   - `o.event_id = ?`. Tier keys are unique only within a listing, so without
 *     this the "momo" of every shop in the bazaar would be pooled into one
 *     number and printed on a page naming a single seller.
 *   - `other.tier_id <> seed.tier_id`. An item is not bought together with
 *     itself; that row would win every time and say nothing.
 *
 * And the floor, which is the point of the whole function:
 *
 *   HAVING COUNT(DISTINCT o.id) >= 2
 *
 * One shared basket is a coincidence. Two people who have never met, buying the
 * same two things on separate days, is the beginning of a pattern; one person
 * who bought a bag of timur and a dhaka topi in the same order is one person
 * having an afternoon. A page that renders the first as "often bought together"
 * is lying to a shopper about how much other people liked something — quietly,
 * plausibly, and hardest of all to notice on a young bazaar where almost every
 * item has exactly one order behind it. So the floor stays even though it means
 * this block shows nothing at all for most items for a long time. Showing
 * nothing is the honest answer to a question the data cannot yet answer.
 *
 * Ordered by how many baskets, then by tier key so that ties come out the same
 * way on every render rather than in whatever order the planner felt like.
 *
 * Raw tier keys come back, not items: whether each one is still visible, still
 * on sale and still worth putting a price beside is the page's to decide from
 * the rows it already holds, and it must — this counts history, and an item
 * that was popular last winter may be withdrawn today.
 */
export function boughtTogether(eventId: string, tierKey: string, max = 4): TogetherRow[] {
  return getDb()
    .prepare(
      // order_items.tier_id holds the tier KEY, not a row id from event_tiers —
      // an old column name the rest of lib/orders.ts joins on the same way.
      `SELECT other.tier_id AS tierKey, COUNT(DISTINCT o.id) AS orders
         FROM order_items seed
         JOIN orders o ON o.id = seed.order_id
         JOIN order_items other ON other.order_id = seed.order_id AND other.tier_id <> seed.tier_id
        WHERE o.status = 'paid' AND o.event_id = ? AND seed.tier_id = ?
        GROUP BY other.tier_id
       HAVING COUNT(DISTINCT o.id) >= 2
        ORDER BY orders DESC, other.tier_id ASC
        LIMIT ?`
    )
    .all(eventId, tierKey, cap(max)) as TogetherRow[];
}
