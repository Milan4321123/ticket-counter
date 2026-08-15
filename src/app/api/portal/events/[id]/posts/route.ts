import { NextResponse } from 'next/server';
import { createEventPost, deleteEventPost, getMediaById } from '@/lib/events';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import type { ApiErrorResponse } from '@/lib/types';
import type { EventRow } from '@/lib/events';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../auth';

const MAX_BODY = 2000;

/** Friendly validation failure — message goes straight to the UI. */
class ValidationError extends Error {}

function need(cond: boolean, message: string): asserts cond {
  if (!cond) throw new ValidationError(message);
}

/** Shared guard chain + body parsing for both verbs on this route. */
async function guardedEvent(
  id: string
): Promise<{ event: EventRow; failure: null } | { event: null; failure: NextResponse }> {
  const auth = await requireOrganizerApi();
  if (auth.failure) return { event: null, failure: auth.failure };
  const { organizer } = auth;

  const blocked = planGate(organizer);
  if (blocked) return { event: null, failure: blocked };

  const owned = requireOwnedEvent(organizer, id);
  if (owned.failure) return { event: null, failure: owned.failure };

  need(
    owned.event.status !== 'archived',
    'This event has been archived by the platform and can no longer be changed.'
  );
  return { event: owned.event, failure: null };
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await readJsonLimited(req, 64 * 1024);
    need(Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed), 'Nothing to save.');
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof BodyTooLargeError || e instanceof ValidationError) throw e;
    throw new ValidationError('Nothing to save.');
  }
}

/** Publish an update post on the event page. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const guarded = await guardedEvent(id);
    if (guarded.failure) return guarded.failure;
    const { event } = guarded;

    const body = await parseBody(req);

    need(typeof body.body === 'string', 'The update text is missing.');
    const text = body.body.trim();
    need(text.length > 0, 'Write something first — the update text is empty.');
    need(text.length <= MAX_BODY, `Updates can be at most ${MAX_BODY} characters.`);

    // An update can carry one attachment from the event's own media — a photo
    // OR a video. Ownership is what matters, not the type.
    let mediaId: string | null = null;
    if ('mediaId' in body && body.mediaId !== null && body.mediaId !== '') {
      need(typeof body.mediaId === 'string', 'Invalid attachment choice.');
      const media = getMediaById(body.mediaId);
      need(media !== null && media.eventId === event.id, 'That photo or video does not belong to this event.');
      mediaId = media.id;
    }

    const post = createEventPost(event.id, text, mediaId);
    return NextResponse.json({
      ok: true,
      post: { id: post.id, body: post.body, mediaId: post.mediaId, createdAt: post.createdAt },
    });
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
    }
    console.error(`POST /api/portal/events/${id}/posts failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}

/** Take an update post down again. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const guarded = await guardedEvent(id);
    if (guarded.failure) return guarded.failure;
    const { event } = guarded;

    const body = await parseBody(req);
    need(typeof body.postId === 'string' && body.postId.length > 0, 'Which update should be deleted?');

    const deleted = deleteEventPost(event.id, body.postId);
    if (!deleted) {
      return NextResponse.json(
        { error: 'That update no longer exists.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
    }
    console.error(`DELETE /api/portal/events/${id}/posts failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
