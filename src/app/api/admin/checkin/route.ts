import { NextResponse } from 'next/server';
import { SCAN_COOKIE_NAME, verifyScanToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { getEventById } from '@/lib/events';
import { currentOrganizer } from '@/lib/organizers';
import { checkInTicket, getTicketByCode } from '@/lib/orders';
import type { ApiErrorResponse, CheckinRequest, CheckinResponse } from '@/lib/types';

/**
 * Door check-in. Two callers are allowed, both scoped to one event:
 *  - an organizer session: only tickets for THEIR OWN events;
 *  - a scanner cookie (from an event-scoped scanner link): only tickets for
 *    THAT event.
 * Out-of-scope tickets come back as 'wrong_event' with no ticket details, so
 * nobody ever sees another event's buyer data.
 *
 * The PLATFORM ADMIN session is deliberately not a caller. A successful check-in
 * names the ticket holder — that is the point of it at a door — so an admin who
 * could scan any event's tickets was an admin who could read any organizer's
 * buyers. Door staff still get in through the organizer's scanner link, which
 * is what that link is for.
 */
export async function POST(req: Request) {
  try {
    const store = await cookies();
    const scan = verifyScanToken(store.get(SCAN_COOKIE_NAME)?.value ?? null);
    const organizer = scan ? null : await currentOrganizer();
    if (!scan && !organizer) {
      return NextResponse.json(
        { error: 'Please sign in first, or open a valid scanner link.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    let code = '';
    try {
      const body = (await req.json()) as CheckinRequest;
      if (typeof body?.code === 'string') code = body.code.trim().slice(0, 64);
    } catch {
      // Malformed body -> empty code -> not_found below.
    }

    if (!code) {
      return NextResponse.json({ result: 'not_found' } satisfies CheckinResponse);
    }

    if (scan) {
      // Scanner cookies are always scoped to the one event they were minted for.
      return NextResponse.json(checkInTicket(code, { eventId: scan.eventId }) satisfies CheckinResponse);
    }

    if (organizer) {
      // Organizer session: the ticket's event must belong to this organizer.
      const ticket = getTicketByCode(code);
      if (!ticket) {
        return NextResponse.json({ result: 'not_found' } satisfies CheckinResponse);
      }
      const event = getEventById(ticket.eventId);
      if (!event || event.organizerId !== organizer.id) {
        return NextResponse.json({ result: 'wrong_event' } satisfies CheckinResponse);
      }
      return NextResponse.json(checkInTicket(code, { eventId: event.id }) satisfies CheckinResponse);
    }

    // Unreachable past the guard above — kept so neither branch needs a
    // non-null assertion to convince the compiler.
    return NextResponse.json(
      { error: 'Please sign in first, or open a valid scanner link.' } satisfies ApiErrorResponse,
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
