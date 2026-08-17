'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set once the password was right and this account has an authenticator. The
  // form then shows the code step instead — the password is never re-sent.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  /** Which second factor the server asked for, so the step can say so. */
  const [factor, setFactor] = useState<'authenticator' | 'email'>('authenticator');
  const [sentTo, setSentTo] = useState('');
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
        | {
            ok?: boolean;
            pending?: boolean;
            organizerId?: string;
            totpRequired?: boolean;
            emailCodeRequired?: boolean;
            sentTo?: string;
            pendingToken?: string;
            error?: string;
          }
        | null;
      // A correct password with a second factor set returns 200 but NO session:
      // move to the code step rather than treating it as signed in.
      if (data?.totpRequired && data.pendingToken) {
        setFactor('authenticator');
        setPendingToken(data.pendingToken);
        setBusy(false);
        return;
      }
      // No authenticator on this account, so a code went to the address it was
      // opened with. Same step, different source — and the copy has to say which,
      // or the organizer stares at their authenticator app waiting for nothing.
      if (data?.emailCodeRequired && data.pendingToken) {
        setFactor('email');
        setSentTo(data.sentTo ?? '');
        setPendingToken(data.pendingToken);
        setBusy(false);
        return;
      }
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

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !pendingToken) return;
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) {
      setError(
        factor === 'email'
          ? 'Enter the 6-digit code from the email we just sent.'
          : 'Enter the 6-digit code from your authenticator app.'
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code: digits }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        router.push('/portal');
        router.refresh();
        return;
      }
      setError(data?.error || 'That code is not right. Please try again.');
      // An expired ticket means the password step has to happen again — say so
      // by putting them back there rather than leaving them on a dead form.
      if (res.status === 401 && /expired/i.test(data?.error ?? '')) {
        setPendingToken(null);
        setCode('');
      }
      setBusy(false);
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
      setBusy(false);
    }
  }

  if (pendingToken) {
    return (
      <form className="anim-fade-up" onSubmit={submitCode}>
        {error && <div className="notice notice-error">{error}</div>}
        <p className="muted small" style={{ marginTop: 0 }}>
          {factor === 'email' ? (
            <>
              Your password was correct. We sent a 6-digit code to{' '}
              <strong>{sentTo || 'the address on your account'}</strong> — type it in below. It
              expires in 10 minutes.
            </>
          ) : (
            <>
              Your password was correct. Now open your authenticator app and type the 6-digit code
              for this account.
            </>
          )}
        </p>
        <div className="field">
          <label htmlFor="portal-totp">6-digit code</label>
          <input
            id="portal-totp"
            className="input mono"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            style={{ letterSpacing: '0.3em', fontSize: '1.15rem' }}
          />
        </div>
        <button type="submit" className="btn btn-brand btn-block btn-lg" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Checking…' : 'Sign in'}
        </button>
        <p className="muted small" style={{ marginTop: 12, textAlign: 'center' }}>
          {factor === 'email' ? (
            <>
              Not arriving? Check your spam folder. An authenticator app works without email at all —
              you can set one up in Settings once you are in.
            </>
          ) : (
            <>The code changes every 30 seconds — if it is refused, wait for the next one.</>
          )}
        </p>
      </form>
    );
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
