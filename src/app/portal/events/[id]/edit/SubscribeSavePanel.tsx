'use client';

// "Subscribe & save" — a shop's repeat-order discount, and who has signed up.
// Saved through its own route (api/portal/events/[id]/subscribe-save).
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  eventId: string;
  initialPct: number;
  /** Why buyers cannot see the offer right now, or '' when they can. */
  blockedBy: string;
  subscribers: { id: string; name: string; items: string; every: string; next: string; status: string; orders: number }[];
}

const CHOICES = [0, 5, 10, 15];

export default function SubscribeSavePanel({ eventId, initialPct, blockedBy, subscribers }: Props) {
  const router = useRouter();
  const [pct, setPct] = useState(initialPct);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(next: number) {
    if (busy) return;
    setPct(next);
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/subscribe-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pct: next }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setPct(initialPct);
        setNote({ ok: false, text: data?.error ?? 'Something went wrong — please try again.' });
        return;
      }
      setNote({ ok: true, text: next === 0 ? 'Subscribe & save is off.' : `Saved — buyers now see “Subscribe & save ${next}%”.` });
      router.refresh();
    } catch {
      setPct(initialPct);
      setNote({ ok: false, text: 'Could not reach the server — please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 14 }}>
      <div>
        <div className="card-title">Subscribe &amp; save</div>
        <p className="muted small" style={{ margin: 0 }}>
          Regulars repeat an order every 1, 2 or 4 weeks for a little less. Nothing is charged automatically — each
          repeat is a normal order paid to you.
        </p>
      </div>
      <div role="radiogroup" aria-label="Subscribe & save discount" className="te-seg" style={{ justifySelf: 'start' }}>
        {CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={pct === c}
            className={pct === c ? 'is-on' : ''}
            disabled={busy}
            onClick={() => void save(c)}
          >
            {c === 0 ? 'Off' : `${c}% off`}
          </button>
        ))}
      </div>
      {note && (
        <p className={note.ok ? 'muted small' : 'small'} role="status" style={{ margin: 0, color: note.ok ? undefined : '#f87171' }}>
          {note.text}
        </p>
      )}
      {pct > 0 && blockedBy && (
        <p className="small" style={{ margin: 0, color: '#fbbf24' }}>
          Not shown to buyers yet: {blockedBy}
        </p>
      )}
      <div>
        <div className="card-title" style={{ fontSize: '1rem' }}>
          Subscribers ({subscribers.filter((s) => s.status === 'active').length} active)
        </div>
        {subscribers.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            Nobody yet. Once someone subscribes they appear here with their next order date.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table small">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Items</th>
                  <th>How often</th>
                  <th>Next</th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.items}</td>
                    <td>{s.every}</td>
                    <td>{s.status === 'active' ? s.next : s.status}</td>
                    <td>{s.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
