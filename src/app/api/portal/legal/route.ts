import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import { BodyTooLargeError, fromThisSite, readJsonLimited } from '@/lib/http';
import { getOrganizer, setOrganizerLegalDetails, validateLegalDetails } from '@/lib/organizers';
import type { ApiErrorResponse } from '@/lib/types';
import { demoGate, planGate, requireOrganizerApi } from '../auth';

export const dynamic = 'force-dynamic';

/**
 * Save the organizer's legal identity — the seller buyers are shown on every
 * page and email (lib/sellerIdentity), and the controller named in the AVV.
 * Validation lives in lib/organizers so the rules cannot differ between here
 * and anything else that writes them.
 */
export async function POST(req: Request) {
  try {
    if (!fromThisSite(req, getBaseUrl())) {
      return NextResponse.json({ error: 'Forbidden' } satisfies ApiErrorResponse, { status: 403 });
    }
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer) ?? demoGate(organizer, 'entering legal details');
    if (blocked) return blocked;

    let body: unknown;
    try {
      body = await readJsonLimited(req);
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      return NextResponse.json({ error: 'Nothing to save.' } satisfies ApiErrorResponse, { status: 400 });
    }

    const checked = validateLegalDetails(body);
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error } satisfies ApiErrorResponse, { status: 400 });
    }
    setOrganizerLegalDetails(organizer.id, checked.value);
    const saved = getOrganizer(organizer.id);
    return NextResponse.json({
      ok: true,
      details: {
        legalName: saved?.legalName ?? checked.value.legalName,
        legalAddress: saved?.legalAddress ?? checked.value.legalAddress,
        legalRepresentative: saved?.legalRepresentative ?? checked.value.legalRepresentative,
        legalRegister: saved?.legalRegister ?? checked.value.legalRegister,
        legalContactEmail: saved?.legalContactEmail ?? checked.value.legalContactEmail,
      },
    });
  } catch (e) {
    console.error('POST /api/portal/legal failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
