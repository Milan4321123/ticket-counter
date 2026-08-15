'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    // Read the DOM directly: browser autofill can put values in the boxes
    // without firing onChange, leaving React state empty.
    const emailValue = (emailRef.current?.value ?? email).trim();
    const passwordValue = passwordRef.current?.value ?? password;
    if (!emailValue || !passwordValue) {
      setError('Please enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue, password: passwordValue }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; pending?: boolean; organizerId?: string; error?: string }
        | null;
      if (res.ok) {
        // Right password, but the account isn't switched on yet — show them
        // the welcome page with the fee details instead of the portal.
        if (data?.pending && data.organizerId) {
          router.push(`/organizers/pay?id=${encodeURIComponent(data.organizerId)}`);
          return;
        }
        router.push('/portal');
        router.refresh();
        return;
      }
      if (res.status === 401) {
        setError(data?.error || 'Wrong email or password. Please try again.');
      } else if (res.status === 429) {
        setError(data?.error || 'Too many failed attempts — please wait 15 minutes and try again.');
      } else {
        setError(data?.error || 'Something went wrong. Please try again.');
      }
      setBusy(false);
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <form className="anim-fade-up" onSubmit={submit}>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="field">
        <label htmlFor="portal-email">Email</label>
        <input
          id="portal-email"
          ref={emailRef}
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          autoComplete="email"
          spellCheck={false}
          placeholder="you@example.com"
        />
      </div>
      <div className="field">
        <label htmlFor="portal-password">Password</label>
        <input
          id="portal-password"
          ref={passwordRef}
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="Your password"
        />
      </div>
      <button type="submit" className="btn btn-brand btn-block" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden /> : null}
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
