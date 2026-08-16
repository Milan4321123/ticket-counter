'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Organizer-facing setup for an authenticator app.
 *
 * Two steps on purpose. Scanning a QR proves nothing — plenty of people scan
 * the wrong thing, or scan it into an app they then delete. So the secret is
 * stored but INERT until a working code comes back; until then, sign-in carries
 * on exactly as before. Nobody gets locked out by a setup that silently failed.
 */
export default function TotpPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/portal/totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    setBusy(false);
    if (!res.ok) {
      setError((data?.error as string) || 'Something went wrong — please try again.');
      return null;
    }
    return data;
  }

  if (done || (enabled && !qr)) {
    return (
      <div className="card">
        <div className="card-title">
          Authenticator app <span className="badge badge-green">On</span>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Signing in asks for a 6-digit code from your phone as well as your password. Nobody can get
          into your events with a stolen password alone.
        </p>
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy}
          onClick={async () => {
            if (!confirm('Turn off the authenticator? Your password alone will then be enough to sign in.')) return;
            const r = await post({ action: 'disable' });
            if (r) {
              setDone(false);
              setQr(null);
              router.refresh();
            }
          }}
        >
          {busy ? 'Working…' : 'Turn it off (lost phone)'}
        </button>
        {error && (
          <div className="notice notice-error small" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">
        Authenticator app <span className="badge badge-amber">Off</span>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Add a second step to your sign-in using a free app like Google Authenticator. It works
        offline and needs no email, so it keeps working even when email does not.
      </p>

      {!qr ? (
        <button
          type="button"
          className="btn btn-brand btn-sm"
          disabled={busy}
          onClick={async () => {
            const r = await post({ action: 'start' });
            if (r) {
              setQr(r.qr as string);
              setManualCode(r.manualCode as string);
            }
          }}
        >
          {busy ? 'Preparing…' : 'Set up an authenticator'}
        </button>
      ) : (
        <div>
          <ol className="step-list">
            <li className="step-item">
              <span className="step-num step-num-brand" aria-hidden>
                1
              </span>
              <div>
                <strong>Scan this with your authenticator app</strong>
                {/* Server-rendered data URL — the secret never travels as a URL
                    anyone else could request. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qr}
                  alt="Authenticator setup QR code"
                  width={200}
                  height={200}
                  style={{ display: 'block', marginTop: 10, borderRadius: 10, background: '#fff', padding: 8 }}
                />
                <p className="muted small" style={{ margin: '8px 0 0' }}>
                  Cannot scan? Type this into the app instead:
                </p>
                <p className="mono small" style={{ margin: '2px 0 0', wordBreak: 'break-all' }}>
                  <strong>{manualCode}</strong>
                </p>
              </div>
            </li>
            <li className="step-item">
              <span className="step-num step-num-brand" aria-hidden>
                2
              </span>
              <div>
                <strong>Type the 6-digit code it shows</strong>
                <p className="muted small" style={{ margin: '0 0 8px' }}>
                  This proves the app is set up correctly. Until you do it, nothing changes about how
                  you sign in.
                </p>
                <input
                  className="input mono"
                  inputMode="numeric"
                  maxLength={7}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  style={{ maxWidth: 180, letterSpacing: '0.3em' }}
                />
              </div>
            </li>
          </ol>

          <button
            type="button"
            className="btn btn-brand btn-sm"
            disabled={busy || code.replace(/\D/g, '').length !== 6}
            onClick={async () => {
              const r = await post({ action: 'confirm', code: code.replace(/\D/g, '') });
              if (r) {
                setDone(true);
                router.refresh();
              }
            }}
          >
            {busy ? 'Checking…' : 'Turn on the authenticator'}
          </button>
        </div>
      )}

      {error && (
        <div className="notice notice-error small" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}
