'use client';

// The buttons on a meetup's page: join, ask to join, take back, or leave for
// members; edit, cancel, the invite link, and yes/no on requests for the host.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

async function act(id: string, payload: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`/api/community/meetups/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || 'That did not work — try again.';
}

interface Props {
  id: string;
  joined: boolean;
  requested: boolean;
  isHost: boolean;
  open: boolean;
  full: boolean;
  joinMode: 'open' | 'ask' | 'private';
  /** A private meetup's invite code from the link, passed on with "I'm in". */
  code?: string;
}

export default function MeetupActions({ id, joined, requested, isHost, open, full, joinMode, code }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function run(payload: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const err = await act(id, payload);
    setBusy(false);
    if (err) setError(err);
    else router.refresh();
  }

  if (!open) return null;
  return (
    <div className="mu-actions">
      {isHost ? (
        <div className="cm-row">
          <Link href={`/bhetghat/m/${id}/edit`} className="btn btn-sm">
            Edit
          </Link>
          {confirmCancel ? (
            <>
              <button type="button" className="btn btn-sm mu-danger" disabled={busy} onClick={() => run({ action: 'cancel' })}>
                Yes, cancel it
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setConfirmCancel(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-sm" onClick={() => setConfirmCancel(true)}>
              Cancel meetup
            </button>
          )}
        </div>
      ) : joined ? (
        <div className="cm-row">
          <span className="mu-in">✓ You&rsquo;re going</span>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run({ action: 'leave' })}>
            Can&rsquo;t make it
          </button>
        </div>
      ) : requested ? (
        <div className="cm-row">
          <span className="mu-wait">⏳ Request sent — the host will say yes or no</span>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run({ action: 'leave' })}>
            Take it back
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-brand" disabled={busy || full} onClick={() => run({ action: 'join', code })}>
          {full ? 'Full' : busy ? '…' : joinMode === 'ask' ? '✋ Ask to join' : "I'm in"}
        </button>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** The host's "take off" control beside one person on the list. */
export function RemovePerson({ id, handle, name }: { id: string; handle: string; name: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  if (!ask) {
    return (
      <button type="button" className="cm-link-btn" onClick={() => setAsk(true)} aria-label={`Take ${name} off this meetup`}>
        ✕
      </button>
    );
  }
  return (
    <span className="mu-remove">
      Take {name} off?{' '}
      <button
        type="button"
        className="cm-link-btn mu-danger-text"
        onClick={async () => {
          await act(id, { action: 'remove', handle });
          router.refresh();
        }}
      >
        Yes
      </button>{' '}
      <button type="button" className="cm-link-btn" onClick={() => setAsk(false)}>
        No
      </button>
    </span>
  );
}

/** Yes / no on one request (host). */
export function RequestControls({ id, handle, name }: { id: string; handle: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function decide(action: 'approve' | 'remove') {
    setBusy(true);
    const err = await act(id, { action, handle });
    setBusy(false);
    if (err) setError(err);
    else router.refresh();
  }
  return (
    <span className="mu-req">
      <button type="button" className="btn btn-sm btn-brand" disabled={busy} onClick={() => decide('approve')} aria-label={`Let ${name} in`}>
        Yes
      </button>
      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => decide('remove')} aria-label={`Say no to ${name}`}>
        No
      </button>
      {error && <span className="mu-danger-text small">{error}</span>}
    </span>
  );
}

/** The invite link, to copy or send on WhatsApp — and, for the host, to replace. */
export function InviteLink({ id, url, title, isHost, isPrivate }: { id: string; url: string; title: string; isHost: boolean; isPrivate: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const text = `${title} — join me on MartNepali: ${url}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the link is on screen to copy by hand */
    }
  }
  return (
    <div className="mu-invite">
      <p className="mu-invite-url" translate="no">
        {url}
      </p>
      <div className="cm-row">
        <button type="button" className="btn btn-sm" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
        <a className="btn btn-sm btn-green" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
          Send on WhatsApp
        </a>
        {isHost && (
          <button
            type="button"
            className="cm-link-btn"
            onClick={async () => {
              await act(id, { action: 'new-link' });
              router.refresh();
            }}
          >
            New link (the old one stops working)
          </button>
        )}
      </div>
      <p className="muted small">
        {isPrivate
          ? 'Anyone with this link can open the meetup and join — send it only to people you want there.'
          : 'Friends who are not members yet join the community first, then land here.'}
      </p>
    </div>
  );
}
