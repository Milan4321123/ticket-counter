// A buyer's standing order (lib/subscriptions): what repeats, how often, when
// next, at what discount — and the four buttons that control it.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEventById, getEventTiers } from '@/lib/events';
import { formatMoney, subscribeDiscountCents } from '@/lib/money';
import { everyLabel, getSubscriptionByToken } from '@/lib/subscriptions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your subscription', robots: { index: false, follow: false } };

const NOTICES: Record<string, string> = {
  skip: 'Done — the next delivery is skipped.',
  pause: 'Paused. No new orders until you resume.',
  resume: 'Welcome back — your subscription is running again.',
  cancel: 'Cancelled. No more orders will be placed.',
  invalid: 'That did not work — please try again.',
  busy: 'Too many clicks — please wait a moment.',
};

function niceDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export default async function SubscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { token } = await params;
  const { msg } = await searchParams;
  const sub = getSubscriptionByToken(token);
  if (!sub) notFound();
  const event = getEventById(sub.eventId);
  const tiers = new Map(getEventTiers(sub.eventId).map((t) => [t.tierKey, t]));
  const currency = event?.currency ?? 'EUR';
  const lines = sub.items.map((it) => ({ ...it, tier: tiers.get(it.tierId) }));
  const subtotal = lines.reduce((n, l) => n + (l.tier?.priceCents ?? 0) * l.quantity, 0);
  const off = subscribeDiscountCents(sub.discountPct, subtotal);
  const action = `/api/subscriptions/${encodeURIComponent(token)}`;

  return (
    <div className="container container-narrow section">
      <p className="feed-kicker">Subscribe &amp; save</p>
      <h1 className="page-title">{event?.name ?? 'Your subscription'}</h1>
      {msg && NOTICES[msg] && (
        <p className="card" role="status" style={{ padding: '10px 14px' }}>
          {NOTICES[msg]}
        </p>
      )}
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <span className={`badge ${sub.status === 'active' ? 'badge-green' : ''}`}>
            {sub.status === 'active' ? 'Active' : sub.status === 'paused' ? 'Paused' : 'Cancelled'}
          </span>{' '}
          Repeats <strong>{everyLabel(sub.everyDays)}</strong> at <strong>{sub.discountPct}% off</strong>.
        </p>
        {sub.status === 'active' && (
          <p>
            Next order: <strong>{niceDate(sub.nextOn)}</strong>
          </p>
        )}
        {sub.statusNote && sub.status !== 'active' && <p className="muted">{sub.statusNote}</p>}
        <table className="table small">
          <tbody>
            {lines.map((l) => (
              <tr key={l.tierId}>
                <td>
                  {l.quantity}× {l.tier?.name ?? 'Item no longer sold'}
                </td>
                <td style={{ textAlign: 'right' }}>{formatMoney((l.tier?.priceCents ?? 0) * l.quantity, currency)}</td>
              </tr>
            ))}
            <tr>
              <td>You save {sub.discountPct}%</td>
              <td style={{ textAlign: 'right' }}>−{formatMoney(off, currency)}</td>
            </tr>
            <tr>
              <td>
                <strong>Each order</strong>
              </td>
              <td style={{ textAlign: 'right' }}>
                <strong>{formatMoney(subtotal - off, currency)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="muted small">
          Every repeat holds your items and emails you the seller&rsquo;s payment details. Nothing is charged
          automatically; you pay the seller directly, like any order. {sub.ordersMade} order
          {sub.ordersMade === 1 ? '' : 's'} so far.
        </p>
        {sub.status !== 'cancelled' && (
          <form method="post" action={action} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {sub.status === 'active' ? (
              <>
                <button className="btn btn-sm" name="action" value="skip">
                  Skip the next one
                </button>
                <button className="btn btn-sm" name="action" value="pause">
                  Pause
                </button>
              </>
            ) : (
              <button className="btn btn-green btn-sm" name="action" value="resume">
                Resume
              </button>
            )}
            <button className="btn btn-sm btn-danger" name="action" value="cancel">
              Cancel subscription
            </button>
          </form>
        )}
      </div>
      {sub.lastOrderId && (
        <p>
          <Link href={`/order/${sub.lastOrderId}`} className="inline-link">
            Open the latest order →
          </Link>
        </p>
      )}
    </div>
  );
}
