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
import type { EventMediaRow, EventRow } from '@/lib/events';
import type { FeedSnapshot } from '@/lib/feedSnapshot';
import { getAvailability } from '@/lib/inventory';
import { ticketState, fromPriceCents, comingSoonLabel } from '@/lib/ticketState';
import { formatMoney } from '@/lib/money';
import { dateChipLabel } from './EventCard';
import { listingStillUrl } from '@/lib/listing';

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
 * The billboard's picture, in BOTH shapes it is displayed at.
 *
 * On a wide screen this frame is a landscape band, so it takes the cover — the
 * photo the organizer framed at exactly that shape for the top of their own
 * event page.
 *
 * On a phone the same frame is TALL: measured at 375px it is 333x418, a 0.8
 * portrait box. Feeding it the 2.16:1 cover render there threw away 63% of the
 * picture's width — the reason a billboard that looked right on a laptop showed
 * a meaningless slice of somebody's face on a phone.
 *
 * So each screen gets a render of its own shape. The portrait one is the
 * existing 'card' variant, which is 4:5 = 0.8 and therefore an exact match for
 * the phone box: nothing is cropped at all. No new variant, no new cache
 * entries — the tiles already generate it.
 */
function billboardMedia(
  event: EventRow,
  preloaded?: EventMediaRow[]
): {
  videoUrl: string | null;
  stillUrl: string | null;
  stillUrlNarrow: string | null;
} {
  const photos = preloaded ?? getEventMedia(event.id); // photos only
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
    // The phone billboard is a 4:5 portrait panel, which is exactly what a feed
    // tile is — so it takes the tile's picture, with the tile's framing. Reusing
    // that resolver rather than re-cropping the wide cover is the whole fix:
    // the cover's rectangle describes a landscape band and means nothing here.
    stillUrlNarrow: listingStillUrl(event, preloaded),
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
  /** The listing's one-shot read of tiers, photos and availability, when it has one. */
  snapshot?: FeedSnapshot;
}

export default function EventBillboard({
  event,
  leading = false,
  snapshot,
}: EventBillboardProps) {
  // See EventCard for why the `?? []` sits inside the snapshot branch.
  const tiers = snapshot ? (snapshot.tiers.get(event.id) ?? []) : getEventTiers(event.id);
  const availability = snapshot?.availability.get(event.id) ?? getAvailability(event.id);
  const minPrice = fromPriceCents(tiers, availability);
  /**
   * The cheapest announced type's price, for the badge that names it.
   *
   * The from-price above is about what can be BOUGHT, so on a sold-out event it
   * says nothing about the ticket that is still coming — which is the one piece
   * of information a visitor on that card actually wants.
   */
  const comingPrice = (() => {
    const announced = tiers.filter((t) => t.status === 'coming-soon');
    return announced.length ? Math.min(...announced.map((t) => t.priceCents)) : null;
  })();
  // One shared decision for badge, button and note — see lib/ticketState.ts for
  // why these three used to disagree with each other.
  const state = ticketState(event, tiers, availability);
  const { videoUrl, stillUrl, stillUrlNarrow } = billboardMedia(
    event,
    snapshot ? (snapshot.photos.get(event.id) ?? []) : undefined
  );
  const accent = parsePageDesign(event.pageDesign).accent ?? 'violet';
  const design = parsePageDesign(event.pageDesign);

  const canBuy = state.buyable;
  const where = [event.venueName, event.city].filter((s) => s.trim()).join(', ');
  const when = event.dateDisplay.trim() || dateChipLabel(event) || '';

  return (
    // The id has to carry the slug: several billboards now share a page, and a
    // repeated id is both invalid and points every slide's label at the first.
    <section className="billboard anim-fade-up" aria-labelledby={`billboard-title-${event.slug}`}>
      <div className="billboard-media" aria-hidden="true">
        {videoUrl ? (
          /* A poster here, unlike on a feed tile — the trade-off runs the other
             way at this size. The tile withholds one because the poster is a
             DIFFERENT photo from the clip's first frame and the swap reads as a
             glitch. But this frame is the top of the homepage and the clip
             behind it is the heaviest thing on the site: measured at 375px it
             pulled 3.3 MB within 8 s of the slide appearing, and until those
             bytes arrive the panel paints NOTHING. A brief flash of the tile's
             own photo beats an empty hero on any connection slower than an
             office — and it is the SAME url the feed tile below requests
             (measured: 58 KB, one fetch serving both), so the flash costs one
             render of a picture this page was going to download anyway. */
          <CardVideo
            src={videoUrl}
            poster={stillUrlNarrow ?? stillUrl ?? undefined}
            label={event.name}
            className="billboard-shot"
          />
        ) : stillUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          /* <picture> so the browser picks the render that matches the box it
             will actually be painted into. The 520px breakpoint is the one the
             stylesheet already uses to turn this frame portrait, so the two
             cannot drift apart. */
          <picture>
            <source media="(max-width: 520px)" srcSet={stillUrlNarrow ?? stillUrl} />
            <img src={stillUrl} alt="" className="billboard-shot" />
          </picture>
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
          {/* The kicker follows the same single decision as the button, so the
              two can never say different things about the same event. */}
          {state.kind !== 'on-sale'
            ? state.badge
            : leading && event.eventDate
              ? 'Next up'
              : 'On sale now'}
          {/* Both states, side by side, because an event really is in both at
              once: this batch has gone AND another is on the way. Said as a
              badge rather than only as a line of text below the buttons — a
              sold-out headline with the good news in small print underneath is
              read as simply sold out.
              With the price, because the from-price on the button is about what
              can be BOUGHT and says nothing about the one ticket a visitor on a
              sold-out card still has a reason to care about. */}
          {state.kind !== 'coming-soon' && comingSoonLabel(state) ? (
            <span className="badge badge-green billboard-kicker-badge">
              {comingSoonLabel(state)}
              {state.upcomingNames.length === 1 && comingPrice !== null
                ? ` · ${formatMoney(comingPrice, event.currency)}`
                : ''}
            </span>
          ) : null}
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
          ) : (
            /* Not a link, because there is nothing to go to — but the state has
               to be SAID. This slot used to fall silent, so a sold-out or
               not-yet-selling event simply lost its headline button and looked
               broken rather than explained. */
            <span className={`btn btn-lg ${state.kind === 'coming-soon' ? 'btn-green' : 'billboard-secondary'}`} aria-disabled="true">
              {state.cta}
              {state.kind === 'coming-soon' && minPrice !== null
                ? ` · from ${formatMoney(minPrice, event.currency)}`
                : ''}
            </span>
          )}
          <Link href={`/e/${event.slug}`} className="btn btn-lg billboard-secondary">
            {canBuy ? 'Event details' : 'See the event'}
          </Link>
        </p>
        {canBuy && state.showCount && state.remaining <= 50 ? (
          <p className="billboard-note">
            Only {state.remaining} ticket{state.remaining === 1 ? '' : 's'} left
          </p>
        ) : null}
        {/* Only when the badge could not fit the whole answer. With ONE type
            still to come the badge already names it and prices it, and repeating
            that in a sentence underneath was the third time the card said the
            same thing — after the kicker and the button. */}
        {state.kind !== 'coming-soon' && state.upcomingNames.length > 1 ? (
          <p className="billboard-note">
            {state.upcomingNames.join(', ')} are coming soon — see the event page for what is on the
            way.
          </p>
        ) : null}
      </div>
    </section>
  );
}
