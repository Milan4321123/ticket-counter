import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import {
  activateOrganizer,
  getOrganizer,
  resetOrganizerPassword,
  setOrganizerPlanPaidUntil,
  setOrganizerStatus,
} from '@/lib/organizers';
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
      ...(activated ? { activated: true } : {}),
    });
  } catch (e) {
    console.error(`POST /api/admin/organizers/${id} failed:`, e);
    return NextResponse.json(
      { error: 'Could not update the account. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
