'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface ApplyPayoutNowProps {
  eventId: string;
  fromHolder: string;
  toHolder: string;
  effectiveAt: number;
  /** False when the queued change moves money to a new IBAN/PayPal. */
  allowed: boolean;
}

/**
 * A queued payout change, and — only when it keeps the same IBAN and PayPal —
 * the owner's button to apply it now instead of waiting the day.
 */
export default function ApplyPayoutNow({ eventId, fromHolder, toHolder, effectiveAt, allowed }: ApplyPayoutNowProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function apply() {
    if (busy) return;
    if (!window.confirm(`Apply now? Account holder becomes "${toHolder}". Only do this after confirming with the organizer.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/payout/apply-now`, { method: 'POST' });
      const data = (await res.json().catch(() => null)) as { ordersUpdated?: number; error?: string } | null;
      if (!res.ok) {
        setMessage({ kind: 'error', text: data?.error ?? 'Could not apply. Please try again.' });
        return;
      }
      setMessage({
        kind: 'ok',
        text: `Applied. ${data?.ordersUpdated ?? 0} unpaid order${data?.ordersUpdated === 1 ? '' : 's'} now show the corrected name.`,
      });
      router.refresh();
    } catch {
      setMessage({ kind: 'error', text: 'Could not reach the server. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notice" style={{ marginTop: 12 }}>
      {message && (
        <div className={`notice ${message.kind === 'error' ? 'notice-error' : 'notice-success'}`}>{message.text}</div>
      )}
      <div className="small">
        <strong>Payment change waiting</strong> until{' '}
        <span className="mono">{new Date(effectiveAt).toLocaleString('de-DE')}</span> — account holder{' '}
        <span className="mono">{fromHolder || '—'}</span> → <span className="mono">{toHolder || '—'}</span>
      </div>
      {allowed ? (
        <button type="button" className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={apply} disabled={busy}>
          {busy ? 'Applying…' : 'Apply now (same IBAN, name fix)'}
        </button>
      ) : (
        <div className="muted small" style={{ marginTop: 6 }}>
          This change moves the money to a different IBAN or PayPal, so it waits the full day.
        </div>
      )}
    </div>
  );
}
