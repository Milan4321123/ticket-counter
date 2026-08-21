// Server-only: which picture represents an event wherever it is LISTED —
// the browse feed and the organizer's own dashboard.
//
// There are two different jobs here and they used to be confused for one:
//
//  - The COVER is the wide band across the top of the event's own page. It is
//    chosen to look good at 2.17:1, and it may be a video.
//  - The LISTING PHOTO (stored as poster_media_id, because that is what the
//    slot was originally called) is the tall 4:5 tile the event shows on the
//    browse page. A wide cover cropped into a tall tile is a slice of a
//    picture; a photo picked FOR the tile is a poster.
//
// So the listing photo wins here whenever the organizer has set one — that
// choice is meaningless otherwise, and "set a different picture for the browse
// page" is exactly what the slot exists for. The cover is the fallback, so an
// organizer who never opens that control still gets a full, sensible tile.
import { cropTag, getEventMedia, mediaUrl, parseCropRect } from './events';
import type { EventMediaRow, EventRow } from './events';

export interface ListingTileMedia {
  /** A looping video cover to play in the tile, or null for a still. */
  videoUrl: string | null;
  /** The still to show — already rendered to the tile's exact 4:5 shape. */
  stillUrl: string | null;
}

/** The chosen photo id plus that slot's framing stamp, or null when none fits. */
function listingStill(event: EventRow, photos: { id: string }[]): { id: string; crop: string | null } | null {
  const isPhoto = (id: string | null): id is string => !!id && photos.some((p) => p.id === id);

  // The organizer's explicit tile choice first, then the cover, then whatever
  // photo exists. Each slot carries its OWN framing — sending the cover's
  // rectangle with the listing photo would frame it by someone else's crop.
  if (isPhoto(event.posterMediaId)) {
    return { id: event.posterMediaId, crop: cropTag(parseCropRect(event.posterCrop)) };
  }
  if (isPhoto(event.coverMediaId)) {
    // The cover photo, but NOT the cover's rectangle. That rectangle was framed
    // against a 2.17:1 band, and one real event here has it set to the full
    // width by 31% of the height — a letterbox strip. Re-cropping a strip like
    // that into a 4:5 tile keeps only its middle: a fragment of a fragment.
    // Cropping the WHOLE photo automatically, around its subject, beats the
    // middle of somebody's letterbox every time. A crop belongs to the shape it
    // was drawn for, and this is not that shape.
    return { id: event.coverMediaId, crop: null };
  }
  return photos[0] ? { id: photos[0].id, crop: null } : null;
}

/**
 * What a browse tile shows for this event.
 *
 * When the cover is a VIDEO the tile plays it, silent and looping — that is
 * what makes the feed feel alive. But a listing photo outranks it: an organizer
 * who deliberately picked a still for the browse page gets that still, and
 * their video still plays at the top of the event page where it was chosen for.
 */
export function listingTileMedia(event: EventRow, preloaded?: EventMediaRow[]): ListingTileMedia {
  // A listing page has already read every row's photos in one query; anywhere
  // else this falls back to reading them here, so a single-tile caller keeps
  // its one-argument contract.
  const photos = preloaded ?? getEventMedia(event.id); // photos only — videos are excluded
  const isPhoto = (id: string | null): id is string => !!id && photos.some((p) => p.id === id);

  const still = listingStill(event, photos);
  // A cover id that is not one of the photos is the event's video cover.
  const coverIsVideo = Boolean(event.coverMediaId) && !isPhoto(event.coverMediaId);
  const hasListingPhoto = isPhoto(event.posterMediaId);

  return {
    videoUrl: coverIsVideo && !hasListingPhoto ? mediaUrl(event.coverMediaId as string) : null,
    stillUrl: still ? mediaUrl(still.id, 'card', still.crop) : null,
  };
}

/**
 * The same picture as a plain still, for places that cannot play video — the
 * organizer's dashboard row. Sharing this with the feed is the point: the
 * organizer must see the tile buyers see, not a second guess at it.
 */
export function listingStillUrl(event: EventRow, preloaded?: EventMediaRow[]): string | null {
  const still = listingStill(event, preloaded ?? getEventMedia(event.id));
  return still ? mediaUrl(still.id, 'card', still.crop) : null;
}

/**
 * The picture that represents this listing everywhere OFF-site: Google,
 * WhatsApp, Facebook, Viber. Uses the SAME cover the page itself opens with,
 * including the organizer's own crop, so the link preview and the page agree.
 *
 * 1200x630 is the size every social platform crops to; the 'cover' variant is
 * 1600x740, close enough in shape that nothing important is lost and far better
 * than shipping a 7 MB original that Facebook would reject for size.
 *
 * Videos are skipped: a link preview must be a still. A listing whose cover is a
 * video falls through to its poster or first photo, and if it has no picture at
 * all it gets no og:image rather than a broken one.
 *
 * Lives here rather than on the event page because the item page needs the same
 * fallback: an item with no photo of its own shares its shop's picture, and two
 * copies of this preference order would eventually disagree about which one.
 */
export function socialImageUrl(event: EventRow): string | null {
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
