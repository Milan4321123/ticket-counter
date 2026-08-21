import { shareImages } from '@/lib/seo';
import Np from '@/components/Np';
import Link from 'next/link';
import EventCard from '@/components/EventCard';
import ItemRail from '@/components/ItemRail';
import ItemTile from '@/components/ItemTile';
import { SHOP_CATEGORIES, isShopCategory } from '@/lib/categories';
import { listPublishedEvents } from '@/lib/events';
import { FESTIVALS, currentOccurrence } from '@/lib/festivals';
import type { Festival, FestivalOccurrence } from '@/lib/festivals';
import { loadFeedSnapshot } from '@/lib/feedSnapshot';
import { howItWorks } from '@/lib/howItWorks';
import {
  countByCategory,
  facetCities,
  filterShopItems,
  listShopItems,
  queryTerms,
  searchShopItems,
  searchSuggestions,
  sortShopItems,
} from '@/lib/marketItems';
import type { ShopItem } from '@/lib/marketItems';
import { platformNameFromEnv } from '@/lib/platform';

// The public bazaar: every published shop on the platform, grouped by the
// shelf its seller picked in the editor (lib/categories). The feed on / mixes
// shops in between events by date; this page is for the person who came to
// BUY SOMETHING — momo for Saturday, a sari before Teej — and wants to browse
// by what is sold, not by when things happen.
//
// It used to be shops and nothing else, which meant a visitor had to guess a
// shop before they could see one thing on sale. Now the goods come first — a
// search box, the seven departments, and a few rows of actual items — and the
// shelves of shops sit under them for the person who came looking for a
// particular seller. Both halves are the same bazaar, and each says which it
// is rather than leaving the visitor to find out by clicking.
//
// Live availability shows on every tile — always render fresh.
export const dynamic = 'force-dynamic';

/**
 * Under this many items in the whole bazaar there are no rails at all.
 *
 * A rail is a claim that a SET of things belong together, and five items split
 * into three rows of two is not five sets — it is the same handful of goods
 * dealt out under headings that imply the bazaar has more behind them. Below
 * the line the page shows one grid holding literally everything and says so,
 * which is both the honest picture and the more useful one while the bazaar is
 * this young.
 */
const RAILS_NEED_ITEMS = 8;

/** How many tiles one rail may hold. Beyond this a row stops being a taster. */
const RAIL_MAX = 12;

/**
 * Six things people actually type, offered as searches rather than as shelves.
 *
 * Searches, deliberately: a shelf is where the seller filed their shop, and
 * "momo" cuts across shelves — a momo listing might sit under Khaja or, from a
 * seller who mostly does groceries, somewhere else entirely. Every one of them
 * is checked against the real goods before it is shown (see below), on the
 * same rule searchSuggestions follows: a chip that leads to an empty page
 * teaches a first-time visitor that the search is broken.
 */
const QUICK_SEARCHES = ['momo', 'sel roti', 'timur', 'dhaka topi', 'achar', 'pote'];

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
 * a seller HAS it — the strip only links to a shelf that currently holds
 * something, and the wording below says "the shelf people look on", not "we
 * have it".
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

/** How far ahead a festival may be and still be worth a strip on this page. */
const FESTIVAL_HORIZON_DAYS = 45;

export function generateMetadata() {
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
    alternates: { canonical: '/market' },
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
 * currentOccurrence() is the site's single answer to "which Dashain does a
 * visitor today mean", and it deliberately keeps a finished festival visible
 * for two months afterwards — the festival PAGES want that, because "how was
 * Dashain this year" is real traffic. A shopping strip does not: nobody is
 * ordering sel roti for a Tika that happened three weeks ago, and a bazaar
 * that says so would be selling against its own calendar. So a finished
 * occurrence is dropped here, and only the next 45 days count.
 *
 * Forty-five days because that is roughly when a household starts buying
 * rather than only remembering: sweets are made to order, a sari has to be
 * chosen, and a seller needs the notice. Further out than that and the strip
 * would be a countdown widget rather than a reason to open a shop.
 *
 * null is the normal state for most of the year, and it renders nothing at
 * all. A permanent "the next festival is in 143 days" band is a countdown
 * nobody asked for taking up the best space on the page.
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

/** "in 23 days" / "tomorrow" / "today" / "on now" — the whole countdown, and
    only ever the true one. An occurrence that has started but not ended reads
    as under way rather than as a negative number of days. */
function whenPhrase(days: number): string {
  if (days < 0) return 'is on now';
  if (days === 0) return 'starts today';
  if (days === 1) return 'starts tomorrow';
  return `starts in ${days} days`;
}

/** A festival date as a shopper reads it. The year is left off on purpose —
    everything this strip shows is inside the next six weeks, so printing 2026
    beside it only invites the question of whether it means next year. */
function festivalDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export default function MarketPage() {
  const shops = listPublishedEvents().filter((e) => e.kind === 'shop');
  // One read of tiers, photos and availability for every tile below — the same
  // snapshot the homepage feed uses. See lib/feedSnapshot.
  const snapshot = loadFeedSnapshot(shops);
  /**
   * Every sellable thing in the bazaar, for the search hints, the department
   * counts and the rails.
   *
   * This is a SECOND fixed read rather than a reuse of `snapshot` above, and
   * that is a deliberate trade. listShopItems does its own five statements; the
   * shelves below need the shops themselves, including the ones that have not
   * listed a single item yet and so appear nowhere in this array. Ten fixed
   * statements is still ten whatever the size of the bazaar, which is the rule
   * that actually matters — the thing forbidden here is a reader called inside
   * a loop, not a second reader called once. (If it ever matters, the fix is
   * for lib/marketItems to hand back the snapshot it already built rather than
   * for this page to start reading shops one at a time.)
   */
  const items = listShopItems();

  // The shelves, in the fixed order of the list — a shelf nobody stocks yet is
  // simply absent, not an empty heading apologising for itself.
  const shelves = SHOP_CATEGORIES.map((c) => ({
    ...c,
    shops: shops.filter((s) => s.category === c.key),
  })).filter((c) => c.shops.length > 0);

  // Shops whose seller has not picked a shelf (or picked one the list no
  // longer knows). They belong on the page every bit as much — a shop is not
  // hidden for skipping an optional field — they just file at the end.
  const uncategorised = shops.filter((s) => !isShopCategory(s.category));

  // The state between "no shops at all" (which has its own page below) and a
  // stocked bazaar — a handful of shops on one or two shelves. It is where
  // this page really sits now that the seed publishes ONE example shop rather
  // than seven (scripts/seed-bazaar.mjs), and it will sit here for a while.
  //
  // It does not LOOK broken: .feed-grid centres its columns at max 300px, so a
  // single tile sits centred at card width instead of stretching across the
  // page. But the hero above promises a bazaar across Germany, and a visitor
  // who then counts two tiles is owed the reason in words rather than left to
  // decide the site is abandoned. One line, and no growth claim we cannot
  // keep.
  const isYoungBazaar = shops.length > 0 && shops.length <= 3;

  // Search hints and quick chips both describe what is on sale RIGHT NOW, so
  // both are computed from the items and neither is offered when there is
  // nothing to search. A search box over an empty bazaar is a trap with a
  // button on it.
  const hints = searchSuggestions(items);
  const quick = QUICK_SEARCHES.filter((term) => searchShopItems(items, queryTerms(term)).length > 0);

  const itemsByShelf = countByCategory(items);
  const near = nearestFestival(new Date());
  const festivalShelf = near ? FESTIVAL_SHELVES[near.festival.slug] : undefined;
  // Only when that shelf actually holds something. A festival strip pointing at
  // an empty department would be the page promising sweets for Tihar on the
  // strength of a lookup table rather than of a seller.
  const festivalShelfHasGoods = Boolean(
    festivalShelf && (itemsByShelf.get(festivalShelf.shelf) ?? 0) > 0
  );

  const rails = buildRails(items);

  return (
    <>
      <section className="feed-hero" style={{ padding: '64px 0 36px' }}>
        <div className="container">
          <p className="feed-kicker anim-fade-up">
            <Np>नेपाली बजार</Np> · The bazaar
          </p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.9rem, 4.4vw, 3rem)' }}>
            The Nepali bazaar, wherever you are in Germany
          </h1>
          {/* "Every shop here belongs to a Nepali seller near you" stopped being
              true the day the site published its own example shops (see
              scripts/seed-bazaar.mjs): those name an invented seller and an
              invented collection address, and a promise like this one is
              exactly what would send somebody to a doorbell that does not
              exist. Naming the marked-out exception keeps the sentence honest
              without softening it — every shop that is NOT marked is still a
              real Nepali seller, which is the claim the real sellers on this
              page have earned. If the example shops ever come down, this
              clause can go with them. */}
          <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 0 }}>
            Momo folded the way somebody&rsquo;s mother taught them. Sel roti for the festival,
            timur for the achar, dhaka for the photo. Every shop here that isn&rsquo;t marked
            &ldquo;example shop&rdquo; belongs to a Nepali seller near you — you order, pay them
            directly, and collect with the QR code on your order. No middleman between you and
            the person who made it.
          </p>

          {items.length > 0 && (
            <>
              {/* A plain GET form to the search page: what a visitor types lands
                  in the URL, so a result is a link they can send to a friend, a
                  page the back button returns to, and a thing that works before
                  any JavaScript has loaded. The <datalist> is the browser's own
                  suggestion list — no dropdown of ours, no keystroke sent
                  anywhere, and every word in it is drawn from goods that are on
                  sale this minute (searchSuggestions in lib/marketItems). */}
              <form
                action="/market/items"
                method="get"
                role="search"
                className="bz-search anim-fade-up anim-d3"
                style={{ marginTop: 22, maxWidth: 560 }}
              >
                <input
                  className="bz-search-input"
                  type="search"
                  name="q"
                  list="bz-market-hints"
                  aria-label="Search everything on sale in the bazaar"
                  placeholder="momo, timur, dhaka topi, Berlin…"
                  autoComplete="off"
                />
                <button className="btn btn-brand bz-search-btn" type="submit">
                  Search
                </button>
              </form>
              {hints.length > 0 && (
                <datalist id="bz-market-hints">
                  {hints.map((hint) => (
                    <option key={hint} value={hint} />
                  ))}
                </datalist>
              )}

              {quick.length > 0 && (
                <nav
                  className="bz-quick anim-fade-up anim-d3"
                  aria-label="Quick searches"
                  style={{ justifyContent: 'flex-start' }}
                >
                  {quick.map((term) => (
                    <Link
                      key={term}
                      className="bz-quick-chip"
                      href={`/market/items?q=${encodeURIComponent(term)}`}
                    >
                      {term}
                    </Link>
                  ))}
                </nav>
              )}
            </>
          )}

          {/* The same bazaar the other way round. Named rather than hinted at,
              because "browse" on its own does not tell anybody which of two
              pages they are about to land on: this one is a wall of SHOPS,
              that one is a wall of GOODS with a search box over it. Somebody
              who came looking for a seller wants this page; somebody who came
              looking for sel roti wants that one, and until now had to guess a
              shop before they could see a single thing on sale. */}
          <p className="anim-fade-up anim-d3" style={{ marginTop: 18 }}>
            <Link href="/market/items" className="btn">
              Browse everything on sale →
            </Link>{' '}
            {/* Quiet, and it has to be: a shopper who has saved nothing gets an
                empty page, so this is a way back to a list they already made
                rather than an invitation to go and make one. */}
            <Link href="/market/saved" style={{ marginLeft: 8, textDecoration: 'underline' }}>
              Your saved items
            </Link>
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container">
          {shops.length === 0 ? (
            // Zero shops ever: the state the page launches in. It still has to
            // be worth arriving at — say what is coming, and invite the person
            // who could stock the first shelf.
            <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
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
          ) : (
            <>
              {isYoungBazaar && (
                <p
                  className="muted anim-fade-up"
                  style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 30px' }}
                >
                  Early days — {shops.length === 1 ? 'one shop' : `${shops.length} shops`} on the
                  shelves so far. The bazaar fills up as sellers join, and joining is free.
                </p>
              )}

              {/* The seven departments, always all seven.
                  A shelf nobody stocks is shown with "nothing yet" rather than
                  hidden, and that is the opposite of the rule the shop shelves
                  below follow, on purpose: down there an empty heading would be
                  a heading with nothing under it, while up here the card is a
                  door to a department page that tells a would-be seller exactly
                  what belongs on that shelf. The empty ones are the whole
                  recruiting pitch, so hiding them would hide it. */}
              <h2 className="feed-section-title anim-fade-up">Departments</h2>
              {/* Not "every shop sits on one of them", which this same page
                  disproves a few hundred pixels further down: the shelf is an
                  optional field in the editor, and the shops whose seller left
                  it blank are gathered under "More from the bazaar" below.
                  Saying otherwise would make the one section a visitor cannot
                  explain look like a bug in the page rather than a seller who
                  has not filled a box in yet. */}
              <p className="muted anim-fade-up" style={{ margin: '4px 0 16px' }}>
                Seven shelves, and a seller picks the one their shop belongs on.
              </p>
              <nav className="bz-depts anim-fade-up" aria-label="Departments">
                {SHOP_CATEGORIES.map((shelf) => {
                  const count = itemsByShelf.get(shelf.key) ?? 0;
                  const shopCount = shops.filter((s) => s.category === shelf.key).length;
                  return (
                    <Link key={shelf.key} className="bz-dept" href={`/market/c/${shelf.key}`}>
                      {/* lang="ne" so a screen reader reaches for a Nepali voice
                          instead of spelling खाजा out in English phonemes. */}
                      <span className="bz-dept-np" lang="ne">
                        {shelf.np}
                      </span>
                      <span className="bz-dept-name">{shelf.label}</span>
                      <p className="bz-dept-line">{shelf.line}</p>
                      <span className="bz-dept-count">{shelfCountLabel(count, shopCount)}</span>
                    </Link>
                  );
                })}
              </nav>

              {near && (
                <div className="bz-festival anim-fade-up" style={{ marginTop: 26 }}>
                  <div className="bz-festival-body">
                    <p className="feed-kicker" style={{ margin: 0 }}>
                      <span lang="ne">{near.festival.nameNe}</span> · The calendar
                    </p>
                    <h2 className="feed-section-title" style={{ margin: '2px 0 0' }}>
                      {near.festival.name} {whenPhrase(near.days)}
                    </h2>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      {near.occurrence.mainDayName} falls on{' '}
                      {festivalDate(near.occurrence.mainDay)}.{' '}
                      {festivalShelf && festivalShelfHasGoods ? (
                        <>The shelf people look on for it is {shelfLabel(festivalShelf.shelf)} —{' '}
                        {festivalShelf.going}.</>
                      ) : (
                        <>
                          Sellers list what they are making for it in their own shops, so it is
                          worth a look through the bazaar as the day gets closer.
                        </>
                      )}
                    </p>
                  </div>
                  <p style={{ margin: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {festivalShelf && festivalShelfHasGoods && (
                      <Link className="btn btn-brand" href={`/market/c/${festivalShelf.shelf}`}>
                        {shelfLabel(festivalShelf.shelf)} →
                      </Link>
                    )}
                    <Link className="btn" href={`/${near.festival.slug}`}>
                      Dates &amp; what&rsquo;s on
                    </Link>
                  </p>
                </div>
              )}

              {items.length > 0 && (
                <div style={{ marginTop: 34 }}>
                  {items.length < RAILS_NEED_ITEMS ? (
                    /* Everything, in one grid. See RAILS_NEED_ITEMS: below the
                       line there is no honest way to cut this into rows, so the
                       page stops pretending it is a department store for a
                       moment and simply shows the shelves as they are. */
                    <>
                      <h2 className="feed-section-title anim-fade-up">On the shelves right now</h2>
                      <p className="muted anim-fade-up" style={{ margin: '4px 0 0' }}>
                        Not enough here yet to sort into rows worth the name, so this is all of it
                        — every item every shop has listed, {items.length} in total.
                      </p>
                      <div className="bz-grid" style={{ marginTop: 16 }}>
                        {items.map((item) => (
                          <ItemTile key={`${item.shop.id}:${item.tier.tierKey}`} item={item} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Only once there is more than one row to describe. No
                          rail may show an item another rail already took (see
                          buildRails), so just over the eight-item line the
                          newest row can claim everything there is and the
                          others come back empty — and "a handful from each
                          corner" over a single row holding the entire bazaar
                          is a promise of depth the shelves do not have yet.
                          The row's own heading and note say what it is. */}
                      {rails.length > 1 && (
                        <p className="muted anim-fade-up" style={{ margin: '0 0 6px' }}>
                          A handful from each corner of the bazaar. Every row has a link at its
                          end to the full list behind it.
                        </p>
                      )}
                      {rails.map((rail) => (
                        <ItemRail
                          key={rail.title}
                          title={rail.title}
                          items={rail.items}
                          href={rail.href}
                          hrefLabel={rail.hrefLabel}
                          note={rail.note}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* And the same bazaar shop-first, for the visitor who came for a
                  particular seller rather than for a particular thing. */}
              <p className="muted anim-fade-up" style={{ margin: '38px 0 18px' }}>
                The shops themselves, shelf by shelf — open one to see everything that seller
                makes.
              </p>
              {shelves.map((shelf, i) => (
                <div key={shelf.key} style={{ marginTop: i === 0 ? 0 : 36 }}>
                  <h2 className="feed-section-title anim-fade-up">{shelf.label}</h2>
                  <p className="muted anim-fade-up" style={{ margin: '4px 0 0' }}>
                    {shelf.line}
                  </p>
                  <div className="feed-grid" style={{ marginTop: 18 }}>
                    {shelf.shops.map((s) => (
                      <EventCard key={s.id} event={s} snapshot={snapshot} />
                    ))}
                  </div>
                </div>
              ))}
              {uncategorised.length > 0 && (
                <div style={{ marginTop: shelves.length > 0 ? 36 : 0 }}>
                  <h2 className="feed-section-title anim-fade-up">More from the bazaar</h2>
                  <div className="feed-grid" style={{ marginTop: 18 }}>
                    {uncategorised.map((s) => (
                      <EventCard key={s.id} event={s} snapshot={snapshot} />
                    ))}
                  </div>
                </div>
              )}
              {/* How buying here actually WORKS.
                  The page above sells the feeling — momo folded the way
                  somebody's mother taught them — and then leaves a first-time
                  visitor to open a shop before they learn there is no card
                  field, that they transfer the money to the seller themselves,
                  and that what arrives is a code to show at a door. That is a
                  surprising enough shape that it should not be a surprise.

                  Four steps, and not one word of them written here: they come
                  from lib/howItWorks, the same function every seller's own
                  page calls, so the bazaar's front page and a shop's page
                  cannot promise different things. 'varies' is what this page
                  honestly knows about payment — each seller chooses their own
                  routes, and only their own page can say which.

                  Kept short and placed BELOW the shelves: the shops are the
                  point of this page, and an explainer above them would be a
                  wall of process in front of the thing people came for. */}
              <div style={{ marginTop: 44 }}>
                <h2 className="feed-section-title anim-fade-up">How ordering works here</h2>
                <p className="muted anim-fade-up" style={{ margin: '4px 0 0' }}>
                  Every shop is run by its own seller. You order from them, pay them, and collect
                  from them — {platformNameFromEnv()} is only the software in between, and never
                  touches the money.
                </p>
                <ol className="step-list anim-fade-up" style={{ maxWidth: 680, marginTop: 20 }}>
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
                <p className="muted small anim-fade-up" style={{ maxWidth: 680, margin: '4px 0 0' }}>
                  Each seller sets their own prices, their own collection days and how long they
                  hold an order — their shop&rsquo;s own page says which, and that page is the one
                  that counts.
                </p>
              </div>

              {/* One quiet line for the seller scrolling past the shelves and
                  thinking "I could do this" — because they can, for nothing. */}
              <p className="muted anim-fade-up" style={{ textAlign: 'center', marginTop: 40 }}>
                Have something to sell?{' '}
                <Link href="/organizers" style={{ textDecoration: 'underline' }}>
                  A shop here is free
                </Link>
                {' '}— buyers pay you directly, and you hand orders over with one scan.
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}

/** A shelf's label from its key, for the two places that print one from a
    lookup rather than from a shelf object already in hand. */
function shelfLabel(key: string): string {
  return SHOP_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/**
 * What the corner of a department card says about how full it is.
 *
 * Three states, because there are genuinely three: goods on the shelf, a shop
 * that has opened but listed nothing yet, and an empty department. Collapsing
 * the middle one into "nothing yet" would be a small lie about a seller who is
 * standing right there mid-setup, and collapsing it into "1 shop" would send a
 * shopper to a page with no prices on it.
 */
function shelfCountLabel(items: number, shopsOnShelf: number): string {
  if (items > 0) return `${items} ${items === 1 ? 'item' : 'items'}`;
  if (shopsOnShelf > 0) {
    return `${shopsOnShelf === 1 ? 'One shop' : `${shopsOnShelf} shops`}, nothing on sale yet`;
  }
  return 'Nothing yet';
}

interface Rail {
  title: string;
  items: ShopItem[];
  href?: string;
  hrefLabel?: string;
  note?: string;
}

/**
 * The rows of goods on the front of the bazaar, with one item never in two of
 * them.
 *
 * The no-repeat rule is the interesting part, and it is not a layout
 * preference. A young bazaar's newest item is also, usually, its best rated
 * and its cheapest and the only thing in Hamburg — so without the rule the
 * page becomes four rows of the same six jars of achar, which reads as a shop
 * with a lot of stock right up until the moment somebody looks properly.
 *
 * Which rail gets first claim on an item is therefore a real decision, and it
 * is made by how much the heading CLAIMS:
 *
 *   - "Best rated" is a RANKING. If an earlier row had taken the highest-rated
 *     item, this row would be showing the fourth, fifth and sixth best under a
 *     heading that says otherwise. So it picks first.
 *   - "Fresh on the shelves" is a ranking too, a softer one, and picks second.
 *   - "In stock today", "Under €10" and "Collect in X" are plain facts, true of
 *     every tile they show whichever tiles those turn out to be. Losing an item
 *     to a row above cannot make one of these say something false; it only
 *     makes the row shorter, and the link at its end goes to the complete list.
 *
 * They are RENDERED in the order the storefront wants — freshness first,
 * because that is what a returning visitor came to see — which is why claiming
 * and rendering are two separate lists below.
 */
function buildRails(items: ShopItem[]): Rail[] {
  const claimed = new Set<string>();
  const idOf = (i: ShopItem) => `${i.shop.id}:${i.tier.tierKey}`;

  /** Take up to RAIL_MAX of these that no earlier rail took. Under three, the
      rail is abandoned and — importantly — claims nothing, so the items stay
      available to the rows below rather than being swallowed by a row that
      never rendered. ItemRail enforces the same floor itself; this is here so
      the accounting matches what the page will actually show. */
  const claim = (pool: ShopItem[]): ShopItem[] => {
    const picked = pool.filter((i) => !claimed.has(idOf(i))).slice(0, RAIL_MAX);
    if (picked.length < 3) return [];
    for (const i of picked) claimed.add(idOf(i));
    return picked;
  };

  // Only items somebody has actually reviewed, and only when there are enough
  // of them for the row to be a selection rather than a list of everything
  // that has ever been rated. Three is the same floor ItemRail uses.
  const rated = items.filter((i) => i.rating);
  const bestRated = rated.length >= 3 ? claim(sortShopItems(rated, 'rating')) : [];

  const fresh = claim(sortShopItems(items, 'newest'));

  const inStock = claim(items.filter((i) => i.buyable));

  // EUR only, and the reason is the same one bandOf gives in lib/marketItems:
  // a shop selling in another currency has prices this heading has not
  // converted, and putting one under "Under €10" would be the page making a
  // claim about a number it has not looked at.
  const cheap = claim(
    items.filter((i) => i.currency.trim().toUpperCase() === 'EUR' && i.priceCents < 1000)
  );

  // The busiest town, from the same facet the search page's Town filter is
  // built from — so the row and the filter can never disagree about which
  // spelling of "berlin" is the town. facetCities sorts busiest first.
  const topCity = facetCities(items)[0];
  const cityItems = topCity
    ? filterShopItems(items, {
        q: '',
        category: '',
        city: topCity.key,
        shop: '',
        inStock: false,
        band: '',
      })
    : [];
  const local = claim(cityItems);

  return [
    {
      title: 'Fresh on the shelves',
      items: fresh,
      href: '/market/items?sort=newest',
      hrefLabel: 'All the newest',
      note: 'The most recently opened shops first — it is the shop’s own age, not the item’s.',
    },
    {
      title: 'In stock today',
      items: inStock,
      href: '/market/items?stock=1',
      hrefLabel: 'Everything in stock',
      note: 'On sale this minute, from a shop that is open and has some left.',
    },
    {
      title: 'Under €10',
      items: cheap,
      // There is no "under €10" band — PRICE_BANDS splits it at €5, and this
      // page does not get to invent a seventh band in lib/marketItems' name.
      // Cheapest-first is the honest neighbouring list: every tile in this row
      // is near the top of it.
      href: '/market/items?sort=price-asc',
      hrefLabel: 'Cheapest first',
    },
    {
      title: 'Best rated',
      items: bestRated,
      href: '/market/items?sort=rating',
      hrefLabel: 'All rated items',
      note:
        'Scored by people who ordered and paid for them here. Items nobody has reviewed yet are ' +
        'not in this row and are not given a score.',
    },
    ...(topCity
      ? [
          {
            title: `Collect in ${topCity.label}`,
            items: local,
            href: `/market/items?city=${encodeURIComponent(topCity.label)}`,
            hrefLabel: `Everything in ${topCity.label}`,
            note: `Shops based in ${topCity.label} — you collect from the seller there.`,
          },
        ]
      : []),
  ].filter((rail) => rail.items.length >= 3);
}
