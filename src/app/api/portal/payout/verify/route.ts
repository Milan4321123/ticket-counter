import { NextResponse } from 'next/server';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { checkOrganizerCredentials } from '@/lib/organizers';
import { verifyOrganizerTotp } from '@/lib/organizerTotp';
import { PAYOUT_STEP_UP_COOKIE, STEP_UP_TTL_MS, createStepUpToken } from '@/lib/payoutStepUp';
import { clientIp, isRateLimited, recordStrike } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi } from '../../auth';
import { payoutStepUpChallenge } from '../method';

export const dynamic = 'force-dynamic';

/**
 * Six digits is a million possibilities, and the authenticator's code is valid
 * for about ninety seconds — so the limit, not the length, is what makes the
 * code worth anything. Per-IP and global counters, and ONLY failures count, so
 * fumbling one digit costs nothing.
 */
const FAILURE_LIMIT = 6;
const FAILURE_WINDOW_MS = 15 * 60_000;
const GLOBAL_FAILURE_KEY = 'payout-step-up:all';
const GLOBAL_FAILURE_LIMIT = 60;

/**
 * Finish the check and hand back a step-up cookie.
 *
 * The factor is decided HERE, from the account, and never read from the request:
 * letting the caller name its own method would let an enrolled account ask to be
 * challenged by password instead — a downgrade to the weakest rung, requested by
 * exactly the person the check exists to stop.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    const limiterKey = `payout-step-up:${clientIp(req)}`;
    if (isRateLimited(limiterKey, FAILURE_LIMIT) || isRateLimited(GLOBAL_FAILURE_KEY, GLOBAL_FAILURE_LIMIT)) {
      return NextResponse.json(
        { error: 'Too many wrong answers — please wait 15 minutes and try again.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    let code = '';
    let password = '';
    try {
      const body = (await readJsonLimited(req)) as { code?: unknown; password?: unknown };
      if (typeof body?.code === 'string') code = body.code;
      if (typeof body?.password === 'string') password = body.password;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
    }

    const { method } = payoutStepUpChallenge(organizer);

    let ok = false;
    let failure: string;
    if (method === 'authenticator') {
      ok = verifyOrganizerTotp(organizer.id, code);
      failure = 'That code is not right. Check your authenticator app — the code changes every 30 seconds.';
    } else {
      ok = Boolean(password) && checkOrganizerCredentials(organizer.email, password) !== null;
      failure = 'That password is not right.';
    }

    if (!ok) {
      recordStrike(limiterKey, FAILURE_WINDOW_MS);
      recordStrike(GLOBAL_FAILURE_KEY, FAILURE_WINDOW_MS);
      return NextResponse.json({ error: failure } satisfies ApiErrorResponse, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(PAYOUT_STEP_UP_COOKIE, createStepUpToken(organizer.id), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: Math.floor(STEP_UP_TTL_MS / 1000),
    });
    return res;
  } catch (e) {
    console.error('POST /api/portal/payout/verify failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
