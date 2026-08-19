'use client';

import { useState } from 'react';
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
      router.push(`/portal/events/${data.eventId}/edit`);
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
        <legend className="small" style={{ padding: 0, marginBottom: 8, fontWeight: 600 }}>
          What are you setting up?
        </legend>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <KindChoice
            checked={!isShop}
            onSelect={() => setKind('event')}
            disabled={busy}
            title="An event"
            blurb="Happens once, at a venue, on a date. Sells tickets, scanned at the door."
          />
          <KindChoice
            checked={isShop}
            onSelect={() => setKind('shop')}
            disabled={busy}
            title="A shop"
            blurb="Sells items people order ahead and come to collect. No date, no venue — you say where and when to pick up."
          />
        </div>
      </fieldset>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: '1 1 240px' }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder={isShop ? 'Shop name, e.g. Sunita’s Home Kitchen' : 'Event name, e.g. Summer Night Live 2026'}
          aria-label={isShop ? 'New shop name' : 'New event name'}
          disabled={busy}
        />
        <button type="submit" className="btn btn-brand" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Creating…' : isShop ? 'Create shop' : 'Create event'}
        </button>
      </div>
      {error && (
        <div className="notice notice-error" style={{ marginTop: 12, marginBottom: 0 }}>
          {error}
        </div>
      )}
      <p className="muted small" style={{ margin: '10px 0 0' }}>
        New {isShop ? 'shops' : 'events'} start as a private draft — nothing goes public until you hit Publish.
      </p>
    </form>
  );
}

/**
 * One of the two choices. A label wrapping a real radio: the whole card is the
 * hit target, but keyboard and screen-reader users still get an ordinary radio
 * group rather than a div someone has taught to look clickable.
 */
function KindChoice({
  checked,
  onSelect,
  disabled,
  title,
  blurb,
}: {
  checked: boolean;
  onSelect: () => void;
  disabled: boolean;
  title: string;
  blurb: string;
}) {
  return (
    <label
      style={{
        flex: '1 1 220px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '12px 14px',
        borderRadius: 12,
        cursor: disabled ? 'default' : 'pointer',
        border: `1px solid ${checked ? 'var(--brand)' : 'var(--border)'}`,
        background: checked ? 'var(--brand-soft)' : 'var(--bg-elevated)',
      }}
    >
      <input
        type="radio"
        name="listing-kind"
        checked={checked}
        onChange={onSelect}
        disabled={disabled}
        style={{ marginTop: 3, flex: 'none' }}
      />
      <span>
        <strong>{title}</strong>
        <span className="muted small" style={{ display: 'block', marginTop: 2 }}>
          {blurb}
        </span>
      </span>
    </label>
  );
}
