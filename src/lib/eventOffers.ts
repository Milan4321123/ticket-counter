// Server-only: what can be bought AT events — ticket types, a restaurant
// night's dishes, a festival's food stalls — as searchable rows, for the Ask
// chat. The bazaar (lib/marketItems) only holds shops' goods; a "Momo Night"
// selling "Chicken momo plate" is an event, and a visitor asking for "momo"
// should meet it too.
import { listPublishedEvents, mediaUrl, tierPhoto, type EventRow, type EventTierRow } from './events';
import { relatedWords } from './bazaarWords';
import { loadFeedSnapshot } from './feedSnapshot';
import { formatMoney } from './money';
import { visibleTiers } from './ticketState';

export interface EventOffer {
  event: EventRow;
  tier: EventTierRow;
  image: string | null;
  href: string;
  haystack: string;
}

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const today = () => new Date().toISOString().slice(0, 10);

/** Every ticket / dish on an upcoming published event (not shops — those are the bazaar). */
export function listEventOffers(): EventOffer[] {
  const events = listPublishedEvents().filter((e) => e.kind !== 'shop' && (!e.eventDate || e.eventDate >= today()));
  const snap = loadFeedSnapshot(events);
  const out: EventOffer[] = [];
  for (const event of events) {
    const photos = snap.photos.get(event.id) ?? [];
    const cover = event.posterMediaId || event.coverMediaId || event.profileMediaId;
    for (const tier of visibleTiers(snap.tiers.get(event.id) ?? [])) {
      const photo = tierPhoto(tier, photos);
      const text = fold([tier.name, tier.description, tier.details, event.name, event.artist, event.city, event.venueName].join(' \n '));
      const related = relatedWords(text);
      out.push({
        event,
        tier,
        image: photo ? mediaUrl(photo.id, 'card', null) : cover ? mediaUrl(cover, 'card', null) : null,
        // Straight to the ticket picker, where this row can be chosen.
        href: `/e/${event.slug}#tickets`,
        haystack: related.length ? `${text} \n ${related.join(' ')}` : text,
      });
    }
  }
  return out;
}

export interface OfferFilters {
  q: string;
  city?: string;
  minCents?: number;
  maxCents?: number;
  from?: string;
  to?: string;
  cheapestFirst?: boolean;
}

/**
 * The offers whose OWN words (the ticket or dish) match every search term —
 * a term that only matches the event's name would list every ticket of it,
 * so the event itself is shown as one card elsewhere instead.
 */
export function findEventOffers(f: OfferFilters): EventOffer[] {
  const terms = fold(f.q).split(' ').filter(Boolean);
  if (!terms.length) return [];
  const town = fold(f.city ?? '');
  const rows = listEventOffers().filter((o) => {
    const own = fold([o.tier.name, o.tier.description, o.tier.details].join(' '));
    const ownRelated = relatedWords(own).join(' ');
    return (
      terms.every((t) => o.haystack.includes(t)) &&
      terms.some((t) => own.includes(t) || ownRelated.includes(t)) &&
      (!town || fold(o.event.city).includes(town)) &&
      (!f.maxCents || o.tier.priceCents <= f.maxCents) &&
      (!f.minCents || o.tier.priceCents >= f.minCents) &&
      (!f.from || (o.event.eventDate !== null && o.event.eventDate >= f.from && o.event.eventDate <= (f.to || f.from)))
    );
  });
  return f.cheapestFirst
    ? rows.sort((a, b) => a.tier.priceCents - b.tier.priceCents)
    : rows.sort((a, b) => (a.event.eventDate ?? '9').localeCompare(b.event.eventDate ?? '9'));
}

/** As a chat card: "€9.00 · Momo Night · Sat 3 Oct". */
export function offerCard(o: EventOffer) {
  // "Sat 17 Oct" — the full "Saturday, October 17, 2026 · Doors 6:00 PM" does not fit a card.
  const when = o.event.eventDate
    ? new Date(`${o.event.eventDate}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    : o.event.dateDisplay;
  return {
    kind: 'offer' as const,
    title: o.tier.name,
    sub: [formatMoney(o.tier.priceCents, o.event.currency), o.event.name, when].filter(Boolean).join(' · '),
    href: o.href,
    image: o.image,
  };
}
