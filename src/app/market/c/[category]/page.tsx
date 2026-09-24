import { absoluteUrl, itemListJsonLd, jsonLdScript } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import EventCard from '@/components/EventCard';
import ItemTile from '@/components/ItemTile';
import { shopCategory } from '@/lib/categories';
import { listPublishedEvents } from '@/lib/events';
import { loadFeedSnapshot } from '@/lib/feedSnapshot';
import { filterShopItems, listShopItems, queryTerms, searchShopItems } from '@/lib/marketItems';
import type { ShopItem } from '@/lib/marketItems';
import { metaText, shareImages } from '@/lib/seo';
import { platformNameFromEnv } from '@/lib/platform';

// One department of the bazaar: everything filed under a single shelf, shops
// and goods together.
//
// It exists for two people who never meet. The first is a shopper who typed
// "Nepali sweets Germany" into a search engine — /market is a search page
// and asks not to be indexed slice by slice, so without this there is no
// stable, indexable page for "sweets" at all, only a query string. The second
// is a seller wondering where their thing would go: the shelf's own
// description says what belongs here, which is why an EMPTY department is
// still worth publishing and still worth arriving at. It gets an invitation
// rather than an apology.
//
// Live availability shows on every tile — always render fresh.
export const dynamic = 'force-dynamic';

/** How many goods this page shows before it hands over to the search page.
    Twenty-four is two or three screens of the dense grid: enough to judge a
    shelf by, and short of the point where a page that is not paginated starts
    loading a hundred pictures nobody scrolls to. */
const MAX_ITEMS = 24;

interface Props {
  params: Promise<{ category: string }>;
}

/**
 * A search-engine description in the shelf's OWN words, cut to fit.
 *
 * Built from `intro` rather than written twice, because two descriptions of
 * one shelf drift apart the first time somebody edits only one of them — and
 * the one that gets edited is never the one buried in a meta tag.
 *
 * Cut at a sentence, never mid-word: results pages show roughly 155
 * characters, and a description that stops in the middle of "handicraft" reads
 * as a page that is broken rather than as a page that was trimmed. If even the
 * first sentence is longer than that, it goes out whole — a search engine
 * truncating a complete sentence is tidier than this function guessing.
 */
function shelfDescription(intro: string, budget: number): string {
  const sentences = intro.split(/(?<=\.)\s+/);
  let out = '';
  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (out && next.length > budget) break;
    out = next;
  }
  // A first sentence longer than the whole budget used to go out untouched,
  // which is how these pages came to ship 264-character descriptions: the
  // sentence was whole, and then the "order direct" line was added AFTER the
  // measuring was done. metaText is the honest backstop — it cuts on a word
  // and says so with an ellipsis, rather than letting Google cut mid-word.
  return out.length > budget ? metaText(out, budget) : out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const shelf = shopCategory(category);
  // Nothing to describe — the page itself answers this with notFound().
  if (!shelf) return {};

  const name = platformNameFromEnv();
  // The title is written for what people type, not for what this page calls
  // itself: nobody searches for "department". The Nepali name leads the H1 on
  // the page, where a Nepali reader is looking at it; in a list of ten search
  // results the words that have to do the work are the English ones.
  const title = `${shelf.label} from Nepali sellers in Germany`;
  // The suffix is part of what a searcher reads, so it is part of what has to
  // fit — measured first, and the shelf's own words get whatever is left.
  const closing = ` Order direct from the seller on ${name}.`;
  const description = `${shelfDescription(shelf.intro, 155 - closing.length)}${closing}`;

  // A shelf nobody has stocked yet is a heading and an invitation to sellers.
  // It is worth having — a seller deciding what to list should be able to see
  // where their thing would go — and it is not worth a place in Google's
  // index, where it would be a page promising Nepali sweets and delivering an
  // empty grid. `follow` so the links out of it still count; sitemap.ts leaves
  // the same shelves out, so the two agree about every one of the seven.
  const stocked = listPublishedEvents().some(
    (e) => e.kind === 'shop' && e.category === shelf.key
  );

  return {
    title,
    description,
    ...(stocked ? {} : { robots: { index: false, follow: true } }),
    // Unlike a filtered /market, this URL IS worth holding: it is a fixed shelf
    // rather than a slice of a search, its words do not change with a query
    // string, and there are exactly seven of them.
    alternates: { canonical: `/market/c/${shelf.key}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `/market/c/${shelf.key}`,
      images: shareImages(),
    },
  };
}

export default async function DepartmentPage({ params }: Props) {
  const { category } = await params;
  const shelf = shopCategory(category);
  // A retired or mistyped key is a 404 and not an empty department: publishing
  // a page headed by a shelf that does not exist would invite a seller to
  // stock something the editor will never offer them.
  if (!shelf) notFound();

  const shops = listPublishedEvents().filter(
    (e) => e.kind === 'shop' && e.category === shelf.key
  );
  // Only this shelf's shops go into the snapshot, so the read is proportional
  // to what the page actually renders. Two fixed reads on this page — this one
  // and listShopItems' five — because a shop that has opened but listed
  // nothing yet appears in the first and, rightly, in neither the item grid
  // nor listShopItems at all. Fixed is the rule; one loop-free reader per
  // thing being shown is how it stays fixed.
  const snapshot = loadFeedSnapshot(shops);
  const items = filterShopItems(listShopItems(), {
    q: '',
    category: shelf.key,
    city: '',
    shop: '',
    inStock: false,
    band: '',
  });
  const shown = items.slice(0, MAX_ITEMS);

  // The shelf's own vocabulary, offered as searches — but only the words that
  // find something HERE. lib/categories keeps `terms` as a wish list on
  // purpose ("a term for a thing nobody stocks yet costs nothing"), and the
  // cost of forgetting that is a chip on a department page leading to an empty
  // result, which teaches a first-time visitor that the search does not work.
  const terms = shelf.terms.filter(
    (term) => searchShopItems(items, queryTerms(term)).length > 0
  );

  // The shelf, described to a crawler as what it is: a list of products, in
  // the order shown, capped exactly where the grid is capped. An empty shelf
  // publishes nothing — an ItemList of zero items is a page saying "here are
  // the goods" and then showing none.
  const listLd = itemListJsonLd(
    `${shelf.label} from Nepali sellers`,
    shown.map((item) => ({ name: item.tier.name, url: absoluteUrl(item.href) }))
  );

  return (
    <>
      {shown.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(listLd)} />
      )}
      <section className="feed-hero" style={{ padding: '52px 0 26px' }}>
        <div className="container">
          <nav className="bz-crumbs" aria-label="Breadcrumb">
            <Link href="/market">The bazaar</Link>
            <span aria-current="page">{shelf.label}</span>
          </nav>
          <h1 className="anim-fade-up" style={{ fontSize: 'clamp(1.8rem, 4.2vw, 2.7rem)' }}>
            {/* lang="ne" so a screen reader reaches for a Nepali voice rather
                than spelling मिठाई out in English phonemes. Both names, never
                one: the people who shop here read one or the other, and a
                heading that picks for them loses half of them. */}
            <span lang="ne">{shelf.np}</span> · {shelf.label}
          </h1>
          <p className="feed-hero-sub anim-fade-up anim-d1" style={{ marginBottom: 0 }}>
            {shelf.intro}
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 14 }}>
        <div className="container">
          {items.length === 0 && shops.length === 0 ? (
            /* Nobody has stocked this shelf yet.
               An empty department is not a failure to report — it is the one
               page on the site that can tell the person who makes these things
               that there is a whole shelf with their name on it and nobody
               standing at it. So: what belongs here (the intro is already
               above), that it is free, and the way out for a shopper who came
               to buy rather than to sell. */
            <div className="bz-empty" style={{ maxWidth: 620, margin: '0 auto' }}>
              <h2 className="feed-section-title" style={{ margin: 0, color: 'var(--text)' }}>
                Nobody is on this shelf yet
              </h2>
              <p style={{ margin: '10px 0 0' }}>
                No shop on the site sells {shelf.label.toLowerCase()} so far. If that is what you
                make, this shelf is empty and it is free to stand on — buyers pay you directly and
                you hand orders over with one scan.
              </p>
              <p style={{ margin: '18px 0 0' }}>
                <Link className="btn btn-brand" href="/organizers">
                  Open your shop — it&rsquo;s free
                </Link>{' '}
                <Link className="btn" href="/market" style={{ marginLeft: 8 }}>
                  Back to the bazaar &rarr;
                </Link>
              </p>
            </div>
          ) : (
            <>
              <p className="muted" style={{ margin: 0 }}>
                <strong>
                  {items.length === 0
                    ? 'Nothing on sale here right now'
                    : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
                </strong>{' '}
                from {shops.length === 1 ? 'one shop' : `${shops.length} shops`} on this shelf. Each
                one is sold by the seller named on it, who takes the money and hands the order
                over.
              </p>

              {terms.length > 0 && (
                <nav
                  className="bz-quick"
                  aria-label={`Searches within ${shelf.label}`}
                  style={{ justifyContent: 'flex-start', marginTop: 14 }}
                >
                  {terms.map((term) => (
                    <Link
                      key={term}
                      className="bz-quick-chip"
                      href={`/market?q=${encodeURIComponent(term)}&category=${shelf.key}`}
                    >
                      {term}
                    </Link>
                  ))}
                </nav>
              )}

              {shops.length > 0 && (
                <div style={{ marginTop: 30 }}>
                  <h2 className="feed-section-title anim-fade-up">
                    {shops.length === 1 ? 'The shop on this shelf' : 'The shops on this shelf'}
                  </h2>
                  <p className="muted anim-fade-up" style={{ margin: '4px 0 0' }}>
                    {shelf.line}
                  </p>
                  <div className="feed-grid" style={{ marginTop: 18 }}>
                    {shops.map((s) => (
                      <EventCard key={s.id} event={s} snapshot={snapshot} />
                    ))}
                  </div>
                </div>
              )}

              {shown.length > 0 ? (
                <div style={{ marginTop: 38 }}>
                  <h2 className="feed-section-title anim-fade-up">
                    {items.length > MAX_ITEMS
                      ? `Some of what is on sale here`
                      : 'Everything on sale here'}
                  </h2>
                  <p className="muted anim-fade-up" style={{ margin: '4px 0 0' }}>
                    {items.length > MAX_ITEMS ? (
                      <>
                        The first {MAX_ITEMS} of {items.length}, in the bazaar&rsquo;s usual order:
                        in stock first, real sellers before example shops.
                      </>
                    ) : (
                      <>In stock first, then real sellers before example shops.</>
                    )}
                  </p>
                  <div className="bz-grid" style={{ marginTop: 16 }}>
                    {shown.map((item: ShopItem) => (
                      <ItemTile key={`${item.shop.id}:${item.tier.tierKey}`} item={item} />
                    ))}
                  </div>
                  <p style={{ marginTop: 24 }}>
                    {/* The full list, with the filters and the sort on it. This
                        page is the shelf's front window; that page is the one
                        you rummage through. */}
                    <Link className="btn btn-brand" href={`/market?category=${shelf.key}`}>
                      {items.length > MAX_ITEMS
                        ? `See all ${items.length} — filter and sort`
                        : 'Filter and sort these'}
                    </Link>{' '}
                    <Link className="btn" href="/market" style={{ marginLeft: 8 }}>
                      Back to the bazaar &rarr;
                    </Link>
                  </p>
                </div>
              ) : (
                /* Shops here, but not one of them has a visible item on sale —
                   mid-setup, or everything hidden for the week. Said plainly,
                   because a heading over an empty grid would look like a
                   failure to load. */
                <div className="bz-empty" style={{ marginTop: 30, maxWidth: 620 }}>
                  <p style={{ margin: 0 }}>
                    {shops.length === 1 ? 'The shop' : 'The shops'} on this shelf{' '}
                    {shops.length === 1 ? 'has' : 'have'} nothing listed for sale at the moment.
                    Open {shops.length === 1 ? 'it' : 'one'} above — sellers here often list a batch
                    for a particular weekend rather than keeping a permanent counter.
                  </p>
                  <p style={{ margin: '16px 0 0' }}>
                    <Link className="btn" href="/market">
                      Everything on sale in the bazaar &rarr;
                    </Link>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
