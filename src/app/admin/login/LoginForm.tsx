'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const RESEND_COOLDOWN_S = 45;

type Step = 'password' | 'code';

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [emailHint, setEmailHint] = useState('your email or phone');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // While on the code step: focus the input and tick the resend countdown.
  useEffect(() => {
    if (step !== 'code') return;
    codeRef.current?.focus();
    const timer = window.setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy || password.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; otpRequired?: boolean; emailHint?: string; error?: string }
        | null;
      if (res.ok) {
        if (data?.otpRequired) {
          setEmailHint(data.emailHint || 'your email or phone');
          setCode('');
          setInfo(null);
          setResendIn(RESEND_COOLDOWN_S);
          setStep('code');
          setBusy(false);
        } else {
          // Password-only setup: signed in straight away.
          router.push('/admin');
          router.refresh();
        }
        return;
      }
      if (res.status === 401) {
        setError('Wrong password. Please try again.');
      } else if (res.status === 429) {
        setError(data?.error || 'Too many failed attempts — please wait 15 minutes and try again.');
      } else if (res.status === 502) {
        setError(
          data?.error || 'Your password is correct, but the sign-in code email could not be sent. Please try again.'
        );
      } else if (res.status === 503) {
        setError(data?.error || 'The admin area is not set up yet. Ask the organizer to configure it.');
      } else {
        setError(data?.error || 'Something went wrong. Please try again.');
      }
      setBusy(false);
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
      setBusy(false);
    }
  }

  async function verifyCode(candidate: string) {
    if (busy || candidate.length !== 6) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch('/api/admin/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: candidate }),
      });
      if (res.ok) {
        router.push('/admin');
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 410) {
        // Expired or too many wrong tries — a fresh code is needed.
        setError(data?.error || 'That code is no longer valid — request a new one below.');
        setResendIn(0);
      } else if (res.status === 429) {
        setError(data?.error || 'Too many attempts — please wait 15 minutes and try again.');
      } else if (res.status === 401) {
        setError(data?.error || 'Wrong code — check the email and try again.');
      } else {
        setError(data?.error || 'Something went wrong. Please try again.');
      }
      setCode('');
      setBusy(false);
      codeRef.current?.focus();
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
      setBusy(false);
    }
  }

  function onCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    // Submit as soon as all 6 digits are in — no extra click needed.
    if (digits.length === 6) void verifyCode(digits);
  }

  async function resend() {
    if (resendBusy || resendIn > 0) return;
    setResendBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch('/api/admin/login/resend', { method: 'POST' });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; emailHint?: string; error?: string }
        | null;
      if (res.ok) {
        if (data?.emailHint) setEmailHint(data.emailHint);
        setInfo('A new code is on its way — check your email and phone.');
        setResendIn(RESEND_COOLDOWN_S);
      } else if (res.status === 429) {
        setError(data?.error || 'A code was just sent — wait a moment before requesting another.');
        setResendIn(RESEND_COOLDOWN_S);
      } else if (res.status === 401) {
        setError(data?.error || 'Your sign-in session expired — please enter the password again.');
      } else {
        setError(data?.error || 'The code email could not be sent. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setResendBusy(false);
    }
  }

  function startOver() {
    setStep('password');
    setPassword('');
    setCode('');
    setError(null);
    setInfo(null);
    setBusy(false);
  }

  if (step === 'code') {
    return (
      <form
        key="code"
        className="anim-fade-up"
        onSubmit={(e) => {
          e.preventDefault();
          void verifyCode(code);
        }}
      >
        <p style={{ marginTop: 0 }}>
          We sent a 6-digit code to <strong>{emailHint}</strong>. Enter it below to finish signing in.
        </p>
        {error && <div className="notice notice-error">{error}</div>}
        {!error && info && <div className="notice notice-success">{info}</div>}
        <div className="field">
          <label htmlFor="admin-otp">Sign-in code</label>
          <input
            id="admin-otp"
            ref={codeRef}
            className="input input-code"
            value={code}
            onChange={onCodeChange}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
            spellCheck={false}
            placeholder="••••••"
            disabled={busy}
            aria-label="6-digit sign-in code"
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Checking code…' : 'Verify and sign in'}
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
            onClick={() => void resend()}
            disabled={resendBusy || resendIn > 0}
          >
            {resendBusy ? 'Sending…' : resendIn > 0 ? `Resend code (${resendIn}s)` : 'Resend code'}
          </button>
          <button
            type="button"
            onClick={startOver}
            className="small"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--accent)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Start over
          </button>
        </div>
      </form>
    );
  }

  return (
    <form key="password" className="anim-fade-up" onSubmit={submitPassword}>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="field">
        <label htmlFor="admin-password">Admin password</label>
        <input
          id="admin-password"
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          placeholder="Enter the admin password"
        />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || password.length === 0}>
        {busy ? <span className="spinner" aria-hidden /> : null}
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
