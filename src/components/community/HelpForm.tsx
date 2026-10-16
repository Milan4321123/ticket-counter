'use client';

// Put up a Sahayog post: asking or offering, what it is about, the town, one
// line, a few more words, and — for rides and flights — the day.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { KNOWN_CITIES } from '@/lib/cities';

interface Category {
  key: string;
  label: string;
  emoji: string;
  tip: string;
  dated: boolean;
}

interface Props {
  categories: Category[];
  initialKind: 'ask' | 'offer';
  initialCity: string;
  minDate: string;
  maxDate: string;
}

const EXAMPLES: Record<string, { ask: string; offer: string }> = {
  room: { ask: 'Looking for a WG room in Frankfurt from December', offer: 'Room free in my WG in Darmstadt from 1 Nov' },
  rides: { ask: 'Need a ride Heidelberg → Frankfurt on Saturday', offer: 'Driving Mannheim → Frankfurt Sat 17:00, 3 seats' },
  luggage: { ask: 'Anyone flying to Kathmandu soon? Need to send medicine', offer: 'Flying FRA → KTM on 20 Nov, 5 kg free' },
  papers: { ask: 'Help with my first Anmeldung in Munich?', offer: 'I can explain the Blocked Account / visa extension' },
  jobs: { ask: 'Looking for a Minijob in Berlin (restaurant)', offer: 'Our restaurant needs a cook in Cologne' },
  newcomers: { ask: 'Arriving at Frankfurt airport on 3 Dec — pickup?', offer: 'Happy to help new students in Leipzig settle in' },
  study: { ask: 'Anyone studying at TU Darmstadt? Questions about admission', offer: 'I can help with uni-assist applications' },
  other: { ask: 'Looking for a Nepali language teacher for my kids', offer: 'Free tabla lessons on Sundays' },
};

export default function HelpForm({ categories, initialKind, initialCity, minDate, maxDate }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<'ask' | 'offer'>(initialKind);
  const [category, setCategory] = useState('');
  const [city, setCity] = useState(initialCity);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [whenDate, setWhenDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cat = categories.find((c) => c.key === category);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/community/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, category, city, title, body, whenDate }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok || !data.id) throw new Error(data.error || 'Could not post — try again.');
      router.push(`/sahayog/p/${data.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="mu-form" onSubmit={submit}>
      <div className="hb-kindpick" role="radiogroup" aria-label="Asking or offering">
        <button type="button" role="radio" aria-checked={kind === 'ask'} className={`hb-kindbtn${kind === 'ask' ? ' on' : ''}`} onClick={() => setKind('ask')}>
          <span aria-hidden="true">🙋</span> I need help
        </button>
        <button type="button" role="radio" aria-checked={kind === 'offer'} className={`hb-kindbtn${kind === 'offer' ? ' on' : ''}`} onClick={() => setKind('offer')}>
          <span aria-hidden="true">🤝</span> I can help
        </button>
      </div>

      <fieldset className="gc-group">
        <legend>What is it about?</legend>
        <div className="chip-row">
          {categories.map((c) => (
            <button
              type="button"
              key={c.key}
              className={`chip${category === c.key ? ' chip-active' : ''}`}
              aria-pressed={category === c.key}
              onClick={() => setCategory(c.key)}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      {cat && <p className="hb-tip">🛡️ {cat.tip}</p>}

      <div className="field">
        <label htmlFor="hb-title">In one line</label>
        <input
          id="hb-title"
          className="input"
          value={title}
          maxLength={90}
          required
          onChange={(e) => setTitle(e.target.value)}
          placeholder={category ? EXAMPLES[category]?.[kind] : 'e.g. Looking for a room in Frankfurt from December'}
        />
      </div>

      <div className="mu-two">
        <div className="field">
          <label htmlFor="hb-city">Town</label>
          <input id="hb-city" className="input" value={city} list="hb-cities" maxLength={60} required onChange={(e) => setCity(e.target.value)} />
          <datalist id="hb-cities">
            {KNOWN_CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        {cat?.dated && (
          <div className="field">
            <label htmlFor="hb-when">{cat.key === 'rides' ? 'Day of the ride' : 'Day of the flight'}</label>
            <input id="hb-when" type="date" className="input" value={whenDate} min={minDate} max={maxDate} required onChange={(e) => setWhenDate(e.target.value)} />
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="hb-body">More details (optional)</label>
        <textarea
          id="hb-body"
          className="input"
          rows={5}
          maxLength={1500}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Dates, budget, how much space, what you can help with… No phone numbers — people answer you privately here."
        />
      </div>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-brand" disabled={busy || !category}>
        {busy ? 'Posting…' : 'Put it on the board'}
      </button>
      <p className="muted small">
        Only community members see it. It leaves the board by itself {cat?.dated ? 'after the day' : 'after 30 days'}, and you can close it any time.
      </p>
    </form>
  );
}
