'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * New password + confirm, nothing else: the organizer is already signed in with
 * the emailed one-time password, so asking them to type it again buys nothing.
 * On success the server hands back a fresh session cookie and the portal opens.
 */
export default function FirstPasswordForm() {
  const router = useRouter();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (next.length < 8) {
      setError('Your new password needs at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/portal/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: next }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        setBusy(false);
        return;
      }
      // Stay busy through the navigation: the portal is one redirect away and a
      // second submit would only fail.
      router.push('/portal');
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="field">
        <label htmlFor="first-pw-new">New password (at least 8 characters)</label>
        <input
          id="first-pw-new"
          className="input"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="first-pw-confirm">Repeat it</label>
        <input
          id="first-pw-confirm"
          className="input"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <button type="submit" className="btn btn-brand btn-block" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden /> : null}
        {busy ? 'Saving…' : 'Save and open my portal'}
      </button>
      <p className="muted small" style={{ margin: '12px 0 0' }}>
        The password from the email stops working straight away. You can change this one again any
        time from Settings.
      </p>
    </form>
  );
}
