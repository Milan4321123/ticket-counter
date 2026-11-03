/**
 * THE CLASS BOOKING DEMO KEEPS ITS SEATS HONEST.
 *
 * /work/classes is client-only: booking.ts holds every rule and the page keeps
 * the state in localStorage. A class that books past capacity, a waitlist that
 * never moves, a scan that checks the wrong person in or a note that never
 * reaches the student would all happen in front of a visitor, so the whole
 * story is played here on a fixed clock — and the "no money anywhere" rule is
 * pinned on every word the app can show.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSES,
  TERM_WEEKS,
  addDays,
  book,
  buildIcs,
  cancel,
  classById,
  classesOn,
  isCheckedIn,
  isoDate,
  normalize,
  notesForVisitor,
  postNote,
  presentIds,
  reschedule,
  roster,
  scanPass,
  seedState,
  simulateCancellation,
  spotsLeft,
  togglePresent,
  upcomingDates,
  waitPosition,
  weekAttendance,
  weekday,
  type ClassesState,
} from '../src/app/work/classes/booking.ts';
import { COPY, fmtDate } from '../src/app/work/classes/content.ts';

// Tuesday 3 November 2026, 09:00 local.
const NOW = new Date(2026, 10, 3, 9, 0);

test('the seeded school looks alive: a class every day, two bookings, teacher notes', () => {
  const s = seedState(NOW);
  for (let i = 0; i < 7; i++) assert.ok(classesOn(addDays(isoDate(NOW), i)).length > 0, `a class on weekday ${i}`);
  assert.equal(s.bookings.filter((b) => b.status === 'booked').length, 2);
  const term = s.bookings.find((b) => b.kind === 'term')!;
  assert.equal(term.dates.length, TERM_WEEKS);
  assert.ok(term.dates.every((d) => weekday(d) === classById(term.classId)!.day));
  assert.ok(notesForVisitor(s).length >= 2, 'the visitor sees notes for their own classes');
  assert.ok(CLASSES.some((c) => spotsLeft(s, c, upcomingDates(c, NOW, 1)[0]) === 0), 'one class is full, for the waitlist');
});

test('upcoming dates skip a session that has already started', () => {
  const tue = classById('adults-a')!; // Tuesday 19:00
  assert.equal(upcomingDates(tue, NOW, 1)[0], '2026-11-03');
  assert.equal(upcomingDates(tue, new Date(2026, 10, 3, 19, 30), 1)[0], '2026-11-10');
});

test('a trial takes one seat; the same person cannot book the same date twice', () => {
  let s = seedState(NOW);
  const c = classById('madal-a')!;
  const d = upcomingDates(c, NOW, 1)[0];
  const before = spotsLeft(s, c, d);
  const r = book(s, { classId: c.id, kind: 'trial', dates: [d], who: '  Maya ' }, NOW);
  assert.equal(r.booking?.status, 'booked');
  assert.equal(r.booking?.who, 'Maya');
  s = r.state;
  assert.equal(spotsLeft(s, c, d), before - 1);
  assert.ok(s.people.includes('Maya'));
  const again = book(s, { classId: c.id, kind: 'trial', dates: [d], who: 'maya' }, NOW);
  assert.equal(again.error, 'duplicate');
  assert.equal(again.clash, d);
  assert.equal(book(s, { classId: c.id, kind: 'trial', dates: [d], who: 'https://x.y' }, NOW).error, 'name');
  assert.equal(book(s, { classId: c.id, kind: 'trial', dates: ['2020-01-03'], who: 'Ravi' }, NOW).error, 'dates');
  assert.equal(book(s, { classId: c.id, kind: 'trial', dates: [], who: 'Ravi' }, NOW).error, 'dates');
});

test('a term books eight weekly dates and the calendar file has one event per date', () => {
  const c = classById('classical')!;
  const dates = upcomingDates(c, NOW, TERM_WEEKS);
  const r = book(seedState(NOW), { classId: c.id, kind: 'term', dates, who: 'Anu' }, NOW);
  assert.equal(r.booking?.status, 'booked');
  assert.equal(r.booking?.dates.length, 8);
  const ics = buildIcs(r.booking!, 'Classical dance, Aangan', 'Hall; Frankfurt', 'demo', NOW);
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 8);
  assert.match(ics, /DTSTART:20261104T180000/);
  assert.match(ics, /SUMMARY:Classical dance\\, Aangan/);
  assert.ok(ics.endsWith('\r\n'));
});

test('a full class puts the visitor on the waitlist, and cancellations move them up', () => {
  let s = seedState(NOW);
  const c = classById('madal-b')!;
  const d = upcomingDates(c, NOW, 1)[0];
  assert.equal(spotsLeft(s, c, d), 0);
  const r = book(s, { classId: c.id, kind: 'trial', dates: [d], who: 'Kiran' }, NOW);
  assert.equal(r.booking?.status, 'waitlist');
  s = r.state;
  assert.equal(waitPosition(s, r.booking!), 2, 'one made-up person waits ahead');
  assert.equal(roster(s, c, d).length, c.capacity, 'a waitlisted booking is not on the register');

  let sim = simulateCancellation(s, c.id);
  assert.equal(sim.event, 'ahead-moved');
  s = sim.state;
  assert.equal(waitPosition(s, s.bookings.find((b) => b.id === r.booking!.id)!), 1);
  assert.equal(spotsLeft(s, c, d), 0, 'the person ahead took that spot');

  sim = simulateCancellation(s, c.id);
  assert.equal(sim.event, 'promoted');
  assert.equal(sim.promoted[0].id, r.booking!.id);
  s = sim.state;
  assert.equal(s.bookings.find((b) => b.id === r.booking!.id)!.status, 'booked');
  assert.equal(spotsLeft(s, c, d), 0, 'the freed seat went to the visitor');
  assert.ok(roster(s, c, d).some((p) => p.you && p.name === 'Kiran'));
});

test('cancelling a booked seat hands it to the visitor waiting for it', () => {
  let s = seedState(NOW);
  const c = classById('folk-kids')!; // one spot left
  const d = upcomingDates(c, NOW, 1)[0];
  assert.equal(spotsLeft(s, c, d), 1);
  const first = book(s, { classId: c.id, kind: 'trial', dates: [d], who: 'Asha' }, NOW);
  s = first.state;
  const second = book(s, { classId: c.id, kind: 'trial', dates: [d], who: 'Nisha' }, NOW);
  assert.equal(second.booking?.status, 'waitlist');
  s = second.state;
  const r = cancel(s, first.booking!.id, null);
  assert.equal(r.state.bookings.find((b) => b.id === first.booking!.id)!.status, 'cancelled');
  assert.deepEqual(
    r.promoted.map((b) => b.id),
    [second.booking!.id]
  );
  assert.equal(spotsLeft(r.state, c, d), 0);
});

test('a term can drop one date; a trial can move to another date with room', () => {
  let s = seedState(NOW);
  const term = s.bookings.find((b) => b.kind === 'term')!;
  s = cancel(s, term.id, term.dates[0]).state;
  const after = s.bookings.find((b) => b.id === term.id)!;
  assert.equal(after.status, 'booked');
  assert.equal(after.dates.length, TERM_WEEKS - 1);

  const trial = s.bookings.find((b) => b.kind === 'trial')!;
  const c = classById(trial.classId)!;
  const to = upcomingDates(c, NOW, 3)[2];
  const moved = reschedule(s, trial.id, trial.dates[0], to, NOW);
  assert.ok(moved.ok);
  assert.deepEqual(moved.state.bookings.find((b) => b.id === trial.id)!.dates, [to]);
  assert.equal(reschedule(moved.state, trial.id, to, to, NOW).ok, false);
  const full = classById('madal-b')!;
  const t2 = book(moved.state, { classId: full.id, kind: 'trial', dates: [upcomingDates(full, NOW, 1)[0]], who: 'Om' }, NOW);
  assert.equal(t2.booking?.status, 'waitlist');
});

test('the teacher scans the visitor’s pass once, on the right day only', () => {
  let s = seedState(NOW);
  const c = classById('adults-a')!;
  const d = upcomingDates(c, NOW, 1)[0];
  const r = book(s, { classId: c.id, kind: 'trial', dates: [d], who: 'Sita' }, NOW);
  s = r.state;
  const code = r.booking!.code;
  assert.equal(scanPass(s, code, addDays(d, 1), NOW).result, 'other-day');
  assert.equal(scanPass(s, 'AP-NOPE', d, NOW).result, 'unknown');
  const ok = scanPass(s, code, d, NOW);
  assert.equal(ok.result, 'ok');
  s = ok.state;
  assert.ok(isCheckedIn(s, r.booking!, d));
  assert.ok(presentIds(s, c, d, NOW).has(`b:${r.booking!.id}`));
  assert.equal(scanPass(s, code, d, NOW).result, 'already');
  // Tapping the name again un-marks them.
  s = togglePresent(s, c, d, `b:${r.booking!.id}`, NOW);
  assert.equal(isCheckedIn(s, r.booking!, d), false);
});

test('past sessions carry a plausible register; the week chart counts what the teacher marks', () => {
  const s = seedState(NOW);
  const mon = classById('harm-a')!; // Monday 2 Nov, already over
  const past = presentIds(s, mon, '2026-11-02', NOW);
  const expected = roster(s, mon, '2026-11-02').length;
  assert.ok(past.size > 0 && past.size <= expected);
  const week = weekAttendance(s, NOW);
  assert.equal(week.length, 7);
  assert.equal(week[0].present, past.size);
  const tue = classById('adults-a')!;
  const before = week[1].present;
  const s2 = togglePresent(s, tue, '2026-11-03', roster(s, tue, '2026-11-03')[0].id, NOW);
  assert.equal(weekAttendance(s2, NOW)[1].present, before + 1);
});

test('a teacher note reaches the student view; links and empty notes are refused', () => {
  let s = seedState(NOW);
  const r = postNote(s, 'kids-a', '  Bring your madal on Saturday ', NOW);
  assert.ok(r.note);
  s = r.state;
  assert.equal(notesForVisitor(s)[0].text, 'Bring your madal on Saturday');
  assert.ok(notesForVisitor(s)[0].at > s.seenAt, 'it shows as new');
  assert.equal(postNote(s, 'kids-a', 'see https://spam.example', NOW).note, undefined);
  assert.equal(postNote(s, 'kids-a', ' ', NOW).note, undefined);
  assert.equal(postNote(s, 'nope', 'Hello class', NOW).note, undefined);
  // A note to a class the visitor has not booked does not show on their side.
  const other = postNote(s, 'madal-b', 'Fast taal practice', NOW).state;
  assert.equal(notesForVisitor(other)[0].classId, 'kids-a');
});

test('stored state survives a reload; anything broken becomes a fresh seed', () => {
  const s = book(seedState(NOW), { classId: 'harm-a', kind: 'trial', dates: [upcomingDates(classById('harm-a')!, NOW, 1)[0]], who: 'Ram' }, NOW).state;
  const back = normalize(JSON.parse(JSON.stringify({ ...s, lang: 'ne' })), NOW);
  assert.equal(back.bookings.length, s.bookings.length);
  assert.equal(back.lang, 'ne');
  assert.equal(normalize(null, NOW).bookings.length, 2);
  assert.equal(normalize({ v: 1, lang: 'de' }, NOW).lang, 'de');
  assert.equal(normalize('garbage', NOW).bookings.length, 2);
  const tampered = normalize({ ...s, bookings: [...s.bookings, { id: 'x', classId: 'nope', dates: [], who: 'X' }] } as ClassesState, NOW);
  assert.equal(tampered.bookings.length, s.bookings.length);
});

test('every word the app can show is free of money, in all three languages', () => {
  const MONEY = /€|\beur\b|euro|price|prices|\bfee|\bfees\b|cost|pay|paid|quote|rate\b|package|hire|preis|gebühr|kosten|zahlung|bezahl|honorar|शुल्क|मूल्य|भुक्तानी|पैसा|रुपैयाँ|दाम/i;
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'string') assert.doesNotMatch(v, MONEY, path);
    else if (typeof v === 'function') {
      const out = (v as (...a: unknown[]) => unknown)('1', '2');
      if (typeof out === 'string') assert.doesNotMatch(out, MONEY, path);
    } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  for (const lang of ['en', 'ne', 'de'] as const) {
    walk(COPY[lang], lang);
    const t = COPY[lang];
    walk(t.remText({ who: 'A', cls: 'B', date: 'C', time: 'D', room: 'E', bring: 'F', code: 'G' }), `${lang}.remText`);
    for (const c of CLASSES) assert.ok(t.classes[c.id], `${lang} has words for ${c.id}`);
    assert.ok(fmtDate('2026-11-07', lang).length > 4);
  }
  assert.equal(fmtDate('2026-11-07', 'ne'), 'शनि, नोभेम्बर ७');
});
