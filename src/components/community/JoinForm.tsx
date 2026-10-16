'use client';

// Joining the community: the name other members see, a home town, and two
// boxes that must be ticked by hand — 16 or over, and the rules. Nothing is
// pre-ticked and nothing is saved until they press Join.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { KNOWN_CITIES } from '@/lib/cities';

interface Props {
  draft: { name: string; city: string };
  rules: { title: string; text: string }[];
  minAge: number;
  /** True when they were a member before and only the rules changed. */
  rejoin?: boolean;
}

export default function JoinForm({ draft, rules, minAge, rejoin = false }: Props) {
  const router = useRouter();
  const [name, setName] = useState(draft.name);
  const [city, setCity] = useState(draft.city);
  const [age, setAge] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/community/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, city, age, rules: agree }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not join — please try again.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="cm-join" onSubmit={submit}>
      {rejoin && <p className="notice notice-warn">The community rules changed — please read them and confirm once more.</p>}
      <div className="field">
        <label htmlFor="cm-name">Your name in the community</label>
        <input
          id="cm-name"
          className="input"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sita S. or Sita Shrestha"
          autoComplete="nickname"
          required
        />
        <p className="muted small cm-hint">Other members see this — your email never.</p>
      </div>
      <div className="field">
        <label htmlFor="cm-city">Your town</label>
        <input
          id="cm-city"
          className="input"
          value={city}
          maxLength={60}
          list="cm-cities"
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Frankfurt"
          autoComplete="address-level2"
          required
        />
        <datalist id="cm-cities">
          {KNOWN_CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <details className="cm-rules" open>
        <summary>The community rules</summary>
        <ol>
          {rules.map((r) => (
            <li key={r.title}>
              <strong>{r.title}.</strong> {r.text}
            </li>
          ))}
        </ol>
      </details>

      <label className="cm-check">
        <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
        <span>I am {minAge} or older.</span>
      </label>
      <label className="cm-check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>I have read the rules and I will keep them.</span>
      </label>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-brand cm-join-btn" disabled={busy || !age || !agree || name.trim().length < 2 || !city.trim()}>
        {busy ? 'Joining…' : 'Join the community'}
      </button>
      <p className="muted small">
        Free, always. You can leave any time from your community page — everything you posted goes with you.
      </p>
    </form>
  );
}
