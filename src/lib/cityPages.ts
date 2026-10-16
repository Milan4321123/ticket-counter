// Server-only: the city pages — /nepali-in/frankfurt, /nepali-in/munchen …
//
// "Nepali community Berlin", "Nepali restaurant Munich", "Dashain Frankfurt":
// people search for their town, not for a platform. One page per town brings
// together what the site already has there — upcoming events, shops, Kalakar
// profiles, and a count of what members are doing — so that search has
// something real to land on.
//
// Only towns with something public to show get a page in the sitemap and are
// indexed; a page with nothing on it would be the thin, empty kind that
// teaches a search engine to distrust the rest of the site.
import { citySlug, cityName, cityKey } from './cities';
import { berlinNow } from './community';
import { listPublishedEvents, type EventRow } from './events';
import { upcomingMeetupCountIn } from './meetups';
import { listTalent, type TalentProfile } from './talent';
import { getDb } from './db';

export interface CityHub {
  slug: string;
  name: string;
  events: EventRow[];
  shops: EventRow[];
  talent: TalentProfile[];
}

function isUpcomingEvent(e: EventRow, today: string): boolean {
  return e.kind !== 'shop' && Boolean(e.eventDate) && e.eventDate!.slice(0, 10) >= today;
}

/** Every town with at least one upcoming event, shop or profile, busiest first. */
export function cityHubs(): CityHub[] {
  const today = berlinNow().slice(0, 10);
  const map = new Map<string, CityHub>();
  const hub = (raw: string): CityHub | null => {
    const slug = citySlug(raw);
    if (!slug) return null;
    let h = map.get(slug);
    if (!h) {
      h = { slug, name: cityName(raw), events: [], shops: [], talent: [] };
      map.set(slug, h);
    }
    return h;
  };
  for (const e of listPublishedEvents()) {
    if (e.kind === 'shop') hub(e.city)?.shops.push(e);
    else if (isUpcomingEvent(e, today)) hub(e.city)?.events.push(e);
  }
  for (const t of listTalent()) hub(t.city)?.talent.push(t);
  return [...map.values()]
    .filter((h) => h.events.length + h.shops.length + h.talent.length > 0)
    .sort((a, b) => b.events.length + b.shops.length + b.talent.length - (a.events.length + a.shops.length + a.talent.length));
}

export function cityHub(slug: string): CityHub | null {
  if (!/^[a-z-]{2,60}$/.test(slug)) return null;
  const found = cityHubs().find((h) => h.slug === slug);
  if (found) {
    found.events.sort((a, b) => (a.eventDate ?? '').localeCompare(b.eventDate ?? ''));
    return found;
  }
  return null;
}

/** What members are doing in this town — counts only, never content. */
export function cityCommunityCounts(name: string): { meetups: number; helpPosts: number } {
  const key = cityKey(name);
  const today = berlinNow().slice(0, 10);
  const rows = getDb().prepare(`SELECT city FROM help_posts WHERE status = 'open' AND expires_on >= ?`).all(today) as { city: string }[];
  return {
    meetups: upcomingMeetupCountIn(name),
    helpPosts: rows.filter((r) => cityKey(r.city) === key).length,
  };
}
