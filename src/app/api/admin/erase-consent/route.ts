import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { eraseMarketingConsent } from '@/lib/marketing';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Erase an address from the marketing consent book entirely, on request.
 *
 * This is the button behind a legal promise: /privacy and the unsubscribe page
 * both say the do-not-email record is erased entirely when its owner asks, and
 * a manual DELETE cannot keep that promise — marketing_sends rows reference
 * the consent row and foreign_keys=ON makes the delete throw once anything was
 * ever announced to the address. eraseMarketingConsent() removes both, in
 * order, in one transaction.
 *
 * Admin-only: erasure requests arrive by email to the platform owner, and only
 * the owner should be able to destroy someone's suppression record (destroying
 * it also removes the guarantee they are never emailed again). Rate limited
 * like the other admin buttons — it is a destructive action, not a search box.
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
    }
    if (!rateLimit(`admin-erase-consent:${clientIp(req)}`, 10, 60_000)) {
      return NextResponse.json(
        { error: 'Too many erasures at once — please wait a minute.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    let email = '';
    try {
      const body = (await req.json()) as { email?: unknown };
      if (typeof body?.email === 'string') email = body.email.trim();
    } catch {
      // handled by the empty-email check below
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Enter the email address exactly as the person wrote it.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    const erased = eraseMarketingConsent(email);
    return NextResponse.json({ ok: true, erased });
  } catch (e) {
    console.error('POST /api/admin/erase-consent failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
