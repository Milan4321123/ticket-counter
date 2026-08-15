import { NextResponse } from 'next/server';
import { listEventsForOrganizer } from '@/lib/events';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import {
  getReminderSettings,
  parseReminderDays,
  recommendedReminderDays,
  setReminderSettings,
} from '@/lib/reminders';
import type { ApiErrorResponse } from '@/lib/types';
import type { OrganizerRow } from '@/lib/organizers';
import { planGate, requireOrganizerApi } from '../auth';

/** Friendly validation failure — message goes straight to the UI. */
class ValidationError extends Error {}

function need(cond: boolean, message: string): asserts cond {
  if (!cond) throw new ValidationError(message);
}

/**
 * Recommendation is tied to how long buyers get to pay: use the LONGEST
 * pay-within window across this organizer's events (default 5 days when they
 * have no events yet).
 */
function recommendedFor(organizer: OrganizerRow): number[] {
  const events = listEventsForOrganizer(organizer.id);
  const maxPayWithin = events.reduce((max, e) => Math.max(max, e.payWithinDays), 0) || 5;
  return recommendedReminderDays(maxPayWithin);
}

/** Current "check your bank account" reminder settings for the organizer. */
export async function GET() {
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const settings = getReminderSettings(organizer.id);
    return NextResponse.json({
      enabled: settings.enabled,
      days: settings.days,
      recommended: recommendedFor(organizer),
    });
  } catch (e) {
    console.error('GET /api/portal/reminders failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}

/** Save reminder settings: on/off plus up to three timers (days). */
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

    need(typeof body.enabled === 'boolean', 'Reminders must be on or off.');
    need(Array.isArray(body.days), 'Invalid reminder timers.');
    const rawDays = body.days as unknown[];
    need(rawDays.length <= 3, 'You can set at most three reminder timers.');
    for (const d of rawDays) {
      need(
        typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 30,
        'Each reminder timer must be a whole number of days between 1 and 30.'
      );
    }

    const days = parseReminderDays((rawDays as number[]).join(','));
    need(
      !body.enabled || days.length >= 1,
      'Add at least one reminder timer, or switch reminders off.'
    );

    setReminderSettings(organizer.id, body.enabled, days);
    return NextResponse.json({ ok: true, enabled: body.enabled, days });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
    }
    console.error('POST /api/portal/reminders failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
