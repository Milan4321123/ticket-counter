import Link from 'next/link';
import EventCard from '@/components/EventCard';
import { SHOP_CATEGORIES, isShopCategory } from '@/lib/categories';
import { listPublishedEvents } from '@/lib/events';
import { loadFeedSnapshot } from '@/lib/feedSnapshot';
import { howItWorks } from '@/lib/howItWorks';
import { platformNameFromEnv } from '@/lib/platform';

// The public bazaar: every published shop on the platform, grouped by the
// shelf its seller picked in the editor (lib/categories). The feed on / mixes
// shops in between events by date; this page is for the person who came to
// BUY SOMETHING — momo for Saturday, a sari before Teej — and wants to browse
// by what is sold, not by when things happen.
//
// Live availability shows on every tile — always render fresh.
export const dynamic = 'force-dynamic';

export function generateMetadata() {
  const name = platformNameFromEnv();
  const title = 'Nepali shops in Germany — order food, sweets & crafts';
  const description =
    'The Nepali bazaar online: order momo, sel roti, sweets, spices, dhaka and handicrafts ' +
    'from Nepali sellers across Germany. You pay each seller directly and collect your ' +
    `order with a QR code. Free to browse and free to sell, on ${name}.`;
  return {
    title,
    description,
    alternates: { canonical: '/market' },
    openGraph: { type: 'website', title, description, url: '/market' },
  };
}

export default function MarketPage() {
  const shops = listPublishedEvents().filter((e) => e.kind === 'shop');
  // One read of tiers, photos and availability for every tile below — the same
  // snapshot the homepage feed uses. See lib/feedSnapshot.
  const snapshot = loadFeedSnapshot(shops);

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

  return (
    <>
      <section className="feed-hero" style={{ padding: '64px 0 36px' }}>
        <div className="container">
          <p className="feed-kicker anim-fade-up">नेपाली बजार · The bazaar</p>
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
          {/* The same bazaar the other way round. Named rather than hinted at,
              because "browse" on its own does not tell anybody which of two
              pages they are about to land on: this one is a wall of SHOPS,
              that one is a wall of GOODS with a search box over it. Somebody
              who came looking for a seller wants this page; somebody who came
              looking for sel roti wants that one, and until now had to guess a
              shop before they could see a single thing on sale. */}
          <p className="anim-fade-up anim-d3" style={{ marginTop: 18 }}>
            <Link href="/market/items" className="btn btn-brand">
              Browse everything on sale →
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
