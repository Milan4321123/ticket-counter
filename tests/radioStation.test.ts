/**
 * DUI KINARA RADIO (/work/radio) KNOWS WHAT IS ON AND WHERE YOU STOPPED.
 *
 * The made-up station's rules, without a browser: the week's programme
 * covers every minute exactly once and "on now" is right across days and
 * midnight (Friday Night Dohori runs into Saturday), in station time and in
 * Kathmandu time; the live stream is the same for everyone at the same
 * moment; a bar of music depends only on its style and number; an episode's
 * waveform only on its id; chapters, seeking, ±15 s and the resume spot;
 * requests and what comes back from localStorage — and that no word in any
 * language talks money, ads or donations.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DONE_WITHIN,
  FILLER,
  GRID_ROWS,
  REQ_LIMITS,
  RESUME_BACK,
  RESUME_MIN,
  SEGMENT_SEC,
  WEEK,
  addRequest,
  asSpeed,
  barEvents,
  barSec,
  chapterIndexAt,
  chapterSeek,
  cleanRequest,
  cleanSaved,
  clock,
  daySlots,
  emptySaved,
  episodeStyle,
  fractionToTime,
  gridRows,
  hhmm,
  inZone,
  listenersAt,
  liveSegment,
  nextChapterSeek,
  nextSpeed,
  onNow,
  prevChapterSeek,
  recordProgress,
  resumeFrom,
  segmentStyle,
  showTimes,
  skipBy,
  stingEvents,
  timeToFraction,
  tuneIndex,
  tzOffset,
  waveform,
  zonedClock,
  type ShowId,
} from '../src/app/work/radio/radio.ts';
import { COPY, EPISODES, FRAME, HOSTS, SEED_REQUESTS, SHOWS, TUNES, count, dateLabel, num, type Lang } from '../src/app/work/radio/content.ts';

const LANGS: Lang[] = ['en', 'de', 'ne'];
const MON = 0;
const FRI = 4;
const SAT = 5;
const SUN = 6;
const at = (h: number, m = 0) => h * 60 + m;

// ---------- the programme ----------

test('every minute of every day is covered exactly once (late shows spill into the next day)', () => {
  for (let d = 0; d < 7; d++) {
    const covered = new Array(1440).fill(0);
    for (const s of daySlots(d)) for (let m = s.start; m < Math.min(1440, s.end); m++) covered[m]++;
    // Last night's slot that runs past midnight covers the start of today.
    for (const s of daySlots((d + 6) % 7)) for (let m = 1440; m < s.end; m++) covered[m - 1440]++;
    assert.deepEqual(
      covered.map((c, m) => [m, c]).filter(([, c]) => c !== 1),
      [],
      `day ${d}`
    );
    const slots = daySlots(d);
    for (let i = 1; i < slots.length; i++) assert.equal(slots[i].start, slots[i - 1].end, `day ${d} slot ${i} is contiguous`);
  }
});

test('the listed shows never overlap and every show has words, hosts and colours', () => {
  for (let d = 0; d < 7; d++) {
    const real = daySlots(d).filter((s) => !s.filler);
    for (let i = 1; i < real.length; i++) assert.ok(real[i].start >= real[i - 1].end, `day ${d}: ${real[i - 1].show} / ${real[i].show}`);
  }
  for (const def of WEEK) {
    const s = SHOWS[def.show];
    assert.ok(s, def.show);
    assert.ok(s.hosts.length >= 1, `${def.show} has a host`);
  }
  assert.deepEqual(SHOWS[FILLER].hosts, []);
  assert.ok(showTimes('geet').length === 7, 'Lok Geet Hour is daily');
});

test('on now: a weekday morning, the evening, and nothing on → the mix', () => {
  const morning = onNow(MON, at(7, 15));
  assert.equal(morning.slot.show, 'bihani');
  assert.equal(morning.left, 105);
  assert.equal(Math.round(morning.progress * 100), 30);
  assert.equal(morning.next.show, FILLER);
  assert.equal(morning.nextShow.show, 'geet', 'up next skips the mix');

  assert.equal(onNow(MON, at(19, 30)).slot.show, 'diaspora');
  assert.equal(onNow(1, at(19, 30)).slot.show, 'sanjh');
  assert.equal(onNow(MON, at(10)).slot.show, FILLER);
  assert.equal(onNow(SAT, at(10, 44)).slot.show, 'katha');
  assert.equal(onNow(SAT, at(10, 45)).slot.show, FILLER, 'the end minute belongs to the next slot');
});

test('on now across midnight: Friday Night Dohori runs until 00:30 on Saturday', () => {
  const late = onNow(FRI, at(23, 30));
  assert.equal(late.slot.show, 'dohori');
  assert.equal(late.left, 60);
  const afterMidnight = onNow(SAT, at(0, 15));
  assert.equal(afterMidnight.slot.show, 'dohori', 'still Friday’s show');
  assert.equal(afterMidnight.slot.day, FRI);
  assert.equal(afterMidnight.left, 15);
  assert.ok(afterMidnight.progress > 0.9 && afterMidnight.progress < 1);
  assert.equal(onNow(SAT, at(0, 30)).slot.show, FILLER);
  assert.equal(onNow(SAT, at(0, 30)).nextShow.show, 'bhajan');
  // Saturday's first slot starts where the dohori ends.
  assert.equal(daySlots(SAT)[0].start, 30);
});

test('on now across the week’s end: Sunday night → Monday’s morning show, the mix is one stretch', () => {
  const sun = onNow(SUN, at(23, 59));
  assert.equal(sun.slot.show, FILLER);
  assert.equal(sun.nextShow.show, 'bihani');
  assert.equal(sun.nextShow.day, MON);
  assert.equal(sun.left, 1 + at(6, 30), 'the mix runs on until 06:30 on Monday');
  const monNight = onNow(MON, at(3));
  assert.equal(monNight.slot.show, FILLER);
  assert.equal(monNight.nextShow.show, 'bihani');
  assert.equal(monNight.left, at(3, 30));
});

test('station clock and Kathmandu time, winter and summer', () => {
  // Tue 3 Nov 2026 12:00 UTC = 13:00 in Berlin (CET).
  const winter = new Date(Date.UTC(2026, 10, 3, 12, 0, 30));
  assert.deepEqual(zonedClock(winter), { day: 1, minute: at(13), second: 30 });
  assert.equal(tzOffset(winter, 'Europe/Berlin'), 60);
  assert.equal(tzOffset(winter, 'Asia/Kathmandu'), 345);
  assert.deepEqual(inZone(at(7), winter, 'Asia/Kathmandu'), { label: '11:45', dayShift: 0 });
  assert.deepEqual(inZone(at(21), winter, 'Asia/Kathmandu'), { label: '01:45', dayShift: 1 });
  // Wed 1 Jul 2026 12:00 UTC = 14:00 in Berlin (CEST), Kathmandu 3 h 45 ahead.
  const summer = new Date(Date.UTC(2026, 6, 1, 12, 0));
  assert.deepEqual(zonedClock(summer), { day: 2, minute: at(14), second: 0 });
  assert.equal(tzOffset(summer, 'Europe/Berlin'), 120);
  assert.deepEqual(inZone(at(7), summer, 'Asia/Kathmandu'), { label: '10:45', dayShift: 0 });
  // Midnight in Berlin is still the right weekday.
  assert.deepEqual(zonedClock(new Date(Date.UTC(2026, 10, 6, 23, 10))), { day: SAT, minute: at(0, 10), second: 0 });
  assert.equal(onNow(SAT, at(0, 10)).slot.show, 'dohori');
});

test('clock labels', () => {
  assert.equal(hhmm(0), '00:00');
  assert.equal(hhmm(at(6, 30)), '06:30');
  assert.equal(hhmm(1470), '00:30');
  assert.equal(clock(0), '0:00');
  assert.equal(clock(65), '1:05');
  assert.equal(clock(3725), '1:02:05');
  assert.equal(clock(-3), '0:00');
});

test('the week grid places slots between 06:00 and 01:00', () => {
  const bihani = daySlots(MON).find((s) => s.show === 'bihani')!;
  assert.deepEqual(gridRows(bihani), { from: 2, to: 7 });
  const dohori = daySlots(FRI).find((s) => s.show === 'dohori')!;
  assert.deepEqual(gridRows(dohori), { from: 31, to: 38 });
  assert.deepEqual(gridRows(daySlots(MON)[0]), { from: 1, to: 2 }, 'the night mix shows only from 06:00');
  assert.equal(gridRows({ show: FILLER, day: MON, start: at(2), end: at(5), filler: true }), null, 'before 06:00 it is off the grid');
  assert.equal(GRID_ROWS, 38);
});

// ---------- the live stream ----------

test('live segments come from the wall clock: same moment, same segment and tune', () => {
  const ms = Date.UTC(2026, 10, 3, 18, 0, 0);
  const a = liveSegment(ms);
  assert.equal(a.endMs - a.startMs, SEGMENT_SEC * 1000);
  assert.ok(a.startMs <= ms && ms < a.endMs);
  assert.deepEqual(liveSegment(a.startMs), a);
  assert.equal(liveSegment(a.endMs).index, a.index + 1);
  assert.deepEqual(segmentStyle(a.index, 'mix'), segmentStyle(a.index, 'mix'));
  assert.equal(segmentStyle(a.index, 'dohori').meter, 6, 'dohori sways in six');
  assert.equal(segmentStyle(a.index, 'diaspora').drums, 0, 'no drum under talk');
  const t = tuneIndex(a.index, TUNES.length);
  assert.ok(t >= 0 && t < TUNES.length);
  const many = new Set(Array.from({ length: 40 }, (_, i) => tuneIndex(i, TUNES.length)));
  assert.ok(many.size >= 5, 'the tunes vary');
});

test('a bar depends only on its style and number; A A′ B A, every event inside the bar', () => {
  for (const show of ['bihani', 'geet', 'dohori', 'mix', 'katha'] as ShowId[]) {
    const s = segmentStyle(123, show);
    const len = barSec(s);
    for (let bar = 0; bar < 40; bar++) {
      const evs = barEvents(s, bar);
      assert.deepEqual(evs, barEvents(s, bar), `${show} bar ${bar} is deterministic`);
      for (const e of evs) {
        assert.ok(e.at >= 0 && e.at < len + 1e-9, `${show} bar ${bar}: event at ${e.at} inside ${len}`);
        assert.ok(e.dur > 0 && e.vel > 0);
      }
    }
  }
  const s = segmentStyle(7, 'geet');
  const lead = (b: number) => barEvents(s, b).filter((e) => e.kind === 'lead');
  assert.deepEqual(lead(1), lead(5), 'A and A′ share the tune');
  assert.deepEqual(lead(0), lead(12), 'A comes back after B');
  assert.ok([8, 9, 10, 11].some((b) => JSON.stringify(lead(b)) !== JSON.stringify(lead(b - 8))), 'B is a different tune');
  assert.ok(barEvents(s, 0).some((e) => e.kind === 'dhin'), 'the madal plays');
  assert.equal(stingEvents().at(-1)!.kind, 'chime');
});

// ---------- episodes ----------

test('waveforms are drawn from the id alone', () => {
  const a = waveform('home-language', 120);
  assert.equal(a.length, 120);
  assert.deepEqual(a, waveform('home-language', 120));
  assert.notDeepEqual(a, waveform('frog-rain', 120));
  for (const v of a) assert.ok(v >= 0.12 && v <= 1, String(v));
  assert.ok(new Set(a).size > 30, 'it has a shape');
  assert.equal(waveform('x', 60).length, 60);
});

test('chapters: which one is playing, where a click seeks, previous / next', () => {
  const ch = [{ at: 0 }, { at: 150 }, { at: 520 }, { at: 980 }];
  const dur = 1200;
  assert.equal(chapterIndexAt(ch, 0), 0);
  assert.equal(chapterIndexAt(ch, 149.9), 0);
  assert.equal(chapterIndexAt(ch, 150), 1);
  assert.equal(chapterIndexAt(ch, 5000), 3);
  assert.equal(chapterSeek(ch, 2, dur), 520);
  assert.equal(chapterSeek(ch, 9, dur), 980, 'clamped to the last chapter');
  assert.equal(chapterSeek(ch, -1, dur), 0);
  assert.equal(chapterSeek([{ at: 0 }, { at: 2000 }], 1, dur), dur - 1, 'never past the end');
  assert.equal(prevChapterSeek(ch, 600, dur), 520, 'back to the start of this chapter');
  assert.equal(prevChapterSeek(ch, 521, dur), 150, 'just started it: the one before');
  assert.equal(prevChapterSeek(ch, 1, dur), 0);
  assert.equal(nextChapterSeek(ch, 600, dur), 980);
  assert.equal(nextChapterSeek(ch, 990, dur), null);
});

test('seeking: a point on the waveform, ±15 s, kept inside the episode', () => {
  assert.equal(fractionToTime(0.5, 1470), 735);
  assert.equal(fractionToTime(-0.2, 1470), 0);
  assert.equal(fractionToTime(1.4, 1470), 1470);
  assert.equal(fractionToTime(NaN, 1470), 0);
  assert.equal(timeToFraction(735, 1470), 0.5);
  assert.equal(timeToFraction(10, 0), 0);
  assert.equal(skipBy(100, 15, 1470), 115);
  assert.equal(skipBy(10, -15, 1470), 0);
  assert.equal(skipBy(1465, 15, 1470), 1469.5);
  assert.equal(asSpeed(1.25), 1.25);
  assert.equal(asSpeed(2), 1);
  assert.equal(nextSpeed(1.5), 1);
});

test('resume: remember the spot, pick up a little before it, forget it near the ends', () => {
  const dur = 1470;
  let m = recordProgress({}, 'ep', 5, dur);
  assert.deepEqual(m, {}, 'barely started: nothing to remember');
  m = recordProgress(m, 'ep', 600.4, dur);
  assert.deepEqual(m.ep, { pos: 600, done: false });
  assert.equal(resumeFrom(m.ep, dur), 600 - RESUME_BACK);
  m = recordProgress(m, 'ep', dur - DONE_WITHIN + 1, dur);
  assert.deepEqual(m.ep, { pos: 0, done: true }, 'near the end counts as finished');
  assert.equal(resumeFrom(m.ep, dur), 0, 'a finished episode starts from the top');
  m = recordProgress(m, 'ep', 300, dur);
  assert.deepEqual(m.ep, { pos: 300, done: true }, 'played again: the spot is kept, so is "played"');
  m = recordProgress(m, 'ep', 2, dur);
  assert.deepEqual(m.ep, { pos: 0, done: true });
  assert.equal(resumeFrom(undefined, dur), 0);
  assert.equal(resumeFrom({ pos: RESUME_MIN - 1, done: false }, dur), 0);
  assert.equal(resumeFrom({ pos: NaN, done: false }, dur), 0);
  assert.equal(recordProgress(m, 'ep', NaN, dur), m);
  const other = recordProgress({}, 'a', 100, dur);
  assert.deepEqual(Object.keys(recordProgress(other, 'b', 200, dur)).sort(), ['a', 'b']);
});

test('every episode: chapters from 0, in order, inside it; its style is steady', () => {
  const ids = new Set<string>();
  for (const e of EPISODES) {
    assert.ok(!ids.has(e.id), e.id);
    ids.add(e.id);
    assert.equal(e.chapters[0].at, 0);
    for (let i = 1; i < e.chapters.length; i++) assert.ok(e.chapters[i].at > e.chapters[i - 1].at, `${e.id} chapter ${i}`);
    assert.ok(e.chapters.at(-1)!.at < e.dur - 30, `${e.id}: the last chapter has room`);
    assert.ok(SHOWS[e.show].hosts.length > 0);
    assert.deepEqual(episodeStyle(e.id), episodeStyle(e.id));
    assert.match(e.date, /^2026-\d\d-\d\d$/);
    for (const l of LANGS) {
      assert.ok(e.title[l] && e.desc[l], `${e.id} ${l}`);
      for (const c of e.chapters) assert.ok(c.title[l], `${e.id} chapter ${l}`);
      for (const n of e.notes) assert.ok(n[l], `${e.id} note ${l}`);
    }
  }
});

// ---------- listeners, requests, saved state ----------

test('the simulated listener count is steady for a moment and differs by show', () => {
  const ms = Date.UTC(2026, 10, 6, 21, 0, 2);
  assert.equal(listenersAt(ms, 'dohori'), listenersAt(ms + 1000, 'dohori'), 'same 5-second window');
  assert.ok(listenersAt(ms, 'dohori') > listenersAt(ms, 'mix'));
  for (let i = 0; i < 50; i++) assert.ok(listenersAt(ms + i * 60_000, 'mix') >= 12);
});

test('requests: a song needs a tune, a shout-out a message; text is tidied and capped', () => {
  assert.deepEqual(cleanRequest({ kind: 'song', tune: '' }, TUNES.length, 1), { ok: false, error: 'tune' });
  assert.deepEqual(cleanRequest({ kind: 'song', tune: 99 }, TUNES.length, 1), { ok: false, error: 'tune' });
  assert.deepEqual(cleanRequest({ kind: 'shout', msg: '   ' }, TUNES.length, 1), { ok: false, error: 'msg' });
  const r = cleanRequest({ kind: 'song', tune: '3', name: '  Mina \n K ', town: 'Wien', msg: 'x'.repeat(500) }, TUNES.length, 1000);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.req.tune, 3);
  assert.equal(r.req.name, 'Mina K');
  assert.equal(r.req.msg.length, REQ_LIMITS.msg);
  const shout = cleanRequest({ kind: 'shout', tune: 2, msg: 'Namaste!' }, TUNES.length, 2000);
  assert.ok(shout.ok && shout.req.tune === null, 'a shout-out carries no tune');
  let list: ReturnType<typeof addRequest> = [];
  for (let i = 0; i < 20; i++) {
    const x = cleanRequest({ kind: 'shout', msg: `m${i}` }, TUNES.length, i + 1);
    if (x.ok) list = addRequest(list, x.req);
  }
  assert.equal(list.length, REQ_LIMITS.keep);
  assert.equal(list[0].msg, 'm19', 'newest first');
});

test('what comes back from localStorage is cleaned', () => {
  const ids = EPISODES.map((e) => e.id);
  assert.deepEqual(cleanSaved(null, ids, TUNES.length), emptySaved());
  assert.deepEqual(cleanSaved('nope', ids, TUNES.length), emptySaved());
  const s = cleanSaved(
    {
      vol: 7,
      speed: 3,
      progress: { [ids[0]]: { pos: 123.6, done: 'yes' }, ghost: { pos: 5 }, [ids[1]]: null },
      reqs: [{ kind: 'shout', msg: 'hi', at: 5, id: 'r1' }, { kind: 'song', tune: 42 }, 'junk'],
      remind: ['geet', 'geet', 'mix', 'nonsense'],
    },
    ids,
    TUNES.length
  );
  assert.equal(s.vol, 1);
  assert.equal(s.speed, 1);
  assert.deepEqual(s.progress, { [ids[0]]: { pos: 124, done: false } });
  assert.equal(s.reqs.length, 1);
  assert.equal(s.reqs[0].id, 'r1');
  assert.deepEqual(s.remind, ['geet']);
});

// ---------- words ----------

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') {
    const r = (v as (...a: string[]) => unknown)('X', 'Y');
    if (typeof r === 'string') out.push(r);
  } else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
  return out;
}

test('every interface string exists in all three languages', () => {
  const keys = (o: object) => Object.keys(o).sort();
  for (const l of LANGS) {
    assert.deepEqual(keys(COPY[l]), keys(COPY.en), l);
    assert.deepEqual(keys(FRAME[l]), keys(FRAME.en), l);
    for (const s of strings(COPY[l])) assert.ok(s.trim(), `${l}: empty string`);
    assert.equal(COPY[l].daysShort.length, 7);
    assert.equal(COPY[l].months.length, 12);
  }
  assert.equal(FRAME.en.talk, 'Kura garau');
  assert.match(FRAME.en.endH, /radio or podcast/);
  assert.equal(dateLabel('2026-10-28', 'en'), '28 Oct 2026');
  assert.equal(dateLabel('2026-10-28', 'de'), '28. Okt. 2026');
  assert.equal(dateLabel('2026-10-28', 'ne'), 'अक्टोबर २८, २०२६');
  assert.equal(num('07:30', 'ne'), '०७:३०');
  assert.equal(count(1234, 'de'), '1.234');
  assert.equal(count(1234, 'ne'), '१,२३४');
});

test('made-up people: hosts are first names only, requests too', () => {
  for (const h of Object.values(HOSTS)) {
    assert.match(h.name.en, /^[A-Z][a-z]+( Didi)?$/, h.name.en);
  }
  for (const r of SEED_REQUESTS) assert.match(r.name, /^[A-Z][a-z]+( & [A-Z][a-z]+)?$/);
});

test('no money, ads or donation words in any language (free while we grow)', () => {
  const MONEY =
    /€|\$\s?\d|\beuros?\b|\bprice|\bpricing|\bfees?\b|\bcosts?\b|\bquotes?\b|\brates?\b|\bpackages?\b|\bhire|\binvoice|\bbudget|\bdonat|\bsponsor|\badverti|\bads?\b|\bbuy\b|\bpaid\b|preis|gebühr|\bkosten\b|\bkostet\b|angebot|honorar|\bpaket|rechnung|spende|werbung|anzeige|(?<!निः)शुल्क|मूल्य|रुपैयाँ|भाडा|बजेट|प्याकेज|चन्दा|विज्ञापन|प्रायोजक/i;
  const all = [...strings(COPY), ...strings(SHOWS), ...strings(EPISODES), ...strings(TUNES), ...strings(SEED_REQUESTS)];
  const bad = all.filter((s) => MONEY.test(s));
  assert.deepEqual(bad, []);
  for (const l of LANGS) {
    const frame = strings(FRAME[l]).filter((s) => s !== FRAME[l].free);
    assert.deepEqual(frame.filter((s) => MONEY.test(s)), [], l);
  }
  assert.ok(all.length > 300);
});
