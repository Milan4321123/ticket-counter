'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveEvent } from './save';

interface Props {
  eventId: string;
  initial: {
    bankAccountHolder: string;
    bankIban: string;
    bankBic: string;
    bankName: string;
  };
}

export default function BankForm({ eventId, initial }: Props) {
  const router = useRouter();
  const [holder, setHolder] = useState(initial.bankAccountHolder);
  const [iban, setIban] = useState(initial.bankIban);
  const [bic, setBic] = useState(initial.bankBic);
  const [bankName, setBankName] = useState(initial.bankName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await saveEvent(eventId, {
      bankAccountHolder: holder,
      bankIban: iban,
      bankBic: bic,
      bankName,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong — please try again.');
      return;
    }
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2200);
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Buyers pay by bank transfer <strong>directly to this account</strong> — the ticket money goes straight to you,
        the platform never touches it. You confirm each transfer on the orders page and the tickets go out by email.
      </p>
      {error && <div className="notice notice-error">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 16 }}>
        <div className="field">
          <label htmlFor="bank-holder">Account holder</label>
          <input
            id="bank-holder"
            className="input"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            maxLength={120}
            placeholder="Name on the account"
          />
        </div>
        <div className="field">
          <label htmlFor="bank-iban">IBAN</label>
          <input
            id="bank-iban"
            className="input mono"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            maxLength={60}
            spellCheck={false}
            placeholder="DE89 3704 0044 0532 0130 00"
          />
        </div>
        <div className="field">
          <label htmlFor="bank-bic">BIC (optional)</label>
          <input
            id="bank-bic"
            className="input mono"
            value={bic}
            onChange={(e) => setBic(e.target.value)}
            maxLength={20}
            spellCheck={false}
            placeholder="COBADEFFXXX"
          />
        </div>
        <div className="field">
          <label htmlFor="bank-bankname">Bank name (optional)</label>
          <input
            id="bank-bankname"
            className="input"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Commerzbank"
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="submit" className="btn btn-brand" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Saving…' : 'Save bank details'}
        </button>
        {saved && <span className="badge badge-green">Saved ✓</span>}
      </div>
    </form>
  );
}
