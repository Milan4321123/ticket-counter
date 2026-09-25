import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { listEventsForOrganizer } from '@/lib/events';
import { readListingName } from '@/lib/exampleShop';
import PortalNav from '../PortalNav';
import { requirePortalOrganizer } from '../guard';
import ApplyForm from './ApplyForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Apply with your page — Organizer portal', robots: { index: false, follow: false } };

/**
 * A demo visitor turns the page they built into an account application.
 * The platform owner decides by hand; on approval the page moves into the new
 * real account as a draft (api/portal/apply, lib/demo adoptDemoListing).
 */
export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const organizer = await requirePortalOrganizer();
  if (!organizer.isDemo) redirect('/portal');
  const { event: wanted } = await searchParams;

  const listings = listEventsForOrganizer(organizer.id)
    .filter((e) => e.status !== 'archived')
    .map((e) => ({ id: e.id, name: readListingName(e.name).name, kind: e.kind }));
  const sent = new Set(
    (
      getDb()
        .prepare(
          `SELECT demo_event_id AS id FROM contact_requests
            WHERE demo_event_id IN (SELECT id FROM events WHERE organizer_id = ?)`
        )
        .all(organizer.id) as { id: string }[]
    ).map((r) => r.id)
  );

  return (
    <>
      <PortalNav />
      <div className="container section apply-page">
        <p className="feed-kicker anim-fade-up">From demo to the real thing</p>
        <h1 className="page-title anim-fade-up anim-d1" style={{ margin: '2px 0 8px' }}>
          Apply with your page
        </h1>
        <p className="muted anim-fade-up anim-d1" style={{ maxWidth: 560 }}>
          Send the page you built as your application. We look at every one by hand. Once approved, you get your
          login by email — and this page is already waiting in your new account, ready for your last details.
        </p>
        <ApplyForm
          listings={listings.map((l) => ({ ...l, sent: sent.has(l.id) }))}
          initial={listings.some((l) => l.id === wanted) ? (wanted as string) : ''}
        />
      </div>
    </>
  );
}
