import Link from 'next/link';
import { notFound } from 'next/navigation';
import CheckPaymentButton from '@/components/CheckPaymentButton';
import CopyButton from '@/components/CopyButton';
import PrintButton from '@/components/PrintButton';
import { getEventById, getEventTiers, paypalPayee } from '@/lib/events';
import { formatMoney } from '@/lib/money';
import { getOrder, getOrderItems, getTicketsForOrder, paymentReference } from '@/lib/orders';
import { orderPayout } from '@/lib/payout';
import { ticketQrDataUrl } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

// The order page shows buyer details + payment reference — never index it.
export const metadata = { robots: { index: false, follow: false } };

// Fixed-width labels keep the .copy-row values aligned.
const rowLabelStyle = { minWidth: 130 } as const;

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = getOrder(id);
  if (!order) notFound();

  // Every order belongs to an event — its name, venue, and bank details all
  // come from there.
  const event = getEventById(order.eventId);
  const eventVenue = event ? [event.venueName, event.city].filter(Boolean).join(', ') : '';
  const checkoutHref = event ? `/e/${event.slug}/checkout` : '/';

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
    return (
      <div className="container container-narrow section">
        <h1 className="page-title anim-fade-up">Your reservation</h1>
        {event ? (
          <p className="muted anim-fade-up" style={{ margin: '-8px 0 16px' }}>
            {[event.name, event.dateDisplay, eventVenue].filter(Boolean).join(' · ')}
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
                <p className="muted small" style={{ margin: '2px 0 0' }}>
                  {paypal
                    ? 'PayPal usually arrives within minutes; a bank transfer takes 1–2 business days. As soon as yours lands, it is confirmed.'
                    : 'Bank transfers usually take 1–2 business days to arrive. As soon as yours lands, it is confirmed.'}
                </p>
              </div>
            </li>
            <li className="step-item">
              <span className="step-num">3</span>
              <div>
                <div className="tier-name">Your QR tickets arrive</div>
                <p className="muted small" style={{ margin: '2px 0 0' }}>
                  They&rsquo;re emailed to <strong>{order.buyerEmail}</strong> and appear right
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
            <div className="copy-row">
              <span className="muted small" style={rowLabelStyle}>
                Amount
              </span>
              <strong>{amountDisplay}</strong>
              <CopyButton value={amountPlain} />
            </div>
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
            <div className="copy-row">
              <span className="muted small" style={rowLabelStyle}>
                Amount
              </span>
              <strong>{amountDisplay}</strong>
              <CopyButton value={amountPlain} />
            </div>
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

        <p className="muted small anim-fade-up anim-d4">
          Tip: bookmark this page — your tickets will appear here the moment your payment is
          confirmed. These instructions have been emailed to you as well.
        </p>
        <p className="mono small muted">Order ID: {order.id}</p>
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
  const items = getOrderItems(order.id);
  const tiers = event ? getEventTiers(event.id) : [];
  const tierName = (tierId: string) => tiers.find((t) => t.tierKey === tierId)?.name ?? tierId;
  const tickets = await Promise.all(
    getTicketsForOrder(order.id).map(async (t) => ({ ...t, qr: await ticketQrDataUrl(t.code) }))
  );

  return (
    <div className="container section">
      <h1 className="page-title anim-fade-up">Your tickets</h1>
      <div className="notice notice-success anim-fade-up anim-d1">
        Payment received — you&rsquo;re all set. See you at the show!
      </div>

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
          <span>{order.buyerName}</span>
        </div>
        <div className="summary-row">
          <span className="muted">Email</span>
          <span>{order.buyerEmail}</span>
        </div>
        {items.map((it) => (
          <div className="summary-row" key={it.tierId}>
            <span>
              {it.quantity}&times; {tierName(it.tierId)}
            </span>
            <span>{formatMoney(it.quantity * it.unitPriceCents, order.currency)}</span>
          </div>
        ))}
        <div className="summary-row total">
          <span>Total</span>
          <span>{formatMoney(order.totalCents, order.currency)}</span>
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
        <PrintButton label="Print or save tickets" />
        <p className="muted small no-print" style={{ marginTop: 12 }}>
          Each QR code admits one person and can only be scanned once. A copy has been emailed to
          you if email is configured.
        </p>
      </div>
    </div>
  );
}
