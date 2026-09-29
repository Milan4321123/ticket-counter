'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  /** LEGAL_TERMS_VERSION — sent back so a stale page cannot accept a newer text. */
  version: string;
  /** "29.09.2026" — the version as a date, for the sentence being agreed to. */
  versionLabel: string;
  /** Legal name + address are filled in; the AVV needs a controller to name. */
  detailsComplete: boolean;
}

/** The one checkbox that concludes the terms + AVV for this organizer. */
export default function AcceptTermsForm({ version, versionLabel, detailsComplete }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!checked) {
      setError('Please tick the box first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept: true, version }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="notice notice-error">{error}</div>}
      {!detailsComplete && (
        <div className="notice notice-warn">
          Add your legal name and postal address first (below) — the agreement has to say who it is with.
        </div>
      )}
      <label className="checkbox-row" htmlFor="accept-terms">
        <input
          id="accept-terms"
          type="checkbox"
          checked={checked}
          disabled={!detailsComplete}
          onChange={(e) => {
            setChecked(e.target.checked);
            setError(null);
          }}
        />
        <span style={{ color: 'var(--text)' }}>
          <span lang="de">
            Ich akzeptiere die Nutzungsbedingungen und schließe den Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28
            DSGVO in der Fassung vom {versionLabel} ab.
          </span>{' '}
          <span className="muted">/ I accept the terms and conclude the data processing agreement.</span>
        </span>
      </label>
      <button type="submit" className="btn btn-brand" disabled={busy || !detailsComplete || !checked}>
        {busy ? 'Saving…' : 'Accept and conclude'}
      </button>
    </form>
  );
}
