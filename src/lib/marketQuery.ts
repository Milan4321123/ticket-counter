// Server-only: how /market reads its URL and how it writes the next one.
//
// The bazaar's front page is a search-results page — every chip, every pill,
// every page number is a plain GET link, and the page and its generateMetadata
// both have to agree about what a given URL means (the day they disagree is
// the day a search results page starts asking Google to index it). So the
// reader, the link builder and the small facet helpers around them live here,
// as pure functions, rather than as locals of the page that renders them.
//
// This grew out of /market/items, which used to be the goods-first view while
// /market was shelves of shops. Those two pages are now one, at /market, and
// /market/items is a redirect that carries the query string across.
import { isShopCategory } from './categories';
import { asBand, asSortKey } from './marketItems';
import type { Facet, MarketFilters, ShopItem, SortKey } from './marketItems';

/**
 * How many goods one page shows.
 *
 * 48 divides by 2, 3, 4 and 6, so the last row of the grid is full at every
 * column count the layout produces between 360px and a wide desktop. It is
 * also about as far as anybody scrolls before they would rather re-search, and
 * forty-eight lazy-loaded photographs is a page a phone on mobile data can
 * still finish.
 */
export const PER_PAGE = 48;

/** A repeated ?q= is a hand-edited URL; the first value is the answer. */
export function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
}

/** Everything the URL can say about the bazaar page, whitelisted. */
export interface MarketQuery {
  q: string;
  category: string;
  city: string;
  shop: string;
  band: string;
  inStock: boolean;
  sort: SortKey;
  page: number;
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function readQuery(sp: SearchParams): MarketQuery {
  // `category` is the parameter this page writes. `c` is what /market/items
  // wrote for months and what old links, the audit script and a few bookmarks
  // still say; it is read as a fallback so none of them land on the wrong
  // shelf, and never written, so the page keeps one spelling of its own URLs.
  const rawCategory = one(sp.category) || one(sp.c);
  return {
    q: one(sp.q),
    // Whitelisted, exactly as the editor's <select> and the server's writer
    // whitelist it. An unknown key shows everything rather than an empty shelf:
    // a retired category in an old bookmark should degrade to the full bazaar,
    // never to a page that looks like the bazaar has closed.
    category: isShopCategory(rawCategory) ? rawCategory : '',
    // Towns and sellers are not whitelisted against a list, and cannot be: a
    // town is whatever its seller typed and a seller's slug changes when they
    // open a shop. Both are compared, never rendered raw as a claim — a value
    // matching nothing simply produces the empty state, and the label printed
    // on the pill comes from the facet that matched it rather than from the URL.
    city: one(sp.city),
    shop: one(sp.shop),
    band: asBand(one(sp.band)),
    // Exactly one spelling accepted, because exactly one thing produces it:
    // this page's own toggle and its own hidden field. Being generous here
    // ("on", "true", "yes") would buy nothing and cost four URLs for one page.
    inStock: one(sp.stock) === '1',
    sort: asSortKey(one(sp.sort)),
    page: readPage(one(sp.page)),
  };
}

/** ?page= as a whole number, or 1 for anything that is not one. */
function readPage(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

/**
 * The page's own address with some of the controls changed — how every chip,
 * every pill and every page number is built.
 *
 * Two rules, and both of them are the reason this is one function rather than
 * a URLSearchParams at each call site:
 *
 *   1. Everything the visitor already set is carried, so picking a town keeps
 *      their search, their shelf and their sort instead of quietly throwing
 *      away four decisions to honour one click.
 *   2. Empty values are dropped rather than written as `?q=`, and the page
 *      number is dropped unless the caller is a page link. "Everything" has
 *      exactly ONE URL, and a visitor who narrows a search from page 7 lands
 *      on the first page of the new result set rather than on a page 7 that no
 *      longer exists.
 *
 * The parameters are written in a fixed order, so the same state is always the
 * same string — two spellings of one page is a canonical problem and, more
 * immediately, a link that never looks active.
 */
export function hrefFor(query: MarketQuery, patch: Partial<MarketQuery> = {}): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.category) params.set('category', next.category);
  if (next.city) params.set('city', next.city);
  if (next.shop) params.set('shop', next.shop);
  if (next.band) params.set('band', next.band);
  if (next.inStock) params.set('stock', '1');
  // 'featured' is the order this page has when nobody asked for one, so it is
  // not written down. Naming the default in the URL is how a site ends up with
  // two addresses for its own front door.
  if (next.sort !== 'featured') params.set('sort', next.sort);
  const page = patch.page ?? 1;
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/market?${qs}` : '/market';
}

/** True when this request is a slice of the list rather than the whole list. */
export function isSlice(query: MarketQuery): boolean {
  return Boolean(
    query.q ||
      query.category ||
      query.city ||
      query.shop ||
      query.band ||
      query.inStock ||
      query.sort !== 'featured' ||
      query.page > 1
  );
}

/** The filters, in the shape lib/marketItems wants them. */
export function filtersOf(query: MarketQuery): MarketFilters {
  return {
    q: query.q,
    category: query.category,
    city: query.city,
    shop: query.shop,
    inStock: query.inStock,
    band: query.band,
  };
}

/**
 * A town's key as facetCities spells it.
 *
 * lib/marketItems folds a town on both sides of every comparison so that
 * "Berlin" and "berlin" are one place rather than two half-empty facets; this
 * has to fold the same way or the town a visitor is standing in would never
 * light up in the chip row beside them.
 */
export function townKey(city: string): string {
  return city.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * The first `max` rows of a facet, with the selected one kept even when it
 * falls outside them.
 *
 * A bazaar with two hundred sellers cannot put two hundred chips in a row —
 * nobody scrolls that far. The rows arrive busiest-first, so the ones that get
 * cut are the ones fewest goods are behind, and the page says how many it is
 * not showing rather than pretending the list is complete. The selected row
 * survives the cut because it is the visitor's only way back off it.
 */
export function capFacet(rows: Facet[], selected: string, max: number): Facet[] {
  const head = rows.slice(0, max);
  if (!selected || head.some((r) => r.key === selected)) return head;
  const picked = rows.find((r) => r.key === selected);
  return picked ? [...head.slice(0, Math.max(0, max - 1)), picked] : head;
}

/**
 * The seller behind every slug, and the town behind every folded town key, as
 * their owners spell them — read off the goods the page already holds.
 *
 * Both readers in lib/marketItems keep the facet a visitor is STANDING ON even
 * when their other filters have emptied it, because a control that vanishes
 * under the person who clicked it leaves them no way back off it. Having no
 * matching row left to take a name from, they label that row with its own key.
 *
 * A key is not a name. Filter to a seller and then to a price band they have
 * nothing in, and the chip and the pill would both read "sunita-s-home-kitchen"
 * — a URL slug printed in the site's own voice, in the one row whose entire job
 * is naming the sellers. Same for a town, which would come out lower-cased and
 * space-collapsed.
 *
 * So the label is looked up in the unfiltered list, which is the only place a
 * name for an emptied facet still exists. A key that is not there either (a
 * hand-edited URL naming a seller who does not exist) keeps the key, which is
 * honestly all anybody knows about it — and it counts zero, so the row leads
 * nowhere and says so.
 */
export function shopNames(items: ShopItem[]): Map<string, string> {
  return new Map(items.map((i) => [i.shopSlug, i.shopName]));
}

export function townNames(items: ShopItem[]): Map<string, string> {
  return new Map(items.map((i) => [townKey(i.city), i.city.trim()]));
}

export function named(rows: Facet[], names: Map<string, string>): Facet[] {
  // A count of zero is exactly and only the synthetic row, because facetCities
  // and facetShops build their counts from the goods themselves and a key with
  // no goods behind it never appears. Testing it — rather than only testing
  // whether the label happens to equal the key — is what keeps this from
  // overruling the sellers' own spelling: where forty items say "berlin" and
  // one says "Berlin", the readers already picked the busy one on purpose, and
  // a lookup that took whichever came last in the array would undo that.
  return rows.map((row) =>
    row.count === 0 && row.label === row.key
      ? { ...row, label: names.get(row.key) ?? row.key }
      : row
  );
}

/**
 * Which page numbers to print: the first, the last, and the ones either side
 * of where the visitor is, with a gap marker where numbers were left out.
 *
 * Not every page. A bazaar of three thousand goods is sixty-three pages, and
 * sixty-three tap targets at the bottom of a phone screen is not navigation.
 */
export function pageWindow(current: number, total: number): (number | 'gap')[] {
  const wanted = [1, total, current - 1, current, current + 1];
  const pages = [...new Set(wanted)].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) out.push('gap');
    out.push(n);
  });
  return out;
}
