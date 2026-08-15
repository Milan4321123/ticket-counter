'use client';

import { useState } from 'react';

interface Summary {
  eventName: string;
  items: string;
  ticketCount: number;
  total: string;
  reservedOn: string;
}

interface LookupResponse {
  ok?: boolean;
  summary?: Summary;
  sent?: boolean;
  reason?: string | null;
  error?: string;
}

/**
 * The platform owner's support backstop: someone writes in having lost their
 * ticket email, quotes their payment reference, and their tickets go out again.
 *
 * Two steps on purpose — look up first, so the owner can check the event and
 * the number of tickets match what the person described before an email leaves.
 * Neither step ever shows a name or an email address; the tickets go to the
 * address already on the order.
 */
export default function SupportResend() {
  const [reference, setReference] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<'lookup' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentNote, setSentNote] = useState<string | null>(null);

  async function call(confirm: boolean) {
    if (busy !== null) return;
    setBusy(confirm ? 'send' : 'lookup');
    setError(null);
    setSentNote(null);
    try {
      const res = await fetch('/api/admin/support/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: reference.trim(), confirm }),
      });
      const data = (await res.json().catch(() => null)) as LookupResponse | null;
      if (!res.ok || !data?.ok) {
        setSummary(null);
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      setSummary(data.summary ?? null);
      if (confirm) {
        setSentNote(
          data.sent
            ? 'Sent — the tickets are on their way to the address on the order.'
            : `The email could not be sent${data.reason ? ` (${data.reason})` : ''}. The organizer can re-send it from their portal.`
        );
      }
    } catch {
      setError('Could not reach the server — please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="muted small" style={{ marginTop: 0 }}>
        If a buyer writes to you because their tickets never arrived, ask them for the payment
        reference from their confirmation email or bank statement and paste it here. You will see
        which event and how many tickets — never who they are — and the tickets go back out to the
        address already on the order. Confirming a payment or cancelling a reservation is the
        organizer&rsquo;s job: the money went to their bank account, so only they can see it arrive.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void call(false);
        }}
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <div className="field" style={{ flex: '1 1 260px', marginBottom: 0 }}>
          <label htmlFor="support-reference">Payment reference</label>
          <input
            id="support-reference"
            className="input mono"
            value={reference}
            onChange={(e) => {
              setReference(e.target.value);
              setSummary(null);
              setSentNote(null);
              setError(null);
            }}
            placeholder="TICKETS-AB12CD34"
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
          />
        </div>
        <button type="submit" className="btn" disabled={busy !== null || !reference.trim()}>
          {busy === 'lookup' ? 'Looking up…' : 'Find the order'}
        </button>
      </form>

      {error && (
        <div className="notice notice-error small" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {summary && (
        <div className="anim-fade-up" style={{ marginTop: 14 }}>
          <div className="summary-row">
            <span className="muted">Event</span>
            <span>{summary.eventName}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Tickets</span>
            <span>
              {summary.items || '—'} ({summary.ticketCount} QR code
              {summary.ticketCount === 1 ? '' : 's'})
            </span>
          </div>
          <div className="summary-row">
            <span className="muted">Total</span>
            <span>{summary.total}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Booked</span>
            <span className="mono small">{summary.reservedOn}</span>
          </div>
          {sentNote ? (
            <div className="notice notice-success small" style={{ marginTop: 12 }}>
              {sentNote}
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => void call(true)}
              disabled={busy !== null}
            >
              {busy === 'send' ? 'Sending…' : 'Send these tickets again'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
