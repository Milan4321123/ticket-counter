import { NextResponse } from 'next/server';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import {
  createOrganizerSessionToken,
  getOrganizer,
  getOrganizerByEmail,
  ORGANIZER_COOKIE_NAME,
  ORGANIZER_SESSION_TTL_MS,
  setOrganizerPassword,
} from '@/lib/organizers';
import {
  burnOrganizerResetCodes,
  RESET_CODE_REJECTED_MESSAGE,
  verifyOrganizerResetCode,
} from '@/lib/passwordReset';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { passwordProblem } from '@/lib/passwordPolicy';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Every submission counts, not only the failures: an honest organizer sends one
// or two, so a low ceiling costs them nothing and leaves a guesser almost no
// room on top of the 5-attempt cap the code itself carries.
const IP_LIMIT = 12;
const IP_WINDOW_MS = 15 * 60_000;
const GLOBAL_KEY = 'pw-reset-confirm:all';
const GLOBAL_LIMIT = 200;
const GLOBAL_WINDOW_MS = 60 * 60_000;


/** One rejection for every way this can fail — see RESET_CODE_REJECTED_MESSAGE. */
function rejected() {
  return NextResponse.json({ error: RESET_CODE_REJECTED_MESSAGE } satisfies ApiErrorResponse, { status: 400 });
}

/**
 * Step 2 of "I forgot my password": the emailed code plus the new password,
 * together in one request. There is no in-between "verified" state to protect —
 * the code is checked and the password is set inside the same call, or nothing
 * happens at all.
 *
 * Wrong code, expired code, code out of attempts, address with no account,
 * account disabled since the code was sent: all answer identically, so this
 * step cannot be used to work out which addresses have accounts either.
 */
export async function POST(req: Request) {
  try {
    if (
      !rateLimit(`pw-reset-confirm:${clientIp(req)}`, IP_LIMIT, IP_WINDOW_MS) ||
      !rateLimit(GLOBAL_KEY, GLOBAL_LIMIT, GLOBAL_WINDOW_MS)
    ) {
      return NextResponse.json(
        { error: 'Too many tries — please wait 15 minutes and try again.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    let email = '';
    let code = '';
    let newPassword = '';
    try {
      const body = (await readJsonLimited(req)) as { email?: unknown; code?: unknown; newPassword?: unknown };
      if (typeof body?.email === 'string') email = body.email.trim();
      if (typeof body?.code === 'string') code = body.code;
      if (typeof body?.newPassword === 'string') newPassword = body.newPassword;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      // Malformed body -> rejected below.
    }

    // The password is judged BEFORE the code is checked: a good code must not
    // be burnt because the password they typed was two characters short.
    const problem = passwordProblem(newPassword);
    if (problem) {
      return NextResponse.json({ error: problem } satisfies ApiErrorResponse, { status: 400 });
    }

    if (!email || !code) return rejected();

    const organizer = getOrganizerByEmail(email);
    if (!organizer || organizer.status !== 'active') return rejected();

    const verdict = verifyOrganizerResetCode(organizer.id, code);
    if (verdict !== 'ok') return rejected();

    // Read the account again, now, immediately before writing the password. The
    // check above happened before the code was verified, and the code itself
    // was issued minutes ago — an account deleted or switched off in between
    // must fail here, at the last possible moment.
    const stillThere = getOrganizer(organizer.id);
    if (!stillThere || stillThere.status !== 'active') {
      burnOrganizerResetCodes(organizer.id);
      return rejected();
    }

    // Clears must_change_password, and burns this code along with any other
    // outstanding one for the account (see setOrganizerPassword).
    setOrganizerPassword(organizer.id, newPassword);

    // Session MACs are bound to the password hash, so the write above revoked
    // every token for this organizer. Hand them a fresh one — they have just
    // proved they hold the account's inbox — otherwise the reset would end at
    // the sign-in page instead of the portal.
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
      // password IS set; they simply sign in with it.
    }
    return res;
  } catch (e) {
    console.error('POST /api/portal/password-reset/confirm failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
