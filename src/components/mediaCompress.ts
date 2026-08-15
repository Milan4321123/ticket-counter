// Browser-only helpers that shrink what an organizer picked BEFORE it is
// uploaded, so photos straight off a phone still fit the server's caps.
//
// Nothing here ever throws: if anything at all goes wrong (unsupported type,
// no canvas, a decode failure) the original file comes back and the normal
// server-side validation decides. These functions are imported by client
// components only; they no-op outside a browser.

export interface CompressImageOptions {
  /** Target size. The result is only guaranteed to be *as small as we got it*. */
  maxBytes: number;
  /** Longest edge of the output, in pixels. */
  maxDimension?: number;
}

export interface CompressVideoResult {
  file: File;
  /** Set only when the video is still too big — friendly guidance for the UI. */
  note?: string;
}

/** Types we can re-encode. Anything else is passed straight through. */
const COMPRESSIBLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** JPEG quality ladder, tried in order at each scale step. */
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55, 0.5];

/** Extra scale-downs to try when even the lowest quality is still too big. */
const SCALE_STEPS = [1, 0.75, 0.55, 0.4];

/** "3.4", "12", "60" — megabytes for human-readable size messages. */
export function formatMb(bytes: number): string {
  const rounded = Math.round((bytes / (1024 * 1024)) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/** Decode a file to something drawable, preferring the fast bitmap path. */
async function loadImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** Same base name, .jpg extension — the re-encoded output is always JPEG. */
function jpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.jpg`;
}

/**
 * Shrink a photo until it fits `maxBytes`: scale it down to `maxDimension` and
 * step JPEG quality down (0.85 → 0.5), scaling further if that is not enough.
 * Returns the original when it already fits or cannot be re-encoded, and the
 * smallest version we managed when nothing reaches the target.
 */
export async function compressImage(file: File, options: CompressImageOptions): Promise<File> {
  const { maxBytes, maxDimension = 1920 } = options;
  if (file.size <= maxBytes) return file;
  if (!COMPRESSIBLE_IMAGE_TYPES.includes(file.type)) return file;
  if (typeof document === 'undefined') return file;

  let loaded: Awaited<ReturnType<typeof loadImage>> | null = null;
  try {
    loaded = await loadImage(file);
    const { source, width, height } = loaded;
    if (!width || !height) return file;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // Never upscale: the dimension cap only ever shrinks.
    const fit = Math.min(1, maxDimension / Math.max(width, height));
    let best: Blob | null = null;

    for (const step of SCALE_STEPS) {
      const scale = fit * step;
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      // JPEG has no alpha — paint white underneath so transparent PNGs do not
      // come out with black edges.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

      for (const quality of QUALITY_STEPS) {
        const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        if (!blob) continue;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= maxBytes) {
          return new File([blob], jpegName(file.name), {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          });
        }
      }
    }

    // Nothing reached the target — hand back whatever got smallest, as long as
    // it actually beats the original.
    if (best && best.size < file.size) {
      return new File([best], jpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified });
    }
    return file;
  } catch {
    return file;
  } finally {
    loaded?.release();
  }
}

/**
 * Videos: browsers cannot re-encode reliably without a bundled encoder, so
 * this never transcodes. It returns the file untouched, plus a `note` telling
 * the organizer what to do when it is over the cap. The shape is deliberately
 * the same as a real compressor's so one can drop in later.
 */
export async function compressVideo(file: File, options: { maxBytes: number }): Promise<CompressVideoResult> {
  const { maxBytes } = options;
  if (file.size <= maxBytes) return { file };
  return {
    file,
    note:
      `This video is ${formatMb(file.size)} MB — the limit is ${formatMb(maxBytes)} MB. ` +
      `On your phone: share/export at 720p, or trim it, then try again.`,
  };
}
