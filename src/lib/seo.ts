import { platformNameFromEnv } from './platform';
// Everything Google needs to find this site, understand it, and show it well.
//
// Three separate jobs live here, and they are easy to confuse:
//
//  1. METADATA — the <title>, the description, and the Open Graph tags that
//     decide what a link looks like when it is pasted into WhatsApp, Facebook
//     or Viber. This is most of what "SEO" means day to day.
//  2. STRUCTURED DATA — JSON-LD describing an event in Schema.org's vocabulary.
//     This is what earns the rich result: the date, venue and "from EUR 15"
//     shown directly in Google's results instead of a plain blue link. For a
//     ticketing site it is by far the highest-value thing on this page.
//  3. CRAWL CONTROL — sitemap.ts and robots.ts (their own files) telling Google
//     which pages exist and which are none of its business.
//
// The rule running through all of it: never claim anything the database cannot
// prove. A confident lie in structured data is worse than an omission — Google
// checks the page against the claim, and a mismatch costs the rich result on
// every event, not just the one that lied.
import { getBaseUrl, getPaymentMode } from './config';
import { paypalPayee } from './events';
import type { EventRow, EventTierRow } from './events';
import { effectivePayout } from './payout';
import { readsAsComingSoon } from './ticketState';

export const SITE_NAME = platformNameFromEnv();

/**
 * The one-line pitch, used wherever nothing more specific exists. Written for a
 * human reading a search result, not stuffed with keywords — Google has scored
 * keyword stuffing as spam for over a decade, and the phrases people actually
 * type ("nepali concert berlin", "nepali cultural night tickets") are already
 * here because they are what the site genuinely is.
 */
export const SITE_DESCRIPTION =
  'Nepali concerts, cultural nights, festivals and community events across Europe, plus a bazaar of Nepali sellers — momo, sweets, crafts. Reserve or order in one click, pay the organizer or seller directly, and your QR tickets or collection codes arrive by email.';

/**
 * Country for venue addresses in structured data, as an ISO code.
 *
 * Guessing this per-event is not possible — the editor collects a city and a
 * street, never a country. Defaulted rather than omitted because Google treats
 * an address without a country as incomplete, and every organizer on the
 * platform today collects money by IBAN/Überweisung, which is Germany and its
 * neighbours. Override with PLATFORM_COUNTRY when that stops being true.
 */
const PLATFORM_COUNTRY = process.env.PLATFORM_COUNTRY || 'DE';

/** An absolute https URL. Required by Open Graph and JSON-LD — both reject paths. */
export function absoluteUrl(path: string): string {
  const base = getBaseUrl();
  if (!path) return base;
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

/**
 * Squash text into a clean, bounded meta description.
 *
 * Descriptions are pulled from whatever the organizer typed, which may be
 * hundreds of words with newlines and markdown-ish punctuation. Google rewrites
 * anything past ~160 characters anyway, so cut at a word boundary rather than
 * shipping a paragraph that gets truncated mid-word in the result.
 */
export function metaText(input: string, limit = 155): string {
  const flat = input.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`;
}

/**
 * The sentence that describes an event in a search result.
 *
 * Built from the fields rather than the organizer's prose, because the fields
 * are the part a searcher is actually matching on — the event name, when, and
 * where. The organizer's own description is appended only if there is room
 * left, so a page whose description is empty still reads like a real listing.
 */
export function eventDescription(event: EventRow): string {
  const where = [event.venueName, event.city].filter((s) => s.trim()).join(', ');
  const parts = [
    event.artist.trim() ? `${event.name} with ${event.artist.trim()}` : event.name,
    event.dateDisplay.trim(),
    where,
  ].filter(Boolean);
  const lead = `${parts.join(' · ')}. Book tickets online and get your QR tickets by email.`;
  const extra = event.description.replace(/\s+/g, ' ').trim();
  return metaText(extra ? `${lead} ${extra}` : lead);
}

/**
 * A date Schema.org will accept, or null.
 *
 * ONLY the machine column is trusted. dateDisplay is free text an organizer
 * types by hand — it holds things like "Saturday, October 17, 2026", but also
 * "Doors 6pm, show 7" and, on one live event right now, pure keyboard mash.
 * Parsing it would produce a startDate that is confidently wrong on some
 * fraction of events, and a wrong date in structured data is exactly the kind
 * of mismatch that gets rich results withdrawn site-wide.
 *
 * The cost of returning null is visible and fixable: no rich result for that
 * event until someone sets a real date in the editor.
 */
export function machineDate(event: EventRow): string | null {
  const raw = event.eventDate?.trim();
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/**
 * Can a buyer actually pay for something on this listing?
 *
 * The same question POST /api/orders asks, in the same words, because the
 * answer has to match: `mode === 'transfer' && !hasBankRoute && !hasPaypalRoute`
 * is the branch that refuses the order, and effectivePayout() (not the raw
 * columns) is what that branch reads, so a payout change still inside its
 * waiting period is not counted as an account yet.
 *
 * In any other payment mode the platform's own credentials take the money, so a
 * listing with no payout route of its own is still perfectly orderable — the
 * seller simply has no way to be paid afterwards. That is a different problem
 * and not one structured data should be lying about in either direction.
 */
export function canTakePaidOrders(event: EventRow): boolean {
  if (getPaymentMode() !== 'transfer') return true;
  const payout = effectivePayout(event);
  const hasBankRoute = Boolean(payout.iban.trim() && payout.holder.trim());
  const hasPaypalRoute = paypalPayee({ paypalAccount: payout.paypal }) !== null;
  return hasBankRoute || hasPaypalRoute;
}

/**
 * The Schema.org availability of ONE ticket type, in one place.
 *
 * Shared by the event's Offer list and the item page's Product offer, because
 * the two describe the same row: an item page that said InStock while the
 * listing said SoldOut would be exactly the mismatch the note at the top of
 * this file warns about, and would be found by the crawler that fetches both
 * within a second of each other.
 */
function offerAvailability(
  event: EventRow,
  tiers: EventTierRow[],
  tier: EventTierRow,
  remaining: number,
  totalRemaining: number
): string {
  // An event that has not opened yet is not sold out, and marking it so tells
  // Google to stop advertising tickets that were never offered. PreOrder is the
  // state Google documents for "announced, not yet purchasable" — it keeps the
  // listing alive without promising a checkout.
  if (tier.status === 'coming-soon' || (!event.salesOpen && readsAsComingSoon(tiers))) {
    return 'https://schema.org/PreOrder';
  }
  if (!event.salesOpen || totalRemaining === 0 || remaining === 0) {
    return 'https://schema.org/SoldOut';
  }
  return 'https://schema.org/InStock';
}

export interface EventJsonLdInput {
  event: EventRow;
  tiers: EventTierRow[];
  /** Remaining seats per tier_key, from getAvailability(). */
  remainingByTier: Record<string, number>;
  totalRemaining: number;
  /** Absolute image URLs, best first. */
  images: string[];
  organizerName: string;
}

/**
 * Schema.org Event for a published event page.
 *
 * This is the piece that turns a blue link into a result with the date, the
 * venue and a price on it. Every field is conditional on the data existing —
 * see machineDate() for why an event with no real date gets no startDate rather
 * than a guessed one.
 */
export function eventJsonLd({
  event,
  tiers,
  remainingByTier,
  totalRemaining,
  images,
  organizerName,
}: EventJsonLdInput): Record<string, unknown> {
  const url = absoluteUrl(`/e/${event.slug}`);
  const startDate = machineDate(event);
  const venue = event.venueName.trim();
  const city = event.city.trim();
  const street = event.address.trim();

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    // MusicEvent rather than plain Event: these are concerts and cultural
    // nights, and the more specific type is what Google matches music-intent
    // searches against.
    '@type': 'MusicEvent',
    name: event.name,
    description: eventDescription(event),
    url,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    organizer: { '@type': 'Organization', name: organizerName, url: getBaseUrl() },
  };

  if (startDate) data.startDate = startDate;
  if (images.length) data.image = images;
  if (event.artist.trim()) {
    data.performer = { '@type': 'PerformingGroup', name: event.artist.trim() };
  }

  // A Place with no name and no address says nothing; omit it entirely rather
  // than emit an empty shell Google will flag as an error.
  if (venue || city || street) {
    const address: Record<string, string> = { '@type': 'PostalAddress' };
    if (street) address.streetAddress = street;
    if (city) address.addressLocality = city;
    address.addressCountry = PLATFORM_COUNTRY;
    data.location = {
      '@type': 'Place',
      name: venue || city || event.name,
      address,
    };
  }

  // One Offer per ticket type, so Google can show a real "from" price. Sold-out
  // tiers stay in the list marked SoldOut — dropping them would make a sold-out
  // event look merely priceless, and the marked-up state is what lets Google
  // stop advertising tickets nobody can buy.
  //
  // A PRICED tier on a listing with no payout route is a different case, and it
  // gets no Offer at all. Checkout on such a listing refuses every order at the
  // last step, so an Offer would be advertising a price nobody can pay — and
  // there is no availability value that says so honestly. SoldOut is false
  // (nothing is sold), PreOrder promises a checkout that opens later and none
  // is scheduled, and InStock, which is what this used to emit for every
  // published listing, is the outright lie. So the offer is omitted, exactly as
  // machineDate() returns null rather than a guessed date and location is
  // dropped rather than emitted as an empty shell: the rule at the top of this
  // file is that a confident lie in structured data costs the rich result on
  // EVERY listing on the domain, not just the one that lied.
  //
  // Free tiers survive the filter: a €0 booking never reaches the payout guard
  // (see `isFree` in POST /api/orders), so it really can be reserved.
  const offerableTiers = canTakePaidOrders(event) ? tiers : tiers.filter((t) => t.priceCents === 0);
  if (offerableTiers.length) {
    data.offers = offerableTiers.map((tier) => ({
      '@type': 'Offer',
      name: tier.name,
      price: (tier.priceCents / 100).toFixed(2),
      priceCurrency: event.currency,
      url,
      availability: offerAvailability(
        event,
        tiers,
        tier,
        remainingByTier[tier.tierKey] ?? 0,
        totalRemaining
      ),
    }));
  }

  return data;
}

/** Home > Event, so Google shows a breadcrumb trail instead of a bare URL. */
export function eventBreadcrumbJsonLd(event: EventRow): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Events', item: getBaseUrl() },
      { '@type': 'ListItem', position: 2, name: event.name, item: absoluteUrl(`/e/${event.slug}`) },
    ],
  };
}

export interface ItemJsonLdInput {
  event: EventRow;
  /** Every visible tier — the pause/coming-soon rule reads the whole set. */
  tiers: EventTierRow[];
  /** The one this page is about. */
  tier: EventTierRow;
  /** Remaining units of THIS tier, from getAvailability(). */
  remaining: number;
  totalRemaining: number;
  /** Absolute image URLs, best first. */
  images: string[];
  /** The person selling it — the disclosed seller, never the platform. */
  sellerName: string;
  /** This item page's own canonical URL. */
  url: string;
}

/**
 * Schema.org Product for one item's page.
 *
 * Product, not Event: this page is about a THING with a price and a picture,
 * and on a shop it genuinely is a product. On an event it is a ticket, which
 * Schema.org also models as a Product with an Offer — the parent MusicEvent
 * with its date and venue stays on the listing page, where it belongs, so the
 * two pages describe different entities instead of competing for the same one.
 *
 * seller is the ORGANIZER. That is the same disclosed-seller posture the page
 * body takes ("Sold by …"): the money goes to their account, they hand the
 * goods over, and structured data naming this platform as the seller would
 * contradict the sentence printed beside the button.
 *
 * The Offer is CONDITIONAL, exactly as it is in eventJsonLd — see the long
 * note there. A priced item on a listing with no payout route cannot be
 * ordered at all (POST /api/orders refuses it), and there is no availability
 * value that says "priced, but unpayable" honestly, so it gets no Offer. A
 * free item survives, because a €0 booking never reaches the payout guard.
 * A Product with no offers is still valid and still earns the picture and the
 * name in a result; a Product with a fictional offer costs the rich result on
 * every listing on the domain.
 */
export function itemJsonLd({
  event,
  tiers,
  tier,
  remaining,
  totalRemaining,
  images,
  sellerName,
  url,
}: ItemJsonLdInput): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: tier.name,
    description: itemDescription(event, tier),
    url,
  };
  if (images.length) data.image = images;

  const offerable = canTakePaidOrders(event) || tier.priceCents === 0;
  if (offerable) {
    data.offers = {
      '@type': 'Offer',
      price: (tier.priceCents / 100).toFixed(2),
      priceCurrency: event.currency,
      url,
      availability: offerAvailability(event, tiers, tier, remaining, totalRemaining),
      seller: { '@type': 'Organization', name: sellerName },
    };
  }
  return data;
}

/**
 * The sentence that describes ONE item in a search result.
 *
 * The seller's OWN words win, and the long write-up wins over the one-liner:
 * on an item page both are about this exact thing, which is what a searcher is
 * matching on, and metaText cuts them to a length Google will not rewrite.
 * Unlike eventDescription() nothing is prepended to them — an event needs its
 * date and city stitched in because those are the fields people search events
 * by, and a product does not.
 *
 * The fallback is for an item nobody has written a word about: the name, the
 * listing it belongs to and the city, so it still reads like a real listing
 * rather than a bare product name.
 */
export function itemDescription(event: EventRow, tier: EventTierRow): string {
  const own = (tier.details || tier.description).replace(/\s+/g, ' ').trim();
  if (own) return metaText(own);
  const where = event.city.trim() ? ` — ${event.city.trim()}` : '';
  return metaText(`${tier.name}, from ${event.name}${where}.`);
}

/** Home > Listing > Item, so an item page shows its shop in the trail. */
export function itemBreadcrumbJsonLd(event: EventRow, tier: EventTierRow): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Events', item: getBaseUrl() },
      { '@type': 'ListItem', position: 2, name: event.name, item: absoluteUrl(`/e/${event.slug}`) },
      {
        '@type': 'ListItem',
        position: 3,
        name: tier.name,
        item: absoluteUrl(`/e/${event.slug}/item/${encodeURIComponent(tier.tierKey)}`),
      },
    ],
  };
}

/**
 * Who runs this site. Feeds Google's knowledge panel and, more practically,
 * teaches it that the name in every page title refers to one organisation.
 *
 * No sameAs: that field is for profiles we can prove we own, and inventing
 * social links we do not control is how a knowledge panel ends up pointing at
 * a stranger.
 */
export function siteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: getBaseUrl(),
    description: SITE_DESCRIPTION,
    logo: absoluteUrl('/icon.svg'),
  };
}

/**
 * The home page's event list, in the order visitors see it. Tells Google the
 * page is a listing of these specific events rather than one long article —
 * without it, a feed of ten events reads to a crawler as a single blob.
 */
export function eventListJsonLd(events: EventRow[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Upcoming events on ${SITE_NAME}`,
    numberOfItems: events.length,
    itemListElement: events.map((event, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: event.name,
      url: absoluteUrl(`/e/${event.slug}`),
    })),
  };
}

/**
 * A page's question-and-answer block, in Schema.org's vocabulary.
 *
 * Only pass questions whose answers are visible ON the page — Google checks,
 * and marked-up answers a visitor cannot read are the textbook example of what
 * gets structured data ignored site-wide. Answers are flattened to plain text
 * because acceptedAnswer.text is a string, not markup.
 */
export function faqJsonLd(items: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer.replace(/\s+/g, ' ').trim() },
    })),
  };
}

/**
 * Render JSON-LD into the page.
 *
 * JSON.stringify escaping is not enough on its own: a `</script>` sequence
 * inside any organizer-typed field (name, description, venue) would close this
 * tag early and turn the rest of the payload into live markup. Escaping the
 * `<` of every closing tag is the standard defence and costs nothing.
 */
export function jsonLdScript(data: Record<string, unknown>): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}
