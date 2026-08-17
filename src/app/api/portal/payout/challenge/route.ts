import { NextResponse } from 'next/server';
import { sendPayoutStepUpCodeEmail } from '@/lib/otp';
import { createPayoutStepUpCode } from '@/lib/payoutStepUp';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi } from '../../auth';
import { payoutStepUpChallenge } from '../method';

export const dynamic = 'force-dynamic';

/**
 * Start the check that stands in front of a payout-account change.
 *
 * Rate-limited on SENDS rather than failures: a code email is the side effect
 * here, so without this an organizer's own session could be scripted to flood
 * their inbox (and the platform's mail reputation) with alarm mail. Six in a
 * quarter of an hour is far more than a person retrying a form needs.
 */
const SEND_LIMIT = 6;
const SEND_WINDOW_MS = 15 * 60_000;

export async function POST(req: Request) {
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    const challenge = payoutStepUpChallenge(organizer);

    // The authenticator and password rungs deliver nothing — the code is on the
    // organizer's phone, or already in their head. Reporting the method is the
    // whole job, and neither should burn the send budget.
    if (challenge.method !== 'email') {
      return NextResponse.json({ ok: true, ...challenge });
    }

    if (!rateLimit(`payout-challenge:${organizer.id}`, SEND_LIMIT, SEND_WINDOW_MS)) {
      return NextResponse.json(
        {
          error: 'We have sent several codes already — please use the newest one, or wait 15 minutes.',
        } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }
    // A second limiter on the sending IP, because the per-organizer key above is
    // useless against someone working through several stolen sessions at once.
    if (!rateLimit(`payout-challenge-ip:${clientIp(req)}`, SEND_LIMIT * 3, SEND_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Too many requests — please wait 15 minutes and try again.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    const code = createPayoutStepUpCode(organizer.id);
    const result = await sendPayoutStepUpCodeEmail(organizer.email, code);
    if (!result.sent) {
      // Fail loudly rather than leaving them typing into a box for a code that
      // was never delivered. The code stays valid, so a retry that DOES send is
      // still usable — but they are told the truth now.
      return NextResponse.json(
        {
          error:
            'We could not send the code to your email just now. Please try again in a moment — or set up an authenticator app in Settings, which works without email.',
        } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, ...challenge });
  } catch (e) {
    console.error('POST /api/portal/payout/challenge failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
