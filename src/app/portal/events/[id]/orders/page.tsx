import { kitchenDetailsBulk, parseSlotConfig, type KitchenLine } from '@/lib/kitchen';
import { parseSeatMap, seatSummary, seatsForOrders } from '@/lib/seats';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getEventById } from '@/lib/events';
import { vocabFor } from '@/lib/vocab';
import { effectivePayout } from '@/lib/payout';
import { formatMoney } from '@/lib/money';
import {
  expireOverdueTransferReservations,
  getStats,
  listAwaitingTransferOrders,
  listOrders,
  type OrderStatus,
} from '@/lib/orders';
import { organizerPlanActive } from '@/lib/organizers';
import { listStallLinksForShop } from '@/lib/stalls';
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

/** "6 min", "2 h 5 min" since a UTC SQLite time. */
function minutesSince(at: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(`${at.replace(' ', 'T')}Z`)) / 60_000));
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} d`;
}

function ReferenceTag({ reference }: { reference: string }) {
  return (
    <span className="mono small" style={{ whiteSpace: 'nowrap' }} translate="no">
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
  searchParams: Promise<{ q?: string | string[]; show?: string | string[] }>;
}) {
  const { id } = await params;
  const organizer = await requirePortalOrganizer();
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;

  const event = getEventById(id);
  if (!event || event.organizerId !== organizer.id) redirect('/portal');
  const v = vocabFor(event.kind);

  const sp = await searchParams;
  const query = typeof sp.q === 'string' ? sp.q : '';
  const show = sp.show === 'todo' || sp.show === 'paid' || sp.show === 'cancelled' ? sp.show : 'all';

  // Release seats of transfer reservations whose payment never arrived.
  expireOverdueTransferReservations(event.id);
  const awaiting = listAwaitingTransferOrders(event.id);
  // Both routes are manual and both land as 'transfer' orders, so the platform
  // cannot know which one a given buyer chose — only that this event offered
  // both. That makes "bank transfer" the wrong word here whenever PayPal is on.
  const takesPaypal = effectivePayout(event).paypal.trim() !== '';
  const allOrders = listOrders({ eventId: event.id, query });
  const isTodo = (o: (typeof allOrders)[number]) => o.paymentMode === 'transfer' && o.status === 'claimed';
  const isGone = (o: (typeof allOrders)[number]) => o.status === 'cancelled' || o.status === 'failed';
  const counts = {
    all: allOrders.length,
    todo: allOrders.filter(isTodo).length,
    paid: allOrders.filter((o) => o.status === 'paid').length,
    cancelled: allOrders.filter(isGone).length,
  };
  const orders =
    show === 'todo'
      ? allOrders.filter(isTodo)
      : show === 'paid'
        ? allOrders.filter((o) => o.status === 'paid')
        : show === 'cancelled'
          ? allOrders.filter(isGone)
          : allOrders;
  // Restaurant pack: collection time / table / choices per order (shops only).
  const kitchenLines = event.kind === 'shop' ? kitchenDetailsBulk(orders.map((o) => o.id), parseSlotConfig(event.pickupSlots).purpose) : new Map<string, KitchenLine>();
  // Reserved seating: the seats each order holds, as its extra line.
  const seatMap = event.kind === 'event' ? parseSeatMap(event.seatMap) : null;
  if (seatMap) {
    for (const [orderId, seatIds] of seatsForOrders(orders.map((o) => o.id))) {
      kitchenLines.set(orderId, { line: `Seats: ${seatSummary(seatIds, seatMap)}` });
    }
  }
  const stats = getStats(event.id);
  // A shop with an approved stall will meet buyers face to face at someone
  // else's event — the one place a transfer sent that morning may not have
  // landed yet. The counter hint below tells the owner the fix is right here.
  const hasApprovedStall =
    event.kind === 'shop' && listStallLinksForShop(event.id).some((l) => l.status === 'approved');
  // Whether the EVENT has any orders at all, independent of the search box.
  // Gating the export on the filtered list made the button vanish the moment a
  // search matched nothing — exactly when someone is most likely to give up and
  // reach for the download instead.
  const hasAnyOrders = query ? listOrders({ eventId: event.id, limit: 1 }).length > 0 : allOrders.length > 0;

  return (
    <>
      <PortalNav
        event={{ id: event.id, name: event.name, slug: event.slug, published: event.status === 'published', kind: event.kind }}
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

      {/* ---- The one thing that needs doing: confirm payments that arrived ----
           Worded around whichever routes this event actually offers. A buyer
           given a PayPal address may well have used it, and an organizer told
           to "check your bank account" would look in one place, not find the
           money, and leave a paid buyer waiting for what they bought. */}
      {awaiting.length > 0 && (
        <div className="card action-card anim-fade-up">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="pulse-dot" aria-hidden />
            {awaiting.length} reservation{awaiting.length === 1 ? '' : 's'} waiting for your confirmation
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>
            Money arrived in {takesPaypal ? 'your bank or PayPal' : 'your bank'}? Tap <strong>Payment received</strong>{' '}
            — the buyer gets their {v.codes} by email.
          </p>
          {/* Said once, here, rather than discovered at the moment somebody is
              staring at a PayPal payment with no reference on it and a box
              demanding one. */}
          {takesPaypal && (
            <p className="muted small" style={{ marginTop: 0 }}>
              PayPal payments have no reference — match them by the sender&rsquo;s <strong>name</strong>.
            </p>
          )}
          {/* The stall counter-confirmation hint (stalls plan §7): a buyer
              standing at the stall whose transfer has not landed yet is not
              stuck — the owner confirms right here and scans a moment later. */}
          {hasApprovedStall && (
            <p className="muted small" style={{ marginTop: 0 }}>
              This works at your stall too: when a buyer is standing in front of you but their payment
              has not landed yet, confirm it here on the spot — their {v.code} is emailed straight away,
              ready to scan at {v.where}.
            </p>
          )}
          <div>
            {awaiting.map((o) => {
              const reference = o.paymentReference;
              return (
                <div key={o.id} className="action-row">
                  <div className="action-row-who">
                    <div style={{ fontWeight: 700 }} translate="no">{o.buyerName}</div>
                    <div className="muted small">
                      {o.itemsSummary} · reserved {o.createdAt.slice(0, 10)}
                    </div>
                    {kitchenLines.get(o.id) && <div className="small" style={{ color: 'var(--amber)' }} translate="no">{kitchenLines.get(o.id)!.line}</div>}
                    {o.buyerPhone && !o.buyerErasedAt && (
                      <a className="small" href={`tel:${o.buyerPhone.replace(/[^\d+]/g, '')}`} translate="no">
                        📞 {o.buyerPhone}
                      </a>
                    )}
                    {/* The buyer told us the money would come from someone
                        else. Worth its own line: an organizer scanning a
                        statement for "Ramesh Thapa" will never find the
                        payment his mother sent. */}
                    {o.payerName.trim() && (
                      <div className="small" style={{ marginTop: 2 }}>
                        Paying as <strong translate="no">{o.payerName.trim()}</strong>
                      </div>
                    )}
                  </div>
                  <div className="action-row-amount">{formatMoney(o.totalCents, o.currency)}</div>
                  <ReferenceTag reference={reference} />
                  <TransferActions
                    orderId={o.id}
                    buyerName={o.buyerName}
                    payerName={o.payerName}
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
          <div className="stat-label">{takesPaypal ? 'Awaiting payment' : 'Awaiting bank transfer'}</div>
          <div className="stat-value">{formatMoney(stats.awaitingTransferCents, event.currency)}</div>
          <div className="stat-sub">
            {stats.awaitingTransferOrders} order{stats.awaitingTransferOrders === 1 ? '' : 's'} ·{' '}
            {stats.awaitingTransferTickets} {stats.awaitingTransferTickets === 1 ? v.unit : v.units}
          </div>
        </div>
        <div className="stat-card anim-fade-up anim-d3">
          <div className="stat-label">{v.Units} sold</div>
          <div className="stat-value">
            {stats.ticketsSold}
            <span className="muted small">/ {event.totalCapacity}</span>
          </div>
        </div>
        <div className="stat-card anim-fade-up anim-d4">
          <div className="stat-label">{v.Redeemed}</div>
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
          placeholder="Search name, email, phone or a bank reference"
          aria-label="Search orders"
        />
        {show !== 'all' && <input type="hidden" name="show" value={show} />}
        <button type="submit" className="btn">
          Search
        </button>
      </form>
      <nav className="ks-presets anim-fade-up anim-d2" aria-label="Show orders" style={{ marginBottom: 16 }}>
        {(
          [
            ['all', 'All'],
            ['todo', 'To confirm'],
            ['paid', 'Paid'],
            ['cancelled', 'Cancelled'],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={`/portal/events/${event.id}/orders${key === 'all' && !query ? '' : `?${new URLSearchParams({ ...(key === 'all' ? {} : { show: key }), ...(query ? { q: query } : {}) }).toString()}`}`}
            className={`ks-chip${show === key ? ' is-on' : ''}`}
            aria-current={show === key ? 'page' : undefined}
          >
            {label} <span className="ord-count">{counts[key]}</span>
          </Link>
        ))}
      </nav>

      {query && (
        <p className="muted small">
          Showing results for &ldquo;<span translate="no">{query}</span>&rdquo; —{' '}
          <Link href={`/portal/events/${event.id}/orders`} style={{ color: 'var(--accent)' }}>
            clear
          </Link>
        </p>
      )}

      <div className={orders.length === 0 ? 'card anim-fade-up anim-d2' : 'anim-fade-up anim-d2'}>
        {orders.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {query
              ? 'No orders match that search.'
              : show !== 'all' && counts.all > 0
                ? 'Nothing here right now.'
                : 'No orders yet — they show up here the moment someone books.'}
          </p>
        ) : (
          /* One card per order: who, how to reach them, what they want and
             when, what they wrote — readable at a glance on a phone at the
             counter, with Call one tap away. */
          <div className="oc-list">
            {orders.map((o) => {
              const reference = o.paymentMode === 'transfer' ? o.paymentReference : null;
              // Erased by the retention sweep (or on the buyer's request): the
              // person is gone — name, contact, payer and their free-text note —
              // and only the seller's arithmetic stays. An order erased before
              // the note was part of erasure may still carry one in the
              // database until the next sweep scrubs it; it never reaches here.
              const erased = Boolean(o.buyerErasedAt);
              const k0 = kitchenLines.get(o.id);
              const k =
                erased && k0?.note
                  ? { ...k0, note: '', line: k0.line.split(' — ').filter((p) => p !== `“${k0.note}”`).join(' — ') }
                  : k0;
              const items = o.itemsSummary.split(/,\s(?=\d+×)/).map((line) => {
                const m = /^(\d+)×\s*(.*)$/.exec(line);
                return m ? { qty: m[1], name: m[2] } : { qty: '', name: line };
              });
              const awaitingPay = o.paymentMode === 'transfer' && o.status === 'claimed';
              const gone = o.status === 'cancelled' || o.status === 'failed';
              const phone = erased ? '' : o.buyerPhone;
              const dial = phone.replace(/[^\d+]/g, '');
              const wa = /^(\+|00)/.test(dial) ? dial.replace(/^\+|^00/, '') : '';
              const initials = erased
                ? ''
                : o.buyerName
                .split(/\s+/)
                .map((w) => w[0] ?? '')
                .join('')
                .slice(0, 2)
                .toUpperCase();
              return (
                <article key={o.id} className={`oc${awaitingPay ? ' oc-todo' : gone ? ' oc-gone' : ''}`}>
                  <header className="oc-top">
                    <span className="oc-avatar" aria-hidden="true" translate="no">
                      {initials || '?'}
                    </span>
                    <div className="oc-who">
                      <strong translate="no">{o.buyerName}</strong>
                      <span className="oc-when">{o.createdAt.slice(5, 16).replace('-', '/').replace(' ', ' · ')} UTC</span>
                    </div>
                    <div className="oc-sum">
                      <span className="oc-total">{formatMoney(o.totalCents, o.currency)}</span>
                      {awaitingPay ? (
                        <span className="badge badge-amber">{takesPaypal ? 'awaiting payment' : 'awaiting transfer'}</span>
                      ) : (
                        <StatusBadge status={o.status} />
                      )}
                      {/* Every demo payment is simulated — no need to say so on each one. */}
                      {o.paymentMode === 'mock' && !organizer.isDemo && <span className="badge badge-amber">test</span>}
                    </div>
                  </header>

                  {(k?.when || k?.table || (k?.line && !k.when && !k.table && !k.note && !k.picks?.length) || k?.stage) && (
                    <div className="oc-chips">
                      {(k.when || k.table || (k.line && !k.note && !k.picks?.length)) && (
                        <p className="oc-slot">
                          {k.table ? `🍽 Table ${k.table}` : k.when ? `🕔 ${k.when}` : `💺 ${k.line}`}
                        </p>
                      )}
                      {/* Where it is in the kitchen, and for how long (lib/kitchen). */}
                      {event.kind === 'shop' && k.stage && (
                        <p className={`oc-stage oc-stage-${k.stage}`}>
                          {{ new: '🆕 New', cooking: '🔥 Cooking', ready: '✅ Ready', done: '🤝 Handed over' }[k.stage]}
                          {k.stageAt && k.stage !== 'done' ? ` · ${minutesSince(k.stageAt)}` : ''}
                        </p>
                      )}
                    </div>
                  )}

                  <ul className="oc-items">
                    {items.map((it, i) => (
                      <li key={i}>
                        {it.qty && <span className="oc-qty">{it.qty}×</span>}
                        <span>{it.name}</span>
                      </li>
                    ))}
                  </ul>
                  {k?.picks && k.picks.length > 0 && <p className="oc-picks">{k.picks.join('  |  ')}</p>}
                  {k?.note && (
                    <blockquote className="oc-note" translate="no">
                      <span aria-hidden="true">💬</span> {k.note}
                    </blockquote>
                  )}
                  {o.payerName.trim() && !erased && (
                    <p className="oc-payer small">
                      Paying as <strong translate="no">{o.payerName.trim()}</strong>
                    </p>
                  )}

                  <div className="oc-contact">
                    {phone ? (
                      <>
                        <a className="oc-call" href={`tel:${dial}`} translate="no">
                          <span aria-hidden="true">📞</span> {phone}
                        </a>
                        {wa && (
                          <a className="oc-btn" href={`https://wa.me/${wa}`} target="_blank" rel="noopener">
                            WhatsApp
                          </a>
                        )}
                      </>
                    ) : erased ? (
                      <span className="oc-nophone muted small">
                        Contact details erased under the privacy policy
                      </span>
                    ) : (
                      <span className="oc-nophone muted small">No phone given</span>
                    )}
                    {!erased && (
                      <a className="oc-btn" href={`mailto:${o.buyerEmail}`} title={o.buyerEmail} translate="no">
                        ✉ {o.buyerEmail}
                      </a>
                    )}
                  </div>

                  <footer className="oc-foot">
                    {reference ? <ReferenceTag reference={reference} /> : <span />}
                    <div className="oc-actions">
                      {o.status === 'paid' ? (
                        // Nothing can be re-sent to an erased buyer: there is
                        // no address left (lib/email refuses it too).
                        erased ? null : <ResendButton orderId={o.id} demo={organizer.isDemo} />
                      ) : awaitingPay ? (
                        <TransferActions
                          orderId={o.id}
                          buyerName={o.buyerName}
                          payerName={o.payerName}
                          amountDisplay={formatMoney(o.totalCents, o.currency)}
                          reference={o.paymentReference}
                        />
                      ) : o.paymentMode === 'transfer' && gone && !erased ? (
                        <TransferActions
                          variant="late"
                          orderId={o.id}
                          buyerName={o.buyerName}
                          payerName={o.payerName}
                          amountDisplay={formatMoney(o.totalCents, o.currency)}
                          reference={o.paymentReference}
                        />
                      ) : null}
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>

      </div>
    </>
  );
}
