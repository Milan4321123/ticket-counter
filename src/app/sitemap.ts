import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/config';
import { listPublishedEvents } from '@/lib/events';
import { machineDate } from '@/lib/seo';

/**
 * /sitemap.xml — the list of pages we are asking Google to index.
 *
 * Generated from the database on every request rather than written by hand, so
 * an event published tonight is in the sitemap tonight. Only PUBLISHED events
 * appear: a draft is the organizer's private workspace, and a sitemap entry is
 * a public invitation to come and look at it.
 *
 * Nothing behind a login is listed, and nothing that is personal to one visitor
 * — tickets, orders, checkout. Those are excluded here AND in robots.ts; a
 * sitemap says "please index this", robots says "do not", and a page that is
 * genuinely private should never rely on only one of the two.
 */
export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getBaseUrl();
  const events = listPublishedEvents();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/organizers`, changeFrequency: 'monthly', priority: 0.8 },
    // The evergreen festival pages: same URL every year, so their search
    // standing compounds. Weekly — the events listed on them change.
    { url: `${base}/dashain`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/tihar`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/digest`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${base}/e/${event.slug}`,
    // The event's own date is the honest "this changed" signal we have — there
    // is no updated_at on events. An upcoming event is worth recrawling often;
    // one whose date has passed is not.
    lastModified: machineDate(event) ?? undefined,
    changeFrequency: 'daily',
    priority: 0.9,
  }));

  return [...staticPages, ...eventPages];
}
