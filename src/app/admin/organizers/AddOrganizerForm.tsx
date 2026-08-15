'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PasswordReveal from './PasswordReveal';

interface Created {
  email: string;
  password: string;
}

/**
 * Create a new organizer account. The account is free (the platform fee is
 * charged per event), so it only needs a name and an email. The server
 * generates the initial password and returns it exactly once — it is shown
 * below the form until the admin navigates away.
 */
export default function AddOrganizerForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/organizers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; initialPassword?: string; organizer?: { email?: string }; error?: string }
        | null;
      if (!res.ok || !data?.ok || !data.initialPassword) {
        // 409 = an account with this email already exists; the server message says so.
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      setCreated({ email: data.organizer?.email ?? email.trim(), password: data.initialPassword });
      setName('');
      setEmail('');
      router.refresh();
    } catch {
      setError('Could not reach the server — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={(e) => void submit(e)} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '2 1 180px', marginBottom: 0 }}>
          <label htmlFor="new-org-name">Name</label>
          <input
            id="new-org-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Milan Events"
            maxLength={120}
            required
            disabled={busy}
          />
        </div>
        <div className="field" style={{ flex: '2 1 220px', marginBottom: 0 }}>
          <label htmlFor="new-org-email">Email (their portal sign-in)</label>
          <input
            id="new-org-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            maxLength={200}
            required
            disabled={busy}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      {error && (
        <div className="notice notice-error small" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
      {created && <PasswordReveal email={created.email} password={created.password} />}
    </div>
  );
}
