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
        <p className="muted small" style={{ marginTop: 0 }}>
          Your own discount on your own prices — the buyer simply pays you less. We never take a part.
        </p>

        <form onSubmit={submit} className="ks">
          <section className="ks-step">
            <h3 className="ks-q">
              <span className="ks-num">1</span> The code
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                id="promo-code"
                className="input bf-big"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="DASHAIN10"
                maxLength={24}
                aria-label="The code buyers type"
                style={{ flex: '1 1 180px' }}
              />
              <button type="button" className="btn btn-sm" onClick={suggestCode} disabled={busy}>
                ✨ Make one up
              </button>
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              5–24 letters, numbers or dashes (not exactly 8 letters/numbers — that shape is for thank-you vouchers).
            </p>
          </section>

          <section className="ks-step">
            <h3 className="ks-q">
              <span className="ks-num">2</span> How much off?
            </h3>
            <div className="te-seg" role="radiogroup" aria-label="Takes off" style={{ justifySelf: 'start' }}>
              <button type="button" role="radio" aria-checked={kind === 'fixed'} className={kind === 'fixed' ? 'is-on' : ''} onClick={() => setKind('fixed')}>
                {currency === 'EUR' ? '€' : currency} amount
              </button>
              <button type="button" role="radio" aria-checked={kind === 'percent'} className={kind === 'percent' ? 'is-on' : ''} onClick={() => setKind('percent')}>
                % off
              </button>
            </div>
            <div className="ks-presets">
              {(kind === 'fixed' ? ['2', '5', '10'] : ['10', '15', '20', '50']).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`ks-chip${(kind === 'fixed' ? amount : percent) === n ? ' is-on' : ''}`}
                  onClick={() => (kind === 'fixed' ? setAmount(n) : setPercent(n))}
                >
                  {kind === 'fixed' ? `${n} ${currency === 'EUR' ? '€' : currency}` : `${n}%`}
                </button>
              ))}
              {kind === 'fixed' ? (
                <input
                  id="promo-amount"
                  className="input bf-num"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="other"
                  aria-label={`Amount (${currency})`}
                />
              ) : (
                <input
                  id="promo-percent"
                  className="input bf-num"
                  type="number"
                  min={1}
                  max={100}
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  placeholder="other"
                  aria-label="Percentage off"
                />
              )}
            </div>
          </section>

          <section className="ks-step">
            <h3 className="ks-q">
              <span className="ks-num">3</span> Where does it work?
            </h3>
            <select
              id="promo-event"
              className="input"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              aria-label="Works on"
            >
              <option value="">All your listings</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </section>

          <details className="bf-inline" open={maxRedemptions || expiresOn ? true : undefined}>
            <summary>+ Limit how often, or until when (optional)</summary>
            <div className="bf-row">
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="promo-max">Uses in total</label>
                <input
                  id="promo-max"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                  placeholder="no limit"
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="promo-expires">Last day it works</label>
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
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              A use is given back if the order is cancelled or never paid. One code per order.
            </p>
          </details>

          <div className="ks-save">
            <button type="submit" className="btn btn-brand" disabled={busy}>
              {busy ? <span className="spinner" aria-hidden /> : null}
              {busy ? 'Saving…' : 'Create code'}
            </button>
          </div>
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
            <table className="table table-cards">
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
                      <td data-label="Code" className="tc-head">
                        <span className="mono">{promo.code}</span>{' '}
                        {dormant && <span className="badge">{dormant}</span>}
                      </td>
                      <td data-label="Worth">{worth(promo)}</td>
                      <td data-label="Works on">{scope(promo)}</td>
                      <td data-label="Used">
                        {promo.redeemedCount}
                        {promo.maxRedemptions > 0 ? ` / ${promo.maxRedemptions}` : ''}
                      </td>
                      <td data-label="Last day">{promo.expiresOn ?? '—'}</td>
                      <td className="tc-actions" style={{ textAlign: 'right' }}>
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
