'use client';

// "Seating" — draw the hall for reserved seating (lib/seats). Sections of rows
// × seats, each sold as one ticket type; tap a seat in the preview to take it
// out of sale (a pillar, the sound desk). Saving sets each seated type's
// capacity to its number of seats.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import SeatMapView, { type SeatMapData, type SeatMapSection } from '@/components/SeatMapView';

interface Props {
  eventId: string;
  initial: SeatMapData | null;
  tiers: { tierKey: string; name: string; seatsPerUnit: number }[];
  taken: Record<string, 'held' | 'sold'>;
}

function blankSection(i: number, tierKey: string, firstRow: string): SeatMapSection {
  return { id: `S${i + 1}`, name: i === 0 ? 'Front' : `Section ${i + 1}`, tierKey, rows: 4, seatsPerRow: 12, firstRow, aislesAfter: [6], blocked: [] };
}

const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export default function SeatingPanel({ eventId, initial, tiers, taken }: Props) {
  const router = useRouter();
  const seatable = tiers.filter((t) => t.seatsPerUnit === 1);
  const [map, setMap] = useState<SeatMapData>(
    initial ?? { enabled: false, stageLabel: 'Stage', sections: seatable[0] ? [blankSection(0, seatable[0].tierKey, 'A')] : [] }
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSection = (i: number, patch: Partial<SeatMapSection>) =>
    setMap((m) => ({ ...m, sections: m.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  function addSection() {
    const last = map.sections[map.sections.length - 1];
    const nextRow = last ? ROW_LETTERS[Math.min(ROW_LETTERS.length - 1, ROW_LETTERS.indexOf(last.firstRow) + last.rows)] : 'A';
    const used = new Set(map.sections.map((s) => s.id));
    let n = map.sections.length;
    while (used.has(`S${n + 1}`)) n++;
    setMap((m) => ({ ...m, sections: [...m.sections, { ...blankSection(n, seatable[0]?.tierKey ?? '', nextRow), name: `Section ${n + 1}` }] }));
  }

  function toggleBlocked(seatId: string) {
    const sec = map.sections.findIndex((s) => seatId.startsWith(`${s.id}-`));
    if (sec < 0) return;
    const b = new Set(map.sections[sec].blocked);
    if (b.has(seatId)) b.delete(seatId);
    else b.add(seatId);
    setSection(sec, { blocked: [...b] });
  }

  const totalSeats = map.sections.reduce((n, s) => n + s.rows * s.seatsPerRow - s.blocked.length, 0);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/seat-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (seatable.length === 0) {
    return (
      <div className="card">
        <div className="card-title">Reserved seating</div>
        <p className="muted small" style={{ margin: 0 }}>
          Add a ticket type first (one seat per ticket). Then you can lay out your hall here and let buyers pick exact seats.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 18 }}>
      <div>
        <div className="card-title">Reserved seating</div>
        <p className="muted small" style={{ margin: 0 }}>
          Lay out your hall and buyers pick exact seats at checkout — every seat can only be sold once. Each section is
          sold as one ticket type; saving sets that type&rsquo;s capacity to its number of seats.
        </p>
      </div>

      {error && <div className="notice notice-error" style={{ margin: 0 }}>{error}</div>}

      <label className="checkbox-row" style={{ margin: 0 }}>
        <input type="checkbox" checked={map.enabled} onChange={(e) => setMap((m) => ({ ...m, enabled: e.target.checked }))} />
        <span>
          <strong>Let buyers choose their seats</strong>
          <span className="muted small" style={{ display: 'block' }}>
            {totalSeats} seats in {map.sections.length} section{map.sections.length === 1 ? '' : 's'}
          </span>
        </span>
      </label>

      <div className="field" style={{ margin: 0, maxWidth: 260 }}>
        <label htmlFor="seat-stage">Stage label</label>
        <input
          id="seat-stage"
          className="input"
          value={map.stageLabel}
          maxLength={30}
          onChange={(e) => setMap((m) => ({ ...m, stageLabel: e.target.value }))}
        />
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {map.sections.map((s, i) => (
          <div key={s.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-elevated)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor={`sn-${s.id}`}>Section</label>
                <input id={`sn-${s.id}`} className="input" value={s.name} maxLength={30} onChange={(e) => setSection(i, { name: e.target.value })} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor={`st-${s.id}`}>Sold as</label>
                <select id={`st-${s.id}`} className="input" value={s.tierKey} onChange={(e) => setSection(i, { tierKey: e.target.value })}>
                  {seatable.map((t) => (
                    <option key={t.tierKey} value={t.tierKey}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor={`sr-${s.id}`}>Rows</label>
                <input id={`sr-${s.id}`} className="input" type="number" min={1} max={30} value={s.rows} onChange={(e) => setSection(i, { rows: Math.max(1, Math.min(30, Math.floor(Number(e.target.value) || 1))) })} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor={`sp-${s.id}`}>Seats per row</label>
                <input id={`sp-${s.id}`} className="input" type="number" min={1} max={40} value={s.seatsPerRow} onChange={(e) => setSection(i, { seatsPerRow: Math.max(1, Math.min(40, Math.floor(Number(e.target.value) || 1))) })} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor={`sf-${s.id}`}>First row</label>
                <select id={`sf-${s.id}`} className="input" value={s.firstRow} onChange={(e) => setSection(i, { firstRow: e.target.value })}>
                  {ROW_LETTERS.split('').map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor={`sa-${s.id}`}>Aisle after seat</label>
                <input
                  id={`sa-${s.id}`}
                  className="input"
                  placeholder="e.g. 6, 12"
                  defaultValue={s.aislesAfter.join(', ')}
                  onBlur={(e) =>
                    setSection(i, {
                      aislesAfter: e.target.value
                        .split(',')
                        .map((x) => Math.floor(Number(x.trim())))
                        .filter((n) => n >= 1 && n < s.seatsPerRow),
                    })
                  }
                />
              </div>
            </div>
            {map.sections.length > 1 && (
              <button
                type="button"
                className="btn btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => setMap((m) => ({ ...m, sections: m.sections.filter((_, j) => j !== i) }))}
              >
                Remove section
              </button>
            )}
          </div>
        ))}
        {map.sections.length < 6 && (
          <button type="button" className="btn btn-sm" onClick={addSection} style={{ justifySelf: 'start' }}>
            + Add a section
          </button>
        )}
      </div>

      <div>
        <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>
          Preview — tap a seat to take it out of sale
        </div>
        <div style={{ padding: 14, borderRadius: 14, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <SeatMapView
            map={map}
            taken={taken}
            selected={new Set(map.sections.flatMap((s) => s.blocked))}
            mode="block"
            onToggle={toggleBlocked}
            legend={Object.fromEntries(seatable.map((t) => [t.tierKey, { label: t.name }]))}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" className="btn btn-brand" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save seating'}
        </button>
        {saved && <span className="badge badge-green">Saved ✓</span>}
      </div>
    </div>
  );
}
