'use client';

import { useState } from 'react';
import CopyButton from '@/components/CopyButton';

interface SetupData {
  secret: string;
  qrDataUrl: string;
  uri: string;
}

/**
 * The secret in blocks of four, e.g. 'JBSW Y3DP EHPK 3PXP'. Typing a 32-character
 * string off a screen is where manual setup goes wrong; the blocks give the eye
 * somewhere to come back to. Authenticator apps ignore the spaces.
 */
function groupSecret(secret: string): string {
  return secret
    .toUpperCase()
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

/**
 * Set up (or turn off) an authenticator app as a free second factor for admin
 * login. The emailed code keeps working either way — this just lets you use a
 * code from Google/Microsoft Authenticator / Authy instead of waiting on email.
 */
export default function TotpPanel({ initialEnrolled }: { initialEnrolled: boolean }) {
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'start' | 'enable' | 'disable' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy('start');
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = (await res.json().catch(() => null)) as
        | { enrolled?: boolean; secret?: string; qrDataUrl?: string; uri?: string; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? 'Could not start setup — please try again.');
        return;
      }
      if (data?.enrolled) {
        setEnrolled(true);
        return;
      }
      if (data?.secret && data.qrDataUrl && data.uri) {
        setSetup({ secret: data.secret, qrDataUrl: data.qrDataUrl, uri: data.uri });
      }
    } catch {
      setError('Could not reach the server — please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function enable() {
    if (busy || code.length !== 6) return;
    setBusy('enable');
    setError(null);
    try {
      const res = await fetch('/api/admin/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable', code }),
      });
      const data = (await res.json().catch(() => null)) as { enrolled?: boolean; error?: string } | null;
      if (!res.ok || !data?.enrolled) {
        setError(data?.error ?? 'That code did not match — try the current one.');
        return;
      }
      setEnrolled(true);
      setSetup(null);
      setCode('');
      setNotice('Authenticator app is on. From now on you can use its code to sign in.');
    } catch {
      setError('Could not reach the server — please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function disable() {
    if (busy) return;
    if (!window.confirm('Turn off the authenticator app?\n\nYou will sign in with the emailed code again. You can set it up any time.')) {
      return;
    }
    setBusy('disable');
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      });
      const data = (await res.json().catch(() => null)) as { enrolled?: boolean; error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'Could not turn it off — please try again.');
        return;
      }
      setEnrolled(false);
      setSetup(null);
      setNotice('Authenticator app is off. Sign-in codes come by email again.');
    } catch {
      setError('Could not reach the server — please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Optional, free, and more secure than SMS: use a code from an authenticator app (Google Authenticator,
        Microsoft Authenticator, or Authy) to sign in, instead of waiting for the emailed code. Your emailed code
        keeps working too, so you can never be locked out.
      </p>

      {notice && <div className="notice notice-success">{notice}</div>}
      {error && <div className="notice notice-error">{error}</div>}

      {enrolled ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-green">Authenticator app is ON</span>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => void disable()} disabled={busy !== null}>
            {busy === 'disable' ? 'Turning off…' : 'Turn off'}
          </button>
        </div>
      ) : setup ? (
        <div className="anim-fade-up">
          <ol className="step-list" style={{ margin: '0 0 14px' }}>
            <li className="step-item">
              <span className="step-num">1</span>
              <div style={{ width: '100%' }}>
                <div className="tier-name">Scan this with your authenticator app</div>
                <div className="qr-frame" style={{ marginTop: 10, width: 'fit-content' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={setup.qrDataUrl} alt="Authenticator app setup QR code" width={200} height={200} />
                </div>
                {/* Scanning fails often — the QR is usually on the same phone
                    that holds the app. Keep the typeable key one tap away. */}
                <details className="faq-item" style={{ marginTop: 12, marginBottom: 0 }}>
                  <summary>Can&rsquo;t scan the code?</summary>
                  <div style={{ padding: '0 18px 14px' }}>
                    <p className="muted small" style={{ marginTop: 0 }}>
                      Type the key in by hand instead. In your authenticator app choose{' '}
                      <strong>Enter a setup key</strong> (some apps call it &ldquo;manual entry&rdquo;), give the
                      account any name you like, set the type to <strong>Time-based</strong>, then type or paste
                      this key.
                    </p>
                    <div className="copy-row">
                      <span
                        className="mono"
                        style={{ letterSpacing: '0.06em', fontWeight: 700, overflowWrap: 'anywhere' }}
                      >
                        {groupSecret(setup.secret)}
                      </span>
                      <CopyButton value={setup.secret} label="Copy key" />
                    </div>
                    <p className="muted small" style={{ margin: '8px 0 0' }}>
                      The spaces are only there to make it readable — the app ignores them. Treat this key like a
                      password: anyone who copies it can generate your sign-in codes.
                    </p>
                  </div>
                </details>
              </div>
            </li>
            <li className="step-item">
              <span className="step-num">2</span>
              <div style={{ width: '100%' }}>
                <div className="tier-name">Enter the 6-digit code it shows</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                  <input
                    className="input input-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="••••••"
                    aria-label="6-digit code from your authenticator app"
                    style={{ maxWidth: 160 }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void enable()}
                    disabled={busy !== null || code.length !== 6}
                  >
                    {busy === 'enable' ? 'Checking…' : 'Turn on'}
                  </button>
                </div>
              </div>
            </li>
          </ol>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-amber">Not set up</span>
          <button type="button" className="btn btn-sm" onClick={() => void start()} disabled={busy !== null}>
            {busy === 'start' ? 'Preparing…' : 'Set up authenticator app'}
          </button>
        </div>
      )}
    </div>
  );
}
