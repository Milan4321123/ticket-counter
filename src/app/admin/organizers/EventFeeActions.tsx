'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  eventId: string;
  eventName: string;
  organizerName: string;
  feeDisplay: string;
  reference: string;
}

/**
 * Two-step confirm for one event's platform fee, matching the bank-transfer
 * and signup flows: the admin types the last 4 characters of the event's
 * Verwendungszweck as read off the bank statement, so a stray click can never
 * unlock publishing for an event nobody paid for.
 */
export default function EventFeeActions({ eventId, eventName, organizerName, feeDisplay, reference }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [emailSent, setEmailSent] = useState(true);
  const [emailReason, setEmailReason] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function confirm() {
    if (busy || typed.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceConfirmation: typed }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; emailSent?: boolean; emailReason?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        setBusy(false);
        inputRef.current?.focus();
        return;
      }
      setEmailSent(data.emailSent !== false);
      setEmailReason(data.emailReason);
      setDone(true);
      setOpen(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError('Could not reach the server — please try again.');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, whiteSpace: 'normal' }}>
        <span className="badge badge-green">Fee confirmed ✓</span>
        <span className="muted small">
          {/* "Emailed" only ever meant the provider accepted it. Saying it
              arrived is a promise this platform cannot keep while its From
              address fails alignment and gets filtered downstream. */}
          {emailSent
            ? 'They can publish now. We sent them an email — if they say it never arrived, tell them directly.'
            : `They can publish now, but the email did NOT go out${
                emailReason ? ` (${emailReason})` : ''
              } — tell them yourself.`}
        </span>
      </span>
    );
  }

  if (!open) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setError(null);
            setTyped('');
            setOpen(true);
          }}
          disabled={busy}
        >
          Fee received
        </button>
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
        void confirm();
      }}
    >
      <p className="small" style={{ marginTop: 0, marginBottom: 10 }}>
        Confirm the event fee: <strong>{feeDisplay}</strong> from <strong>{organizerName}</strong> for{' '}
        <strong>{eventName}</strong>, reference <span className="mono">{reference}</span>
      </p>
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor={`confirm-event-fee-${eventId}`}>
          Type the LAST 4 characters of the reference as shown on your bank statement
        </label>
        <input
          id={`confirm-event-fee-${eventId}`}
          ref={inputRef}
          className="input input-code"
          value={typed}
          onChange={(e) => setTyped(e.target.value.toUpperCase().slice(0, 4))}
          maxLength={4}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="····"
          disabled={busy}
          aria-label="Last 4 characters of the event fee payment reference"
        />
      </div>
      {error && (
        <div className="notice notice-error small" style={{ marginBottom: 10 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="submit" className="btn btn-danger btn-sm" disabled={typed.length !== 4 || busy}>
          {busy ? 'Unlocking…' : 'Yes — money received, unlock publishing'}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setOpen(false);
            setTyped('');
            setError(null);
          }}
          disabled={busy}
        >
          Not yet
        </button>
      </div>
    </form>
  );
}
