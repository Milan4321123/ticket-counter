'use client';

// "This show is in Lisbon — are you sure?" The same act sometimes plays in two
// cities a few days apart, on two pages that look almost identical, and a
// buyer who lands on the wrong one pays for a night in the wrong country.
// On such a page (lib/sameAct otherShowsByAct), the FIRST tap on anything that
// leads to this event's checkout opens this overlay instead: the city and date
// they are about to buy for, the other show(s) as a one-tap way across, and a
// clear "yes, this one". Confirmed once, it stays out of the way for this
// event (sessionStorage).
import { useCallback, useEffect, useRef, useState } from 'react';

interface OtherShow {
  slug: string;
  city: string;
  dateLabel: string;
}

export default function CityCheck({
  slug,
  city,
  dateLabel,
  venue,
  act,
  others,
}: {
  slug: string;
  city: string;
  dateLabel: string;
  venue: string;
  act: string;
  others: OtherShow[];
}) {
  const [pending, setPending] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const storeKey = `citycheck:${slug}`;

  const confirmed = useCallback(() => {
    try {
      return sessionStorage.getItem(storeKey) === '1';
    } catch {
      return false;
    }
  }, [storeKey]);

  useEffect(() => {
    if (others.length === 0) return;
    const checkout = `/e/${slug}/checkout`;
    // Capture phase, on the document: runs before React's own handlers, so a
    // prevented click never reaches next/link's navigation.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith(checkout)) return;
      if (confirmed()) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(url.pathname + url.search);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [slug, others.length, confirmed]);

  useEffect(() => {
    if (!pending) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPending(null);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [pending]);

  if (!pending) return null;

  const go = () => {
    try {
      sessionStorage.setItem(storeKey, '1');
    } catch {
      // Private mode: they are simply asked again next time.
    }
    window.location.href = pending;
  };

  return (
    <div className="cc-backdrop" role="presentation" onClick={() => setPending(null)}>
      <div
        className="cc-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="cc-x" aria-label="Close" onClick={() => setPending(null)}>
          ✕
        </button>
        <div className="cc-pin" aria-hidden="true">
          <span>📍</span>
        </div>
        <p className="cc-kicker">Quick check before you buy</p>
        <h2 id="cc-title" className="cc-title">
          This show is in <span>{city}</span>
        </h2>
        <p className="cc-sub">
          {[dateLabel, venue].filter(Boolean).join(' · ')}
        </p>

        <div className="cc-also">
          <p>
            {act ? <strong>{act}</strong> : 'The same show'} also plays in {others.length === 1 ? 'another city' : 'other cities'}:
          </p>
          {others.map((o) => (
            <a key={o.slug} href={`/e/${o.slug}`} className="cc-other">
              <span className="cc-other-pin" aria-hidden="true">
                📍
              </span>
              <span className="cc-other-text">
                <strong>{o.city}</strong>
                {o.dateLabel ? <span>{o.dateLabel}</span> : null}
              </span>
              <span className="cc-other-go">See this show →</span>
            </a>
          ))}
        </div>

        <button ref={confirmRef} type="button" className="btn btn-brand btn-lg cc-yes" onClick={go}>
          Yes, {city} is right — continue
        </button>
        <button type="button" className="cc-back" onClick={() => setPending(null)}>
          Go back
        </button>
      </div>
    </div>
  );
}
