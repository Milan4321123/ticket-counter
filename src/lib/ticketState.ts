// Server-only: the ONE answer to "can a buyer get a ticket for this event right
// now, and what should the button say".
//
// It exists because four surfaces were each deciding this for themselves — the
// feed card, the billboard, the event page hero and the checkout — and they
// disagreed. Each had its own version of the same conditional, and each got a
// different part of it wrong:
//
//   - "sold out" was read from the ROOM rather than the tickets. Tier caps do
//     not have to add up to the event's capacity, so every ticket type could be
//     exhausted while the venue still had space, and the page went on offering a
//     Get tickets button into a checkout where nothing could be selected.
//   - hiding the countdown was treated as "never sells out". The organizer's
//     choice not to publish a number was checked BEFORE the number, so an event
//     with the countdown off — the recommended setting for early-bird pricing —
//     advertised tickets after selling out completely.
//   - the buttons never moved. "Get tickets · from €39.99" stayed exactly the
//     same when the event sold out, when sales were paused, and when nothing was
//     on sale yet.
//
// One function now, so the badge, the button and the checkout cannot drift apart
// again. Adding a new surface means calling this rather than rewriting it.
import type { EventRow, EventTierRow } from './events';
import type { Availability } from './inventory';

export type TicketStateKind =
  /** Buyable now. */
  | 'on-sale'
  /** Announced, nothing on sale yet — every ticket type is marked coming soon. */
  | 'coming-soon'
  /** Everything that was on sale has gone. */
  | 'sold-out'
  /** The organizer paused sales without unpublishing. */
  | 'closed'
  /** The event has been and gone. */
  | 'past';

export interface TicketState {
  kind: TicketStateKind;
  /** True only when a buyer can actually complete a purchase. */
  buyable: boolean;
  /** How many tickets can genuinely be bought — never more than the room. */
  remaining: number;
  /** Short label for a badge: "Sold out", "Coming soon", … */
  badge: string;
  /** Label for the call-to-action button. */
  cta: string;
  /** Whether a countdown may be shown. Off when the organizer hid it. */
  showCount: boolean;
  /**
   * Ticket types announced but not yet on sale. A card whose event is otherwise
   * on sale still needs to say a VIP table is coming — that announcement is the
   * whole reason the organizer ticked the box, and a listing that swallows it
   * makes the feature invisible everywhere except the event page.
   */
  upcoming: number;
}

/**
 * Work out the state from the event, its ticket types and live availability.
 *
 * `past` is passed in rather than derived, because "has this event happened" is
 * decided differently by the feed (which sorts by date) and by the event page
 * (which still renders for someone holding a link).
 */
export function ticketState(
  event: EventRow,
  tiers: EventTierRow[],
  availability: Availability,
  opts: { past?: boolean } = {}
): TicketState {
  const showCount = availability.showRemaining;

  // Only tiers that are actually for sale count as stock. A tier that is merely
  // announced is not inventory, and counting it would make an event whose whole
  // line-up is "coming soon" look like it was on sale.
  const sellable = tiers.filter((t) => !t.comingSoon);
  const upcoming = tiers.length - sellable.length;

  // Each tier's remaining is already clamped to the room by getAvailability, so
  // summing several can overshoot when they are clamped to the same headroom —
  // hence the final min against the room itself.
  const remaining = Math.min(
    availability.totalRemaining,
    sellable.reduce((n, t) => n + Math.max(0, availability.tiers[t.tierKey]?.remaining ?? 0), 0)
  );

  if (opts.past) {
    return { kind: 'past', buyable: false, remaining: 0, badge: 'Finished', cta: 'See page', showCount, upcoming };
  }
  if (!event.salesOpen) {
    return { kind: 'closed', buyable: false, remaining, badge: 'Sales closed', cta: 'Sales closed', showCount, upcoming };
  }
  // Announced-but-not-yet-selling is checked BEFORE sold out: an event where
  // nothing has gone on sale has not sold out, and saying so would be a lie that
  // costs the organizer the audience they were building.
  if (tiers.length > 0 && sellable.length === 0) {
    return { kind: 'coming-soon', buyable: false, remaining: 0, badge: 'Coming soon', cta: 'Coming soon', showCount, upcoming };
  }
  if (remaining === 0) {
    return { kind: 'sold-out', buyable: false, remaining: 0, badge: 'Sold out', cta: 'Sold out', showCount, upcoming };
  }
  return {
    kind: 'on-sale',
    buyable: true,
    remaining,
    badge: showCount && remaining <= 50 ? `Only ${remaining} left` : 'Tickets available',
    cta: 'Get tickets',
    showCount,
    upcoming,
  };
}

/**
 * The "from €x" headline price.
 *
 * Only ticket types someone can actually buy count towards it. A coming-soon
 * type is usually the cheap teaser — an early-bird announced at €20 next to a
 * €50 door ticket — so counting it advertised a price that no button on the
 * page could reach. When NOTHING is on sale yet, the announced prices are all
 * there is, and showing them is the point of announcing.
 */
export function fromPriceCents(tiers: EventTierRow[]): number | null {
  const sellable = tiers.filter((t) => !t.comingSoon);
  const upcoming = tiers.length - sellable.length;
  const pool = sellable.length ? sellable : tiers;
  return pool.length ? Math.min(...pool.map((t) => t.priceCents)) : null;
}
