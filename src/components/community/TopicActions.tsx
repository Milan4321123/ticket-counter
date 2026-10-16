'use client';

// "Write to them" on a help post or a profile: opens (or reopens) the private
// conversation about it and goes there. And, for a help post's author, the
// close / reopen / delete controls.
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function WriteButton({ topic, topicId, label }: { topic: 'help' | 'talent'; topicId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/community/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, topicId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok || !data.id) throw new Error(data.error || 'Could not open the conversation.');
      router.push(`/inbox/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className="btn btn-brand" disabled={busy} onClick={go}>
        {busy ? 'Opening…' : label}
      </button>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function HelpPostControls({ id, status, canReopen }: { id: string; status: string; canReopen: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  async function act(action: 'close' | 'reopen' | 'delete') {
    setBusy(true);
    const res = await fetch(`/api/community/help/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) return;
    if (action === 'delete') router.push('/sahayog');
    router.refresh();
  }
  return (
    <div className="cm-row">
      {status === 'open' && (
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => act('close')}>
          ✓ Solved — take it down
        </button>
      )}
      {status === 'closed' && canReopen && (
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => act('reopen')}>
          Put it back up
        </button>
      )}
      {askDelete ? (
        <>
          <button type="button" className="btn btn-sm mu-danger" disabled={busy} onClick={() => act('delete')}>
            Yes, delete it and its messages
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setAskDelete(false)}>
            Keep
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-sm" onClick={() => setAskDelete(true)}>
          Delete
        </button>
      )}
    </div>
  );
}
