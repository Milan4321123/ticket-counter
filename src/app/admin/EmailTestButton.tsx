'use client';

import { useState } from 'react';

interface Result {
  ok?: boolean;
  to?: string;
  from?: string;
  host?: string;
  detail?: string;
  error?: string;
}

/**
 * Sends one test message and shows what the mail server actually replied.
 *
 * The raw reply is the whole point. Every email failure looks the same from
 * outside — nothing arrives — while the causes need completely different fixes,
 * and only the SMTP response tells them apart. "535 Authentication failed" is a
 * wrong key; "550 does not match a verified Sender Identity" is a sender the
 * provider will not vouch for; a timeout is the wrong port. Guessing between
 * those costs hours.
 */
export default function EmailTestButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/email-test', { method: 'POST' });
      setResult((await res.json().catch(() => null)) ?? { error: 'No response from the server.' });
    } catch {
      setResult({ error: 'Could not reach the server.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button type="button" className="btn btn-sm btn-brand" onClick={() => void run()} disabled={busy}>
        {busy ? 'Sending…' : 'Send a test email'}
      </button>

      {result && (
        <div
          className={`notice small ${result.ok ? 'notice-success' : 'notice-error'}`}
          style={{ marginTop: 10, marginBottom: 0 }}
        >
          {result.error ? (
            <>{result.error}</>
          ) : result.ok ? (
            <>
              <strong>Sent.</strong> The mail server accepted a test to <strong>{result.to}</strong> from{' '}
              <span className="mono">{result.from}</span> via <span className="mono">{result.host}</span>.
              <p className="small" style={{ margin: '6px 0 0' }}>
                Accepted is not the same as delivered — check the inbox, and check that{' '}
                <span className="mono">signed-by</span> in the headers is your own domain rather than your mail
                provider&rsquo;s.
              </p>
            </>
          ) : (
            <>
              <strong>Failed.</strong> Sending as <span className="mono">{result.from}</span> via{' '}
              <span className="mono">{result.host || '(no SMTP host)'}</span> was refused:
              <p className="mono small" style={{ margin: '6px 0 0', wordBreak: 'break-word' }}>
                {result.detail}
              </p>
              <p className="small" style={{ margin: '6px 0 0' }}>
                <strong>535</strong> means the credentials are wrong — SMTP_USER must be the literal word{' '}
                <span className="mono">apikey</span> for SendGrid, and the key needs Mail Send permission.{' '}
                <strong>550</strong> means the provider will not send as that address: it is not at a domain
                you have authenticated in <em>this</em> account. A timeout means the wrong port.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
