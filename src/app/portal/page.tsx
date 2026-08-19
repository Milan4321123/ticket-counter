import Link from 'next/link';
import PlatformAssistant from '@/components/PlatformAssistant';
import {
  listEventQuestions,
  listEventsForOrganizer,
  type EventRow,
  type EventStatus,
} from '@/lib/events';
import { listingStillUrl } from '@/lib/listing';
import { vocabFor } from '@/lib/vocab';
import { formatMoney } from '@/lib/money';
import { getStats } from '@/lib/orders';
import { organizerPlanActive } from '@/lib/organizers';
import { organizerTotpEnabled } from '@/lib/organizerTotp';
import { runTransferReminderSweep } from '@/lib/reminders';
import CreateEventForm from './CreateEventForm';
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

function dashboardThumb(event: EventRow): string | null {
  return listingStillUrl(event);
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
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;

  // Lazy trigger: visiting the dashboard also nudges the reminder sweep, so
  // reminders still go out on hosts without the background interval. The
  // sweep self-throttles, so firing it on every visit is cheap.
  void runTransferReminderSweep();

  const hasAuthenticator = organizerTotpEnabled(organizer.id);

  const events = listEventsForOrganizer(organizer.id);
  const cards = events.map((event) => ({
    event,
    stats: getStats(event.id),
    openQuestions: listEventQuestions(event.id, 'open').length,
    thumb: dashboardThumb(event),
  }));
  const firstName = organizer.name.trim().split(/\s+/)[0] || organizer.name;

  return (
    <>
      <PortalNav active="events" />
      <div className="container section">
        <div className="anim-fade-up" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            Namaste, {firstName}
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {cards.length === 0
              ? 'Welcome to your organizer portal — this is where your events and shops live.'
              : `Here is how your ${cards.length === 1 ? 'listing is' : 'listings are'} doing.`}{' '}
            Signed in as {organizer.email}.
          </p>
        </div>

        {deletedName && (
          <div className="notice notice-success anim-fade-up" role="status">
            <strong>{deletedName}</strong> is gone — its page, photos, prices, orders and codes have all been
            removed. Nothing about it is left on the platform.
          </div>
        )}

        <p className="muted small anim-fade-up" style={{ marginTop: -6 }}>
          Your account is free, and so is publishing — no fees, and never a cut of your ticket
          sales.
        </p>

        {/* Said here, not only at the moment publishing is refused. An organizer
            who meets this as a blocked button on launch day reads it as the
            platform getting in the way; the same sentence a week earlier reads
            as the platform looking after their money. */}
        {!hasAuthenticator && (
          <div className="notice notice-warn anim-fade-up" style={{ marginTop: 12 }}>
            <strong>Set up your authenticator app.</strong>
            <p className="small" style={{ margin: '6px 0 0' }}>
              It is a free app on your phone that shows a 6-digit code. Once it is on, your password
              alone is not enough to get into your account — and not enough to change the bank
              account your ticket money is paid into, which is the one thing nobody can undo for
              you. It works offline, so it keeps working even when email does not.
            </p>
            <p className="small" style={{ margin: '8px 0 0' }}>
              <strong>You will need it before you can publish an event</strong>, so it is worth doing
              now rather than on the day you want to go live.{' '}
              <a href="/portal/settings">Set it up in Settings</a> — it takes a minute.
            </p>
          </div>
        )}

        {cards.length === 0 ? (
          <div className="card glow-card anim-fade-up anim-d1">
            <div className="card-title">Create your first listing</div>
            <p className="muted small" style={{ marginTop: 0 }}>
              From idea to selling in three steps:
            </p>
            <ol className="step-list">
              <li className="step-item">
                <span className="step-num step-num-brand" aria-hidden>
                  1
                </span>
                <div>
                  <strong>Name it</strong>
                  <p className="muted small" style={{ margin: 0 }}>
                    Pick what you are setting up and name it below — it starts as a private draft
                    only you can see.
                  </p>
                </div>
              </li>
              <li className="step-item">
                <span className="step-num step-num-brand" aria-hidden>
                  2
                </span>
                <div>
                  <strong>Fill it in</strong>
                  <p className="muted small" style={{ margin: 0 }}>
                    An event wants a date and venue; a shop wants collection details. Both want
                    prices, photos — and the bank account the money goes to.
                  </p>
                </div>
              </li>
              <li className="step-item">
                <span className="step-num step-num-brand" aria-hidden>
                  3
                </span>
                <div>
                  <strong>Publish</strong>
                  <p className="muted small" style={{ margin: 0 }}>
                    Your page goes live and buyers can start ordering right away.
                  </p>
                </div>
              </li>
            </ol>
            <CreateEventForm />
          </div>
        ) : (
          <>
            {cards.map(({ event, stats, openQuestions, thumb }, i) => {
              // Every event states a capacity now, so the bar always has an
              // end to fill toward.
              const pct =
                event.totalCapacity > 0
                  ? Math.min(100, Math.round((stats.ticketsSold / event.totalCapacity) * 100))
                  : 0;
              return (
                <div
                  key={event.id}
                  className={`card anim-fade-up${i < 4 ? ` anim-d${i + 1}` : ''}`}
                  style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}
                >
                  {thumb ? (
                    // Poster thumbnails are served by our own /api/media route — next/image is not needed.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={`Poster for ${event.name}`}
                      width={104}
                      height={130}
                      // PORTRAIT, matching the public tile exactly (4:5). It was
                      // a 132x92 landscape box, so once the tile went portrait
                      // this showed a different — and much worse — slice of the
                      // same photo than the organizer sees on their live page.
                      style={{
                        width: 104,
                        height: 130,
                        objectFit: 'cover',
                        borderRadius: 10,
                        flex: 'none',
                        background: 'var(--bg-elevated)',
                      }}
                    />
                  ) : (
                    <div
                      aria-hidden
                      style={{
                        width: 104,
                        height: 130,
                        borderRadius: 10,
                        flex: 'none',
                        background: 'linear-gradient(135deg, var(--brand-soft), rgba(0, 56, 147, 0.18))',
                        border: '1px solid var(--border)',
                      }}
                    />
                  )}
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.08rem' }}>{event.name}</strong>
                      <StatusBadge status={event.status} />
                      {/* Events and shops share this list, and they behave
                          differently enough — no date, different checklist,
                          different words on the page — that which one you are
                          looking at should never be a guess. */}
                      {event.kind === 'shop' && <span className="badge">Shop</span>}
                      {openQuestions > 0 && (
                        // Straight into the Questions tab, which is now its own
                        // tab rather than a section buried in Page & content.
                        <Link
                          href={`/portal/events/${event.id}/edit?tab=questions`}
                          className="badge badge-green"
                          style={{ textDecoration: 'none' }}
                        >
                          {openQuestions} question{openQuestions === 1 ? '' : 's'}
                        </Link>
                      )}
                    </div>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {/* A shop has no date to show here, so it shows the line
                          that actually tells its organizer whether it is ready:
                          the collection details, which are what publishing asks
                          for in place of a date and a venue. */}
                      {event.kind === 'shop'
                        ? firstLine(event.pickupInfo) || 'Collection details not set'
                        : `${event.dateDisplay || event.eventDate || 'Date not set'}${
                            event.venueName ? ` · ${event.venueName}` : ''
                          }`}
                    </div>
                    <div className="meter" style={{ maxWidth: 320 }}>
                      <span className="meter-track">
                        <span className="meter-fill meter-fill-brand" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="meter-num">
                        {`${stats.ticketsSold} / ${event.totalCapacity} sold`}
                      </span>
                    </div>
                    <div className="small" style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span>
                        <strong>{formatMoney(stats.revenueCents, event.currency)}</strong>
                        <span className="muted"> received</span>
                      </span>
                      <span>
                        <strong>{formatMoney(stats.awaitingTransferCents, event.currency)}</strong>
                        <span className="muted"> on its way</span>
                        {stats.awaitingTransferOrders > 0 && (
                          <span className="badge badge-amber" style={{ marginLeft: 8 }}>
                            {stats.awaitingTransferOrders} to confirm
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link href={`/portal/events/${event.id}/edit`} className="btn btn-brand btn-sm">
                      Edit
                    </Link>
                    {openQuestions > 0 && (
                      // Its own green button among the actions. The badge in
                      // the title row says a number; this says what to do about
                      // it, in the row an organizer actually clicks from.
                      <Link
                        href={`/portal/events/${event.id}/edit?tab=questions`}
                        className="btn btn-sm btn-green"
                      >
                        Answer {openQuestions} message{openQuestions === 1 ? '' : 's'}
                      </Link>
                    )}
                    <Link href={`/portal/events/${event.id}/orders`} className="btn btn-sm">
                      Orders
                    </Link>
                    <Link href={`/portal/events/${event.id}/checkin`} className="btn btn-sm">
                      {vocabFor(event.kind).Redeem}
                    </Link>
                    {/* Draft events get the same link, named for what it does.
                        Seeing your own page is how you decide it is ready — it
                        should not be something you only earn after paying. */}
                    <Link href={`/e/${event.slug}`} className="btn btn-sm">
                      {event.status === 'published' ? 'View page' : 'Preview page'}
                    </Link>
                  </div>
                </div>
              );
            })}

            <div className="card glow-card anim-fade-up anim-d4" style={{ marginTop: 16 }}>
              <div className="card-title">Create something new</div>
              <CreateEventForm />
            </div>
          </>
        )}
      </div>

      <PlatformAssistant brand={platformNameFromEnv()} />
    </>
  );
}
