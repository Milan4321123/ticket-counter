import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listBuyers, paymentSplit, returningBuyerCount, salesByDay, topReferrers, waitlistWaitingCount } from '@/lib/analytics';
import { getEventById } from '@/lib/events';
import { activeConsentCount } from '@/lib/marketing';
import { formatMoney } from '@/lib/money';
import { getStats } from '@/lib/orders';
import { organizerPlanActive } from '@/lib/organizers';
import { BUYER_RETENTION_DAYS } from '@/lib/retention';
import { vocabFor } from '@/lib/vocab';
import PlanExpired from '../../../PlanExpired';
import PortalNav from '../../../PortalNav';
import { requirePortalOrganizer } from '../../../guard';
import { PaymentSplitBar, SalesOverTimeChart, TierBarsChart } from './charts';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Insights — Organizer portal', robots: { index: false, follow: false } };

/**
 * The organizer's sales-analysis view for ONE listing: how the money came in,
 * what sold, how people paid, and who bought. Read-only — every number here
 * is a rearrangement of what Orders already shows, so nothing on this page
 * can change an order.
 *
 * Deliberately NOT here: any way to message the buyers. They gave their
 * address to receive what they bought, not to receive offers. (The Publish
 * tab's announce button is not an exception — it reaches ONLY people who
 * ticked the optional "keep me posted" box, which is a different list with
 * its own consent; see lib/marketing.ts.)
 */
export default async function PortalInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organizer = await requirePortalOrganizer();
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;

  const event = getEventById(id);
  if (!event || event.organizerId !== organizer.id) redirect('/portal');
  const v = vocabFor(event.kind);
  const isShop = event.kind === 'shop';

  const stats = getStats(event.id);
  const days = salesByDay(event.id);
  const split = paymentSplit(event.id);
  const buyers = listBuyers(event.id);
  const cameBefore = returningBuyerCount(event.id, organizer.id);
  const waiting = waitlistWaitingCount(event.id);
  // Account-wide, not per-listing: a confirmed "keep me posted" tick
  // subscribes to the ORGANIZER's future announcements, whichever checkout
  // carried it. Counts only confirmed, not-unsubscribed addresses — a pending
  // request is not a subscriber.
  const subscribers = activeConsentCount(organizer.id);
  const referrers = topReferrers(event.id);

  const hasSales = stats.ordersPaid > 0 || stats.awaitingTransferOrders > 0;
  const checkinPct = stats.ticketsSold > 0 ? Math.round((stats.checkedIn / stats.ticketsSold) * 100) : 0;
  // Charts appear once a few days of sales exist; below that, a chart of one
  // or two points would just be a slow way to print a sentence.
  const enoughDaysForChart = days.length >= 3;
  const tiersWithMeaning = stats.perTier.filter((t) => t.sold > 0 || t.cap > 0);
  const paidMethodCount = Number(split.transfer > 0) + Number(split.paypal > 0) + Number(split.free > 0);

  return (
    <>
      <PortalNav
        event={{ id: event.id, name: event.name, slug: event.slug, published: event.status === 'published', kind: event.kind }}
        tab="insights"
      />
      <div className="container section">
        <div className="anim-fade-up" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            Insights
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {event.name}
            {event.dateDisplay ? ` · ${event.dateDisplay}` : ''} — how your {v.listing} is selling.
          </p>
        </div>

        {/* ---- The headline numbers, same meanings as the dashboard chips ---- */}
        <div className="stat-grid">
          <div className="stat-card anim-fade-up anim-d1">
            <div className="stat-label">Money received</div>
            <div className="stat-value">{formatMoney(stats.revenueCents, event.currency)}</div>
            <div className="stat-sub">
              {stats.ordersPaid} confirmed order{stats.ordersPaid === 1 ? '' : 's'}
            </div>
          </div>
          <div className={`stat-card anim-fade-up anim-d2${stats.awaitingTransferOrders > 0 ? ' stat-card-alert' : ''}`}>
            <div className="stat-label">On its way</div>
            <div className="stat-value">{formatMoney(stats.awaitingTransferCents, event.currency)}</div>
            <div className="stat-sub">
              {stats.awaitingTransferOrders} reservation{stats.awaitingTransferOrders === 1 ? '' : 's'} to confirm
            </div>
          </div>
          <div className="stat-card anim-fade-up anim-d3">
            <div className="stat-label">{v.Units} sold</div>
            <div className="stat-value">
              {stats.ticketsSold}
              <span className="muted small">/ {event.totalCapacity}</span>
            </div>
            <div className="stat-sub">
              {event.totalCapacity > 0
                ? `${Math.min(100, Math.round((stats.ticketsSold / event.totalCapacity) * 100))}% of ${v.capacity}`
                : `of stated ${v.capacity}`}
            </div>
          </div>
          <div className="stat-card anim-fade-up anim-d4">
            <div className="stat-label">{v.Redeemed}</div>
            <div className="stat-value">
              {checkinPct}
              <span className="muted small">%</span>
            </div>
            <div className="stat-sub">
              {stats.checkedIn} of {stats.ticketsSold} {stats.ticketsSold === 1 ? v.code : v.codes} scanned
            </div>
          </div>
          <div className="stat-card anim-fade-up anim-d4">
            <div className="stat-label">Waitlist</div>
            <div className="stat-value">{waiting}</div>
            <div className="stat-sub">{waiting === 1 ? 'person waiting' : 'people waiting'} for space</div>
          </div>
          <div className="stat-card anim-fade-up anim-d4">
            <div className="stat-label">Subscribers</div>
            <div className="stat-value">{subscribers}</div>
            <div className="stat-sub">
              asked to hear about your new listings — announce from the Publish tab
            </div>
          </div>
        </div>

        {/* ---- Sales over time ---- */}
        <div className="card anim-fade-up anim-d2">
          <div className="card-title">Sales over time</div>
          {enoughDaysForChart ? (
            <>
              <p className="muted small" style={{ marginTop: 0 }}>
                Confirmed money, adding up day by day. Hover a day for its detail.
              </p>
              <SalesOverTimeChart days={days} currency={event.currency} unitsWord="booking" />
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {hasSales
                ? `The chart appears once a few days of sales exist. So far: ${formatMoney(stats.revenueCents, event.currency)} confirmed across ${stats.ordersPaid} order${stats.ordersPaid === 1 ? '' : 's'}${days.length > 0 ? `, starting ${days[0].day}` : ''}.`
                : `No sales yet — this page fills in the moment someone ${isShop ? 'orders' : 'books'}.`}
            </p>
          )}
        </div>

        {/* ---- By ticket type / by item ---- */}
        <div className="card anim-fade-up anim-d3">
          <div className="card-title">By {v.unitType}</div>
          {tiersWithMeaning.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No {v.unitTypes} yet — add them in Edit and this breakdown appears.
            </p>
          ) : tiersWithMeaning.length < 3 ? (
            // One or two rows is a couple of numbers, not a chart.
            <div style={{ display: 'grid', gap: 6 }}>
              {tiersWithMeaning.map((t) => (
                <p key={t.tierId} className="small" style={{ margin: 0 }}>
                  <strong>{t.name}</strong> — {t.sold} sold ·{' '}
                  <strong>{formatMoney(t.revenueCents, event.currency)}</strong>
                </p>
              ))}
            </div>
          ) : (
            <TierBarsChart
              tiers={tiersWithMeaning.map((t) => ({ name: t.name, sold: t.sold, revenueCents: t.revenueCents }))}
              currency={event.currency}
            />
          )}
        </div>

        {/* ---- How people paid ---- */}
        <div className="card anim-fade-up anim-d3">
          <div className="card-title">How people paid</div>
          {stats.ordersPaid === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Nothing confirmed yet — once orders are paid, this shows which route buyers chose.
            </p>
          ) : (
            <>
              {paidMethodCount > 1 && (
                <p className="muted small" style={{ marginTop: 0 }}>
                  Confirmed orders by payment route.
                </p>
              )}
              <PaymentSplitBar
                segments={[
                  { key: 'transfer', label: 'Bank transfer', count: split.transfer },
                  { key: 'paypal', label: 'PayPal', count: split.paypal },
                  { key: 'free', label: 'Free', count: split.free },
                ]}
              />
            </>
          )}
        </div>

        {/* ---- Top referrers ---- */}
        {/* Only when at least one referred paid order exists: an empty "nobody
            shared your event" table is a worse message than no table. */}
        {referrers.length > 0 && (
          <div className="card anim-fade-up anim-d3">
            <div className="card-title">Top referrers</div>
            <p className="muted small" style={{ marginTop: 0 }}>
              Buyers whose shared link brought in a confirmed order. Just for you to see who spreads
              the word — nothing is owed to anyone, and buyers erased by the privacy sweep show as
              &ldquo;a past guest&rdquo;.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Referrer</th>
                    <th>Orders brought</th>
                    <th>{v.Units} brought</th>
                  </tr>
                </thead>
                <tbody>
                  {referrers.map((r, i) => (
                    <tr key={`${r.name}-${i}`}>
                      <td>{r.name}</td>
                      <td>{r.referredOrders}</td>
                      <td>{r.referredSeats}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---- Buyers ---- */}
        <div className="card anim-fade-up anim-d4">
          <div
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="card-title" style={{ marginBottom: 4 }}>
                {isShop ? 'Your customers' : 'Your guests'}
              </div>
              <p className="muted small" style={{ margin: 0 }}>
                Everyone with a confirmed order, biggest first.
                {cameBefore > 0 && (
                  <>
                    {' '}
                    <strong style={{ color: 'var(--text)' }}>
                      {cameBefore} {cameBefore === 1 ? 'has' : 'have'} bought from one of your other listings before.
                    </strong>
                  </>
                )}
              </p>
            </div>
            {buyers.length > 0 && (
              // The one export that exists is the same per-listing orders
              // spreadsheet the Orders tab offers — nothing new to leak.
              <a className="btn btn-sm" href={`/api/portal/events/${event.id}/orders/export`} download>
                Download as spreadsheet
              </a>
            )}
          </div>

          {buyers.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No confirmed buyers yet.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th>Email</th>
                    <th>Bookings</th>
                    <th>{v.Units}</th>
                    <th>Total paid</th>
                    <th>{v.Redeemed}</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map((b) => (
                    <tr key={b.email}>
                      <td>{b.name}</td>
                      <td className="small">{b.email}</td>
                      <td>{b.orders}</td>
                      <td>{b.units}</td>
                      <td>{formatMoney(b.totalPaidCents, event.currency)}</td>
                      <td>
                        {b.checkedIn}
                        <span className="muted small">/ {b.units}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* The retention promise, stated where the data is shown. The number
              comes from lib/retention so this sentence and the sweep that
              enforces it can never drift apart. */}
          <p className="muted small" style={{ margin: '12px 0 0' }}>
            Privacy: buyer names and email addresses are erased automatically{' '}
            {isShop
              ? `once an order is completed (${BUYER_RETENTION_DAYS} days after the last collection)`
              : `${BUYER_RETENTION_DAYS} days after the event`}
            . Your counts and totals stay; the people behind them stop being identifiable. Buyers gave their
            address to receive their {v.codes} — this page never sends them anything else.
          </p>
        </div>

        <p className="muted small anim-fade-up anim-d4">
          Looking for a single order? The{' '}
          <Link href={`/portal/events/${event.id}/orders`} style={{ color: 'var(--accent-text)' }}>
            Orders tab
          </Link>{' '}
          has the search box and the confirm buttons.
        </p>
      </div>
    </>
  );
}
