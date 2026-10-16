'use client';

// The events someone swiped right on — kept in this browser only (see
// SwipeDeck), so this list is read here, never from the server.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { loadDeckStore, saveDeckStore, type PlanEvent } from './SwipeDeck';

export default function PlannedEvents({ today }: { today: string }) {
  const [plans, setPlans] = useState<[string, PlanEvent][] | null>(null);

  useEffect(() => {
    const s = loadDeckStore();
    setPlans(
      Object.entries(s.liked)
        .filter(([, p]) => p.sortAt.slice(0, 10) >= today)
        .sort((a, b) => a[1].sortAt.localeCompare(b[1].sortAt))
    );
  }, [today]);

  function drop(key: string) {
    const s = loadDeckStore();
    delete s.liked[key];
    saveDeckStore(s);
    setPlans((prev) => (prev ?? []).filter(([k]) => k !== key));
  }

  if (plans === null) return null;
  if (plans.length === 0) {
    return (
      <p className="muted">
        No events saved yet. Swipe right on an event in <Link href="/bhetghat">Bhetghat</Link> and it lands here.
      </p>
    );
  }
  return (
    <>
      <ul className="pl-list">
        {plans.map(([key, p]) => (
          <li key={key} className="pl-item">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" className="pl-thumb" />
            ) : (
              <span className="pl-thumb pl-thumb-none" aria-hidden="true">
                🎟
              </span>
            )}
            <span className="pl-main">
              <Link href={p.href} className="pl-title">
                {p.title}
              </Link>
              <span className="muted small">
                {p.when}
                {p.city ? ` · ${p.city}` : ''}
              </span>
            </span>
            <span className="pl-side">
              <Link href={p.href} className="btn btn-sm btn-brand">
                Tickets
              </Link>
              <button type="button" className="cm-link-btn" onClick={() => drop(key)} aria-label={`Remove ${p.title} from my plans`}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small">Saved on this phone only — nobody else sees this list.</p>
    </>
  );
}
