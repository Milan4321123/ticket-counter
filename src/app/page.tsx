import Link from 'next/link';
import { serverT } from '@/lib/i18nServer';
import { ensureExampleBazaarOnce } from '@/lib/exampleBazaar';
import { runSubscriptionSweep } from '@/lib/subscriptions';
import EventCard from '@/components/EventCard';
import EventRail from '@/components/EventRail';
import ShopRail from '@/components/ShopRail';
import type { ShopCardData } from '@/components/ShopRail';
import { readListingName } from '@/lib/exampleShop';
import { listShopItems, sortShopItems } from '@/lib/marketItems';
import type { ShopItem } from '@/lib/marketItems';
import PlatformAssistant from '@/components/PlatformAssistant';
import { listPublishedEvents, mediaUrl } from '@/lib/events';
import type { EventRow } from '@/lib/events';
import { loadFeedSnapshot } from '@/lib/feedSnapshot';
import { runBuyerDataRetentionSweep } from '@/lib/retention';
import { eventListJsonLd, jsonLdScript } from '@/lib/seo';
import HomeBillboard from '@/components/HomeBillboard';
import type { BillboardSlide } from '@/components/HomeBillboard';
import { listingCoverUrl, listingStillUrl } from '@/lib/listing';
import BazaarPager from '@/components/BazaarPager';
import type { PagerItem } from '@/components/BazaarPager';
import { formatMoney as fmt, subscribeDiscountCents } from '@/lib/money';
import { fromPriceCents } from '@/lib/ticketState';
import { formatMoney } from '@/lib/money';
import type { FeedSnapshot } from '@/lib/feedSnapshot';
import { listPlatformPosts } from '@/lib/platformPosts';
import type { PlatformPostRow } from '@/lib/platformPosts';
import { platformNameFromEnv } from '@/lib/platform';

// The feed reflects live availability — always render fresh.
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** Today, as the same 'YYYY-MM-DD' shape the event_date column stores. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Is this event already over?
 *
 * Only the machine date can answer — dateDisplay is free text. An event with no
 * date is never treated as past: it is unscheduled, not finished, and hiding it
 * would quietly drop an organizer's event off the site.
 */
function isPast(event: EventRow, today: string): boolean {
  const date = event.eventDate?.slice(0, 10);
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today;
}

/** One row of the browse page. */
interface Row {
  key: string;
  kicker: string;
  title: string;
  events: EventRow[];
  past?: boolean;
  /** A quiet "see all of these" link beside the heading, for rows that are a
      taste of a fuller page rather than the whole list. */
  more?: { href: string; label: string };
}

/**
 * Slice the events into rows.
 *
 * Two rules keep this from turning into a wall of near-identical shelves:
 * a row is only worth its own heading if it is a real cut of the listing
 * (curation, not a duplicate of "everything"), and every event has to land in
 * at least one row. "All events" is that guarantee — it is always last and
 * always complete, so nothing can be lost between the curated rows above it.
 */
function buildRows(listings: EventRow[]): Row[] {
  const today = todayIso();
  // Shops are pulled out before anything else. Every row below is built around
  // a date — soonest first, near you, already happened — and a shop has none;
  // dropped into those rows it would sink to the bottom of the undated tail and
  // never be seen. It gets a shelf of its own instead, which is also the more
  // honest heading: "what's on" and "what you can order" are different questions.
  const shops = listings.filter((e) => e.kind === 'shop');
  const events = listings.filter((e) => e.kind !== 'shop');
  const upcoming = events.filter((e) => !isPast(e, today));
  const past = events.filter((e) => isPast(e, today));
  const rows: Row[] = [];

  // The soonest dated events get the top row — but only when that row says
  // something the catch-all row below does not. With a handful of events the
  // two would open with the identical tiles under two different headings,
  // which reads as a rendering fault rather than as curation.
  const dated = upcoming.filter((e) => e.eventDate);
  const soon = upcoming.length >= 4 && dated.length >= 2 ? dated.slice(0, 8) : [];
  if (soon.length > 0) {
    rows.push({ key: 'soon', kicker: 'Don’t miss', title: 'Happening soon', events: soon });
  }

  // City shelves, once there is enough on the site for "events near me" to be
  // a real question. Biggest cities first, and never more than three — past
  // that the page is scrolling through shelves rather than events.
  //
  // Three events is the floor for a shelf, not two: a row holding two tiles
  // leaves most of its width empty, which reads as a section that failed to
  // load rather than as a short list.
  if (upcoming.length >= 8) {
    const byCity = new Map<string, EventRow[]>();
    for (const event of upcoming) {
      const city = event.city.trim();
      if (!city) continue;
      const list = byCity.get(city);
      if (list) list.push(event);
      else byCity.set(city, [event]);
    }
    const cities = [...byCity.entries()]
      .filter(([, list]) => list.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3);
    for (const [city, list] of cities) {
      rows.push({ key: `city-${city}`, kicker: 'Near you', title: `In ${city}`, events: list });
    }
  }

  // The guarantee: whatever the rows above did or did not pick up, everything
  // still on sale ends up on the page exactly once between here and the top
  // row. City shelves may repeat an event, but their heading explains why —
  // two catch-all rows holding the same tiles would not.
  const soonIds = new Set(soon.map((e) => e.id));
  const remaining = upcoming.filter((e) => !soonIds.has(e.id));
  if (remaining.length > 0) {
    rows.push({
      key: 'all',
      kicker: 'Explore',
      title: soon.length > 0 ? 'More events' : 'What’s on',
      events: remaining,
    });
  }

  // Above the archive, below what is on: a shop is live and orderable today,
  // so it belongs with the present, not filed after events that have finished.
  if (shops.length > 0) {
    rows.push({
      key: 'shops',
      kicker: 'Order & collect',
      title: 'Buy from local sellers',
      events: shops,
      // The rail shows whatever is published; the bazaar page is the full
      // directory, sorted by category, so the row points at it rather than
      // pretending to be it.
      more: { href: '/market', label: 'Browse the whole bazaar →' },
    });
  }

  // Kept, not hidden: someone who was at the show still follows the link from a
  // photo or a message, and a page that quietly deletes its past looks smaller
  // than it is. Last, and labelled, so it can never be mistaken for what is on.
  if (past.length > 0) {
    rows.push({ key: 'past', kicker: 'The archive', title: 'Already happened', events: past, past: true });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Icons — small, single-stroke, and the same weight everywhere.
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------

/**
 * The billboard at the top: the next few events and some of the bazaar's best
 * goods, alternating, so the first screen is pictures of things to go to and
 * things to buy — not a paragraph about the site. Only listings with a real
 * picture make it; a billboard of blank panels would be worse than none.
 */
function billboardSlides(
  events: EventRow[],
  snapshot: FeedSnapshot,
  items: ShopItem[],
  tr: Awaited<ReturnType<typeof serverT>>
): BillboardSlide[] {
  const today = todayIso();
  const eventSlides: BillboardSlide[] = [];
  for (const e of events) {
    if (e.kind === 'shop' || isPast(e, today) || eventSlides.length >= 8) continue;
    const image = listingCoverUrl(e, snapshot.photos.get(e.id));
    if (!image) continue;
    const min = fromPriceCents(snapshot.tiers.get(e.id) ?? [], snapshot.availability.get(e.id));
    eventSlides.push({
      id: `e-${e.id}`,
      href: `/e/${e.slug}`,
      image,
      imageTall: listingStillUrl(e, snapshot.photos.get(e.id)),
      art: null,
      kicker: [tr('bb.event'), e.city.trim()].filter(Boolean).join(' · '),
      title: e.name,
      facts: [e.dateDisplay, e.venueName].filter(Boolean).join(' · '),
      price: min === null ? '' : min === 0 ? tr('bb.free') : tr('bb.from', { price: formatMoney(min, e.currency) }),
      cta: tr('bb.tickets'),
    });
  }
  // One item per shop, so the bazaar reads as many sellers rather than one.
  const itemSlides: BillboardSlide[] = [];
  const shopsSeen = new Set<string>();
  for (const item of sortShopItems(items, 'featured')) {
    if (!item.photo || !item.buyable || shopsSeen.has(item.shop.id) || itemSlides.length >= 4) continue;
    shopsSeen.add(item.shop.id);
    const picture = mediaUrl(item.photo.id, 'card', null);
    itemSlides.push({
      id: `i-${item.shop.id}-${item.tier.tierKey}`,
      href: item.href,
      image: picture,
      art: picture,
      kicker: `${tr('bb.bazaar')} · ${item.shopName}`,
      title: item.tier.name,
      facts: [item.categoryName, item.shop.city.trim()].filter(Boolean).join(' · '),
      price: formatMoney(item.priceCents, item.currency),
      cta: tr('bb.order'),
    });
  }
  // Events first — two side by side on the opening screen — then the
  // bazaar's goods carry on in the same swipe.
  return [...eventSlides, ...itemSlides];
}

/**
 * The bazaar grid under the carousel: goods with a picture first, dealt round
 * the shops so one seller never fills a whole page.
 */
function pagerItems(items: ShopItem[]): PagerItem[] {
  const byShop = new Map<string, ShopItem[]>();
  for (const it of sortShopItems(items, 'featured')) {
    if (!it.buyable && !it.isExample) continue;
    const list = byShop.get(it.shop.id) ?? [];
    list.push(it);
    byShop.set(it.shop.id, list);
  }
  for (const list of byShop.values()) list.sort((a, b) => Number(Boolean(b.photo)) - Number(Boolean(a.photo)));
  const dealt: ShopItem[] = [];
  for (let round = 0; dealt.length < 30; round++) {
    let any = false;
    for (const list of byShop.values()) {
      if (list[round]) {
        dealt.push(list[round]);
        any = true;
      }
    }
    if (!any) break;
  }
  // Pictures first: a grid that opens on a blank tile looks broken.
  const ordered = [...dealt.filter((it) => it.photo), ...dealt.filter((it) => !it.photo)];
  return ordered.slice(0, 30).map((it) => {
    const pct = it.shop.subscribePct || 0;
    return {
      key: `${it.shop.id}:${it.tier.tierKey}`,
      href: it.href,
      image: it.photo ? mediaUrl(it.photo.id, 'card', null) : null,
      name: it.tier.name,
      shop: it.shopName,
      price: it.priceCents === 0 ? 'Free' : fmt(it.priceCents, it.currency),
      subscribe:
        pct > 0 && it.priceCents > 0 ? `${fmt(it.priceCents - subscribeDiscountCents(pct, it.priceCents), it.currency)} on subscription` : '',
      example: it.isExample,
    };
  });
}

/** The shops rail: real shops first, then the site's example ones. */
function shopCards(events: EventRow[], snapshot: FeedSnapshot): ShopCardData[] {
  return events
    .filter((e) => e.kind === 'shop')
    .map((e) => {
      const { name, isExample } = readListingName(e.name);
      const items = (snapshot.tiers.get(e.id) ?? []).filter((t) => t.status !== 'hidden').length;
      return {
        id: e.id,
        href: `/e/${e.slug}`,
        image: listingCoverUrl(e, snapshot.photos.get(e.id)),
        name,
        place: e.city.trim(),
        items,
        example: isExample,
      };
    })
    .sort((a, b) => Number(a.example) - Number(b.example) || Number(Boolean(b.image)) - Number(Boolean(a.image)));
}

export default async function HomePage() {
  // Example shops for a fresh hosted site, once, in the background (lib/exampleBazaar).
  ensureExampleBazaarOnce();
  // Places any Subscribe & save repeats that are due (self-throttled).
  void runSubscriptionSweep().catch((e) => console.error('Subscription sweep failed:', e));
  const tr = await serverT();
  // The feed is the busiest page on the site, so it is where the erasure sweep
  // is armed: it self-throttles and swallows its own errors, so this costs a
  // clock comparison on all but one render an hour. See lib/retention.ts.
  runBuyerDataRetentionSweep();
  const events = listPublishedEvents();
  // Tiers, photos and availability for every tile on the page, in three
  // statements rather than five per tile. See lib/feedSnapshot for why this is
  // a per-request read and not a cache.
  const snapshot = loadFeedSnapshot(events);
  const platformPosts = listPlatformPosts(3);
  const rows = buildRows(events);
  // The bazaar shelf as several short rows, one per department, Netflix-style —
  // rather than one long row of shop cards. Items, not shops: a visitor sees
  // what is on sale before they have to pick a seller.
  const shopItems = listShopItems();
  const slides = billboardSlides(events, snapshot, shopItems, tr);
  const picks = pagerItems(shopItems);
  const shops = shopCards(events, snapshot);
  const upcoming = events.filter((e) => e.kind !== 'shop' && !isPast(e, todayIso()));
  const upcomingCount = upcoming.length;
  const upcomingCities = new Set(upcoming.map((e) => e.city.trim()).filter(Boolean));
  const cities = new Set(events.map((e) => e.city.trim()).filter(Boolean));

  return (
    <>
      {/* Tells Google this page is a LIST of these specific events. Without it a
          feed of ten events reads to a crawler as one long article, and none of
          the individual events get discovered from here. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(eventListJsonLd(events))}
      />
      {/* Pictures first: the billboard, then one slim line of doors. The long
          explanations (how paying works, the FAQ) live on /organizers and on
          each checkout, where someone is actually about to use them. */}
      <h1 className="sr-only">{tr('home.title')}</h1>
      {upcomingCount > 0 && (
        <div className="container pk-head">
          <p className="feed-kicker">{tr('pk.kicker')}</p>
          <p className="pk-count">
            {upcomingCount} {tr('pk.events', { n: upcomingCount })}
            {upcomingCities.size > 1 ? ` · ${tr('home.inCities', { n: upcomingCities.size })}` : ''}
          </p>
        </div>
      )}
      <HomeBillboard slides={slides} />
      <nav className="qt container" aria-label={tr('home.title')}>
        <Link href="/market" className="qt-tile qt-bazaar">
          <span className="qt-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 8h14l-1 11H6L5 8Z" />
              <path d="M9 10V7a3 3 0 0 1 6 0v3" />
            </svg>
          </span>
          <span className="qt-text">
            <strong>{tr('qt.bazaar')}</strong>
            <span>{tr('qt.bazaarSub', { n: shopItems.length })}</span>
          </span>
        </Link>
        <Link href="/organizers" className="qt-tile qt-org">
          <span className="qt-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 20V9l8-5 8 5v11" />
              <path d="M9 20v-6h6v6" />
            </svg>
          </span>
          <span className="qt-text">
            <strong>{tr('qt.sell')}</strong>
            <span>{tr('qt.sellSub')}</span>
          </span>
        </Link>
        <Link href="/demo" className="qt-tile qt-demo">
          <span className="qt-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7L8 5Z" />
            </svg>
          </span>
          <span className="qt-text">
            <strong>{tr('qt.demo')}</strong>
            <span>{tr('qt.demoSub')}</span>
          </span>
        </Link>
      </nav>

      {/* The platform's own voice, AFTER the listing. Above the events it was
          the first thing between a visitor and the reason they came, and news
          about the site is never that. Someone who has scrolled the whole
          listing is the one it is actually for. */}
      <BazaarPager
        kicker={tr('bb.bazaar')}
        title={tr('home.picks')}
        items={picks}
        moreHref="/market"
        moreLabel={tr('home.seeAll')}
      />

      <ShopRail
        kicker={tr('sr.kicker')}
        title={tr('sr.title')}
        shops={shops}
        moreHref="/market"
        moreLabel={tr('home.seeAll')}
        itemsLabel={tr('sr.items')}
      />

      <div id="events">
        {events.length === 0 ? (
          <section className="section">
            <div className="container">
              <div
                className="card anim-fade-up"
                style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: 36 }}
              >
                <h2 className="card-title" style={{ fontSize: '1.3rem' }}>
                  The stage is being set
                </h2>
                <p className="muted">
                  New events appear here the very moment an organizer presses publish —
                  check back soon, or be the reason everyone else does.
                </p>
                <p style={{ margin: 0 }}>
                  <Link href="/portal" className="btn btn-brand">
                    Organizing an event? Get started
                  </Link>
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* The shops have their own rail above; these rows are the events. */}
            {rows.filter((row) => row.key !== 'shops').map((row) => (
              <section className="section rail-section" key={row.key}>
                <div className="container">
                  <div className="rail-head anim-fade-up">
                    <p className="feed-kicker">{row.kicker}</p>
                    <h2 className="feed-section-title">{row.title}</h2>
                    {row.more && (
                      <p className="muted small" style={{ margin: '4px 0 0' }}>
                        <Link href={row.more.href} className="inline-link">
                          {row.more.label}
                        </Link>
                      </p>
                    )}
                  </div>
                  <div className="rail-bleed">
                    <EventRail label={row.title}>
                      {row.events.map((event, i) => (
                        <div className="rail-item" key={event.id}>
                          <EventCard
                            event={event}
                            past={row.past}
                            delayClass={['', ' anim-d1', ' anim-d2', ' anim-d3'][i % 4]}
                            snapshot={snapshot}
                          />
                        </div>
                      ))}
                    </EventRail>
                  </div>
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      {platformPosts.length > 0 && (
        <section className="section">
          <div className="container">
            <p className="section-kicker">From the team</p>
            <div className="platform-posts">
              {platformPosts.map((post: PlatformPostRow) => (
                <article className="platform-post anim-fade-up" key={post.id}>
                  <p>{post.body}</p>
                  {post.photoUrl ? (
                    // Served from our own route; next/image adds nothing here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.photoUrl} alt="" className="platform-post-photo" />
                  ) : null}
                  <time className="muted small" dateTime={post.createdAt.replace(' ', 'T') + 'Z'}>
                    {post.createdAt.slice(0, 10)}
                  </time>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <PlatformAssistant brand={platformNameFromEnv()} />
    </>
  );
}
