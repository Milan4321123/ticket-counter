'use client';

import { useState } from 'react';
import type { EventKind } from '@/lib/types';
import { vocabFor } from '@/lib/vocab';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 160;

/**
 * The sold-out waitlist form on an event page.
 *
 * Rendered ONLY while the ticket state is sold-out: it is the one state where
 * the page can still do something for the visitor, and the one moment they are
 * willing to leave an address. The microcopy under the field IS the consent —
 * it states everything that will happen to the address (one email if spots
 * free up, first come first served, deleted afterwards), so pressing the
 * button is agreeing to exactly that and nothing more. No checkbox theatre for
 * a single field whose only possible use is written directly above the button.
 *
 * The server can answer "actually, you can buy right now" — between this page
 * rendering sold-out and the visitor typing their email, a reservation may
 * have expired. That answer replaces the form with a checkout link instead of
 * putting them on a list for spots that already exist.
 */
export default function WaitlistForm({
  eventId,
  kind,
  checkoutHref,
}: {
  eventId: string;
  kind: EventKind;
  checkoutHref: string;
}) {
  const v = vocabFor(kind);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'joined' | 'on-sale' | null>(null);

  const trimmed = email.trim();
  const ready = trimmed.length > 0 && trimmed.length <= MAX_EMAIL && EMAIL_RE.test(trimmed);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; onSale?: boolean; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        setBusy(false);
        return;
      }
      setDone(data?.onSale ? 'on-sale' : 'joined');
      setBusy(false);
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
      setBusy(false);
    }
  }

  if (done === 'on-sale') {
    return (
      <div className="card glow-card">
        <div className="card-title">Good news — {v.units} just became available</div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Someone&rsquo;s spot freed up between this page loading and now, so there is no need for a
          waitlist — you can book right away. Be quick: nothing is held for you until you do.
        </p>
        <a href={checkoutHref} className="btn btn-primary btn-block">
          {v.cta}
        </a>
      </div>
    );
  }

  if (done === 'joined') {
    return (
      <div className="card glow-card">
        <div className="card-title">You&rsquo;re on the list</div>
        <p className="muted small" style={{ marginTop: 0, marginBottom: 0 }}>
          If {v.units} free up, we send you <strong>one email</strong> saying so — everyone on the
          list gets it at the same moment, and the {v.units} go to whoever books first. That email
          is the only one we ever send, and your address is deleted afterwards
          {kind === 'shop' ? '' : ', or once the event has passed'}.
        </p>
      </div>
    );
  }

  return (
    <div className="card glow-card">
      <div className="card-title">Sold out — want to know if {v.units} free up?</div>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="waitlist-email">
          Your email
        </label>
        <input
          id="waitlist-email"
          className="input"
          type="email"
          value={email}
          maxLength={MAX_EMAIL}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          disabled={busy}
        />
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Sometimes an unpaid reservation expires and its {v.units} come back. If that happens we
          send you <strong>one email</strong> — everyone on the list gets it at once, and the{' '}
          {v.units} go to whoever books first. That single email is all we ever send, your address
          is used for nothing else, and it is deleted afterwards
          {kind === 'shop' ? '' : ' (or once the event has passed)'}.{' '}
          <a href="/privacy" target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
            Privacy · Datenschutz
          </a>
        </p>

        {error && (
          <div className="notice notice-error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          style={{ marginTop: 14 }}
          disabled={busy || !ready}
        >
          {busy ? (
            <>
              <span className="spinner" aria-hidden /> Joining…
            </>
          ) : (
            `Email me if ${v.units} free up`
          )}
        </button>
      </form>
    </div>
  );
}
