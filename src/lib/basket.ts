// Server-only: which things can go in the cross-seller basket.
//
// The basket checks out by placing one ordinary bank-transfer order per
// seller through POST /api/orders, with nothing but quantities — so a listing
// whose checkout needs anything more (a collection time, a seat on the map, a
// spice choice) or whose seller takes no transfers is bought on its own page.
import crypto from 'crypto';
import { getDb } from './db';
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
  /** The seller takes cards instantly on their own Stripe account. */
  card?: boolean;
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
    ...(!example && paymentOptionsFor(event).stripe ? { card: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Basket runs: one checkout of the basket = one run, holding the orders it
// placed, so the payments page (and a buyer coming back from a seller's card
// page) finds them all. The id is random and long — whoever holds it is the
// buyer who made the run, exactly as with an order id.
// ---------------------------------------------------------------------------
export const BASKET_RUN_RE = /^[A-Za-z0-9_-]{24,64}$/;

export function createBasketRun(): string {
  const id = crypto.randomBytes(24).toString('base64url');
  getDb().prepare(`INSERT INTO basket_runs (id) VALUES (?)`).run(id);
  return id;
}

export function basketRunOrderIds(runId: string): string[] | null {
  if (!BASKET_RUN_RE.test(runId)) return null;
  const row = getDb().prepare(`SELECT order_ids AS ids FROM basket_runs WHERE id = ?`).get(runId) as { ids: string } | undefined;
  if (!row) return null;
  try {
    const ids = JSON.parse(row.ids);
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Add an order to a run; false when the run does not exist or is full. */
export function addOrderToBasketRun(runId: string, orderId: string): boolean {
  const ids = basketRunOrderIds(runId);
  if (!ids || ids.length >= 20) return false;
  if (!ids.includes(orderId)) ids.push(orderId);
  getDb().prepare(`UPDATE basket_runs SET order_ids = ? WHERE id = ?`).run(JSON.stringify(ids), runId);
  return true;
}

/** Where a card payment made from a basket run sends the buyer back to. */
export function basketRunPath(runId: string): string {
  return `/basket/done?run=${runId}`;
}
