import fs from 'fs';
import { NextResponse } from 'next/server';
import { getCropForSlot, getMediaById, type CropSlot } from '@/lib/events';
import { getVariant, isVariantName, type VariantName } from '@/lib/imageVariants';
import { mediaFilePath } from '@/lib/media';

export const dynamic = 'force-dynamic';

/**
 * Which stored framing belongs to which rendered shape. A photo is only framed
 * in the slot it actually fills, so the same photo can be a hand-positioned
 * cover and an automatically cropped card at the same time.
 */
const SLOT_BY_VARIANT: Record<VariantName, CropSlot | null> = {
  cover: 'cover',
  avatar: 'profile',
  card: 'poster',
  // The gallery shows the picture WHOLE, so there is no rectangle to apply —
  // a framing belongs to the fixed shape it was drawn for, and this slot has
  // no fixed shape.
  gallery: null,
};

/** Shared headers for video responses; videos are large, so let browsers cache. */
function videoHeaders(mime: string): Record<string, string> {
  return {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  };
}

/**
 * A file on disk as a Response body, safe to abandon mid-flight.
 *
 * Built by hand rather than with Readable.toWeb(): that adapter pushes the
 * file's remaining chunks into the web stream's controller regardless of the
 * controller's state, so a visitor who scrolls a feed video out of view — or
 * simply clicks a link — leaves it enqueueing into a controller the runtime has
 * already closed. That throws ERR_INVALID_STATE from outside any request's
 * try/catch, i.e. an uncaughtException, i.e. ordinary browsing could take the
 * server down. Here EVERY controller call is guarded and the read stops the
 * moment the request goes away.
 */
function fileStream(
  filePath: string,
  signal: AbortSignal,
  range?: { start: number; end: number }
): ReadableStream {
  const node = range ? fs.createReadStream(filePath, range) : fs.createReadStream(filePath);

  return new ReadableStream({
    start(controller) {
      let finished = false;
      const finish = (err?: unknown) => {
        if (finished) return;
        finished = true;
        node.destroy();
        try {
          if (err) controller.error(err);
          else controller.close();
        } catch {
          // The runtime already tore the controller down — nothing to report.
        }
      };

      node.on('data', (chunk: string | Buffer) => {
        if (finished) return;
        try {
          // The stream is opened without an encoding, so chunks are Buffers;
          // the string branch exists only to satisfy the shared event type.
          controller.enqueue(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk));
          // Respect the consumer's appetite instead of buffering the whole file.
          if ((controller.desiredSize ?? 1) <= 0) node.pause();
        } catch {
          finish();
        }
      });
      node.on('end', () => finish());
      node.on('error', (e) => finish(e));

      if (signal.aborted) finish();
      else signal.addEventListener('abort', () => finish(), { once: true });
    },
    pull() {
      node.resume();
    },
    cancel() {
      node.destroy();
    },
  });
}

/**
 * Public media serving (photos + the event video). The id is a UUID looked up
 * in the database; the file path is built exclusively from stored values, so
 * no request input can reach the filesystem.
 *
 * Videos additionally honor HTTP Range requests (single "bytes=" range) — the
 * browser needs 206 responses to seek — and are streamed from disk instead of
 * being buffered whole.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = getMediaById(id);
  if (!media) return new NextResponse('Not found', { status: 404 });
  const filePath = mediaFilePath(media);

  if (media.mime.startsWith('video/')) {
    let size: number;
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) throw new Error('not a file');
      size = stat.size;
    } catch {
      return new NextResponse('Not found', { status: 404 });
    }

    // Single-range parsing: "bytes=start-end", "bytes=start-", or "bytes=-suffix".
    // Anything else (multi-range, malformed) falls back to a full 200 response,
    // which is always a valid answer to a Range request.
    const rangeHeader = req.headers.get('range');
    const match = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()) : null;
    if (match && (match[1] !== '' || match[2] !== '')) {
      let start: number;
      let end: number;
      if (match[1] === '') {
        // Suffix form: the last N bytes.
        const suffix = Number(match[2]);
        start = size - suffix;
        end = size - 1;
      } else {
        start = Number(match[1]);
        end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
      }
      if (start < 0) start = 0;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) {
        return new NextResponse('Range not satisfiable', {
          status: 416,
          headers: { ...videoHeaders(media.mime), 'Content-Range': `bytes */${size}` },
        });
      }
      return new Response(fileStream(filePath, req.signal, { start, end }), {
        status: 206,
        headers: {
          ...videoHeaders(media.mime),
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': String(end - start + 1),
        },
      });
    }

    return new Response(fileStream(filePath, req.signal), {
      status: 200,
      headers: { ...videoHeaders(media.mime), 'Content-Length': String(size) },
    });
  }

  // Photos. "?v=cover|avatar|card" asks for the copy rendered to that slot's
  // exact shape (see lib/imageVariants), cropped where the organizer positioned
  // it if they positioned it at all. An unknown or failed variant falls back to
  // the original, which is always a valid image.
  //
  // "?c=" may also be present: it is the framing's cache stamp (lib/events
  // cropTag), read by nobody here — the crop below comes from the database, so
  // a fiddled stamp can only ever cost a re-render of the same picture.
  let servePath = filePath;
  let serveMime: string = media.mime;

  const requested = new URL(req.url).searchParams.get('v');
  if (requested && isVariantName(requested)) {
    // A framing that cannot be read (missing, malformed) resolves to null, and
    // the automatic crop takes over — the picture always renders.
    const slot = SLOT_BY_VARIANT[requested];
    const crop = slot ? getCropForSlot(media.id, slot) : null;
    const variant = await getVariant(media, requested, crop);
    if (variant) {
      servePath = variant.filePath;
      serveMime = variant.mime;
    }
  }

  try {
    const bytes = fs.readFileSync(servePath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': serveMime,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
