import { NextResponse } from 'next/server';
import { getEventVideos, getMediaById, mediaUrl } from '@/lib/events';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import {
  allowedVideoMime,
  deleteEventVideo,
  saveEventVideo,
  MAX_VIDEO_BYTES,
  MAX_VIDEOS_PER_EVENT,
} from '@/lib/media';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent, demoGate } from '../../../auth';

const TOO_BIG = 'Videos can be at most 60 MB — compress it and try again.';

/**
 * Sniff the file's magic bytes and require them to match the DECLARED mime —
 * a renamed .exe or .mkv gets rejected even if the browser lies about type.
 *  - MP4: "ftyp" brand marker at byte offset 4.
 *  - WebM: EBML header 0x1A45DFA3 at offset 0.
 */
function magicBytesMatch(mime: string, bytes: Buffer): boolean {
  if (mime === 'video/mp4') return bytes.length >= 12 && bytes.toString('latin1', 4, 8) === 'ftyp';
  if (mime === 'video/webm') {
    return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  return false;
}

/**
 * Upload one event video (multipart form, field name "file"). Videos are an
 * ordered collection like photos — this appends, up to MAX_VIDEOS_PER_EVENT,
 * and replaces nothing. Same guard chain as every other portal event route:
 * signed-in organizer, active plan, owns the event, event not archived. Size
 * is enforced on the streamed bytes (a lying Content-Length can't make us
 * buffer more than the cap), and the type is checked twice: declared mime AND
 * magic-byte sniff.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;
    const demoBlocked = demoGate(organizer, 'uploading videos');
    if (demoBlocked) return demoBlocked;

    const owned = requireOwnedEvent(organizer, id);
    if (owned.failure) return owned.failure;
    const { event } = owned;

    if (event.status === 'archived') {
      return NextResponse.json(
        {
          error: 'This event has been archived by the platform and can no longer be changed.',
        } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    // Refuse before reading a single byte when the collection is already full
    // (saveEventVideo re-checks — this just saves the organizer an upload).
    if (getEventVideos(event.id).length >= MAX_VIDEOS_PER_EVENT) {
      return NextResponse.json(
        {
          error: `An event can have at most ${MAX_VIDEOS_PER_EVENT} videos — delete one first.`,
        } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    // Cheap early rejection when the header admits the body is too big — but
    // the header can lie (or be absent on a chunked body), so the REAL limit
    // is enforced below on the bytes as they stream in.
    const declared = Number(req.headers.get('content-length') || '');
    if (Number.isFinite(declared) && declared > MAX_VIDEO_BYTES + 64 * 1024) {
      // Discard the rest instead of answering mid-upload and walking away:
      // leaving a huge body unread lets Next.js hit its own body cap and close
      // the stream we never touched, which surfaces as an uncaughtException.
      await req.body?.cancel().catch(() => {});
      return NextResponse.json({ error: TOO_BIG } satisfies ApiErrorResponse, { status: 413 });
    }

    if (!req.body) {
      return NextResponse.json(
        { error: 'The upload did not come through — please try again.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    // Stream the body ourselves and abort the moment it exceeds the video cap
    // (plus 2 MB slack for the multipart envelope) — same counting-reader
    // pattern as the photo upload route.
    const hardCap = MAX_VIDEO_BYTES + 2 * 1024 * 1024;
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
      return NextResponse.json({ error: TOO_BIG } satisfies ApiErrorResponse, { status: 413 });
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
    } catch (e) {
      // A truncated body lands here ("expected boundary after body"). Next.js
      // caps request bodies at experimental.middlewareClientMaxBodySize when a
      // middleware exists — that value must stay above MAX_VIDEO_BYTES or every
      // large upload dies here with a confusing "did not come through".
      console.error(`Video upload multipart parse failed (${total} bytes):`, e);
      return NextResponse.json(
        { error: 'The upload did not come through — please try again.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Please choose a video to upload.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    if (!allowedVideoMime(file.type)) {
      return NextResponse.json(
        { error: 'Only MP4 and WebM videos are supported.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: TOO_BIG } satisfies ApiErrorResponse, { status: 413 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!magicBytesMatch(file.type, bytes)) {
      return NextResponse.json(
        {
          error: 'That file does not look like a real MP4/WebM video — please re-export it and try again.',
        } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    try {
      const media = saveEventVideo(event.id, file.type, bytes);
      return NextResponse.json({
        ok: true,
        media: { id: media.id, url: mediaUrl(media.id), mime: media.mime, sort: media.sort },
      });
    } catch (e) {
      // saveEventVideo's messages are already friendly (size/type).
      const message = e instanceof Error ? e.message : 'The video could not be saved — please try again.';
      return NextResponse.json({ error: message } satisfies ApiErrorResponse, { status: 400 });
    }
  } catch (e) {
    console.error(`POST /api/portal/events/${id}/video failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}

/**
 * Remove one uploaded video (file + row). Send {"mediaId": "..."} to pick
 * which one — the row must belong to THIS event. With no body the legacy
 * behaviour applies and the event's current video_media_id is removed. The
 * legacy pointer then moves to the next remaining video.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    const owned = requireOwnedEvent(organizer, id);
    if (owned.failure) return owned.failure;
    const { event } = owned;

    if (event.status === 'archived') {
      return NextResponse.json(
        {
          error: 'This event has been archived by the platform and can no longer be changed.',
        } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    // Which video? An explicit id targets one of several; no body at all keeps
    // the old "remove the event's video" behaviour working.
    let mediaId: string | undefined;
    try {
      const parsed = await readJsonLimited(req, 16 * 1024);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const raw = (parsed as Record<string, unknown>).mediaId;
        if (typeof raw === 'string' && raw.trim() !== '') mediaId = raw.trim();
      }
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      // Empty/unparsable body — fall through to the legacy path.
    }

    if (mediaId) {
      // Ownership: a video on someone else's event answers exactly like a
      // missing one, so this never confirms that another event's id exists.
      const media = getMediaById(mediaId);
      if (!media || media.eventId !== event.id || !media.mime.startsWith('video/')) {
        return NextResponse.json(
          { error: 'That video is already gone.' } satisfies ApiErrorResponse,
          { status: 404 }
        );
      }
    }

    deleteEventVideo(event.id, mediaId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`DELETE /api/portal/events/${id}/video failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
