'use client';

// Start (or edit) a meetup. Short on purpose: what, when, where, and an
// optional limit — a meetup should take a minute to put up.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { KNOWN_CITIES } from '@/lib/cities';

interface Category {
  key: string;
  label: string;
  emoji: string;
}

interface Initial {
  id?: string;
  title: string;
  about: string;
  category: string;
  city: string;
  place: string;
  date: string;
  time: string;
  capacity: number;
  joinMode: 'open' | 'ask' | 'private';
  minPeople: number;
  costNote: string;
}

interface Idea {
  emoji: string;
  title: string;
  category: string;
  min: number;
  about: string;
}

interface Props {
  categories: Category[];
  ideas: Idea[];
  initial: Initial;
  minDate: string;
  maxDate: string;
}

const MODES: { key: Initial['joinMode']; title: string; text: string }[] = [
  { key: 'open', title: '🌍 Open', text: 'Members see it; anyone taps in.' },
  { key: 'ask', title: '✋ Ask to join', text: 'Members see it; you say yes or no to each request.' },
  { key: 'private', title: '🔒 Private', text: 'Not listed. Only people with your invite link.' },
];

export default function MeetupForm({ categories, ideas, initial, minDate, maxDate }: Props) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = Boolean(initial.id);
  const set = <K extends keyof Initial>(k: K, value: Initial[K]) => setV((prev) => ({ ...prev, [k]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const url = editing ? `/api/community/meetups/${initial.id}` : '/api/community/meetups';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, action: editing ? 'update' : undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok || !data.id) throw new Error(data.error || 'Could not save — try again.');
      router.push(`/bhetghat/m/${data.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="mu-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="mu-title">What are you doing?</label>
        <input id="mu-title" className="input" value={v.title} maxLength={80} required onChange={(e) => set('title', e.target.value)} placeholder="e.g. Sunday futsal at Huthpark" />
        {!editing && (
          <div className="chip-row mu-ideas">
            {ideas.map((idea) => (
              <button
                type="button"
                key={idea.title}
                className="chip"
                onClick={() =>
                  setV((prev) => ({
                    ...prev,
                    title: idea.title,
                    category: idea.category,
                    minPeople: prev.minPeople || idea.min,
                    about: prev.about || idea.about,
                  }))
                }
              >
                {idea.emoji} {idea.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <fieldset className="gc-group">
        <legend>Kind</legend>
        <div className="chip-row">
          {categories.map((c) => (
            <button
              type="button"
              key={c.key}
              className={`chip${v.category === c.key ? ' chip-active' : ''}`}
              aria-pressed={v.category === c.key}
              onClick={() => set('category', c.key)}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mu-two">
        <div className="field">
          <label htmlFor="mu-date">Day</label>
          <input id="mu-date" type="date" className="input" value={v.date} min={minDate} max={maxDate} required onChange={(e) => set('date', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="mu-time">Time</label>
          <input id="mu-time" type="time" className="input" value={v.time} required onChange={(e) => set('time', e.target.value)} />
        </div>
      </div>

      <div className="mu-two">
        <div className="field">
          <label htmlFor="mu-city">Town</label>
          <input id="mu-city" className="input" value={v.city} list="mu-cities" maxLength={60} required onChange={(e) => set('city', e.target.value)} />
          <datalist id="mu-cities">
            {KNOWN_CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="mu-place">Where exactly</label>
          <input id="mu-place" className="input" value={v.place} maxLength={120} required onChange={(e) => set('place', e.target.value)} placeholder="A café, a park, a hall" />
        </div>
      </div>
      <p className="muted small mu-tip">🛡️ Somewhere public, please — never your home address. You can share details in the group chat later.</p>

      <div className="field">
        <label htmlFor="mu-about">More about it (optional)</label>
        <textarea id="mu-about" className="input" rows={4} maxLength={1000} value={v.about} onChange={(e) => set('about', e.target.value)} placeholder="What to bring, who it is for, how to find you…" />
      </div>

      <fieldset className="gc-group">
        <legend>Who can come?</legend>
        <div className="mu-modes" role="radiogroup">
          {MODES.map((m) => (
            <button
              type="button"
              role="radio"
              key={m.key}
              aria-checked={v.joinMode === m.key}
              className={`mu-mode${v.joinMode === m.key ? ' on' : ''}`}
              onClick={() => set('joinMode', m.key)}
            >
              <strong>{m.title}</strong>
              <span>{m.text}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="mu-cost">What does it cost? (optional)</label>
        <input id="mu-cost" className="input" value={v.costNote} maxLength={80} onChange={(e) => set('costNote', e.target.value)} placeholder="e.g. about €12 each, pay at the venue" />
        <p className="muted small cm-hint">Everyone pays the venue themselves — nothing is paid through MartNepali.</p>
      </div>

      <div className="mu-two">
      <div className="field">
        <label htmlFor="mu-min">Happens if at least… (optional)</label>
        <input
          id="mu-min"
          type="number"
          className="input"
          min={0}
          max={200}
          value={v.minPeople || ''}
          placeholder="No minimum"
          onChange={(e) => set('minPeople', Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
        />
      </div>
      <div className="field mu-cap">
        <label htmlFor="mu-cap">How many people at most? (optional)</label>
        <input
          id="mu-cap"
          type="number"
          className="input"
          min={0}
          max={200}
          value={v.capacity || ''}
          placeholder="No limit"
          onChange={(e) => set('capacity', Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
        />
      </div>
      </div>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-brand" disabled={busy}>
        {busy ? 'Saving…' : editing ? 'Save changes' : 'Put it up'}
      </button>
      {!editing && (
        <p className="muted small">
          {v.joinMode === 'private'
            ? 'Only people you send the invite link to can see it. You can change or cancel it any time.'
            : 'Only community members see it. You can change or cancel it any time.'}
        </p>
      )}
    </form>
  );
}
