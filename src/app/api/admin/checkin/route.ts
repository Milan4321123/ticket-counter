import { NextResponse } from 'next/server';
import { SCAN_COOKIE_NAME, verifyScanToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { cardAtCounter, isCardCode } from '@/lib/cards';
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
 *
 * TWO KINDS OF CODE arrive here, and one endpoint is the right place to tell
 * them apart: a TICKET code, which is checked in, and a CUSTOMER CARD code
 * (lib/cards.ts), which is not — a card is spent on nothing and admits nobody,
 * it just says who is standing at the counter. The two shapes cannot be
 * confused (see isCardCode for why length makes that structural).
 *
 * Only an ORGANIZER SESSION may look a card up. The scanner-cookie branch below
 * never even tests for one, so a card scanned on a door-staff link falls
 * through to the ticket lookup and comes back 'not_found' — door staff are
 * handed a scanner to verify codes, not to read a customer's history with the
 * seller. That rule lives HERE rather than in the UI, so which page rendered
 * the scanner cannot change who is allowed to see what.
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
      // A customer card, held up by a regular. Scoped to this organizer's own
      // cards — cardAtCounter answers null for anybody else's, and the reply
      // is the same 'not_found' a stranger's junk gets, so the endpoint never
      // confirms that some other seller's card exists.
      if (isCardCode(code)) {
        const card = cardAtCounter(code, organizer.id);
        return NextResponse.json(
          (card
            ? {
                result: 'customer_card',
                card: {
                  cardCode: card.cardCode,
                  holderName: card.holderName,
                  email: card.email,
                  confirmedOrders: card.confirmedOrders,
                  heldForDays: card.heldForDays,
                  lastSeenAt: card.lastSeenAt,
                  vouchers: card.vouchers.map((v) => ({ code: v.code, amountCents: v.amountCents })),
                  currency: card.currency,
                },
              }
            : { result: 'not_found' }) satisfies CheckinResponse
        );
      }

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
