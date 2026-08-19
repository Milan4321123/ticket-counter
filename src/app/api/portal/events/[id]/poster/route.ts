// GET /api/portal/events/[id]/poster — a ready-to-forward WhatsApp poster.
//
// Organizers here market in WhatsApp groups and stories, not on billboards: what
// they need is one portrait image with the cover photo, the essentials, and a QR
// code that lands on their page. Rendered on demand rather than stored, so it
// always shows the event as it is TODAY — a renamed event or a repriced tier is
// on the next download with nothing to invalidate.
//
// 1080x1350 (4:5) because that is the largest portrait shape WhatsApp and
// Instagram show uncropped; a square wastes the phone screen and a 9:16 story
// gets its edges eaten by the UI in group chats.
import fs from 'fs';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import QRCode from 'qrcode';
import {
  getEventMedia,
  getEventTiers,
  parseCropRect,
  type CropRect,
  type EventMediaRow,
  type EventRow,
} from '@/lib/events';
import { mediaFilePath } from '@/lib/media';
import { formatMoney } from '@/lib/money';
import { platformWordmark } from '@/lib/platform';
import { rateLimit } from '@/lib/ratelimit';
import { absoluteUrl } from '@/lib/seo';
import { getBaseUrl } from '@/lib/config';
import type { ApiErrorResponse } from '@/lib/types';
import { vocabFor } from '@/lib/vocab';
import { requireOrganizerApi, requireOwnedEvent } from '../../../auth';

export const dynamic = 'force-dynamic';

const W = 1080;
const H = 1350;
/** The photo band: roughly the top 60%, the rest is the text panel. */
const PHOTO_H = 810;
const MARGIN = 64;
/** Site background — the panel must match the pages the QR code leads to. */
const INK = '#0a0b10';
/** The platform crimson, same value the emails and the site chrome use. */
const CRIMSON = '#dc143c';

const QR_TILE = 288;
const QR_SIZE = 240;
const QR_X = W - MARGIN - QR_TILE;
/**
 * The tile starts below the headline's worst-case second baseline. Text width
 * here is ESTIMATED (librsvg cannot measure), so nothing estimated is allowed
 * to share a row with the tile's top edge — the headline gets the full width
 * above it and can only ever miss into empty margin.
 */
const QR_Y = PHOTO_H + 194;

/** The full-width band the headline may use. */
const NAME_W = W - MARGIN * 2;
/** Meta lines and the price sit beside the QR tile, so they stop short of it. */
const TEXT_W = QR_X - MARGIN - 36;

/**
 * Same ceiling lib/media.ts enforces at upload time, re-applied at decode time
 * as sharp's own input limit. Uploads were validated, but this route also opens
 * files that may have been swapped on disk since — the cap makes a decode bomb
 * fail this one download instead of taking the shared process with it.
 */
const MAX_INPUT_PIXELS = 50_000_000;

/** Everything organizer-typed goes through here before it enters the SVG. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * librsvg (sharp's SVG rasterizer) cannot measure text for us, so wrapping is
 * done by estimate: ~0.56em per glyph of a mixed-case bold sans face. A wrong
 * guess costs margin, never a collision — the layout keeps estimated text and
 * the QR tile out of each other's rows entirely.
 */
function maxChars(fontSize: number, width: number, factor = 0.56): number {
  return Math.max(4, Math.floor(width / (fontSize * factor)));
}

/**
 * Posters love ALL CAPS, and capitals run ~30% wider than the mixed-case
 * average — an estimate tuned for "Dashain Night" would let "DASHAIN NIGHT"
 * spill past the right margin. Latin-only on purpose: scripts without a case
 * distinction (Devanagari) fall through to the mixed-case factor.
 */
function nameCharFactor(text: string): number {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (!letters) return 0.56;
  const upper = (letters.match(/[A-Z]/g) ?? []).length;
  return upper / letters.length > 0.6 ? 0.72 : 0.56;
}

function ellipsize(text: string, limit: number): string {
  const t = text.trim();
  return t.length <= limit ? t : t.slice(0, Math.max(1, limit - 1)).trimEnd() + '…';
}

/**
 * Greedy word-wrap into at most two lines; anything beyond ends in an
 * ellipsis. Two lines is a poster decision, not a technical one — a headline
 * that needs three reads like a paragraph from across a room. `cut` tells the
 * caller whether shrinking the font would let more of the name survive.
 */
function wrapTwoLines(text: string, limit: number): { lines: string[]; cut: boolean } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < 2) {
    let line = words[i++];
    while (i < words.length && line.length + 1 + words[i].length <= limit) {
      line = `${line} ${words[i++]}`;
    }
    lines.push(line);
  }
  // Either words were left over, or a single word overflows the line on its
  // own — the trailing ellipsize() cuts the latter.
  const cut = i < words.length || lines.some((l) => l.length > limit);
  if (i < words.length) lines[lines.length - 1] += '…';
  return { lines: lines.map((l) => ellipsize(l, limit)), cut };
}

/** The first non-empty line of a shop's free-text collection details. */
function firstLine(text: string): string {
  return text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
}

/**
 * Which photo fronts the poster: the same order the public page and its social
 * preview use (cover, then listing photo, then first upload), each with the
 * framing the organizer chose for that slot — the poster must agree with every
 * other place the event shows a face.
 */
function pickPhoto(event: EventRow): { media: EventMediaRow; crop: CropRect | null } | null {
  const photos = getEventMedia(event.id); // photos only — a video cannot front a poster
  const byId = (id: string | null) => photos.find((p) => p.id === id) ?? null;

  const cover = byId(event.coverMediaId);
  if (cover) return { media: cover, crop: parseCropRect(event.coverCrop) };
  const poster = byId(event.posterMediaId);
  if (poster) return { media: poster, crop: parseCropRect(event.posterCrop) };
  return photos[0] ? { media: photos[0], crop: null } : null;
}

/**
 * The organizer's crop fractions as a pixel region of this image, clamped to
 * its real bounds. A local copy of the arithmetic in lib/imageVariants (which
 * keeps it private): the fractions arrive rounded from a browser, and sharp
 * throws outright on a region that pokes past an edge or has no area.
 */
function cropToPixels(crop: CropRect, width: number, height: number) {
  const left = Math.min(Math.max(Math.round(crop.x * width), 0), width - 1);
  const top = Math.min(Math.max(Math.round(crop.y * height), 0), height - 1);
  return {
    left,
    top,
    width: Math.min(Math.max(Math.round(crop.w * width), 1), width - left),
    height: Math.min(Math.max(Math.round(crop.h * height), 1), height - top),
  };
}

/**
 * The photo band as an encoded image, or null for ANY failure — a deleted
 * file, a corrupt image, a crop that no longer fits. The poster then falls
 * back to the brand gradient rather than answering 500: a poster without a
 * photo is still a poster, and the organizer is mid-share when they hit this.
 */
async function renderPhotoBand(event: EventRow): Promise<Buffer | null> {
  const picked = pickPhoto(event);
  if (!picked) return null;
  try {
    const source = mediaFilePath(picked.media);
    fs.statSync(source); // fail early and quietly if the file is gone

    // One metadata read (no pixel decode) answers two questions: where the
    // organizer's fractions land in pixels, and whether the shape is such a
    // freak strip that smart cropping would chew an enormous intermediate.
    let region: ReturnType<typeof cropToPixels> | null = null;
    let extremeAspect = false;
    const meta = await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    if (meta.width && meta.height) {
      const ratio = Math.max(meta.width / meta.height, meta.height / meta.width);
      extremeAspect = ratio > 10;
      if (picked.crop) {
        // .rotate() below uprights the picture before extract() runs, so the
        // region is measured against the UPRIGHT dimensions — a quarter-turn
        // EXIF flag (5-8) means the stored width and height are swapped.
        const quarterTurn = (meta.orientation ?? 1) >= 5;
        region = cropToPixels(
          picked.crop,
          quarterTurn ? meta.height : meta.width,
          quarterTurn ? meta.width : meta.height
        );
      }
    }

    let pipeline = sharp(source, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
    if (region) pipeline = pipeline.extract(region);
    return await pipeline
      .resize(W, PHOTO_H, {
        fit: 'cover',
        // The organizer's own framing is already centred on their subject, so
        // once extracted a plain centre fill is exactly right; only an unframed
        // photo needs the automatic subject-finder.
        position: region || extremeAspect ? 'centre' : sharp.strategy.attention,
        withoutEnlargement: false,
      })
      // Transparent PNG posters would otherwise composite onto black.
      .flatten({ background: INK })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

/**
 * The lowest price a buyer will actually be offered, or null when there is
 * nothing to say: no visible tiers, or a fully free listing — "from €0.00"
 * on a poster reads like a mistake, and free is the page's story to tell.
 */
function fromPrice(event: EventRow): string | null {
  const visible = getEventTiers(event.id).filter((t) => t.status !== 'hidden');
  if (visible.length === 0) return null;
  const min = Math.min(...visible.map((t) => t.priceCents));
  if (min <= 0) return null;
  return `from ${formatMoney(min, event.currency)}`;
}

/** <text> attrs shared by every run: system sans only — no webfonts on a server. */
const FONT = `font-family="Helvetica, Arial, 'DejaVu Sans', sans-serif"`;

function buildOverlaySvg(event: EventRow, hasPhoto: boolean): string {
  const v = vocabFor(event.kind);

  // Adaptive headline: try large, step down, and only then truncate — a short
  // name should be huge and a long one should still be two readable lines.
  let nameSize = 60;
  let nameLines: string[] = [' '];
  const factor = nameCharFactor(event.name);
  for (const size of [60, 50, 42]) {
    nameSize = size;
    const wrapped = wrapTwoLines(event.name, maxChars(size, NAME_W, factor));
    if (wrapped.lines.length > 0) nameLines = wrapped.lines;
    if (!wrapped.cut) break;
  }
  const nameGap = Math.round(nameSize * 1.18);

  // Events say when and where; shops say how to collect. Both come from the
  // fields the buyer page itself shows, so the poster can never promise a
  // detail the page does not.
  const metaLimit = maxChars(32, TEXT_W) + 6; // regular weight runs narrower than bold
  const metaLines = (
    event.kind === 'shop'
      ? [firstLine(event.pickupInfo), event.city]
      : [event.dateDisplay, [event.venueName, event.city].filter((s) => s.trim()).join(', ')]
  )
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => ellipsize(s, metaLimit));

  const price = fromPrice(event);

  // Vertical layout as a running cursor, so a one-line name pulls everything
  // beneath it upward instead of leaving a hole.
  const parts: string[] = [];
  let baseline = PHOTO_H + 100;
  for (const line of nameLines) {
    parts.push(
      `<text x="${MARGIN}" y="${baseline}" ${FONT} font-size="${nameSize}" font-weight="800" fill="#ffffff">${escapeXml(line)}</text>`
    );
    baseline += nameGap;
  }
  baseline += 18;
  for (const line of metaLines) {
    parts.push(
      `<text x="${MARGIN}" y="${baseline}" ${FONT} font-size="32" fill="#b9becf">${escapeXml(line)}</text>`
    );
    baseline += 48;
  }
  if (price) {
    // A crimson pill instead of crimson text: the brand red on the near-black
    // panel is too dim to carry small type, but as a filled shape under white
    // bold it is unmissable — same trick the site's buttons use.
    const pillTop = baseline + 4;
    const pillW = Math.round(price.length * 30 * 0.56) + 48;
    parts.push(
      `<rect x="${MARGIN}" y="${pillTop}" width="${Math.min(pillW, TEXT_W)}" height="58" rx="29" fill="${CRIMSON}"/>`,
      `<text x="${MARGIN + 24}" y="${pillTop + 39}" ${FONT} font-size="30" font-weight="700" fill="#ffffff">${escapeXml(price)}</text>`
    );
  }

  // Wordmark + host pinned to the bottom, clear of the cursor-driven block
  // above: whoever forwards this poster is also spreading where to find the
  // next one.
  const { head, accent } = platformWordmark();
  const host = (() => {
    try {
      return new URL(getBaseUrl()).host;
    } catch {
      return '';
    }
  })();
  parts.push(
    `<text x="${MARGIN}" y="${H - 78}" ${FONT} font-size="38" font-weight="800"><tspan fill="#ffffff">${escapeXml(head)}</tspan><tspan fill="${CRIMSON}">${escapeXml(accent)}</tspan></text>`
  );
  if (host) {
    parts.push(
      `<text x="${MARGIN}" y="${H - 40}" ${FONT} font-size="24" fill="#8b90a0">${escapeXml(host)}</text>`
    );
  }

  // White tile behind the QR code: the inset doubles as the quiet zone a
  // scanner needs, and rounded corners keep it from reading as a sticker
  // pasted over the design.
  parts.push(
    `<rect x="${QR_X}" y="${QR_Y}" width="${QR_TILE}" height="${QR_TILE}" rx="24" fill="#ffffff"/>`,
    `<text x="${QR_X + QR_TILE / 2}" y="${QR_Y + QR_TILE + 38}" ${FONT} font-size="26" font-weight="600" fill="#d6d9e4" text-anchor="middle">${escapeXml(`Scan to ${v.cta.toLowerCase()}`)}</text>`
  );

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="seam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK}" stop-opacity="0"/>
      <stop offset="1" stop-color="${INK}" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b0f2f"/>
      <stop offset="0.55" stop-color="#3d0c1e"/>
      <stop offset="1" stop-color="${INK}"/>
    </linearGradient>
  </defs>
  ${hasPhoto ? '' : `<rect x="0" y="0" width="${W}" height="${PHOTO_H}" fill="url(#brand)"/>`}
  <rect x="0" y="${PHOTO_H - 240}" width="${W}" height="240" fill="url(#seam)"/>
  <rect x="0" y="${PHOTO_H}" width="${W}" height="${H - PHOTO_H}" fill="${INK}"/>
  ${parts.join('\n  ')}
</svg>`;
}

/**
 * Compose and download the poster. Same guard chain as every portal route; no
 * planGate because this is a read — a switched-off account may still download
 * marketing for the events it already runs.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const owned = requireOwnedEvent(organizer, id);
    if (owned.failure) return owned.failure;
    const { event } = owned;

    // Composing (decode + smart crop + QR + rasterize) is real CPU on a
    // single-process server shared by every tenant. Ten a minute is far more
    // than a person clicking a download button; a stuck refresh loop is not.
    if (!rateLimit(`poster:${organizer.id}`, 10, 60_000)) {
      return NextResponse.json(
        { error: 'That is a lot of posters at once — give it a minute and try again.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    const photoBand = await renderPhotoBand(event);
    const overlay = Buffer.from(buildOverlaySvg(event, photoBand !== null));

    // Margin 1 module inside the buffer on top of the tile's 24px inset — the
    // quiet zone survives even a phone camera that clips the tile's edge.
    const qr = await QRCode.toBuffer(absoluteUrl(`/e/${event.slug}`), {
      width: QR_SIZE,
      margin: 1,
      color: { dark: INK, light: '#ffffff' },
    });

    const png = await sharp({ create: { width: W, height: H, channels: 3, background: INK } })
      .composite([
        ...(photoBand ? [{ input: photoBand, top: 0, left: 0 }] : []),
        { input: overlay, top: 0, left: 0 },
        { input: qr, top: QR_Y + (QR_TILE - QR_SIZE) / 2, left: QR_X + (QR_TILE - QR_SIZE) / 2 },
      ])
      .png()
      .toBuffer();

    const safeSlug = event.slug.replace(/[^a-z0-9-]/gi, '') || 'event';
    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="poster-${safeSlug}.png"`,
        // Rendered from live data — a cached copy would outlive a rename.
        'Cache-Control': 'no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    console.error(`GET /api/portal/events/${id}/poster failed:`, e);
    return NextResponse.json(
      { error: 'The poster could not be rendered. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
