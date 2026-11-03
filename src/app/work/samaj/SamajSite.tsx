'use client';

// The association website kit demo: a whole site for a made-up Nepali Verein
// (Saathi Samaj Main-Neckar e.V.) on one page — home, programme calendar,
// news, about, a multi-step membership form, a members' area, a gallery and
// contact. The kit bar on top shows it is a kit: three looks that re-theme the
// whole site live, a logo maker and three languages. Rules live in samaj.ts,
// words in content.ts; everything stays in localStorage under one key and
// nothing is sent anywhere.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { Avatar, Icon, Scene } from './art';
import {
  COPY,
  DOCS,
  EMAIL,
  GALLERY,
  LANGS,
  NEWS_DATES,
  NEWS_ORDER,
  NEWS_TAG,
  PEOPLE,
  fmtDate,
  fmtTimeRange,
  num,
  personName,
  type Copy,
  type DocId,
  type GalleryId,
  type NewsId,
} from './content';
import {
  EMBLEM_SHAPES,
  EVENTS,
  FAMILY_MAX,
  LOOKS,
  LOOK_IDS,
  ORG,
  PEOPLE_MAX,
  POLL_OPTIONS,
  RELATIONS,
  RSVPS,
  SCHOOL,
  STEPS,
  addFamily,
  bsLabel,
  castVote,
  clampMonth,
  confirmationHtml,
  emblemSvg,
  eventsOn,
  goingCount,
  initialsFrom,
  isSchoolDay,
  isoDate,
  join,
  lookVars,
  monthGrid,
  nextEvent,
  normalize,
  pollCounts,
  pollLeader,
  pollResults,
  removeFamily,
  seedState,
  setRsvp,
  validateStep,
  type Application,
  type EmblemShape,
  type Errors,
  type EventDef,
  type Lang,
  type LookId,
  type Member,
  type PollOption,
  type Relation,
  type Rsvp,
  type SamajState,
  type StepId,
} from './samaj';

const STORE_KEY = 'mn-demo:samaj';
/** The first paint (server and client) uses this clock; the real one takes over after mount. */
const FIRST_NOW = new Date(2026, 10, 3, 12, 0);
const DEMO_NUMBER = 'SSM-2019-0042';

function loadRaw(): unknown {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveRaw(s: SamajState | null) {
  try {
    if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private window: the demo still works, it just forgets on reload */
  }
}
function lessMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
function goTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: lessMotion() ? 'auto' : 'smooth', block: 'start' });
}
function saveFile(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function daysBetween(fromIso: string, toIso: string): number {
  const [a, b] = [fromIso, toIso].map((s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

// ---------- small pieces ----------

function Emblem({ s, prefix, size, className }: { s: SamajState; prefix: string; size: number; className?: string }) {
  const html = useMemo(() => emblemSvg({ ...s.logo, look: s.look, idPrefix: prefix }, size), [s.logo, s.look, prefix, size]);
  return <span className={`sj-emblem ${className ?? ''}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Qr({ text, label }: { text: string; label: string }) {
  const path = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d, n: n + 4 };
  }, [text]);
  return (
    <svg className="sj-qr" viewBox={`0 0 ${path.n} ${path.n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={path.n} height={path.n} fill="#fff" />
      <path d={path.d} fill="#111827" />
    </svg>
  );
}

function Modal({ title, onClose, children, labelId, wide, closeLabel }: { title: ReactNode; onClose: () => void; children: ReactNode; labelId: string; wide?: boolean; closeLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const body = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = body;
      prev?.focus?.();
    };
  }, []);
  return (
    <div className="sj-modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sj-modal${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1} ref={ref}>
        <div className="sj-modal-head">
          <h2 id={labelId}>{title}</h2>
          <button type="button" className="sj-icon-btn" onClick={onClose} aria-label={closeLabel}>
            <Icon name="x" />
          </button>
        </div>
        <div className="sj-modal-body">{children}</div>
      </div>
    </div>
  );
}

function SectionHead({ kicker, title, sub, id }: { kicker?: string; title: string; sub?: string; id: string }) {
  return (
    <header className="sj-sec-head">
      {kicker && <p className="sj-kicker">{kicker}</p>}
      <h2 id={id}>{title}</h2>
      {sub && <p className="sj-sec-sub">{sub}</p>}
    </header>
  );
}

function TicketLink({ t }: { t: Copy }) {
  return (
    <a className="sj-btn sj-btn-ticket" href="/events" title={t.ev.ticketsNote}>
      <Icon name="ticket" />
      {t.ev.tickets}
    </a>
  );
}

// ---------- kit bar & header ----------

const NAV: { id: string; key: keyof Copy['nav'] }[] = [
  { id: 'sj-home', key: 'home' },
  { id: 'sj-programme', key: 'programme' },
  { id: 'sj-news', key: 'news' },
  { id: 'sj-about', key: 'about' },
  { id: 'sj-join', key: 'join' },
  { id: 'sj-members', key: 'members' },
  { id: 'sj-gallery', key: 'gallery' },
  { id: 'sj-contact', key: 'contact' },
];

function KitBar({ s, t, onLook, onLogo, onReset }: { s: SamajState; t: Copy; onLook: (l: LookId) => void; onLogo: () => void; onReset: () => void }) {
  return (
    <div className="sj-kit" role="region" aria-label={t.kit.label}>
      <div className="sj-kit-inner">
        <p className="sj-kit-label">
          <Icon name="palette" />
          <strong>{t.kit.label}</strong>
          <span className="sj-kit-hint">{t.kit.hint}</span>
        </p>
        <div className="sj-kit-tools">
          <div className="sj-looks" role="radiogroup" aria-label={t.kit.look}>
            {LOOK_IDS.map((id) => {
              const c = LOOKS[id].colors;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={s.look === id}
                  className={`sj-look${s.look === id ? ' is-on' : ''}`}
                  onClick={() => onLook(id)}
                  data-look={id}
                >
                  <span className="sj-look-sw" aria-hidden="true">
                    <span style={{ background: c.primary }} />
                    <span style={{ background: c.accent }} />
                    <span style={{ background: c.bg }} />
                  </span>
                  {t.kit.looks[id]}
                </button>
              );
            })}
          </div>
          <button type="button" className="sj-kit-btn" onClick={onLogo} data-act="logo">
            {t.kit.logo}
          </button>
          <button type="button" className="sj-kit-btn sj-kit-reset" onClick={onReset} data-act="reset">
            <Icon name="reset" />
            {t.kit.reset}
          </button>
        </div>
      </div>
    </div>
  );
}

function SiteHeader({ s, t, onLang, active }: { s: SamajState; t: Copy; onLang: (l: Lang) => void; active: string }) {
  return (
    <header className="sj-header">
      <div className="sj-header-top sj-wrap">
        <a href="#sj-home" className="sj-brand" onClick={(e) => (e.preventDefault(), goTo('sj-home'))}>
          <Emblem s={s} prefix="hdr" size={48} />
          <span className="sj-brand-text">
            <span className="sj-brand-name">{t.orgName}</span>
            <span className="sj-brand-sub">{t.orgSub}</span>
          </span>
        </a>
        <div className="sj-langs" role="group" aria-label={t.kit.lang}>
          {LANGS.map((l) => (
            <button key={l.id} type="button" className={`sj-lang${s.lang === l.id ? ' is-on' : ''}`} aria-pressed={s.lang === l.id} onClick={() => onLang(l.id)} lang={l.id} data-lang={l.id}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <nav className="sj-nav" aria-label={t.nav.label}>
        <ul className="sj-wrap">
          {NAV.map((n) => (
            <li key={n.id}>
              <a
                href={`#${n.id}`}
                className={active === n.id ? 'is-on' : undefined}
                aria-current={active === n.id ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  goTo(n.id);
                }}
              >
                {t.nav[n.key]}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

// ---------- home ----------

function Hero({ s, t, lang, now, mounted, onEvent }: { s: SamajState; t: Copy; lang: Lang; now: Date; mounted: boolean; onEvent: (e: EventDef) => void }) {
  const next = nextEvent(now);
  const days = next ? daysBetween(isoDate(now), next.date) : 0;
  return (
    <section className="sj-hero" id="sj-home" aria-labelledby="sj-home-h">
      <div className="sj-hero-art" aria-hidden="true">
        <svg viewBox="0 0 1200 220" preserveAspectRatio="none">
          <path d="M0 220 L0 150 L140 70 L230 130 L360 30 L480 120 L560 80 L700 160 L820 60 L940 130 L1040 90 L1200 150 L1200 220 Z" />
          <path className="sj-hero-art-b" d="M0 220 L0 185 L180 120 L320 170 L470 110 L640 180 L790 120 L960 175 L1100 135 L1200 170 L1200 220 Z" />
        </svg>
      </div>
      <div className="sj-wrap sj-hero-grid">
        <div className="sj-hero-copy">
          <p className="sj-kicker sj-on-hero">{t.hero.kicker}</p>
          <h1 id="sj-home-h">{t.hero.title}</h1>
          <p className="sj-hero-mission">{t.hero.mission}</p>
          <ul className="sj-stats">
            {t.hero.stats.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        {next && (
          <article className="sj-next" aria-labelledby="sj-next-h">
            <p className="sj-next-label">
              {t.hero.next}
              {mounted && <span className="sj-next-days">{days === 0 ? t.hero.today : t.hero.inDays(num(days, lang))}</span>}
            </p>
            <div className="sj-next-date" aria-hidden="true">
              <span className="sj-next-m">{t.monthsShort[Number(next.date.slice(5, 7)) - 1]}</span>
              <span className="sj-next-d">{num(Number(next.date.slice(8)), lang)}</span>
            </div>
            <h2 id="sj-next-h">{t.ev.items[next.id].title}</h2>
            <p className="sj-next-when">
              {fmtDate(next.date, lang)} · {fmtTimeRange(next.start, next.end, lang)}
            </p>
            <p className="sj-next-bs">{bsLabel(next.date, lang)}</p>
            <p className="sj-next-where">
              <Icon name="pin" />
              {t.ev.places[next.place]}
            </p>
            <div className="sj-next-ctas">
              <button type="button" className="sj-btn sj-btn-main" onClick={() => onEvent(next)}>
                {t.hero.details}
              </button>
              <TicketLink t={t} />
            </div>
          </article>
        )}
      </div>
      <div className="sj-wrap">
        <nav className="sj-quick" aria-label={t.hero.quick}>
          {(
            [
              ['sj-join', t.hero.quickJoin, 'join'],
              ['sj-programme', t.hero.quickProgramme, 'cal'],
              ['sj-members', t.hero.quickMembers, 'lock'],
              ['sj-contact', t.hero.quickContact, 'mail'],
            ] as const
          ).map(([id, label, icon]) => (
            <a key={id} href={`#${id}`} onClick={(e) => (e.preventDefault(), goTo(id))}>
              <Icon name={icon} />
              {label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}

const PILLAR_ICONS = ['cal', 'doc', 'users', 'join'] as const;

function Pillars({ t }: { t: Copy }) {
  return (
    <section className="sj-section sj-pillars-sec" aria-label={t.about.title}>
      <ul className="sj-wrap sj-pillars">
        {t.pillars.map((p, i) => (
          <li key={p.title} className="sj-pillar">
            <span className="sj-pillar-n" aria-hidden="true">
              <Icon name={PILLAR_ICONS[i]} />
            </span>
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- programme ----------

function EventCard({ e, t, lang }: { e: EventDef; t: Copy; lang: Lang }) {
  return (
    <article className={`sj-ev sj-ev-${e.kind}`} id={`sj-ev-${e.id}`}>
      <div className="sj-ev-date" aria-hidden="true">
        <span>{t.monthsShort[Number(e.date.slice(5, 7)) - 1]}</span>
        <strong>{num(Number(e.date.slice(8)), lang)}</strong>
      </div>
      <div className="sj-ev-body">
        <p className="sj-ev-kind">{t.ev.kinds[e.kind]}</p>
        <h3>{t.ev.items[e.id].title}</h3>
        <p className="sj-ev-when">
          <Icon name="clock" />
          <span>
            {fmtDate(e.date, lang)} · {fmtTimeRange(e.start, e.end, lang)}
            <span className="sj-ev-bs"> · {bsLabel(e.date, lang)}</span>
          </span>
        </p>
        <p className="sj-ev-where">
          <Icon name="pin" />
          <span>{t.ev.places[e.place]}</span>
        </p>
        <p className="sj-ev-blurb">{t.ev.items[e.id].blurb}</p>
        <TicketLink t={t} />
      </div>
    </article>
  );
}

function Programme({ t, lang, month, setMonth, view, setView, picked, setPicked, now }: {
  t: Copy;
  lang: Lang;
  month: { y: number; m: number };
  setMonth: (m: { y: number; m: number }) => void;
  view: 'month' | 'list';
  setView: (v: 'month' | 'list') => void;
  picked: string | null;
  setPicked: (d: string | null) => void;
  now: Date;
}) {
  const weeks = monthGrid(month.y, month.m);
  const today = isoDate(now);
  const inMonth = EVENTS.filter((e) => Number(e.date.slice(0, 4)) === month.y && Number(e.date.slice(5, 7)) - 1 === month.m);
  const shown = picked ? eventsOn(picked) : inMonth;
  const atStart = month.y === 2027 && month.m === 0;
  const atEnd = month.y === 2027 && month.m === 11;
  return (
    <section className="sj-section" id="sj-programme" aria-labelledby="sj-programme-h">
      <div className="sj-wrap">
        <SectionHead id="sj-programme-h" title={t.ev.title} sub={t.ev.sub} />
        <div className="sj-ev-tools">
          <div className="sj-seg" role="group" aria-label={t.ev.title}>
            <button type="button" className={view === 'month' ? 'is-on' : ''} aria-pressed={view === 'month'} onClick={() => setView('month')} data-view="month">
              <Icon name="grid" />
              {t.ev.month}
            </button>
            <button type="button" className={view === 'list' ? 'is-on' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')} data-view="list">
              <Icon name="list" />
              {t.ev.list}
            </button>
          </div>
          <p className="sj-ev-note">{t.ev.ticketsNote}</p>
        </div>

        {view === 'month' ? (
          <div className="sj-cal-wrap">
            <div className="sj-cal">
              <div className="sj-cal-head">
                <button type="button" className="sj-icon-btn" disabled={atStart} onClick={() => (setPicked(null), setMonth(clampMonth(month.y, month.m - 1)))} aria-label={t.ev.prev}>
                  <Icon name="chev-l" />
                </button>
                <h3 aria-live="polite">
                  {t.months[month.m]} {num(month.y, lang)}
                </h3>
                <button type="button" className="sj-icon-btn" disabled={atEnd} onClick={() => (setPicked(null), setMonth(clampMonth(month.y, month.m + 1)))} aria-label={t.ev.next} data-act="next-month">
                  <Icon name="chev-r" />
                </button>
              </div>
              <table className="sj-cal-grid">
                <thead>
                  <tr>
                    {t.days.map((d) => (
                      <th key={d} scope="col">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w, i) => (
                    <tr key={i}>
                      {w.map((d, j) => {
                        if (!d) return <td key={j} className="is-out" />;
                        const evs = eventsOn(d);
                        const school = isSchoolDay(d);
                        const has = evs.length > 0 || school;
                        const label = [fmtDate(d, lang), ...evs.map((e) => t.ev.items[e.id].title), school ? t.ev.school : ''].filter(Boolean).join(' · ');
                        return (
                          <td key={j} className={`${evs.length ? 'has-ev' : ''}${d === today ? ' is-today' : ''}${picked === d ? ' is-picked' : ''}`}>
                            {has ? (
                              <button type="button" onClick={() => setPicked(picked === d ? null : d)} aria-label={label} aria-pressed={picked === d}>
                                <span className="sj-cal-n">{num(Number(d.slice(8)), lang)}</span>
                                <span className="sj-cal-dots" aria-hidden="true">
                                  {evs.length > 0 && <i className="dot-ev" />}
                                  {school && <i className="dot-school" />}
                                </span>
                                {evs[0] && <span className="sj-cal-t">{t.ev.items[evs[0].id].title}</span>}
                              </button>
                            ) : (
                              <span className="sj-cal-n">{num(Number(d.slice(8)), lang)}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="sj-cal-legend">
                <span>
                  <i className="dot-ev" /> {t.ev.legendEvent}
                </span>
                <span>
                  <i className="dot-school" /> {t.ev.legendSchool}
                </span>
                <span className="sj-cal-pick">{t.ev.pick}</span>
              </p>
            </div>
            <div className="sj-cal-side" aria-live="polite">
              {picked && isSchoolDay(picked) && (
                <div className="sj-school-card">
                  <p className="sj-ev-kind">{t.ev.kinds.school}</p>
                  <h3>{t.ev.schoolLine}</h3>
                  <p>
                    {fmtDate(picked, lang)} · {fmtTimeRange(SCHOOL.start, SCHOOL.end, lang)}
                  </p>
                  <p className="sj-muted">{t.ev.places.club}</p>
                </div>
              )}
              {shown.map((e) => (
                <EventCard key={e.id} e={e} t={t} lang={lang} />
              ))}
              {!shown.length && !(picked && isSchoolDay(picked)) && <p className="sj-empty">{t.ev.nothing}</p>}
            </div>
          </div>
        ) : (
          <div className="sj-ev-list">
            <div className="sj-school-card">
              <p className="sj-ev-kind">{t.ev.kinds.school}</p>
              <h3>{t.ev.schoolLine}</h3>
              <p>{lang === 'ne' ? num(t.ev.schoolWhen, lang) : t.ev.schoolWhen}</p>
              <p className="sj-muted">{t.ev.places.club}</p>
            </div>
            {EVENTS.map((e) => (
              <EventCard key={e.id} e={e} t={t} lang={lang} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- news ----------

function News({ t, lang, open, setOpen }: { t: Copy; lang: Lang; open: NewsId | null; setOpen: (id: NewsId | null) => void }) {
  const a = open ? t.news.items[open] : null;
  return (
    <section className="sj-section sj-alt" id="sj-news" aria-labelledby="sj-news-h">
      <div className="sj-wrap">
        <SectionHead id="sj-news-h" title={t.news.title} sub={t.news.sub} />
        {a && open ? (
          <article className="sj-article" aria-labelledby="sj-article-h">
            <button type="button" className="sj-link-btn" onClick={() => (setOpen(null), goTo('sj-news'))} data-act="news-back">
              {t.news.back}
            </button>
            <p className="sj-news-meta">
              <span className="sj-tag">{t.news.tags[NEWS_TAG[open]]}</span>
              <time dateTime={NEWS_DATES[open]}>{fmtDate(NEWS_DATES[open], lang)}</time>
            </p>
            <h3 id="sj-article-h">{a.title}</h3>
            <p className="sj-article-lead">{a.excerpt}</p>
            {a.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>
        ) : (
          <ul className="sj-news">
            {NEWS_ORDER.map((id, i) => {
              const it = t.news.items[id];
              return (
                <li key={id} className={`sj-news-item${i === 0 ? ' is-lead' : ''}`}>
                  <p className="sj-news-meta">
                    <span className="sj-tag">{t.news.tags[NEWS_TAG[id]]}</span>
                    <time dateTime={NEWS_DATES[id]}>{fmtDate(NEWS_DATES[id], lang)}</time>
                  </p>
                  <h3>{it.title}</h3>
                  <p>{it.excerpt}</p>
                  <button
                    type="button"
                    className="sj-link-btn"
                    onClick={() => {
                      setOpen(id);
                      requestAnimationFrame(() => goTo('sj-news'));
                    }}
                    data-news={id}
                  >
                    {t.news.read} →
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------- about ----------

function About({ t, lang }: { t: Copy; lang: Lang }) {
  return (
    <section className="sj-section" id="sj-about" aria-labelledby="sj-about-h">
      <div className="sj-wrap">
        <SectionHead id="sj-about-h" title={t.about.title} sub={t.about.intro} />
        <h3 className="sj-h3">{t.about.committee}</h3>
        <p className="sj-muted sj-small">{t.about.committeeNote}</p>
        <ul className="sj-committee">
          {PEOPLE.map((p) => (
            <li key={p.id} className="sj-person">
              <Avatar id={p.id} size={72} />
              <div>
                <p className="sj-person-name">{personName(p.id, lang)}</p>
                <p className="sj-person-role">
                  <strong>{t.about.roles[p.id].native}</strong>
                  <span>{t.about.roles[p.id].role}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="sj-about-grid">
          <div>
            <h3 className="sj-h3">{t.about.statutes}</h3>
            <p className="sj-muted sj-small">{t.about.statutesNote}</p>
            <div className="sj-statutes">
              {t.about.statuteItems.map((x, i) => (
                <details key={x.h} open={i < 2}>
                  <summary>{x.h}</summary>
                  <p>{x.p}</p>
                </details>
              ))}
            </div>
          </div>
          <div>
            <h3 className="sj-h3">{t.about.history}</h3>
            <ol className="sj-timeline">
              {t.about.historyItems.map((h) => (
                <li key={h.year}>
                  <span className="sj-tl-year">{num(h.year, lang)}</span>
                  <p>{h.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- membership ----------

function Field({ label, err, t, children, hint, id }: { label: string; err?: string; t: Copy; children: ReactNode; hint?: string; id: string }) {
  return (
    <div className={`sj-field${err ? ' has-err' : ''}`}>
      <label htmlFor={id}>
        {label}
        {hint && <span className="sj-opt"> ({hint})</span>}
      </label>
      {children}
      {err && (
        <p className="sj-err" id={`${id}-err`} role="alert">
          {t.join.errors[err as keyof Copy['join']['errors']]}
        </p>
      )}
    </div>
  );
}

function JoinSection({ s, t, lang, now, update, onJoined, onMembers, onAgain }: {
  s: SamajState;
  t: Copy;
  lang: Lang;
  now: Date;
  update: (fn: (s: SamajState) => SamajState) => void;
  onJoined: (m: Member) => void;
  onMembers: () => void;
  onAgain: () => void;
}) {
  const [tried, setTried] = useState<Partial<Record<StepId, boolean>>>({});
  const a = s.draft;
  const step = s.step;
  const idx = STEPS.indexOf(step);
  const year = now.getFullYear();
  const errors: Errors = tried[step] ? validateStep(step, a, year) : {};
  const set = (patch: Partial<Application>) => update((x) => ({ ...x, draft: { ...x.draft, ...patch } }));
  const setFam = (i: number, patch: Partial<Application['family'][number]>) =>
    update((x) => ({ ...x, draft: { ...x.draft, family: x.draft.family.map((f, j) => (j === i ? { ...f, ...patch } : f)) } }));
  const goStep = (st: StepId) => {
    update((x) => ({ ...x, step: st }));
    requestAnimationFrame(() => {
      document.querySelector('#sj-join .sj-steps')?.scrollIntoView({ block: 'start', behavior: lessMotion() ? 'auto' : 'smooth' });
      document.getElementById('sj-join-form')?.focus({ preventScroll: true });
    });
  };
  const next = (e?: FormEvent) => {
    e?.preventDefault();
    const errs = validateStep(step, a, year);
    if (Object.keys(errs).length) {
      setTried((x) => ({ ...x, [step]: true }));
      requestAnimationFrame(() => (document.querySelector('#sj-join .has-err input, #sj-join .has-err select') as HTMLElement | null)?.focus());
      return;
    }
    if (step === 'review') {
      const r = join(a, now);
      if (r.member) onJoined(r.member);
      return;
    }
    goStep(STEPS[idx + 1]);
  };
  const inp = (k: 'first' | 'last' | 'email' | 'phone' | 'town', type = 'text', auto?: string, optional?: boolean) => (
    <Field id={`sj-f-${k}`} label={t.join[k]} err={errors[k]} t={t} hint={optional ? t.join.optional : undefined}>
      <input
        id={`sj-f-${k}`}
        type={type}
        value={a[k]}
        autoComplete={auto}
        maxLength={k === 'email' ? 120 : 80}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? `sj-f-${k}-err` : undefined}
        onChange={(e) => set({ [k]: e.target.value } as Partial<Application>)}
      />
    </Field>
  );

  if (s.member) {
    return (
      <section className="sj-section sj-alt" id="sj-join" aria-labelledby="sj-join-h">
        <div className="sj-wrap sj-narrow">
          <SectionHead id="sj-join-h" title={t.join.title} />
          <Confirmation s={s} m={s.member} t={t} lang={lang} onMembers={onMembers} onAgain={onAgain} />
        </div>
      </section>
    );
  }

  return (
    <section className="sj-section sj-alt" id="sj-join" aria-labelledby="sj-join-h">
      <div className="sj-wrap sj-narrow">
        <SectionHead id="sj-join-h" title={t.join.title} sub={t.join.sub} />
        <ol className="sj-steps" aria-label={t.join.stepOf(num(idx + 1, lang), num(STEPS.length, lang))}>
          {STEPS.map((st, i) => (
            <li key={st} className={`${i === idx ? 'is-on' : ''}${i < idx ? ' is-done' : ''}`} aria-current={i === idx ? 'step' : undefined}>
              <span className="sj-step-n">{i < idx ? '✓' : num(i + 1, lang)}</span>
              <span className="sj-step-l">{t.join.steps[st]}</span>
            </li>
          ))}
        </ol>
        <form className="sj-form" id="sj-join-form" tabIndex={-1} onSubmit={next} noValidate>
          <p className="sj-form-step">{t.join.stepOf(num(idx + 1, lang), num(STEPS.length, lang))}</p>
          {step === 'personal' && (
            <div className="sj-form-grid">
              {inp('first', 'text', 'given-name')}
              {inp('last', 'text', 'family-name')}
              {inp('email', 'email', 'email')}
              {inp('phone', 'tel', 'tel', true)}
              {inp('town', 'text', 'address-level2')}
            </div>
          )}
          {step === 'family' && (
            <div>
              <p className="sj-muted">{t.join.familyIntro}</p>
              {a.family.length === 0 && <p className="sj-empty">{t.join.familyNone}</p>}
              <ul className="sj-family">
                {a.family.map((f, i) => (
                  <li key={i} className="sj-fam-row">
                    <Field id={`sj-fam-${i}-name`} label={t.join.familyName} err={errors[`family.${i}.name`]} t={t}>
                      <input id={`sj-fam-${i}-name`} value={f.name} maxLength={80} onChange={(e) => setFam(i, { name: e.target.value })} aria-invalid={errors[`family.${i}.name`] ? true : undefined} />
                    </Field>
                    <Field id={`sj-fam-${i}-rel`} label={t.join.familyRelation} err={errors[`family.${i}.relation`]} t={t}>
                      <select id={`sj-fam-${i}-rel`} value={f.relation} onChange={(e) => setFam(i, { relation: e.target.value as Relation })}>
                        {RELATIONS.map((r) => (
                          <option key={r} value={r}>
                            {t.join.relations[r]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field id={`sj-fam-${i}-born`} label={t.join.familyBorn} err={errors[`family.${i}.born`]} t={t} hint={t.join.optional}>
                      <input id={`sj-fam-${i}-born`} inputMode="numeric" value={f.born} maxLength={4} onChange={(e) => setFam(i, { born: e.target.value.replace(/\D/g, '') })} />
                    </Field>
                    <button type="button" className="sj-link-btn sj-fam-x" onClick={() => update((x) => ({ ...x, draft: removeFamily(x.draft, i) }))}>
                      {t.join.familyRemove}
                    </button>
                  </li>
                ))}
              </ul>
              {a.family.length < FAMILY_MAX ? (
                <button type="button" className="sj-btn" onClick={() => update((x) => ({ ...x, draft: addFamily(x.draft) }))} data-act="add-family">
                  {t.join.familyAdd}
                </button>
              ) : (
                <p className="sj-muted">{t.join.familyMax}</p>
              )}
            </div>
          )}
          {step === 'consent' && (
            <div className="sj-consents">
              <div className={`sj-check${errors.consentData ? ' has-err' : ''}`}>
                <input id="sj-c-data" type="checkbox" checked={a.consentData} onChange={(e) => set({ consentData: e.target.checked })} />
                <label htmlFor="sj-c-data">
                  {t.join.consentData}
                  <span className="sj-opt sj-block">{t.join.consentDataMore}</span>
                </label>
                {errors.consentData && <p className="sj-err" role="alert">{t.join.errors.consent}</p>}
              </div>
              <fieldset className={`sj-radios${errors.photos ? ' has-err' : ''}`}>
                <legend>{t.join.photosQ}</legend>
                {(['yes', 'no'] as const).map((v) => (
                  <label key={v} className="sj-radio">
                    <input type="radio" name="sj-photos" value={v} checked={a.photos === v} onChange={() => set({ photos: v })} />
                    <span>{v === 'yes' ? t.join.photosYes : t.join.photosNo}</span>
                  </label>
                ))}
                <p className="sj-opt">{t.join.photosMore}</p>
                {errors.photos && <p className="sj-err" role="alert">{t.join.errors.choose}</p>}
              </fieldset>
              <div className="sj-check">
                <input id="sj-c-news" type="checkbox" checked={a.newsletter} onChange={(e) => set({ newsletter: e.target.checked })} />
                <label htmlFor="sj-c-news">
                  {t.join.newsletter} <span className="sj-opt">({t.join.optional})</span>
                </label>
              </div>
            </div>
          )}
          {step === 'review' && (
            <div className="sj-review">
              <p className="sj-muted">{t.join.reviewIntro}</p>
              <dl>
                <div>
                  <dt>{t.join.steps.personal}</dt>
                  <dd>
                    {a.first} {a.last}
                    <br />
                    {a.email}
                    {a.phone && (
                      <>
                        <br />
                        {a.phone}
                      </>
                    )}
                    <br />
                    {a.town}
                  </dd>
                  <button type="button" className="sj-link-btn" onClick={() => goStep('personal')}>
                    {t.join.edit}
                  </button>
                </div>
                <div>
                  <dt>{t.join.steps.family}</dt>
                  <dd>
                    {a.family.length
                      ? a.family.map((f, i) => (
                          <span key={i} className="sj-block">
                            {f.name} · {t.join.relations[f.relation]}
                            {f.born ? ` · ${num(f.born, lang)}` : ''}
                          </span>
                        ))
                      : '—'}
                  </dd>
                  <button type="button" className="sj-link-btn" onClick={() => goStep('family')}>
                    {t.join.edit}
                  </button>
                </div>
                <div>
                  <dt>{t.join.steps.consent}</dt>
                  <dd>
                    <span className="sj-block">DSGVO: {a.consentData ? t.join.yes : t.join.no}</span>
                    <span className="sj-block">
                      {t.join.photosLabel}: {a.photos === 'yes' ? t.join.yes : a.photos === 'no' ? t.join.no : '—'}
                    </span>
                    <span className="sj-block">
                      {t.join.newsletterLabel}: {a.newsletter ? t.join.yes : t.join.no}
                    </span>
                  </dd>
                  <button type="button" className="sj-link-btn" onClick={() => goStep('consent')}>
                    {t.join.edit}
                  </button>
                </div>
              </dl>
            </div>
          )}
          {Object.keys(errors).length > 0 && <p className="sj-err sj-err-sum">{t.join.fixFirst}</p>}
          <div className="sj-form-nav">
            {idx > 0 ? (
              <button type="button" className="sj-btn" onClick={() => goStep(STEPS[idx - 1])}>
                {t.join.back}
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="sj-btn sj-btn-main" data-act="join-next">
              {step === 'review' ? t.join.submit : t.join.nextStep}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function confirmText(t: Copy, lang: Lang, m: Member) {
  return {
    lang,
    title: t.join.confirmTitle,
    org: ORG.name,
    welcome: t.join.welcome,
    numberLabel: t.join.number,
    joinedLabel: t.join.joinedOn,
    nameLabel: `${t.join.first} / ${t.join.last}`,
    emailLabel: t.join.email,
    townLabel: t.join.town,
    familyLabel: t.join.steps.family,
    relations: t.join.relations,
    photosLabel: t.join.photosLabel,
    photos: { yes: t.join.yes, no: t.join.no },
    newsletterLabel: t.join.newsletterLabel,
    yesNo: { yes: t.join.yes, no: t.join.no },
    consentLine: t.join.consentLine,
    demoNote: t.join.demoNote,
    footer: t.join.footer,
    joined: fmtDate(m.joined, lang),
  };
}

function Confirmation({ s, m, t, lang, onMembers, onAgain }: { s: SamajState; m: Member; t: Copy; lang: Lang; onMembers: () => void; onAgain: () => void }) {
  const print = () => {
    document.body.classList.add('sj-printing');
    const done = () => {
      document.body.classList.remove('sj-printing');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  };
  const download = () => {
    const html = confirmationHtml(m, confirmText(t, lang, m), emblemSvg({ ...s.logo, look: s.look, idPrefix: 'doc' }, 84));
    saveFile(`saathi-samaj-${m.number.toLowerCase()}.html`, html, 'text/html;charset=utf-8');
  };
  return (
    <div className="sj-done" aria-live="polite">
      <div className="sj-cert">
        <div className="sj-cert-head">
          <Emblem s={s} prefix="cert" size={72} />
          <div>
            <p className="sj-kicker">{t.join.confirmTitle}</p>
            <h3>{t.join.doneTitle(m.app.first)}</h3>
          </div>
        </div>
        <p>{t.join.doneText}</p>
        <dl className="sj-cert-dl">
          <div>
            <dt>{t.join.number}</dt>
            <dd className="sj-cert-num">{m.number}</dd>
          </div>
          <div>
            <dt>{t.join.joinedOn}</dt>
            <dd>{fmtDate(m.joined, lang)}</dd>
          </div>
          <div>
            <dt>{t.join.steps.personal}</dt>
            <dd>
              {m.app.first} {m.app.last} · {m.app.town}
            </dd>
          </div>
          {m.app.family.length > 0 && (
            <div>
              <dt>{t.join.steps.family}</dt>
              <dd>{m.app.family.map((f) => `${f.name} (${t.join.relations[f.relation]})`).join(', ')}</dd>
            </div>
          )}
        </dl>
        <p className="sj-cert-demo">{t.join.demoNote}</p>
      </div>
      <p className="sj-nothing">
        <Icon name="check" />
        {t.join.nothingSent}
      </p>
      <div className="sj-done-ctas">
        <button type="button" className="sj-btn" onClick={print} data-act="print">
          <Icon name="print" />
          {t.join.print}
        </button>
        <button type="button" className="sj-btn" onClick={download} data-act="download-confirmation">
          <Icon name="download" />
          {t.join.download}
        </button>
        <button type="button" className="sj-btn sj-btn-main" onClick={onMembers} data-act="to-members">
          {t.join.toMembers}
        </button>
      </div>
      <button type="button" className="sj-link-btn" onClick={onAgain}>
        {t.join.again}
      </button>
    </div>
  );
}

// ---------- members' area ----------

function Members({ s, t, lang, now, update, onDoc }: { s: SamajState; t: Copy; lang: Lang; now: Date; update: (fn: (s: SamajState) => SamajState) => void; onDoc: (d: DocId) => void }) {
  const [changing, setChanging] = useState(false);
  const [pick, setPick] = useState<PollOption | null>(null);
  if (!s.loggedIn) {
    return (
      <section className="sj-section" id="sj-members" aria-labelledby="sj-members-h">
        <div className="sj-wrap">
          <SectionHead id="sj-members-h" title={t.members.title} sub={t.members.sub} />
          <div className="sj-locked">
            <span className="sj-locked-icon" aria-hidden="true">
              <Icon name="lock" />
            </span>
            <div>
              <h3>{t.members.lockedTitle}</h3>
              <p>{t.members.lockedText}</p>
              <button type="button" className="sj-btn sj-btn-main" onClick={() => update((x) => ({ ...x, loggedIn: true }))} data-act="login">
                {t.members.login}
              </button>
              <p className="sj-opt">{t.members.loginNote}</p>
            </div>
            <div className="sj-locked-peek" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>
    );
  }
  const first = s.member?.app.first ?? t.members.demoName;
  const fullName = s.member ? `${s.member.app.first} ${s.member.app.last}` : t.members.demoName;
  const number = s.member?.number ?? DEMO_NUMBER;
  const since = s.member ? Number(s.member.joined.slice(0, 4)) : 2019;
  const today = isoDate(now);
  const upcoming = EVENTS.filter((e) => e.date >= today).slice(0, 3);
  const counts = pollCounts(s.vote);
  const results = pollResults(counts);
  const total = results.reduce((a, r) => a + r.count, 0);
  const showVote = !s.vote || changing;
  return (
    <section className="sj-section" id="sj-members" aria-labelledby="sj-members-h">
      <div className="sj-wrap">
        <div className="sj-members-top">
          <SectionHead id="sj-members-h" title={t.members.title} sub={t.members.hello(first)} />
          <button type="button" className="sj-btn" onClick={() => update((x) => ({ ...x, loggedIn: false }))} data-act="logout">
            {t.members.logout}
          </button>
        </div>
        <div className="sj-members-grid">
          <div className="sj-card-col">
            <div className="sj-mcard">
              <div className="sj-mcard-top">
                <Emblem s={s} prefix="card" size={44} />
                <div>
                  <p className="sj-mcard-org">{t.orgName}</p>
                  <p className="sj-mcard-kind">{t.members.card}</p>
                </div>
              </div>
              <div className="sj-mcard-body">
                <div>
                  <p className="sj-mcard-name">{fullName}</p>
                  <p className="sj-mcard-num">{number}</p>
                  <p className="sj-mcard-since">{t.members.since(num(since, lang))}</p>
                </div>
                <Qr text={`DEMO MEMBER CARD | ${ORG.name} | ${number}`} label={t.members.qrLabel} />
              </div>
            </div>
            <p className="sj-opt">{t.members.cardHint}</p>

            <div className="sj-panel">
              <h3 className="sj-h3">{t.members.docsTitle}</h3>
              <ul className="sj-docs">
                {DOCS.map((d) => (
                  <li key={d}>
                    <Icon name="doc" />
                    <div>
                      <p className="sj-doc-t">{t.members.docs[d].title}</p>
                      <p className="sj-opt">{t.members.docs[d].meta}</p>
                    </div>
                    <button type="button" className="sj-btn sj-btn-sm" onClick={() => onDoc(d)} data-doc={d}>
                      {t.members.open}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="sj-panel">
            <h3 className="sj-h3">{t.members.rsvpTitle}</h3>
            <ul className="sj-rsvps">
              {upcoming.map((e) => {
                const mine = s.rsvps[e.id];
                const people = mine?.people ?? 1;
                return (
                  <li key={e.id} className="sj-rsvp" data-event={e.id}>
                    <p className="sj-rsvp-when">{fmtDate(e.date, lang, true)}</p>
                    <p className="sj-rsvp-t">{t.ev.items[e.id].title}</p>
                    <p className="sj-opt">{t.members.going(num(goingCount(e, mine), lang))}</p>
                    <div className="sj-seg sj-seg-sm" role="group" aria-label={t.ev.items[e.id].title}>
                      {RSVPS.map((r: Rsvp) => (
                        <button key={r} type="button" className={mine?.answer === r ? 'is-on' : ''} aria-pressed={mine?.answer === r} onClick={() => update((x) => setRsvp(x, e.id, r, people))} data-rsvp={r}>
                          {t.members.rsvp[r]}
                        </button>
                      ))}
                    </div>
                    {mine?.answer === 'yes' && (
                      <div className="sj-stepper">
                        <span>{t.members.people}</span>
                        <button type="button" className="sj-icon-btn" disabled={people <= 1} onClick={() => update((x) => setRsvp(x, e.id, 'yes', people - 1))} aria-label={t.members.fewer}>
                          −
                        </button>
                        <output aria-live="polite">{num(people, lang)}</output>
                        <button type="button" className="sj-icon-btn" disabled={people >= PEOPLE_MAX} onClick={() => update((x) => setRsvp(x, e.id, 'yes', people + 1))} aria-label={t.members.more} data-act="more-people">
                          +
                        </button>
                      </div>
                    )}
                    {mine && <p className="sj-rsvp-mine">{t.members.yourAnswer[mine.answer](num(mine.people, lang))}</p>}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="sj-panel sj-poll" aria-labelledby="sj-poll-h">
            <p className="sj-kicker">{t.members.pollTitle}</p>
            <h3 id="sj-poll-h" className="sj-h3">
              {t.members.pollQ}
            </h3>
            {showVote ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const o = pick ?? s.vote;
                  if (!o) return;
                  update((x) => castVote(x, o));
                  setChanging(false);
                }}
              >
                <fieldset className="sj-radios">
                  <legend className="sj-sr">{t.members.pollQ}</legend>
                  {POLL_OPTIONS.map((o) => (
                    <label key={o} className="sj-radio">
                      <input type="radio" name="sj-poll" value={o} checked={(pick ?? s.vote) === o} onChange={() => setPick(o)} />
                      <span>{t.members.pollOptions[o]}</span>
                    </label>
                  ))}
                </fieldset>
                <button type="submit" className="sj-btn sj-btn-main" disabled={!(pick ?? s.vote)} data-act="vote">
                  {t.members.pollVote}
                </button>
                <p className="sj-opt">{t.members.pollHint}</p>
              </form>
            ) : (
              <div>
                <ul className="sj-bars">
                  {results.map((r) => (
                    <li key={r.id} className={r.id === s.vote ? 'is-mine' : ''}>
                      <div className="sj-bar-top">
                        <span>
                          {t.members.pollOptions[r.id]}
                          {r.id === s.vote && <Icon name="check" />}
                        </span>
                        <span>{num(r.pct, lang)}%</span>
                      </div>
                      <div className="sj-bar" aria-hidden="true">
                        <span style={{ width: `${r.pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="sj-opt">
                  {t.members.pollVotes(num(total, lang))} · {t.members.pollLeader(t.members.pollOptions[pollLeader(counts)])}
                </p>
                <p className="sj-poll-voted">{t.members.pollVoted(t.members.pollOptions[s.vote!])}</p>
                <button type="button" className="sj-link-btn" onClick={() => (setPick(s.vote), setChanging(true))} data-act="change-vote">
                  {t.members.pollChange}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function docText(d: DocId, t: Copy, lang: Lang): string[] {
  if (d !== 'programme') return t.members.docs[d].body;
  return [
    ...EVENTS.map((e) => `${fmtDate(e.date, lang)} · ${fmtTimeRange(e.start, e.end, lang)} — ${t.ev.items[e.id].title} (${t.ev.places[e.place]})`),
    `${t.ev.schoolLine}: ${t.ev.schoolWhen}`,
  ];
}

// ---------- gallery & contact ----------

function Gallery({ t, onOpen }: { t: Copy; onOpen: (i: number) => void }) {
  return (
    <section className="sj-section sj-alt" id="sj-gallery" aria-labelledby="sj-gallery-h">
      <div className="sj-wrap">
        <SectionHead id="sj-gallery-h" title={t.gallery.title} sub={t.gallery.sub} />
        <ul className="sj-gallery">
          {GALLERY.map((g, i) => (
            <li key={g} className={i === 0 ? 'is-big' : i === 5 ? 'is-wide' : undefined}>
              <button type="button" onClick={() => onOpen(i)} data-gallery={g}>
                <Scene id={g} />
                <span className="sj-gal-cap">{t.gallery.items[g]}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="sj-opt">{t.gallery.drawn}</p>
      </div>
    </section>
  );
}

function Contact({ t }: { t: Copy }) {
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ name: '', email: '', message: '' });
  return (
    <section className="sj-section" id="sj-contact" aria-labelledby="sj-contact-h">
      <div className="sj-wrap">
        <SectionHead id="sj-contact-h" title={t.contact.title} sub={t.contact.sub} />
        <div className="sj-contact-grid">
          <form
            className="sj-form"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <div className="sj-field">
              <label htmlFor="sj-c-name">{t.contact.name}</label>
              <input id="sj-c-name" value={f.name} required maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="sj-field">
              <label htmlFor="sj-c-email">{t.contact.email}</label>
              <input id="sj-c-email" type="email" value={f.email} required maxLength={120} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div className="sj-field">
              <label htmlFor="sj-c-msg">{t.contact.message}</label>
              <textarea id="sj-c-msg" rows={4} value={f.message} required maxLength={2000} onChange={(e) => setF({ ...f, message: e.target.value })} />
            </div>
            <button type="submit" className="sj-btn sj-btn-main">
              {t.contact.send}
            </button>
            {sent && (
              <p className="sj-nothing" role="status">
                <Icon name="check" />
                {t.contact.sent}
              </p>
            )}
          </form>
          <div className="sj-contact-side">
            <div className="sj-map" aria-hidden="true">
              <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
                <rect width="320" height="180" className="m-bg" />
                <path d="M-10 120 C60 100 120 140 190 112 S300 70 340 90" className="m-river" />
                <path d="M0 40 H320 M0 150 H320 M60 0 V180 M200 0 V180 M260 0 V180" className="m-road" />
                <path d="M110 0 L150 180" className="m-road" />
                <rect x="210" y="52" width="40" height="30" rx="3" className="m-block" />
                <rect x="70" y="52" width="36" height="22" rx="3" className="m-block" />
                <g transform="translate(160 66)">
                  <path d="M0 18 C-12 6 -12 -2 -12 -6 A12 12 0 0 1 12 -6 C12 -2 12 6 0 18 Z" className="m-pin" />
                  <circle cy="-6" r="4.5" fill="#fff" />
                </g>
              </svg>
            </div>
            <h3 className="sj-h3">{t.contact.where}</h3>
            <p>
              <Icon name="pin" />
              <span>{t.contact.whereText}</span>
            </p>
            <p>
              <Icon name="mail" />
              <span>
                {t.contact.mailUs}: <span className="sj-mono">{EMAIL}</span>
              </span>
            </p>
            <div className="sj-impressum">
              <p className="sj-example">{t.contact.example}</p>
              <h3 className="sj-h3">{t.contact.impressum}</h3>
              {t.contact.impressumLines.map((l) => (
                <p key={l}>{l}</p>
              ))}
              <p className="sj-opt">{t.contact.privacy}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- logo maker ----------

function LogoMaker({ s, t, update, onClose }: { s: SamajState; t: Copy; update: (fn: (s: SamajState) => SamajState) => void; onClose: () => void }) {
  const [initials, setInitials] = useState(s.logo.initials);
  const [ring, setRing] = useState(s.logo.ring);
  const setLogo = (patch: Partial<SamajState['logo']>) => update((x) => normalize({ ...x, logo: { ...x.logo, ...patch } }, x.lang));
  return (
    <Modal title={t.logo.title} onClose={onClose} labelId="sj-logo-h" wide closeLabel={t.close}>
      <div className="sj-logo">
        <div className="sj-logo-preview">
          <Emblem s={s} prefix="maker" size={200} />
          <p className="sj-opt">{t.logo.colours}</p>
          <div className="sj-looks sj-looks-sm" role="radiogroup" aria-label={t.kit.look}>
            {LOOK_IDS.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={s.look === id} className={`sj-look${s.look === id ? ' is-on' : ''}`} onClick={() => update((x) => ({ ...x, look: id }))}>
                <span className="sj-look-sw" aria-hidden="true">
                  <span style={{ background: LOOKS[id].colors.primary }} />
                  <span style={{ background: LOOKS[id].colors.accent }} />
                </span>
                {t.kit.looks[id]}
              </button>
            ))}
          </div>
        </div>
        <div className="sj-logo-form">
          <div className="sj-field">
            <label htmlFor="sj-logo-ini">{t.logo.initials}</label>
            <div className="sj-row">
              <input
                id="sj-logo-ini"
                value={initials}
                maxLength={12}
                onChange={(e) => {
                  setInitials(e.target.value);
                  setLogo({ initials: e.target.value || s.logo.initials });
                }}
                onBlur={() => setInitials(s.logo.initials)}
              />
              <button
                type="button"
                className="sj-btn sj-btn-sm"
                onClick={() => {
                  const i = initialsFrom(ORG.name);
                  setInitials(i);
                  setLogo({ initials: i, ring: `${ORG.name} · ${ORG.founded}` });
                  setRing(`${ORG.name} · ${ORG.founded}`);
                }}
              >
                {t.logo.fromName}
              </button>
            </div>
            <p className="sj-opt">{t.logo.initialsHint}</p>
          </div>
          <div className="sj-field">
            <label htmlFor="sj-logo-ring">{t.logo.ring}</label>
            <input
              id="sj-logo-ring"
              value={ring}
              maxLength={60}
              onChange={(e) => {
                setRing(e.target.value);
                setLogo({ ring: e.target.value });
              }}
            />
          </div>
          <fieldset className="sj-shapes">
            <legend>{t.logo.shape}</legend>
            {EMBLEM_SHAPES.map((sh: EmblemShape) => (
              <label key={sh} className={`sj-shape${s.logo.shape === sh ? ' is-on' : ''}`}>
                <input type="radio" name="sj-shape" value={sh} checked={s.logo.shape === sh} onChange={() => setLogo({ shape: sh })} />
                <span>{t.logo.shapes[sh]}</span>
              </label>
            ))}
          </fieldset>
          <div className="sj-logo-ctas">
            <button
              type="button"
              className="sj-btn"
              onClick={() => saveFile(`logo-${s.logo.initials.toLowerCase() || 'samaj'}.svg`, emblemSvg({ ...s.logo, look: s.look, idPrefix: 'file' }, 600), 'image/svg+xml')}
              data-act="logo-download"
            >
              <Icon name="download" />
              {t.logo.download}
            </button>
            <button type="button" className="sj-btn sj-btn-main" onClick={onClose} data-act="logo-done">
              {t.logo.done}
            </button>
          </div>
          <p className="sj-opt">{t.logo.saved}</p>
        </div>
      </div>
    </Modal>
  );
}

// ---------- the page ----------

export default function SamajSite({ initialLang }: { initialLang: Lang }) {
  const [s, setS] = useState<SamajState>(() => seedState(initialLang));
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(FIRST_NOW);
  const [month, setMonth] = useState(() => {
    const n = nextEvent(FIRST_NOW);
    return n ? { y: Number(n.date.slice(0, 4)), m: Number(n.date.slice(5, 7)) - 1 } : { y: 2027, m: 0 };
  });
  const [view, setView] = useState<'month' | 'list'>('month');
  const [picked, setPicked] = useState<string | null>(null);
  const [news, setNews] = useState<NewsId | null>(null);
  const [logoOpen, setLogoOpen] = useState(false);
  const [doc, setDoc] = useState<DocId | null>(null);
  const [gal, setGal] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [active, setActive] = useState('sj-home');
  const [resetKey, setResetKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  const lang = s.lang;
  const t = COPY[lang];

  const update = useCallback((fn: (x: SamajState) => SamajState) => {
    setS((x) => {
      const n = fn(x);
      if (loaded.current) saveRaw(n);
      return n;
    });
  }, []);

  useEffect(() => {
    const raw = loadRaw();
    const st = raw ? normalize(raw, initialLang) : seedState(initialLang);
    loaded.current = true;
    setS(st);
    const n = new Date();
    setNow(n);
    const ne = nextEvent(n);
    if (ne) setMonth({ y: Number(ne.date.slice(0, 4)), m: Number(ne.date.slice(5, 7)) - 1 });
    setMounted(true);
    // Sit the sticky section nav under the site's own sticky header.
    const hdr = document.querySelector('.site-header');
    const setTop = () => rootRef.current?.style.setProperty('--sj-top', `${Math.round(hdr?.getBoundingClientRect().height ?? 0)}px`);
    setTop();
    window.addEventListener('resize', setTop);
    return () => window.removeEventListener('resize', setTop);
  }, [initialLang]);

  // Which section is on screen, for the nav highlight.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const ids = NAV.map((n) => n.id);
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        const best = ids.find((id) => (seen.get(id) ?? 0) > 0);
        if (best) setActive(best);
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.01] }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [s.loggedIn, s.member, resetKey]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  const style = useMemo(() => lookVars(s.look) as CSSProperties, [s.look]);

  const reset = () => {
    saveRaw(null);
    const fresh = seedState(lang);
    setS(fresh);
    saveRaw(fresh);
    setView('month');
    setPicked(null);
    setNews(null);
    setResetKey((k) => k + 1);
    const ne = nextEvent(now);
    if (ne) setMonth({ y: Number(ne.date.slice(0, 4)), m: Number(ne.date.slice(5, 7)) - 1 });
    setToast(t.kit.resetDone);
  };

  const showEvent = (e: EventDef) => {
    setView('month');
    setMonth({ y: Number(e.date.slice(0, 4)), m: Number(e.date.slice(5, 7)) - 1 });
    setPicked(e.date);
    requestAnimationFrame(() => goTo('sj-programme'));
  };

  return (
    <div
      ref={rootRef}
      className={`sj sj-look-${s.look}${LOOKS[s.look].serif ? ' is-serif' : ''}${LOOKS[s.look].dark ? ' is-dark' : ''}`}
      style={style}
      lang={lang}
      translate="no"
      data-ready={mounted ? '1' : undefined}
    >
      <KitBar s={s} t={t} onLook={(l) => update((x) => ({ ...x, look: l }))} onLogo={() => setLogoOpen(true)} onReset={reset} />
      <SiteHeader s={s} t={t} onLang={(l) => update((x) => ({ ...x, lang: l }))} active={active} />
      <Hero s={s} t={t} lang={lang} now={now} mounted={mounted} onEvent={showEvent} />
      <Pillars t={t} />
      <Programme t={t} lang={lang} month={month} setMonth={setMonth} view={view} setView={setView} picked={picked} setPicked={setPicked} now={now} />
      <News t={t} lang={lang} open={news} setOpen={setNews} />
      <About t={t} lang={lang} />
      <JoinSection
        key={`join-${resetKey}`}
        s={s}
        t={t}
        lang={lang}
        now={now}
        update={update}
        onJoined={(m) => {
          update((x) => ({ ...x, member: m }));
          requestAnimationFrame(() => goTo('sj-join'));
        }}
        onMembers={() => {
          update((x) => ({ ...x, loggedIn: true }));
          requestAnimationFrame(() => goTo('sj-members'));
        }}
        onAgain={() => update((x) => ({ ...x, member: null, loggedIn: false, step: 'personal' }))}
      />
      <Members key={`members-${resetKey}`} s={s} t={t} lang={lang} now={now} update={update} onDoc={setDoc} />
      <Gallery t={t} onOpen={setGal} />
      <Contact key={`contact-${resetKey}`} t={t} />

      <footer className="sj-footer">
        <div className="sj-wrap sj-footer-inner">
          <Emblem s={s} prefix="foot" size={40} />
          <div>
            <p>{t.footer.line}</p>
            <p className="sj-opt">{t.footer.example}</p>
          </div>
          <a href="#sj-home" onClick={(e) => (e.preventDefault(), goTo('sj-home'))}>
            {t.footer.top}
          </a>
        </div>
      </footer>

      {logoOpen && <LogoMaker s={s} t={t} update={update} onClose={() => setLogoOpen(false)} />}
      {doc && (
        <Modal title={t.members.docs[doc].title} onClose={() => setDoc(null)} labelId="sj-doc-h" closeLabel={t.close}>
          <p className="sj-opt">{t.members.docs[doc].meta}</p>
          <div className="sj-doc-body">
            {docText(doc, t, lang).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <button
            type="button"
            className="sj-btn"
            onClick={() => saveFile(`saathi-samaj-${doc}.txt`, [t.members.docs[doc].title, t.members.docs[doc].meta, '', ...docText(doc, t, lang)].join('\n'), 'text/plain;charset=utf-8')}
          >
            <Icon name="download" />
            {t.members.downloadTxt}
          </button>
        </Modal>
      )}
      {gal !== null && (
        <Modal title={t.gallery.items[GALLERY[gal] as GalleryId]} onClose={() => setGal(null)} labelId="sj-gal-h" wide closeLabel={t.gallery.close}>
          <div className="sj-lightbox">
            <Scene id={GALLERY[gal]} label={t.gallery.items[GALLERY[gal]]} />
            <div className="sj-lb-nav">
              <button type="button" className="sj-icon-btn" onClick={() => setGal((gal + GALLERY.length - 1) % GALLERY.length)} aria-label={t.gallery.prev}>
                <Icon name="chev-l" />
              </button>
              <span>
                {num(gal + 1, lang)} / {num(GALLERY.length, lang)}
              </span>
              <button type="button" className="sj-icon-btn" onClick={() => setGal((gal + 1) % GALLERY.length)} aria-label={t.gallery.next} data-act="gal-next">
                <Icon name="chev-r" />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="sj-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
