import Link from 'next/link';
import DemoBanner from './DemoBanner';
import type { EventKind } from '@/lib/types';

interface PortalNavEvent {
  id: string;
  name: string;
  slug: string;
  published: boolean;
  /** Event or shop — decides what the scanning tab is called. See lib/vocab. */
  kind: EventKind;
}

interface Props {
  /** Which top-level portal link is the current page. */
  active?: 'events' | 'reviews' | 'settings';
  /** When set, a second row shows the event name and its section tabs. */
  event?: PortalNavEvent;
  /** Which event tab is the current page. */
  tab?: 'overview' | 'edit' | 'orders' | 'insights' | 'checkin' | 'kitchen' | 'live';
}

/**
 * Slim portal sub-header shown on every organizer portal page, under the
 * main site header. Rows scroll sideways on small screens.
 */
export default function PortalNav({ event, tab }: Props) {
  // The account-wide links (Home, Reviews, Codes, Statements, Settings, Sign
  // out) live in the hub sidebar now (./HubSidebar, mounted by ./layout). What
  // is left here is what belongs to ONE page: the demo strip, and — on a
  // listing's pages — that listing's name and its own tabs.
  return (
    <>
      {/* Server component inside a server component: renders nothing unless the
          signed-in account is a try-it-yourself demo. */}
      <DemoBanner />
      {event && tab !== 'overview' && (
        <div className="hub-listing-head">
          <div className="container hub-listing-head-row">
            <div className="hub-listing-title">
              <span className="hub-listing-kind">{event.kind === 'shop' ? 'Shop' : 'Event'}</span>
              <span className="hub-listing-title-name" title={event.name}>
                {event.name}
              </span>
              <span className={`badge ${event.published ? 'badge-green' : 'badge-amber'}`}>
                {event.published ? 'Live' : 'Not published'}
              </span>
            </div>
            {/* The tool board (/portal/events/[id]) holds every tool as a
                card; a tool page only needs the way back to it. */}
            <nav className="hub-tabs" aria-label={`Back to ${event.name}`}>
              <Link href={`/portal/events/${event.id}`} className="hub-tab-pill hub-tab-pill-on hub-tab-pill-home">
                ← All tools
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
