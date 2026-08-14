import { NextResponse } from 'next/server';
import {
  adminEnabled,
  checkPassword,
  createPreauthToken,
  createSessionToken,
  COOKIE_NAME,
  PREAUTH_COOKIE_NAME,
  PREAUTH_TTL_MS,
  SESSION_TTL_MS,
} from '@/lib/auth';
import { createOtpCode, deliverOtpCode, freshOtpOutstanding, otpDestinationHint, otpEnabled } from '@/lib/otp';
import { clientIp, isRateLimited, recordStrike } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';

const LOGIN_FAILURE_LIMIT = 8;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60_000;
// Global backstop: even with rotated/spoofed IPs, at most this many wrong
// guesses land per window across ALL clients.
const GLOBAL_FAILURE_KEY = 'admin-login:all';
const GLOBAL_FAILURE_LIMIT = 60;

/**
 * Step 1 of the admin sign-in: check the password. When two-step login is
 * configured (ADMIN_EMAIL + working SMTP), this emails a one-time code and
 * returns { otpRequired: true } — the session cookie is only set by the
 * verify step. Without OTP configuration it signs straight in.
 */
export async function POST(req: Request) {
  try {
    // Brute-force protection: only FAILED attempts count, so door staff
    // sharing one venue IP can all sign in successfully.
    const limiterKey = `admin-login:${clientIp(req)}`;
    if (isRateLimited(limiterKey, LOGIN_FAILURE_LIMIT) || isRateLimited(GLOBAL_FAILURE_KEY, GLOBAL_FAILURE_LIMIT)) {
      return NextResponse.json(
        { error: 'Too many failed attempts — please wait 15 minutes and try again.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    if (!adminEnabled()) {
      return NextResponse.json(
        {
          error: 'The admin area is not set up yet. Ask the organizer to set an ADMIN_PASSWORD on the server.',
        } satisfies ApiErrorResponse,
        { status: 503 }
      );
    }

    let password = '';
    try {
      const body = (await req.json()) as { password?: unknown };
      if (typeof body?.password === 'string') password = body.password;
    } catch {
      // Malformed body -> treated as a wrong password below.
    }

    if (!password || !checkPassword(password)) {
      recordStrike(limiterKey, LOGIN_FAILURE_WINDOW_MS);
      recordStrike(GLOBAL_FAILURE_KEY, LOGIN_FAILURE_WINDOW_MS);
      return NextResponse.json({ error: 'Wrong password' } satisfies ApiErrorResponse, { status: 401 });
    }

    if (!otpEnabled()) {
      // Password-only fallback (OTP not configured or explicitly off).
      const res = NextResponse.json({ ok: true, otpRequired: false });
      res.cookies.set(COOKIE_NAME, createSessionToken(), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      });
      return res;
    }

    // If a fresh, unexhausted code is already outstanding, do NOT mint/send a
    // new one — just re-enter the code step. This stops a caller who has the
    // password from scripting /login to flood the admin inbox/phone (and reset
    // the 6-guess limit) on every request. The separately-throttled "Resend"
    // button covers a genuinely lost code.
    if (freshOtpOutstanding()) {
      const res = NextResponse.json({ ok: true, otpRequired: true, emailHint: otpDestinationHint() });
      res.cookies.set(PREAUTH_COOKIE_NAME, createPreauthToken(), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: Math.floor(PREAUTH_TTL_MS / 1000),
      });
      return res;
    }

    const code = createOtpCode();
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      console.log(`[dev only] Admin sign-in code: ${code}`);
    }
    const delivery = await deliverOtpCode(code);
    // In development the code is printed to the server console, so broken
    // delivery shouldn't block sign-in. In production it must fail closed.
    if (!delivery.sent && !isDev) {
      return NextResponse.json(
        {
          error:
            'Your password is correct, but the sign-in code could not be sent by email or SMS. Check the SMTP/Twilio settings, or set ADMIN_OTP=off to sign in with password only.',
        } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    const res = NextResponse.json({
      ok: true,
      otpRequired: true,
      emailHint: otpDestinationHint(),
    });
    res.cookies.set(PREAUTH_COOKIE_NAME, createPreauthToken(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: Math.floor(PREAUTH_TTL_MS / 1000),
    });
    return res;
  } catch (e) {
    console.error('POST /api/admin/login failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
