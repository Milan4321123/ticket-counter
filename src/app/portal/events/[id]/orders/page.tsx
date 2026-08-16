import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getEventById } from '@/lib/events';
import { formatMoney } from '@/lib/money';
import {
  expireOverdueTransferReservations,
  getStats,
  listAwaitingTransferOrders,
  listOrders,
  paymentReference,
  type OrderStatus,
} from '@/lib/orders';
import { organizerPlanActive } from '@/lib/organizers';
import TransferActions from '@/app/admin/TransferActions';
import ResendButton from '@/app/admin/orders/ResendButton';
import PlanExpired from '../../../PlanExpired';
import PortalNav from '../../../PortalNav';
import { requirePortalOrganizer } from '../../../guard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Orders — Organizer portal', robots: { index: false, follow: false } };

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

export default async function PortalOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { id } = await params;
  const organizer = await requirePortalOrganizer();
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;

  const event = getEventById(id);
  if (!event || event.organizerId !== organizer.id) redirect('/portal');

  const sp = await searchParams;
  const query = typeof sp.q === 'string' ? sp.q : '';

  // Release seats of transfer reservations whose payment never arrived.
  expireOverdueTransferReservations(event.id);
  const awaiting = listAwaitingTransferOrders(event.id);
  const orders = listOrders({ eventId: event.id, query });
  const stats = getStats(event.id);
  // Whether the EVENT has any orders at all, independent of the search box.
  // Gating the export on the filtered list made the button vanish the moment a
  // search matched nothing — exactly when someone is most likely to give up and
  // reach for the download instead.
  const hasAnyOrders = query ? listOrders({ eventId: event.id, limit: 1 }).length > 0 : orders.length > 0;

  return (
    <>
      <PortalNav
        event={{ id: event.id, name: event.name, slug: event.slug, published: event.status === 'published' }}
        tab="orders"
      />
      <div className="container section">
        <div
          className="anim-fade-up"
          style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              Orders
            </h1>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {event.name}
              {event.dateDisplay ? ` · ${event.dateDisplay}` : ''}
            </p>
          </div>
          {hasAnyOrders && (
            <div style={{ flex: 'none' }}>
              {/* A plain link, not fetch(): the browser handles the download and
                  the cookie rides along, so there is nothing to hold in memory. */}
              <a className="btn btn-sm" href={`/api/portal/events/${event.id}/orders/export`} download>
                Download as spreadsheet
              </a>
              <p className="muted small" style={{ margin: '4px 0 0', maxWidth: 210 }}>
                Your buyer list is yours — take a copy any time.
              </p>
            </div>
          )}
        </div>

      {/* ---- The one thing that needs doing: confirm arrived bank transfers ---- */}
      {awaiting.length > 0 && (
        <div className="card action-card anim-fade-up">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="pulse-dot" aria-hidden />
            {awaiting.length} reservation{awaiting.length === 1 ? '' : 's'} waiting for your confirmation
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>
            Check your bank account for these references. When the money is there, click{' '}
            <strong>Payment received</strong> and type the last 4 characters of the reference — the QR tickets are
            emailed to the buyer automatically.
          </p>
          <div>
            {awaiting.map((o) => {
              const reference = paymentReference(o.id);
              return (
                <div key={o.id} className="action-row">
                  <div className="action-row-who">
                    <div style={{ fontWeight: 700 }}>{o.buyerName}</div>
                    <div className="muted small">
                      {o.itemsSummary} · reserved {o.createdAt.slice(0, 10)}
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
          <div className="stat-value">{formatMoney(stats.revenueCents, event.currency)}</div>
          <div className="stat-sub">
            {stats.ordersPaid} confirmed order{stats.ordersPaid === 1 ? '' : 's'}
          </div>
        </div>
        <div className={`stat-card anim-fade-up anim-d2${stats.awaitingTransferOrders > 0 ? ' stat-card-alert' : ''}`}>
          <div className="stat-label">Awaiting bank transfer</div>
          <div className="stat-value">{formatMoney(stats.awaitingTransferCents, event.currency)}</div>
          <div className="stat-sub">
            {stats.awaitingTransferOrders} order{stats.awaitingTransferOrders === 1 ? '' : 's'} ·{' '}
            {stats.awaitingTransferTickets} ticket{stats.awaitingTransferTickets === 1 ? '' : 's'}
          </div>
        </div>
        <div className="stat-card anim-fade-up anim-d3">
          <div className="stat-label">Tickets sold</div>
          <div className="stat-value">
            {stats.ticketsSold}
            {event.capacityUnlimited ? null : (
              <span className="muted small">/ {event.totalCapacity}</span>
            )}
          </div>
        </div>
        <div className="stat-card anim-fade-up anim-d4">
          <div className="stat-label">Checked in</div>
          <div className="stat-value">
            {stats.checkedIn} <span className="muted small">/ {stats.ticketsSold}</span>
          </div>
        </div>
      </div>

      <form
        method="get"
        action={`/portal/events/${event.id}/orders`}
        className="anim-fade-up anim-d2"
        style={{ display: 'flex', gap: 10, marginBottom: 8, maxWidth: 560 }}
      >
        <input
          type="search"
          name="q"
          className="input"
          defaultValue={query}
          placeholder="Search by name, email, order ID, or payment reference"
          aria-label="Search orders"
        />
        <button type="submit" className="btn">
          Search
        </button>
      </form>
      <p className="muted small anim-fade-up anim-d2" style={{ marginBottom: 16 }}>
        Tip: paste a reference straight from your bank statement (like <span className="mono">TICKETS-AB12CD34</span>)
        to find its order.
      </p>

      {query && (
        <p className="muted small">
          Showing results for &ldquo;{query}&rdquo; —{' '}
          <Link href={`/portal/events/${event.id}/orders`} style={{ color: 'var(--accent)' }}>
            clear
          </Link>
        </p>
      )}

      <div className="card anim-fade-up anim-d2">
        {orders.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {query ? 'No orders match that search.' : 'No orders yet — they show up here the moment someone books.'}
          </p>
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
                {orders.map((o) => {
                  const reference = o.paymentMode === 'transfer' ? paymentReference(o.id) : null;
                  return (
                    <tr key={o.id}>
                      <td className="mono small">{o.createdAt.slice(0, 16)}</td>
                      <td>{o.buyerName}</td>
                      <td className="small">{o.buyerEmail}</td>
                      <td>{o.itemsSummary}</td>
                      <td>{formatMoney(o.totalCents, o.currency)}</td>
                      <td>
                        {o.paymentMode === 'transfer' && o.status === 'claimed' ? (
                          <span className="badge badge-amber" style={{ whiteSpace: 'nowrap' }}>
                            awaiting transfer
                          </span>
                        ) : (
                          <StatusBadge status={o.status} />
                        )}
                        {o.paymentMode === 'mock' ? (
                          <span className="badge badge-amber" style={{ marginLeft: 6 }}>
                            test
                          </span>
                        ) : null}
                      </td>
                      <td>{reference ? <ReferenceTag reference={reference} /> : <span className="muted">—</span>}</td>
                      <td>
                        {o.status === 'paid' ? (
                          <ResendButton orderId={o.id} />
                        ) : o.paymentMode === 'transfer' && o.status === 'claimed' ? (
                          <TransferActions
                            orderId={o.id}
                            buyerName={o.buyerName}
                            amountDisplay={formatMoney(o.totalCents, o.currency)}
                            reference={paymentReference(o.id)}
                          />
                        ) : o.paymentMode === 'transfer' && (o.status === 'cancelled' || o.status === 'failed') ? (
                          <TransferActions
                            variant="late"
                            orderId={o.id}
                            buyerName={o.buyerName}
                            amountDisplay={formatMoney(o.totalCents, o.currency)}
                            reference={paymentReference(o.id)}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </div>
    </>
  );
}
