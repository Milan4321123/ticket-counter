import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { sendOrganizerCredentialsEmail } from '@/lib/email';
import {
  activateOrganizer,
  getOrganizer,
  resetOrganizerPassword,
  setOrganizerPlanPaidUntil,
  setOrganizerStatus,
} from '@/lib/organizers';
import { disableOrganizerTotp } from '@/lib/organizerTotp';
import { signupReference } from '@/lib/platform';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Platform admin updates one organizer account. The body carries any of:
 *  - planPaidUntil: 'YYYY-MM-DD' | null | '' — legacy paid-until date; accounts
 *    no longer expire (the platform fee is charged per event), so this is only
 *    kept for old data and manual corrections
 *  - status: 'active' | 'disabled' — disabling signs them out immediately
 *  - resetPassword: true — returns { newPassword } EXACTLY ONCE (never re-readable)
 *    and emails it to the organizer, reporting { emailed, emailReason }. This is
 *    also the "resend their sign-in details" path: the password cannot be read
 *    back to re-send, so a fresh one is issued and sent.
 *  - clearAuthenticator: true — the lost-phone path; organizers cannot clear
 *    their own without a working code, so this is the only way back in
 *  - confirmSignup: { referenceConfirmation } — activate a pending signup: the
 *    admin types the LAST 4 characters of its reference (the same deliberate
 *    two-step confirm as mark-paid). Accounts are free — the money is charged
 *    per event, when the organizer publishes one.
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

    const organizer = getOrganizer(id);
    if (!organizer) {
      return NextResponse.json(
        { error: 'This organizer account no longer exists.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }

    interface UpdateOrganizerBody {
      planPaidUntil?: unknown;
      status?: unknown;
      resetPassword?: unknown;
      clearAuthenticator?: unknown;
      confirmSignup?: unknown;
    }
    let body: UpdateOrganizerBody | null = null;
    try {
      body = (await req.json()) as UpdateOrganizerBody;
    } catch {
      // handled below (counts as "nothing to change")
    }

    let changedSomething = false;
    let newPassword: string | undefined;
    let activated = false;
    let clearedAuthenticator = false;
    let emailed: boolean | undefined;
    let emailReason: string | undefined;

    if (body && 'confirmSignup' in body) {
      const cs = body.confirmSignup as { referenceConfirmation?: unknown } | null;
      const confirmation =
        cs && typeof cs === 'object' && typeof cs.referenceConfirmation === 'string'
          ? cs.referenceConfirmation
          : '';
      if (organizer.status !== 'pending') {
        return NextResponse.json(
          { error: 'This account is not waiting to be activated anymore.' } satisfies ApiErrorResponse,
          { status: 409 }
        );
      }
      const expected = signupReference(id).slice(-4).toUpperCase();
      if (confirmation.trim().toUpperCase() !== expected) {
        return NextResponse.json(
          {
            error:
              'The characters you typed do not match this signup’s reference. Read the last 4 characters of the reference shown next to the signup and try again.',
          } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }
      // The account is free and never expires — the fee is charged per event.
      activateOrganizer(id);
      activated = true;
      changedSomething = true;
    }

    if (body && 'planPaidUntil' in body) {
      const v = body.planPaidUntil;
      if (v === null || v === '') {
        setOrganizerPlanPaidUntil(id, null);
      } else if (typeof v === 'string' && isValidDate(v)) {
        setOrganizerPlanPaidUntil(id, v);
      } else {
        return NextResponse.json(
          { error: 'Please pick a valid “plan paid until” date.' } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }
      changedSomething = true;
    }

    if (body && 'status' in body) {
      if (body.status !== 'active' && body.status !== 'disabled') {
        return NextResponse.json(
          { error: 'The account status can only be “active” or “disabled”.' } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }
      setOrganizerStatus(id, body.status);
      changedSomething = true;
    }

    if (body?.resetPassword === true) {
      newPassword = resetOrganizerPassword(id);
      changedSomething = true;
      // And EMAIL it, which is the whole point of the action.
      //
      // The reset used to hand the new password back to this screen and stop
      // there, so the only way an organizer ever received one was the single
      // email sent when their application was approved. If that email failed —
      // and with a From address the provider will not vouch for, it does — there
      // was no second attempt available anywhere: the owner had to copy the
      // password out of the admin panel and pass it on by hand, over whatever
      // channel, hoping the tab had not been refreshed first.
      //
      // Awaited, not fire-and-forget, because the answer decides what the owner
      // does next: if it did not go out, the password on their screen is again
      // the only copy that will ever exist.
      const org = getOrganizer(id);
      if (org) {
        const mail = await sendOrganizerCredentialsEmail({ name: org.name, email: org.email }, newPassword);
        emailed = mail.sent;
        emailReason = mail.reason;
        console.log(`Admin reset password for organizer ${id}; credentials email:`, mail);
      }
    }

    // The lost-phone path, and the ONLY one. An organizer cannot clear their own
    // authenticator without a working code from it — deliberately, because one
    // that a signed-in stranger could remove would guard neither the sign-in nor
    // the payout account. That makes a genuinely lost phone a lockout, so the
    // way back has to exist somewhere: here, in the hands of the platform owner,
    // who can establish who they are talking to before using it.
    if (body?.clearAuthenticator === true) {
      disableOrganizerTotp(id);
      clearedAuthenticator = true;
      changedSomething = true;
    }

    if (!changedSomething) {
      return NextResponse.json(
        { error: 'Nothing to change — please try again.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      organizer: getOrganizer(id),
      ...(newPassword ? { newPassword } : {}),
      ...(emailed === undefined ? {} : { emailed, emailReason }),
      ...(activated ? { activated: true } : {}),
      ...(clearedAuthenticator ? { clearedAuthenticator: true } : {}),
    });
  } catch (e) {
    console.error(`POST /api/admin/organizers/${id} failed:`, e);
    return NextResponse.json(
      { error: 'Could not update the account. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
