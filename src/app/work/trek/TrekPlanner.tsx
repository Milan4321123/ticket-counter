'use client';

// "Yatri Treks" — a made-up Nepal travel agency's trek & trip planner (studio
// demo #17). Pick a ready trip (Everest Base Camp, Annapurna Base Camp, Poon
// Hill, Langtang, a family visit with Chitwan and Pokhara, a Lumbini
// pilgrimage) or build your own; the days are cards you can reorder, drop or
// double; the route is drawn on a hand-made map of Nepal; the altitude
// profile flags days by a simple acclimatisation rule (general guidance, not
// medical advice); the season strip, packing list and permits follow the trip.
// The enquiry is a summary on screen — nothing is sent. Printable, and a .ics
// with one event per day. One localStorage key; the root is translate="no" so
// nothing typed here reaches the site's translator.

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { setSiteLangCookie } from '@/components/studio/siteLang';
import MapView from './MapView';
import Profile from './Profile';
import {
  BRAND,
  COPY,
  FESTIVAL_TEXT,
  LANGS,
  MODE_NAME,
  PACK_GROUP_NAME,
  PACK_TEXT,
  PERMIT_TEXT,
  REGION_NAME,
  STOP_NAME,
  TRIP_TEXT,
  count,
  dateLabel,
  dayFacts,
  dayHighlight,
  dayTitle,
  enquiryText,
  icsEvents,
  num,
  tripName,
  warningText,
  type Lang,
} from './content';
import {
  ADDABLE,
  MAX_DAYS,
  MONSOON,
  PACK_GROUPS,
  REGIONS,
  STOPS,
  STORE_KEY,
  TRIP_IDS,
  addDays,
  addRestAfter,
  addStop,
  altitudeWarnings,
  bestMonths,
  cleanSaved,
  dayInfos,
  defaultStart,
  emptySaved,
  festivalsFor,
  icsCalendar,
  isDate,
  monthOf,
  moveDay,
  packingList,
  permitsFor,
  removeDay,
  seasonScores,
  totals,
  tripDays,
  type Day,
  type PackId,
  type Saved,
  type StopId,
  type TripId,
} from './trek';

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? cleanSaved(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function writeSaved(s: Saved) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private window: it just forgets */
  }
}
function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const set = () => setReduce(mq.matches);
    set();
    mq.addEventListener?.('change', set);
    return () => mq.removeEventListener?.('change', set);
  }, []);
  return reduce;
}

let keySeq = 0;
const newKey = () => `u-${Date.now().toString(36)}-${(keySeq++).toString(36)}`;

export default function TrekPlanner({ initialLang }: { initialLang: Lang }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [lang, setLangState] = useState<Lang>(initialLang);
  const t = COPY[lang];
  const [saved, setSaved] = useState<Saved>(emptySaved);
  const [today, setToday] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState('ebc');
  const [focus, setFocus] = useState<{ stop: StopId; n: number } | null>(null);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<{ id: number; text: string } | null>(null);
  const [addPick, setAddPick] = useState<StopId>('pkr');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', contact: '', note: '' });
  const [summary, setSummary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const daysRef = useRef<HTMLOListElement>(null);

  const commit = useCallback((fn: (s: Saved) => Saved) => {
    setSaved((s) => {
      const n = fn(s);
      writeSaved(n);
      return n;
    });
  }, []);

  useEffect(() => {
    const s = readSaved();
    if (s) {
      setSaved(s);
      setFitKey(`${s.base}-load`);
    }
    setToday(defaultStart(new Date()));
    setMounted(true);
  }, []);

  const toastTimer = useRef<number | undefined>(undefined);
  const toast = useCallback((text: string) => {
    setToastMsg({ id: Date.now(), text });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  // ----- derived -----
  const base = saved.base;
  const days: Day[] = useMemo(() => saved.days ?? (base === 'custom' ? [{ k: 'c-ktm', stop: 'ktm' }] : tripDays(base)), [saved.days, base]);
  const edited = saved.days !== null && base !== 'custom';
  const infos = useMemo(() => dayInfos(days), [days]);
  const tot = useMemo(() => totals(days), [days]);
  const warnings = useMemo(() => altitudeWarnings(days), [days]);
  const start = saved.start ?? today;
  const month = monthOf(start);
  const scores = useMemo(() => seasonScores(days), [days]);
  const best = bestMonths(scores);
  const fests = useMemo(() => festivalsFor(days), [days]);
  const pack = useMemo(() => packingList({ days, month }), [days, month]);
  const permits = useMemo(() => permitsFor(days), [days]);
  const label = tripName(base, edited, lang);
  const packedSet = new Set(saved.packed);
  const packedN = pack.filter((p) => packedSet.has(p.id)).length;
  const warnByDay = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const w of warnings) m.set(w.day, [...(m.get(w.day) ?? []), warningText(w, days, lang)]);
    return m;
  }, [warnings, days, lang]);
  const regionsOn = REGIONS.filter((r) => tot.regions[r] > 0);

  // ----- language -----
  const setLang = (l: Lang) => {
    setLangState(l);
    setSiteLangCookie(l);
    try {
      document.documentElement.lang = l;
    } catch {
      /* ignore */
    }
    router.refresh();
  };

  // ----- trips -----
  const pickTrip = (id: TripId | 'custom') => {
    commit((s) => ({
      ...s,
      base: id,
      days: id === 'custom' ? [{ k: newKey(), stop: 'ktm' }] : null,
    }));
    setFitKey(`${id}-${Date.now()}`);
    setActiveDay(null);
    setSummary(null);
    toast(t.tripLoaded(TRIP_TEXT[id].name[lang]));
  };
  const setDays = (next: Day[]) => commit((s) => ({ ...s, days: next }));
  const backToOriginal = () => {
    commit((s) => ({ ...s, days: null }));
    setFitKey(`${base}-${Date.now()}`);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= days.length) return;
    setDays(moveDay(days, from, to));
    setActiveDay(to);
    toast(t.moved(num(from + 1, lang), num(to + 1, lang)));
    // keep the keyboard on the moved card's same button
    requestAnimationFrame(() => {
      const btn = daysRef.current?.querySelector<HTMLButtonElement>(`[data-day="${to}"][data-dir="${to > from ? 'down' : 'up'}"]`);
      (btn && !btn.disabled ? btn : daysRef.current?.querySelector<HTMLElement>(`[data-day-card="${to}"]`))?.focus();
    });
  };
  const remove = (i: number) => {
    if (days.length <= 1) return;
    setDays(removeDay(days, i));
    setActiveDay(null);
    toast(t.removed(num(i + 1, lang)));
  };
  const another = (i: number) => {
    if (days.length >= MAX_DAYS) return toast(t.maxDays);
    setDays(addRestAfter(days, i, newKey()));
    toast(t.restAdded(STOP_NAME[days[i].stop][lang]));
  };
  const add = (stop: StopId) => {
    if (days.length >= MAX_DAYS) return toast(t.maxDays);
    const next = addStop(days, stop, newKey());
    setDays(next);
    setActiveDay(next.length - 1);
    setFocus({ stop, n: Date.now() });
    toast(t.added(STOP_NAME[stop][lang], num(next.length, lang)));
  };
  const showDay = (i: number) => {
    setActiveDay(i);
    setFocus({ stop: days[i].stop, n: Date.now() });
  };

  // ----- packing -----
  const togglePack = (id: PackId) =>
    commit((s) => ({
      ...s,
      packed: s.packed.includes(id) ? s.packed.filter((x) => x !== id) : [...s.packed, id],
    }));

  // ----- downloads -----
  const downloadIcs = () => {
    const from = isDate(start) ? start : defaultStart(new Date());
    const text = icsCalendar(icsEvents(days, from, lang), `${BRAND[lang]} · ${label}`, new Date());
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yatri-treks-${base}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(t.icsDone);
  };
  const print = () => {
    try {
      window.print();
    } catch {
      /* no print dialog here */
    }
  };

  // ----- enquiry -----
  const buildEnquiry = (e: React.FormEvent) => {
    e.preventDefault();
    setSummary(enquiryText(days, label, start, { ...form, people: saved.people }, warnings, lang));
    setCopied(false);
    requestAnimationFrame(() => summaryRef.current?.focus());
  };
  const copySummary = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  // ----- reset -----
  const reset = () => {
    commit(() => emptySaved());
    setForm({ name: '', contact: '', note: '' });
    setSummary(null);
    setActiveDay(null);
    setFitKey(`reset-${Date.now()}`);
    toast(t.resetDone);
  };

  // ----- drag to reorder (mouse); the arrows do the same for keyboard and touch -----
  const onDrop = (to: number) => {
    if (dragFrom !== null && dragFrom !== to) move(dragFrom, to);
    setDragFrom(null);
    setDragOver(null);
  };

  const monthName = (m: number) => t.months[m - 1];
  const startScore = scores[month - 1];

  return (
    <div className={`tk tk-lang-${lang}`} lang={lang} translate="no">
      <header className="tk-top">
        <div className="tk-brand">
          <Mark />
          <div>
            <h1 className="tk-h1">{BRAND[lang]}</h1>
            <p className="tk-tagline">{t.tagline}</p>
          </div>
        </div>
        <div className="tk-langs" role="group" aria-label={t.langLabel}>
          {LANGS.map((x) => (
            <button key={x.id} type="button" aria-pressed={lang === x.id} onClick={() => setLang(x.id)} lang={x.id} aria-label={x.label}>
              {x.short}
            </button>
          ))}
        </div>
      </header>
      <p className="tk-madeup">{t.madeUp}</p>

      {/* ---------- trips ---------- */}
      <section className="tk-trips" aria-labelledby="tk-trips-h">
        <h2 id="tk-trips-h">{t.pickH}</h2>
        <div className="tk-trip-list" role="group" aria-label={t.tripsLabel}>
          {[...TRIP_IDS, 'custom' as const].map((id) => (
            <button key={id} type="button" className={`tk-trip${id === 'custom' ? ' is-custom' : ''}`} aria-pressed={base === id} onClick={() => pickTrip(id)}>
              <span className="tk-trip-name">{TRIP_TEXT[id].name[lang]}</span>
              <span className="tk-trip-days">{id === 'custom' ? '+' : t.daysN(num(tripDays(id).length, lang))}</span>
              <span className="tk-trip-blurb">{TRIP_TEXT[id].blurb[lang]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="tk-sum" aria-label={label}>
        <div className="tk-sum-head">
          <p className="tk-sum-name">{label}</p>
          {edited && (
            <button type="button" className="tk-btn tk-btn-sm" onClick={backToOriginal}>
              {t.backToOriginal}
            </button>
          )}
        </div>
        <dl className="tk-sum-stats">
          <div>
            <dt>{t.sum.days}</dt>
            <dd>{num(tot.days, lang)}</dd>
          </div>
          <div>
            <dt>{t.sum.walkDays}</dt>
            <dd>{num(tot.walkDays, lang)}</dd>
          </div>
          <div>
            <dt>{t.sum.onFoot}</dt>
            <dd>{count(tot.walkKm, lang)}</dd>
          </div>
          <div>
            <dt>{t.sum.hours}</dt>
            <dd>{count(tot.walkH, lang)}</dd>
          </div>
          <div>
            <dt>{t.sum.maxSleep}</dt>
            <dd>{count(tot.maxSleep, lang)} m</dd>
          </div>
          <div>
            <dt>{t.sum.maxTop}</dt>
            <dd>{count(tot.maxTop, lang)} m</dd>
          </div>
        </dl>
      </section>

      <div className="tk-grid">
        {/* ---------- map (sticky on wide screens) ---------- */}
        <div className="tk-col-map">
          <section className="tk-card" aria-labelledby="tk-map-h">
            <h2 id="tk-map-h">{t.mapH}</h2>
            <MapView lang={lang} infos={infos} fitKey={fitKey} focus={focus} activeDay={activeDay} reduce={reduce} tripLabel={label} canAdd onAdd={add} />
          </section>
        </div>

        <div className="tk-col-days">
          {/* ---------- profile + the rule ---------- */}
          <section className="tk-card" aria-labelledby="tk-prof-h">
            <h2 id="tk-prof-h">{t.profileH}</h2>
            <Profile lang={lang} infos={infos} warnings={warnings} tripLabel={label} active={activeDay} onPick={showDay} />
            <div className="tk-rule" aria-labelledby="tk-rule-h">
              <h3 id="tk-rule-h">
                {t.ruleH} <span className="tk-rule-tag">{t.ruleTag}</span>
              </h3>
              <ol className="tk-rule-list">
                {t.rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
              {warnings.length ? (
                <ul className="tk-warn-list" aria-live="polite">
                  {warnings.map((w, i) => (
                    <li key={`${w.kind}-${w.day}-${i}`}>
                      <button type="button" className="tk-linkish" onClick={() => showDay(w.day)}>
                        {warningText(w, days, lang)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tk-ok" aria-live="polite">
                  {t.ruleOk}
                </p>
              )}
              <p className="tk-feel">{t.feelBad}</p>
            </div>
          </section>

          {/* ---------- days ---------- */}
          <section className="tk-card" aria-labelledby="tk-days-h">
            <h2 id="tk-days-h">{t.daysH}</h2>
            <form
              className="tk-add"
              onSubmit={(e) => {
                e.preventDefault();
                add(addPick);
              }}
            >
              <label htmlFor="tk-add-sel" className="tk-add-label">
                {t.addH}
              </label>
              <div className="tk-add-row">
                <select id="tk-add-sel" value={addPick} onChange={(e) => setAddPick(e.target.value as StopId)}>
                  {REGIONS.map((r) => (
                    <optgroup key={r} label={REGION_NAME[r][lang]}>
                      {ADDABLE.filter((id) => STOPS[id].region === r).map((id) => (
                        <option key={id} value={id}>
                          {STOP_NAME[id][lang]} · {count(STOPS[id].alt, lang)} m
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button type="submit" className="tk-btn tk-btn-main">
                  {t.addBtn(num(days.length + 1, lang))}
                </button>
              </div>
              <p className="tk-add-hint">{t.addHint}</p>
            </form>

            <ol className="tk-days" ref={daysRef}>
              {infos.map((x, i) => {
                const d = days[i];
                const ws = warnByDay.get(i);
                const date = isDate(start) ? dateLabel(addDays(start, i), lang) : null;
                return (
                  <li
                    key={d.k}
                    className={`tk-day tk-mode-${x.mode}${activeDay === i ? ' is-active' : ''}${ws ? ' is-flag' : ''}${dragOver === i ? ' is-over' : ''}${dragFrom === i ? ' is-dragging' : ''}`}
                    data-day-card={i}
                    tabIndex={-1}
                    onDragOver={(e) => {
                      if (dragFrom === null) return;
                      e.preventDefault();
                      setDragOver(i);
                    }}
                    onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault();
                      onDrop(i);
                    }}
                  >
                    <div className="tk-day-head">
                      <span
                        className="tk-drag"
                        draggable
                        role="img"
                        aria-label={t.drag(num(i + 1, lang))}
                        title={t.drag(num(i + 1, lang))}
                        onDragStart={(e) => {
                          setDragFrom(i);
                          e.dataTransfer.effectAllowed = 'move';
                          try {
                            e.dataTransfer.setData('text/plain', String(i));
                          } catch {
                            /* ignore */
                          }
                        }}
                        onDragEnd={() => {
                          setDragFrom(null);
                          setDragOver(null);
                        }}
                      >
                        <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
                          {[3, 8, 13].map((cy) => (
                            <g key={cy}>
                              <circle cx="2.5" cy={cy} r="1.4" />
                              <circle cx="7.5" cy={cy} r="1.4" />
                            </g>
                          ))}
                        </svg>
                      </span>
                      <p className="tk-day-n">
                        {t.dayN(num(i + 1, lang))}
                        {date && <span className="tk-day-date"> · {date}</span>}
                      </p>
                      <span className="tk-mode">{MODE_NAME[x.mode][lang]}</span>
                    </div>
                    <h3 className="tk-day-title">
                      <button type="button" className="tk-linkish" onClick={() => showDay(i)} title={t.showOnMap(STOP_NAME[x.stop][lang])}>
                        {dayTitle(x, lang)}
                        <span className="tk-sr"> — {t.showOnMap(STOP_NAME[x.stop][lang])}</span>
                      </button>
                    </h3>
                    {(x.via || x.side) && (
                      <p className="tk-day-via">
                        {x.via && `${t.viaWord} ${STOP_NAME[x.via][lang]}`}
                        {x.via && x.side && ' · '}
                        {x.side && `${t.sideWord} ${STOP_NAME[x.side][lang]} (${count(STOPS[x.side].alt, lang)} m)`}
                      </p>
                    )}
                    <ul className="tk-facts">
                      {dayFacts(x, lang).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <p className="tk-hl">{dayHighlight(x, lang)}</p>
                    {!x.authored && i > 0 && <p className="tk-est">{t.estimated}</p>}
                    {ws && (
                      <ul className="tk-day-warn">
                        {ws.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    )}
                    <div className="tk-day-tools">
                      <button
                        type="button"
                        className="tk-icon-btn"
                        data-day={i}
                        data-dir="up"
                        onClick={() => move(i, i - 1)}
                        disabled={i === 0}
                        aria-label={t.moveUp(num(i + 1, lang))}
                      >
                        <span aria-hidden="true">↑</span>
                      </button>
                      <button
                        type="button"
                        className="tk-icon-btn"
                        data-day={i}
                        data-dir="down"
                        onClick={() => move(i, i + 1)}
                        disabled={i === days.length - 1}
                        aria-label={t.moveDown(num(i + 1, lang))}
                      >
                        <span aria-hidden="true">↓</span>
                      </button>
                      <button type="button" className="tk-btn tk-btn-sm" onClick={() => another(i)} aria-label={t.anotherLabel(num(i + 1, lang))}>
                        {t.another}
                      </button>
                      <button type="button" className="tk-icon-btn tk-remove" onClick={() => remove(i)} disabled={days.length <= 1} aria-label={t.remove(num(i + 1, lang))}>
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            {days.length <= 1 && base === 'custom' && <p className="tk-empty">{t.emptyDays}</p>}
          </section>
        </div>
      </div>

      {/* ---------- season ---------- */}
      <section className="tk-card tk-season" aria-labelledby="tk-season-h">
        <div className="tk-season-head">
          <div>
            <h2 id="tk-season-h">{t.seasonH}</h2>
            <p className="tk-sub">{t.seasonSub(label)}</p>
          </div>
          <div className="tk-start">
            <label htmlFor="tk-start">{t.startLabel}</label>
            <input
              id="tk-start"
              type="date"
              value={start ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                commit((s) => ({ ...s, start: isDate(v) ? v : null }));
              }}
            />
            <label htmlFor="tk-people">{t.peopleLabel}</label>
            <select id="tk-people" value={saved.people} onChange={(e) => commit((s) => ({ ...s, people: Number(e.target.value) }))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {num(n, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ol className="tk-months">
          {scores.map((s, i) => {
            const m = i + 1;
            const f = fests.filter((x) => x.months.includes(m));
            return (
              <li key={m} className={`tk-month tk-s${s}${m === month ? ' is-start' : ''}${MONSOON.includes(m) ? ' is-monsoon' : ''}`}>
                <span className="tk-bar" aria-hidden="true">
                  <span style={{ height: `${[22, 46, 72, 100][s]}%` }} />
                </span>
                <span className="tk-m-name">
                  <span aria-hidden="true">{t.monthsShort[i]}</span>
                  <span className="tk-sr">
                    {t.months[i]}: {t.score[s]}
                    {f.length ? ` · ${f.map((x) => FESTIVAL_TEXT[x.id].name[lang]).join(', ')}` : ''}
                  </span>
                </span>
                {f.length > 0 && (
                  <span className="tk-fest-dots" aria-hidden="true">
                    {f.map((x) => (
                      <span key={x.id} className={`tk-fest-dot tk-f-${x.id}`} title={FESTIVAL_TEXT[x.id].name[lang]} />
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <ul className="tk-score-key" aria-hidden="true">
          {t.score.map((s, i) => (
            <li key={s}>
              <span className={`tk-swatch tk-s${i}`} />
              {s}
            </li>
          ))}
        </ul>
        <p className="tk-season-line">
          <strong>{t.startIs(monthName(month), t.score[startScore].toLowerCase())}</strong> {t.best(best.map(monthName).join(', '))}
        </p>
        <ul className="tk-notes">
          {(regionsOn.some((r) => r !== 'mustang') || !regionsOn.length) && <li>{t.seasonNotes.monsoon}</li>}
          {regionsOn.includes('mustang') && <li>{t.seasonNotes.mustang}</li>}
          {regionsOn.includes('lowland') && <li>{t.seasonNotes.lowland}</li>}
        </ul>
        <h3>{t.festivalsH}</h3>
        <ul className="tk-fests">
          {fests.map((f) => (
            <li key={f.id}>
              <span className={`tk-fest-dot tk-f-${f.id}`} aria-hidden="true" />
              <strong>{FESTIVAL_TEXT[f.id].name[lang]}</strong> — {FESTIVAL_TEXT[f.id].line[lang]}
            </li>
          ))}
        </ul>
        <p className="tk-sub">{t.festivalNote}</p>
      </section>

      <div className="tk-grid tk-grid-2">
        {/* ---------- packing ---------- */}
        <section className="tk-card" aria-labelledby="tk-pack-h">
          <h2 id="tk-pack-h">{t.packH}</h2>
          <p className="tk-sub">{t.packSub(monthName(month))}</p>
          <p className="tk-pack-count" aria-live="polite">
            {t.packed(num(packedN, lang), num(pack.length, lang))}
          </p>
          <div className="tk-pack-meter" aria-hidden="true">
            <span
              style={{
                width: `${pack.length ? (packedN / pack.length) * 100 : 0}%`,
              }}
            />
          </div>
          {PACK_GROUPS.map((g) => {
            const items = pack.filter((p) => p.group === g);
            if (!items.length) return null;
            return (
              <fieldset key={g} className="tk-pack-group">
                <legend>{PACK_GROUP_NAME[g][lang]}</legend>
                <ul>
                  {items.map((p) => (
                    <li key={p.id}>
                      <label>
                        <input type="checkbox" checked={packedSet.has(p.id)} onChange={() => togglePack(p.id)} />
                        <span>{PACK_TEXT[p.id][lang]}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            );
          })}
          {packedN > 0 && (
            <button type="button" className="tk-btn tk-btn-sm" onClick={() => commit((s) => ({ ...s, packed: [] }))}>
              {t.untick}
            </button>
          )}
        </section>

        {/* ---------- permits ---------- */}
        <section className="tk-card" aria-labelledby="tk-permit-h">
          <h2 id="tk-permit-h">{t.permitsH}</h2>
          <ul className="tk-permits">
            {permits.map((p) => (
              <li key={p}>
                <strong>{PERMIT_TEXT[p].name[lang]}</strong>
                <span>{PERMIT_TEXT[p].line[lang]}</span>
              </li>
            ))}
          </ul>
          <p className="tk-sub">{t.permitsNote}</p>
        </section>
      </div>

      {/* ---------- enquiry ---------- */}
      <section className="tk-card tk-enquiry" aria-labelledby="tk-enq-h">
        <h2 id="tk-enq-h">{t.enquiryH}</h2>
        <p className="tk-sub">{t.enquiryP}</p>
        {!summary ? (
          <form className="tk-form" onSubmit={buildEnquiry}>
            <div className="tk-field">
              <label htmlFor="tk-f-name">{t.fName}</label>
              <input id="tk-f-name" type="text" autoComplete="name" maxLength={80} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="tk-field">
              <label htmlFor="tk-f-contact">{t.fContact}</label>
              <input
                id="tk-f-contact"
                type="text"
                autoComplete="email"
                maxLength={120}
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              />
            </div>
            <div className="tk-field tk-field-wide">
              <label htmlFor="tk-f-note">{t.fNote}</label>
              <textarea id="tk-f-note" rows={3} maxLength={600} placeholder={t.fNoteHint} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="tk-form-row">
              <button type="submit" className="tk-btn tk-btn-main">
                {t.build}
              </button>
            </div>
          </form>
        ) : (
          <div className="tk-sent" ref={summaryRef} tabIndex={-1} role="status">
            <p className="tk-sent-h">
              <CheckIcon /> {t.sentH}
            </p>
            <p>{t.sentP}</p>
            <pre className="tk-summary">{summary}</pre>
            <div className="tk-form-row">
              <button type="button" className="tk-btn" onClick={copySummary}>
                {copied ? t.copied : t.copy}
              </button>
              <button type="button" className="tk-btn" onClick={() => setSummary(null)}>
                {t.edit}
              </button>
            </div>
          </div>
        )}
        <div className="tk-exports">
          <button type="button" className="tk-btn" onClick={print}>
            <PrintIcon /> {t.printBtn}
          </button>
          <button type="button" className="tk-btn" onClick={downloadIcs}>
            <CalIcon /> {t.icsBtn}
          </button>
        </div>
      </section>

      <section className="tk-how" aria-labelledby="tk-how-h">
        <h2 id="tk-how-h">{t.howH}</h2>
        <ul>
          {t.how.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <button type="button" className="tk-btn" onClick={reset}>
          {t.reset}
        </button>
      </section>

      <div className="tk-toast-region" aria-live="polite" role="status">
        {toastMsg && (
          <div key={toastMsg.id} className="tk-toast">
            {toastMsg.text}
          </div>
        )}
      </div>

      {mounted &&
        createPortal(
          <PrintSheet
            lang={lang}
            label={label}
            days={days}
            start={start}
            people={saved.people}
            warnings={warnings.map((w) => warningText(w, days, lang))}
            permits={permits.map((p) => PERMIT_TEXT[p].name[lang])}
          />,
          document.body,
        )}
    </div>
  );
}

/** What window.print() prints: a plain sheet, a direct child of <body> so the print CSS can hide everything else. */
function PrintSheet({
  lang,
  label,
  days,
  start,
  people,
  warnings,
  permits,
}: {
  lang: Lang;
  label: string;
  days: Day[];
  start: string | null;
  people: number;
  warnings: string[];
  permits: string[];
}) {
  const t = COPY[lang];
  const infos = dayInfos(days);
  const tot = totals(days);
  return (
    <div className="tk-print" lang={lang} translate="no" aria-hidden="true">
      <p className="tk-print-brand">{BRAND[lang]}</p>
      <h2>{t.printTitle(label)}</h2>
      <p>
        {num(tot.days, lang)} {t.sum.days}
        {isDate(start)
          ? ` · ${dateLabel(start, lang, { day: 'numeric', month: 'long', year: 'numeric' })} – ${dateLabel(addDays(start, days.length - 1), lang, { day: 'numeric', month: 'long', year: 'numeric' })}`
          : ''}{' '}
        · {num(people, lang)} {t.peopleLabel} · {t.sum.maxSleep} {count(tot.maxSleep, lang)} m · {t.sum.maxTop} {count(tot.maxTop, lang)} m
      </p>
      <Profile lang={lang} infos={infos} warnings={altitudeWarnings(days)} tripLabel={label} active={null} compact />
      <table>
        <tbody>
          {infos.map((x, i) => (
            <tr key={days[i].k}>
              <th scope="row">
                {t.dayN(num(i + 1, lang))}
                {isDate(start) && <small>{dateLabel(addDays(start, i), lang)}</small>}
              </th>
              <td>
                <strong>{dayTitle(x, lang)}</strong>
                <span>{dayFacts(x, lang).join(' · ')}</span>
                <span>{dayHighlight(x, lang)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>
        {t.ruleH} — {t.ruleTag}
      </h3>
      <ul>
        {(warnings.length ? warnings : [t.ruleOk]).map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <h3>{t.permitsH}</h3>
      <p>{permits.join(' · ')}</p>
      <p className="tk-print-foot">{t.printFoot}</p>
    </div>
  );
}

function Mark() {
  return (
    <svg className="tk-mark" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="#0f5e63" />
      <path d="M6 34 L17 18 L23 26 L30 14 L42 34 Z" fill="#f7f3ea" />
      <path d="M30 14 L34 20.5 L31 19 L28.5 21.5 L26.8 19.6 Z" fill="#0f5e63" opacity="0.35" />
      <path d="M10 38 C17 33, 24 40, 38 34" fill="none" stroke="#f2b544" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1 4.2" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#1f7a4d" />
      <path d="M5.5 10.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PrintIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 8V2.5h10V8M5 14.5H3V8h14v6.5h-2M5 11.5h10v6H5z" strokeLinejoin="round" />
    </svg>
  );
}
function CalIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="4" width="15" height="13" rx="2" />
      <path d="M2.5 8h15M6.5 2v4M13.5 2v4" strokeLinecap="round" />
    </svg>
  );
}
