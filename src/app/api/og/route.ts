import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { OG_HEIGHT, OG_WIDTH, ogCardSvg } from '@/lib/ogCard';
import { platformNameFromEnv, platformWordmark } from '@/lib/platform';

/**
 * GET /api/og — the site's default social preview picture.
 *
 * Every page that has no photograph of its own points its og:image here (see
 * app/layout.tsx), which is most of the site: the home page, the whole bazaar,
 * the festival calendar, the patro, /organizers. Before this they arrived in a
 * WhatsApp group as a grey box, on a platform where a forwarded link IS the
 * distribution.
 *
 * Rasterised rather than served as SVG on purpose: Facebook, WhatsApp, Viber
 * and iMessage all refuse an SVG og:image. sharp does the conversion and is
 * already here for every photo on the site, so this costs no new dependency.
 *
 * The card itself is drawn in lib/ogCard and is deliberately shapes and Latin
 * text only — see the note there about fonts we do not control.
 */
// NOT force-dynamic. That makes Next stamp `Cache-Control: no-store` over
// whatever this route sets, and a preview card re-rasterised for every crawler
// hit — they arrive one per link in a group chat — is the one thing this must
// not be. A year of revalidation matches the immutable header below: the
// picture only changes when the platform is renamed, which is a redeploy.
export const revalidate = 31536000;

/**
 * One render per process. The card only changes when the platform is renamed,
 * which is a redeploy, so rasterising it on every crawler hit would be pure
 * waste — and crawler hits arrive in bursts, one per link in a group chat.
 */
let cached: Buffer | null = null;

export async function GET() {
  try {
    if (!cached) {
      const { head, accent } = platformWordmark();
      const svg = ogCardSvg({
        head,
        accent,
        // Latin only, and it has to survive being read at the size of a chat
        // bubble: what the site is, and where.
        tagline: 'Nepali events, tickets & bazaar — across Germany',
      });
      cached = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
    }

    return new NextResponse(new Uint8Array(cached), {
      headers: {
        'Content-Type': 'image/png',
        // A year, and immutable: the URL has no parameters and the picture
        // behind it does not change between deploys. Crawlers re-fetch this
        // for every link that gets shared, and there is nothing here worth
        // making them ask about twice.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(cached.length),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    // A preview picture is never worth a 500 on a page: a crawler that gets an
    // error here shows the same grey box it showed before this route existed.
    console.error('OG card render failed:', e);
    return NextResponse.json(
      { error: `Could not render the ${platformNameFromEnv()} preview card.` },
      { status: 500 }
    );
  }
}
