'use client';

// "Kitchen & collection" — the restaurant pack's settings for one shop:
// collection time slots, free item choices, and order-from-the-table QR codes.
// Saved through its own route (api/portal/events/[id]/kitchen-setup), so none
// of it rides on the big editor save or its payout checks.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SlotConfig {
  enabled: boolean;
  days: number[];
  start: string;
  end: string;
  stepMin: number;
  perSlot: number;
  leadMin: number;
  daysAhead: number;
  purpose: 'collection' | 'appointment';
}

interface Props {
  eventId: string;
  slug: string;
  initialSlots: SlotConfig;
  initialTables: number;
  items: { tierKey: string; name: string; choicesText: string }[];
}

const DAYS = [
  { d: 1, label: 'Mon' },
  { d: 2, label: 'Tue' },
  { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' },
  { d: 5, label: 'Fri' },
  { d: 6, label: 'Sat' },
  { d: 0, label: 'Sun' },
];

export default function KitchenSetupPanel({ eventId, slug, initialSlots, initialTables, items }: Props) {
  const router = useRouter();
  const [slots, setSlots] = useState<SlotConfig>(initialSlots);
  const [tables, setTables] = useState(initialTables);
  const [choices, setChoices] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.tierKey, i.choicesText]))
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof SlotConfig>(k: K, v: SlotConfig[K]) => setSlots((s) => ({ ...s, [k]: v }));

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/kitchen-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots, tableCount: tables, choices }),
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

  return (
    <div className="card" style={{ display: 'grid', gap: 22 }}>
      <div>
        <div className="card-title">Kitchen &amp; collection</div>
        <p className="muted small" style={{ margin: 0 }}>
          Run your shop like a restaurant: buyers pick a collection time, choose how they want each dish, and paid
          orders land on your live{' '}
          <Link href={`/portal/events/${eventId}/kitchen`}>kitchen screen</Link>.
        </p>
      </div>

      {error && <div className="notice notice-error" style={{ margin: 0 }}>{error}</div>}

      {/* ---- Collection times ---- */}
      <section style={{ display: 'grid', gap: 12 }}>
        <label className="checkbox-row" style={{ margin: 0 }}>
          <input type="checkbox" checked={slots.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          <span>
            <strong>Let buyers choose a time — to collect, or for an appointment</strong>
            <span className="muted small" style={{ display: 'block' }}>
              They pick a slot at checkout; a slot that is full cannot be picked.
            </span>
          </span>
        </label>

        {slots.enabled && (
          <div style={{ display: 'grid', gap: 12, paddingLeft: 4 }}>
            <div>
              <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>
                These times are for
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm${slots.purpose !== 'appointment' ? ' btn-brand' : ''}`}
                  aria-pressed={slots.purpose !== 'appointment'}
                  onClick={() => set('purpose', 'collection')}
                >
                  🛍️ Collecting orders
                </button>
                <button
                  type="button"
                  className={`btn btn-sm${slots.purpose === 'appointment' ? ' btn-brand' : ''}`}
                  aria-pressed={slots.purpose === 'appointment'}
                  onClick={() => {
                    set('purpose', 'appointment');
                    if (slots.perSlot === 0 || slots.perSlot > 3) set('perSlot', 1);
                  }}
                >
                  📅 Appointments
                </button>
              </div>
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                {slots.purpose === 'appointment'
                  ? 'Salons, tutors, pujas, photo shoots: each booking takes a time. “Per slot” is how many people you can see at once — usually 1.'
                  : 'Restaurants and bakeries: buyers pick when they will come to collect.'}
              </p>
            </div>
            <div>
              <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>
                Open on
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DAYS.map(({ d, label }) => {
                  const on = slots.days.includes(d);
                  return (
                    <button
                      type="button"
                      key={d}
                      className={`btn btn-sm${on ? ' btn-brand' : ''}`}
                      aria-pressed={on}
                      onClick={() => set('days', on ? slots.days.filter((x) => x !== d) : [...slots.days, d])}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="ks-start">First collection</label>
                <input id="ks-start" className="input" type="time" value={slots.start} onChange={(e) => set('start', e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="ks-end">Closes at</label>
                <input id="ks-end" className="input" type="time" value={slots.end} onChange={(e) => set('end', e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="ks-step">Every</label>
                <select id="ks-step" className="input" value={slots.stepMin} onChange={(e) => set('stepMin', Number(e.target.value))}>
                  {[10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>
                      {m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? '' : 's'}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="ks-per">{slots.purpose === 'appointment' ? 'Bookings per slot' : 'Orders per slot'}</label>
                <input
                  id="ks-per"
                  className="input"
                  type="number"
                  min={0}
                  max={500}
                  value={slots.perSlot}
                  onChange={(e) => set('perSlot', Math.max(0, Math.min(500, Math.floor(Number(e.target.value) || 0))))}
                />
                <span className="muted small">0 = no limit</span>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="ks-lead">Kitchen needs</label>
                <select id="ks-lead" className="input" value={slots.leadMin} onChange={(e) => set('leadMin', Number(e.target.value))}>
                  {[0, 15, 30, 60, 120, 240, 720, 1440].map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? 'no notice' : m < 60 ? `${m} min notice` : m < 1440 ? `${m / 60} h notice` : '1 day notice'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="ks-ahead">Book up to</label>
                <select id="ks-ahead" className="input" value={slots.daysAhead} onChange={(e) => set('daysAhead', Number(e.target.value))}>
                  {[1, 2, 3, 7, 14, 30].map((d) => (
                    <option key={d} value={d}>
                      {d === 1 ? 'today only' : `${d} days ahead`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ---- Item choices ---- */}
      <section style={{ display: 'grid', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Choices for each item</div>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            One choice per line, like <span className="mono">Spice: Mild, Medium, Hot</span>. Buyers must pick one of
            each. Choices never change the price — add a separate item for paid extras.
          </p>
        </div>
        {items.length === 0 ? (
          <p className="muted small">Add some items first, then give them choices here.</p>
        ) : (
          items.map((it) => (
            <div className="field" key={it.tierKey} style={{ margin: 0 }}>
              <label htmlFor={`ch-${it.tierKey}`}>{it.name}</label>
              <textarea
                id={`ch-${it.tierKey}`}
                className="input"
                rows={2}
                value={choices[it.tierKey] ?? ''}
                onChange={(e) => setChoices((c) => ({ ...c, [it.tierKey]: e.target.value }))}
                placeholder={'Spice: Mild, Medium, Hot\nDip: Tomato achar, Sesame achar'}
              />
            </div>
          ))
        )}
      </section>

      {/* ---- Tables ---- */}
      <section style={{ display: 'grid', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Order from the table</div>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            Print a QR code for each table. Guests scan it, order and pay on their phone, and the order reaches your
            kitchen screen with the table number — no collection time needed.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0, maxWidth: 160 }}>
            <label htmlFor="ks-tables">Number of tables</label>
            <input
              id="ks-tables"
              className="input"
              type="number"
              min={0}
              max={200}
              value={tables}
              onChange={(e) => setTables(Math.max(0, Math.min(200, Math.floor(Number(e.target.value) || 0))))}
            />
          </div>
          {initialTables > 0 && (
            <Link className="btn" href={`/portal/events/${eventId}/tables`} target="_blank">
              Print table QR codes ↗
            </Link>
          )}
          {initialTables > 0 && (
            <Link className="btn" href={`/e/${slug}?table=1`} target="_blank">
              Try table 1 ↗
            </Link>
          )}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" className="btn btn-brand" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save kitchen settings'}
        </button>
        {saved && <span className="badge badge-green">Saved ✓</span>}
      </div>
    </div>
  );
}
