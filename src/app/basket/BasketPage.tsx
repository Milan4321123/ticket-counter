'use client';

// The basket: everything picked, grouped by seller, then ONE checkout that
// places one ordinary bank-transfer order per seller through POST /api/orders
// — the same endpoint, prices and limits as a single checkout. Each seller is
// paid directly; /basket/done shows every payment on one page.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/money';
import { removeLines, setQty, useBasket, type BasketLine } from '@/components/basket/basketStore';
import { WishPanel } from '@/components/WishButton';

interface Group {
  eventId: string;
  slug: string;
  listing: string;
  seller: string;
  kind: 'event' | 'shop';
  currency: string;
  lines: BasketLine[];
  subtotal: number;
  /** An example shop: shown, never ordered. */
  example: boolean;
  /** The seller takes cards instantly (their own Stripe). */
  card: boolean;
}

export default function BasketPage({ customer }: { customer: { name: string; email: string } | null }) {
  const lines = useBasket();
  const router = useRouter();
  const [name, setName] = useState(customer?.name ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  /** 'card' = each seller's own card checkout, one after another; 'transfer' = bank/PayPal details. */
  const [payWith, setPayWith] = useState<'card' | 'transfer' | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const l of lines) {
      const g = map.get(l.eventId) ?? {
        eventId: l.eventId,
        slug: l.slug,
        listing: l.listing,
        seller: l.seller,
        kind: l.kind,
        currency: l.currency,
        lines: [],
        subtotal: 0,
        example: false,
        card: true,
      };
      g.lines.push(l);
      g.subtotal += l.priceCents * l.qty;
      if (l.example) g.example = true;
      if (!l.card) g.card = false;
      map.set(l.eventId, g);
    }
    return [...map.values()];
  }, [lines]);

  // Example shops sit in the basket to show how it works; only real ones are ordered.
  const orderable = groups.filter((g) => !g.example);
  const total = orderable.reduce((n, g) => n + g.subtotal, 0);
  const cardCount = orderable.filter((g) => g.card).length;
  const method: 'card' | 'transfer' = payWith ?? (cardCount > 0 ? 'card' : 'transfer');
  const currency = orderable[0]?.currency ?? groups[0]?.currency ?? 'EUR';

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (busy || orderable.length === 0) return;
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('Please enter your name and a valid email address.');
      return;
    }
    setBusy(true);
    setFormError(null);
    setErrors({});
    const placed: string[] = [];
    const failed: Record<string, string> = {};
    const cardPages: string[] = [];
    // One run for this checkout, so the payments page finds every order.
    let runId = '';
    try {
      const r = await fetch('/api/basket/run', { method: 'POST' });
      runId = ((await r.json()) as { runId?: string }).runId ?? '';
    } catch {
      runId = '';
    }
    // One order per seller, one after another (each reserves its own stock).
    for (const g of orderable) {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: g.eventId,
            buyerName: name.trim(),
            buyerEmail: email.trim(),
            payerName: '',
            items: g.lines.map((l) => ({ tierId: l.tierKey, quantity: l.qty })),
            expectedTotalCents: g.subtotal,
            marketingOptIn: false,
            ref: '',
            voucherCode: '',
            payVia: method === 'card' && g.card ? 'stripe' : 'transfer',
            ...(runId ? { basketRun: runId } : {}),
          }),
        });
        const data = (await res.json().catch(() => null)) as { orderId?: string; error?: string; redirectUrl?: string | null } | null;
        if (!res.ok || !data?.orderId) throw new Error(data?.error ?? 'This part could not be ordered.');
        placed.push(data.orderId);
        if (data.redirectUrl) cardPages.push(data.redirectUrl);
        removeLines(g.lines.map((l) => l.key));
      } catch (err) {
        failed[g.eventId] = err instanceof Error ? err.message : 'This part could not be ordered.';
      }
    }
    setBusy(false);
    setErrors(failed);
    if (placed.length > 0) {
      const extra = Object.keys(failed).length ? '&partial=1' : '';
      // Paying by card: straight to the first seller's card page; Stripe
      // brings the buyer back to the payments page, which offers the next.
      if (cardPages.length > 0) {
        window.location.href = cardPages[0];
        return;
      }
      router.push(runId ? `/basket/done?run=${runId}${extra}` : `/basket/done?o=${placed.join(',')}${extra}`);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="container section bk">
        <h1 className="page-title">Your basket</h1>
        <div className="bk-empty">
          <span aria-hidden="true">🧺</span>
          <p>Your basket is empty.</p>
          <p className="muted small">Tap “＋ Add to basket” on anything in the bazaar — from as many sellers as you like.</p>
          <p>
            <Link href="/market" className="btn btn-brand">
              Shop the bazaar
            </Link>{' '}
            <Link href="/" className="btn">
              Browse events
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container section bk">
      <h1 className="page-title">Your basket</h1>
      <p className="muted bk-sub">
        From {groups.length} {groups.length === 1 ? 'shop or event' : 'shops and events'}. Each seller is paid directly,
        so you get one payment per shop or event — all on one page after you order.
      </p>

      <div className="bk-layout">
        <div className="bk-groups">
          {groups.map((g) => (
            <section key={g.eventId} className={`bk-group${errors[g.eventId] ? ' has-error' : ''}`}>
              <header className="bk-group-head">
                <span aria-hidden="true">{g.kind === 'shop' ? '🛍' : '🎟'}</span>
                <div>
                  <Link href={`/e/${g.slug}`} className="bk-group-name">
                    {g.listing}
                  </Link>
                  <span className="muted small">Sold by {g.seller}</span>
                </div>
                <b>{formatMoney(g.subtotal, g.currency)}</b>
              </header>
              {g.lines.map((l) => (
                <div key={l.key} className="bk-line">
                  {l.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.image} alt="" />
                  ) : (
                    <span className="bk-line-blank">{l.name.charAt(0)}</span>
                  )}
                  <div className="bk-line-info">
                    <strong>{l.name}</strong>
                    <span>{formatMoney(l.priceCents, l.currency)} each</span>
                  </div>
                  <div className="qty-stepper">
                    <button type="button" aria-label={`Remove one ${l.name}`} onClick={() => setQty(l.key, l.qty - 1)} disabled={busy}>
                      −
                    </button>
                    <span className="qty-value">{l.qty}</span>
                    <button
                      type="button"
                      aria-label={`Add one ${l.name}`}
                      onClick={() => setQty(l.key, l.qty + 1)}
                      disabled={busy || l.qty >= l.max}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              {g.example && (
                <>
                  <WishPanel
                    eventId={g.eventId}
                    example
                    unit={g.kind === 'shop' ? 'item' : 'ticket'}
                    items={g.lines.map((l) => ({ tierKey: l.tierKey, name: l.name }))}
                  />
                  <p className="bk-example">
                    It stays in your basket until you remove it.{' '}
                    <button type="button" className="bk-remove" onClick={() => removeLines(g.lines.map((l) => l.key))}>
                      Remove
                    </button>
                  </p>
                </>
              )}
              {errors[g.eventId] && (
                <p className="bk-error" role="alert">
                  {errors[g.eventId]} <Link href={`/e/${g.slug}/checkout`}>Order this one on its own page →</Link>
                </p>
              )}
            </section>
          ))}
          <p className="small">
            <Link href="/market">← Keep shopping</Link>
          </p>
        </div>

        <form className="bk-summary" onSubmit={checkout}>
          <h2>Checkout</h2>
          {orderable.map((g) => (
            <div key={g.eventId} className="bk-sum-row">
              <span>{g.listing}</span>
              <span>{formatMoney(g.subtotal, g.currency)}</span>
            </div>
          ))}
          <div className="bk-sum-row bk-sum-total">
            <span>Total</span>
            <span>{formatMoney(total, currency)}</span>
          </div>
          {cardCount > 0 && (
            <div className="bk-method" role="radiogroup" aria-label="How to pay">
              <button
                type="button"
                role="radio"
                aria-checked={method === 'card'}
                className={method === 'card' ? 'is-on' : ''}
                onClick={() => setPayWith('card')}
              >
                <strong>⚡ Pay now by card</strong>
                <span>
                  {cardCount === orderable.length
                    ? `${cardCount === 1 ? 'One card payment' : `${cardCount} quick card payments, one per seller`}`
                    : `${cardCount} by card now, the rest by bank transfer`}
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={method === 'transfer'}
                className={method === 'transfer' ? 'is-on' : ''}
                onClick={() => setPayWith('transfer')}
              >
                <strong>🏦 Bank transfer / PayPal</strong>
                <span>Details and QR codes on the next page</span>
              </button>
            </div>
          )}
          <label htmlFor="bk-name">Your name</label>
          <input id="bk-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={120} />
          <label htmlFor="bk-email">Email — your order confirmations go here</label>
          <input
            id="bk-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            maxLength={200}
          />
          {formError && (
            <p className="bk-error" role="alert">
              {formError}
            </p>
          )}
          <button className="btn btn-brand btn-lg btn-block" disabled={busy || orderable.length === 0}>
            {busy
              ? 'Placing your orders…'
              : orderable.length === 0
                ? 'Only example items here'
                : orderable.length === 1
                  ? 'Place order'
                  : `Place ${orderable.length} orders`}
          </button>
          <p className="muted small" style={{ margin: 0 }}>
            {method === 'card'
              ? 'Each seller has their own secure card page. Pay one, and you come straight back here for the next — the money goes directly to each seller.'
              : 'Your items are held for you. Next you see each seller’s payment details — bank transfer or PayPal — with a QR code for your banking app. Nothing is charged here.'}
          </p>
          {!customer && (
            <p className="muted small" style={{ margin: 0 }}>
              <Link href="/account">Sign in</Link> to keep your basket and orders on every device.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
