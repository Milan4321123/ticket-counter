'use client';

import { useEffect, useState } from 'react';
import CheckinClient from '@/app/admin/checkin/CheckinClient';
import type { EventKind } from '@/lib/types';

type Status = 'checking' | 'ready' | 'invalid';

/**
 * Activates the door scanner: exchanges the key from the URL fragment
 * (#k=...) for a scanner cookie, or — when opened without a key — checks
 * whether a valid scanner cookie / admin session already exists.
 */
export default function ScanClient({
  eventName,
  kind = 'event',
}: {
  eventName: string | null;
  /**
   * Resolved server-side from the scanner cookie's event. On a fresh link the
   * cookie does not exist yet, so this is the default until the session
   * exchange lands — and 'event' is the safe default to be wrong with, since it
   * is what every listing was before shops existed.
   */
  kind?: EventKind;
}) {
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState<string | null>(null);
  // Server-known name (from the scanner cookie), possibly replaced by the
  // name returned when a fresh link's key is exchanged for a cookie.
  const [shownEventName, setShownEventName] = useState<string | null>(eventName);

  useEffect(() => {
    let cancelled = false;

    async function activate() {
      const match = /[#&]k=([^&]+)/.exec(window.location.hash);
      let key: string | null = null;
      if (match) {
        try {
          key = decodeURIComponent(match[1]);
        } catch {
          key = match[1];
        }
      }
      try {
        if (key) {
          const res = await fetch('/api/scan/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key }),
          });
          if (res.ok) {
            const data = (await res.json().catch(() => null)) as { eventName?: string | null } | null;
            // The key did its job — remove it from the address bar.
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            if (!cancelled) {
              if (typeof data?.eventName === 'string' && data.eventName) setShownEventName(data.eventName);
              setStatus('ready');
            }
            return;
          }
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!cancelled) {
            setMessage(data?.error ?? null);
            setStatus('invalid');
          }
          return;
        }
        // No key in the URL: probe the check-in API once to see whether a
        // scanner cookie is already in place (401 = no).
        const probe = await fetch('/api/admin/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: '' }),
        });
        if (!cancelled) setStatus(probe.ok ? 'ready' : 'invalid');
      } catch {
        if (!cancelled) {
          setMessage('Could not reach the server — check the connection and reload this page.');
          setStatus('invalid');
        }
      }
    }

    void activate();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking') {
    return (
      <div className="container container-narrow section" style={{ textAlign: 'center', paddingTop: 72 }}>
        <span className="spinner" aria-hidden />
        <p className="muted" style={{ marginTop: 14 }}>
          Getting the scanner ready…
        </p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="container container-narrow section">
        <div className="card anim-fade-up" style={{ textAlign: 'center', padding: '44px 24px' }}>
          <h1 style={{ marginBottom: 10 }}>This scanner link doesn’t work</h1>
          <p className="muted" style={{ marginBottom: 6 }}>
            {message ?? 'The link is invalid, has expired, or was revoked.'}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Ask the organizer for a fresh scanner link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container container-narrow section">
      <div
        className="anim-fade-up"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Door check-in
          </h1>
          {shownEventName && (
            <p className="muted small" style={{ margin: 0 }}>
              {shownEventName}
            </p>
          )}
        </div>
        <span className="badge badge-green">
          <span className="pulse-dot" aria-hidden /> Scanner active
        </span>
      </div>
      <div className="anim-fade-up anim-d1">
        <CheckinClient unauthorizedHref="/scan" kind={kind} />
      </div>
    </div>
  );
}
