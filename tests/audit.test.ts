/**
 * THE AUDIT, AUDITED.
 *
 * scripts/audit-bazaar.mjs reports by NOT firing. Run it and it says
 * "Everything checked passed", and that sentence means one of two completely
 * different things: the site is fine, or a check broke and has been quietly
 * approving everything ever since. From outside they are indistinguishable —
 * both are green, and the broken one is more reassuring because it never
 * complains.
 *
 * That is the whole reason this file exists. Every check below is handed a
 * page that breaks its rule and required to complain, and then handed a page
 * that keeps the rule and required to stay silent. Both halves matter: a check
 * that fires on everything is as useless as one that fires on nothing, and it
 * is worse, because people start ignoring it.
 *
 * The HTML fragments are deliberately minimal — the point is the rule, not a
 * realistic page — except where a rule is about the shape of a real component,
 * in which case the fragment is copied from what the site actually renders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkAccessibility,
  checkArtifacts,
  checkDisclosure,
  checkExampleMarks,
  checkHead,
  checkLang,
  checkLeaks,
  checkRatings,
  checkShareCard,
  checkStructuredData,
  checkTogether,
  checkUrls,
  runCheck,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — a plain .mjs script, deliberately not typed
} from '../scripts/audit-bazaar.mjs';

type Finding = { level: string; check: string; path: string; detail: string };

const fails = (found: Finding[]) => found.filter((f) => f.level === 'FAIL');

/** A page skeleton with everything the whole-page checks insist on. */
function page(body: string, head = ''): string {
  return (
    `<html lang="en"><head><title>A page</title>` +
    `<meta name="description" content="${'x'.repeat(80)}">` +
    `<link rel="canonical" href="/x">` +
    `<meta property="og:title" content="t"><meta property="og:description" content="d">` +
    `<meta property="og:image" content="/api/og">` +
    head +
    `</head><body><a class="skip-link" href="#main">Skip</a><main id="main"><h1>A page</h1>` +
    body +
    `</main></body></html>`
  );
}

// ---------------------------------------------------------------- disclosure

const TILE_WITH_SELLER = `<a class="bz-tile" href="/e/s/item/i"><div class="bz-tile-price">€10.50</div>
  <div class="bz-tile-seller">Sold by <strong>Sunita’s Kitchen</strong> · Berlin</div></a>`;
const TILE_WITHOUT_SELLER = `<a class="bz-tile" href="/e/s/item/i"><div class="bz-tile-price">€10.50</div>
  <div class="bz-tile-name">Chicken momo</div></a>`;

test('disclosure: an item tile priced with nobody’s name on it is caught', () => {
  // The check with the most attached to it — a buyer page that prices goods
  // without naming the seller is what turns the order value into the
  // platform's own turnover.
  const found = fails(runCheck(checkDisclosure, page(TILE_WITHOUT_SELLER)));
  assert.equal(found.length, 1, 'exactly one tile is wrong, so exactly one finding');
  assert.match(found[0].detail, /names no seller/);
});

test('disclosure: a tile that names its seller is left alone', () => {
  assert.deepEqual(runCheck(checkDisclosure, page(TILE_WITH_SELLER)), []);
});

test('disclosure: a tile with no price at all is not asked to name anybody', () => {
  const noPrice = `<a class="bz-tile" href="/x"><div class="bz-tile-name">Coming soon</div></a>`;
  assert.deepEqual(runCheck(checkDisclosure, page(noPrice)), []);
});

// ------------------------------------------------------------------ example

test('example: an invented seller without its badge is caught', () => {
  const unmarked = `<a class="bz-tile" href="/x"><div class="bz-tile-price">€9.50</div>
    <div class="bz-tile-seller">An example shop by <strong>Taplejung Alaichi Ghar</strong></div></a>`;
  const found = fails(runCheck(checkExampleMarks, page(unmarked)));
  assert.equal(found.length, 1);
  assert.match(found[0].detail, /without its badge/);
});

test('example: the same tile carrying the badge passes', () => {
  const marked = `<a class="bz-tile" href="/x"><span class="badge badge-amber">Example shop</span>
    <div class="bz-tile-price">€9.50</div>
    <div class="bz-tile-seller">An example shop by <strong>Taplejung Alaichi Ghar</strong></div></a>`;
  assert.deepEqual(fails(runCheck(checkExampleMarks, page(marked))), []);
});

// ------------------------------------------------------------------ ratings

test('ratings: a score built out of no reviews is caught', () => {
  const found = fails(runCheck(checkRatings, page('<p>Rated 0.0 from 0 reviews</p>')));
  assert.ok(found.length > 0, 'a zero-review score must never render');
});

test('ratings: a real score with its count passes', () => {
  const stars = `<a class="bz-stars" href="#reviews" aria-label="4.5 out of 5 from 12 reviews">
    <span class="bz-rating-count">4.5 (12)</span></a>`;
  assert.deepEqual(fails(runCheck(checkRatings, page(stars))), []);
});

// ----------------------------------------------------------------- together

test('together: "often bought together" without saying where it came from is caught', () => {
  const found = fails(runCheck(checkTogether, page('<h2>Often bought together</h2><p>These go well.</p>')));
  assert.equal(found.length, 1);
});

test('together: the same block that explains itself passes', () => {
  const honest =
    '<h2>Often bought together</h2><p>Built from what people actually ordered here: ' +
    'every item below turned up in at least two separate paid orders alongside this one.</p>';
  assert.deepEqual(fails(runCheck(checkTogether, page(honest))), []);
});

// --------------------------------------------------------------------- urls

test('urls: a link that writes an empty parameter is caught', () => {
  const found = fails(runCheck(checkUrls, page('<a href="/market/items?q=&c=jewellery">x</a>')));
  assert.ok(found.length > 0, 'one page must have one address');
});

test('urls: a clean query string passes', () => {
  assert.deepEqual(fails(runCheck(checkUrls, page('<a href="/market/items?c=jewellery">x</a>'))), []);
});

// ---------------------------------------------------------------- artifacts

test('artifacts: a rendering slip that reached the page is caught', () => {
  for (const slip of ['undefined', 'NaN', '[object Object]']) {
    const found = fails(runCheck(checkArtifacts, page(`<p>Collect from ${slip} on Saturday</p>`)));
    assert.ok(found.length > 0, `"${slip}" must be caught`);
  }
});

test('artifacts: the same word inside a script is not the page saying it', () => {
  const inScript = page('<p>All good</p><script>var x = undefined;</script>');
  assert.deepEqual(fails(runCheck(checkArtifacts, inScript)), []);
});

// --------------------------------------------------------------------- a11y

test('a11y: an image with no alt attribute is caught', () => {
  const found = fails(runCheck(checkAccessibility, page('<img src="/api/media/x">')));
  assert.ok(found.some((f) => /no alt attribute/.test(f.detail)));
});

test('a11y: alt="" is a decision, not a defect', () => {
  // The decorative marker. Flagging it buried the real findings under a dozen
  // correct calls, which is how a checker teaches people to skip it.
  assert.deepEqual(fails(runCheck(checkAccessibility, page('<img src="/x" alt="">'))), []);
});

test('a11y: a control wrapped in its own label is named', () => {
  const wrapped = page('<label class="checkbox-row"><input type="checkbox"><span>I agree</span></label>');
  assert.deepEqual(fails(runCheck(checkAccessibility, wrapped)), []);
});

test('a11y: a control with no name at all is caught', () => {
  const bare = page('<input type="checkbox">');
  assert.ok(fails(runCheck(checkAccessibility, bare)).some((f) => /accessible name/.test(f.detail)));
});

test('a11y: two h1s, a duplicate id, a missing landmark and a missing skip link are each caught', () => {
  const twoH1 = page('<h1>Second</h1>');
  assert.ok(fails(runCheck(checkAccessibility, twoH1)).some((f) => /2 <h1>/.test(f.detail)));

  const dupe = page('<div id="reviews"></div><div id="reviews"></div>');
  assert.ok(fails(runCheck(checkAccessibility, dupe)).some((f) => /duplicate id/.test(f.detail)));

  const noMain = '<html><body><a class="skip-link" href="#main">s</a><h1>x</h1></body></html>';
  assert.ok(fails(runCheck(checkAccessibility, noMain)).some((f) => /<main> landmark/.test(f.detail)));

  const noSkip = '<html><body><main><h1>x</h1></main></body></html>';
  assert.ok(fails(runCheck(checkAccessibility, noSkip)).some((f) => /skip link/.test(f.detail)));
});

// --------------------------------------------------------------------- head

test('head: a page with no title and no description is caught', () => {
  const bald = '<html><head></head><body><main><h1>x</h1></main></body></html>';
  const found = fails(runCheck(checkHead, bald));
  assert.ok(found.some((f) => /no <title>/.test(f.detail)));
  assert.ok(found.some((f) => /no meta description/.test(f.detail)));
});

test('head: two canonicals are caught, one is fine', () => {
  const two = page('', '<link rel="canonical" href="/a"><link rel="canonical" href="/b">');
  assert.ok(fails(runCheck(checkHead, two)).some((f) => /canonical/.test(f.detail)));
  assert.deepEqual(fails(runCheck(checkHead, page(''))), []);
});

// --------------------------------------------------------------------- leak

test('leak: a database row serialised into a public page is caught', () => {
  const leaked = page('<p>fine</p>') + '{"bankIban":"DE12","paypalAccount":"x@y.z"}';
  const found = fails(runCheck(checkLeaks, leaked));
  assert.ok(found.some((f) => /bankIban/.test(f.detail)));
  assert.ok(found.some((f) => /paypalAccount/.test(f.detail)));
});

test('leak: the same names in a DEV payload warn instead of failing', () => {
  // A dev server inlines React's owner stacks, which legitimately carry every
  // server component's props. Failing there would make the check useless in
  // the one place people run it most.
  const dev = page('<p>x</p>') + 'webpack-internal:///(rsc)/./src/app/page.tsx {"bankIban":""}';
  const found = runCheck(checkLeaks, dev);
  assert.ok(found.length > 0);
  assert.deepEqual(fails(found), []);
});

test('leak: an ordinary page says nothing', () => {
  assert.deepEqual(runCheck(checkLeaks, page('<p>Collect on Saturdays</p>')), []);
});

// --------------------------------------------------------------------- lang

test('lang: Nepali text outside any lang="ne" is caught', () => {
  const found = runCheck(checkLang, page('<h2>खाजा &middot; Khaja</h2>'));
  assert.ok(found.length > 0, 'a screen reader would read this with English phonemes');
});

test('lang: the same text marked as Nepali passes', () => {
  assert.deepEqual(runCheck(checkLang, page('<h2><span lang="ne">खाजा</span> · Khaja</h2>')), []);
});

test('lang: Devanagari in a <title> is exempt — there is nowhere to mark it', () => {
  const titled = '<html lang="en"><head><title>यो हप्ता के छ</title></head><body><main><h1>x</h1></main></body></html>';
  assert.deepEqual(runCheck(checkLang, titled), []);
});

// -------------------------------------------------------------------- share

test('share: a page with no og:image is caught, and one with it is not', () => {
  const noCard =
    '<html><head><title>t</title><meta name="description" content="d"></head>' +
    '<body><main><h1>x</h1></main></body></html>';
  assert.ok(runCheck(checkShareCard, noCard).some((f) => /og:image/.test(f.detail)));
  assert.deepEqual(runCheck(checkShareCard, page('')), []);
});

test('share: a noindex page is not asked for a preview picture', () => {
  const priv = '<html><head><meta name="robots" content="noindex, follow"></head><body></body></html>';
  assert.deepEqual(runCheck(checkShareCard, priv), []);
});

// ---------------------------------------------------------------- structure

test('structure: JSON-LD that does not parse is caught', () => {
  const broken = page('<script type="application/ld+json">{not json}</script>');
  assert.ok(fails(runCheck(checkStructuredData, broken)).some((f) => /does not parse/.test(f.detail)));
});

test('structure: an ItemList whose count disagrees with its own list is caught', () => {
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: 5,
    itemListElement: [{ '@type': 'ListItem', position: 1, name: 'a', url: 'https://x.test/e/s/item/a' }],
  });
  const found = fails(runCheck(checkStructuredData, page(`<script type="application/ld+json">${ld}</script>`)));
  assert.ok(found.some((f) => /says 5 items and lists 1/.test(f.detail)));
});

test('structure: an ItemList offering a URL the page does not link to is caught', () => {
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: 1,
    itemListElement: [{ '@type': 'ListItem', position: 1, name: 'a', url: 'https://x.test/e/s/item/ghost' }],
  });
  const found = fails(runCheck(checkStructuredData, page(`<script type="application/ld+json">${ld}</script>`)));
  assert.ok(found.some((f) => /does not link to/.test(f.detail)));
});

test('structure: an ItemList that matches its page passes', () => {
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: 1,
    itemListElement: [{ '@type': 'ListItem', position: 1, name: 'a', url: 'https://x.test/e/s/item/a' }],
  });
  const body = `<a href="/e/s/item/a">a</a><script type="application/ld+json">${ld}</script>`;
  assert.deepEqual(fails(runCheck(checkStructuredData, page(body))), []);
});

test('structure: aggregateRating with nothing behind it is caught', () => {
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Momo',
    offers: { '@type': 'Offer', price: '9.50', seller: { name: 'Sunita' } },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: '5.0', reviewCount: 0 },
  });
  const found = fails(runCheck(checkStructuredData, page(`<script type="application/ld+json">${ld}</script>`)));
  assert.ok(found.some((f) => /no reviews behind it/.test(f.detail)));
});
