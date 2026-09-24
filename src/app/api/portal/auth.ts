// Server-only: shared auth/ownership guards for the organizer-portal API.
// Every /api/portal route funnels through these so the rules live in ONE place:
//   1. a valid organizer session is required (401 otherwise),
//   2. writes require an account that is switched on (403 otherwise),
//   3. an organizer can only ever touch their OWN events/media (404 otherwise —
//      indistinguishable from a resource that does not exist).
import { NextResponse } from 'next/server';
import { describeDevice, sendSignInAlertEmail } from '@/lib/email';
import { getEventById, type EventRow } from '@/lib/events';
import { currentOrganizer, organizerPlanActive, type OrganizerRow } from '@/lib/organizers';
import { rateLimit } from '@/lib/ratelimit';
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
 * Non-null 403 when a try-it-yourself demo account (lib/demo.ts) tries
 * something a demo may not do: upload files (media URLs are public), set real
 * payment details, or connect a PayPal/Stripe account. The wording says it is
 * the demo, not a fault, so the visitor is not left thinking the feature is
 * broken.
 */
export function demoGate(organizer: OrganizerRow, what: string): NextResponse | null {
  if (!organizer.isDemo) return null;
  return NextResponse.json(
    {
      error: `This is a demo account, so ${what} is switched off here. In a real account it works exactly as shown.`,
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

/**
 * One hour between sign-in alerts for the same account.
 *
 * The alert is meant to be read, and an organizer working an event door signs
 * in over and over on the same phone — ten identical emails in an afternoon is
 * how a person learns to ignore the eleventh, which is the one that matters. An
 * intruder inside the window is already covered by the alert that was sent.
 */
const SIGN_IN_ALERT_WINDOW_MS = 60 * 60_000;

/**
 * Tell the account's own address that somebody just signed in.
 *
 * Called from BOTH sign-in paths — the password-only one and the one that ends
 * at the authenticator — because the point is to catch whoever got in, however
 * they managed it.
 *
 * Not awaited on purpose: a sign-in must never wait on SMTP, nor fail because a
 * mail server was slow. sendSignInAlertEmail() swallows its own errors.
 *
 * Worth knowing what this is currently worth: until the sending domain is
 * authenticated, mail to some providers is silently dropped, so this warns
 * reliably only once that is done.
 */
export function notifySignIn(organizer: OrganizerRow, req: Request): void {
  if (!rateLimit(`signin-alert:${organizer.id}`, 1, SIGN_IN_ALERT_WINDOW_MS)) return;
  void sendSignInAlertEmail(
    { name: organizer.name, email: organizer.email },
    { device: describeDevice(req.headers.get('user-agent') ?? ''), when: new Date() }
  );
}
