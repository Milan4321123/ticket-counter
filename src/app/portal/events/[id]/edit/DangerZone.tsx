'use client';

import { useState } from 'react';
import type { EventKind } from '@/lib/types';
import { vocabFor } from '@/lib/vocab';
import { useRouter } from 'next/navigation';

/** Everything that disappears with the event, so the list is never a guess. */
export interface DeletionCounts {
  photos: number;
  videos: number;
  posts: number;
  faqs: number;
  ticketsSold: number;
}

interface Props {
  eventId: string;
  eventName: string;
  /** Event or shop — decides the nouns in the warning. See lib/vocab. */
  kind: EventKind;
  counts: DeletionCounts;
  /** Orders already paid for — buyers holding a real ticket. */
  paidOrders: number;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The permanent-delete control. Deliberately slow to trigger: the organizer has
 * to type the event's own name (a window.confirm is one reflex click away, and
 * this is not undoable), and if anyone has already paid they must tick a box
 * that says so out loud first.
 */
export default function DangerZone({ eventId, eventName, kind, counts, paidOrders }: Props) {
  const router = useRouter();
  const v = vocabFor(kind);
  const [typed, setTyped] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the server asks for the acknowledgement this page did not know
  // about — a buyer's transfer was confirmed after the page was rendered.
  const [serverWantsAck, setServerWantsAck] = useState(false);

  const nameMatches = typed.trim() === eventName.trim();
  const askAck = paidOrders > 0 || serverWantsAck;
  const paidCleared = !askAck || acknowledged;
  const canDelete = nameMatches && paidCleared && !busy;

  const goesWithIt = [
    counts.photos > 0 ? plural(counts.photos, 'photo', 'photos') : null,
    counts.videos > 0 ? plural(counts.videos, 'video', 'videos') : null,
    counts.posts > 0 ? plural(counts.posts, 'update', 'updates') : null,
    counts.faqs > 0 ? plural(counts.faqs, 'FAQ answer', 'FAQ answers') : null,
    counts.ticketsSold > 0 ? plural(counts.ticketsSold, `sold ${v.unit}`, `sold ${v.units}`) : null,
  ].filter(Boolean) as string[];

  async function remove() {
    if (!canDelete) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: typed.trim(), acknowledgePaidOrders: acknowledged }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        if (res.status === 409) setServerWantsAck(true);
        setError(data?.error ?? 'Something went wrong — please try again.');
        setBusy(false);
        return;
      }
      // Stay busy through the navigation: the event is gone, so there is
      // nothing left on this page to click.
      router.push(`/portal?deleted=${encodeURIComponent(eventName)}`);
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <div className="notice notice-error">{error}</div>}

      <p className="small" style={{ marginTop: 0 }}>
        Deleting <strong>{eventName}</strong> removes the {v.listing} page and everything on it
        {goesWithIt.length > 0 ? <> — {goesWithIt.join(', ')}</> : null}, along with its {v.unitTypes}, orders
        and anything visitors asked. It is gone from our side for good: we keep no copy, and there is no undo.
      </p>

      {paidOrders > 0 && (
        <div className="notice notice-error" role="alert">
          <strong>
            {plural(paidOrders, 'buyer has', 'buyers have')} already paid for this {v.listing}.
          </strong>{' '}
          Their {v.codes} stop working the moment you delete it, and we do not email them about it. Please tell
          them yourself — and sort out their money — before you go ahead.
        </div>
      )}

      {askAck && (
        <label className="checkbox-row" htmlFor="danger-ack">
          <input
            id="danger-ack"
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={busy}
          />
          <span>
            {paidOrders > 0
              ? `I understand ${plural(paidOrders, 'paid order', 'paid orders')} and their ${v.codes} will be destroyed.`
              : `I understand the ${v.codes} people have already paid for will be destroyed.`}
          </span>
        </label>
      )}

      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="danger-confirm">
          Type the {v.listing} name to confirm: <strong>{eventName}</strong>
        </label>
        <input
          id="danger-confirm"
          className="input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          maxLength={140}
          autoComplete="off"
          spellCheck={false}
          placeholder={eventName}
          disabled={busy}
        />
      </div>

      <button
        type="button"
        className="btn btn-danger"
        onClick={() => void remove()}
        disabled={!canDelete}
        title={
          nameMatches
            ? paidCleared
              ? undefined
              : 'Tick the box above first'
            : `Type the ${v.listing} name above first`
        }
      >
        {busy ? <span className="spinner" aria-hidden /> : null}
        {busy ? 'Deleting…' : 'Delete this event for good'}
      </button>
      {!canDelete && !busy && (
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          {nameMatches ? 'Tick the box above and the button unlocks.' : 'The button unlocks once the name matches exactly.'}
        </p>
      )}
    </div>
  );
}
