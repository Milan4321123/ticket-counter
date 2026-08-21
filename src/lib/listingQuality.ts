// What would make this shop sell better — advice, never a gate.
//
// There is already a checklist in lib/events (listingDetailChecks), and it is
// a different thing on purpose: that one is the PUBLISH GATE, the short list of
// facts without which a listing would mislead somebody — a name, a way to be
// paid, how to collect. Failing it stops publishing.
//
// This is the other half. A shop can pass every one of those checks and still
// arrive in the bazaar as a wall of grey initials with no shelf, no town and
// nothing to read — and that shop will not sell, while its seller has no idea
// why. Nothing here blocks anything. It is the difference between "you cannot
// publish this" and "here is why nobody is buying", which is the question a
// seller actually has after week one.
//
// Two rules kept it honest while it was written:
//
//   1. Every hint names a CONSEQUENCE, not a preference. Not "add a photo" but
//      "seven of your items show a letter instead of a picture in the bazaar
//      grid". A seller who is told what a shopper sees can decide for
//      themselves; a seller who is told to fill in a box just feels nagged.
//   2. Nothing is invented. Each hint is computed from the same data the
//      public pages render from, so it cannot advise about a problem the
//      bazaar does not actually have.
//
// Server-only in practice (it reads rows), but it imports nothing that is —
// the caller passes the rows in, which is what makes it testable.
import { categoryLabel, isShopCategory } from './categories';
import type { EventMediaRow, EventRow, EventTierRow } from './events';
import { tierPhoto } from './events';
import { visibleTiers } from './ticketState';

export interface QualityHint {
  /** Stable id, so a hint can be dismissed or tested by name. */
  key: string;
  /** What to do, imperative and short. */
  label: string;
  /** What a shopper sees today because it is not done. One sentence. */
  why: string;
  /** Which tab of the editor fixes it — the panel links straight there. */
  tab: 'details' | 'items' | 'media';
}

/**
 * How this shop is doing, worst first.
 *
 * SHOPS ONLY. An event is found by its date and its festival pages; none of
 * the advice below — shelves, item photos, towns — is about how an event gets
 * discovered, and inventing an event version of this would be advice made up
 * to fill a panel.
 *
 * Returns [] for a shop that is doing everything, and the panel that renders
 * this says so rather than drawing an empty box.
 */
export function shopQualityHints(
  shop: EventRow,
  tiers: EventTierRow[],
  photos: EventMediaRow[]
): QualityHint[] {
  if (shop.kind !== 'shop') return [];

  const hints: QualityHint[] = [];
  const selling = visibleTiers(tiers);
  const n = selling.length;

  // ---- the shelf: without one, the shop is off six pages ------------------
  if (!isShopCategory(shop.category)) {
    hints.push({
      key: 'no-shelf',
      label: 'Pick the shelf your shop belongs on',
      why:
        'Without one your shop is filed under "More from the bazaar" at the bottom of /market, ' +
        'it is missing from its own department page, and a shopper filtering by shelf never sees it.',
      tab: 'details',
    });
  }

  // ---- photographs: the single thing a grid of goods is made of -----------
  const photoless = selling.filter((t) => !tierPhoto(t, photos));
  if (photoless.length > 0) {
    hints.push({
      key: 'items-without-photos',
      label:
        photoless.length === n
          ? 'Add a photo to your items'
          : `Add a photo to ${photoless.length} of your items`,
      why:
        photoless.length === n
          ? 'Every one of your items shows a letter on a coloured square instead of a picture, ' +
            'in a grid where everything around it is a photograph of food.'
          : `${photoless.length} of your ${n} items show a letter instead of a picture: ` +
            photoless
              .slice(0, 3)
              .map((t) => `"${t.name}"`)
              .join(', ') +
            (photoless.length > 3 ? ' and others.' : '.'),
      tab: 'items',
    });
  }

  // ---- the write-up: what sells something nobody can smell -----------------
  const undescribed = selling.filter((t) => !t.details.trim());
  if (undescribed.length > 0) {
    hints.push({
      key: 'items-without-detail',
      label:
        undescribed.length === n
          ? 'Write a few lines about each item'
          : `Write a few lines about ${undescribed.length} of your items`,
      why:
        'Their pages show a price and a button and nothing to read. This is where a spice ' +
        'nobody can smell through a screen is actually sold — where it came from, how much ' +
        'to use, what it is like.',
      tab: 'items',
    });
  }

  // ---- the town: a whole way of finding a shop ----------------------------
  if (!shop.city.trim()) {
    hints.push({
      key: 'no-town',
      label: 'Add your town',
      why:
        'Buyers filter the bazaar by town and the front page has a row for each one. ' +
        'Nobody searching their own city can find you, and your tiles say nothing about ' +
        'how far your collection point is.',
      tab: 'details',
    });
  }

  // ---- the shop's own picture ---------------------------------------------
  if (!shop.coverMediaId && !shop.posterMediaId && photos.length === 0) {
    hints.push({
      key: 'no-cover',
      label: 'Add a picture of your shop',
      why:
        'Your tile in the bazaar and the card that appears when somebody shares your shop ' +
        'in a WhatsApp group both have no picture in them.',
      tab: 'media',
    });
  }

  // ---- one lonely item -----------------------------------------------------
  if (n === 1) {
    hints.push({
      key: 'single-item',
      label: 'Add a second thing to sell',
      why:
        'A shopper who opens your shop sees one item and no reason to look further. ' +
        'Shops with a few sizes or a small gift box get browsed for longer.',
      tab: 'items',
    });
  }

  return hints;
}

/** One line for the tab badge: how many hints, or '' when there are none. */
export function qualitySummary(hints: QualityHint[], shop: EventRow): string {
  if (hints.length === 0) {
    const shelf = categoryLabel(shop.category);
    return shelf
      ? `Your shop is set up well and filed under ${shelf}.`
      : 'Your shop is set up well.';
  }
  return hints.length === 1
    ? 'One thing would make your shop easier to buy from.'
    : `${hints.length} things would make your shop easier to buy from.`;
}
