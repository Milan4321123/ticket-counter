/**
 * THE IDEA BUILDER'S BRIEF ARRIVES IN THE CHAT CLEAN, SHORT AND UNSENT.
 *
 * /work/build sends a visitor to /contact?intent=app&brief=<text>; the page
 * cleans the text (lib/ideaBrief) and the chat shows it as an editable,
 * unsent message. Anyone can build such a link, so: one line, no markup, no
 * foreign links, no invisible direction tricks, never over the chat's cap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRIEF_MAX, cleanBrief } from '../src/lib/ideaBrief.ts';
import { scriptedTurn, EMPTY_FIELDS } from '../src/lib/creatorChat.ts';
import { COPY } from '../src/app/work/build/content.ts';
import { EMPTY_IDEA, contactHref, ideaBrief, normalizeIdea } from '../src/app/work/build/idea.ts';

test('nothing, or not a string, is no brief', () => {
  assert.equal(cleanBrief(undefined), '');
  assert.equal(cleanBrief(null), '');
  assert.equal(cleanBrief(42), '');
  assert.equal(cleanBrief({ a: 1 }), '');
  assert.equal(cleanBrief('   '), '');
});

test('the first of several ?brief= values is taken', () => {
  assert.equal(cleanBrief(['first idea', 'second']), 'first idea');
});

test('one line: newlines become a separator, control characters a space', () => {
  assert.equal(cleanBrief('An app\nfor my shop\r\n\r\nwith codes'), 'An app · for my shop · with codes');
  assert.equal(cleanBrief('tab\there\u0007bell'), 'tab here bell');
});

test('no markup and no invisible direction overrides — but Devanagari joiners stay', () => {
  assert.equal(cleanBrief('<script>alert(1)</script> hi'), 'scriptalert(1)/script hi');
  assert.equal(cleanBrief('abc‮def​'), 'abcdef');
  const ne = 'क्‍ष र ज्ञ'; // includes a zero-width joiner
  assert.equal(cleanBrief(ne), ne.normalize('NFC'));
});

test('foreign links are dropped; our own sketch link survives', () => {
  assert.equal(cleanBrief('see https://evil.example/x now'), 'see now');
  assert.equal(cleanBrief('see javascript:alert(1) now'), 'see now');
  assert.equal(cleanBrief('see www.spam.example now'), 'see now');
  assert.equal(cleanBrief('see evil.example/path now'), 'see now');
  assert.equal(cleanBrief('see //evil.example now'), 'see now');
  assert.equal(cleanBrief('go /admin/x now'), 'go now');
  assert.equal(cleanBrief('Sketch: /work/build#k=shop&f=shop.news'), 'Sketch: /work/build#k=shop&f=shop.news');
  // Ordinary dotted words are not links.
  assert.equal(cleanBrief('Saathi Samaj e.V. in Frankfurt'), 'Saathi Samaj e.V. in Frankfurt');
});

test('never longer than the chat takes, cut at a word with an ellipsis', () => {
  const long = 'momo '.repeat(400);
  const out = cleanBrief(long);
  assert.ok(Array.from(out).length <= BRIEF_MAX, String(out.length));
  assert.ok(out.endsWith('…'));
  assert.match(out, /momo…$/, 'cut at a whole word');
  // Counted in characters, not UTF-16 units: Devanagari and emoji are not split.
  const ne = 'नमस्ते 🙏 '.repeat(200);
  const outNe = cleanBrief(ne);
  assert.ok(Array.from(outNe).length <= BRIEF_MAX);
  assert.ok(!/[\uD800-\uDBFF]$/.test(outNe.replace(/…$/, '')), 'no half emoji');
  assert.equal(cleanBrief('short', 3), 'sh…');
});

test('the builder writes a brief in each language that the chat reads as a request to build', () => {
  const idea = normalizeIdea({
    kind: 'restaurant',
    name: 'Himalayan Chulo',
    tagline: 'Momo & more',
    color: '#ea580c',
    make: 'both',
    features: ['menu', 'lang', 'chat', 'gallery', 'tickets'],
  });
  for (const lang of ['en', 'de', 'ne'] as const) {
    const brief = ideaBrief(idea, COPY[lang].brief);
    assert.ok(brief.length > 30 && Array.from(brief).length <= BRIEF_MAX, lang);
    assert.equal(cleanBrief(brief), brief, `${lang}: already clean`);
    assert.match(brief, /Himalayan Chulo/, lang);
    assert.match(brief, /\/work\/build#k=restaurant/, `${lang}: links back to the sketch`);
    // The chat's scripted fallback files it as design work and keeps it as the summary.
    const turn = scriptedTurn([{ from: 'bot', text: 'Namaste 🙏' }, { from: 'me', text: brief }], EMPTY_FIELDS);
    assert.equal(turn.fields.kind, 'custom-design', lang);
    assert.equal(turn.fields.summary, brief.slice(0, 600), lang);
    // No money, no estimates.
    assert.doesNotMatch(brief, /€|\bprice|\bcost|\bbudget|\bquote|\bestimat|preis|kosten|मूल्य|शुल्क/i, lang);
  }
});

test('a huge idea still fits: the sketch link goes first, then features from the end', () => {
  const idea = normalizeIdea({
    kind: 'other',
    other: 'x'.repeat(40),
    name: 'N'.repeat(40),
    tagline: 'T'.repeat(60),
    make: 'both',
    features: ['tickets', 'menu', 'shop', 'booking', 'members', 'quiz', 'dashboard', 'lang', 'chat', 'news', 'gallery', 'video', 'stage'],
  });
  for (const lang of ['en', 'de', 'ne'] as const) {
    const brief = ideaBrief(idea, COPY[lang].brief);
    assert.ok(Array.from(brief).length <= BRIEF_MAX, `${lang}: ${brief.length}`);
    assert.match(brief, /N{40}/, `${lang}: the name is kept`);
  }
});

test('"Send this to us" opens the chat on apps or websites, with the brief encoded', () => {
  const idea = { ...EMPTY_IDEA, make: 'web' as const };
  assert.equal(contactHref(idea, 'A b&c'), '/contact?intent=website&brief=A%20b%26c');
  assert.match(contactHref({ ...idea, make: 'app' }, 'x'), /^\/contact\?intent=app&brief=x$/);
  assert.match(contactHref({ ...idea, make: 'both' }, 'x'), /^\/contact\?intent=app&/);
});
