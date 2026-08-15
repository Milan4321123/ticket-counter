import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/auth';
import { listAllEvents } from '@/lib/events';
import { formatMoney } from '@/lib/money';
import { listOrganizers } from '@/lib/organizers';
import {
  expireOverdueTransferReservations,
  listEventSalesSummaries,
  summaryFor,
  type EventSalesSummary,
} from '@/lib/orders';
import { BUYER_RETENTION_DAYS, runBuyerDataRetentionSweep } from '@/lib/retention';
import SupportResend from './SupportResend';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sales — Admin', robots: { index: false, follow: false } };

/** Add up a group of events' totals for the per-organizer subtotal row. */
function totalOf(rows: EventSalesSummary[]): EventSalesSummary {
  return rows.reduce(
    (sum, r) => ({
      ordersPaid: sum.ordersPaid + r.ordersPaid,
      ticketsSold: sum.ticketsSold + r.ticketsSold,
      revenueCents: sum.revenueCents + r.revenueCents,
      checkedIn: sum.checkedIn + r.checkedIn,
      awaitingOrders: sum.awaitingOrders + r.awaitingOrders,
      awaitingCents: sum.awaitingCents + r.awaitingCents,
    }),
    { ordersPaid: 0, ticketsSold: 0, revenueCents: 0, checkedIn: 0, awaitingOrders: 0, awaitingCents: 0 }
  );
}

export default async function AdminSalesPage() {
  if (!(await isAdminRequest())) redirect('/admin/login');

  expireOverdueTransferReservations();
  runBuyerDataRetentionSweep();

  const events = listAllEvents();
  const salesByEvent = listEventSalesSummaries();
  const organizers = listOrganizers();

  // One block per organizer, their own events inside it, biggest earner first.
  // Organizers with no events at all are left out — they belong on /admin/organizers.
  const blocks = organizers
    .map((organizer) => {
      const own = events
        .filter((e) => e.organizerId === organizer.id)
        .map((event) => ({ event, sales: summaryFor(salesByEvent, event.id) }));
      return { organizer, rows: own, total: totalOf(own.map((r) => r.sales)) };
    })
    .filter((block) => block.rows.length > 0)
    .sort((a, b) => b.total.revenueCents - a.total.revenueCents);

  const currency = events[0]?.currency ?? 'EUR';
  const platformTotal = totalOf([...salesByEvent.values()]);

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
            Sales
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            What every organizer is selling, event by event.
          </p>
        </div>
        <Link href="/admin" className="btn btn-sm">
          ← Dashboard
        </Link>
      </div>

      {/* The honest explanation for what is deliberately NOT on this page. */}
      <div className="card anim-fade-up anim-d1">
        <div className="card-title">Why there are no names here</div>
        <p className="muted small" style={{ margin: 0 }}>
          Buyer details belong to the organizer, not to the platform — you can see totals, not
          people. Every organizer sees their own buyers in their own portal, confirms their own bank
          transfers, and re-sends their own tickets. On this side of the platform an order is a
          count and an amount, and buyers&rsquo; names and email addresses are erased altogether{' '}
          {BUYER_RETENTION_DAYS} days after their event ends. That is what lets us tell buyers, on{' '}
          <Link href="/privacy" style={{ color: 'var(--accent)' }}>
            the privacy page
          </Link>
          , that their details never leave the organizer they bought from.
        </p>
      </div>

      <div className="card anim-fade-up anim-d1">
        <div className="card-title">Platform total</div>
        <p style={{ margin: 0 }}>
          <strong style={{ fontSize: '1.4rem' }}>{formatMoney(platformTotal.revenueCents, currency)}</strong>{' '}
          <span className="muted small">
            across {platformTotal.ordersPaid} confirmed order{platformTotal.ordersPaid === 1 ? '' : 's'} ·{' '}
            {platformTotal.ticketsSold} ticket{platformTotal.ticketsSold === 1 ? '' : 's'} ·{' '}
            {platformTotal.checkedIn} checked in
          </span>
        </p>
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          This is your customers&rsquo; ticket money, not yours — it goes straight to their bank
          accounts and the platform never touches it. Your own revenue is the per-event fee, under{' '}
          <Link href="/admin/organizers" style={{ color: 'var(--accent)' }}>
            Organizers → Event fees
          </Link>
          .
        </p>
      </div>

      {blocks.length === 0 ? (
        <div className="card anim-fade-up anim-d2">
          <p className="muted" style={{ margin: 0 }}>
            No events on the platform yet.
          </p>
        </div>
      ) : (
        blocks.map(({ organizer, rows, total }) => (
          <div key={organizer.id} className="card anim-fade-up anim-d2">
            <div className="card-title">{organizer.name}</div>
            <p className="muted small" style={{ marginTop: 0 }}>
              {rows.length} event{rows.length === 1 ? '' : 's'} ·{' '}
              {formatMoney(total.revenueCents, currency)} in ticket sales · {total.ticketsSold} ticket
              {total.ticketsSold === 1 ? '' : 's'}
              {total.awaitingOrders > 0 ? (
                <>
                  {' '}
                  · {formatMoney(total.awaitingCents, currency)} still awaiting transfer
                </>
              ) : null}
            </p>
            <div className="table-wrap">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Fee</th>
                    <th>Tickets</th>
                    <th>Revenue</th>
                    <th>Awaiting transfer</th>
                    <th>Checked in</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ event, sales }) => (
                    <tr key={event.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{event.name}</div>
                        <div className="muted small">{event.dateDisplay || 'no date set'}</div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            event.status === 'published'
                              ? 'badge-green'
                              : event.status === 'draft'
                                ? 'badge-amber'
                                : 'badge-red'
                          }`}
                        >
                          {event.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${event.feeStatus === 'paid' ? 'badge-green' : 'badge-amber'}`}>
                          {event.feeStatus}
                        </span>
                      </td>
                      <td>
                        {sales.ticketsSold} <span className="muted small">/ {event.totalCapacity}</span>
                      </td>
                      <td>{formatMoney(sales.revenueCents, event.currency)}</td>
                      <td>
                        {sales.awaitingOrders > 0 ? (
                          <span className="badge badge-amber" style={{ whiteSpace: 'nowrap' }}>
                            {sales.awaitingOrders} · {formatMoney(sales.awaitingCents, event.currency)}
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
          </div>
        ))
      )}

      <div className="card glow-card anim-fade-up anim-d3">
        <div className="card-title">Support · re-send someone&rsquo;s tickets</div>
        <SupportResend />
      </div>
    </div>
  );
}
