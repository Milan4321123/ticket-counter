'use client';

// A member's own corner: the name others see, their town, who they blocked,
// and leaving the community (everything they posted goes with them).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { KNOWN_CITIES } from '@/lib/cities';

interface Props {
  name: string;
  city: string;
  blocked: { handle: string; name: string }[];
  profileSlug: string | null;
}

async function call(url: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || 'That did not work — try again.';
}

export default function CommunitySettings({ name: initialName, city: initialCity, blocked, profileSlug }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [city, setCity] = useState(initialCity);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirm, setConfirm] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNote('');
    const err = await call('/api/community/profile', { action: 'update', name, city });
    setBusy(false);
    if (err) setError(err);
    else {
      setNote('Saved.');
      router.refresh();
    }
  }

  async function unblock(handle: string) {
    await call('/api/community/report', { action: 'unblock', handle });
    router.refresh();
  }

  async function leave() {
    setBusy(true);
    const err = await call('/api/community/profile', { action: 'leave', confirm: confirm.trim().toUpperCase() });
    setBusy(false);
    if (err) return setError(err);
    router.push('/community');
    router.refresh();
  }

  return (
    <div className="cs">
      <form onSubmit={save}>
        <div className="mu-two">
          <div className="field">
            <label htmlFor="cs-name">Name other members see</label>
            <input id="cs-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cs-city">Your town</label>
            <input id="cs-city" className="input" value={city} list="cs-cities" maxLength={60} onChange={(e) => setCity(e.target.value)} />
            <datalist id="cs-cities">
              {KNOWN_CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="cm-row">
          <button className="btn btn-sm" disabled={busy}>
            Save
          </button>
          {note && <span className="mu-in">{note}</span>}
        </div>
      </form>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      <p className="cs-line">
        {profileSlug ? (
          <>
            Your Kalakar profile: <Link href={`/kalakar/${profileSlug}`}>see it</Link> · <Link href="/kalakar/edit">edit</Link>
          </>
        ) : (
          <>
            Do you sing, dance, cook, take photos or do puja? <Link href="/kalakar/edit">Make a Kalakar profile</Link>
          </>
        )}
      </p>

      <h3 className="cs-h">Blocked</h3>
      {blocked.length === 0 ? (
        <p className="muted small">Nobody. When you block someone from a Report menu, they appear here.</p>
      ) : (
        <ul className="cs-blocked">
          {blocked.map((b) => (
            <li key={b.handle}>
              <span translate="no">{b.name}</span>
              <button type="button" className="cm-link-btn" onClick={() => unblock(b.handle)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="cs-h">Leave the community</h3>
      {!leaving ? (
        <p className="muted small">
          Your meetups, help posts, profile and messages are deleted; your customer account, orders and tickets stay.{' '}
          <button type="button" className="cm-link-btn" onClick={() => setLeaving(true)}>
            Leave…
          </button>
        </p>
      ) : (
        <div className="cs-leave">
          <label htmlFor="cs-confirm" className="small">
            Type LEAVE to confirm
          </label>
          <div className="cm-row">
            <input id="cs-confirm" className="input cs-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            <button type="button" className="btn btn-sm mu-danger" disabled={busy || confirm.trim().toUpperCase() !== 'LEAVE'} onClick={leave}>
              Leave and delete everything
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setLeaving(false)}>
              Stay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
