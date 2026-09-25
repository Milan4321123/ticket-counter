'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EventKind } from '@/lib/types';

/**
 * Small inline form: name a new listing, get a draft, jump into the editor.
 *
 * The kind is chosen HERE and never again. It decides which fields the editor
 * shows and what publishing insists on, so asking once at the start is much
 * kinder than letting someone fill in a date and then discover they wanted the
 * other thing. It is stored as a plain column, so a mistake is a support
 * request rather than a dead end.
 */
export default function CreateEventForm() {
  const router = useRouter();
  const [kind, setKind] = useState<EventKind>('event');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isShop = kind === 'shop';
  const noun = isShop ? 'shop' : 'event';

  /** Which button sent the form: the AI helper opens with the new listing. */
  const withAi = useRef(true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError(`Please give your ${noun} a name — you can change it any time.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), kind }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; eventId?: string; error?: string } | null;
      if (!res.ok || !data?.eventId) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        setBusy(false);
        return;
      }
      router.push(`/portal/events/${data.eventId}/edit${withAi.current ? '?assistant=1' : ''}`);
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="ks-modes" role="radiogroup" aria-label="What are you setting up?" style={{ marginBottom: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {(
          [
            ['event', '🎟', 'An event', 'A date and a place — tickets scanned at the door.'],
            ['shop', '🛍', 'A shop', 'Food, goods or bookings — people order ahead.'],
          ] as const
        ).map(([k, icon, title, line]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className={`ks-mode${kind === k ? ' is-on' : ''}`}
            onClick={() => setKind(k)}
            disabled={busy}
          >
            <span className="ks-mode-icon" aria-hidden="true">
              {icon}
            </span>
            <strong>{title}</strong>
            <span>{line}</span>
          </button>
        ))}
      </div>

      <input
        className="input bf-big"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        placeholder={isShop ? 'Shop name, e.g. Sunita’s Home Kitchen' : 'Event name, e.g. Summer Night Live 2026'}
        aria-label={isShop ? 'New shop name' : 'New event name'}
        disabled={busy}
      />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <button type="submit" className="btn btn-brand" disabled={busy} onClick={() => (withAi.current = true)}>
          {busy && withAi.current ? <span className="spinner" aria-hidden /> : null}✨ Create with the AI helper
        </button>
        <button type="submit" className="btn" disabled={busy} onClick={() => (withAi.current = false)}>
          {busy && !withAi.current ? <span className="spinner" aria-hidden /> : null}
          {isShop ? 'Create shop' : 'Create event'}
        </button>
      </div>
      {error && (
        <div className="notice notice-error" style={{ marginTop: 12, marginBottom: 0 }}>
          {error}
        </div>
      )}
      <p className="muted small" style={{ margin: '10px 0 0' }}>
        It starts as a private draft. The AI helper asks a few questions and fills it in for you.
      </p>
    </form>
  );
}
