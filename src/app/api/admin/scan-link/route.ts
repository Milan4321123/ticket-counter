import { NextResponse } from 'next/server';
import { bumpScanEpoch, createScanToken, isAdminRequest } from '@/lib/auth';
import { getBaseUrl } from '@/lib/config';
import { getEventById, listAllEvents } from '@/lib/events';
import { ticketQrDataUrl } from '@/lib/tickets';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Create a door-scanner access link for ONE event (platform admin — any
 * event). The key is carried in the URL FRAGMENT (#k=...) so it never appears
 * in server or proxy logs; the /scan page exchanges it for a scanner-only
 * cookie that can check in that event's tickets and nothing else.
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdminRequest())) {
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
    const event = eventId ? getEventById(eventId) : null;
    if (!event) {
      return NextResponse.json(
        { error: 'Please choose which event this scanner link is for.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    hours = Math.min(Math.max(Math.round(hours), 1), 24 * 7);
    const token = createScanToken(event.id, hours);
    const url = `${getBaseUrl()}/scan#k=${token}`;
    // QR of the link itself: door staff scan it off the organizer's screen.
    const qrDataUrl = await ticketQrDataUrl(url);
    return NextResponse.json({ url, hours, qrDataUrl });
  } catch (e) {
    console.error('POST /api/admin/scan-link failed:', e);
    return NextResponse.json({ error: 'Could not create the link.' } satisfies ApiErrorResponse, { status: 500 });
  }
}

/**
 * Revoke scanner links (epoch bump). With {eventId} in the body only that
 * event's links die; without one this is the break-glass "revoke everything
 * everywhere" — every event's epoch is bumped.
 */
export async function DELETE(req: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
    }
    let eventId = '';
    try {
      const body = (await req.json()) as { eventId?: unknown };
      if (typeof body?.eventId === 'string') eventId = body.eventId;
    } catch {
      // no body = revoke everything
    }
    if (eventId) {
      const event = getEventById(eventId);
      if (!event) {
        return NextResponse.json({ error: 'That event does not exist.' } satisfies ApiErrorResponse, { status: 404 });
      }
      bumpScanEpoch(event.id);
    } else {
      for (const event of listAllEvents()) bumpScanEpoch(event.id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/admin/scan-link failed:', e);
    return NextResponse.json({ error: 'Could not revoke the links.' } satisfies ApiErrorResponse, { status: 500 });
  }
}
