import Link from 'next/link';
import DemoBanner from './DemoBanner';
import { getEventById } from '@/lib/events';
import { parseSlotConfig } from '@/lib/kitchen';
import type { EventKind } from '@/lib/types';
import { vocabFor } from '@/lib/vocab';

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
  tab?: 'edit' | 'orders' | 'insights' | 'checkin' | 'kitchen' | 'live';
}

/**
 * Slim portal sub-header shown on every organizer portal page, under the
 * main site header. Rows scroll sideways on small screens.
 */
export default function PortalNav({ event, tab }: Props) {
  // A shop whose times are appointments calls its board "Bookings".
  const full = event && event.kind === 'shop' ? getEventById(event.id) : null;
  const boardLabel = full && parseSlotConfig(full.pickupSlots).purpose === 'appointment' ? 'Bookings' : 'Kitchen';
  // The account-wide links (Home, Reviews, Codes, Statements, Settings, Sign
  // out) live in the hub sidebar now (./HubSidebar, mounted by ./layout). What
  // is left here is what belongs to ONE page: the demo strip, and — on a
  // listing's pages — that listing's name and its own tabs.
  return (
    <>
      {/* Server component inside a server component: renders nothing unless the
          signed-in account is a try-it-yourself demo. */}
      <DemoBanner />
      {event && (
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
            <nav className="hub-tabs" aria-label={`Sections for ${event.name}`}>
              <Link
                href={`/portal/events/${event.id}/edit`}
                className={`hub-tab-pill${tab === 'edit' ? ' hub-tab-pill-on' : ''}`}
              >
                Edit
              </Link>
              <Link
                href={`/portal/events/${event.id}/orders`}
                className={`hub-tab-pill${tab === 'orders' ? ' hub-tab-pill-on' : ''}`}
              >
                Orders
              </Link>
              <Link
                href={`/portal/events/${event.id}/insights`}
                className={`hub-tab-pill${tab === 'insights' ? ' hub-tab-pill-on' : ''}`}
              >
                Insights
              </Link>
              {event.kind === 'shop' && (
                <Link
                  href={`/portal/events/${event.id}/kitchen`}
                  className={`hub-tab-pill${tab === 'kitchen' ? ' hub-tab-pill-on' : ''}`}
                >
                  {boardLabel}
                </Link>
              )}
              <Link
                href={`/portal/events/${event.id}/checkin`}
                className={`hub-tab-pill${tab === 'checkin' ? ' hub-tab-pill-on' : ''}`}
              >
                {vocabFor(event.kind).Redeem}
              </Link>
              <Link
                href={`/portal/events/${event.id}/live`}
                className={`hub-tab-pill${tab === 'live' ? ' hub-tab-pill-on' : ''}`}
              >
                ● Live
              </Link>
              {/* Always present. On a draft it opens the private preview, which
                  is the whole point: check the page, THEN decide to publish. */}
              <Link href={`/e/${event.slug}`} className="hub-tab-pill hub-tab-pill-quiet">
                {event.published ? 'View page ↗' : 'Preview ↗'}
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
