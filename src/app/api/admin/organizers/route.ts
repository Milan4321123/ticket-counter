import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { createOrganizer, getOrganizerByEmail } from '@/lib/organizers';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Platform admin creates an organizer account by hand. The account itself is
 * free and never expires — the platform fee is charged per event, when the
 * organizer publishes one. Returns the generated initial password EXACTLY
 * ONCE — it is never stored in plain text and can only be reset, not re-read.
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json(
        { error: 'Please sign in to the admin area first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    interface CreateOrganizerBody {
      name?: unknown;
      email?: unknown;
    }
    let body: CreateOrganizerBody | null = null;
    try {
      body = (await req.json()) as CreateOrganizerBody;
    } catch {
      // handled below
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!name || name.length > 120) {
      return NextResponse.json(
        { error: 'Please enter the organizer’s name.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    if (getOrganizerByEmail(email)) {
      return NextResponse.json(
        { error: 'There is already an organizer account with this email address.' } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    try {
      const { organizer, initialPassword } = createOrganizer({ name, email });
      return NextResponse.json({ ok: true, organizer, initialPassword });
    } catch (e) {
      // Race fallback: the UNIQUE(email) constraint fired between check and insert.
      if (e instanceof Error && /UNIQUE/i.test(e.message)) {
        return NextResponse.json(
          { error: 'There is already an organizer account with this email address.' } satisfies ApiErrorResponse,
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (e) {
    console.error('POST /api/admin/organizers failed:', e);
    return NextResponse.json(
      { error: 'Could not create the account. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
