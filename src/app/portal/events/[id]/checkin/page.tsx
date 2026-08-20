import Link from 'next/link';
import { redirect } from 'next/navigation';
import CheckinClient from '@/app/admin/checkin/CheckinClient';
import { getEventById } from '@/lib/events';
import { vocabFor } from '@/lib/vocab';
import { organizerPlanActive } from '@/lib/organizers';
import PlanExpired from '../../../PlanExpired';
import PortalNav from '../../../PortalNav';
import { requirePortalOrganizer } from '../../../guard';
import ScanLinkCard from './ScanLinkCard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Check-in — Organizer portal', robots: { index: false, follow: false } };

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

  // Identical scanning either way — the same endpoint, the same one-scan rule.
  // Only what the person holding the phone is doing has a different name.
  const v = vocabFor(event.kind);
  const isShop = event.kind === 'shop';
  const whenLine = isShop
    ? (event.pickupInfo.split('\n').map((l) => l.trim()).find(Boolean) ?? '')
    : event.dateDisplay;

  return (
    <>
      <PortalNav
        event={{ id: event.id, name: event.name, slug: event.slug, published: event.status === 'published', kind: event.kind }}
        tab="checkin"
      />
      <div className="container container-narrow section">
        <div className="anim-fade-up" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            {isShop ? 'Hand over orders' : 'Door check-in'}
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {event.name}
            {whenLine ? ` · ${whenLine}` : ''}
          </p>
        </div>

        <p className="muted small anim-fade-up" style={{ marginTop: -8 }}>
          Scan the QR code on each {v.code}, or type it in. Every {v.code} works exactly once — a second
          scan shows &ldquo;Already used&rdquo;.{' '}
          {isShop
            ? 'One scan per item, then hand the order over.'
            : 'For student tickets, ask to see a student ID at the door.'}
        </p>

        {/* The same box reads CUSTOMER CARDS too — the codes your regulars
            chose to hold with you. Scanning one admits nobody and spends
            nothing; it tells you who is in front of you and what codes they
            are carrying. Deliberately NOT on the scanner links below: door
            staff are handed a scanner to verify {v.codes}, not to read a
            customer's history with you, and /api/admin/checkin enforces that
            rather than trusting this page. */}
        <p className="muted small anim-fade-up" style={{ marginTop: -4 }}>
          A card code (<span className="mono">card-…</span>) works in the same box: it shows you who
          the holder is instead of checking anything in.
        </p>

        <div className="anim-fade-up anim-d1">
          <CheckinClient unauthorizedHref="/portal/login" kind={event.kind} cards />
        </div>

        {/* Handing the scanning to someone else is a check-in job, so the links
            live on this page rather than a tab about money. */}
        <div className="card anim-fade-up anim-d2" style={{ marginTop: 22 }}>
          <div className="card-title">Scanner links for {isShop ? 'whoever is on the counter' : 'door staff'}</div>
          <ScanLinkCard eventId={event.id} kind={event.kind} />
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
