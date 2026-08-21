import { shareImages } from '@/lib/seo';
import { absoluteUrl, itemListJsonLd, jsonLdScript } from '@/lib/seo';
import Np from '@/components/Np';
import type { Metadata } from 'next';
import Link from 'next/link';
import ItemTile from '@/components/ItemTile';
import { expansionsFor } from '@/lib/bazaarWords';
import { SHOP_CATEGORIES, categoryLabel, isShopCategory } from '@/lib/categories';
import {
  PRICE_BANDS,
  SORTS,
  asBand,
  asSortKey,
  countByCategory,
  facetBands,
  facetCities,
  facetShops,
  filterShopItems,
  listShopItems,
  queryTerms,
  searchSuggestions,
  sortShopItems,
} from '@/lib/marketItems';
import type { Facet, MarketFilters, ShopItem, SortKey } from '@/lib/marketItems';
import { platformNameFromEnv } from '@/lib/platform';
import { vocabFor } from '@/lib/vocab';

// The bazaar, goods-first: every item every published shop sells, on one page,
// searchable, filterable and sortable.
//
// /market is the shop-first view — shelves of shops, open one, then see what
// it sells. That is how a market square works, and it is not how anybody shops
// online: people look for the THING. Somebody who wants sel roti for Saturday
// should not have to guess which of eleven shops folded it, and a seller with
// one very good jar of achar should not be invisible because their shop is
// filed under a shelf that visitor never opened.
//
// The two views are deliberately both kept, and each links to the other in
// words that say which is which — "browse the shops" against "browse
// everything on sale". Nothing here is a second product page: a tile is a link
// to /e/<shop>/item/<key>, which already renders the picture at a size you can
// judge, the seller's write-up, the collection details and the button.
//
// Everything that narrows or reorders this page is a plain GET — one form, and
// links for the facets, the pills and the pages. No JavaScript runs to produce
// a result, which is not nostalgia: a result here is a URL somebody can send to
// a friend, the back button returns to it, and a search engine that follows a
// facet link sees exactly what a visitor sees. The whole of the machinery that
// decides WHICH items live in lib/marketItems, as pure functions over rows this
// page already has in memory, so a query with five filters and a sort on it
// costs the same five statements the bare page costs.
//
// Live availability on every tile — always render fresh, exactly like the
// listing pages this must never disagree with.
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * How many goods one page shows.
 *
 * 48 divides by 2, 3, 4 and 6, so the last row of the grid is full at every
 * column count the layout produces between 360px and a wide desktop. It is
 * also about as far as anybody scrolls before they would rather re-search, and
 * forty-eight lazy-loaded photographs is a page a phone on mobile data can
 * still finish.
 */
const PER_PAGE = 48;

/** How many towns and sellers the facet column offers before it stops. */
const MAX_TOWN_FACETS = 10;
const MAX_SELLER_FACETS = 12;

/** A repeated ?q= is a hand-edited URL; the first value is the answer. */
function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
}

/**
 * Everything the URL can say about this page, whitelisted.
 *
 * One reader, called by both the page and generateMetadata, because the two
 * have to agree about whether this request is a filtered slice — the day they
 * disagree is the day a search results page starts asking Google to index it.
 */
interface Query {
  q: string;
  category: string;
  city: string;
  shop: string;
  band: string;
  inStock: boolean;
  sort: SortKey;
  page: number;
}

function readQuery(sp: Record<string, string | string[] | undefined>): Query {
  const rawCategory = one(sp.c);
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
 * The page's own address with some of the controls changed — how every facet
 * link, every pill and every page number is built.
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
function hrefFor(query: Query, patch: Partial<Query> = {}): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.category) params.set('c', next.category);
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
  return qs ? `/market/items?${qs}` : '/market/items';
}

/** True when this request is a slice of the list rather than the whole list. */
function isSlice(query: Query): boolean {
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
function filtersOf(query: Query): MarketFilters {
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
 * light up in the column beside them.
 */
function townKey(city: string): string {
  return city.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * The first `max` rows of a facet, with the selected one kept even when it
 * falls outside them.
 *
 * A bazaar with two hundred sellers cannot put two hundred rows in a sidebar —
 * nobody reads that, and on a phone it is a screen and a half of scrolling
 * before the goods start. The rows arrive busiest-first, so the ones that get
 * cut are the ones fewest goods are behind, and the page says how many it is
 * not showing rather than pretending the list is complete. The selected row
 * survives the cut because it is the visitor's only way back off it.
 */
function capFacet(rows: Facet[], selected: string, max: number): Facet[] {
  const head = rows.slice(0, max);
  if (!selected || head.some((r) => r.key === selected)) return head;
  const picked = rows.find((r) => r.key === selected);
  return picked ? [...head.slice(0, Math.max(0, max - 1)), picked] : head;
}

/**
 * The seller behind every slug, and the town behind every folded town key, as
 * their owners spell them — read off the goods this page already holds.
 *
 * Both readers in lib/marketItems keep the facet a visitor is STANDING ON even
 * when their other filters have emptied it, because a control that vanishes
 * under the person who clicked it leaves them no way back off it. Having no
 * matching row left to take a name from, they label that row with its own key.
 *
 * A key is not a name. Filter to a seller and then to a price band they have
 * nothing in, and the sidebar and the pill above the results would both read
 * "sunita-s-home-kitchen" — a URL slug printed in the site's own voice, in the
 * one column whose entire job is naming the sellers. Same for a town, which
 * would come out lower-cased and space-collapsed.
 *
 * So the label is looked up in the unfiltered list, which is the only place a
 * name for an emptied facet still exists. A key that is not there either (a
 * hand-edited URL naming a seller who does not exist) keeps the key, which is
 * honestly all anybody knows about it — and it counts zero, so the row leads
 * nowhere and says so.
 */
function shopNames(items: ShopItem[]): Map<string, string> {
  return new Map(items.map((i) => [i.shopSlug, i.shopName]));
}

function townNames(items: ShopItem[]): Map<string, string> {
  return new Map(items.map((i) => [townKey(i.city), i.city.trim()]));
}

function named(rows: Facet[], names: Map<string, string>): Facet[] {
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
function pageWindow(current: number, total: number): (number | 'gap')[] {
  const wanted = [1, total, current - 1, current, current + 1];
  const pages = [...new Set(wanted)].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = readQuery(await searchParams);
  const name = platformNameFromEnv();

  // Written for what people actually type — "nepali momo berlin", "sel roti
  // bestellen", "timur kaufen" — rather than for the word this page calls its
  // own contents. Nobody has ever searched for "items".
  const title = 'Nepali food, spices & crafts to order in Germany';
  // Under the ~155 characters a search result shows — the list of goods is
  // what people are typing, so it keeps the room and the platform name goes.
  const description =
    'Search everything Nepali sellers have on sale in Germany — momo, sel roti, timur, ' +
    'gundruk, dhaka, pote, singing bowls. Order direct, collect by QR.';

  return {
    title,
    description,
    // Canonical to the BARE page, always. Every search, every shelf, every town
    // and every page number is a slice of this one list, and asking Google to
    // hold a URL per combination is how a site fills an index with near-
    // identical thin pages. With five filters and a sort on the page the number
    // of combinations is no longer countable, which makes this rule the whole
    // defence rather than a tidy-up.
    alternates: { canonical: '/market/items' },
    // …and a slice is not offered for indexing at all, though the links on it
    // are still worth following through to the item pages.
    ...(isSlice(query) ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: 'website', title, description, url: '/market/items', images: shareImages() },
  };
}

/**
 * One group in the facet column: a heading and its rows.
 *
 * `hrefOf` is handed the key to move to, and the group hands it '' for the row
 * that is already selected — so every facet on this page is a toggle and the
 * visitor can always click their way back off one, which is the thing a filter
 * column most often gets wrong.
 */
function FacetGroup({
  title,
  rows,
  selected,
  hrefOf,
  note,
}: {
  title: string;
  rows: Facet[];
  selected: string;
  hrefOf: (key: string) => string;
  note?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="bz-facet">
      <p className="bz-facet-title">{title}</p>
      <ul className="bz-facet-list">
        {rows.map((row) => {
          const on = row.key === selected;
          return (
            <li key={row.key}>
              <Link
                className={`bz-facet-link${on ? ' bz-facet-on' : ''}`}
                href={hrefOf(on ? '' : row.key)}
                aria-current={on ? 'true' : undefined}
                aria-label={on ? `${row.label} — remove this filter` : undefined}
              >
                <span>{row.label}</span>
                <span className="bz-facet-count">{row.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {note && (
        <p className="bz-facet-count" style={{ margin: '7px 0 0' }}>
          {note}
        </p>
      )}
    </div>
  );
}

export default async function MarketItemsPage({ searchParams }: Props) {
  const query = readQuery(await searchParams);
  const v = vocabFor('shop');
  const f = filtersOf(query);
  const terms = queryTerms(query.q);
  // The Nepali/English connections this particular search leaned on, so the
  // page can name them under the results. Computed from what was TYPED rather
  // than from what matched — a shopper deserves to know the site widened their
  // word whether or not the widening found anything.
  const expansions = expansionsFor(terms);

  const all = listShopItems();
  const results = filterShopItems(all, f);

  // Every facet counts against the items matching every OTHER active filter,
  // with its own dimension cleared — the rule lib/marketItems documents at
  // length. Count against the fully filtered list instead and the moment
  // somebody picks Berlin every other town reads "0" and the visitor is
  // trapped in the town they clicked, with the page telling them, wrongly,
  // that the bazaar sells nothing anywhere else.
  //
  // Six more passes over an array that is already in memory. That is the whole
  // cost: no filter, no facet and no sort on this page opens a second
  // connection to the database, so a visitor with five controls set is served
  // by the same five statements listShopItems() runs for the bare page.
  const forShelf = filterShopItems(all, { ...f, category: '' });
  const forCity = filterShopItems(all, { ...f, city: '' });
  const forShop = filterShopItems(all, { ...f, shop: '' });
  const forBand = filterShopItems(all, { ...f, band: '' });
  const forStock = filterShopItems(all, { ...f, inStock: false });
  const forQuery = filterShopItems(all, { ...f, q: '' });

  const shelfCounts = countByCategory(forShelf);
  const shelfRows: Facet[] = SHOP_CATEGORIES.filter(
    // A shelf with nothing on it under the rest of these filters is not
    // offered — a link that leads to "0 items" is a dead end wearing a
    // button's clothes. The one currently selected always stays, or clicking
    // it would make it vanish and strand the visitor on a page with no way
    // back to it.
    (c) => (shelfCounts.get(c.key) ?? 0) > 0 || c.key === query.category
  ).map((c) => ({ key: c.key, label: c.label, count: shelfCounts.get(c.key) ?? 0 }));

  const cityKey = townKey(query.city);
  const cityRows = named(facetCities(forCity, query.city), townNames(all));
  const shopRows = named(facetShops(forShop, query.shop), shopNames(all));
  const bandRows = facetBands(forBand, query.band);
  // "In stock" means what the buy button means, so the count is the number of
  // rows that would survive the toggle rather than the number with stock on
  // the shelf — a paused shop's goods are not something a shopper can have.
  const inStockCount = forStock.filter((i) => i.buyable).length;

  // Which sellers are the site's own example shops. facetShops prints the name
  // with the "(example shop)" mark taken off, exactly as every tile does, so
  // the facet list alone cannot tell a visitor which sellers are inventions —
  // this page has the items in hand and can read isExample off them. A filter
  // by seller that hid that fact would be the one place on the site where a
  // made-up shop looks like a real one.
  const exampleShops = new Set(all.filter((i) => i.isExample).map((i) => i.shopSlug));
  const sellerLabel = (row: Facet) =>
    exampleShops.has(row.key) ? `${row.label} · example shop` : row.label;

  const townFacets = capFacet(cityRows, cityKey, MAX_TOWN_FACETS);
  const sellerFacets = capFacet(shopRows, query.shop, MAX_SELLER_FACETS).map((row) => ({
    ...row,
    label: sellerLabel(row),
  }));

  const sorted = sortShopItems(results, query.sort);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  // Clamped rather than refused. ?page=99 in an old link, or a page that has
  // shrunk because a seller sold out, should land on the last page of what
  // there is — an "that page does not exist" for a page that used to exist
  // blames the visitor for a bazaar that moved underneath them.
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * PER_PAGE;
  const pageItems = sorted.slice(start, start + PER_PAGE);

  const activeSort = SORTS.find((s) => s.key === query.sort) ?? SORTS[0];

  // The filters that are not the search box or the shelf. Kept apart because
  // the empty state has to know: "nobody sells that here" is a true sentence
  // about a search and a false one about a search with a town, a price band
  // and a seller stacked on top of it.
  const narrowed = Boolean(query.city || query.shop || query.band || query.inStock);
  const filtered = Boolean(terms.length || query.category || narrowed);

  // Each pill removes exactly one thing and keeps the rest — the reason it is
  // a pill rather than a "Clear all", which is offered separately beside the
  // search box for the visitor who wants to start over.
  const pills: { key: string; label: string; href: string }[] = [];
  if (query.q) {
    pills.push({
      key: 'q',
      label: `“${query.q}”`,
      href: hrefFor(query, { q: '' }),
    });
  }
  if (query.category) {
    pills.push({
      key: 'c',
      label: categoryLabel(query.category),
      href: hrefFor(query, { category: '' }),
    });
  }
  if (query.band) {
    pills.push({
      key: 'band',
      label: PRICE_BANDS.find((b) => b.key === query.band)?.label ?? query.band,
      href: hrefFor(query, { band: '' }),
    });
  }
  if (query.city) {
    pills.push({
      key: 'city',
      // The town as the SELLERS spell it, from the facet that matched, rather
      // than as the URL happens to spell it — otherwise a link somebody typed
      // by hand puts "BERLIN" on the page in the site's own voice.
      label: cityRows.find((c) => c.key === cityKey)?.label || query.city,
      href: hrefFor(query, { city: '' }),
    });
  }
  if (query.shop) {
    const row = shopRows.find((s) => s.key === query.shop);
    pills.push({
      key: 'shop',
      label: row ? sellerLabel(row) : query.shop,
      href: hrefFor(query, { shop: '' }),
    });
  }
  if (query.inStock) {
    pills.push({ key: 'stock', label: 'In stock only', href: hrefFor(query, { inStock: false }) });
  }

  const exampleCount = pageItems.filter((i) => i.isExample).length;
  const realCount = pageItems.length - exampleCount;
  // The state the bazaar is genuinely in for now: the site publishes its own
  // example shops, and while the real sellers are still arriving those can be
  // most of what a visitor scrolls past. Every tile says so on its own, but a
  // grid where the marked ones dominate needs the reason once, in words, at
  // the top — otherwise the honest chips read as clutter rather than as the
  // point.
  //
  // Counted over the tiles that are actually on THIS page, not over the whole
  // result set: with 48 to a page the real sellers can all be on page one, and
  // a notice saying "most of what is on this page" has to be true of the page
  // the visitor is looking at.
  const mostlyExamples = pageItems.length > 0 && exampleCount > pageItems.length / 2;

  // …and the same count over the WHOLE result set, which is the only thing
  // that can answer "has a real seller listed anything like this at all". Page
  // two of a search can easily hold nothing but example shops while page one
  // was all real sellers, and the notice must not turn that into "nobody sells
  // this" — the most discouraging sentence on the site, and in that case a
  // false one.
  const realTotal = results.filter((i) => !i.isExample).length;

  // Only offered under the featured sort, which is the one that puts real
  // sellers ahead of example shops. Under "price: low to high" they are
  // interleaved by price, and the sentence would be describing an order the
  // page is not in.
  const realFirst = query.sort === 'featured';

  // Drawn from the goods matching every filter EXCEPT the search box, so every
  // suggestion returns at least one result on the page the visitor is standing
  // on. Suggesting a word that leads to an empty page teaches somebody that
  // the search is broken, and doing it from inside a filtered slice is the
  // easiest way to do exactly that.
  const suggestions = searchSuggestions(forQuery);

  // Whether there is anything to put in the facet column at all. A search that
  // matched nothing has no towns and no sellers to offer — every group empties
  // itself by the same rule — and the panel would then be an empty bordered
  // box holding a heading, with the results pushed into a 236px column beside
  // it. So the sidebar and the two-column layout come and go together.
  const hasFacets =
    shelfRows.length > 0 ||
    bandRows.length > 0 ||
    townFacets.length > 0 ||
    sellerFacets.length > 0 ||
    inStockCount > 0 ||
    query.inStock;

  const shopCount = new Set(results.map((i) => i.shop.id)).size;
  const noun = total === 1 ? v.unit : v.units;

  // What this page IS, for a crawler: a list of products, in the order drawn.
  // Built from pageItems — the slice actually rendered — because an ItemList
  // that counts the whole result set on a page showing 48 of them is a
  // mismatch, and a mismatch costs the page its structured data outright.
  const listLd = itemListJsonLd(
    'Nepali goods on sale in Germany',
    pageItems.map((item) => ({ name: item.tier.name, url: absoluteUrl(item.href) }))
  );

  return (
    <>
      {/* Only on the page Google is allowed to keep. Every filtered slice is
          noindex (see generateMetadata), and handing a crawler a product list
          for a page we have just asked it to forget is noise at best. */}
      {!filtered && pageItems.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(listLd)} />
      )}
      <section className="feed-hero" style={{ padding: '56px 0 28px' }}>
        <div className="container">
          <p className="feed-kicker anim-fade-up">
            <Np>नेपाली बजार</Np> · Everything on sale
          </p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.8rem, 4.2vw, 2.7rem)' }}>
            Every {v.unit} in the bazaar, in one place
          </h1>
          <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 14 }}>
            Momo, sel roti, timur, dhaka, pote, singing bowls — search across every Nepali shop on
            the site at once, then order from the seller who makes it. You pay them directly and
            collect with the QR code on your order.
          </p>
          {/* The other way round the same bazaar, named so the difference is
              obvious before the click. */}
          <p className="anim-fade-up anim-d3" style={{ margin: 0 }}>
            <Link href="/market" style={{ textDecoration: 'underline' }}>
              Rather browse the shops? →
            </Link>
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 14 }}>
        <div className="container">
          {all.length === 0 ? (
            /* No shop has anything on sale yet — the state this page launches
               in. Say what is coming and invite the person who could stock the
               first shelf, exactly as /market does for its own empty case.
               No search box and no filter column over an empty bazaar: a
               control that can only ever return nothing is a trap, and the two
               links below are the only useful things on the page. */
            <div className="bz-empty" style={{ maxWidth: 620, margin: '10px auto 0' }}>
              <h2 className="feed-section-title anim-fade-up">Nothing on the shelves yet</h2>
              <p className="muted anim-fade-up anim-d1" style={{ margin: '10px 0 0' }}>
                The first shops are being set up right now. Soon this page will list every {v.unit}{' '}
                on sale across the bazaar — momo, festival sweets, spices and crafts from Nepali
                sellers around Germany — and if you make any of those, the first shelf could be
                yours.
              </p>
              <p className="anim-fade-up anim-d2" style={{ marginTop: 22 }}>
                <Link href="/organizers" className="btn btn-brand">
                  Open your shop — it&rsquo;s free
                </Link>{' '}
                <Link href="/" className="btn" style={{ marginLeft: 8 }}>
                  What&rsquo;s on instead →
                </Link>
              </p>
            </div>
          ) : (
            /* ONE form for the whole page. The search box is at the top and the
               sort control is down in the toolbar, so the form has to span both
               — every filter the visitor set rides along as a hidden field, and
               a new search or a new sort keeps their town and their shelf
               instead of silently throwing them away.

               What it deliberately does NOT carry is the page number. A GET
               form writes every one of its named fields into the URL, so a
               hidden page=1 would put ?page=1 on the address of the first page
               and give this list two spellings of its own front door. Every
               submission therefore starts at page one, which is also what
               somebody who has just changed their search means.

               That same rule about GET forms is why pressing Search on an
               empty box lands on `?q=`, and why applying the default order
               lands on `?sort=featured`: a form cannot leave out a field it
               owns, and there is no JavaScript here to tidy the address
               afterwards. Neither is a filter — both read as "everything",
               both render the identical page — and every link this page builds
               drops them, so the most a bare submit can produce is two extra
               spellings rather than a family of them, with the canonical
               pointing at the bare page in every case. */
            <form
              action="/market/items"
              method="get"
              aria-label={`Search, filter and sort every ${v.unit} on sale`}
            >
              <div className="bz-search">
                {/* aria-label rather than a visible <label>: the placeholder
                    shows what to type and a heading two lines up already says
                    what this searches, so a printed label would only repeat the
                    page. */}
                <input
                  className="input bz-search-input"
                  type="search"
                  name="q"
                  aria-label={`Search every ${v.unit} on sale`}
                  defaultValue={query.q}
                  placeholder="momo, timur, dhaka topi, Berlin…"
                  autoComplete="off"
                  list={suggestions.length > 0 ? 'bz-suggestions' : undefined}
                />
                <button className="btn btn-brand bz-search-btn" type="submit">
                  Search
                </button>
                {filtered && (
                  <Link className="btn bz-search-btn" href="/market/items">
                    Clear all
                  </Link>
                )}

                {/* The rest of the state, carried so the search box narrows
                    what is on the page rather than replacing it. Rendered only
                    when set, because an empty hidden field writes `&city=` into
                    the URL and that is a second address for this same page. */}
                {query.category && <input type="hidden" name="c" value={query.category} />}
                {query.city && <input type="hidden" name="city" value={query.city} />}
                {query.shop && <input type="hidden" name="shop" value={query.shop} />}
                {query.band && <input type="hidden" name="band" value={query.band} />}
                {query.inStock && <input type="hidden" name="stock" value="1" />}
              </div>

              {suggestions.length > 0 && (
                <datalist id="bz-suggestions">
                  {suggestions.map((word) => (
                    <option key={word} value={word} />
                  ))}
                </datalist>
              )}

              <div className={hasFacets ? 'bz-layout' : ''} style={{ marginTop: 18 }}>
                {/* Open at every width: a sidebar on a desktop, and on a phone
                    a panel with a real "Filters" bar the visitor can close. The
                    stylesheet hides the summary only while this is open and
                    only at 900px and up, so the filters can never become
                    unreachable. */}
                {hasFacets && (
                  <details className="bz-facets" open>
                    <summary>
                      <span>
                        Filters
                        {pills.length > 0 ? ` · ${pills.length} on` : ''}
                      </span>
                    </summary>

                    <FacetGroup
                      title="Shelf"
                      rows={shelfRows}
                      selected={query.category}
                      hrefOf={(key) => hrefFor(query, { category: key })}
                    />
                    <FacetGroup
                      title="Price"
                      rows={bandRows}
                      selected={query.band}
                      hrefOf={(key) => hrefFor(query, { band: key })}
                    />
                    <FacetGroup
                      title="Town"
                      rows={townFacets}
                      selected={cityKey}
                      hrefOf={(key) => hrefFor(query, { city: key })}
                      note={
                        cityRows.length > townFacets.length
                          ? `The ${townFacets.length} busiest of ${cityRows.length} towns.`
                          : undefined
                      }
                    />
                    <FacetGroup
                      title="Seller"
                      rows={sellerFacets}
                      selected={query.shop}
                      hrefOf={(key) => hrefFor(query, { shop: key })}
                      note={
                        shopRows.length > sellerFacets.length
                          ? `The ${sellerFacets.length} busiest of ${shopRows.length} sellers — search a name to find another.`
                          : undefined
                      }
                    />

                    {/* Held to the same rule as every other facet: a toggle that
                        would empty the page is not offered, and the one the
                        visitor is standing on is offered even at zero because it
                        is their only way back off it. */}
                    {(inStockCount > 0 || query.inStock) && (
                      <div className="bz-facet">
                        <p className="bz-facet-title">Availability</p>
                        <ul className="bz-facet-list">
                          <li>
                            <Link
                              className={`bz-facet-link${query.inStock ? ' bz-facet-on' : ''}`}
                              href={hrefFor(query, { inStock: !query.inStock })}
                              aria-current={query.inStock ? 'true' : undefined}
                              aria-label={
                                query.inStock ? 'In stock only — remove this filter' : undefined
                              }
                            >
                              <span>In stock only</span>
                              <span className="bz-facet-count">{inStockCount}</span>
                            </Link>
                          </li>
                        </ul>
                        {/* Deliberately not "…and they sit at the bottom": that
                            is only true of the featured order. Under "price: low
                            to high" a sold-out jar sits at its price like
                            everything else, and a note that said otherwise would
                            be describing an order the page is not in. */}
                        <p className="bz-facet-count" style={{ margin: '7px 0 0' }}>
                          Otherwise sold-out and paused goods stay in the list.
                        </p>
                      </div>
                    )}
                  </details>
                )}

                <div>
                  <div className="bz-toolbar">
                    <p className="bz-toolbar-count">
                      {total} {noun}
                    </p>
                    {/* The Apply button is always visible, and that is the
                        whole design: nothing on this page runs JavaScript, so
                        there is no change handler to submit the form for you,
                        and a select that silently does nothing when you pick
                        from it is worse than no sort at all. */}
                    <div className="bz-sort">
                      <label htmlFor="bz-sort-by">Sort</label>
                      <select id="bz-sort-by" name="sort" defaultValue={query.sort}>
                        {SORTS.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <button className="btn btn-sm" type="submit">
                        Apply
                      </button>
                    </div>
                  </div>

                  {pills.length > 0 && (
                    <ul className="bz-pills" aria-label="Filters you have set">
                      {pills.map((pill) => (
                        <li key={pill.key}>
                          <Link
                            className="bz-pill"
                            href={pill.href}
                            aria-label={`Remove filter: ${pill.label}`}
                          >
                            <span>{pill.label}</span>
                            <span className="bz-pill-x" aria-hidden="true">
                              ×
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {total === 0 ? (
                    /* Matched nothing. The honest version says what was
                       searched, does not pretend a near-miss was found, and
                       hands back every way out — the same search across every
                       shelf, the same search without the filters stacked on it,
                       and the whole bazaar. */
                    <div className="bz-empty" style={{ marginTop: 16, textAlign: 'left' }}>
                      <h2 className="feed-section-title" style={{ marginTop: 0 }}>
                        {terms.length > 0 ? (
                          <>Nothing matched &ldquo;{query.q}&rdquo;</>
                        ) : query.category ? (
                          <>Nothing on this shelf yet</>
                        ) : (
                          <>Nothing matched those filters</>
                        )}
                      </h2>
                      <p className="muted" style={{ margin: '10px 0 0' }}>
                        {terms.length > 0 && narrowed ? (
                          <>
                            Nothing is left once the other filters you set are applied. The{' '}
                            {v.unit} you are after may be in another town, at another price, or
                            from a seller you have filtered out — take one filter off and look
                            again.
                          </>
                        ) : terms.length > 0 && query.category ? (
                          <>
                            No {v.unit} on the {categoryLabel(query.category)} shelf mentions that.
                            It may be on another shelf, or nobody is selling it here yet — the
                            bazaar is still filling up.
                          </>
                        ) : terms.length > 0 ? (
                          <>
                            We searched every {v.unit} name, the sellers&rsquo; own descriptions,
                            and the shop names and towns. Nobody is selling that here yet — the
                            bazaar is still filling up, so it is worth looking again.
                          </>
                        ) : query.category && !narrowed ? (
                          <>No shop has listed anything on this shelf so far.</>
                        ) : (
                          <>
                            Nothing on sale is left once these filters are applied. Take one off —
                            each pill above removes only itself.
                          </>
                        )}
                      </p>
                      {/* What the bazaar DOES have, when it does not have what
                          was asked for.
                          A dead end used to offer three buttons back to the
                          same wall of everything. These are real words drawn
                          from goods on sale right now — the same list the
                          search box suggests — so every one of them lands on
                          results, and on a bazaar this young they are also the
                          honest answer to "what is even here?". Capped at six:
                          this is a consolation, not a second search box. */}
                      {suggestions.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <p className="muted small" style={{ margin: '0 0 8px' }}>
                            On the shelves right now:
                          </p>
                          <div className="chip-row">
                            {suggestions.slice(0, 6).map((word) => (
                              <Link key={word} className="chip" href={`/market/items?q=${encodeURIComponent(word)}`}>
                                {word}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      <p style={{ marginTop: 18 }}>
                        {terms.length > 0 && query.category && (
                          <>
                            <Link className="btn" href={hrefFor(query, { category: '' })}>
                              Search every shelf
                            </Link>{' '}
                          </>
                        )}
                        {/* Only when there is something left to keep. With
                            nothing but the town and the price band set,
                            dropping them IS "show everything on sale", and two
                            buttons to the same page beside each other is a
                            choice that is not one. */}
                        {narrowed && (terms.length > 0 || query.category) && (
                          <>
                            <Link
                              className="btn"
                              href={hrefFor(query, {
                                city: '',
                                shop: '',
                                band: '',
                                inStock: false,
                              })}
                            >
                              {terms.length > 0
                                ? 'Drop the filters, keep the search'
                                : 'Drop the filters, keep the shelf'}
                            </Link>{' '}
                          </>
                        )}
                        <Link className="btn btn-brand" href="/market/items">
                          Show everything on sale
                        </Link>{' '}
                        <Link className="btn" href="/market" style={{ marginLeft: 4 }}>
                          Browse the shops instead →
                        </Link>
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="muted" style={{ margin: '14px 0 0' }}>
                        {filtered ? (
                          <>
                            <strong>
                              {total} {noun}
                            </strong>{' '}
                            {terms.length > 0 ? (
                              <>
                                matching &ldquo;{query.q}&rdquo;
                                {query.category ? (
                                  <> on the {categoryLabel(query.category)} shelf</>
                                ) : null}
                              </>
                            ) : query.category ? (
                              <>on the {categoryLabel(query.category)} shelf</>
                            ) : (
                              <>matching the filters you set</>
                            )}
                            {narrowed && (terms.length > 0 || query.category)
                              ? ', with your other filters applied'
                              : ''}
                            .{' '}
                          </>
                        ) : (
                          <>
                            <strong>
                              Everything on sale — {total} {noun}
                            </strong>{' '}
                            from {shopCount} shops.{' '}
                          </>
                        )}
                        {/* Which slice of the list is on the screen. Without
                            this line a visitor on page 2 of a 213-item search
                            is looking at 48 tiles under a heading that says
                            213, with no way to tell whether the other 165 are
                            missing or merely elsewhere. */}
                        {totalPages > 1 ? (
                          <>
                            Showing {start + 1}&ndash;{start + pageItems.length} of {total}, page{' '}
                            {page} of {totalPages}.{' '}
                          </>
                        ) : null}
                        {/* What the order actually is, in the sort's own words.
                            A shop that offers an arrangement it will not
                            describe is asking to be trusted about the one thing
                            a marketplace is usually caught putting a thumb on. */}
                        {activeSort.explainer}
                      </p>
                      {terms.length > 0 && (
                        <p className="muted small" style={{ margin: '4px 0 0' }}>
                          Searched in {v.unit} names, the sellers&rsquo; descriptions, and shop
                          names and towns.
                        </p>
                      )}
                      {/* Why a jar labelled in a language you do not read came
                          back. The bazaar's search knows some of these things
                          have two or three names — alaichi and cardamom, momo
                          and dumplings, ढाका टोपी and dhaka topi — and a shopper
                          who typed the English one is looking at a shelf of
                          Nepali labels wondering whether the site understood
                          them. It did, and this is it saying so. Only ever
                          printed for a connection actually used: expansionsFor
                          returns nothing for a word that is already the name
                          the sellers themselves write. */}
                      {expansions.length > 0 && (
                        <p className="muted small" style={{ margin: '4px 0 0' }}>
                          {expansions.map((e, i) => (
                            <span key={e.label}>
                              {i > 0 && ' · '}
                              &ldquo;{e.typed}&rdquo; also matches <strong>{e.label}</strong>
                            </span>
                          ))}
                        </p>
                      )}

                      {mostlyExamples && (
                        <p className="notice" style={{ marginTop: 16, maxWidth: 720 }}>
                          Most of what is on this page right now is <strong>example shops</strong> —
                          shops the site publishes itself so a Nepali seller can see their own
                          before they build it. Every one of them is marked, and nothing on them can
                          be ordered or collected.
                          {realCount > 0 ? (
                            <>
                              {' '}
                              The {realCount} unmarked {realCount === 1 ? v.unit : v.units} on this
                              page {realCount === 1 ? 'is' : 'are'} from real sellers
                              {realFirst ? <>, and the featured order puts them first</> : null}.
                            </>
                          ) : realTotal > 0 ? (
                            <>
                              {' '}
                              {realTotal} unmarked {realTotal === 1 ? v.unit : v.units} from real
                              sellers {realTotal === 1 ? 'matches' : 'match'} this too —{' '}
                              {realTotal === 1 ? 'it is' : 'they are'} on another page.
                            </>
                          ) : (
                            <>
                              {' '}
                              No real seller has listed anything matching this yet.{' '}
                              <Link href="/organizers" style={{ textDecoration: 'underline' }}>
                                Opening a shop is free
                              </Link>
                              .
                            </>
                          )}
                        </p>
                      )}

                      <div className="bz-grid" style={{ marginTop: 16 }}>
                        {pageItems.map((item) => (
                          <ItemTile key={`${item.shop.id}:${item.tier.tierKey}`} item={item} />
                        ))}
                      </div>

                      {totalPages > 1 && (
                        <nav aria-label="Result pages">
                          <ul className="bz-pages">
                            {page > 1 && (
                              <li>
                                <Link
                                  className="bz-page-link"
                                  rel="prev"
                                  href={hrefFor(query, { page: page - 1 })}
                                >
                                  ← Previous
                                </Link>
                              </li>
                            )}
                            {pageWindow(page, totalPages).map((n, i) =>
                              n === 'gap' ? (
                                /* Punctuation, not a control: the numbers it
                                   stands for are reachable from the page it
                                   sits beside. */
                                <li key={`gap-${i}`} className="muted" aria-hidden="true">
                                  …
                                </li>
                              ) : n === page ? (
                                <li key={n}>
                                  <span className="bz-page-link bz-page-current" aria-current="page">
                                    {n}
                                  </span>
                                </li>
                              ) : (
                                <li key={n}>
                                  <Link
                                    className="bz-page-link"
                                    href={hrefFor(query, { page: n })}
                                    aria-label={`Page ${n}`}
                                  >
                                    {n}
                                  </Link>
                                </li>
                              )
                            )}
                            {page < totalPages && (
                              <li>
                                <Link
                                  className="bz-page-link"
                                  rel="next"
                                  href={hrefFor(query, { page: page + 1 })}
                                >
                                  Next →
                                </Link>
                              </li>
                            )}
                          </ul>
                        </nav>
                      )}
                    </>
                  )}

                  <p className="muted" style={{ textAlign: 'center', marginTop: 30 }}>
                    Looking for a particular seller instead?{' '}
                    <Link href="/market" style={{ textDecoration: 'underline' }}>
                      Browse the shops
                    </Link>{' '}
                    — or, if you have something to sell,{' '}
                    <Link href="/organizers" style={{ textDecoration: 'underline' }}>
                      a shop here is free
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
