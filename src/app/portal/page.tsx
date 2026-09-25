import Link from 'next/link';
import LogoutButton from './LogoutButton';
import DemoPicker from './DemoPicker';
import { readListingName } from '@/lib/exampleShop';
import PlatformAssistant from '@/components/PlatformAssistant';
import {
  countOpenQuestionsByEvent,
  getEventMediaBulk,
  listEventsForOrganizer,
  type EventMediaRow,
  type EventRow,
  type EventStatus,
} from '@/lib/events';
import { listingStillUrl } from '@/lib/listing';
import { vocabFor } from '@/lib/vocab';
import { formatMoney } from '@/lib/money';
import { getEventTotalsBulk, totalsFor } from '@/lib/orders';
import { organizerPlanActive } from '@/lib/organizers';
import { organizerTotpEnabled } from '@/lib/organizerTotp';
import { runTransferReminderSweep } from '@/lib/reminders';
import CreateEventForm from './CreateEventForm';
import { serverT } from '@/lib/i18nServer';
import InstallAppButton from '@/components/AppInstall';
import { IconCheck, IconEdit, IconGear, IconInbox, IconMessage, IconReceipt, IconScan, IconShield, IconStar, IconTag, IconTicket } from './HubIcons';
import PlanExpired from './PlanExpired';
import PortalNav from './PortalNav';
import { requirePortalOrganizer } from './guard';
import { platformNameFromEnv } from '@/lib/platform';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Your events and shops — Organizer portal', robots: { index: false, follow: false } };

const STATUS_LABEL: Record<EventStatus, string> = {
  published: 'Live',
  draft: 'Draft',
  archived: 'Archived',
};

function StatusBadge({ status }: { status: EventStatus }) {
  const cls = status === 'published' ? 'badge-green' : status === 'draft' ? 'badge-amber' : 'badge-red';
  return <span className={`badge ${cls}`}>{STATUS_LABEL[status]}</span>;
}

/**
 * The thumbnail beside an event here must be the SAME picture the public tile
 * shows, or the organizer checks their dashboard and sees something other than
 * what buyers see. So it is not worked out here at all: lib/listing owns that
 * choice for the whole site, and this simply asks it. Videos are skipped by
 * that helper too — this slot is a still.
 */
/** The first non-empty line of a multi-line field, for a one-line summary. */
function firstLine(text: string): string {
  return text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
}

function dashboardThumb(event: EventRow, photos: EventMediaRow[]): string | null {
  return listingStillUrl(event, photos);
}

export default async function PortalDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string | string[] }>;
}) {
  // ?deleted=<name> is set by the redirect after an event is deleted — the
  // event itself no longer exists, so its name has to travel in the URL.
  const deletedParam = (await searchParams).deleted;
  const deletedName = (Array.isArray(deletedParam) ? deletedParam[0] : deletedParam)?.trim().slice(0, 140) ?? '';

  const organizer = await requirePortalOrganizer();
  const tr = await serverT();
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;

  // Lazy trigger: visiting the dashboard also nudges the reminder sweep, so
  // reminders still go out on hosts without the background interval. The
  // sweep self-throttles, so firing it on every visit is cheap.
  void runTransferReminderSweep();

  const hasAuthenticator = organizerTotpEnabled(organizer.id);

  // Four statements for the whole dashboard, however many listings it shows.
  // Each card wants sales totals, a photo and an open-question count, and
  // asking per card cost eleven statements per listing — an account with
  // twenty of them opened this page with 220 (measured), sixty with 660.
  // Nothing here is cached: they are the same reads, asked for every row at
  // once instead of one row at a time, so the page stays force-dynamic.
  const events = listEventsForOrganizer(organizer.id);
  const eventIds = events.map((e) => e.id);
  const totals = getEventTotalsBulk(eventIds);
  const photos = getEventMediaBulk(eventIds);
  const openQuestions = countOpenQuestionsByEvent(eventIds);
  const cards = events.map((event) => ({
    event,
    stats: totalsFor(totals, event.id),
    openQuestions: openQuestions.get(event.id) ?? 0,
    thumb: dashboardThumb(event, photos.get(event.id) ?? []),
  }));
  const firstName = organizer.name.trim().split(/\s+/)[0] || organizer.name;

  const questions = cards.reduce((n, c) => n + c.openQuestions, 0);

  // The demo's three businesses (lib/demo), found the way demoTargetPath finds them.
  const demoPicks = organizer.isDemo
    ? [
        {
          event: events.find((e) => e.kind === 'shop' && e.slug.endsWith('-momo-kitchen')),
          emoji: '🥟',
          title: 'Restaurant',
          line: 'Orders, pickup times, kitchen screen, table QR',
          tone: 'amber',
        },
        {
          event: [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find((e) => e.kind !== 'shop'),
          emoji: '🎶',
          title: 'Event',
          line: 'Tickets, seat map, payments, door scanning',
          tone: 'brand',
        },
        {
          event: events.find((e) => e.kind === 'shop' && e.slug.endsWith('-glow-beauty')),
          emoji: '💅',
          title: 'Salon',
          line: 'Appointments by time slot, booking board',
          tone: 'violet',
        },
      ].flatMap((p) => (p.event ? [{ ...p, id: p.event.id, who: readListingName(p.event.name).name }] : []))
    : [];
  // A demo's own three businesses are the cards above; the listings grid shows
  // everything else (what the visitor made themselves).
  const shownCards = cards.filter((c) => !demoPicks.some((p) => p.id === c.event.id));

  return (
    <>
      <PortalNav active="events" />
      <div className="container hub-home">
        <header className="hub-hello hub-hello-slim anim-fade-up">
          <h1>
            {tr('hub.namaste')}, {firstName} 🙏
          </h1>
          <div className="hub-hello-actions">
            {/* Only appears where the browser can install, or on iPhone with the how-to. */}
            <InstallAppButton label="Install the seller app" />
            <LogoutButton quiet />
          </div>
        </header>

        {/* A demo account opens on its three businesses: pick one, land on its
            tool board, and every page's "All tools" brings you back. */}
        {demoPicks.length > 0 && <DemoPicker picks={demoPicks} />}

        {deletedName && (
          <div className="notice notice-success anim-fade-up" role="status" style={{ margin: 0 }}>
            <strong>{deletedName}</strong> is gone — its page, photos, prices, orders and codes have all been
            removed. Nothing about it is left on the platform.
          </div>
        )}

        {/* A demo's home is only for picking a business; its tools are on
            each business's board. Real sellers keep the quick tools. */}
        {!organizer.isDemo && (
        <section className="hub-panel hub-quick anim-fade-up anim-d1" aria-label="Quick tools">
              <h2 className="hub-panel-title">{tr('hub.tools')}</h2>
              <div className="hub-tools">
                <Link href="/portal/promos" className="hub-tool">
                  <IconTag />
                  <strong>Discount codes</strong>
                  <span>Early-bird, sponsor or WhatsApp-group codes</span>
                </Link>
                <Link href="/portal/reviews" className="hub-tool">
                  <IconStar />
                  <strong>Reviews</strong>
                  <span>What buyers say, and your replies</span>
                </Link>
                <Link href="/portal/statements" className="hub-tool">
                  <IconReceipt />
                  <strong>Statements</strong>
                  <span>Monthly bookkeeping for your tax advisor</span>
                </Link>
                <Link href="/portal/settings" className="hub-tool">
                  <IconGear />
                  <strong>Get paid instantly</strong>
                  <span>Card and PayPal on your own account</span>
                </Link>
              </div>
        </section>
        )}

        {shownCards.length > 0 && (
          <>
            <div className="hub-section-title">
              <h2>{tr('hub.yourListings')}</h2>
              <span className="muted small">
                {questions > 0 ? `${questions} open question${questions === 1 ? '' : 's'}` : ''}
              </span>
            </div>
            <section className="hub-cards">
              {shownCards.map(({ event, stats, openQuestions, thumb }, i) => {
                const v = vocabFor(event.kind);
                const pct =
                  event.totalCapacity > 0 ? Math.min(100, Math.round((stats.ticketsSold / event.totalCapacity) * 100)) : 0;
                return (
                  <article key={event.id} className={`hub-card anim-fade-up${i < 4 ? ` anim-d${i + 1}` : ''}`}>
                    <Link href={`/portal/events/${event.id}`} className="hub-card-media" aria-label={`Edit ${event.name}`}>
                      {thumb ? (
                        // Served by our own /api/media route — next/image is not needed.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" loading="lazy" />
                      ) : null}
                      <span className="hub-card-badges">
                        <StatusBadge status={event.status} />
                        <span className="badge">{event.kind === 'shop' ? 'Shop' : 'Event'}</span>
                        {openQuestions > 0 && (
                          <span className="badge badge-green">
                            {openQuestions} question{openQuestions === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>
                    </Link>
                    <div className="hub-card-body">
                      <h3 className="hub-card-name">{event.name}</h3>
                      <p className="hub-card-sub">
                        {event.kind === 'shop'
                          ? firstLine(event.pickupInfo) || 'Collection details not set'
                          : `${event.dateDisplay || event.eventDate || 'Date not set'}${
                              event.venueName ? ` · ${event.venueName}` : ''
                            }`}
                      </p>
                      {event.kind === 'shop' ? (
                        // A shop has no room to fill — its "capacity" is only a
                        // ceiling. What an owner reads is how much went out of
                        // the door, and how much is still waiting to be collected.
                        <div className="meter" style={{ margin: 0 }}>
                          <span className="meter-track">
                            <span
                              className="meter-fill meter-fill-brand"
                              style={{ width: `${stats.ticketsSold ? Math.round((stats.checkedIn / stats.ticketsSold) * 100) : 0}%` }}
                            />
                          </span>
                          <span className="meter-num">{`${stats.ticketsSold} ${v.units} sold · ${stats.checkedIn} collected`}</span>
                        </div>
                      ) : (
                        <div className="meter" style={{ margin: 0 }}>
                          <span className="meter-track">
                            <span className="meter-fill meter-fill-brand" style={{ width: `${pct}%` }} />
                          </span>
                          <span className="meter-num">{`${stats.ticketsSold} / ${event.totalCapacity} ${v.units} sold`}</span>
                        </div>
                      )}
                      <div className="hub-card-money">
                        <div>
                          <strong>{formatMoney(stats.revenueCents, event.currency)}</strong>
                          <span>received</span>
                        </div>
                        <div>
                          <strong>{formatMoney(stats.awaitingTransferCents, event.currency)}</strong>
                          <span>
                            {stats.awaitingTransferOrders > 0
                              ? `${stats.awaitingTransferOrders} to confirm`
                              : 'on its way'}
                          </span>
                        </div>
                      </div>
                      <div className="hub-card-actions">
                        <Link href={`/portal/events/${event.id}`} className="btn btn-brand btn-sm">
                          ▦ All tools
                        </Link>
                        <Link href={`/portal/events/${event.id}/edit`} className="btn btn-sm">
                          {tr('hub.edit')}
                        </Link>
                        <Link href={`/portal/events/${event.id}/orders`} className="btn btn-sm">
                          {tr('hub.orders')}
                        </Link>
                        <Link href={`/portal/events/${event.id}/checkin`} className="btn btn-sm">
                          {v.Redeem}
                        </Link>
                        <Link href={`/e/${event.slug}`} className="btn btn-sm">
                          {event.status === 'published' ? 'View' : 'Preview'}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}

        <section id="new" className="hub-new anim-fade-up">
          <h2>{cards.length === 0 ? 'Create your first listing' : 'Create something new'}</h2>
          <p>
            {cards.length === 0
              ? 'Name it, fill it in, publish — it starts as a private draft only you can see.'
              : 'Another event, or a shop for food and goods people order ahead and collect.'}
          </p>
          <CreateEventForm />
        </section>

        <p className="hub-note">
          Your account is free, and so is publishing — no fees, and never a cut of your sales. Signed in as{' '}
          {organizer.email}.
        </p>
      </div>

      <PlatformAssistant brand={platformNameFromEnv()} />
    </>
  );
}
