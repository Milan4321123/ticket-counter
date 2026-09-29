'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Mirrors the caps the API enforces, so the form cannot promise what the
// route would refuse.
const MAX_MESSAGE = 500;
const MAX_PICKUP_INFO = 300;

/** A published, upcoming event the shop could ask to stand at. */
export interface StallHostOption {
  id: string;
  name: string;
  dateDisplay: string;
  city: string;
}

/** One link this shop holds, joined server-side with the host's details. */
export interface ShopStallLink {
  id: string;
  status: 'requested' | 'approved' | 'declined' | 'revoked' | 'withdrawn';
  stallPickupInfo: string;
  hostName: string;
  /** '' when the host page is not publicly reachable right now. */
  hostSlug: string;
  hostDate: string;
  /** True once the host event's date has passed — the card no longer shows. */
  hostPast: boolean;
  hostOrganizerName: string;
}

/**
 * The shop owner's side of vendor stalls: pick a published upcoming event and
 * ask its host for a stall, watch the answer, withdraw, and — once approved —
 * tell buyers where the stall stands at that event.
 *
 * Everything here is consent and placement only. Orders, money and scanning
 * stay on the shop exactly as they are; the panel repeats that where it
 * matters so nobody expects more from a link than it does.
 */
export default function StallRequestsPanel({
  shopId,
  hosts,
  links,
  paidOrders,
}: {
  shopId: string;
  hosts: StallHostOption[];
  links: ShopStallLink[];
  /**
   * Paid orders across the WHOLE shop — orders carry no per-event attribution,
   * so the withdraw warning labels the number shop-wide, never per event.
   */
  paidOrders: number;
}) {
  const router = useRouter();
  const [hostEventId, setHostEventId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);
  // Per-link state for the withdraw button and the collection-note editor.
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});
  const [pickupDrafts, setPickupDrafts] = useState<Record<string, string>>({});
  const [savedPickup, setSavedPickup] = useState<Record<string, boolean>>({});

  async function ask() {
    if (busy) return;
    if (!hostEventId) {
      setFormError('Pick an event first.');
      return;
    }
    setBusy(true);
    setFormError('');
    setSent(false);
    try {
      const res = await fetch(`/api/portal/events/${shopId}/stall-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostEventId, message: message.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFormError(data?.error ?? 'Something went wrong — please try again.');
        setBusy(false);
        return;
      }
      setSent(true);
      setHostEventId('');
      setMessage('');
      setBusy(false);
      router.refresh();
    } catch {
      setFormError('Could not reach the server — please try again.');
      setBusy(false);
    }
  }

  async function patchLink(linkId: string, body: Record<string, unknown>): Promise<boolean> {
    setLinkErrors((e) => ({ ...e, [linkId]: '' }));
    try {
      const res = await fetch(`/api/portal/events/${shopId}/stall-requests/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setLinkErrors((e) => ({ ...e, [linkId]: data?.error ?? 'Something went wrong — please try again.' }));
        return false;
      }
      return true;
    } catch {
      setLinkErrors((e) => ({ ...e, [linkId]: 'Could not reach the server — please try again.' }));
      return false;
    }
  }

  async function withdraw(link: ShopStallLink) {
    if (busy) return;
    // The count is shop-wide, and the wording must say so honestly: orders
    // carry no host attribution, so "N orders for this event" would be a lie.
    const orderLine =
      paidOrders > 0
        ? ` This shop has ${paidOrders} paid order${paidOrders === 1 ? '' : 's'} awaiting collection — across all your sales, not just this event.`
        : '';
    const warning =
      link.status === 'approved'
        ? `Withdraw from ${link.hostName}?\n\nYour card disappears from their event page immediately.${orderLine} Buyers who already pre-ordered keep their paid orders — honouring or refunding them stays your job.`
        : `Withdraw your request to ${link.hostName}?\n\nThe host will simply see it gone. You can ask again later.`;
    if (!window.confirm(warning)) return;
    setBusy(true);
    const ok = await patchLink(link.id, { action: 'withdraw' });
    setBusy(false);
    if (ok) router.refresh();
  }

  async function savePickup(link: ShopStallLink) {
    if (busy) return;
    setBusy(true);
    const ok = await patchLink(link.id, { stallPickupInfo: (pickupDrafts[link.id] ?? link.stallPickupInfo).trim() });
    setBusy(false);
    if (ok) {
      setSavedPickup((s) => ({ ...s, [link.id]: true }));
      router.refresh();
    }
  }

  // Plain-language status, exactly the states the plan names — no jargon like
  // "revoked" ever reaches the screen.
  function statusBadge(link: ShopStallLink) {
    switch (link.status) {
      case 'requested':
        return <span className="badge badge-amber">Requested — waiting for <span translate="no">{link.hostOrganizerName}</span></span>;
      case 'approved':
        return link.hostPast ? (
          <span className="badge">The event is over</span>
        ) : (
          <span className="badge badge-green">Approved — you&rsquo;re on the event page</span>
        );
      case 'declined':
        return <span className="badge">Declined</span>;
      case 'revoked':
        return <span className="badge badge-red">Removed by the host</span>;
      case 'withdrawn':
        return <span className="badge">Withdrawn</span>;
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <p className="muted small" style={{ margin: 0 }}>
        A stall puts a card for this shop on another organizer&rsquo;s event page, linking back here. Buyers
        still order from your page, pay your account, and show your collection codes at your stall — the
        host only lends you the spotlight, and can take it back.
      </p>

      {/* ---- Ask a host ---- */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 700 }}>Ask a host</div>
        {hosts.length === 0 ? (
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            No upcoming events to ask right now — every published event is either already asked or in the
            past. Check back when new events go live.
          </p>
        ) : (
          <>
            <label className="small" style={{ display: 'block', marginTop: 10 }}>
              Which event?
              <select
                className="input"
                style={{ marginTop: 4 }}
                value={hostEventId}
                onChange={(e) => setHostEventId(e.target.value)}
                disabled={busy}
              >
                <option value="">Pick an event…</option>
                {hosts.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                    {h.dateDisplay ? ` — ${h.dateDisplay}` : ''}
                    {h.city ? ` — ${h.city}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="small" style={{ display: 'block', marginTop: 10 }}>
              A line to the host (optional)
              <textarea
                className="input"
                rows={2}
                maxLength={MAX_MESSAGE}
                style={{ marginTop: 4, resize: 'vertical' }}
                placeholder="Who you are and what you'd sell at their event…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={busy}
              />
            </label>
            {formError ? (
              <div className="notice notice-error small" style={{ margin: '10px 0 0' }}>
                {formError}
              </div>
            ) : null}
            {sent && !formError ? (
              <p className="small" style={{ margin: '10px 0 0' }}>
                <span className="badge badge-green">Sent — the host decides from your public page ✓</span>
              </p>
            ) : null}
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-brand btn-sm" onClick={() => void ask()} disabled={busy || !hostEventId}>
                {busy ? 'Sending…' : 'Ask for a stall'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ---- Existing links ---- */}
      {links.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {links.map((link) => (
            <div key={link.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700 }}>
                  {link.hostSlug ? (
                    <a href={`/e/${link.hostSlug}`} target="_blank" rel="noopener noreferrer">
                      {link.hostName} ↗
                    </a>
                  ) : (
                    link.hostName
                  )}
                </span>
                {link.hostDate ? <span className="muted small">{link.hostDate}</span> : null}
                {statusBadge(link)}
              </div>

              {link.status === 'revoked' && (
                <p className="muted small" style={{ margin: '8px 0 0' }}>
                  The host took your stall off their page. If you want to return, talk to them directly —
                  it cannot be re-requested from here.
                </p>
              )}

              {link.status === 'approved' && !link.hostPast && (
                <div style={{ marginTop: 10 }}>
                  <label className="small" style={{ display: 'block' }}>
                    Where do buyers find you at the event?
                    <input
                      className="input"
                      type="text"
                      maxLength={MAX_PICKUP_INFO}
                      style={{ marginTop: 4 }}
                      placeholder="e.g. Stall 4, food row, from 17:00"
                      value={pickupDrafts[link.id] ?? link.stallPickupInfo}
                      onChange={(e) => {
                        setPickupDrafts((d) => ({ ...d, [link.id]: e.target.value }));
                        setSavedPickup((s) => ({ ...s, [link.id]: false }));
                      }}
                      disabled={busy}
                    />
                  </label>
                  <p className="muted small" style={{ margin: '6px 0 0' }}>
                    Shown on your card on the event page and on your own page&rsquo;s event banner. Change it
                    any time — no re-approval needed.
                  </p>
                </div>
              )}

              {linkErrors[link.id] ? (
                <div className="notice notice-error small" style={{ margin: '10px 0 0' }}>
                  {linkErrors[link.id]}
                </div>
              ) : null}

              {(link.status === 'requested' || link.status === 'approved') && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                  {link.status === 'approved' && !link.hostPast && (
                    <button type="button" className="btn btn-brand btn-sm" onClick={() => void savePickup(link)} disabled={busy}>
                      {busy ? 'Saving…' : 'Save note'}
                    </button>
                  )}
                  {savedPickup[link.id] && <span className="badge badge-green">Saved ✓</span>}
                  <button type="button" className="btn btn-sm" onClick={() => void withdraw(link)} disabled={busy}>
                    Withdraw
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
