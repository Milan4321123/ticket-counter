'use client';

import { useState } from 'react';

interface Props {
  initialEnabled: boolean;
  initialDays: number[];
  recommended: number[];
}

const LABELS = ['First reminder', 'Second reminder', 'Third reminder'] as const;

/**
 * "Check your bank account" reminder settings. Up to three timers, in days
 * after a buyer reserved with bank transfer — the platform emails the
 * organizer so arrived transfers get confirmed quickly.
 */
export default function RemindersCard({ initialEnabled, initialDays, recommended }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [days, setDays] = useState<string[]>([0, 1, 2].map((i) => (initialDays[i] != null ? String(initialDays[i]) : '')));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function setDay(index: number, value: string) {
    setDays((prev) => prev.map((d, i) => (i === index ? value : d)));
  }

  function useRecommended() {
    setDays([0, 1, 2].map((i) => (recommended[i] != null ? String(recommended[i]) : '')));
    setNotice(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    const parsed: number[] = [];
    for (let i = 0; i < days.length; i++) {
      const raw = days[i].trim();
      if (raw === '') continue; // timers are optional — skip empty slots
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 30) {
        setError(`${LABELS[i]} must be a whole number of days between 1 and 30.`);
        return;
      }
      parsed.push(n);
    }
    if (enabled && parsed.length === 0) {
      setError('Add at least one reminder timer, or switch reminders off.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/portal/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, days: parsed }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; days?: number[] } | null;
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      if (Array.isArray(data?.days)) {
        setDays([0, 1, 2].map((i) => (data.days![i] != null ? String(data.days![i]) : '')));
      }
      setNotice(enabled ? 'Saved — we will email you at those times.' : 'Saved — reminders are switched off.');
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="notice notice-error">{error}</div>}
      {!error && notice && <div className="notice notice-success">{notice}</div>}

      <p className="muted small" style={{ marginTop: 0 }}>
        Bank transfers arrive silently — nothing pings you when the money lands. We&rsquo;ll email you to check your
        bank account for arrived transfers while reservations are waiting, so buyers get their tickets quickly. Each
        timer is measured in days after a reservation was made.
      </p>

      <label className="checkbox-row" htmlFor="rem-enabled">
        <input
          id="rem-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>
          <strong style={{ color: 'var(--text)' }}>Email me payment reminders</strong> — while transfers are waiting
          to be confirmed.
        </span>
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', columnGap: 16 }}>
        {LABELS.map((label, i) => (
          <div className="field" key={label}>
            <label htmlFor={`rem-day-${i}`}>
              {label} {i === 2 ? '(days, optional)' : '(days)'}
            </label>
            <input
              id={`rem-day-${i}`}
              className="input"
              type="number"
              min={1}
              max={30}
              value={days[i]}
              onChange={(e) => setDay(i, e.target.value)}
              disabled={!enabled}
              placeholder={recommended[i] != null ? String(recommended[i]) : '—'}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Saving…' : 'Save reminders'}
        </button>
        <button type="button" className="btn btn-sm" onClick={useRecommended} disabled={busy || !enabled}>
          Use recommended times
        </button>
        <span className="muted small">
          Recommended: day {recommended.join(', day ')} — tuned to your payment deadline.
        </span>
      </div>
    </form>
  );
}
