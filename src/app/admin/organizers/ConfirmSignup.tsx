'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  organizerId: string;
  name: string;
  reference: string;
}

/**
 * Two-step activation for a pending self-service signup, matching the
 * bank-transfer confirm flow: the admin must type the last 4 characters of the
 * signup reference, so a stray click can never let an account in. The account
 * itself is free — the platform fee is charged per event, later.
 */
export default function ConfirmSignup({ organizerId, name, reference }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function confirm() {
    if (busy || typed.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/organizers/${organizerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmSignup: { referenceConfirmation: typed } }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; activated?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        setBusy(false);
        inputRef.current?.focus();
        return;
      }
      setDone(true);
      setOpen(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError('Could not reach the server — please try again.');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, whiteSpace: 'normal' }}>
        <span className="badge badge-green">Account activated ✓</span>
        <span className="muted small">They can build events now and pay per event to publish.</span>
      </span>
    );
  }

  if (!open) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setError(null);
            setTyped('');
            setOpen(true);
          }}
          disabled={busy}
        >
          Activate account
        </button>
        {error && (
          <span className="badge badge-red" title={error}>
            Failed
          </span>
        )}
      </span>
    );
  }

  return (
    <form
      className="confirm-panel anim-fade-up"
      style={{ whiteSpace: 'normal', minWidth: 280, maxWidth: 400, textAlign: 'left' }}
      onSubmit={(e) => {
        e.preventDefault();
        void confirm();
      }}
    >
      <p className="small" style={{ marginTop: 0, marginBottom: 10 }}>
        Let <strong>{name}</strong> into the portal — free, reference{' '}
        <span className="mono">{reference}</span>. Their events still cost the platform fee each.
      </p>
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor={`confirm-signup-${organizerId}`}>
          Type the LAST 4 characters of their signup reference to confirm
        </label>
        <input
          id={`confirm-signup-${organizerId}`}
          ref={inputRef}
          className="input input-code"
          value={typed}
          onChange={(e) => setTyped(e.target.value.toUpperCase().slice(0, 4))}
          maxLength={4}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="····"
          disabled={busy}
          aria-label="Last 4 characters of the signup reference"
        />
      </div>
      {error && (
        <div className="notice notice-error small" style={{ marginBottom: 10 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="submit" className="btn btn-danger btn-sm" disabled={typed.length !== 4 || busy}>
          {busy ? 'Activating…' : 'Yes — activate this account'}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setOpen(false);
            setTyped('');
            setError(null);
          }}
          disabled={busy}
        >
          Not yet
        </button>
      </div>
    </form>
  );
}
