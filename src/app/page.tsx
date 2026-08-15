import Link from 'next/link';
import CardVideo from '@/components/CardVideo';
import Logo from '@/components/Logo';
import PlatformAssistant from '@/components/PlatformAssistant';
import {
  cropTag,
  getEventMedia,
  getEventTiers,
  listPublishedEvents,
  mediaUrl,
  parseCropRect,
  parsePageDesign,
} from '@/lib/events';
import type { EventRow, PageDesign } from '@/lib/events';
import { getAvailability } from '@/lib/inventory';
import { formatMoney } from '@/lib/money';

// The feed reflects live availability — always render fresh.
export const dynamic = 'force-dynamic';

type AccentName = NonNullable<PageDesign['accent']>;

// Poster stand-in when an event has no photos yet, tinted by its accent.
const PLACEHOLDER_GRADIENTS: Record<AccentName, string> = {
  violet: 'linear-gradient(135deg, #2e1065, #7c3aed 55%, #ec4899)',
  sunset: 'linear-gradient(135deg, #431407, #ea580c 55%, #ec4899)',
  ocean: 'linear-gradient(135deg, #082f49, #0284c7 55%, #22d3ee)',
  emerald: 'linear-gradient(135deg, #022c22, #059669 55%, #34d399)',
  gold: 'linear-gradient(135deg, #451a03, #d97706 55%, #fbbf24)',
  crimson: 'linear-gradient(135deg, #450a0a, #dc2626 55%, #f43f5e)',
};

/**
 * What a feed tile shows.
 *
 * The COVER comes first — that is what the organizer chose to represent this
 * event, so the tile and the event page agree instead of quietly disagreeing.
 * When that cover is a VIDEO the tile plays it, silent and looping, which is
 * what makes the feed feel alive; a still is always resolved alongside it as
 * the poster frame and the fallback for reduced motion or a file that will not
 * decode.
 *
 * The crop tag follows whichever still won, because each slot stores its own
 * framing — sending the cover's rectangle with the poster's photo would frame
 * it by someone else's crop.
 */
function tileMediaFor(event: EventRow): { videoUrl: string | null; stillUrl: string | null } {
  const photos = getEventMedia(event.id); // photos only — videos are excluded
  const isPhoto = (id: string | null): id is string => !!id && photos.some((p) => p.id === id);

  const still = isPhoto(event.coverMediaId)
    ? { id: event.coverMediaId, crop: cropTag(parseCropRect(event.coverCrop)) }
    : isPhoto(event.posterMediaId)
      ? { id: event.posterMediaId, crop: cropTag(parseCropRect(event.posterCrop)) }
      : photos[0]
        ? { id: photos[0].id, crop: null }
        : null;

  // A cover id that is not one of the photos is the event's video cover.
  const coverIsVideo = Boolean(event.coverMediaId) && !isPhoto(event.coverMediaId);

  return {
    videoUrl: coverIsVideo ? mediaUrl(event.coverMediaId as string) : null,
    stillUrl: still ? mediaUrl(still.id, 'card', still.crop) : null,
  };
}

/**
 * The little date badge over the picture — "Oct 12", and never more.
 *
 * It used to fall back to the organizer's own date text, which is written for
 * the page body ("Saturday, October 17, 2026 · Doors 6:00 PM · Show 7:00 PM")
 * and turned the badge into a paragraph covering a third of the tile. If a real
 * date is not available, a short label is teased out of that text instead, and
 * failing that the badge is simply left off: the full date is already printed
 * under the title, so nothing is lost.
 */
function dateChipLabel(event: EventRow): string | null {
  if (event.eventDate) {
    const iso = event.eventDate.length === 10 ? `${event.eventDate}T12:00:00` : event.eventDate;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }
  // "Saturday, October 3, 2026 · Doors 19:00" -> "Oct 3"
  const match = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/i.exec(
    event.dateDisplay
  );
  if (match) {
    return `${match[1][0].toUpperCase()}${match[1].slice(1, 3).toLowerCase()} ${match[2]}`;
  }
  return null;
}

function AvailabilityBadge({ event, remaining }: { event: EventRow; remaining: number }) {
  if (!event.salesOpen) return <span className="badge badge-amber">Sales closed</span>;
  if (remaining === 0) return <span className="badge badge-red">Sold out</span>;
  if (remaining <= 50) return <span className="badge badge-amber">Only {remaining} left</span>;
  return <span className="badge badge-green">Tickets available</span>;
}

function EventCard({
  event,
  featured = false,
  delayClass = '',
}: {
  event: EventRow;
  featured?: boolean;
  delayClass?: string;
}) {
  const tiers = getEventTiers(event.id);
  const minPrice = tiers.length ? Math.min(...tiers.map((t) => t.priceCents)) : null;
  const availability = getAvailability(event.id);
  const { videoUrl, stillUrl } = tileMediaFor(event);
  const accent = parsePageDesign(event.pageDesign).accent ?? 'violet';
  const location = [event.venueName, event.city].filter(Boolean).join(', ');
  const chip = dateChipLabel(event);

  return (
    <Link
      href={`/e/${event.slug}`}
      className={`event-card${featured ? ' event-card-featured' : ''} anim-fade-up${delayClass}`}
    >
      <div className="event-card-media">
        {videoUrl ? (
          <CardVideo src={videoUrl} poster={stillUrl ?? undefined} label={event.name} />
        ) : stillUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stillUrl}
            alt={`${event.name} poster`}
            loading="lazy"
            className="event-card-shot"
          />
        ) : (
          // No photo yet: a flat colour block reads as a broken image, so give
          // it the event's initial and its own accent — it looks deliberate,
          // and an organizer mid-setup does not appear on the feed as an error.
          <div
            className="event-card-placeholder"
            aria-hidden="true"
            style={{ background: PLACEHOLDER_GRADIENTS[accent] }}
          >
            <span className="event-card-initial">
              {event.name.trim().charAt(0).toUpperCase() || '\u2022'}
            </span>
          </div>
        )}
        {chip ? <span className="event-date-chip">{chip}</span> : null}
        <span className="event-card-status">
          <AvailabilityBadge event={event} remaining={availability.totalRemaining} />
        </span>
        {/* Fades the photo into the card body so the two are one object rather
            than a picture sitting on a panel. */}
        <span className="event-card-scrim" aria-hidden />
      </div>
      <div className="event-card-body">
        <div className="event-card-title">{event.name}</div>
        {event.artist ? <div className="event-card-meta">{event.artist}</div> : null}
        {event.dateDisplay ? <div className="event-card-meta">{event.dateDisplay}</div> : null}
        {location ? <div className="event-card-meta">{location}</div> : null}
        <div className="event-card-foot">
          {minPrice !== null ? (
            <span className="event-card-price">
              from {formatMoney(minPrice, event.currency)}
            </span>
          ) : (
            <span />
          )}
          <span className="event-card-go">Get tickets</span>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const events = listPublishedEvents();

  // listPublishedEvents() is already sorted soonest-first, dated events ahead
  // of undated ones — the first three dated events are "Happening soon".
  const soon = events.filter((e) => e.eventDate).slice(0, 3);
  const soonIds = new Set(soon.map((e) => e.id));
  const rest = events.filter((e) => !soonIds.has(e.id));

  return (
    <>
      <section className="feed-hero">
        <div className="container">
          <div className="feed-hero-logo anim-fade-up">
            <Logo size={44} />
          </div>
          <h1 className="anim-fade-up anim-d1">Nepali concerts &amp; events, near you</h1>
          <p className="feed-hero-sub anim-fade-up anim-d2">
            Live shows, cultural nights and parties from Nepali organizers — reserve your
            tickets in one click, pay by bank transfer, and your QR tickets arrive by
            email.
          </p>
          <p className="feed-hero-actions anim-fade-up anim-d3">
            <a href="#events" className="btn btn-brand btn-lg">
              Browse events
            </a>
            {/* The pitch, not the sign-in door: someone who does not have an
                account yet needs the price and the explanation first. */}
            <Link href="/organizers" className="btn btn-lg">
              For organizers
            </Link>
          </p>
        </div>
      </section>

      <div id="events">
        {events.length === 0 ? (
          <section className="section">
            <div className="container">
              <div
                className="card anim-fade-up"
                style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: 36 }}
              >
                <h2 className="card-title" style={{ fontSize: '1.3rem' }}>
                  No events yet
                </h2>
                <p className="muted">
                  New events appear here the moment organizers publish them — check back
                  soon.
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
            {soon.length > 0 && (
              <section className="section">
                <div className="container">
                  <p className="feed-kicker anim-fade-up">Don&rsquo;t miss</p>
                  <h2 className="feed-section-title anim-fade-up">Happening soon</h2>
                  <div className="feed-strip">
                    {soon.map((event, i) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        featured
                        delayClass={[' anim-d1', ' anim-d2', ' anim-d3'][i] ?? ''}
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {rest.length > 0 && (
              <section className="section">
                <div className="container">
                  <p className="feed-kicker anim-fade-up">Explore</p>
                  <h2 className="feed-section-title anim-fade-up">All events</h2>
                  <div className="feed-grid">
                    {rest.map((event, i) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        delayClass={['', ' anim-d1', ' anim-d2', ' anim-d3'][i % 4]}
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <PlatformAssistant />
    </>
  );
}
