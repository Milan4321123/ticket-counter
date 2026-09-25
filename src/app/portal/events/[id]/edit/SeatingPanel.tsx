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

  /** One-tap starting layouts — only while nothing has been sold on the map. */
  const anySold = Object.keys(taken).length > 0;
  const t0 = seatable[0]?.tierKey ?? '';
  const tVip = (seatable.find((t) => /vip|front|premium/i.test(t.name)) ?? seatable[1] ?? seatable[0])?.tierKey ?? '';
  const LAYOUTS: { label: string; sections: SeatMapSection[] }[] = [
    { label: 'Small room · 5 × 10', sections: [{ ...blankSection(0, t0, 'A'), name: 'Seats', rows: 5, seatsPerRow: 10, aislesAfter: [5] }] },
    { label: 'Hall · 10 × 20', sections: [{ ...blankSection(0, t0, 'A'), name: 'Hall', rows: 10, seatsPerRow: 20, aislesAfter: [5, 15] }] },
    {
      label: 'VIP front + main',
      sections: [
        { ...blankSection(0, tVip, 'A'), name: 'VIP', rows: 2, seatsPerRow: 12, aislesAfter: [6] },
        { ...blankSection(1, t0, 'C'), name: 'Main', rows: 8, seatsPerRow: 16, aislesAfter: [8] },
      ],
    },
  ];

  /** − n + for a number that people nudge rather than type. */
  const stepper = (id: string, value: number, min: number, max: number, onChange: (n: number) => void) => (
    <div className="sp-step">
      <button type="button" aria-label="Fewer" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        −
      </button>
      <input
        id={id}
        className="input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Math.floor(Number(e.target.value) || min))))}
      />
      <button type="button" aria-label="More" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        +
      </button>
    </div>
  );

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
          Buyers pick their exact seat at checkout. Each section sells as one ticket type.
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

      {map.enabled && (
      <>
      {!anySold && (
        <div className="ks-presets">
          <span className="muted small">Start from:</span>
          {LAYOUTS.map((l) => (
            <button key={l.label} type="button" className="ks-chip" onClick={() => setMap((m) => ({ ...m, sections: l.sections }))}>
              {l.label}
            </button>
          ))}
        </div>
      )}

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
                {stepper(`sr-${s.id}`, s.rows, 1, 30, (n) => setSection(i, { rows: n }))}
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor={`sp-${s.id}`}>Seats per row</label>
                {stepper(`sp-${s.id}`, s.seatsPerRow, 1, 40, (n) => setSection(i, { seatsPerRow: n }))}
              </div>
            </div>
            <details className="bf-inline" style={{ marginTop: 10 }}>
              <summary>+ First row letter and aisles</summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
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
            </details>
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

      </>
      )}

      <div className="ks-save">
        <button type="button" className="btn btn-brand" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save seating'}
        </button>
        {saved && <span className="badge badge-green">Saved ✓</span>}
      </div>
    </div>
  );
}
