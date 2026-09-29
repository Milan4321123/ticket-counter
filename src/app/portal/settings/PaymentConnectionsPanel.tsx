'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/money';
import { ROUTE_FEES, providerCutCents, sellerNetCents } from '@/lib/paymentFees';
import type { StepUpRequest } from '../events/[id]/edit/save';

export interface ConnectionView {
  provider: 'paypal' | 'stripe';
  accountLabel: string;
  sandbox: boolean;
  updatedAt: string;
}

interface Props {
  connections: ConnectionView[];
  currency: string;
  /** A typical price on this seller's listings, for the fee example. */
  exampleCents: number;
}

/**
 * "Get paid instantly": the seller's own PayPal app and/or Stripe key.
 *
 * Nothing here is the platform's account. Every payment made through a
 * connection lands in the seller's own PayPal or Stripe balance — which is
 * also why the seller has to bring their own: the platform holds no money and
 * pays nothing out. The panel says so, shows what each route costs (the
 * provider's published fee, dated), and keeps the actual keys off the screen
 * once saved.
 */
export default function PaymentConnectionsPanel({ connections, currency, exampleCents }: Props) {
  const router = useRouter();
  const paypal = connections.find((c) => c.provider === 'paypal') ?? null;
  const stripe = connections.find((c) => c.provider === 'stripe') ?? null;

  return (
    <div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Bank transfer is free and always works — buyers reserve, send you the money, and you confirm it. If you
        would rather have the money <strong>the same second</strong> and the {`QR codes`} go out by themselves,
        connect your <strong>own</strong> PayPal or Stripe account here. Buyers then get a &ldquo;Pay now&rdquo;
        option next to the transfer. The money still goes straight to you — we only ask PayPal or Stripe to open
        the payment page on your account, and we never see your buyers&rsquo; card numbers or your balance.
      </p>

      <FeeTable currency={currency} exampleCents={exampleCents} />

      <ProviderCard
        provider="paypal"
        title="PayPal Checkout"
        connection={paypal}
        onChanged={() => router.refresh()}
      />
      <ProviderCard
        provider="stripe"
        title="Card payments via Stripe"
        connection={stripe}
        onChanged={() => router.refresh()}
      />

      <p className="muted small" style={{ margin: '14px 0 0' }}>
        After connecting, open each listing&rsquo;s editor → <strong>How you get paid</strong> and tick which ways
        that listing offers. You can keep bank transfer on beside the instant route, or switch it off.
      </p>
    </div>
  );
}

function FeeTable({ currency, exampleCents }: { currency: string; exampleCents: number }) {
  const checked = ROUTE_FEES[0].checkedOn;
  return (
    <div style={{ overflowX: 'auto', margin: '12px 0 18px' }}>
      <table className="table small" style={{ minWidth: 520 }}>
        <thead>
          <tr>
            <th>Way to pay</th>
            <th>Provider keeps</th>
            <th>On {formatMoney(exampleCents, currency)} you get</th>
            <th>Codes go out</th>
          </tr>
        </thead>
        <tbody>
          {ROUTE_FEES.map((fee) => (
            <tr key={fee.route}>
              <td>{fee.label}</td>
              <td>
                {fee.percent === 0 && fee.fixedCents === 0
                  ? 'Nothing'
                  : `${fee.percent.toLocaleString('en-GB')} % + ${formatMoney(fee.fixedCents, currency)}${
                      fee.vatPercentOnFee ? ` (+${fee.vatPercentOnFee} % VAT on the fee)` : ''
                    }`}
              </td>
              <td>
                <strong>{formatMoney(sellerNetCents(exampleCents, fee), currency)}</strong>
                {providerCutCents(exampleCents, fee) > 0 && (
                  <span className="muted"> (−{formatMoney(providerCutCents(exampleCents, fee), currency)})</span>
                )}
              </td>
              <td>{fee.route === 'transfer' || fee.route === 'paypalme' ? 'When you confirm' : 'Instantly'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small" style={{ margin: '6px 0 0' }}>
        Provider fees as published on {checked}; they change, so check{' '}
        <a href="https://www.paypal.com/de/business/paypal-business-fees" target="_blank" rel="noopener noreferrer">
          PayPal&rsquo;s
        </a>{' '}
        and{' '}
        <a href="https://stripe.com/en-de/pricing" target="_blank" rel="noopener noreferrer">
          Stripe&rsquo;s
        </a>{' '}
        pricing pages before deciding. {`We charge nothing on any route.`}
      </p>
    </div>
  );
}

function ProviderCard({
  provider,
  title,
  connection,
  onChanged,
}: {
  provider: 'paypal' | 'stripe';
  title: string;
  connection: ConnectionView | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [sandbox, setSandbox] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);
  const [answer, setAnswer] = useState('');
  const [removing, setRemoving] = useState(false);

  const body = () => (provider === 'paypal' ? { clientId, clientSecret: secret, sandbox } : { secretKey: secret });

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/payments/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body()),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; stepUp?: StepUpRequest } | null;
      if (res.status === 403 && data?.stepUp) {
        setStepUp(data.stepUp);
        setAnswer('');
        return;
      }
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      setSaved(true);
      setOpen(false);
      setClientId('');
      setSecret('');
      onChanged();
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmStepUp(e: React.FormEvent) {
    e.preventDefault();
    if (!stepUp || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/payout/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stepUp.method === 'password' ? { password: answer } : { code: answer }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'That did not work. Please try again.');
        return;
      }
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
      return;
    } finally {
      setBusy(false);
    }
    setStepUp(null);
    await save();
  }

  async function remove() {
    if (removing) return;
    if (!window.confirm(`Remove your ${provider === 'paypal' ? 'PayPal' : 'Stripe'} connection? Listings offering it fall back to bank transfer.`)) return;
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/payments/${provider}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'Could not remove that just now.');
        return;
      }
      onChanged();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setRemoving(false);
    }
  }

  const help =
    provider === 'paypal' ? (
      <ol className="small muted" style={{ margin: '6px 0 10px', paddingLeft: 18 }}>
        <li>
          You need a <strong>PayPal Business</strong> account (free to upgrade from a personal one).
        </li>
        <li>
          Go to{' '}
          <a href="https://developer.paypal.com/dashboard/applications/live" target="_blank" rel="noopener noreferrer">
            developer.paypal.com → Apps &amp; Credentials
          </a>
          , pick <strong>Live</strong>, and create an app (any name).
        </li>
        <li>Copy its Client ID and Secret here. We store the secret encrypted and never show it again.</li>
      </ol>
    ) : (
      <ol className="small muted" style={{ margin: '6px 0 10px', paddingLeft: 18 }}>
        <li>
          Create a free account at{' '}
          <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer">
            stripe.com
          </a>{' '}
          and activate it (business details and the bank account Stripe pays you out to).
        </li>
        <li>
          Go to <strong>Developers → API keys</strong> and create a <strong>restricted key</strong> with{' '}
          <em>Checkout Sessions: write</em> and <em>Account: read</em> — or use the standard secret key.
        </li>
        <li>Paste it here. We store it encrypted and never show it again.</li>
      </ol>
    );

  return (
    <div className="card" style={{ marginTop: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <strong>{title}</strong>{' '}
          {connection ? (
            <>
              <span className="badge badge-green">Connected</span>{' '}
              {connection.sandbox && <span className="badge badge-amber">Test mode</span>}
              <div className="muted small" style={{ marginTop: 2 }} translate={connection.accountLabel ? 'no' : undefined}>
                {connection.accountLabel || 'Your own account'}
              </div>
            </>
          ) : (
            <span className="badge">Not connected</span>
          )}
          {saved && <span className="badge badge-green" style={{ marginLeft: 6 }}>Saved ✓</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!open && (
            <button type="button" className="btn btn-sm" onClick={() => setOpen(true)} disabled={removing}>
              {connection ? 'Replace' : 'Connect'}
            </button>
          )}
          {connection && (
            <button type="button" className="btn btn-sm btn-danger" onClick={remove} disabled={removing || busy}>
              {removing ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="notice notice-error small" style={{ marginTop: 10 }}>{error}</div>}

      {stepUp ? (
        <form onSubmit={confirmStepUp} style={{ marginTop: 12 }}>
          <div className="notice">
            <strong>One more check before this takes effect.</strong>
            <p className="small" style={{ margin: '6px 0 0' }}>
              You are replacing the account your buyers pay into — the one change we ask twice about.
            </p>
          </div>
          <div className="field" style={{ maxWidth: 320 }}>
            <label htmlFor={`stepup-${provider}`}>
              {stepUp.method === 'password' ? 'Your account password' : 'Confirmation code'}
            </label>
            <input
              id={`stepup-${provider}`}
              className={stepUp.method === 'password' ? 'input' : 'input mono'}
              type={stepUp.method === 'password' ? 'password' : 'text'}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoFocus
              autoComplete={stepUp.method === 'password' ? 'current-password' : 'one-time-code'}
              maxLength={stepUp.method === 'password' ? 200 : 6}
            />
            <p className="muted small" style={{ margin: '6px 0 0' }}>{stepUp.hint}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-brand" disabled={busy || answer.trim() === ''}>
              {busy ? 'Confirming…' : 'Confirm and save'}
            </button>
            <button type="button" className="btn" onClick={() => setStepUp(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          style={{ marginTop: 12 }}
        >
          {help}
          {provider === 'paypal' && (
            <div className="field">
              <label htmlFor="pp-client-id">Client ID</label>
              <input
                id="pp-client-id"
                className="input mono"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="AXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor={`${provider}-secret`}>{provider === 'paypal' ? 'Secret' : 'Secret key'}</label>
            <input
              id={`${provider}-secret`}
              className="input mono"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={provider === 'paypal' ? 'EXxxxxxxxx…' : 'rk_live_… or sk_live_…'}
            />
          </div>
          {provider === 'paypal' && (
            <label className="checkbox-row small" style={{ fontWeight: 400 }}>
              <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
              <span>These are <strong>Sandbox</strong> (test) credentials — no real money moves.</span>
            </label>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" className="btn btn-brand" disabled={busy || !secret.trim() || (provider === 'paypal' && !clientId.trim())}>
              {busy ? <span className="spinner" aria-hidden /> : null}
              {busy ? 'Checking with ' + (provider === 'paypal' ? 'PayPal' : 'Stripe') + '…' : 'Check and save'}
            </button>
            <button type="button" className="btn" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
