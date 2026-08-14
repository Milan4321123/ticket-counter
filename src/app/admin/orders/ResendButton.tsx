'use client';

import { useState } from 'react';

type ResendState = 'idle' | 'busy' | 'sent' | 'failed';

export default function ResendButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<ResendState>('idle');
  const [reason, setReason] = useState<string | null>(null);

  async function onResend() {
    if (state === 'busy') return;
    setState('busy');
    setReason(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/resend`, { method: 'POST' });
      const data = (await res.json().catch(() => null)) as { sent?: boolean; reason?: string } | null;
      if (res.ok && data?.sent) {
        setState('sent');
      } else {
        setState('failed');
        setReason(typeof data?.reason === 'string' ? data.reason : 'Email could not be sent.');
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
      {state === 'failed' && (
        <span className="badge badge-red" title={reason ?? undefined}>
          Failed
        </span>
      )}
    </span>
  );
}
