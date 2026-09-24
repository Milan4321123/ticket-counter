import QRCode from 'qrcode';
import { redirect } from 'next/navigation';
import PrintButton from '@/components/PrintButton';
import { getBaseUrl } from '@/lib/config';
import { getEventById } from '@/lib/events';
import { organizerPlanActive } from '@/lib/organizers';
import PlanExpired from '../../../PlanExpired';
import { requirePortalOrganizer } from '../../../guard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Table QR codes — Seller hub', robots: { index: false, follow: false } };

/**
 * A printable sheet: one card per table, each with a QR code that opens the
 * shop with ?table=N (lib/kitchen). Cut them out, put one on every table.
 */
export default async function TablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organizer = await requirePortalOrganizer();
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;
  const event = getEventById(id);
  if (!event || event.organizerId !== organizer.id) redirect('/portal');
  if (event.kind !== 'shop' || event.tableCount < 1) redirect(`/portal/events/${event.id}/edit?tab=kitchen`);

  const base = getBaseUrl();
  const cards = await Promise.all(
    Array.from({ length: event.tableCount }, async (_, i) => {
      const n = String(i + 1);
      const url = `${base}/e/${event.slug}?table=${n}`;
      const qr = await QRCode.toDataURL(url, { width: 420, margin: 1 });
      return { n, url, qr };
    })
  );

  return (
    <div className="container section table-sheet">
      <div className="table-sheet-head no-print">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Table QR codes
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {event.tableCount} tables for {event.name}. Print, cut along the lines, and put one on each table.
          </p>
        </div>
        <PrintButton />
      </div>
      <div className="table-grid">
        {cards.map((c) => (
          <div className="table-card" key={c.n}>
            <div className="table-card-shop">{event.name}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.qr} alt={`QR code for table ${c.n}`} width={180} height={180} />
            <div className="table-card-n">Table {c.n}</div>
            <div className="table-card-how">Scan · order · pay on your phone</div>
          </div>
        ))}
      </div>
    </div>
  );
}
