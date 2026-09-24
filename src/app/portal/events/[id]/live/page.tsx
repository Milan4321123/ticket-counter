import { redirect } from 'next/navigation';
import { getEventById } from '@/lib/events';
import { organizerPlanActive } from '@/lib/organizers';
import PlanExpired from '../../../PlanExpired';
import PortalNav from '../../../PortalNav';
import { requirePortalOrganizer } from '../../../guard';
import LiveBoard from './LiveBoard';
import '../../../live.css';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Live — Seller hub', robots: { index: false, follow: false } };

/** The live event-day screen (lib/liveDoor): arrivals in real time, for a screen by the door. */
export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organizer = await requirePortalOrganizer();
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;
  const event = getEventById(id);
  if (!event || event.organizerId !== organizer.id) redirect('/portal');
  return (
    <>
      <PortalNav
        event={{ id: event.id, name: event.name, slug: event.slug, published: event.status === 'published', kind: event.kind }}
        tab="live"
      />
      <div className="section" style={{ paddingTop: 18 }}>
        <div className="container">
        <LiveBoard eventId={event.id} name={event.name} currency={event.currency} isShop={event.kind === 'shop'} />
        </div>
      </div>
    </>
  );
}
