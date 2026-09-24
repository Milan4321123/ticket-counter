import { NextResponse } from 'next/server';
import { mediaUrl } from '@/lib/events';
import { allowedImageMime, saveEventPhoto, MAX_IMAGE_BYTES } from '@/lib/media';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent, demoGate } from '../../../auth';

/**
 * Upload one event photo (multipart form, field name "file"). Ownership is
 * verified before anything is read; size and type are enforced both here and
 * inside saveEventPhoto.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;
    const demoBlocked = demoGate(organizer, 'uploading photos');
    if (demoBlocked) return demoBlocked;

    const owned = requireOwnedEvent(organizer, id);
    if (owned.failure) return owned.failure;
    const { event } = owned;

    // Cheap early rejection when the header admits the body is too big — but
    // the header can lie (or be absent on a chunked body), so the REAL limit
    // is enforced below on the bytes as they stream in.
    const declared = Number(req.headers.get('content-length') || '');
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES + 64 * 1024) {
      return NextResponse.json(
        { error: 'Photos can be at most 5 MB.' } satisfies ApiErrorResponse,
        { status: 413 }
      );
    }

    if (!req.body) {
      return NextResponse.json(
        { error: 'The upload did not come through — please try again.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    // Stream the body ourselves and abort the moment it exceeds the photo cap
    // (plus 1 MB slack for the multipart envelope) — a lying Content-Length
    // can never make us buffer an arbitrarily large upload.
    const hardCap = MAX_IMAGE_BYTES + 1024 * 1024;
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    let overflow = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > hardCap) {
        overflow = true;
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
    if (overflow) {
      return NextResponse.json(
        { error: 'Photos can be at most 5 MB.' } satisfies ApiErrorResponse,
        { status: 413 }
      );
    }
    if (total === 0) {
      return NextResponse.json(
        { error: 'The upload did not come through — please try again.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    const bodyBytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bodyBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    let form: FormData;
    try {
      // Re-parse the buffered (size-checked) bytes as multipart form data.
      form = await new Request('http://internal/upload', {
        method: 'POST',
        headers: { 'content-type': req.headers.get('content-type') ?? '' },
        body: bodyBytes,
      }).formData();
    } catch {
      return NextResponse.json(
        { error: 'The upload did not come through — please try again.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Please choose a photo to upload.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    if (!allowedImageMime(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, and WebP photos are supported.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'Photos can be at most 5 MB.' } satisfies ApiErrorResponse,
        { status: 413 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      const media = await saveEventPhoto(event.id, file.type, bytes);
      return NextResponse.json({ ok: true, media: { id: media.id, url: mediaUrl(media.id) } });
    } catch (e) {
      // saveEventPhoto's messages are already friendly (size/type/photo cap).
      const message = e instanceof Error ? e.message : 'The photo could not be saved — please try again.';
      return NextResponse.json({ error: message } satisfies ApiErrorResponse, { status: 400 });
    }
  } catch (e) {
    console.error(`POST /api/portal/events/${id}/media failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
