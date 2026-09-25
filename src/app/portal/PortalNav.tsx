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
export default function PortalNav({ active, event, tab }: Props) {
  // The hub has no sidebar: the home screen's cards lead everywhere, and this
  // line is the way back up — plus the demo strip on a demo account.
  return (
    <>
      {/* Server component inside a server component: renders nothing unless the
          signed-in account is a try-it-yourself demo. */}
      <DemoBanner />
      {/* One slim line up to the level above: a tool → its listing's tool
          board, the tool board or an account page → Home. The home screen
          itself is the top and has none. */}
      {(!event || tab === 'overview') && active !== 'events' && (
        <div className="hub-listing-head hub-listing-slim">
          <div className="container hub-slim-row">
            <Link href="/portal" className="hub-slim-back">
              ← Home
            </Link>
          </div>
        </div>
      )}
      {event && tab !== 'overview' && (
        // One slim line: the way back to the listing's tool board, and which
        // listing this is. The page below carries its own title.
        <div className="hub-listing-head hub-listing-slim">
          <div className="container hub-slim-row">
            <Link href={`/portal/events/${event.id}`} className="hub-slim-back">
              ← All tools
            </Link>
            <span className="hub-slim-name" title={event.name}>
              <span className="hub-listing-kind">{event.kind === 'shop' ? 'Shop' : 'Event'}</span> {event.name}
            </span>
            <span className={`hub-slim-dot ${event.published ? 'is-live' : ''}`} aria-label={event.published ? 'Live' : 'Not published'} />
          </div>
        </div>
      )}
    </>
  );
}
