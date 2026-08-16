import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { isAdminRequest } from '@/lib/auth';
import { setPlatformContact, setPlatformPostPhoto } from '@/lib/platformPosts';
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

/** One announcement's picture. The id is a UUID we generated, never user input. */
function postPhotoPath(postId: string): string {
  return path.join(photoDir(), `post-${postId}.jpg`);
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

    // A postId means "picture for this announcement"; without one it is the face
    // on the contact bubble. Only our own UUIDs are ever accepted, so the id can
    // never walk out of the directory.
    const rawPostId = form.get('postId');
    const postId = typeof rawPostId === 'string' && /^[0-9a-f-]{36}$/i.test(rawPostId) ? rawPostId : null;

    const bytes = Buffer.from(await file.arrayBuffer());
    fs.mkdirSync(photoDir(), { recursive: true });

    // The face is a 46px circle, so it is squared. An announcement picture is a
    // banner read at full width, so it keeps its shape and is merely bounded —
    // squaring somebody's poster would be the crop bug all over again.
    const pipeline = sharp(bytes).rotate();
    if (postId) {
      await pipeline
        .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(postPhotoPath(postId));
    } else {
      await pipeline
        // 'inside', NOT a square crop. Cropping here would throw away the
        // parts of the photo the focus control exists to bring back — you
        // cannot reposition pixels that were discarded on arrival.
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 86, mozjpeg: true })
        .toFile(contactPhotoPath());
    }

    // A fixed path with a cache-busting stamp: the path never changes, so
    // without one a replaced photo would keep showing the old picture until
    // every visitor cleared their cache.
    const url = postId
      ? `/api/platform-photo?post=${postId}&v=${Date.now()}`
      : `/api/platform-photo?v=${Date.now()}`;
    if (postId) setPlatformPostPhoto(postId, url);
    else setPlatformContact({ photoUrl: url });
    return NextResponse.json({ ok: true, photoUrl: url });
  } catch (e) {
    console.error('POST /api/admin/contact-photo failed:', e);
    return NextResponse.json(
      { error: 'That image could not be processed. Please try another.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
