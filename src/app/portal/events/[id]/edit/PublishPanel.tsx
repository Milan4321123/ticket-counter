'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveEvent } from './save';
import { vocabFor } from '@/lib/vocab';
import type { EventKind } from '@/lib/types';

interface ChecklistItem {
  ok: boolean;
  label: string;
}

interface Props {
  eventId: string;
  kind: EventKind;
  status: 'draft' | 'published' | 'archived';
  slug: string;
  checklist: ChecklistItem[];
  /** A try-it-yourself demo: it never goes live, the preview is the end. */
  isDemo?: boolean;
  /**
   * How many subscribers an announcement about THIS listing would reach right
   * now: the organizer's confirmed, not-unsubscribed addresses minus anyone
   * already announced-to for this event. Computed server-side by the same
   * query the announce route walks (lib/marketing.ts), so the number shown is
   * the number sent.
   */
  announceAudience: number;
  /**
   * Advice, never a gate — see lib/listingQuality. Empty for events, and empty
   * for a shop that is already doing everything, in which case the panel says
   * so rather than drawing a box with nothing in it.
   */
  quality?: { key: string; label: string; why: string; tab: string }[];
  /** One line above them, or the praise line when there are none. */
  qualityLine?: string;
  /**
   * Another live listing bills the same act in a different city.
   *
   * Advice, like `quality` — publishing is never blocked by it. It is here
   * because the organizer is the only person who can fix the root cause: two
   * shows of one act, in two countries, titled so alike that buyers pick the
   * wrong one. Undefined for the overwhelming majority of listings; see
   * lib/sameAct.ts for how narrow the match is.
   */
  sameAct?: {
    /** This listing's own city, already de-postcoded. */
    city: string;
    /** "Lisbon on Mon 19 Oct", one per other show. */
    others: string[];
    /** False when the title already carries the city, so the advice is dropped. */
    suggestTitle: boolean;
  };
}

// There used to be a fee card here — the per-event platform fee, its bank
// details and Verwendungszweck, and an "email me these details" button. The
// platform is free while it grows, so publishing now waits on nothing but the
// checklist. The card was removed rather than hidden so this tab can never
// show a price again by accident.
export default function PublishPanel({
  eventId,
  kind,
  status,
  slug,
  checklist,
  isDemo = false,
  announceAudience,
  quality = [],
  qualityLine = '',
  sameAct,
}: Props) {
  const router = useRouter();
  const v = vocabFor(kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = checklist.every((c) => c.ok);

  // The announcement flow: one confirm step (a second button press — no typing),
  // because the audience count on the first button already says exactly what is
  // about to happen, and the server's send-tracking makes even a double send of
  // one event harmless. 'sent' keeps the result on screen until the next visit.
  const [announceStep, setAnnounceStep] = useState<'idle' | 'confirm' | 'sending' | 'sent'>('idle');
  const [announceResult, setAnnounceResult] = useState<string | null>(null);
  const [announceError, setAnnounceError] = useState<string | null>(null);

  async function sendAnnouncement() {
    if (announceStep === 'sending') return;
    setAnnounceStep('sending');
    setAnnounceError(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/announce`, { method: 'POST' });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; sent?: number; failed?: number; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setAnnounceError(data?.error ?? 'Something went wrong — nothing extra was sent. Please try again.');
        setAnnounceStep('confirm');
        return;
      }
      setAnnounceResult(
        data.sent === 0
          ? 'Everyone had already been told — no new emails to send.'
          : `Sent to ${data.sent} subscriber${data.sent === 1 ? '' : 's'}.${
              data.failed ? ` ${data.failed} could not be delivered — they stay eligible for a retry.` : ''
            }`
      );
      setAnnounceStep('sent');
      // The audience count comes from the server — refresh so it shows 0 next.
      router.refresh();
    } catch {
      setAnnounceError('We could not reach the server — please check your connection and try again.');
      setAnnounceStep('confirm');
    }
  }

  async function setStatus(next: 'draft' | 'published') {
    if (busy) return;
    if (
      next === 'draft' &&
      !window.confirm(
        `Take the ${v.listing} offline?\n\nIt comes off the public feed and its link stops working. You keep editing it in your portal and can publish it again any time. ${v.Codes} already bought stay valid.`
      )
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

  if (status === 'archived') {
    return (
      <p className="muted" style={{ margin: 0 }}>
        This {v.listing} has been archived by the platform. Get in touch with them if you think that&rsquo;s a
        mistake.
      </p>
    );
  }

  return (
    <div>
      {error && <div className="notice notice-error">{error}</div>}

      {/* Before the checklist and before the buttons, because it is about the
          one thing the organizer cannot change later without confusing the
          people who already bought: what this listing is CALLED. */}
      {sameAct && sameAct.others.length > 0 && (
        <div className="notice notice-warn">
          <strong>The same act is playing elsewhere.</strong> {sameAct.others.join(' and ')} — by
          another organizer, on their own page. Your page and theirs each link to the other, so
          nobody buys the wrong city by accident.
          {sameAct.suggestTitle ? (
            <>
              {' '}
              Putting <strong>{sameAct.city}</strong> in your title helps even more: it is the one
              thing buyers see in the feed, in search results and in their inbox.
            </>
          ) : null}
        </div>
      )}

      {status === 'published' ? (
        <div>
          <p style={{ marginTop: 0 }}>
            <span className="badge badge-green">Live</span>{' '}
            Your {v.listing} is public — people can find it in the feed and buy {v.units} at{' '}
            <a href={`/e/${slug}`} style={{ color: 'var(--accent)' }} className="mono small">
              /e/{slug}
            </a>
            .
          </p>
          <button type="button" className="btn btn-sm" onClick={() => void setStatus('draft')} disabled={busy}>
            {busy ? 'Working…' : 'Take offline'}
          </button>
          <p className="muted small" style={{ margin: '10px 0 0' }}>
            Your page comes off the feed and its public link stops working, and you carry on editing
            it here exactly as before. Publish again whenever you like — going offline and back on
            costs nothing. {v.Codes} people already bought stay valid either way.
          </p>

          {/* Only while live: the poster's QR code opens the public page, and a
              draft's link answers nothing — handing that into a group chat would
              burn the one moment people were curious. A plain <a>, not a fetch:
              the route streams a PNG and the browser's own download handling is
              exactly the right amount of UI. */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 20 }}>
            <div className="card-title" style={{ fontSize: 16 }}>Poster for WhatsApp</div>
            <p className="muted small" style={{ margin: '6px 0 12px' }}>
              A picture of your {v.listing} sized for group chats and statuses, with a QR code that
              opens your page — forward it wherever your buyers already are.
            </p>
            <a href={`/api/portal/events/${eventId}/poster`} download className="btn btn-sm">
              Download poster
            </a>
          </div>

          {/* Only while live, like the poster: the email links to the public
              page. The audience is ONLY people who ticked "keep me posted" at
              one of this organizer's checkouts and have not unsubscribed — the
              server enforces that, and also that nobody hears about one
              listing twice, however often this button is pressed. */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 20 }}>
            <div className="card-title" style={{ fontSize: 16 }}>Tell your subscribers</div>
            <p className="muted small" style={{ margin: '6px 0 12px' }}>
              {announceAudience === 0 && announceStep !== 'sent'
                ? `Nobody to email yet. Buyers can tick “keep me posted” at your checkouts and confirm it from their inbox — everyone who has (and has not already been told about this ${v.listing}) shows up here.`
                : `People who ticked “keep me posted” at one of your checkouts and confirmed it from their inbox get one email about this ${v.listing} — at most one per listing, each with a one-button unsubscribe link.`}
            </p>
            {announceError && <div className="notice notice-error">{announceError}</div>}
            {announceStep === 'sent' ? (
              <p className="small" style={{ margin: 0 }}>
                <span className="badge badge-green">Done</span> {announceResult}
              </p>
            ) : announceStep === 'idle' ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setAnnounceStep('confirm')}
                disabled={announceAudience === 0}
              >
                Announce to {announceAudience} subscriber{announceAudience === 1 ? '' : 's'}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-brand btn-sm"
                  onClick={() => void sendAnnouncement()}
                  disabled={announceStep === 'sending'}
                >
                  {announceStep === 'sending'
                    ? 'Sending…'
                    : `Yes — email ${announceAudience} subscriber${announceAudience === 1 ? '' : 's'} now`}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setAnnounceStep('idle')}
                  disabled={announceStep === 'sending'}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="notice" style={{ marginTop: 0 }}>
            <strong>See it before you decide.</strong> Your page is finished enough to look at —
            open it exactly as visitors will see it, while it is still private. Nobody else can open
            that link.
            <div style={{ marginTop: 10 }}>
              <a href={`/e/${slug}`} className="btn btn-sm" target="_blank" rel="noopener">
                Preview my page ↗
              </a>
            </div>
          </div>

          <p className="muted small" style={{ marginTop: 0 }}>
            Publishing is free and puts your {v.listing} in the public feed right away — buyers can
            start reserving {v.units}. Here&rsquo;s what it still needs:
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
          {isDemo ? (
            <div className="notice">
              <strong>Demo pages stay private.</strong> They can&rsquo;t go live — who publishes on this
              platform is decided by hand. Use &ldquo;Preview my page&rdquo; above to see it.
              <div style={{ marginTop: 10 }}>
                <a href="/contact?intent=account" className="btn btn-sm btn-brand">
                  Get a real account
                </a>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-brand"
              onClick={() => void setStatus('published')}
              disabled={busy || !ready}
              title={ready ? undefined : 'Finish the checklist above first'}
            >
              {busy ? <span className="spinner" aria-hidden /> : null}
              {busy ? 'Publishing…' : `Publish ${v.listing}`}
            </button>
          )}
          {!ready && !isDemo && (
            <p className="muted small" style={{ margin: '10px 0 0' }}>
              The button unlocks once every item above is done.
            </p>
          )}
        </div>
      )}

      {/* How the shop LOOKS, as opposed to whether it may be published.
          Deliberately below everything else and deliberately not a checklist
          with ticks: nothing here blocks anything, and a second list of
          circles beside the publish gate would read as more rules. Each line
          says what a shopper sees today, because a seller who is told the
          consequence can decide for themselves whether they care. */}
      {qualityLine && (
        <div style={{ marginTop: 26, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <div className="card-step-head" style={{ marginBottom: 4 }}>
            <strong>How your shop looks to a buyer</strong>
          </div>
          <p className="muted small" style={{ margin: '0 0 12px' }}>
            {qualityLine}
          </p>
          {quality.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
              {quality.map((hint) => (
                <li key={hint.key}>
                  <div className="tier-name" style={{ marginBottom: 2 }}>
                    {hint.label}
                  </div>
                  <p className="muted small" style={{ margin: 0 }}>
                    {hint.why}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
