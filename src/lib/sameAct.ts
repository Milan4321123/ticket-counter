// Server-only: "is there ANOTHER show by this act, in a different city?"
//
// It exists because of a real near-miss on the live site. One artist was
// booked twice inside ten days by two different organizers — Heidelberg on the
// 10th, Lisbon on the 19th — with near-identical poster art, because both
// posters came from the same act. Every surface between the feed and the pay
// button named the city, and every one of them named it in small grey text
// under something louder. A buyer in Portugal could pick the German show off
// the feed, pay by bank transfer, and find out at the door.
//
// Nothing here merges the two listings. They belong to different organizers,
// who each own their own page, their own bank account and their own buyers;
// folding them into one card would put one organizer's show under another
// organizer's name. What this does is let each page POINT at the other one, so
// the choice is made knowingly.
//
// The match is deliberately conservative: a wrong "same act" claim is worse
// than a missing one, because it tells a buyer about a show that does not
// exist. See looksLikeSameAct for the exact rule.
import { listPublishedEvents } from './events';
import type { EventRow } from './events';

/**
 * Words that carry no identity. Two acts sharing only these are not the same
 * act: "Live Band" and "Live Music Group" have nothing in common but the
 * furniture.
 *
 * Connectives and billing words only. Nothing here is a name — removing a word
 * that COULD be part of a name (a place, a surname, "nepali") would quietly
 * merge two different acts, which is the failure this module exists to avoid.
 */
const FILLER = new Set([
  'and',
  'the',
  'with',
  'feat',
  'featuring',
  'ft',
  'presents',
  'present',
  'live',
  'band',
  'group',
  'crew',
  'team',
  'show',
  'tour',
  'concert',
  'music',
  'musical',
  'dj',
  'x',
]);

/**
 * An artist line reduced to the words that identify it.
 *
 * "Sugam Pokhrel & Bajagaja" and "Sugam Pokhrel bajagaja and Binay Karki" are
 * typed by two organizers who have never met, so nothing but the names can be
 * relied on: no shared casing, no shared punctuation, no shared word order,
 * and usually a different number of names billed. Accents are folded because
 * the same name is written both ways ("Śrestha"/"Shrestha").
 */
export function actTokens(artist: string): string[] {
  return artist
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ]+/g, ' ')
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !FILLER.has(w) && !/^\d+$/.test(w));
}

/**
 * Two artist lines that name the same act.
 *
 * The rule is TWO shared identifying words, and the reason is the false
 * positive: one shared word is a first name. Half the acts on a Nepali events
 * feed share a "Binay", a "Bijay" or a "Karki", and a banner that tells a
 * buyer in Berlin about a Lisbon show by a different singer with the same
 * first name is worse than no banner — it is a wrong fact on a page whose only
 * job at that moment is to be trusted about where the buyer is going.
 *
 * Two shared words is what "Sugam Pokhrel" is, and what a coincidence is not.
 */
export function looksLikeSameAct(a: string, b: string): boolean {
  const left = new Set(actTokens(a));
  if (left.size === 0) return false;
  const shared = new Set(actTokens(b).filter((w) => left.has(w)));
  return shared.size >= 2;
}

/** Cities that are the same place however the two organizers typed it. */
function sameCity(a: string, b: string): boolean {
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      // Postcodes travel with the city on this site ("69126 Heidelberg").
      .replace(/\d+/g, ' ')
      .replace(/[^a-z ]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  const x = clean(a);
  const y = clean(b);
  return x.length > 0 && x === y;
}

/** How far apart two bookings can be and still be worth warning about. */
const WINDOW_DAYS = 60;

function daysApart(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const parse = (s: string) => Date.parse(s.length === 10 ? `${s}T12:00:00Z` : s);
  const x = parse(a);
  const y = parse(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return Math.abs(x - y) / 86_400_000;
}

/**
 * The other published shows by the same act, in a DIFFERENT city.
 *
 * Same city is left out on purpose: two nights at the same venue are not a
 * confusion about where, and a buyer who wants the other night is already
 * choosing between two dates in one place. The whole warning is about
 * travelling to the wrong country.
 *
 * Undated shows are kept rather than dropped. `event_date` is optional on this
 * site — plenty of listings carry only the organizer's own date text — and a
 * missing date is not evidence that two bookings are unrelated. The date
 * window only rules a show OUT when both sides actually have a date.
 *
 * Shops never match: a shop has no act, and "the same artist also sells momos"
 * is not a sentence anybody needs.
 */
export function otherShowsByAct(event: EventRow, all?: EventRow[]): EventRow[] {
  if (event.kind !== 'event' || !event.artist.trim()) return [];
  const candidates = all ?? listPublishedEvents();
  return candidates
    .filter((other) => {
      if (other.id === event.id) return false;
      if (other.status !== 'published' || other.kind !== 'event') return false;
      if (!other.artist.trim()) return false;
      // No city on one side means nothing can be said about where it is, and a
      // banner that cannot name the other city says nothing worth reading.
      if (!other.city.trim() || !event.city.trim()) return false;
      if (sameCity(other.city, event.city)) return false;
      if (!looksLikeSameAct(event.artist, other.artist)) return false;
      const gap = daysApart(event.eventDate, other.eventDate);
      return gap === null || gap <= WINDOW_DAYS;
    })
    .sort((a, b) => (a.eventDate ?? '9999').localeCompare(b.eventDate ?? '9999'));
}

/**
 * The city on its own, without the postcode the organizer typed in front of it
 * — "69126 Heidelberg" is an address, "Heidelberg" is the word a buyer is
 * scanning for. Falls back to the raw string when stripping leaves nothing, so
 * a city written as digits is shown rather than blanked.
 */
export function cityLabel(city: string): string {
  const stripped = city.replace(/\b\d{4,6}\b/g, '').trim().replace(/\s+/g, ' ');
  // Only a remainder that still reads as a NAME is an improvement. Stripping
  // digits out of "1100-062" leaves "-062", which is not a city, not the
  // address either, and not something to print on a pay button.
  return /\p{L}/u.test(stripped) ? stripped : city.trim();
}

/**
 * "Sat 10 Oct" — short enough to sit inside a button or a banner sentence.
 *
 * Only ever built from the machine date. The organizer's own date text is free
 * text with doors, support acts and afterparties in it ("Monday 19 October
 * Door open 22:00"), and pasting that into a button is how a control becomes a
 * paragraph.
 */
export function shortDateLabel(event: EventRow): string {
  if (!event.eventDate) return '';
  const iso = event.eventDate.length === 10 ? `${event.eventDate}T12:00:00` : event.eventDate;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
