'use client';

import { useState } from 'react';

interface Choice {
  id: string;
  name: string;
  kind: 'event' | 'shop';
  sent: boolean;
}

export default function ApplyForm({ listings, initial }: { listings: Choice[]; initial: string }) {
  const firstOpen = listings.find((l) => !l.sent)?.id ?? '';
  const [eventId, setEventId] = useState(listings.find((l) => l.id === initial && !l.sent)?.id ?? firstOpen);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, name, email, phone, message }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (data?.ok) setDone(true);
      else setError(data?.error ?? 'Something went wrong — please try again.');
    } catch {
      setError('We could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="apply-done anim-fade-up" role="status">
        <span className="apply-done-icon" aria-hidden="true">
          ✓
        </span>
        <h2>Application sent</h2>
        <p className="muted">
          We will look at your page and write to <strong translate="no">{email}</strong>. Your demo is kept for 30 days while
          you wait — you can keep improving the page, and whatever it looks like on approval is what moves into
          your account.
        </p>
        <a href="/portal" className="btn btn-brand">
          Back to the demo
        </a>
      </div>
    );
  }

  if (!firstOpen) {
    return (
      <div className="apply-done">
        <h2>{listings.length ? 'Already sent' : 'Build a page first'}</h2>
        <p className="muted">
          {listings.length
            ? 'Your page is with us — we will get back to you by email.'
            : 'Create a shop or event in the demo, then send it from here.'}
        </p>
        <a href="/portal" className="btn btn-brand">
          Back to the demo
        </a>
      </div>
    );
  }

  return (
    <form className="apply-form anim-fade-up anim-d2" onSubmit={submit}>
      <fieldset className="apply-pick">
        <legend>Which page?</legend>
        {listings.map((l) => (
          <label key={l.id} className={`apply-choice${l.id === eventId ? ' is-on' : ''}${l.sent ? ' is-sent' : ''}`}>
            <input
              type="radio"
              name="event"
              value={l.id}
              checked={l.id === eventId}
              disabled={l.sent}
              onChange={() => setEventId(l.id)}
            />
            <span aria-hidden="true">{l.kind === 'shop' ? '🛍' : '🎟'}</span>
            <span className="apply-choice-name">{l.name}</span>
            {l.sent && <span className="muted small">sent</span>}
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span>Your name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoComplete="name" />
      </label>
      <label className="field">
        <span>Email — your login is sent here</span>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={200}
          autoComplete="email"
        />
      </label>
      <label className="field">
        <span>Phone (optional)</span>
        <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={60} autoComplete="tel" />
      </label>
      <label className="field">
        <span>Anything we should know? (optional)</span>
        <textarea className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
      </label>

      {error && <div className="notice notice-error">{error}</div>}
      {/* What happens to the application — information beside the button, not
          an "I agree" tick: reviewing it is what the person is asking for. */}
      <p className="muted small" style={{ margin: 0 }}>
        Your details go to the MartNepali team, who read them to decide on your account and write back to you.
        Details:{' '}
        <a href="/privacy" target="_blank" rel="noopener">
          Privacy
        </a>
        .
      </p>
      <button type="submit" className="btn btn-brand btn-lg" disabled={busy || !eventId}>
        {busy ? 'Sending…' : 'Send my application'}
      </button>
    </form>
  );
}
