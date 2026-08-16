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
import type { EventRow } from './events';

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
    return { id: event.coverMediaId, crop: cropTag(parseCropRect(event.coverCrop)) };
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
export function listingTileMedia(event: EventRow): ListingTileMedia {
  const photos = getEventMedia(event.id); // photos only — videos are excluded
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
export function listingStillUrl(event: EventRow): string | null {
  const still = listingStill(event, getEventMedia(event.id));
  return still ? mediaUrl(still.id, 'card', still.crop) : null;
}
