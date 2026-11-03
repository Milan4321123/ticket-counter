// The pure rules behind the /work/classes demo: a made-up Nepali culture school
// (Aangan Pathshala, Frankfurt), its weekly timetable, and everything a visitor
// can do to it — book a trial or a term, wait for a full class, cancel,
// reschedule — and everything its teachers can do — mark attendance, scan a
// pass, post a note to a class.
//
// No React, no clock and no storage in here: the page passes `now` in and
// keeps the returned state in localStorage. That keeps every rule testable
// (tests/classBooking.test.ts) and the same state readable after a reload.
//
// There is deliberately nothing about money anywhere: classes have no fees.

export type Subject = 'kids' | 'adults' | 'dance' | 'madal' | 'harmonium';
export type Level = 'beginner' | 'intermediate' | 'advanced' | 'all';
export type AgeFilter = 'kids' | 'teens' | 'adults';
export type TeacherId = 'kamala' | 'ramesh' | 'anjana' | 'dipesh' | 'sushma';
export type Room = 'r1' | 'r2' | 'r3' | 'hall';

export type ClassDef = {
  id: string;
  subject: Subject;
  level: Level;
  /** Youngest age the class takes. */
  ageMin: number;
  /** Oldest, or null for "and up". */
  ageMax: number | null;
  /** 0 = Monday … 6 = Sunday. */
  day: number;
  /** Minutes after midnight. */
  start: number;
  mins: number;
  teacher: TeacherId;
  room: Room;
  capacity: number;
  /** Term students already enrolled when the demo starts. */
  enrolled: number;
  /** Made-up people already on the waitlist, ahead of any visitor. */
  waitAhead?: number;
};

const h = (hh: number, mm = 0) => hh * 60 + mm;

export const CLASSES: ClassDef[] = [
  { id: 'harm-a', subject: 'harmonium', level: 'beginner', ageMin: 8, ageMax: null, day: 0, start: h(18, 30), mins: 60, teacher: 'sushma', room: 'r3', capacity: 8, enrolled: 5 },
  { id: 'adults-a', subject: 'adults', level: 'beginner', ageMin: 16, ageMax: null, day: 1, start: h(19), mins: 90, teacher: 'ramesh', room: 'r2', capacity: 14, enrolled: 10 },
  { id: 'classical', subject: 'dance', level: 'intermediate', ageMin: 13, ageMax: null, day: 2, start: h(18), mins: 90, teacher: 'anjana', room: 'hall', capacity: 10, enrolled: 7 },
  { id: 'adults-b', subject: 'adults', level: 'intermediate', ageMin: 16, ageMax: null, day: 3, start: h(19), mins: 90, teacher: 'ramesh', room: 'r2', capacity: 12, enrolled: 9 },
  { id: 'madal-a', subject: 'madal', level: 'beginner', ageMin: 10, ageMax: null, day: 4, start: h(17, 30), mins: 60, teacher: 'dipesh', room: 'r3', capacity: 8, enrolled: 5 },
  { id: 'folk-adults', subject: 'dance', level: 'beginner', ageMin: 16, ageMax: null, day: 4, start: h(19), mins: 75, teacher: 'anjana', room: 'hall', capacity: 16, enrolled: 11 },
  { id: 'kids-a', subject: 'kids', level: 'beginner', ageMin: 5, ageMax: 8, day: 5, start: h(10), mins: 60, teacher: 'kamala', room: 'r1', capacity: 12, enrolled: 9 },
  { id: 'kids-b', subject: 'kids', level: 'intermediate', ageMin: 9, ageMax: 13, day: 5, start: h(11, 15), mins: 60, teacher: 'kamala', room: 'r1', capacity: 12, enrolled: 8 },
  { id: 'folk-kids', subject: 'dance', level: 'all', ageMin: 6, ageMax: 12, day: 5, start: h(14), mins: 60, teacher: 'anjana', room: 'hall', capacity: 16, enrolled: 15 },
  { id: 'harm-b', subject: 'harmonium', level: 'all', ageMin: 16, ageMax: null, day: 6, start: h(11), mins: 90, teacher: 'sushma', room: 'r2', capacity: 10, enrolled: 7 },
  { id: 'madal-b', subject: 'madal', level: 'advanced', ageMin: 14, ageMax: null, day: 6, start: h(15), mins: 90, teacher: 'dipesh', room: 'r3', capacity: 6, enrolled: 6, waitAhead: 1 },
];

export const SUBJECTS: Subject[] = ['kids', 'adults', 'dance', 'madal', 'harmonium'];
export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced', 'all'];
export const AGES: AgeFilter[] = ['kids', 'teens', 'adults'];
export const TERM_WEEKS = 8;
export const TRIAL_CHOICES = 4;
export const NAME_MAX = 30;
export const NOTE_MAX = 160;
export const STORE_VERSION = 3;

export function classById(id: string): ClassDef | undefined {
  return CLASSES.find((c) => c.id === id);
}

// ---------- dates (local, as YYYY-MM-DD strings) ----------

export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: string, n: number): string {
  const d = parseIso(s);
  return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}
/** 0 = Monday … 6 = Sunday. */
export function weekday(s: string): number {
  return (parseIso(s).getDay() + 6) % 7;
}
export function mondayOf(s: string): string {
  return addDays(s, -weekday(s));
}
export function sessionStart(c: ClassDef, date: string): Date {
  const d = parseIso(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(c.start / 60), c.start % 60);
}
export function sessionKey(classId: string, date: string): string {
  return `${classId}@${date}`;
}
/** "18:30" */
export function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** The next `count` dates this class meets that have not started yet. */
export function upcomingDates(c: ClassDef, now: Date, count: number): string[] {
  const today = isoDate(now);
  let d = addDays(today, (c.day - weekday(today) + 7) % 7);
  if (sessionStart(c, d) <= now) d = addDays(d, 7);
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(addDays(d, i * 7));
  return out;
}

export function classesOn(date: string): ClassDef[] {
  const wd = weekday(date);
  return CLASSES.filter((c) => c.day === wd).sort((a, b) => a.start - b.start);
}

// ---------- tiny deterministic hash (seeded rosters, codes) ----------

export function hash(s: string): number {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 0x01000193);
  }
  return x >>> 0;
}
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function passCode(seed: string): string {
  let x = hash(seed);
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += CODE_ABC[x % CODE_ABC.length];
    x = (Math.floor(x / CODE_ABC.length) ^ hash(seed + i)) >>> 0;
  }
  return `AP-${s}`;
}

// ---------- state ----------

export type BookingKind = 'trial' | 'term';
export type BookingStatus = 'booked' | 'waitlist' | 'cancelled';

export type Booking = {
  id: string;
  /** What the QR code carries. */
  code: string;
  classId: string;
  kind: BookingKind;
  /** The dates still booked (cancelled single dates are removed). */
  dates: string[];
  who: string;
  status: BookingStatus;
  /** ms timestamp — waitlist order. */
  at: number;
};

export type Note = {
  id: string;
  classId: string;
  /** A built-in note (translated in content.ts) … */
  key?: string;
  /** … or what a teacher typed in the demo. */
  text?: string;
  at: number;
};

export type ClassesState = {
  v: number;
  lang: 'en' | 'ne' | 'de';
  /** Names entered on this device, for the "who is coming" chips. */
  people: string[];
  bookings: Booking[];
  /** Made-up term students who have left a class (a spot each). */
  left: Record<string, number>;
  /** Made-up people still waiting ahead of the visitor. */
  waitAhead: Record<string, number>;
  /** Who was marked present, per session key (once a teacher touched it). */
  present: Record<string, string[]>;
  notes: Note[];
  /** When the visitor last looked at their bookings (for the new-note dot). */
  seenAt: number;
  seq: number;
};

const DAY = 86400000;

/** A school that already looks lived-in: a child on a term, a parent's trial, three teacher notes. */
export function seedState(now: Date): ClassesState {
  const t = now.getTime();
  const kids = classById('kids-a')!;
  const harm = classById('harm-b')!;
  const s: ClassesState = {
    v: STORE_VERSION,
    lang: 'en',
    people: ['Aarav', 'Sita'],
    bookings: [],
    left: {},
    waitAhead: Object.fromEntries(CLASSES.filter((c) => c.waitAhead).map((c) => [c.id, c.waitAhead!])),
    present: {},
    notes: [
      { id: 'n1', classId: 'kids-a', key: 'deusi', at: t - 2 * DAY },
      { id: 'n2', classId: 'madal-a', key: 'tune', at: t - DAY },
      { id: 'n3', classId: 'harm-b', key: 'bhajan', at: t - 3 * 3600000 },
    ],
    seenAt: t - 2.5 * DAY,
    seq: 2,
  };
  s.bookings.push({
    id: 'b1',
    code: passCode('seed-b1'),
    classId: kids.id,
    kind: 'term',
    dates: upcomingDates(kids, now, TERM_WEEKS),
    who: 'Aarav',
    status: 'booked',
    at: t - 9 * DAY,
  });
  s.bookings.push({
    id: 'b2',
    code: passCode('seed-b2'),
    classId: harm.id,
    kind: 'trial',
    dates: upcomingDates(harm, now, 1),
    who: 'Sita',
    status: 'booked',
    at: t - 4 * DAY,
  });
  return s;
}

/** Whatever came out of localStorage, as a state this version understands (or a fresh seed). */
export function normalize(raw: unknown, now: Date): ClassesState {
  const s = raw as Partial<ClassesState> | null;
  if (
    !s ||
    typeof s !== 'object' ||
    s.v !== STORE_VERSION ||
    !Array.isArray(s.bookings) ||
    !Array.isArray(s.notes) ||
    !Array.isArray(s.people) ||
    typeof s.seq !== 'number'
  ) {
    const fresh = seedState(now);
    if (s && typeof s === 'object' && (s.lang === 'ne' || s.lang === 'de')) fresh.lang = s.lang;
    return fresh;
  }
  const bookings = s.bookings.filter(
    (b) => b && typeof b.id === 'string' && classById(b.classId) && Array.isArray(b.dates) && typeof b.who === 'string'
  );
  return {
    v: STORE_VERSION,
    lang: s.lang === 'ne' || s.lang === 'de' ? s.lang : 'en',
    people: s.people.filter((p) => typeof p === 'string').slice(0, 8),
    bookings,
    left: s.left && typeof s.left === 'object' ? s.left : {},
    waitAhead: s.waitAhead && typeof s.waitAhead === 'object' ? s.waitAhead : {},
    present: s.present && typeof s.present === 'object' ? s.present : {},
    notes: s.notes.filter((n) => n && classById(n.classId)).slice(0, 40),
    seenAt: typeof s.seenAt === 'number' ? s.seenAt : 0,
    seq: s.seq,
  };
}

// ---------- seats ----------

/** Made-up drop-in trial guests on a date (only where there is room to spare). */
export function guestsOn(c: ClassDef, date: string): number {
  return c.capacity - c.enrolled >= 3 ? hash(`${c.id}|${date}`) % 2 : 0;
}

export function visitorBookedOn(s: ClassesState, classId: string, date: string): Booking[] {
  return s.bookings.filter((b) => b.classId === classId && b.status === 'booked' && b.dates.includes(date));
}

export function taken(s: ClassesState, c: ClassDef, date: string): number {
  return c.enrolled - (s.left[c.id] ?? 0) + guestsOn(c, date) + visitorBookedOn(s, c.id, date).length;
}
export function spotsLeft(s: ClassesState, c: ClassDef, date: string): number {
  return Math.max(0, c.capacity - taken(s, c, date));
}

/** 1-based place in the line for a waitlisted booking (made-up people count first). */
export function waitPosition(s: ClassesState, b: Booking): number {
  const mine = s.bookings
    .filter((x) => x.classId === b.classId && x.status === 'waitlist')
    .sort((x, y) => x.at - y.at)
    .findIndex((x) => x.id === b.id);
  return (s.waitAhead[b.classId] ?? 0) + mine + 1;
}
export function waitingCount(s: ClassesState, classId: string): number {
  return (s.waitAhead[classId] ?? 0) + s.bookings.filter((b) => b.classId === classId && b.status === 'waitlist').length;
}

/** Move waitlisted bookings up (oldest first) wherever every one of their dates has room now. */
export function promote(s: ClassesState): { state: ClassesState; promoted: Booking[] } {
  let state = s;
  const promoted: Booking[] = [];
  const waiting = s.bookings.filter((b) => b.status === 'waitlist').sort((a, b) => a.at - b.at);
  for (const w of waiting) {
    if ((state.waitAhead[w.classId] ?? 0) > 0) continue;
    const c = classById(w.classId)!;
    if (w.dates.every((d) => spotsLeft(state, c, d) > 0)) {
      const nb: Booking = { ...w, status: 'booked' };
      state = { ...state, bookings: state.bookings.map((b) => (b.id === w.id ? nb : b)) };
      promoted.push(nb);
    }
  }
  return { state, promoted };
}

// ---------- the visitor's actions ----------

export type BookError = 'name' | 'dates' | 'duplicate' | 'class';

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}
export function checkName(raw: string): boolean {
  const n = cleanName(raw);
  return n.length >= 1 && n.length <= NAME_MAX && !/https?:|www\.|[<>@]/i.test(n);
}

export function book(
  s: ClassesState,
  input: { classId: string; kind: BookingKind; dates: string[]; who: string },
  now: Date
): { state: ClassesState; booking?: Booking; error?: BookError; clash?: string } {
  const c = classById(input.classId);
  if (!c) return { state: s, error: 'class' };
  if (!checkName(input.who)) return { state: s, error: 'name' };
  const who = cleanName(input.who);
  const valid = new Set(upcomingDates(c, now, TERM_WEEKS + TRIAL_CHOICES));
  const dates = [...new Set(input.dates)].sort();
  if (!dates.length || dates.some((d) => !valid.has(d)) || (input.kind === 'trial' && dates.length !== 1)) {
    return { state: s, error: 'dates' };
  }
  const clash = dates.find((d) =>
    s.bookings.some(
      (b) => b.classId === c.id && b.status !== 'cancelled' && b.who.toLowerCase() === who.toLowerCase() && b.dates.includes(d)
    )
  );
  if (clash) return { state: s, error: 'duplicate', clash };

  const full = dates.some((d) => spotsLeft(s, c, d) === 0);
  const seq = s.seq + 1;
  const booking: Booking = {
    id: `b${seq}`,
    code: passCode(`${seq}|${c.id}|${who}|${dates[0]}`),
    classId: c.id,
    kind: input.kind,
    dates,
    who,
    status: full ? 'waitlist' : 'booked',
    at: now.getTime(),
  };
  const people = s.people.some((p) => p.toLowerCase() === who.toLowerCase()) ? s.people : [...s.people, who].slice(-8);
  return { state: { ...s, seq, people, bookings: [...s.bookings, booking] }, booking };
}

/** Cancel one date of a booking, or (date = null) all of it. Frees the seat and moves the waitlist up. */
export function cancel(
  s: ClassesState,
  bookingId: string,
  date: string | null
): { state: ClassesState; promoted: Booking[] } {
  const b = s.bookings.find((x) => x.id === bookingId);
  if (!b || b.status === 'cancelled') return { state: s, promoted: [] };
  const dates = date === null ? [] : b.dates.filter((d) => d !== date);
  const nb: Booking = dates.length ? { ...b, dates } : { ...b, status: 'cancelled' };
  const state = { ...s, bookings: s.bookings.map((x) => (x.id === b.id ? nb : x)) };
  return promote(state);
}

/** Move a booked date to another date of the same class (if there is room and no clash). */
export function reschedule(
  s: ClassesState,
  bookingId: string,
  from: string,
  to: string,
  now: Date
): { state: ClassesState; ok: boolean; promoted: Booking[] } {
  const b = s.bookings.find((x) => x.id === bookingId);
  if (!b || b.status !== 'booked' || !b.dates.includes(from) || b.dates.includes(to)) return { state: s, ok: false, promoted: [] };
  const c = classById(b.classId)!;
  if (!upcomingDates(c, now, TERM_WEEKS + TRIAL_CHOICES).includes(to) || spotsLeft(s, c, to) === 0) {
    return { state: s, ok: false, promoted: [] };
  }
  const clash = s.bookings.some(
    (x) => x.id !== b.id && x.classId === b.classId && x.status !== 'cancelled' && x.who.toLowerCase() === b.who.toLowerCase() && x.dates.includes(to)
  );
  if (clash) return { state: s, ok: false, promoted: [] };
  const nb: Booking = { ...b, dates: b.dates.map((d) => (d === from ? to : d)).sort() };
  const r = promote({ ...s, bookings: s.bookings.map((x) => (x.id === b.id ? nb : x)) });
  return { state: r.state, ok: true, promoted: r.promoted };
}

/**
 * Someone else cancels (the demo plays this so the waitlist can move): first
 * the made-up people ahead of the visitor take the spots; once nobody is
 * ahead, a spot opens and the visitor's waitlisted booking is moved up.
 */
export function simulateCancellation(
  s: ClassesState,
  classId: string
): { state: ClassesState; event: 'ahead-moved' | 'promoted' | 'none'; promoted: Booking[] } {
  const c = classById(classId);
  if (!c) return { state: s, event: 'none', promoted: [] };
  const ahead = s.waitAhead[classId] ?? 0;
  if (ahead > 0) {
    // Their spot goes to the person in front, so the count of free seats stays the same.
    return { state: { ...s, waitAhead: { ...s.waitAhead, [classId]: ahead - 1 } }, event: 'ahead-moved', promoted: [] };
  }
  const left = s.left[classId] ?? 0;
  if (left >= c.enrolled) return { state: s, event: 'none', promoted: [] };
  const r = promote({ ...s, left: { ...s.left, [classId]: left + 1 } });
  return { state: r.state, event: r.promoted.length ? 'promoted' : 'none', promoted: r.promoted };
}

// ---------- the teacher's side ----------

export type RosterKind = 'term' | 'trial' | 'guest';
export type RosterEntry = { id: string; name: string; kind: RosterKind; you: boolean; bookingId?: string };

const KID_NAMES = ['Aarohi', 'Bibek', 'Prisha', 'Nirjal', 'Sneha', 'Yugal', 'Anushka', 'Rohan', 'Kritika', 'Saugat', 'Ishani', 'Pranav', 'Mira', 'Kushal', 'Lena', 'Ojas'];
const ADULT_NAMES = ['Manisha', 'Suraj', 'Jonas', 'Pooja', 'Rabin', 'Anna', 'Dikshya', 'Tobias', 'Nabin', 'Sarita', 'Elif', 'Prakriti', 'Bishal', 'Laura', 'Sunil', 'Reema'];
const INITIALS = 'ABCDGJKLMNPRSTW';

function seededName(c: ClassDef, i: number): string {
  const pool = (c.ageMax ?? 99) <= 13 ? KID_NAMES : ADULT_NAMES;
  const n = pool[(i + hash(c.id)) % pool.length];
  return `${n} ${INITIALS[hash(`${c.id}${i}`) % INITIALS.length]}.`;
}

/** Everyone expected at one session: term students, made-up trial guests, then the visitor's people. */
export function roster(s: ClassesState, c: ClassDef, date: string): RosterEntry[] {
  const out: RosterEntry[] = [];
  const stay = c.enrolled - (s.left[c.id] ?? 0);
  for (let i = 0; i < stay; i++) out.push({ id: `s:${c.id}:${i}`, name: seededName(c, i), kind: 'term', you: false });
  for (let i = 0; i < guestsOn(c, date); i++) {
    out.push({ id: `g:${c.id}:${date}:${i}`, name: seededName(c, c.enrolled + 3 + (hash(date) % 5) + i), kind: 'guest', you: false });
  }
  for (const b of visitorBookedOn(s, c.id, date)) out.push({ id: `b:${b.id}`, name: b.who, kind: b.kind, you: true, bookingId: b.id });
  return out;
}

/** Who is present: what the teacher marked, or (for a session already over, untouched) a plausible seeded register. */
export function presentIds(s: ClassesState, c: ClassDef, date: string, now: Date): Set<string> {
  const key = sessionKey(c.id, date);
  const marked = s.present[key];
  if (marked) return new Set(marked);
  if (sessionStart(c, date).getTime() + c.mins * 60000 > now.getTime()) return new Set();
  return new Set(roster(s, c, date).filter((r) => !r.you && hash(`${key}|${r.id}`) % 7 !== 0).map((r) => r.id));
}

export function togglePresent(s: ClassesState, c: ClassDef, date: string, id: string, now: Date): ClassesState {
  const cur = presentIds(s, c, date, now);
  if (cur.has(id)) cur.delete(id);
  else cur.add(id);
  return { ...s, present: { ...s.present, [sessionKey(c.id, date)]: [...cur] } };
}

export function markAll(s: ClassesState, c: ClassDef, date: string): ClassesState {
  return { ...s, present: { ...s.present, [sessionKey(c.id, date)]: roster(s, c, date).map((r) => r.id) } };
}

export type ScanResult = 'ok' | 'already' | 'other-day' | 'unknown' | 'waitlist';

/** The door scan: a pass code on a given day checks its holder in to that day's session. */
export function scanPass(
  s: ClassesState,
  code: string,
  date: string,
  now: Date
): { state: ClassesState; result: ScanResult; booking?: Booking } {
  const b = s.bookings.find((x) => x.code === code && x.status !== 'cancelled');
  if (!b) return { state: s, result: 'unknown' };
  if (b.status === 'waitlist') return { state: s, result: 'waitlist', booking: b };
  if (!b.dates.includes(date)) return { state: s, result: 'other-day', booking: b };
  const c = classById(b.classId)!;
  const cur = presentIds(s, c, date, now);
  const id = `b:${b.id}`;
  if (cur.has(id)) return { state: s, result: 'already', booking: b };
  cur.add(id);
  return { state: { ...s, present: { ...s.present, [sessionKey(c.id, date)]: [...cur] } }, result: 'ok', booking: b };
}

export function isCheckedIn(s: ClassesState, b: Booking, date: string): boolean {
  return (s.present[sessionKey(b.classId, date)] ?? []).includes(`b:${b.id}`);
}

export function checkNote(raw: string): boolean {
  const t = raw.trim();
  return t.length >= 2 && t.length <= NOTE_MAX && !/https?:|www\./i.test(t);
}

export function postNote(s: ClassesState, classId: string, raw: string, now: Date): { state: ClassesState; note?: Note } {
  if (!classById(classId) || !checkNote(raw)) return { state: s };
  const seq = s.seq + 1;
  const note: Note = { id: `n${seq}`, classId, text: raw.trim().replace(/\s+/g, ' '), at: now.getTime() };
  return { state: { ...s, seq, notes: [note, ...s.notes].slice(0, 40) }, note };
}

/** Notes for the classes the visitor has a live booking in, newest first. */
export function notesForVisitor(s: ClassesState): Note[] {
  const mine = new Set(s.bookings.filter((b) => b.status !== 'cancelled').map((b) => b.classId));
  return s.notes.filter((n) => mine.has(n.classId)).sort((a, b) => b.at - a.at);
}

export type DayAttendance = { date: string; expected: number; present: number };

/** Monday to Sunday of the current week: how many were expected and how many came. */
export function weekAttendance(s: ClassesState, now: Date): DayAttendance[] {
  const mon = mondayOf(isoDate(now));
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(mon, i);
    let expected = 0;
    let present = 0;
    for (const c of classesOn(date)) {
      expected += roster(s, c, date).length;
      present += presentIds(s, c, date, now).size;
    }
    return { date, expected, present };
  });
}

/** The visitor's sessions still to come, soonest first (one line per booking and date). */
export function upcomingFor(s: ClassesState, now: Date): { booking: Booking; date: string }[] {
  const out: { booking: Booking; date: string }[] = [];
  for (const b of s.bookings) {
    if (b.status === 'cancelled') continue;
    const c = classById(b.classId)!;
    for (const d of b.dates) {
      if (sessionStart(c, d).getTime() + c.mins * 60000 > now.getTime()) out.push({ booking: b, date: d });
    }
  }
  return out.sort((a, b) => sessionStart(classById(a.booking.classId)!, a.date).getTime() - sessionStart(classById(b.booking.classId)!, b.date).getTime());
}

/** The first date of a booking that has not finished yet. */
export function nextDate(b: Booking, now: Date): string | undefined {
  const c = classById(b.classId)!;
  return b.dates.find((d) => sessionStart(c, d).getTime() + c.mins * 60000 > now.getTime());
}

// ---------- the calendar file ----------

function icsLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}
export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}
/** A .ics with one event per booked date, in local (Frankfurt) wall-clock time. */
export function buildIcs(b: Booking, title: string, where: string, description: string, stamp: Date): string {
  const c = classById(b.classId)!;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MartNepali//Demo class booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  for (const d of b.dates) {
    const start = sessionStart(c, d);
    const end = new Date(start.getTime() + c.mins * 60000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.code}-${d}@demo.martnepali.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${icsLocal(start)}`,
      `DTEND:${icsLocal(end)}`,
      `SUMMARY:${icsEscape(title)}`,
      `LOCATION:${icsEscape(where)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
