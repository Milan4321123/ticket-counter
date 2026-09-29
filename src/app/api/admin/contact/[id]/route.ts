import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { getContactRequest, markContactRequestHandled } from '@/lib/contact';
import { deleteContactRequest } from '@/lib/erasure';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Platform admin ticks one contact request off the inbox: { handled: true }.
 * A handled enquiry stays readable at /admin/contact until it is deleted (DELETE
 * below) or reaches its retention limit (lib/retention.ts).
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

/**
 * Platform admin deletes one contact request outright — the conversation is
 * over, or the person asked for their message to be erased (Art. 17 GDPR).
 * The retention sweep deletes every request after CONTACT_REQUEST_RETENTION_DAYS
 * anyway (lib/retention.ts); this is the "sooner" button.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json(
        { error: 'Please sign in to the admin area first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }
    if (!deleteContactRequest(id)) {
      return NextResponse.json({ error: 'That request no longer exists.' } satisfies ApiErrorResponse, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`DELETE /api/admin/contact/${id} failed:`, e);
    return NextResponse.json(
      { error: 'Could not delete the request. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
