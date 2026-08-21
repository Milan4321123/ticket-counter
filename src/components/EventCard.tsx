// The tile one event gets in every listing on the site. Server component: it
// reads tiers and live availability itself, so a caller only has to hand it an
// event row — or, on a page showing many tiles, a snapshot the page already
// read for all of them at once (see lib/feedSnapshot).
import Link from 'next/link';
import CardVideo from '@/components/CardVideo';
import { categoryLabel } from '@/lib/categories';
import { readListingName } from '@/lib/exampleShop';
import { getEventTiers, parsePageDesign } from '@/lib/events';
import type { EventRow, PageDesign } from '@/lib/events';
import type { FeedSnapshot } from '@/lib/feedSnapshot';
import { getAvailability } from '@/lib/inventory';
import { ticketState, fromPriceCents, comingSoonLabel } from '@/lib/ticketState';
import { listingTileMedia } from '@/lib/listing';
import { formatMoney } from '@/lib/money';

type AccentName = NonNullable<PageDesign['accent']>;

/** Poster stand-in when an event has no photos yet, tinted by its accent.
    Exported: the event page's stall cards are built from the same tile
    classes, and a shop with no photo must fall back to the same deliberate
    gradient there — not to a second guess at it. */
export const PLACEHOLDER_GRADIENTS: Record<AccentName, string> = {
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

/** Colour follows meaning: green is fine, amber is a nudge, red is a stop.
    Exported for the same reason as the gradients above: a stall card's chip
    must colour a state exactly the way the feed tile colours it. */
export const BADGE_TONE: Record<string, string> = {
  'on-sale': 'badge-green',
  'coming-soon': 'badge-green',
  closed: 'badge-amber',
  'sold-out': 'badge-red',
  past: 'badge',
};

export interface EventCardProps {
  event: EventRow;
  /** Dims the tile and drops the availability badge — for events already over. */
  past?: boolean;
  delayClass?: string;
  /**
   * The listing's one-shot read of tiers, photos and availability. Optional:
   * without it the tile reads its own, which is right for a page showing one.
   */
  snapshot?: FeedSnapshot;
}

export default function EventCard({
  event,
  past = false,
  delayClass = '',
  snapshot,
}: EventCardProps) {
  // `?? []` inside the snapshot branch, not around it: an event with no tiers
  // and no photos is a real state (a listing mid-setup), and falling through to
  // the per-tile reader for it would put the query back exactly on the rows
  // that have nothing to read.
  const tiers = snapshot ? (snapshot.tiers.get(event.id) ?? []) : getEventTiers(event.id);
  const availability = snapshot?.availability.get(event.id) ?? getAvailability(event.id);
  const minPrice = fromPriceCents(tiers, availability);
  /**
   * What can actually be bought, not what is left in the room.
   *
   * Tier capacities need not add up to the event's capacity, so every ticket
   * type can be exhausted while the venue still has space — and the room's
   * figure would then call a card available when nothing on it is. Each tier's
   * remaining is already clamped to the room, so the sum can overshoot when
   * several are clamped to the same headroom; hence the min.
   */
  const state = ticketState(event, tiers, availability, { past });
  const { videoUrl, stillUrl } = listingTileMedia(
    event,
    snapshot ? (snapshot.photos.get(event.id) ?? []) : undefined
  );
  const accent = parsePageDesign(event.pageDesign).accent ?? 'violet';
  const location = [event.venueName, event.city].filter(Boolean).join(', ');
  // One line only — the tile is 216px wide and the full collection details are
  // a paragraph. The rest is on the shop's own page.
  const collectLine =
    event.pickupInfo
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) ?? '';
  // A shop has no date, so the corner chip that would sit empty says what the
  // tile IS instead — the one thing a browser scanning a mixed feed needs, and
  // the thing the date was communicating on the tiles beside it.
  const isShop = event.kind === 'shop';
  const chip = isShop ? 'Shop' : dateChipLabel(event);
  /**
   * The example mark, moved out of the title and into a pill of its own.
   *
   * The mark lives in the listing NAME — "Taplejung Alaichi Ghar (example
   * shop)" — which was fine while a tile was 300px wide and its title had
   * three lines to spend. On the bazaar's compact tile it is four words of
   * parenthesis in the middle of a wrapping heading, i.e. exactly the shape a
   * scanning eye skips, and the honesty rule here is that a visitor must never
   * mistake an invented seller for a real one AT ANY TILE SIZE. A pill beside
   * the availability badge is louder than the parenthesis was, not quieter.
   *
   * Nothing changes for anything unmarked: readListingName only matches that
   * exact suffix, so every event and every real seller's shop renders exactly
   * as before.
   */
  const listing = readListingName(event.name);
  // Which shelf of the bazaar this shop sits on — '' (no chip) when the seller
  // has not picked one, or for a key the list no longer knows. Events never
  // carry one, so their tiles are untouched.
  const shopCategory = isShop ? categoryLabel(event.category) : '';

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
          {/* First in the pile, before availability: the badges wrap on a
              narrow tile, and the one fact a buyer must not miss cannot be the
              one that ends up on the last line. */}
          {listing.isExample ? <span className="badge badge-amber">Example shop</span> : null}
          <span className={`badge ${BADGE_TONE[state.kind] ?? 'badge-green'}`}>{state.badge}</span>
          {/* A second pill, not a replacement: an event can be on sale AND have
              a type still to come, and a sold-out one with something coming is
              exactly the card a buyer wants to keep an eye on. */}
          {!past && state.kind !== 'coming-soon' && comingSoonLabel(state) ? (
            <span className="badge badge-green">{comingSoonLabel(state)}</span>
          ) : null}
          {/* The shop's bazaar shelf, when the seller picked one — what a buyer
              scanning a mixed feed wants after "Shop": shop of WHAT. */}
          {shopCategory ? <span className="badge badge-accent">{shopCategory}</span> : null}
        </span>
        {/* Fades the photo into the card body so the two are one object rather
            than a picture sitting on a panel. */}
        <span className="event-card-scrim" aria-hidden />
      </div>
      <div className="event-card-body">
        <div className="event-card-title">{event.name}</div>
        {event.artist ? <div className="event-card-meta">{event.artist}</div> : null}
        {isShop ? (
          collectLine ? <div className="event-card-meta">{collectLine}</div> : null
        ) : event.dateDisplay ? (
          <div className="event-card-meta">{event.dateDisplay}</div>
        ) : null}
        {location ? <div className="event-card-meta">{location}</div> : null}
        <div className="event-card-foot">
          {minPrice !== null && !past ? (
            <span className="event-card-price">
              {minPrice === 0 ? 'Free' : `from ${formatMoney(minPrice, event.currency)}`}
            </span>
          ) : (
            <span />
          )}
          {/* Says what the buyer can actually do. It used to read "Get tickets"
              on a sold-out event, on a paused one, and on one where nothing had
              gone on sale yet. */}
          <span className="event-card-go">{state.cta}</span>
        </div>
      </div>
    </Link>
  );
}
