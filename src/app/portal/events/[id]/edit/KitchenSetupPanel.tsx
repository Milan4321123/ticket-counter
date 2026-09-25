'use client';

// "Times & options" — the restaurant / salon pack for one shop: pick-up or
// appointment times, free choices per item, and order-from-the-table QR codes.
// Saved through its own route (api/portal/events/[id]/kitchen-setup), so none
// of it rides on the big editor save or its payout checks.
//
// Built to be filled in without thinking: one question first ("how do people
// get what you sell?"), then only the fields that answer needs, worded for it
// — a salon never reads "kitchen" or "spice" — with one-tap presets for the
// usual opening hours and the usual choices, and a live line showing the
// times a buyer will actually be offered.
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

type Mode = 'none' | 'collection' | 'appointment';

const DAYS = [
  { d: 1, label: 'Mon' },
  { d: 2, label: 'Tue' },
  { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' },
  { d: 5, label: 'Fri' },
  { d: 6, label: 'Sat' },
  { d: 0, label: 'Sun' },
];

const PRESETS: Record<'collection' | 'appointment', { label: string; days: number[]; start: string; end: string }[]> = {
  collection: [
    { label: 'Every day 11–21', days: [0, 1, 2, 3, 4, 5, 6], start: '11:00', end: '21:00' },
    { label: 'Evenings 17–21', days: [1, 2, 3, 4, 5], start: '17:00', end: '21:00' },
    { label: 'Weekends 10–18', days: [0, 6], start: '10:00', end: '18:00' },
  ],
  appointment: [
    { label: 'Mon–Sat 9–18', days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '18:00' },
    { label: 'Weekdays 10–19', days: [1, 2, 3, 4, 5], start: '10:00', end: '19:00' },
    { label: 'Weekends 10–16', days: [0, 6], start: '10:00', end: '16:00' },
  ],
};

const CHOICE_IDEAS: Record<'collection' | 'appointment', string[]> = {
  collection: ['Spice: Mild, Medium, Hot', 'Size: Small, Large', 'Dip: Tomato achar, Sesame achar', 'Filling: Chicken, Veg, Buff'],
  appointment: ['With: Anyone, Sita, Maya', 'Hair length: Short, Medium, Long', 'Design: Simple, Detailed', 'Language: Nepali, English, German'],
};

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const durationLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} hour${m === 60 ? '' : 's'}`);

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
  const mode: Mode = !slots.enabled ? 'none' : slots.purpose === 'appointment' ? 'appointment' : 'collection';
  const appt = mode === 'appointment';
  const ideasFor = appt ? 'appointment' : 'collection';
  const hoursBad = slots.enabled && toMin(slots.end) <= toMin(slots.start);

  function pickMode(next: Mode) {
    if (next === 'none') {
      set('enabled', false);
      return;
    }
    setSlots((s) => ({
      ...s,
      enabled: true,
      purpose: next,
      // One client at a time is what almost every salon means; a kitchen
      // usually handles several orders per pick-up time.
      perSlot: next === 'appointment' ? (s.perSlot === 0 || s.perSlot > 3 ? 1 : s.perSlot) : s.perSlot || 6,
      stepMin: next === 'appointment' && s.stepMin < 30 ? 30 : s.stepMin,
    }));
  }

  function addIdea(tierKey: string, line: string) {
    setChoices((c) => {
      const now = (c[tierKey] ?? '').trim();
      const label = line.split(':')[0].trim().toLowerCase();
      if (now.split('\n').some((l) => l.split(':')[0].trim().toLowerCase() === label)) return c;
      return { ...c, [tierKey]: now ? `${now}\n${line}` : line };
    });
  }

  // The first few times a buyer would be offered on an open day.
  const sample: string[] = [];
  if (slots.enabled && !hoursBad) {
    for (let m = toMin(slots.start); m < toMin(slots.end) && sample.length < 5; m += slots.stepMin) sample.push(fromMin(m));
  }
  const firstDay = DAYS.find((x) => slots.days.includes(x.d))?.label;

  async function save() {
    if (busy) return;
    if (hoursBad) {
      setError('The closing time has to be after the opening time.');
      return;
    }
    if (slots.enabled && slots.days.length === 0) {
      setError('Pick at least one day you are open.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/kitchen-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots, tableCount: appt ? 0 : tables, choices }),
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

  const hasChoices = Object.values(choices).some((v) => v.trim());

  return (
    <div className="card ks">
      <div>
        <div className="card-title">{appt ? 'Booking times & options' : 'Pick-up times & options'}</div>
        <p className="muted small" style={{ margin: 0 }}>
          All optional. Answer the first question — the rest follows from it.
        </p>
      </div>

      {error && (
        <div className="notice notice-error" style={{ margin: 0 }}>
          {error}
        </div>
      )}

      {/* ---- 1. How do people get it? ---- */}
      <section className="ks-step">
        <h3 className="ks-q">
          <span className="ks-num">1</span> How do people get what you sell?
        </h3>
        <div className="ks-modes" role="radiogroup" aria-label="How people get it">
          {(
            [
              ['collection', '🛍️', 'They pick it up', 'Food, bakery, groceries — buyers choose a pick-up time.'],
              ['appointment', '📅', 'They book a time', 'Salon, tutor, puja, photo shoot — each booking is an appointment.'],
              ['none', '📦', 'No set times', 'Buyers order; you arrange the hand-over yourself.'],
            ] as const
          ).map(([key, icon, title, line]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={mode === key}
              className={`ks-mode${mode === key ? ' is-on' : ''}`}
              onClick={() => pickMode(key)}
            >
              <span className="ks-mode-icon" aria-hidden="true">
                {icon}
              </span>
              <strong>{title}</strong>
              <span>{line}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ---- 2. When ---- */}
      {slots.enabled && (
        <section className="ks-step">
          <h3 className="ks-q">
            <span className="ks-num">2</span> {appt ? 'When can people book?' : 'When can people pick up?'}
          </h3>

          <div className="ks-presets">
            <span className="muted small">Quick start:</span>
            {PRESETS[ideasFor].map((p) => (
              <button
                key={p.label}
                type="button"
                className="ks-chip"
                onClick={() => setSlots((s) => ({ ...s, days: p.days, start: p.start, end: p.end }))}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="ks-days" aria-label="Open on">
            {DAYS.map(({ d, label }) => {
              const on = slots.days.includes(d);
              return (
                <button
                  type="button"
                  key={d}
                  className={`ks-day${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => set('days', on ? slots.days.filter((x) => x !== d) : [...slots.days, d])}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="ks-grid">
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ks-start">{appt ? 'First appointment' : 'Opens'}</label>
              <input id="ks-start" className="input" type="time" value={slots.start} onChange={(e) => set('start', e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ks-end">{appt ? 'Last one ends' : 'Closes'}</label>
              <input
                id="ks-end"
                className={`input${hoursBad ? ' input-error' : ''}`}
                type="time"
                value={slots.end}
                onChange={(e) => set('end', e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ks-step">{appt ? 'Each one takes' : 'A time every'}</label>
              <select id="ks-step" className="input" value={slots.stepMin} onChange={(e) => set('stepMin', Number(e.target.value))}>
                {[10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {durationLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ks-per">{appt ? 'Clients at once' : 'Orders per time'}</label>
              <select
                id="ks-per"
                className="input"
                value={slots.perSlot}
                onChange={(e) => set('perSlot', Number(e.target.value))}
              >
                {(appt ? [1, 2, 3, 4, 5] : [0, 2, 4, 6, 8, 10, 15, 20, 30]).map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? 'No limit' : appt ? `${n} ${n === 1 ? 'client' : 'clients'}` : `${n} orders`}
                  </option>
                ))}
                {/* Keep a custom value someone set before these lists existed. */}
                {!(appt ? [1, 2, 3, 4, 5] : [0, 2, 4, 6, 8, 10, 15, 20, 30]).includes(slots.perSlot) && (
                  <option value={slots.perSlot}>{slots.perSlot}</option>
                )}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ks-lead">{appt ? 'Book at least' : 'You need'}</label>
              <select id="ks-lead" className="input" value={slots.leadMin} onChange={(e) => set('leadMin', Number(e.target.value))}>
                {[0, 15, 30, 60, 120, 240, 720, 1440].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? (appt ? 'Any time' : 'No notice') : m < 1440 ? `${durationLabel(m)} ${appt ? 'ahead' : 'notice'}` : `1 day ${appt ? 'ahead' : 'notice'}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ks-ahead">Bookable up to</label>
              <select id="ks-ahead" className="input" value={slots.daysAhead} onChange={(e) => set('daysAhead', Number(e.target.value))}>
                {[1, 2, 3, 7, 14, 30].map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? 'Today only' : `${d} days ahead`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className={`ks-preview${hoursBad || slots.days.length === 0 ? ' is-bad' : ''}`}>
            {hoursBad
              ? 'The closing time has to be after the opening time.'
              : slots.days.length === 0
                ? 'Pick at least one day.'
                : `Buyers will see: ${firstDay} ${sample.join(', ')}${sample.length === 5 ? ' …' : ''}`}
          </p>
        </section>
      )}

      {/* ---- 3. Choices ---- */}
      <details className="ks-step ks-more" open={hasChoices || undefined}>
        <summary className="ks-q">
          <span className="ks-num">{slots.enabled ? 3 : 2}</span> Options per item{' '}
          <span className="badge">optional</span>
        </summary>
        <p className="muted small" style={{ margin: '0 0 8px' }}>
          {appt ? 'E.g. who does it, or which style.' : 'E.g. how spicy, or which size.'} Buyers pick one of each; the
          price stays the same. Tap an idea to add it, or type your own — one per line.
        </p>
        {items.length === 0 ? (
          <p className="muted small">Add your {appt ? 'services' : 'items'} first, then give them options here.</p>
        ) : (
          items.map((it) => (
            <div className="field ks-item" key={it.tierKey} style={{ margin: 0 }}>
              <label htmlFor={`ch-${it.tierKey}`}>{it.name}</label>
              <div className="ks-presets">
                {CHOICE_IDEAS[ideasFor].map((idea) => (
                  <button key={idea} type="button" className="ks-chip ks-chip-sm" onClick={() => addIdea(it.tierKey, idea)}>
                    + {idea.split(':')[0]}
                  </button>
                ))}
              </div>
              <textarea
                id={`ch-${it.tierKey}`}
                className="input"
                rows={choices[it.tierKey]?.trim() ? Math.min(4, choices[it.tierKey].split('\n').length) : 1}
                value={choices[it.tierKey] ?? ''}
                onChange={(e) => setChoices((c) => ({ ...c, [it.tierKey]: e.target.value }))}
                placeholder={appt ? 'With: Anyone, Sita, Maya' : 'Spice: Mild, Medium, Hot'}
              />
            </div>
          ))
        )}
      </details>

      {/* ---- 4. Tables (food only) ---- */}
      {!appt && (
        <details className="ks-step ks-more" open={tables > 0 || undefined}>
          <summary className="ks-q">
            <span className="ks-num">{slots.enabled ? 4 : 3}</span> Guests order at the table{' '}
            <span className="badge">optional</span>
          </summary>
          <p className="muted small" style={{ margin: '0 0 8px' }}>
            For a restaurant: print a QR code for each table. Guests scan, order and pay on their phone, and the order
            reaches your <Link href={`/portal/events/${eventId}/kitchen`}>kitchen screen</Link> with the table number.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ margin: 0, maxWidth: 160 }}>
              <label htmlFor="ks-tables">Number of tables</label>
              <input
                id="ks-tables"
                className="input"
                type="number"
                inputMode="numeric"
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
        </details>
      )}

      <div className="ks-save">
        <button type="button" className="btn btn-brand" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="badge badge-green">Saved ✓</span>}
      </div>
    </div>
  );
}
