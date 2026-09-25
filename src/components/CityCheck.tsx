'use client';

// "This show is in Lisbon — are you sure?" The same act sometimes plays in two
// cities a few days apart, on two pages that look almost identical, and a
// buyer who lands on the wrong one pays for a night in the wrong country.
// On such a page (lib/sameAct otherShowsByAct), the FIRST tap on anything that
// leads towards paying — this event's checkout, a ticket's own page, "Add to
// basket" (marked data-city-check) — opens this overlay instead: the city and
// date they are about to buy for, the other show(s) as a one-tap way across,
// and a clear "yes, this one". On the checkout page itself it opens straight
// away (mode "gate"), so no path into payment skips it — a shared link, the
// basket, a bookmark. Confirmed once, it stays out of the way for this event
// (sessionStorage).
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lang } from '@/lib/i18n';

/** Its own words in all three languages — a sentence built around a city name
    does not survive being translated in pieces. */
const WORDS: Record<Lang, {
  kicker: string;
  title: (city: string) => [string, string];
  also: (act: string, many: boolean) => string;
  see: string;
  yes: (city: string) => string;
  back: string;
  toEvent: string;
}> = {
  en: {
    kicker: 'Quick check before you buy',
    title: (c) => ['This show is in ', c],
    also: (a, many) => `${a || 'The same show'} also plays in ${many ? 'other cities' : 'another city'}:`,
    see: 'See this show →',
    yes: (c) => `Yes, ${c} is right — continue`,
    back: 'Go back',
    toEvent: 'Back to the event',
  },
  de: {
    kicker: 'Kurz prüfen, bevor du kaufst',
    title: (c) => ['Diese Show ist in ', c],
    also: (a, many) => `${a || 'Die gleiche Show'} spielt auch in ${many ? 'anderen Städten' : 'einer anderen Stadt'}:`,
    see: 'Diese Show ansehen →',
    yes: (c) => `Ja, ${c} stimmt — weiter`,
    back: 'Zurück',
    toEvent: 'Zurück zum Event',
  },
  ne: {
    kicker: 'किन्नुअघि एकपटक जाँच गर्नुहोस्',
    title: (c) => [`यो कार्यक्रम `, `${c} मा हो`],
    also: (a, many) => `${a || 'यही कार्यक्रम'} ${many ? 'अरू सहरहरूमा' : 'अर्को सहरमा'} पनि हुँदैछ:`,
    see: 'यो कार्यक्रम हेर्नुहोस् →',
    yes: (c) => `हो, ${c} नै ठीक हो — अगाडि बढ्नुहोस्`,
    back: 'पछाडि जानुहोस्',
    toEvent: 'कार्यक्रममा फर्कनुहोस्',
  },
};

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
  mode = 'intercept',
  lang = 'en',
}: {
  slug: string;
  city: string;
  dateLabel: string;
  venue: string;
  act: string;
  others: OtherShow[];
  /** "gate" = ask as soon as the page opens (the checkout page). */
  mode?: 'intercept' | 'gate';
  lang?: Lang;
}) {
  const w = WORDS[lang] ?? WORDS.en;
  /** What the buyer tapped (to repeat after "yes"), or "gate" on the checkout page. */
  const [pending, setPending] = useState<Element | 'gate' | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const storeKey = `citycheck:${slug}`;

  const confirmed = useCallback(() => {
    try {
      return sessionStorage.getItem(storeKey) === '1';
    } catch {
      return false;
    }
  }, [storeKey]);

  // On the checkout page "Go back" means back to the event, not to the form.
  const back = () => (mode === 'gate' ? window.location.assign(`/e/${slug}`) : setPending(null));

  // The checkout page: ask before anything else.
  useEffect(() => {
    if (mode === 'gate' && others.length > 0 && !confirmed()) setPending('gate');
  }, [mode, others.length, confirmed]);

  useEffect(() => {
    if (others.length === 0 || mode === 'gate') return;
    const paths = [`/e/${slug}/checkout`, `/e/${slug}/item/`];
    // Capture phase, on the document: runs before React's own handlers, so a
    // prevented click never reaches next/link's navigation.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (confirmed()) return;
      const target = e.target as Element | null;
      const marked = target?.closest?.('[data-city-check]');
      const a = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      let hit: Element | null = marked ?? null;
      if (!hit && a) {
        const url = new URL(a.href, window.location.href);
        if (url.origin === window.location.origin && paths.some((p) => url.pathname.startsWith(p))) hit = a;
      }
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(hit);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [slug, others.length, confirmed, mode]);

  useEffect(() => {
    if (!pending) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') back();
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
    const what = pending;
    setPending(null);
    // Do what they tapped, now that the answer is on record.
    if (what instanceof HTMLElement) what.click();
  };

  const [lead, place] = w.title(city);
  // Rendered into <body>: inside the page it would sit in the hero's stacking
  // context, and later sections (ticket cards, the "When & where" card) were
  // drawn on top of it.
  return createPortal(
    <div className="cc-backdrop" role="presentation" onClick={back} translate="no">
      <div
        className="cc-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="cc-x" aria-label="Close" onClick={back}>
          ✕
        </button>
        <div className="cc-pin" aria-hidden="true">
          <span>📍</span>
        </div>
        <p className="cc-kicker">{w.kicker}</p>
        <h2 id="cc-title" className="cc-title">
          {lead}
          <span>{place}</span>
        </h2>
        <p className="cc-sub">
          {[dateLabel, venue].filter(Boolean).join(' · ')}
        </p>

        <div className="cc-also">
          <p>{w.also(act, others.length > 1)}</p>
          {others.map((o) => (
            <a key={o.slug} href={`/e/${o.slug}`} className="cc-other">
              <span className="cc-other-pin" aria-hidden="true">
                📍
              </span>
              <span className="cc-other-text">
                <strong>{o.city}</strong>
                {o.dateLabel ? <span>{o.dateLabel}</span> : null}
              </span>
              <span className="cc-other-go">{w.see}</span>
            </a>
          ))}
        </div>

        <button ref={confirmRef} type="button" className="btn btn-brand btn-lg cc-yes" onClick={go}>
          {w.yes(city)}
        </button>
        <button type="button" className="cc-back" onClick={back}>
          {mode === 'gate' ? w.toEvent : w.back}
        </button>
      </div>
    </div>,
    document.body
  );
}
