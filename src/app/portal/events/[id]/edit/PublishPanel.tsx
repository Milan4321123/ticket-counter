'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CopyButton from '@/components/CopyButton';
import { saveEvent } from './save';

interface ChecklistItem {
  ok: boolean;
  label: string;
}

/** Everything the fee card needs, quoted on the server from this event's capacity. */
export interface EventFeeInfo {
  paid: boolean;
  /** This event's own fee, e.g. '€50.00'. */
  amount: string;
  /** Amount as plain digits for the copy button, e.g. '50.00'. */
  amountPlain: string;
  /** Where that amount came from, e.g. 'Your venue holds 500 — that is €1.00 for every 10 tickets.' */
  basis: string;
  /** This event's Verwendungszweck, e.g. 'EVENT-4BD6F584'. */
  reference: string;
  /** The PLATFORM's bank details; null until the owner configures them. */
  bank: { accountHolder: string; iban: string; bic: string; bankName: string } | null;
}

interface Props {
  eventId: string;
  status: 'draft' | 'published' | 'archived';
  slug: string;
  checklist: ChecklistItem[];
  fee: EventFeeInfo;
}

// Fixed-width labels keep the .copy-row values aligned.
const rowLabelStyle = { minWidth: 130 } as const;

export default function PublishPanel({ eventId, status, slug, checklist, fee }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [feeNote, setFeeNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checklistReady = checklist.every((c) => c.ok);
  const ready = checklistReady && fee.paid;

  async function setStatus(next: 'draft' | 'published') {
    if (busy) return;
    if (
      next === 'draft' &&
      !window.confirm('Take the event offline?\n\nIt disappears from the public feed and its page — you can publish it again any time. Existing tickets stay valid.')
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await saveEvent(eventId, { status: next });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong — please try again.');
      return;
    }
    router.refresh();
  }

  /**
   * Ask the server for the payment details by mail. It is the same publish
   * attempt the button makes — the server answers with the friendly "still
   * needs its fee" line and sends the email as it does so.
   */
  async function emailFeeDetails() {
    if (emailing) return;
    setEmailing(true);
    setError(null);
    setFeeNote(null);
    const result = await saveEvent(eventId, { status: 'published' });
    setEmailing(false);
    if (result.ok) {
      // Rare race: the fee was confirmed while this page was open, so the same
      // request published the event instead of being turned away.
      setFeeNote('Good news — your fee had just been confirmed, so your event is live now.');
      router.refresh();
      return;
    }
    setFeeNote(result.error ?? 'Could not reach the server — please try again.');
  }

  if (status === 'archived') {
    return (
      <p className="muted" style={{ margin: 0 }}>
        This event has been archived by the platform. Get in touch with them if you think that&rsquo;s a mistake.
      </p>
    );
  }

  return (
    <div>
      {error && <div className="notice notice-error">{error}</div>}

      {status === 'published' ? (
        <div>
          <p style={{ marginTop: 0 }}>
            <span className="badge badge-green">Live</span>{' '}
            Your event is public — people can find it in the feed and buy tickets at{' '}
            <a href={`/e/${slug}`} style={{ color: 'var(--accent)' }} className="mono small">
              /e/{slug}
            </a>
            .
          </p>
          <button type="button" className="btn btn-sm" onClick={() => void setStatus('draft')} disabled={busy}>
            {busy ? 'Working…' : 'Take offline'}
          </button>
        </div>
      ) : (
        <div>
          {!fee.paid && (
            <div className="bank-box" style={{ margin: '0 0 20px' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pulse-dot" aria-hidden />
                Event fee — {fee.amount}
              </div>
              <p className="muted small" style={{ marginTop: 0 }}>
                {fee.basis} One transfer for this event, nothing else: no yearly plan, and no
                commission on your ticket sales. Send it to the account below with the reference
                exactly as shown.
              </p>

              {fee.bank ? (
                <>
                  <div className="copy-row">
                    <span className="muted small" style={rowLabelStyle}>
                      Amount
                    </span>
                    <strong>{fee.amount}</strong>
                    <CopyButton value={fee.amountPlain} />
                  </div>
                  <div className="copy-row">
                    <span className="muted small" style={rowLabelStyle}>
                      Account holder
                    </span>
                    <span>{fee.bank.accountHolder}</span>
                  </div>
                  <div className="copy-row">
                    <span className="muted small" style={rowLabelStyle}>
                      IBAN
                    </span>
                    <span className="mono">{fee.bank.iban}</span>
                    <CopyButton value={fee.bank.iban} />
                  </div>
                  {fee.bank.bic ? (
                    <div className="copy-row">
                      <span className="muted small" style={rowLabelStyle}>
                        BIC
                      </span>
                      <span className="mono">{fee.bank.bic}</span>
                    </div>
                  ) : null}
                  {fee.bank.bankName ? (
                    <div className="copy-row">
                      <span className="muted small" style={rowLabelStyle}>
                        Bank
                      </span>
                      <span>{fee.bank.bankName}</span>
                    </div>
                  ) : null}
                  <div
                    className="copy-row"
                    style={{ borderColor: 'rgba(220, 20, 60, 0.6)', background: 'rgba(220, 20, 60, 0.08)' }}
                  >
                    <span className="muted small" style={rowLabelStyle}>
                      Verwendungszweck
                    </span>
                    <span className="mono" style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.05em' }}>
                      {fee.reference}
                    </span>
                    <CopyButton value={fee.reference} />
                  </div>
                  <p className="muted small" style={{ margin: '12px 0 0' }}>
                    The reference is the important part: it is what tells us the money is for{' '}
                    <strong>this</strong> event. Once we see your transfer we unlock publishing — usually
                    within a day. We&rsquo;ll email you the moment it&rsquo;s live. Change your capacity
                    before you pay and the amount above changes with it.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <button type="button" className="btn btn-sm" onClick={() => void emailFeeDetails()} disabled={emailing}>
                      {emailing ? 'Sending…' : 'Email me these details'}
                    </button>
                  </div>
                  {feeNote && (
                    <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
                      {feeNote}
                    </div>
                  )}
                </>
              ) : (
                <div className="notice notice-warn" style={{ marginBottom: 0 }}>
                  The payment details aren&rsquo;t set up yet. Please get in touch with the platform team and
                  they&rsquo;ll unlock publishing for this event.
                </div>
              )}
            </div>
          )}

          {fee.paid && (
            <p className="small" style={{ marginTop: 0, color: 'var(--green)', fontWeight: 600 }}>
              <span className="badge badge-green">Event fee paid</span> Thanks — this event is paid for.
            </p>
          )}

          <p className="muted small" style={{ marginTop: 0 }}>
            Publishing puts your event in the public feed right away, and buyers can start reserving tickets. Here&rsquo;s
            what it still needs:
          </p>
          <ul className="check-list">
            {checklist.map((item) => (
              <li key={item.label} className="check-item">
                <span
                  className={`check-dot${item.ok ? ' check-dot-done' : ''}`}
                  role="img"
                  aria-label={item.ok ? 'done' : 'still to do'}
                >
                  {item.ok ? '✓' : ''}
                </span>
                <span className={item.ok ? 'check-label-done' : undefined}>{item.label}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-brand"
            onClick={() => void setStatus('published')}
            disabled={busy || !ready}
            title={
              fee.paid
                ? checklistReady
                  ? undefined
                  : 'Finish the checklist above first'
                : `Waiting for your ${fee.amount} event fee to arrive`
            }
          >
            {busy ? <span className="spinner" aria-hidden /> : null}
            {busy ? 'Publishing…' : 'Publish event'}
          </button>
          {!ready && (
            <p className="muted small" style={{ margin: '10px 0 0' }}>
              {fee.paid
                ? 'The button unlocks once every item above is done.'
                : `The button unlocks once your ${fee.amount} transfer arrives${
                    checklistReady ? '' : ' and every item above is done'
                  }.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
