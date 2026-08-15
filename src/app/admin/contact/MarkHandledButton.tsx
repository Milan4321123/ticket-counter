'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  requestId: string;
}

interface UpdateResponse {
  ok?: boolean;
  error?: string;
}

/** Ticks one enquiry off the inbox once you have replied to it. */
export default function MarkHandledButton({ requestId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markHandled() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contact/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handled: true }),
      });
      const data = (await res.json().catch(() => null)) as UpdateResponse | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        setBusy(false);
        return;
      }
      router.refresh();
      setBusy(false);
    } catch {
      setError('Could not reach the server — please try again.');
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 130 }}>
      <button type="button" className="btn btn-sm" onClick={() => void markHandled()} disabled={busy}>
        {busy ? 'Working…' : 'Mark handled'}
      </button>
      {error && (
        <div className="notice notice-error small" style={{ margin: 0 }}>
          {error}
        </div>
      )}
    </div>
  );
}
