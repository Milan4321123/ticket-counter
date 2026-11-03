/**
 * /work/build — THE IDEA FITS IN A LINK, AND THE PAGE NEVER TALKS MONEY.
 *
 * The builder's state is a short #hash anyone can share; it must survive a
 * round trip, shrug off junk, and never mention prices, estimates, budgets or
 * packages in any language (the studio's operator is a student — see
 * app/studio/page.tsx). "See it working →" links come from lib/projects.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLORS,
  EMPTY_IDEA,
  FEATURES,
  FEATURE_IDS,
  KINDS,
  KIND_IDS,
  cleanColor,
  decodeIdea,
  emblemInitials,
  encodeIdea,
  featureDemoHref,
  normalizeIdea,
  onColor,
  pickKind,
  shade,
  slug,
  toggleFeature,
} from '../src/app/work/build/idea.ts';
import { COPY } from '../src/app/work/build/content.ts';
import { LIVE_DEMOS, PROJECTS, demoHref, IDEA_BUILDER } from '../src/lib/projects.ts';

const restaurant = normalizeIdea({
  kind: 'restaurant',
  name: 'Himalayan Chulo',
  tagline: 'Momo, thali & chiya',
  initials: 'hc',
  color: '#EA580C',
  make: 'both',
  features: ['menu', 'lang', 'chat', 'gallery', 'tickets'],
});

test('an idea survives the link round trip', () => {
  const enc = encodeIdea(restaurant);
  assert.ok(enc.length < 200, enc);
  assert.deepEqual(decodeIdea(`#${enc}`), restaurant);
  assert.deepEqual(decodeIdea(`?${enc}`), restaurant);
  assert.equal(restaurant.color, '#ea580c');
  assert.equal(restaurant.initials, 'HC');
  const ne = normalizeIdea({ kind: 'association', name: 'साथी समाज', make: 'web', features: ['members'] });
  assert.deepEqual(decodeIdea(encodeIdea(ne)), ne);
  const other = normalizeIdea({ kind: 'other', other: 'a cricket club', features: [] });
  assert.equal(decodeIdea(encodeIdea(other))?.other, 'a cricket club');
});

test('a link with no idea in it is no idea; junk is cleaned, not trusted', () => {
  assert.equal(decodeIdea(''), null);
  assert.equal(decodeIdea('#'), null);
  assert.equal(decodeIdea('#top'), null);
  const junk = decodeIdea('#k=hacker&m=rocket&c=zzz&f=menu.menu.nope.quiz&n=' + encodeURIComponent('<b>x</b>‮' + 'y'.repeat(99)));
  assert.ok(junk);
  assert.equal(junk.kind, '');
  assert.equal(junk.make, 'app');
  assert.equal(junk.color, EMPTY_IDEA.color);
  assert.deepEqual(junk.features, ['menu', 'quiz']);
  assert.ok(!/[<>‮]/.test(junk.name));
  assert.ok(Array.from(junk.name).length <= 40);
  // "other" text is kept only for kind other.
  assert.equal(normalizeIdea({ kind: 'shop', other: 'x' }).other, '');
});

test('toggling adds at the end and removes; picking a kind brings its colour', () => {
  let i = toggleFeature(EMPTY_IDEA, 'quiz');
  i = toggleFeature(i, 'menu');
  assert.deepEqual(i.features, ['quiz', 'menu']);
  i = toggleFeature(i, 'quiz');
  assert.deepEqual(i.features, ['menu']);
  const r = pickKind({ ...i, color: '#123456' }, 'restaurant');
  assert.equal(r.color, KINDS.restaurant.color);
  assert.deepEqual(r.features, ['menu']);
});

test('every kind and every preset colour is a real colour with readable text on it', () => {
  for (const k of KIND_IDS) assert.ok(cleanColor(KINDS[k].color), k);
  for (const c of COLORS) {
    assert.ok(cleanColor(c.hex), c.id);
    assert.equal(onColor(c.hex), '#ffffff', `${c.id} takes white text`);
  }
  assert.equal(onColor('#fde68a'), '#1c1917');
  assert.equal(shade('#ffffff', -1), '#000000');
  assert.equal(shade('#000000', 1), '#ffffff');
  assert.match(shade('#ea580c', 0.5), /^#[0-9a-f]{6}$/);
});

test('emblem letters and slugs', () => {
  assert.equal(emblemInitials({ ...EMPTY_IDEA, name: 'Himalayan Chulo' }, 'x'), 'HC');
  assert.equal(emblemInitials({ ...EMPTY_IDEA, name: 'Saathi Samaj e.V.' }, 'x'), 'SS');
  assert.equal(emblemInitials({ ...EMPTY_IDEA, initials: 'MN', name: 'Himalayan Chulo' }, 'x'), 'MN');
  assert.equal(emblemInitials(EMPTY_IDEA, 'Dhaka Corner'), 'DC');
  assert.equal(slug('Himalayan Chulo'), 'himalayan-chulo');
  assert.equal(slug('Café Zürich!'), 'cafe-zurich');
  assert.equal(slug('साथी'), 'my-idea');
});

test('"See it working →" points at real /work demos from lib/projects', () => {
  const demos = new Set(LIVE_DEMOS.map((p) => demoHref(p)));
  let linked = 0;
  for (const f of FEATURES) {
    const href = featureDemoHref(f.id);
    if (f.demo) {
      assert.ok(PROJECTS.some((p) => p.id === f.demo), `${f.id} → ${f.demo} exists`);
      assert.ok(href && demos.has(href), `${f.id} → ${href}`);
      linked++;
    } else assert.equal(href, undefined);
  }
  assert.ok(linked >= 6);
});

test('the builder is a tool, not a project card', () => {
  assert.equal(IDEA_BUILDER.href, '/work/build');
  assert.ok(!PROJECTS.some((p) => p.links.some((l) => l.href === IDEA_BUILDER.href)));
});

test('every word the builder shows is there in all three languages, and none is about money', () => {
  const money =
    /€|\$|\beur\b|euro|\bprices?\b|\bpricing|\bfees?\b|\bcosts?\b|\bcheap|\bbudgets?\b|\bestimat\w*|\bquotes?\b|\brates?\b|\bpackages?\b|\bhire|\bpay|\bpaid\b|\binvoice|preis|gebühr|\bkosten\b|budget|angebot|honorar|zahl|rechnung|(?<!निः)शुल्क|मूल्य|भुक्तानी|पैसा|रुपैयाँ|(?<![\u0900-\u097F])दाम|बजेट|खर्च/i;
  const strings = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') {
      const r = (v as (...a: string[]) => unknown)('X', 'Y', 'Z', 'W');
      if (typeof r === 'string') out.push(r);
    } else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
    return out;
  };
  const en = strings(COPY.en);
  for (const lang of ['en', 'de', 'ne'] as const) {
    const all = strings(COPY[lang]);
    assert.equal(all.length, en.length, `${lang} has every string`);
    for (const s of all) assert.doesNotMatch(s, money, `${lang}: ${s}`);
    for (const f of FEATURE_IDS) assert.ok(COPY[lang].features[f].label && COPY[lang].brief.features[f], `${lang}.${f}`);
    for (const k of KIND_IDS) assert.ok(COPY[lang].kinds[k].label, `${lang}.${k}`);
  }
});
