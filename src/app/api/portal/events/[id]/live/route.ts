import { NextResponse } from 'next/server';
import { liveDoor } from '@/lib/liveDoor';
import { requireOrganizerApi, requireOwnedEvent } from '../../../auth';

export const dynamic = 'force-dynamic';

/** The live event-day numbers for one of this organizer's listings. Polled by the live screen. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireOrganizerApi();
  if (auth.failure) return auth.failure;
  const owned = requireOwnedEvent(auth.organizer, id);
  if (owned.failure) return owned.failure;
  return NextResponse.json(liveDoor(owned.event.id, owned.event.totalCapacity), { headers: { 'Cache-Control': 'no-store' } });
}
