import { NextResponse } from 'next/server';
import { bumpScanEpoch, createScanToken, isAdminRequest } from '@/lib/auth';
import { getBaseUrl } from '@/lib/config';
import { ticketQrDataUrl } from '@/lib/tickets';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Create a door-scanner access link. The key is carried in the URL FRAGMENT
 * (#k=...) so it never appears in server or proxy logs; the /scan page
 * exchanges it for a scanner-only cookie.
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
    }
    let hours = 24;
    try {
      const body = (await req.json()) as { hours?: unknown };
      if (typeof body?.hours === 'number' && Number.isFinite(body.hours)) hours = body.hours;
    } catch {
      // default stays
    }
    hours = Math.min(Math.max(Math.round(hours), 1), 24 * 7);
    const token = createScanToken(hours);
    const url = `${getBaseUrl()}/scan#k=${token}`;
    // QR of the link itself: door staff scan it off the organizer's screen.
    const qrDataUrl = await ticketQrDataUrl(url);
    return NextResponse.json({ url, hours, qrDataUrl });
  } catch (e) {
    console.error('POST /api/admin/scan-link failed:', e);
    return NextResponse.json({ error: 'Could not create the link.' } satisfies ApiErrorResponse, { status: 500 });
  }
}

/** Revoke ALL scanner links and cookies ever issued (epoch bump). */
export async function DELETE() {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
    }
    bumpScanEpoch();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/admin/scan-link failed:', e);
    return NextResponse.json({ error: 'Could not revoke the links.' } satisfies ApiErrorResponse, { status: 500 });
  }
}
