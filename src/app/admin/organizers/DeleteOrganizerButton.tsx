'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  organizerId: string;
  name: string;
  email: string;
  /** How many listings go with it — said out loud before anything is typed. */
  events: number;
}

/** What POST /api/admin/organizers/[id]/delete answers with (lib/erasure OrganizerDeletionReport). */
interface DeletionReport {
  events: number;
  orders: number;
  tickets: number;
  media: number;
  reviews: number;
  subscriptions: number;
  marketingConsents: number;
  customerCards: number;
}

/**
 * "Delete organizer permanently" — the platform's deletion duty when the
 * processing contract ends (Art. 28(3)(g) GDPR). Shown only for DISABLED
 * accounts, and it asks for the account's email typed out in full: this
 * removes every listing, order, ticket, photo and buyer record the organizer
 * ever had, and there is no undo. The server re-checks both conditions
 * (lib/erasure deleteOrganizerPermanently), so this form is a courtesy, not
 * the guard.
 */
export default function DeleteOrganizerButton({ organizerId, name, email, events }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DeletionReport | null>(null);

  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !matches) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/organizers/${organizerId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: typed.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; report?: DeletionReport; error?: string } | null;
      if (!res.ok || !data?.ok || !data.report) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        setBusy(false);
        return;
      }
      setDone(data.report);
      setBusy(false);
    } catch {
      setError('Could not reach the server — please try again.');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="notice notice-success small" style={{ margin: '8px 0 0' }}>
        Deleted <strong translate="no">{name}</strong>: {done.events} listing{done.events === 1 ? '' : 's'},{' '}
        {done.orders} order{done.orders === 1 ? '' : 's'}, {done.tickets} ticket{done.tickets === 1 ? '' : 's'},{' '}
        {done.media} photo/video file{done.media === 1 ? '' : 's'}, {done.reviews} review
        {done.reviews === 1 ? '' : 's'}, {done.subscriptions} subscription{done.subscriptions === 1 ? '' : 's'},{' '}
        {done.marketingConsents} consent record{done.marketingConsents === 1 ? '' : 's'} and {done.customerCards}{' '}
        customer card{done.customerCards === 1 ? '' : 's'}. Copies inside database backups disappear as those backups age out (30 days).
        <div>
          <button type="button" className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => router.refresh()}>
            Done
          </button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-sm btn-danger"
        style={{ marginTop: 8 }}
        onClick={() => setOpen(true)}
      >
        Delete permanently…
      </button>
    );
  }

  return (
    <form onSubmit={remove} className="notice notice-error small" style={{ margin: '8px 0 0', display: 'grid', gap: 6 }}>
      <div>
        This deletes <strong translate="no">{name}</strong> and <strong>everything</strong> they own:{' '}
        {events} listing{events === 1 ? '' : 's'} with every order, ticket, buyer record, review, photo and
        video, plus their consents, customer cards, codes, vouchers and payment connections. There is no undo.
      </div>
      <label htmlFor={`del-${organizerId}`}>
        Type <strong className="mono" translate="no">{email}</strong> to confirm:
      </label>
      <input
        id={`del-${organizerId}`}
        className="input"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        translate="no"
      />
      {error && <div className="notice notice-error small" style={{ margin: 0 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-sm btn-danger" disabled={!matches || busy}>
          {busy ? 'Deleting…' : 'Delete everything'}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setTyped('');
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
