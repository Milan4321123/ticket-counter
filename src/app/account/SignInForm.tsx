'use client';

// Sign in with a code sent to your email, or with Google. Two steps on one
// card: address, then the six digits.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SignInForm({ google, back = '/account' }: { google: boolean; back?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Google refuses to sign anyone in inside another app's built-in browser
  // (WhatsApp, Instagram, Facebook…): its page shows an error instead. There
  // we say how to get to a real browser, and the email code still works.
  const [inAppBrowser, setInAppBrowser] = useState(false);
  useEffect(() => {
    setInAppBrowser(/FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|TikTok|; wv\)/i.test(navigator.userAgent));
  }, []);

  async function post(url: string, body: unknown): Promise<string | null> {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return null;
    const data = (await r.json().catch(() => null)) as { error?: string } | null;
    return data?.error ?? 'Something went wrong — please try again.';
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await post('/api/account/code', { email }).catch(() => 'Could not reach the server.');
    setBusy(false);
    if (err) setError(err);
    else setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await post('/api/account/verify', { email, code }).catch(() => 'Could not reach the server.');
    setBusy(false);
    if (err) setError(err);
    else {
      router.replace(back);
      router.refresh();
    }
  }

  return (
    <div className="acc-signin">
      {google && inAppBrowser && (
        <p className="acc-inapp">
          To use <strong>Google</strong>, open this page in Chrome or Safari (⋮ or share menu → “Open in browser”). Or
          use a code by email below — it works here.
        </p>
      )}
      {google && !inAppBrowser && (
        <>
          <a className="acc-google" href={`/api/account/google?back=${encodeURIComponent(back)}`}>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </a>
          <div className="acc-or">
            <span>or with your email</span>
          </div>
        </>
      )}

      {step === 'email' ? (
        <form onSubmit={sendCode} className="acc-form">
          <label htmlFor="acc-email">Email address</label>
          <input
            id="acc-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button className="btn btn-brand btn-block" disabled={busy}>
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="acc-form">
          <label htmlFor="acc-code">
            The 6-digit code we sent to <strong>{email}</strong>
          </label>
          <input
            id="acc-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="acc-code"
          />
          <button className="btn btn-brand btn-block" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="acc-link"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          >
            Use a different address or send a new code
          </button>
        </form>
      )}
      {error && (
        <p className="acc-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
