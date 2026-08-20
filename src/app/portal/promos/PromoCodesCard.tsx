'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/money';

/** The shape lib/promos returns, redeclared so this client never imports it. */
export interface PromoCodeView {
  id: string;
  code: string;
  kind: 'fixed' | 'percent';
  amountCents: number;
  percent: number;
  eventId: string | null;
  maxRedemptions: number;
  redeemedCount: number;
  expiresOn: string | null;
  active: number;
  createdAt: string;
}

interface Listing {
  id: string;
  name: string;
}

interface Props {
  initialCodes: PromoCodeView[];
  listings: Listing[];
  currency: string;
}

/** Today as 'YYYY-MM-DD' — the same shape the server compares expiry dates in. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Mint, list and switch off the organizer's own discount codes.
 *
 * The amount is typed in whole currency (9.00), not cents — organizers think
 * in prices — and converted on the way out, which is also where a "9,00" with
 * a comma is accepted, because half of Europe types it that way. Same
 * conversion as the referral rewards card, for the same reason.
 */
export default function PromoCodesCard({ initialCodes, listings, currency }: Props) {
  const [codes, setCodes] = useState<PromoCodeView[]>(initialCodes);
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'fixed' | 'percent'>('fixed');
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState('');
  const [eventId, setEventId] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function parseAmountCents(raw: string): number | null {
    const s = raw.trim().replace(',', '.');
    if (s === '') return 0;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    return Math.round(Number(s) * 100);
  }

  /**
   * A random code, generated in the browser purely as a SUGGESTION the
   * organizer can still edit — the server mints nothing until Create is
   * pressed, and refuses anything it does not like there.
   */
  // The client-side twin of generatePromoCode in lib/promos.ts: same alphabet,
  // and the same NINE characters — an eight-character code reads as one of the
  // thank-you vouchers (THANKS- plus eight), which the server refuses, so a
  // generator that made eight would suggest codes that cannot be saved.
  function suggestCode() {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 9; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    setCode(s);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    const parsedAmount = parseAmountCents(amount);
    if (kind === 'fixed' && parsedAmount === null) {
      setError(`Enter the amount like 5.00 (in ${currency}).`);
      return;
    }
    const parsedPercent = percent.trim() === '' ? 0 : Number(percent.trim());
    if (kind === 'percent' && (!Number.isInteger(parsedPercent) || parsedPercent < 1 || parsedPercent > 100)) {
      setError('Enter a whole percentage between 1 and 100.');
      return;
    }
    const parsedMax = maxRedemptions.trim() === '' ? 0 : Number(maxRedemptions.trim());
    if (!Number.isInteger(parsedMax) || parsedMax < 0) {
      setError('The limit has to be a whole number — or leave it empty for no limit.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/portal/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          kind,
          amountCents: kind === 'fixed' ? parsedAmount : 0,
          percent: kind === 'percent' ? parsedPercent : 0,
          eventId,
          maxRedemptions: parsedMax,
          expiresOn,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; promo?: PromoCodeView }
        | null;
      if (!res.ok || !data?.promo) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      setCodes((prev) => [data.promo!, ...prev]);
      setNotice(`${data.promo.code} is live. Hand it out — buyers type it in at your checkout.`);
      setCode('');
      setAmount('');
      setPercent('');
      setMaxRedemptions('');
      setExpiresOn('');
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(promo: PromoCodeView) {
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch('/api/portal/promos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promo.id, active: promo.active !== 1 }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      const nowActive = promo.active !== 1;
      setCodes((prev) => prev.map((c) => (c.id === promo.id ? { ...c, active: nowActive ? 1 : 0 } : c)));
      setNotice(
        nowActive
          ? `${promo.code} works again.`
          : `${promo.code} is switched off — nobody can redeem it from now on. What it already took off stays on those orders.`
      );
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  function worth(promo: PromoCodeView): string {
    return promo.kind === 'percent'
      ? `${promo.percent}% off`
      : `${formatMoney(promo.amountCents, currency)} off`;
  }

  function scope(promo: PromoCodeView): string {
    if (!promo.eventId) return 'All your listings';
    return listings.find((l) => l.id === promo.eventId)?.name ?? 'One listing';
  }

  /** Why a code is not usable right now — or '' when it is. */
  function dormantReason(promo: PromoCodeView): string {
    if (promo.active !== 1) return 'off';
    if (promo.expiresOn && promo.expiresOn < todayIso()) return 'expired';
    if (promo.maxRedemptions > 0 && promo.redeemedCount >= promo.maxRedemptions) return 'used up';
    return '';
  }

  return (
    <>
      <div className="card anim-fade-up">
        <div className="card-title">Make a code</div>
        {error && <div className="notice notice-error">{error}</div>}
        {!error && notice && <div className="notice notice-success">{notice}</div>}

        {/* The single most important sentence on this page: whose money this
            is. Buyers pay the organizer directly and the platform never
            touches any of it, so a code can only ever be the organizer's own
            reduction of their own price. */}
        <div className="notice" style={{ marginTop: 0 }}>
          <strong>This is your discount, on your own prices.</strong> A code means the buyer
          transfers <em>less money to you</em> — nothing is paid by us and nothing is deducted from
          you. The platform is free, never handles your ticket money, and takes no part of this.
          Only give what you are happy to give away.
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="promo-code">The code buyers type</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                id="promo-code"
                className="input"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="DASHAIN10"
                maxLength={24}
                style={{ flex: '1 1 180px' }}
              />
              <button type="button" className="btn btn-sm" onClick={suggestCode} disabled={busy}>
                Generate one
              </button>
            </div>
            <p className="muted small">
              5 to 24 characters — letters, numbers and dashes. Not exactly eight letters and
              numbers though (dashes do not count): that is the shape of the thank-you vouchers
              your referrers earn, and one buyer typing one box has to mean one thing. Your codes
              are yours: another seller can use the same word without it ever touching yours.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              columnGap: 16,
            }}
          >
            <div className="field">
              <label htmlFor="promo-kind">Takes off</label>
              <select
                id="promo-kind"
                className="input"
                value={kind}
                onChange={(e) => setKind(e.target.value === 'percent' ? 'percent' : 'fixed')}
              >
                <option value="fixed">An amount</option>
                <option value="percent">A percentage</option>
              </select>
            </div>
            {kind === 'fixed' ? (
              <div className="field">
                <label htmlFor="promo-amount">Amount ({currency})</label>
                <input
                  id="promo-amount"
                  className="input"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 5.00"
                />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="promo-percent">Percentage off</label>
                <input
                  id="promo-percent"
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              columnGap: 16,
            }}
          >
            <div className="field">
              <label htmlFor="promo-event">Works on</label>
              <select
                id="promo-event"
                className="input"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                <option value="">All your listings</option>
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="promo-max">Limit (optional)</label>
              <input
                id="promo-max"
                className="input"
                type="number"
                min={0}
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="no limit"
              />
            </div>
            <div className="field">
              <label htmlFor="promo-expires">Last day (optional)</label>
              <input
                id="promo-expires"
                className="input"
                type="date"
                min={todayIso()}
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
              />
            </div>
          </div>

          {/* The test-mode exception is SAID, not left to be discovered. A
              mock order finalizes as paid, so it holds its redemption exactly
              like a real sale until the test orders are deleted — promising
              "never used up by a booking nobody paid for" without that caveat
              was simply untrue for anybody trying the checkout out. */}
          <p className="muted small" style={{ marginTop: 0 }}>
            A limit counts redemptions, and it is given back when an order is cancelled or its
            payment never arrives — a real code is never used up by a booking nobody paid for. One
            exception: a booking you make yourself in test mode counts as paid, so it holds its
            redemption until the test orders are deleted before going live. The last day counts: a
            code that ends on the 20th still works all of the 20th. A buyer can use
            <strong> one code per order</strong>: a code and a thank-you voucher never stack.
          </p>

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden /> : null}
            {busy ? 'Saving…' : 'Create code'}
          </button>
        </form>
      </div>

      <div className="card anim-fade-up anim-d1">
        <div className="card-title">Your codes</div>
        {codes.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            No codes yet. Make one above and hand it out — there is nothing to undo if you change
            your mind, you can switch a code off at any time.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Worth</th>
                  <th>Works on</th>
                  <th>Used</th>
                  <th>Last day</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {codes.map((promo) => {
                  const dormant = dormantReason(promo);
                  return (
                    <tr key={promo.id}>
                      <td>
                        <span className="mono">{promo.code}</span>{' '}
                        {dormant && <span className="badge">{dormant}</span>}
                      </td>
                      <td>{worth(promo)}</td>
                      <td>{scope(promo)}</td>
                      <td>
                        {promo.redeemedCount}
                        {promo.maxRedemptions > 0 ? ` / ${promo.maxRedemptions}` : ''}
                      </td>
                      <td>{promo.expiresOn ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => toggleActive(promo)}
                          disabled={busy}
                        >
                          {promo.active === 1 ? 'Switch off' : 'Switch on'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Said out loud rather than left to be discovered: there is no delete
            button, and that is a decision, not an omission. */}
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          Codes are never deleted — switching one off stops it working, and keeps the record of what
          you gave away honest.
        </p>
      </div>
    </>
  );
}
