'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  orderId: string;
  buyerName: string;
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
  amountDisplay,
  reference,
  variant = 'awaiting',
}: Props) {
  const isLate = variant === 'late';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [done, setDone] = useState<Done>(null);
  const [emailSent, setEmailSent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function confirmPaid() {
    if (busy !== null || typed.length !== 4) return;
    setBusy('confirm');
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceConfirmation: typed }),
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
      <p className="small" style={{ marginTop: 0, marginBottom: 10 }}>
        Confirm bank transfer: <strong>{amountDisplay}</strong> from <strong>{buyerName}</strong>, reference{' '}
        <span className="mono">{reference}</span>
      </p>
      {isLate && (
        <p className="muted small" style={{ marginTop: 0, marginBottom: 10 }}>
          This reservation had expired. Confirming re-books the seats if any are still available — if the event has
          since sold out, you&rsquo;ll be told to refund the buyer instead.
        </p>
      )}
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor={`confirm-ref-${orderId}`}>
          Type the LAST 4 characters of the reference as shown on your bank statement
        </label>
        <input
          id={`confirm-ref-${orderId}`}
          ref={inputRef}
          className="input input-code"
          value={typed}
          onChange={(e) => setTyped(e.target.value.toUpperCase().slice(0, 4))}
          maxLength={4}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="····"
          disabled={busy !== null}
          aria-label="Last 4 characters of the payment reference"
        />
      </div>
      {error && (
        <div className="notice notice-error small" style={{ marginBottom: 10 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="submit" className="btn btn-danger btn-sm" disabled={typed.length !== 4 || busy !== null}>
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
