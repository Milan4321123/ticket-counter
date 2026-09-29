import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { deleteOrganizerPermanently, OrganizerDeletionError } from '@/lib/erasure';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Platform admin deletes one organizer PERMANENTLY, with every listing, order,
 * ticket, buyer record, media file and organizer-scoped row — the processor's
 * deletion duty when the contract ends (Art. 28(3)(g) GDPR).
 *
 * Body: { confirmEmail } — the account's email, typed out. The guards (account
 * must already be DISABLED, the typed email must match) live in
 * lib/erasure.deleteOrganizerPermanently, so no caller can skip them.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json(
        { error: 'Please sign in to the admin area first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }
    if (!rateLimit(`admin-delete-organizer:${clientIp(req)}`, 5, 60_000)) {
      return NextResponse.json(
        { error: 'Too many deletions at once — please wait a minute.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    let confirmEmail = '';
    try {
      const body = (await readJsonLimited(req)) as { confirmEmail?: unknown } | null;
      if (typeof body?.confirmEmail === 'string') confirmEmail = body.confirmEmail;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      // Malformed JSON: an empty confirmation, refused below.
    }

    try {
      const report = deleteOrganizerPermanently(id, confirmEmail);
      console.log(
        `Admin deleted organizer ${id}: ${report.events} listing(s), ${report.orders} order(s), ` +
          `${report.tickets} ticket(s), ${report.media} media file(s), ${report.reviews} review(s), ` +
          `${report.subscriptions} subscription(s), ${report.marketingConsents} consent(s), ` +
          `${report.customerCards} card(s), ${report.otherRows} other row(s).`
      );
      return NextResponse.json({ ok: true, report });
    } catch (e) {
      if (e instanceof OrganizerDeletionError) {
        return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
      }
      throw e;
    }
  } catch (e) {
    console.error(`POST /api/admin/organizers/${id}/delete failed:`, e);
    return NextResponse.json(
      { error: 'The deletion did not finish — the account is still disabled. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
