'use client';

import { useState } from 'react';
import CopyButton from '@/components/CopyButton';

interface ScanLink {
  url: string;
  hours: number;
  qrDataUrl: string;
}

const PRESETS = [
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
];

function validityLabel(hours: number): string {
  if (hours >= 48 && hours % 24 === 0) return `${hours / 24} days`;
  return `${hours} hours`;
}

/** Create / revoke time-limited door-scanner links (no admin password needed at the door). */
export default function ScanLinkPanel() {
  const [busy, setBusy] = useState<number | 'revoke' | null>(null);
  const [link, setLink] = useState<ScanLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function createLink(hours: number) {
    if (busy !== null) return;
    setBusy(hours);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/scan-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      const data = (await res.json().catch(() => null)) as
        | { url?: string; hours?: number; qrDataUrl?: string; error?: string }
        | null;
      if (!res.ok || !data?.url || !data.qrDataUrl) {
        setError(data?.error ?? 'Could not create the link — please try again.');
        return;
      }
      setLink({ url: data.url, hours: data.hours ?? hours, qrDataUrl: data.qrDataUrl });
    } catch {
      setError('Could not reach the server — please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function revokeAll() {
    if (busy !== null) return;
    if (
      !window.confirm(
        'Revoke ALL scanner links?\n\nEvery door-staff phone loses access immediately. You can create a fresh link right after.'
      )
    ) {
      return;
    }
    setBusy('revoke');
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/scan-link', { method: 'DELETE' });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'Could not revoke the links — please try again.');
        return;
      }
      setLink(null);
      setNotice('All scanner links are now revoked. Create a new one whenever you need it.');
    } catch {
      setError('Could not reach the server — please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Door staff scan tickets at the entrance without the admin password: create a time-limited scanner link and
        share it with them. Anyone who opens it can check tickets in — and nothing else. Links switch off by
        themselves when the time is up.
      </p>

      {notice && <div className="notice notice-success">{notice}</div>}
      {error && <div className="notice notice-error">{error}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {PRESETS.map((p) => (
          <button
            key={p.hours}
            type="button"
            className="btn btn-sm"
            onClick={() => void createLink(p.hours)}
            disabled={busy !== null}
          >
            {busy === p.hours ? 'Creating…' : `New link · valid ${p.label}`}
          </button>
        ))}
      </div>

      {link && (
        <div className="anim-fade-up" style={{ marginTop: 16 }}>
          <div className="copy-row">
            <span className="muted small">Scanner link</span>
            <span className="mono small" style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}>
              {link.url}
            </span>
            <CopyButton value={link.url} label="Copy link" />
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
            <div className="qr-frame">
              {/* Generated locally as a data URL — next/image is not needed here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={link.qrDataUrl} alt="QR code that opens the scanner link" width={180} height={180} />
            </div>
            <p className="muted small" style={{ margin: 0, maxWidth: 340 }}>
              Let door staff scan this with their phone camera — it opens the scanner directly, no typing needed. This
              link works for {validityLabel(link.hours)}.
            </p>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button type="button" className="btn btn-danger btn-sm" onClick={() => void revokeAll()} disabled={busy !== null}>
          {busy === 'revoke' ? 'Revoking…' : 'Revoke all scanner links'}
        </button>
        <span className="muted small">Lost a phone? This instantly cuts off every scanner link ever created.</span>
      </div>
    </div>
  );
}
