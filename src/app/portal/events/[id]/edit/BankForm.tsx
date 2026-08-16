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
    paypalAccount: string;
  };
}

export default function BankForm({ eventId, initial }: Props) {
  const router = useRouter();
  const [holder, setHolder] = useState(initial.bankAccountHolder);
  const [iban, setIban] = useState(initial.bankIban);
  const [bic, setBic] = useState(initial.bankBic);
  const [bankName, setBankName] = useState(initial.bankName);
  const [paypal, setPaypal] = useState(initial.paypalAccount);
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
      paypalAccount: paypal,
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
        Buyers pay <strong>directly to you</strong> — the ticket money goes straight into your own account, the
        platform never touches it. You confirm each payment on the orders page and the tickets go out by email.
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
      {/* PayPal sits in the same form as the IBAN because it is the same thing:
          somewhere for the buyer to send the money, shown to them with the same
          reference. It is NOT a PayPal checkout — nothing is collected on your
          behalf, so there is nothing for us to pay out to you. */}
      <div className="field" style={{ maxWidth: 460 }}>
        <label htmlFor="bank-paypal">PayPal (optional)</label>
        <input
          id="bank-paypal"
          className="input"
          value={paypal}
          onChange={(e) => setPaypal(e.target.value)}
          maxLength={120}
          spellCheck={false}
          placeholder="you@example.com or paypal.me/yourname"
        />
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Offer PayPal as well as the bank transfer. Buyers see this next to your IBAN with the same payment
          reference, send the money themselves, and you confirm it on the orders page exactly as you do a transfer.
          The money lands in <strong>your</strong> PayPal — we never hold it. Leave empty for bank transfer only.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="submit" className="btn btn-brand" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Saving…' : 'Save payment details'}
        </button>
        {saved && <span className="badge badge-green">Saved ✓</span>}
      </div>
    </form>
  );
}
