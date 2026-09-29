'use client';

import { useState } from 'react';

/** The per-table report POST /api/admin/erase-consent answers with (lib/erasure PersonErasureReport). */
interface ErasureReport {
  orders: number;
  ordersInFlight: { orderId: string; reference: string; eventName: string; status: string; createdAt: string }[];
  reviews: number;
  subscriptions: number;
  customers: number;
  baskets: number;
  loginCodes: number;
  voucherEmails: number;
  contactRequests: number;
  waitlist: number;
  questionsDeleted: number;
  questionsAnonymised: number;
  marketingConsents: number;
  customerCards: number;
  organizerAccount: boolean;
}

const LINES: [keyof ErasureReport, string][] = [
  ['orders', 'orders anonymised (name, email, phone, payer name, note)'],
  ['reviews', 'reviews unsigned (the words stay)'],
  ['subscriptions', 'subscriptions deleted'],
  ['customers', 'customer accounts deleted'],
  ['baskets', 'saved baskets deleted'],
  ['loginCodes', 'pending sign-in codes deleted'],
  ['voucherEmails', 'referral vouchers unlinked (codes still work)'],
  ['contactRequests', 'contact requests deleted'],
  ['waitlist', 'waitlist entries deleted'],
  ['questionsDeleted', 'unanswered questions deleted'],
  ['questionsAnonymised', 'answered questions unsigned'],
  ['marketingConsents', 'keep-me-posted consents / do-not-email records deleted'],
  ['customerCards', 'customer cards deleted'],
];

/**
 * The button behind "erase my record entirely" (Art. 17 GDPR): /privacy, the
 * unsubscribe page and the customer card all say the record is erased entirely
 * when its owner asks. Requests arrive by email to the platform owner, so the
 * owner needs a control that actually works across EVERY table — which lives
 * in lib/erasure.ts; this panel only reports what it did, table by table.
 *
 * Orders still awaiting payment are left alone and listed: erasing one would
 * make a late transfer impossible to confirm. Cancel those first (admin →
 * orders), then run the erasure again.
 */
export default function EraseConsentPanel() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ErasureReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!window.confirm(`Erase everything held about ${email.trim()}, across every seller? This cannot be undone.`)) return;
    setBusy(true);
    setReport(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/erase-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => null)) as { report?: ErasureReport; error?: string } | null;
      if (!res.ok || !data || data.error || !data.report) {
        setError(data?.error || 'Could not erase that address.');
      } else {
        setReport(data.report);
        if (data.report.ordersInFlight.length === 0) setEmail('');
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  const touched = report ? LINES.filter(([key]) => (report[key] as number) > 0) : [];

  return (
    <div className="card">
      <div className="card-title">Erase a person everywhere</div>
      <p className="muted small" style={{ marginTop: 0 }}>
        For &ldquo;delete my data&rdquo; requests (Art. 17, the /privacy promise). One address, every table,
        every seller: orders are anonymised in place (the seller&rsquo;s totals still add up), and
        accounts, subscriptions, waitlists, questions, contact messages, consents, do-not-email records
        and customer cards are deleted. Tickets carry no names, so their codes stay.
      </p>
      {error && <div className="notice notice-error small">{error}</div>}
      {report && (
        <div className="notice notice-success small">
          {touched.length === 0 && report.ordersInFlight.length === 0 ? (
            <>Nothing was on file for that address — nothing to erase.</>
          ) : (
            <>
              <strong>Done.</strong>
              {touched.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {touched.map(([key, label]) => (
                    <li key={key}>
                      {report[key] as number} {label}
                    </li>
                  ))}
                </ul>
              )}
              {report.marketingConsents > 0 && (
                <p style={{ margin: '6px 0 0' }}>
                  Their do-not-email protection is gone with it — a future checkout tick could subscribe them
                  again.
                </p>
              )}
            </>
          )}
        </div>
      )}
      {report && report.ordersInFlight.length > 0 && (
        <div className="notice notice-warn small">
          <strong>
            {report.ordersInFlight.length} order{report.ordersInFlight.length === 1 ? ' is' : 's are'} still
            waiting for payment and {report.ordersInFlight.length === 1 ? 'was' : 'were'} NOT erased
          </strong>{' '}
          — erasing now would make a late transfer impossible to confirm. Cancel{' '}
          {report.ordersInFlight.length === 1 ? 'it' : 'them'} first (or let the seller), then run this again:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {report.ordersInFlight.map((o) => (
              <li key={o.orderId}>
                <span className="mono">{o.reference}</span> · <span translate="no">{o.eventName}</span> · {o.status} ·{' '}
                {o.createdAt.slice(0, 10)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report?.organizerAccount && (
        <div className="notice notice-warn small">
          This address also owns an <strong>organizer account</strong>, which this does not touch. To remove
          it, disable it in Organizers, then use &ldquo;Delete permanently&rdquo; there.
        </div>
      )}
      <form onSubmit={run} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="email"
          className="input"
          style={{ flex: '1 1 240px' }}
          placeholder="person@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          translate="no"
          required
        />
        <button type="submit" className="btn btn-sm btn-danger" disabled={busy || !email.trim()}>
          {busy ? 'Erasing…' : 'Erase everywhere'}
        </button>
      </form>
    </div>
  );
}
