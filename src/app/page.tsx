import Link from 'next/link';
import { currentLang, serverT } from '@/lib/i18nServer';
import AskBar from '@/components/AskBar';
import StoryPlayer from '@/components/StoryPlayer';
import { ensureExampleBazaarOnce } from '@/lib/exampleBazaar';
import { runSubscriptionSweep } from '@/lib/subscriptions';
import ShopRail from '@/components/ShopRail';
import DemoTile from '@/components/DemoTile';
import type { ShopCardData } from '@/components/ShopRail';
import { readListingName } from '@/lib/exampleShop';
import { listShopItems, sortShopItems } from '@/lib/marketItems';
import type { ShopItem } from '@/lib/marketItems';
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
): { slides: BillboardSlide[]; startAt: number } {
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
  // The events first, then the goods. The row is endless (HomeBillboard), so
  // it opens on the events with goods to swipe to on BOTH sides.
  return { slides: [...eventSlides, ...itemSlides], startAt: 0 };
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
  // The page, top to bottom: the events carousel, three quick tiles, the
  // shops, then the bazaar's goods (Top picks).
  const shopItems = listShopItems();
  const { slides, startAt: slidesStart } = billboardSlides(events, snapshot, shopItems, tr);
  const picks = pagerItems(shopItems);
  // Real shops first; the row is endless, so it opens on them with the
  // others to swipe to on both sides.
  const shops = shopCards(events, snapshot);
  const upcoming = events.filter((e) => e.kind !== 'shop' && !isPast(e, todayIso()));
  const upcomingCount = upcoming.length;
  const upcomingCities = new Set(upcoming.map((e) => e.city.trim()).filter(Boolean));

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
      {/* Ask anything — opens a full-screen chat over the page. */}
      <div className="container ab-wrap">
        <AskBar lang={await currentLang()} />
        {/* The customer's story video: find, ask, order, pay, collect. */}
        <p className="ab-watch">
          <StoryPlayer storyId="customer" label="How it works · watch in 1½ min" />
        </p>
      </div>
      {upcomingCount > 0 && (
        <div className="container pk-head">
          <p className="feed-kicker">{tr('pk.kicker')}</p>
          <p className="pk-count">
            {upcomingCount} {tr('pk.events', { n: upcomingCount })}
            {upcomingCities.size > 1 ? ` · ${tr('home.inCities', { n: upcomingCities.size })}` : ''}
          </p>
        </div>
      )}
      {/* Anchors the Ask chat links to ("/#events", "/#shops", "/#picks"). */}
      <span id="events" className="ab-anchor" aria-hidden="true" />
      <HomeBillboard slides={slides} startAt={slidesStart} />
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
        <DemoTile
          title={tr('qt.demo')}
          sub={tr('qt.demoSub')}
          icon={
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7L8 5Z" />
            </svg>
          }
        />
      </nav>

      {/* The platform's own voice, AFTER the listing. Above the events it was
          the first thing between a visitor and the reason they came, and news
          about the site is never that. Someone who has scrolled the whole
          listing is the one it is actually for. */}
      <span id="shops" className="ab-anchor" aria-hidden="true" />
      <ShopRail
        kicker={tr('sr.kicker')}
        title={tr('sr.title')}
        shops={shops}
        moreHref="/market"
        moreLabel={tr('home.seeAll')}
        itemsLabel={tr('sr.items')}
      />

      <span id="picks" className="ab-anchor" aria-hidden="true" />
      <BazaarPager
        kicker={tr('bb.bazaar')}
        title={tr('home.picks')}
        items={picks}
        moreHref="/market"
        moreLabel={tr('home.seeAll')}
      />

      {/* Nothing on the site yet: say so, instead of an empty page. The
          events themselves are the carousel at the top. */}
      {events.length === 0 && (
        <section className="section">
          <div className="container">
            <div className="card anim-fade-up" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: 36 }}>
              <h2 className="card-title" style={{ fontSize: '1.3rem' }}>
                The stage is being set
              </h2>
              <p className="muted">New events appear here the moment an organizer presses publish — check back soon.</p>
              <p style={{ margin: 0 }}>
                <Link href="/portal" className="btn btn-brand">
                  Organizing an event? Get started
                </Link>
              </p>
            </div>
          </div>
        </section>
      )}

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

      {/* No chat bubble here: the Ask bar at the top is this page's assistant. */}
    </>
  );
}
