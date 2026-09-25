import { absoluteUrl, itemListJsonLd, jsonLdScript, shareImages } from '@/lib/seo';
import Np from '@/components/Np';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import LiveSearchInput from './LiveSearchInput';
import { serverT } from '@/lib/i18nServer';
import { ensureExampleBazaarOnce } from '@/lib/exampleBazaar';
import { runSubscriptionSweep } from '@/lib/subscriptions';
import ItemTile from '@/components/ItemTile';
import { expansionsFor } from '@/lib/bazaarWords';
import { SHOP_CATEGORIES, categoryLabel } from '@/lib/categories';
import { cropTag, listPublishedEvents, mediaUrl, parseCropRect } from '@/lib/events';
import { FESTIVALS, currentOccurrence } from '@/lib/festivals';
import type { Festival, FestivalOccurrence } from '@/lib/festivals';
import { loadFeedSnapshot } from '@/lib/feedSnapshot';
import { howItWorks } from '@/lib/howItWorks';
import {
  SORTS,
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
import type { Facet } from '@/lib/marketItems';
import {
  PER_PAGE,
  capFacet,
  filtersOf,
  hrefFor,
  isSlice,
  named,
  pageWindow,
  readQuery,
  shopNames,
  townKey,
  townNames,
} from '@/lib/marketQuery';
import type { SearchParams } from '@/lib/marketQuery';
import { platformNameFromEnv } from '@/lib/platform';
import { vocabFor } from '@/lib/vocab';
import SwipeFx from '@/components/SwipeFx';

// The public bazaar, goods-first: every item every published shop sells, on
// one page, the moment it opens — searchable, filterable and sortable.
//
// It used to be a front page (hero, seven department cards, item rails, then
// shelves of shop cards) with the actual wall of goods a click away on
// /market/items. The owner's verdict on that was the right one: a visitor who
// opens a bazaar wants to see the things for sale, the way a shopping site
// shows products before it shows departments. So the wall IS the page now,
// and the departments and the shops — which still matter, because "sweets"
// and "Sarita's kitchen" are both how people narrow a search — are small
// chips above the grid rather than sections that push it below the fold.
// /market/items redirects here with its query string intact.
//
// Everything that narrows or reorders this page is a plain GET — two small
// forms (search, sort) and links for every chip, pill and page number. No
// JavaScript runs to produce a result, which is not nostalgia: a result here is
// a URL somebody can send to a friend, the back button returns to it, and a
// search engine that follows a chip sees exactly what a visitor sees. The
// machinery that decides WHICH items lives in lib/marketItems as pure functions
// over rows this page already has in memory, and the URL reading and writing
// lives in lib/marketQuery, so a query with five filters and a sort costs the
// same fixed statements the bare page costs.
//
// Live availability shows on every tile — always render fresh.
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<SearchParams>;
}

/** How many towns and sellers the chip rows offer before they stop. A row
    that scrolls is fine; a row that scrolls past forty sellers is a list
    nobody reaches the end of, and the search box finds the rest by name. */
const MAX_TOWN_CHIPS = 10;
const MAX_SELLER_CHIPS = 40;

/**
 * Which shelf a festival sends a shopper to, and what they would be going for.
 *
 * A hand-kept table beside the hand-kept calendar in lib/festivals, and it has
 * to be hand-kept for the same reason: nothing in the data says that Tihar
 * means a sweet box and Teej means a red sari. That is knowledge about the
 * festival, not about the shop, and guessing it from a category name would put
 * "Jewellery" in front of somebody shopping for Chhath.
 *
 * The phrase is what people buy, in their own words. It is never a claim that
 * a seller HAS it — the line only links to a shelf that currently holds
 * something.
 */
const FESTIVAL_SHELVES: Record<string, { shelf: string; going: string }> = {
  dashain: { shelf: 'khaja-food', going: 'sel roti and a khaja set for Tika day' },
  tihar: { shelf: 'sweets-bakery', going: 'the sweet box you carry to somebody else’s house' },
  chhath: { shelf: 'sweets-bakery', going: 'thekuwa and what goes in the basket for the ghat' },
  teej: { shelf: 'clothing-fabrics', going: 'a red sari, pote, and dar before the fasting day' },
  holi: { shelf: 'khaja-food', going: 'what you cook for friends who arrive covered in colour' },
  'nepali-new-year': { shelf: 'khaja-food', going: 'food for the picnic the spring get-together runs on' },
  'sonam-lhosar': { shelf: 'khaja-food', going: 'khapse and the plates a Lhosar table is laid with' },
  'tamu-lhosar': { shelf: 'khaja-food', going: 'khapse and the plates a Lhosar table is laid with' },
  'gyalpo-lhosar': { shelf: 'khaja-food', going: 'khapse and the plates a Lhosar table is laid with' },
  'saraswati-puja': { shelf: 'other', going: 'puja things, and a pen for a child starting to write' },
  'buddha-jayanti': { shelf: 'handicrafts', going: 'butter lamps, incense and prayer flags' },
};

/** How far ahead a festival may be and still be worth a line on this page. */
const FESTIVAL_HORIZON_DAYS = 45;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = readQuery(await searchParams);
  const name = platformNameFromEnv();
  const title = 'Nepali shops in Germany — order food, sweets & crafts';
  // Kept under the ~155 characters a search result shows. The words that earn
  // the click are the goods and the country, so they go first and the platform
  // name — which is already the title's suffix — goes last or not at all.
  const description =
    'Order momo, sel roti, sweets, spices and crafts from Nepali sellers across Germany. ' +
    `Pay the seller directly, collect with a QR code. Free on ${name}.`;
  return {
    title,
    description,
    // Canonical to the BARE page, always. Every search, every shelf, every town
    // and every page number is a slice of this one list, and asking Google to
    // hold a URL per combination is how a site fills an index with near-
    // identical thin pages.
    alternates: { canonical: '/market' },
    // …and a slice is not offered for indexing at all, though the links on it
    // are still worth following through to the item pages.
    ...(isSlice(query) ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: 'website', title, description, url: '/market', images: shareImages() },
  };
}

/** Two dates as whole days apart, both read as UTC — see listedAtMs in
    lib/marketItems for why a bare SQLite-shaped date must never be handed to
    Date.parse without its Z. These are ISO dates from the festival table, so
    the same fix applies: midnight UTC on both sides, never local midnight,
    or a visitor in Berlin and one in Kathmandu get different countdowns. */
function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

interface NearFestival {
  festival: Festival;
  occurrence: FestivalOccurrence;
  /** Whole days from today to the first day. Zero today, negative once it is on. */
  days: number;
}

/**
 * The one festival close enough ahead to be worth shopping for, or null.
 *
 * currentOccurrence() deliberately keeps a finished festival visible for two
 * months afterwards — the festival PAGES want that. A shopping line does not:
 * nobody is ordering sel roti for a Tika that happened three weeks ago. So a
 * finished occurrence is dropped here, and only the next 45 days count —
 * roughly when a household starts buying rather than only remembering.
 *
 * null is the normal state for most of the year, and it renders nothing.
 */
function nearestFestival(today: Date): NearFestival | null {
  const iso = today.toISOString().slice(0, 10);
  let best: NearFestival | null = null;
  for (const festival of FESTIVALS) {
    const occurrence = currentOccurrence(festival, today);
    if (!occurrence || occurrence.end < iso) continue;
    const days = daysBetween(iso, occurrence.start);
    if (days > FESTIVAL_HORIZON_DAYS) continue;
    if (!best || days < best.days) best = { festival, occurrence, days };
  }
  return best;
}

/** "in 23 days" / "tomorrow" / "today" / "on now" — only ever the true one. */
function whenPhrase(days: number): string {
  if (days < 0) return 'is on now';
  if (days === 0) return 'starts today';
  if (days === 1) return 'starts tomorrow';
  return `starts in ${days} days`;
}

/** A festival date as a shopper reads it; the year is left off because
    everything this line shows is inside the next six weeks. */
function festivalDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

/**
 * One chip. A link, always — the active one links to the URL WITHOUT itself,
 * so every chip on the page is a toggle and the visitor can click their way
 * back off any filter, which is the thing a filter row most often gets wrong.
 */
function Chip({
  href,
  on,
  muted,
  label,
  children,
}: {
  href: string;
  on: boolean;
  muted?: boolean;
  /** The spoken name when the visible content is more than plain text. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <Link
      className={`bz-chip${on ? ' bz-chip-on' : ''}${muted ? ' bz-chip-muted' : ''}`}
      href={href}
      aria-current={on ? 'true' : undefined}
      aria-label={label ? (on ? `${label} — remove this filter` : label) : undefined}
    >
      {children}
    </Link>
  );
}

export default async function MarketPage({ searchParams }: Props) {
  // A hosted site that has never had the example shops gets them once, in the
  // background (lib/exampleBazaar). One indexed read on every later visit.
  ensureExampleBazaarOnce();
  // Places any Subscribe & save repeats that are due (self-throttled).
  void runSubscriptionSweep().catch((e) => console.error('Subscription sweep failed:', e));
  const tr = await serverT();
  const query = readQuery(await searchParams);
  const v = vocabFor('shop');
  const f = filtersOf(query);
  const terms = queryTerms(query.q);
  // The Nepali/English connections this particular search leaned on, so the
  // page can name them under the results. Computed from what was TYPED rather
  // than from what matched — a shopper deserves to know the site widened their
  // word whether or not the widening found anything.
  const expansions = expansionsFor(terms);

  const shops = listPublishedEvents().filter((e) => e.kind === 'shop');
  // The shops' own photos, for the round avatar on each shop chip. The same
  // snapshot the homepage feed reads; see lib/feedSnapshot. A second fixed
  // read beside listShopItems' five — fixed is the rule that matters, never a
  // reader inside a loop.
  const snapshot = loadFeedSnapshot(shops);
  const all = listShopItems();
  const results = filterShopItems(all, f);

  // Every facet counts against the items matching every OTHER active filter,
  // with its own dimension cleared — the rule lib/marketItems documents at
  // length. Count against the fully filtered list instead and the moment
  // somebody picks Berlin every other town reads "0" and the visitor is
  // trapped in the town they clicked, with the page telling them, wrongly,
  // that the bazaar sells nothing anywhere else. Six more passes over an array
  // already in memory; no filter here opens a second database connection.
  const forShelf = filterShopItems(all, { ...f, category: '' });
  const forCity = filterShopItems(all, { ...f, city: '' });
  const forShop = filterShopItems(all, { ...f, shop: '' });
  const forBand = filterShopItems(all, { ...f, band: '' });
  const forStock = filterShopItems(all, { ...f, inStock: false });
  const forQuery = filterShopItems(all, { ...f, q: '' });

  // The department chips: always all seven. A shelf nobody stocks is shown
  // muted rather than hidden — it is a door to a department page that tells a
  // would-be seller exactly what belongs there, and the empty ones are the
  // whole recruiting pitch. A shelf with goods that merely fall outside the
  // current filters stays a filter link, and lands on an honest empty state.
  const shelfCounts = countByCategory(forShelf);
  const shelfTotals = countByCategory(all);

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
  // the chip carries a small "example" tag of its own — the one place on the
  // site a made-up shop must never look like a real one.
  const exampleShops = new Set(all.filter((i) => i.isExample).map((i) => i.shopSlug));
  const sellerLabel = (row: Facet) =>
    exampleShops.has(row.key) ? `${row.label} · example shop` : row.label;

  // A shop's round profile photo, by slug — guarded the way the shop's own
  // page guards it, so a pointer to a deleted photo draws the initial instead
  // of a broken image.
  const avatarOf = new Map<string, string>();
  for (const s of shops) {
    const photos = snapshot.photos.get(s.id) ?? [];
    if (s.profileMediaId && photos.some((m) => m.id === s.profileMediaId)) {
      avatarOf.set(s.slug, mediaUrl(s.profileMediaId, 'avatar', cropTag(parseCropRect(s.profileCrop))));
    }
  }

  const townChips = capFacet(cityRows, cityKey, MAX_TOWN_CHIPS);
  const shopChips = capFacet(shopRows, query.shop, MAX_SELLER_CHIPS);

  const sorted = sortShopItems(results, query.sort);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  // Clamped rather than refused. ?page=99 in an old link, or a page that has
  // shrunk because a seller sold out, should land on the last page of what
  // there is — a "that page does not exist" for a page that used to exist
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

  // Removable pills for the two filters that are not a chip the visitor can
  // see: the search text (which lives in the box, not in a row) and the seller
  // (whose chip may be scrolled out of sight in a long row). Town, price and
  // stock are their own removers — the highlighted chip links to the page
  // without itself — and a pill for each would be the same control twice.
  const pills: { key: string; label: string; href: string }[] = [];
  if (query.q) pills.push({ key: 'q', label: `“${query.q}”`, href: hrefFor(query, { q: '' }) });
  if (query.shop) {
    const row = shopRows.find((s) => s.key === query.shop);
    pills.push({
      key: 'shop',
      label: row ? sellerLabel(row) : query.shop,
      href: hrefFor(query, { shop: '' }),
    });
  }

  const exampleCount = pageItems.filter((i) => i.isExample).length;
  const realCount = pageItems.length - exampleCount;
  // The state the bazaar is genuinely in for now: the site publishes its own
  // example shops, and while the real sellers are still arriving those can be
  // most of what a visitor scrolls past. Counted over the tiles on THIS page,
  // because "most of what is on this page" has to be true of the page the
  // visitor is looking at; realTotal is over the whole result set, which is
  // the only thing that can answer "has a real seller listed anything like
  // this at all".
  const mostlyExamples = pageItems.length > 0 && exampleCount > pageItems.length / 2;
  const realTotal = results.filter((i) => !i.isExample).length;
  // Only offered under the featured sort, which is the one that puts real
  // sellers ahead of example shops.
  const realFirst = query.sort === 'featured';

  // Drawn from the goods matching every filter EXCEPT the search box, so every
  // suggestion returns at least one result on the page the visitor is standing
  // on. Suggesting a word that leads to an empty page teaches somebody that
  // the search is broken.
  const suggestions = searchSuggestions(forQuery);

  const near = nearestFestival(new Date());
  const festivalShelf = near ? FESTIVAL_SHELVES[near.festival.slug] : undefined;
  // Only when that shelf actually holds something — a line pointing at an
  // empty department would be the page promising sweets for Tihar on the
  // strength of a lookup table rather than of a seller.
  const festivalShelfHasGoods = Boolean(
    festivalShelf && (shelfTotals.get(festivalShelf.shelf) ?? 0) > 0
  );

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

  // The hidden fields both forms carry, so a new search keeps the visitor's
  // shelf and town and a new sort keeps their search. Rendered only when set,
  // because an empty hidden field writes `&city=` into the URL and that is a
  // second address for this same page. Neither form carries the page number:
  // a changed search or sort means page one.
  const carried = (omit: 'q' | 'sort') => (
    <>
      {omit !== 'q' && query.q && <input type="hidden" name="q" value={query.q} />}
      {query.category && <input type="hidden" name="category" value={query.category} />}
      {query.city && <input type="hidden" name="city" value={query.city} />}
      {query.shop && <input type="hidden" name="shop" value={query.shop} />}
      {query.band && <input type="hidden" name="band" value={query.band} />}
      {query.inStock && <input type="hidden" name="stock" value="1" />}
      {omit !== 'sort' && query.sort !== 'featured' && (
        <input type="hidden" name="sort" value={query.sort} />
      )}
    </>
  );

  return (
    <>
      {/* The sideways rows (departments, shops, filters, item rails) swipe
          like the homepage's: edges dimmed, a one-time nudge. */}
      <SwipeFx selector=".bz-chips, .bz-rail-track" />
      {/* Only on the page Google is allowed to keep. Every filtered slice is
          noindex (see generateMetadata), and handing a crawler a product list
          for a page we have just asked it to forget is noise at best. */}
      {!filtered && pageItems.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(listLd)} />
      )}

      {/* The hero is one band: the name of the page on the left, the search on
          the right, wrapping under it on a phone. Nothing else — every pixel
          this takes is a pixel the goods are not in. */}
      <section className="feed-hero bz-hero">
        <div className="container bz-hero-row">
          <div className="bz-hero-text">
            <p className="feed-kicker anim-fade-up">
              <Np>नेपाली बजार</Np> · {tr('bz.kicker')}
            </p>
            <h1 className="bz-hero-title anim-fade-up anim-d1">
              {tr('bz.title')}
            </h1>
          </div>
          {all.length > 0 && (
            /* A plain GET form: what a visitor types lands in the URL, so a
               result is a link they can send to a friend and a page the back
               button returns to. The <datalist> is the browser's own
               suggestion list, drawn from goods on sale this minute. */
            <form action="/market" method="get" role="search" className="bz-search bz-hero-search anim-fade-up anim-d2">
              {/* Results update as you type (LiveSearchInput); Enter and the
                  button still submit the plain form without JavaScript. */}
              <LiveSearchInput
                listId={suggestions.length > 0 ? 'bz-market-hints' : undefined}
                ariaLabel={`Search every ${v.unit} on sale in the bazaar`}
                defaultValue={query.q}
                placeholder={tr('bz.placeholder')}
              />
              <button className="btn btn-brand bz-search-btn" type="submit">
                {tr('bz.search')}
              </button>
              {carried('q')}
            </form>
          )}
          {suggestions.length > 0 && (
            <datalist id="bz-market-hints">
              {suggestions.map((hint) => (
                <option key={hint} value={hint} />
              ))}
            </datalist>
          )}
        </div>
      </section>

      <section className="section bz-wall">
        <div className="container">
          {shops.length === 0 ? (
            // Zero shops ever: the state the page launches in. It still has to
            // be worth arriving at — say what is coming, and invite the person
            // who could stock the first shelf.
            <div className="bz-empty" style={{ maxWidth: 620, margin: '10px auto 0' }}>
              <h2 className="feed-section-title anim-fade-up">The shelves are going up</h2>
              <p className="muted anim-fade-up anim-d1" style={{ margin: '10px 0 0' }}>
                The first shops are being set up right now. Soon this page will be where you order
                momo, festival sweets, spices and crafts from Nepali sellers across Germany — and
                if you are one of the people who makes those things, the first shelf could be
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
          ) : all.length === 0 ? (
            /* Shops, but not one of them has a visible item on sale — mid-setup,
               or everything hidden for the week. No search box over it: a
               control that can only ever return nothing is a trap. The shops
               themselves are still worth a link. */
            <div className="bz-empty" style={{ maxWidth: 620, margin: '10px auto 0' }}>
              <h2 className="feed-section-title anim-fade-up">Nothing on the shelves yet</h2>
              <p className="muted anim-fade-up anim-d1" style={{ margin: '10px 0 0' }}>
                {shops.length === 1 ? 'One shop has' : `${shops.length} shops have`} opened here but
                nothing is listed for sale at the moment — sellers often list a batch for a
                particular weekend rather than keeping a permanent counter.
              </p>
              <nav className="bz-chips anim-fade-up anim-d2" aria-label="Shops" style={{ justifyContent: 'center' }}>
                {shops.map((s) => (
                  <Link key={s.id} className="bz-chip" href={`/e/${s.slug}`}>
                    {s.name}
                  </Link>
                ))}
              </nav>
              <p className="anim-fade-up anim-d2" style={{ marginTop: 18 }}>
                <Link href="/organizers" className="btn btn-brand">
                  Open your shop — it&rsquo;s free
                </Link>
              </p>
            </div>
          ) : (
            <>
              {/* Departments: "All" and the seven shelves, each a toggle. The
                  Nepali name leads, small, because it is the word a Nepali
                  shopper recognises first; the English label is the translation. */}
              <nav className="bz-chips" aria-label="Departments">
                <Chip href={hrefFor(query, { category: '' })} on={!query.category}>
                  <span>{tr('bz.all')}</span>
                  <span className="bz-chip-count">{forShelf.length}</span>
                </Chip>
                {SHOP_CATEGORIES.map((shelf) => {
                  const count = shelfCounts.get(shelf.key) ?? 0;
                  const on = query.category === shelf.key;
                  const emptyShelf = (shelfTotals.get(shelf.key) ?? 0) === 0;
                  return (
                    <Chip
                      key={shelf.key}
                      // An unstocked shelf goes to its department page, which
                      // says what belongs on it — that page is the recruiting
                      // pitch, and a filter to zero items would not be.
                      href={emptyShelf ? `/market/c/${shelf.key}` : hrefFor(query, { category: on ? '' : shelf.key })}
                      on={on}
                      muted={count === 0 && !on}
                      label={`${shelf.label}${count === 0 ? ' — nothing here yet' : ''}`}
                    >
                      <span className="bz-chip-np" lang="ne">
                        {shelf.np}
                      </span>
                      <span>{shelf.label}</span>
                      <span className="bz-chip-count">{count}</span>
                    </Chip>
                  );
                })}
              </nav>

              {/* Shops: every seller with something on sale under the other
                  filters, busiest first, with their round photo where they
                  have one. Also toggles. */}
              {shopChips.length > 0 && (
                <nav className="bz-chips bz-chips-shops" aria-label="Shops">
                  {shopChips.map((row) => {
                    const on = row.key === query.shop;
                    const avatar = avatarOf.get(row.key);
                    return (
                      <Chip
                        key={row.key}
                        href={hrefFor(query, { shop: on ? '' : row.key })}
                        on={on}
                        muted={row.count === 0 && !on}
                        label={sellerLabel(row)}
                      >
                        {avatar ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img className="bz-chip-avatar" src={avatar} alt="" loading="lazy" />
                        ) : (
                          <span className="bz-chip-avatar bz-chip-avatar-blank" aria-hidden="true">
                            {row.label.trim().charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span>{row.label}</span>
                        {exampleShops.has(row.key) && <span className="bz-chip-tag">example</span>}
                        <span className="bz-chip-count">{row.count}</span>
                      </Chip>
                    );
                  })}
                  {shopRows.length > shopChips.length && (
                    <span className="bz-chips-note">
                      the {shopChips.length} busiest of {shopRows.length} — search a name for the rest
                    </span>
                  )}
                </nav>
              )}

              {/* The toolbar: how many, the small toggles, and the sort. The
                  sort is its own GET form with an always-visible Apply — no
                  JavaScript, so there is no change handler to submit it, and a
                  select that silently does nothing is worse than no sort. */}
              <div className="bz-toolbar bz-bar">
                <p className="bz-toolbar-count">
                  {total} {total === 1 ? tr('bz.item') : tr('bz.items')}
                </p>
                <div className="bz-chips bz-chips-inline" role="group" aria-label="Filters">
                  {/* Held to the same rule as every other facet: a toggle that
                      would empty the page is not offered, and the one the
                      visitor is standing on is offered even at zero. */}
                  {(inStockCount > 0 || query.inStock) && (
                    <Chip href={hrefFor(query, { inStock: !query.inStock })} on={query.inStock} label={tr('bz.inStock')}>
                      <span>{tr('bz.inStock')}</span>
                      <span className="bz-chip-count">{inStockCount}</span>
                    </Chip>
                  )}
                  {/* Towns only when there is a choice to make — one town is
                      a fact, not a filter. */}
                  {(cityRows.length > 1 || query.city) &&
                    townChips.map((row) => {
                      const on = row.key === cityKey;
                      return (
                        <Chip key={row.key} href={hrefFor(query, { city: on ? '' : row.key })} on={on} label={`Collect in ${row.label}`}>
                          <span>{row.label}</span>
                          <span className="bz-chip-count">{row.count}</span>
                        </Chip>
                      );
                    })}
                  {bandRows.length > 1 &&
                    bandRows.map((row) => {
                      const on = row.key === query.band;
                      return (
                        <Chip key={row.key} href={hrefFor(query, { band: on ? '' : row.key })} on={on} label={row.label}>
                          <span>{row.label}</span>
                          <span className="bz-chip-count">{row.count}</span>
                        </Chip>
                      );
                    })}
                </div>
                <form action="/market" method="get" className="bz-sort" aria-label="Sort">
                  <label htmlFor="bz-sort-by">{tr('bz.sort')}</label>
                  <select id="bz-sort-by" name="sort" aria-label="Sort by" defaultValue={query.sort}>
                    {SORTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-sm" type="submit">
                    {tr('bz.apply')}
                  </button>
                  {carried('sort')}
                </form>
              </div>

              {(pills.length > 0 || filtered) && (
                <ul className="bz-pills" aria-label="Filters you have set">
                  {pills.map((pill) => (
                    <li key={pill.key}>
                      <Link className="bz-pill" href={pill.href} aria-label={`Remove filter: ${pill.label}`}>
                        <span>{pill.label}</span>
                        <span className="bz-pill-x" aria-hidden="true">
                          ×
                        </span>
                      </Link>
                    </li>
                  ))}
                  {filtered && (
                    <li>
                      <Link className="bz-pill bz-pill-clear" href="/market">
                        Clear all
                      </Link>
                    </li>
                  )}
                </ul>
              )}

              {total === 0 ? (
                /* Matched nothing. The honest version says what was searched,
                   does not pretend a near-miss was found, and hands back every
                   way out. */
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
                        Nothing is left once the other filters you set are applied. The {v.unit} you
                        are after may be in another town, at another price, or from a seller you
                        have filtered out — take one filter off and look again.
                      </>
                    ) : terms.length > 0 && query.category ? (
                      <>
                        No {v.unit} on the {categoryLabel(query.category)} shelf mentions that. It
                        may be on another shelf, or nobody is selling it here yet — the bazaar is
                        still filling up.
                      </>
                    ) : terms.length > 0 ? (
                      <>
                        We searched every {v.unit} name, the sellers&rsquo; own descriptions, and the
                        shop names and towns. Nobody is selling that here yet — the bazaar is still
                        filling up, so it is worth looking again.
                      </>
                    ) : query.category && !narrowed ? (
                      <>
                        No shop has listed anything on this shelf so far.{' '}
                        <Link href={`/market/c/${query.category}`} style={{ textDecoration: 'underline' }}>
                          What belongs here
                        </Link>
                        , if it is yours to sell.
                      </>
                    ) : (
                      <>
                        Nothing on sale is left once these filters are applied. Take one off — each
                        highlighted chip above removes only itself.
                      </>
                    )}
                  </p>
                  {/* Real words drawn from goods on sale right now, so every
                      one of them lands on results. Capped at six: a consolation,
                      not a second search box. */}
                  {suggestions.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <p className="muted small" style={{ margin: '0 0 8px' }}>
                        On the shelves right now:
                      </p>
                      <div className="chip-row">
                        {suggestions.slice(0, 6).map((word) => (
                          <Link key={word} className="chip" href={hrefFor(query, { q: word, page: 1 })}>
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
                    {narrowed && (terms.length > 0 || query.category) && (
                      <>
                        <Link
                          className="btn"
                          href={hrefFor(query, { city: '', shop: '', band: '', inStock: false })}
                        >
                          {terms.length > 0
                            ? 'Drop the filters, keep the search'
                            : 'Drop the filters, keep the shelf'}
                        </Link>{' '}
                      </>
                    )}
                    <Link className="btn btn-brand" href="/market">
                      Show everything on sale
                    </Link>
                  </p>
                </div>
              ) : (
                <>
                  <div className="bz-grid" style={{ marginTop: 12 }}>
                    {/* Compact: the shelf badge repeats the chip row above, and
                        the example-shop sentence is said once, under the grid,
                        instead of on every tile. The price, the seller and the
                        Example mark stay on every tile regardless. */}
                    {pageItems.map((item) => (
                      <ItemTile key={`${item.shop.id}:${item.tier.tierKey}`} item={item} compact />
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <nav aria-label="Result pages">
                      <ul className="bz-pages">
                        {page > 1 && (
                          <li>
                            <Link className="bz-page-link" rel="prev" href={hrefFor(query, { page: page - 1 })}>
                              ← Previous
                            </Link>
                          </li>
                        )}
                        {pageWindow(page, totalPages).map((n, i) =>
                          n === 'gap' ? (
                            /* Punctuation, not a control: the numbers it stands
                               for are reachable from the page it sits beside. */
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
                              <Link className="bz-page-link" href={hrefFor(query, { page: n })} aria-label={`Page ${n}`}>
                                {n}
                              </Link>
                            </li>
                          )
                        )}
                        {page < totalPages && (
                          <li>
                            <Link className="bz-page-link" rel="next" href={hrefFor(query, { page: page + 1 })}>
                              Next →
                            </Link>
                          </li>
                        )}
                      </ul>
                    </nav>
                  )}

                  {/* Everything that explains the grid sits UNDER it. The goods
                      are the first thing on the page; the notes about them are
                      for whoever scrolls past the last row. */}
                  <div className="bz-below">
                  {/* One quiet line saying what the grid is, which slice of it
                      is on screen, and what order it is in — in the sort's own
                      words, because an arrangement a shop will not describe is
                      one it is asking to be trusted about. */}
                  <p className="muted small bz-results-line">
                    {filtered ? (
                      <>
                        <strong>
                          {total} {noun}
                        </strong>{' '}
                        {terms.length > 0 ? (
                          <>
                            matching &ldquo;{query.q}&rdquo;
                            {query.category ? <> on the {categoryLabel(query.category)} shelf</> : null}
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
                        from {shopCount === 1 ? 'one shop' : `${shopCount} shops`}.{' '}
                      </>
                    )}
                    {totalPages > 1 ? (
                      <>
                        Showing {start + 1}&ndash;{start + pageItems.length} of {total}, page {page} of{' '}
                        {totalPages}.{' '}
                      </>
                    ) : null}
                    {activeSort.explainer}
                    {terms.length > 0 && (
                      <> Searched in {v.unit} names, the sellers&rsquo; descriptions, and shop names and towns.</>
                    )}
                    {/* Why a jar labelled in a language you do not read came
                        back: the search knows some things have two names, and
                        this is it saying which one it used. */}
                    {expansions.map((e) => (
                      <span key={e.label}>
                        {' '}
                        &ldquo;{e.typed}&rdquo; also matches <strong>{e.label}</strong>.
                      </span>
                    ))}
                  </p>

                  {mostlyExamples && (
                    <p className="notice" style={{ marginTop: 12, maxWidth: 720 }}>
                      Most of what is on this page right now is <strong>example shops</strong> —
                      shops the site publishes itself so a Nepali seller can see their own before
                      they build it. Every one of them is marked, and nothing on them can be ordered
                      or collected.
                      {realCount > 0 ? (
                        <>
                          {' '}
                          The {realCount} unmarked {realCount === 1 ? v.unit : v.units} on this page{' '}
                          {realCount === 1 ? 'is' : 'are'} from real sellers
                          {realFirst ? <>, and the featured order puts them first</> : null}.
                        </>
                      ) : realTotal > 0 ? (
                        <>
                          {' '}
                          {realTotal} unmarked {realTotal === 1 ? v.unit : v.units} from real sellers{' '}
                          {realTotal === 1 ? 'matches' : 'match'} this too —{' '}
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

                  {/* One line, only when a festival is genuinely near — the warmest
                      thing on the page, and the smallest. */}
                  {near && (
                    <p className="bz-festival-line">
                      <span lang="ne">{near.festival.nameNe}</span>{' '}
                      <strong>
                        {near.festival.name} {whenPhrase(near.days)}
                      </strong>{' '}
                      — {near.occurrence.mainDayName} falls on {festivalDate(near.occurrence.mainDay)}.{' '}
                      {festivalShelf && festivalShelfHasGoods ? (
                        <>
                          People look on{' '}
                          <Link href={hrefFor(query, { category: festivalShelf.shelf, q: '', page: 1 })}>
                            {categoryLabel(festivalShelf.shelf)}
                          </Link>{' '}
                          for {festivalShelf.going}.
                        </>
                      ) : (
                        <>Sellers list what they are making for it in their own shops.</>
                      )}{' '}
                      <Link href={`/${near.festival.slug}`}>Dates &amp; what&rsquo;s on →</Link>
                    </p>
                  )}
                  </div>
                </>
              )}

              {/* How buying here actually WORKS — collapsed, at the bottom.
                  The goods are the point of this page; an explainer above them
                  would be a wall of process in front of the thing people came
                  for, and one open below them is a screen of text under the
                  last row. The four steps come from lib/howItWorks, the same
                  function every seller's own page calls, so this page and a
                  shop's page cannot promise different things. 'varies' is what
                  this page honestly knows about payment — each seller chooses
                  their own routes. */}
              <details className="bz-how">
                <summary>How ordering works here</summary>
                <p className="muted" style={{ margin: '10px 0 0' }}>
                  Every shop is run by its own seller. You order from them, pay them, and collect
                  from them — {platformNameFromEnv()} is only the software in between, and never
                  touches the money.
                </p>
                <ol className="step-list" style={{ maxWidth: 680, marginTop: 16 }}>
                  {howItWorks('varies', 'shop').map((item, i) => (
                    <li className="step-item" key={item.title}>
                      <span className="step-num">{i + 1}</span>
                      <div>
                        <div className="tier-name">{item.title}</div>
                        <p className="tier-desc" style={{ margin: '2px 0 0' }}>
                          {item.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="muted small" style={{ maxWidth: 680, margin: '4px 0 0' }}>
                  Each seller sets their own prices, their own collection days and how long they
                  hold an order — their shop&rsquo;s own page says which, and that page is the one
                  that counts.
                </p>
              </details>

              {/* One quiet line for the seller scrolling past the shelves and
                  thinking "I could do this" — because they can, for nothing. */}
              <p className="muted" style={{ textAlign: 'center', marginTop: 28 }}>
                Have something to sell?{' '}
                <Link href="/organizers" style={{ textDecoration: 'underline' }}>
                  A shop here is free
                </Link>{' '}
                — buyers pay you directly, and you hand orders over with one scan.{' '}
                <Link href="/market/saved" style={{ textDecoration: 'underline' }}>
                  Your saved items
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
