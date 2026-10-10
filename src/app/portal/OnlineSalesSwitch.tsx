'use client';

// "Stop online sales now" — the organizer's own hand on the show-night
// handover (lib/onlineSales). One tap, saved immediately: it is pressed at the
// door, on a phone, when the hall is filling faster than expected — not after
// scrolling to a Save button. Shown in the editor and on the live door screen.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveEvent } from './events/[id]/edit/save';
import './onlineSales.css';

export interface OnlineSalesSwitchProps {
  eventId: string;
  /** Online buying is closed right now. */
  closed: boolean;
  /** Why: the organizer pressed stop, or the automatic cutoff passed. */
  reason: 'stopped' | 'clock' | null;
  /** The automatic cutoff has passed, so lifting the stop alone would not reopen. */
  clockPassed: boolean;
  /** "today at 18:00" — when the automatic cutoff is, or null when there is none. */
  closesLabel: string | null;
  /** Tickets are sold at the counter, so the closed page sends buyers there. */
  counter: boolean;
  /** Told when reopening also switched the automatic cutoff off, so a form holding it can follow. */
  onReopened?: (autoCloseCleared: boolean) => void;
}

export default function OnlineSalesSwitch({
  eventId,
  closed,
  reason,
  clockPassed,
  closesLabel,
  counter,
  onReopened,
}: OnlineSalesSwitchProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const result = await saveEvent(eventId, patch);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'That did not save — please try again.');
      return false;
    }
    router.refresh();
    return true;
  }

  async function stop() {
    const ok = window.confirm(
      counter
        ? 'Stop online sales now?\n\nYour page will tell buyers to buy their ticket at the counter. Tickets already sold stay valid.'
        : 'Stop online sales now?\n\nNobody will be able to buy online any more. Tickets already sold stay valid.'
    );
    if (ok) await send({ onlineStopped: true });
  }

  async function reopen() {
    // Past the automatic cutoff, lifting the stop alone changes nothing the
    // buyer can see — so reopening switches the automatic close off too, and
    // says so before doing it.
    const clearAuto = clockPassed;
    if (clearAuto && !window.confirm('Online sales closed automatically before the show.\n\nReopen them? Automatic closing will be switched off for this event, so the page keeps selling until you stop it again.')) return;
    if (await send(clearAuto ? { onlineStopped: false, onlineCloseMin: null } : { onlineStopped: false })) {
      onReopened?.(clearAuto);
    }
  }

  return (
    <div className={`os-switch${closed ? ' is-closed' : ''}`}>
      <div className="os-switch-text">
        <strong>{closed ? 'Online sales are closed' : 'Online sales are open'}</strong>
        <span className="muted small">
          {closed
            ? reason === 'stopped'
              ? `You stopped them.${counter ? ' Your page tells buyers to buy at the counter.' : ''}`
              : `They closed automatically before the show.${counter ? ' Your page tells buyers to buy at the counter.' : ''}`
            : closesLabel
              ? `They close automatically ${closesLabel}.`
              : 'They stay open until you stop them.'}
        </span>
        {error && <span className="os-switch-error">{error}</span>}
      </div>
      {closed ? (
        <button type="button" className="btn btn-sm" onClick={reopen} disabled={busy}>
          {busy ? 'Saving…' : 'Reopen online sales'}
        </button>
      ) : (
        <button type="button" className="btn btn-sm btn-danger" onClick={stop} disabled={busy}>
          {busy ? 'Saving…' : 'Stop online sales now'}
        </button>
      )}
    </div>
  );
}
