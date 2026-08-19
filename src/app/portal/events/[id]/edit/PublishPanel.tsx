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
}

// There used to be a fee card here — the per-event platform fee, its bank
// details and Verwendungszweck, and an "email me these details" button. The
// platform is free while it grows, so publishing now waits on nothing but the
// checklist. The card was removed rather than hidden so this tab can never
// show a price again by accident.
export default function PublishPanel({ eventId, kind, status, slug, checklist }: Props) {
  const router = useRouter();
  const v = vocabFor(kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = checklist.every((c) => c.ok);

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
          {!ready && (
            <p className="muted small" style={{ margin: '10px 0 0' }}>
              The button unlocks once every item above is done.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
