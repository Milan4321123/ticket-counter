import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/auth';
import { countNewContactRequests } from '@/lib/contact';
import { getPrimaryEvent, listAllEvents } from '@/lib/events';
import { formatMoney } from '@/lib/money';
import { listOrganizers } from '@/lib/organizers';
import {
  expireOverdueTransferReservations,
  getStats,
  getStuckOrders,
  listAwaitingTransferOrders,
  listOrders,
  paymentReference,
  type OrderStatus,
} from '@/lib/orders';
import LogoutButton from './LogoutButton';
import { isTotpEnrolled } from '@/lib/totp';
import MaintenancePanel from './MaintenancePanel';
import ScanLinkPanel from './ScanLinkPanel';
import TotpPanel from './TotpPanel';
import TransferActions from './TransferActions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Admin dashboard' };

function StatusBadge({ status }: { status: OrderStatus }) {
  const cls =
    status === 'paid'
      ? 'badge-green'
      : status === 'pending' || status === 'claimed' || status === 'capturing'
        ? 'badge-amber'
        : 'badge-red';
  return <span className={`badge ${cls}`}>{status}</span>;
}

function ReferenceTag({ reference }: { reference: string }) {
  return (
    <span className="mono small" style={{ whiteSpace: 'nowrap' }}>
      <strong>{reference}</strong>
      {reference.includes('-S-') && (
        <span className="badge badge-student" style={{ marginLeft: 6 }}>
          student
        </span>
      )}
    </span>
  );
}

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
  // No event argument = the whole platform, across every organizer.
  const stats = getStats();
  const recent = listOrders({ limit: 10 });
  const stuckCount = getStuckOrders(10).length;
  const awaitingTransfer = listAwaitingTransferOrders();

  const organizers = listOrganizers();
  const activeOrganizers = organizers.filter((o) => o.status === 'active').length;
  const pendingOrganizers = organizers.filter((o) => o.status === 'pending').length;
  const events = listAllEvents();
  const publishedEvents = events.filter((e) => e.status === 'published').length;
  // Events still owing the per-event platform fee — your outstanding revenue.
  const feesDue = events.filter((e) => e.feeStatus !== 'paid' && e.status !== 'archived').length;
  const eventNameById = new Map(events.map((e) => [e.id, e.name]));
  // Account applications and "design my page for me" enquiries from /contact
  // still waiting for an answer.
  const newContactRequests = countNewContactRequests();
  const totalCapacity = events.reduce((sum, e) => sum + e.totalCapacity, 0);
  // Every event shares one currency until multi-currency exists — use the
  // platform's first event's (falls back to EUR before any event exists).
  const currency = getPrimaryEvent()?.currency ?? 'EUR';

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
            Platform overview — organizers, events, and every order in one place.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/admin/organizers" className="btn btn-sm">
            Organizers
          </Link>
          <Link href="/admin/orders" className="btn btn-sm">
            Orders
          </Link>
          <Link href="/admin/contact" className="btn btn-sm">
            Applications
            {newContactRequests > 0 ? (
              <span className="badge badge-amber" style={{ marginLeft: 6 }}>
                {newContactRequests} new
              </span>
            ) : null}
          </Link>
          <Link href="/admin/checkin" className="btn btn-primary btn-sm">
            Door check-in
          </Link>
          <LogoutButton />
        </div>
      </div>

      {/* ---- The one thing that needs doing: confirm arrived bank transfers ---- */}
      {awaitingTransfer.length > 0 && (
        <div className="card action-card anim-fade-up">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="pulse-dot" aria-hidden />
            {awaitingTransfer.length} reservation{awaitingTransfer.length === 1 ? '' : 's'} waiting for your
            confirmation
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>
            Check the bank statement for these references. When the money is there, click{' '}
            <strong>Payment received</strong> and type the last 4 characters of the reference — the QR tickets are
            emailed automatically.
          </p>
          <div>
            {awaitingTransfer.map((o) => {
              const reference = paymentReference(o.id);
              return (
                <div key={o.id} className="action-row">
                  <div className="action-row-who">
                    <div style={{ fontWeight: 700 }}>{o.buyerName}</div>
                    <div className="muted small">
                      {eventNameById.get(o.eventId) ?? 'Unknown event'} · {o.itemsSummary} · reserved{' '}
                      {o.createdAt.slice(0, 10)}
                    </div>
                  </div>
                  <div className="action-row-amount">{formatMoney(o.totalCents, o.currency)}</div>
                  <ReferenceTag reference={reference} />
                  <TransferActions
                    orderId={o.id}
                    buyerName={o.buyerName}
                    amountDisplay={formatMoney(o.totalCents, o.currency)}
                    reference={reference}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card anim-fade-up anim-d1">
          <div className="stat-label">Money received</div>
          <div className="stat-value">{formatMoney(stats.revenueCents, currency)}</div>
          <div className="stat-sub">
            {stats.ordersPaid} confirmed order{stats.ordersPaid === 1 ? '' : 's'}
          </div>
        </div>
        <div className={`stat-card anim-fade-up anim-d2${stats.awaitingTransferOrders > 0 ? ' stat-card-alert' : ''}`}>
          <div className="stat-label">Awaiting bank transfer</div>
          <div className="stat-value">{formatMoney(stats.awaitingTransferCents, currency)}</div>
          <div className="stat-sub">
            {stats.awaitingTransferOrders} order{stats.awaitingTransferOrders === 1 ? '' : 's'} ·{' '}
            {stats.awaitingTransferTickets} ticket{stats.awaitingTransferTickets === 1 ? '' : 's'}
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
        <div className={`stat-card anim-fade-up anim-d4${feesDue > 0 ? ' stat-card-alert' : ''}`}>
          <div className="stat-label">Events</div>
          <div className="stat-value">
            {publishedEvents} <span className="muted small">/ {events.length}</span>
          </div>
          <div className="stat-sub">
            published / total
            {feesDue > 0 ? (
              <>
                {' '}
                ·{' '}
                <Link href="/admin/organizers" style={{ color: 'var(--accent)' }}>
                  <strong>{feesDue} fee{feesDue === 1 ? '' : 's'} to confirm</strong>
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <MaintenancePanel
        stuckCount={stuckCount}
        mockPaidOrders={stats.mockPaidOrders}
        mockTicketsSold={stats.mockTicketsSold}
      />

      <div className="card anim-fade-up">
        <div className="card-title">Recent orders</div>
        {recent.length === 0 ? (
          <p className="muted">No orders yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Created (UTC)</th>
                  <th>Event</th>
                  <th>Buyer</th>
                  <th>Email</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => {
                  const reference = o.paymentMode === 'transfer' ? paymentReference(o.id) : null;
                  return (
                    <tr key={o.id}>
                      <td className="mono small">{o.createdAt.slice(0, 16)}</td>
                      <td className="small">{eventNameById.get(o.eventId) ?? '—'}</td>
                      <td>{o.buyerName}</td>
                      <td className="small">{o.buyerEmail}</td>
                      <td>{o.itemsSummary}</td>
                      <td>{formatMoney(o.totalCents, o.currency)}</td>
                      <td>
                        <StatusBadge status={o.status} />
                        {o.paymentMode === 'mock' ? (
                          <span className="badge badge-amber" style={{ marginLeft: 6 }}>
                            test
                          </span>
                        ) : null}
                      </td>
                      <td>{reference ? <ReferenceTag reference={reference} /> : <span className="muted">—</span>}</td>
                      <td>
                        <Link href={`/order/${o.id}`} className="btn btn-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ margin: '12px 0 0' }}>
          <Link href="/admin/orders" className="small" style={{ color: 'var(--accent)' }}>
            View all orders →
          </Link>
        </p>
      </div>

      <div className="card glow-card anim-fade-up">
        <div className="card-title">Door scanner access</div>
        <ScanLinkPanel events={events.map((e) => ({ id: e.id, name: e.name }))} />
      </div>

      <div className="card glow-card anim-fade-up">
        <div className="card-title">Sign-in security · authenticator app</div>
        <TotpPanel initialEnrolled={isTotpEnrolled()} />
      </div>
    </div>
  );
}
