import { NextResponse } from 'next/server';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import {
  checkOrganizerCredentials,
  createOrganizerPendingToken,
  createOrganizerSessionToken,
  ORGANIZER_COOKIE_NAME,
  ORGANIZER_SESSION_TTL_MS,
} from '@/lib/organizers';
import { organizerTotpEnabled } from '@/lib/organizerTotp';
import { clientIp, isRateLimited, recordStrike } from '@/lib/ratelimit';
import { createOrganizerLoginCode, freshLoginCodeOutstanding } from '@/lib/loginCode';
import { maskEmail, sendOrganizerLoginCodeEmail } from '@/lib/otp';
import { isEmailConfigured } from '@/lib/email';
import type { ApiErrorResponse } from '@/lib/types';
import { notifySignIn } from '../auth';

const LOGIN_FAILURE_LIMIT = 8;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60_000;
// Global backstop: even with rotated/spoofed IPs, at most this many wrong
// guesses land per window across ALL clients.
const GLOBAL_FAILURE_KEY = 'portal-login:all';
const GLOBAL_FAILURE_LIMIT = 100;

/**
 * Organizer sign-in: email + password -> session cookie. Only FAILED attempts
 * count toward the rate limit, so a team sharing one office IP can all sign in.
 */
/**
 * Is the emailed sign-in code switched on?
 *
 * OFF by default, and that is not timidity — it is the only safe default until
 * the sending domain is authenticated.
 *
 * The obvious safeguard does not work here. A code that cannot be SENT is
 * caught below and waved through, but that is not the failure this platform
 * has: SendGrid ACCEPTS the message and it is discarded further down, silently,
 * for whole providers. From the server the send looks perfectly successful, so
 * the code is demanded and the organizer simply never receives one — and every
 * organizer without an authenticator is locked out at once, with nobody able to
 * sign in and turn it off.
 *
 * So it waits behind a switch. Authenticate the domain, confirm a code actually
 * arrives at a Gmail address, then set PORTAL_EMAIL_OTP=on. Everything else is
 * built and tested; this is one environment variable away.
 */
function emailLoginCodeEnabled(): boolean {
  return process.env.PORTAL_EMAIL_OTP === 'on' && isEmailConfigured();
}

export async function POST(req: Request) {
  try {
    const limiterKey = `portal-login:${clientIp(req)}`;
    if (isRateLimited(limiterKey, LOGIN_FAILURE_LIMIT) || isRateLimited(GLOBAL_FAILURE_KEY, GLOBAL_FAILURE_LIMIT)) {
      return NextResponse.json(
        { error: 'Too many failed attempts — please wait 15 minutes and try again.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    let email = '';
    let password = '';
    try {
      const body = (await readJsonLimited(req)) as { email?: unknown; password?: unknown };
      if (typeof body?.email === 'string') email = body.email.trim();
      if (typeof body?.password === 'string') password = body.password;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      // Malformed body -> treated as wrong credentials below.
    }

    // Verify credentials regardless of account status — the status decides
    // what happens next, and only WRONG credentials count as a failed attempt.
    const organizer = email && password ? checkOrganizerCredentials(email, password) : null;
    if (!organizer) {
      recordStrike(limiterKey, LOGIN_FAILURE_WINDOW_MS);
      recordStrike(GLOBAL_FAILURE_KEY, LOGIN_FAILURE_WINDOW_MS);
      return NextResponse.json(
        { error: 'Wrong email or password. Please try again.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    if (organizer.status === 'pending') {
      // Correct password, but the account hasn't been switched on yet: no
      // session cookie — the client sends them to their welcome page.
      return NextResponse.json({ ok: false, pending: true, organizerId: organizer.id });
    }

    if (organizer.status !== 'active') {
      return NextResponse.json(
        {
          error: 'This account has been disabled. Please contact the NepaliConcert team if you think this is a mistake.',
        } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    // Second factor, when this organizer has switched one on. The session
    // cookie is NOT issued here — the password alone must not sign anyone in,
    // or the second factor would be decoration. They get a five-minute ticket
    // proving the password was right, and nothing else.
    if (organizerTotpEnabled(organizer.id)) {
      return NextResponse.json({
        ok: false,
        totpRequired: true,
        pendingToken: createOrganizerPendingToken(organizer.id),
      });
    }

    // No authenticator: fall back to a code emailed to the address on the
    // account. See lib/loginCode.ts for why a failure to SEND must not become a
    // failure to sign in — an undeliverable second factor would lock out every
    // organizer at once, with nobody able to get in and fix it.
    let codeSent = false;
    // Set ONLY when the emailed factor was meant to run and could not. Being
    // switched off is not a failure and must not be reported as one, or every
    // sign-in would warn about a check nobody asked for.
    let codeSkippedReason = '';
    if (emailLoginCodeEnabled()) {
      if (freshLoginCodeOutstanding(organizer.id)) {
        // One is already in their inbox. Re-sending on every password submit is
        // how someone who knows the password floods it.
        codeSent = true;
      } else {
        const result = await sendOrganizerLoginCodeEmail(
          organizer.email,
          createOrganizerLoginCode(organizer.id)
        );
        codeSent = result.sent;
        codeSkippedReason = result.reason ?? '';
      }
    }

    if (codeSent) {
      return NextResponse.json({
        ok: false,
        emailCodeRequired: true,
        sentTo: maskEmail(organizer.email),
        pendingToken: createOrganizerPendingToken(organizer.id),
      });
    }
    if (codeSkippedReason) {
      console.warn(
        `Organizer sign-in code not sent (${codeSkippedReason}) for ${organizer.email} — signing in on the password alone.`
      );
    }

    let token: string;
    try {
      token = createOrganizerSessionToken(organizer.id);
    } catch {
      return NextResponse.json(
        {
          error:
            'Sign-in is not fully set up on this server yet — the site owner needs to set an APP_SECRET. Please let them know.',
        } satisfies ApiErrorResponse,
        { status: 503 }
      );
    }

    notifySignIn(organizer, req);

    // Never a silent fail-open: the client says so, so an organizer knows the
    // check did not happen rather than believing they are protected.
    const res = NextResponse.json({ ok: true, ...(codeSkippedReason ? { codeUnavailable: true } : {}) });
    res.cookies.set(ORGANIZER_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: Math.floor(ORGANIZER_SESSION_TTL_MS / 1000),
    });
    return res;
  } catch (e) {
    console.error('POST /api/portal/login failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
