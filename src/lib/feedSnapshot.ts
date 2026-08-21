// Server-only: everything a LISTING of events needs about them, read once.
//
// A feed tile is a self-contained server component — hand it an event row and
// it works out its own prices, availability and picture. That is the right
// shape for one tile and the wrong one for forty: each tile then issued five
// statements about rows the page was already holding, so the homepage cost
// 6.5 statements per published event and grew with the platform (measured:
// 96 statements for 12 events, 411 for 60).
//
// This reads the same three tables ONCE for the whole page and hands the tiles
// a lookup. It is deliberately NOT a cache: it lives for one render of one
// request, so a force-dynamic listing keeps showing live availability — the
// property the whole feed is force-dynamic for. Nothing here outlives the
// response it was built for, so there is no invalidation story to get wrong.
import { getEventMediaBulk, getEventTiersBulk } from './events';
import type { EventMediaRow, EventRow, EventTierRow } from './events';
import { getAvailabilityBulk } from './inventory';
import type { Availability } from './inventory';

export interface FeedSnapshot {
  tiers: Map<string, EventTierRow[]>;
  /** Photos only, in gallery order — the tile picture is resolved from these. */
  photos: Map<string, EventMediaRow[]>;
  availability: Map<string, Availability>;
}

/** Three statements for a whole listing, however many events are on it. */
export function loadFeedSnapshot(events: EventRow[]): FeedSnapshot {
  const ids = events.map((e) => e.id);
  const tiers = getEventTiersBulk(ids);
  return {
    tiers,
    photos: getEventMediaBulk(ids),
    availability: getAvailabilityBulk(events, tiers),
  };
}
