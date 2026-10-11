import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import CheckPaymentButton from '@/components/CheckPaymentButton';
import OrganizerWhatsApp from '@/components/OrganizerWhatsApp';
import CopyButton from '@/components/CopyButton';
import PrintButton from '@/components/PrintButton';
import ReviewForm from '@/components/ReviewForm';
import { buyerAccountForOrder, issueCardForOrder } from '@/lib/buyerAccount';
import {
  cropTag,
  getEventById,
  getEventTiers,
  mapsUrl,
  mediaUrl,
  parseCropRect,
  paypalMeUrl,
  paypalPayee,
} from '@/lib/events';
import { isEmailConfigured } from '@/lib/email';
import { currentOrganizer, getOrganizer } from '@/lib/organizers';
import { getSellerIdentity } from '@/lib/sellerIdentity';
import SellerBlock from '@/components/legal/SellerBlock';
import { platformName } from '@/lib/platform';
import { girocodePayload } from '@/lib/girocode';
import { isPaypalMeLink } from '@/lib/paypalLink';
import { formatMoney } from '@/lib/money';
import { getBaseUrl } from '@/lib/config';
import { getOrder, getOrderItems, getTicketsForOrder, paymentReference, referralCode } from '@/lib/orders';
import OrderTracker, { type TrackerStep } from '@/components/OrderTracker';
import { orderPayout } from '@/lib/payout';
import { withAnonymizedBuyer } from '@/lib/retention';
import { getReferralRewardSettings, referralRewardsReachable } from '@/lib/referrals';
import { paymentQrDataUrl } from '@/lib/paymentQr';
import { MAX_REVIEW_CHARS, reviewableItems } from '@/lib/reviews';
import { machineDate } from '@/lib/seo';
import { ticketQrDataUrl } from '@/lib/tickets';
import { vocabFor } from '@/lib/vocab';
import { cityLabel, shortDateLabel } from '@/lib/sameAct';
import { whatsappShareUrl } from '@/lib/whatsapp';
import { armStripeSweep } from '@/lib/stripeOrders';
import { getOrderKitchenDetails, parseSlotConfig, picksLine, slotLabel } from '@/lib/kitchen';
import { parseSeatMap, seatSummary, seatsForOrder } from '@/lib/seats';
import { everyLabel, getSubscription } from '@/lib/subscriptions';

export const dynamic = 'force-dynamic';

// The order page shows buyer details + payment reference — never index it.
export const metadata = { robots: { index: false, follow: false } };

// Fixed-width labels keep the .copy-row values aligned.
const rowLabelStyle = { minWidth: 130 } as const;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const order = getOrder(id);
  if (!order) notFound();

  // The token from the buyer's own confirmation email, if this page was opened
  // from it. It is the ONLY thing on this page that says anything about who is
  // reading — the order id says only that somebody has the link — and it
  // decides the two ACCOUNT-level panels far below. Nothing else uses it.
  const sp = await searchParams;
  const accessToken = (Array.isArray(sp.token) ? sp.token[0] : sp.token) ?? null;

  // What this page may PRINT about the buyer. `order` keeps the real columns
  // for the machinery below (the payment blocks, the card offer, the resend);
  // this is the screen's copy, and after the retention sweep it says 'a past
  // guest' instead of the placeholder that keeps those columns non-null.
  const shown = withAnonymizedBuyer(order);

  // Every order belongs to an event — its name, venue, and bank details all
  // come from there.
  const event = getEventById(order.eventId);
  // An order on a try-it-yourself demo listing (lib/demo.ts) is visible only
  // to the demo account that owns the listing — the same wall as its pages.
  if (event?.isDemo) {
    const viewer = await currentOrganizer();
    if (!viewer || viewer.id !== event.organizerId) notFound();
  }
  const eventVenue = event ? [event.venueName, event.city].filter(Boolean).join(', ') : '';
  /**
   * "Heidelberg · Sat 10 Oct" — the two facts a buyer has to carry with them.
   *
   * This page is what somebody reopens on the night, and what they scroll back
   * to when a friend asks which show they got. Both were previously only
   * available inside a grey line built out of the organizer's free-text date
   * and the full postal address.
   */
  const eventPlace = event
    ? [event.kind === 'shop' ? '' : cityLabel(event.city), shortDateLabel(event)]
        .filter(Boolean)
        .join(' · ')
    : '';
  const checkoutHref = event ? `/e/${event.slug}/checkout` : '/';
  const v = vocabFor(event?.kind ?? 'event');

  // What this order IS, bundle-aware: quantities count BOOKINGS, and a
  // "2× Table of 8" line has to say somewhere that sixteen QR tickets come out
  // of it — on this page and in the pending state below, where no ticket grid
  // exists yet to make the count obvious.
  const orderItems = getOrderItems(order.id);
  const orderTiers = event ? getEventTiers(event.id) : [];
  const tierFor = (tierId: string) => orderTiers.find((t) => t.tierKey === tierId) ?? null;
  const totalTickets = orderItems.reduce(
    (s, it) => s + it.quantity * (tierFor(it.tierId)?.seatsPerUnit ?? 1),
    0
  );
  const hasBundle = orderItems.some((it) => (tierFor(it.tierId)?.seatsPerUnit ?? 1) > 1);
  // Restaurant pack (lib/kitchen): the collection time or table, and the
  // choices made for each item, shown back exactly as the kitchen sees them.
  const kitchenInfo = getOrderKitchenDetails(order.id);
  const itemsLine = orderItems
    .map((it) => {
      const picks = picksLine(kitchenInfo.choices, it.tierId);
      return `${it.quantity}× ${tierFor(it.tierId)?.name ?? it.tierId}${picks ? ` (${picks})` : ''}`;
    })
    .join(', ');
  // Reserved seating (lib/seats): which seats this order holds.
  const orderSeats = seatsForOrder(order.id);
  const seatMapForOrder = event ? parseSeatMap(event.seatMap) : null;
  const seatsBlock =
    orderSeats.length > 0 ? (
      <div className="notice anim-fade-up" style={{ marginTop: 0 }}>
        <strong>Your seats:</strong> {seatSummary(orderSeats, seatMapForOrder)}
      </div>
    ) : null;
  // Subscribe & save (lib/subscriptions): this order is part of a standing order.
  const sub = order.subscriptionId ? getSubscription(order.subscriptionId) : null;
  const subscriptionBlock = sub ? (
    <div className="notice anim-fade-up" style={{ marginBottom: 14 }}>
      <strong>Subscribe &amp; save {sub.discountPct}%</strong> — this order repeats {everyLabel(sub.everyDays)}
      {sub.status === 'active' ? `, next on ${sub.nextOn}` : ` (${sub.status})`}.{' '}
      <Link href={`/subscription/${sub.token}`} className="inline-link">
        Skip, pause or cancel →
      </Link>
    </div>
  ) : null;
  // A shop order to collect (not an appointment): the live tracker — where it
  // is, since when, and where to pick it up (components/OrderTracker).
  const tracked =
    event?.kind === 'shop' &&
    parseSlotConfig(event.pickupSlots).purpose !== 'appointment' &&
    (order.status === 'paid' || order.status === 'claimed');
  let trackerBlock: React.ReactNode = null;
  if (tracked && event) {
    const codes = getTicketsForOrder(order.id);
    const scanned = codes.length > 0 && codes.every((t) => t.checkedInAt);
    const collectedAt = scanned
      ? codes.map((t) => t.checkedInAt as string).sort().at(-1) ?? null
      : kitchenInfo.handedAt;
    const paid = order.status === 'paid';
    const st = kitchenInfo.kitchenStatus;
    const atTable = Boolean(kitchenInfo.tableLabel);
    // A shop with pickup times cooks (the kitchen pack); any other packs goods.
    const cooks = parseSlotConfig(event.pickupSlots).enabled || atTable || event.category === 'khaja-food';
    const steps: TrackerStep[] = [
      { label: 'Ordered', at: order.createdAt, done: true },
      { label: paid ? 'Paid' : 'Waiting for your payment', at: order.paidAt, done: paid },
      { label: cooks ? 'Being prepared' : 'Being packed', at: kitchenInfo.cookingAt, done: paid && (st !== 'new' || scanned) },
      {
        label: atTable ? 'Ready — on its way to your table' : 'Ready to collect',
        at: kitchenInfo.readyAt,
        done: paid && (st === 'ready' || st === 'done' || scanned),
      },
      { label: atTable ? 'Served' : 'Collected', at: collectedAt, done: paid && (st === 'done' || scanned) },
    ];
    const reached = steps.reduce((i, x, k) => (x.done ? k : i), 0);
    const headline = [
      'Order received — waiting for payment',
      cooks ? 'Paid — the kitchen has your order' : 'Paid — the shop has your order',
      cooks ? 'Being prepared' : 'Being packed',
      atTable ? 'Ready — coming to your table' : 'Ready! Show your code at the counter',
      atTable ? 'Served — enjoy!' : 'Collected — enjoy!',
    ][reached];
    trackerBlock = (
      <OrderTracker
        steps={steps}
        headline={headline}
        place={atTable ? '' : [event.venueName, event.address, event.city].filter(Boolean).join(', ')}
        mapsHref={atTable ? null : mapsUrl(event)}
      />
    );
  }

  const kitchenBlock =
    kitchenInfo.tableLabel || kitchenInfo.pickupSlot || kitchenInfo.note ? (
      <div className="notice anim-fade-up" style={{ marginTop: 0 }}>
        {kitchenInfo.tableLabel ? (
          <strong>Table {kitchenInfo.tableLabel} — we bring it to you.</strong>
        ) : kitchenInfo.pickupSlot ? (
          <strong>
            {event && parseSlotConfig(event.pickupSlots).purpose === 'appointment' ? 'Appointment' : 'Collect'}:{' '}
            {slotLabel(kitchenInfo.pickupSlot)}
          </strong>
        ) : null}
        {tracked ? null : kitchenInfo.kitchenStatus === 'ready' && order.status === 'paid' ? (
          <span className="badge badge-green" style={{ marginLeft: 8 }}>
            Ready now
          </span>
        ) : kitchenInfo.kitchenStatus === 'cooking' && order.status === 'paid' ? (
          <span className="badge badge-amber" style={{ marginLeft: 8 }}>
            Being prepared
          </span>
        ) : null}
        {kitchenInfo.note ? <div className="small muted">Your note: “<span translate="no">{kitchenInfo.note}</span>”</div> : null}
      </div>
    ) : null;

  // Reaching the organizer matters most on THIS page: it is where a buyer is
  // looking at a stranger's IBAN and deciding whether to send real money to it.
  // The one person who can settle that is the organizer whose account it is.
  const organizer = event ? getOrganizer(event.organizerId) : null;
  // The seller of record, named on every state of this page that is about
  // paying or holding what was bought: their legal identity once filled in,
  // their account name until then.
  const seller = event ? getSellerIdentity(event.organizerId) : null;
  const sellerBlock = event ? (
    <SellerBlock
      seller={seller}
      kind={event.kind === 'shop' ? 'shop' : 'event'}
      platformName={platformName()}
      fallback
    />
  ) : null;

  // Offered while the order is still awaiting payment too, not only once paid —
  // people block the evening out the moment they reserve. Only for event-kind
  // orders with a machine date (shops have no date, and free-text dateDisplay
  // is never parsed — see machineDate in lib/seo), and only while published,
  // because the calendar route answers 404 for everything else.
  const calendarHref =
    event && event.status === 'published' && event.kind === 'event' && machineDate(event)
      ? `/api/events/${event.id}/calendar`
      : null;
  const organizerWhatsApp = event ? (
    <OrganizerWhatsApp
      number={event.whatsapp}
      organizerName={event.whatsappName || organizer?.name?.trim() || 'the organizer'}
      eventName={event.name}
      photoUrl={
        event.whatsappPhoto ||
        (event.profileMediaId
          ? mediaUrl(event.profileMediaId, 'avatar', cropTag(parseCropRect(event.profileCrop)))
          : null)
      }
      photoFocus={event.whatsappPhoto ? event.whatsappFocus : null}
    />
  ) : null;

  // A Stripe order is paid on Stripe's page, out of our sight — somebody has
  // to keep looking for the buyer who paid and never came back.
  if (order.paymentMode === 'stripe') armStripeSweep();

  if (order.status === 'capturing' && order.paymentMode !== 'stripe') {
    return (
      <div className="container container-narrow section">
        <h1 className="page-title anim-fade-up">Your order</h1>
        <div className="notice notice-warn anim-fade-up anim-d1">
          We&rsquo;re confirming your payment with PayPal. Refresh this page in a minute — if you completed the
          payment, your {v.codes} will appear here. If it didn&rsquo;t go through, you have not been charged.
        </div>
        <div className="anim-fade-up anim-d2">
          <CheckPaymentButton orderId={order.id} />
        </div>
      </div>
    );
  }

  if (
    order.paymentMode === 'stripe' &&
    (order.status === 'claimed' || order.status === 'capturing' || order.status === 'pending')
  ) {
    // Not paid yet, as far as we know. The buyer either left Stripe's page
    // without paying (the cancel link brings them here), or paid and Stripe
    // has not been asked since — the button asks now. The order holds its
    // seats only as long as Stripe's own page stays open (30 minutes).
    const cancelled = (Array.isArray(sp.stripe) ? sp.stripe[0] : sp.stripe) === 'cancelled';
    return (
      <div className="container container-narrow section">
        <h1 className="page-title anim-fade-up">Your order</h1>
        {event ? (
          <div className="checkout-for anim-fade-up" style={{ marginTop: -8 }}>
            <div className="checkout-for-name">{event.name}</div>
            <div className="muted small">{[event.dateDisplay, eventVenue].filter(Boolean).join(' · ')}</div>
          </div>
        ) : null}
        <div className={`notice ${cancelled ? 'notice-warn' : ''} anim-fade-up anim-d1`}>
          {cancelled ? (
            <>
              <strong>Payment not completed — you have not been charged.</strong> Your {v.units} are still held
              for a little while; you can finish paying below, or simply leave this page and they go back on sale.
            </>
          ) : (
            <>
              <strong>Your card payment has not been confirmed yet.</strong> If you just paid, press the button
              below and your {v.codes} will appear. If you did not finish, you have not been charged.
            </>
          )}
        </div>
        <div className="anim-fade-up anim-d2" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {order.stripeSessionUrl && (
            <a className="btn btn-brand" href={order.stripeSessionUrl}>
              Finish paying {formatMoney(order.totalCents, order.currency)} by card →
            </a>
          )}
          <CheckPaymentButton orderId={order.id} />
        </div>
        <p className="muted small anim-fade-up anim-d3" style={{ marginTop: 14 }}>
          The payment goes to {seller?.displayName || organizer?.name?.trim() || 'the seller'} directly — the card page is run by Stripe on
          their own account, and {'the platform'} never sees your card details.
        </p>
        {sellerBlock}
      </div>
    );
  }

  if (order.paymentMode === 'transfer' && (order.status === 'claimed' || order.status === 'pending')) {
    // What THIS order was told to pay, frozen when it was created — never the
    // event's current details. An organizer who changes their IBAN afterwards
    // must not be able to rewrite the instructions this buyer already has, and
    // an attacker who changes it must not be able to redirect a payment that
    // was promised to somebody else.
    const payout = orderPayout(order, event);
    const bank =
      payout.iban.trim() && payout.holder.trim()
        ? {
            accountHolder: payout.holder,
            iban: payout.iban,
            bic: payout.bic,
            bankName: payout.bankName,
            payWithinDays: event?.payWithinDays ?? 5,
          }
        : null;
    const paypal = paypalPayee({ paypalAccount: payout.paypal });
    const reference = paymentReference(order.id);
    const isStudentOrder = reference.includes('-S-');
    const amountPlain = (order.totalCents / 100).toFixed(2);
    const amountDisplay = formatMoney(order.totalCents, order.currency);
    const deadline = bank
      ? new Date(Date.parse(order.createdAt.replace(' ', 'T') + 'Z') + bank.payWithinDays * 86_400_000)
      : null;
    const deadlineDisplay = deadline?.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // The whole transfer, encoded so a banking app can fill its own form: payee,
    // IBAN, amount, and — the part people get wrong — the reference. Built from
    // the SAME frozen payout snapshot the text below shows, never from the
    // event's current details, so the code and the printed IBAN can never
    // disagree about where the money goes.
    const giroQr = await paymentQrDataUrl(
      bank
        ? girocodePayload({
            accountHolder: bank.accountHolder,
            iban: bank.iban,
            bic: bank.bic,
            amountCents: order.totalCents,
            currency: order.currency,
            reference,
          })
        : null,
    );

    // PayPal's equivalent, and deliberately the weaker one: a PayPal.Me link
    // carries the amount but has nowhere to put the reference, so the buyer
    // still types that in by hand. Only exists at all when the organizer gave a
    // PayPal.Me link rather than a plain address.
    // The URL itself, not only its QR. The QR is for someone reading this on a
    // laptop with a phone in hand; most people open this page ON the phone, and
    // cannot scan their own screen — they need something to TAP.
    const paypalPayUrl = paypalMeUrl(paypal, order.totalCents, order.currency);
    // False for a PayPal app QR link: it opens the organizer's PayPal but
    // cannot carry the amount, so the buyer is told to type it.
    const paypalHasAmount = Boolean(paypal?.link && isPaypalMeLink(paypal.link));
    const paypalQr = await paymentQrDataUrl(paypalPayUrl);

    return (
      <div className="container container-narrow section">
        <h1 className="page-title anim-fade-up">Your reservation</h1>
        {event ? (
          <div className="checkout-for anim-fade-up" style={{ marginTop: -8 }}>
            <div className="checkout-for-name">{event.name}</div>
            {eventPlace ? <div className="checkout-for-place">{eventPlace}</div> : null}
            <div className="muted small">
              {[event.dateDisplay, eventVenue].filter(Boolean).join(' · ')}
            </div>
          </div>
        ) : null}
        {subscriptionBlock}
        {trackerBlock}
      {kitchenBlock}
        {seatsBlock}
        {itemsLine ? (
          <p className="muted small anim-fade-up" style={{ margin: '-8px 0 16px' }}>
            {itemsLine}
            {/* Only bundles need the translation to tickets — for ordinary
                orders the quantities already are the ticket count. */}
            {hasBundle ? ` — ${totalTickets} QR ${totalTickets === 1 ? v.code : v.codes} once paid` : ''}
          </p>
        ) : null}
        <div className="notice notice-success anim-fade-up anim-d1">
          Your tickets are reserved — the seats are being held for you.{' '}
          {paypal ? 'One payment' : 'One bank transfer'}
          {deadlineDisplay ? (
            <>
              {' '}by <strong>{deadlineDisplay}</strong>
            </>
          ) : null}{' '}
          and they&rsquo;re yours.
        </div>

        <div className="card anim-fade-up anim-d2">
          <h2 className="card-title">What happens next</h2>
          <ol className="step-list" style={{ margin: 0 }}>
            <li className="step-item">
              <span className="step-num">1</span>
              <div>
                <div className="tier-name">
                  {paypal ? 'Send the money — bank transfer or PayPal' : 'Send the bank transfer'}
                </div>
                <p className="muted small" style={{ margin: '2px 0 0' }}>
                  {paypal
                    ? 'Use either set of details below — whichever suits you. Both go to the organizer, and both need your personal reference included.'
                    : 'Use the details below in any bank app — and make sure your personal reference is included.'}
                </p>
              </div>
            </li>
            <li className="step-item">
              <span className="step-num">2</span>
              <div>
                <div className="tier-name">The organizer confirms your payment</div>
                {/* Since October 2025 every euro-area bank must offer instant
                    transfers, settle them in ten seconds, and charge no more
                    than for a normal one. But it is opt-in: the buyer has to
                    pick it, and nothing in a GiroCode can pick it for them. So
                    the only place that choice can be prompted is here. */}
                <p className="muted small" style={{ margin: '2px 0 0' }}>
                  {paypal
                    ? 'PayPal arrives within minutes. A bank transfer takes 1–2 business days — or seconds, if you choose “instant” (“Echtzeit”) in your banking app, which your bank cannot charge extra for. Once yours lands, the organizer sees it on their statement and confirms it.'
                    : 'A transfer takes 1–2 business days — or seconds, if you choose “instant” (“Echtzeit”) in your banking app, which your bank cannot charge extra for. Once yours lands, the organizer sees it on their statement and confirms it.'}
                </p>
              </div>
            </li>
            <li className="step-item">
              <span className="step-num">3</span>
              <div>
                <div className="tier-name">Your QR tickets arrive</div>
                <p className="muted small" style={{ margin: '2px 0 0' }}>
                  They&rsquo;re emailed to <strong translate="no">{shown.buyerEmail}</strong> and appear right
                  here on this page.
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* The same money, the same person, the same reference — just a second
            way to send it. Deliberately built like the bank box rather than as
            a PayPal checkout: a checkout would collect into the platform's
            merchant account, and every promise on this site says the money goes
            straight to the organizer. */}
        {paypal ? (
          <div className="bank-box pay-fast anim-fade-up anim-d3" style={{ margin: '16px 0' }}>
            <div className="card-title">
              Send {amountDisplay} by PayPal <span className="badge badge-green">Fastest</span>
            </div>
            <p className="muted small" style={{ margin: '0 0 10px' }}>
              Arrives in seconds, so the organizer can confirm it and send your QR tickets straight
              away{bank ? ' — a bank transfer takes 1–2 business days' : ''}.
            </p>
            {paypalQr ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 16,
                  margin: '4px 0 16px',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={paypalQr}
                  alt={paypalHasAmount ? `PayPal.Me link for ${amountDisplay}` : 'The organizer’s PayPal QR code'}
                  width={160}
                  height={160}
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                    background: '#fff',
                    padding: 6,
                    flex: '0 0 auto',
                  }}
                />
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <strong style={{ display: 'block', marginBottom: 4 }}>
                    {paypalHasAmount
                      ? 'Open PayPal with the amount filled in'
                      : `Open the organizer’s PayPal and send ${amountDisplay}`}
                  </strong>
                  {/* The tap and the scan are the same link. Which one is
                      useful depends only on which device this page is open on,
                      so both are offered rather than making the phone reader —
                      who cannot scan their own screen — hunt for the address
                      further down and type the amount in by hand. */}
                  {paypalPayUrl ? (
                    <a
                      href={paypalPayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ margin: '0 0 8px' }}
                    >
                      Pay {amountDisplay} with PayPal →
                    </a>
                  ) : null}
                  <p className="muted small" style={{ margin: 0 }}>
                    Or scan the code. Unlike a bank transfer, PayPal has no field a link can put the
                    reference in — so please still type <span className="mono">{reference}</span> into
                    the message box yourself. Without it the organizer cannot tell whose payment it is.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="copy-row">
              <span className="muted small" style={rowLabelStyle}>
                Amount
              </span>
              <strong>{amountDisplay}</strong>
              <CopyButton value={amountPlain} />
            </div>
            {/* The amount above is already the discounted one — total_cents IS
                what is owed — so this only explains why it is lower, and must
                never read as something still to subtract. */}
            {order.discountCents > 0 ? (
              <p className="muted small" style={{ margin: '0 0 10px' }}>
                {order.subscriptionId ? (
                  <>Subscribe &amp; save — </>
                ) : (
                  <>
                    Code <span className="mono">{order.voucherCode}</span> applied —{' '}
                  </>
                )}
                {formatMoney(order.discountCents, order.currency)} off the organizer&rsquo;s own price.
                Transfer the amount above and nothing else.
              </p>
            ) : null}
            <div className="copy-row">
              <span className="muted small" style={rowLabelStyle}>
                PayPal
              </span>
              {/* Only a recognised PayPal.Me link ever becomes an href — see
                  paypalPayee(). Anything else is shown as text to copy. */}
              {paypal.link ? (
                <a
                  href={paypal.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--brand-text)', fontWeight: 600, wordBreak: 'break-all' }}
                  translate="no"
                >
                  {paypal.handle}
                </a>
              ) : (
                <span className="mono" style={{ wordBreak: 'break-all' }}>
                  {paypal.handle}
                </span>
              )}
              <CopyButton value={paypal.handle} />
            </div>
            <div
              className="copy-row"
              style={{
                borderColor: 'rgba(139, 92, 246, 0.6)',
                background: 'rgba(139, 92, 246, 0.1)',
              }}
            >
              <span className="muted small" style={rowLabelStyle}>
                Reference
              </span>
              <span
                className="mono"
                style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.05em' }}
              >
                {reference}
              </span>
              {isStudentOrder ? <span className="badge badge-student">Student order</span> : null}
              <CopyButton value={reference} />
            </div>
            <p className="muted small" style={{ margin: '12px 0 0' }}>
              Send the amount to that PayPal address and put the reference{' '}
              <span className="mono">{reference}</span> in PayPal&rsquo;s message field — it is how the
              organizer matches your payment to your tickets, exactly as with a bank transfer. Pay
              either way, not both.
            </p>
          </div>
        ) : null}

        {bank ? (
          <div className="bank-box anim-fade-up anim-d3" style={{ margin: '16px 0' }}>
            <div className="card-title">{paypal ? `Or transfer ${amountDisplay} to` : `Transfer ${amountDisplay} to`}</div>
            {giroQr ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 16,
                  margin: '4px 0 16px',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={giroQr}
                  alt={`GiroCode to transfer ${amountDisplay} with reference ${reference}`}
                  width={160}
                  height={160}
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                    background: '#fff',
                    padding: 6,
                    flex: '0 0 auto',
                  }}
                />
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <strong style={{ display: 'block', marginBottom: 4 }}>
                    Scan this in your banking app
                  </strong>
                  <p className="muted small" style={{ margin: 0 }}>
                    It fills in the account, the amount and the reference for you — nothing to type,
                    nothing to mistype. Sparkasse, Volksbank, Deutsche Bank, Postbank, Commerzbank,
                    comdirect, DKB and ING all read it.
                  </p>
                  {/* A GiroCode is plain text, not a link, so there is nothing for
                      a phone to hand to its banking app — a buyer cannot scan a
                      code on the screen they are holding. Several banks do accept
                      the code as an imported image, which is the only same-device
                      route that actually works; the copy buttons below are the
                      other. Both beat retyping an IBAN. */}
                  <p className="muted small" style={{ margin: '6px 0 0' }}>
                    On the same phone as your banking app? Screenshot this and import it there (many
                    apps offer a photo transfer), or just use the details below — they say exactly the
                    same thing.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="copy-row">
              <span className="muted small" style={rowLabelStyle}>
                Amount
              </span>
              <strong>{amountDisplay}</strong>
              <CopyButton value={amountPlain} />
            </div>
            {/* The amount above is already the discounted one — total_cents IS
                what is owed — so this only explains why it is lower, and must
                never read as something still to subtract. */}
            {order.discountCents > 0 ? (
              <p className="muted small" style={{ margin: '0 0 10px' }}>
                {order.subscriptionId ? (
                  <>Subscribe &amp; save — </>
                ) : (
                  <>
                    Code <span className="mono">{order.voucherCode}</span> applied —{' '}
                  </>
                )}
                {formatMoney(order.discountCents, order.currency)} off the organizer&rsquo;s own price.
                Transfer the amount above and nothing else.
              </p>
            ) : null}
            <div className="copy-row">
              <span className="muted small" style={rowLabelStyle}>
                Account holder
              </span>
              <span translate="no">{bank.accountHolder}</span>
            </div>
            <div className="copy-row">
              <span className="muted small" style={rowLabelStyle}>
                IBAN
              </span>
              <span className="mono">{bank.iban}</span>
              <CopyButton value={bank.iban} />
            </div>
            {bank.bic ? (
              <div className="copy-row">
                <span className="muted small" style={rowLabelStyle}>
                  BIC
                </span>
                <span className="mono">{bank.bic}</span>
              </div>
            ) : null}
            {bank.bankName ? (
              <div className="copy-row">
                <span className="muted small" style={rowLabelStyle}>
                  Bank
                </span>
                <span>{bank.bankName}</span>
              </div>
            ) : null}
            <div
              className="copy-row"
              style={{
                borderColor: 'rgba(139, 92, 246, 0.6)',
                background: 'rgba(139, 92, 246, 0.1)',
              }}
            >
              <span className="muted small" style={rowLabelStyle}>
                Reference
              </span>
              <span
                className="mono"
                style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.05em' }}
              >
                {reference}
              </span>
              {isStudentOrder ? <span className="badge badge-student">Student order</span> : null}
              <CopyButton value={reference} />
            </div>
            <p className="muted small" style={{ margin: '12px 0 0' }}>
              The reference is the important part: put it in your transfer&rsquo;s purpose line
              (&ldquo;Verwendungszweck&rdquo;) exactly as shown — it&rsquo;s how the organizer
              matches your payment to your tickets.
            </p>
            {isStudentOrder ? (
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                The &ldquo;-S-&rdquo; in your reference marks this as a student order — please
                bring a valid student ID to the entrance.
              </p>
            ) : null}
          </div>
        ) : paypal ? null : (
          <div className="notice notice-error anim-fade-up anim-d3">
            Payment details are not available right now — please contact the organizer.
          </div>
        )}


        {deadlineDisplay ? (
          <div className="notice notice-warn anim-fade-up anim-d4">
            Please send your transfer by <strong>{deadlineDisplay}</strong> — after that the
            reservation expires and the seats are released for other guests. A transfer sent in
            time but still on its way will not lose your seats.
          </div>
        ) : null}

        {calendarHref ? (
          <p className="anim-fade-up anim-d4" style={{ margin: '16px 0' }}>
            <a href={calendarHref} className="btn btn-sm">
              Add to calendar
            </a>
          </p>
        ) : null}

        <p className="muted small anim-fade-up anim-d4">
          Tip: bookmark this page — your tickets will appear here the moment your payment is
          confirmed. These instructions have been emailed to you as well.
        </p>
        <p className="mono small muted">Order ID: {order.id}</p>
        {sellerBlock}
        {organizerWhatsApp}
      </div>
    );
  }

  if (order.status === 'pending' || order.status === 'claimed') {
    return (
      <div className="container container-narrow section">
        <h1 className="page-title anim-fade-up">Your order</h1>
        <div className="notice notice-warn anim-fade-up anim-d1">
          This order hasn&rsquo;t been paid yet. You can finish it at checkout — nothing has been
          charged so far.
        </div>
        <div
          className="anim-fade-up anim-d2"
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}
        >
          <Link href={checkoutHref} className="btn btn-primary">
            Return to checkout
          </Link>
          {order.paymentMode === 'paypal' && order.paypalOrderId ? <CheckPaymentButton orderId={order.id} /> : null}
        </div>
      </div>
    );
  }

  if (order.status === 'failed' || order.status === 'cancelled') {
    if (order.paymentMode === 'transfer') {
      return (
        <div className="container container-narrow section">
          <h1 className="page-title anim-fade-up">Your order</h1>
          <div className="notice notice-error anim-fade-up anim-d1">
            This reservation has expired or been cancelled, and its seats have been released.
          </div>
          <p className="muted anim-fade-up anim-d2">
            If you already sent your bank transfer, don&rsquo;t worry — contact the organizer with
            your order ID <span className="mono">{order.id}</span> and you&rsquo;ll receive your
            tickets (if seats are still available) or a full refund.
          </p>
          {sellerBlock}
          <p className="anim-fade-up anim-d3">
            <Link href={checkoutHref} className="btn btn-primary">
              Book again at checkout
            </Link>
          </p>
        </div>
      );
    }
    return (
      <div className="container container-narrow section">
        <h1 className="page-title anim-fade-up">Your order</h1>
        <div className="notice notice-error anim-fade-up anim-d1">
          This order was not completed. You have not been charged.
        </div>
        <p className="anim-fade-up anim-d2">
          <Link href={checkoutHref} className="btn btn-primary">
            Try again at checkout
          </Link>
        </p>
      </div>
    );
  }

  // status === 'paid'
  const items = orderItems;
  const tierName = (tierId: string) => tierFor(tierId)?.name ?? tierId;
  const tickets = await Promise.all(
    getTicketsForOrder(order.id).map(async (t) => ({ ...t, qr: await ticketQrDataUrl(t.code) }))
  );

  const isFreeOrder = order.paymentMode === 'free';
  // The one moment a buyer is happiest is the moment they hold their codes —
  // and they are standing in exactly the WhatsApp groups the next buyers are
  // in. One pre-written tap; WhatsApp's own picker chooses who hears it.
  //
  // ?ref= is this buyer's own referral code (the order's random share_code —
  // see lib/orders referralCode — NEVER the payment reference's short id,
  // which support treats as weak proof of owning the order and so must not be
  // broadcast), so the organizer's insights can see who brought friends.
  // Analysis only, no reward. Pre-share_code orders have no code — their link
  // simply carries no ref. The TEXT here and in the ticket email must stay
  // word-for-word identical — change one, change both.
  const refCode = referralCode(order);
  const shareEventUrl = event ? `${getBaseUrl()}/e/${event.slug}${refCode ? `?ref=${refCode}` : ''}` : null;
  const shareUrl =
    event && event.status === 'published'
      ? whatsappShareUrl(
          isFreeOrder
            ? `I'm going to ${event.name} — it's free! Reserve your spot: ${shareEventUrl}`
            : `I just got my tickets for ${event.name}! Get yours: ${shareEventUrl}`
        )
      : null;

  // The same invitation as a QR, for the times a link cannot be sent: hold the
  // phone up, a friend scans it, and they are on the listing with this buyer's
  // referral code already attached.
  //
  // WHY THIS IS A SECOND, SEPARATE QR and not the ones on the tickets below: a
  // ticket QR encodes a TICKET CODE, which is a private, single-use identifier
  // — the seller scans it at the door, and anybody who photographs it can walk
  // in on this buyer's seat. This one encodes nothing but a PUBLIC URL that
  // anyone may open. One is an identifier to guard, the other is an invitation
  // to broadcast, so they can never be the same image, and the labels on the
  // page say which is which.
  //
  // Only on a published listing with a code to carry — a QR pointing at a page
  // nobody else can open, or carrying no referral at all, is not worth showing.
  const referralQr =
    refCode && shareEventUrl && event && event.status === 'published'
      ? await ticketQrDataUrl(shareEventUrl)
      : null;

  // ---- Everything below belongs to the ADDRESS, not to this order ---------
  //
  // The referral vouchers this buyer holds and the code of their customer card
  // are keyed off orders.buyer_email — and that column is an unverified claim:
  // POST /api/orders only format-checks the address and hands the new order id
  // straight back, so anybody can mint an order carrying anybody's address and
  // then open its page. So a page reached with nothing but the order id shows
  // NONE of it; the one key is the token from the buyer's own confirmation
  // email. See lib/buyerAccount.ts, which is the only door to these reads and
  // holds the rest of the reasoning (including why an erased buyer, an unpaid
  // order, or a listing where rewards can never be earned all come back shut).
  const account = buyerAccountForOrder(order, accessToken);
  const rewards = account.rewards;
  const existingCard = account.card;
  const sellerName = organizer?.name?.trim() || 'The organizer';

  // The card is a card WITH somebody — no organizer row, nobody to hold it.
  const cardOfferable = account.cardPossible && Boolean(organizer);

  // Whether this seller thanks referrers at all, and whether the thank-you is
  // reachable on this listing. Their own PUBLIC promise — the same thing the
  // listing page shows every visitor before anybody buys — so reading it says
  // nothing about the buyer. It decides only whether the explainer below
  // mentions vouchers: telling somebody their codes are in their inbox, on a
  // listing that hands out none, would be a worse lie than the missing panel.
  const rewardsOffered =
    event !== null &&
    referralRewardsReachable(orderTiers) &&
    getReferralRewardSettings(event.organizerId).enabled;

  // Whether this deployment can post the mail that carries the access token at
  // all. The token reaches a buyer by exactly one road (lib/orders.ts), so on a
  // server with no SMTP the account panels are not "one tap away" — they are
  // unreachable, and promising a message that will never be sent is the one
  // thing this explainer must not do. The gate stays shut either way: an
  // undeliverable email is not a reason to show one person's codes to another.
  //
  // It answers the deployment question only. A configured server whose provider
  // rejects the send (a dead From domain, a suspended account) still reads true
  // here, which is why the wording below never claims a mail ARRIVED — it names
  // the road the link travels and sends anyone who cannot find it to the seller.
  const mailConfigured = isEmailConfigured();

  // ---- What this buyer may review, and whether they may review at all ------
  //
  // Three conditions, and the token is the one that matters. A shop's own
  // seller can read every order id it has ever taken out of their portal, so
  // "knows the order id" would let them post five stars on their own goods all
  // afternoon. The token is an HMAC that only travels in the mail sent to
  // orders.buyer_email, and account.mailboxProven is the answer this page has
  // ALREADY worked out from it a few lines above — asking verifyOrderAccessToken
  // a second time here would be a second place for the rule to drift, and it
  // would also skip the axes buyerAccountForOrder fails closed on (an unpaid
  // order, an erased buyer whose byline no longer belongs to anybody).
  //
  // The raw token still has to be passed down, because the form POSTs it back
  // and /api/reviews checks it again — a rendered form is not authority.
  //
  // Shops only: an event's ticket tiers are not goods, and a star rating under
  // "Standard ticket" would be a review of somebody's evening. reviewableItems
  // enforces that itself and returns [] either way; the kind check here just
  // saves the read on the far commoner case.
  const reviewToken = event?.kind === 'shop' && account.mailboxProven ? accessToken : null;
  const reviewable = reviewToken ? reviewableItems(order.id) : [];

  /**
   * Create the card, because the buyer pressed the button asking for one.
   *
   * Both fields are transport, not authority: issueCardForOrder re-reads the
   * order and re-checks the token itself, so a hand-made POST issues nothing
   * without proof of the mailbox on the order it names. See there for why the
   * token — not the rendered form — has to be what decides it.
   */
  async function keepCard(formData: FormData) {
    'use server';
    const orderId = String(formData.get('orderId') ?? '');
    const token = String(formData.get('token') ?? '');
    if (!issueCardForOrder(orderId, token)) return;
    // Straight back to this page, which now shows the link to the card rather
    // than the offer — one POST, one visible result. The token rides along, or
    // the buyer would land back on a page that has shut its own panels.
    redirect(`/order/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`);
  }

  return (
    <div className="container section">
      <h1 className="page-title anim-fade-up">{event?.kind === 'shop' ? 'Your order' : 'Your tickets'}</h1>
      {/* Where and when, above the QR codes rather than below them: this is the
          page somebody reopens on the night. */}
      {event ? (
        <div className="checkout-for anim-fade-up" style={{ marginTop: -8 }}>
          <div className="checkout-for-name">{event.name}</div>
          {eventPlace ? <div className="checkout-for-place">{eventPlace}</div> : null}
          <div className="muted small">
            {[event.dateDisplay, eventVenue].filter(Boolean).join(' · ')}
          </div>
        </div>
      ) : null}
      <div className="notice notice-success anim-fade-up anim-d1">
        {/* "confirmed", not "received": the money went to the organizer, and the
            organizer confirming it is the event this banner reports — the ticket
            email says it the same way. */}
        {isFreeOrder
          ? "You're on the list — reservation confirmed. See you there!"
          : event?.kind === 'shop'
            ? 'Payment confirmed — you’re all set. Show the code below when you collect.'
            : 'Payment confirmed — you’re all set. See you at the show!'}
      </div>
      {trackerBlock}
      {kitchenBlock}
      {seatsBlock}
      {event?.kind === 'shop' && itemsLine ? <p className="muted small anim-fade-up">{itemsLine}</p> : null}
      {shareUrl && (
        <p className="anim-fade-up anim-d1" style={{ margin: '0 0 16px' }}>
          {/* noreferrer as well as noopener now that this page's URL can carry
              the order access token: browsers already trim the query string
              out of a cross-origin Referer by default, and this makes the
              token's confinement to the buyer's inbox not depend on that
              default. The PayPal links above are spelled the same way. */}
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="btn btn-green">
            {isFreeOrder ? "Tell your friends — I'm going →" : 'Tell your friends on WhatsApp →'}
          </a>
        </p>
      )}

      {/* The share button's other half, for when you are standing next to the
          person instead of messaging them. Deliberately labelled against the
          ticket QRs further down — see the comment where referralQr is built:
          one of these images is a private identifier, the other is a public
          invitation, and a buyer must never have to guess which. */}
      {referralQr && shareEventUrl ? (
        <div className="card anim-fade-up anim-d1 no-print">
          <div className="card-title">Your referral QR — for your friends to scan</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={referralQr}
              alt="QR code that opens this listing with your referral link"
              width={180}
              height={180}
              style={{ borderRadius: 12 }}
            />
            <div style={{ flex: 1, minWidth: 220 }}>
              <p className="muted small" style={{ marginTop: 0 }}>
                Hold your phone up and a friend scans this with their camera. It opens{' '}
                {event ? event.name : `this ${v.listing}`} with your referral link already on it, so{' '}
                {sellerName} can see that you brought them.
              </p>
              <p className="muted small" style={{ margin: 0 }}>
                Safe to show anyone: it carries a public link and nothing about you or this order.
                Your {v.codes} below are the opposite — those QR codes are yours alone, they are
                what gets scanned at {v.where}, and each one works exactly once.
              </p>
              <p className="mono small muted" style={{ margin: '8px 0 0', wordBreak: 'break-all' }}>
                {shareEventUrl}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* The other half of that share button: what it has actually brought,
          and what it has earned. Shown ONLY when the organizer rewards
          referrals — and stated as their thank-you on their own prices, never
          as anything the platform hands out. */}
      {rewards?.settings.enabled ? (
        <div className="card anim-fade-up anim-d1">
          <div className="card-title">Bring a friend, get a thank-you</div>
          <p className="muted small" style={{ marginTop: 0 }}>
            {sellerName} gives a{' '}
            {formatMoney(rewards.settings.rewardCents, rewards.currency)} voucher for every{' '}
            {rewards.settings.threshold}{' '}
            {rewards.settings.threshold === 1 ? 'friend who books' : 'friends who book'} through your
            link above and actually pays. It is their own discount on their own {v.units} — you
            simply pay them less next time, and nothing about it passes through us.
          </p>
          <div className="summary-row">
            {/* Counted from the day this seller made the promise, which is the
                same window the vouchers below are issued from — a lifetime
                number here would tell somebody they had earned four vouchers
                they do not hold. */}
            <span className="muted">Friends who booked and paid since this started</span>
            <span>{rewards.paidReferrals}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Until your next voucher</span>
            <span>
              {rewards.toNextReward} more {rewards.toNextReward === 1 ? 'booking' : 'bookings'}
            </span>
          </div>
          {rewards.vouchers.length > 0 ? (
            <>
              <p style={{ margin: '14px 0 4px' }}>
                <strong>
                  {rewards.vouchers.length === 1 ? 'Your voucher' : 'Your vouchers'}
                </strong>
              </p>
              {rewards.vouchers.map((voucher) => (
                <div className="summary-row" key={voucher.code}>
                  <span className="mono">{voucher.code}</span>
                  <span>{formatMoney(voucher.amountCents, rewards.currency)} off</span>
                </div>
              ))}
              <p className="muted small" style={{ margin: '10px 0 0' }}>
                Type it into the &ldquo;Have a discount code?&rdquo; box at checkout on any{' '}
                {v.listing} from {sellerName}. Each one is yours to use once, and there is no expiry
                date on it.
              </p>
            </>
          ) : (
            <p className="muted small" style={{ margin: '10px 0 0' }}>
              Only bookings {sellerName} has confirmed as paid count — nothing is owed to you until
              then, and we will email you the moment a voucher is yours.
            </p>
          )}
        </div>
      ) : null}

      {/* Said out loud, not hidden. A buyer who came straight from checkout
          has proved nothing about the address they typed, so the two panels
          that belong to that ADDRESS are not here — and they must understand
          why, or the missing rewards read as a broken promise. The words are
          warm on purpose: this is the normal path, not an error. */}
      {cardOfferable && !account.mailboxProven ? (
        <div className="card anim-fade-up anim-d1">
          {/* "Travel by email", not "are in your email": this page is bookmarked
              and reopened, so the copy has to stay true for the buyer reading it
              weeks after the mail went out as well as the one reading it two
              minutes later. Neither branch claims a message arrived. */}
          <div className="card-title">
            {rewardsOffered
              ? 'Your rewards and your card travel by email'
              : 'Your card travels by email'}
          </div>
          {mailConfigured ? (
            <p className="muted small" style={{ marginTop: 0 }}>
              Anything that belongs to your address rather than to this one order —{' '}
              {rewardsOffered ? `any thank-you codes ${sellerName} has given you, and ` : ''}your
              own card with {sellerName} — opens from the link we email to{' '}
              <strong translate="no">{shown.buyerEmail}</strong>. That link rides in the confirmation for this
              order: tap it, whether the message reached you minutes ago or seasons ago, and they
              appear right here on this page. If it is not in that inbox, ask {sellerName}.
            </p>
          ) : (
            <p className="muted small" style={{ marginTop: 0 }}>
              Anything that belongs to your address rather than to this one order —{' '}
              {rewardsOffered ? `any thank-you codes ${sellerName} has given you, and ` : ''}your
              own card with {sellerName} — opens only from a link that travels by email to{' '}
              <strong translate="no">{shown.buyerEmail}</strong>, and this site is not sending email at the moment.
              So that link cannot reach you right now, and we would rather say so than promise you a
              message. Nothing here is lost — your {v.codes} below are unaffected — and {sellerName}{' '}
              can tell you directly what you are holding.
            </p>
          )}
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Why the extra step: anyone can type any address into a checkout, so this page will not
            hand out what belongs to an address until the link from that inbox shows it is yours.
          </p>
        </div>
      ) : null}

      {/* The card offer. Nobody gets one by buying something — this button is
          the only way a card comes into existence, which is exactly what lets
          it outlive the after-event erasure (see /privacy and lib/cards.ts). */}
      {cardOfferable && account.mailboxProven ? (
        existingCard ? (
          <p className="muted small anim-fade-up anim-d1" style={{ margin: '0 0 16px' }}>
            You keep a card with {sellerName} —{' '}
            <Link
              href={`/c/${encodeURIComponent(existingCard.cardCode)}`}
              style={{ color: 'var(--brand-text)', fontWeight: 600 }}
            >
              open it
            </Link>{' '}
            for your QR, your codes and everything you have bought from them.
          </p>
        ) : (
          <div className="card anim-fade-up anim-d1">
            <div className="card-title">Keep a card with {sellerName}?</div>
            <p className="muted small" style={{ marginTop: 0 }}>
              One page of your own with {sellerName}: a QR that lets them recognise you at{' '}
              {v.where}, your referral code, any discount codes you are holding, and what you have
              bought from them. It stores your email address and nothing more, it works only with{' '}
              {sellerName} and nowhere else on this site, and you can close it yourself from the
              card in one press.
            </p>
            <form action={keepCard}>
              <input type="hidden" name="orderId" value={order.id} />
              {/* The proof travels with the request, and is checked again on
                  the other side — see keepCard. */}
              <input type="hidden" name="token" value={accessToken ?? ''} />
              <button type="submit" className="btn btn-brand">
                Yes, keep a card for me
              </button>
            </form>
          </div>
        )
      ) : null}

      <div className="card anim-fade-up anim-d2">
        <div className="card-title">Order summary</div>
        {event ? (
          <div className="summary-row">
            <span className="muted">Event</span>
            <span>{[event.name, event.dateDisplay].filter(Boolean).join(' · ')}</span>
          </div>
        ) : null}
        {event && eventVenue ? (
          /* The address on its own row. It was only ever on this page inside
             the ticket cards further up, which is the one part of it a buyer
             screenshots and sends to somebody else. */
          <div className="summary-row">
            <span className="muted">Where</span>
            <span>{eventVenue}</span>
          </div>
        ) : null}
        <div className="summary-row">
          <span className="muted">Name</span>
          <span translate="no">{shown.buyerName}</span>
        </div>
        <div className="summary-row">
          <span className="muted">Email</span>
          <span translate="no">{shown.buyerEmail}</span>
        </div>
        {items.map((it) => {
          const seatsPerUnit = tierFor(it.tierId)?.seatsPerUnit ?? 1;
          return (
            <div className="summary-row" key={it.tierId}>
              <span>
                {it.quantity}&times; {tierName(it.tierId)}
                {/* A bundled booking translated into tickets, right on the
                    line that would otherwise read "2× Table of 8" against a
                    grid of sixteen codes below with nothing connecting them. */}
                {seatsPerUnit > 1 ? (
                  <span className="muted small">
                    {' '}
                    — {it.quantity * seatsPerUnit} QR {v.codes} ({seatsPerUnit} per booking)
                  </span>
                ) : null}
              </span>
              <span>{formatMoney(it.quantity * it.unitPriceCents, order.currency)}</span>
            </div>
          );
        })}
        {order.discountCents > 0 ? (
          <div className="summary-row">
            <span>
              Code <span className="mono small">{order.voucherCode}</span>
            </span>
            <span>&minus;{formatMoney(order.discountCents, order.currency)}</span>
          </div>
        ) : null}
        <div className="summary-row total">
          <span>Total</span>
          <span>{order.totalCents === 0 ? 'Free' : formatMoney(order.totalCents, order.currency)}</span>
        </div>
        <p className="mono small muted" style={{ margin: '10px 0 0' }}>
          Order ID: {order.id}
        </p>
      </div>

      <p className="muted small anim-fade-up anim-d3 no-print" style={{ margin: '0 0 10px' }}>
        Tap a {v.code} to open it on its own — &ldquo;Save to phone&rdquo; there keeps it in your photos, so it
        opens even without signal.
      </p>
      <div className="ticket-grid anim-fade-up anim-d3">
        {tickets.map((t) => (
          <Link
            key={t.code}
            href={`/ticket/${encodeURIComponent(t.code)}`}
            className="ticket-card glow-card"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.qr} alt={`QR code for ticket ${t.code}`} width={260} height={260} />
            <div className="ticket-code">{t.code}</div>
            <div className="ticket-tier">{tierName(t.tierId)}</div>
            {event ? (
              <div style={{ color: '#555', fontSize: '0.78rem', marginTop: 8, lineHeight: 1.45 }}>
                {event.name}
                {event.dateDisplay ? (
                  <>
                    <br />
                    {event.dateDisplay}
                  </>
                ) : null}
                {eventVenue ? (
                  <>
                    <br />
                    {eventVenue}
                  </>
                ) : null}
              </div>
            ) : null}
          </Link>
        ))}
      </div>

      {/* The review panel. Below the codes on purpose: the codes are what the
          buyer came for, and nothing should stand between them and the thing
          they paid for. no-print because a printed sheet of collection codes
          carrying an empty star input is nonsense.

          It exists at all only because this page was opened from the buyer's
          own email — see reviewToken above — so the panel appearing IS the
          proof of the mailbox, and it needs no explanation of who may write. */}
      {reviewToken && reviewable.length > 0 ? (
        /* id="review" because the collection email links straight here —
           "once you have collected and tried it, say how it was" — and this
           card is a long way down a page that opens on payment instructions
           and a grid of QR codes. Without the anchor the link lands at the top
           and the invitation reads as if it went nowhere. scroll-margin keeps
           the heading clear of the sticky site header. */
        <div
          id="review"
          className="card glow-card anim-fade-up anim-d4 no-print"
          style={{ marginTop: 20, scrollMarginTop: 90 }}
        >
          <div className="card-title">How was it?</div>
          <p className="muted small" style={{ marginTop: 0 }}>
            You paid for {reviewable.length === 1 ? 'this' : 'these'}, which is the only way anybody
            gets to say anything about {reviewable.length === 1 ? 'it' : 'them'} here. What you write
            goes on the shop&rsquo;s own page, under the item.
          </p>
          <p className="muted small">
            {/* The one sentence the panel owes the buyer BEFORE they type: what
                strangers will see over their words. lib/reviews stores exactly
                this — a first name and an initial, frozen at write time — and
                the address they ordered with never goes near a review. */}
            Your reviews are signed{' '}
            <strong translate="no">&ldquo;{reviewable[0]?.byline ?? 'First L.'}&rdquo;</strong> — never your
            surname in full, never your email address. The seller can reply to you in public; they cannot
            edit or take down what you wrote. You can delete your own review here at any time.
          </p>
          <div style={{ display: 'grid', gap: 14 }}>
            {reviewable.map((it) => (
              <ReviewForm
                key={it.tierKey}
                orderId={order.id}
                token={reviewToken}
                tierKey={it.tierKey}
                itemName={it.name}
                existing={it.existing}
                maxChars={MAX_REVIEW_CHARS}
                byline={it.byline}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="anim-fade-up anim-d4">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <PrintButton label="Print or save tickets" />
          {calendarHref ? (
            <a href={calendarHref} className="btn no-print">
              Add to calendar
            </a>
          ) : null}
        </div>
        <p className="muted small no-print" style={{ marginTop: 12 }}>
          Each QR code admits one person and can only be scanned once. A copy has been emailed to
          you if email is configured.
        </p>
      </div>
      {sellerBlock}
    </div>
  );
}
