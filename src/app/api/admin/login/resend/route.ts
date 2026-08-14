import { NextResponse } from 'next/server';
import { isPreauthRequest } from '@/lib/auth';
import { createOtpCode, deliverOtpCode, otpDestinationHint, otpEnabled } from '@/lib/otp';
import { rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';

/** Re-send the one-time code (with a cooldown so it can't be spammed). */
export async function POST() {
  try {
    if (!(await isPreauthRequest())) {
      return NextResponse.json(
        { error: 'Your sign-in session expired — please enter the password again.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }
    if (!otpEnabled()) {
      return NextResponse.json({ error: 'Two-step login is not configured.' } satisfies ApiErrorResponse, {
        status: 400,
      });
    }
    // One resend per 45 seconds, shared across everyone (there is one code slot).
    if (!rateLimit('otp-resend', 1, 45_000)) {
      return NextResponse.json(
        { error: 'A code was just sent — wait a moment before requesting another.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    const code = createOtpCode();
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[dev only] Admin sign-in code: ${code}`);
    }
    const delivery = await deliverOtpCode(code);
    if (!delivery.sent) {
      return NextResponse.json(
        { error: 'The code could not be sent by email or SMS — check the SMTP/Twilio settings.' } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, emailHint: otpDestinationHint() });
  } catch (e) {
    console.error('POST /api/admin/login/resend failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
