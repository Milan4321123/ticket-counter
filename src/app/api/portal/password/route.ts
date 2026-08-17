import { NextResponse } from 'next/server';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import {
  checkOrganizerLogin,
  createOrganizerSessionToken,
  ORGANIZER_COOKIE_NAME,
  ORGANIZER_SESSION_TTL_MS,
  setOrganizerPassword,
} from '@/lib/organizers';
import { isRateLimited, recordStrike } from '@/lib/ratelimit';
import { passwordProblem } from '@/lib/passwordPolicy';
import type { ApiErrorResponse } from '@/lib/types';
import { requireOrganizerApi } from '../auth';

const FAILURE_LIMIT = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;

/**
 * Change the signed-in organizer's password (current password required).
 * Deliberately NOT plan-gated: account hygiene must work even on a lapsed plan.
 *
 * One exception to "current password required": an account still carrying the
 * one-time password the platform emailed it. They typed that password minutes
 * ago to get this session, it is written down in an inbox, and the whole point
 * of /portal/change-password is to retire it — so asking for it again would
 * only be ceremony. It is still checked in one direction: the new password may
 * not BE the emailed one.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireOrganizerApi({ allowUnchangedPassword: true });
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    // Only failed current-password checks count toward the limit.
    const limiterKey = `portal-password:${organizer.id}`;
    if (isRateLimited(limiterKey, FAILURE_LIMIT)) {
      return NextResponse.json(
        { error: 'Too many failed attempts — please wait 15 minutes and try again.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    let currentPassword = '';
    let newPassword = '';
    try {
      const body = (await readJsonLimited(req)) as { currentPassword?: unknown; newPassword?: unknown };
      if (typeof body?.currentPassword === 'string') currentPassword = body.currentPassword;
      if (typeof body?.newPassword === 'string') newPassword = body.newPassword;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
    }

    const problem = passwordProblem(newPassword);
    if (problem) {
      return NextResponse.json({ error: problem } satisfies ApiErrorResponse, { status: 400 });
    }
    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: 'Your new password must be different from the current one.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    if (organizer.mustChangePassword) {
      if (checkOrganizerLogin(organizer.email, newPassword)) {
        return NextResponse.json(
          {
            error: 'That is the temporary password we emailed you — please pick a different one.',
          } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }
    } else if (!currentPassword || !checkOrganizerLogin(organizer.email, currentPassword)) {
      recordStrike(limiterKey, FAILURE_WINDOW_MS);
      return NextResponse.json(
        { error: 'Your current password is not correct.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    setOrganizerPassword(organizer.id, newPassword);

    // Session MACs are bound to the password hash, so the change just revoked
    // this organizer's own cookie along with every other one. Hand the caller a
    // fresh token — they authenticated seconds ago — otherwise saving a new
    // password would dump them back at the sign-in page.
    const res = NextResponse.json({ ok: true });
    try {
      res.cookies.set(ORGANIZER_COOKIE_NAME, createOrganizerSessionToken(organizer.id), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: Math.floor(ORGANIZER_SESSION_TTL_MS / 1000),
      });
    } catch {
      // No APP_SECRET, so no session could exist in the first place. The
      // password IS changed; they simply sign in again.
    }
    return res;
  } catch (e) {
    console.error('POST /api/portal/password failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
