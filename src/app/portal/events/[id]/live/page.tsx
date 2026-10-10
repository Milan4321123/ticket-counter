import { redirect } from 'next/navigation';
import { getEventById } from '@/lib/events';
import { organizerPlanActive } from '@/lib/organizers';
import PlanExpired from '../../../PlanExpired';
import PortalNav from '../../../PortalNav';
import { requirePortalOrganizer } from '../../../guard';
import LiveBoard from './LiveBoard';
import OnlineSalesSwitch from '../../../OnlineSalesSwitch';
import { onlineSwitchState } from '@/lib/onlineSales';
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
        {/* Door night: the one control an organizer reaches for when the hall
            fills faster than planned — stop selling online, send buyers to the
            counter. Events only; a shop has no show to hand over to. */}
        {event.kind === 'event' && (
          <div style={{ marginBottom: 14 }}>
            <OnlineSalesSwitch eventId={event.id} {...onlineSwitchState(event)} />
          </div>
        )}
        <LiveBoard eventId={event.id} name={event.name} currency={event.currency} isShop={event.kind === 'shop'} />
        </div>
      </div>
    </>
  );
}
