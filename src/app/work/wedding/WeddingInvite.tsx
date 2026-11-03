'use client';

// The demo invitation itself: hero, countdown, programme, venue, dress code,
// gallery, RSVP, FAQ and sharing, in English or नेपाली. Everything runs in the
// browser — the RSVP is kept in localStorage and never sent anywhere, and the
// calendar file is built on the spot.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ArtDefs, Arch, Diya, Mandala, MiniMap, ProgrammeIcon, TileArt, Toran } from './art';
import { CEREMONY_AT, COPY, PROGRAMME, VENUE, toNeDigits, type InviteLang, type ProgrammeItem } from './content';

const LANG_KEY = 'mn-demo:wedding-lang';
const RSVP_KEY = 'mn-demo:wedding-rsvp';

type Rsvp = {
  name: string;
  coming: boolean;
  guests: number;
  events: ProgrammeItem['id'][];
  food: 'veg' | 'nonveg';
  message: string;
};

const EMPTY: Rsvp = { name: '', coming: true, guests: 2, events: ['janti', 'bihe', 'reception'], food: 'veg', message: '' };

function readStore<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeStore(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private window: the page still works, it just forgets */
  }
}

// ---------- calendar (.ics) ----------

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}
function buildIcs(items: ProgrammeItem[], lang: InviteLang): string {
  const t = COPY[lang];
  const stamp = icsDate(new Date().toISOString());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MartNepali//Demo wedding invitation//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const p of items) {
    const where = p.place === 'hall' ? `${VENUE.name}, ${VENUE.street}, ${VENUE.city}` : t.places.home;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${p.id}-20270220@demo.martnepali.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(p.start)}`,
      `DTEND:${icsDate(p.end)}`,
      `SUMMARY:${icsText(`${t.icsTitle} · ${t.events[p.id].name} (${t.demo})`)}`,
      `LOCATION:${icsText(where)}`,
      `DESCRIPTION:${icsText(t.events[p.id].text)}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
function downloadIcs(items: ProgrammeItem[], lang: InviteLang, name: string) {
  const blob = new Blob([buildIcs(items, lang)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- pieces ----------

function useCountdown(target: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const end = new Date(target).getTime();
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

function Countdown({ lang }: { lang: InviteLang }) {
  const t = COPY[lang];
  const left = useCountdown(CEREMONY_AT);
  const parts =
    left === null
      ? null
      : [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60];
  const show = (n: number | undefined, pad: boolean) => {
    if (n === undefined) return '–';
    const s = pad ? String(n).padStart(2, '0') : String(n);
    return lang === 'ne' ? toNeDigits(s) : s;
  };
  return (
    <section className="wd-section wd-count" aria-labelledby="wd-count-h" data-reveal>
      <h2 id="wd-count-h" className="wd-h2 wd-h2-light">
        {t.countdownTitle}
      </h2>
      {left === 0 ? (
        <p className="wd-count-done">{t.countdownDone}</p>
      ) : (
        <div className="wd-count-grid" role="timer" aria-live="off">
          {t.units.map((u, i) => (
            <div key={u} className="wd-count-cell">
              <span className="wd-count-num" key={parts ? parts[i] : 'x'}>
                {show(parts?.[i], i > 0)}
              </span>
              <span className="wd-count-unit">{u}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RsvpBlock({ lang }: { lang: InviteLang }) {
  const t = COPY[lang];
  const [form, setForm] = useState<Rsvp>(EMPTY);
  const [sent, setSent] = useState<Rsvp | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = readStore<Rsvp>(RSVP_KEY);
    if (saved && typeof saved.name === 'string') {
      setSent(saved);
      setForm(saved);
    }
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim().slice(0, 60);
    if (!name) {
      setError(t.needName);
      return;
    }
    const events = PROGRAMME.map((p) => p.id).filter((id) => form.events.includes(id));
    const reply: Rsvp = { ...form, name, events, message: form.message.slice(0, 400) };
    writeStore(RSVP_KEY, reply);
    setError('');
    setSent(reply);
  };

  const toggleEvent = (id: ProgrammeItem['id']) =>
    setForm((f) => ({ ...f, events: f.events.includes(id) ? f.events.filter((x) => x !== id) : [...f.events, id] }));

  if (sent) {
    const first = sent.name.split(/\s+/)[0];
    return (
      <div className="wd-thanks" role="status">
        <div className="wd-petals" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
        <Mandala className="wd-thanks-mandala" stroke="#c8962e" />
        <p className="wd-thanks-kicker">{sent.coming ? '✦ ✦ ✦' : '✦'}</p>
        <h3 className="wd-thanks-h">{sent.coming ? t.thanksYes(first) : t.thanksNo(first)}</h3>
        <p>{sent.coming ? t.thanksYesText : t.thanksNoText}</p>
        {sent.coming && (
          <p className="wd-thanks-sum">
            {t.summaryGuests(sent.guests)} · {sent.events.map((id) => t.events[id].name).join(' · ')} ·{' '}
            {sent.food === 'veg' ? t.veg : t.nonveg}
          </p>
        )}
        <div className="wd-thanks-actions">
          {sent.coming && (
            <button type="button" className="wd-btn wd-btn-gold" onClick={() => downloadIcs(PROGRAMME.filter((p) => sent.events.includes(p.id)), lang, 'aarati-sujan-wedding.ics')}>
              {t.addOne}
            </button>
          )}
          <button
            type="button"
            className="wd-btn wd-btn-ghost"
            onClick={() => {
              setSent(null);
              writeStore(RSVP_KEY, null);
            }}
          >
            {t.edit}
          </button>
        </div>
        <p className="wd-demo-note">{t.demoNote}</p>
      </div>
    );
  }

  return (
    <form className="wd-form" onSubmit={submit} noValidate>
      <label className="wd-field">
        <span>{t.fName}</span>
        <input
          type="text"
          value={form.name}
          maxLength={60}
          autoComplete="off"
          placeholder={t.fNamePh}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          aria-invalid={Boolean(error)}
        />
      </label>
      {error && (
        <p className="wd-error" role="alert">
          {error}
        </p>
      )}
      <fieldset className="wd-field">
        <legend>{t.fComing}</legend>
        <div className="wd-choice">
          <button type="button" aria-pressed={form.coming} className={form.coming ? 'on' : ''} onClick={() => setForm({ ...form, coming: true })}>
            {t.yes}
          </button>
          <button type="button" aria-pressed={!form.coming} className={!form.coming ? 'on' : ''} onClick={() => setForm({ ...form, coming: false })}>
            {t.no}
          </button>
        </div>
      </fieldset>
      {form.coming && (
        <>
          <fieldset className="wd-field">
            <legend>{t.fGuests}</legend>
            <div className="wd-stepper">
              <button type="button" aria-label="−" onClick={() => setForm({ ...form, guests: Math.max(1, form.guests - 1) })}>
                −
              </button>
              <output aria-live="polite">{lang === 'ne' ? toNeDigits(form.guests) : form.guests}</output>
              <button type="button" aria-label="+" onClick={() => setForm({ ...form, guests: Math.min(8, form.guests + 1) })}>
                +
              </button>
            </div>
          </fieldset>
          <fieldset className="wd-field">
            <legend>{t.fWhich}</legend>
            <div className="wd-checks">
              {PROGRAMME.map((p) => (
                <label key={p.id} className={form.events.includes(p.id) ? 'on' : ''}>
                  <input type="checkbox" checked={form.events.includes(p.id)} onChange={() => toggleEvent(p.id)} />
                  {t.events[p.id].name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="wd-field">
            <legend>{t.fFood}</legend>
            <div className="wd-choice">
              <button type="button" aria-pressed={form.food === 'veg'} className={form.food === 'veg' ? 'on' : ''} onClick={() => setForm({ ...form, food: 'veg' })}>
                {t.veg}
              </button>
              <button type="button" aria-pressed={form.food === 'nonveg'} className={form.food === 'nonveg' ? 'on' : ''} onClick={() => setForm({ ...form, food: 'nonveg' })}>
                {t.nonveg}
              </button>
            </div>
          </fieldset>
        </>
      )}
      <label className="wd-field">
        <span>{t.fMessage}</span>
        <textarea rows={3} maxLength={400} value={form.message} placeholder={t.fMessagePh} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      </label>
      <button type="submit" className="wd-btn wd-btn-red wd-btn-wide">
        {t.send}
      </button>
      <p className="wd-demo-note">{t.demoNote}</p>
    </form>
  );
}

function Gallery({ lang }: { lang: InviteLang }) {
  const t = COPY[lang];
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const show = (i: number) => {
    setOpen(i);
    ref.current?.showModal?.();
  };
  return (
    <>
      <div className="wd-gallery">
        {t.tiles.map((label, i) => (
          <button key={i} type="button" className={`wd-tile wd-tile-${i}`} onClick={() => show(i)} data-reveal style={{ '--i': i } as CSSProperties}>
            <span className="wd-tile-art">
              <TileArt i={i} />
            </span>
            <span className="wd-tile-label">{label}</span>
          </button>
        ))}
      </div>
      <dialog
        ref={ref}
        className="wd-lightbox"
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
      >
        {open !== null && (
          <div className={`wd-lightbox-inner wd-tile-${open}`}>
            <div className="wd-tile-art">
              <TileArt i={open} />
            </div>
            <p>
              {t.tiles[open]} · {t.gallerySub}
            </p>
            <button type="button" className="wd-btn wd-btn-ghost" onClick={() => ref.current?.close()}>
              {t.close}
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}

function Share({ lang }: { lang: InviteLang }) {
  const t = COPY[lang];
  const [url, setUrl] = useState('https://martnepali.com/work/wedding');
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(`${window.location.origin}/work/wedding`), []);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${t.waMessage} ${url}`)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* older browsers: the button still says copied only if it worked */
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };
  return (
    <section className="wd-section wd-share" aria-labelledby="wd-share-h" data-reveal>
      <h2 id="wd-share-h" className="wd-h2">
        {t.shareTitle}
      </h2>
      <p className="wd-sub">{t.shareText}</p>
      <div className="wd-share-row">
        <a className="wd-btn wd-btn-wa" href={wa} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"
            />
          </svg>
          {t.whatsapp}
        </a>
        <button type="button" className="wd-btn wd-btn-ghost" onClick={copy}>
          {copied ? `✓ ${t.copied}` : t.copy}
        </button>
      </div>
    </section>
  );
}

// ---------- the page ----------

export default function WeddingInvite() {
  const [lang, setLang] = useState<InviteLang>('en');
  const rootRef = useRef<HTMLDivElement>(null);
  const t = COPY[lang];

  useEffect(() => {
    const saved = readStore<InviteLang>(LANG_KEY);
    if (saved === 'ne' || saved === 'en') setLang(saved);
  }, []);

  const pick = useCallback((l: InviteLang) => {
    setLang(l);
    writeStore(LANG_KEY, l);
  }, []);

  // Sticky bar sits under the site header, whatever its height.
  useEffect(() => {
    const root = rootRef.current;
    const header = document.querySelector<HTMLElement>('.site-header');
    if (!root) return;
    const set = () => root.style.setProperty('--wd-top', `${header ? header.offsetHeight : 0}px`);
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, []);

  // Sections rise in as they scroll into view (only once JS is here, and
  // never for visitors who asked for less motion — see wedding.css).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) return;
    root.classList.add('wd-js');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    root.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={`wd wd-lang-${lang}`} lang={lang === 'ne' ? 'ne' : 'en'} translate="no">
      <ArtDefs />

      <div className="wd-bar">
        <a href="#wd-top" className="wd-mono" aria-label={`${t.bride} & ${t.groom}`}>
          <span>{lang === 'ne' ? 'आ' : 'A'}</span>
          <i>✦</i>
          <span>{lang === 'ne' ? 'सु' : 'S'}</span>
        </a>
        <nav className="wd-bar-nav" aria-label="Invitation">
          <a href="#wd-programme">{t.nav.programme}</a>
          <a href="#wd-venue">{t.nav.venue}</a>
          <a href="#wd-rsvp">{t.nav.rsvp}</a>
          <a href="#wd-faq">{t.nav.faq}</a>
        </nav>
        <div className="wd-lang" role="group" aria-label="Language / भाषा">
          <button type="button" aria-pressed={lang === 'en'} onClick={() => pick('en')}>
            EN
          </button>
          <button type="button" aria-pressed={lang === 'ne'} onClick={() => pick('ne')} lang="ne">
            नेपाली
          </button>
        </div>
      </div>

      {/* ---------- hero ---------- */}
      <header className="wd-hero" id="wd-top">
        <Mandala className="wd-hero-mandala" />
        <Toran />
        <div className="wd-doors" aria-hidden="true">
          <span className="wd-door wd-door-l" />
          <span className="wd-door wd-door-r" />
          <span className="wd-seal">
            <span>{lang === 'ne' ? 'आ ✦ सु' : 'A ✦ S'}</span>
          </span>
        </div>
        <div className="wd-hero-inner">
          <Arch />
          <div className="wd-hero-text">
            <p className="wd-invocation">{t.invocation}</p>
            <p className="wd-kicker">{t.kicker}</p>
            <h1 className="wd-names">
              <span className="wd-name wd-name-1">{t.bride}</span>
              <span className="wd-amp">&amp;</span>
              <span className="wd-name wd-name-2">{t.groom}</span>
            </h1>
            <p className="wd-invite">{t.invite}</p>
            <div className="wd-date">
              <span className="wd-rule" />
              <p>
                <strong>{t.dateLine}</strong>
                <span>
                  {t.bsLine} · {t.cityLine}
                </span>
              </p>
              <span className="wd-rule" />
            </div>
            <a href="#wd-rsvp" className="wd-btn wd-btn-gold">
              {t.rsvpCta}
            </a>
          </div>
          <Diya className="wd-hero-diya wd-hero-diya-l" />
          <Diya className="wd-hero-diya wd-hero-diya-r" />
        </div>
        <a href="#wd-welcome" className="wd-scroll" aria-label={t.scroll}>
          <span />
        </a>
      </header>

      <div className="wd-dhaka" aria-hidden="true" />

      {/* ---------- welcome ---------- */}
      <section className="wd-section wd-welcome" id="wd-welcome" data-reveal>
        <Mandala className="wd-welcome-mandala" stroke="#c8962e" />
        <h2 className="wd-h2">{t.welcomeTitle}</h2>
        <p className="wd-lead">{t.welcome}</p>
        <p className="wd-sign">{t.families}</p>
      </section>

      <Countdown lang={lang} />

      {/* ---------- programme ---------- */}
      <section className="wd-section" id="wd-programme" aria-labelledby="wd-prog-h">
        <h2 id="wd-prog-h" className="wd-h2" data-reveal>
          {t.programmeTitle}
        </h2>
        <p className="wd-sub" data-reveal>
          {t.programmeSub}
        </p>
        <ol className="wd-timeline">
          {PROGRAMME.map((p, i) => {
            const e = t.events[p.id];
            return (
              <li key={p.id} className="wd-step" data-reveal style={{ '--i': i } as CSSProperties}>
                <span className="wd-step-icon">
                  <ProgrammeIcon id={p.id} />
                </span>
                <div className="wd-step-card">
                  <p className="wd-step-when">
                    {e.day} · <strong>{e.time}</strong>
                  </p>
                  <h3>{e.name}</h3>
                  <p>{e.text}</p>
                  <p className="wd-step-where">📍 {t.places[p.place]}</p>
                  <button type="button" className="wd-link-btn" onClick={() => downloadIcs([p], lang, `aarati-sujan-${p.id}.ics`)}>
                    + {t.addOne}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="wd-center" data-reveal>
          <button type="button" className="wd-btn wd-btn-red" onClick={() => downloadIcs(PROGRAMME, lang, 'aarati-sujan-wedding.ics')}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
            </svg>
            {t.addAll}
          </button>
        </div>
      </section>

      {/* ---------- venue + dress ---------- */}
      <section className="wd-section wd-two" id="wd-venue">
        <article className="wd-card wd-venue" data-reveal>
          <MiniMap />
          <div className="wd-card-body">
            <p className="wd-card-kicker">{t.venueTitle}</p>
            <h3>{VENUE.name}</h3>
            <p className="wd-addr">
              {VENUE.street}
              <br />
              {VENUE.city}
            </p>
            <ul className="wd-notes">
              {t.venueNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <a className="wd-btn wd-btn-red" href={VENUE.map} target="_blank" rel="noopener noreferrer">
              {t.openMap} ↗
            </a>
            <p className="wd-demo-note">{t.venueDemo}</p>
          </div>
        </article>
        <article className="wd-card wd-dress" data-reveal>
          <div className="wd-card-body">
            <p className="wd-card-kicker">{t.dressTitle}</p>
            <div className="wd-swatches">
              {t.swatches.map((s, i) => (
                <span key={i} className={`wd-swatch wd-swatch-${i}`}>
                  <i />
                  {s}
                </span>
              ))}
            </div>
            <p>{t.dressText}</p>
            <p className="wd-avoid">{t.dressAvoid}</p>
            <p className="wd-warm">❄ {t.dressWarm}</p>
          </div>
        </article>
      </section>

      {/* ---------- gallery ---------- */}
      <section className="wd-section" id="wd-gallery" aria-labelledby="wd-gal-h">
        <h2 id="wd-gal-h" className="wd-h2" data-reveal>
          {t.galleryTitle}
        </h2>
        <p className="wd-sub" data-reveal>
          {t.gallerySub}
        </p>
        <Gallery lang={lang} />
      </section>

      <div className="wd-dhaka" aria-hidden="true" />

      {/* ---------- RSVP ---------- */}
      <section className="wd-section wd-rsvp" id="wd-rsvp" aria-labelledby="wd-rsvp-h">
        <div className="wd-rsvp-card" data-reveal>
          <h2 id="wd-rsvp-h" className="wd-h2">
            {t.rsvpTitle}
          </h2>
          <p className="wd-sub">{t.rsvpSub}</p>
          <p className="wd-by">{t.rsvpBy}</p>
          <RsvpBlock lang={lang} />
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="wd-section" id="wd-faq" aria-labelledby="wd-faq-h">
        <h2 id="wd-faq-h" className="wd-h2" data-reveal>
          {t.faqTitle}
        </h2>
        <div className="wd-faq">
          {t.faq.map((f, i) => (
            <details key={i} data-reveal>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Share lang={lang} />

      <footer className="wd-foot">
        <Mandala className="wd-foot-mandala" />
        <p className="wd-foot-names">{t.footer}</p>
        <p className="wd-foot-date">
          {t.dateLine} · {t.cityLine}
        </p>
      </footer>
    </div>
  );
}
