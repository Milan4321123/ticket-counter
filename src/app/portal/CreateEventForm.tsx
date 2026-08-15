'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Small inline form: name a new event, get a draft, jump into the editor. */
export default function CreateEventForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError('Please give your event a name — you can change it any time.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
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
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: '1 1 240px' }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="Event name, e.g. Summer Night Live 2026"
          aria-label="New event name"
          disabled={busy}
        />
        <button type="submit" className="btn btn-brand" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Creating…' : 'Create event'}
        </button>
      </div>
      {error && (
        <div className="notice notice-error" style={{ marginTop: 12, marginBottom: 0 }}>
          {error}
        </div>
      )}
      <p className="muted small" style={{ margin: '10px 0 0' }}>
        New events start as a private draft — nothing goes public until you hit Publish.
      </p>
    </form>
  );
}
