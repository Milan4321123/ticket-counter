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
import SectionNav from './SectionNav';
import type { EventSectionLink } from './SectionNav';
import StickyCtaBar from './StickyCtaBar';
import {
  cropTag,
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
  videoEmbedUrl,
} from '@/lib/events';
import type { EventRow, PageDesign } from '@/lib/events';
import { getAvailability } from '@/lib/inventory';
import { ticketState, fromPriceCents } from '@/lib/ticketState';
import { currentOrganizer, getOrganizer } from '@/lib/organizers';
import { formatMoney } from '@/lib/money';
import {
  SITE_NAME,
  absoluteUrl,
  eventBreadcrumbJsonLd,
  eventDescription,
  eventJsonLd,
  jsonLdScript,
} from '@/lib/seo';

// Availability comes from the database — always render fresh.
export const dynamic = 'force-dynamic';

type AccentName = NonNullable<PageDesign['accent']>;

/**
 * The six organizer-selectable accents, mapped onto the design system's CSS
 * tokens. Applied as inline CSS variables on a wrapper div, so every existing
 * class (buttons, badges, steps, glows) recolors itself — no raw CSS from
 * organizers ever reaches the page.
 */
const ACCENT_THEMES = {
  violet: {
    '--accent': '#8b5cf6',
    '--accent-strong': '#7c3aed',
    '--accent-soft': 'rgba(139, 92, 246, 0.14)',
    '--accent-glow': 'rgba(139, 92, 246, 0.45)',
    '--accent-text': '#c4b5fd',
    '--pink': '#ec4899',
    '--pink-soft': 'rgba(236, 72, 153, 0.14)',
    '--pink-text': '#f9a8d4',
  },
  sunset: {
    '--accent': '#f97316',
    '--accent-strong': '#ea580c',
    '--accent-soft': 'rgba(249, 115, 22, 0.14)',
    '--accent-glow': 'rgba(249, 115, 22, 0.45)',
    '--accent-text': '#fdba74',
    '--pink': '#ec4899',
    '--pink-soft': 'rgba(236, 72, 153, 0.14)',
    '--pink-text': '#f9a8d4',
  },
  ocean: {
    '--accent': '#0ea5e9',
    '--accent-strong': '#0284c7',
    '--accent-soft': 'rgba(14, 165, 233, 0.14)',
    '--accent-glow': 'rgba(14, 165, 233, 0.45)',
    '--accent-text': '#7dd3fc',
    '--pink': '#22d3ee',
    '--pink-soft': 'rgba(34, 211, 238, 0.14)',
    '--pink-text': '#a5f3fc',
  },
  emerald: {
    '--accent': '#10b981',
    '--accent-strong': '#059669',
    '--accent-soft': 'rgba(16, 185, 129, 0.14)',
    '--accent-glow': 'rgba(16, 185, 129, 0.45)',
    '--accent-text': '#6ee7b7',
    '--pink': '#2dd4bf',
    '--pink-soft': 'rgba(45, 212, 191, 0.14)',
    '--pink-text': '#99f6e4',
  },
  gold: {
    '--accent': '#f59e0b',
    '--accent-strong': '#d97706',
    '--accent-soft': 'rgba(245, 158, 11, 0.14)',
    '--accent-glow': 'rgba(245, 158, 11, 0.45)',
    '--accent-text': '#fcd34d',
    '--pink': '#f97316',
    '--pink-soft': 'rgba(249, 115, 22, 0.14)',
    '--pink-text': '#fdba74',
  },
  crimson: {
    '--accent': '#ef4444',
    '--accent-strong': '#dc2626',
    '--accent-soft': 'rgba(239, 68, 68, 0.14)',
    '--accent-glow': 'rgba(239, 68, 68, 0.45)',
    '--accent-text': '#fca5a5',
    '--pink': '#f43f5e',
    '--pink-soft': 'rgba(244, 63, 94, 0.14)',
    '--pink-text': '#fda4af',
  },
} satisfies Record<AccentName, Record<string, string>>;

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

/**
 * The four steps, told for THIS event: an organizer who also takes PayPal
 * should not have their page promising a bank transfer is the only way, and one
 * who does not must not have PayPal dangled in front of their buyers.
 */
function howItWorks(takesPaypal: boolean) {
  return [
    {
      title: 'Reserve your tickets',
      desc: 'Pick your tickets at checkout and reserve them in one click — no account needed, and your seats are held for you right away.',
    },
    takesPaypal
      ? {
          title: 'Pay by bank transfer or PayPal',
          desc: 'You get the organizer’s bank details, their PayPal address, and a personal payment reference. Send the money whichever way suits you — just remember to include the reference.',
        }
      : {
          title: 'Pay by bank transfer',
          desc: 'You get the organizer’s bank details and a personal payment reference. Send a normal transfer from any bank app — just remember to include the reference.',
        },
    {
      title: 'Your payment is confirmed',
      desc: takesPaypal
        ? 'PayPal usually arrives within minutes and a bank transfer takes 1–2 business days. As soon as yours lands, the organizer confirms it and your QR-code tickets are emailed to you.'
        : 'As soon as the transfer arrives (usually 1–2 business days), the organizer confirms it and your QR-code tickets land in your inbox.',
    },
    {
      title: 'Show the QR code at the door',
      desc: 'Bring your QR codes on your phone or on paper. One quick scan per ticket and you are in — enjoy the show!',
    },
  ];
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
}

/**
 * The picture that represents this event everywhere off-site: Google, WhatsApp,
 * Facebook, Viber. Uses the SAME cover the page itself opens with, including
 * the organizer's own crop, so the link preview and the page agree.
 *
 * 1200x630 is the size every social platform crops to; the 'cover' variant is
 * 1600x740, close enough in shape that nothing important is lost and far better
 * than shipping a 7 MB original that Facebook would reject for size.
 *
 * Videos are skipped: a link preview must be a still. An event whose cover is a
 * video falls through to its poster or first photo, and if it has no picture at
 * all it gets no og:image rather than a broken one.
 */
function socialImage(event: EventRow): string | null {
  const photos = getEventMedia(event.id); // photos only — videos are excluded here
  const isPhoto = (id: string | null): id is string => !!id && photos.some((p) => p.id === id);

  if (isPhoto(event.coverMediaId)) {
    return mediaUrl(event.coverMediaId, 'cover', cropTag(parseCropRect(event.coverCrop)));
  }
  if (isPhoto(event.posterMediaId)) {
    return mediaUrl(event.posterMediaId, 'cover', cropTag(parseCropRect(event.posterCrop)));
  }
  return photos[0] ? mediaUrl(photos[0].id, 'cover', null) : null;
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
  if (event.status !== 'published') {
    return { title: `${event.name} — preview`, robots: { index: false, follow: false } };
  }

  const description = eventDescription(event);
  const image = socialImage(event);
  const url = absoluteUrl(`/e/${event.slug}`);
  // What a searcher types: the event, then the city. "Dashain Night 2026 —
  // Tickets, Berlin" matches "dashain night berlin tickets" far better than the
  // name alone, and still reads like a sentence rather than keyword soup.
  const title = `${event.name} — Tickets${event.city.trim() ? `, ${event.city.trim()}` : ''}`;

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
      ...(image ? { images: [{ url: image, width: 1600, height: 740, alt: event.name }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function EventPage({ params }: Params) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) notFound();

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

  const design = parsePageDesign(event.pageDesign);
  const theme = ACCENT_THEMES[design.accent ?? 'violet'];
  const tuning = vibeTuning(design.vibe);

  const tiers = getEventTiers(event.id);
  const availability = getAvailability(event.id);

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
  const minPrice = fromPriceCents(tiers);

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
  const addMedia = (id: string | null, kind: 'photo' | 'video') => {
    if (!id || seenMedia.has(id)) return;
    seenMedia.add(id);
    const alt =
      kind === 'video' ? `${event.name} video ${++videoNo}` : `${event.name} photo ${++photoNo}`;
    galleryItems.push({ id, kind, src: mediaUrl(id), alt });
  };
  addMedia(coverId, coverIsVideo ? 'video' : 'photo');
  photos.forEach((m) => addMedia(m.id, 'photo'));
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
  const faqs = getEventFaqs(event.id);
  const answeredQuestions = listEventQuestions(event.id, 'answered');

  const maps = mapsUrl(event);
  const location = [event.venueName, event.city].filter(Boolean).join(', ');
  const hasWhereCard = Boolean(
    event.dateDisplay || event.venueName || event.address || event.city
  );
  const checkoutHref = `/e/${event.slug}/checkout`;
  const headline = design.headline || event.name;
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
    { id: 'tickets', label: 'Tickets' },
    event.description.trim() ? { id: 'about', label: 'About' } : null,
    legacyVideo ? { id: 'watch', label: 'Watch' } : null,
    posts.length > 0 ? { id: 'updates', label: 'Updates' } : null,
    showGallery ? { id: 'gallery', label: 'Gallery' } : null,
    { id: 'how-it-works', label: 'How it works' },
    faqs.length > 0 ? { id: 'faq', label: 'FAQ' } : null,
    // Always present now — the section holds the ask form, not just answers.
    { id: 'questions', label: 'Questions' },
  ].filter((s): s is EventSectionLink => s !== null);
  // Tickets and "How it works" are always there, so two buttons means the event
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
  const organizerDisplayName = organizer?.name?.trim() || 'the organizer';
  const socialImageUrl = socialImage(event);
  const eventLd = eventJsonLd({
    event,
    tiers,
    remainingByTier: Object.fromEntries(
      Object.entries(availability.tiers).map(([key, t]) => [key, t.remaining])
    ),
    totalRemaining: availability.totalRemaining,
    images: socialImageUrl ? [absoluteUrl(socialImageUrl)] : [],
    organizerName: organizer?.name?.trim() || SITE_NAME,
  });

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
      {!preview && (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(eventLd)} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={jsonLdScript(eventBreadcrumbJsonLd(event))}
          />
        </>
      )}

      {preview && (
        <div className="preview-bar" role="status">
          <div className="container preview-bar-inner">
            <span className="badge badge-amber">Preview</span>
            <span className="preview-bar-text">
              This is your page as visitors will see it. <strong>Nobody else can open it</strong> —
              it stays private until you publish, and tickets cannot be bought yet.
            </span>
            <Link href={`/portal/events/${event.id}/edit`} className="btn btn-sm">
              Back to editing
            </Link>
          </div>
        </div>
      )}

      <section className="hero event-hero" style={heroStyle}>
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

        <div className="container event-hero-inner">
          {/* "Live event" is a claim, and on a draft it is a false one. */}
          <p className="hero-kicker anim-fade-up">{preview ? 'Not published yet' : 'Live event'}</p>
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
          {(event.dateDisplay || location) && (
            <div className="hero-chip-row anim-fade-up anim-d2">
              {event.dateDisplay ? (
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
                Get tickets
              </span>
              <span className="badge badge-amber">Live once you publish</span>
              {minPrice !== null ? (
                <span className="event-hero-price">
                  from {formatMoney(minPrice, event.currency)}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="event-hero-actions anim-fade-up anim-d3">
              {state.buyable ? (
                <Link href={checkoutHref} className="btn btn-primary btn-lg">
                  Get tickets
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
              <span
                className={`badge ${
                  state.kind === 'sold-out'
                    ? 'badge-red'
                    : state.kind === 'closed'
                      ? 'badge-amber'
                      : state.badge.startsWith('Only')
                        ? 'badge-amber'
                        : 'badge-green'
                }`}
              >
                {state.badge}
              </span>
              {/* Both at once: this batch has gone, another is on the way. The
                  hero used to say only the first, so an event with tickets
                  still to come read as finished. */}
              {state.kind !== 'coming-soon' && state.upcoming > 0 ? (
                <span className="badge badge-green">Coming soon</span>
              ) : null}
              {state.buyable && minPrice !== null ? (
                <span className="event-hero-price">
                  from {formatMoney(minPrice, event.currency)}
                </span>
              ) : null}
              {/* One line of context under the buttons for the states that need
                  explaining. "Sold out" speaks for itself; the other two do not. */}
              {state.kind === 'closed' || state.kind === 'coming-soon' ? (
                <p className="muted small" style={{ width: '100%', margin: '8px 0 0' }}>
                  {state.kind === 'closed'
                    ? 'Ticket sales are paused right now — check back soon.'
                    : 'Tickets are not on sale yet. This page is where they will appear.'}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {/* Facebook-style profile photo, overlapping the hero's bottom edge. */}
      {profileUrl && (
        <div className="container event-avatar-wrap">
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
          <div className={hasWhereCard ? 'event-split' : undefined}>
            <div>
              <p className="section-kicker">Pick your spot</p>
              <h2 className="page-title">Tickets</h2>
              <div className="tier-grid">
                {tiers.map((tier) => {
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
                  const tierBuyable = state.buyable && !preview && !tier.comingSoon && remaining > 0;
                  const card = (
                    <>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {/* Order matters. The event's own state comes first: a
                            finished or paused event cannot have a ticket type
                            that is "Available", and this list used to say so
                            anyway because it only ever looked at its own row.
                            Then announced, then sold out, and only THEN the
                            countdown — because hiding the count must hide the
                            NUMBER, never the fact. This branch used to start with
                            "uncapped or countdown hidden -> Available", so a tier
                            with the countdown switched off said Available after
                            it had completely sold out. */}
                        {state.kind === 'past' ? (
                          <span className="badge">{state.badge}</span>
                        ) : state.kind === 'closed' ? (
                          /* Amber, the same as the hero says it. Red here read
                             as a failure next to an amber pause overhead. */
                          <span className="badge badge-amber">{state.badge}</span>
                        ) : tier.comingSoon || state.kind === 'coming-soon' ? (
                          <span className="badge badge-green">Coming soon</span>
                        ) : remaining === 0 ? (
                          <span className="badge badge-red">Sold out</span>
                        ) : availability.showRemaining && remaining <= 25 ? (
                          <span className="badge badge-amber">Only {remaining} left</span>
                        ) : (
                          <span className="badge badge-green">Available</span>
                        )}
                        {tier.studentOnly && <span className="badge badge-student">Student</span>}
                      </div>
                      <div className="tier-name">{tier.name}</div>
                      <div className="tier-price">
                        {formatMoney(tier.priceCents, event.currency)}
                      </div>
                      <p className="tier-desc">{tier.description}</p>
                      {tier.studentOnly && (
                        <p className="small muted" style={{ margin: 0 }}>
                          Bring a valid student ID — it&rsquo;s checked at the entrance.
                        </p>
                      )}
                      {tierBuyable && <span className="tier-card-go">Get tickets →</span>}
                    </>
                  );
                  return tierBuyable ? (
                    <Link
                      className="tier-card glow-card tier-card-link"
                      key={tier.tierKey}
                      href={checkoutHref}
                      aria-label={`Get ${tier.name} tickets`}
                    >
                      {card}
                    </Link>
                  ) : (
                    <div className="tier-card glow-card" key={tier.tierKey}>
                      {card}
                    </div>
                  );
                })}
              </div>
              <p className="muted small">Up to {event.maxPerOrder} tickets per order.</p>
              {canBuy && (
                <p style={{ marginTop: 16 }}>
                  <Link href={checkoutHref} className="btn btn-primary btn-lg">
                    Get your tickets
                  </Link>
                </p>
              )}
            </div>

            {hasWhereCard && (
              <aside className="event-aside">
                <div className="card glow-card">
                  <div className="card-title">When &amp; where</div>
                  <ul className="event-fact-list">
                    {event.dateDisplay ? (
                      <li className="event-fact">
                        <span className="event-fact-icon" aria-hidden="true">
                          <CalendarIcon />
                        </span>
                        <div>
                          <div className="event-fact-label">Date</div>
                          <div className="event-fact-value">{event.dateDisplay}</div>
                        </div>
                      </li>
                    ) : null}
                    {event.venueName || event.address || event.city ? (
                      <li className="event-fact">
                        <span className="event-fact-icon" aria-hidden="true">
                          <PinIcon />
                        </span>
                        <div>
                          <div className="event-fact-label">Venue</div>
                          <div className="event-fact-value">{event.venueName || 'Venue'}</div>
                          {event.address ? (
                            <div className="muted small">{event.address}</div>
                          ) : null}
                          {event.city ? <div className="muted small">{event.city}</div> : null}
                        </div>
                      </li>
                    ) : null}
                  </ul>
                  {maps ? (
                    <a
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-block"
                    >
                      Open in Maps
                    </a>
                  ) : null}
                </div>
              </aside>
            )}
          </div>
        </div>
      </section>

      {event.description.trim() && (
        <section className="section event-section" id="about">
          <div className="container">
            <p className="section-kicker">The story</p>
            <h2 className="page-title">{design.aboutTitle || 'About the event'}</h2>
            <p className="muted event-prose">{event.description}</p>
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
          <p className="section-kicker">From reserve to entry</p>
          <h2 className="page-title">How it works</h2>
          <ol className="step-list" style={{ maxWidth: 680 }}>
            {howItWorks(paypalPayee(event) !== null).map((item, i) => (
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
          <div className="event-closing-actions">
            {canBuy ? (
              <Link href={checkoutHref} className="btn btn-primary btn-lg">
                Get tickets for {event.name}
              </Link>
            ) : (
              <span className="btn btn-lg" aria-disabled="true" style={{ opacity: 0.6, pointerEvents: 'none' }}>
                {state.cta}
              </span>
            )}
            <Link href="/" className="btn">
              Browse more events
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

      {/* Sticky mobile checkout bar — appears below 640px via CSS, and only
          once the hero's own button has scrolled away. */}
      {!preview && (
        <StickyCtaBar
          href={checkoutHref}
          name={event.name}
          buyable={state.buyable}
          cta={state.cta}
          priceLabel={
            state.buyable && minPrice !== null
              ? `from ${formatMoney(minPrice, event.currency)}`
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
          organizerName={organizerDisplayName}
          eventName={event.name}
          photoUrl={profileUrl}
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
