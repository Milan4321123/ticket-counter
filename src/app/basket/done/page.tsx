import Link from 'next/link';
import { getEventById, getEventTiers, paypalMeUrl, paypalPayee } from '@/lib/events';
import { girocodePayload } from '@/lib/girocode';
import { formatMoney } from '@/lib/money';
import { getOrder, getOrderItems, paymentReference } from '@/lib/orders';
import { orderPayout } from '@/lib/payout';
import { paymentQrDataUrl } from '@/lib/paymentQr';
import { readListingName } from '@/lib/exampleShop';
import CopyText from './CopyText';
import { basketRunOrderIds } from '@/lib/basket';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pay your orders', robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * After a basket checkout: one card per seller with everything needed to pay
 * that seller — amount, reference, bank details, a GiroCode for the banking
 * app, and PayPal where offered. The money never passes through this site,
 * which is why there is one payment per seller rather than one in total.
 */
export default async function BasketDone({
  searchParams,
}: {
  searchParams: Promise<{ o?: string; run?: string; partial?: string }>;
}) {
  const { o = '', run = '', partial } = await searchParams;
  const ids = (run ? (basketRunOrderIds(run) ?? []) : o.split(',')).filter((id) => UUID.test(id)).slice(0, 20);
  const cards = [];
  for (const id of ids) {
    const order = getOrder(id);
    if (!order) continue;
    const event = getEventById(order.eventId);
    if (!event) continue;
    const payout = orderPayout(order, event);
    const reference = paymentReference(order.id);
    const bank = payout.iban.trim() && payout.holder.trim() ? payout : null;
    const paypal = paypalPayee({ paypalAccount: payout.paypal });
    const giroQr =
      order.paymentMode === 'transfer' && bank
        ? await paymentQrDataUrl(
            girocodePayload({
              accountHolder: bank.holder,
              iban: bank.iban,
              bic: bank.bic,
              amountCents: order.totalCents,
              currency: order.currency,
              reference,
            })
          )
        : null;
    const tiers = new Map(getEventTiers(event.id).map((t) => [t.tierKey, t.name]));
    cards.push({
      order,
      event,
      reference,
      bank,
      paypalUrl: paypalMeUrl(paypal, order.totalCents, order.currency),
      giroQr,
      items: getOrderItems(order.id).map((it) => `${it.quantity}× ${tiers.get(it.tierId) ?? it.tierId}`),
    });
  }

  const total = cards.reduce((n, c) => n + c.order.totalCents, 0);
  const currency = cards[0]?.order.currency ?? 'EUR';
  // Card payments, one per seller: how many are done, and which one is next.
  const cardOrders = cards.filter((c) => c.order.paymentMode === 'stripe');
  const paidCount = cards.filter((c) => c.order.status === 'paid').length;
  const nextCard = cardOrders.find((c) => c.order.status === 'claimed' && c.order.stripeSessionUrl);

  return (
    <div className="container section bk">
      <p className="feed-kicker">Orders placed ✓</p>
      <h1 className="page-title">
        {cards.length > 0 && paidCount === cards.length
          ? 'All paid — thank you!'
          : cards.length === 1
            ? 'One payment to make'
            : `${cards.length} payments — one per shop or event`}
      </h1>
      <p className="muted bk-sub">
        Your items are held. Pay each one below — straight into the seller’s own account — using the reference shown,
        so they can match your payment. Total {formatMoney(total, currency)}. Every order is also in your email and in{' '}
        <Link href="/account">your account</Link>.
      </p>
      {cardOrders.length > 0 && (
        <div className="bk-progress">
          <div className="bk-progress-bar">
            <span style={{ width: `${Math.round((paidCount / cards.length) * 100)}%` }} />
          </div>
          <span>
            {paidCount} of {cards.length} paid
          </span>
          {nextCard && (
            <a href={nextCard.order.stripeSessionUrl!} className="btn btn-brand">
              Pay {formatMoney(nextCard.order.totalCents, nextCard.order.currency)} to{' '}
              {readListingName(nextCard.event.name).name} by card →
            </a>
          )}
        </div>
      )}
      {partial && (
        <div className="notice notice-warn">
          Some items could not be ordered — they are still in <Link href="/basket">your basket</Link>.
        </div>
      )}

      <ol className="bk-pay">
        {cards.map((c, i) => (
          <li key={c.order.id} className="bk-pay-card" style={{ ['--i' as string]: String(i) }}>
            <div className="bk-pay-head">
              <span className="bk-pay-step">{i + 1}</span>
              <div>
                <strong>{readListingName(c.event.name).name}</strong>
                <span className="muted small">{c.items.join(' · ')}</span>
              </div>
              <b className="bk-pay-amount">{formatMoney(c.order.totalCents, c.order.currency)}</b>
            </div>
            {c.order.status === 'paid' ? (
              <p className="notice notice-success" style={{ margin: 0 }}>
                ✓ Paid — thank you. Your {c.event.kind === 'shop' ? 'collection code' : 'tickets'} are in your email and on{' '}
                <Link href={`/order/${c.order.id}`}>the order page</Link>.
              </p>
            ) : c.order.paymentMode === 'stripe' ? (
              c.order.status === 'claimed' && c.order.stripeSessionUrl ? (
                <p className="bk-card-pay">
                  <a href={c.order.stripeSessionUrl} className="btn btn-brand">
                    Pay {formatMoney(c.order.totalCents, c.order.currency)} by card →
                  </a>
                  <span className="muted small">On {readListingName(c.event.name).name}’s own secure Stripe page.</span>
                </p>
              ) : (
                <p className="notice notice-warn" style={{ margin: 0 }}>
                  This card payment was not completed in time, and the items were released.{' '}
                  <Link href={`/e/${c.event.slug}/checkout`}>Order them again</Link>.
                </p>
              )
            ) : (
              <div className="bk-pay-body">
                <div className="bk-pay-rows">
                  <CopyText label="Reference" value={c.reference} strong />
                  {c.bank && (
                    <>
                      <CopyText label="Account holder" value={c.bank.holder} />
                      <CopyText label="IBAN" value={c.bank.iban} mono />
                      {c.bank.bic ? <CopyText label="BIC" value={c.bank.bic} mono /> : null}
                    </>
                  )}
                  <CopyText label="Amount" value={(c.order.totalCents / 100).toFixed(2)} />
                  <div className="bk-pay-links">
                    {c.paypalUrl && (
                      <a href={c.paypalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                        Pay with PayPal ↗
                      </a>
                    )}
                    <Link href={`/order/${c.order.id}`} className="btn btn-sm">
                      Open this order
                    </Link>
                  </div>
                </div>
                {c.giroQr && (
                  <figure className="bk-pay-qr">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.giroQr} alt={`Payment QR code for ${readListingName(c.event.name).name}`} width={150} height={150} />
                    <figcaption>Scan with your banking app — everything is filled in</figcaption>
                  </figure>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      {cards.length === 0 && (
        <p className="muted">
          Nothing to show here. Your orders are in <Link href="/account">your account</Link>.
        </p>
      )}
    </div>
  );
}
