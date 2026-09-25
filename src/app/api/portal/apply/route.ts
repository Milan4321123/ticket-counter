import { NextResponse } from 'next/server';
import { createContactRequest } from '@/lib/contact';
import { getDb } from '@/lib/db';
import { keepDemoForApplication } from '@/lib/demo';
import { sendContactRequestAck, sendContactRequestToTeam } from '@/lib/email';
import { readListingName } from '@/lib/exampleShop';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';
import { requireOrganizerApi, requireOwnedEvent } from '../auth';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(error: string, status = 400) {
  return NextResponse.json({ error } satisfies ApiErrorResponse, { status });
}

/**
 * "Apply with this page": a demo visitor asks for a real account and sends
 * the demo page they built along with it. It lands in the platform owner's
 * account applications (/admin/contact) like any other — the owner still
 * decides, by hand, who gets an account and so who can ever publish — and on
 * approval the page moves into the new account as a draft (lib/demo
 * adoptDemoListing). Until then the demo is kept for 30 days instead of 24h.
 *
 * Only a demo account can use this, and only with a page it owns.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const organizer = auth.organizer;
    if (!organizer.isDemo) return fail('This is for demo accounts — your account is already real.', 403);
    if (!rateLimit(`apply:${clientIp(req)}`, 3, 60 * 60_000) || !rateLimit('apply:all', 40, 60 * 60_000)) {
      return fail('Too many applications just now — please try again in a while.', 429);
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const str = (k: string) => (typeof body?.[k] === 'string' ? (body[k] as string).trim() : '');
    const eventId = str('eventId');
    const name = str('name');
    const email = str('email').toLowerCase();
    const phone = str('phone');
    const note = str('message');

    const owned = requireOwnedEvent(organizer, eventId);
    if (owned.failure) return owned.failure;
    const event = owned.event;

    if (!name || name.length > 120) return fail('Please tell us your name.');
    if (!email || email.length > 200 || !EMAIL_RE.test(email) || email.endsWith('.invalid')) {
      return fail('Please give an email address we can send your login to.');
    }
    if (phone.length > 60) return fail('That phone number is a little too long.');
    if (note.length > 2000) return fail('That message is a bit long — please keep it under 2000 characters.');

    const already = getDb()
      .prepare(`SELECT 1 FROM contact_requests WHERE demo_event_id = ? AND organizer_id IS NULL`)
      .get(event.id);
    if (already) return fail('This page has already been sent — we will get back to you by email.', 409);

    const listing = readListingName(event.name).name;
    const what = event.kind === 'shop' ? 'shop' : 'event';
    const request = createContactRequest({
      name,
      email,
      message:
        `Applied from the demo with the ${what} page “${listing}” — it moves into the new account as a draft on approval.` +
        (note ? `\n\n${note}` : ''),
      kind: 'organizer-account',
      phone,
      eventKind: event.kind === 'shop' ? 'Shop' : 'Event',
      eventWhere: event.city || event.venueName || '',
      eventWhen: event.kind === 'shop' ? '' : event.dateDisplay || event.eventDate || '',
      demoEventId: event.id,
    });
    keepDemoForApplication(organizer.id);

    void sendContactRequestToTeam(request)
      .then((r) => console.log(`Demo application ${request.id} → team:`, r))
      .catch((e) => console.error(`Demo application ${request.id} team email threw:`, e));
    void sendContactRequestAck(request)
      .then((r) => console.log(`Demo application ${request.id} ack:`, r))
      .catch((e) => console.error(`Demo application ${request.id} ack email threw:`, e));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/portal/apply failed:', e);
    return fail('Could not send your application. Please try again.', 500);
  }
}
