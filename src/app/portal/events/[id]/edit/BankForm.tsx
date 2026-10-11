'use client';

import { useRef, useState } from 'react';
import type { EventKind } from '@/lib/types';
import { vocabFor } from '@/lib/vocab';
import { isPaypalMeLink, paypalLinkFor } from '@/lib/paypalLink';
import PaypalQrUpload from './PaypalQrUpload';
import { useRouter } from 'next/navigation';
import { saveEvent, type StepUpRequest } from './save';

interface QueuedChange {
  holder: string;
  iban: string;
  paypal: string;
  /** Unix ms at which buyers start being given this account. */
  effectiveAt: number;
}

interface Props {
  eventId: string;
  /** Event or shop — decides the nouns in the explanatory copy. See lib/vocab. */
  kind: EventKind;
  initial: {
    bankAccountHolder: string;
    bankIban: string;
    bankBic: string;
    bankName: string;
    paypalAccount: string;
  };
  /** A confirmed change still inside its waiting period, if any. */
  queued?: QueuedChange | null;
  /** Which ways to pay THIS listing offers — see lib/paymentConnections. */
  routes: { transfer: boolean; paypal: boolean; stripe: boolean };
  /** The seller's connected accounts (label), or null when not connected. */
  connected: { paypal: string | null; stripe: string | null };
}

/** The exact patch that was refused, held so the confirmed save is the same one. */
type PendingPatch = Record<string, unknown>;

export default function BankForm({ eventId, kind, initial, queued, routes, connected }: Props) {
  const router = useRouter();
  const v = vocabFor(kind);
  const [payTransfer, setPayTransfer] = useState(routes.transfer);
  const [payPaypal, setPayPaypal] = useState(routes.paypal);
  const [payStripe, setPayStripe] = useState(routes.stripe);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [holder, setHolder] = useState(initial.bankAccountHolder);
  const [iban, setIban] = useState(initial.bankIban);
  const [bic, setBic] = useState(initial.bankBic);
  const [bankName, setBankName] = useState(initial.bankName);
  const [paypal, setPaypal] = useState(initial.paypalAccount);
  const paypalLink = paypal.trim() ? paypalLinkFor(paypal) : null;
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- The payout confirmation step ------------------------------------
  //
  // Changing where the money goes is the one change in this editor that asks
  // twice. The form does not decide that — it only reacts when the server
  // refuses a save and says which factor this account can complete.
  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);
  const [answer, setAnswer] = useState('');
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const pending = useRef<PendingPatch | null>(null);

  function buildPatch(): PendingPatch {
    return {
      bankAccountHolder: holder,
      bankIban: iban,
      bankBic: bic,
      bankName,
      paypalAccount: paypal,
      payTransfer,
      payPaypal,
      payStripe,
    };
  }

  /** Nothing a buyer could pay by — said before they publish, not after. */
  const noRoute =
    !(payTransfer && (iban.trim() && holder.trim() || paypal.trim())) &&
    !(payPaypal && connected.paypal) &&
    !(payStripe && connected.stripe);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const patch = buildPatch();
    const result = await saveEvent(eventId, patch);
    setBusy(false);

    if (result.stepUp) {
      // Hold the exact patch that was refused: the organizer is confirming THIS
      // change, so anything they type afterwards must not ride in on the same
      // confirmation.
      pending.current = patch;
      setStepUp(result.stepUp);
      setAnswer('');
      setStepUpError(null);
      return;
    }

    if (!result.ok) {
      setError(result.error ?? 'Something went wrong — please try again.');
      return;
    }
    finishSaved();
  }

  function finishSaved() {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2200);
    router.refresh();
  }

  function cancelStepUp() {
    pending.current = null;
    setStepUp(null);
    setAnswer('');
    setStepUpError(null);
  }

  async function confirmStepUp(e: React.FormEvent) {
    e.preventDefault();
    if (stepUpBusy || !stepUp) return;
    const patch = pending.current;
    if (!patch) return cancelStepUp();
    setStepUpBusy(true);
    setStepUpError(null);

    try {
      const body = stepUp.method === 'password' ? { password: answer } : { code: answer };
      const res = await fetch('/api/portal/payout/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setStepUpError(data?.error ?? 'That did not work. Please try again.');
        setStepUpBusy(false);
        return;
      }
    } catch {
      setStepUpError('Could not reach the server — please check your connection and try again.');
      setStepUpBusy(false);
      return;
    }

    // Confirmed — replay the same patch, which now passes the gate.
    const result = await saveEvent(eventId, patch);
    setStepUpBusy(false);
    if (!result.ok) {
      setStepUpError(result.error ?? 'Something went wrong — please try again.');
      return;
    }
    cancelStepUp();
    finishSaved();
  }

  if (stepUp) {
    const isPassword = stepUp.method === 'password';
    const changingBank = iban.trim() !== initial.bankIban.trim() || holder.trim() !== initial.bankAccountHolder.trim();
    const changingPaypal = paypal.trim() !== initial.paypalAccount.trim();
    return (
      <form onSubmit={confirmStepUp}>
        <div className="notice" style={{ marginTop: 0 }}>
          <strong>One more check before this takes effect.</strong>
          <p className="small" style={{ margin: '6px 0 0' }}>
            You are changing the account your buyers pay into. It is the only change in the editor we ask twice
            about, because a transfer a buyer has already sent cannot be called back.
          </p>
        </div>

        {/* What they are actually confirming, in full. A confirmation step that
            does not say what it is confirming is only a speed bump. */}
        <div className="field" style={{ maxWidth: 460 }}>
          <p className="muted small" style={{ margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            About to be saved
          </p>
          {changingBank && (
            <p className="mono small" style={{ margin: '0 0 4px', wordBreak: 'break-word' }}>
              {holder.trim() || <span className="muted">(no account holder)</span>} — {iban.trim() || <span className="muted">(IBAN removed)</span>}
            </p>
          )}
          {changingPaypal && (
            <p className="mono small" style={{ margin: '0 0 4px', wordBreak: 'break-word' }}>
              PayPal: {paypal.trim() || <span className="muted">(removed)</span>}
            </p>
          )}
        </div>

        {stepUpError && <div className="notice notice-error">{stepUpError}</div>}

        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="payout-answer">{isPassword ? 'Your account password' : 'Confirmation code'}</label>
          <input
            id="payout-answer"
            className={isPassword ? 'input' : 'input mono'}
            type={isPassword ? 'password' : 'text'}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoFocus
            autoComplete={isPassword ? 'current-password' : 'one-time-code'}
            inputMode={isPassword ? undefined : 'numeric'}
            maxLength={isPassword ? 200 : 6}
            placeholder={isPassword ? '' : '000000'}
            spellCheck={false}
          />
          <p className="muted small" style={{ margin: '6px 0 0' }}>{stepUp.hint}</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-brand" disabled={stepUpBusy || answer.trim() === ''}>
            {stepUpBusy ? <span className="spinner" aria-hidden /> : null}
            {stepUpBusy ? 'Confirming…' : 'Confirm and save'}
          </button>
          <button type="button" className="btn" onClick={cancelStepUp} disabled={stepUpBusy}>
            Cancel
          </button>
        </div>

        {/* The honest version of the nudge: the password is what we can ask of
            an account with no authenticator, and it is the weaker of the two —
            anyone who has learned the password can answer it. Say so. */}
        {stepUp.urgeEnrolment && (
          <p className="muted small" style={{ margin: '12px 0 0', maxWidth: 460 }}>
            Your password is all that guards this right now, and a password can be learned.{' '}
            <a href="/portal/settings">Set up an authenticator app</a> — then this step asks for a code from your
            phone instead, which someone who only knows your password cannot produce.
          </p>
        )}
      </form>
    );
  }

  async function cancelQueued() {
    if (cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/payout/cancel`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setCancelError(data?.error ?? 'Could not cancel that change. Please try again.');
        setCancelling(false);
        return;
      }
    } catch {
      setCancelError('Could not reach the server — please check your connection and try again.');
      setCancelling(false);
      return;
    }
    setCancelling(false);
    router.refresh();
  }

  /** "de89 3704…" → "DE89 3704 0044 …", as a bank app would show it. */
  const tidyIban = (raw: string) =>
    raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/(.{4})/g, '$1 ')
      .trim();

  const routeCards: { key: 'transfer' | 'paypal' | 'stripe'; icon: string; title: string; line: string; on: boolean; set: (v: boolean) => void; needs: string | null }[] = [
    { key: 'transfer', icon: '🏦', title: 'Bank transfer', line: 'Free · you confirm each payment', on: payTransfer, set: setPayTransfer, needs: null },
    { key: 'paypal', icon: '🅿️', title: 'PayPal checkout', line: connected.paypal ? `Instant · ${connected.paypal}` : 'Instant · into your PayPal', on: payPaypal, set: setPayPaypal, needs: connected.paypal ? null : 'PayPal' },
    { key: 'stripe', icon: '💳', title: 'Card', line: connected.stripe ? `Instant · ${connected.stripe}` : 'Instant · via your Stripe', on: payStripe, set: setPayStripe, needs: connected.stripe ? null : 'Stripe' },
  ];

  return (
    <form onSubmit={submit} className="ks bk">
      <p className="muted small" style={{ margin: 0 }}>
        Buyers pay <strong>you</strong> directly — the money never passes through us.
      </p>

      {/* ---- 1. How buyers pay ---- */}
      <section className="ks-step">
        <h3 className="ks-q">
          <span className="ks-num">1</span> How can buyers pay?
        </h3>
        <div className="ks-modes">
          {routeCards.map((r) => (
            <button
              key={r.key}
              type="button"
              role="checkbox"
              aria-checked={r.on}
              className={`ks-mode${r.on ? ' is-on' : ''}`}
              disabled={Boolean(r.needs)}
              onClick={() => r.set(!r.on)}
            >
              <span className="ks-mode-icon" aria-hidden="true">
                {r.icon}
              </span>
              <strong>
                {r.title} {r.on ? '✓' : ''}
              </strong>
              {/* A connected account's label (its email or name) is the seller's, not page text. */}
              <span translate={r.key !== 'transfer' && r.needs === null ? 'no' : undefined}>{r.line}</span>
            </button>
          ))}
        </div>
        {(!connected.paypal || !connected.stripe) && (
          <p className="muted small" style={{ margin: 0 }}>
            Instant payments need your own account connected once —{' '}
            <a href="/portal/settings#instant-payments">connect PayPal or Stripe in Settings</a>.
          </p>
        )}
        {noRoute && (
          <p className="ks-preview is-bad">Nobody can pay yet — add a bank account or PayPal.Me below, or pick a connected instant route.</p>
        )}
      </section>

      {queued && (
        <div className="notice notice-warn">
          <strong>A change to your payment details is waiting.</strong>
          <p className="small" style={{ margin: '6px 0 0' }}>
            Buyers are still being given the account below. From{' '}
            <strong>
              {new Date(queued.effectiveAt).toLocaleString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>{' '}
            they will be given this instead:
          </p>
          <p className="mono small" style={{ margin: '6px 0 0', wordBreak: 'break-word' }}>
            {queued.holder || '(no account holder)'} — {queued.iban || '(no IBAN)'}
            {queued.paypal ? ` · PayPal: ${queued.paypal}` : ''}
          </p>
          <p className="small" style={{ margin: '8px 0 0' }}>
            If you did not make this change, cancel it now — nothing has moved yet — and then change your
            password.
          </p>
          {cancelError && (
            <div className="notice notice-error small" style={{ marginTop: 8 }}>
              {cancelError}
            </div>
          )}
          <button
            type="button"
            className="btn btn-sm btn-danger"
            style={{ marginTop: 10 }}
            onClick={cancelQueued}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling…' : 'Cancel this change'}
          </button>
        </div>
      )}

      {error && (
        <div className="notice notice-error" style={{ margin: 0 }}>
          {error}
        </div>
      )}

      {/* ---- 2. Where the money goes ---- */}
      <section className="ks-step">
        <h3 className="ks-q">
          <span className="ks-num">2</span> Where should the money go?
        </h3>
        <div className="bf-row">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="bank-holder">Account holder</label>
            <input
              id="bank-holder"
              className="input"
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              maxLength={120}
              autoComplete="name"
              placeholder="Name on the account"
            />
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              Exactly as your bank has it — buyers&rsquo; banking apps check it.
            </p>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="bank-iban">IBAN</label>
            <input
              id="bank-iban"
              className="input mono"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              onBlur={() => setIban((x) => (x.trim() ? tidyIban(x) : x))}
              maxLength={60}
              spellCheck={false}
              autoCapitalize="characters"
              placeholder="DE89 3704 0044 0532 0130 00"
            />
          </div>
        </div>
        <details className="bf-inline" open={bic || bankName ? true : undefined}>
          <summary>+ BIC and bank name (optional)</summary>
          <div className="bf-row">
            <input
              id="bank-bic"
              className="input mono"
              value={bic}
              onChange={(e) => setBic(e.target.value.toUpperCase())}
              maxLength={20}
              spellCheck={false}
              placeholder="BIC, e.g. COBADEFFXXX"
              aria-label="BIC"
            />
            <input
              id="bank-bankname"
              className="input"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              maxLength={120}
              placeholder="Bank, e.g. Commerzbank"
              aria-label="Bank name"
            />
          </div>
        </details>

        <div className="field" style={{ margin: 0, maxWidth: 460 }}>
          <label htmlFor="bank-paypal">PayPal (optional)</label>
          <input
            id="bank-paypal"
            className="input"
            value={paypal}
            onChange={(e) => setPaypal(e.target.value)}
            maxLength={400}
            spellCheck={false}
            autoCapitalize="none"
            placeholder="paypal.me/yourname or you@email.com"
          />
          <PaypalQrUpload onFound={setPaypal} />
          <p className={`small${paypalLink ? '' : ' muted'}`} style={{ margin: '6px 0 0', ...(paypalLink ? { color: 'var(--green)', fontWeight: 600 } : {}) }}>
            {!paypal.trim()
              ? 'A PayPal.Me link, the email on your PayPal, or a screenshot of the QR code in your PayPal app. Offered next to your IBAN; payments arrive under the sender’s name — match it on the orders page.'
              : paypalLink && isPaypalMeLink(paypalLink)
                ? '✓ Buyers get a QR code and a Pay button with the amount already filled in.'
                : paypalLink
                  ? '✓ Buyers get your PayPal QR code and a Pay button. They type the amount themselves.'
                  : 'Works, but buyers must type the amount. A paypal.me/yourname link or your PayPal QR code gives them a ready button.'}
          </p>
        </div>
      </section>

      <div className="ks-save">
        <button type="submit" className="btn btn-brand" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="badge badge-green">Saved ✓</span>}
      </div>
    </form>
  );
}
