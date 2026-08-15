import { NextResponse } from 'next/server';
import { scanTokenRemainingSeconds, verifyScanToken, SCAN_COOKIE_NAME } from '@/lib/auth';
import { getEventById } from '@/lib/events';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Exchange a scanner-link key for a scanner cookie. The key itself is the
 * credential (signed + expiring + revocable), so no other auth is required.
 */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`scan-session:${clientIp(req)}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts.' } satisfies ApiErrorResponse, { status: 429 });
    }
    let key = '';
    try {
      const body = (await req.json()) as { key?: unknown };
      if (typeof body?.key === 'string') key = body.key;
    } catch {
      // handled below
    }
    const scan = verifyScanToken(key);
    if (!scan) {
      return NextResponse.json(
        { error: 'This scanner link is invalid, expired, or has been revoked — ask the organizer for a new one.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }
    // Tell the scanner page which event this link is scoped to, so door staff
    // can see at a glance they hold the right link.
    const event = getEventById(scan.eventId);
    const res = NextResponse.json({ ok: true, eventName: event?.name ?? null });
    res.cookies.set(SCAN_COOKIE_NAME, key, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: scanTokenRemainingSeconds(key),
    });
    return res;
  } catch (e) {
    console.error('POST /api/scan/session failed:', e);
    return NextResponse.json({ error: 'Something went wrong.' } satisfies ApiErrorResponse, { status: 500 });
  }
}
