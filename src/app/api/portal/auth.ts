// Server-only: shared auth/ownership guards for the organizer-portal API.
// Every /api/portal route funnels through these so the rules live in ONE place:
//   1. a valid organizer session is required (401 otherwise),
//   2. writes require an account that is switched on (403 otherwise),
//   3. an organizer can only ever touch their OWN events/media (404 otherwise —
//      indistinguishable from a resource that does not exist).
import { NextResponse } from 'next/server';
import { getEventById, type EventRow } from '@/lib/events';
import { currentOrganizer, organizerPlanActive, type OrganizerRow } from '@/lib/organizers';
import type { ApiErrorResponse } from '@/lib/types';

type Guarded<T extends object> = ({ failure: null } & T) | ({ failure: NextResponse } & { [K in keyof T]: null });

/**
 * The signed-in organizer, or a ready-to-return 401 response.
 *
 * An account still carrying the one-time password the platform emailed it can
 * do exactly one thing: replace that password (allowUnchangedPassword, used by
 * /api/portal/password). Everything else is refused, so the API cannot be used
 * to walk around the wall the page guard puts up.
 */
export async function requireOrganizerApi(
  options: { allowUnchangedPassword?: boolean } = {}
): Promise<Guarded<{ organizer: OrganizerRow }>> {
  const organizer = await currentOrganizer();
  if (!organizer) {
    return {
      organizer: null,
      failure: NextResponse.json(
        { error: 'Please sign in to your organizer account first.' } satisfies ApiErrorResponse,
        { status: 401 }
      ),
    };
  }
  if (organizer.mustChangePassword && !options.allowUnchangedPassword) {
    return {
      organizer: null,
      failure: NextResponse.json(
        {
          error: 'Please choose your own password first — open the portal and it will ask you for one.',
        } satisfies ApiErrorResponse,
        { status: 403 }
      ),
    };
  }
  return { organizer, failure: null };
}

/**
 * Non-null 403 response when the account cannot make changes. Accounts never
 * expire under per-event pricing, so this only fires for an account the
 * platform switched off (or one that is not activated yet).
 */
export function planGate(organizer: OrganizerRow): NextResponse | null {
  if (organizerPlanActive(organizer)) return null;
  return NextResponse.json(
    {
      error:
        'This account is switched off, so changes are paused for now. Contact the platform team — your published events keep running in the meantime.',
    } satisfies ApiErrorResponse,
    { status: 403 }
  );
}

/**
 * Look up an event and verify it belongs to this organizer. A miss returns
 * 404 whether the event does not exist or belongs to someone else.
 */
export function requireOwnedEvent(organizer: OrganizerRow, eventId: string): Guarded<{ event: EventRow }> {
  const event = getEventById(eventId);
  if (!event || event.organizerId !== organizer.id) {
    return {
      event: null,
      failure: NextResponse.json(
        { error: 'We could not find that event.' } satisfies ApiErrorResponse,
        { status: 404 }
      ),
    };
  }
  return { event, failure: null };
}
