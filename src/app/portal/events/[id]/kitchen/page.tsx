import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getEventById } from '@/lib/events';
import { parseSlotConfig } from '@/lib/kitchen';
import { organizerPlanActive } from '@/lib/organizers';
import PlanExpired from '../../../PlanExpired';
import PortalNav from '../../../PortalNav';
import { requirePortalOrganizer } from '../../../guard';
import KitchenBoard from './KitchenBoard';
import '../../../kitchen.css';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Kitchen — Seller hub', robots: { index: false, follow: false } };

/** The live kitchen board for one of the seller's shops (lib/kitchen). */
export default async function KitchenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organizer = await requirePortalOrganizer();
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;
  const event = getEventById(id);
  if (!event || event.organizerId !== organizer.id) redirect('/portal');
  if (event.kind !== 'shop') redirect(`/portal/events/${event.id}/edit`);

  const slots = parseSlotConfig(event.pickupSlots);

  return (
    <>
      <PortalNav
        event={{ id: event.id, name: event.name, slug: event.slug, published: event.status === 'published', kind: event.kind }}
        tab="kitchen"
      />
      <div className="section" style={{ paddingTop: 18 }}>
        <div className="container">
        <KitchenBoard eventId={event.id} shopName={event.name} mode={slots.purpose} />
        <p className="muted small" style={{ marginTop: 18 }}>
          Paid orders appear here by themselves, ordered by collection time
          {slots.enabled ? '' : ' (switch on collection times to let buyers pick one)'}. &ldquo;Mark ready&rdquo; emails
          the buyer. Set up collection times, item choices and table QR codes in{' '}
          <Link href={`/portal/events/${event.id}/edit?tab=kitchen`}>Kitchen &amp; collection</Link>.
        </p>
        </div>
      </div>
    </>
  );
}
