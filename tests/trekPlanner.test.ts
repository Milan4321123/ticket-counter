/**
 * YATRI TREKS (/work/trek) PLANS RIGHT — AND NEVER TALKS MONEY.
 *
 * The made-up agency's trip planner without a browser: the map projection
 * puts places where they are (Kathmandu east of Pokhara, Lukla north-east of
 * Kathmandu, …) and inside the drawn outline; the altitudes are the usual
 * figures; the acclimatisation rule flags what it says it flags (and the
 * ready trips stay sensible); itinerary totals add up; reordering, removing
 * and adding days; season scores and festivals per region; the packing list
 * and permits follow the trip and the month; the .ics file (escaping,
 * folding, one event per day); what comes back from localStorage; and no
 * price, fee or cost words in any generated text, in any language.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADDABLE,
  ALT_LINE,
  MAP_H,
  MAP_W,
  MAX_DAYS,
  MAX_GAIN,
  PEAKS,
  SEASON,
  STOPS,
  STOP_IDS,
  TRIP_IDS,
  addDays,
  addRestAfter,
  addStop,
  altitudeWarnings,
  bestMonths,
  cleanSaved,
  clampView,
  dayInfo,
  dayInfos,
  defaultStart,
  emptySaved,
  estimateLeg,
  festivalsFor,
  fitView,
  icsCalendar,
  icsEscape,
  icsFold,
  insideNepal,
  isDate,
  monthOf,
  moveDay,
  packingList,
  panBy,
  permitsFor,
  project,
  projectStop,
  removeDay,
  seasonScores,
  totals,
  tripDays,
  zoomAt,
  type Day,
} from '../src/app/work/trek/trek.ts';
import { COPY, HL, LANGS, STOP_NAME, TRIP_TEXT, dayFacts, dayTitle, enquiryText, icsEvents, warningText } from '../src/app/work/trek/content.ts';

const MONEY =
  /€|\$\s?\d|\beuros?\b|\bprices?\b|\bfees?\b|\bcosts?\b|\bcheap|\bquotes?\b|\brates?\b|\bpackages?\b|\bhire|preis|gebühr|\bkosten\b|\bangebot|\bpaket|(?<!निः)शुल्क|मूल्य|रुपैयाँ|भाडा|रु\.?\s?[०-९\d]/i;

// ---------------------------------------------------------------- the map

test('the projection puts places where they are', () => {
  const ktm = projectStop('ktm');
  const pkr = projectStop('pkr');
  const lukla = projectStop('lukla');
  const ebc = projectStop('ebc');
  const chitwan = projectStop('chitwan');
  const lumbini = projectStop('lumbini');
  const rara = projectStop('rara');
  const lo = projectStop('lomanthang');
  assert.ok(ktm.x > pkr.x, 'Kathmandu is east of Pokhara');
  // Lukla is due east of Kathmandu — in fact a touch SOUTH of it (27.69° N vs 27.72° N); Namche is the first stop north-east.
  assert.ok(lukla.x > ktm.x && Math.abs(lukla.y - ktm.y) < 5, 'Lukla is east of Kathmandu, at about the same latitude');
  const namche = projectStop('namche');
  assert.ok(namche.x > ktm.x && namche.y < ktm.y, 'Namche is north-east of Kathmandu');
  assert.ok(ebc.y < lukla.y && ebc.x > lukla.x, 'base camp is north(-east) of Lukla');
  assert.ok(chitwan.y > pkr.y && chitwan.x > pkr.x, 'Chitwan is south-east of Pokhara');
  assert.ok(lumbini.x < chitwan.x && lumbini.y > pkr.y, 'Lumbini is west of Chitwan, south of Pokhara');
  assert.ok(rara.x < pkr.x && rara.y < pkr.y, 'Rara is north-west of Pokhara');
  assert.ok(lo.y < pkr.y, 'Lo Manthang is north of Pokhara');
  // Distances keep their shape: one degree of latitude ≈ 0.88 × one degree of longitude at 28° N.
  const a = project(28, 84);
  const b = project(29, 84);
  const c = project(28, 85);
  assert.ok(Math.abs(b.y - a.y) > Math.abs(c.x - a.x) && Math.abs(c.x - a.x) / Math.abs(b.y - a.y) > 0.85 && Math.abs(c.x - a.x) / Math.abs(b.y - a.y) < 0.92);
});

test('every place sits inside the drawn outline, and the outline fits the frame', () => {
  for (const id of STOP_IDS) assert.ok(insideNepal(STOPS[id].lat, STOPS[id].lon), `${id} inside Nepal`);
  for (const p of PEAKS) {
    // The border runs over some summits: allow those to sit on the line (within ~3 km).
    const near = insideNepal(p.lat, p.lon) || insideNepal(p.lat - 0.04, p.lon) || insideNepal(p.lat - 0.04, p.lon - 0.04);
    assert.ok(near, `${p.id} on or inside the border`);
  }
  for (const [lat, lon] of [
    [28, 79.5],
    [31, 84],
    [26, 85],
    [27.5, 88.6],
    [52.5, 13.4],
  ])
    assert.equal(insideNepal(lat, lon), false, `${lat},${lon} is outside`);
  for (const id of STOP_IDS) {
    const p = projectStop(id);
    assert.ok(p.x > 0 && p.x < MAP_W && p.y > 0 && p.y < MAP_H, `${id} on the map`);
  }
});

test('altitudes are the usual figures', () => {
  const want: Partial<Record<keyof typeof STOPS, number>> = {
    ktm: 1400,
    pkr: 820,
    lukla: 2860,
    phakding: 2610,
    namche: 3440,
    tengboche: 3860,
    dingboche: 4410,
    lobuche: 4910,
    gorakshep: 5160,
    ebc: 5364,
    kalapatthar: 5644,
    pheriche: 4240,
    abc: 4130,
    mbc: 3700,
    poonhill: 3210,
    ghorepani: 2860,
    kyanjin: 3870,
    kyanjinri: 4773,
    langtang: 3430,
    lamahotel: 2470,
  };
  for (const [id, alt] of Object.entries(want)) assert.equal(STOPS[id as keyof typeof STOPS].alt, alt, id);
  // A sanity floor and ceiling for everything else.
  for (const id of STOP_IDS) assert.ok(STOPS[id].alt >= 60 && STOPS[id].alt < 6000, id);
});

test('pan and zoom stay inside the map', () => {
  const v = clampView({ cx: -500, cy: 9999, z: 40 });
  assert.equal(v.z, 12);
  const w = MAP_W / v.z;
  const h = MAP_H / v.z;
  assert.ok(v.cx - w / 2 >= 0 && v.cy + h / 2 <= MAP_H + 0.01);
  const z = zoomAt({ cx: 400, cy: 230, z: 1 }, 2, 200, 100);
  assert.equal(z.z, 2);
  // The point under the cursor stays put.
  const before = (200 - (400 - MAP_W / 2)) / MAP_W;
  const after = (200 - (z.cx - MAP_W / 4)) / (MAP_W / 2);
  assert.ok(Math.abs(before - after) < 0.01);
  const p = panBy({ cx: 400, cy: 230, z: 4 }, 0.15, 0);
  assert.ok(p.cx > 400);
  const f = fitView(['lukla', 'ebc', 'namche']);
  assert.ok(f.z > 4, 'the Everest trail fits zoomed in');
  const e = projectStop('ebc');
  assert.ok(Math.abs(f.cx - e.x) < MAP_W / f.z / 2, 'base camp is in view');
});

// ---------------------------------------------------------------- trips, totals, the rule

test('the ready trips have the promised lengths and add up', () => {
  const len = Object.fromEntries(TRIP_IDS.map((id) => [id, tripDays(id).length]));
  assert.deepEqual(len, { ebc: 14, abc: 10, poon: 5, langtang: 8, family: 12, lumbini: 6 });
  for (const id of TRIP_IDS) {
    const d = tripDays(id);
    assert.equal(new Set(d.map((x) => x.k)).size, d.length, `${id} keys are unique`);
    for (const x of dayInfos(d)) assert.ok(x.authored, `${id}: every day of a ready trip uses its own figures`);
    for (const x of d) if (x.hl) assert.ok(HL[x.hl], `${id}: highlight ${x.hl} exists`);
  }
  const t = totals(tripDays('ebc'));
  assert.equal(t.days, 14);
  assert.equal(t.restDays, 2);
  assert.equal(t.walkDays, 9);
  assert.equal(t.maxSleep, 5160);
  assert.equal(t.maxTop, 5644);
  assert.equal(t.flights, 1);
  assert.equal(t.walkKm, 8 + 11 + 5 + 10 + 11 + 5 + 8 + 15 + 14 + 20 + 19);
  assert.equal(t.nights.teahouse, 11);
  assert.equal(t.nights.hotel, 3);
  const fam = totals(tripDays('family'));
  assert.equal(fam.maxSleep, 1650);
  assert.ok(fam.nights.homestay >= 6);
  assert.equal(totals(tripDays('lumbini')).walkDays, 0);
});

test('the acclimatisation rule: what the ready trips show', () => {
  // Everest: Tengboche (3,860) → Dingboche (4,410) is 550 m, with a rest day after it.
  assert.deepEqual(altitudeWarnings(tripDays('ebc')), [{ day: 5, kind: 'gain', gain: 550, eased: true }]);
  for (const id of ['abc', 'poon', 'langtang', 'family', 'lumbini'] as const) assert.deepEqual(altitudeWarnings(tripDays(id)), [], id);
});

test('the acclimatisation rule: remove a rest day and it says so', () => {
  const ebc = tripDays('ebc');
  const noDingRest = removeDay(ebc, 6);
  const w = altitudeWarnings(noDingRest);
  assert.deepEqual(w[0], { day: 5, kind: 'gain', gain: 550, eased: false }, 'no rest day after the big climb any more');
  assert.ok(
    w.some((x) => x.kind === 'rest' && x.day === 6 && x.streak === 3),
    'Lobuche is the third climbing night in a row',
  );
  const noNamcheRest = removeDay(ebc, 3);
  assert.ok(altitudeWarnings(noNamcheRest).some((x) => x.kind === 'rest' && x.streak === 3));
});

test('the acclimatisation rule counts from 3,000 m', () => {
  const d = (...stops: (keyof typeof STOPS)[]): Day[] => stops.map((stop, i) => ({ k: `x${i}`, stop }));
  assert.equal(ALT_LINE, 3000);
  assert.equal(MAX_GAIN, 500);
  // Phakding 2,610 → Namche 3,440: only 440 m of it is above 3,000 m.
  assert.deepEqual(altitudeWarnings(d('phakding', 'namche')), []);
  // Lukla 2,860 → Dingboche 4,410: 1,410 m above 3,000.
  assert.deepEqual(altitudeWarnings(d('lukla', 'dingboche')), [{ day: 1, kind: 'gain', gain: 1410, eased: false }]);
  // Exactly 500 m is fine; 501 is not.
  assert.deepEqual(
    altitudeWarnings(d('lobuche', 'dingboche', 'lobuche')).filter((w) => w.kind === 'gain'),
    [{ day: 0, kind: 'gain', gain: 1910, eased: true }],
  );
  // Flying straight to a high place counts from sea level.
  assert.equal(altitudeWarnings(d('kyanjin'))[0].kind, 'gain');
  // Three climbing nights above 3,000 m: the third is flagged; a descent resets.
  const climb = d('lukla', 'namche', 'tengboche', 'dingboche');
  assert.deepEqual(
    altitudeWarnings(climb).filter((w) => w.kind === 'rest'),
    [{ day: 3, kind: 'rest', streak: 3 }],
  );
  assert.deepEqual(
    altitudeWarnings(d('namche', 'tengboche', 'namche', 'tengboche')).filter((w) => w.kind === 'rest'),
    [],
  );
});

test('moving, removing and adding days', () => {
  const d = tripDays('poon');
  const m = moveDay(d, 0, 2);
  assert.deepEqual(
    m.map((x) => x.stop),
    ['ghorepani', 'tadapani', 'tikhedhunga', 'ghandruk', 'pkr'],
  );
  assert.equal(moveDay(d, 0, 9), d, 'out of range changes nothing');
  assert.equal(moveDay(d, 2, 2), d);
  // A moved day's figures are estimated, not copied.
  const infos = dayInfos(m);
  assert.equal(infos[0].authored, false);
  assert.equal(infos[0].mode, 'arrive');
  assert.equal(infos[1].authored, true, 'Tadapani still follows Ghorepani, so it keeps its own figures');
  assert.equal(infos[2].authored, false);
  assert.equal(removeDay(d, 1).length, 4);
  assert.equal(removeDay([d[0]], 0).length, 1, 'never empty');
  const a = addStop(d, 'abc', 'new');
  assert.equal(a.length, 6);
  assert.equal(a[5].stop, 'abc');
  assert.equal(addStop(d, 'ebc', 'x'), d, 'viewpoints are not nights');
  assert.ok(!ADDABLE.includes('kalapatthar') && ADDABLE.includes('namche'));
  const r = addRestAfter(d, 1, 'rest');
  assert.equal(r[2].stop, 'ghorepani');
  assert.equal(dayInfo(r, 2).mode, 'rest');
  let long = d;
  for (let i = 0; i < 40; i++) long = addStop(long, 'pkr', `k${i}`);
  assert.equal(long.length, MAX_DAYS);
});

test('estimated legs: walk on trails, drive on roads, fly where there is no road', () => {
  assert.equal(estimateLeg('namche', 'tengboche').mode, 'walk');
  assert.equal(estimateLeg('ktm', 'lukla').mode, 'fly');
  assert.equal(estimateLeg('ktm', 'pkr').mode, 'drive');
  assert.equal(estimateLeg('ktm', 'chitwan').mode, 'drive');
  assert.equal(estimateLeg('pkr', 'pkr').mode, 'visit');
  assert.equal(estimateLeg('namche', 'namche').mode, 'rest');
  const w = estimateLeg('namche', 'tengboche');
  assert.ok(w.km >= 6 && w.km <= 14 && w.h >= 3 && w.h <= 7, JSON.stringify(w));
  const dr = estimateLeg('ktm', 'pkr');
  assert.ok(dr.km > 150 && dr.km < 260 && dr.h >= 5 && dr.h <= 10, JSON.stringify(dr));
});

// ---------------------------------------------------------------- season, packing, permits

test('season scores: best after the monsoon and in spring, monsoon worst — Mustang the exception', () => {
  for (const r of ['everest', 'annapurna', 'langtang'] as const) {
    const s = SEASON[r];
    for (const m of [10, 11]) assert.equal(s[m - 1], 3, `${r} ${m}`);
    for (const m of [6, 7, 8]) assert.equal(s[m - 1], 0, `${r} ${m}`);
    assert.ok(s[3] >= 2 && s[2] >= 2, `${r} spring`);
  }
  assert.ok(SEASON.mustang[6] >= 2, 'Mustang is fine in July');
  assert.ok(SEASON.mustang[0] === 0, 'and closed in January');
  const ebc = seasonScores(tripDays('ebc'));
  assert.equal(ebc.length, 12);
  assert.ok(bestMonths(ebc).includes(10) && bestMonths(ebc).includes(11));
  assert.ok(!bestMonths(ebc).includes(7));
  const fam = seasonScores(tripDays('family'));
  assert.ok(fam[1] >= 2, 'a family trip in February is good');
  assert.deepEqual(bestMonths([0, 0, 3, 3, 1, 0, 0, 0, 0, 3, 2, 0]), [3, 4, 10]);
});

test('festivals: Dashain and Tihar everywhere, the local ones by region', () => {
  const ebc = festivalsFor(tripDays('ebc')).map((f) => f.id);
  assert.ok(ebc.includes('dashain') && ebc.includes('tihar') && ebc.includes('maniRimdu'));
  assert.ok(!ebc.includes('tiji'));
  const lum = festivalsFor(tripDays('lumbini')).map((f) => f.id);
  assert.ok(lum.includes('buddha') && !lum.includes('maniRimdu'));
  const dashain = festivalsFor(tripDays('ebc')).find((f) => f.id === 'dashain')!;
  assert.deepEqual(dashain.months, [10]);
});

test('the packing list follows the trip and the month', () => {
  const ids = (days: Day[], month: number) => packingList({ days, month }).map((p) => p.id);
  const ebcNov = ids(tripDays('ebc'), 11);
  for (const x of ['down', 'sleepingbag', 'boots', 'altitude', 'sunglasses', 'softbag', 'purify', 'poles']) assert.ok(ebcNov.includes(x as never), `EBC: ${x}`);
  assert.ok(!ebcNov.includes('leech') && !ebcNov.includes('binoculars'));
  assert.ok(ids(tripDays('ebc'), 1).includes('spikes'), 'icy trails in January');
  const famJul = ids(tripDays('family'), 7);
  for (const x of ['leech', 'raincover', 'repellent', 'binoculars', 'neutral', 'gifts', 'modest', 'light']) assert.ok(famJul.includes(x as never), `family in July: ${x}`);
  assert.ok(!famJul.includes('down') && !famJul.includes('altitude'));
  const lum = ids(tripDays('lumbini'), 11);
  assert.ok(lum.includes('modest') && lum.includes('slipons') && !lum.includes('boots'));
  for (const id of TRIP_IDS) {
    for (let m = 1; m <= 12; m++) {
      const list = ids(tripDays(id), m);
      assert.equal(new Set(list).size, list.length, `${id} ${m}: no duplicates`);
      assert.ok(list.includes('passport') && list.includes('insurance'));
    }
  }
});

test('permits are named per region, generically', () => {
  assert.deepEqual(permitsFor(tripDays('ebc')), ['visa', 'guide', 'sagarmatha', 'khumbu']);
  assert.deepEqual(permitsFor(tripDays('abc')), ['visa', 'guide', 'acap', 'tims']);
  assert.deepEqual(permitsFor(tripDays('langtang')), ['visa', 'guide', 'langtangNp', 'tims']);
  assert.deepEqual(permitsFor(tripDays('lumbini')), ['visa', 'lumbiniSite']);
  const fam = permitsFor(tripDays('family'));
  assert.ok(fam.includes('chitwanNp') && !fam.includes('guide'), 'a short homestay walk is no trek');
  const mustang: Day[] = [
    { k: 'a', stop: 'pkr' },
    { k: 'b', stop: 'jomsom' },
    { k: 'c', stop: 'lomanthang' },
  ];
  assert.ok(permitsFor(mustang).includes('upperMustang') && permitsFor(mustang).includes('acap'));
});

// ---------------------------------------------------------------- dates and the calendar

test('dates', () => {
  assert.equal(addDays('2027-10-10', 13), '2027-10-23');
  assert.equal(addDays('2027-12-30', 3), '2028-01-02');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.ok(isDate('2027-10-10'));
  assert.ok(!isDate('2027-02-30') && !isDate('10/10/2027') && !isDate(null));
  assert.equal(monthOf('2027-03-01'), 3);
  assert.equal(monthOf(null), 10);
  assert.equal(defaultStart(new Date('2026-11-03T12:00:00Z')), '2027-10-10');
  assert.equal(defaultStart(new Date('2027-05-01T12:00:00Z')), '2027-10-10');
  assert.equal(defaultStart(new Date('2027-10-01T12:00:00Z')), '2028-10-10');
});

test('.ics: escaping, folding at 75 octets, one all-day event per day', () => {
  assert.equal(icsEscape('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const long = 'DESCRIPTION:' + 'सगरमाथा आधार शिविर '.repeat(12);
  const folded = icsFold(long);
  const enc = new TextEncoder();
  for (const line of folded.split('\r\n')) assert.ok(enc.encode(line).length <= 75, `line ≤ 75 octets: ${enc.encode(line).length}`);
  assert.equal(
    folded
      .split('\r\n')
      .map((l, i) => (i ? l.slice(1) : l))
      .join(''),
    long,
    'unfolds back to the same text',
  );
  for (const lang of ['en', 'de', 'ne'] as const) {
    const ev = icsEvents(tripDays('ebc'), '2027-10-10', lang);
    const ics = icsCalendar(ev, 'Yatri Treks · Everest, Base; Camp', new Date('2026-11-03T10:00:00Z'));
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
    assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 14);
    assert.ok(ics.includes('DTSTART;VALUE=DATE:20271010'));
    assert.ok(ics.includes('DTEND;VALUE=DATE:20271024'), 'the last day ends the morning after');
    assert.ok(ics.includes('X-WR-CALNAME:Yatri Treks · Everest\\, Base\\; Camp'));
    assert.ok(ics.includes('DTSTAMP:20261103T100000Z'));
    assert.ok(!/\r(?!\n)|(?<!\r)\n/.test(ics), 'CRLF only');
    for (const line of ics.split('\r\n')) assert.ok(enc.encode(line).length <= 75, `${lang}: ${line.slice(0, 30)}`);
    const uids = ics.match(/UID:[^\r]+/g)!;
    assert.equal(new Set(uids).size, 14);
  }
  // A typed comma or newline in a summary can't break the file.
  const evil = icsCalendar([{ date: '2027-10-10', summary: 'x\nEND:VCALENDAR', description: 'a;b' }], 'n', new Date(0));
  assert.equal(evil.split('\r\n').filter((l) => l === 'END:VCALENDAR').length, 1, 'the injected line is escaped, not a real line');
  assert.ok(evil.includes('SUMMARY:x\\nEND:VCALENDAR'));
});

// ---------------------------------------------------------------- saved state

test('what comes back from localStorage is cleaned', () => {
  assert.deepEqual(cleanSaved(null), emptySaved());
  assert.deepEqual(cleanSaved({ v: 2, base: 'abc' }), emptySaved());
  const s = cleanSaved({
    v: 1,
    base: 'custom',
    days: [{ k: 'a', stop: 'ktm' }, { k: 'a', stop: 'namche', km: -4, h: 99, hl: '<script>' }, { stop: 'atlantis' }, 'x'],
    start: '2027-02-31',
    packed: ['boots', 'boots', 'gold'],
    people: 99,
  });
  assert.equal(s.base, 'custom');
  assert.deepEqual(
    s.days!.map((d) => d.stop),
    ['ktm', 'namche'],
  );
  assert.notEqual(s.days![0].k, s.days![1].k);
  assert.equal(s.days![1].km, undefined);
  assert.equal(s.days![1].h, undefined);
  assert.equal(s.days![1].hl, undefined);
  assert.equal(s.start, null);
  assert.deepEqual(s.packed, ['boots']);
  assert.equal(s.people, 2);
  assert.equal(cleanSaved({ v: 1, base: 'custom', days: [] }).base, 'ebc', 'custom with no days falls back');
  const round = cleanSaved(JSON.parse(JSON.stringify({ ...emptySaved(), base: 'abc', days: tripDays('abc'), start: '2027-04-02', people: 4 })));
  assert.deepEqual(round.days, tripDays('abc'));
  assert.equal(round.start, '2027-04-02');
});

// ---------------------------------------------------------------- words

test('every place, trip and line exists in all three languages; Nepali names are in Devanagari', () => {
  for (const id of STOP_IDS) {
    for (const { id: l } of LANGS) assert.ok(STOP_NAME[id][l]?.trim(), `${id} ${l}`);
    assert.match(STOP_NAME[id].ne, /[ऀ-ॿ]/, `${id} in Devanagari`);
  }
  for (const id of [...TRIP_IDS, 'custom' as const]) for (const { id: l } of LANGS) assert.ok(TRIP_TEXT[id].name[l] && TRIP_TEXT[id].blurb[l]);
  for (const [k, v] of Object.entries(HL)) for (const { id: l } of LANGS) assert.ok(v[l]?.trim(), `${k} ${l}`);
  const keys = (o: object) => Object.keys(o).sort();
  assert.deepEqual(keys(COPY.de), keys(COPY.en));
  assert.deepEqual(keys(COPY.ne), keys(COPY.en));
  assert.match(COPY.en.ruleTag, /not medical advice/);
  assert.match(COPY.de.ruleTag, /kein medizinischer Rat/);
});

test('no prices, fees or costs in any generated text, in any language', () => {
  const hits: string[] = [];
  const check = (where: string, s: string) => {
    const m = s.match(MONEY);
    if (m) hits.push(`${where} [${m[0]}] ${s.slice(0, 120)}`);
  };
  for (const { id: lang } of LANGS) {
    for (const id of TRIP_IDS) {
      const days = tripDays(id);
      const infos = dayInfos(days);
      infos.forEach((x, i) => check(`${lang} ${id} ${i}`, `${dayTitle(x, lang)} ${dayFacts(x, lang).join(' ')}`));
      for (const w of altitudeWarnings(removeDay(days, Math.min(6, days.length - 1))))
        check(`${lang} ${id} warn`, warningText(w, removeDay(days, Math.min(6, days.length - 1)), lang));
      check(
        `${lang} ${id} enquiry`,
        enquiryText(days, TRIP_TEXT[id].name[lang], '2027-10-10', { name: 'Asha', contact: 'asha@example.com', note: 'First trek', people: 3 }, altitudeWarnings(days), lang),
      );
      for (const e of icsEvents(days, '2027-10-10', lang)) check(`${lang} ${id} ics`, `${e.summary} ${e.description} ${e.location}`);
    }
  }
  assert.deepEqual(hits, [], hits.join('\n'));
});
