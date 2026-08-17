import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

/** Our own UUIDs, and only those, ever reach the filesystem. */
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Serves an event's WhatsApp-bubble photo.
 *
 * Public by design — it is a face shown on a public event page — so there is no
 * authorization here. What there IS is a hard constraint on the name: the id
 * must match our own UUID shape, and the filename is then built from a fixed
 * prefix and suffix, so nothing a caller sends can climb out of the directory or
 * name a file we did not write.
 *
 * Separate from /api/media/[id] because that route serves rows of event_media,
 * and this photo deliberately is not one — see the whatsapp-photo upload route.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('whatsapp');
  if (!id || !UUID.test(id)) return new NextResponse(null, { status: 404 });

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(path.join(dataDir, 'events', `whatsapp-${id}.jpg`));
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'content-type': 'image/jpeg',
      // The URL carries a ?v= stamp that changes on every upload, so this can be
      // cached hard without ever showing a stale face.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
