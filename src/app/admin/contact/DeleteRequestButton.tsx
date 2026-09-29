'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  requestId: string;
  /** Who sent it — for the confirmation, so the right row is the one that goes. */
  name: string;
}

/**
 * Deletes one enquiry outright: the conversation is over, or its sender asked
 * for their message to be erased. Every request is deleted automatically after
 * the retention limit anyway (lib/retention.ts) — this is the sooner button.
 */
export default function DeleteRequestButton({ requestId, name }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (busy) return;
    if (!window.confirm(`Delete the request from ${name}? Their name, email, phone and message are removed for good.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contact/${requestId}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
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
      <button type="button" className="btn btn-sm btn-danger" onClick={() => void remove()} disabled={busy}>
        {busy ? 'Deleting…' : 'Delete'}
      </button>
      {error && (
        <div className="notice notice-error small" style={{ margin: 0 }}>
          {error}
        </div>
      )}
    </div>
  );
}
