import type { Metadata } from 'next';
import Link from 'next/link';
import { SHOP_CATEGORIES, categoryLabel, isShopCategory } from '@/lib/categories';
import { mediaUrl } from '@/lib/events';
import {
  SORT_EXPLAINER,
  countByCategory,
  listShopItems,
  queryTerms,
  searchShopItems,
} from '@/lib/marketItems';
import type { ShopItem } from '@/lib/marketItems';
import { formatMoney } from '@/lib/money';
import { platformNameFromEnv } from '@/lib/platform';
import { vocabFor } from '@/lib/vocab';

// The bazaar, goods-first: every item every published shop sells, on one page,
// searchable.
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
// Live availability on every tile — always render fresh, exactly like the
// listing pages this must never disagree with.
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** A repeated ?q= is a hand-edited URL; the first value is the answer. */
function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
}

/**
 * The page's own address with these two controls set — how a category chip
 * keeps the search it was clicked from, and how the search box stays inside
 * the shelf it was typed in.
 *
 * Empty values are dropped rather than written as `?q=`, so "everything" has
 * exactly ONE URL. Two spellings of the same page is a canonical problem and,
 * more immediately, a chip that never looks active.
 */
function hrefFor(q: string, category: string): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('c', category);
  const qs = params.toString();
  return qs ? `/market/items?${qs}` : '/market/items';
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = one(sp.q);
  const category = isShopCategory(one(sp.c)) ? one(sp.c) : '';
  const name = platformNameFromEnv();

  // Written for what people actually type — "nepali momo berlin", "sel roti
  // bestellen", "timur kaufen" — rather than for the word this page calls its
  // own contents. Nobody has ever searched for "items".
  const title = 'Nepali food, spices & crafts to order in Germany';
  const description =
    'Search everything Nepali sellers have on sale in Germany: momo and sel roti, festival ' +
    'sweets, timur and gundruk, dhaka, pote and singing bowls. Order from the seller, pay them ' +
    `directly, and collect with a QR code. Free to browse and free to sell, on ${name}.`;

  return {
    title,
    description,
    // Canonical to the BARE page, always. Every search and every shelf is a
    // slice of this one list, and asking Google to hold a URL per query is how
    // a site fills an index with near-identical thin pages.
    alternates: { canonical: '/market/items' },
    // …and a slice is not offered for indexing at all, though the links on it
    // are still worth following through to the item pages.
    ...(q || category ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: 'website', title, description, url: '/market/items' },
  };
}

/** One good, as a tile. Built from the tier-card the shop pages already use. */
function ItemTile({ item }: { item: ShopItem }) {
  const v = vocabFor('shop');
  const { tier, shop } = item;
  const where = [item.shopName, shop.city].filter(Boolean).join(' · ');

  return (
    /* The whole tile is the link, with a spoken name of its own: the visible
       text is a picture, a name, a price and a badge, which a screen reader
       otherwise announces as four unlabelled fragments of the same link. */
    <Link
      href={item.href}
      className="tier-card glow-card tier-card-link"
      aria-label={`${tier.name} — ${where}`}
    >
      {item.photo ? (
        /* The 'card' variant — the same 800x1000 render the shop's own grid
           and the item page serve, so a cross-shop grid costs no new
           derivative on disk and the picture is already cached by the time a
           shopper taps through. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          className="tier-card-photo"
          src={mediaUrl(item.photo.id, 'card', null)}
          alt={`${tier.name} — ${item.shopName}`}
          loading="lazy"
        />
      ) : (
        /* On a SHOP grid a missing photo cannot be left as a shapeless card
           the way it is on an event page: the tiles beside it are pictures,
           and one that simply starts with text reads as a broken image. The
           item's initial on the accent wash — the same treatment the item page
           gives a photo-less row — reads as a decision instead. */
        <div className="tier-card-photo tier-card-photo-blank" aria-hidden="true">
          <span>{tier.name.trim().charAt(0).toUpperCase() || v.Unit.charAt(0)}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className={item.badge.className}>{item.badge.label}</span>
        {/* The example mark, as loud as the availability beside it. The shop's
            listing name carries "(example shop)", but on this page the name is
            a small line under the price — a visitor scanning forty pictures of
            food would read the item name, the price, and nothing else. A
            visitor must never mistake an invented seller for a real one, so
            the fact gets a pill of its own, and the sentence under the tile
            says what it means. */}
        {item.isExample && <span className="badge badge-amber">Example shop</span>}
        {item.categoryName && <span className="badge badge-accent">{item.categoryName}</span>}
      </div>

      <div className="tier-name">{tier.name}</div>
      <div className="tier-price">
        {tier.priceCents === 0 ? 'Free' : formatMoney(tier.priceCents, shop.currency)}
      </div>
      {/* Same sentence the shop's own card prints: the price above is per
          bundle, not per item, and a shopper comparing tiles must know that. */}
      {tier.seatsPerUnit > 1 && (
        <p className="small muted" style={{ margin: 0 }}>
          Includes {tier.seatsPerUnit} {v.units}.
        </p>
      )}
      <p className="tier-desc">{tier.description}</p>

      {/* Whose it is — the disclosed seller, named wherever a price is shown.
          Not decoration: a buyer page that does not name the seller is what
          turns the whole order value into this platform's turnover. */}
      <p className="small muted" style={{ margin: 0 }}>
        {item.isExample ? 'An example shop by ' : 'Sold by '}
        <strong>{item.shopName}</strong>
        {shop.city ? ` · ${shop.city}` : ''}
      </p>
      {item.isExample && (
        <p className="small muted" style={{ margin: 0 }}>
          Published by us to show sellers what their own shop could look like — there is nothing
          here to collect, and checkout will refuse an order.
        </p>
      )}
      <span className="tier-card-go">See this {v.unit} →</span>
    </Link>
  );
}

export default async function MarketItemsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = one(sp.q);
  const rawCategory = one(sp.c);
  // Whitelisted, exactly as the editor's <select> and the server's writer
  // whitelist it. An unknown key shows everything rather than an empty shelf:
  // a retired category in an old bookmark should degrade to the full bazaar,
  // never to a page that looks like the bazaar has closed.
  const category = isShopCategory(rawCategory) ? rawCategory : '';
  const v = vocabFor('shop');

  const all = listShopItems();
  const terms = queryTerms(q);
  // Search first, THEN the shelf — so the chips can honestly say how many
  // results each shelf holds for the search that is actually running.
  const searched = searchShopItems(all, terms);
  const counts = countByCategory(searched);
  const shown = category ? searched.filter((i) => i.categoryKey === category) : searched;

  const shelves = SHOP_CATEGORIES.filter(
    // A shelf with nothing on it under this search is not offered — a chip
    // that leads to "0 items" is a dead end wearing a button's clothes. The
    // one currently selected always stays, or clicking it would make it
    // vanish and strand the visitor on a page with no way back to it.
    (c) => (counts.get(c.key) ?? 0) > 0 || c.key === category
  );

  const exampleCount = shown.filter((i) => i.isExample).length;
  const realCount = shown.length - exampleCount;
  // The state the bazaar is genuinely in for now: the site publishes its own
  // example shops, and while the real sellers are still arriving those can be
  // most of what a visitor scrolls past. Every tile says so on its own, but a
  // grid where the marked ones dominate needs the reason once, in words, at
  // the top — otherwise the honest chips read as clutter rather than as the
  // point. Sorting already puts the real sellers first.
  const mostlyExamples = shown.length > 0 && exampleCount > shown.length / 2;

  const filtered = Boolean(terms.length || category);

  return (
    <>
      <section className="feed-hero" style={{ padding: '56px 0 28px' }}>
        <div className="container">
          <p className="feed-kicker anim-fade-up">नेपाली बजार · Everything on sale</p>
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
          {/* A plain GET form: the search lands in the URL, so a result is a
              link somebody can send to a friend, a page the back button
              returns to, and a thing that works before any JavaScript has
              loaded. Nothing here needs a framework. */}
          <form action="/market/items" method="get" className="market-search" role="search">
            {/* The shelf rides along as a hidden field so searching inside
                "Sweets & bakery" stays inside it, rather than silently
                throwing away the filter the visitor just set. */}
            {category && <input type="hidden" name="c" value={category} />}
            {/* aria-label rather than a visible <label>: the placeholder shows
                what to type and a heading two lines up already says what this
                searches, so a printed label would only repeat the page. */}
            <input
              className="input"
              type="search"
              name="q"
              aria-label={`Search every ${v.unit} on sale`}
              defaultValue={q}
              placeholder="momo, timur, dhaka topi, Berlin…"
              autoComplete="off"
            />
            <button className="btn btn-brand" type="submit">
              Search
            </button>
            {filtered && (
              <Link className="btn" href="/market/items">
                Clear
              </Link>
            )}
          </form>

          {shelves.length > 0 && (
            <div className="chip-row" style={{ marginTop: 16 }}>
              {/* Every chip carries the current search, so a shelf narrows the
                  search rather than replacing it. */}
              <Link
                href={hrefFor(q, '')}
                className={`chip${category === '' ? ' chip-active' : ''}`}
              >
                Everything ({searched.length})
              </Link>
              {shelves.map((c) => (
                <Link
                  key={c.key}
                  href={hrefFor(q, c.key)}
                  className={`chip${category === c.key ? ' chip-active' : ''}`}
                >
                  {c.label} ({counts.get(c.key) ?? 0})
                </Link>
              ))}
            </div>
          )}

          {all.length === 0 ? (
            /* No shop has anything on sale yet — the state this page launches
               in. Say what is coming and invite the person who could stock the
               first shelf, exactly as /market does for its own empty case. */
            <div style={{ textAlign: 'center', maxWidth: 560, margin: '30px auto 0' }}>
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
          ) : shown.length === 0 ? (
            /* Matched nothing. The honest version says what was searched, does
               not pretend a near-miss was found, and hands back both ways out
               — the same search across every shelf, and the whole bazaar. */
            <div style={{ maxWidth: 620, margin: '30px 0 0' }}>
              <h2 className="feed-section-title">
                {terms.length ? (
                  <>Nothing matched &ldquo;{q}&rdquo;</>
                ) : (
                  <>Nothing on this shelf yet</>
                )}
              </h2>
              <p className="muted" style={{ margin: '10px 0 0' }}>
                {terms.length && category ? (
                  <>
                    No {v.unit} on the {categoryLabel(category)} shelf mentions that. It may be on
                    another shelf, or nobody is selling it here yet — the bazaar is still filling
                    up.
                  </>
                ) : terms.length ? (
                  <>
                    We searched every {v.unit} name, the sellers&rsquo; own descriptions, and the
                    shop names and towns. Nobody is selling that here yet — the bazaar is still
                    filling up, so it is worth looking again.
                  </>
                ) : (
                  <>No shop has listed anything on this shelf so far.</>
                )}
              </p>
              <p style={{ marginTop: 18 }}>
                {terms.length > 0 && category && (
                  <>
                    <Link className="btn" href={hrefFor(q, '')}>
                      Search every shelf
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
              <p className="muted" style={{ margin: '18px 0 0' }}>
                {filtered ? (
                  <>
                    <strong>
                      {shown.length} {shown.length === 1 ? v.unit : v.units}
                    </strong>{' '}
                    {terms.length ? (
                      <>
                        matching &ldquo;{q}&rdquo;
                        {category ? <> on the {categoryLabel(category)} shelf</> : null}
                      </>
                    ) : (
                      <>on the {categoryLabel(category)} shelf</>
                    )}
                    .{' '}
                  </>
                ) : (
                  <>
                    <strong>
                      Everything on sale — {shown.length}{' '}
                      {shown.length === 1 ? v.unit : v.units}
                    </strong>{' '}
                    from {new Set(shown.map((i) => i.shop.id)).size} shops.{' '}
                  </>
                )}
                {SORT_EXPLAINER}
              </p>
              {terms.length > 0 && (
                <p className="muted small" style={{ margin: '4px 0 0' }}>
                  Searched in {v.unit} names, the sellers&rsquo; descriptions, and shop names and
                  towns.
                </p>
              )}

              {mostlyExamples && (
                <p className="notice" style={{ marginTop: 16, maxWidth: 720 }}>
                  Most of what is on this page right now is <strong>example shops</strong> — shops
                  the site publishes itself so a Nepali seller can see their own before they build
                  it. Every one of them is marked, and nothing on them can be ordered or collected.
                  {realCount > 0 ? (
                    <>
                      {' '}
                      The {realCount} unmarked {realCount === 1 ? v.unit : v.units} above{' '}
                      {realCount === 1 ? 'is' : 'are'} from real sellers, and{' '}
                      {realCount === 1 ? 'it comes' : 'they come'} first.
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

              <div className="tier-grid" style={{ marginTop: 18 }}>
                {shown.map((item) => (
                  <ItemTile key={`${item.shop.id}:${item.tier.tierKey}`} item={item} />
                ))}
              </div>

              <p className="muted" style={{ textAlign: 'center', marginTop: 30 }}>
                Looking for a particular seller instead?{' '}
                <Link href="/market" style={{ textDecoration: 'underline' }}>
                  Browse the shops
                </Link>
                {' '}— or, if you have something to sell,{' '}
                <Link href="/organizers" style={{ textDecoration: 'underline' }}>
                  a shop here is free
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
