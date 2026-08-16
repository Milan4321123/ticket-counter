import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { isAdminRequest } from '@/lib/auth';
import { setPlatformContact } from '@/lib/platformPosts';
import type { ApiErrorResponse } from '@/lib/types';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

function photoDir(): string {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  return path.join(dataDir, 'platform');
}

// NOT exported: a route file may only export HTTP handlers, and Next rejects
// the build outright otherwise. The serving route computes the same path.
function contactPhotoPath(): string {
  return path.join(photoDir(), 'contact.jpg');
}

/**
 * Upload the face shown on the "talk to a person" bubble.
 *
 * Rendered to a square 256px JPEG on arrival rather than stored as sent: the
 * bubble is a 46px circle, so a 4 MB portrait would be four megabytes fetched
 * on every page of the site to fill a thumbnail. Cropped around the subject so
 * a photo that is not already square does not lose a face to the centre.
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json(
        { error: 'Please sign in to the admin area first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    const form = await req.formData();
    const file = form.get('photo');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a photo first.' } satisfies ApiErrorResponse, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG and WebP photos are supported.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Photos can be at most 5 MB.' } satisfies ApiErrorResponse, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    fs.mkdirSync(photoDir(), { recursive: true });
    await sharp(bytes)
      // Respect the EXIF flag first, or a phone photo taken sideways is cropped
      // along the wrong axis.
      .rotate()
      .resize(256, 256, { fit: 'cover', position: sharp.strategy.attention })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(contactPhotoPath());

    // A fixed URL with a cache-busting stamp: the path never changes, so without
    // one a replaced photo would keep showing the old face until every visitor
    // cleared their cache.
    const url = `/api/platform-photo?v=${Date.now()}`;
    setPlatformContact({ photoUrl: url });
    return NextResponse.json({ ok: true, photoUrl: url });
  } catch (e) {
    console.error('POST /api/admin/contact-photo failed:', e);
    return NextResponse.json(
      { error: 'That image could not be processed. Please try another.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
