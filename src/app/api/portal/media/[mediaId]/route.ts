import { NextResponse } from 'next/server';
import { getMediaById } from '@/lib/events';
import { deleteEventPhoto } from '@/lib/media';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../auth';

/** Delete one event photo. The photo must belong to an event this organizer owns. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    const media = getMediaById(mediaId);
    if (!media) {
      return NextResponse.json(
        { error: 'That photo is already gone.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }
    // Ownership: the photo's event must belong to this organizer. A photo on
    // someone else's event answers exactly like a missing one.
    const owned = requireOwnedEvent(organizer, media.eventId);
    if (owned.failure) {
      return NextResponse.json(
        { error: 'That photo is already gone.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }

    deleteEventPhoto(media);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`DELETE /api/portal/media/${mediaId} failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
