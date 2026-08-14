'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ReconcileSummary {
  finalized: string[];
  recovered: string[];
  released: string[];
  needsAttention: string[];
  cleanedPending: number;
}

export default function MaintenancePanel({
  stuckCount,
  mockPaidOrders,
  mockTicketsSold,
}: {
  stuckCount: number;
  mockPaidOrders: number;
  mockTicketsSold: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'reconcile' | 'purge' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  async function runReconcile() {
    setBusy('reconcile');
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/reconcile', { method: 'POST' });
      const data = (await res.json().catch(() => null)) as ReconcileSummary | { error?: string } | null;
      if (!res.ok || !data || !('finalized' in data)) {
        const errMsg = data && 'error' in data ? data.error : null;
        setError(errMsg || 'Reconciliation failed.');
      } else {
        const parts: string[] = [];
        if (data.finalized.length) parts.push(`${data.finalized.length} confirmed paid`);
        if (data.recovered.length) parts.push(`${data.recovered.length} recovered`);
        if (data.released.length) parts.push(`${data.released.length} released back to sale`);
        if (data.needsAttention.length) parts.push(`${data.needsAttention.length} need manual review`);
        if (data.cleanedPending) parts.push(`${data.cleanedPending} abandoned orders cleaned up`);
        setMessage(parts.length ? `Done: ${parts.join(', ')}.` : 'Done — nothing needed fixing.');
        router.refresh();
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(null);
    }
  }

  async function runPurge() {
    if (!confirmPurge) {
      setConfirmPurge(true);
      return;
    }
    setBusy('purge');
    setError(null);
    setMessage(null);
    setConfirmPurge(false);
    try {
      const res = await fetch('/api/admin/purge-mock', { method: 'POST' });
      const data = (await res.json().catch(() => null)) as { orders?: number; tickets?: number; error?: string } | null;
      if (!res.ok || !data || data.error) {
        setError(data?.error || 'Could not delete test orders.');
      } else {
        setMessage(`Deleted ${data.orders ?? 0} test orders and ${data.tickets ?? 0} test tickets.`);
        router.refresh();
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(null);
    }
  }

  const hasMock = mockPaidOrders > 0;
  if (stuckCount === 0 && !hasMock && !message && !error) return null;

  return (
    <div className="card">
      <div className="card-title">Needs attention</div>
      {message && <div className="notice notice-success">{message}</div>}
      {error && <div className="notice notice-error">{error}</div>}
      {stuckCount > 0 && (
        <div className="notice notice-warn">
          {stuckCount} order{stuckCount === 1 ? ' is' : 's are'} stuck mid-payment (crash or lost connection).
          &ldquo;Fix stuck orders&rdquo; checks each one with PayPal: paid buyers get their tickets, unpaid seats go
          back on sale.
        </div>
      )}
      {hasMock && (
        <div className="notice notice-warn">
          The database contains {mockPaidOrders} test-mode order{mockPaidOrders === 1 ? '' : 's'} ({mockTicketsSold}{' '}
          ticket{mockTicketsSold === 1 ? '' : 's'}) with no real payment behind them. Delete them before the real
          sale starts.
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={runReconcile} disabled={busy !== null}>
          {busy === 'reconcile' ? 'Checking with PayPal…' : 'Fix stuck orders'}
        </button>
        {hasMock && (
          <button className="btn btn-sm btn-danger" onClick={runPurge} disabled={busy !== null}>
            {busy === 'purge'
              ? 'Deleting…'
              : confirmPurge
                ? 'Click again to confirm deleting ALL test orders'
                : 'Delete test orders'}
          </button>
        )}
      </div>
    </div>
  );
}
