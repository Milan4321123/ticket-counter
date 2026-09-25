// One thing a listing sells, on a page of its own.
//
// The listing page shows every tier as a small card in a grid: a name, a price
// and one line. That is the right shape for picking a ticket and the wrong
// shape for buying goods — a shop's products were reading as a ticket picker,
// with no picture and nowhere to go for the detail that decides a purchase.
// This page is where the picture is big enough to judge and the seller's own
// write-up has room.
//
// It never DECIDES anything about availability: the state, the badge and the
// button all come from lib/ticketState, the same call the listing page makes,
// so an item page cannot say "Available" beside a grid saying "Sold out".
//
// On a SHOP it is also where the rest of the bazaar hangs off one thing: the
// shelf this sits on, the stars people who bought it left, the rest of the
// seller's stall, the same shelf at other stalls, and what other people
// actually put in the same basket as this. All of it is read ONCE, above the
// JSX, and the reads are counted deliberately — a page of related goods is the
// classic place a site starts asking the database a question per tile, and
// this one asks four questions no matter how many tiles come back.
import { localizeListing } from '@/lib/listingI18n';
import { currentLang } from '@/lib/i18nServer';
import { listingOpenTo } from '@/lib/demo';
import { MixedScript } from '@/components/Np';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ItemRail from '@/components/ItemRail';
import ItemReviews from '@/components/ItemReviews';
import MediaSwiper from '@/components/MediaSwiper';
import type { MediaSwiperItem } from '@/components/MediaSwiper';
import SaveButton from '@/components/SaveButton';
import Stars from '@/components/Stars';
import TrackView from '@/components/TrackView';
import WaitlistForm from '@/components/WaitlistForm';
import { ACCENT_THEMES } from '@/lib/accents';
import { shopCategory } from '@/lib/categories';
import {
  getEventBySlug,
  getEventMedia,
  getEventTiers,
  mediaUrl,
  parsePageDesign,
  tierPhoto,
  unclaimedPhotos,
} from '@/lib/events';
import type { EventMediaRow, EventRow, EventTierRow } from '@/lib/events';
import { readListingName } from '@/lib/exampleShop';
import { getAvailability } from '@/lib/inventory';
import { socialImageUrl } from '@/lib/listing';
import { listShopItems } from '@/lib/marketItems';
import SwipeFx from '@/components/SwipeFx';
import AddToBasket from '@/components/basket/AddToBasket';
import { basketLineFor } from '@/lib/basket';
import { formatMoney, subscribeDiscountCents } from '@/lib/money';
import { subscriptionOffer } from '@/lib/subscriptions';
import { getOrganizer } from '@/lib/organizers';
import { boughtTogether, moreFromShop, othersOnShelf } from '@/lib/relatedItems';
import { listReviewsForItem, ratingForItem } from '@/lib/reviews';
import type { SavedItem } from '@/lib/savedItems';
import {
  SITE_NAME,
  absoluteUrl,
  itemBreadcrumbJsonLd,
  itemDescription,
  itemJsonLd,
  jsonLdScript,
  SHARE_CARD,
  shareImages,
} from '@/lib/seo';
import { tierBadge, ticketState, visibleTiers } from '@/lib/ticketState';
import { cityLabel, otherShowsByAct, shortDateLabel } from '@/lib/sameAct';
import OtherCityNotice from '@/components/OtherCityNotice';
import { vocabFor } from '@/lib/vocab';

// Availability comes from the database — always render fresh, exactly like the
// listing page this must never disagree with.
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string; tierKey: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The listing and the one row this page is about, or null.
 *
 * Three ways to get nothing, and all three are a 404 rather than a message:
 * an unpublished listing (a draft is its organizer's private workspace — and
 * unlike the listing page there is no preview here, because there is nothing
 * to preview that the editor does not already show), an unknown tier key, and
 * a HIDDEN tier. Hidden is the one worth spelling out: it means "off the page
 * entirely", so an item page for it would be the one place on the site where a
 * withdrawn ticket type was still reachable by anyone who kept the URL. Asking
 * visibleTiers rather than re-testing `status` is what keeps that true if the
 * definition of visible ever gains a case.
 */
async function load(slug: string, tierKey: string): Promise<{ event: EventRow; tier: EventTierRow } | null> {
  const event = getEventBySlug(slug);
  // Published — and, for a try-it-yourself demo shop, only for its own account.
  if (!event || !(await listingOpenTo(event))) return null;
  const tier = visibleTiers(getEventTiers(event.id)).find((t) => t.tierKey === tierKey);
  return tier ? { event, tier } : null;
}

/** This item's own picture, or null — guarded against a deleted/foreign id. */
function photoOf(event: EventRow, tier: EventTierRow): EventMediaRow | null {
  return tierPhoto(tier, getEventMedia(event.id));
}

/**
 * The other things people bought in the same order as this one, reduced to the
 * ones a shopper could actually add to their basket today.
 *
 * boughtTogether() has already applied the honesty floor — it refuses to
 * answer at all below two separate PAID orders, because one shared basket is
 * one person having an afternoon and not a pattern anybody should be told
 * about. What it cannot know is whether those items still exist to be bought:
 * it counts history, and the pairing that carried a shop through last Dashain
 * may be a row its seller has since hidden or taken off sale.
 *
 * So every key it returns is looked up in the tiers this page is already
 * holding and dropped unless it is BOTH visible and on sale. Visible, because
 * a hidden row is off the seller's own page and this must not be the one place
 * left where it can be reached. On sale, because a suggestion a shopper cannot
 * act on is worse than no suggestion — it spends their attention and gives
 * back a dead end with a price on it.
 *
 * The lookup is a Map built once rather than a find() per row: there are at
 * most four rows, so this is not about speed, it is about the loop below
 * having exactly one way to answer "is this still for sale".
 */
function pairedItems(
  eventId: string,
  tiers: EventTierRow[],
  tierKey: string
): { orders: number; tier: EventTierRow }[] {
  const sellable = new Map(
    visibleTiers(tiers)
      .filter((t) => t.status === 'on-sale')
      .map((t) => [t.tierKey, t])
  );

  const out: { orders: number; tier: EventTierRow }[] = [];
  for (const row of boughtTogether(eventId, tierKey)) {
    const paired = sellable.get(row.tierKey);
    if (paired) out.push({ orders: row.orders, tier: paired });
  }
  return out;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, tierKey } = await params;
  const found = await load(slug, decodeURIComponent(tierKey));
  // Same posture as the listing page: a page that is not public must not leak
  // its name into a title tag, and must never be indexed.
  if (!found) return { title: 'Not found', robots: { index: false, follow: false } };

  const { event, tier } = found;
  const description = itemDescription(event, tier);
  // The item's own photo first. An item with none shares its listing's picture
  // rather than going out bare: a shared link with no image is a grey box in
  // WhatsApp, and the shop's cover is still an honest answer to "what is this".
  // The 'card' variant for the item's own photo — the same 4:5 render the page
  // and the listing card use, so what a shared link previews is the whole
  // picture rather than a band cut out of it. The listing's fallback keeps its
  // own 'cover' shape (socialImageUrl), which is the shape that one was framed
  // for.
  const photo = photoOf(event, tier);
  const image = photo ? mediaUrl(photo.id, 'card', null) : socialImageUrl(event);
  const path = `/e/${event.slug}/item/${encodeURIComponent(tier.tierKey)}`;
  // The thing, then whose it is — what somebody types is the product name, and
  // the shop name after it is what tells them they have found the right one.
  //
  // But only while both fit. Google shows roughly 60 characters and the layout
  // appends " | MartNepali" to every title, so this has about 45 to spend, and
  // "Gift box · pods, tin & chiya masala — Taplejung Alaichi Ghar (example
  // shop)" is 88 — cut by Google exactly where the shop name was supposed to
  // be doing its work. When the pair will not fit, the ITEM name stays whole
  // and the shop name goes: the item name is the half somebody typed, the shop
  // name is on the page they land on, and a title truncated mid-word looks
  // like a broken site rather than a long one.
  const TITLE_BUDGET = 60 - ` | ${SITE_NAME}`.length;
  const withShop = `${tier.name} — ${event.name}`;
  const title = withShop.length <= TITLE_BUDGET ? withShop : tier.name;

  return {
    title,
    description,
    // Canonical to ITSELF, so the item has one address in the index and does
    // not fold into the listing page it is linked from.
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      title,
      description,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      // Three pictures in order of how much they say about this item: its own
      // photo, then the listing's cover, then the site's card. Sizes are
      // declared honestly for each — a stated size that does not match the
      // bytes is what makes a preview render a stretched thumbnail — and the
      // last one means an item with no photograph anywhere still arrives in a
      // chat as something rather than a grey box.
      images: shareImages(
        image
          ? photo
            ? { url: image, width: 800, height: 1000, alt: tier.name }
            : { url: image, width: 1600, height: 740, alt: tier.name }
          : null
      ),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image ?? SHARE_CARD.url],
    },
  };
}

export default async function ItemPage({ params, searchParams }: Params) {
  const { slug, tierKey } = await params;
  const found = await load(slug, decodeURIComponent(tierKey));
  if (!found) notFound();
  // This item and its shop in the visitor's language (lib/listingI18n).
  const localized = localizeListing(found.event, getEventTiers(found.event.id), [], {}, await currentLang());
  const event = localized.event;
  const tier = localized.tiers.find((t) => t.tierKey === found.tier.tierKey) ?? found.tier;

  // ?ref= rides through to checkout exactly as it does from the listing page —
  // a buyer who arrived on a shared item link must earn the sharer the same
  // credit as one who arrived on the shop's front page. Shape-checked only;
  // the orders API is the guard that decides whether it counts.
  const sp = await searchParams;
  const rawRef = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  const refCode =
    typeof rawRef === 'string' && /^[A-Za-z0-9]{8}$/.test(rawRef.trim())
      ? rawRef.trim().toUpperCase()
      : null;

  const v = vocabFor(event.kind);
  const isShop = event.kind === 'shop';
  const subscribe = subscriptionOffer(event);
  const tiers = localized.tiers;
  const availability = getAvailability(event.id);
  const state = ticketState(event, tiers, availability);
  const remaining = Math.max(0, availability.tiers[tier.tierKey]?.remaining ?? 0);
  // The SAME three conditions the listing card uses to decide whether it is a
  // link to checkout. Kept in this order and in these words so the two cannot
  // drift: the listing's own state, this row's status, this row's stock.
  const buyable = state.buyable && tier.status === 'on-sale' && remaining > 0;
  const badge = tierBadge(state, tier, remaining, availability.showRemaining);

  const photos = getEventMedia(event.id);
  const photo = tierPhoto(tier, photos);

  // The item's own picture, then the shop's OWN photos — cheap, because the
  // gallery component and its lightbox already exist and the photos are
  // already loaded here for the guard above. The item's own comes first so the
  // rail opens on the thing the page is about; a listing with one photo shows
  // it as a plain still rather than a one-slide carousel.
  //
  // The other ITEMS' pictures are excluded, because they live in the same
  // media pool and were being served here as more views of this item: somebody
  // deciding on the 100 g jar swiped through the 500 g jar and the gift box
  // under a caption promising more photos of the shop. See unclaimedPhotos.
  const galleryItems: MediaSwiperItem[] = [];
  const seen = new Set<string>();
  // Numbered as they are ADDED, not by array position — the item's own photo
  // goes in first under its own alt, so counting by index skipped whichever
  // number it happened to hold ("photo 1, 2, 3, 5..."). Same running counter
  // the listing page's rail uses.
  let photoNo = 0;
  // The 'gallery' variant, not the raw upload: the swiper paints these into a
  // 253px-wide frame (and the lightbox into the screen), while the originals
  // here are 1600x2000 product shots of ~220 KB — 90% of which the phone
  // throws away before it can show anything. 'gallery' is the one uncropped
  // render, so the rail still shows the whole picture, which is the promise
  // `.mswipe-media`'s object-fit: contain makes.
  const addPhoto = (m: EventMediaRow, alt: string) => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    galleryItems.push({ id: m.id, kind: 'photo', src: mediaUrl(m.id, 'gallery'), alt });
  };
  if (photo) addPhoto(photo, `${tier.name} — ${event.name}`);
  unclaimedPhotos(tiers, photos).forEach((m) => addPhoto(m, `${event.name} photo ${++photoNo}`));

  // The 'card' variant, not 'cover': it is the 4:5 portrait the feed tiles
  // already use, so an item photo costs no new derivative on disk, and the
  // listing card below renders the SAME URL — one render, two places, and the
  // browser has it cached by the time a shopper taps through.
  const heroUrl = photo
    ? mediaUrl(photo.id, 'card', null)
    : galleryItems[0]
      ? mediaUrl(galleryItems[0].id, 'card', null)
      : null;

  const checkoutBase = `/e/${event.slug}/checkout`;
  // The mechanism the listing cards already use: ?tier= preselects this row at
  // quantity one, and the checkout re-validates the key server-side before
  // honouring it (see the wantTier guard there). Nothing new is invented for
  // this page — a second preselect route would be a second thing to keep
  // truthful.
  const buyHref = `${checkoutBase}?tier=${encodeURIComponent(tier.tierKey)}${refCode ? `&ref=${refCode}` : ''}`;
  const backHref = `/e/${event.slug}${refCode ? `?ref=${refCode}` : ''}#tickets`;
  /** "Heidelberg · Sat 10 Oct" — events only; a shop collects, it does not travel. */
  const itemPlace = isShop
    ? ''
    : [cityLabel(event.city), shortDateLabel(event)].filter(Boolean).join(' · ');
  const itemOtherCities = otherShowsByAct(event).map((other) => ({
    slug: other.slug,
    city: cityLabel(other.city),
    dateLabel: shortDateLabel(other),
  }));

  const organizer = getOrganizer(event.organizerId);
  const sellerName = organizer?.name?.trim() || 'the organizer';
  const basketLine = basketLineFor(event, tier, sellerName, tier.mediaId ? mediaUrl(tier.mediaId, 'card', null) : null);

  // The shop's own name with the "(example shop)" mark split off, so the mark
  // can be shown as its own chip rather than read as part of the name. See
  // lib/exampleShop — a visitor must never be able to take a shop the site
  // invented for a real seller, and on a trail of small grey crumbs the words
  // "(example shop)" tucked inside a name is exactly what gets skipped.
  const listing = readListingName(event.name);
  // The shelf this shop is filed under, for the breadcrumb and the cross-shop
  // rail. null when its seller picked none, and then neither of those two
  // things is rendered rather than being rendered against a blank shelf.
  const shelf = isShop ? shopCategory(event.category) : null;

  // ---- The bazaar's furniture, read once, and for shops only ----
  //
  // The isShop gate is not a performance note dressed up as a rule. A review
  // of an event cannot exist at all — writeReview() refuses anything whose
  // listing is not a shop — so the "nobody has reviewed this yet" line would
  // be promising a concert ticket something that can never happen to it.
  // listShopItems() returns shops and nothing else, so both rails would come
  // back empty. And an event carries no category, because a category answers
  // "what does this shop sell?". An event's item page therefore keeps exactly
  // what it had before, and pays for none of this.
  const rating = isShop ? ratingForItem(event.id, tier.tierKey) : null;
  const reviews = isShop ? listReviewsForItem(event.id, tier.tierKey) : [];
  const together = isShop ? pairedItems(event.id, tiers, tier.tierKey) : [];

  // ONE read for BOTH rails, and it is the same read /market and /market/items
  // already make: every published shop, its items, its photos, what is left of
  // each and every rating, in a fixed handful of statements whatever the size
  // of the bazaar (see lib/marketItems). The obvious alternative — "the other
  // things this shop sells" and "the same shelf elsewhere" as two queries of
  // their own — is the N+1 that lib/feedSnapshot exists to prevent, and it
  // would read at a different instant from the availability above, so a rail
  // could offer as available something the badge at the top of this very page
  // had just called sold out.
  const bazaar = isShop ? listShopItems() : [];
  // This page's own row inside that array — what both rails exclude, and what
  // tells othersOnShelf which shelf to look along. Matched on the pair (shop,
  // tier key) rather than on the href, because a tier key is unique only
  // WITHIN a listing and the href is merely one spelling of that pair.
  const self =
    bazaar.find((row) => row.shop.id === event.id && row.tier.tierKey === tier.tierKey) ?? null;
  const alsoFromShop = self ? moreFromShop(bazaar, self) : [];
  const onSameShelf = self ? othersOnShelf(bazaar, self) : [];

  const itemPath = `/e/${event.slug}/item/${encodeURIComponent(tier.tierKey)}`;

  // The flat copy of this item that goes onto the shopper's own "saved" and
  // "recently viewed" lists — in their browser's localStorage, on their own
  // device, and nowhere else. See lib/savedItems for why it is a copy rather
  // than an id, and why nothing here is ever sent to a server.
  //
  // The href is the page's canonical path with no ?ref= on it: the lists key
  // items by href, so a referral code riding along would put the same jar on
  // the list twice under two names, and one of them would credit a sharer for
  // a visit the shopper made from their own saved list.
  //
  // The example mark stays INSIDE the name here, which is the one place on the
  // site that does that. Everywhere else the mark is split off and shown as an
  // amber chip, because there is a chip to show it in; a SavedItem is a flat
  // record with no field for the fact, and the saved page prints "Sold by
  // <name>" beside a price. Rather than let an invented seller be listed there
  // as a real one, the warning travels in the only field that can carry it.
  const savedItem: SavedItem = {
    href: itemPath,
    name: tier.name,
    shopName: listing.isExample ? `${listing.name} (example shop)` : listing.name,
    city: event.city,
    priceCents: tier.priceCents,
    currency: event.currency,
    photoId: photo?.id ?? null,
    at: Date.now(),
  };

  const itemUrl = absoluteUrl(itemPath);
  // The SAME URL generateMetadata puts in og:image. A crawler fetches the head
  // and the body of one response: two different pictures for one product is the
  // kind of mismatch that gets structured data ignored.
  const ogImage = photo ? mediaUrl(photo.id, 'card', null) : socialImageUrl(event);
  // The rating goes through lib/seo rather than being bolted onto the object
  // it returns, so every item page emits one shape. It is the SAME `rating`
  // object the stars under the title and the review list below are drawn from
  // — Google validates aggregateRating against what the page shows, so the
  // markup and the pixels have to come from one read. Null (no reviews yet,
  // which is most items on a bazaar this young) emits no rating at all.
  const productLd = itemJsonLd({
    event,
    tiers,
    tier,
    remaining,
    totalRemaining: availability.totalRemaining,
    images: ogImage ? [absoluteUrl(ogImage)] : [],
    // The disclosed seller, not this platform — the same name the page prints
    // under the button. See the note in lib/seo itemJsonLd.
    sellerName: organizer?.name?.trim() || SITE_NAME,
    url: itemUrl,
    rating,
  });

  // Paragraphs, not a wall: sellers type their write-up with blank lines in it,
  // and the description field on the event page is rendered the same way.
  const detailParagraphs = tier.details
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  // The opening of that write-up, for the jump control near the button. Cut
  // here rather than left whole and clamped in CSS for two reasons: the whole
  // first paragraph is ~300 characters that would then sit in the page twice,
  // and a clamped block is still read out in full by a screen reader, so the
  // link's own text would be a paragraph. 105 is about two lines at the width
  // this sits in on a phone; the cut lands on a word boundary so it never
  // breaks mid-word, and CSS clamps as a backstop for a narrower screen.
  const TEASER_CHARS = 105;
  const detailTeaser = (() => {
    const first = detailParagraphs[0];
    if (!first) return null;
    // A one-line paragraph shorter than the cut is shown whole, with no ellipsis
    // promising something that is not there.
    if (first.length <= TEASER_CHARS) return first;
    const cut = first.slice(0, TEASER_CHARS);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—-]+$/, '')}…`;
  })();

  // The listing's own accent, on the listing's own item pages. This is the same
  // shop one tap further in, so its buttons, links and the blank-photo wash
  // have to be the colour the organizer chose — without this wrapper they fell
  // back to the :root violet, and a gold shop turned violet the moment a
  // shopper opened one of its items.
  const theme = ACCENT_THEMES[parsePageDesign(event.pageDesign).accent ?? 'violet'];

  return (
    <div className="container item-page" style={{ ...theme } as React.CSSProperties}>
      <SwipeFx selector=".bz-rail-track" />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(productLd)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(itemBreadcrumbJsonLd(event, tier))}
      />

      {/* Where this thing sits in the bazaar, for the shopper who arrived on a
          search result with no history to go back to: the market, the shelf it
          is filed under, the stall that sells it, and then the thing itself.
          The last crumb is not a link, because a link to the page you are
          already standing on is a control that does nothing.

          Shops only. An event has no shelf — a category answers "what does
          this shop sell?" and events carry none — so the trail would come out
          as two crumbs with a hole where the middle one should be, under a
          heading calling a concert ticket part of a market. */}
      {isShop && (
        <nav aria-label="Breadcrumb">
          <ol className="bz-crumbs">
            <li>
              <Link href="/market">The bazaar</Link>
            </li>
            {shelf && (
              <li>
                <Link href={`/market/c/${shelf.key}`}>{shelf.label}</Link>
              </li>
            )}
            <li>
              <Link href={backHref}>{listing.name}</Link>
              {/* As loud in the trail as it is on a tile. The mark is split off
                  the name so it does not read as part of it, then put straight
                  back as a chip — the one fact on this page a visitor must not
                  be allowed to miss is that some of these sellers are the
                  site's own invention. */}
              {listing.isExample && (
                <span className="badge badge-amber" style={{ marginLeft: 6 }}>
                  Example shop
                </span>
              )}
            </li>
            <li aria-current="page">{tier.name}</li>
          </ol>
        </nav>
      )}

      {/* The way back to the whole shop, at the top where a browser's own back
          button would be on a phone — someone who landed here from a search
          result has no history to go back to.

          On a shop that job now belongs to the breadcrumb above, which says
          the same thing and two more besides, so this line would be a second
          back link stacked on the first one and competing with it. An event
          keeps it: there is no trail above an event, and this is still the
          only way back to the listing without a browser button. */}
      {!isShop && (
        <p className="item-back">
          <Link href={backHref}>← All {v.units} at {event.name}</Link>
        </p>
      )}

      {/* Three children, not two: the gallery is a SIBLING of the picture and
          the detail column rather than a child of the media column, because
          the stacked phone layout has to be able to put it last. When it lived
          inside .item-media a shopper on a phone met the hero, then 400px of
          "more photos from the shop", and only then the item's own name and
          price — the rail was outranking the thing the page is about. The grid
          areas in globals.css order it photo / detail / gallery on a phone and
          keep the desktop two-column shape. */}
      <div className="item-layout">
        <div className="item-media">
          {heroUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="item-photo" src={heroUrl} alt={`${tier.name} — ${event.name}`} />
          ) : (
            /* No photo is the NORMAL case on an event, so it gets a deliberate
               panel rather than an empty frame: the item's initial on the
               listing's own accent wash. Nothing here says "missing image". */
            <div className="item-photo item-photo-blank" aria-hidden="true">
              <span>{tier.name.trim().charAt(0).toUpperCase() || v.Unit.charAt(0)}</span>
            </div>
          )}
        </div>

        <div className="item-detail">
          <div className="item-badges">
            <span className={badge.className}>{badge.label}</span>
            {tier.studentOnly && <span className="badge badge-student">Student</span>}
          </div>

          <h1 className="page-title item-title">
            {/* The seller's own words, with any Devanagari in them marked as
                Nepali on the way out — see MixedScript. Sellers here write
                "Taplejung ko अलैंची" inside one line, and no editor field
                could ask them to say which half is which. */}
            <MixedScript>{tier.name}</MixedScript>
          </h1>

          {/* The score, directly under the name and directly above the price —
              the three things a shopper weighs against each other, in the
              order they weigh them. It is a link to the reviews themselves
              because a number nobody can check is a number nobody should be
              asked to believe; #reviews is at the bottom of this page and
              scroll-margin lands it clear of the sticky header.

              Rendered only when there is a rating at all. Stars itself draws
              nothing for null, so this wrapper is guarded too — an empty
              paragraph would leave a gap between the title and the price that
              reads as something that failed to load. The class on the wrapper
              is what makes these the big stars rather than tile-sized ones. */}
          {rating && (
            <p className="bz-stars-md" style={{ margin: '2px 0 10px' }}>
              <Stars rating={rating} size="md" href="#reviews" />
            </p>
          )}

          <p className="item-seller-line">
            {isShop ? 'From' : 'Part of'} <Link href={backHref}>{event.name}</Link>
          </p>

          {/* Where and when, on the page a shared link most often opens.
              An item link is what gets forwarded in a group chat — it skips
              the listing page entirely, so everything the hero over there says
              about the city has to be said again here. */}
          {itemPlace ? <p className="item-place-line">{itemPlace}</p> : null}

          <div className="tier-price">
            {tier.priceCents === 0 ? 'Free' : formatMoney(tier.priceCents, event.currency)}
          </div>
          {subscribe && tier.priceCents > 0 && (
            <p className="item-subscribe">
              <span aria-hidden="true">↻</span> <strong>Subscribe &amp; save {subscribe.pct}%</strong> —{' '}
              {formatMoney(tier.priceCents - subscribeDiscountCents(subscribe.pct, tier.priceCents), event.currency)} each
              time, repeating every 1, 2 or 4 weeks. Tick it at checkout; skip or cancel any time.
            </p>
          )}

          {/* Same sentence as the listing card, for the same reason: the price
              above is per bundle, not per person, and a buyer must know that
              before they press the button under it. */}
          {tier.seatsPerUnit > 1 && (
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              Includes {tier.seatsPerUnit} {isShop ? v.units : 'seats'} — you get{' '}
              {tier.seatsPerUnit} QR {v.codes} per booking.
            </p>
          )}

          {tier.description.trim() && (
            <p className="item-lede">
              <MixedScript>{tier.description}</MixedScript>
            </p>
          )}

          {/* The same sentence the listing card prints, and for the same
              reason: the badge above names the restriction, this says what it
              costs you at the door. A buyer who arrived on a shared link to a
              student ticket, tapped the button and checked out would otherwise
              never meet the condition on any page in that path. */}
          {tier.studentOnly && (
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              Bring a valid student ID — it&rsquo;s checked at the entrance.
            </p>
          )}

          {/* Same warning as the listing page and the checkout, because this
              page has its own buy button and a shared item link can reach it
              without passing either of them. */}
          <OtherCityNotice city={cityLabel(event.city)} shows={itemOtherCities} />

          {/* A flex row rather than the inline flow these two would otherwise
              fall into. The buy control is btn-lg and the save toggle is a
              normal button, and inline layout sits the smaller one's text on
              the bigger one's baseline, which reads as a mistake rather than
              as two controls. Wrapping is what keeps both of them whole on a
              360px screen instead of squeezing the primary one. */}
          <p
            className="item-actions"
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}
          >
            {buyable ? (
              /* Short label, full name in the accessible one. The button sits
                 directly under the h1 that names the item, so repeating a name
                 like "Gift box · pods, tin & chiya masala" inside it wraps the
                 control over three lines to say what the heading just said —
                 but a screen reader jumping between links needs the name. */
              <>
                <Link href={buyHref} className="btn btn-primary btn-lg" aria-label={`${v.cta} ${tier.name}`}>
                  {v.cta}
                </Link>
              </>
            ) : (
              /* Not a disabled button: there is nothing to press, and a greyed
                 control invites people to keep trying it. The badge above
                 already says why, in the listing's own words. */
              <span className="btn btn-lg" aria-disabled="true">
                {state.kind === 'past' ? state.badge : badge.label}
              </span>
            )}
            {/* Into the basket that spans every seller, for a shopper filling
                one order from several stalls (lib/basket). Example shops too,
                marked — they show how it works and are never ordered. */}
            {basketLine && <AddToBasket line={basketLine} />}

            {/* Beside the button rather than under it: the two things a
                shopper can do on this page are buy it now and come back to it
                later, and the second one is the whole answer for somebody
                comparing four sellers of the same achar. It also survives a
                sold-out row — an item you cannot have today is exactly the one
                worth keeping a note of.

                It renders NOTHING until it has read this browser's own list,
                so this row is one control wide on the server and two a frame
                after mount; see SaveButton for why guessing would cost a
                hydration mismatch.

                Shops only. The saved page renders these as goods, with a
                seller and a price beside each, and dropping a dated concert
                ticket into that list would make a claim about what the list
                is that the list cannot keep. */}
            {isShop && <SaveButton item={savedItem} />}
          </p>

          {/* The way into the seller's own writing, and the reason it shows two
              lines of that writing rather than only promising it.

              "About this item" is where a spice nobody can smell through a
              screen is actually sold — 600-800 characters of it on the seeded
              shop — and it sits below the gallery, past the button. A shopper
              met the CTA and either bought or left; the paragraphs were never
              read. A bare "read more" link asks to be trusted. Two lines of the
              real prose is the evidence, and it is what makes somebody who was
              not going to scroll want to.

              ONE control, not a link beside the button plus a teaser below it:
              the page then has exactly two things to do — buy, or read — and
              sitting UNDER the primary button is what keeps this one from
              competing with it. Hidden entirely when tier.details is empty,
              which is the normal case for an event ticket: a link to an absent
              section is worse than no link. */}
          {detailTeaser && (
            <a className="item-jump" href="#about" aria-label={`Read about this ${v.unit}`}>
              {/* Affordance first, evidence second — and the practical reason:
                  on a 375x812 phone this card's top edge is the last thing on
                  the first screen, so the line that says what it does has to be
                  the line that lands there. */}
              <span className="item-jump-more" aria-hidden="true">
                Read about this {v.unit} <span className="item-jump-arrow">↓</span>
              </span>
              <span className="item-jump-text">{detailTeaser}</span>
            </a>
          )}

          {/* Under the jump link rather than directly under the button, where it
              used to sit: it is fine print about a limit nobody has hit yet, and
              it was costing the one thing on this page that has to be reachable
              without a scroll a place on the first screen. */}
          <p className="muted small" style={{ marginTop: 10 }}>
            Up to {event.maxPerOrder} {v.units} per order.
          </p>

          {/* The listing offers a waitlist when it is sold out, so an item page
              of that listing must too — a shopper who arrived on a shared item
              link was the one person given a dead end. Keyed on the LISTING's
              state, exactly as there: the list watches the whole listing for
              freed stock, so offering it because this one row is out would
              promise an email on a condition nobody is measuring. There is no
              preview of an item page, hence no !preview here. */}
          {state.kind === 'sold-out' && (
            <div style={{ marginTop: 16, maxWidth: 480 }}>
              <WaitlistForm eventId={event.id} kind={event.kind} checkoutHref={buyHref} />
            </div>
          )}

          {/* Who you are buying from, said on the page where the buying starts
              — and this is now one of those pages. The seller is the organizer,
              not this site: they set the price, the money lands in their own
              account, and they hand the goods over. Naming them here is not
              decoration; a buyer page that does not name the Veranstalter is
              what turns the whole ticket value into this platform's turnover
              (§3 Abs. 11 UStG), so this line goes wherever a price does. */}
          <p className="muted small" style={{ marginTop: 14 }}>
            {isShop ? 'Sold by' : 'Presented by'} <strong>{sellerName}</strong>.{' '}
            {isShop
              ? 'Your order is placed with them, and your payment goes straight to their own account — it never passes through us.'
              : 'Tickets for this event are sold by them, and your payment goes straight to their own account — it never passes through us.'}
          </p>
          {/* The shop behind this item, one tap away: its whole range in the
              bazaar, so a shopper who came for one achar can fill a basket. */}
          {isShop && (
            <Link href={`/market?shop=${encodeURIComponent(event.slug)}`} className="item-visit-shop">
              <span className="item-visit-icon" aria-hidden="true">
                🛍
              </span>
              <span className="item-visit-text">
                <strong>Visit {listing.name}</strong>
                <span>
                  All {visibleTiers(tiers).length} items from this shop in the bazaar
                </span>
              </span>
              <span className="item-visit-go" aria-hidden="true">
                →
              </span>
            </Link>
          )}
        </div>

        {galleryItems.length >= 2 && (
          <div className="item-gallery">
            {/* A quiet label ABOVE the rail instead of the sentence that used to
                sit under it. The caption was the loudest text in the media
                column — louder than the item's own picture — and it spent a
                line explaining a gesture the swiper's own full-screen control
                already offers. */}
            <p className="item-gallery-label">More from {event.name}</p>
            <MediaSwiper items={galleryItems} label={`${tier.name} photos`} />
          </div>
        )}
      </div>

      {detailParagraphs.length > 0 && (
        /* The target of .item-jump. scroll-margin-top in globals.css is what
           lands this heading BELOW the sticky site header rather than behind
           it. */
        <section className="section item-about" id="about">
          <h2 className="page-title item-about-title">About this {v.unit}</h2>
          {detailParagraphs.map((p, i) => (
            <p key={i} className="item-prose">
              <MixedScript>{p}</MixedScript>
            </p>
          ))}
        </section>
      )}

      {together.length > 0 && (
        /* The only block on this page that makes a claim about OTHER PEOPLE,
           which is why it is the one with a floor under it and a sentence
           saying where the claim comes from.

           Everything here survived two filters. lib/relatedItems refused to
           answer below two separate paid orders, and pairedItems() above threw
           away anything that is no longer visible and on sale. What is left is
           a short list of things that genuinely turned up in the same baskets
           and can genuinely still be bought — which is why the copy is allowed
           to say so flatly instead of hedging with "you might also like". */
        <section className="section">
          <h2 className="page-title" style={{ margin: '0 0 8px' }}>
            Often bought together
          </h2>
          <p className="muted small" style={{ margin: '0 0 14px', maxWidth: '68ch' }}>
            Built from what people actually ordered here, not from what looks similar: every item
            below turned up in at least two separate paid orders alongside this one.
          </p>

          <div className="bz-together">
            {/* This item leads the list, unlinked — it is the page you are on,
                and a link back to it would be the one row in the panel that
                goes nowhere. The empty plus keeps its name and price in the
                same two columns as the rows under it. */}
            <div className="bz-together-row">
              <span className="bz-together-plus" aria-hidden="true" />
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                {tier.name} <span className="muted small">— the one you are looking at</span>
              </span>
              <strong style={{ flex: 'none' }}>
                {tier.priceCents === 0 ? 'Free' : formatMoney(tier.priceCents, event.currency)}
              </strong>
            </div>

            {together.map(({ tier: paired, orders }) => (
              <div className="bz-together-row" key={paired.tierKey}>
                <span className="bz-together-plus" aria-hidden="true">
                  +
                </span>
                <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                  {/* ?ref= rides on, exactly as it does everywhere else on this
                      page: a shopper who arrived on somebody's shared link and
                      then followed a suggestion is still that sharer's visit. */}
                  <Link
                    href={`/e/${event.slug}/item/${encodeURIComponent(paired.tierKey)}${
                      refCode ? `?ref=${refCode}` : ''
                    }`}
                  >
                    {paired.name}
                  </Link>{' '}
                  {/* The evidence, printed beside the claim rather than left
                      implied — it is never fewer than two, and a shopper can
                      weigh "in 2 orders" for themselves in a way they cannot
                      weigh the word "often". */}
                  <span className="muted small">in {orders} orders with this one</span>
                </span>
                <strong style={{ flex: 'none' }}>
                  {paired.priceCents === 0
                    ? 'Free'
                    : formatMoney(paired.priceCents, event.currency)}
                </strong>
              </div>
            ))}
          </div>

          {/* Prices are shown above, so the seller is named under them. Not
              decoration and not repetition for its own sake: a buyer-facing
              panel with prices on it that does not name the Veranstalter is
              what turns the whole order value into this platform's turnover
              (§3 Abs. 11 UStG). Everything in this panel is one shop's, which
              is why one line covers all of it. */}
          <p className="muted small" style={{ margin: '10px 0 0' }}>
            Sold by <strong>{sellerName}</strong> — every price here is theirs, and each of these
            is ordered from them and paid straight to them.
          </p>
        </section>
      )}

      {/* Two rails, in this order. The rest of this seller's stall first,
          because somebody holding one jar of their pickle is likeliest to want
          the next thing the same hands made; the same shelf at OTHER stalls
          second, which is the one place in the bazaar where a shopper is
          deliberately handed a competitor.

          Both draw nothing at all below three tiles — see ItemRail. Two items
          under a heading is not a selection, it is everything there was,
          dressed up as one. Neither is rendered on an event page, because
          `bazaar` is empty there by construction.

          "More from this shop" and not "More from <shop name>", which is the
          heading the PHOTO rail up in the media column already carries. Two
          headings reading "More from Taplejung Alaichi Ghar" on one page, one
          over pictures of this jar and one over other things for sale, is a
          shopper being told the same words mean two different things a screen
          apart. The shop is named on every tile in the row anyway — "Sold by"
          is not optional there — so nothing is lost by letting the other
          heading keep the name. */}
      <ItemRail
        title="More from this shop"
        items={alsoFromShop}
        href={backHref}
        hrefLabel="Everything at this shop"
      />
      <ItemRail
        title="Others on this shelf"
        items={onSameShelf}
        href={shelf ? `/market?category=${encodeURIComponent(shelf.key)}` : undefined}
        hrefLabel="See the whole shelf"
        note={
          shelf
            ? `Other sellers filed under ${shelf.label}. Nobody pays to be in this row: things ` +
              `you can buy today come first, real shops before the site's own example ones, and ` +
              `that is the whole of it.`
            : undefined
        }
      />

      {/* The reviews, and the anchor every star cluster on the site points at.
          The component owns the id itself so the two can never be separated by
          a rearrangement of this page. Shops only, for the reason given where
          `reviews` is read: an event's ticket can never be reviewed by anyone,
          so an empty block explaining how to review it would be an invitation
          nobody can accept. */}
      {isShop && (
        <ItemReviews
          rating={rating}
          reviews={reviews}
          itemName={tier.name}
          sellerName={sellerName}
        />
      )}

      {/* The collection/venue details live on the listing page and are the same
          for everything it sells, so this points at them rather than copying a
          second, drifting version of an address. */}
      <p style={{ margin: '28px 0 40px' }}>
        <Link href={backHref} className="btn">
          Back to {event.name}
        </Link>
      </p>

      {/* Renders nothing, fetches nothing, sends nothing anywhere: it drops
          this item onto the "recently viewed" list in this browser's own
          storage and stops. Last in the tree because it is not content — where
          it sits changes nothing a shopper sees, and putting it higher would
          put a client component ahead of the page's own words in the stream. */}
      {isShop && <TrackView item={savedItem} />}
    </div>
  );
}
