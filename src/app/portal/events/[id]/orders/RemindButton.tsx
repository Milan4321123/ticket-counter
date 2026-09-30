'use client';

import { useState } from 'react';

type State = 'idle' | 'busy' | 'sent' | 'failed' | 'demo';

/** "30 Sep", or "30 Sep, 14:05" when a time helps. */
function day(ms: number, withTime = false): string {
  return new Date(ms).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/**
 * What went wrong, in words an organizer at a phone can act on. A mail-server
 * error is never shown raw here: "550 … Sender Identity" is the platform's
 * problem to fix, and the organizer's useful move is to reach the buyer
 * another way in the meantime.
 */
function explain(reason?: string, detail?: string): string {
  if (detail && /\b5\d\d\b|sender identity|authentication/i.test(detail)) {
    return 'Email is not going out from our side right now — not your fault. Please message the buyer on WhatsApp or call them for now.';
  }
  switch (reason) {
    case 'reminded-recently':
      return 'Already reminded in the last 24 hours — give them a day.';
    case 'order-not-awaiting-transfer':
      return 'This order is no longer waiting for payment. Reload the page.';
    case 'transfer-not-configured':
      return 'Add your bank or PayPal details first — the reminder repeats them.';
    case 'buyer-erased':
      return 'The buyer’s details were erased under the privacy policy.';
    case 'email-not-configured':
      return 'Email is switched off on our side right now. Please message the buyer directly.';
    case 'too-many':
      return 'That is a lot of reminders at once — try again in an hour.';
    default:
      return 'The reminder could not be sent. Please try again later.';
  }
}

/**
 * "Remind buyer": sends one unpaid transfer reservation the same reminder the
 * platform sends on its own (lib/reminders.ts), now. The line under it says
 * when the buyer was last reminded, or when the automatic one is due.
 */
export default function RemindButton({
  orderId,
  lastSentAt,
  autoAt,
  demo = false,
}: {
  orderId: string;
  /** buyer_reminder_sent_at, SQLite UTC, or null. */
  lastSentAt: string | null;
  /** When the automatic reminder is due (epoch ms), or null. */
  autoAt: number | null;
  demo?: boolean;
}) {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function onRemind() {
    if (state === 'busy' || state === 'sent') return;
    if (demo) {
      setState('demo');
      return;
    }
    setState('busy');
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/remind`, { method: 'POST' });
      const data = (await res.json().catch(() => null)) as { sent?: boolean; reason?: string; detail?: string } | null;
      if (data?.sent) {
        setState('sent');
      } else {
        setState('failed');
        setMessage(explain(data?.reason, data?.detail));
      }
    } catch {
      setState('failed');
      setMessage('Could not reach the server.');
    }
  }

  const last = lastSentAt ? Date.parse(`${lastSentAt.replace(' ', 'T')}Z`) : null;
  const note =
    state === 'sent'
      ? 'Reminder sent just now.'
      : last
        ? `Reminded ${day(last, true)}.`
        : autoAt && autoAt > Date.now()
          ? `An automatic reminder goes out ${day(autoAt, true)}.`
          : null;

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <button
        type="button"
        className="btn btn-sm"
        onClick={onRemind}
        disabled={state === 'busy' || state === 'sent'}
        title="Email the buyer their payment details and reference again"
      >
        {state === 'busy' ? 'Sending…' : state === 'sent' ? 'Reminder sent ✓' : 'Remind buyer'}
      </button>
      {state === 'demo' && (
        <span className="small muted" style={{ maxWidth: 260 }}>
          No emails in the demo — in a real account the buyer gets a reminder with the payment details.
        </span>
      )}
      {state === 'failed' && (
        <span className="small" style={{ color: 'var(--danger, #f87171)', maxWidth: 300 }}>
          {message}
        </span>
      )}
      {state !== 'failed' && state !== 'demo' && note && <span className="small muted">{note}</span>}
    </span>
  );
}
