import { NextResponse } from 'next/server';
import { isEmailConfigured } from '@/lib/email';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import { getOrganizerByEmail } from '@/lib/organizers';
import { maskEmail, sendOrganizerResetCodeEmail } from '@/lib/otp';
import { createOrganizerResetCode, RESET_REQUEST_NEUTRAL_MESSAGE } from '@/lib/passwordReset';
import { platformContactEmail } from '@/lib/platform';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Two buckets plus a backstop, as on the contact form. The per-EMAIL bucket is
// the one that matters here: without it, anyone could point this endpoint at an
// organizer's inbox from a fresh IP each time and bury them in codes.
const IP_LIMIT = 5;
const IP_WINDOW_MS = 15 * 60_000;
const EMAIL_LIMIT = 3;
const EMAIL_WINDOW_MS = 15 * 60_000;
const GLOBAL_KEY = 'pw-reset-request:all';
const GLOBAL_LIMIT = 60;
const GLOBAL_WINDOW_MS = 60 * 60_000;

/**
 * Step 1 of "I forgot my password": email in, one-time code out — by email, to
 * the address ON THE ACCOUNT.
 *
 * Nothing in the response depends on whether that address has an account. Same
 * sentence, same status, same masked destination (masked from what was TYPED),
 * and the same handful of milliseconds — the mail is sent fire-and-forget, so
 * the reply does not wait on SMTP and a real account cannot be spotted by how
 * long the answer took. That is the whole point: this endpoint is open to the
 * world, and it must not become a way to test which addresses are customers.
 */
export async function POST(req: Request) {
  try {
    // Nothing can be delivered without SMTP, so say so plainly rather than
    // pretending a code is on its way and leaving them waiting for it.
    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error: `Sending email is not set up on this server, so we cannot send you a code. Please write to ${platformContactEmail()} and we will sort your password out.`,
        } satisfies ApiErrorResponse,
        { status: 503 }
      );
    }

    let email = '';
    try {
      const body = (await readJsonLimited(req)) as { email?: unknown };
      if (typeof body?.email === 'string') email = body.email.trim();
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      // Malformed body -> caught by the format check below.
    }

    // A format check is not an existence check: it says nothing about accounts.
    if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'Please enter the email address you sign in with.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    // Keyed on a hash of the address, not the address itself: the limiter map
    // lives for the life of the process and has no business holding inboxes.
    const emailKey = `pw-reset-request:email:${Buffer.from(email.toLowerCase()).toString('base64url').slice(0, 32)}`;
    if (
      !rateLimit(`pw-reset-request:${clientIp(req)}`, IP_LIMIT, IP_WINDOW_MS) ||
      !rateLimit(emailKey, EMAIL_LIMIT, EMAIL_WINDOW_MS) ||
      !rateLimit(GLOBAL_KEY, GLOBAL_LIMIT, GLOBAL_WINDOW_MS)
    ) {
      return NextResponse.json(
        {
          error: 'We have sent a few codes already — please wait a little while before asking for another.',
        } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    // Only a real account in good standing gets a code. An address we do not
    // know, an account the owner disabled, and a signup that was never switched
    // on all fall through silently to the same neutral answer below.
    const organizer = getOrganizerByEmail(email);
    if (organizer && organizer.status === 'active') {
      const code = createOrganizerResetCode(organizer.id);
      // Fire-and-forget, like the contact form: the caller must not wait for
      // SMTP (see the timing note above), and a mail outage is logged rather
      // than turned into a hint that this address exists.
      void sendOrganizerResetCodeEmail(organizer.email, code)
        .then((result) => console.log(`Password-reset code for organizer ${organizer.id}:`, result))
        .catch((e) => console.error(`Password-reset code email threw unexpectedly:`, e));
    }

    return NextResponse.json({
      ok: true,
      message: RESET_REQUEST_NEUTRAL_MESSAGE,
      // Masked from the SUBMITTED address, never from the database — it has to
      // be identical whether or not the account exists.
      sentTo: maskEmail(email),
    });
  } catch (e) {
    console.error('POST /api/portal/password-reset/request failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
