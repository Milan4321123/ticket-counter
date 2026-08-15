import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { getContactRequest, markContactRequestHandled } from '@/lib/contact';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Platform admin ticks one contact request off the inbox: { handled: true }.
 * Nothing is ever deleted — a handled enquiry stays readable at /admin/contact.
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

    const request = getContactRequest(id);
    if (!request) {
      return NextResponse.json(
        { error: 'That request no longer exists.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }

    interface UpdateContactBody {
      handled?: unknown;
    }
    let body: UpdateContactBody | null = null;
    try {
      body = (await readJsonLimited(req)) as UpdateContactBody;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      // Malformed JSON — handled by the "nothing to change" check below.
    }

    if (body?.handled !== true) {
      return NextResponse.json(
        { error: 'Nothing to change — please try again.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    markContactRequestHandled(id); // already handled? then there is simply nothing to do
    return NextResponse.json({ ok: true, request: getContactRequest(id) });
  } catch (e) {
    console.error(`POST /api/admin/contact/${id} failed:`, e);
    return NextResponse.json(
      { error: 'Could not update the request. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
