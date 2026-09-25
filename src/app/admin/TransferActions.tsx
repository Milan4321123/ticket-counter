'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  orderId: string;
  buyerName: string;
  /** Whose name the buyer said the money would arrive under, or ''. */
  payerName?: string;
  amountDisplay: string;
  reference: string;
  /**
   * 'awaiting' (default): live reservation — offers "Payment received" + Cancel.
   * 'late': the reservation already expired/was cancelled, but the buyer's
   * transfer turned up — offers only a "Late payment received" confirm, which
   * revives the order if seats are still available (else the server returns a
   * clear sold-out/refund message).
   */
  variant?: 'awaiting' | 'late';
}

/** A button that reads as a link — the two "match the other way" switches. */
const buttonAsLink: React.CSSProperties = {
  background: 'none',
  border: 0,
  padding: 0,
  cursor: 'pointer',
  color: 'var(--brand-text)',
  fontWeight: 600,
  font: 'inherit',
};

type Busy = 'confirm' | 'cancel' | null;
type Done = 'paid' | 'cancelled' | null;

/**
 * Actions for one awaiting-bank-transfer reservation. Marking an order paid
 * is a deliberate two-step confirm: the organizer must type the last 4
 * characters of the payment reference as read off the bank statement, so a
 * stray click can never issue tickets.
 *
 * ORGANIZER-ONLY, despite the folder. It lives under /app/admin because that is
 * where it was written, and the organizer portal imports it from here — but no
 * admin page renders it any more, and the routes it calls now accept only the
 * organizer who owns the event. The platform owner cannot confirm a transfer he
 * has no way of seeing arrive: the money goes to the organizer's bank account.
 */
export default function TransferActions({
  orderId,
  buyerName,
  payerName = '',
  amountDisplay,
  reference,
  variant = 'awaiting',
}: Props) {
  const isLate = variant === 'late';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  /**
   * Which question the organizer is answering.
   *
   * Defaults to the reference, which is the stronger check and the one a bank
   * transfer actually carries. The sender is there for the case the reference
   * cannot cover: PayPal has nowhere to put one, so the money arrives as a name
   * and an amount — and an organizer with no way to confirm that is an organizer
   * who leaves a paying buyer waiting.
   */
  const [mode, setMode] = useState<'reference' | 'sender'>('reference');
  const isReferenceMode = mode === 'reference';
  // A reference is exactly 4 characters; a name only has to be a real word, and
  // the server has the final say on whether it is the RIGHT one.
  const canSubmit = isReferenceMode ? typed.length === 4 : typed.trim().length >= 3;
  const [busy, setBusy] = useState<Busy>(null);
  const [done, setDone] = useState<Done>(null);
  const [emailSent, setEmailSent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function confirmPaid() {
    if (busy !== null || !canSubmit) return;
    setBusy('confirm');
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The server accepts either and works out which one this was; sending
        // it under the matching key keeps the request readable in a log.
        body: JSON.stringify(
          mode === 'reference' ? { referenceConfirmation: typed } : { senderConfirmation: typed }
        ),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; ticketCount?: number; emailSent?: boolean; error?: string }
        | null;
      if (!res.ok) {
        // 400 = the typed characters do not match; 409 = sold out meanwhile.
        setError(data?.error ?? 'Something went wrong — please try again.');
        setBusy(null);
        inputRef.current?.focus();
        return;
      }
      setEmailSent(data?.emailSent !== false);
      setDone('paid');
      setOpen(false);
      setBusy(null);
      router.refresh();
    } catch {
      setError('Could not reach the server — please try again.');
      setBusy(null);
    }
  }

  async function cancelReservation() {
    if (busy !== null) return;
    if (
      !window.confirm(
        `Cancel the reservation for ${buyerName}?\n\nThe seats go back on sale. Only do this if you are sure no payment is coming.`
      )
    ) {
      return;
    }
    setBusy('cancel');
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/cancel-transfer`, { method: 'POST' });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        setBusy(null);
        return;
      }
      setDone('cancelled');
      setBusy(null);
      router.refresh();
    } catch {
      setError('Could not reach the server — please try again.');
      setBusy(null);
    }
  }

  if (done === 'paid') {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, whiteSpace: 'normal' }}>
        <span className="badge badge-green">Tickets sent ✓</span>
        {!emailSent && (
          <span className="muted small">The email could not be sent — use Resend on the orders page.</span>
        )}
      </span>
    );
  }

  if (done === 'cancelled') {
    return <span className="badge badge-red">Reservation cancelled</span>;
  }

  if (!open) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        <button
          type="button"
          className={isLate ? 'btn btn-sm' : 'btn btn-primary btn-sm'}
          onClick={() => {
            setError(null);
            setTyped('');
            setOpen(true);
          }}
          disabled={busy !== null}
        >
          {isLate ? 'Late payment received' : 'Payment received'}
        </button>
        {!isLate && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void cancelReservation()}
            disabled={busy !== null}
          >
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel reservation'}
          </button>
        )}
        {error && (
          <span className="badge badge-red" title={error}>
            Failed
          </span>
        )}
      </span>
    );
  }

  return (
    <form
      className="confirm-panel anim-fade-up"
      style={{ whiteSpace: 'normal', minWidth: 280, maxWidth: 400, textAlign: 'left' }}
      onSubmit={(e) => {
        e.preventDefault();
        void confirmPaid();
      }}
    >
      {/* Everything the organizer could possibly be looking at on a statement,
          in one line: the amount, who it should be from, and the reference. It
          used to name only the reference, which is exactly the thing a PayPal
          payment does not carry. */}
      <p className="small" style={{ marginTop: 0, marginBottom: 10 }}>
        Confirm <strong>{amountDisplay}</strong> from <strong translate="no">{buyerName}</strong>
        {payerName.trim() ? (
          <>
            {' '}
            (paying as <strong translate="no">{payerName.trim()}</strong>)
          </>
        ) : null}
        , reference <span className="mono">{reference}</span>
      </p>
      {isLate && (
        <p className="muted small" style={{ marginTop: 0, marginBottom: 10 }}>
          This reservation had expired. Confirming re-books the seats if any are still available — if the event has
          since sold out, you&rsquo;ll be told to refund the buyer instead.
        </p>
      )}
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor={`confirm-ref-${orderId}`}>
          {isReferenceMode
            ? 'Type the LAST 4 characters of the reference as shown on your statement'
            : 'Type the name the money came from, as shown on your statement'}
        </label>
        <input
          id={`confirm-ref-${orderId}`}
          ref={inputRef}
          className={isReferenceMode ? 'input input-code' : 'input'}
          value={typed}
          onChange={(e) =>
            setTyped(isReferenceMode ? e.target.value.toUpperCase().slice(0, 4) : e.target.value.slice(0, 120))
          }
          maxLength={isReferenceMode ? 4 : 120}
          autoComplete="off"
          autoCapitalize={isReferenceMode ? 'characters' : 'words'}
          spellCheck={false}
          placeholder={isReferenceMode ? '····' : 'e.g. THAPA RAMESH'}
          disabled={busy !== null}
          aria-label={
            isReferenceMode ? 'Last 4 characters of the payment reference' : 'Name the payment came from'
          }
        />
        {/* The way out for the case the reference cannot answer. Surnames come
            first on plenty of statements and the case is anyone's guess, so the
            match is on WORDS — "THAPA RAMESH" is accepted for Ramesh Thapa. */}
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          {isReferenceMode ? (
            <>
              No reference on it? That is normal for PayPal — it has nowhere to put one.{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('sender');
                  setTyped('');
                  setError(null);
                  inputRef.current?.focus();
                }}
                disabled={busy !== null}
                style={buttonAsLink}
              >
                Match the sender&rsquo;s name instead →
              </button>
            </>
          ) : (
            <>
              Any order, any capitalisation — just the name, or part of it.{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('reference');
                  setTyped('');
                  setError(null);
                  inputRef.current?.focus();
                }}
                disabled={busy !== null}
                style={buttonAsLink}
              >
                ← Back to the reference
              </button>
            </>
          )}
        </p>
      </div>
      {error && (
        <div className="notice notice-error small" style={{ marginBottom: 10 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="submit" className="btn btn-danger btn-sm" disabled={!canSubmit || busy !== null}>
          {busy === 'confirm' ? 'Issuing tickets…' : 'Yes — money received, issue tickets'}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setOpen(false);
            setTyped('');
            setError(null);
          }}
          disabled={busy !== null}
        >
          Not yet
        </button>
      </div>
    </form>
  );
}
