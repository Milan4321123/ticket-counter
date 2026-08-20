import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import CopyButton from '@/components/CopyButton';
import { cardView, closeCustomerCard, getCardByCode } from '@/lib/cards';
import { getBaseUrl } from '@/lib/config';
import { formatMoney } from '@/lib/money';
import { getOrganizer } from '@/lib/organizers';
import { platformName } from '@/lib/platform';
import { ticketQrDataUrl } from '@/lib/tickets';
import { vocabFor } from '@/lib/vocab';

export const dynamic = 'force-dynamic';

// A card page names a person and lists what they have bought — the same class
// of private capability as an order page or a ticket, and kept out of search
// engines for the same reason. The URL's own code is the secret that guards it.
export const metadata = { robots: { index: false, follow: false } };

interface Params {
  params: Promise<{ cardCode: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The customer card its holder opens: their QR, the seller they hold it with,
 * their referral code, the discount codes they have not spent, and their
 * history with that ONE seller.
 *
 * No sign-in, exactly like /order/<id> and /ticket/<code>: the code IN the URL
 * is the secret (24 random characters — see lib/cards.ts), and asking somebody
 * to make an account to look at their own loyalty card would be a worse trade
 * for them than the risk it removes.
 */
export default async function CustomerCardPage({ params, searchParams }: Params) {
  const { cardCode } = await params;
  let raw = cardCode;
  try {
    raw = decodeURIComponent(cardCode);
  } catch {
    // Malformed escape sequence — fall back to the raw param.
  }

  const card = getCardByCode(raw);
  if (!card) notFound();

  const organizer = getOrganizer(card.organizerId);
  const sellerName = organizer?.name?.trim() || 'this seller';
  const view = cardView(card, sellerName);
  const qr = await ticketQrDataUrl(card.cardCode);

  // The words come from the newest thing they bought — somebody whose history
  // is a shop's momo orders should not be read the word "tickets".
  const v = vocabFor(view.orders[0]?.eventKind ?? 'event');

  const sp = await searchParams;
  const confirming = (Array.isArray(sp.close) ? sp.close[0] : sp.close) === '1';

  // Null unless there is a code AND a listing a stranger can actually open —
  // cardView withholds the slug once the seller unpublishes (see there), so the
  // link and the QR below both disappear together rather than sending a friend
  // to a not-found page.
  const shareUrl =
    view.referralCode && view.referralSlug
      ? `${getBaseUrl()}/e/${view.referralSlug}?ref=${view.referralCode}`
      : null;

  // This page carries TWO QR codes, and they mean opposite things.
  //
  // The one above encodes the CARD CODE: a private identifier, the 24 random
  // characters that are also the secret in this page's URL. It exists for the
  // seller to scan at the counter, and anybody who photographs it can open
  // this card — so it must never be the thing held up to strangers.
  //
  // This one encodes a PUBLIC URL: the seller's listing with this holder's
  // referral code on it. It is an invitation, meant to be shown to anyone, and
  // it says nothing about who is holding it. Same helper, deliberately two
  // images, each labelled with who is supposed to scan it.
  const shareQr = shareUrl ? await ticketQrDataUrl(shareUrl) : null;

  const heldSince = card.createdAt.slice(0, 10);

  /**
   * Close the card. One press, and the row is deleted — see
   * closeCustomerCard: nothing is kept behind, because nothing but this
   * person asking again can ever create another one.
   *
   * Re-read from the form field rather than the closure so the deed is a POST
   * with an explicit code in it; the GET that renders the confirm step above
   * changes nothing, so a link-prefetching mail scanner cannot destroy
   * somebody's card by looking at it.
   */
  async function close(formData: FormData) {
    'use server';
    const code = String(formData.get('cardCode') ?? '');
    closeCustomerCard(code);
    redirect('/c/closed');
  }

  return (
    <div className="container container-narrow section">
      <div className="anim-fade-up" style={{ marginBottom: 18 }}>
        <p className="feed-kicker" style={{ margin: 0 }}>
          Your card with {sellerName}
        </p>
        <h1 className="page-title" style={{ margin: '4px 0 0' }}>
          {view.holderName ? `Hello, ${view.holderName}` : 'Hello again'}
        </h1>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Held since {heldSince}. Show this at {v.where} and {sellerName} will know you.
        </p>
      </div>

      <div className="card anim-fade-up anim-d1" style={{ textAlign: 'center' }}>
        <div className="card-title">Your card QR — for {sellerName} to scan</div>
        {/* Same QR helper the tickets use — one image, one meaning: this code
            says who is standing there, and nothing more. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR code for your customer card" width={260} height={260} />
        <div className="ticket-code mono">{card.cardCode}</div>
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          This QR is your card, and it is for {sellerName} at {v.where} — not for your friends. It
          carries this code and nothing else — not your name, not your email, nothing about you.
          Only {sellerName} can look it up.
        </p>
      </div>

      {view.rewards.settings.enabled || view.referralCode ? (
        <div className="card anim-fade-up anim-d1">
          <div className="card-title">Bring a friend</div>
          {view.referralCode ? (
            <>
              <div className="summary-row">
                <span className="muted">Your referral code</span>
                <span className="mono">{view.referralCode}</span>
              </div>
              {shareUrl ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                  <CopyButton value={shareUrl} label="Copy your link" />
                </div>
              ) : null}
              {/* The invitation, as something a friend standing next to you can
                  simply scan. Labelled against the card QR at the top of the
                  page on purpose — see the comment where shareQr is built. */}
              {shareQr ? (
                <div
                  style={{
                    display: 'flex',
                    gap: 14,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    marginTop: 14,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shareQr}
                    alt="QR code that opens the seller's listing with your referral link"
                    width={160}
                    height={160}
                    style={{ borderRadius: 12 }}
                  />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      Your referral QR — for your friends to scan
                    </p>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      Hold it up and they scan it with their camera: it opens {sellerName}&rsquo;s{' '}
                      {v.listing} with your link already on it. Safe to show anyone — it is a public
                      link, and unlike the QR at the top of this page it says nothing about you.
                    </p>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {view.rewards.settings.enabled ? (
            <>
              <p className="muted small" style={{ marginTop: 12 }}>
                {sellerName} gives a{' '}
                {formatMoney(view.rewards.settings.rewardCents, view.rewards.currency)} voucher for
                every {view.rewards.settings.threshold}{' '}
                {view.rewards.settings.threshold === 1 ? 'friend who books' : 'friends who book'}{' '}
                through your link and actually pays. It is their own discount on their own {v.units}
                {' '}— you simply pay them less next time, and nothing about it passes through{' '}
                {platformName()}.
              </p>
              <div className="summary-row">
                <span className="muted">Friends who booked and paid</span>
                <span>{view.rewards.paidReferrals}</span>
              </div>
              <div className="summary-row">
                <span className="muted">Until your next voucher</span>
                <span>
                  {view.rewards.toNextReward} more{' '}
                  {view.rewards.toNextReward === 1 ? 'booking' : 'bookings'}
                </span>
              </div>
            </>
          ) : (
            <p className="muted small" style={{ margin: '10px 0 0' }}>
              Share it with anyone you would bring along — it tells {sellerName} who sent them.
            </p>
          )}
        </div>
      ) : null}

      {view.vouchers.length > 0 ? (
        <div className="card anim-fade-up anim-d2">
          <div className="card-title">
            {view.vouchers.length === 1 ? 'Your discount code' : 'Your discount codes'}
          </div>
          {view.vouchers.map((voucher) => (
            <div className="summary-row" key={voucher.code}>
              <span className="mono">{voucher.code}</span>
              <span>{formatMoney(voucher.amountCents, view.rewards.currency)} off</span>
            </div>
          ))}
          <p className="muted small" style={{ margin: '10px 0 0' }}>
            Type one into the &ldquo;Have a discount code?&rdquo; box at checkout on any {v.listing}{' '}
            from {sellerName}. Each is yours to use once, and none of them expires.
          </p>
        </div>
      ) : null}

      <div className="card anim-fade-up anim-d2">
        <div className="card-title">What you have bought from {sellerName}</div>
        {view.orders.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            Nothing yet — or nothing recent enough to still be on file. Orders drop off this list
            once {sellerName} no longer needs your details for them.
          </p>
        ) : (
          view.orders.map((order) => (
            <div className="summary-row" key={order.id}>
              <span>
                <Link href={`/e/${order.eventSlug}`} style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
                  {order.eventName}
                </Link>
                {order.whenDisplay ? <span className="muted small"> · {order.whenDisplay}</span> : null}
              </span>
              <span>
                {order.totalCents === 0 ? 'Free' : formatMoney(order.totalCents, order.currency)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="card anim-fade-up anim-d3">
        <div className="card-title">This card is yours to close</div>
        <p className="muted small" style={{ marginTop: 0 }}>
          You asked {sellerName} to keep it, which is the only reason it exists. It holds your email
          address and nothing else, it works only with {sellerName}, and {platformName()} does not
          use it to recognise you anywhere else on this site.
        </p>
        {confirming ? (
          <>
            <div className="notice notice-warn small">
              Close this card for good? The QR above stops working immediately and this page will be
              gone. Your orders and any discount codes you are holding are not affected.
            </div>
            <form action={close} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input type="hidden" name="cardCode" value={card.cardCode} />
              <button type="submit" className="btn btn-danger">
                Yes, close my card
              </button>
              <Link href={`/c/${encodeURIComponent(card.cardCode)}`} className="btn">
                Keep it
              </Link>
            </form>
          </>
        ) : (
          <Link href={`/c/${encodeURIComponent(card.cardCode)}?close=1`} className="btn btn-sm">
            Close this card
          </Link>
        )}
      </div>
    </div>
  );
}
