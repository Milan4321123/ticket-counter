import Link from 'next/link';
import EventCard from '@/components/EventCard';
import { SHOP_CATEGORIES, isShopCategory } from '@/lib/categories';
import { listPublishedEvents } from '@/lib/events';
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

  return (
    <>
      <section className="feed-hero" style={{ padding: '64px 0 36px' }}>
        <div className="container">
          <p className="feed-kicker anim-fade-up">नेपाली बजार · The bazaar</p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.9rem, 4.4vw, 3rem)' }}>
            The Nepali bazaar, wherever you are in Germany
          </h1>
          <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 0 }}>
            Momo folded the way somebody&rsquo;s mother taught them. Sel roti for the festival,
            timur for the achar, dhaka for the photo. Every shop here belongs to a Nepali seller
            near you — you order, pay them directly, and collect with the QR code on your order.
            No middleman between you and the person who made it.
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
              {shelves.map((shelf, i) => (
                <div key={shelf.key} style={{ marginTop: i === 0 ? 0 : 36 }}>
                  <h2 className="feed-section-title anim-fade-up">{shelf.label}</h2>
                  <p className="muted anim-fade-up" style={{ margin: '4px 0 0' }}>
                    {shelf.line}
                  </p>
                  <div className="feed-grid" style={{ marginTop: 18 }}>
                    {shelf.shops.map((s) => (
                      <EventCard key={s.id} event={s} />
                    ))}
                  </div>
                </div>
              ))}
              {uncategorised.length > 0 && (
                <div style={{ marginTop: shelves.length > 0 ? 36 : 0 }}>
                  <h2 className="feed-section-title anim-fade-up">More from the bazaar</h2>
                  <div className="feed-grid" style={{ marginTop: 18 }}>
                    {uncategorised.map((s) => (
                      <EventCard key={s.id} event={s} />
                    ))}
                  </div>
                </div>
              )}
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
