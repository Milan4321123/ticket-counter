// The tile one event gets in every listing on the site. Server component: it
// reads tiers and live availability itself, so a caller only has to hand it an
// event row.
import Link from 'next/link';
import CardVideo from '@/components/CardVideo';
import { getEventTiers, parsePageDesign } from '@/lib/events';
import type { EventRow, PageDesign } from '@/lib/events';
import { getAvailability } from '@/lib/inventory';
import { listingTileMedia } from '@/lib/listing';
import { formatMoney } from '@/lib/money';

type AccentName = NonNullable<PageDesign['accent']>;

/** Poster stand-in when an event has no photos yet, tinted by its accent. */
const PLACEHOLDER_GRADIENTS: Record<AccentName, string> = {
  violet: 'linear-gradient(135deg, #2e1065, #7c3aed 55%, #ec4899)',
  sunset: 'linear-gradient(135deg, #431407, #ea580c 55%, #ec4899)',
  ocean: 'linear-gradient(135deg, #082f49, #0284c7 55%, #22d3ee)',
  emerald: 'linear-gradient(135deg, #022c22, #059669 55%, #34d399)',
  gold: 'linear-gradient(135deg, #451a03, #d97706 55%, #fbbf24)',
  crimson: 'linear-gradient(135deg, #450a0a, #dc2626 55%, #f43f5e)',
};

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
export function dateChipLabel(event: EventRow): string | null {
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

function AvailabilityBadge({
  event,
  remaining,
  unlimited,
}: {
  event: EventRow;
  remaining: number;
  unlimited: boolean;
}) {
  if (!event.salesOpen) return <span className="badge badge-amber">Sales closed</span>;
  // An uncapped event has no count to report and can never sell out. Scarcity
  // it does not have would be a lie, so it just says tickets are available.
  // Uncapped, or the organizer chose not to publish a countdown.
  if (unlimited) return <span className="badge badge-green">Tickets available</span>;
  if (remaining === 0) return <span className="badge badge-red">Sold out</span>;
  if (remaining <= 50) return <span className="badge badge-amber">Only {remaining} left</span>;
  return <span className="badge badge-green">Tickets available</span>;
}

export interface EventCardProps {
  event: EventRow;
  /** Dims the tile and drops the availability badge — for events already over. */
  past?: boolean;
  delayClass?: string;
}

export default function EventCard({ event, past = false, delayClass = '' }: EventCardProps) {
  const tiers = getEventTiers(event.id);
  const minPrice = tiers.length ? Math.min(...tiers.map((t) => t.priceCents)) : null;
  const availability = getAvailability(event.id);
  const { videoUrl, stillUrl } = listingTileMedia(event);
  const accent = parsePageDesign(event.pageDesign).accent ?? 'violet';
  const location = [event.venueName, event.city].filter(Boolean).join(', ');
  const chip = dateChipLabel(event);

  return (
    <Link
      href={`/e/${event.slug}`}
      className={`event-card${past ? ' event-card-past' : ''} anim-fade-up${delayClass}`}
    >
      <div className="event-card-media">
        {videoUrl ? (
          /* No poster: it would be a DIFFERENT photo, so the tile showed that
             photo and then flipped to the clip. The video's own first frame is
             the only honest still for a video cover. */
          <CardVideo src={videoUrl} label={event.name} />
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
              {event.name.trim().charAt(0).toUpperCase() || '•'}
            </span>
          </div>
        )}
        {chip ? <span className="event-date-chip">{chip}</span> : null}
        <span className="event-card-status">
          {past ? (
            <span className="badge">Finished</span>
          ) : (
            <AvailabilityBadge
              event={event}
              remaining={availability.totalRemaining}
              unlimited={availability.unlimited || !availability.showRemaining}
            />
          )}
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
          {minPrice !== null && !past ? (
            <span className="event-card-price">from {formatMoney(minPrice, event.currency)}</span>
          ) : (
            <span />
          )}
          <span className="event-card-go">{past ? 'See page' : 'Get tickets'}</span>
        </div>
      </div>
    </Link>
  );
}
