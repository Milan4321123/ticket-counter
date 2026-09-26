// Server-only: every sellable GOOD in the bazaar, flattened out of its shop.
//
// /market opens on the goods themselves — every item every seller has on
// sale, searchable and filterable — because that is how people shop online:
// they look for a THING ("sel roti", "timur", "dhaka topi") across every
// seller at once. This is what that page reads.
//
// Two jobs live here rather than in the page, and both for the same reason —
// the page is JSX and cannot be measured or tested without a renderer:
//
//   1. The read. It touches every published shop at once, so it must cost the
//      SAME number of statements whether the bazaar holds one shop or four
//      hundred. It does: five, always — see listShopItems().
//   2. The filtering, sorting and faceting, as pure functions over the rows
//      already in memory. No second trip to the database narrows a search, so
//      a query with four filters on it costs exactly what the bare page costs.
import { relatedWords } from './bazaarWords';
import { SHOP_CATEGORIES, categoryLabel } from './categories';
import { readListingName } from './exampleShop';
import { getDb } from './db';
import { listPublishedEvents, tierHasItemPage, tierPhoto } from './events';
import type { EventMediaRow, EventRow, EventTierRow } from './events';
import { loadFeedSnapshot } from './feedSnapshot';
import { ratingsForItems } from './reviews';
import type { RatingSummary } from './reviews';
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
  /**
   * What it costs, in the smallest unit of `currency`. Lifted out of `tier` so
   * a sort and a price band never have to know that a tier is where the number
   * lives — and so the one place that reads it is this one.
   */
  priceCents: number;
  /**
   * The SHOP's currency, because the shop is who takes the money. Never the
   * platform's, which has none: every order is paid to the seller directly.
   */
  currency: string;
  /** The shop's town, as its seller typed it. '' when they gave none. */
  city: string;
  /** The shop's slug — the stable key a "Seller" facet filters on. */
  shopSlug: string;
  /**
   * Units of this item a buyer could still take, already bounded by the
   * shop's own stock ceiling. 0 when there are none left.
   *
   * A real, finite number even for an uncapped item: getAvailability gives an
   * uncapped tier whatever is left of the SHOP's total, on the grounds that
   * the room is always a ceiling even when the row is not. So nothing here
   * ever prints UNLIMITED_REMAINING, and "Only 3 left" is only ever a count
   * somebody could actually buy.
   */
  remaining: number;
  /**
   * True when the seller set no cap of their own on this row. It does NOT mean
   * endless — see `remaining` — it means the number beside it is the shop's
   * ceiling rather than the seller's decision about this item, which is why a
   * countdown on it would be telling the buyer something the seller never said.
   */
  unlimited: boolean;
  /**
   * Whether this shop's seller publishes counts at all. False hides the
   * NUMBER — "Only 3 left" — and nothing else: the sold-out badge, the filter
   * and the sort all keep working on a count the visitor is simply not shown.
   *
   * Lifted onto the item beside `remaining` on purpose. The two are only ever
   * correct together, and a tile that reached for the count without it would
   * publish a number its seller deliberately switched off.
   */
  showRemaining: boolean;
  /**
   * When the SHOP was created, in ms. The "newest" sort's key.
   *
   * The shop's date and not the item's: event_tiers carries no created_at, and
   * inventing one from the row's sort order would put a seller's rearranged
   * list at the top of the bazaar every time they dragged something. A new
   * shop is genuinely news; a shop tidying its shelves is not.
   */
  listedAt: number;
  /**
   * What buyers scored this item, or null when nobody has reviewed it.
   *
   * null, never a zero — an unrated item has no score, and a 0.0 out of 5 is a
   * verdict nobody delivered. Every surface that shows stars renders nothing
   * at all for this being null.
   */
  rating: RatingSummary | null;
  /** The item's own page, which already renders all of this properly. */
  href: string;
  /**
   * An event's ticket type rather than a shop's goods (the "Event tickets"
   * shelf): `shopName` is then the EVENT, `seller` its organizer — the one
   * the buyer pays, named on the tile — and `when` its date as written.
   */
  ticket?: { when: string; seller: string };
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
 * Every item on sale in the bazaar, ordered for browsing. FIVE statements,
 * whatever the size of the bazaar:
 *
 *   1  listPublishedEvents()  — the shops
 *   2  event_tiers            — every shop's items, in one IN (...)
 *   3  event_media            — every shop's photos, in one IN (...)
 *   4  order_items x orders   — what is already reserved, grouped
 *   5  item_reviews           — every shop's ratings, grouped (lib/reviews)
 *
 * (2–4 are loadFeedSnapshot, the same one-shot read the homepage feed and
 * /market already use. Reusing it means this page cannot drift from the tiles
 * beside it, and it is why nothing below ever calls a per-event reader: one
 * getAvailability() inside this loop would put the N+1 straight back. 5 is the
 * same shape again — ratingsForItems takes every shop id at once and returns
 * the aggregate keyed by item, because ratingForItem() per tile is the exact
 * N+1 in a new costume, and a bazaar of 400 shops would pay it 2,000 times.)
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
/** The shelf every event's tickets sit on in the bazaar — not a shop category. */
export const TICKETS_SHELF = { key: 'tickets', label: 'Event tickets', np: 'टिकट' } as const;

/** Today in Berlin, YYYY-MM-DD — an event dated before it is over. */
function todayBerlin(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
}

/** Organizer names for the given ids, in one statement. */
function organizerNames(ids: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids)];
  if (!unique.length) return out;
  const rows = getDb()
    .prepare(`SELECT id, name FROM organizers WHERE id IN (${unique.map(() => '?').join(',')})`)
    .all(...unique) as { id: string; name: string }[];
  for (const r of rows) out.set(r.id, r.name);
  return out;
}

/**
 * `tickets: true` (the bazaar itself): every UPCOMING event's ticket types
 * too, on the "Event tickets" shelf — the bazaar is where everything on the
 * platform can be bought. Everywhere else asks for goods only.
 */
export function listShopItems(opts: { tickets?: boolean } = {}): ShopItem[] {
  const today = todayBerlin();
  const shops = listPublishedEvents().filter(
    (e) => e.kind === 'shop' || (opts.tickets === true && e.kind === 'event' && !(e.eventDate && e.eventDate < today))
  );
  const sellers = organizerNames(shops.filter((e) => e.kind === 'event').map((e) => e.organizerId));
  const snapshot = loadFeedSnapshot(shops);
  // Keyed `${eventId}:${tierKey}`, and holding an entry ONLY for items somebody
  // has actually reviewed — a miss below is the honest answer for the other
  // ninety-nine per cent of a young bazaar, not a gap to fill with a default.
  const ratings = ratingsForItems(shops.map((s) => s.id));

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
    const isEvent = shop.kind === 'event';
    const categoryKey = isEvent ? TICKETS_SHELF.key : shop.category;
    const categoryName = isEvent ? TICKETS_SHELF.label : categoryLabel(categoryKey);
    const ticket = isEvent ? { when: shop.dateDisplay || shop.eventDate || '', seller: sellers.get(shop.organizerId) ?? '' } : undefined;
    // Once per shop rather than once per item: every row of one shop was
    // listed the moment the shop was, and Date.parse is not free.
    const listedAt = listedAtMs(shop.createdAt);

    for (const tier of visibleTiers(tiers)) {
      const remaining = Math.max(0, availability.tiers[tier.tierKey]?.remaining ?? 0);
      const ownPhoto = tierPhoto(tier, photos);
      items.push({
        shop,
        tier,
        // A ticket without a picture of its own shows the event's poster.
        photo: ownPhoto ?? (isEvent ? (photos[0] ?? null) : null),
        ticket,
        shopName,
        isExample,
        categoryKey,
        categoryName,
        badge: tierBadge(state, tier, remaining, availability.showRemaining),
        // The SAME three conditions the item page and the shop's own card use,
        // in the same order: the listing's state, this row's status, its stock.
        buyable: state.buyable && tier.status === 'on-sale' && remaining > 0,
        priceCents: tier.priceCents,
        currency: shop.currency,
        city: shop.city,
        shopSlug: shop.slug,
        remaining,
        // The SELLER's own setting, not availability's: getAvailability sets
        // every tier's `unlimited` to false because it has just clamped the row
        // to the shop's total, so reading it from there would say "capped" about
        // every item in the bazaar and no countdown would ever be suppressed.
        unlimited: tier.unlimited,
        showRemaining: availability.showRemaining,
        listedAt,
        rating: ratings.get(`${shop.id}:${tier.tierKey}`) ?? null,
        href:
          isEvent && !tierHasItemPage('event', tier, ownPhoto)
            ? `/e/${shop.slug}#tickets`
            : `/e/${shop.slug}/item/${encodeURIComponent(tier.tierKey)}`,
        haystack: searchText(
          [
            tier.name,
            tier.description,
            tier.details,
            isEvent ? `ticket tickets event ${shop.artist} ${shop.venueName} ${ticket?.seller ?? ''}` : '',
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
 * Case-folding only, plus collapsing runs of whitespace. Deliberately no
 * stemming and no accent folding: both find matches a visitor cannot see the
 * reason for, and the page would then be claiming an understanding of Nepali
 * that this does not have.
 */
function fold(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * An item's searchable text: what the seller wrote, plus the OTHER WORDS the
 * same things are called.
 *
 * This is the one exception to the paragraph above, and it is an exception
 * because it is not a rule the code invented — it is a hand-written list of
 * things Nepali sellers sell, in the spellings people reach for
 * (lib/bazaarWords). A German neighbour typing "cardamom" over a shelf of
 * alaichi used to be told, in the site's own honest empty state, that nobody
 * sells it here; on a bazaar whose whole point is that these goods are hard to
 * find, that was the worst answer the page could give.
 *
 * Three things keep it from becoming the mystery-matching the comment above
 * warns about: the list is written by hand and can be read, a word is only
 * detected on a whole-word boundary, and the results page NAMES the connection
 * it used ("cardamom also matches alaichi") — see expansionsFor().
 */
function searchText(raw: string): string {
  const folded = fold(raw);
  const related = relatedWords(folded);
  return related.length ? `${folded} \n ${related.join(' ')}` : folded;
}

/**
 * A SQLite `created_at` as milliseconds.
 *
 * The column is written by `datetime('now')`, which is UTC spelled
 * 'YYYY-MM-DD HH:MM:SS' with no zone marker at all — hand that to Date.parse
 * as it stands and it is read as LOCAL time, so every shop would appear to
 * have been listed an hour or two out and the ordering of two shops opened
 * minutes apart across a DST boundary would flip. Same fix as lib/reminders
 * and lib/email: put the T and the Z back before parsing.
 *
 * An unparseable value becomes 0 — oldest — rather than NaN, which would make
 * every comparison against it false and quietly scramble the "newest" sort
 * instead of putting one odd row at the bottom.
 */
function listedAtMs(createdAt: string): number {
  const ms = Date.parse(`${createdAt.replace(' ', 'T')}Z`);
  return Number.isNaN(ms) ? 0 : ms;
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

// ---------------- Sorting ----------------

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'newest' | 'rating';

/**
 * The orders a shopper may pick, each with the sentence the page prints under
 * the control.
 *
 * The explainer is not decoration. A shop that offers a "sort" the visitor
 * cannot describe is asking them to trust an arrangement they have no way to
 * check, and the two that would otherwise be mysterious — featured, and what
 * happens to unrated goods under "best rated" — are exactly the two where a
 * marketplace usually hides a thumb on the scale. There is no thumb here, so
 * the page can afford to say precisely what each one does.
 */
export const SORTS: readonly { key: SortKey; label: string; explainer: string }[] = [
  { key: 'featured', label: 'Featured', explainer: SORT_EXPLAINER },
  {
    key: 'price-asc',
    label: 'Price: low to high',
    explainer: 'Cheapest first. Prices are the seller’s own and are what you pay them directly.',
  },
  {
    key: 'price-desc',
    label: 'Price: high to low',
    explainer: 'Dearest first — useful when a bundle or a whole set is what you came for.',
  },
  {
    key: 'newest',
    label: 'Newest shops',
    explainer:
      'The most recently opened shops first. It is the shop’s own age, not the item’s: a seller ' +
      'tidying their shelves does not become news.',
  },
  {
    key: 'rating',
    label: 'Best rated',
    explainer:
      'Highest average from verified buyers first, then the most reviews. Items nobody has ' +
      'reviewed yet come after them, in the featured order — never with an invented score.',
  },
];

/** The sort in a raw ?sort=, or 'featured' for anything this does not offer. */
export function asSortKey(raw: string): SortKey {
  return SORTS.find((s) => s.key === raw)?.key ?? 'featured';
}

/**
 * One of the orders above, as a NEW array — the caller's list is left alone so
 * a page can sort the same rows twice (a rail and a grid) without the second
 * one inheriting the first one's arrangement.
 *
 * Every branch sorts on ONE key and lets the rest of the order stand. That is
 * deliberate and it is why nothing here has a tie-breaker chain of its own:
 * Array.sort is stable, the list it is handed is already in listShopItems'
 * featured order, so two items at the same price stay in the order the front
 * page would have shown them — in stock first, real sellers before example
 * shops. A hand-written tie-break would quietly overrule both of those.
 */
export function sortShopItems(items: ShopItem[], key: SortKey): ShopItem[] {
  const out = items.slice();
  switch (key) {
    case 'price-asc':
      return out.sort((a, b) => a.priceCents - b.priceCents);
    case 'price-desc':
      return out.sort((a, b) => b.priceCents - a.priceCents);
    case 'newest':
      return out.sort((a, b) => b.listedAt - a.listedAt);
    case 'rating':
      return out.sort(byRating);
    case 'featured':
    default:
      return out;
  }
}

/**
 * Rated before unrated, then by average, then by how many people said it.
 *
 * The count is the second key rather than the first because a single delighted
 * five-star buyer is not evidence that this momo beats the one with 4.8 from
 * forty — but it is not evidence of the opposite either, so the honest thing is
 * to rank on the score people gave and use the count only to separate a tie.
 * The page shows both numbers beside every star row, so a shopper can weigh
 * "5.0 from 1" for themselves rather than being weighed for.
 *
 * Unrated goods sort AFTER every rated one and never between them: they have no
 * score, and any number chosen to stand in for one — 0, 3, the site average —
 * would be this file inventing a verdict on a seller's work.
 */
function byRating(a: ShopItem, b: ShopItem): number {
  if (!a.rating || !b.rating) return Number(!a.rating) - Number(!b.rating);
  return b.rating.average - a.rating.average || b.rating.count - a.rating.count;
}

// ---------------- Filtering ----------------

/**
 * Everything the search page can narrow by, in the shape the URL carries it.
 *
 * One object rather than six arguments because these travel together
 * everywhere — into the filter, into every facet link, into the active-filter
 * pills — and a positional list of six strings is a bug waiting for the day
 * somebody swaps `city` and `shop`.
 */
export interface MarketFilters {
  q: string;
  category: string;
  city: string;
  shop: string;
  inStock: boolean;
  band: string;
  /** Price ceiling in cents, inclusive; 0 or missing = none. */
  maxCents?: number;
  /** Price floor in cents, inclusive; 0 or missing = none. */
  minCents?: number;
}

/**
 * The items matching ALL of the given filters — an empty value is not a
 * filter, so the bare page runs this too and gets everything back.
 *
 * Every filter is an AND, including the search terms among themselves, because
 * that is what a shopper who set four controls means: momo, in Berlin, under
 * ten euros, in stock. Nothing here scores or ranks; sortShopItems is the only
 * thing that decides order, and it runs after.
 */
export function filterShopItems(items: ShopItem[], f: MarketFilters): ShopItem[] {
  const terms = queryTerms(f.q);
  // Folded once, not once per item: a filter that lower-cased both sides
  // inside the loop would do the same work a few thousand times per render.
  const city = fold(f.city);
  const band = asBand(f.band);
  return items.filter(
    (item) =>
      terms.every((t) => item.haystack.includes(t)) &&
      (!f.category || item.categoryKey === f.category) &&
      // Case-folded on both sides so a link somebody kept saying `city=Berlin`
      // still finds the shop whose seller typed "berlin", and so the two
      // spellings are ONE town rather than two half-empty facets.
      (!city || fold(item.city) === city) &&
      (!f.shop || item.shopSlug === f.shop) &&
      // "In stock" means what the buy button means — a row that is on sale,
      // in a shop that is open, with something left. Not merely remaining > 0,
      // which is also true of an item whose seller has paused their orders.
      (!f.inStock || item.buyable) &&
      (!band || bandOf(item) === band) &&
      (!f.maxCents || item.priceCents <= f.maxCents) &&
      (!f.minCents || item.priceCents >= f.minCents)
  );
}

// ---------------- Price bands ----------------

/**
 * The price ranges offered as a facet, in EUR cents.
 *
 * `minCents` is inclusive and `maxCents` EXCLUSIVE, which is the whole reason
 * the labels are written as they are: an item at exactly €5.00 is in "€5 to
 * €10" and not in "Under €5", so every price lands in exactly one band and no
 * shopper ever finds the same jar of achar in two of them. The last band's
 * `maxCents` is null rather than a big number — there is no ceiling on what a
 * seller may ask for a thangka.
 */
export const PRICE_BANDS: readonly {
  key: string;
  label: string;
  minCents: number;
  maxCents: number | null;
}[] = [
  { key: 'under-5', label: 'Under €5', minCents: 0, maxCents: 500 },
  { key: '5-10', label: '€5 to €10', minCents: 500, maxCents: 1000 },
  { key: '10-20', label: '€10 to €20', minCents: 1000, maxCents: 2000 },
  { key: '20-50', label: '€20 to €50', minCents: 2000, maxCents: 5000 },
  { key: '50-plus', label: '€50 and up', minCents: 5000, maxCents: null },
];

/** The band in a raw ?band=, or '' — which means "every price". */
export function asBand(raw: string): string {
  return PRICE_BANDS.find((b) => b.key === raw)?.key ?? '';
}

/**
 * Which band an item falls in, or '' for one that is in none.
 *
 * '' covers exactly one case today and it is worth the branch: every band is
 * labelled in euros, and a shop selling in another currency has prices these
 * ranges do not describe. Putting a 400-of-something item under "Under €5"
 * would be the page making a claim about a price it has not converted, so
 * such an item is simply not banded — it still appears everywhere else, and
 * the euro bands stay true to their own labels.
 */
function bandOf(item: ShopItem): string {
  if (item.currency.trim().toUpperCase() !== 'EUR') return '';
  const band = PRICE_BANDS.find(
    (b) => item.priceCents >= b.minCents && (b.maxCents === null || item.priceCents < b.maxCents)
  );
  return band?.key ?? '';
}

// ---------------- Facets ----------------
//
// How all three readers below are meant to be CALLED, because the counting
// rule is the part that is easy to get subtly wrong:
//
//   const cities = facetCities(filterShopItems(all, { ...f, city: '' }), f.city);
//
// Every facet counts against the items matching every OTHER active filter,
// with its own dimension cleared. Count against the fully filtered list
// instead and the moment somebody picks Berlin every other town reads "0" and
// the visitor is trapped in the town they clicked, with the page telling them
// — wrongly — that the bazaar sells nothing anywhere else.
//
// A value that would lead to an empty page is not offered at all: a facet link
// to zero results is a dead end wearing a button's clothes. The one exception
// is `selected`, which is kept even at zero, because the control a visitor is
// currently standing on must not vanish underneath them — that is their only
// way back off it. Passing it is optional; a caller that leaves it out gets
// the plain counts.

export interface Facet {
  key: string;
  label: string;
  count: number;
}

/** The tally the three readers share: count the keys, then pick each label. */
function facet(rows: { key: string; label: string }[], selected: string): Facet[] {
  const counts = new Map<string, number>();
  // Every spelling seen for one key, with how many items used it. The label is
  // the seller's own typing and this file does not tidy anybody's
  // capitalisation, so where two shops disagree the page prints whichever
  // spelling most of the goods on that facet actually carry.
  const labels = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!row.key) continue;
    counts.set(row.key, (counts.get(row.key) ?? 0) + 1);
    let seen = labels.get(row.key);
    if (!seen) labels.set(row.key, (seen = new Map()));
    seen.set(row.label, (seen.get(row.label) ?? 0) + 1);
  }
  if (selected && !counts.has(selected)) {
    counts.set(selected, 0);
    labels.set(selected, new Map([[selected, 0]]));
  }

  const pick = (key: string) => {
    const seen = [...(labels.get(key) ?? new Map<string, number>())];
    return seen.sort((a, b) => b[1] - a[1])[0]?.[0] ?? key;
  };
  return [...counts]
    .map(([key, count]) => ({ key, label: pick(key), count }))
    // Busiest first, then alphabetically — a facet column is scanned, not read,
    // and the town with forty things in it is what most visitors want.
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * The towns these items can be collected in.
 *
 * Keyed on the folded town so "Berlin" and "berlin" are one facet, and no
 * facet at all for a shop whose seller left the town empty: an unnamed place
 * is not a place to filter by, and a chip reading "(none)" is worse than no
 * chip. Those items simply stay in the unfiltered list.
 */
export function facetCities(items: ShopItem[], selected = ''): Facet[] {
  return facet(
    items.map((i) => ({ key: fold(i.city), label: i.city.trim() })),
    fold(selected)
  );
}

/**
 * The sellers these items belong to, by slug — stable across a rename, and
 * already the key the shop's own URL uses.
 *
 * The label is the name with the "(example shop)" mark taken off, exactly as
 * every tile prints it. That means this list alone cannot tell a visitor which
 * sellers are the site's own examples; the page rendering it has the items in
 * hand and can read `isExample` off the ones with this slug.
 */
export function facetShops(items: ShopItem[], selected = ''): Facet[] {
  return facet(
    items.map((i) => ({ key: i.shopSlug, label: i.shopName })),
    selected
  );
}

/**
 * The price bands these items fall in, in PRICE_BANDS order.
 *
 * Cheapest first rather than busiest first — the one facet with a natural
 * order of its own, and a price list shuffled by popularity is unreadable.
 */
export function facetBands(items: ShopItem[], selected = ''): Facet[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = bandOf(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Same rule as the other two: the band the visitor is standing in stays on
  // the page even when the rest of their filters have emptied it.
  const keep = asBand(selected);
  if (keep && !counts.has(keep)) counts.set(keep, 0);
  return PRICE_BANDS.filter((b) => counts.has(b.key)).map((b) => ({
    key: b.key,
    label: b.label,
    count: counts.get(b.key) ?? 0,
  }));
}

// ---------------- Search hints ----------------

/**
 * Words too common to be a useful hint. Deliberately tiny, and only words that
 * would beat real goods to the top of the list on frequency alone — a longer
 * list would start deciding that somebody's actual product name is noise.
 */
const HINT_STOPWORDS = new Set([
  'and',
  'for',
  'from',
  'the',
  'with',
  'per',
  'set',
  'pack',
  'box',
  'size',
  'made',
  'nepali',
  'nepal',
  'und',
  'mit',
  'der',
  'die',
  'das',
]);

/**
 * The words in a piece of text that are worth offering as a search.
 *
 * Split on anything that is not a letter or a digit, so "hand-picked" gives
 * "hand" and "picked" and an apostrophe does not weld two words together.
 * Unicode-aware on purpose: Devanagari is letters, and a rule written in
 * [a-z] would silently drop every Nepali word a seller typed.
 */
function hintWords(s: string): string[] {
  return (
    fold(s)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3 && !HINT_STOPWORDS.has(w))
      // Sizes and weights are not things anybody shops for. "100g", "250g",
      // "500g" and "12cm" are on half the items in a bazaar of spices and
      // bowls, so by count they beat every actual food — and a search box
      // suggesting "100g" is suggesting a page of unrelated jars.
      .filter((w) => !/^\d+[a-z]{0,3}$/.test(w))
  );
}

/**
 * Search hints for the bazaar's search box — the <datalist> under it.
 *
 * Every one of these is drawn from goods that are ON SALE RIGHT NOW: the words
 * in ITEM NAMES, plus each shelf's own terms (lib/categories) — and a shelf
 * term is only offered once something actually listed matches it. So every
 * suggestion returns at least one result.
 *
 * Not shop names and not towns, though both are searchable: those two have
 * their own filters in the facet column, and including them here meant the
 * hints were four towns and a fragment of a shop's name while the food went
 * unmentioned. That is
 * the whole rule here, and it is why this is not the hand-written list of
 * delicious-sounding words it obviously wants to be: suggesting "lakhamari" on
 * a site where nobody sells lakhamari sends a hungry visitor to an empty page
 * and teaches them the search is broken.
 *
 * Ranked by how many items each word reaches, so the most useful hints are the
 * ones a shopper sees first, then alphabetically so the list is stable between
 * renders rather than reshuffling under the cursor.
 *
 * Lower case throughout: these are search terms, not titles, and the search
 * folds case on both sides anyway.
 */
export function searchSuggestions(items: ShopItem[], max = 12): string[] {
  const hits = new Map<string, number>();

  for (const item of items) {
    // Per item, not per occurrence: a word repeated three times in one
    // description describes one thing for sale, and counting it three times
    // would let a wordy seller decide the bazaar's search hints.
    //
    // ITEM NAMES ONLY. Shop names and towns used to be in here too, and they
    // won — every item in Berlin carries "berlin", every item in one shop
    // carries a word from its name, so the top of the list came out as
    // "hamburg, ghar, munich, berlin" and the actual goods never made it in.
    // Both of those already have a filter of their own in the facet column,
    // where they belong: a suggestion should tell somebody what is FOR SALE,
    // which is the one question the facets do not answer.
    const words = new Set(hintWords(item.tier.name));
    for (const w of words) hits.set(w, (hits.get(w) ?? 0) + 1);
  }

  for (const shelf of SHOP_CATEGORIES) {
    for (const raw of shelf.terms) {
      const term = fold(raw);
      // Already offered by the goods themselves, with a count measured the
      // same way — leave it alone rather than double-counting it.
      if (hits.has(term)) continue;
      // The full-text check, which is what lets a two-word term like "sel
      // roti" or "singing bowl" in: those never survive being split into
      // words, and they are exactly what people type.
      const n = items.reduce((acc, item) => acc + (item.haystack.includes(term) ? 1 : 0), 0);
      if (n > 0) hits.set(term, n);
    }
  }

  return [...hits]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([word]) => word);
}
