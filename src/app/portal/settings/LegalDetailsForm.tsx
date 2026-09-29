'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface LegalDetailsValues {
  legalName: string;
  legalAddress: string;
  legalRepresentative: string;
  legalRegister: string;
  legalContactEmail: string;
}

interface Props {
  initial: LegalDetailsValues;
  /** Character limits from lib/organizers LEGAL_LIMITS (the API enforces the same). */
  limits: { name: number; address: number; representative: number; register: number; contactEmail: number };
}

/**
 * "Legal details shown to buyers / Angaben zum Anbieter" — who the seller is,
 * as every buyer page and email names them, and the controller in the AVV.
 * Used on /portal/settings and on /portal/legal.
 */
export default function LegalDetailsForm({ initial, limits }: Props) {
  const router = useRouter();
  const [v, setV] = useState<LegalDetailsValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const set = (key: keyof LegalDetailsValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setV((prev) => ({ ...prev, [key]: e.target.value }));
    setNotice(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch('/api/portal/legal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; details?: LegalDetailsValues }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      if (data.details) setV(data.details);
      setNotice(
        data.details?.legalName && data.details?.legalAddress
          ? 'Saved — buyers now see these details on your pages, at checkout and in their emails.'
          : 'Saved. Add at least your legal name and postal address to be able to publish.'
      );
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
      {!error && notice && <div className="notice notice-success">{notice}</div>}

      <p className="muted small" style={{ marginTop: 0 }}>
        Buyers must know who they are buying from and who handles their data — so these details appear on your
        pages, at checkout, on tickets and in buyer emails. They also serve as your Impressum on your pages.
      </p>

      <div className="field">
        <label htmlFor="legal-name">Legal name / Name des Anbieters</label>
        <input
          id="legal-name"
          className="input"
          value={v.legalName}
          onChange={set('legalName')}
          maxLength={limits.name}
          placeholder="e.g. Nepali Samaj Darmstadt e.V."
          autoComplete="organization"
          translate="no"
        />
      </div>

      <div className="field">
        <label htmlFor="legal-address">Postal address / Anschrift</label>
        <textarea
          id="legal-address"
          className="input"
          rows={3}
          value={v.legalAddress}
          onChange={set('legalAddress')}
          maxLength={limits.address}
          placeholder={'Musterstraße 1\n64283 Darmstadt'}
          autoComplete="street-address"
          translate="no"
        />
      </div>

      <div className="field">
        <label htmlFor="legal-rep">Represented by / Vertreten durch (e.g. your Vorstand)</label>
        <input
          id="legal-rep"
          className="input"
          value={v.legalRepresentative}
          onChange={set('legalRepresentative')}
          maxLength={limits.representative}
          placeholder="e.g. Ram Sharma (1. Vorsitzender), Sita Rai (Kassiererin)"
          translate="no"
        />
      </div>

      <div className="field">
        <label htmlFor="legal-register">Register entry / Registereintrag (optional)</label>
        <input
          id="legal-register"
          className="input"
          value={v.legalRegister}
          onChange={set('legalRegister')}
          maxLength={limits.register}
          placeholder="e.g. Amtsgericht Darmstadt, VR 1234"
          translate="no"
        />
      </div>

      <div className="field">
        <label htmlFor="legal-email">Contact email for buyers (optional)</label>
        <input
          id="legal-email"
          className="input"
          type="email"
          value={v.legalContactEmail}
          onChange={set('legalContactEmail')}
          maxLength={limits.contactEmail}
          placeholder="e.g. vorstand@example.de"
          autoComplete="email"
          translate="no"
        />
      </div>

      <button type="submit" className="btn btn-brand" disabled={busy}>
        {busy ? 'Saving…' : 'Save legal details'}
      </button>
    </form>
  );
}
