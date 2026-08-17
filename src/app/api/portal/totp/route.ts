import { NextResponse } from 'next/server';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import {
  confirmOrganizerTotp,
  disableOrganizerTotp,
  organizerTotpEnabled,
  organizerTotpQrDataUrl,
  formatSecretForTyping,
  startOrganizerTotpEnrolment,
  verifyOrganizerTotp,
} from '@/lib/organizerTotp';
import { checkOrganizerCredentials } from '@/lib/organizers';
import { isRateLimited, recordStrike } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';
import { requireOrganizerApi } from '../../portal/auth';

/**
 * The organizer's own authenticator setup. Every branch requires an existing
 * signed-in session — this turns a second factor ON for an account you are
 * already inside, it is never a way to get in.
 *
 * {action:'start'}   -> a fresh secret + QR to scan (does NOT switch it on)
 * {action:'confirm'} -> a working code switches it on
 * {action:'disable'} -> turn it off and forget the secret
 *
 * WHY BOTH ENDS ARE GUARDED. The authenticator is what stands in front of the
 * payout account, so anything that can silently REPLACE it is a way around
 * that gate. Two holes had to close:
 *
 *  - 'start' now needs the PASSWORD. Without it, someone sitting in a stolen
 *    session could enrol their own phone on an account that had none, and then
 *    satisfy the payout check with it — building the lock and keeping the key.
 *  - 'disable' now needs a WORKING CODE. Without it, the same attacker could
 *    strip an enrolled authenticator and put theirs in its place, which would
 *    have made the strongest factor on the platform removable by anyone holding
 *    a session.
 *
 * A genuinely lost phone therefore cannot be self-serviced, and that is the
 * intended trade: sign-in already demands the code, so a lost phone is a
 * lockout before it ever reaches this route. Recovery is the platform owner's
 * to perform, from the organizers page, after identifying the person off-line.
 */
const PASSWORD_FAILURE_LIMIT = 6;
const FAILURE_WINDOW_MS = 15 * 60_000;

export async function POST(req: Request) {
  try {
    const auth = await requireOrganizerApi({ allowUnchangedPassword: true });
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    let action = '';
    let code = '';
    let password = '';
    try {
      const body = (await readJsonLimited(req, 8 * 1024)) as {
        action?: unknown;
        code?: unknown;
        password?: unknown;
      };
      if (typeof body?.action === 'string') action = body.action;
      if (typeof body?.code === 'string') code = body.code;
      if (typeof body?.password === 'string') password = body.password;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
    }

    if (action === 'start') {
      if (organizerTotpEnabled(organizer.id)) {
        return NextResponse.json(
          { error: 'An authenticator is already set up. Turn it off first if you want to use a new phone.' } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }
      const pwKey = `portal-totp-password:${organizer.id}`;
      if (isRateLimited(pwKey, PASSWORD_FAILURE_LIMIT)) {
        return NextResponse.json(
          { error: 'Too many attempts — please wait 15 minutes and try again.' } satisfies ApiErrorResponse,
          { status: 429 }
        );
      }
      if (!password || checkOrganizerCredentials(organizer.email, password) === null) {
        recordStrike(pwKey, FAILURE_WINDOW_MS);
        return NextResponse.json(
          { error: 'That password is not right.' } satisfies ApiErrorResponse,
          { status: 401 }
        );
      }
      const secret = startOrganizerTotpEnrolment(organizer.id);
      return NextResponse.json({
        ok: true,
        qr: await organizerTotpQrDataUrl(secret, organizer.email),
        manualCode: formatSecretForTyping(secret),
      });
    }

    if (action === 'confirm') {
      // Guessing a code to enrol is pointless (you would be enrolling YOUR OWN
      // already-signed-in account), but an unbounded confirm loop is still a
      // free CPU sink, so it is bounded like every other code check.
      const key = `portal-totp-setup:${organizer.id}`;
      if (isRateLimited(key, 10)) {
        return NextResponse.json(
          { error: 'Too many attempts — please wait a few minutes.' } satisfies ApiErrorResponse,
          { status: 429 }
        );
      }
      if (!confirmOrganizerTotp(organizer.id, code)) {
        recordStrike(key, 15 * 60_000);
        return NextResponse.json(
          {
            error: 'That code did not match. Make sure you scanned the right QR and the code is current.',
          } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: true, enabled: true });
    }

    if (action === 'disable') {
      // Possession of the phone, not merely of the session. See the note above:
      // a removable second factor is not a second factor.
      if (!organizerTotpEnabled(organizer.id)) {
        return NextResponse.json({ ok: true, enabled: false });
      }
      const key = `portal-totp-disable:${organizer.id}`;
      if (isRateLimited(key, 10)) {
        return NextResponse.json(
          { error: 'Too many attempts — please wait a few minutes.' } satisfies ApiErrorResponse,
          { status: 429 }
        );
      }
      if (!verifyOrganizerTotp(organizer.id, code)) {
        recordStrike(key, FAILURE_WINDOW_MS);
        return NextResponse.json(
          {
            error:
              'Enter the current code from your authenticator to turn it off. If you no longer have the phone, contact the platform team — they can clear it for you.',
          } satisfies ApiErrorResponse,
          { status: 401 }
        );
      }
      disableOrganizerTotp(organizer.id);
      return NextResponse.json({ ok: true, enabled: false });
    }

    return NextResponse.json({ error: 'Unknown action.' } satisfies ApiErrorResponse, { status: 400 });
  } catch (e) {
    console.error('POST /api/portal/totp failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
