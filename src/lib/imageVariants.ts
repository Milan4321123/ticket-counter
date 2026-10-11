// Server-only: makes any uploaded photo fit the slot it is shown in.
//
// Organizers upload whatever their phone produced — a tall portrait, a square
// crop, a wide panorama. Every slot on the site has a fixed shape and is always
// completely filled, so something is always cropped away; `object-fit: cover`
// stops photos stretching, but it cannot decide WHICH part to keep.
//
// So each slot gets a derivative rendered to its exact shape. WHICH part
// survives is the organizer's call: when they have repositioned the photo in
// the portal, that exact rectangle is extracted (see CropRect). When they have
// not, we guess — cropping around the most visually interesting region (sharp's
// "attention" strategy) rather than blindly around the centre. Derivatives are
// produced on first request and cached on disk next to the uploads, so the cost
// is paid once per photo per framing.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type { CropRect, EventMediaRow } from './events';
import { mediaFilePath } from './media';

export interface VariantSpec {
  width: number;
  height: number;
  /**
   * 'cover' — fill the box exactly, cropping the overflow. Output is always
   * width x height, which is what every fixed-shape slot on the site needs.
   *
   * 'inside' — fit WITHIN the box, keeping the whole picture and its own shape.
   * Output is at most width x height. Only the gallery wants this: it is the
   * one place that shows a photo whole (see `.mswipe-media` in globals.css), so
   * a cropped render there would quietly cut off what the visitor opened it to
   * see. Everywhere else, cropping is the point.
   */
  fit: 'cover' | 'inside';
  /** Crop around the most visually interesting region instead of the centre. */
  smart: boolean;
}

/**
 * The shapes the site actually renders. Sizes are ~2x the largest CSS box so
 * they stay sharp on retina screens without shipping the full original, and
 * each one matches the aspect of the frame it fills — the organizer is shown
 * exactly this shape when they reposition their photo, so a mismatch here would
 * make that preview lie.
 */
export const VARIANTS = {
  /** The event hero (~2.17:1, the shape the desktop hero actually is). */
  cover: { width: 1600, height: 740, fit: 'cover', smart: true },
  /** Circular profile picture — a circle has to be square. */
  avatar: { width: 512, height: 512, fit: 'cover', smart: true },
  /**
   * Feed and listing tiles — PORTRAIT 4:5, matching `.event-card-media` in
   * globals.css and `CARD_ASPECT` in the editor's MediaPanel. Those three must
   * agree: when this was 800x500 and the tile was already 4:5, the reposition
   * tool drew a landscape frame over a portrait render and silently discarded
   * half the width the organizer had positioned. If you change these numbers,
   * change all three.
   *
   * Portrait because the uploads here are phone photos (measured 0.67-0.80),
   * and a landscape tile had to throw away more than half of every one.
   *
   * CENTRED, not smart-cropped: on the thin slice a tile takes, the automatic
   * subject-finder kept landing on the chin-and-collar edge and cutting the top
   * of the head off. People photograph subjects in the middle of the frame, so
   * the centre simply IS the subject here. The organizer can still override any
   * tile with the poster reposition tool.
   */
  card: { width: 800, height: 1000, fit: 'cover', smart: false },
  /**
   * The media swiper / lightbox — the only slot that must not crop.
   *
   * A 1000px long edge is ~2x the largest gallery box the phone layout paints
   * (measured 253x316 on the item page, 286x358 on a shop page), so it stays
   * sharp at DPR 2 while costing a fraction of the upload: the untouched
   * originals were arriving at 220 KB into a 253px-wide frame. Bounded on BOTH
   * axes because 'inside' keeps the source's own shape — a tall portrait is
   * limited by the height, a wide panorama by the width.
   */
  gallery: { width: 1000, height: 1250, fit: 'inside', smart: false },
} satisfies Record<string, VariantSpec>;

export type VariantName = keyof typeof VARIANTS;

/**
 * Beyond this width:height (or height:width) ratio a photo is a strip, not a
 * picture. Smart cropping is skipped for those — see getVariant.
 */
const EXTREME_ASPECT = 10;

export function isVariantName(value: string): value is VariantName {
  return Object.prototype.hasOwnProperty.call(VARIANTS, value);
}

/** Only raster photos are re-rendered; videos and anything else pass through. */
export function canMakeVariant(mime: string): boolean {
  return mime.startsWith('image/');
}

function derivedDir(eventId: string): string {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  return path.join(dataDir, 'derived', eventId);
}

/**
 * Cache file name.
 *
 * The key covers the source file's size and mtime, the variant's dimensions,
 * AND the organizer's framing. All three matter: without the first, replacing a
 * photo would keep serving the old crop; without the second, retuning a
 * variant's size would silently serve every existing photo at the previous
 * dimensions forever; without the third, dragging the photo to a new position
 * would land on the cached copy of the old one and appear to do nothing.
 */
function derivedName(
  mediaId: string,
  variant: VariantName,
  stamp: string,
  spec: VariantSpec,
  crop: CropRect | null
): string {
  const framing = crop ? `${crop.x},${crop.y},${crop.w},${crop.h}` : 'auto';
  const key = crypto
    .createHash('sha1')
    .update(
      `${mediaId}:${variant}:${spec.width}x${spec.height}:${spec.fit}:${spec.smart ? 'smart' : 'centre'}:${framing}:${stamp}`
    )
    .digest('hex')
    .slice(0, 12);
  return `${mediaId}-${variant}-${key}.jpg`;
}

/** The source file's part of the cache key (see derivedName). */
export function sourceStamp(stat: { size: number; mtimeMs: number }): string {
  return `${stat.size}:${stat.mtimeMs}`;
}

/**
 * Re-point already-rendered derivatives at a source whose BYTES changed but
 * whose PIXELS did not — the metadata strip (lib/stripMetadata) is the one
 * caller. Without this, cleaning every stored photo would change every cache
 * key at once and the next page loads would re-render the whole catalogue in
 * sharp, which is precisely the burst that once OOM-killed the 512 MB instance.
 *
 * Renames only the names this photo can be asked for today: each variant with
 * the automatic framing and with each framing in `crops`. Older framings'
 * files were already unreachable and stay so. Returns how many moved.
 */
export function carryVariantsOver(
  media: EventMediaRow,
  oldStamp: string,
  newStamp: string,
  crops: (CropRect | null)[]
): number {
  if (oldStamp === newStamp) return 0;
  const dir = derivedDir(media.eventId);
  let moved = 0;
  for (const variant of Object.keys(VARIANTS) as VariantName[]) {
    const spec = VARIANTS[variant];
    for (const crop of [null, ...crops]) {
      const from = path.join(dir, derivedName(media.id, variant, oldStamp, spec, crop));
      const to = path.join(dir, derivedName(media.id, variant, newStamp, spec, crop));
      try {
        if (!fs.existsSync(from) || fs.existsSync(to)) continue;
        fs.renameSync(from, to);
        moved++;
      } catch {
        // Not there, or gone meanwhile: it simply renders again on demand.
      }
    }
  }
  return moved;
}

/** A crop rectangle in whole pixels, guaranteed to sit inside `width`x`height`. */
interface PixelRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Turn the organizer's fractions into a pixel region of THIS image.
 *
 * Everything is clamped to the image's real bounds and to at least one pixel:
 * the fractions were measured against a photo in a browser and arrive rounded,
 * and sharp throws outright on a region that pokes over an edge or has no area.
 * Clamping keeps a near-miss looking like what they framed instead of failing
 * the whole render.
 */
function cropToPixels(crop: CropRect, width: number, height: number): PixelRegion {
  const left = Math.min(Math.max(Math.round(crop.x * width), 0), width - 1);
  const top = Math.min(Math.max(Math.round(crop.y * height), 0), height - 1);
  return {
    left,
    top,
    width: Math.min(Math.max(Math.round(crop.w * width), 1), width - left),
    height: Math.min(Math.max(Math.round(crop.h * height), 1), height - top),
  };
}

export interface VariantResult {
  /** Absolute path to a JPEG rendered to the slot's exact dimensions. */
  filePath: string;
  mime: 'image/jpeg';
}

/**
 * Render (or reuse) the derivative of `media` for `variant`.
 *
 * `crop` is the organizer's own framing, in fractions of the picture as it is
 * DISPLAYED (they dragged it in a browser, which has already applied the EXIF
 * rotation). Pass null to let the automatic crop decide, which is what happens
 * for every photo nobody has repositioned.
 *
 * Returns null when the photo cannot be processed — a corrupt file, an
 * unsupported codec, a full disk. Callers fall back to serving the original,
 * so a failure here degrades to today's behaviour instead of a broken image.
 */
/**
 * One render at a time, process-wide. A feed full of fresh photos asks for
 * dozens of variants at once, and each render decodes a full-size original
 * (a 12-megapixel phone photo is ~36 MB of pixels). In parallel that is what
 * ran the 512 MB instance out of memory; queued, the later requests just wait
 * a moment — and usually find the file already rendered when their turn comes.
 */
let renderQueue: Promise<unknown> = Promise.resolve();

function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  const run = renderQueue.then(job, job);
  renderQueue = run.catch(() => undefined);
  return run;
}

export async function getVariant(
  media: EventMediaRow,
  variant: VariantName,
  crop: CropRect | null = null
): Promise<VariantResult | null> {
  if (!canMakeVariant(media.mime)) return null;
  const spec = VARIANTS[variant];
  const source = mediaFilePath(media);
  try {
    const target = path.join(
      derivedDir(media.eventId),
      derivedName(media.id, variant, sourceStamp(fs.statSync(source)), spec, crop)
    );
    // Already rendered: no need to wait in line.
    if (fs.existsSync(target)) return { filePath: target, mime: 'image/jpeg' };
  } catch {
    return null;
  }
  return oneAtATime(() => renderVariant(media, variant, crop));
}

async function renderVariant(
  media: EventMediaRow,
  variant: VariantName,
  crop: CropRect | null
): Promise<VariantResult | null> {

  const spec = VARIANTS[variant];
  const source = mediaFilePath(media);

  let stamp: string;
  try {
    stamp = sourceStamp(fs.statSync(source));
  } catch {
    return null;
  }

  const dir = derivedDir(media.eventId);
  const target = path.join(dir, derivedName(media.id, variant, stamp, spec, crop));

  // Already rendered.
  if (fs.existsSync(target)) return { filePath: target, mime: 'image/jpeg' };

  // Per-CALL temp name. The pid alone is not enough: two requests for the same
  // brand-new photo run concurrently inside ONE server process, and would then
  // pick the same temp path — one render writing over the other's bytes while it
  // was being renamed. A random suffix makes each writer independent.
  const tmp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;

  // One metadata read answers two questions: how lopsided the source is (which
  // decides whether smart cropping is affordable — see the resize below), and
  // how big it is in pixels, which the organizer's fractions are measured
  // against. Metadata only — this does not decode the pixels.
  let extremeAspect = false;
  let region: PixelRegion | null = null;
  try {
    const meta = await sharp(source).metadata();
    if (meta.width && meta.height) {
      const ratio = Math.max(meta.width / meta.height, meta.height / meta.width);
      extremeAspect = ratio > EXTREME_ASPECT;
      if (crop) {
        // .rotate() below turns the picture upright first, so the region has to
        // be measured against the UPRIGHT dimensions — which for a quarter-turn
        // EXIF flag (5-8) are the stored ones swapped. Without the swap a
        // sideways phone photo gets its framing applied along the wrong axis.
        const quarterTurn = (meta.orientation ?? 1) >= 5;
        const width = quarterTurn ? meta.height : meta.width;
        const height = quarterTurn ? meta.width : meta.height;
        region = cropToPixels(crop, width, height);
      }
    }
  } catch {
    // Unreadable metadata: assume the worst and take the cheap path. A framing
    // we cannot measure is dropped rather than guessed at — the automatic crop
    // is a far better answer than a region invented from nothing.
    extremeAspect = true;
  }

  try {
    fs.mkdirSync(dir, { recursive: true });
    let pipeline = sharp(source)
      // Respect the EXIF orientation flag before cropping, or a phone photo
      // taken sideways gets cropped along the wrong axis.
      .rotate();
    // The organizer's own framing wins over any automatic choice: take their
    // rectangle FIRST, then scale it to the slot. Because that rectangle
    // already has the slot's proportions, the resize below has nothing left to
    // crop and what they framed is exactly what ships.
    if (region) pipeline = pipeline.extract(region);
    await pipeline
      .resize(spec.width, spec.height, {
        fit: spec.fit,
        // 'attention' scans the image to find the subject, and its cost grows
        // with the pixel count it is handed. On a normal photo that is cheap; on
        // a freak 100:1 strip the cover-fit upscale hands it an enormous
        // intermediate. Those shapes have no meaningful "subject" to find
        // anyway, so fall back to a centre crop well before it gets expensive.
        position: spec.smart && !extremeAspect ? sharp.strategy.attention : 'centre',
        // A cropping slot always scales to fill, enlarging a small upload if
        // need be: letting it stay small does not avoid the blur — CSS would
        // scale it up anyway, and worse — it just leaves the picture floating
        // undersized in a frame it was supposed to fill.
        //
        // 'inside' is the opposite job. The gallery paints the photo whole on
        // its own backdrop, so an upload smaller than the box has nothing to
        // fill and upscaling it would only spend bytes inventing pixels.
        withoutEnlargement: spec.fit === 'inside',
      })
      // A photo with transparency would otherwise composite onto black; event
      // posters are often PNGs with a transparent margin.
      .flatten({ background: '#12141d' })
      .jpeg({ quality: 82, mozjpeg: true })
      // Render to a temp path and rename: rename is atomic, so a reader can only
      // ever see a complete file, never a half-written one.
      .toFile(tmp);
    fs.renameSync(tmp, target);
    return { filePath: target, mime: 'image/jpeg' };
  } catch {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // Nothing to clean up.
    }
    return null;
  }
}

/**
 * Drop every cached derivative of a media row. Called when the original is
 * deleted so stale crops cannot outlive it (and cannot be served if a future
 * upload ever reuses the id).
 */
export function deleteVariants(eventId: string, mediaId: string): void {
  const dir = derivedDir(eventId);
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.startsWith(`${mediaId}-`)) continue;
    try {
      fs.unlinkSync(path.join(dir, entry));
    } catch {
      // Already gone.
    }
  }
}
