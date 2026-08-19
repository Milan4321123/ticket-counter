'use client';

import { useState } from 'react';

/**
 * The button behind a legal promise: /privacy and the unsubscribe page say a
 * do-not-email record is erased entirely when its owner asks. Erasure requests
 * arrive by email to the platform owner, so the owner needs a control that
 * actually works — a manual DELETE in the database throws once anything was
 * ever announced to the address (marketing_sends references the consent row),
 * which is why this goes through /api/admin/erase-consent instead.
 */
export default function EraseConsentPanel() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/erase-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => null)) as { erased?: number; error?: string } | null;
      if (!res.ok || !data || data.error) {
        setError(data?.error || 'Could not erase that address.');
      } else if (data.erased === 0) {
        setMessage('That address was not on file with any organizer — nothing to erase.');
      } else {
        setMessage(
          `Erased ${data.erased} consent record${data.erased === 1 ? '' : 's'} for that address. ` +
            'Its do-not-email protection is gone with it — a future checkout tick could subscribe them again.'
        );
        setEmail('');
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Erase a marketing consent record</div>
      <p className="muted small" style={{ marginTop: 0 }}>
        For &ldquo;erase my record entirely&rdquo; requests (the /privacy promise). Deletes every
        consent and suppression row for the address, across all organizers.
      </p>
      {message && <div className="notice notice-success small">{message}</div>}
      {error && <div className="notice notice-error small">{error}</div>}
      <form onSubmit={run} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="email"
          className="input"
          style={{ flex: '1 1 240px' }}
          placeholder="person@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-sm btn-danger" disabled={busy || !email.trim()}>
          {busy ? 'Erasing…' : 'Erase entirely'}
        </button>
      </form>
    </div>
  );
}
