'use client';

// "Online sales have closed — buy your ticket at the counter."
//
// Show night (lib/onlineSales): the website stops selling shortly before the
// start, and the counter at the venue takes over. A page that simply went grey
// would lose the buyer who is on their way — so every buy control on a closed
// page carries data-counter-sheet, and tapping one opens this: the counter,
// where it is, what the organizer wants them to know, and the reassurance that
// a ticket already bought online is still good.
//
// mode "intercept" (the event and item pages) waits for that tap; mode "page"
// (the checkout, reached by a link or a bookmark) renders the same card in
// place, because there is nothing behind it to go back to.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lang } from '@/lib/i18n';
import './CounterSheet.css';

const WORDS: Record<Lang, {
  kicker: string;
  title: (counter: boolean) => string;
  body: (name: string, counter: boolean) => string;
  starts: (time: string, doors: boolean) => string;
  maps: string;
  already: string;
  ok: string;
  toEvent: string;
}> = {
  en: {
    kicker: 'Online sales have closed',
    title: (c) => (c ? 'Buy your ticket at the counter' : 'No more tickets online'),
    body: (n, c) =>
      c
        ? `Online ticket sales for ${n} have ended. Tickets are still available at the counter at the venue.`
        : `Online ticket sales for ${n} have ended, and there are no tickets at the door.`,
    starts: (t, doors) => (doors ? `Doors ${t}` : `Show starts ${t}`),
    maps: 'Open in Maps',
    already: 'Already bought online? Your ticket is in your email — just show the QR code at the entrance.',
    ok: 'OK, got it',
    toEvent: 'Back to the event',
  },
  de: {
    kicker: 'Online-Verkauf beendet',
    title: (c) => (c ? 'Tickets gibt es an der Abendkasse' : 'Online keine Tickets mehr'),
    body: (n, c) =>
      c
        ? `Der Online-Ticketverkauf für ${n} ist beendet. Tickets bekommst du direkt an der Abendkasse vor Ort.`
        : `Der Online-Ticketverkauf für ${n} ist beendet, und es gibt keine Abendkasse.`,
    starts: (t, doors) => (doors ? `Einlass ${t}` : `Beginn ${t}`),
    maps: 'In Karten öffnen',
    already: 'Schon online gekauft? Dein Ticket ist in deiner E-Mail — zeig einfach den QR-Code am Eingang.',
    ok: 'Alles klar',
    toEvent: 'Zurück zum Event',
  },
  ne: {
    kicker: 'अनलाइन टिकट बिक्री बन्द भयो',
    title: (c) => (c ? 'टिकट काउन्टरमा किन्नुहोस्' : 'अनलाइन टिकट अब छैन'),
    body: (n, c) =>
      c
        ? `${n} को अनलाइन टिकट बिक्री बन्द भइसकेको छ। टिकट कार्यक्रम स्थलको काउन्टरमा पाइन्छ।`
        : `${n} को अनलाइन टिकट बिक्री बन्द भइसकेको छ, र ढोकामा पनि टिकट पाइँदैन।`,
    starts: (t, doors) => (doors ? `ढोका खुल्ने ${t}` : `कार्यक्रम सुरु ${t}`),
    maps: 'नक्सामा खोल्नुहोस्',
    already: 'अनलाइन टिकट किनिसक्नुभयो? टिकट तपाईंको इमेलमा छ — प्रवेशद्वारमा QR कोड देखाउनुहोस्।',
    ok: 'ठीक छ',
    toEvent: 'कार्यक्रमको पेजमा फर्कनुहोस्',
  },
};

export interface CounterSheetProps {
  slug: string;
  /** The event's name, for the sentence that explains what has closed. */
  name: string;
  /** Tickets are sold at the counter. False: online is closed and there is no door sale. */
  counter: boolean;
  /** The organizer's line about the counter, or ''. */
  note: string;
  venue: string;
  address: string;
  /** Added after the address unless the address already names it. */
  city: string;
  mapsHref: string | null;
  /** 'HH:MM' and whether it is the doors time rather than the show's. */
  start: { time: string; doors: boolean } | null;
  mode?: 'intercept' | 'page';
  lang?: Lang;
}

export default function CounterSheet({
  slug,
  name,
  counter,
  note,
  venue,
  address: street,
  city,
  mapsHref,
  start,
  mode = 'intercept',
  lang = 'en',
}: CounterSheetProps) {
  const w = WORDS[lang] ?? WORDS.en;
  const address =
    street && city && !street.toLowerCase().includes(city.toLowerCase()) ? `${street}, ${city}` : street || city;
  const [open, setOpen] = useState(false);
  const okRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  // Every buy control on a closed page is marked, and a stray checkout link
  // (a cached card, a shared button) counts too: either way the tap is the
  // moment this has to be said. Capture phase on the document, so it runs
  // before next/link starts a navigation.
  useEffect(() => {
    if (mode !== 'intercept') return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      let hit = target?.closest?.('[data-counter-sheet]') ?? null;
      if (!hit) {
        const a = target?.closest?.('a[href]') as HTMLAnchorElement | null;
        if (a) {
          const url = new URL(a.href, window.location.href);
          if (url.origin === window.location.origin && url.pathname.startsWith(`/e/${slug}/checkout`)) hit = a;
        }
      }
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [mode, slug]);

  useEffect(() => {
    if (!open) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const card = (
    <>
      <div className="cc-pin ct-pin" aria-hidden="true">
        <span>{counter ? '🎟️' : '🚫'}</span>
      </div>
      <p className="cc-kicker">{w.kicker}</p>
      <h2 id="ct-title" className="cc-title">
        {w.title(counter)}
      </h2>
      <p className="cc-sub">{w.body(name, counter)}</p>

      {counter && (venue || address || start || note) ? (
        <div className="ct-facts">
          {venue || address ? (
            <div className="ct-fact">
              <span aria-hidden="true">📍</span>
              <span>
                {venue ? <strong translate="no">{venue}</strong> : null}
                {address ? <span className="ct-dim">{address}</span> : null}
              </span>
            </div>
          ) : null}
          {start ? (
            <div className="ct-fact">
              <span aria-hidden="true">🕖</span>
              <span>{w.starts(start.time, start.doors)}</span>
            </div>
          ) : null}
          {note ? (
            <div className="ct-fact">
              <span aria-hidden="true">💬</span>
              <span>{note}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="ct-already">{w.already}</p>

      {counter && mapsHref ? (
        <a className="btn btn-brand btn-lg cc-yes" href={mapsHref} target="_blank" rel="noopener noreferrer">
          {w.maps}
        </a>
      ) : null}
      {mode === 'page' ? (
        <a className="cc-back" href={`/e/${slug}`}>
          {w.toEvent}
        </a>
      ) : (
        <button ref={okRef} type="button" className={counter && mapsHref ? 'cc-back' : 'btn btn-lg cc-yes'} onClick={close}>
          {w.ok}
        </button>
      )}
    </>
  );

  if (mode === 'page') {
    return (
      <div className="cc-sheet ct-inline" role="region" aria-labelledby="ct-title" translate="no">
        {card}
      </div>
    );
  }
  if (!open) return null;
  // Into <body>, for the reason CityCheck gives: inside the page it would sit
  // in the hero's stacking context, under the sections drawn after it.
  return createPortal(
    <div className="cc-backdrop" role="presentation" onClick={close} translate="no">
      <div className="cc-sheet" role="dialog" aria-modal="true" aria-labelledby="ct-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cc-x" aria-label="Close" onClick={close}>
          ✕
        </button>
        {card}
      </div>
    </div>,
    document.body
  );
}
