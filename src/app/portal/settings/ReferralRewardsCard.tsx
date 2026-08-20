'use client';

import { useState } from 'react';

interface Props {
  initialThreshold: number;
  initialRewardCents: number;
  currency: string;
}

/**
 * Referral rewards: how many confirmed paid referrals earn one voucher, and
 * what that voucher is worth.
 *
 * The amount is typed in whole currency (9.00), not cents — organizers think
 * in prices — and converted on the way out, which is also where a "9,00" with
 * a comma is accepted, because half of Europe types it that way.
 */
export default function ReferralRewardsCard({ initialThreshold, initialRewardCents, currency }: Props) {
  const [threshold, setThreshold] = useState(initialThreshold > 0 ? String(initialThreshold) : '');
  const [reward, setReward] = useState(initialRewardCents > 0 ? (initialRewardCents / 100).toFixed(2) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function parseAmountCents(raw: string): number | null {
    const s = raw.trim().replace(',', '.');
    if (s === '') return 0;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    return Math.round(Number(s) * 100);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    const rawThreshold = threshold.trim();
    if (rawThreshold !== '' && !/^\d{1,3}$/.test(rawThreshold)) {
      setError('The number of referrals must be a whole number — or leave it empty to switch rewards off.');
      return;
    }
    const parsedThreshold = rawThreshold === '' ? 0 : Number(rawThreshold);
    const parsedReward = parseAmountCents(reward);
    if (parsedReward === null) {
      setError(`Enter the voucher amount like 5.00 (in ${currency}) — or leave it empty to switch rewards off.`);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/portal/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: parsedThreshold, rewardCents: parsedReward }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; threshold?: number; rewardCents?: number; enabled?: boolean }
        | null;
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      setNotice(
        data?.enabled
          ? `Saved — every ${data.threshold} confirmed paid referrals now earn one voucher.`
          : 'Saved — referral rewards are switched off. Nobody is promised anything.'
      );
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
        Buyers already get a share link on their order page, and you can see who brings friends under
        Insights. Switch this on and those friends earn something: when someone&rsquo;s link has
        brought you the number of confirmed, actually-paid bookings you set here, they get a voucher
        code worth what you set here, and we email it to them in your name.
      </p>

      {/* The single most important sentence on this page: whose money this is.
          Buyers pay the organizer directly and the platform never touches any
          of it, so a "reward" can only ever be the organizer's own discount. */}
      <div className="notice" style={{ marginTop: 0 }}>
        <strong>This is your discount, on your own prices.</strong> A voucher means the buyer
        transfers <em>less money to you</em> — nothing is paid by us and nothing is deducted from you.
        The platform is free, never handles your ticket money, and takes no part of this. Only give
        what you are happy to give away.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', columnGap: 16 }}>
        <div className="field">
          <label htmlFor="ref-threshold">Referrals per voucher</label>
          <input
            id="ref-threshold"
            className="input"
            type="number"
            min={1}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="e.g. 5"
          />
        </div>
        <div className="field">
          <label htmlFor="ref-reward">Voucher is worth ({currency})</label>
          <input
            id="ref-reward"
            className="input"
            type="text"
            inputMode="decimal"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            placeholder="e.g. 5.00"
          />
        </div>
      </div>

      <p className="muted small" style={{ marginTop: 0 }}>
        Only bookings that are <strong>confirmed and actually paid</strong> count — a free
        reservation, a test order, and a booking one of your vouchers already paid part of do not
        (which is what stops a voucher paying for the next voucher). The count runs across all of
        your listings, so somebody who brings two friends to one and three to the next has brought
        five.
      </p>
      <p className="muted small" style={{ marginTop: 0 }}>
        Counting starts <strong>the day you switch this on</strong> — referrals from before that
        earn nothing, so turning rewards on never lands you with a pile of vouchers for bookings you
        made no promise about. Lowering the number of referrals per voucher starts the count fresh
        the same way; raising it, or changing what a voucher is worth, leaves everyone&rsquo;s
        progress where it is. Vouchers people have already earned keep their value whatever you
        change here, and can be spent at any of your checkouts, once each.
      </p>

      {/* The other half of the same idea, one click away: vouchers are earned
          automatically, codes are handed out on purpose. */}
      <p className="muted small" style={{ marginTop: 0 }}>
        Want a code you hand out yourself — an early-bird code, one for a sponsor, one for a
        WhatsApp group? Make one under <a href="/portal/promos">Discount codes</a>. Buyers type
        either kind into the same box, and only one applies per order.
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Saving…' : 'Save referral rewards'}
        </button>
        <span className="muted small">Leave both empty to switch rewards off.</span>
      </div>
    </form>
  );
}
