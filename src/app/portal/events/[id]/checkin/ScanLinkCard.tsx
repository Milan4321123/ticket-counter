'use client';

import { useState } from 'react';
import type { EventKind } from '@/lib/types';
import { vocabFor } from '@/lib/vocab';
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

/**
 * Create time-limited door-scanner links for THIS event. Anyone with the link
 * can check tickets in for this event — and nothing else.
 */
export default function ScanLinkCard({
  eventId,
  kind = 'event',
}: {
  eventId: string;
  /** Event or shop — decides who is described as doing the scanning. */
  kind?: EventKind;
}) {
  const v = vocabFor(kind);
  const isShop = kind === 'shop';
  const [busy, setBusy] = useState<number | null>(null);
  const [link, setLink] = useState<ScanLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);

  async function createLink(hours: number) {
    if (busy !== null || revoking) return;
    setBusy(hours);
    setError(null);
    setRevoked(false);
    try {
      const res = await fetch('/api/portal/scan-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, hours }),
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
    if (busy !== null || revoking) return;
    if (
      !window.confirm(
        `Switch off every scanner link for this ${v.listing}?\n\nAnyone using an old link is signed out right away. You can create a fresh link any time.`
      )
    ) {
      return;
    }
    setRevoking(true);
    setError(null);
    setRevoked(false);
    try {
      const res = await fetch('/api/portal/scan-link', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'The links could not be switched off — please try again.');
        return;
      }
      setLink(null);
      setRevoked(true);
    } catch {
      setError('Could not reach the server — please try again.');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div>
      <p className="muted small" style={{ marginTop: 0 }}>
        {isShop ? 'Whoever hands orders over' : 'Door staff'} can scan {v.codes} without needing your
        password: create a time-limited scanner link and share it with them. Anyone who opens it can scan{' '}
        {v.codes} for <strong>this {v.listing} only</strong> — nothing else. Links switch off by themselves
        when the time is up.
      </p>

      {error && <div className="notice notice-error">{error}</div>}
      {!error && revoked && (
        <div className="notice notice-success">
          Done — every scanner link for this {v.listing} is switched off. Create a new one whenever you need it.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map((p) => (
          <button
            key={p.hours}
            type="button"
            className="btn btn-sm"
            onClick={() => void createLink(p.hours)}
            disabled={busy !== null || revoking}
          >
            {busy === p.hours ? 'Creating…' : `New link · valid ${p.label}`}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-danger"
          style={{ marginLeft: 'auto' }}
          onClick={() => void revokeAll()}
          disabled={busy !== null || revoking}
        >
          {revoking ? 'Switching off…' : 'Revoke all links for this event'}
        </button>
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
    </div>
  );
}
