import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import CheckPaymentButton from '@/components/CheckPaymentButton';
import OrganizerWhatsApp from '@/components/OrganizerWhatsApp';
import CopyButton from '@/components/CopyButton';
import PrintButton from '@/components/PrintButton';
import { getCustomerCard, issueCustomerCard } from '@/lib/cards';
import {
  cropTag,
  getEventById,
  getEventTiers,
  mediaUrl,
  parseCropRect,
  paypalMeUrl,
  paypalPayee,
} from '@/lib/events';
import { getOrganizer } from '@/lib/organizers';
import { girocodePayload } from '@/lib/girocode';
import { formatMoney } from '@/lib/money';
import { getBaseUrl } from '@/lib/config';
import { getOrder, getOrderItems, getTicketsForOrder, paymentReference, referralCode } from '@/lib/orders';
import { orderPayout } from '@/lib/payout';
import { withAnonymizedBuyer } from '@/lib/retention';
import { referralProgressFor, referralRewardsReachable } from '@/lib/referrals';
import { paymentQrDataUrl } from '@/lib/paymentQr';
import { machineDate } from '@/lib/seo';
import { ticketQrDataUrl } from '@/lib/tickets';
import { vocabFor } from '@/lib/vocab';
import { whatsappShareUrl } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

// The order page shows buyer details + payment reference — never index it.
export const metadata = { robots: { index: false, follow: false } };

// Fixed-width labels keep the .copy-row values aligned.
const rowLabelStyle = { minWidth: 130 } as const;

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = getOrder(id);
  if (!order) notFound();

  // What this page may PRINT about the buyer. `order` keeps the real columns
  // for the machinery below (the payment blocks, the card offer, the resend);
  // this is the screen's copy, and after the retention sweep it says 'a past
  // guest' instead of the placeholder that keeps those columns non-null.
  const shown = withAnonymizedBuyer(order);

  // Every order belongs to an event — its name, venue, and bank details all
  // come from there.
  const event = getEventById(order.eventId);
  const eventVenue = event ? [event.venueName, event.city].filter(Boolean).join(', ') : '';
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
  const itemsLine = orderItems
    .map((it) => `${it.quantity}× ${tierFor(it.tierId)?.name ?? it.tierId}`)
    .join(', ');

  // Reaching the organizer matters most on THIS page: it is where a buyer is
  // looking at a stranger's IBAN and deciding whether to send real money to it.
  // The one person who can settle that is the organizer whose account it is.
  const organizer = event ? getOrganizer(event.organizerId) : null;

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

  if (order.status === 'capturing') {
    return (
      <div className="container container-narrow section">
        <h1 className="page-title anim-fade-up">Your order</h1>
        <div className="notice notice-warn anim-fade-up anim-d1">
          We&rsquo;re confirming your payment with PayPal. Refresh this page in a minute — if you completed the
          payment, your tickets will appear here. If it didn&rsquo;t go through, you have not been charged.
        </div>
        <div className="anim-fade-up anim-d2">
          <CheckPaymentButton orderId={order.id} />
        </div>
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
    const paypalQr = await paymentQrDataUrl(paypalPayUrl);

    return (
      <div className="container container-narrow section">
        <h1 className="page-title anim-fade-up">Your reservation</h1>
        {event ? (
          <p className="muted anim-fade-up" style={{ margin: '-8px 0 16px' }}>
            {[event.name, event.dateDisplay, eventVenue].filter(Boolean).join(' · ')}
          </p>
        ) : null}
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
                  They&rsquo;re emailed to <strong>{shown.buyerEmail}</strong> and appear right
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
                  alt={`PayPal.Me link for ${amountDisplay}`}
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
                    Open PayPal with the amount filled in
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
                Code <span className="mono">{order.voucherCode}</span> applied —{' '}
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
                Code <span className="mono">{order.voucherCode}</span> applied —{' '}
                {formatMoney(order.discountCents, order.currency)} off the organizer&rsquo;s own price.
                Transfer the amount above and nothing else.
              </p>
            ) : null}
            <div className="copy-row">
              <span className="muted small" style={rowLabelStyle}>
                Account holder
              </span>
              <span>{bank.accountHolder}</span>
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

  // What the link above has actually earned this buyer, when the organizer has
  // switched referral rewards on. Nothing new appears on the page when they
  // have not — an unasked-for promise is worse than silence.
  //
  // Only while the buyer's details still exist: once lib/retention has erased
  // them, this order's address is a shared placeholder, and counting against
  // it would credit one imaginary, very busy person. Vouchers already earned
  // are unaffected — a voucher stands on its own code.
  //
  // And only where the promise can actually come true. This buyer's share link
  // points at THIS listing, and a referral is counted on the order it brings
  // here — so on a listing where nothing a buyer can buy costs money, no
  // booking it brings can ever be "actually paid for" and the counter would sit
  // at zero for good. Rewards are an ACCOUNT setting, so an organizer with one
  // paid listing and one free one would otherwise promise every RSVP guest
  // something the rules can never give them. Same function as the public
  // listing page asks, so the offer somebody read before booking and the
  // progress they read after it are decided by one rule.
  const rewardsReachable = referralRewardsReachable(orderTiers);
  const rewards =
    event && !order.buyerErasedAt && rewardsReachable
      ? referralProgressFor(event.organizerId, order.buyerEmail)
      : null;
  const sellerName = organizer?.name?.trim() || 'The organizer';

  // ---- The customer card: offered here, never assumed ---------------------
  //
  // Offered only where it can honestly work: this buyer's details still exist
  // (an erased order's address is a shared placeholder, so a card issued
  // against it would be a card for nobody), and the listing still has an
  // organizer to hold it with.
  //
  // Quiet on purpose. It is one paragraph and one button, it is never
  // pre-ticked because there is nothing to tick, and once somebody holds a
  // card the offer is replaced by a link to it — asking again next month is
  // how a kindness turns into nagging.
  const cardOfferable = Boolean(event && organizer && !order.buyerErasedAt && order.buyerEmail);
  const existingCard =
    cardOfferable && event ? getCustomerCard(event.organizerId, order.buyerEmail) : null;

  /**
   * Create the card, because the buyer pressed the button asking for one.
   *
   * The order id in the form is transport, not authority: everything the card
   * is made from is re-read here from the order itself, so a hand-made POST
   * can only ever issue a card to the address that really owns the order it
   * names — and only while that order is paid and its buyer not yet erased.
   */
  async function keepCard(formData: FormData) {
    'use server';
    const orderId = String(formData.get('orderId') ?? '');
    const fresh = getOrder(orderId);
    if (!fresh || fresh.status !== 'paid' || fresh.buyerErasedAt || !fresh.buyerEmail) return;
    const freshEvent = getEventById(fresh.eventId);
    if (!freshEvent) return;
    issueCustomerCard({ organizerId: freshEvent.organizerId, email: fresh.buyerEmail });
    // Straight back to this page, which now shows the link to the card rather
    // than the offer — one POST, one visible result.
    redirect(`/order/${encodeURIComponent(orderId)}`);
  }

  return (
    <div className="container section">
      <h1 className="page-title anim-fade-up">Your tickets</h1>
      <div className="notice notice-success anim-fade-up anim-d1">
        {/* "confirmed", not "received": the money went to the organizer, and the
            organizer confirming it is the event this banner reports — the ticket
            email says it the same way. */}
        {isFreeOrder
          ? "You're on the list — reservation confirmed. See you there!"
          : 'Payment confirmed — you’re all set. See you at the show!'}
      </div>
      {shareUrl && (
        <p className="anim-fade-up anim-d1" style={{ margin: '0 0 16px' }}>
          <a href={shareUrl} target="_blank" rel="noopener" className="btn btn-green">
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

      {/* The card offer. Nobody gets one by buying something — this button is
          the only way a card comes into existence, which is exactly what lets
          it outlive the after-event erasure (see /privacy and lib/cards.ts). */}
      {cardOfferable ? (
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
        <div className="summary-row">
          <span className="muted">Name</span>
          <span>{shown.buyerName}</span>
        </div>
        <div className="summary-row">
          <span className="muted">Email</span>
          <span>{shown.buyerEmail}</span>
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
    </div>
  );
}
