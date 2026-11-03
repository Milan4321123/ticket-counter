/**
 * KA KHA GA (/work/abc) TEACHES THE RIGHT LETTERS AND COUNTS FAIRLY.
 *
 * A kids' Nepali alphabet app is only as good as its letters: these pin the
 * 13 vowels and 36 consonants (unique, in primer order, क्ष त्र ज्ञ at the
 * end), that every example word really starts with its letter — read as a
 * child reads, by syllable, with Intl.Segmenter and with the fallback — or,
 * for ङ ञ ण अः which no word starts with, carries it inside. Then the
 * syllable split the word game relies on, the tracing score (coverage and ink
 * outside the letter) and its stars, the games' rounds, progress, stickers and
 * the day streak, cleaning what comes back from localStorage, picking a voice
 * that never leaves the device — and that no word in any language talks money.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILD_WORDS,
  CONSONANTS,
  GRID,
  LETTERS,
  STICKERS,
  VOWELS,
  aksharas,
  baseLetter,
  buildCorrect,
  buildRound,
  cleanName,
  dilate,
  emptyMask,
  findRound,
  firstLetter,
  fresh,
  graphemes,
  hasLetterInside,
  highlightIndex,
  markDay,
  matchRound,
  newStickers,
  nextStickerIn,
  normalize,
  pickVoice,
  points,
  rasterize,
  recordTrace,
  recordWin,
  rng,
  scoreTrace,
  stickersUnlocked,
  streak,
  totalStars,
  traceHint,
  traceStars,
  type Mask,
} from '../src/app/work/abc/abc.ts';
import { COPY, FRAME, type Lang } from '../src/app/work/abc/content.ts';

const PRIMER_VOWELS = 'अ आ इ ई उ ऊ ऋ ए ऐ ओ औ अं अः'.split(' ');
const PRIMER_CONSONANTS = 'क ख ग घ ङ च छ ज झ ञ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह क्ष त्र ज्ञ'.split(' ');

test('the alphabet: 13 vowels and 36 consonants, unique, in primer order', () => {
  assert.equal(VOWELS.length, 13);
  assert.equal(CONSONANTS.length, 36);
  assert.deepEqual(
    VOWELS.map((l) => l.ch),
    PRIMER_VOWELS
  );
  assert.deepEqual(
    CONSONANTS.map((l) => l.ch),
    PRIMER_CONSONANTS
  );
  assert.equal(new Set(LETTERS.map((l) => l.ch)).size, 49);
  assert.equal(new Set(LETTERS.map((l) => l.word)).size, 49, 'every example word is different');
  assert.equal(new Set(LETTERS.map((l) => l.pic)).size, 49, 'every picture is different');
  for (const l of VOWELS) assert.equal(l.kind, 'vowel');
  for (const l of CONSONANTS) assert.equal(l.kind, 'consonant');
  for (const l of LETTERS) {
    assert.match(l.word, /^[ऀ-ॿ]+$/, `${l.word} is plain Devanagari`);
    assert.ok(l.tr && l.wordTr && l.en && l.de, `${l.ch} has its words`);
  }
});

test('every example word starts with its letter (by syllable, both segmenters)', () => {
  for (const useIntl of [true, false]) {
    for (const l of LETTERS) {
      if (l.inside) continue;
      assert.equal(firstLetter(l.word, useIntl), l.ch, `${l.ch} → ${l.word} (intl ${useIntl})`);
    }
  }
  // the near misses that must NOT count: क्ष is not क, अं is not अ
  assert.equal(firstLetter('क्षितिज'), 'क्ष');
  assert.equal(firstLetter('अंगुर'), 'अं');
  assert.equal(firstLetter('त्रिशूल'), 'त्र');
  assert.equal(firstLetter('आँप'), 'आ');
  assert.equal(firstLetter('दाँत'), 'द');
  assert.notEqual(firstLetter('क्षितिज'), 'क');
  assert.notEqual(firstLetter('अंगुर'), 'अ');
});

test('ङ ञ ण अः: no word starts with them, so the example carries them inside', () => {
  const inside = LETTERS.filter((l) => l.inside).map((l) => l.ch);
  assert.deepEqual(inside.sort(), ['अः', 'ङ', 'ञ', 'ण'].sort());
  for (const useIntl of [true, false])
    for (const l of LETTERS.filter((x) => x.inside)) {
      assert.ok(hasLetterInside(l.word, l.ch, useIntl), `${l.ch} in ${l.word}`);
      assert.notEqual(firstLetter(l.word, useIntl), l.ch);
    }
  const nga = LETTERS.find((l) => l.ch === 'ङ')!;
  assert.equal(highlightIndex(nga), 1); // प · ङ्खा
  assert.equal(highlightIndex(LETTERS.find((l) => l.ch === 'क')!), 0);
});

test('syllables: conjuncts stay together, matras and marks ride along', () => {
  const cases: [string, string[]][] = [
    ['घर', ['घ', 'र']],
    ['कमल', ['क', 'म', 'ल']],
    ['नमस्ते', ['न', 'म', 'स्ते']],
    ['हात्ती', ['हा', 'त्ती']],
    ['पङ्खा', ['प', 'ङ्खा']],
    ['षट्कोण', ['ष', 'ट्को', 'ण']],
    ['आँप', ['आँ', 'प']],
    ['अंगुर', ['अं', 'गु', 'र']],
    ['छः', ['छः']],
    ['क्षितिज', ['क्षि', 'ति', 'ज']],
    ['ज्ञानी', ['ज्ञा', 'नी']],
  ];
  for (const [w, parts] of cases) {
    assert.deepEqual(aksharas(w, true), parts, `${w} (intl)`);
    assert.deepEqual(aksharas(w, false), parts, `${w} (fallback)`);
  }
  // the fallback groups marks onto their base even without Intl
  assert.deepEqual(graphemes('कि', false), ['कि']);
  assert.equal(baseLetter('क्षि'), 'क्ष');
  assert.equal(baseLetter('कि'), 'क');
  assert.equal(baseLetter('अः'), 'अः');
});

test('word game: every word comes apart and back together the same way', () => {
  for (const w of BUILD_WORDS) {
    const a = aksharas(w.word, true);
    assert.deepEqual(aksharas(w.word, false), a, w.word);
    assert.equal(a.join(''), w.word);
    assert.ok(a.length >= 2 && a.length <= 4, `${w.word} is short`);
  }
  for (let seed = 1; seed < 60; seed++) {
    const round = buildRound(rng(seed));
    assert.equal(round.length, 3);
    for (let i = 1; i < round.length; i++) assert.ok(round[i].answer.length >= round[i - 1].answer.length, 'shortest first');
    for (const task of round) {
      for (const piece of task.answer) assert.ok(task.tiles.includes(piece), `${task.word} has ${piece}`);
      assert.ok(task.tiles.length > task.answer.length, 'there are extra tiles');
      assert.ok(buildCorrect(task, task.answer));
      assert.ok(!buildCorrect(task, [...task.answer].reverse()) || task.answer.length === 1 || task.answer[0] === task.answer[task.answer.length - 1]);
      assert.ok(!buildCorrect(task, task.answer.slice(1)));
    }
  }
  const t = { word: 'टमाटर', answer: aksharas('टमाटर'), tiles: [] };
  assert.ok(buildCorrect(t, ['ट', 'मा', 'ट', 'र']));
  assert.ok(!buildCorrect(t, ['मा', 'ट', 'ट', 'र']));
});

// ---- tracing ----

/** A thick "L" on a GRID × GRID mask, like a letter's guide. */
function lGuide(): Mask {
  const m = emptyMask(GRID);
  for (let y = 10; y < 54; y++) for (let x = 14; x < 22; x++) m.d[y * GRID + x] = 1;
  for (let y = 46; y < 54; y++) for (let x = 14; x < 50; x++) m.d[y * GRID + x] = 1;
  return m;
}
const g = (x: number, y: number) => ({ x: x / GRID, y: y / GRID });

test('tracing: going over the letter covers it and earns three stars', () => {
  const guide = lGuide();
  const ink = rasterize([[g(18, 11), g(18, 50), g(49, 50)]]);
  const s = scoreTrace(guide, ink);
  assert.ok(s.coverage > 0.8, `coverage ${s.coverage}`);
  assert.ok(s.outside < 0.05, `outside ${s.outside}`);
  assert.equal(traceStars(s), 3);
  assert.equal(traceHint(s), 'great');
});

test('tracing: half the letter is fewer stars, scribbling off it is none', () => {
  const guide = lGuide();
  const half = scoreTrace(guide, rasterize([[g(18, 11), g(18, 50)]]));
  assert.ok(half.coverage > 0.3 && half.coverage < 0.66, `half ${half.coverage}`);
  assert.ok(traceStars(half) >= 1 && traceStars(half) < 3);
  assert.equal(traceHint(half), 'more');

  const off = scoreTrace(guide, rasterize([[g(40, 8), g(60, 30)], [g(60, 8), g(40, 30)]]));
  assert.equal(off.coverage, 0);
  assert.ok(off.outside > 0.95);
  assert.equal(traceStars(off), 0);
  assert.equal(traceHint(off), 'inside');

  // a full cover with a big scribble beside it loses stars for the ink outside
  const messy = scoreTrace(guide, rasterize([[g(18, 11), g(18, 50), g(49, 50)], [g(30, 5), g(60, 5), g(60, 35), g(30, 35), g(30, 5), g(60, 35)]]));
  assert.ok(messy.coverage > 0.8);
  assert.ok(traceStars(messy) < 3, `messy got ${traceStars(messy)}`);

  // nothing drawn is nothing earned
  assert.equal(traceStars(scoreTrace(guide, emptyMask(GRID))), 0);
  assert.throws(() => scoreTrace(guide, emptyMask(10)));
});

test('tracing math: rasterize, dilate and the score are plain counting', () => {
  const dot = rasterize([[{ x: 0.5, y: 0.5 }]], 20, 0.1);
  let n = 0;
  for (const v of dot.d) n += v;
  assert.ok(n >= 9 && n <= 16, `a dot of radius 2 cells is ${n} cells`);
  const one = emptyMask(5);
  one.d[12] = 1;
  const grown = dilate(one, 1);
  assert.equal(
    grown.d.reduce((a, b) => a + b, 0),
    9
  );
  assert.equal(dilate(one, 0).d.reduce((a, b) => a + b, 0), 1);
  const guide = emptyMask(4);
  guide.d.fill(1);
  const s = scoreTrace(guide, guide, 0);
  assert.equal(s.coverage, 1);
  assert.equal(s.outside, 0);
  assert.equal(s.guideCells, 16);
});

// ---- games ----

test('find the letter: five different letters, each among four different balloons', () => {
  for (let seed = 1; seed < 80; seed++) {
    const qs = findRound(rng(seed));
    assert.equal(qs.length, 5);
    assert.equal(new Set(qs.map((q) => q.target)).size, 5);
    for (const q of qs) {
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4);
      assert.ok(q.options.includes(q.target));
    }
  }
  assert.deepEqual(findRound(rng(7)), findRound(rng(7)), 'seeded');
});

test('match the picture: three letters whose words start with them', () => {
  for (let seed = 1; seed < 80; seed++) {
    const ls = matchRound(rng(seed));
    assert.equal(ls.length, 3);
    assert.equal(new Set(ls).size, 3);
    for (const ch of ls) {
      const l = LETTERS.find((x) => x.ch === ch)!;
      assert.ok(!l.inside, `${ch} is not an inside-the-word letter`);
    }
  }
});

// ---- progress ----

test('stars keep the best go, games count rounds, points fill the sticker book', () => {
  let p = fresh('en');
  p = recordTrace(p, 'क', 2, '2026-11-03');
  p = recordTrace(p, 'क', 1, '2026-11-03');
  assert.equal(p.stars['क'], 2, 'a worse go never takes stars away');
  p = recordTrace(p, 'क', 3, '2026-11-03');
  p = recordTrace(p, 'ख', 0, '2026-11-03');
  assert.equal(p.stars['ख'], undefined, 'no stars, no entry');
  assert.equal(recordTrace(p, 'Q', 3, '2026-11-03'), p, 'unknown letters are ignored');
  p = recordWin(p, 'find', '2026-11-03');
  p = recordWin(p, 'build', '2026-11-04');
  assert.equal(totalStars(p), 3);
  assert.equal(points(p), 3 + 2 * 2);
  assert.equal(stickersUnlocked(points(p)), 2);
  assert.equal(nextStickerIn(points(p)), 1);
  assert.equal(newStickers(p), 2);
  assert.equal(newStickers({ ...p, seen: 2 }), 0);
  assert.deepEqual(p.days, ['2026-11-03', '2026-11-04']);
});

test('sticker thresholds rise and the book can be filled', () => {
  assert.equal(STICKERS.length, 12);
  assert.equal(new Set(STICKERS.map((s) => s.id)).size, 12);
  for (let i = 1; i < STICKERS.length; i++) assert.ok(STICKERS[i].at > STICKERS[i - 1].at);
  assert.equal(stickersUnlocked(0), 0);
  assert.equal(stickersUnlocked(1), 1);
  assert.equal(stickersUnlocked(10_000), 12);
  assert.equal(nextStickerIn(10_000), null);
  // all 49 letters at three stars alone fill most of the book; games do the rest
  assert.ok(STICKERS[STICKERS.length - 1].at <= 49 * 3);
});

test('streak: days in a row up to today, or up to yesterday before today’s go', () => {
  const days = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
  assert.equal(streak(days, '2026-11-02'), 4);
  assert.equal(streak(days, '2026-11-03'), 4, 'still alive before today’s practice');
  assert.equal(streak(days, '2026-11-04'), 0, 'a missed day ends it');
  assert.equal(streak([...days, '2026-11-03'], '2026-11-03'), 5);
  assert.equal(streak(['2026-02-28', '2026-03-01'], '2026-03-01'), 2, 'across a month end');
  assert.equal(streak(['2026-12-31', '2027-01-01'], '2027-01-01'), 2, 'across a year end');
  assert.equal(streak([], '2026-11-03'), 0);
  const p = markDay(markDay(fresh('de'), '2026-11-03'), '2026-11-03');
  assert.deepEqual(p.days, ['2026-11-03']);
});

test('stored progress is cleaned: junk out, an optional first name only', () => {
  const p = normalize(
    {
      lang: 'ne',
      name: '  Asha <script>  123 ',
      stars: { क: 3, ख: 7, X: 2, ग: '3', घ: 1 },
      wins: { find: 2.7, match: -1, build: 'x' },
      days: ['2026-11-01', 'yesterday', '2026-11-01', '2026-10-31'],
      sound: false,
      seen: 99,
      extra: 'dropped',
    },
    'en'
  );
  assert.equal(p.lang, 'ne');
  assert.equal(p.name, 'Asha script');
  assert.deepEqual(p.stars, { क: 3, घ: 1 });
  assert.deepEqual(p.wins, { find: 2, match: 0, build: 0 });
  assert.deepEqual(p.days, ['2026-10-31', '2026-11-01']);
  assert.equal(p.sound, false);
  assert.equal(p.seen, 12);
  assert.ok(!('extra' in p));
  assert.deepEqual(normalize(null, 'de'), fresh('de'));
  assert.deepEqual(normalize('nonsense', 'en'), fresh('en'));
  assert.equal(cleanName('Sita-Maya'), 'Sita-Maya');
  assert.equal(cleanName('सीता'), 'सीता');
  assert.equal(cleanName('a'.repeat(40)).length, 20);
  assert.equal(cleanName(42), '');
});

test('speech: a Nepali voice first, then Hindi, never a voice from a speech server', () => {
  const ne = { lang: 'ne-NP', name: 'Nepali', localService: true };
  const hi = { lang: 'hi-IN', name: 'Lekha', localService: true };
  const hiNet = { lang: 'hi-IN', name: 'Google हिन्दी', localService: false };
  const en = { lang: 'en-GB', name: 'Daniel', localService: true };
  assert.deepEqual(pickVoice([en, hi, ne]), { voice: ne, kind: 'ne' });
  assert.deepEqual(pickVoice([en, hi]), { voice: hi, kind: 'hi' });
  assert.deepEqual(pickVoice([en, hiNet]), { voice: null, kind: 'none' });
  assert.deepEqual(pickVoice([]), { voice: null, kind: 'none' });
  assert.equal(pickVoice([{ lang: 'ne_NP', name: 'x' }]).kind, 'ne');
});

// ---- words ----

const MONEY =
  /€|\$|\beur\b|euro|\bprices?\b|\bprize|\bfees?\b|\bcosts?\b|\bpay|\bpaid\b|\bcash|\bquotes?\b|\brates?\b|\bpackages?\b|\bhire|\btips?\b|\bfree\b|discount|\bdeal\b|voucher|coupon|\bcoins?\b|\bbuy|purchase|\bshop|\bsubscri|premium|unlock|\bads?\b|advert|in-app|\bbets?\b|\bodds\b|jackpot|preis|gebühr|kosten|gratis|rabatt|gutschein|zahlung|zahlen|bezahl|honorar|konto|summe|\btipp|quote|prämie|münze|kauf|\babo\b|werbung|शुल्क|मूल्य|भुक्तानी|पैसा|रुपैयाँ|दाम|टिप|छुट|निःशुल्क|सित्तै|सिक्का|किन्|बेच|विज्ञापन|नगद|इनाम|राशि/i;

function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (typeof v === 'function') {
    const out = (v as (...a: string[]) => unknown)('7', '8', '9');
    return typeof out === 'string' ? [out] : [];
  }
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === 'object') return Object.values(v).flatMap(strings);
  return [];
}

test('no money, purchases, coins or ads anywhere, in all three languages', () => {
  for (const lang of ['en', 'de', 'ne'] as Lang[]) {
    for (const s of strings(COPY[lang])) assert.doesNotMatch(s, MONEY, `${lang}: ${s}`);
    const { free, ...frame } = FRAME[lang];
    for (const s of strings(frame)) assert.doesNotMatch(s, MONEY, `${lang} frame: ${s}`);
    // The frame's one honest line about being free is the only place that idea appears.
    assert.ok(free.length > 0);
  }
  for (const l of LETTERS) assert.doesNotMatch(`${l.word} ${l.wordTr} ${l.en} ${l.de}`, MONEY, l.ch);
  for (const w of BUILD_WORDS) assert.doesNotMatch(`${w.word} ${w.en} ${w.de}`, MONEY, w.word);
});

test('all three languages carry the same content', () => {
  const shape = (v: unknown): unknown =>
    Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
  assert.deepEqual(shape(COPY.de), shape(COPY.en));
  assert.deepEqual(shape(COPY.ne), shape(COPY.en));
  assert.deepEqual(shape(FRAME.de), shape(FRAME.en));
  assert.deepEqual(shape(FRAME.ne), shape(FRAME.en));
});
