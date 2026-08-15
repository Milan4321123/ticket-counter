import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { getContactRequest, linkContactRequestToOrganizer, markContactRequestHandled } from '@/lib/contact';
import { sendOrganizerCredentialsEmail } from '@/lib/email';
import { createOrganizer, getOrganizer, getOrganizerByEmail } from '@/lib/organizers';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Approve an organizer-account application: create the account, email the
 * credentials, tick the application off the inbox.
 *
 * This is the ONLY way an organizer account comes into being besides the
 * admin's own "add organizer" form — there is no self-service signup — so the
 * guards matter: admin only, applications only, and an application that has
 * already been approved can never mint a second account.
 *
 * The generated password comes back in this POST response as well as by email:
 * SMTP may be down or unconfigured, and the admin needs *something* to pass on
 * by hand rather than a half-created account. It is never logged.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json(
        { error: 'Please sign in to the admin area first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    const request = getContactRequest(id);
    if (!request) {
      return NextResponse.json(
        { error: 'That request no longer exists.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }
    if (request.kind !== 'organizer-account') {
      return NextResponse.json(
        {
          error: 'That enquiry is not an account application, so there is nothing to approve.',
        } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    // Already approved: say which account it became, so the admin can go and
    // reset that password instead of trying to create a second one.
    if (request.organizerId) {
      const existing = getOrganizer(request.organizerId);
      return NextResponse.json(
        {
          error: existing
            ? `This application was already approved — the account ${existing.email} exists. Reset its password from Organizers if they need new details.`
            : 'This application was already approved.',
        } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    const name = request.name.trim();
    const email = request.email.trim().toLowerCase();
    if (!name || name.length > 120) {
      return NextResponse.json(
        { error: 'That application has no usable name — create the account by hand instead.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        {
          error: 'That application has no usable email address — create the account by hand instead.',
        } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    if (getOrganizerByEmail(email)) {
      return NextResponse.json(
        {
          error: `There is already an organizer account with ${email}. Reset its password from Organizers rather than creating a second one.`,
        } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    let organizer;
    let initialPassword;
    try {
      // createOrganizer generates the one-time password and flags the account
      // as must-change — the portal stays shut until they pick their own.
      ({ organizer, initialPassword } = createOrganizer({
        name,
        email,
        notes: `Approved from account application ${request.id} (${request.createdAt} UTC).`,
      }));
    } catch (e) {
      // Race fallback: the UNIQUE(email) constraint fired between check and insert.
      if (e instanceof Error && /UNIQUE/i.test(e.message)) {
        return NextResponse.json(
          {
            error: `There is already an organizer account with ${email}. Reset its password from Organizers rather than creating a second one.`,
          } satisfies ApiErrorResponse,
          { status: 409 }
        );
      }
      throw e;
    }

    // Spend the application. Losing this race means another approval already
    // linked it — impossible in practice, since that one would have taken the
    // email address first, but the account is real either way, so say so.
    const linked = linkContactRequestToOrganizer(request.id, organizer.id);
    markContactRequestHandled(request.id);

    // Awaited, not fire-and-forget: the admin has to be told whether these
    // details actually left the building, because if they did not, the password
    // on their screen is the only copy that will ever exist.
    const mail = await sendOrganizerCredentialsEmail({ name: organizer.name, email: organizer.email }, initialPassword);
    console.log(`Approved account application ${request.id} → organizer ${organizer.id}; credentials email:`, mail);

    return NextResponse.json({
      ok: true,
      organizer,
      initialPassword,
      emailed: mail.sent,
      emailReason: mail.reason,
      linked,
    });
  } catch (e) {
    console.error(`POST /api/admin/contact/${id}/approve failed:`, e);
    return NextResponse.json(
      { error: 'Could not approve that application. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
