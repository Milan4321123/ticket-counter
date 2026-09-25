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
  example?: boolean;
}

export function basketLineFor(
  event: EventRow,
  tier: EventTierRow,
  seller: string,
  image: string | null
): BasketLineData | null {
  const example = readListingName(event.name).isExample;
  if (event.isDemo || event.status !== 'published') return null;
  if (!example && !event.salesOpen) return null;
  if (tier.priceCents <= 0 || tier.seatsPerUnit > 1) return null;
  if (!example && tier.status !== 'on-sale') return null;
  // The site's example shops take no money at all; they may sit in a basket
  // (clearly marked) so a visitor can see how one works, and are never ordered.
  if (!example && !paymentOptionsFor(event).transfer) return null;
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
    ...(example ? { example: true } : {}),
  };
}
