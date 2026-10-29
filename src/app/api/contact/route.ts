import { NextResponse } from 'next/server';
import { createContactRequest, type ContactRequestKind } from '@/lib/contact';
import { sendContactRequestAck, sendContactRequestToTeam } from '@/lib/email';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 3 enquiries per minute per IP, plus a global backstop so rotated spoofed IPs
// can't fill the inbox (or the outbox) either.
const IP_LIMIT = 3;
const IP_WINDOW_MS = 60_000;
const GLOBAL_KEY = 'contact:all';
const GLOBAL_LIMIT = 40;
const GLOBAL_WINDOW_MS = 60 * 60_000;

const KINDS: ContactRequestKind[] = ['custom-design', 'organizer-account', 'general'];

/**
 * Public contact form: someone applying for an organizer account (the only way
 * to get one), or asking us to design a page for them.
 *
 * The enquiry is STORED first and emailed afterwards, fire-and-forget — an
 * application must never be lost to an SMTP outage, and the sender must never
 * wait for one.
 */
export async function POST(req: Request) {
  try {
    if (
      !rateLimit(`contact:${clientIp(req)}`, IP_LIMIT, IP_WINDOW_MS) ||
      !rateLimit(GLOBAL_KEY, GLOBAL_LIMIT, GLOBAL_WINDOW_MS)
    ) {
      return NextResponse.json(
        {
          error: 'Too many messages from here — please wait a minute and try again.',
        } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    interface ContactBody {
      name?: unknown;
      email?: unknown;
      organization?: unknown;
      message?: unknown;
      kind?: unknown;
      // Only the account application asks for these, and all of them are
      // optional — free text, because "about 300" is a real answer.
      phone?: unknown;
      eventKind?: unknown;
      eventWhen?: unknown;
      eventWhere?: unknown;
      expectedPeople?: unknown;
      website?: unknown; // honeypot — humans never see this field
    }
    let body: ContactBody | null = null;
    try {
      body = (await readJsonLimited(req)) as ContactBody;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That message was too long.' } satisfies ApiErrorResponse, { status: 413 });
      }
      // Malformed JSON — the field checks below produce the friendly errors.
    }

    // Honeypot: only a bot fills in a field it cannot see. Answer exactly like
    // a success so the bot has nothing to learn, but store nothing and send
    // nothing.
    if (typeof body?.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ ok: true });
    }

    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    // A plain message (the "Sathi" bubble asks only for an email and the
    // message) may come without a name; the inbox and the reply then address
    // them by the part of the address before the @.
    const givenName = typeof body?.name === 'string' ? body.name.trim() : '';
    const name = givenName || (body?.kind === 'general' && EMAIL_RE.test(email) ? email.split('@')[0].slice(0, 120) : '');
    const organization = typeof body?.organization === 'string' ? body.organization.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const kind: ContactRequestKind =
      typeof body?.kind === 'string' && (KINDS as string[]).includes(body.kind)
        ? (body.kind as ContactRequestKind)
        : 'custom-design';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const eventKind = typeof body?.eventKind === 'string' ? body.eventKind.trim() : '';
    const eventWhen = typeof body?.eventWhen === 'string' ? body.eventWhen.trim() : '';
    const eventWhere = typeof body?.eventWhere === 'string' ? body.eventWhere.trim() : '';
    const expectedPeople = typeof body?.expectedPeople === 'string' ? body.expectedPeople.trim() : '';

    if (!name || name.length > 120) {
      return NextResponse.json({ error: 'Please tell us your name.' } satisfies ApiErrorResponse, { status: 400 });
    }
    if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address so we can reply.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    if (organization.length > 160) {
      return NextResponse.json(
        { error: 'That organization name is a little too long — please shorten it.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    // Each optional detail is capped the same way the required fields are, so a
    // bot cannot turn one of them into a payload.
    const tooLong = (
      [
        [phone, 60, 'phone number'],
        [eventKind, 160, 'kind of event'],
        [eventWhen, 160, 'date'],
        [eventWhere, 200, 'venue'],
        [expectedPeople, 60, 'number of people'],
      ] as const
    ).find(([value, max]) => value.length > max);
    if (tooLong) {
      return NextResponse.json(
        { error: `That ${tooLong[2]} is a little too long — please shorten it.` } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    if (message.length < 10) {
      return NextResponse.json(
        { error: 'Please tell us a bit more about what you would like — a sentence or two is plenty.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    if (message.length > 6000) {
      return NextResponse.json(
        { error: 'That message is a bit long — please keep it under 6000 characters.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    const request = createContactRequest({
      name,
      email,
      organization,
      message,
      kind,
      phone,
      eventKind,
      eventWhen,
      eventWhere,
      expectedPeople,
    });

    // Both mails are fire-and-forget: the enquiry is already saved and visible
    // at /admin/contact, so a mail failure must not turn into an error for the
    // person who just wrote to us.
    void sendContactRequestToTeam(request)
      .then((result) => console.log(`Contact request ${request.id} → team:`, result))
      .catch((e) => console.error(`Contact request ${request.id} team email threw unexpectedly:`, e));
    void sendContactRequestAck(request)
      .then((result) => console.log(`Contact request ${request.id} ack:`, result))
      .catch((e) => console.error(`Contact request ${request.id} ack email threw unexpectedly:`, e));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/contact failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
