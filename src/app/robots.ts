import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/config';

/**
 * /robots.txt — what crawlers may look at.
 *
 * Everything public is open; everything that belongs to one person or one
 * account is closed. The closed list is not a security control (robots.txt is a
 * request, and the real protection is the session guard on each of these
 * routes) — it exists so that a ticket QR page or a stranger's order never ends
 * up in a search result, which is a privacy leak that no login check prevents
 * once the URL has been shared.
 *
 * Deliberately NOT listed: the admin gate path. robots.txt is world-readable,
 * so naming a secret URL here would publish the very thing that makes it
 * secret. /admin covers the pages an outsider could guess, and the gate is
 * protected by being unguessable plus a password.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          // Every event photo is served from here, which makes it the source of
          // every og:image and every picture in a rich result. Blanket-blocking
          // /api/ blocks these too, and a rich result whose image Google is not
          // allowed to fetch simply loses the image — the single most valuable
          // part of an event listing. More specific than the /api/ rule below,
          // so it wins on a per-URL basis.
          '/api/media/',
        ],
        disallow: [
          '/api/', // JSON endpoints — nothing here belongs in an index
          '/admin', // the owner's area
          '/portal', // organizers' own dashboards
          '/scan', // door scanner, reachable only by a signed link
          '/ticket/', // a real person's QR ticket
          '/order/', // a real person's order and payment reference
          '/checkout', // mid-purchase state, useless and personal
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
