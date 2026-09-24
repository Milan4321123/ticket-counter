// Server-only: page-level guard for the organizer portal.
import { redirect } from 'next/navigation';
import { currentOrganizer, type OrganizerRow } from '@/lib/organizers';
import { sweepExpiredDemos } from '@/lib/demo';

/**
 * The signed-in organizer for this request; anyone without a valid session is
 * sent to the portal sign-in page. Pages still check the plan themselves
 * (see organizerPlanActive + <PlanExpired/>), so login/logout stay reachable.
 *
 * An account still on its emailed one-time password gets no further than
 * /portal/change-password. EVERY portal page goes through this function, so
 * there is no way around it; the change-password page itself deliberately does
 * not (it calls currentOrganizer directly), which is what keeps this from
 * looping.
 */
export async function requirePortalOrganizer(): Promise<OrganizerRow> {
  // Expired try-it-yourself demos are cleared whenever anyone uses the portal
  // (throttled to once every ten minutes; see lib/demo.ts).
  sweepExpiredDemos();
  const organizer = await currentOrganizer();
  if (!organizer) redirect('/portal/login');
  if (organizer.mustChangePassword) redirect('/portal/change-password');
  return organizer;
}
