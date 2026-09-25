import type { ReactNode } from 'react';
import { listEventsForOrganizer } from '@/lib/events';
import { currentOrganizer } from '@/lib/organizers';
import HubSidebar from './HubSidebar';
import { listingTools } from './listingTools';
import { currentLang } from '@/lib/i18nServer';
import './hub.css';

/**
 * The seller hub's frame: sidebar (laptop) / tab bar (phone) around every
 * signed-in portal page. Sign-in, password reset and the forced password
 * change render bare — there is nobody to show a hub to yet.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const organizer = await currentOrganizer();
  if (!organizer || organizer.mustChangePassword) return <>{children}</>;

  const listings = listEventsForOrganizer(organizer.id)
    .filter((e) => e.status !== 'archived')
    .map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      status: e.status,
      // The listing's own tools, shown under it in the sidebar while it is open.
      tools: listingTools(e)
        .filter((t) => t.primary)
        .map((t) => ({ key: t.key, href: t.href, label: t.label, icon: t.icon })),
    }));

  return (
    <div className="hub">
      <HubSidebar name={organizer.name} listings={listings} isDemo={organizer.isDemo} lang={await currentLang()} />
      <div className="hub-main">{children}</div>
    </div>
  );
}
