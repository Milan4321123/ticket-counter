import { NextResponse } from 'next/server';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import {
  confirmOrganizerTotp,
  disableOrganizerTotp,
  organizerTotpEnabled,
  organizerTotpQrDataUrl,
  formatSecretForTyping,
  startOrganizerTotpEnrolment,
} from '@/lib/organizerTotp';
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
 */
export async function POST(req: Request) {
  try {
    const auth = await requireOrganizerApi({ allowUnchangedPassword: true });
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    let action = '';
    let code = '';
    try {
      const body = (await readJsonLimited(req, 8 * 1024)) as { action?: unknown; code?: unknown };
      if (typeof body?.action === 'string') action = body.action;
      if (typeof body?.code === 'string') code = body.code;
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
