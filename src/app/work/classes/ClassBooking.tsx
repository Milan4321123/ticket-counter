'use client';

// The class booking app demo: a made-up Nepali culture school in Frankfurt.
// Students and parents browse classes, read the timetable, book a trial or a
// whole term, wait for a full class and carry a QR pass; the teacher view takes
// the register (tap or "scan"), watches the week and posts notes that show up
// on the student side. All rules live in booking.ts; this file only draws them.
// Everything is kept in localStorage under one key — nothing is sent anywhere.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { Icon, Initial, SchoolMark, SubjectIcon, TeacherAvatar } from './art';
import {
  AGES,
  CLASSES,
  LEVELS,
  NAME_MAX,
  NOTE_MAX,
  SUBJECTS,
  TERM_WEEKS,
  TRIAL_CHOICES,
  addDays,
  book,
  buildIcs,
  cancel,
  checkName,
  checkNote,
  classById,
  classesOn,
  isCheckedIn,
  isoDate,
  markAll,
  mondayOf,
  nextDate,
  normalize,
  notesForVisitor,
  postNote,
  presentIds,
  reschedule,
  roster,
  scanPass,
  seedState,
  sessionStart,
  simulateCancellation,
  spotsLeft,
  taken,
  togglePresent,
  upcomingDates,
  upcomingFor,
  visitorBookedOn,
  waitPosition,
  waitingCount,
  weekAttendance,
  weekday,
  type AgeFilter,
  type Booking,
  type BookingKind,
  type ClassDef,
  type ClassesState,
  type Level,
  type Note,
  type Subject,
} from './booking';
import { ADDRESS, COPY, LANGS, fmtDate, fmtTime, num, type Copy, type Lang } from './content';

const STORE_KEY = 'mn-demo:classes';

function loadRaw(): unknown {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveRaw(s: ClassesState) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private window: the demo still works, it just forgets on reload */
  }
}
function lessMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
function isWide(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(min-width: 980px)').matches);
}

const subjVar = (s: Subject) => ({ '--c': `var(--cb-${s})`, '--c-soft': `var(--cb-${s}-soft)` }) as CSSProperties;

function timeRange(c: ClassDef, lang: Lang) {
  return `${fmtTime(c.start, lang)}–${fmtTime(c.start + c.mins, lang)}`;
}
function noteText(n: Note, t: Copy): string {
  return n.key ? (t.seedNotes[n.key] ?? '') : (n.text ?? '');
}

function downloadIcs(b: Booking, t: Copy) {
  const c = classById(b.classId)!;
  const ics = buildIcs(
    b,
    `${t.classes[c.id].title} · ${t.school}`,
    `${t.rooms[c.room]}, ${ADDRESS}`,
    `${b.who} · ${t.pass} ${b.code} · ${t.teachers[c.teacher].name} (demo)`,
    new Date()
  );
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aangan-${c.id}-${b.code.toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- small pieces ----------

function Qr({ text, label }: { text: string; label: string }) {
  const path = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d, n: n + 4 };
  }, [text]);
  return (
    <svg className="cb-qr" viewBox={`0 0 ${path.n} ${path.n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={path.n} height={path.n} fill="#fff" />
      <path d={path.d} fill="#1b1530" />
    </svg>
  );
}

function SpotsBar({ left, cap, t, lang, waiting }: { left: number; cap: number; t: Copy; lang: Lang; waiting?: number }) {
  const frac = cap ? (cap - left) / cap : 1;
  const label = left === 0 ? t.full : left === 1 ? t.oneLeft : t.spots(num(left, lang), num(cap, lang));
  return (
    <div className={`cb-spots${left === 0 ? ' is-full' : left <= 2 ? ' is-low' : ''}`}>
      <div className="cb-spots-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(frac * 100)}%` }} />
      </div>
      <span className="cb-spots-text">
        {label}
        {waiting ? ` · ${t.waiting(num(waiting, lang))}` : ''}
      </span>
    </div>
  );
}

type Toast = { id: number; text: string; tone: 'ok' | 'info' | 'warn' };

function Sheet({ title, onClose, children, wide, labelId }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; labelId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useCopy();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const body = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = body;
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="cb-sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`cb-sheet${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1} ref={ref}>
        <div className="cb-sheet-grab" aria-hidden="true" />
        <div className="cb-sheet-head">
          <h2 id={labelId}>{title}</h2>
          <button type="button" className="cb-icon-btn" onClick={onClose} aria-label={t.close}>
            <Icon name="x" />
          </button>
        </div>
        <div className="cb-sheet-body">{children}</div>
      </div>
    </div>
  );
}

// The current language's words, without threading them through every prop.
let CURRENT: Copy = COPY.en;
function useCopy(): Copy {
  return CURRENT;
}

// ---------- classes tab ----------

type Filters = { subject: Subject | 'all'; level: Level | 'any'; day: number | -1; age: AgeFilter | 'any' };
const NO_FILTERS: Filters = { subject: 'all', level: 'any', day: -1, age: 'any' };

function matchesAge(c: ClassDef, a: AgeFilter): boolean {
  const max = c.ageMax ?? 99;
  if (a === 'kids') return c.ageMin <= 12 && max >= 4;
  if (a === 'teens') return c.ageMin <= 17 && max >= 13;
  return max >= 18;
}

function ClassCard({ c, s, now, lang, onOpen }: { c: ClassDef; s: ClassesState; now: Date; lang: Lang; onOpen: () => void }) {
  const t = COPY[lang];
  const next = upcomingDates(c, now, 1)[0];
  const left = spotsLeft(s, c, next);
  const ct = t.classes[c.id];
  const mine = s.bookings.some((b) => b.classId === c.id && b.status !== 'cancelled');
  return (
    <li>
      <button type="button" className="cb-card" style={subjVar(c.subject)} onClick={onOpen}>
        <span className="cb-card-top">
          <SubjectIcon subject={c.subject} />
          <span className="cb-card-subj">{t.subjects[c.subject]}</span>
          {mine && (
            <span className="cb-card-mine">
              <Icon name="check" />
            </span>
          )}
        </span>
        <span className="cb-card-title">{ct.title}</span>
        <span className="cb-card-blurb">{ct.blurb}</span>
        <span className="cb-chips">
          <span className="cb-chip">{t.levels[c.level]}</span>
          <span className="cb-chip">{t.ages(num(c.ageMin, lang), c.ageMax ? num(c.ageMax, lang) : null)}</span>
        </span>
        <span className="cb-card-when">
          <Icon name="clock" />
          {t.daysLong[c.day]} · {timeRange(c, lang)}
        </span>
        <span className="cb-card-teacher">
          <TeacherAvatar id={c.teacher} size={30} />
          <span>{t.teachers[c.teacher].name}</span>
          <span className="cb-card-room">{t.rooms[c.room]}</span>
        </span>
        <SpotsBar left={left} cap={c.capacity} t={t} lang={lang} waiting={left === 0 ? waitingCount(s, c.id) : 0} />
      </button>
    </li>
  );
}

function ClassesPanel({ s, now, lang, onOpen }: { s: ClassesState; now: Date; lang: Lang; onOpen: (id: string, date?: string) => void }) {
  const t = COPY[lang];
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const list = CLASSES.filter(
    (c) =>
      (f.subject === 'all' || c.subject === f.subject) &&
      (f.level === 'any' || c.level === f.level || c.level === 'all') &&
      (f.day === -1 || c.day === f.day) &&
      (f.age === 'any' || matchesAge(c, f.age))
  ).sort((a, b) => a.day - b.day || a.start - b.start);
  const dirty = f.subject !== 'all' || f.level !== 'any' || f.day !== -1 || f.age !== 'any';
  return (
    <section className="cb-panel" aria-labelledby="cb-classes-h">
      <h2 id="cb-classes-h" className="cb-sr">
        {t.tabs.classes}
      </h2>
      <div className="cb-filters">
        <div className="cb-subjects" role="group" aria-label={t.subjectF}>
          {(['all', ...SUBJECTS] as const).map((sub) => (
            <button
              key={sub}
              type="button"
              className={`cb-pill${sub !== 'all' ? ` cb-pill-${sub}` : ''}`}
              aria-pressed={f.subject === sub}
              onClick={() => setF({ ...f, subject: sub })}
            >
              {sub === 'all' ? t.all : t.subjectShort[sub]}
            </button>
          ))}
        </div>
        <div className="cb-selects">
          <label>
            <span>{t.levelF}</span>
            <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value as Filters['level'] })}>
              <option value="any">{t.anyLevel}</option>
              {LEVELS.filter((l) => l !== 'all').map((l) => (
                <option key={l} value={l}>
                  {t.levels[l]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t.dayF}</span>
            <select value={f.day} onChange={(e) => setF({ ...f, day: Number(e.target.value) })}>
              <option value={-1}>{t.anyDay}</option>
              {t.daysLong.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t.ageF}</span>
            <select value={f.age} onChange={(e) => setF({ ...f, age: e.target.value as Filters['age'] })}>
              <option value="any">{t.anyAge}</option>
              {AGES.map((a) => (
                <option key={a} value={a}>
                  {t.ageFilters[a]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="cb-count" aria-live="polite">
          {t.count(num(list.length, lang))}
          {dirty && (
            <button type="button" className="cb-link" onClick={() => setF(NO_FILTERS)}>
              {t.clear}
            </button>
          )}
        </p>
      </div>
      {list.length ? (
        <ul className="cb-cards">
          {list.map((c) => (
            <ClassCard key={c.id} c={c} s={s} now={now} lang={lang} onOpen={() => onOpen(c.id)} />
          ))}
        </ul>
      ) : (
        <p className="cb-empty-line">{t.none}</p>
      )}
    </section>
  );
}

// ---------- timetable ----------

const TT_FROM = 10 * 60;
const TT_TO = 21 * 60;
const PX_PER_MIN = 1;

function TimetablePanel({ s, now, lang, onOpen }: { s: ClassesState; now: Date; lang: Lang; onOpen: (id: string, date?: string) => void }) {
  const t = COPY[lang];
  const today = isoDate(now);
  const mon = mondayOf(today);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [day, setDay] = useState(weekday(today));
  useEffect(() => {
    if (window.matchMedia?.('(max-width: 639px)').matches) setView('day');
  }, []);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dateFor = (c: ClassDef) => {
    const d = addDays(mon, c.day);
    return sessionStart(c, d).getTime() + c.mins * 60000 > now.getTime() ? d : upcomingDates(c, now, 1)[0];
  };
  const hours: number[] = [];
  for (let m = TT_FROM; m <= TT_TO; m += 60) hours.push(m);

  const block = (c: ClassDef) => {
    const d = dateFor(c);
    const left = spotsLeft(s, c, d);
    const mine = visitorBookedOn(s, c.id, d).length > 0;
    return (
      <button
        key={c.id}
        type="button"
        className={`cb-block${mine ? ' is-mine' : ''}${left === 0 ? ' is-full' : ''}`}
        style={{ ...subjVar(c.subject), top: (c.start - TT_FROM) * PX_PER_MIN, height: c.mins * PX_PER_MIN - 3 }}
        onClick={() => onOpen(c.id, d)}
      >
        <span className="cb-block-row">
          <span className="cb-block-time">{fmtTime(c.start, lang)}</span>
          <span className="cb-block-meta">
            {mine && <Icon name="check" />}
            {left === 0 ? t.full.split('·')[0].trim() : t.leftShort(num(left, lang))}
          </span>
        </span>
        <span className="cb-block-title">{t.classes[c.id].title}</span>
      </button>
    );
  };

  return (
    <section className="cb-panel" aria-labelledby="cb-tt-h">
      <div className="cb-tt-head">
        <h2 id="cb-tt-h">{t.week}</h2>
        <div className="cb-seg cb-seg-sm" role="group" aria-label={t.tabs.timetable}>
          <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>
            {t.weekView}
          </button>
          <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}>
            {t.dayView}
          </button>
        </div>
      </div>
      <p className="cb-hint">{t.ttHint}</p>
      {view === 'week' ? (
        <div className="cb-tt-scroll" tabIndex={0} role="region" aria-label={t.tabs.timetable}>
          <div className="cb-tt">
            <div className="cb-tt-corner" aria-hidden="true" />
            {t.days.map((d, i) => {
              const date = addDays(mon, i);
              return (
                <div key={d} className={`cb-tt-day${date === today ? ' is-today' : ''}`}>
                  <b>{d}</b>
                  <span>{num(Number(date.slice(8)), lang)}</span>
                </div>
              );
            })}
            <div className="cb-tt-times" style={{ height: (TT_TO - TT_FROM) * PX_PER_MIN }} aria-hidden="true">
              {hours.map((m) => (
                <span key={m} style={{ top: (m - TT_FROM) * PX_PER_MIN }}>
                  {fmtTime(m, lang)}
                </span>
              ))}
            </div>
            {t.days.map((d, i) => {
              const date = addDays(mon, i);
              return (
                <div key={d} className={`cb-tt-col${date === today ? ' is-today' : ''}`} style={{ height: (TT_TO - TT_FROM) * PX_PER_MIN }}>
                  {hours.map((m) => (
                    <i key={m} style={{ top: (m - TT_FROM) * PX_PER_MIN }} aria-hidden="true" />
                  ))}
                  {CLASSES.filter((c) => c.day === i).map(block)}
                  {date === today && nowMin > TT_FROM && nowMin < TT_TO && (
                    <span className="cb-tt-now" style={{ top: (nowMin - TT_FROM) * PX_PER_MIN }} aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="cb-dayview">
          <div className="cb-daychips" role="group" aria-label={t.dayF}>
            {t.days.map((d, i) => {
              const date = addDays(mon, i);
              return (
                <button key={d} type="button" aria-pressed={day === i} className={date === today ? 'is-today' : ''} onClick={() => setDay(i)}>
                  <b>{d}</b>
                  <span>{num(Number(date.slice(8)), lang)}</span>
                </button>
              );
            })}
          </div>
          <ul className="cb-daylist">
            {CLASSES.filter((c) => c.day === day)
              .sort((a, b) => a.start - b.start)
              .map((c) => {
                const d = dateFor(c);
                const left = spotsLeft(s, c, d);
                return (
                  <li key={c.id}>
                    <button type="button" className="cb-dayrow" style={subjVar(c.subject)} onClick={() => onOpen(c.id, d)}>
                      <span className="cb-dayrow-time">
                        <b>{fmtTime(c.start, lang)}</b>
                        <span>{fmtTime(c.start + c.mins, lang)}</span>
                      </span>
                      <span className="cb-dayrow-main">
                        <span className="cb-dayrow-title">{t.classes[c.id].title}</span>
                        <span className="cb-dayrow-meta">
                          {t.teachers[c.teacher].name} · {t.rooms[c.room]}
                        </span>
                        <SpotsBar left={left} cap={c.capacity} t={t} lang={lang} />
                      </span>
                      {visitorBookedOn(s, c.id, d).length > 0 && (
                        <span className="cb-card-mine">
                          <Icon name="check" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------- the booking sheet ----------

type BookStep = 'details' | 'when' | 'who' | 'confirm' | 'done';

function ClassSheet({
  s,
  now,
  lang,
  classId,
  date,
  onClose,
  onBook,
  onShowBookings,
  onReminder,
}: {
  s: ClassesState;
  now: Date;
  lang: Lang;
  classId: string;
  date?: string;
  onClose: () => void;
  onBook: (input: { classId: string; kind: BookingKind; dates: string[]; who: string }) => { booking?: Booking; error?: string; clash?: string };
  onShowBookings: () => void;
  onReminder: (b: Booking) => void;
}) {
  const t = COPY[lang];
  const c = classById(classId)!;
  const ct = t.classes[c.id];
  const trialDates = upcomingDates(c, now, TRIAL_CHOICES);
  const termDates = upcomingDates(c, now, TERM_WEEKS);
  const [step, setStep] = useState<BookStep>('details');
  const [kind, setKind] = useState<BookingKind>('trial');
  const [pick, setPick] = useState(date && trialDates.includes(date) ? date : trialDates[0]);
  const [who, setWho] = useState(s.people[0] ?? '');
  const [other, setOther] = useState(s.people.length === 0);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Booking | null>(null);
  const next = date && trialDates.includes(date) ? date : trialDates[0];
  const nextLeft = spotsLeft(s, c, next);
  const notes = s.notes.filter((n) => n.classId === c.id).sort((a, b) => b.at - a.at);
  const dates = kind === 'trial' ? [pick] : termDates;
  const willWait = dates.some((d) => spotsLeft(s, c, d) === 0);
  const stepNo = { when: 1, who: 2, confirm: 3 } as Record<BookStep, number>;
  const liveDone = done ? (s.bookings.find((b) => b.id === done.id) ?? done) : null;

  const confirm = () => {
    const r = onBook({ classId: c.id, kind, dates, who });
    if (r.booking) {
      setDone(r.booking);
      setStep('done');
    } else if (r.error === 'duplicate' && r.clash) {
      setError(t.dupErr(who, fmtDate(r.clash, lang)));
      setStep('who');
    } else if (r.error === 'name') {
      setError(t.nameErr);
      setStep('who');
    } else {
      setError(t.datesErr);
      setStep('when');
    }
  };

  const title = step === 'done' && liveDone ? (liveDone.status === 'booked' ? t.doneH : t.doneWait) : ct.title;
  return (
    <Sheet title={title} onClose={onClose} labelId="cb-class-sheet-h">
      <div className="cb-class-sheet" style={subjVar(c.subject)}>
        {step !== 'details' && step !== 'done' && (
          <div className="cb-steps" aria-hidden="true">
            <span>{t.step(num(stepNo[step], lang), num(3, lang))}</span>
            <div className="cb-steps-bar">
              <i style={{ width: `${(stepNo[step] / 3) * 100}%` }} />
            </div>
          </div>
        )}

        {step === 'details' && (
          <>
            <div className="cb-detail-hero">
              <SubjectIcon subject={c.subject} />
              <div>
                <p className="cb-detail-subj">{t.subjects[c.subject]}</p>
                <p className="cb-detail-blurb">{ct.blurb}</p>
              </div>
            </div>
            <div className="cb-chips">
              <span className="cb-chip">{t.levels[c.level]}</span>
              <span className="cb-chip">{t.ages(num(c.ageMin, lang), c.ageMax ? num(c.ageMax, lang) : null)}</span>
              <span className="cb-chip">{t.minutes(num(c.mins, lang))}</span>
            </div>
            <div className="cb-detail-teacher">
              <TeacherAvatar id={c.teacher} size={52} />
              <div>
                <b>{t.teachers[c.teacher].name}</b>
                <span>{t.teachers[c.teacher].role}</span>
              </div>
            </div>
            <dl className="cb-detail-rows">
              <div>
                <dt>
                  <Icon name="clock" />
                </dt>
                <dd>
                  {t.daysLong[c.day]} · {timeRange(c, lang)}
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="pin" />
                </dt>
                <dd>
                  {t.rooms[c.room]} · {ADDRESS}
                </dd>
              </div>
            </dl>
            <div className="cb-detail-next">
              <p>
                <b>{t.nextH}:</b> {fmtDate(next, lang, true)}
              </p>
              <SpotsBar left={nextLeft} cap={c.capacity} t={t} lang={lang} waiting={nextLeft === 0 ? waitingCount(s, c.id) : 0} />
            </div>
            <div className="cb-detail-cols">
              <div>
                <h3>{t.learnH}</h3>
                <ul className="cb-ticks">
                  {ct.learn.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>{t.bringH}</h3>
                <ul className="cb-dots">
                  {ct.bring.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            {notes.length > 0 && (
              <div className="cb-note-inline">
                <TeacherAvatar id={c.teacher} size={28} />
                <p>
                  <b>{t.noteH}:</b> {noteText(notes[0], t)}
                </p>
              </div>
            )}
            <div className="cb-sheet-actions">
              <button type="button" className="cb-btn cb-btn-main" onClick={() => setStep('when')}>
                {nextLeft === 0 ? t.waitBtn : t.bookBtn}
              </button>
            </div>
          </>
        )}

        {step === 'when' && (
          <>
            <h3 className="cb-step-h">{t.whenH}</h3>
            <div className="cb-kind" role="radiogroup" aria-label={t.whenH}>
              <button type="button" role="radio" aria-checked={kind === 'trial'} onClick={() => setKind('trial')}>
                <b>{t.trial}</b>
                <span>{t.trialSub}</span>
              </button>
              <button type="button" role="radio" aria-checked={kind === 'term'} onClick={() => setKind('term')}>
                <b>{t.term}</b>
                <span>{t.termSub(num(TERM_WEEKS, lang))}</span>
              </button>
            </div>
            {kind === 'trial' ? (
              <>
                <p className="cb-label">{t.pickDate}</p>
                <div className="cb-dates" role="radiogroup" aria-label={t.pickDate}>
                  {trialDates.map((d) => {
                    const left = spotsLeft(s, c, d);
                    return (
                      <button key={d} type="button" role="radio" aria-checked={pick === d} className={left === 0 ? 'is-full' : ''} onClick={() => setPick(d)}>
                        <b>{fmtDate(d, lang)}</b>
                        <span>{left === 0 ? t.full.split('·')[0].trim() : t.spots(num(left, lang), num(c.capacity, lang))}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <p className="cb-label">{t.yourDates}</p>
                <ul className="cb-termdates">
                  {termDates.map((d) => (
                    <li key={d} className={spotsLeft(s, c, d) === 0 ? 'is-full' : ''}>
                      {fmtDate(d, lang)}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {willWait && <p className="cb-warn">{kind === 'term' ? t.termFull : t.waitHelp}</p>}
            {error && step === 'when' && <p className="cb-error">{error}</p>}
            <div className="cb-sheet-actions">
              <button type="button" className="cb-btn" onClick={() => setStep('details')}>
                {t.back}
              </button>
              <button type="button" className="cb-btn cb-btn-main" onClick={() => setStep('who')}>
                {t.next}
              </button>
            </div>
          </>
        )}

        {step === 'who' && (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (!checkName(who)) {
                setError(t.nameErr);
                return;
              }
              setError('');
              setStep('confirm');
            }}
          >
            <h3 className="cb-step-h">{t.whoH}</h3>
            <div className="cb-people" role="radiogroup" aria-label={t.whoH}>
              {s.people.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={!other && who === p}
                  onClick={() => {
                    setOther(false);
                    setWho(p);
                    setError('');
                  }}
                >
                  <Initial name={p} />
                  {p}
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={other}
                onClick={() => {
                  setOther(true);
                  setWho('');
                  setError('');
                }}
              >
                <span className="cb-initial is-add" aria-hidden="true">
                  +
                </span>
                {t.addPerson}
              </button>
            </div>
            {other && (
              <label className="cb-field">
                <span>{t.namePh}</span>
                <input
                  value={who}
                  onChange={(e) => setWho(e.target.value)}
                  maxLength={NAME_MAX}
                  autoComplete="off"
                  autoFocus
                  aria-describedby="cb-name-help"
                  aria-invalid={Boolean(error)}
                />
              </label>
            )}
            <p className="cb-help" id="cb-name-help">
              {t.nameHelp}
            </p>
            {error && (
              <p className="cb-error" role="alert">
                {error}
              </p>
            )}
            <div className="cb-sheet-actions">
              <button type="button" className="cb-btn" onClick={() => setStep('when')}>
                {t.back}
              </button>
              <button type="submit" className="cb-btn cb-btn-main">
                {t.next}
              </button>
            </div>
          </form>
        )}

        {step === 'confirm' && (
          <>
            <h3 className="cb-step-h">{t.confirmH}</h3>
            <dl className="cb-summary">
              <div>
                <dt>{t.rowClass}</dt>
                <dd>
                  {ct.title}
                  <small>
                    {t.teachers[c.teacher].name} · {kind === 'trial' ? t.trial : t.term}
                  </small>
                </dd>
              </div>
              <div>
                <dt>{t.rowWhen}</dt>
                <dd>
                  {kind === 'trial' ? fmtDate(pick, lang, true) : `${fmtDate(termDates[0], lang)} – ${fmtDate(termDates[termDates.length - 1], lang)}`}
                  <small>
                    {timeRange(c, lang)}
                    {kind === 'term' ? ` · ${t.termTag(num(TERM_WEEKS, lang))}` : ''}
                  </small>
                </dd>
              </div>
              <div>
                <dt>{t.rowWho}</dt>
                <dd>{who.trim()}</dd>
              </div>
              <div>
                <dt>{t.rowWhere}</dt>
                <dd>
                  {t.rooms[c.room]}
                  <small>{ADDRESS}</small>
                </dd>
              </div>
            </dl>
            {willWait && <p className="cb-warn">{t.waitHelp}</p>}
            <div className="cb-sheet-actions">
              <button type="button" className="cb-btn" onClick={() => setStep('who')}>
                {t.back}
              </button>
              <button type="button" className="cb-btn cb-btn-main" onClick={confirm}>
                {willWait ? t.confirmWait : t.confirmBtn}
              </button>
            </div>
          </>
        )}

        {step === 'done' && liveDone && (
          <>
            <BookingCard b={liveDone} s={s} now={now} lang={lang} big />
            {liveDone.status === 'waitlist' ? (
              <p className="cb-warn">
                {t.waitPos(num(waitPosition(s, liveDone), lang))}. {t.waitHelp}
              </p>
            ) : (
              <p className="cb-help cb-center">{t.showPass}</p>
            )}
            <div className="cb-sheet-actions cb-wrap">
              {liveDone.status === 'booked' && (
                <button type="button" className="cb-btn" onClick={() => downloadIcs(liveDone, t)}>
                  <Icon name="cal" />
                  {t.addCal}
                </button>
              )}
              <button type="button" className="cb-btn" onClick={() => onReminder(liveDone)}>
                <Icon name="bell" />
                {t.previewRem}
              </button>
              <button type="button" className="cb-btn cb-btn-main" onClick={onShowBookings}>
                {t.seeBookings}
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

// ---------- my bookings ----------

function BookingCard({
  b,
  s,
  now,
  lang,
  big,
  actions,
  onPass,
}: {
  b: Booking;
  s: ClassesState;
  now: Date;
  lang: Lang;
  big?: boolean;
  actions?: ReactNode;
  onPass?: () => void;
}) {
  const t = COPY[lang];
  const c = classById(b.classId)!;
  const nd = nextDate(b, now) ?? b.dates[b.dates.length - 1];
  const left = b.dates.filter((d) => sessionStart(c, d).getTime() + c.mins * 60000 > now.getTime());
  const checked = b.status === 'booked' && nd ? isCheckedIn(s, b, nd) : false;
  const tag =
    b.status === 'waitlist'
      ? t.waitTag(num(waitPosition(s, b), lang))
      : b.kind === 'trial'
        ? t.trialTag
        : t.termTag(num(b.dates.length, lang));
  return (
    <article className={`cb-booking${big ? ' is-big' : ''}${b.status === 'waitlist' ? ' is-wait' : ''}`} style={subjVar(c.subject)}>
      <div className="cb-booking-main">
        <div className="cb-booking-head">
          <SubjectIcon subject={c.subject} />
          <div className="cb-booking-title">
            <b>{t.classes[c.id].title}</b>
            <span>
              {t.teachers[c.teacher].name} · {t.rooms[c.room]}
            </span>
          </div>
        </div>
        <div className="cb-booking-tags">
          <span className={`cb-tag${b.status === 'waitlist' ? ' cb-tag-wait' : ''}`}>{tag}</span>
          {checked && (
            <span className="cb-tag cb-tag-ok">
              <Icon name="check" />
              {t.checkedIn}
            </span>
          )}
        </div>
        <p className="cb-booking-who">
          <Initial name={b.who} you />
          <b>{b.who}</b>
        </p>
        {nd && (
          <p className="cb-booking-next">
            <span>{t.nextLabel}</span>
            <b>{fmtDate(nd, lang)}</b> · {timeRange(c, lang)}
          </p>
        )}
        {b.kind === 'term' && left.length > 1 && (
          <ul className="cb-booking-dates" aria-label={t.yourDates}>
            {left.slice(1, 4).map((d) => (
              <li key={d}>{fmtDate(d, lang)}</li>
            ))}
            {left.length > 4 && <li className="is-more">{t.moreDates(num(left.length - 4, lang))}</li>}
          </ul>
        )}
      </div>
      {b.status === 'booked' && (
        <div className="cb-booking-pass">
          {onPass ? (
            <button type="button" className="cb-qr-btn" onClick={onPass} aria-label={t.enlarge}>
              <Qr text={`AANGAN-DEMO|${b.code}`} label={`${t.pass} ${b.code}`} />
            </button>
          ) : (
            <Qr text={`AANGAN-DEMO|${b.code}`} label={`${t.pass} ${b.code}`} />
          )}
          <code>{b.code}</code>
        </div>
      )}
      {actions && <div className="cb-booking-actions">{actions}</div>}
    </article>
  );
}

function BookingsPanel({
  s,
  now,
  lang,
  seenView,
  onBrowse,
  onCancel,
  onMove,
  onReminder,
  onPass,
  onSimulate,
}: {
  s: ClassesState;
  now: Date;
  lang: Lang;
  seenView: number;
  onBrowse: () => void;
  onCancel: (b: Booking, date: string) => void;
  onMove: (b: Booking, date: string) => void;
  onReminder: (b: Booking) => void;
  onPass: (b: Booking) => void;
  onSimulate: (b: Booking) => void;
}) {
  const t = COPY[lang];
  const live = s.bookings
    .filter((b) => b.status !== 'cancelled' && nextDate(b, now))
    .sort((a, b) => {
      const ca = classById(a.classId)!;
      const cb = classById(b.classId)!;
      return sessionStart(ca, nextDate(a, now)!).getTime() - sessionStart(cb, nextDate(b, now)!).getTime();
    });
  const cancelled = s.bookings.filter((b) => b.status === 'cancelled').slice(-4).reverse();
  const notes = notesForVisitor(s).slice(0, 3);
  return (
    <section className="cb-panel cb-bookings" aria-labelledby="cb-bookings-h">
      <div className="cb-aside-head">
        <h2 id="cb-bookings-h">{t.tabs.bookings}</h2>
        <span className="cb-count-pill">{num(live.length, lang)}</span>
      </div>

      {notes.length > 0 && (
        <div className="cb-notes">
          <h3>{t.notesH}</h3>
          <ul>
            {notes.map((n) => {
              const c = classById(n.classId)!;
              return (
                <li key={n.id} className={n.at > seenView ? 'is-new' : ''}>
                  <TeacherAvatar id={c.teacher} size={34} />
                  <div>
                    <p className="cb-note-meta">
                      <b>{t.teachers[c.teacher].name}</b> · {t.classes[c.id].title}
                      {n.at > seenView && <span className="cb-new">{t.newBadge}</span>}
                    </p>
                    <p className="cb-note-text">{noteText(n, t)}</p>
                    <p className="cb-note-ago">{t.ago(Math.max(0, Math.floor((now.getTime() - n.at) / 60000)))}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <h3 className="cb-sub-h">{t.upcomingH}</h3>
      {live.length === 0 ? (
        <div className="cb-empty">
          <b>{t.emptyH}</b>
          <p>{t.emptyText}</p>
          <button type="button" className="cb-btn cb-btn-main" onClick={onBrowse}>
            {t.browse}
          </button>
        </div>
      ) : (
        <ul className="cb-booking-list">
          {live.map((b) => {
            const nd = nextDate(b, now)!;
            return (
              <li key={b.id}>
                <BookingCard
                  b={b}
                  s={s}
                  now={now}
                  lang={lang}
                  onPass={() => onPass(b)}
                  actions={
                    b.status === 'waitlist' ? (
                      <>
                        <button type="button" className="cb-mini cb-mini-accent" onClick={() => onSimulate(b)}>
                          <Icon name="users" />
                          {t.simulate}
                        </button>
                        <button type="button" className="cb-mini" onClick={() => onCancel(b, nd)}>
                          <Icon name="x" />
                          {t.cancel}
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="cb-mini" onClick={() => downloadIcs(b, t)}>
                          <Icon name="cal" />
                          {t.calBtn}
                        </button>
                        <button type="button" className="cb-mini" onClick={() => onReminder(b)}>
                          <Icon name="bell" />
                          {t.remindBtn}
                        </button>
                        <button type="button" className="cb-mini" onClick={() => onMove(b, nd)}>
                          <Icon name="cal" />
                          {t.reschedule}
                        </button>
                        <button type="button" className="cb-mini" onClick={() => onCancel(b, nd)}>
                          <Icon name="x" />
                          {t.cancel}
                        </button>
                      </>
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {cancelled.length > 0 && (
        <div className="cb-cancelled">
          <h3 className="cb-sub-h">{t.cancelledH}</h3>
          <ul>
            {cancelled.map((b) => (
              <li key={b.id}>
                <s>{t.classes[b.classId].title}</s> · {b.who}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ReminderSheet({ b, s, now, lang, onClose }: { b: Booking; s: ClassesState; now: Date; lang: Lang; onClose: () => void }) {
  const t = COPY[lang];
  const c = classById(b.classId)!;
  const [mode, setMode] = useState<'wa' | 'mail'>('wa');
  const d = nextDate(b, now) ?? b.dates[0];
  const note = s.notes.filter((n) => n.classId === c.id).sort((a, x) => x.at - a.at)[0];
  const text = t.remText({
    who: b.who,
    cls: t.classes[c.id].title,
    date: fmtDate(d, lang, true),
    time: fmtTime(c.start, lang),
    room: t.rooms[c.room],
    bring: t.classes[c.id].bring.join(', ').toLowerCase(),
    code: b.code,
  });
  const noteLine = note ? t.remNote(t.teachers[c.teacher].name, noteText(note, t)) : '';
  const eve = new Date(sessionStart(c, d).getTime() - DAY_MS);
  const sendTime = fmtTime(18 * 60, lang);
  return (
    <Sheet title={t.remH} onClose={onClose} labelId="cb-rem-h">
      <p className="cb-help">{t.remSub}</p>
      <div className="cb-seg" role="group" aria-label={t.remH}>
        <button type="button" aria-pressed={mode === 'wa'} onClick={() => setMode('wa')}>
          {t.whatsapp}
        </button>
        <button type="button" aria-pressed={mode === 'mail'} onClick={() => setMode('mail')}>
          {t.email}
        </button>
      </div>
      {mode === 'wa' ? (
        <div className="cb-wa">
          <div className="cb-wa-top">
            <SchoolMark size={30} />
            <div>
              <b>{t.remChat}</b>
              <span>{fmtDate(isoDate(eve), lang)}</span>
            </div>
          </div>
          <div className="cb-wa-chat">
            <div className="cb-wa-bubble">
              {text.split('\n').map((line, i) => (line ? <p key={i}>{line}</p> : <br key={i} />))}
              {noteLine && <p className="cb-wa-note">{noteLine}</p>}
              <p className="cb-wa-reply">{t.remReply}</p>
              <span className="cb-wa-time">{sendTime}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="cb-mail">
          <p>
            <span>{t.emailFrom}</span> Aangan Pathshala &lt;hello@aangan.example&gt;
          </p>
          <p>
            <span>{t.emailTo}</span> {b.who}
          </p>
          <p className="cb-mail-subj">{t.emailSubject(t.classes[c.id].title, fmtTime(c.start, lang))}</p>
          <div className="cb-mail-body">
            {text.split('\n').map((line, i) => (line ? <p key={i}>{line}</p> : null))}
            {noteLine && <p className="cb-wa-note">{noteLine}</p>}
            <p>{t.remReply}</p>
            <div className="cb-mail-qr">
              <Qr text={`AANGAN-DEMO|${b.code}`} label={`${t.pass} ${b.code}`} />
            </div>
          </div>
        </div>
      )}
      <p className="cb-sent-note">{t.nothingSent}</p>
    </Sheet>
  );
}
const DAY_MS = 86400000;

// ---------- teacher view ----------

function TeacherToday({
  s,
  now,
  lang,
  date,
  setDate,
  sel,
  setSel,
  onToggle,
  onAll,
  onScan,
}: {
  s: ClassesState;
  now: Date;
  lang: Lang;
  date: string;
  setDate: (d: string) => void;
  sel: string | null;
  setSel: (id: string) => void;
  onToggle: (c: ClassDef, id: string) => void;
  onAll: (c: ClassDef) => void;
  onScan: () => void;
}) {
  const t = COPY[lang];
  const today = isoDate(now);
  const list = classesOn(date);
  const current = list.find((c) => c.id === sel) ?? list[0];
  const r = current ? roster(s, current, date) : [];
  const present = current ? presentIds(s, current, date, now) : new Set<string>();
  return (
    <section className="cb-panel" aria-labelledby="cb-today-h">
      <div className="cb-datenav">
        <button type="button" className="cb-icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label={t.prevDay}>
          <Icon name="chev-l" />
        </button>
        <div>
          <h2 id="cb-today-h">{date === today ? t.tabs.today : t.daysLong[weekday(date)]}</h2>
          <span>{fmtDate(date, lang, true)}</span>
        </div>
        <button type="button" className="cb-icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label={t.nextDay}>
          <Icon name="chev-r" />
        </button>
        {date !== today && (
          <button type="button" className="cb-link" onClick={() => setDate(today)}>
            {t.todayBtn}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="cb-empty-line">{t.noClasses}</p>
      ) : (
        <>
          <ul className="cb-sessions" role="list">
            {list.map((c) => {
              const n = taken(s, c, date);
              const here = presentIds(s, c, date, now).size;
              const expected = roster(s, c, date).length;
              const w = waitingCount(s, c.id);
              return (
                <li key={c.id}>
                  <button type="button" className="cb-session" style={subjVar(c.subject)} aria-pressed={current?.id === c.id} onClick={() => setSel(c.id)}>
                    <span className="cb-session-time">{timeRange(c, lang)}</span>
                    <span className="cb-session-title">{t.classes[c.id].title}</span>
                    <span className="cb-session-teacher">
                      <TeacherAvatar id={c.teacher} size={22} />
                      {t.teachers[c.teacher].name} · {t.rooms[c.room]}
                    </span>
                    <span className="cb-session-stats">
                      <span>{t.booked(num(Math.min(n, c.capacity), lang), num(c.capacity, lang))}</span>
                      {w > 0 && <span className="cb-stat-wait">{t.waitlistN(num(w, lang))}</span>}
                      <span className="cb-stat-here">{t.presentCount(num(here, lang), num(expected, lang))}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {current && (
            <div className="cb-roster" style={subjVar(current.subject)}>
              <div className="cb-roster-head">
                <div>
                  <h3>
                    {t.rosterH} · {t.classes[current.id].title}
                  </h3>
                  <p className="cb-hint">{t.tapHint}</p>
                </div>
                <div className="cb-roster-btns">
                  <button type="button" className="cb-btn cb-btn-main" onClick={onScan}>
                    <Icon name="qr" />
                    {t.scan}
                  </button>
                  <button type="button" className="cb-btn" onClick={() => onAll(current)}>
                    <Icon name="check" />
                    {t.markAll}
                  </button>
                </div>
              </div>
              <div className="cb-roster-meter" aria-hidden="true">
                <i style={{ width: `${r.length ? (present.size / r.length) * 100 : 0}%` }} />
              </div>
              <p className="cb-roster-count">{t.presentCount(num(present.size, lang), num(r.length, lang))}</p>
              <ul className="cb-roster-list">
                {r.map((p) => {
                  const on = present.has(p.id);
                  return (
                    <li key={p.id}>
                      <button type="button" className={`cb-person${p.you ? ' is-you' : ''}`} aria-pressed={on} onClick={() => onToggle(current, p.id)}>
                        <Initial name={p.name} you={p.you} />
                        <span className="cb-person-name">
                          <b>{p.name}</b>
                          <span>
                            {t.kinds[p.kind]}
                            {p.you ? ` · ${t.fromYou}` : ''}
                          </span>
                        </span>
                        <span className="cb-person-mark">{on ? <Icon name="check" /> : null}</span>
                        <span className="cb-sr">{on ? t.here : ''}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function WeekChart({ s, now, lang }: { s: ClassesState; now: Date; lang: Lang }) {
  const t = COPY[lang];
  const days = weekAttendance(s, now);
  const today = isoDate(now);
  const max = Math.max(1, ...days.map((d) => d.expected));
  const sofar = days.filter((d) => d.date < today || (d.date === today && d.present > 0));
  const pe = sofar.reduce((a, d) => a + d.expected, 0);
  const pp = sofar.reduce((a, d) => a + d.present, 0);
  const pct = pe ? Math.round((pp / pe) * 100) : 0;
  const summary = days.map((d, i) => `${t.days[i]} ${d.present}/${d.expected}`).join(', ');
  return (
    <section className="cb-panel cb-week" aria-labelledby="cb-week-h">
      <div className="cb-aside-head">
        <h2 id="cb-week-h">{t.weekH}</h2>
        <span className="cb-count-pill">{t.weekTotal(num(pct, lang))}</span>
      </div>
      <p className="cb-hint">{t.weekSub}</p>
      <div className="cb-chart" role="img" aria-label={`${t.weekSub}: ${summary}`}>
        {days.map((d, i) => (
          <div key={d.date} className={`cb-chart-col${d.date === today ? ' is-today' : ''}${d.date > today ? ' is-future' : ''}`}>
            <span className="cb-chart-val">{d.expected ? `${num(d.present, lang)}/${num(d.expected, lang)}` : '–'}</span>
            <div className="cb-chart-track" style={{ height: `${(d.expected / max) * 100}%` }}>
              <i style={{ height: `${d.expected ? (d.present / d.expected) * 100 : 0}%` }} />
            </div>
            <span className="cb-chart-day">{t.days[i]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function NotesPanel({ s, now, lang, defaultClass, onPost }: { s: ClassesState; now: Date; lang: Lang; defaultClass: string; onPost: (classId: string, text: string) => boolean }) {
  const t = COPY[lang];
  const [to, setTo] = useState(defaultClass);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => setTo(defaultClass), [defaultClass]);
  const recent = [...s.notes].sort((a, b) => b.at - a.at).slice(0, 4);
  return (
    <section className="cb-panel cb-post" aria-labelledby="cb-post-h">
      <h2 id="cb-post-h" className="cb-aside-title">
        {t.postH}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!checkNote(text)) {
            setErr(t.noteErr);
            return;
          }
          if (onPost(to, text)) {
            setText('');
            setErr('');
          }
        }}
      >
        <label className="cb-field">
          <span>{t.noteTo}</span>
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {CLASSES.map((c) => (
              <option key={c.id} value={c.id}>
                {t.days[c.day]} {fmtTime(c.start, lang)} · {t.classes[c.id].title}
              </option>
            ))}
          </select>
        </label>
        <label className="cb-field">
          <span className="cb-sr">{t.postH}</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={NOTE_MAX} rows={3} placeholder={t.notePh} aria-invalid={Boolean(err)} />
        </label>
        <div className="cb-ideas">
          <span>{t.ideas}:</span>
          {t.ideaList.map((idea) => (
            <button key={idea} type="button" className="cb-pill" onClick={() => setText(idea)}>
              {idea}
            </button>
          ))}
        </div>
        {err && (
          <p className="cb-error" role="alert">
            {err}
          </p>
        )}
        <div className="cb-post-row">
          <span className="cb-hint">
            {num(text.trim().length, lang)}/{num(NOTE_MAX, lang)}
          </span>
          <button type="submit" className="cb-btn cb-btn-main">
            <Icon name="note" />
            {t.notePost}
          </button>
        </div>
      </form>
      <h3 className="cb-sub-h">{t.postedH}</h3>
      <ul className="cb-posted">
        {recent.map((n) => {
          const c = classById(n.classId)!;
          return (
            <li key={n.id}>
              <TeacherAvatar id={c.teacher} size={28} />
              <div>
                <p className="cb-note-meta">
                  <b>{t.classes[c.id].title}</b> · {t.ago(Math.max(0, Math.floor((now.getTime() - n.at) / 60000)))}
                </p>
                <p className="cb-note-text">{noteText(n, t)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ScanSheet({
  s,
  lang,
  date,
  onClose,
  onScan,
}: {
  s: ClassesState;
  lang: Lang;
  date: string;
  onClose: () => void;
  onScan: (code: string) => { result: string; booking?: Booking };
}) {
  const t = COPY[lang];
  const passes = s.bookings.filter((b) => b.status === 'booked' && b.dates.includes(date));
  const [busy, setBusy] = useState<Booking | null>(null);
  const [out, setOut] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const go = (b: Booking) => {
    setBusy(b);
    setOut(null);
    const finish = () => {
      const r = onScan(b.code);
      setBusy(null);
      setOut(r.result === 'ok' ? { ok: true, text: t.scanOk(b.who) } : { ok: false, text: t.scanAlready(b.who) });
    };
    if (lessMotion()) finish();
    else timer.current = setTimeout(finish, 900);
  };
  return (
    <Sheet title={t.scanH} onClose={onClose} labelId="cb-scan-h">
      <div className={`cb-viewfinder${busy ? ' is-busy' : ''}${out ? (out.ok ? ' is-ok' : ' is-warn') : ''}`}>
        <span className="cb-vf-corner tl" />
        <span className="cb-vf-corner tr" />
        <span className="cb-vf-corner bl" />
        <span className="cb-vf-corner br" />
        {busy && (
          <div className="cb-vf-qr">
            <Qr text={`AANGAN-DEMO|${busy.code}`} label={busy.code} />
          </div>
        )}
        {busy && <span className="cb-vf-line" aria-hidden="true" />}
        {!busy && out && (
          <div className="cb-vf-result" role="status">
            <span className="cb-vf-icon">{out.ok ? <Icon name="check" /> : '!'}</span>
            <b>{out.text}</b>
          </div>
        )}
        {!busy && !out && <p className="cb-vf-hint">{t.scanSub}</p>}
        {busy && <p className="cb-vf-hint">{t.scanWait}</p>}
      </div>
      <h3 className="cb-sub-h">{t.scanPasses}</h3>
      {passes.length === 0 ? (
        <p className="cb-help">{t.scanNone}</p>
      ) : (
        <ul className="cb-passes">
          {passes.map((b) => (
            <li key={b.id}>
              <button type="button" className="cb-pass-btn" onClick={() => go(b)} disabled={Boolean(busy)} data-code={b.code}>
                <span className="cb-pass-qr">
                  <Qr text={`AANGAN-DEMO|${b.code}`} label={b.code} />
                </span>
                <span>
                  <b>{b.who}</b>
                  <span>
                    {t.classes[b.classId].title} · {b.code}
                  </span>
                </span>
                <Icon name="qr" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

// ---------- the app ----------

type SheetState =
  | { type: 'class'; classId: string; date?: string; key: number }
  | { type: 'reminder'; bookingId: string }
  | { type: 'cancel'; bookingId: string; date: string }
  | { type: 'move'; bookingId: string; date: string }
  | { type: 'pass'; bookingId: string }
  | { type: 'scan' };

type Tab = 'classes' | 'timetable' | 'bookings';
type TTab = 'today' | 'week' | 'notes';

export default function ClassBooking() {
  const [s, setS] = useState<ClassesState | null>(null);
  const sRef = useRef<ClassesState | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [tab, setTab] = useState<Tab>('classes');
  const [mainTab, setMainTab] = useState<'classes' | 'timetable'>('timetable');
  const [ttab, setTtab] = useState<TTab>('today');
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [seenView, setSeenView] = useState(0);
  const [tDate, setTDate] = useState('');
  const [tSel, setTSel] = useState<string | null>(null);
  const toastId = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const lang: Lang = s?.lang ?? 'en';
  const t = COPY[lang];
  CURRENT = t;

  const commit = useCallback((next: ClassesState) => {
    sRef.current = next;
    setS(next);
    saveRaw(next);
  }, []);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++toastId.current;
    setToasts((x) => [...x.slice(-1), { id, text, tone }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 4600);
  }, []);

  useEffect(() => {
    const n = new Date();
    const st = normalize(loadRaw(), n);
    sRef.current = st;
    setS(st);
    saveRaw(st);
    setNow(n);
    setSeenView(st.seenAt);
    setTDate(isoDate(n));
    if (isWide()) setTab('classes');
    else setMainTab('classes');
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const promotedToasts = useCallback(
    (list: Booking[]) => {
      const cur = sRef.current;
      if (!cur) return;
      const tt = COPY[cur.lang];
      for (const b of list) toast(tt.promoted(b.who, tt.classes[b.classId].title), 'ok');
    },
    [toast]
  );

  const runSim = useCallback(
    (classId: string) => {
      const cur = sRef.current;
      if (!cur) return;
      const r = simulateCancellation(cur, classId);
      commit(r.state);
      const tt = COPY[cur.lang];
      if (r.event === 'ahead-moved') toast(tt.aheadMoved, 'info');
      promotedToasts(r.promoted);
    },
    [commit, toast, promotedToasts]
  );

  // A full class's waitlist moves by itself every few seconds (someone else cancels).
  useEffect(() => {
    if (!s) return;
    const w = s.bookings.filter((b) => b.status === 'waitlist').sort((a, b) => a.at - b.at)[0];
    if (!w) return;
    const id = setTimeout(() => runSim(w.classId), 9000);
    return () => clearTimeout(id);
  }, [s, runSim]);

  const markSeen = useCallback(() => {
    const cur = sRef.current;
    if (!cur) return;
    setSeenView(cur.seenAt);
    commit({ ...cur, seenAt: Date.now() });
  }, [commit]);

  const goTab = (x: Tab) => {
    setTab(x);
    if (x !== 'bookings') setMainTab(x);
    else markSeen();
    rootRef.current?.scrollIntoView({ block: 'start', behavior: lessMotion() ? 'auto' : 'smooth' });
  };

  const switchRole = (r: 'student' | 'teacher') => {
    if (r === role) return;
    setRole(r);
    if (r === 'student' && s) {
      const fresh = notesForVisitor(s).filter((n) => n.at > s.seenAt);
      if (fresh.length) {
        const c = classById(fresh[0].classId)!;
        toast(t.noteNew(t.teachers[c.teacher].name), 'info');
        if (isWide()) markSeen();
      }
    }
  };

  if (!s || !now) {
    return (
      <div className="cb cb-loading" aria-busy="true">
        <div className="cb-shell">
          <header className="cb-header">
            <div className="cb-brand">
              <SchoolMark size={40} />
              <div>
                <b>Aangan Pathshala</b>
                <span>Frankfurt</span>
              </div>
            </div>
          </header>
          <div className="cb-skel">
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    );
  }

  const setLang = (l: Lang) => commit({ ...s, lang: l });
  const openClass = (classId: string, date?: string) => setSheet({ type: 'class', classId, date, key: Date.now() });
  const sheetBooking = sheet && 'bookingId' in sheet ? s.bookings.find((b) => b.id === sheet.bookingId) : undefined;
  const unseen = notesForVisitor(s).some((n) => n.at > s.seenAt);
  const tClass = classesOn(tDate || isoDate(now)).find((c) => c.id === tSel) ?? classesOn(tDate || isoDate(now))[0];

  const doBook = (input: { classId: string; kind: BookingKind; dates: string[]; who: string }) => {
    const r = book(sRef.current!, input, new Date());
    if (r.booking) {
      commit(r.state);
      const tt = COPY[r.state.lang];
      if (r.booking.status === 'booked') toast(tt.bookedToast(r.booking.who, tt.classes[r.booking.classId].title));
      else toast(tt.waitToast(num(waitPosition(r.state, r.booking), r.state.lang)), 'info');
    }
    return r;
  };

  const reset = () => {
    const fresh = seedState(new Date());
    fresh.lang = s.lang;
    commit(fresh);
    setSeenView(fresh.seenAt);
    setSheet(null);
    setTDate(isoDate(new Date()));
    setTSel(null);
    toast(t.resetDone, 'info');
  };

  const studentTabs: { id: Tab; icon: 'grid' | 'cal' | 'ticket'; label: string }[] = [
    { id: 'classes', icon: 'grid', label: t.tabs.classes },
    { id: 'timetable', icon: 'cal', label: t.tabs.timetable },
    { id: 'bookings', icon: 'ticket', label: t.tabs.bookings },
  ];
  const teacherTabs: { id: TTab; icon: 'today' | 'chart' | 'note'; label: string }[] = [
    { id: 'today', icon: 'today', label: t.tabs.today },
    { id: 'week', icon: 'chart', label: t.tabs.week },
    { id: 'notes', icon: 'note', label: t.tabs.notes },
  ];

  return (
    <div ref={rootRef} className={`cb cb-role-${role} cb-tab-${tab} cb-ttab-${ttab} cb-lang-${lang}`} lang={lang} translate="no">
      <div className="cb-shell">
        <header className="cb-header">
          <div className="cb-brand">
            <SchoolMark size={40} />
            <div>
              <b>{t.school}</b>
              <span>
                {t.city} · {t.tagline}
              </span>
            </div>
          </div>
          <div className="cb-header-tools">
            <div className="cb-seg cb-role" role="group" aria-label={`${t.student} / ${t.teacher}`}>
              <button type="button" aria-pressed={role === 'student'} onClick={() => switchRole('student')}>
                {t.student}
              </button>
              <button type="button" aria-pressed={role === 'teacher'} onClick={() => switchRole('teacher')}>
                {t.teacher}
              </button>
            </div>
            <div className="cb-seg cb-langs" role="group" aria-label={t.langLabel}>
              {LANGS.map((l) => (
                <button key={l.id} type="button" aria-pressed={lang === l.id} onClick={() => setLang(l.id)} lang={l.id}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </header>
        <div className="cb-infobar">
          <span>{t.madeUp}</span>
          <button type="button" className="cb-link" onClick={reset}>
            <Icon name="reset" />
            {t.reset}
          </button>
        </div>

        {role === 'student' ? (
          <div className="cb-body">
            <div className="cb-main">
              <div className="cb-toptabs" role="tablist" aria-label={t.tabs.classes}>
                {studentTabs
                  .filter((x) => x.id !== 'bookings')
                  .map((x) => (
                    <button key={x.id} type="button" role="tab" aria-selected={mainTab === x.id} onClick={() => goTab(x.id)}>
                      <Icon name={x.icon} />
                      {x.label}
                    </button>
                  ))}
              </div>
              {mainTab === 'classes' ? (
                <ClassesPanel s={s} now={now} lang={lang} onOpen={openClass} />
              ) : (
                <TimetablePanel s={s} now={now} lang={lang} onOpen={openClass} />
              )}
            </div>
            <aside className="cb-aside">
              <BookingsPanel
                s={s}
                now={now}
                lang={lang}
                seenView={seenView}
                onBrowse={() => goTab('classes')}
                onCancel={(b, date) => setSheet({ type: 'cancel', bookingId: b.id, date })}
                onMove={(b, date) => setSheet({ type: 'move', bookingId: b.id, date })}
                onReminder={(b) => setSheet({ type: 'reminder', bookingId: b.id })}
                onPass={(b) => setSheet({ type: 'pass', bookingId: b.id })}
                onSimulate={(b) => runSim(b.classId)}
              />
            </aside>
          </div>
        ) : (
          <div className="cb-body">
            <div className="cb-main cb-t-today">
              <TeacherToday
                s={s}
                now={now}
                lang={lang}
                date={tDate}
                setDate={(d) => {
                  setTDate(d);
                  setTSel(null);
                }}
                sel={tSel}
                setSel={setTSel}
                onToggle={(c, id) => commit(togglePresent(sRef.current!, c, tDate, id, new Date()))}
                onAll={(c) => commit(markAll(sRef.current!, c, tDate))}
                onScan={() => setSheet({ type: 'scan' })}
              />
            </div>
            <aside className="cb-aside">
              <div className="cb-t-week">
                <WeekChart s={s} now={now} lang={lang} />
              </div>
              <div className="cb-t-notes">
                <NotesPanel
                  s={s}
                  now={now}
                  lang={lang}
                  defaultClass={tClass?.id ?? CLASSES[0].id}
                  onPost={(classId, text) => {
                    const r = postNote(sRef.current!, classId, text, new Date());
                    if (!r.note) return false;
                    commit(r.state);
                    const c = classById(classId)!;
                    toast(t.notePosted(num(roster(r.state, c, upcomingDates(c, new Date(), 1)[0]).length, lang)));
                    return true;
                  }}
                />
              </div>
            </aside>
          </div>
        )}

        <nav className="cb-tabbar" aria-label={role === 'student' ? t.student : t.teacher}>
          {role === 'student'
            ? studentTabs.map((x) => (
                <button key={x.id} type="button" aria-current={tab === x.id ? 'page' : undefined} onClick={() => goTab(x.id)}>
                  <span className="cb-tabbar-ico">
                    <Icon name={x.icon} />
                    {x.id === 'bookings' && unseen && <i className="cb-dot" aria-hidden="true" />}
                  </span>
                  {x.label}
                </button>
              ))
            : teacherTabs.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  aria-current={ttab === x.id ? 'page' : undefined}
                  onClick={() => {
                    setTtab(x.id);
                    rootRef.current?.scrollIntoView({ block: 'start', behavior: lessMotion() ? 'auto' : 'smooth' });
                  }}
                >
                  <span className="cb-tabbar-ico">
                    <Icon name={x.icon} />
                  </span>
                  {x.label}
                </button>
              ))}
        </nav>

        <p className="cb-footnote">{t.footer}</p>
      </div>

      <div className="cb-toasts" aria-live="polite" role="status">
        {toasts.map((x) => (
          <div key={x.id} className={`cb-toast cb-toast-${x.tone}`}>
            <Icon name={x.tone === 'info' ? 'bell' : 'check'} />
            <span>{x.text}</span>
          </div>
        ))}
      </div>

      {sheet?.type === 'class' && (
        <ClassSheet
          key={sheet.key}
          s={s}
          now={now}
          lang={lang}
          classId={sheet.classId}
          date={sheet.date}
          onClose={() => setSheet(null)}
          onBook={doBook}
          onShowBookings={() => {
            setSheet(null);
            goTab('bookings');
          }}
          onReminder={(b) => setSheet({ type: 'reminder', bookingId: b.id })}
        />
      )}
      {sheet?.type === 'reminder' && sheetBooking && <ReminderSheet b={sheetBooking} s={s} now={now} lang={lang} onClose={() => setSheet(null)} />}
      {sheet?.type === 'pass' && sheetBooking && (
        <Sheet title={t.pass} onClose={() => setSheet(null)} labelId="cb-pass-h">
          <BookingCard b={sheetBooking} s={s} now={now} lang={lang} big />
          <p className="cb-help cb-center">{t.showPass}</p>
        </Sheet>
      )}
      {sheet?.type === 'cancel' && sheetBooking && (
        <Sheet title={t.cancelH} onClose={() => setSheet(null)} labelId="cb-cancel-h">
          {(() => {
            const b = sheetBooking;
            const doCancel = (date: string | null) => {
              const r = cancel(sRef.current!, b.id, date);
              commit(r.state);
              setSheet(null);
              toast(t.cancelledToast, 'info');
              promotedToasts(r.promoted);
            };
            const live = b.dates.filter((d) => d >= sheet.date);
            return (
              <>
                <p className="cb-cancel-what">
                  <b>{t.classes[b.classId].title}</b> · {b.who}
                </p>
                {b.kind === 'term' && b.status === 'booked' && live.length > 1 ? (
                  <div className="cb-sheet-actions cb-stack">
                    <button type="button" className="cb-btn" onClick={() => doCancel(sheet.date)}>
                      {t.cancelOne(fmtDate(sheet.date, lang, true))}
                    </button>
                    <button type="button" className="cb-btn cb-btn-danger" onClick={() => doCancel(null)}>
                      {t.cancelAll}
                    </button>
                    <button type="button" className="cb-btn cb-btn-ghost" onClick={() => setSheet(null)}>
                      {t.keep}
                    </button>
                  </div>
                ) : (
                  <>
                    <p>{t.cancelTrial(fmtDate(sheet.date, lang, true))}</p>
                    <div className="cb-sheet-actions">
                      <button type="button" className="cb-btn" onClick={() => setSheet(null)}>
                        {t.keep}
                      </button>
                      <button type="button" className="cb-btn cb-btn-danger" onClick={() => doCancel(null)}>
                        {t.cancelYes}
                      </button>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </Sheet>
      )}
      {sheet?.type === 'move' && sheetBooking && (
        <Sheet title={t.reschedH} onClose={() => setSheet(null)} labelId="cb-move-h">
          {(() => {
            const b = sheetBooking;
            const c = classById(b.classId)!;
            const options = upcomingDates(c, now, TERM_WEEKS + TRIAL_CHOICES).filter((d) => !b.dates.includes(d)).slice(0, 5);
            return (
              <>
                <p className="cb-cancel-what">
                  <b>{t.classes[c.id].title}</b> · {b.who} · {fmtDate(sheet.date, lang)}
                </p>
                <div className="cb-dates">
                  {options.map((d) => {
                    const left = spotsLeft(s, c, d);
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={left === 0}
                        className={left === 0 ? 'is-full' : ''}
                        onClick={() => {
                          const r = reschedule(sRef.current!, b.id, sheet.date, d, new Date());
                          if (r.ok) {
                            commit(r.state);
                            setSheet(null);
                            toast(t.reschedOk(fmtDate(d, lang, true)));
                            promotedToasts(r.promoted);
                          } else toast(t.reschedNone, 'warn');
                        }}
                      >
                        <b>{fmtDate(d, lang)}</b>
                        <span>{left === 0 ? t.full.split('·')[0].trim() : t.spots(num(left, lang), num(c.capacity, lang))}</span>
                      </button>
                    );
                  })}
                </div>
                {options.every((d) => spotsLeft(s, c, d) === 0) && <p className="cb-help">{t.reschedNone}</p>}
              </>
            );
          })()}
        </Sheet>
      )}
      {sheet?.type === 'scan' && (
        <ScanSheet
          s={s}
          lang={lang}
          date={tDate}
          onClose={() => setSheet(null)}
          onScan={(code) => {
            const r = scanPass(sRef.current!, code, tDate, new Date());
            commit(r.state);
            if (r.booking) setTSel(r.booking.classId);
            return r;
          }}
        />
      )}
    </div>
  );
}
