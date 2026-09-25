import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { setEventWhatsappPhoto } from '@/lib/events';
import type { ApiErrorResponse } from '@/lib/types';
import { clientIp } from '@/lib/ratelimit';
import { planGate, requireOrganizerApi, requireOwnedEvent, demoPhotoGate } from '../../../auth';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Formats we accept, decided by what the BYTES are — never by the Content-Type
 * on the multipart part, which is attacker-controlled text. A whitelist rather
 * than a blocklist, so a vector (svg) or an animation (gif) sharp happens to be
 * able to decode can never reach the resizer: rasterising an SVG that declares
 * enormous dimensions is a cheap way to make a server allocate a lot of memory.
 * The same rule lib/media.ts applies to gallery uploads.
 */
const ALLOWED_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp']);

function photoPath(eventId: string): string {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  return path.join(dataDir, 'events', `whatsapp-${eventId}.jpg`);
}

/**
 * The face on this event's WhatsApp bubble.
 *
 * Its own file rather than an event_media row, because the event page builds
 * its public gallery from every photo in that table — a headshot uploaded for a
 * chat bubble would end up in the gallery beside the poster. Keeping it out of
 * there also keeps it out of the event's photo quota, which is for the artwork
 * people came to look at.
 *
 * Re-encoded to a bounded JPEG on arrival rather than stored as sent: the bubble
 * is a 46px circle, so a 5 MB portrait would be five megabytes fetched to fill a
 * thumbnail. Bounded with `fit: 'inside'` and NOT cropped square — cropping here
 * would throw away the edges of a portrait that is not already square, and you
 * cannot get discarded pixels back.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;
    // Demos may add photos, within a limit (they go with the demo after 24 h).
    const demoBlocked = demoPhotoGate(organizer, clientIp(req));
    if (demoBlocked) return demoBlocked;

    const owned = requireOwnedEvent(organizer, id);
    if (owned.failure) return owned.failure;
    const { event } = owned;

    if (event.status === 'archived') {
      return NextResponse.json(
        { error: 'This event has been archived by the platform and can no longer be changed.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    const form = await req.formData();
    const file = form.get('photo');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a photo first.' } satisfies ApiErrorResponse, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'That file is empty.' } satisfies ApiErrorResponse, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Photos can be at most 5 MB.' } satisfies ApiErrorResponse, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // Header only — metadata() does not decode the pixels, so this stays cheap
    // even for the pathological files it exists to reject.
    let format = '';
    try {
      format = String((await sharp(bytes).metadata()).format ?? '');
    } catch {
      return NextResponse.json(
        { error: 'That file does not look like a real photo — please re-save it and try again.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    if (!ALLOWED_FORMATS.has(format)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG and WebP photos are supported — please re-save it as one of those.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    const target = photoPath(event.id);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await sharp(bytes)
      .rotate() // honour EXIF orientation, or portraits arrive on their side
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(target);

    // The file path never changes, so the URL carries a stamp: without one a
    // replaced photo would keep showing the old face until every visitor who had
    // seen it cleared their cache.
    const url = `/api/event-photo?whatsapp=${event.id}&v=${Date.now()}`;
    setEventWhatsappPhoto(event.id, url);
    return NextResponse.json({ ok: true, photoUrl: url });
  } catch (e) {
    console.error(`POST /api/portal/events/${id}/whatsapp-photo failed:`, e);
    return NextResponse.json(
      { error: 'That image could not be processed. Please try another.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}

/** Remove it again — the bubble falls back to an initial. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const owned = requireOwnedEvent(auth.organizer, id);
    if (owned.failure) return owned.failure;

    // The row is cleared first. If the unlink fails the file is orphaned, which
    // is invisible; if it were the other way round a failed clear would leave a
    // URL pointing at nothing, which a visitor would see as a broken image.
    setEventWhatsappPhoto(owned.event.id, '');
    try {
      fs.unlinkSync(photoPath(owned.event.id));
    } catch {
      /* already gone */
    }
    return NextResponse.json({ ok: true, photoUrl: '' });
  } catch (e) {
    console.error(`DELETE /api/portal/events/${id}/whatsapp-photo failed:`, e);
    return NextResponse.json(
      { error: 'That could not be removed. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
