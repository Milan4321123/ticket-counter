import { NextResponse } from 'next/server';
import { getEventTiers } from '@/lib/events';
import { sendOrderReadyEmail } from '@/lib/email';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { KITCHEN_STATUSES, listKitchenTickets, parseSlotConfig, setKitchenStatus, type KitchenStatus } from '@/lib/kitchen';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../auth';

export const dynamic = 'force-dynamic';

/** The live kitchen board for one of this seller's shops. Polled every few seconds by the board. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireOrganizerApi();
  if (auth.failure) return auth.failure;
  const owned = requireOwnedEvent(auth.organizer, id);
  if (owned.failure) return owned.failure;
  const tickets = listKitchenTickets(owned.event, getEventTiers(owned.event.id));
  return NextResponse.json({ tickets, at: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Move one order on the board: { orderId, status }. Ready sends the buyer one email. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireOrganizerApi();
  if (auth.failure) return auth.failure;
  const blocked = planGate(auth.organizer);
  if (blocked) return blocked;
  const owned = requireOwnedEvent(auth.organizer, id);
  if (owned.failure) return owned.failure;

  let body: { orderId?: unknown; status?: unknown };
  try {
    body = ((await readJsonLimited(req)) ?? {}) as typeof body;
  } catch (e) {
    const tooBig = e instanceof BodyTooLargeError;
    return NextResponse.json({ error: tooBig ? 'That request was too large.' : 'Nothing to save.' } satisfies ApiErrorResponse, {
      status: tooBig ? 413 : 400,
    });
  }
  const status = body.status as KitchenStatus;
  if (typeof body.orderId !== 'string' || !KITCHEN_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'That change does not look right.' } satisfies ApiErrorResponse, { status: 400 });
  }
  if (!setKitchenStatus(owned.event.id, body.orderId, status)) {
    return NextResponse.json({ error: 'We could not find that order.' } satisfies ApiErrorResponse, { status: 404 });
  }
  // "Ready to collect" means nothing for an appointment, so no email there.
  if (status === 'ready' && parseSlotConfig(owned.event.pickupSlots).purpose !== 'appointment') {
    void sendOrderReadyEmail(body.orderId).catch((e) => console.error('Order-ready email threw:', e));
  }
  return NextResponse.json({ ok: true });
}
