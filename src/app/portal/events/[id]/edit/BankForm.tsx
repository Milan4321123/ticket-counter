'use client';

import { useRef, useState } from 'react';
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
  initial: {
    bankAccountHolder: string;
    bankIban: string;
    bankBic: string;
    bankName: string;
    paypalAccount: string;
  };
  /** A confirmed change still inside its waiting period, if any. */
  queued?: QueuedChange | null;
}

/** The exact patch that was refused, held so the confirmed save is the same one. */
type PendingPatch = Record<string, unknown>;

export default function BankForm({ eventId, initial, queued }: Props) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [holder, setHolder] = useState(initial.bankAccountHolder);
  const [iban, setIban] = useState(initial.bankIban);
  const [bic, setBic] = useState(initial.bankBic);
  const [bankName, setBankName] = useState(initial.bankName);
  const [paypal, setPaypal] = useState(initial.paypalAccount);
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
    };
  }

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

  return (
    <form onSubmit={submit}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Buyers pay <strong>directly to you</strong> — the ticket money goes straight into your own account, the
        platform never touches it. You confirm each payment on the orders page and the tickets go out by email.
      </p>

      {/* A confirmed change that has not landed yet. This is the whole payoff of
          the waiting period: if it was not you, the account has not actually
          moved and one click puts it back. */}
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

      {error && <div className="notice notice-error">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 16 }}>
        <div className="field">
          <label htmlFor="bank-holder">Account holder</label>
          <input
            id="bank-holder"
            className="input"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            maxLength={120}
            placeholder="Name on the account"
          />
        </div>
        <div className="field">
          <label htmlFor="bank-iban">IBAN</label>
          <input
            id="bank-iban"
            className="input mono"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            maxLength={60}
            spellCheck={false}
            placeholder="DE89 3704 0044 0532 0130 00"
          />
        </div>
        <div className="field">
          <label htmlFor="bank-bic">BIC (optional)</label>
          <input
            id="bank-bic"
            className="input mono"
            value={bic}
            onChange={(e) => setBic(e.target.value)}
            maxLength={20}
            spellCheck={false}
            placeholder="COBADEFFXXX"
          />
        </div>
        <div className="field">
          <label htmlFor="bank-bankname">Bank name (optional)</label>
          <input
            id="bank-bankname"
            className="input"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Commerzbank"
          />
        </div>
      </div>
      {/* PayPal sits in the same form as the IBAN because it is the same thing:
          somewhere for the buyer to send the money, shown to them with the same
          reference. It is NOT a PayPal checkout — nothing is collected on your
          behalf, so there is nothing for us to pay out to you. */}
      <div className="field" style={{ maxWidth: 460 }}>
        <label htmlFor="bank-paypal">PayPal (optional)</label>
        <input
          id="bank-paypal"
          className="input"
          value={paypal}
          onChange={(e) => setPaypal(e.target.value)}
          maxLength={120}
          spellCheck={false}
          placeholder="you@example.com or paypal.me/yourname"
        />
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Offer PayPal as well as the bank transfer. Buyers see this next to your IBAN with the same payment
          reference, send the money themselves, and you confirm it on the orders page exactly as you do a transfer.
          The money lands in <strong>your</strong> PayPal — we never hold it. Leave empty for bank transfer only.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="submit" className="btn btn-brand" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Saving…' : 'Save payment details'}
        </button>
        {saved && <span className="badge badge-green">Saved ✓</span>}
      </div>
    </form>
  );
}
