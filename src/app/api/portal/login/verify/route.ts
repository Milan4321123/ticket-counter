import { NextResponse } from 'next/server';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import {
  ORGANIZER_COOKIE_NAME,
  ORGANIZER_SESSION_TTL_MS,
  createOrganizerSessionToken,
  getOrganizer,
  verifyOrganizerPendingToken,
} from '@/lib/organizers';
import { verifyOrganizerTotp } from '@/lib/organizerTotp';
import { clientIp, isRateLimited, recordStrike } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';
import { notifySignIn } from '../../auth';

/**
 * Step two of organizer sign-in: the six digits from their authenticator app.
 *
 * A six-digit code is only 1,000,000 possibilities and it is valid for about
 * ninety seconds, so the rate limit is not a nicety here — it is the thing that
 * makes the code worth having. Both a per-IP and a global counter, and ONLY
 * wrong codes count, so somebody fumbling a digit once is not punished.
 */
const FAILURE_LIMIT = 6;
const FAILURE_WINDOW_MS = 15 * 60_000;
const GLOBAL_FAILURE_KEY = 'portal-2fa:all';
const GLOBAL_FAILURE_LIMIT = 60;

export async function POST(req: Request) {
  try {
    const limiterKey = `portal-2fa:${clientIp(req)}`;
    if (isRateLimited(limiterKey, FAILURE_LIMIT) || isRateLimited(GLOBAL_FAILURE_KEY, GLOBAL_FAILURE_LIMIT)) {
      return NextResponse.json(
        { error: 'Too many wrong codes — please wait 15 minutes and try again.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    let pendingToken = '';
    let code = '';
    try {
      const body = (await readJsonLimited(req)) as { pendingToken?: unknown; code?: unknown };
      if (typeof body?.pendingToken === 'string') pendingToken = body.pendingToken;
      if (typeof body?.code === 'string') code = body.code;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
    }

    // An expired or tampered ticket sends them back to the password step rather
    // than pretending the code was wrong — otherwise someone whose ticket timed
    // out would retype a perfectly good code forever.
    const organizerId = verifyOrganizerPendingToken(pendingToken);
    if (!organizerId) {
      return NextResponse.json(
        { error: 'That sign-in attempt has expired. Please enter your email and password again.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    const organizer = getOrganizer(organizerId);
    if (!organizer || organizer.status !== 'active') {
      return NextResponse.json(
        { error: 'This account is not available. Please contact the team.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    if (!verifyOrganizerTotp(organizerId, code)) {
      recordStrike(limiterKey, FAILURE_WINDOW_MS);
      recordStrike(GLOBAL_FAILURE_KEY, FAILURE_WINDOW_MS);
      return NextResponse.json(
        {
          error:
            'That code is not right. Check your authenticator app — the code changes every 30 seconds.',
        } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    notifySignIn(organizer, req);

    const res = NextResponse.json({ ok: true, mustChangePassword: organizer.mustChangePassword });
    res.cookies.set(ORGANIZER_COOKIE_NAME, createOrganizerSessionToken(organizerId), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: Math.floor(ORGANIZER_SESSION_TTL_MS / 1000),
    });
    return res;
  } catch (e) {
    console.error('POST /api/portal/login/verify failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
