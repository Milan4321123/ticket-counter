import { NextResponse } from 'next/server';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import {
  getReferralRewardSettings,
  setReferralRewardSettings,
  validateReferralRewardSettings,
} from '@/lib/referrals';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi } from '../auth';

/** Friendly validation failure — message goes straight to the UI. */
class ValidationError extends Error {}

function need(cond: boolean, message: string): asserts cond {
  if (!cond) throw new ValidationError(message);
}

/** Current referral-reward settings for the signed-in organizer. */
export async function GET() {
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const settings = getReferralRewardSettings(organizer.id);
    return NextResponse.json({
      threshold: settings.threshold,
      rewardCents: settings.rewardCents,
      enabled: settings.enabled,
    });
  } catch (e) {
    console.error('GET /api/portal/referrals failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}

/**
 * Save referral rewards: how many confirmed paid referrals earn one voucher,
 * and what that voucher is worth.
 *
 * The organizer is the only person who may set this — it is a discount on
 * THEIR prices, granted by them, and the platform neither funds nor takes any
 * part of it.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    let body: Record<string, unknown>;
    try {
      const parsed = await readJsonLimited(req);
      need(Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed), 'Nothing to save.');
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      if (e instanceof ValidationError) throw e;
      return NextResponse.json({ error: 'Nothing to save.' } satisfies ApiErrorResponse, { status: 400 });
    }

    need(typeof body.threshold === 'number' && Number.isFinite(body.threshold), 'Invalid number of referrals.');
    need(typeof body.rewardCents === 'number' && Number.isFinite(body.rewardCents), 'Invalid reward amount.');
    const threshold = Math.round(body.threshold as number);
    const rewardCents = Math.round(body.rewardCents as number);

    // One rule, in lib/referrals, so the portal and anything else that ever
    // writes these two columns refuse the same pairs for the same reasons.
    const problem = validateReferralRewardSettings(threshold, rewardCents);
    need(problem === null, problem ?? '');

    setReferralRewardSettings(organizer.id, threshold, rewardCents);
    return NextResponse.json({ ok: true, threshold, rewardCents, enabled: threshold > 0 && rewardCents > 0 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
    }
    console.error('POST /api/portal/referrals failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
