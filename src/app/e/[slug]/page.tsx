import LoopCarousel from '@/components/LoopCarousel';
import { currentLang } from '@/lib/i18nServer';
import { localizeListing } from '@/lib/listingI18n';
import CityCheck from '@/components/CityCheck';
import Stars from '@/components/Stars';
import { ratingForShop, ratingsForItems } from '@/lib/reviews';
import { MixedScript } from '@/components/Np';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AskOrganizerForm from '@/components/AskOrganizerForm';
import ChatWidget from '@/components/ChatWidget';
import OrganizerWhatsApp from '@/components/OrganizerWhatsApp';
import FeedPhoto from '@/components/FeedPhoto';
import FeedVideo from '@/components/FeedVideo';
import MediaSwiper from '@/components/MediaSwiper';
import type { MediaSwiperItem } from '@/components/MediaSwiper';
import HeroCoverVideo from './HeroCoverVideo';
import HeroDepth from './HeroDepth';
import EventDepth from './EventDepth';
import HoloStage from './HoloStage';
import SectionNav from './SectionNav';
import type { EventSectionLink } from './SectionNav';
import StickyCtaBar from './StickyCtaBar';
import OtherCityNotice from '@/components/OtherCityNotice';
import {
  cropTag,
  getEventById,
  getEventBySlug,
  getEventFaqs,
  getEventMedia,
  getEventTiers,
  getEventVideos,
  listEventPosts,
  listEventQuestions,
  mapsUrl,
  mediaUrl,
  parseCropRect,
  parsePageDesign,
  paypalPayee,
  tierHasItemPage,
  tierPhoto,
  unclaimedPhotos,
  videoEmbedUrl,
} from '@/lib/events';
import type { EventRow, PageDesign } from '@/lib/events';
import { paymentOptionsFor } from '@/lib/paymentConnections';
import { ACCENT_THEMES } from '@/lib/accents';
import { listStallLinksForShop, listVisibleStallsForEvent, stallBannerVisibleOnShopPage } from '@/lib/stalls';
import type { StallLinkRow } from '@/lib/stalls';
import { listingStillUrl, socialImageUrl } from '@/lib/listing';
import { BADGE_TONE, PLACEHOLDER_GRADIENTS } from '@/components/EventCard';
import { howItWorks } from '@/lib/howItWorks';
import { vocabFor } from '@/lib/vocab';
import { loadFeedSnapshot } from '@/lib/feedSnapshot';
import { getAvailability } from '@/lib/inventory';
import { runWaitlistNotifySweep } from '@/lib/waitlist';
import { runTransferReminderSweep } from '@/lib/reminders';
import WaitlistForm from '@/components/WaitlistForm';
import EventCountdown from '@/components/EventCountdown';
import WishButton from '@/components/WishButton';
import { readListingName } from '@/lib/exampleShop';
import { canWish, wishCountsFor } from '@/lib/wishes';
import { cityLabel, otherShowsByAct, shortDateLabel } from '@/lib/sameAct';
import {
  ticketState,
  fromPriceCents,
  tierBadge,
  visibleTiers,
  tiersInSaleOrder,
  comingSoonLabel,
} from '@/lib/ticketState';
import { platformName } from '@/lib/platform';
import { currentOrganizer, getOrganizer } from '@/lib/organizers';
import { getSellerIdentitiesBulk, getSellerIdentity } from '@/lib/sellerIdentity';
import SellerBlock from '@/components/legal/SellerBlock';
import { listingOpenTo } from '@/lib/demo';
import { cleanTableLabel, parseSlotConfig } from '@/lib/kitchen';
import {
  getReferralRewardSettings,
  organizerCurrency,
  referralRewardsReachable,
} from '@/lib/referrals';
import { formatMoney } from '@/lib/money';
import {
  SITE_NAME,
  absoluteUrl,
  eventBreadcrumbJsonLd,
  eventDescription,
  eventJsonLd,
  jsonLdScript,
  SHARE_CARD,
  shareImages,
} from '@/lib/seo';

// Availability comes from the database — always render fresh.
export const dynamic = 'force-dynamic';

/** Subtle hero adjustments per vibe — sizing and spacing only. */
function vibeTuning(vibe: PageDesign['vibe']): {
  hero: React.CSSProperties;
  h1: React.CSSProperties;
} {
  switch (vibe) {
    case 'bold':
      return { hero: {}, h1: { fontSize: 'clamp(2.4rem, 6vw, 4rem)' } };
    case 'elegant':
      return {
        hero: { minHeight: 'clamp(520px, 80vh, 780px)' },
        h1: { letterSpacing: '0.01em', fontWeight: 700 },
      };
    case 'party':
      return { hero: {}, h1: { fontSize: 'clamp(2.3rem, 5.5vw, 3.8rem)' } };
    case 'minimal':
      return {
        hero: { minHeight: 'clamp(380px, 58vh, 560px)' },
        h1: { fontSize: 'clamp(1.9rem, 4vw, 2.9rem)' },
      };
    default:
      return { hero: {}, h1: {} };
  }
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Post date header: relative while fresh ("Today", "3 days ago"), absolute
 * once it is older than a week. UTC math keeps server output deterministic.
 */
function postDateLabel(createdAt: string): string {
  const ts = Date.parse(createdAt.replace(' ', 'T') + 'Z');
  if (Number.isNaN(ts)) return createdAt;
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

interface Params {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);

  // A draft or a deleted event must not be indexable — and must not leak its
  // name into a title tag either. noindex here is what stops a page that was
  // briefly public from lingering in Google after it is unpublished.
  if (!event) return { title: 'Event not found', robots: { index: false, follow: false } };

  // An unpublished event can be opened by its own organizer as a preview, so it
  // gets a real title to sit in the browser tab — but never an index entry, an
  // og:image, or a canonical. Metadata is public even when the page body is
  // not: a crawler that fetches this URL without the session cookie is served
  // exactly this, so the noindex has to live here and not only in the body.
  if (event.status !== 'published' || event.isDemo) {
    return { title: `${event.name} — ${event.isDemo ? 'demo' : 'preview'}`, robots: { index: false, follow: false } };
  }

  const description = eventDescription(event);
  const image = socialImageUrl(event);
  const url = absoluteUrl(`/e/${event.slug}`);
  // What a searcher types: the thing, then the city. "Dashain Night 2026 —
  // Tickets, Berlin" matches "dashain night berlin tickets" far better than the
  // name alone, and still reads like a sentence rather than keyword soup. A
  // shop's buyers are searching for something else entirely, so it says so.
  const searchNoun = event.kind === 'shop' ? 'Order online' : 'Tickets';
  // The town earns its place until the title stops fitting in a result.
  //
  // Google shows roughly 60 characters and the layout appends " | MartNepali"
  // to every title, so the page's own half has about 45 to spend. A long
  // listing name plus a noun plus a town went past that and got cut — and what
  // gets cut is the END, which is precisely the town this was added for. So
  // when it will not fit, the town is dropped deliberately rather than
  // truncated by somebody else: a whole shorter title beats a longer one with
  // its last word missing.
  const TITLE_BUDGET = 60 - ` | ${SITE_NAME}`.length;
  const withCity = `${event.name} — ${searchNoun}${event.city.trim() ? `, ${event.city.trim()}` : ''}`;
  const title = withCity.length <= TITLE_BUDGET ? withCity : `${event.name} — ${searchNoun}`;

  return {
    title,
    description,
    // Canonical, so the event has exactly ONE address in Google's index no
    // matter what tracking parameters get appended when the link is shared.
    alternates: { canonical: `/e/${event.slug}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: SITE_NAME,
      // The listing's own cover if it has one, the site's card if it does not.
      // A listing with no photograph used to ship no og:image at all, so the
      // one thing an organizer does the hour they publish — paste the link
      // into their community's WhatsApp group — produced a grey box.
      images: shareImages(image ? { url: image, width: 1600, height: 740, alt: event.name } : null),
    },
    twitter: {
      // Always the large card now: there is always a picture behind it.
      card: 'summary_large_image',
      title,
      description,
      images: [image ?? SHARE_CARD.url],
    },
  };
}

export default async function EventPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const rawEvent = getEventBySlug(slug);
  if (!rawEvent) notFound();
  // The listing's own words in the visitor's language, when a translation of
  // the current text exists (lib/listingI18n) — rendered here on the server,
  // so switching language never flashes the English first.
  const localized = localizeListing(
    rawEvent,
    getEventTiers(rawEvent.id),
    getEventFaqs(rawEvent.id),
    parsePageDesign(rawEvent.pageDesign),
    await currentLang()
  );
  const event = localized.event;

  // ?ref= arrives on shared links (a buyer's own order page and ticket email
  // both append their referral code) and rides every checkout link below as a
  // PLAIN query param — no cookie, nothing stored on this page. Shape-checked
  // only; the orders API is the guard that decides whether it counts.
  const sp = await searchParams;
  const rawRef = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  const refCode =
    typeof rawRef === 'string' && /^[A-Za-z0-9]{8}$/.test(rawRef.trim())
      ? rawRef.trim().toUpperCase()
      : null;

  /**
   * An unpublished event is visible to exactly one person: the organizer who
   * owns it.
   *
   * Before this, a draft 404'd for everybody — including its author — so the
   * first time anyone saw their own event page was after they had paid the fee
   * and put it in front of the public. That is the wrong order. Someone should
   * be able to look at what they have built, decide it is right, and only then
   * pay; and if the photos are wrong they should find that out privately.
   *
   * Ownership is checked against the session, NOT against anything in the URL —
   * a slug is guessable, and "unlisted therefore safe" is not a permission
   * model. Anyone else, signed in or not, still gets the same 404 as before.
   */
  const isPublished = event.status === 'published';
  let preview = false;
  if (!isPublished) {
    const viewer = await currentOrganizer();
    if (!viewer || viewer.id !== event.organizerId) notFound();
    preview = true;
  }
  // A try-it-yourself demo listing (lib/demo.ts) behaves like a live page —
  // it can be bought from, with a simulated payment — but only for the demo
  // account that owns it. Everyone else gets the same 404 a draft gives them.
  const demo = event.isDemo && isPublished;
  if (demo && !(await listingOpenTo(event))) notFound();

  const design = localized.design;
  const theme = ACCENT_THEMES[design.accent ?? 'violet'];
  const tuning = vibeTuning(design.vibe);

  const tiers = localized.tiers;
  const availability = getAvailability(event.id);
  // Every event-page render is also the waitlist's clock. Availability was
  // just computed anyway, and the sweep self-throttles to a Date.now() check
  // when nothing is due — so the people waiting on a sold-out event get told
  // about freed spots by the very traffic still looking at it, with no cron.
  void runWaitlistNotifySweep();
  // Payment reminders ride the same traffic. Before this they started only
  // when an organizer opened the portal dashboard, so after every deploy (a
  // fresh process) no buyer was reminded until some organizer signed in.
  void runTransferReminderSweep();

  /**
   * How many tickets can ACTUALLY be bought right now.
   *
   * Not the same as space left in the room, and the difference was showing.
   * Tier capacities do not have to add up to the event's capacity — an event for
   * 100 people can have ticket types totalling 50 — so every type can be
   * exhausted while the venue still has room. The old check only asked whether
   * the room was full, so such an event advertised "Tickets available" with a
   * Get tickets button that led to a checkout where nothing could be selected.
   *
   * Each tier's remaining is already clamped to the room by getAvailability, so
   * the sum can overshoot when several tiers are clamped to the same headroom —
   * hence the min.
   */
  // A tier that is only announced is not stock. Counting it would make an event
  // whose whole line-up is "coming soon" look on sale.
  const state = ticketState(event, tiers, availability);
  const soldOut = !state.buyable;
  const buyableRemaining = state.remaining;
  const minPrice = fromPriceCents(tiers, availability);

  // ---------------- Media ----------------

  const photos = getEventMedia(event.id); // photos only
  const videos = getEventVideos(event.id); // every uploaded video, in sort order
  const isPhotoId = (id: string | null) => !!id && photos.some((p) => p.id === id);
  const isVideoId = (id: string | null) => !!id && videos.some((v) => v.id === id);

  // Cover preference: the organizer's cover pick, then the poster, then the
  // first photo — skipping any id whose media row has since been deleted.
  const coverId =
    [event.coverMediaId, event.posterMediaId, photos[0]?.id ?? null].find(
      (id) => isPhotoId(id) || isVideoId(id)
    ) ?? null;
  const coverIsVideo = isVideoId(coverId);
  // Only a VIDEO cover has a source of its own — a photo cover is the still
  // below, and giving it a second URL here just invited one of the two to be
  // built without the framing stamp.
  const coverVideoUrl = coverIsVideo && coverId ? mediaUrl(coverId) : null;
  // ONE cover, never two. A video cover used to be backed by a DIFFERENT photo
  // (the poster, or the first upload) as its still, so the hero showed that
  // photo and then swapped to an unrelated clip — two covers, one after the
  // other. The video carries its own first frame, so there is nothing a stand-in
  // photo can add here except that flicker.
  const stillId = coverIsVideo ? null : coverId;
  // The 3D ticket in the hero shows a picture WHOLE, uncropped (the cover is a
  // wide strip cut from it): the poster when there is one, else that photo.
  const ticketArtId = isPhotoId(event.posterMediaId) ? event.posterMediaId : stillId;
  // The framing stamp only applies to the photo the organizer actually framed as
  // the cover — a stand-in still under a video cover was never positioned here,
  // so it keeps the automatic crop (and no stamp). See cropTag for why the URL
  // has to carry it at all.
  const stillTag = stillId === event.coverMediaId ? cropTag(parseCropRect(event.coverCrop)) : null;
  const stillUrl = stillId ? mediaUrl(stillId, 'cover', stillTag) : null;

  // One rail for everything, cover first, no duplicates.
  const galleryItems: MediaSwiperItem[] = [];
  const seenMedia = new Set<string>();
  let photoNo = 0;
  let videoNo = 0;
  // Photos go through the 'gallery' variant — the one render that keeps the
  // whole picture (see lib/imageVariants), because this rail is the one place
  // that shows it whole. Without it a shop page shipped its untouched uploads
  // into a 286px frame: 350 KB of the page's 520 KB of media was originals
  // nobody could see the detail of. Videos have no derivative and pass through.
  const addMedia = (id: string | null, kind: 'photo' | 'video') => {
    if (!id || seenMedia.has(id)) return;
    seenMedia.add(id);
    const alt =
      kind === 'video' ? `${event.name} video ${++videoNo}` : `${event.name} photo ${++photoNo}`;
    galleryItems.push({ id, kind, src: kind === 'photo' ? mediaUrl(id, 'gallery') : mediaUrl(id), alt });
  };
  addMedia(coverId, coverIsVideo ? 'video' : 'photo');
  // NOT every photo: the ones a tier claimed as its item picture belong to that
  // item's page, not to a rail captioned as photos of the whole listing. Left
  // in, a five-product shop advertised eight "photos" of itself, five of them
  // jars. The cover above is added before this and so survives the filter — an
  // organizer who deliberately made a product shot the cover keeps it.
  unclaimedPhotos(tiers, photos).forEach((m) => addMedia(m.id, 'photo'));
  videos.forEach((v) => addMedia(v.id, 'video'));
  // A lone item is already the hero cover — no point repeating it below.
  const showGallery = galleryItems.length >= 2;
  const galleryPhotos = galleryItems.filter((m) => m.kind === 'photo').length;
  const galleryVideos = galleryItems.length - galleryPhotos;
  const galleryBlurb = [
    galleryPhotos ? `${galleryPhotos} photo${galleryPhotos === 1 ? '' : 's'}` : '',
    galleryVideos ? `${galleryVideos} video${galleryVideos === 1 ? '' : 's'}` : '',
  ]
    .filter(Boolean)
    .join(' and ');

  // Legacy path: a pasted YouTube/Vimeo link, only when nothing was uploaded.
  const legacyVideo = videos.length === 0 ? videoEmbedUrl(event.videoUrl) : null;

  // Facebook-style page bits: round profile photo, update posts, FAQ.
  const profileUrl =
    event.profileMediaId && photos.some((m) => m.id === event.profileMediaId)
      ? mediaUrl(event.profileMediaId, 'avatar', cropTag(parseCropRect(event.profileCrop)))
      : null;
  const posts = listEventPosts(event.id);
  const faqs = localized.faqs;
  const answeredQuestions = listEventQuestions(event.id, 'answered');

  const maps = mapsUrl(event);
  const location = [event.venueName, event.city].filter(Boolean).join(', ');
  /**
   * Where and when, in the two words a buyer is actually checking.
   *
   * The venue line above is an address; this is the answer to "is this my
   * city, and is it the night I think it is". It goes directly under the title
   * because an act touring two countries publishes the SAME poster for both
   * dates — the title and the picture cannot tell those pages apart, and until
   * now nothing above the fold could either.
   */
  const heroCity = event.kind === 'shop' ? '' : cityLabel(event.city);
  const heroWhen = event.kind === 'shop' ? '' : shortDateLabel(event);
  /**
   * The same act, published elsewhere, in another city. Empty for all but a
   * handful of listings — see lib/sameAct.ts for how narrow the match is.
   */
  const otherCities = otherShowsByAct(event).map((other) => ({
    slug: other.slug,
    city: cityLabel(other.city),
    dateLabel: shortDateLabel(other),
  }));
  // The words this page speaks. A shop sells items to collect, not tickets to
  // a night out, and every noun below comes from here rather than a literal.
  const v = vocabFor(event.kind);
  // Which ways to pay this listing takes, for the 'how it works' steps below.
  const payOptions = paymentOptionsFor(event);
  const payOffer = { instant: payOptions.paypal !== null || payOptions.stripe !== null, transfer: payOptions.transfer, paypalMe: payOptions.paypalMe };
  const isShop = event.kind === 'shop';

  // Everything buyers have said about this shop, in TWO statements for the
  // whole page however many items are on it: one aggregate per item for the
  // grid, one for the shop as a whole. A rating per card would be a query per
  // card, which is the N+1 the rest of this codebase goes to some length to
  // avoid — see lib/reviews ratingsForItems.
  //
  // Shops only. An event's tickets are not reviewed here: "Standard entry, 3
  // stars" is a verdict on somebody's evening, not on a thing that was sold.
  const itemRatings = isShop ? ratingsForItems([event.id]) : new Map();
  // "Add to wish list" on what cannot be bought: an example shop's goods and
  // "Coming soon" rows (lib/wishes) — with how many already want each.
  const exampleListing = readListingName(event.name).isExample;
  const wishCounts = !preview ? wishCountsFor(event.id) : new Map<string, number>();
  const shopRating = isShop ? ratingForShop(event.id) : null;

  // One chip-sized line: the first line of the collection details, cut at a
  // word near 64 characters — a paragraph in a pill is an oval, not a chip.
  const firstCollectLine =
    event.pickupInfo
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) ?? '';
  const heroCollectLine =
    firstCollectLine.length > 70 ? `${firstCollectLine.slice(0, 64).replace(/\s+\S*$/, '')}…` : firstCollectLine;
  // A restaurant or food stall (its kitchen takes pickup times, or it sells
  // food or sweets): its goods read as a MENU — rows with a thumbnail, the way
  // every food app lists dishes — not as a shop's product grid.
  const foodPlace =
    isShop && (event.category === 'khaja-food' || event.category === 'sweets-bakery' || parseSlotConfig(event.pickupSlots).enabled);
  // A shop's collection details replace the date AND the venue in this card,
  // and are required to publish — so a published shop always has one. An event
  // still shows it only when it has something to put in it.
  const hasWhereCard = Boolean(
    isShop
      ? event.pickupInfo.trim() || event.venueName || event.address || event.city
      : event.dateDisplay || event.venueName || event.address || event.city
  );
  // Where those details go, and it is the one place the two kinds diverge in
  // this section.
  //
  // On an EVENT they stay in the sidebar. A date and a venue are two short
  // lines, the tier list beside them is usually two or three rows, and the
  // pair balances — which is what the large majority of this site's traffic
  // looks at, so it does not move.
  //
  // On a SHOP the same layout is upside down. The goods ARE the page, and the
  // 1.55fr column left a five-item grid wrapping into two narrow tiles while a
  // tall column of pickup prose held the other 40% of the width — the least
  // important thing in the most space. So a shop gives the goods the full
  // width and the collection details become a band underneath them, laid out
  // wide instead of tall. It is the same content in the same section, one
  // scroll further down, and the hero already carries the first line of it.
  const asideBesideGoods = hasWhereCard && !isShop;
  // Every checkout link on this page carries the referral code the visitor
  // arrived with, so it survives the hop to checkout and into the create-order
  // POST. refCode is already reduced to /^[A-Z0-9]{8}$/, so it is URL-safe.
  const checkoutBase = `/e/${event.slug}/checkout`;
  // Order-from-the-table (lib/kitchen): a printed QR code opens this page with
  // ?table=5, and every checkout link carries it on. cleanTableLabel keeps it
  // to a short plain label, so it is URL-safe too.
  const tableLabel = isShop && event.tableCount > 0 ? cleanTableLabel(sp.table) : '';
  const extraQs = `${refCode ? `&ref=${refCode}` : ''}${tableLabel ? `&table=${encodeURIComponent(tableLabel)}` : ''}`;
  const checkoutHref = extraQs ? `${checkoutBase}?${extraQs.slice(1)}` : checkoutBase;
  const headline = design.headline || event.name;
  const layout = design.layout ?? 'classic';
  // "SAT · 17 · OCT" for the layouts with a big date block.
  const heroDate =
    !isShop && event.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(event.eventDate)
      ? (() => {
          const d = new Date(`${event.eventDate}T12:00:00Z`);
          return {
            weekday: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
            day: String(d.getUTCDate()),
            month: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
          };
        })()
      : null;

  // ---------------- Stalls (slice 2) ----------------
  //
  // An event page lists the shops approved to stand at it; a shop page tells
  // buyers which events it will be standing at. Both lists arrive pre-filtered
  // through the ONE visibility rule in stalls.ts (approved link, both sides
  // published, host date not yet passed), so this page never re-derives who is
  // allowed to show. Money is untouched by all of it: a stall card links to
  // the shop's OWN page, and an order placed there pays the shop's own account
  // exactly like any other shop order.
  const stalls = isShop ? [] : listVisibleStallsForEvent(event.id);
  // The stall cards below are feed tiles by another name, so they get the feed's
  // one-shot read rather than five statements each. See lib/feedSnapshot.
  const stallSnapshot = loadFeedSnapshot(stalls.map((st) => st.shop));
  // Each stall card names its seller: one read for all of them, not one per card.
  const stallSellers = getSellerIdentitiesBulk(stalls.map((st) => st.shop.organizerId));
  // Same day arithmetic as stalls.ts itself: dates compare as ISO strings.
  const today = new Date().toISOString().slice(0, 10);
  const hostStalls = !isShop
    ? []
    : listStallLinksForShop(event.id)
        .map((link) => ({ link, host: getEventById(link.hostEventId) }))
        .filter(
          (x): x is { link: StallLinkRow; host: EventRow } =>
            x.host !== null && stallBannerVisibleOnShopPage(x.link, x.host, today)
        );
  // Never buyable in preview. The event is not public, its fee may be unpaid,
  // and POST /api/orders would refuse the order anyway — offering a button that
  // cannot work is just a trap for the person testing their own page.
  const canBuy = event.salesOpen && !soldOut && !preview;

  // The jump bar under the hero, in the order the sections appear. Each entry
  // hangs off the SAME flag that decides whether its section renders at all, so
  // an event with no updates and no gallery never offers a button that would
  // scroll nowhere. Labels are fixed and short on purpose: the About section's
  // heading is the organizer's own wording and can be a paragraph long.
  const navSections: EventSectionLink[] = [
    { id: 'tickets', label: v.Units },
    stalls.length > 0 ? { id: 'stalls', label: 'Stalls' } : null,
    event.description.trim() ? { id: 'about', label: 'About' } : null,
    legacyVideo ? { id: 'watch', label: 'Watch' } : null,
    posts.length > 0 ? { id: 'updates', label: 'Updates' } : null,
    showGallery ? { id: 'gallery', label: 'Gallery' } : null,
    { id: 'how-it-works', label: 'How it works' },
    faqs.length > 0 ? { id: 'faq', label: 'FAQ' } : null,
    // Always present now — the section holds the ask form, not just answers.
    { id: 'questions', label: 'Questions' },
  ].filter((s): s is EventSectionLink => s !== null);
  // The sales section and "How it works" are always there, so two buttons means the event
  // filled in nothing else — a bar over a page that short is just chrome.
  const showSectionNav = navSections.length >= 3;

  // The gradient is the hero's background whether or not there is a cover: it
  // is what shows while a large photo loads, and all there is when an event has
  // no photo at all.
  const heroStyle: React.CSSProperties = {
    ...tuning.hero,
    backgroundImage: `radial-gradient(ellipse 70% 50% at 50% -10%, ${theme['--accent-soft']}, transparent), radial-gradient(ellipse 40% 35% at 80% 0%, ${theme['--pink-soft']}, transparent)`,
  };

  // ---------------- Structured data ----------------
  //
  // Rendered into the page rather than into generateMetadata, because it needs
  // live availability — Google is told a tier is sold out only while it really
  // is. The organizer's real name is used, not the platform's: they are who is
  // putting the event on, and Google attributes the event to them.
  const organizer = getOrganizer(event.organizerId);
  // The seller of record: their legal name once they have filled it in
  // (portal Settings → Legal details), their account name until then.
  const seller = getSellerIdentity(event.organizerId);
  const organizerDisplayName = seller?.displayName || organizer?.name?.trim() || 'the organizer';

  // ---------------- The seller's referral offer ----------------
  //
  // Once the seller has switched rewards on, the offer belongs on the page
  // people are BROWSING — until now it only appeared on the order page, so the
  // only people who ever heard about it were the ones who had already bought.
  //
  // Null — and nothing renders — in two cases, both of them promises this page
  // must not make:
  //   - rewards are off, so there is no offer to describe;
  //   - nothing a buyer can actually buy here costs money. A referral only
  //     earns a voucher when the booking it brought was ACTUALLY PAID FOR
  //     (lib/referrals paidReferralSql), so on a free RSVP listing no link
  //     anyone shares here can ever qualify. referralRewardsReachable is the
  //     SAME function the progress card on the order page asks — one rule, so
  //     the page somebody browses and the page they land on after booking
  //     cannot promise different things.
  // The amount is the seller's own money in the seller's own currency; the
  // platform is not part of the offer and the copy below says so.
  const referralRewards = getReferralRewardSettings(event.organizerId);
  const referralOffer =
    referralRewards.enabled && referralRewardsReachable(tiers)
      ? { settings: referralRewards, currency: organizerCurrency(event.organizerId) }
      : null;

  const ogImage = socialImageUrl(event);
  const eventLd = eventJsonLd({
    event,
    tiers,
    remainingByTier: Object.fromEntries(
      Object.entries(availability.tiers).map(([key, t]) => [key, t.remaining])
    ),
    totalRemaining: availability.totalRemaining,
    images: ogImage ? [absoluteUrl(ogImage)] : [],
    organizerName: seller?.displayName || organizer?.name?.trim() || SITE_NAME,
  });

  // ---------------- The logistics facts ----------------
  //
  // Written once, placed twice: an event stacks them in the sidebar card, a
  // shop lays them side by side in the band under its goods (see
  // asideBesideGoods). Two copies of this markup would drift, and the shop
  // copy is the one nobody would remember to update.

  // The one thing a shop's buyer came here to find, so it gets the top slot a
  // date holds on an event — and it is shown WHOLE, line breaks and all,
  // because "ring the bell marked Sharma" is exactly the kind of detail that
  // gets lost when a paragraph is squeezed onto one line.
  const whenFact = isShop ? (
    event.pickupInfo.trim() ? (
      <li className="event-fact">
        <span className="event-fact-icon" aria-hidden="true">
          <CalendarIcon />
        </span>
        <div>
          <div className="event-fact-label">Collection</div>
          <div className={`event-fact-value${event.pickupInfo.trim().length > 90 ? ' event-fact-long' : ''}`} style={{ whiteSpace: 'pre-line' }}>
            {event.pickupInfo.trim()}
          </div>
        </div>
      </li>
    ) : null
  ) : event.dateDisplay ? (
    <li className="event-fact">
      <span className="event-fact-icon" aria-hidden="true">
        <CalendarIcon />
      </span>
      <div>
        <div className="event-fact-label">Date</div>
        <div className="event-fact-value">{event.dateDisplay}</div>
      </div>
    </li>
  ) : null;

  const whereFact =
    event.venueName || event.address || event.city ? (
      <li className="event-fact">
        <span className="event-fact-icon" aria-hidden="true">
          <PinIcon />
        </span>
        <div>
          <div className="event-fact-label">{isShop ? 'Where' : 'Venue'}</div>
          <div className="event-fact-value">
            {event.venueName || (isShop ? 'Collection point' : 'Venue')}
          </div>
          {event.address ? <div className="muted small">{event.address}</div> : null}
          {event.city ? <div className="muted small">{event.city}</div> : null}
        </div>
      </li>
    ) : null;

  const mapsLink = maps ? (
    <a href={maps} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-block">
      Open in Maps
    </a>
  ) : null;

  // Where this shop will be standing (its approved stall links), ABOVE the
  // generic collection details: a buyer working out how to get their order
  // should meet the event option first, while the shop's own pickup_info below
  // stays untouched and true for everything bought outside the event.
  // hostStalls is empty on an event, so this only ever renders on a shop.
  const stallNotices = hostStalls.map(({ link, host }) => (
    <div className="notice notice-success" key={link.id}>
      <div>
        Find us at{' '}
        <Link href={`/e/${host.slug}`} style={{ fontWeight: 700, textDecoration: 'underline' }}>
          {host.name}
          {host.dateDisplay ? ` — ${host.dateDisplay}` : ''}
        </Link>
      </div>
      {link.stallPickupInfo ? (
        <div className="small" style={{ marginTop: 4 }}>
          {link.stallPickupInfo}
        </div>
      ) : null}
    </div>
  ));

  return (
    <div
      className={`event-page${preview ? '' : ' has-cta-bar'}${profileUrl ? ' has-avatar' : ''}${
        showSectionNav ? ' has-section-nav' : ''
      }`}
      style={{ ...theme } as React.CSSProperties}
    >
      {/* No structured data on a preview. This page is not public, its tickets
          cannot be bought, and telling Google about an event that does not exist
          yet is the kind of claim that costs rich results on the events that
          DO. The page is noindex besides — this is the second lock. */}
      {!preview && !demo && (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(eventLd)} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={jsonLdScript(eventBreadcrumbJsonLd(event))}
          />
        </>
      )}

      {demo && (
        <div className="preview-bar" role="status">
          <div className="container preview-bar-inner">
            <span className="badge badge-amber">Demo</span>
            <span className="preview-bar-text">
              This is your demo {isShop ? 'shop' : 'event'} as a buyer sees it. <strong>Only you can open it.</strong>{' '}
              Try buying — payment is simulated and no email is sent.
            </span>
            <Link href={`/portal/events/${event.id}/edit`} className="btn btn-sm">
              Back to the portal
            </Link>
          </div>
        </div>
      )}

      {preview && (
        <div className="preview-bar" role="status">
          <div className="container preview-bar-inner">
            <span className="badge badge-amber">Preview</span>
            <span className="preview-bar-text">
              This is your page as visitors will see it. <strong>Nobody else can open it</strong> —
              it stays private until you publish, and nothing can be bought yet.
            </span>
            <Link href={`/portal/events/${event.id}/edit`} className="btn btn-sm">
              Back to editing
            </Link>
          </div>
        </div>
      )}

      <section
        className={`hero event-hero event-hero--${layout}${!isShop && !coverVideoUrl ? ' event-hero--stage' : ''}`}
        style={heroStyle}
      >
        {/* The layout's own decoration (lib/events PageDesign.layout). */}
        {layout === 'festival' && (
          <div className="evl-kites" aria-hidden="true">
            {['🪁', '✨', '🪁', '🎶', '🪔', '🪁', '✨'].map((k, i) => (
              <span key={i} style={{ ['--i' as string]: i, ['--y' as string]: `${[12, 34, 8, 52, 22, 44, 16][i]}%` } as React.CSSProperties}>
                {k}
              </span>
            ))}
          </div>
        )}
        {layout === 'neon' && <div className="evl-grid" aria-hidden="true" />}
        {/* The floating 3D scene after the cover, so it paints over the photo
            and under the text. Events only — see HeroDepth. */}
        {!isShop && <HeroDepth layout={layout} day={heroDate?.day} />}
        {/* …and the WebGL stage: the cover printed on a holographic 3D ticket.
            Not over a video cover — a clip is the hero there. */}
        {!isShop && !coverVideoUrl && (
          <HoloStage
            layout={layout}
            cover={stillUrl}
            poster={ticketArtId ? mediaUrl(ticketArtId, 'gallery', null) : null}
            title={event.name}
            kicker={event.artist || (preview ? 'Preview' : 'Live event')}
            place={[event.venueName, heroCity].filter(Boolean).join(' · ')}
            day={heroDate?.day ?? ''}
            month={heroDate?.month ?? ''}
            weekday={heroDate?.weekday ?? ''}
            price={minPrice === null ? '' : minPrice === 0 ? 'FREE' : `FROM ${formatMoney(minPrice, event.currency)}`}
            accent={theme['--accent']}
            pink={theme['--pink']}
          />
        )}
        {(coverVideoUrl || stillUrl) && (
          <div
            className={`event-hero-media${stillUrl ? '' : ' event-hero-media-bare'}`}
            /* The same picture, handed to CSS as a variable so the phone
               layout can paint a blurred copy of it behind the letterboxed
               original instead of leaving dead bars. */
            style={stillUrl ? ({ ['--hero-img' as string]: `url("${stillUrl}")` } as React.CSSProperties) : undefined}
            aria-hidden="true"
          >
            {/* The cover, filling the frame. Under a video cover this same
                element is the fallback the video is stacked on top of — never
                beside it (see .event-hero-still). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {stillUrl ? <img src={stillUrl} alt="" className="event-hero-still" /> : null}
            {coverVideoUrl ? (
              <HeroCoverVideo src={coverVideoUrl} poster={stillUrl ?? undefined} />
            ) : null}
            <span className="event-hero-scrim" />
          </div>
        )}

        {/* Phone: the round photo sits on the cover's bottom edge, like a
            storefront's logo — the laptop copy is the one after the hero. */}
        {profileUrl && (stillUrl || coverVideoUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profileUrl} alt="" aria-hidden="true" className="event-avatar event-avatar-edge" />
        )}
        <div className="container event-hero-inner">
          {/* Poster layout: the poster itself, crisp, as a tilted card. */}
          {layout === 'poster' && stillUrl && (
            <div className="evl-poster-card anim-fade-up" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stillUrl} alt="" />
            </div>
          )}
          {/* The big date, for the layouts that shout it. */}
          {layout !== 'classic' && layout !== 'poster' && heroDate && (
            <div className="evl-date anim-fade-up" aria-hidden="true">
              <span>{heroDate.weekday}</span>
              <strong>{heroDate.day}</strong>
              <span>{heroDate.month}</span>
            </div>
          )}
          {/* "Live event" is a claim, and on a draft it is a false one. */}
          <p className="hero-kicker anim-fade-up">
            {preview ? 'Not published yet' : isShop ? 'Open for orders' : 'Live event'}
          </p>
          <h1
            className="anim-fade-up anim-d1"
            style={{
              ...tuning.h1,
              backgroundImage:
                'linear-gradient(120deg, #fff 30%, var(--accent-text) 70%, var(--pink))',
            }}
          >
            {headline}
          </h1>
          {heroCity || heroWhen ? (
            <p className="event-hero-where anim-fade-up anim-d1">
              {heroCity ? <span className="event-hero-city">{heroCity}</span> : null}
              {heroCity && heroWhen ? <span aria-hidden="true"> · </span> : null}
              {heroWhen ? <span>{heroWhen}</span> : null}
            </p>
          ) : null}
          {/* What this shop's buyers have said, taken together — under the
              name, where somebody deciding whether to trust a stranger with a
              bank transfer is already looking.

              Nothing renders until at least one person who actually paid has
              spoken (Stars returns null for null), so a shop that opened this
              morning shows a clean heading rather than five empty outlines
              that read as a bad score. It links down to the items, because
              this page has no review list of its own — every review lives
              under the thing it is about, which is where it means something. */}
          {shopRating ? (
            <p className="hero-meta anim-fade-up anim-d2" style={{ marginBottom: 12 }}>
              <Stars rating={shopRating} href="#tickets" />
            </p>
          ) : null}
          {design.tagline ? (
            <p className="hero-meta anim-fade-up anim-d2" style={{ maxWidth: 640, marginBottom: 14 }}>
              {design.tagline}
            </p>
          ) : null}
          {event.artist ? (
            <p className="hero-meta anim-fade-up anim-d2" style={{ marginBottom: 16 }}>
              <strong>{event.artist}</strong>
            </p>
          ) : null}
          {((isShop ? heroCollectLine : event.dateDisplay) || location) && (
            <div className="hero-chip-row anim-fade-up anim-d2">
              {/* A chip is one line, and collection details are a paragraph, so
                  a shop puts its FIRST line here — "Collect Saturdays 4–7pm" —
                  and leaves the rest to the card further down. */}
              {isShop ? (
                heroCollectLine ? (
                  <span className="hero-chip">
                    <CalendarIcon />
                    {heroCollectLine}
                  </span>
                ) : null
              ) : event.dateDisplay ? (
                <span className="hero-chip">
                  <CalendarIcon />
                  {event.dateDisplay}
                </span>
              ) : null}
              {location ? (
                <span className="hero-chip">
                  <PinIcon />
                  {location}
                </span>
              ) : null}
            </div>
          )}
          {/* In preview the checkout does not exist yet — /e/[slug]/checkout
              404s on an unpublished event — so a live "Get tickets" button here
              would send the organizer testing their own page straight into a
              dead end. Show them what the button WILL be instead. */}
          {preview ? (
            <div className="event-hero-actions anim-fade-up anim-d3">
              <span className="btn btn-primary btn-lg" aria-disabled="true" style={{ opacity: 0.5, pointerEvents: 'none' }}>
                {v.cta}
              </span>
              <span className="badge badge-amber">Live once you publish</span>
              {minPrice !== null ? (
                <span className="event-hero-price">
                  {minPrice === 0 ? 'Free' : `from ${formatMoney(minPrice, event.currency)}`}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="event-hero-actions anim-fade-up anim-d3">
              {state.buyable ? (
                <Link href={checkoutHref} className="btn btn-primary btn-lg">
                  {v.cta}
                </Link>
              ) : (
                /* Says why there is no button rather than leaving a gap. A
                   visitor who arrives at an event with nothing on sale should
                   read "Coming soon" or "Sold out", not wonder whether the page
                   failed to load. */
                <span
                  className="btn btn-lg"
                  aria-disabled="true"
                  style={{ opacity: 0.6, pointerEvents: 'none' }}
                >
                  {state.cta}
                </span>
              )}
              {/* Only when it adds something. When nothing is buyable the
                  disabled button beside this already says "Sold out" or "Sales
                  closed" — printing it again put THREE chips on a two-ticket
                  event, all saying variations of the same thing. While tickets
                  ARE buyable this slot is the only place the count appears. */}
              {state.buyable ? (
                <span className={`badge ${state.badge.startsWith('Only') ? 'badge-amber' : 'badge-green'}`}>
                  {state.badge}
                </span>
              ) : state.kind === 'sold-out' && state.soldOutNames.length === 1 ? (
                /* Names the type that has gone, which the button cannot: on an
                   event with an early bird and a standard, "Sold out" alone left
                   the visitor to guess which of the two it meant. */
                <span className="badge badge-red">{state.badge}</span>
              ) : null}
              {/* And which one is still to come. */}
              {state.kind !== 'coming-soon' && comingSoonLabel(state) ? (
                <span className="badge badge-green">{comingSoonLabel(state)}</span>
              ) : null}
              {state.buyable && minPrice !== null ? (
                <span className="event-hero-price">
                  {minPrice === 0 ? 'Free' : `from ${formatMoney(minPrice, event.currency)}`}
                </span>
              ) : null}
              {/* One line of context under the buttons for the states that need
                  explaining. "Sold out" speaks for itself; the other two do not. */}
              {state.kind === 'closed' || state.kind === 'coming-soon' ? (
                <p className="muted small" style={{ width: '100%', margin: '8px 0 0' }}>
                  {state.kind === 'closed'
                    ? `${v.Sales} are paused right now — check back soon.`
                    : `${v.Units} are not on sale yet. This page is where they will appear.`}
                </p>
              ) : null}
            </div>
          )}
          {(layout === 'festival' || layout === 'neon') && !isShop && event.eventDate && (
            <EventCountdown date={event.eventDate} time={event.dateDisplay.match(/(\d{1,2}:\d{2})/)?.[1]} />
          )}
          {/* Under the button, not buried in the body: this is the last thing
              between a visitor and a checkout for the wrong country. */}
          <OtherCityNotice city={heroCity} shows={otherCities} />
          {/* …and the moment they tap to buy, one clear question. */}
          {otherCities.length > 0 && !preview && (
            <CityCheck
              lang={await currentLang()}
              slug={event.slug}
              city={heroCity}
              dateLabel={heroWhen}
              venue={event.venueName}
              act={event.artist}
              others={otherCities}
            />
          )}
        </div>
      </section>

      {/* Facebook-style profile photo, overlapping the hero's bottom edge. */}
      {profileUrl && (
        <div className={`container event-avatar-wrap${stillUrl || coverVideoUrl ? ' has-edge-copy' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profileUrl} alt={`${event.name} profile photo`} className="event-avatar" />
        </div>
      )}

      {design.highlights?.length ? (
        <div className="container event-highlights">
          {design.highlights.map((h) => (
            <span key={h} className="badge badge-accent event-highlight">
              {h}
            </span>
          ))}
        </div>
      ) : null}

      {/* Below the avatar and the highlight badges, never above them: the
          avatar rises 55px into the hero, so anything stacked before it gets
          pulled up underneath. */}
      {showSectionNav && <SectionNav sections={navSections} />}

      <section className="section event-section" id="tickets">
        <div className="container">
          <div className={asideBesideGoods ? 'event-split' : undefined}>
            <div>
              <p className="section-kicker">{isShop ? 'Pick what you want' : 'Pick your spot'}</p>
              <h2 className="page-title">{v.Units}</h2>
              {/* A shop's grid is a shopfront, not a price list: it gets its
                  own column counts and its own tile, both of which need the
                  full width to be worth looking at. The event grid keeps the
                  auto-fit it has always had. */}
              {(() => {
                const tierCards = tiersInSaleOrder(tiers, availability).map((tier) => {
                  const tierAvail = availability.tiers[tier.tierKey];
                  const remaining = tierAvail?.remaining ?? 0;
                  // The card is the button when this type can actually be
                  // bought. People tap the price, not the paragraph below it —
                  // and a card that lifts on hover but does nothing on click
                  // reads as broken. A type that is sold out, announced or on a
                  // paused event stays a plain card: there is nowhere to go.
                  //
                  // `!preview` for the same reason the hero button has it: the
                  // checkout 404s on an unpublished event, so a live link here
                  // would walk an organizer previewing their own draft straight
                  // into a dead end — off the biggest tap target on the page.
                  const tierBuyable =
                    state.buyable && !preview && tier.status === 'on-sale' && remaining > 0;
                  // The picture the seller picked for this one, degrading to
                  // none when the photo behind it has since been deleted.
                  const tierPic = tierPhoto(tier, photos);
                  // Whether this row is worth a page of its own — always for a
                  // shop, only when there is something extra to read for an
                  // event. See tierHasItemPage() for why. In preview the item
                  // page 404s on an unpublished listing, exactly like the
                  // checkout, so it is not offered there either.
                  const itemHref =
                    !preview && tierHasItemPage(event.kind, tier, tierPic)
                      ? `/e/${event.slug}/item/${encodeURIComponent(tier.tierKey)}${refCode ? `?ref=${refCode}` : ''}`
                      : null;
                  const buyHref = `${checkoutBase}?tier=${encodeURIComponent(tier.tierKey)}${extraQs}`;
                  // One badge function, shared with the item page — the chain
                  // it encodes is order-dependent enough that two copies of it
                  // would eventually disagree about the same row.
                  const badge = tierBadge(state, tier, remaining, availability.showRemaining);
                  // The availability chip and the student flag, hoisted because
                  // a shop tile with a photo hangs them OVER the picture and
                  // every other tile keeps them on their own row underneath it.
                  // Same chips, same words, two positions.
                  const chips = (
                    <>
                      <span className={badge.className}>{badge.label}</span>
                      {tier.studentOnly && <span className="badge badge-student">Student</span>}
                    </>
                  );
                  const photo = tierPic ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      className="tier-card-photo"
                      src={mediaUrl(tierPic.id, 'card', null)}
                      alt={tier.name}
                      loading="lazy"
                    />
                  ) : null;
                  // Read about it, or buy it now — a shopper who already knows
                  // what they want must not be made to open a page to get at
                  // the button that was there before this existed. Hoisted for
                  // the same reason as the chips: on a shop the two share one
                  // footer row, everywhere else they stack as they always have.
                  const goLink = itemHref ? (
                    <span className="tier-card-go">See this {v.unit} →</span>
                  ) : tierBuyable ? (
                    <span className="tier-card-go">{v.cta} →</span>
                  ) : null;
                  const buyBtn =
                    itemHref && tierBuyable ? (
                      <Link
                        className="btn btn-primary btn-sm tier-card-buy"
                        href={buyHref}
                        aria-label={isShop ? `Order ${tier.name}` : `Get ${tier.name} tickets`}
                      >
                        {v.cta}
                      </Link>
                    ) : null;
                  const wishBtn =
                    !preview && (exampleListing || tier.status === 'coming-soon') && canWish(event, tier) ? (
                      <WishButton eventId={event.id} tierKey={tier.tierKey} count={wishCounts.get(tier.tierKey) ?? 0} size="sm" />
                    ) : null;
                  const card = (
                    <>
                      {/* The photo, when there is one. Cards without one keep
                          exactly today's shape rather than reserving an empty
                          frame: most events will never set one, and a row of
                          grey placeholders would make a perfectly finished
                          event page look half-built. */}
                      {photo && isShop ? (
                        /* On a shop the picture is the product shot, so it
                           carries the chip the way every shop grid on the web
                           does — over the bottom of the image, on a scrim that
                           keeps it readable whatever the photograph is. It also
                           buys back a whole row of card height, which is what
                           was pushing the price and the button apart. */
                        <div className="tier-card-media">
                          {photo}
                          <span className="tier-card-chips">{chips}</span>
                        </div>
                      ) : (
                        photo
                      )}
                      {/* The light that moves over a ticket (depth.css). */}
                      {!isShop && (
                        <>
                          <span className="tk-foil" aria-hidden="true" />
                          <span className="tk-shine" aria-hidden="true" />
                        </>
                      )}
                      {(!isShop || !photo) && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{chips}</div>
                      )}
                      <div className="tier-name">
                        {/* The name is the link to the item page, and its
                            ::after covers the whole card — so the card is
                            clickable while the buy button inside stays its own
                            control. An <a> inside an <a> is invalid HTML and
                            browsers split it, which is why this is an overlay
                            and not a nested link. */}
                        {itemHref ? (
                          <Link className="tier-card-title-link" href={itemHref}>
                            {tier.name}
                          </Link>
                        ) : (
                          tier.name
                        )}
                      </div>
                      <div className="tier-price">
                        {tier.priceCents === 0 ? 'Free' : formatMoney(tier.priceCents, event.currency)}
                      </div>
                      {/* What buyers said about THIS item, on the shop's own
                          grid. It renders nothing at all until somebody who
                          bought it has spoken — see Stars — so a young shop
                          shows a clean card rather than rows of grey outlines
                          reading as a bad score. One bulk read for the whole
                          grid (itemRatings above), never one per card. */}
                      <Stars rating={itemRatings.get(`${event.id}:${tier.tierKey}`) ?? null} size="sm" />
                      {/* A bundled tier is bought as ONE booking for a group —
                          said plainly on the card, because the price above is
                          per table, not per person, and a buyer comparing it
                          against single tickets must know that before tapping. */}
                      {tier.seatsPerUnit > 1 && (
                        <p className="small muted" style={{ margin: '0 0 6px' }}>
                          Includes {tier.seatsPerUnit} {isShop ? v.units : 'seats'} — you get{' '}
                          {tier.seatsPerUnit} QR {v.codes} per booking.
                        </p>
                      )}
                      <p className="tier-desc">{tier.description}</p>
                      {tier.studentOnly && (
                        <p className="small muted" style={{ margin: 0 }}>
                          Bring a valid student ID — it&rsquo;s checked at the entrance.
                        </p>
                      )}
                      {/* One footer row on a shop — button first, so the thing
                          that takes the money is the anchored left edge of
                          every tile in the row — and the same two elements
                          stacked, unchanged, on everything else. */}
                      {isShop ? (
                        (buyBtn || goLink) && (
                          <div className="tier-card-foot">
                            {buyBtn}
                            {goLink}
                          </div>
                        )
                      ) : (
                        <>
                          {goLink}
                          {buyBtn}
                        </>
                      )}
                      {wishBtn}
                    </>
                  );
                  // With an item page the card is a plain box holding two links
                  // (see tier-card-title-link above). Without one it behaves
                  // exactly as it always has: the whole card is the checkout
                  // link when buyable, and a dead box when it is not.
                  if (itemHref) {
                    return (
                      <div className="tier-card glow-card tier-card-has-link" key={tier.tierKey}>
                        {card}
                      </div>
                    );
                  }
                  return tierBuyable ? (
                    <Link
                      className="tier-card glow-card tier-card-link"
                      key={tier.tierKey}
                      // Carries WHICH ticket was tapped, so the checkout opens
                      // with it already at one. The server re-checks the key
                      // before honouring it.
                      href={buyHref}
                      aria-label={isShop ? `Order ${tier.name}` : `Get ${tier.name} tickets`}
                    >
                      {card}
                    </Link>
                  ) : (
                    <div className="tier-card glow-card" key={tier.tierKey}>
                      {card}
                    </div>
                  );
                });
                // Sold-out rows sink to the end: see tiersInSaleOrder. The
                // organizer's own order survives inside each group.
                //
                // Everything on one screen: tickets two by two, so four are
                // seen at once; a shop keeps its shopfront grid of three
                // across. Only when there are more than a screenful do they
                // turn into pages — 4 tickets or 9 items each — that swipe
                // (endless, arrows on a laptop, dots).
                // A menu is one list, never pages: dishes are compared by
                // scrolling, and a row is short. A shop pages at twelve (six
                // rows of two on a phone, four of three on a laptop).
                const perPage = foodPlace ? Number.POSITIVE_INFINITY : isShop ? 12 : 4;
                const gridClass = isShop ? `tier-grid goods-grid${foodPlace ? ' menu-list' : ''}` : 'tier-grid tier-grid-2';
                if (tierCards.length <= perPage) {
                  return <div className={gridClass}>{tierCards}</div>;
                }
                const pages: (typeof tierCards)[] = [];
                for (let i = 0; i < tierCards.length; i += perPage) pages.push(tierCards.slice(i, i + perPage));
                return (
                  <LoopCarousel label={v.Units} className="tier-lc tier-pages">
                    {pages.map((page, i) => (
                      <div key={i} className={`${gridClass} tier-page`}>
                        {page}
                      </div>
                    ))}
                  </LoopCarousel>
                );
              })()}
              <p className="muted small">
                Up to {event.maxPerOrder} {v.units} per order.
              </p>
              {/* Who you are buying from — said where the buying starts. The
                  seller is the organizer, not this site: they set the prices,
                  the money lands in their own account, and they are the ones
                  who confirm it. The platform is only the software in between,
                  and a buyer should not have to dig through the homepage FAQ
                  to learn that. organizerDisplayName already falls back to
                  "the organizer" when the account row has no name — generic,
                  but still an honest answer to "whose event is this?". */}
              <p className="muted small">
                {isShop ? 'Sold by' : 'Presented by'} <strong translate="no">{organizerDisplayName}</strong>
                {/\.$/.test(organizerDisplayName) ? '' : '.'}{' '}
                {isShop
                  ? 'Your order is placed with them, and your payment goes straight to their own account — it never passes through us.'
                  : 'Tickets for this event are sold by them, and your payment goes straight to their own account — it never passes through us.'}
              </p>
              {canBuy && (
                <p style={{ marginTop: 16 }}>
                  <Link href={checkoutHref} className="btn btn-primary btn-lg">
                    {isShop ? 'Place your order' : 'Get your tickets'}
                  </Link>
                </p>
              )}
              {/* Sold out is the one state where this page can still DO
                  something for the visitor, so it is the only state that gets
                  the waitlist — a paused or coming-soon event is not "full",
                  and offering to watch for freed spots there would promise an
                  email on the wrong condition. Not in preview: the API would
                  refuse an unpublished event anyway, and the organizer does
                  not need a form that signs them up to their own list. */}
              {state.kind === 'sold-out' && !preview && (
                <div style={{ marginTop: 16, maxWidth: 480 }}>
                  <WaitlistForm eventId={event.id} kind={event.kind} checkoutHref={checkoutHref} />
                </div>
              )}
              {/* Their Impressum, in short: address, who represents them, the
                  register entry — only what they filled in. Nothing renders
                  until they do; the seller line above already names them. */}
              <SellerBlock
                seller={seller}
                kind={isShop ? 'shop' : 'event'}
                style={{ maxWidth: 560, marginTop: 16 }}
              />
            </div>

            {asideBesideGoods && (
              <aside className="event-aside">
                <div className="card glow-card">
                  <div className="card-title">{v.logistics}</div>
                  <ul className="event-fact-list">
                    {whenFact}
                    {whereFact}
                  </ul>
                  {mapsLink}
                </div>
              </aside>
            )}
          </div>

          {/* The shop's half of that same divergence (see asideBesideGoods):
              the collection details as a wide band under the goods instead of
              a tall column beside them. It sits AFTER the buying controls on
              purpose — the seller line has to stay directly under those — and
              after the goods, because "where do I pick this up" is the question
              a buyer asks once something has caught their eye. The hero already
              carries the first line of it for anyone who wants it sooner, and
              the band is the full width of the page, which is harder to miss
              than a sidebar. */}
          {isShop && hasWhereCard && (
            <div className="shop-collect">
              {stallNotices}
              <div className="card glow-card shop-collect-card">
                <div className="card-title">{v.logistics}</div>
                <div
                  className={`shop-collect-body${whereFact || mapsLink ? ' shop-collect-cols' : ''}`}
                >
                  {whenFact ? <ul className="event-fact-list">{whenFact}</ul> : null}
                  {whereFact || mapsLink ? (
                    <div className="shop-collect-side">
                      {whereFact ? <ul className="event-fact-list">{whereFact}</ul> : null}
                      {mapsLink}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Shops standing at this event (slice 2), each card linking OUT to the
          stall's own page — never straight to checkout. The stall's page is
          where the seller's identity, pickup details and payment claims live,
          and the disclosed-agent posture needs every one of those claims made
          by the seller's own page, not vouched for by the host's. */}
      {stalls.length > 0 && (
        <section className="section event-section" id="stalls">
          <div className="container">
            <p className="section-kicker">At the event</p>
            <h2 className="page-title">Order ahead from the stalls</h2>
            <p className="muted small event-section-sub">
              Pre-order and skip the queue — collect at their stall at the event.
            </p>
            <div className="feed-grid" style={{ margin: '24px 0 16px' }}>
              {stalls.map(({ link, shop }) => {
                // Each card answers the same three questions the feed tile
                // does — what is it, can I order, from how much — through the
                // same one source of truth, so a stall can never claim a state
                // its own page would contradict one click later.
                const shopTiers = stallSnapshot.tiers.get(shop.id) ?? [];
                const shopAvailability =
                  stallSnapshot.availability.get(shop.id) ?? getAvailability(shop.id);
                const shopState = ticketState(shop, shopTiers, shopAvailability);
                const shopPrice = fromPriceCents(shopTiers, shopAvailability);
                // The one label ticketState words generically: a paused SHOP
                // reads "Orders closed" to a buyer, not "Sales closed".
                const chip = shopState.kind === 'closed' ? 'Orders closed' : shopState.badge;
                const sellerName = stallSellers.get(shop.organizerId)?.displayName || 'the organizer';
                const stillUrl = listingStillUrl(shop, stallSnapshot.photos.get(shop.id) ?? []);
                const accent = parsePageDesign(shop.pageDesign).accent ?? 'violet';
                return (
                  <Link href={`/e/${shop.slug}`} className="event-card" key={link.id}>
                    <div className="event-card-media">
                      {stillUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={stillUrl}
                          alt={`${shop.name} photo`}
                          loading="lazy"
                          className="event-card-shot"
                        />
                      ) : (
                        <div
                          className="event-card-placeholder"
                          aria-hidden="true"
                          style={{ background: PLACEHOLDER_GRADIENTS[accent] }}
                        >
                          <span className="event-card-initial">
                            {shop.name.trim().charAt(0).toUpperCase() || '•'}
                          </span>
                        </div>
                      )}
                      <span className="event-card-status">
                        <span className={`badge ${BADGE_TONE[shopState.kind] ?? 'badge-green'}`}>
                          {chip}
                        </span>
                      </span>
                      <span className="event-card-scrim" aria-hidden />
                    </div>
                    <div className="event-card-body">
                      <div className="event-card-title">{shop.name}</div>
                      {/* The disclosed-agent line, non-negotiable: every buyer
                          surface that shows a stall names its seller. */}
                      <div className="event-card-meta">
                        Sold by <strong translate="no">{sellerName}</strong>
                      </div>
                      {link.stallPickupInfo ? (
                        <div className="event-card-meta">{link.stallPickupInfo}</div>
                      ) : null}
                      <div className="event-card-foot">
                        {shopPrice !== null ? (
                          <span className="event-card-price">
                            {shopPrice === 0 ? 'Free' : `from ${formatMoney(shopPrice, shop.currency)}`}
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className="event-card-go">View stall</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <p className="muted small">
              Every stall is its own shop: ordering takes you to their page, and you pay each
              seller directly into their own account — payments never pass through {SITE_NAME} or
              the event organizer.
            </p>
          </div>
        </section>
      )}

      {event.description.trim() && (
        <section className="section event-section" id="about">
          <div className="container">
            <p className="section-kicker">The story</p>
            <h2 className="page-title">
              {design.aboutTitle || (isShop ? 'About this shop' : 'About the event')}
            </h2>
            <p className="muted event-prose">
              {/* Whatever Devanagari the seller wrote in here, marked as
                  Nepali on the way out. They type one description in one box
                  and it is routinely both languages at once. */}
              <MixedScript>{event.description}</MixedScript>
            </p>
          </div>
        </section>
      )}


      {legacyVideo && (
        <section className="section event-section" id="watch">
          <div className="container">
            <p className="section-kicker">Press play</p>
            <h2 className="page-title">Watch</h2>
            {legacyVideo.kind === 'file' ? (
              <video controls preload="metadata" playsInline src={legacyVideo.url} className="event-embed-video" />
            ) : (
              <div className="event-embed">
                <iframe
                  src={legacyVideo.url}
                  title={`${event.name} video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section className="section event-section" id="updates">
          <div className="container">
            <p className="section-kicker">Fresh from the organizer</p>
            <h2 className="page-title">Updates</h2>
            <div className="event-feed">
              {posts.map((post) => {
                // An update carries at most one attachment — a photo or a clip.
                const attachedId = post.mediaId;
                const photo = attachedId && isPhotoId(attachedId) ? mediaUrl(attachedId) : null;
                const clip = attachedId && isVideoId(attachedId) ? mediaUrl(attachedId) : null;
                return (
                  <article className="card event-post" key={post.id}>
                    <header className="event-post-head">
                      {profileUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profileUrl}
                          alt=""
                          loading="lazy"
                          className="event-post-avatar"
                        />
                      ) : (
                        <span aria-hidden className="event-post-avatar event-post-avatar-fallback">
                          {event.name.trim().charAt(0).toUpperCase() || '•'}
                        </span>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{event.name}</div>
                        <div className="muted small">{postDateLabel(post.createdAt)}</div>
                      </div>
                    </header>
                    <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{post.body}</p>
                    {photo && <FeedPhoto src={photo} alt={`${event.name} update photo`} />}
                    {clip && <FeedVideo src={clip} label={`${event.name} update video`} />}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {showGallery && (
        <section className="section event-section" id="gallery">
          <div className="container">
            <p className="section-kicker">The vibe</p>
            <h2 className="page-title">Gallery</h2>
            <p className="muted small event-section-sub">
              Swipe through {galleryBlurb} — tap any one to open it full screen.
            </p>
          </div>
          <div className="container">
            <div className="mswipe-bleed">
              <MediaSwiper items={galleryItems} label={`${event.name} gallery`} />
            </div>
          </div>
        </section>
      )}

      <section className="section event-section" id="how-it-works">
        <div className="container">
          <p className="section-kicker">{isShop ? 'From order to collection' : 'From reserve to entry'}</p>
          <h2 className="page-title">How it works</h2>
          {/* Four cards in a row (swiped on a phone) rather than four
              paragraphs down the page: the order of things is the point. */}
          <ol className="step-list step-strip">
            {howItWorks(payOffer, event.kind).map((item, i) => (
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

          {/* The seller's own thank-you for bringing friends, placed at the END
              of "how it works" rather than up beside the prices: it is
              something that happens AFTER a booking, and a discount on a
              future order has no business competing with what someone came
              here to buy. Quiet card, same width as the steps above it. */}
          {referralOffer && (
            <div className="card" style={{ maxWidth: 680, marginTop: 18 }}>
              <div className="card-title">Bring a friend, and {organizerDisplayName} says thank you</div>
              <p className="muted small" style={{ marginTop: 0, marginBottom: 0 }}>
                Book, then share your own link. When{' '}
                {referralOffer.settings.threshold === 1
                  ? 'a friend books and pays'
                  : `${referralOffer.settings.threshold} friends book and pay`}{' '}
                through it, you get{' '}
                <strong>
                  {formatMoney(referralOffer.settings.rewardCents, referralOffer.currency)} off
                </strong>{' '}
                your next booking — {organizerDisplayName}&rsquo;s own discount; none of it passes
                through {platformName()}.
              </p>
            </div>
          )}

          <div className="event-closing-actions">
            {canBuy ? (
              <Link href={checkoutHref} className="btn btn-primary btn-lg">
                {isShop ? `Order from ${event.name}` : `Get tickets for ${event.name}`}
              </Link>
            ) : (
              <span className="btn btn-lg" aria-disabled="true" style={{ opacity: 0.6, pointerEvents: 'none' }}>
                {state.cta}
              </span>
            )}
            <Link href="/" className="btn">
              Browse more
            </Link>
          </div>
        </div>
      </section>


      {faqs.length > 0 && (
        <section className="section event-section" id="faq">
          <div className="container">
            <p className="section-kicker">Good to know</p>
            <h2 className="page-title">FAQ</h2>
            <div style={{ maxWidth: 680 }}>
              {faqs.map((faq) => (
                <details className="faq-item" key={faq.id}>
                  <summary>{faq.question}</summary>
                  <p className="faq-answer">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Always rendered, even with nothing answered yet: the ASK form is the
          point of this section, and hiding it until somebody else had already
          asked meant a brand-new event — the one with the most unanswered
          questions — was the one with no way to ask them. */}
      <section className="section event-section" id="questions">
        <div className="container">
          <p className="section-kicker">Still wondering?</p>
          <h2 className="page-title">Questions</h2>
          <div style={{ maxWidth: 680 }}>
            {answeredQuestions.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                {answeredQuestions.map((q) => (
                  <details className="faq-item" key={q.id}>
                    <summary>{q.question}</summary>
                    <p className="faq-answer" style={{ paddingBottom: 6 }}>
                      {q.answer}
                    </p>
                    <p className="small muted" style={{ margin: 0, padding: '0 18px 14px' }}>
                      Asked by a visitor
                    </p>
                  </details>
                ))}
              </div>
            )}

            {preview ? (
              <div className="notice notice-warn">
                Your visitors get a form here to ask you a question — their answer reaches them by
                email once you reply in the portal. It starts working when you publish.
              </div>
            ) : (
              <AskOrganizerForm eventId={event.id} organizerName={organizerDisplayName} />
            )}

            <p className="muted small" style={{ marginTop: 14 }}>
              In a hurry? Tap the chat bubble in the corner — most questions get an instant answer
              from the organizer&rsquo;s own event details.
            </p>
          </div>
        </div>
      </section>

      {/* The one thing on this page that is not about this event.
          Organizers share their own event link directly, so most people who
          land here never see the home page — and somebody who could be running
          their own night has no way to learn that this is a thing they could
          do. The header's "Organizer sign in" is not that door either: it
          leads to a password box, which is a dead end for anyone who does not
          have an account yet.
          Placed dead last, after everything that helps someone buy a ticket,
          and kept deliberately quiet: this page belongs to the organizer who
          made it, and it must never compete with their sale. */}
      <section className="section event-section">
        <div className="container">
          <aside className="org-pitch">
            <div className="org-pitch-text">
              <p className="org-pitch-kicker">Thinking of putting on your own event?</p>
              <h2 className="org-pitch-title">You could have a page like this one</h2>
              {/* platformFeeLabel() used to live here; the fee machinery was
                  deleted (see lib/platform.ts) and this merge-survivor was the
                  last call site — it broke the production build. */}
              <p className="org-pitch-body">
                Build your event page, sell tickets straight into your own bank account, and
                scan guests in at the door — free while we grow, and never a commission on a
                single ticket.
              </p>
            </div>
            <p className="org-pitch-actions">
              <Link href="/organizers" className="btn btn-green">
                See how it works
              </Link>
            </p>
          </aside>
        </div>
      </section>

      {/* Scroll-driven motion: 3D on an event, calm on a shop. */}
      <EventDepth mode={isShop ? 'flat' : '3d'} />

      {/* Sticky mobile checkout bar — appears below 640px via CSS, and only
          once the hero's own button has scrolled away. */}
      {!preview && (
        <StickyCtaBar
          href={checkoutHref}
          name={event.name}
          place={[heroCity, heroWhen].filter(Boolean).join(' · ')}
          buyable={state.buyable}
          cta={state.cta}
          priceLabel={
            state.buyable && minPrice !== null
              ? minPrice === 0
                ? 'Free'
                : `from ${formatMoney(minPrice, event.currency)}`
              : state.badge
          }
        />
      )}

      {/* The organizer's own WhatsApp, above the assistant. Not in preview:
          an organizer testing their page does not need a link to message
          themselves, and it would sit over the controls they came to check. */}
      {!preview && (
        <OrganizerWhatsApp
          number={event.whatsapp}
          organizerName={event.whatsappName || organizerDisplayName}
          eventName={event.name}
          // Its own photo, chosen in the WhatsApp panel. Falls back to the
          // page's profile photo only when the organizer has not uploaded one,
          // so an existing bubble does not suddenly lose its face.
          photoUrl={event.whatsappPhoto || profileUrl}
          photoFocus={event.whatsappPhoto ? event.whatsappFocus : null}
        />
      )}

      {/* Floating assistant — it portals itself to <body>, and the CSS lifts it
          above the sticky checkout bar on phones while that bar is showing. */}
      <ChatWidget
        title={`Ask about ${event.name}`}
        subtitle="Instant answers from the organizer's event info"
        placeholder="e.g. Is there parking at the venue?"
        endpoint={`/api/events/${event.id}/ask`}
      />
    </div>
  );
}
