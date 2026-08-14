'use client';

import { useState } from 'react';

/**
 * Lets a buyer whose connection dropped mid-payment re-run the (idempotent)
 * capture: if PayPal says they paid, their tickets appear; if not, they see a
 * clear "not charged" message.
 */
export default function CheckPaymentButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST' });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setMessage(data?.error || 'We could not check the payment right now — please try again in a minute.');
    } catch {
      setMessage('We could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn" onClick={check} disabled={busy}>
        {busy ? 'Checking…' : 'I already paid — check again'}
      </button>
      {message && (
        <p className="muted small" style={{ marginTop: 10 }}>
          {message}
        </p>
      )}
    </div>
  );
}
