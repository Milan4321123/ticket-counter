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
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import MediaSwiper from '@/components/MediaSwiper';
import type { MediaSwiperItem } from '@/components/MediaSwiper';
import WaitlistForm from '@/components/WaitlistForm';
import { ACCENT_THEMES } from '@/lib/accents';
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
import { getAvailability } from '@/lib/inventory';
import { socialImageUrl } from '@/lib/listing';
import { formatMoney } from '@/lib/money';
import { getOrganizer } from '@/lib/organizers';
import {
  SITE_NAME,
  absoluteUrl,
  itemBreadcrumbJsonLd,
  itemDescription,
  itemJsonLd,
  jsonLdScript,
} from '@/lib/seo';
import { tierBadge, ticketState, visibleTiers } from '@/lib/ticketState';
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
function load(slug: string, tierKey: string): { event: EventRow; tier: EventTierRow } | null {
  const event = getEventBySlug(slug);
  if (!event || event.status !== 'published') return null;
  const tier = visibleTiers(getEventTiers(event.id)).find((t) => t.tierKey === tierKey);
  return tier ? { event, tier } : null;
}

/** This item's own picture, or null — guarded against a deleted/foreign id. */
function photoOf(event: EventRow, tier: EventTierRow): EventMediaRow | null {
  return tierPhoto(tier, getEventMedia(event.id));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, tierKey } = await params;
  const found = load(slug, decodeURIComponent(tierKey));
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
  const title = `${tier.name} — ${event.name}`;

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
      ...(image
        ? {
            images: [
              // 800x1000 for the item's own photo, 1600x740 for the listing
              // fallback — declared honestly either way, because a stated size
              // that does not match the bytes is what makes a preview render a
              // stretched thumbnail.
              photo
                ? { url: image, width: 800, height: 1000, alt: tier.name }
                : { url: image, width: 1600, height: 740, alt: tier.name },
            ],
          }
        : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ItemPage({ params, searchParams }: Params) {
  const { slug, tierKey } = await params;
  const found = load(slug, decodeURIComponent(tierKey));
  if (!found) notFound();
  const { event, tier } = found;

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
  const tiers = getEventTiers(event.id);
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

  const organizer = getOrganizer(event.organizerId);
  const sellerName = organizer?.name?.trim() || 'the organizer';

  const itemUrl = absoluteUrl(`/e/${event.slug}/item/${encodeURIComponent(tier.tierKey)}`);
  // The SAME URL generateMetadata puts in og:image. A crawler fetches the head
  // and the body of one response: two different pictures for one product is the
  // kind of mismatch that gets structured data ignored.
  const ogImage = photo ? mediaUrl(photo.id, 'card', null) : socialImageUrl(event);
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
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(productLd)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(itemBreadcrumbJsonLd(event, tier))}
      />

      {/* The way back to the whole shop, at the top where a browser's own back
          button would be on a phone — someone who landed here from a search
          result has no history to go back to. */}
      <p className="item-back">
        <Link href={backHref}>← All {v.units} at {event.name}</Link>
      </p>

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

          <h1 className="page-title item-title">{tier.name}</h1>
          <p className="item-seller-line">
            {isShop ? 'From' : 'Part of'} <Link href={backHref}>{event.name}</Link>
          </p>

          <div className="tier-price">
            {tier.priceCents === 0 ? 'Free' : formatMoney(tier.priceCents, event.currency)}
          </div>

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
            <p className="item-lede">{tier.description}</p>
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

          <p className="item-actions">
            {buyable ? (
              /* Short label, full name in the accessible one. The button sits
                 directly under the h1 that names the item, so repeating a name
                 like "Gift box · pods, tin & chiya masala" inside it wraps the
                 control over three lines to say what the heading just said —
                 but a screen reader jumping between links needs the name. */
              <Link href={buyHref} className="btn btn-primary btn-lg" aria-label={`${v.cta} ${tier.name}`}>
                {v.cta}
              </Link>
            ) : (
              /* Not a disabled button: there is nothing to press, and a greyed
                 control invites people to keep trying it. The badge above
                 already says why, in the listing's own words. */
              <span className="btn btn-lg" aria-disabled="true">
                {state.kind === 'past' ? state.badge : badge.label}
              </span>
            )}
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
              {p}
            </p>
          ))}
        </section>
      )}

      {/* The collection/venue details live on the listing page and are the same
          for everything it sells, so this points at them rather than copying a
          second, drifting version of an address. */}
      <p style={{ margin: '28px 0 40px' }}>
        <Link href={backHref} className="btn">
          Back to {event.name}
        </Link>
      </p>
    </div>
  );
}
