import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import {
  disableTotp,
  getOrCreateTotpSecret,
  isTotpEnrolled,
  setTotpEnrolled,
  totpAuthUri,
  totpQrDataUrl,
  totpStepFor,
} from '@/lib/totp';
import type { ApiErrorResponse } from '@/lib/types';

/**
 * Manage authenticator-app (TOTP) enrollment for the admin login. Admin session
 * required. Actions:
 *   start   -> generate/return the secret + QR to scan (does NOT enable yet)
 *   enable  -> confirm a 6-digit code from the app, then switch it on
 *   disable -> forget the secret and turn authenticator login off
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: 'Please sign in to the admin area first.' } satisfies ApiErrorResponse, {
        status: 401,
      });
    }

    let action = '';
    let code = '';
    try {
      const body = (await readJsonLimited(req)) as { action?: unknown; code?: unknown };
      if (typeof body?.action === 'string') action = body.action;
      if (typeof body?.code === 'string') code = body.code;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      // fall through to invalid-action below
    }

    if (action === 'start') {
      if (isTotpEnrolled()) {
        return NextResponse.json({ enrolled: true });
      }
      const secret = getOrCreateTotpSecret();
      const qrDataUrl = await totpQrDataUrl(secret);
      // Return the secret so the admin can also type it in manually if the
      // camera scan fails. It is only ever sent to an authenticated admin.
      return NextResponse.json({ enrolled: false, secret, uri: totpAuthUri(secret), qrDataUrl });
    }

    if (action === 'enable') {
      const secret = getOrCreateTotpSecret();
      const step = totpStepFor(secret, code);
      if (step < 0) {
        return NextResponse.json(
          { error: 'That code did not match. Make sure your phone’s clock is set automatically, then enter the current 6-digit code.' } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }
      // Spend it, so the code just typed cannot also be used to sign in.
      setTotpEnrolled(step);
      return NextResponse.json({ enrolled: true });
    }

    if (action === 'disable') {
      disableTotp();
      return NextResponse.json({ enrolled: false });
    }

    return NextResponse.json({ error: 'Unknown action.' } satisfies ApiErrorResponse, { status: 400 });
  } catch (e) {
    console.error('POST /api/admin/totp failed:', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse, {
      status: 500,
    });
  }
}
