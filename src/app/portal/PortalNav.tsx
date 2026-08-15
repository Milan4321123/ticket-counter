import Link from 'next/link';
import Logo from '@/components/Logo';
import LogoutButton from './LogoutButton';

interface PortalNavEvent {
  id: string;
  name: string;
  slug: string;
  published: boolean;
}

interface Props {
  /** Which top-level portal link is the current page. */
  active?: 'events' | 'settings';
  /** When set, a second row shows the event name and its section tabs. */
  event?: PortalNavEvent;
  /** Which event tab is the current page. */
  tab?: 'edit' | 'orders' | 'checkin';
}

/**
 * Slim portal sub-header shown on every organizer portal page, under the
 * main site header. Rows scroll sideways on small screens.
 */
export default function PortalNav({ active, event, tab }: Props) {
  return (
    <div className="portal-nav">
      <div className="container portal-nav-row">
        <Link href="/portal" className="portal-nav-home" aria-label="Organizer portal home">
          <Logo size={18} />
          <span className="portal-nav-tag">Organizer</span>
        </Link>
        <nav className="portal-nav-links" aria-label="Portal">
          <Link
            href="/portal"
            className={`portal-nav-link${active === 'events' ? ' portal-nav-link-active' : ''}`}
          >
            My events
          </Link>
          <Link
            href="/portal/settings"
            className={`portal-nav-link${active === 'settings' ? ' portal-nav-link-active' : ''}`}
          >
            Settings
          </Link>
        </nav>
        <div className="portal-nav-end">
          <LogoutButton />
        </div>
      </div>

      {event && (
        <div className="portal-nav-eventband">
          <div className="container portal-nav-row">
            <span className="portal-nav-event" title={event.name}>
              {event.name}
            </span>
            <nav className="portal-tabs" aria-label={`Sections for ${event.name}`}>
              <Link
                href={`/portal/events/${event.id}/edit`}
                className={`portal-tab${tab === 'edit' ? ' portal-tab-active' : ''}`}
              >
                Edit
              </Link>
              <Link
                href={`/portal/events/${event.id}/orders`}
                className={`portal-tab${tab === 'orders' ? ' portal-tab-active' : ''}`}
              >
                Orders
              </Link>
              <Link
                href={`/portal/events/${event.id}/checkin`}
                className={`portal-tab${tab === 'checkin' ? ' portal-tab-active' : ''}`}
              >
                Check-in
              </Link>
              {/* Always present. On a draft it opens the private preview, which
                  is the whole point: check the page, THEN decide to publish. */}
              <Link href={`/e/${event.slug}`} className="portal-tab">
                {event.published ? 'View page ↗' : 'Preview ↗'}
              </Link>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
