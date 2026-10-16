import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/auth';
import { countNewContactRequests } from '@/lib/contact';
import { communityCounts } from '@/lib/community';
import { getPrimaryEvent, listAllEvents } from '@/lib/events';
import { formatMoney } from '@/lib/money';
import { listOrganizers } from '@/lib/organizers';
import {
  expireOverdueTransferReservations,
  getStats,
  getStuckOrders,
  listEventSalesSummaries,
  summaryFor,
} from '@/lib/orders';
import { BUYER_RETENTION_DAYS, runBuyerDataRetentionSweep } from '@/lib/retention';
import LogoutButton from './LogoutButton';
import { isTotpEnrolled } from '@/lib/totp';
import EmailConfigPanel from './EmailConfigPanel';
import EraseConsentPanel from './EraseConsentPanel';
import MaintenancePanel from './MaintenancePanel';
import ExampleBazaarPanel from './ExampleBazaarPanel';
import { getDb } from '@/lib/db';
import PlatformPostsPanel from './PlatformPostsPanel';
import { getPlatformContact, listPlatformPosts } from '@/lib/platformPosts';
import ScanLinkPanel from './ScanLinkPanel';
import TotpPanel from './TotpPanel';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Admin dashboard', robots: { index: false, follow: false } };

/** Slim progress bar with the value always written out beside it. */
function Meter({ value, max, tone }: { value: number; max: number; tone?: 'green' | 'amber' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="meter">
      <span className="meter-track">
        <span
          className={`meter-fill${tone ? ` meter-fill-${tone}` : ''}`}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </span>
      <span className="meter-num">{pct}%</span>
    </div>
  );
}

export default async function AdminDashboardPage() {
  if (!(await isAdminRequest())) redirect('/admin/login');

  // Release seats of transfer reservations whose payment never arrived.
  expireOverdueTransferReservations();
  // Erase buyer details for events that are long over (self-throttling, and it
  // swallows its own errors — see lib/retention.ts).
  runBuyerDataRetentionSweep();
  // No event argument = the whole platform, across every organizer.
  const stats = getStats();
  const stuckCount = getStuckOrders(10).length;

  const organizers = listOrganizers();
  const activeOrganizers = organizers.filter((o) => o.status === 'active').length;
  const pendingOrganizers = organizers.filter((o) => o.status === 'pending').length;
  const events = listAllEvents();
  const publishedEvents = events.filter((e) => e.status === 'published').length;
  // Account applications and "design my page for me" enquiries from /contact
  // still waiting for an answer.
  const newContactRequests = countNewContactRequests();
  const communityReports = communityCounts().openReports;
  const totalCapacity = events.reduce((sum, e) => sum + e.totalCapacity, 0);
  // Every event shares one currency until multi-currency exists — use the
  // platform's first event's (falls back to EUR before any event exists).
  const currency = getPrimaryEvent()?.currency ?? 'EUR';

  // Counts and money per event — never a buyer. The five busiest are enough for
  // a glance; /admin/sales has the full list grouped by organizer.
  const salesByEvent = listEventSalesSummaries();
  const busiestEvents = [...events]
    .map((e) => ({ event: e, sales: summaryFor(salesByEvent, e.id) }))
    .filter((row) => row.sales.ordersPaid > 0 || row.sales.awaitingOrders > 0)
    .sort((a, b) => b.sales.revenueCents - a.sales.revenueCents)
    .slice(0, 5);

  return (
    <div className="container section">
      <div
        className="anim-fade-up"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Admin dashboard
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Platform overview — organizers, events, and how the whole thing is selling.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/admin/organizers" className="btn btn-sm">
            Organizers
          </Link>
          <Link href="/admin/events" className="btn btn-sm">
            Ticket limits
          </Link>
          <Link href="/admin/sales" className="btn btn-sm">
            Sales
          </Link>
          {/* Moderation lives only here. A seller can answer a review of their
              own goods and nothing else, so the power to take one down has to
              sit with somebody who has no stake in the score. */}
          <Link href="/admin/reviews" className="btn btn-sm">
            Reviews
          </Link>
          {/* Reports on meetups, help posts, messages and Kalakar profiles. */}
          <Link href="/admin/community" className="btn btn-sm">
            Community
            {communityReports > 0 ? (
              <span className="badge badge-amber" style={{ marginLeft: 6 }}>
                {communityReports} reported
              </span>
            ) : null}
          </Link>
          {/* What people wanted but could not buy (lib/wishes). */}
          <Link href="/admin/wishes" className="btn btn-sm">
            ♥ Wish list
          </Link>
          <Link href="/admin/contact" className="btn btn-primary btn-sm">
            Applications
            {newContactRequests > 0 ? (
              <span className="badge badge-amber" style={{ marginLeft: 6 }}>
                {newContactRequests} new
              </span>
            ) : null}
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card anim-fade-up anim-d1">
          <div className="stat-label">Money received</div>
          <div className="stat-value">{formatMoney(stats.revenueCents, currency)}</div>
          <div className="stat-sub">
            {stats.ordersPaid} confirmed order{stats.ordersPaid === 1 ? '' : 's'} — paid straight to
            the organizers
          </div>
        </div>
        <div className="stat-card anim-fade-up anim-d2">
          <div className="stat-label">Awaiting bank transfer</div>
          <div className="stat-value">{formatMoney(stats.awaitingTransferCents, currency)}</div>
          <div className="stat-sub">
            {stats.awaitingTransferOrders} order{stats.awaitingTransferOrders === 1 ? '' : 's'} ·{' '}
            {stats.awaitingTransferTickets} ticket{stats.awaitingTransferTickets === 1 ? '' : 's'} ·
            each organizer confirms their own
          </div>
        </div>
        <div className="stat-card anim-fade-up anim-d2">
          <div className="stat-label">Tickets sold</div>
          <div className="stat-value">
            {stats.ticketsSold} <span className="muted small">/ {totalCapacity}</span>
          </div>
          <Meter value={stats.ticketsSold} max={totalCapacity} />
        </div>
        <div className="stat-card anim-fade-up anim-d3">
          <div className="stat-label">Checked in</div>
          <div className="stat-value">
            {stats.checkedIn} <span className="muted small">/ {stats.ticketsSold}</span>
          </div>
          <Meter value={stats.checkedIn} max={stats.ticketsSold} tone="green" />
        </div>
        <div className={`stat-card anim-fade-up anim-d3${pendingOrganizers > 0 ? ' stat-card-alert' : ''}`}>
          <div className="stat-label">Organizers</div>
          <div className="stat-value">{organizers.length}</div>
          <div className="stat-sub">
            {activeOrganizers} active
            {pendingOrganizers > 0 ? (
              <>
                {' '}
                · <strong>{pendingOrganizers} to activate</strong>
              </>
            ) : null}{' '}
            ·{' '}
            <Link href="/admin/organizers" style={{ color: 'var(--accent)' }}>
              manage →
            </Link>
          </div>
        </div>
        <div className="stat-card anim-fade-up anim-d4">
          <div className="stat-label">Events</div>
          <div className="stat-value">
            {publishedEvents} <span className="muted small">/ {events.length}</span>
          </div>
          <div className="stat-sub">published / total</div>
        </div>
      </div>

      <MaintenancePanel
        stuckCount={stuckCount}
        mockPaidOrders={stats.mockPaidOrders}
        mockTicketsSold={stats.mockTicketsSold}
      />

      <ExampleBazaarPanel
        initialShops={(getDb().prepare(`SELECT COUNT(*) AS n FROM events WHERE id LIKE 'seed-bazaar-%'`).get() as { n: number }).n}
      />

      <div className="card anim-fade-up">
        <div className="card-title">Busiest events</div>
        {busiestEvents.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nothing sold yet — the moment an event takes its first booking it shows up here.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Tickets</th>
                  <th>Revenue</th>
                  <th>Awaiting transfer</th>
                  <th>Checked in</th>
                </tr>
              </thead>
              <tbody>
                {busiestEvents.map(({ event, sales }) => (
                  <tr key={event.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{event.name}</div>
                      <div className="muted small">
                        {event.dateDisplay || 'no date set'}
                        {event.status !== 'published' ? ` · ${event.status}` : ''}
                      </div>
                    </td>
                    <td>
                      {sales.ticketsSold} <span className="muted small">/ {event.totalCapacity}</span>
                    </td>
                    <td>{formatMoney(sales.revenueCents, event.currency)}</td>
                    <td>
                      {sales.awaitingOrders > 0 ? (
                        <span className="badge badge-amber" style={{ whiteSpace: 'nowrap' }}>
                          {formatMoney(sales.awaitingCents, event.currency)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{sales.checkedIn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small" style={{ margin: '12px 0 0' }}>
          Buyers belong to the organizer who sold to them, so this panel counts sales rather than
          listing people — and their names and email addresses are erased{' '}
          {BUYER_RETENTION_DAYS} days after their event&rsquo;s date.{' '}
          <Link href="/admin/sales" style={{ color: 'var(--accent)' }}>
            Full breakdown by organizer →
          </Link>
        </p>
      </div>

      {/* Kept for the platform owner: minting a scanner link hands door staff a
          key, it does not show him anything. A scanner only ever names a holder
          once a real ticket is presented to it, and the admin side no longer
          has a ticket code or a buyer anywhere on it. This stays the break-glass
          for the night an organizer's own link fails 20 minutes before doors. */}
      <div className="card glow-card anim-fade-up">
        <div className="card-title">Door scanner access</div>
        <ScanLinkPanel events={events.map((e) => ({ id: e.id, name: e.name }))} />
      </div>

      <PlatformPostsPanel posts={listPlatformPosts(10)} contact={getPlatformContact()} />

      <div className="card glow-card anim-fade-up">
        <div className="card-title">Sign-in security · authenticator app</div>
        <TotpPanel initialEnrolled={isTotpEnrolled()} />
      </div>

      {/* Straight from the running process, so "I set it in the dashboard" and
          "the server is using it" stop being the same assumption. */}
      <EmailConfigPanel />

      {/* The "erase my record entirely" requests /privacy invites land in the
          owner's inbox — this is the control that fulfils them. */}
      <EraseConsentPanel />
    </div>
  );
}
