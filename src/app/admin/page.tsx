import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/auth';
import { getEventConfig } from '@/lib/config';
import { formatMoney } from '@/lib/money';
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
import MaintenancePanel from './MaintenancePanel';
import ScanLinkPanel from './ScanLinkPanel';
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

export default async function AdminDashboardPage() {
  if (!(await isAdminRequest())) redirect('/admin/login');

  const cfg = getEventConfig();
  // Release seats of transfer reservations whose payment never arrived.
  expireOverdueTransferReservations();
  const stats = getStats();
  const recent = listOrders({ limit: 10 });
  const stuckCount = getStuckOrders(10).length;
  const awaitingTransfer = listAwaitingTransferOrders();

  return (
    <div className="container section">
      <div
        className="anim-fade-up"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <h1 className="page-title" style={{ margin: 0 }}>
          Admin dashboard
        </h1>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/admin/orders" className="btn btn-sm">
            Orders
          </Link>
          <Link href="/admin/checkin" className="btn btn-primary btn-sm">
            Door check-in
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card anim-fade-up anim-d1">
          <div className="stat-label">Money received</div>
          <div className="stat-value">{formatMoney(stats.revenueCents, cfg.currency)}</div>
          <div className="muted small">confirmed payments</div>
        </div>
        <div className="stat-card anim-fade-up anim-d2">
          <div className="stat-label">Awaiting bank transfer</div>
          <div className="stat-value">{formatMoney(stats.awaitingTransferCents, cfg.currency)}</div>
          <div className="muted small">
            {stats.awaitingTransferOrders} order{stats.awaitingTransferOrders === 1 ? '' : 's'} ·{' '}
            {stats.awaitingTransferTickets} ticket{stats.awaitingTransferTickets === 1 ? '' : 's'}
          </div>
        </div>
        <div className="stat-card anim-fade-up anim-d3">
          <div className="stat-label">Tickets sold</div>
          <div className="stat-value">
            {stats.ticketsSold} <span className="muted small">/ {cfg.totalCapacity}</span>
          </div>
        </div>
        <div className="stat-card anim-fade-up anim-d4">
          <div className="stat-label">Checked in</div>
          <div className="stat-value">
            {stats.checkedIn} <span className="muted small">/ {stats.ticketsSold}</span>
          </div>
        </div>
      </div>

      <MaintenancePanel
        stuckCount={stuckCount}
        mockPaidOrders={stats.mockPaidOrders}
        mockTicketsSold={stats.mockTicketsSold}
      />

      <div className="card anim-fade-up">
        <div className="card-title">Sales by tier</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Sold</th>
                <th>Revenue (real)</th>
              </tr>
            </thead>
            <tbody>
              {stats.perTier.map((t) => (
                <tr key={t.tierId}>
                  <td>{t.name}</td>
                  <td>
                    {t.sold} / {t.cap}
                  </td>
                  <td>{formatMoney(t.revenueCents, cfg.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card anim-fade-up">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {awaitingTransfer.length > 0 && <span className="pulse-dot" aria-hidden />}
          Awaiting bank transfer{awaitingTransfer.length > 0 ? ` (${awaitingTransfer.length})` : ''}
        </div>
        {awaitingTransfer.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No reservations are waiting for a bank transfer right now.
          </p>
        ) : (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              Compare your bank statement against the references below. When a payment has arrived, click{' '}
              <strong>Payment received</strong> and type the last 4 characters of its reference — the tickets are
              emailed to the buyer automatically.
            </p>
            <div className="table-wrap">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Reserved (UTC)</th>
                    <th>Buyer</th>
                    <th>Email</th>
                    <th>Items</th>
                    <th>Expected amount</th>
                    <th>Reference</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {awaitingTransfer.map((o) => {
                    const reference = paymentReference(o.id);
                    return (
                      <tr key={o.id}>
                        <td className="mono small">{o.createdAt.slice(0, 16)}</td>
                        <td>{o.buyerName}</td>
                        <td className="small">{o.buyerEmail}</td>
                        <td>{o.itemsSummary}</td>
                        <td>
                          <strong>{formatMoney(o.totalCents, o.currency)}</strong>
                        </td>
                        <td>
                          <ReferenceTag reference={reference} />
                        </td>
                        <td>
                          <TransferActions
                            orderId={o.id}
                            buyerName={o.buyerName}
                            amountDisplay={formatMoney(o.totalCents, o.currency)}
                            reference={reference}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

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
        <ScanLinkPanel />
      </div>
    </div>
  );
}
