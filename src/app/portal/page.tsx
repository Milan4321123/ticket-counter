import Link from 'next/link';
import PlatformAssistant from '@/components/PlatformAssistant';
import {
  eventFeeCentsFor,
  listEventQuestions,
  listEventsForOrganizer,
  type EventRow,
  type EventStatus,
} from '@/lib/events';
import { listingStillUrl } from '@/lib/listing';
import { formatMoney } from '@/lib/money';
import { getStats } from '@/lib/orders';
import { organizerPlanActive } from '@/lib/organizers';
import { organizerTotpEnabled } from '@/lib/organizerTotp';
import { platformFeeRule } from '@/lib/platform';
import { runTransferReminderSweep } from '@/lib/reminders';
import CreateEventForm from './CreateEventForm';
import PlanExpired from './PlanExpired';
import PortalNav from './PortalNav';
import { requirePortalOrganizer } from './guard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Your events — Organizer portal', robots: { index: false, follow: false } };

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
  // Events that still owe the platform fee — they cannot be published yet. Each
  // one costs what its own capacity says, so show the money, not just a count.
  const unpaid = events.filter((e) => e.feeStatus !== 'paid' && e.status !== 'archived');
  const feesDue = unpaid.length;
  const feesDueAmount = formatMoney(
    unpaid.reduce((sum, e) => sum + eventFeeCentsFor(e), 0),
    'EUR'
  );
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
              ? 'Welcome to your organizer portal — this is where your events live.'
              : `Here is how your ${cards.length === 1 ? 'event is' : 'events are'} doing.`}{' '}
            Signed in as {organizer.email}.
          </p>
        </div>

        {deletedName && (
          <div className="notice notice-success anim-fade-up" role="status">
            <strong>{deletedName}</strong> is gone — its page, photos, ticket types, orders and tickets have all been
            removed. Nothing about it is left on the platform.
          </div>
        )}

        {feesDue > 0 ? (
          <div className="plan-banner anim-fade-up" role="status">
            <strong>
              {feesDue === 1
                ? `1 event waiting for its ${feesDueAmount} event fee`
                : `${feesDue} events waiting for their event fees — ${feesDueAmount} in total`}
            </strong>{' '}
            — open the event below and check its <strong>Publish</strong> tab for the exact amount, the
            bank details and the payment reference. Publishing unlocks as soon as your transfer arrives.
          </div>
        ) : (
          <p className="muted small anim-fade-up" style={{ marginTop: -6 }}>
            Your account is free — you pay per event you publish: {platformFeeRule()}.
          </p>
        )}

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
            <div className="card-title">Create your first event</div>
            <p className="muted small" style={{ marginTop: 0 }}>
              From idea to selling tickets in three steps:
            </p>
            <ol className="step-list">
              <li className="step-item">
                <span className="step-num step-num-brand" aria-hidden>
                  1
                </span>
                <div>
                  <strong>Name it</strong>
                  <p className="muted small" style={{ margin: 0 }}>
                    Type a name below — your event starts as a private draft only you can see.
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
                    Date, venue, ticket types and prices, photos — and the bank account the ticket money goes to.
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
                    Your event page goes live and buyers can reserve tickets right away.
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
                      {event.feeStatus !== 'paid' && event.status !== 'archived' && (
                        <span className="badge badge-amber">Fee due</span>
                      )}
                      {openQuestions > 0 && (
                        // Straight to where they can actually be answered: the
                        // questions inbox sits in the editor's Page & content
                        // tab, beside the FAQ.
                        <Link
                          href={`/portal/events/${event.id}/edit?tab=page`}
                          className="badge badge-amber"
                          style={{ textDecoration: 'none' }}
                        >
                          {openQuestions} question{openQuestions === 1 ? '' : 's'}
                        </Link>
                      )}
                    </div>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {event.dateDisplay || event.eventDate || 'Date not set'}
                      {event.venueName ? ` · ${event.venueName}` : ''}
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
                    <Link href={`/portal/events/${event.id}/orders`} className="btn btn-sm">
                      Orders
                    </Link>
                    <Link href={`/portal/events/${event.id}/checkin`} className="btn btn-sm">
                      Check-in
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
              <div className="card-title">Create a new event</div>
              <CreateEventForm />
            </div>
          </>
        )}
      </div>

      <PlatformAssistant />
    </>
  );
}
