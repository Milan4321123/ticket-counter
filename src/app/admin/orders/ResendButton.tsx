'use client';

import { useState } from 'react';

type ResendState = 'idle' | 'busy' | 'sent' | 'failed';

/** Internal reason codes, in words the person fixing it can act on. */
function explain(reason?: string): string | null {
  switch (reason) {
    case 'email-not-configured':
      return 'Sending is switched off — SMTP_HOST or a From address is missing.';
    case 'order-not-found':
      return 'That order no longer exists.';
    case 'no-tickets':
      return 'This order has no tickets to send.';
    default:
      return reason ?? null;
  }
}

export default function ResendButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<ResendState>('idle');
  const [reason, setReason] = useState<string | null>(null);

  async function onResend() {
    if (state === 'busy') return;
    setState('busy');
    setReason(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/resend`, { method: 'POST' });
      const data = (await res.json().catch(() => null)) as
        | { sent?: boolean; reason?: string; detail?: string }
        | null;
      if (res.ok && data?.sent) {
        setState('sent');
      } else {
        setState('failed');
        // Prefer what the mail server said over the internal code. 'send-failed'
        // is true and useless; "535 Authentication failed" names the fix.
        setReason(data?.detail || explain(data?.reason) || 'Email could not be sent.');
      }
    } catch {
      setState('failed');
      setReason('Could not reach the server.');
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
      <button type="button" className="btn btn-sm" onClick={onResend} disabled={state === 'busy'}>
        {state === 'busy' ? 'Sending…' : state === 'sent' ? 'Send again' : 'Resend email'}
      </button>
      {state === 'sent' && <span className="badge badge-green">Sent</span>}
      {/* The reason shown, not hidden in a tooltip. A red badge saying only
          "Failed" sends the owner to the server logs, which is where an evening
          goes. Hover text is also invisible on a phone. */}
      {state === 'failed' && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, whiteSpace: 'normal' }}>
          <span className="badge badge-red">Failed</span>
          {reason && (
            <span className="mono small" style={{ color: 'var(--danger, #f87171)', maxWidth: 320 }}>
              {reason}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
