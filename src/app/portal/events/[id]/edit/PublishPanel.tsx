'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveEvent } from './save';
import { GOTO_TAB_EVENT } from './GoToTab';
import { vocabFor } from '@/lib/vocab';
import type { EventKind } from '@/lib/types';

interface ChecklistItem {
  ok: boolean;
  label: string;
  /** The editor section where it is fixed, or a page for things outside it. */
  tab?: string;
  href?: string;
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
/** listingQuality's words for where a fix lives → the editor's section keys. */
const HINT_TAB: Record<string, string> = { details: 'basics', items: 'tickets', media: 'media' };

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

  const [copied, setCopied] = useState(false);
  // The full address is only known in the browser; until then the share link
  // is the path (never rendered differently on server and client).
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const publicUrl = () => `${origin}/e/${slug}`;
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy your link:', publicUrl());
    }
  }
  const goTo = (tab: string) => window.dispatchEvent(new CustomEvent<string>(GOTO_TAB_EVENT, { detail: tab }));

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
        <div className="ks">
          {/* ---- Live ---- */}
          <div className="pb-live">
            <span className="pb-live-dot" aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>Your {v.listing} is live</strong>
              <a href={`/e/${slug}`} target="_blank" rel="noopener" className="pb-url mono">
                /e/{slug}
              </a>
            </div>
          </div>

          <section className="ks-step">
            <h3 className="ks-q">
              <span className="ks-num">↗</span> Share it
            </h3>
            <div className="pb-actions">
              <button type="button" className="pb-act" onClick={() => void copyLink()}>
                <span aria-hidden="true">{copied ? '✓' : '🔗'}</span>
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <a
                className="pb-act"
                href={`https://wa.me/?text=${encodeURIComponent(publicUrl())}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span aria-hidden="true">💬</span>
                WhatsApp
              </a>
              {/* The route streams a PNG; the browser's own download is the UI. */}
              <a className="pb-act" href={`/api/portal/events/${eventId}/poster`} download>
                <span aria-hidden="true">🖼</span>
                Poster
              </a>
              <a className="pb-act" href={`/e/${slug}`} target="_blank" rel="noopener">
                <span aria-hidden="true">👁</span>
                View page
              </a>
            </div>
          </section>

          {/* Only people who ticked "keep me posted" at one of this organizer's
              checkouts and have not unsubscribed — the server enforces that,
              and also that nobody hears about one listing twice. */}
          <section className="ks-step">
            <h3 className="ks-q">
              <span className="ks-num">✉</span> Tell your subscribers
            </h3>
            {announceError && (
              <div className="notice notice-error" style={{ margin: 0 }}>
                {announceError}
              </div>
            )}
            {announceStep === 'sent' ? (
              <p className="small" style={{ margin: 0 }}>
                <span className="badge badge-green">Done</span> {announceResult}
              </p>
            ) : announceAudience === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                Nobody to email yet — buyers who tick &ldquo;keep me posted&rdquo; at your checkout show up here.
              </p>
            ) : announceStep === 'idle' ? (
              <div>
                <button type="button" className="btn btn-sm" onClick={() => setAnnounceStep('confirm')}>
                  Email {announceAudience} subscriber{announceAudience === 1 ? '' : 's'}
                </button>
                <p className="muted small" style={{ margin: '6px 0 0' }}>
                  One email per {v.listing}, with an unsubscribe link.
                </p>
              </div>
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
                    : `Yes — email ${announceAudience} now`}
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
          </section>

          {/* A demo could not publish again once offline, so it is not offered. */}
          {!isDemo && (
          <p className="muted small" style={{ margin: 0 }}>
            Need a break?{' '}
            <button type="button" className="bf-link" onClick={() => void setStatus('draft')} disabled={busy}>
              {busy ? 'Working…' : 'Take it offline'}
            </button>{' '}
            — {v.codes} already bought stay valid, and you can publish again any time.
          </p>
          )}
        </div>
      ) : (
        <div className="ks">
          {/* ---- Draft: what is left, each with the way to fix it ---- */}
          <div className="ed-progress" style={{ margin: 0 }}>
            <div className="ed-progress-text">
              <strong>
                {ready ? 'Ready to go live ✓' : `${checklist.filter((c) => c.ok).length} of ${checklist.length} ready`}
              </strong>
              <span>{ready ? 'Publishing is free.' : 'Fix what is left, then publish — it is free.'}</span>
            </div>
            <div className="ed-progress-bar">
              <span
                style={{ width: `${Math.max(4, Math.round((checklist.filter((c) => c.ok).length / checklist.length) * 100))}%` }}
                className={ready ? 'is-full' : ''}
              />
            </div>
          </div>

          <ul className="pb-checks">
            {checklist.map((item) => (
              <li key={item.label} className={item.ok ? 'is-ok' : ''}>
                <span className="pb-check" aria-label={item.ok ? 'done' : 'still to do'} role="img">
                  {item.ok ? '✓' : ''}
                </span>
                <span className="pb-check-label">{item.label}</span>
                {!item.ok &&
                  (item.href ? (
                    <a className="pb-fix" href={item.href}>
                      Fix →
                    </a>
                  ) : item.tab ? (
                    <button type="button" className="pb-fix" onClick={() => goTo(item.tab!)}>
                      Fix →
                    </button>
                  ) : null)}
              </li>
            ))}
          </ul>

          {isDemo ? (
            <div className="notice" style={{ margin: 0 }}>
              <strong>Demo pages stay private.</strong> They can&rsquo;t go live — who publishes on this platform is
              decided by hand. Send it as your application instead: once approved, it moves into your real account
              as a draft.
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href={`/portal/apply?event=${eventId}`} className="btn btn-sm btn-brand">
                  Apply with this page
                </a>
                <a href={`/e/${slug}`} className="btn btn-sm" target="_blank" rel="noopener">
                  Preview my page ↗
                </a>
              </div>
            </div>
          ) : (
            <div className="pb-go">
              <a href={`/e/${slug}`} className="btn btn-lg" target="_blank" rel="noopener">
                👁 Preview
              </a>
              <button
                type="button"
                className="btn btn-brand btn-lg"
                onClick={() => void setStatus('published')}
                disabled={busy || !ready}
                title={ready ? undefined : 'Fix the list above first'}
              >
                {busy ? <span className="spinner" aria-hidden /> : null}
                {busy ? 'Publishing…' : `🚀 Publish ${v.listing}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* How the shop LOOKS, as opposed to whether it may be published —
          advice, never a gate, so it folds away with a count. */}
      {qualityLine && (
        <details className="ks-step ks-more" style={{ marginTop: 18 }}>
          <summary className="ks-q">
            <span className="ks-num">💡</span> Tips to sell more{' '}
            <span className="badge">{quality.length > 0 ? quality.length : '✓'}</span>
          </summary>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            {qualityLine}
          </p>
          {quality.length > 0 && (
            <ul className="pb-checks">
              {quality.map((hint) => (
                <li key={hint.key}>
                  <span className="pb-check-label">
                    <strong>{hint.label}</strong>
                    <span className="muted small" style={{ display: 'block' }}>
                      {hint.why}
                    </span>
                  </span>
                  <button type="button" className="pb-fix" onClick={() => goTo(HINT_TAB[hint.tab] ?? hint.tab)}>
                    Fix →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </div>
  );
}
