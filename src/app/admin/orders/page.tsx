import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/auth';
import { listAllEvents } from '@/lib/events';
import { formatMoney } from '@/lib/money';
import {
  countOrdersByFilter,
  expireOverdueTransferReservations,
  listOrders,
  paymentReference,
  type OrderFilter,
  type OrderStatus,
} from '@/lib/orders';
import TransferActions from '../TransferActions';
import ResendButton from './ResendButton';

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'awaiting', label: 'Awaiting transfer' },
  { key: 'paid', label: 'Paid' },
  { key: 'closed', label: 'Cancelled / failed' },
];

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Orders — Admin' };

function StatusBadge({ status }: { status: OrderStatus }) {
  const cls =
    status === 'paid'
      ? 'badge-green'
      : status === 'pending' || status === 'claimed' || status === 'capturing'
        ? 'badge-amber'
        : 'badge-red';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; filter?: string | string[]; event?: string | string[] }>;
}) {
  if (!(await isAdminRequest())) redirect('/admin/login');

  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q : '';
  const rawFilter = typeof params.filter === 'string' ? params.filter : 'all';
  const filter: OrderFilter = FILTERS.some((f) => f.key === rawFilter) ? (rawFilter as OrderFilter) : 'all';

  const events = listAllEvents();
  const eventNameById = new Map(events.map((e) => [e.id, e.name]));
  const rawEvent = typeof params.event === 'string' ? params.event : '';
  const eventId = eventNameById.has(rawEvent) ? rawEvent : '';

  expireOverdueTransferReservations();
  const orders = listOrders({ query, filter, eventId: eventId || undefined });
  // Chip counts are platform-wide, so they are hidden while an event filter is on.
  const counts = countOrdersByFilter(query);

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
          Orders
        </h1>
        <Link href="/admin" className="btn btn-sm">
          ← Dashboard
        </Link>
      </div>

      <form
        method="get"
        action="/admin/orders"
        className="anim-fade-up anim-d1"
        style={{ display: 'flex', gap: 10, marginBottom: 8, maxWidth: 760, flexWrap: 'wrap' }}
      >
        {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
        <input
          type="search"
          name="q"
          className="input"
          defaultValue={query}
          placeholder="Search by name, email, order ID, or payment reference"
          aria-label="Search orders"
          style={{ flex: '2 1 260px' }}
        />
        <select
          name="event"
          className="input"
          defaultValue={eventId}
          aria-label="Filter by event"
          style={{ flex: '1 1 180px', width: 'auto' }}
        >
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.status !== 'published' ? ` (${e.status})` : ''}
            </option>
          ))}
        </select>
        <button type="submit" className="btn">
          Search
        </button>
      </form>
      <p className="muted small anim-fade-up anim-d2" style={{ marginBottom: 16 }}>
        Tip: paste a reference straight from the bank statement (like <span className="mono">TICKETS-AB12CD34</span>)
        to find its order.
      </p>

      <div className="chip-row anim-fade-up anim-d2">
        {FILTERS.map((f) => {
          const href = `/admin/orders?${new URLSearchParams({
            ...(query ? { q: query } : {}),
            ...(eventId ? { event: eventId } : {}),
            ...(f.key !== 'all' ? { filter: f.key } : {}),
          }).toString()}`;
          return (
            <Link key={f.key} href={href} className={`chip${filter === f.key ? ' chip-active' : ''}`}>
              {f.label}
              {!eventId && <span className="chip-count">{counts[f.key]}</span>}
            </Link>
          );
        })}
      </div>

      {(query || eventId) && (
        <p className="muted small">
          {eventId && (
            <>
              Event: <strong>{eventNameById.get(eventId)}</strong>
              {query ? ' · ' : ' '}
            </>
          )}
          {query && <>Search: “{query}” </>}—{' '}
          <Link href="/admin/orders" style={{ color: 'var(--accent)' }}>
            clear filters
          </Link>
        </p>
      )}

      <div className="card anim-fade-up anim-d2">
        {orders.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {query || eventId ? 'No orders match these filters.' : 'No orders yet.'}
          </p>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
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
                      <td>
                        {reference ? (
                          <span className="mono small" style={{ whiteSpace: 'nowrap' }}>
                            {reference}
                            {reference.includes('-S-') && (
                              <span className="badge badge-student" style={{ marginLeft: 6 }}>
                                student
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <Link href={`/order/${o.id}`} className="btn btn-sm">
                          View
                        </Link>
                      </td>
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
  );
}
