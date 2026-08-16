// The wide feature panel at the top of the browse page: one event, given the
// room a poster deserves. Server component — it reads its own tiers and
// availability, exactly like EventCard.
import Link from 'next/link';
import CardVideo from '@/components/CardVideo';
import {
  cropTag,
  getEventMedia,
  getEventTiers,
  mediaUrl,
  parseCropRect,
  parsePageDesign,
} from '@/lib/events';
import type { EventRow } from '@/lib/events';
import { getAvailability } from '@/lib/inventory';
import { formatMoney } from '@/lib/money';
import { dateChipLabel } from './EventCard';

/** Tinted stand-in for an event with no picture at all, by its accent. */
const PLACEHOLDER_GRADIENTS: Record<string, string> = {
  violet: 'linear-gradient(115deg, #2e1065, #7c3aed 60%, #ec4899)',
  sunset: 'linear-gradient(115deg, #431407, #ea580c 60%, #ec4899)',
  ocean: 'linear-gradient(115deg, #082f49, #0284c7 60%, #22d3ee)',
  emerald: 'linear-gradient(115deg, #022c22, #059669 60%, #34d399)',
  gold: 'linear-gradient(115deg, #451a03, #d97706 60%, #fbbf24)',
  crimson: 'linear-gradient(115deg, #450a0a, #dc2626 60%, #f43f5e)',
};

/**
 * The billboard's picture.
 *
 * This frame is WIDE, so it takes the cover — the photo the organizer framed
 * at exactly this shape for the top of their own event page. The listing photo
 * is not consulted here on purpose: it was cropped for a tall 4:5 tile, and
 * stretching that choice across a 21:9 band shows the middle third of it.
 */
function billboardMedia(event: EventRow): { videoUrl: string | null; stillUrl: string | null } {
  const photos = getEventMedia(event.id); // photos only
  const isPhoto = (id: string | null): id is string => !!id && photos.some((p) => p.id === id);

  const still = isPhoto(event.coverMediaId)
    ? { id: event.coverMediaId, crop: cropTag(parseCropRect(event.coverCrop)) }
    : isPhoto(event.posterMediaId)
      ? { id: event.posterMediaId, crop: cropTag(parseCropRect(event.posterCrop)) }
      : photos[0]
        ? { id: photos[0].id, crop: null }
        : null;

  const coverIsVideo = Boolean(event.coverMediaId) && !isPhoto(event.coverMediaId);

  return {
    videoUrl: coverIsVideo ? mediaUrl(event.coverMediaId as string) : null,
    stillUrl: still ? mediaUrl(still.id, 'cover', still.crop) : null,
  };
}

export interface EventBillboardProps {
  event: EventRow;
  /**
   * This is the front of the queue. Only a leading event that also has a real
   * calendar date is allowed to announce itself as what happens next — on any
   * other slide that phrase is either a guess or plainly false.
   */
  leading?: boolean;
}

export default function EventBillboard({ event, leading = false }: EventBillboardProps) {
  const tiers = getEventTiers(event.id);
  const minPrice = tiers.length ? Math.min(...tiers.map((t) => t.priceCents)) : null;
  const { totalRemaining } = getAvailability(event.id);
  const { videoUrl, stillUrl } = billboardMedia(event);
  const accent = parsePageDesign(event.pageDesign).accent ?? 'violet';
  const design = parsePageDesign(event.pageDesign);

  const soldOut = totalRemaining === 0;
  const canBuy = event.salesOpen && !soldOut;
  const where = [event.venueName, event.city].filter((s) => s.trim()).join(', ');
  const when = event.dateDisplay.trim() || dateChipLabel(event) || '';

  return (
    // The id has to carry the slug: several billboards now share a page, and a
    // repeated id is both invalid and points every slide's label at the first.
    <section className="billboard anim-fade-up" aria-labelledby={`billboard-title-${event.slug}`}>
      <div className="billboard-media" aria-hidden="true">
        {videoUrl ? (
          <CardVideo src={videoUrl} label={event.name} className="billboard-shot" />
        ) : stillUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stillUrl} alt="" className="billboard-shot" />
        ) : (
          <div className="billboard-shot" style={{ background: PLACEHOLDER_GRADIENTS[accent] }} />
        )}
        {/* Two scrims, not one: the vertical fade seats the panel on the page,
            and the horizontal one keeps the text legible over a busy photo
            without dimming the whole picture. */}
        <span className="billboard-scrim" />
        <span className="billboard-scrim-side" />
      </div>

      <div className="billboard-body">
        <p className="billboard-kicker">
          <span className="pulse-dot" aria-hidden />
          {soldOut
            ? 'Sold out'
            : !event.salesOpen
              ? 'Sales closed'
              : leading && event.eventDate
                ? 'Next up'
                : 'On sale now'}
        </p>
        <h2 className="billboard-title" id={`billboard-title-${event.slug}`}>
          {event.name}
        </h2>
        {design.tagline ? <p className="billboard-tagline">{design.tagline}</p> : null}
        <p className="billboard-meta">
          {[event.artist.trim(), when, where].filter(Boolean).map((part, i, all) => (
            <span key={part}>
              {part}
              {i < all.length - 1 ? <span className="billboard-dot"> · </span> : null}
            </span>
          ))}
        </p>
        <p className="billboard-actions">
          {canBuy ? (
            <Link href={`/e/${event.slug}/checkout`} className="btn btn-brand btn-lg">
              Get tickets
              {minPrice !== null ? ` · from ${formatMoney(minPrice, event.currency)}` : ''}
            </Link>
          ) : null}
          <Link href={`/e/${event.slug}`} className="btn btn-lg billboard-secondary">
            {canBuy ? 'Event details' : 'See the event'}
          </Link>
        </p>
        {canBuy && totalRemaining <= 50 ? (
          <p className="billboard-note">Only {totalRemaining} tickets left</p>
        ) : null}
      </div>
    </section>
  );
}
