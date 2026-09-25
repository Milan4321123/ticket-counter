import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listBuyers, paymentSplit, returningBuyerCount, salesByDay, topReferrers, waitlistWaitingCount } from '@/lib/analytics';
import { getEventById } from '@/lib/events';
import { activeConsentCount } from '@/lib/marketing';
import { formatMoney } from '@/lib/money';
import { getStats } from '@/lib/orders';
import { organizerPlanActive } from '@/lib/organizers';
import { promoTotalsForOrganizer, promoUsageForEvent } from '@/lib/promos';
import { getReferralRewardSettings, voucherTotalsForOrganizer } from '@/lib/referrals';
import { BUYER_RETENTION_DAYS } from '@/lib/retention';
import { vocabFor } from '@/lib/vocab';
import PlanExpired from '../../../PlanExpired';
import PortalNav from '../../../PortalNav';
import { requirePortalOrganizer } from '../../../guard';
import { PaymentSplitBar, SalesOverTimeChart, TierBarsChart } from './charts';
import ShopInsightsPanel from './ShopInsightsPanel';
import { shopInsights } from '@/lib/shopInsights';

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
  // The biggest referrers, plus how many did not fit — see ReferralChain for
  // why the card is capped and why the leftovers are said out loud.
  const chain = topReferrers(event.id);
  const referrers = chain.referrers;
  // Rewards are an ACCOUNT setting and vouchers are earned across all of this
  // organizer's listings, so both are read per organizer — the table above is
  // this listing only, and the copy says so.
  const rewards = getReferralRewardSettings(organizer.id);
  const vouchers = voucherTotalsForOrganizer(organizer.id);
  // The organizer's OWN codes, next to the vouchers the rewards issue: same
  // kind of thing to a buyer (the seller's discount on the seller's price),
  // and both are redeemed through the same box at checkout. The totals are
  // account-wide like the vouchers above; the usage line underneath is this
  // listing's confirmed orders only, which is why it is a separate number.
  const promos = promoTotalsForOrganizer(organizer.id);
  const promoUsage = promoUsageForEvent(event.id);

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
              {!isShop && <span className="muted small">/ {event.totalCapacity}</span>}
            </div>
            <div className="stat-sub">
              {isShop
                ? `across ${stats.perTier.filter((t) => t.sold > 0).length} ${stats.perTier.filter((t) => t.sold > 0).length === 1 ? 'item' : 'items'}`
                : event.totalCapacity > 0
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

        {/* ---- The shop's own questions: what, when, what together (lib/shopInsights) ---- */}
        {isShop && hasSales && <ShopInsightsPanel data={shopInsights(event.id)} currency={event.currency} />}

        {/* ---- Sales over time ---- */}
        <div className="card anim-fade-up anim-d2">
          <div className="card-title">Sales over time</div>
          {enoughDaysForChart ? (
            <>
              <p className="muted small" style={{ marginTop: 0 }}>
                Confirmed money, adding up day by day. Hover a day for its detail.
              </p>
              <SalesOverTimeChart days={days} currency={event.currency} unitsWord={isShop ? "order" : "booking"} />
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

        {/* ---- Referrals and codes ---- */}
        {/* Shown when there is something to say — OR whenever rewards are
            switched on, so an organizer who has just promised something can
            always see that it is live. The empty referrer table is still
            hidden further down; it was hiding the whole CARD that left a
            brand-new promise invisible on the page it belongs to. */}
        {(rewards.enabled || referrers.length > 0 || vouchers.earned > 0 || promos.minted > 0) && (
          <div className="card anim-fade-up anim-d3">
            <div className="card-title">Referrals and codes</div>
            <p className="muted small" style={{ marginTop: 0 }}>
              Buyers whose shared link brought in a booking you have{' '}
              <strong>confirmed</strong> — test orders are never counted, and free reservations are
              counted here as the bookings they are. Open a name to see exactly who they brought.
              Buyers erased by the privacy sweep show as &ldquo;a past guest&rdquo;.
              {rewards.enabled ? (
                <>
                  {' '}
                  Rewards are on: every {rewards.threshold} booking
                  {rewards.threshold === 1 ? '' : 's'} someone brings that is{' '}
                  <strong>actually paid for</strong> earns them a{' '}
                  {formatMoney(rewards.rewardCents, event.currency)} voucher — your discount, on
                  your prices. That is the stricter count: a free reservation, and a booking one of
                  your vouchers already paid part of, appear in the table below but never earn the
                  next voucher.
                </>
              ) : (
                <>
                  {' '}
                  Nothing is owed to anyone — you can change that under{' '}
                  <Link href="/portal/settings">Settings</Link>, where you decide how many referrals
                  earn a voucher and what it is worth.
                </>
              )}
            </p>
            {rewards.enabled && (
              <>
                <div className="summary-row">
                  <span className="muted">Vouchers earned (all your listings)</span>
                  <span>
                    {vouchers.earned} · {formatMoney(vouchers.earnedCents, event.currency)}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="muted">Of those, redeemed</span>
                  <span>
                    {vouchers.redeemed} · {formatMoney(vouchers.redeemedCents, event.currency)}
                  </span>
                </div>
                <p className="muted small" style={{ margin: '8px 0 16px' }}>
                  A redeemed voucher means a buyer transferred you that much less — your own
                  discount on your own prices. Nothing is charged or deducted by the platform, and
                  the counts above run across all your listings, while the table below is this{' '}
                  {v.listing} only.
                </p>
              </>
            )}
            {/* The organizer's own codes, once they have made any. Kept in
                this card rather than a new one: to a buyer a promo code and a
                thank-you voucher are one thing typed into one box, and
                splitting them across the page would suggest otherwise. */}
            {promos.minted > 0 && (
              <>
                <div className="summary-row">
                  <span className="muted">Your own codes (all your listings)</span>
                  <span>
                    {promos.minted} made · {promos.live} usable now · {promos.redeemed} redeemed
                  </span>
                </div>
                <div className="summary-row">
                  <span className="muted">What they took off this {v.listing}</span>
                  <span>
                    {promoUsage.orders} order{promoUsage.orders === 1 ? '' : 's'} ·{' '}
                    {formatMoney(promoUsage.discountCents, event.currency)}
                  </span>
                </div>
                <p className="muted small" style={{ margin: '8px 0 16px' }}>
                  Your own discount on your own prices — those buyers transferred you that much
                  less, and nothing was charged or deducted by the platform. A code counts as
                  redeemed only while an order holds it: cancel an order, or let its payment lapse,
                  and the code goes back — except a test-mode booking, which counts as paid and
                  holds its redemption until the test orders are deleted before going live. Make
                  and switch off codes under{' '}
                  <Link href="/portal/promos">Discount codes</Link>.
                </p>
              </>
            )}
            {/* Only when somebody has actually referred a paid booking on THIS
                listing: an empty table under a filled-in voucher summary would
                read as a bug rather than as "not yet". */}
            {referrers.length > 0 && (
              <>
                {/* One line per referrer, opening into the actual chain on
                    demand. A table of everyone's referred bookings all at once
                    would bury the summary an organizer opens this card for —
                    and most rows have one booking under them, which is not
                    worth a screen of table. */}
                <div style={{ display: 'grid', gap: 2 }}>
                  {referrers.map((r, i) => (
                    <details
                      key={`${r.name}-${i}`}
                      style={{ borderTop: '1px solid var(--border-soft)', padding: '8px 0' }}
                    >
                      <summary style={{ cursor: 'pointer' }}>
                        <strong>{r.name}</strong>
                        <span className="muted small">
                          {' '}
                          — {r.referredOrders} booking{r.referredOrders === 1 ? '' : 's'} ·{' '}
                          {r.referredSeats} {r.referredSeats === 1 ? v.unit : v.units}
                        </span>
                      </summary>
                      <div className="table-wrap" style={{ marginTop: 10 }}>
                        <table className="table table-cards">
                          <thead>
                            <tr>
                              <th>Who they brought</th>
                              <th>Confirmed</th>
                              <th>Worth</th>
                              <th>{v.Units}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.bookings.map((b) => (
                              <tr key={b.orderId}>
                                <td data-label="Who they brought" className="tc-head">
                                  {b.name}
                                  {/* The chain going one step deeper. Said, not
                                      paid for: the reward rule is unchanged
                                      (direct referrals only), and the note
                                      under this list says so in as many
                                      words. */}
                                  {b.broughtOnward > 0 && (
                                    <span className="muted small">
                                      {' '}
                                      — and brought {b.broughtOnward} of their own
                                    </span>
                                  )}
                                </td>
                                <td data-label="Confirmed" className="small">{b.confirmedOn}</td>
                                <td data-label="Worth">{formatMoney(b.totalCents, event.currency)}</td>
                                <td data-label={v.Units}>{b.units}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {/* Never truncated in silence: the count beside the
                            name is the whole total, so a shorter table under
                            it has to say what it left out. */}
                        {r.moreBookings > 0 && (
                          <p className="muted small" style={{ margin: '8px 0 0' }}>
                            and {r.moreBookings} more booking{r.moreBookings === 1 ? '' : 's'} not
                            listed here — the newest {r.bookings.length} are shown.
                          </p>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
                {chain.moreReferrers > 0 && (
                  <p className="muted small" style={{ margin: '10px 0 0' }}>
                    and {chain.moreReferrers} more{' '}
                    {chain.moreReferrers === 1 ? 'person who brought' : 'people who brought'} someone
                    — the {referrers.length} who brought the most are shown.
                  </p>
                )}
                <p className="muted small" style={{ margin: '12px 0 0' }}>
                  Someone who was brought here can bring people themselves, and where that has
                  happened their row says so — they also have a row of their own in this list, with
                  their bookings under it. That is the chain, and it is only ever something to
                  see: {rewards.enabled ? 'a voucher is earned for' : 'if you switch rewards on, a voucher is earned for'}{' '}
                  <strong>direct referrals only</strong>, so bringing someone who then brings two
                  more earns you one referral, not three. Nothing deeper down the chain pays anyone
                  anything.
                </p>
              </>
            )}
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
              <table className="table table-cards">
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
                      <td data-label="Buyer" className="tc-head">{b.name}</td>
                      <td data-label="Email" className="small">{b.email}</td>
                      <td data-label="Bookings">{b.orders}</td>
                      <td data-label={v.Units}>{b.units}</td>
                      <td data-label="Total paid">{formatMoney(b.totalPaidCents, event.currency)}</td>
                      <td data-label={v.Redeemed}>
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
