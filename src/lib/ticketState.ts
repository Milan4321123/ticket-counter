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
import { vocabFor } from './vocab';

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
  /**
   * How many SEATS can genuinely still be bought — never more than the room.
   * In seats, not bookings, because that is what every "Only N left" surface
   * means to a visitor: a bundled tier's one remaining table counts as eight.
   */
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
  /**
   * The announced types by name, in page order.
   *
   * A bare "Coming soon" beside a bare "Sold out" tells a visitor that
   * SOMETHING is gone and SOMETHING is coming, and leaves them to guess which —
   * on an event with an early bird, a standard and a student ticket that is
   * three guesses. The names are here so a badge can say "Standard coming soon".
   */
  upcomingNames: string[];
  /** On-sale types with nothing left, by name — same reason. */
  soldOutNames: string[];
}

/**
 * "Standard coming soon", or "2 more coming soon" when there is more than one.
 *
 * Naming every type would overflow a 216px feed tile, and the event page lists
 * them all a screen below anyway — so one gets named and several get counted.
 */
export function comingSoonLabel(state: TicketState): string | null {
  if (state.upcomingNames.length === 0) return null;
  if (state.upcomingNames.length === 1) return `${state.upcomingNames[0]} coming soon`;
  return `${state.upcomingNames.length} more coming soon`;
}

/** Ticket types a visitor should see at all — 'hidden' is off the page. */
export function visibleTiers(tiers: EventTierRow[]): EventTierRow[] {
  return tiers.filter((t) => t.status !== 'hidden');
}

/**
 * Nothing is on sale, but something has been announced.
 *
 * Read from the TICKETS and nothing else. It used to also consult an event-wide
 * "what a pause says" setting, which overrode every ticket type at once: an
 * organizer who set one type to coming-soon and left another on sale watched
 * both go green, with no way to tell which control had won. Coming soon is a
 * property of a ticket now, and only of a ticket.
 *
 * Exported so a refusal from the orders API cannot contradict the badge the
 * buyer was looking at when they pressed the button.
 */
export function readsAsComingSoon(tiers: EventTierRow[]): boolean {
  const visible = visibleTiers(tiers);
  return visible.length > 0 && !visible.some((t) => t.status === 'on-sale');
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
  // line-up is "coming soon" look like it was on sale. Hidden types are not on
  // the page at all, so they count for nothing either way.
  const visible = visibleTiers(tiers);
  const sellable = visible.filter((t) => t.status === 'on-sale');
  const announced = visible.filter((t) => t.status === 'coming-soon');
  const upcoming = announced.length;
  const upcomingNames = announced.map((t) => t.name);
  const left = (t: EventTierRow) => Math.max(0, availability.tiers[t.tierKey]?.remaining ?? 0);
  const soldOutNames = sellable.filter((t) => left(t) === 0).map((t) => t.name);
  /**
   * Nothing has been offered for sale yet.
   *
   * Covers an event with no visible ticket types at all, not only one whose
   * every type is announced. Guarding this on a non-empty list sent a half-built
   * event down the sold-out branch — the empty reduce below makes `remaining` 0
   * — so an organizer previewing a page they had not added tickets to yet was
   * told it had sold out.
   */
  const nothingOnSaleYet = sellable.length === 0;

  // In SEATS on both sides of the min: a tier's remaining counts BOOKINGS of
  // it, so each one is weighted by its seatsPerUnit before it can be compared
  // with (or capped by) the room. Each tier's remaining is already clamped to
  // the room by getAvailability, so summing several can overshoot when they
  // are clamped to the same headroom — hence the final min against the room
  // itself.
  const remaining = Math.min(
    availability.totalRemaining,
    sellable.reduce((n, t) => {
      const a = availability.tiers[t.tierKey];
      return n + Math.max(0, a?.remaining ?? 0) * (a?.seatsPerUnit ?? 1);
    }, 0)
  );

  if (opts.past) {
    return { kind: 'past', buyable: false, remaining: 0, badge: 'Finished', cta: 'See page', showCount, upcoming, upcomingNames, soldOutNames };
  }
  // Announced-but-not-yet-selling is checked before BOTH the pause and sold out.
  //
  // Before sold out, because an event where nothing has gone on sale has not
  // sold out, and saying so costs the organizer the audience they were building.
  // Before the pause, because a pause is the organizer stopping sales — and
  // there is nothing to stop when no ticket type was on sale in the first place.
  // The count is dropped: what is sitting unsold is not "left", it was never
  // offered.
  if (nothingOnSaleYet) {
    return { kind: 'coming-soon', buyable: false, remaining: 0, badge: 'Coming soon', cta: 'Coming soon', showCount, upcoming, upcomingNames, soldOutNames };
  }
  if (!event.salesOpen) {
    return { kind: 'closed', buyable: false, remaining, badge: 'Sales closed', cta: 'Sales closed', showCount, upcoming, upcomingNames, soldOutNames };
  }
  if (remaining === 0) {
    // Named only when there was exactly ONE type to sell. With two both gone,
    // naming one of them would be picking a winner out of a tie.
    const badge = soldOutNames.length === 1 ? `${soldOutNames[0]} sold out` : 'Sold out';
    return {
      kind: 'sold-out',
      buyable: false,
      remaining: 0,
      badge,
      // The button stays short: it is a control, not a sentence.
      cta: 'Sold out',
      showCount,
      upcoming,
      upcomingNames,
      soldOutNames,
    };
  }
  // The only two labels a shop says differently — the rest ("Sold out",
  // "Sales closed", "Coming soon") read correctly for anything on sale.
  const v = vocabFor(event.kind);
  return {
    kind: 'on-sale',
    buyable: true,
    remaining,
    badge: showCount && remaining <= 50 ? `Only ${remaining} left` : `${v.Units} available`,
    cta: v.cta,
    showCount,
    upcoming,
    upcomingNames,
    soldOutNames,
  };
}

/**
 * The "from €x" headline price — the cheapest price the badge beside it is
 * actually talking about.
 *
 * Three tiers of preference, and the order is the whole point:
 *
 *  1. What can be bought right now. A coming-soon type is usually the cheap
 *     teaser — an early bird announced at €20 next to a €50 door ticket — so
 *     counting it would advertise a price no button on the page can reach.
 *  2. Failing that, what is coming. When the early bird has SOLD OUT and only
 *     the €50 standard is still to come, the page said "Coming soon · from
 *     €39.99" — the price of the one thing nobody can have. The badge and the
 *     price have to describe the same ticket.
 *  3. Failing that, any price at all, so an event whose sales are simply paused
 *     still says what it costs.
 *
 * `availability` is optional: a caller that has not loaded it still gets the
 * coming-soon/on-sale split right, just without the sold-out step.
 */
export function fromPriceCents(tiers: EventTierRow[], availability?: Availability): number | null {
  const cheapest = (rows: EventTierRow[]) =>
    rows.length ? Math.min(...rows.map((t) => t.priceCents)) : null;
  const hasStock = (t: EventTierRow) =>
    !availability || (availability.tiers[t.tierKey]?.remaining ?? 0) > 0;

  const visible = visibleTiers(tiers);
  const onSale = visible.filter((t) => t.status === 'on-sale' && hasStock(t));
  const announced = visible.filter((t) => t.status === 'coming-soon');
  return cheapest(onSale) ?? cheapest(announced) ?? cheapest(visible);
}
