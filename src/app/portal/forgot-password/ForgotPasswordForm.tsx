'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@/lib/passwordPolicy';

const RESEND_COOLDOWN_S = 60;

type Step = 'email' | 'code';

/**
 * Two steps on ONE page, never a navigation: the code usually arrives on the
 * same phone the form is open on, so leaving to check the inbox and coming back
 * must not lose the code box, the password they were typing, or their place.
 */
export default function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Tick the resend countdown while the code step is open.
  useEffect(() => {
    if (step !== 'code') return;
    codeRef.current?.focus();
    const timer = window.setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  /** Ask for a code. Used by both the first send and "Send a new code". */
  async function requestCode(address: string, isResend: boolean): Promise<boolean> {
    const res = await fetch('/api/portal/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: address }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; message?: string; sentTo?: string; error?: string }
      | null;
    if (!res.ok) {
      setError(data?.error ?? 'Something went wrong — please try again.');
      return false;
    }
    if (data?.sentTo) setSentTo(data.sentTo);
    setError(null);
    // The server owns this wording — it is the same sentence whether or not the
    // address has an account, and it should stay that way in one place.
    setInfo(isResend ? `A new code is on its way. ${data?.message ?? ''}`.trim() : (data?.message ?? null));
    setResendIn(RESEND_COOLDOWN_S);
    return true;
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    // Read the DOM directly: autofill can fill the box without firing onChange.
    const address = (emailRef.current?.value ?? email).trim();
    if (!address) {
      setError('Please enter the email address you sign in with.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (await requestCode(address, false)) {
        setEmail(address);
        setStep('code');
      }
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (resendBusy || resendIn > 0) return;
    setResendBusy(true);
    setError(null);
    setInfo(null);
    try {
      // A new code replaces the old one, so anything already typed is stale.
      if (await requestCode(email, true)) setCode('');
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setResendBusy(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setInfo(null);
    if (code.trim().length !== 6) {
      setError('Please type the 6-digit code from the email.');
      return;
    }
    const problem = passwordProblem(next);
    if (problem) {
      setError(problem);
      return;
    }
    if (next !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/portal/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: code.trim(), newPassword: next }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; totpRequired?: boolean; pendingToken?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        setCode('');
        // Whatever went wrong, a fresh code is the way out — so let them ask
        // for one straight away instead of watching a countdown.
        if (res.status !== 429) setResendIn(0);
        setBusy(false);
        codeRef.current?.focus();
        return;
      }
      // The password is set, but this account has an authenticator, so no
      // session was issued — holding the inbox proves you may CHANGE the
      // password, never that you may get in. Send them to sign in with the new
      // one, where the code step is waiting.
      //
      // Not carrying the pending ticket across: it is a five-minute token and
      // putting it in a URL is how it ends up in history and referrers. Typing
      // a password they chose ten seconds ago costs them nothing.
      if (data.totpRequired) {
        router.push('/portal/login?reset=1');
        router.refresh();
        return;
      }

      // Stay busy through the navigation: they are signed in already and a
      // second submit could only fail.
      router.push('/portal');
      router.refresh();
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
      setBusy(false);
    }
  }

  if (step === 'code') {
    return (
      <form key="code" className="anim-fade-up" onSubmit={submitReset}>
        <p style={{ marginTop: 0 }}>
          If <strong translate="no">{sentTo || email}</strong> has an account, a 6-digit code is on its way. Type it
          below with the password you would like from now on.
        </p>
        {error && <div className="notice notice-error">{error}</div>}
        {!error && info && <div className="notice notice-success">{info}</div>}
        <div className="field">
          <label htmlFor="reset-code">Code from the email</label>
          <input
            id="reset-code"
            ref={codeRef}
            className="input input-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            spellCheck={false}
            autoCapitalize="off"
            placeholder="••••••"
            disabled={busy}
            aria-label="Code from the email"
          />
        </div>
        <div className="field">
          <label htmlFor="reset-new">New password (at least {MIN_PASSWORD_LENGTH} characters)</label>
          <input
            id="reset-new"
            className="input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="reset-confirm">Repeat it</label>
          <input
            id="reset-confirm"
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={busy}
          />
        </div>
        <button type="submit" className="btn btn-brand btn-block" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Saving…' : 'Save and open my portal'}
        </button>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginTop: 14,
          }}
        >
          <button
            type="button"
            className="btn btn-sm"
            style={{ minHeight: 44 }}
            onClick={() => void resend()}
            disabled={resendBusy || resendIn > 0}
          >
            {resendBusy ? 'Sending…' : resendIn > 0 ? `Send a new code (${resendIn}s)` : 'Send a new code'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
              setInfo(null);
            }}
            className="small"
            style={{
              background: 'none',
              border: 'none',
              padding: '10px 0',
              minHeight: 44,
              color: 'var(--accent)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Use a different email
          </button>
        </div>
        <p className="muted small" style={{ margin: '12px 0 0' }}>
          The code lasts 10 minutes. Asking for a new one replaces the old — always use the newest
          email.
        </p>
      </form>
    );
  }

  return (
    <form key="email" className="anim-fade-up" onSubmit={submitEmail}>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="field">
        <label htmlFor="reset-email">Your email</label>
        <input
          id="reset-email"
          ref={emailRef}
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          autoComplete="email"
          spellCheck={false}
          placeholder="you@example.com"
          disabled={busy}
        />
      </div>
      <button type="submit" className="btn btn-brand btn-block" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden /> : null}
        {busy ? 'Sending…' : 'Send me a code'}
      </button>
      <p className="muted small" style={{ margin: '12px 0 0' }}>
        We send the code to the address on the account, so keep this page open and check your inbox.
      </p>
    </form>
  );
}
