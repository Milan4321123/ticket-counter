/**
 * /work/instant — "YOUR WEBSITE IN 10 SECONDS": THE SAME NAME GIVES THE SAME
 * SITE, EVERY STYLE READS WELL, AND NOTHING A VISITOR TYPES CAN ESCAPE.
 *
 * The generator (src/app/work/instant/instant.ts) is pure: a name, a kind and
 * a city become one static HTML document — the preview's srcdoc and the
 * downloaded .html are the same string. These pin its rules: seeded
 * determinism, kind → sections, the eight styles' contrast with any colour,
 * escaping (scripts, quotes, </style>), no requests or scripts in the output,
 * the capped share link, the brief for /contact and the build's timeline.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRIEF_MAX, cleanBrief } from '../src/lib/ideaBrief.ts';
import { contrast } from '../src/app/work/samaj/samaj.ts';
import { COPY } from '../src/app/work/instant/content.ts';
import {
  HASH_MAX,
  KIND_IDS,
  LANG_IDS,
  LIMITS,
  MIN_CONTRAST,
  POOL,
  SECTION_IDS,
  SITE_CSP,
  STYLES,
  SWATCHES,
  cleanSaved,
  contactHref,
  decodeSite,
  demoHost,
  encodeSite,
  esc,
  fileName,
  fill,
  fitColor,
  generate,
  instantBrief,
  moveSection,
  newSite,
  normalizeSite,
  onSections,
  palette,
  placeSection,
  poolOf,
  setColor,
  setEdit,
  shuffleStyle,
  shuffleWords,
  siteHtml,
  siteSeed,
  textPairs,
  timeline,
  toggleSection,
  type Site,
} from '../src/app/work/instant/instant.ts';

const base = () => newSite('Chiya Ghar', 'restaurant', 'Mainz');
const textOf = (html: string) =>
  html
    .replace(/<style>[\s\S]*?<\/style>/, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

// ---------------- determinism ----------------

test('the same name always gives the same site; another name gives another', () => {
  for (const lang of LANG_IDS) {
    assert.equal(siteHtml(base(), lang), siteHtml(base(), lang), lang);
    assert.deepEqual(generate(base(), lang), generate(base(), lang));
  }
  // Case and spaces do not make it another name.
  assert.equal(siteSeed('  chiya   GHAR ', 'restaurant', 'mainz'), siteSeed('Chiya Ghar', 'restaurant', 'Mainz'));
  assert.equal(newSite('Chiya Ghar', 'restaurant', 'Mainz').style, newSite('chiya ghar', 'restaurant', 'MAINZ').style);
  // Different names land on different looks and words (over a handful of names).
  const names = ['Chiya Ghar', 'Pahelo Pani', 'Saathi Samaj', 'Lali Guras', 'Momo Corner', 'Hamro Pasal', 'Sagarmatha', 'Kalo Pani'];
  const styles = new Set(names.map((n) => newSite(n, 'restaurant').style));
  assert.ok(styles.size >= 4, `only ${styles.size} styles over ${names.length} names`);
  const heads = new Set(names.map((n) => generate(newSite(n, 'restaurant'), 'en').defaults.h.replace(n, '')));
  assert.ok(heads.size >= 2);
});

test('shuffling the words changes the words, not the style; shuffling the style changes the style, not the words', () => {
  const s = base();
  const a = generate(s, 'en');
  const words = [1, 2, 3, 4, 5].map((w) => generate({ ...s, words: w }, 'en'));
  assert.ok(words.some((g) => JSON.stringify(g.sections) !== JSON.stringify(a.sections)), 'some words change');
  for (const g of words) assert.equal(g.style.id, a.style.id);
  const b = generate(shuffleStyle(s), 'en');
  assert.notEqual(b.style.id, a.style.id);
  assert.deepEqual(b.sections, a.sections);
  assert.equal(shuffleWords(s).words, 1);
});

test('switching a section off or moving it never rewrites the others', () => {
  const s = { ...base(), off: [] };
  const all = generate(s, 'de').sections;
  const without = generate(toggleSection(s, 'menu'), 'de').sections;
  assert.ok(!without.some((x) => x.id === 'menu'));
  for (const sec of without) assert.deepEqual(sec, all.find((x) => x.id === sec.id), sec.id);
  const moved = generate(moveSection(s, 'contact', -3), 'de').sections;
  for (const sec of moved) assert.deepEqual(sec, all.find((x) => x.id === sec.id), sec.id);
});

// ---------------- kinds → sections ----------------

test('each kind gets the sections that fit it, with hero and footer always there', () => {
  const ids = (k: (typeof KIND_IDS)[number]) => onSections(newSite('X', k));
  assert.ok(ids('restaurant').includes('menu') && !ids('restaurant').includes('products'));
  assert.ok(ids('shop').includes('products') && !ids('shop').includes('menu'));
  assert.ok(ids('verein').includes('events') && ids('verein').includes('team'));
  assert.ok(ids('artist').includes('events'));
  assert.ok(ids('tutor').includes('timetable') && ids('tutor').includes('services'));
  assert.ok(ids('event').includes('timetable'));
  assert.ok(ids('salon').includes('services') && ids('salon').includes('hours'));
  assert.ok(ids('handy').includes('services'));
  for (const k of KIND_IDS) {
    const pool = poolOf(k);
    assert.equal(new Set(pool).size, pool.length, `${k}: no section twice`);
    for (const id of pool) assert.ok(SECTION_IDS.includes(id));
    assert.equal(ids(k)[0], 'about', `${k} opens with its story`);
    assert.equal(ids(k).at(-1), 'contact', `${k} ends with contact`);
    assert.deepEqual(newSite('X', k).off, POOL[k].extra);
    // Every kind's every section renders, in every language.
    for (const lang of LANG_IDS) {
      const html = siteHtml({ ...newSite('X', k, 'Mainz'), off: [] }, lang);
      assert.match(html, /<h1>/);
      assert.match(html, /class="foot"/);
      for (const id of pool) assert.match(html, new RegExp(`<section id="${id}"`), `${k}/${lang}/${id}`);
      assert.doesNotMatch(textOf(html), /undefined|NaN|\{name\}|\{city\}|\[\[|\]\]/, `${k}/${lang}`);
    }
  }
});

test('a city appears when given and its phrases vanish cleanly when not', () => {
  assert.equal(fill('Visit us[[ in {city}]]', { name: 'A', city: '' }), 'Visit us');
  assert.equal(fill('Visit us[[ in {city}]]', { name: 'A', city: 'Mainz' }), 'Visit us in Mainz');
  // A name that contains "{city}" stays as typed.
  assert.equal(fill('Welcome to {name}', { name: '{city} Café', city: 'Mainz' }), 'Welcome to {city} Café');
  for (const lang of LANG_IDS) {
    for (const k of KIND_IDS) {
      const t = textOf(siteHtml({ ...newSite('Kalo Pani', k), off: [] }, lang));
      assert.doesNotMatch(t, /\s[,.।]/, `${k}/${lang}: no orphan punctuation`);
    }
  }
});

// ---------------- styles ----------------

test('at least six really different styles', () => {
  assert.ok(STYLES.length >= 6);
  const sig = STYLES.map((s) => `${s.fonts.head}|${s.hero}|${s.radius}|${s.ill}|${s.base.bg}`);
  assert.equal(new Set(sig).size, STYLES.length);
  assert.ok(new Set(STYLES.map((s) => s.hero)).size >= 4, 'hero layouts');
  assert.ok(new Set(STYLES.map((s) => s.ill)).size >= 5, 'illustration styles');
  assert.ok(new Set(STYLES.map((s) => s.fonts.head)).size >= 5, 'type pairs');
  assert.ok(STYLES.some((s) => s.dark) && STYLES.some((s) => !s.dark));
  // Six shuffles visit six different styles.
  let s = base();
  const seen = new Set<string>();
  for (let i = 0; i < 6; i++) {
    s = shuffleStyle(s);
    seen.add(STYLES[s.style].id);
  }
  assert.equal(seen.size, 6);
});

test('every style reads at 4.5 : 1 or better — with its own colour, every swatch and any colour at all', () => {
  const colours: (string | null)[] = [null, ...SWATCHES, '#ffffff', '#000000', '#ffff00', '#00ffff', '#808080', '#ff00ff'];
  let x = 12345;
  for (let i = 0; i < 120; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    colours.push(`#${(x & 0xffffff).toString(16).padStart(6, '0')}`);
  }
  for (const st of STYLES) {
    for (const c of colours) {
      for (const [name, fg, bg] of textPairs(palette(st, c))) {
        const r = contrast(fg, bg);
        assert.ok(r >= MIN_CONTRAST, `${st.id} with ${c}: ${name} ${fg} on ${bg} is ${r.toFixed(2)}`);
      }
    }
  }
  // A colour that already reads well is kept as picked.
  assert.equal(fitColor('#1d4ed8', ['#ffffff']), '#1d4ed8');
  assert.notEqual(fitColor('#ffff00', ['#ffffff']), '#ffff00');
});

// ---------------- safety ----------------

const NASTY = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "' onmouseover='alert(1)",
  '</style><script>alert(1)</script>',
  '</title><script>x</script>',
  '<!-- -->',
  '{city} & co',
];

test('esc escapes every character that could leave text', () => {
  assert.equal(esc(`<a href="x" onclick='y'>&</a>`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.equal(esc('नमस्ते'), 'नमस्ते');
});

test('nothing typed can become markup: names, cities and headings are escaped everywhere', () => {
  for (const bad of NASTY) {
    // Straight into the generator, past every cleaner.
    const raw: Site = { ...base(), name: bad, city: bad, edits: { h: bad, b: bad, menu: bad, about: bad, contact: bad } };
    for (const lang of LANG_IDS) {
      const html = siteHtml(raw, lang);
      assert.doesNotMatch(html, /<script/i, bad);
      assert.doesNotMatch(html, /<img/i, bad);
      for (const tag of html.match(/<[a-z][^>]*>/gi) ?? []) assert.doesNotMatch(tag, /\son[a-z]+=/i, `${bad}: ${tag}`);
      assert.equal(html.match(/<\/style>/g)?.length, 1, `${bad}: exactly one </style>`);
      assert.equal(html.match(/<\/title>/g)?.length, 1, `${bad}: exactly one </title>`);
      assert.equal(html.match(/<!--/g)?.length, 1, `${bad}: only our own comment`);
    }
  }
  // And the cleaners on the way in (a link, localStorage) drop markup characters anyway.
  const s = normalizeSite({ name: '<b>Hi</b>', kind: 'shop', city: '"x"' })!;
  assert.doesNotMatch(s.name, /[<>]/);
});

test('the generated page makes no requests and runs no scripts', () => {
  for (const lang of LANG_IDS) {
    for (let st = 0; st < STYLES.length; st++) {
      const html = siteHtml({ ...newSite('Chiya Ghar', KIND_IDS[st % KIND_IDS.length], 'Mainz'), style: st, off: [] }, lang, { animate: st % 2 === 0 });
      assert.ok(html.startsWith('<!doctype html><html lang="'));
      assert.match(html, /translate="no"/);
      assert.ok(html.includes(`content="${SITE_CSP}"`), 'a CSP that allows nothing else');
      assert.match(SITE_CSP, /default-src 'none'/);
      assert.doesNotMatch(html, /<script|javascript:|<link|<iframe|<object|<embed|<form|@import|url\(/i);
      assert.doesNotMatch(html, /\ssrc=/i, 'no src attribute at all');
      const external = [...html.matchAll(/href="(https?:[^"]*)"/g)].map((m) => m[1]);
      assert.deepEqual([...new Set(external)], ['https://www.martnepali.com/work/instant'], 'only the watermark links out');
      assert.match(textOf(html), /MartNepali/, 'watermarked');
    }
  }
});

test('one h1 in the generated page (its own document), headings in order', () => {
  const html = siteHtml({ ...base(), off: [] }, 'en');
  assert.equal(html.match(/<h1>/g)?.length, 1);
  assert.ok((html.match(/<h2>/g)?.length ?? 0) >= 7);
});

// ---------------- the link, the saved state ----------------

test('a site survives the link, edits and order included', () => {
  let s = base();
  s = setColor(s, '#7c3aed');
  s = moveSection(s, 'faq', -3);
  s = toggleSection(s, 'gallery');
  s = toggleSection(s, 'events');
  s = setEdit(s, 'h', 'Momo & more');
  s = setEdit(s, 'menu', 'Was wir kochen');
  s = { ...shuffleStyle(s), words: 7 };
  const back = decodeSite(`#${encodeSite(s)}`);
  assert.deepEqual(back, s);
  assert.equal(siteHtml(back!, 'ne'), siteHtml(s, 'ne'));
  // A plain site keeps a short link.
  assert.ok(encodeSite(base()).length < 80, encodeSite(base()));
  assert.ok(!encodeSite(base()).includes('o='));
});

test('links are capped and cleaned: long text, unknown kinds, junk', () => {
  assert.equal(decodeSite(''), null);
  assert.equal(decodeSite('#k=shop'), null, 'no name, no site');
  assert.equal(decodeSite('#hello world'), null);
  const long = decodeSite(`#n=${'A'.repeat(500)}&k=nope&c=${'B'.repeat(500)}&s=999&w=-4&a=zzz&o=menu.bogus.-x&e.h=${'C'.repeat(900)}&e.bogus=1`)!;
  assert.equal(long.name.length, LIMITS.name);
  assert.equal(long.city.length, LIMITS.city);
  assert.equal(long.kind, 'other');
  assert.ok(long.style >= 0 && long.style < STYLES.length);
  assert.equal(long.words, 0);
  assert.equal(long.color, null);
  assert.deepEqual([...long.order].sort(), [...poolOf('other')].sort());
  assert.equal(long.edits.h?.length, LIMITS.head);
  assert.ok(!('bogus' in long.edits));
  // Every heading edited to the limit still fits in a capped link.
  let s = { ...base(), off: [] as Site['off'] };
  for (const k of ['h', 'b', ...poolOf('restaurant')] as const) s = setEdit(s, k, 'ह'.repeat(200));
  const enc = encodeSite(s);
  assert.ok(enc.length <= HASH_MAX, String(enc.length));
  assert.ok(decodeSite(enc));
  // Saved state reads back the same way, and junk is harmless.
  assert.deepEqual(cleanSaved({ v: 1, site: encodeSite(base()), device: 'phone' }), { site: base(), device: 'phone' });
  assert.deepEqual(cleanSaved({ site: 42, device: 'fridge' }), { site: null, device: 'desktop' });
  assert.deepEqual(cleanSaved(null), { site: null, device: 'desktop' });
});

test('drag and drop and the arrows move sections and stop at the ends', () => {
  const s = base();
  assert.deepEqual(moveSection(s, s.order[0], -1), s);
  assert.deepEqual(moveSection(s, s.order.at(-1)!, 1), s);
  const d = placeSection(s, 'contact', 'about');
  assert.equal(d.order[0], 'contact');
  assert.equal(d.order.length, s.order.length);
  assert.deepEqual(toggleSection(toggleSection(s, 'menu'), 'menu').off, s.off);
  assert.equal(setEdit(setEdit(s, 'h', 'x'), 'h', '  ').edits.h, undefined, 'an emptied field goes back to the generated words');
});

// ---------------- around it ----------------

test('the brief for /contact: their name, kind and city, a link back, never too long', () => {
  for (const lang of LANG_IDS) {
    const c = COPY[lang];
    const s = setColor(base(), '#15803d');
    const brief = instantBrief(s, c.brief, c.styles[STYLES[s.style].id], (id) => c.sectionNames[id]);
    assert.ok(brief.includes('Chiya Ghar') && brief.includes('Mainz'), brief);
    assert.match(brief, /\/work\/instant#n=/);
    assert.equal(cleanBrief(brief), brief, 'the contact page keeps it as is');
    assert.ok(Array.from(brief).length <= BRIEF_MAX);
    const href = contactHref(brief);
    assert.match(href, /^\/contact\?intent=website&brief=/);
    assert.equal(decodeURIComponent(href.split('brief=')[1]), brief);
    // Very long names and cities still fit.
    const big = { ...newSite('ज'.repeat(40), 'verein', 'क'.repeat(30)), off: [] };
    const b2 = instantBrief(big, c.brief, 'x'.repeat(40), (id) => c.sectionNames[id]);
    assert.ok(Array.from(b2).length <= BRIEF_MAX);
  }
});

test('the build takes about ten seconds, one beat per section', () => {
  for (const k of KIND_IDS) {
    const all = timeline(poolOf(k));
    const def = timeline(onSections(newSite('X', k)));
    assert.equal(def.at(-1)!.key, 'done');
    assert.ok(def.at(-1)!.at >= 5000 && all.at(-1)!.at <= 11500, `${k}: ${def.at(-1)!.at}–${all.at(-1)!.at} ms`);
    for (let i = 1; i < def.length; i++) assert.ok(def[i].at > def[i - 1].at);
  }
  for (const lang of LANG_IDS) for (const k of [...Object.keys(COPY[lang].steps)]) assert.ok(COPY[lang].steps[k as keyof typeof COPY.en.steps]);
});

test('the pretend address and the file name are tidy', () => {
  assert.equal(demoHost('Chiya Ghar'), 'chiya-ghar.martnepali.demo');
  assert.equal(demoHost('नमस्ते'), 'your-name.martnepali.demo');
  assert.equal(fileName('Café Ü <x>'), 'cafe-u-x-website-demo.html');
});

test('every language has every word the tool and the generator need', () => {
  for (const lang of LANG_IDS) {
    const c = COPY[lang];
    for (const k of KIND_IDS) assert.ok(c.kinds[k] && c.brief.kinds[k], `${lang} ${k}`);
    for (const id of SECTION_IDS) assert.ok(c.sectionNames[id], `${lang} ${id}`);
    for (const st of STYLES) assert.ok(c.styles[st.id], `${lang} ${st.id}`);
    assert.match(c.real, /Kura garau/);
  }
});
