// Server-only: which things can go in the cross-seller basket.
//
// The basket checks out by placing one ordinary bank-transfer order per
// seller through POST /api/orders, with nothing but quantities — so a listing
// whose checkout needs anything more (a collection time, a seat on the map, a
// spice choice) or whose seller takes no transfers is bought on its own page.
import type { EventRow, EventTierRow } from './events';
import { parseChoices, parseSlotConfig } from './kitchen';
import { paymentOptionsFor } from './paymentConnections';
import { parseSeatMap } from './seats';
import { readListingName } from './exampleShop';

export interface BasketLineData {
  key: string;
  eventId: string;
  slug: string;
  tierKey: string;
  name: string;
  priceCents: number;
  currency: string;
  max: number;
  seller: string;
  listing: string;
  kind: 'event' | 'shop';
  image: string | null;
}

export function basketLineFor(
  event: EventRow,
  tier: EventTierRow,
  seller: string,
  image: string | null
): BasketLineData | null {
  if (event.isDemo || event.status !== 'published' || !event.salesOpen) return null;
  if (tier.status !== 'on-sale' || tier.priceCents <= 0 || tier.seatsPerUnit > 1) return null;
  if (!paymentOptionsFor(event).transfer) return null;
  if (event.kind === 'shop' && parseSlotConfig(event.pickupSlots).enabled) return null;
  if (event.kind === 'event' && parseSeatMap(event.seatMap)?.enabled) return null;
  if (parseChoices(tier.choices).length > 0) return null;
  return {
    key: `${event.id}:${tier.tierKey}`,
    eventId: event.id,
    slug: event.slug,
    tierKey: tier.tierKey,
    name: tier.name,
    priceCents: tier.priceCents,
    currency: event.currency,
    max: event.maxPerOrder,
    seller,
    listing: readListingName(event.name).name,
    kind: event.kind,
    image,
  };
}
