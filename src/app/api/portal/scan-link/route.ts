import { NextResponse } from 'next/server';
import { bumpScanEpoch, createScanToken } from '@/lib/auth';
import { getBaseUrl } from '@/lib/config';
import { getEventById } from '@/lib/events';
import { currentOrganizer } from '@/lib/organizers';
import { ticketQrDataUrl } from '@/lib/tickets';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Create a door-scanner access link for ONE of the signed-in ORGANIZER'S OWN
 * events. Same link format as the platform-admin version: the key rides in
 * the URL fragment (#k=...) so it never appears in server or proxy logs, and
 * the /scan page exchanges it for a scanner-only cookie scoped to this event.
 */
export async function POST(req: Request) {
  try {
    const organizer = await currentOrganizer();
    if (!organizer) {
      return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
    }
    let hours = 24;
    let eventId = '';
    try {
      const body = (await req.json()) as { eventId?: unknown; hours?: unknown };
      if (typeof body?.hours === 'number' && Number.isFinite(body.hours)) hours = body.hours;
      if (typeof body?.eventId === 'string') eventId = body.eventId;
    } catch {
      // defaults stay
    }
    // Ownership check: an organizer can only hand out scanner access to
    // events they own.
    const event = eventId ? getEventById(eventId) : null;
    if (!event || event.organizerId !== organizer.id) {
      return NextResponse.json(
        { error: 'Please choose one of your own events for this scanner link.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }
    hours = Math.min(Math.max(Math.round(hours), 1), 24 * 7);
    const token = createScanToken(event.id, hours);
    const url = `${getBaseUrl()}/scan#k=${token}`;
    // QR of the link itself: door staff scan it off the organizer's screen.
    const qrDataUrl = await ticketQrDataUrl(url);
    return NextResponse.json({ url, hours, qrDataUrl });
  } catch (e) {
    console.error('POST /api/portal/scan-link failed:', e);
    return NextResponse.json({ error: 'Could not create the link.' } satisfies ApiErrorResponse, { status: 500 });
  }
}

/**
 * Revoke every scanner link/cookie for ONE of the organizer's own events
 * (per-event epoch bump — other events' door staff are unaffected).
 */
export async function DELETE(req: Request) {
  try {
    const organizer = await currentOrganizer();
    if (!organizer) {
      return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
    }
    let eventId = '';
    try {
      const body = (await req.json()) as { eventId?: unknown };
      if (typeof body?.eventId === 'string') eventId = body.eventId;
    } catch {
      // handled below
    }
    const event = eventId ? getEventById(eventId) : null;
    if (!event || event.organizerId !== organizer.id) {
      return NextResponse.json(
        { error: 'Please choose one of your own events.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }
    bumpScanEpoch(event.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/portal/scan-link failed:', e);
    return NextResponse.json({ error: 'Could not revoke the links.' } satisfies ApiErrorResponse, { status: 500 });
  }
}
