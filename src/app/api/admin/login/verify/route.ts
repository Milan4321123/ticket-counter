import { NextResponse } from 'next/server';
import {
  createSessionToken,
  isPreauthRequest,
  COOKIE_NAME,
  PREAUTH_COOKIE_NAME,
  SESSION_TTL_MS,
} from '@/lib/auth';
import { verifyMasterOtp, verifyOtpCode } from '@/lib/otp';
import { verifyTotp } from '@/lib/totp';
import { clientIp, isRateLimited, recordStrike } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';

const VERIFY_FAILURE_LIMIT = 10;
const VERIFY_FAILURE_WINDOW_MS = 15 * 60_000;
// Global backstop: even across many rotated/real IPs, at most this many wrong
// code guesses land per window in total — so a distributed attempt can never
// grind through the 1,000,000-code space regardless of source IP diversity.
const GLOBAL_VERIFY_KEY = 'admin-verify:all';
const GLOBAL_VERIFY_LIMIT = 60;

/** Step 2 of the admin sign-in: check the emailed one-time code. */
export async function POST(req: Request) {
  try {
    const limiterKey = `admin-verify:${clientIp(req)}`;
    if (isRateLimited(limiterKey, VERIFY_FAILURE_LIMIT) || isRateLimited(GLOBAL_VERIFY_KEY, GLOBAL_VERIFY_LIMIT)) {
      return NextResponse.json(
        { error: 'Too many attempts — please wait 15 minutes and start again.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    if (!(await isPreauthRequest())) {
      return NextResponse.json(
        { error: 'Your sign-in session expired — please enter the password again.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    let code = '';
    try {
      const body = (await req.json()) as { code?: unknown };
      if (typeof body?.code === 'string') code = body.code;
    } catch {
      // Malformed body -> wrong code below.
    }

    // Accept the stateless codes first (authenticator app, then the optional
    // ADMIN_MASTER_OTP tester code): trying them never consumes the emailed
    // code's limited attempts. Falls through to the emailed/texted code
    // otherwise — any of them is accepted.
    const statelessOk = verifyTotp(code) || verifyMasterOtp(code);
    const verdict = statelessOk ? 'ok' : verifyOtpCode(code);
    if (verdict === 'ok') {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(COOKIE_NAME, createSessionToken(), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      });
      res.cookies.set(PREAUTH_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
      return res;
    }

    recordStrike(limiterKey, VERIFY_FAILURE_WINDOW_MS);
    recordStrike(GLOBAL_VERIFY_KEY, VERIFY_FAILURE_WINDOW_MS);
    const message =
      verdict === 'expired'
        ? 'That code has expired — request a new one.'
        : verdict === 'too_many'
          ? 'Too many wrong codes — request a new one.'
          : 'Wrong code — check the email and try again.';
    return NextResponse.json({ error: message, verdict } as ApiErrorResponse & { verdict: string }, {
      status: verdict === 'wrong' ? 401 : 410,
    });
  } catch (e) {
    console.error('POST /api/admin/login/verify failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
