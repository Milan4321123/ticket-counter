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
import { getBaseUrl } from './config';
import type { EventRow, EventTierRow } from './events';

export const SITE_NAME = platformNameFromEnv();

/**
 * The one-line pitch, used wherever nothing more specific exists. Written for a
 * human reading a search result, not stuffed with keywords — Google has scored
 * keyword stuffing as spam for over a decade, and the phrases people actually
 * type ("nepali concert berlin", "nepali cultural night tickets") are already
 * here because they are what the site genuinely is.
 */
export const SITE_DESCRIPTION =
  'Nepali concerts, cultural nights and community events across Europe. Book tickets in one click, pay by bank transfer, and get your QR tickets by email.';

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
  if (tiers.length) {
    data.offers = tiers.map((tier) => ({
      '@type': 'Offer',
      name: tier.name,
      price: (tier.priceCents / 100).toFixed(2),
      priceCurrency: event.currency,
      url,
      availability:
        !event.salesOpen || totalRemaining === 0 || (remainingByTier[tier.tierKey] ?? 0) === 0
          ? 'https://schema.org/SoldOut'
          : 'https://schema.org/InStock',
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
