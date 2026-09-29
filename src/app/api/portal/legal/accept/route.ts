import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import { BodyTooLargeError, fromThisSite, readJsonLimited } from '@/lib/http';
import { LEGAL_TERMS_VERSION } from '@/lib/legal';
import { acceptLegalTerms } from '@/lib/organizers';
import type { ApiErrorResponse } from '@/lib/types';
import { demoGate, planGate, requireOrganizerApi } from '../../auth';

export const dynamic = 'force-dynamic';

/**
 * Record that the organizer accepted the platform terms (/terms) and concluded
 * the Auftragsverarbeitungsvertrag (/avv) in the version published now.
 *
 * The body must name that version and carry the ticked box: a click on a
 * page that was open since before a new version went up must not accept a
 * text the person never saw.
 */
export async function POST(req: Request) {
  try {
    if (!fromThisSite(req, getBaseUrl())) {
      return NextResponse.json({ error: 'Forbidden' } satisfies ApiErrorResponse, { status: 403 });
    }
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer) ?? demoGate(organizer, 'accepting the terms');
    if (blocked) return blocked;

    let body: Record<string, unknown>;
    try {
      const parsed = await readJsonLimited(req, 1024);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError('not an object');
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      return NextResponse.json({ error: 'Please tick the box first.' } satisfies ApiErrorResponse, { status: 400 });
    }

    if (body.accept !== true) {
      return NextResponse.json({ error: 'Please tick the box first.' } satisfies ApiErrorResponse, { status: 400 });
    }
    if (body.version !== LEGAL_TERMS_VERSION) {
      return NextResponse.json(
        {
          error: 'The terms were updated while this page was open. Please reload it and read the current version.',
        } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    const result = acceptLegalTerms(organizer.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error } satisfies ApiErrorResponse, { status: 400 });
    }
    return NextResponse.json({ ok: true, version: result.version, acceptedAt: result.acceptedAt });
  } catch (e) {
    console.error('POST /api/portal/legal/accept failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
