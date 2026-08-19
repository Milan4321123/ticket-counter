import { NextResponse } from 'next/server';
import { isEmailConfigured, sendOrganizerAnnouncementEmail } from '@/lib/email';
import { claimAnnouncementSend, listAnnouncementAudience, releaseAnnouncementSend } from '@/lib/marketing';
import { rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../auth';

/**
 * Announce a published listing to this organizer's subscribers — everyone who
 * ticked "keep me posted" at one of their checkouts and has not unsubscribed,
 * MINUS anyone already announced-to for this event.
 *
 * The one promise this route must keep is "at most one email per new listing":
 * each subscriber's send is CLAIMED in marketing_sends (UNIQUE per consent and
 * event) before their email goes out, so pressing the button twice — or two
 * organizers' browser tabs racing — re-emails nobody. A claim whose send then
 * FAILS is released again in the same iteration: otherwise one SMTP outage
 * during the run would silently spend every remaining subscriber's one email
 * on nothing, with no retry path — while the portal tells the organizer the
 * opposite. Releasing is safe because a failed send delivered nothing.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    const owned = requireOwnedEvent(organizer, id);
    if (owned.failure) return owned.failure;
    const { event } = owned;

    // Only a LIVE page may be announced: the email links straight to /e/[slug],
    // and a draft's link answers nothing — every subscriber's one email about
    // this event would be spent on a dead end.
    if (event.status !== 'published') {
      return NextResponse.json(
        { error: 'Publish first — the announcement links to your public page, which does not exist yet.' } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: 'Email is not configured on this server, so announcements cannot be sent right now.' } satisfies ApiErrorResponse,
        { status: 503 }
      );
    }

    // Per-organizer, not per-IP: this button sends real email to real inboxes,
    // and the send-tracking already makes repeats about ONE event harmless —
    // what this bounds is one account hammering its whole subscriber base
    // across many events in a burst. Three an hour is more listings than
    // anyone publishes in one; a real fourth can simply wait.
    if (!rateLimit(`announce:${organizer.id}`, 3, 60 * 60_000)) {
      return NextResponse.json(
        { error: 'You have sent several announcements just now — please wait an hour before the next one.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    const audience = listAnnouncementAudience(organizer.id, event.id);

    // Sequential on purpose: one SMTP connection's pace is the polite ceiling
    // for a marketing send, and an audience this platform can gather is small
    // enough that nobody is watching a spinner for long.
    let sent = 0;
    let failed = 0;
    for (const consent of audience) {
      // Claim BEFORE sending — see lib/marketing.ts for why this order.
      if (!claimAnnouncementSend(consent.id, event.id)) continue;
      const result = await sendOrganizerAnnouncementEmail(consent.email, event);
      if (result.sent) {
        sent++;
      } else {
        // Give the claim back: this subscriber heard nothing, so they must
        // stay in the audience for the retry the portal promises. The email
        // sender never throws, so a false here always means nothing was sent.
        releaseAnnouncementSend(consent.id, event.id);
        failed++;
        console.error(
          `Announcement for event ${event.id} to consent ${consent.id} not sent: ${result.reason}`
        );
      }
    }

    return NextResponse.json({ ok: true, sent, failed });
  } catch (e) {
    console.error(`POST /api/portal/events/${id}/announce failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
