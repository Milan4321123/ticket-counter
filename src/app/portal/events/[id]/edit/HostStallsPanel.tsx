'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** A shop waiting for this host's yes or no, joined server-side. */
export interface PendingStallRequest {
  id: string;
  shopName: string;
  shopSlug: string;
  sellerName: string;
  message: string;
  requestedAt: string;
}

/** An approved stall on this event, joined server-side. */
export interface ApprovedStall {
  id: string;
  shopName: string;
  shopSlug: string;
  sellerName: string;
  stallPickupInfo: string;
  /**
   * Paid orders across the WHOLE shop — orders carry no per-event attribution,
   * so this is honestly labelled shop-wide wherever it is shown.
   */
  paidOrders: number;
  /** stallVisibleOnEventPage(), computed server-side — the one visibility rule. */
  visible: boolean;
  /** Why the card is hidden right now, or '' when it is showing. */
  hiddenReason: string;
}

/**
 * The host organizer's side of vendor stalls: the requests waiting on them and
 * the stalls already on their event page. Approving is consent and placement
 * only — every order, payment and scan stays the shop's own, and this panel
 * says so out loud so a host never thinks they took on someone else's money.
 */
export default function HostStallsPanel({
  eventId,
  pending,
  approved,
}: {
  eventId: string;
  pending: PendingStallRequest[];
  approved: ApprovedStall[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function act(linkId: string, action: 'approve' | 'decline' | 'revoke') {
    if (busyId !== null) return;
    setBusyId(linkId);
    setErrors((e) => ({ ...e, [linkId]: '' }));
    try {
      const res = await fetch(`/api/portal/events/${eventId}/stalls/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setErrors((e) => ({ ...e, [linkId]: data?.error ?? 'Something went wrong — please try again.' }));
        setBusyId(null);
        return;
      }
      setBusyId(null);
      router.refresh();
    } catch {
      setErrors((e) => ({ ...e, [linkId]: 'Could not reach the server — please try again.' }));
      setBusyId(null);
    }
  }

  function decline(r: PendingStallRequest) {
    if (
      !window.confirm(
        `Decline ${r.shopName}?\n\nThe seller is told by email. They can ask again later.`
      )
    ) {
      return;
    }
    void act(r.id, 'decline');
  }

  function revoke(s: ApprovedStall) {
    // The count is shop-wide, and the wording must say so honestly: orders
    // carry no host attribution, so "N orders for your event" would be a lie.
    const orderLine =
      s.paidOrders > 0
        ? `\n\nThis shop has ${s.paidOrders} paid order${s.paidOrders === 1 ? '' : 's'} awaiting collection — across all its sales, not just your event. Removing the stall does not cancel them: buyers paid the seller directly, and honouring or refunding those orders is the seller's job.`
        : '';
    if (
      !window.confirm(
        `Remove ${s.shopName} from your event page?\n\nTheir card disappears immediately and the seller is told by email. They cannot re-request from their side — if you change your mind later, you would have to sort it out with them directly.${orderLine}`
      )
    ) {
      return;
    }
    void act(s.id, 'revoke');
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <p className="muted small" style={{ margin: 0 }}>
        Shops can ask to stand at your event. Approving puts their card in the &ldquo;Order ahead&rdquo;
        section of your event page, linking out to their shop — buyers order there, pay the seller&rsquo;s
        own account directly, and collect at the stall. Your tickets, your door and your money are untouched.
      </p>

      {/* ---- Waiting on you ---- */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 700 }}>Requests</div>
        {pending.length === 0 ? (
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Nothing waiting on you right now.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {pending.map((r) => (
              <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* No slug means the shop unpublished after asking: its public
                      page 404s, and a link promising "what buyers would see"
                      must not open an error page. */}
                  {r.shopSlug ? (
                    <a href={`/e/${r.shopSlug}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
                      {r.shopName} ↗
                    </a>
                  ) : (
                    <span style={{ fontWeight: 700 }}>{r.shopName}</span>
                  )}
                  <span className="muted small">sold by {r.sellerName}</span>
                  <span className="muted small">asked {r.requestedAt.slice(0, 10)}</span>
                </div>
                <p className="muted small" style={{ margin: '6px 0 0' }}>
                  {r.shopSlug
                    ? 'The link opens their public shop page — exactly what buyers would see from your event page.'
                    : 'Their shop page is currently unpublished, so there is nothing to preview — worth waiting until it is back before deciding.'}
                </p>
                {r.message ? (
                  <div className="small" style={{ marginTop: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    &ldquo;{r.message}&rdquo;
                  </div>
                ) : null}
                {errors[r.id] ? (
                  <div className="notice notice-error small" style={{ margin: '10px 0 0' }}>
                    {errors[r.id]}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-brand btn-sm"
                    onClick={() => void act(r.id, 'approve')}
                    disabled={busyId !== null}
                  >
                    {busyId === r.id ? 'Working…' : 'Approve'}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => decline(r)} disabled={busyId !== null}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Live on the page ---- */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 700 }}>Approved stalls</div>
        {approved.length === 0 ? (
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            No stalls on your event page yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {approved.map((s) => (
              <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {s.shopSlug ? (
                    <a href={`/e/${s.shopSlug}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
                      {s.shopName} ↗
                    </a>
                  ) : (
                    <span style={{ fontWeight: 700 }}>{s.shopName}</span>
                  )}
                  <span className="muted small">sold by {s.sellerName}</span>
                  {/* The same rule the public page reads (stallVisibleOnEventPage),
                      so this tick can never disagree with what buyers see. */}
                  {s.visible ? (
                    <span className="badge badge-green">On your event page</span>
                  ) : (
                    <span className="badge badge-amber">Hidden — {s.hiddenReason}</span>
                  )}
                </div>
                {s.stallPickupInfo ? (
                  <p className="muted small" style={{ margin: '6px 0 0' }}>
                    At your event: {s.stallPickupInfo}
                  </p>
                ) : null}
                {errors[s.id] ? (
                  <div className="notice notice-error small" style={{ margin: '10px 0 0' }}>
                    {errors[s.id]}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <button type="button" className="btn btn-sm" onClick={() => revoke(s)} disabled={busyId !== null}>
                    {busyId === s.id ? 'Working…' : 'Remove from page'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="muted small" style={{ margin: 0 }}>
        Each stall scans its own collection codes with its own scanner link from their portal — your door
        scanner only checks in tickets, and a collection code shown at your door is simply refused.
      </p>
      <p className="muted small" style={{ margin: 0 }}>
        The platform never handles or mediates any payment between you and a vendor — booth rent, if any,
        is your own offline business.
      </p>
    </div>
  );
}
