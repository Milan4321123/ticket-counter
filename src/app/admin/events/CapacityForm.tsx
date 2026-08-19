'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface CapacityTier {
  tierKey: string;
  name: string;
  /** In BOOKINGS of this tier — a "Table of 8" tier with cap 10 sells 10 tables. */
  cap: number;
  /** Also in bookings. */
  sold: number;
  /** Seats one booking occupies — the weight between this tier and the room. */
  seatsPerUnit: number;
}

export interface CapacityFormProps {
  eventId: string;
  totalCapacity: number;
  totalSold: number;
  tiers: CapacityTier[];
}

/**
 * Release more tickets for one event.
 *
 * Both numbers are on screen together on purpose. The event's total and each
 * ticket type's limit BOTH gate a sale and the lower one wins, so a form that
 * offered only the total would keep producing events that stay sold out after
 * the admin "fixed" them.
 */
export default function CapacityForm({ eventId, totalCapacity, totalSold, tiers }: CapacityFormProps) {
  const router = useRouter();
  const [total, setTotal] = useState(String(totalCapacity));
  const [caps, setCaps] = useState<Record<string, string>>(
    Object.fromEntries(tiers.map((t) => [t.tierKey, String(t.cap)]))
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/capacity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalCapacity: Number(total),
          tierCaps: Object.fromEntries(Object.entries(caps).map(([k, v]) => [k, Number(v)])),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; changed?: boolean; totalRemaining?: number; error?: string }
        | null;
      if (!res.ok) {
        setMessage({ kind: 'error', text: data?.error ?? 'Could not save. Please try again.' });
        return;
      }
      setMessage({
        kind: 'ok',
        text: data?.changed
          ? `Saved — ${data.totalRemaining} tickets now available to buy.`
          : 'Nothing changed — those were already the limits.',
      });
      router.refresh();
    } catch {
      setMessage({ kind: 'error', text: 'Could not reach the server. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  /** Raise everything to one number — the common case, and the one that is
      easiest to get half-right by hand. */
  function addTickets(extra: number) {
    const nextTotal = totalCapacity + extra;
    setTotal(String(nextTotal));
    // Only lift a tier that is currently the thing standing in the way. A tier
    // the organizer deliberately set small (early bird, students) stays small.
    // The comparison weighs the cap by seatsPerUnit because the cap counts
    // BOOKINGS while the capacity counts SEATS — and the lifted value is
    // converted back to bookings, or a "Table of 8" tier would get a seats
    // number written into its bookings field.
    setCaps((cur) => {
      const next = { ...cur };
      for (const t of tiers) {
        if (t.cap * t.seatsPerUnit >= totalCapacity) {
          next[t.tierKey] = String(Math.ceil(nextTotal / t.seatsPerUnit));
        }
      }
      return next;
    });
    setMessage(null);
  }

  return (
    <form onSubmit={submit}>
      {message && (
        <div className={`notice ${message.kind === 'error' ? 'notice-error' : 'notice-success'}`}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, maxWidth: 170 }}>
          <label htmlFor={`cap-total-${eventId}`}>Total capacity</label>
          <input
            id={`cap-total-${eventId}`}
            className="input mono"
            value={total}
            inputMode="numeric"
            onChange={(e) => setTotal(e.target.value.replace(/[^0-9]/g, ''))}
            disabled={busy}
          />
        </div>

        {tiers.map((t) => (
          <div className="field" style={{ margin: 0, maxWidth: 170 }} key={t.tierKey}>
            <label htmlFor={`cap-${eventId}-${t.tierKey}`}>
              {t.name} <span className="muted small">({t.sold} sold)</span>
            </label>
            <input
              id={`cap-${eventId}-${t.tierKey}`}
              className="input mono"
              value={caps[t.tierKey] ?? ''}
              inputMode="numeric"
              onChange={(e) =>
                setCaps((cur) => ({ ...cur, [t.tierKey]: e.target.value.replace(/[^0-9]/g, '') }))
              }
              disabled={busy}
            />
          </div>
        ))}

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Saving…' : 'Save limits'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <span className="muted small">Release more:</span>
        {[10, 25, 50, 100].map((n) => (
          <button
            key={n}
            type="button"
            className="btn-copy"
            onClick={() => addTickets(n)}
            disabled={busy}
          >
            +{n}
          </button>
        ))}
        <span className="muted small">
          {/* The total is in seats but each type's limit is in bookings, so the
              two floors are named separately — one shared number would be wrong
              for any tier that seats more than one person per booking. */}
          Fills the boxes — nothing is saved until you press Save. {totalSold} seat
          {totalSold === 1 ? '' : 's'} sold so far: the total can&rsquo;t go below that, and no
          type&rsquo;s limit can go below its own sold count.
        </span>
      </div>
    </form>
  );
}
