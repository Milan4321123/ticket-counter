import Link from 'next/link';
import { redirect } from 'next/navigation';
import CheckinClient from '@/app/admin/checkin/CheckinClient';
import { getEventById } from '@/lib/events';
import { organizerPlanActive } from '@/lib/organizers';
import PlanExpired from '../../../PlanExpired';
import PortalNav from '../../../PortalNav';
import { requirePortalOrganizer } from '../../../guard';
import ScanLinkCard from './ScanLinkCard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Door check-in — Organizer portal', robots: { index: false, follow: false } };

/**
 * Door check-in for ONE of the organizer's own events, right inside the
 * portal. The organizer's own session cookie authorizes the scans — the
 * check-in endpoint accepts organizer sessions for their events' tickets and
 * answers "Different event" for anything else.
 */
export default async function PortalCheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organizer = await requirePortalOrganizer();
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;

  const event = getEventById(id);
  if (!event || event.organizerId !== organizer.id) redirect('/portal');

  return (
    <>
      <PortalNav
        event={{ id: event.id, name: event.name, slug: event.slug, published: event.status === 'published' }}
        tab="checkin"
      />
      <div className="container container-narrow section">
        <div className="anim-fade-up" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            Door check-in
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {event.name}
            {event.dateDisplay ? ` · ${event.dateDisplay}` : ''}
          </p>
        </div>

        <p className="muted small anim-fade-up" style={{ marginTop: -8 }}>
          Scan the QR code on each ticket, or type its code. Every ticket works exactly once — a second scan shows
          &ldquo;Already used&rdquo;. For student tickets, ask to see a student ID at the door.
        </p>

        <div className="anim-fade-up anim-d1">
          <CheckinClient unauthorizedHref="/portal/login" />
        </div>

        {/* Handing the door to someone else is a check-in job, so the links live
            on the check-in page rather than a tab about money. */}
        <div className="card anim-fade-up anim-d2" style={{ marginTop: 22 }}>
          <div className="card-title">Scanner links for door staff</div>
          <ScanLinkCard eventId={event.id} />
        </div>

        <p className="muted small anim-fade-up anim-d3" style={{ marginTop: 20 }}>
          Head{' '}
          <Link href={`/portal/events/${event.id}/edit`} style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
            back to {event.name}
          </Link>
          .
        </p>
      </div>
    </>
  );
}
