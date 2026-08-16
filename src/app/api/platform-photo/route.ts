import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

/**
 * Serves the platform contact photo. Public by design — it is a face shown on
 * every page — and a single fixed file, so there is no id to guess and nothing
 * to enumerate.
 */
export async function GET(req: Request) {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  // Only our own UUID shape is accepted, so nothing here can traverse a path.
  const post = new URL(req.url).searchParams.get('post');
  const name = post && /^[0-9a-f-]{36}$/i.test(post) ? `post-${post}.jpg` : 'contact.jpg';
  const file = path.join(dataDir, 'platform', name);
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(file);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'content-type': 'image/jpeg',
      // The URL carries a ?v= stamp that changes on every upload, so this can
      // be cached hard without ever showing a stale face.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
