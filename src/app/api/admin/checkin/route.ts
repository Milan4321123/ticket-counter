import { NextResponse } from 'next/server';
import { isScanRequest } from '@/lib/auth';
import { getEventById } from '@/lib/events';
import { currentOrganizer } from '@/lib/organizers';
import { checkInTicket, getTicketByCode } from '@/lib/orders';
import type { ApiErrorResponse, CheckinRequest, CheckinResponse } from '@/lib/types';

/**
 * Door check-in. Three callers are allowed, with different scopes:
 *  - the platform admin: any ticket, any event;
 *  - an organizer session: only tickets for THEIR OWN events;
 *  - a scanner cookie (from an event-scoped scanner link): only tickets for
 *    THAT event.
 * Out-of-scope tickets come back as 'wrong_event' with no ticket details, so
 * nobody ever sees another event's buyer data.
 */
export async function POST(req: Request) {
  try {
    const scan = await isScanRequest();
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

    // Scanner cookies are scoped to their event; the platform admin is not.
    const scope = scan && scan.kind === 'scan' ? { eventId: scan.eventId } : undefined;
    return NextResponse.json(checkInTicket(code, scope) satisfies CheckinResponse);
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
