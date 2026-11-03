/**
 * THE ASSOCIATION WEBSITE KIT KEEPS ITS PROMISES.
 *
 * /work/samaj is client-only: samaj.ts holds every rule and the page keeps the
 * state in localStorage. Three looks that turn unreadable, a membership form
 * that lets a broken application through (or blocks a good one), a poll whose
 * percentages do not add up, or a confirmation file that runs what someone
 * typed would all happen in front of a visitor — so they are pinned here, and
 * so is the "no money anywhere" rule on every word the site can show.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOGO,
  EMPTY_APPLICATION,
  EVENTS,
  FAMILY_MAX,
  LOOKS,
  LOOK_IDS,
  POLL_OPTIONS,
  POLL_SEED,
  addFamily,
  asLook,
  castVote,
  cleanInitials,
  clampMonth,
  confirmationHtml,
  contrast,
  emblemSvg,
  firstOpenStep,
  initialsFrom,
  isSchoolDay,
  join,
  lookVars,
  memberNumber,
  monthGrid,
  nextEvent,
  normalize,
  pollCounts,
  pollLeader,
  pollResults,
  schoolDays,
  seedState,
  setRsvp,
  goingCount,
  validateStep,
  weekdayMon,
  type Application,
  type Lang,
} from '../src/app/work/samaj/samaj.ts';
import { COPY, fmtDate } from '../src/app/work/samaj/content.ts';

const NOW = new Date(2026, 10, 3, 12, 0);
const GOOD: Application = {
  ...EMPTY_APPLICATION,
  first: 'Maya',
  last: 'Gurung',
  email: 'maya@example.org',
  phone: '+49 170 1234567',
  town: 'Darmstadt',
  family: [{ name: 'Aarav', relation: 'child', born: '2016' }],
  consentData: true,
  photos: 'no',
};

// ---------------- looks ----------------

test('every look is readable: text, buttons, badges and the hero pass WCAG AA', () => {
  for (const id of LOOK_IDS) {
    const c = LOOKS[id].colors;
    const pairs: [string, string, string, number][] = [
      ['text on bg', c.text, c.bg, 4.5],
      ['text on surface', c.text, c.surface, 4.5],
      ['text on surface2', c.text, c.surface2, 4.5],
      ['muted on bg', c.muted, c.bg, 4.5],
      ['muted on surface', c.muted, c.surface, 4.5],
      ['muted on surface2', c.muted, c.surface2, 4.5],
      ['link (primary) on surface', c.primary, c.surface, 4.5],
      ['link (primary) on bg', c.primary, c.bg, 4.5],
      ['link (primary) on surface2', c.primary, c.surface2, 4.5],
      ['button text', c.onPrimary, c.primary, 4.5],
      ['badge text', c.onAccent, c.accent, 4.5],
      ['hero text (from)', c.onHero, c.heroFrom, 4.5],
      ['hero text (to)', c.onHero, c.heroTo, 4.5],
    ];
    for (const [what, fg, bg, min] of pairs) {
      const r = contrast(fg, bg);
      assert.ok(r >= min, `${id}: ${what} is ${r.toFixed(2)}:1`);
    }
  }
  assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01);
});

test('three distinct looks, each setting every variable; unknown looks fall back', () => {
  assert.deepEqual(LOOK_IDS, ['himalaya', 'dhaka', 'modern']);
  const sets = LOOK_IDS.map((id) => lookVars(id));
  const keys = Object.keys(sets[0]).sort();
  for (const v of sets) assert.deepEqual(Object.keys(v).sort(), keys);
  assert.ok(keys.includes('--sj-primary') && keys.includes('--sj-bg'));
  assert.notEqual(sets[0]['--sj-primary'], sets[1]['--sj-primary']);
  assert.equal(LOOKS.modern.dark, true);
  assert.equal(LOOKS.himalaya.dark, false);
  assert.equal(asLook('dhaka'), 'dhaka');
  assert.equal(asLook('neon'), 'himalaya');
  assert.equal(asLook(undefined), 'himalaya');
});

// ---------------- logo maker ----------------

test('initials: from the name without the legal form, letters only, three at most', () => {
  assert.equal(initialsFrom('Saathi Samaj Main-Neckar e.V.'), 'SSM');
  assert.equal(DEFAULT_LOGO.initials, 'SSM');
  assert.equal(initialsFrom('nepal samaj ev'), 'NS');
  assert.equal(cleanInitials('n.s.-1'), 'NS');
  assert.equal(cleanInitials('abcdef'), 'ABC');
  assert.equal(cleanInitials('<b>'), 'B');
  assert.equal(cleanInitials('नेपाली समाज'), 'नेपाली', 'three Devanagari letters as a reader counts them');
  assert.equal(initialsFrom('नेपाली समाज जर्मनी'), 'नेसज');
  assert.equal(cleanInitials('ि'), '', 'a lone vowel sign is not an initial');
  assert.equal(cleanInitials(''), '');
});

test('the emblem is a self-contained SVG that escapes what was typed', () => {
  const svg = emblemSvg({ initials: 'NS', shape: 'lotus', ring: 'Nepali <script>alert(1)</script> & "Samaj"', look: 'dhaka', idPrefix: 'x' });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(svg.endsWith('</svg>'));
  assert.doesNotMatch(svg, /<script/i);
  assert.match(svg, /&lt;SCRIPT&gt;/);
  assert.match(svg, /&amp;/);
  assert.match(svg, />NS</);
  assert.ok(svg.includes(LOOKS.dhaka.colors.primary), 'coloured by the look');
  assert.match(svg, /id="x-ring"/);
  for (const shape of ['peaks', 'lotus', 'sun', 'star'] as const) {
    const s = emblemSvg({ initials: '', shape, ring: '', look: 'modern' });
    assert.match(s, />SS</, 'empty initials fall back');
    assert.doesNotMatch(s, /textPath/, 'no ring text when the ring is empty');
  }
  assert.notEqual(emblemSvg({ ...DEFAULT_LOGO, look: 'himalaya' }), emblemSvg({ ...DEFAULT_LOGO, look: 'modern' }));
});

// ---------------- programme ----------------

test('the 2027 programme: festivals on weekends, in date order, all made-up dates in 2027', () => {
  const ids = EVENTS.map((e) => e.id);
  for (const want of ['dashain', 'tihar', 'teej', 'newyear', 'sports', 'agm']) assert.ok(ids.includes(want as never), want);
  const dates = EVENTS.map((e) => e.date);
  assert.deepEqual([...dates].sort(), dates);
  for (const e of EVENTS) {
    assert.match(e.date, /^2027-/);
    assert.ok(weekdayMon(e.date) >= 5, `${e.id} on a weekend`);
    assert.ok(e.start < e.end);
  }
});

test('the Saturday school skips festival days and the summer break', () => {
  const days = schoolDays();
  assert.ok(days.length > 30);
  assert.ok(days.every((d) => weekdayMon(d) === 5));
  assert.equal(isSchoolDay('2027-01-09'), true);
  assert.equal(isSchoolDay('2027-04-17'), false, 'New Year');
  assert.equal(isSchoolDay('2027-08-14'), false, 'summer break');
  assert.equal(isSchoolDay('2027-01-10'), false, 'a Sunday');
});

test('next event and the month grid', () => {
  assert.equal(nextEvent(NOW)?.id, 'maghe');
  assert.equal(nextEvent(new Date(2027, 0, 16, 16, 59))?.id, 'maghe');
  assert.equal(nextEvent(new Date(2027, 0, 16, 17, 0))?.id, 'agm', 'started events are not next');
  assert.equal(nextEvent(new Date(2028, 0, 1)), null);
  const jan = monthGrid(2027, 0);
  assert.ok(jan.every((w) => w.length === 7));
  assert.equal(jan[0].indexOf('2027-01-01'), 4, '1 Jan 2027 is a Friday');
  assert.equal(jan.flat().filter(Boolean).length, 31);
  assert.equal(monthGrid(2027, 1).flat().filter(Boolean).length, 28);
  assert.deepEqual(clampMonth(2027, -1), { y: 2027, m: 0 });
  assert.deepEqual(clampMonth(2027, 12), { y: 2027, m: 11 });
  assert.deepEqual(clampMonth(2027, 5), { y: 2027, m: 5 });
});

// ---------------- membership ----------------

test('step 1 needs a real name, email and town; phone is optional but checked', () => {
  const e = validateStep('personal', EMPTY_APPLICATION, 2026);
  assert.deepEqual(e, { first: 'required', last: 'required', email: 'required', town: 'required' });
  assert.deepEqual(validateStep('personal', GOOD, 2026), {});
  assert.equal(validateStep('personal', { ...GOOD, email: 'maya@' }, 2026).email, 'email');
  assert.equal(validateStep('personal', { ...GOOD, first: 'M4ya' }, 2026).first, 'name');
  assert.equal(validateStep('personal', { ...GOOD, first: 'x'.repeat(61) }, 2026).first, 'tooLong');
  assert.equal(validateStep('personal', { ...GOOD, phone: 'call me' }, 2026).phone, 'phone');
  assert.deepEqual(validateStep('personal', { ...GOOD, phone: '' }, 2026), {});
  assert.deepEqual(validateStep('personal', { ...GOOD, first: 'सीता', last: "O'Neill-Rai" }, 2026), {}, 'Devanagari and apostrophes are names');
});

test('family: optional, at most six, each named, birth year sensible', () => {
  assert.deepEqual(validateStep('family', { ...GOOD, family: [] }, 2026), {});
  let a: Application = { ...GOOD, family: [] };
  for (let i = 0; i < FAMILY_MAX + 3; i++) a = addFamily(a);
  assert.equal(a.family.length, FAMILY_MAX);
  const e = validateStep('family', a, 2026);
  assert.equal(e['family.0.name'], 'required');
  assert.equal(validateStep('family', { ...GOOD, family: [{ name: 'Aarav', relation: 'child', born: '2031' }] }, 2026)['family.0.born'], 'year');
  assert.equal(validateStep('family', { ...GOOD, family: [{ name: 'Aarav', relation: 'child', born: '1890' }] }, 2026)['family.0.born'], 'year');
});

test('consent: DSGVO is required and the photo question must be answered either way', () => {
  assert.deepEqual(validateStep('consent', { ...GOOD, consentData: false, photos: null }, 2026), { consentData: 'consent', photos: 'choose' });
  assert.deepEqual(validateStep('consent', { ...GOOD, photos: 'yes' }, 2026), {});
  assert.deepEqual(validateStep('consent', { ...GOOD, photos: 'no', newsletter: false }, 2026), {});
});

test('joining checks every step, tidies the input and numbers the member', () => {
  assert.equal(firstOpenStep(EMPTY_APPLICATION, 2026), 'personal');
  assert.equal(firstOpenStep({ ...GOOD, consentData: false }, 2026), 'consent');
  assert.equal(firstOpenStep(GOOD, 2026), 'review');
  assert.ok(join({ ...GOOD, consentData: false }, NOW).errors?.consentData);
  const r = join({ ...GOOD, first: '  Maya  ', town: ' Darm   stadt ' }, NOW);
  assert.equal(r.member?.app.first, 'Maya');
  assert.equal(r.member?.app.town, 'Darm stadt');
  assert.equal(r.member?.number, 'SSM-2026-0148');
  assert.equal(r.member?.joined, '2026-11-03');
  assert.equal(memberNumber(7, 2027), 'SSM-2027-0007');
});

test('the confirmation file escapes everything typed and says nothing was sent', () => {
  const r = join({ ...GOOD, first: 'Maya', last: "D'Souza" }, NOW);
  const m = { ...r.member!, app: { ...r.member!.app, town: '<img src=x onerror=alert(1)>' } };
  const t = COPY.en;
  const html = confirmationHtml(
    m,
    {
      lang: 'en',
      title: t.join.confirmTitle,
      org: 'Saathi Samaj Main-Neckar e.V.',
      welcome: t.join.welcome,
      numberLabel: t.join.number,
      joinedLabel: t.join.joinedOn,
      nameLabel: 'Name',
      emailLabel: t.join.email,
      townLabel: t.join.town,
      familyLabel: t.join.steps.family,
      relations: t.join.relations,
      photosLabel: t.join.photosLabel,
      photos: { yes: 'Yes', no: 'No' },
      newsletterLabel: t.join.newsletterLabel,
      yesNo: { yes: 'Yes', no: 'No' },
      consentLine: t.join.consentLine,
      demoNote: t.join.demoNote,
      footer: t.join.footer,
      joined: fmtDate(m.joined, 'en'),
    },
    emblemSvg({ ...DEFAULT_LOGO, look: 'himalaya' })
  );
  assert.match(html, /^<!doctype html>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /D&#39;Souza/);
  assert.match(html, /SSM-2026-0148/);
  assert.match(html, /nothing was sent/i);
  assert.match(html, /Aarav · Child · 2016/);
});

// ---------------- members' area ----------------

test('poll: only a logged-in member votes, a vote can change, percentages add up to 100', () => {
  let s = seedState();
  assert.equal(castVote(s, 'lake').vote, null, 'logged out cannot vote');
  s = { ...s, loggedIn: true };
  s = castVote(s, 'forest');
  assert.equal(s.vote, 'forest');
  assert.equal(pollCounts(s.vote).forest, POLL_SEED.forest + 1);
  s = castVote(s, 'citypark');
  const c = pollCounts(s.vote);
  assert.equal(c.forest, POLL_SEED.forest, 'the old vote is gone');
  assert.equal(c.citypark, POLL_SEED.citypark + 1);
  assert.equal(castVote(s, 'moon' as never).vote, 'citypark');
  for (const mine of [null, ...POLL_OPTIONS]) {
    const r = pollResults(pollCounts(mine));
    assert.equal(r.reduce((a, x) => a + x.pct, 0), 100);
    assert.deepEqual(r.map((x) => x.id), POLL_OPTIONS);
  }
  assert.deepEqual(pollResults({ riverside: 1, citypark: 1, lake: 1, forest: 0 }).map((x) => x.pct), [34, 33, 33, 0]);
  assert.ok(pollResults({ riverside: 0, citypark: 0, lake: 0, forest: 0 }).every((x) => x.pct === 0));
  assert.equal(pollLeader(pollCounts(null)), 'lake');
});

test('RSVP: one answer per event, people clamped, counts include the household', () => {
  let s = seedState();
  const dashain = EVENTS.find((e) => e.id === 'dashain')!;
  s = setRsvp(s, 'dashain', 'yes', 3);
  assert.deepEqual(s.rsvps.dashain, { answer: 'yes', people: 3 });
  assert.equal(goingCount(dashain, s.rsvps.dashain), dashain.going + 3);
  s = setRsvp(s, 'dashain', 'yes', 99);
  assert.equal(s.rsvps.dashain?.people, 8);
  s = setRsvp(s, 'dashain', 'maybe', 0);
  assert.equal(s.rsvps.dashain?.people, 1);
  assert.equal(goingCount(dashain, s.rsvps.dashain), dashain.going, 'maybe does not count');
  assert.equal(setRsvp(s, 'nope', 'yes', 2), s, 'unknown events are ignored');
});

// ---------------- saved state ----------------

test('normalize: garbage becomes the seed, good state survives a reload, bad parts are dropped', () => {
  assert.deepEqual(normalize(null, 'de'), seedState('de'));
  assert.deepEqual(normalize('nope'), seedState());
  assert.deepEqual(normalize({ v: 2, look: 'modern' }), seedState());
  let s = seedState('en');
  s = { ...s, look: 'dhaka', lang: 'ne', loggedIn: true, logo: { initials: 'NS', shape: 'sun', ring: 'Nepali Samaj' } };
  s = castVote(s, 'lake');
  s = setRsvp(s, 'tihar', 'yes', 4);
  s = { ...s, member: join(GOOD, NOW).member!, draft: { ...GOOD }, step: 'consent' };
  const back = normalize(JSON.parse(JSON.stringify(s)), 'en');
  assert.deepEqual(back, s);

  const messy = normalize({
    v: 1,
    lang: 'fr',
    look: 'neon',
    logo: { initials: '12', shape: 'cube', ring: 'x'.repeat(80) },
    member: { app: { ...GOOD, email: 'bad' }, number: 'SSM-2026-0148', joined: '2026-11-03' },
    rsvps: { dashain: { answer: 'yes', people: 40 }, nope: { answer: 'yes', people: 1 }, tihar: { answer: 'perhaps' } },
    vote: 'moon',
    step: 'payment',
    draft: { first: 5, family: 'lots' },
  });
  assert.equal(messy.lang, 'en');
  assert.equal(messy.look, 'himalaya');
  assert.equal(messy.logo.initials, DEFAULT_LOGO.initials);
  assert.equal(messy.logo.shape, 'peaks');
  assert.equal(messy.logo.ring.length, 44);
  assert.equal(messy.member, null, 'an invalid member is dropped');
  assert.deepEqual(messy.rsvps, { dashain: { answer: 'yes', people: 8 } });
  assert.equal(messy.vote, null);
  assert.equal(messy.step, 'personal');
  assert.deepEqual(messy.draft.family, []);
  assert.equal(messy.draft.first, '');
});

// ---------------- words ----------------

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') {
    const r = (v as (...a: string[]) => unknown)('7', '7', '7', '7');
    if (typeof r === 'string') out.push(r);
  } else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

test('every word the site can show is free of money, in all three languages', () => {
  const MONEY =
    /€|\$|\beur\b|euro|\bprices?\b|\bfees?\b|\bcosts?\b|\bpay|\bpaid\b|\bquotes?\b|\brates?\b|\bpackages?\b|\bhire|\bdues\b|\biban\b|\bbic\b|\bbank|donat|spende|beitr[äa]g|preis|gebühr|kosten|zahlung|bezahl|honorar|konto|शुल्क|मूल्य|भुक्तानी|पैसा|रुपैयाँ|दाम|चन्दा|बैंक/i;
  for (const lang of ['en', 'de', 'ne'] as Lang[]) {
    for (const s of strings(COPY[lang])) assert.doesNotMatch(s, MONEY, `${lang}: ${s}`);
  }
});

test('all three languages carry the same content', () => {
  const shape = (v: unknown): unknown =>
    Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
  assert.deepEqual(shape(COPY.de), shape(COPY.en));
  assert.deepEqual(shape(COPY.ne), shape(COPY.en));
  assert.match(fmtDate('2027-10-16', 'de'), /^Samstag, 16\. Oktober 2027$/);
  assert.match(fmtDate('2027-10-16', 'ne'), /१६/);
  assert.equal(fmtDate('2027-10-16', 'en', true), 'Sat 16 Oct');
});
