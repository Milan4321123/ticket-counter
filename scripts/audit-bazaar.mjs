#!/usr/bin/env node
// Hold the running site to the promises the code makes about it.
//
// The suite in tests/ checks the functions. It cannot check the thing a
// visitor actually receives, and almost every rule this project cares about is
// a rule about THAT: a price with no seller beside it is a VAT problem
// (§3 Abs. 11 UStG) whatever the function returned; an example shop that lost
// its mark on one tile is a person sent to a doorbell that does not exist; a
// rating rendered as "0.0" is a lie about goods nobody has reviewed. Those are
// properties of HTML, so this reads the HTML.
//
// It is a crawler with opinions, not a linter. Every check below exists
// because the rule it defends is written down somewhere in this repo as a
// sentence somebody could quietly break:
//
//   disclosure   every price a buyer can see names who is selling
//   example      an invented shop says so wherever it appears
//   ratings      no score without the count it came from, no score at zero
//   together     "often bought together" only where the page also says why
//   links        nothing on a public page leads to a 404
//   urls         one page has one address — no ?q=&c= spellings of "everything"
//   a11y         images have alt text, controls have names, headings nest
//   head         a title, a description, and one canonical per page
//   artifacts    no undefined / NaN / [object Object] reaching a person
//   structure    JSON-LD parses, and a Product carries price and seller
//   leak         no database row reaches the browser inside a page
//   sitemap      what we ask Google to index exists, and agrees with the page
//   lang         Nepali text is marked as Nepali, not read out as English
//   duplicate    no two indexable pages share a title or a description
//   share        a link pasted into WhatsApp shows a picture, not a grey box
//   caching      photos are cacheable; everything else under /api is not
//   css          every class the pages use is one the stylesheets define
//   hostile      a hand-edited URL cannot crash a page or inject into it
//   csp          the site's own policy allows the third parties its code loads
//   weight       a page arrives in a size and a time a phone can afford
//
// Run it against a dev server, a preview, or production:
//
//   npm run audit                       # http://localhost:3000
//   npm run audit -- https://martnepali.com
//   npm run audit -- http://localhost:3000 --json   # machine-readable
//
// Exit code 1 when anything FAILED, 0 otherwise — so it can sit in a
// pre-deploy step. Warnings never fail the run: they are things worth looking
// at that a reasonable page might do on purpose.
//
// It only ever GETs public pages. It never signs in, never posts, and never
// touches /admin, /portal, /scan or an order page — a crawler that wandered
// into those would be reading somebody's private data to check a heading.

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3000').replace(/\/+$/, '');

/** Pages every run checks. Anything reachable from them is link-checked too. */
const SEED_PATHS = [
  '/',
  '/market',
  '/market/items',
  '/market/items?sort=price-asc',
  '/market/items?c=groceries-spices',
  '/market/saved',
  '/festivals',
  '/patro',
  '/organizers',
];

/**
 * Never fetched, whatever links to them. The private half of the site (an
 * order page is somebody's own receipt; the scanner is door security), plus
 * the two routes that exist to send mail or file a row.
 */
const OFF_LIMITS = [/^\/admin\b/, /^\/portal\b/, /^\/scan\b/, /^\/order\//, /^\/ticket\//, /^\/c\//, /^\/api\//, /^\/unsubscribe\b/];

/**
 * Not pages. The build's own assets are linked from every document and they
 * are not HTML — running heading and alt-text checks over a webpack chunk
 * produces a screenful of nonsense that buries the real findings, which is
 * exactly what the first run of this script did.
 */
const NOT_A_PAGE = [/^\/_next\//, /^\/favicon/, /\.(css|js|mjs|map|png|jpe?g|svg|webp|avif|ico|txt|xml|webmanifest|woff2?)($|\?)/i];

const findings = [];
const seen = new Map(); // path -> { status, html, ms, bytes }

function report(level, check, path, detail) {
  findings.push({ level, check, path, detail });
}
const fail = (check, path, detail) => report('FAIL', check, path, detail);
const warn = (check, path, detail) => report('WARN', check, path, detail);

// ---------------------------------------------------------------- fetching

async function get(path) {
  if (seen.has(path)) return seen.get(path);
  const started = Date.now();
  let res;
  try {
    res = await fetch(base + path, { redirect: 'follow', headers: { 'user-agent': 'martnepali-audit' } });
  } catch (e) {
    const miss = { status: 0, html: '', ms: Date.now() - started, bytes: 0, error: String(e) };
    seen.set(path, miss);
    return miss;
  }
  const html = await res.text();
  const entry = { status: res.status, html, ms: Date.now() - started, bytes: Buffer.byteLength(html) };
  seen.set(path, entry);
  return entry;
}

// ------------------------------------------------------------ tiny parsing
//
// Deliberately string-level rather than a DOM library: this script has to run
// with no dependencies at all, against a production URL, from anybody's
// machine. Everything it looks at is generated by this repo's own components,
// so the shapes are known — and where a check cannot be certain it warns
// instead of failing.

const stripTags = (html) => html.replace(/<[^>]+>/g, ' ');
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'",
  '&nbsp;': ' ', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
  '&middot;': '·', '&mdash;': '—', '&ndash;': '–', '&euro;': '€', '&hellip;': '…', '&times;': '×',
};
const decode = (s) => s.replace(/&[#a-zA-Z0-9]+;/g, (m) => ENTITIES[m] ?? m);
const text = (html) => decode(stripTags(html)).replace(/\s+/g, ' ').trim();

/** The bodies of every <a> whose class attribute contains `needle`. */
function anchors(html, needle) {
  const out = [];
  const re = /<a\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const open = m[0];
    const cls = /class="([^"]*)"/i.exec(open)?.[1] ?? '';
    if (!cls.includes(needle)) continue;
    // Anchors cannot nest, so the next closing tag is this one's.
    const end = html.indexOf('</a>', re.lastIndex);
    if (end === -1) continue;
    out.push({ open, inner: html.slice(re.lastIndex, end) });
  }
  return out;
}

/** Every href on the page, as site-relative paths, deduped. */
function links(html) {
  const out = new Set();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    let href = decode(m[1]);
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (href.startsWith(base)) href = href.slice(base.length) || '/';
    if (/^https?:/i.test(href)) continue; // another site's problem
    if (!href.startsWith('/')) continue;
    out.add(href.split('#')[0]);
  }
  return [...out];
}

const offLimits = (path) => OFF_LIMITS.some((re) => re.test(path));
const notAPage = (path) => NOT_A_PAGE.some((re) => re.test(path));

// ------------------------------------------------------------------ checks

const SELLER_PHRASES = ['Sold by', 'An example shop by', 'Presented by', 'Part of', 'From'];
const PRICE_RE = /(?:€|EUR)\s?\d|(?:\d+[.,]\d{2}\s?(?:€|EUR))/;

/**
 * A price with nobody's name beside it.
 *
 * This is the check with the most money attached to it. Every buyer-facing
 * surface that quotes a price has to name the Veranstalter/seller, or the
 * order value can be treated as this platform's own turnover rather than the
 * seller's. It is checked per TILE rather than per page, because "the seller
 * is named somewhere on the page" is not the promise — the promise is that a
 * shopper reading a price can see whose it is.
 */
function checkDisclosure(path, html) {
  // An ITEM tile is the hard case and the one the rule was written for: it can
  // appear on a page that mixes forty sellers, so the tile itself has to say
  // whose the price is. A LISTING tile (a whole shop or event) is different —
  // its title IS the seller's own trading name, which is the disclosure, and
  // demanding "Sold by" inside it would be asking the page to say the name
  // twice. The page-level check below covers a shop's own item grid, where the
  // seller is named once for the whole page.
  for (const tile of anchors(html, 'bz-tile')) {
    const body = text(tile.inner);
    if (!PRICE_RE.test(body)) continue;
    if (SELLER_PHRASES.some((p) => body.includes(p))) continue;
    fail('disclosure', path, `an item tile shows a price and names no seller: "${body.slice(0, 120)}"`);
  }

  const page = text(html.replace(/<script[\s\S]*?<\/script>/gi, ' '));
  const pageHasPrice = [...anchors(html, 'tier-card-link')].some((t) => PRICE_RE.test(text(t.inner)));
  if (pageHasPrice && !SELLER_PHRASES.some((p) => page.includes(p))) {
    fail('disclosure', path, 'the page prices things and never names who is selling them');
  }
}

/** An invented shop that lost its mark on the way to a tile. */
function checkExampleMarks(path, html) {
  for (const tile of [...anchors(html, 'bz-tile'), ...anchors(html, 'tier-card-link'), ...anchors(html, 'event-card')]) {
    const body = text(tile.inner);
    const looksExample = /example shop|example seller/i.test(body);
    if (!looksExample) continue;
    if (/Example shop/.test(body)) continue;
    fail('example', path, `an example listing appears without its badge: "${body.slice(0, 120)}"`);
  }
}

/**
 * A score with no count behind it, or a score at zero reviews.
 *
 * lib/reviews returns null rather than 0.0 precisely so this can never render;
 * the check exists because the next person to add a star widget will not know
 * that, and "0.0 ★" reads as "people hated it" rather than "nobody has said".
 */
function checkRatings(path, html) {
  for (const stars of anchors(html, 'bz-stars')) {
    const body = text(stars.inner);
    if (!/\(\s*\d+\s*\)/.test(body)) warn('ratings', path, `stars without a review count: "${body.slice(0, 80)}"`);
  }
  const body = text(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '));
  if (/\b0\.0\s*\(?\s*0?\s*\)?\s*(?:star|review)/i.test(body)) {
    fail('ratings', path, 'a zero-review item is being scored 0.0');
  }
  if (/from 0 reviews/i.test(body)) fail('ratings', path, 'a rating summary claims 0 reviews');
}

/** "Often bought together" without the sentence that says where it came from. */
function checkTogether(path, html) {
  if (!/Often bought together/i.test(html)) return;
  const body = text(html);
  if (!/actually ordered|separate paid orders|orders with this one/i.test(body)) {
    fail('together', path, '"Often bought together" is shown without saying it comes from real orders');
  }
}

/** One page, one address: no empty query values, no dangling separators. */
function checkUrls(path, html) {
  for (const href of links(html)) {
    if (/[?&][^=&]+=(?:&|$)/.test(href)) fail('urls', path, `link writes an empty parameter: ${href}`);
    if (/\?&|&&|\?$/.test(href)) fail('urls', path, `malformed query string: ${href}`);
  }
}

function checkArtifacts(path, html) {
  const body = text(html);
  for (const bad of ['undefined', 'NaN', '[object Object]', 'Invalid Date', 'null null']) {
    // "undefined" can legitimately appear inside inlined JS payloads, which
    // stripTags leaves behind — so only flag it in visible prose.
    const visible = text(html.replace(/<script[\s\S]*?<\/script>/gi, ' '));
    if (visible.includes(bad)) fail('artifacts', path, `"${bad}" is rendered to the page`);
  }
  if (/&[a-z]+;/i.test(body)) warn('artifacts', path, 'an HTML entity is showing as text');
}

function checkAccessibility(path, html) {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');

  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (/aria-hidden="true"/.test(tag)) continue;
    const alt = /alt="([^"]*)"/i.exec(tag);
    // A MISSING alt is a defect; an EMPTY one is a decision. alt="" is the
    // standard, explicit way to say "this picture carries nothing a listener
    // needs" — which is exactly right for a shop's cover photo sitting beside
    // an <h1> that already names the shop, where a filled-in alt would make a
    // screen reader announce the name twice. Warning on every one of them
    // buried the real findings under a dozen correct decisions, and a checker
    // that cries about correct code is a checker people learn to skip.
    if (!alt) fail('a11y', path, `an image has no alt attribute: ${tag.slice(0, 110)}`);
  }

  // Where every <label> begins and ends, so a control WRAPPED in one counts as
  // named. This site writes most of its checkboxes as
  // `<label><input type="checkbox"><span>…</span></label>`, which is valid and
  // accessible and carries no for= at all — an earlier version of this check
  // reported every one of them as nameless, which is how a checker teaches
  // people to ignore it.
  const labelRanges = [];
  for (const m of body.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/gi)) {
    labelRanges.push([m.index, m.index + m[0].length]);
  }
  const insideLabel = (at) => labelRanges.some(([from, to]) => at > from && at < to);

  for (const m of body.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = m[0];
    if (/type="(hidden|submit|button|image)"/i.test(tag)) continue;
    const id = /\sid="([^"]+)"/i.exec(tag)?.[1];
    const labelled =
      /aria-label="[^"]+"/i.test(tag) ||
      /aria-labelledby="[^"]+"/i.test(tag) ||
      /\stitle="[^"]+"/i.test(tag) ||
      insideLabel(m.index) ||
      (id && new RegExp(`<label[^>]*for="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i').test(body));
    if (!labelled) fail('a11y', path, `a form control has no accessible name: ${tag.slice(0, 110)}`);
  }

  const headings = [...body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({
    level: Number(m[1]),
    label: text(m[2]).slice(0, 60),
  }));
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 0) fail('a11y', path, 'the page has no <h1>');
  if (h1s.length > 1) fail('a11y', path, `the page has ${h1s.length} <h1> elements: ${h1s.map((h) => h.label).join(' / ')}`);
  for (let i = 1; i < headings.length; i++) {
    const jump = headings[i].level - headings[i - 1].level;
    if (jump > 1) {
      warn('a11y', path, `heading level jumps h${headings[i - 1].level} → h${headings[i].level} at "${headings[i].label}"`);
    }
  }

  // The landmarks a screen-reader user navigates by, and the skip link that
  // lets a keyboard user reach the second one without walking the first.
  if (!/<main\b/i.test(body)) fail('a11y', path, 'the page has no <main> landmark');
  if (!/class="skip-link"/.test(body)) fail('a11y', path, 'no skip link — every page starts with the header');

  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of new Set(dupes)) fail('a11y', path, `duplicate id="${id}" — a label or anchor will point at the wrong element`);
}

/** Every indexable page's title and description, for the duplicate check. */
const headSeen = [];

function checkHead(path, html) {
  // Deliberately the WHOLE document, not the <head> slice. Next streams a
  // page's metadata into the body when the head is flushed before the
  // generateMetadata promise settles, so a head-only search reports "no title"
  // on pages that have one — which is worse than not checking at all.
  const head = html;
  const title = text(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? '');
  if (!title) fail('head', path, 'no <title>');
  else if (title.length > 70) warn('head', path, `title is ${title.length} characters — Google will cut it: "${title}"`);

  const desc = /<meta name="description" content="([^"]*)"/i.exec(head)?.[1];
  if (!desc) fail('head', path, 'no meta description');
  else {
    const len = decode(desc).length;
    if (len < 50) warn('head', path, `meta description is only ${len} characters`);
    if (len > 175) warn('head', path, `meta description is ${len} characters — it will be truncated`);
  }

  const robotsTag = /<meta name="robots" content="([^"]*)"/i.exec(head)?.[1] ?? '';
  if (!robotsTag.includes('noindex') && !path.includes('?')) {
    headSeen.push({ path, title, description: desc ? decode(desc) : '' });
  }

  const canonicals = [...head.matchAll(/<link rel="canonical" href="([^"]+)"/gi)];
  if (canonicals.length > 1) fail('head', path, `${canonicals.length} canonical links`);
  const robots = /<meta name="robots" content="([^"]*)"/i.exec(head)?.[1] ?? '';
  if (canonicals.length === 0 && !robots.includes('noindex')) {
    warn('head', path, 'an indexable page with no canonical link');
  }
}

/**
 * What this page looks like when somebody pastes it into a WhatsApp group.
 *
 * That is not a nice-to-have on this site: the digest page exists to be
 * copied into community groups, organizers share their event straight into
 * one, and lib/seo's own comments call the social preview "most of what SEO
 * means day to day" here. A link with no og:image renders as a grey box with
 * a line of text, and in a feed of photos it is the one nobody taps.
 *
 * Checked on indexable pages only — a private order page has nothing to
 * preview and should not be shared anyway.
 */
function checkShareCard(path, html) {
  const robotsTag = /<meta name="robots" content="([^"]*)"/i.exec(html)?.[1] ?? '';
  if (robotsTag.includes('noindex')) return;

  const has = (property) =>
    new RegExp(`<meta property="${property}" content="[^"]+"`, 'i').test(html) ||
    new RegExp(`<meta name="${property}" content="[^"]+"`, 'i').test(html);

  if (!has('og:title')) warn('share', path, 'no og:title — a shared link shows the raw URL');
  if (!has('og:description')) warn('share', path, 'no og:description');
  if (!has('og:image')) {
    warn('share', path, 'no og:image — pasted into WhatsApp this is a grey box');
  }
}

function checkStructuredData(path, html) {
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch (e) {
      fail('structure', path, `JSON-LD does not parse: ${String(e).slice(0, 120)}`);
      continue;
    }
    for (const node of Array.isArray(data) ? data : [data]) {
      if (node['@type'] === 'ItemList') {
        // An ItemList is a claim about THIS page: these products, in this
        // order, at these URLs. Google checks it against what the page shows,
        // and drops the page's structured data when the two disagree — so the
        // three ways it can drift are all failures here.
        const elements = Array.isArray(node.itemListElement) ? node.itemListElement : [];
        if (node.numberOfItems !== elements.length) {
          fail('structure', path, `ItemList says ${node.numberOfItems} items and lists ${elements.length}`);
        }
        const positions = elements.map((e) => e.position);
        const expected = elements.map((_, i) => i + 1);
        if (JSON.stringify(positions) !== JSON.stringify(expected)) {
          fail('structure', path, 'ItemList positions are not 1..n in order');
        }
        const onPage = new Set(links(html));
        for (const element of elements) {
          let listed;
          try {
            listed = new URL(element.url).pathname;
          } catch {
            fail('structure', path, `ItemList entry has an unusable url: ${element.url}`);
            continue;
          }
          if (!onPage.has(listed)) {
            fail('structure', path, `ItemList offers ${listed}, which this page does not link to`);
          }
        }
        continue;
      }
      if (node['@type'] !== 'Product') continue;
      // An Offer is a claim that this can be bought. A listing that cannot
      // take an order today (no payout route, sales closed, an example shop)
      // is RIGHT to publish a Product with no offers, so the requirement is
      // conditional on the page actually offering a way to buy — see
      // canTakePaidOrders() in lib/seo.
      // Whether the LISTING can take money is a server-side fact
      // (canTakePaidOrders: a payout route, sales open, not locked) and it is
      // not in the HTML — an example shop shows an Order button and still
      // refuses at the last step, on purpose. So a missing offer is reported
      // as something to look at rather than as a failure: from out here this
      // checker genuinely cannot tell "correctly not for sale" from "we forgot
      // the price", and pretending otherwise would make the audit lie.
      // An example shop is the one case where "no offer" is not just allowed
      // but required: the site publishes those itself, nothing on them can be
      // collected, and checkout refuses. They are marked in the HTML, so the
      // checker can see it — and reporting thirty-five of them every run
      // buried the case that actually matters, which is a REAL seller whose
      // items quietly cannot be bought because they never set up a payout
      // route. That one still warns.
      const looksBuyable =
        /class="btn btn-primary btn-lg"/.test(html) && !/Example shop/.test(text(html));
      const offers = Array.isArray(node.offers) ? (node.offers[0] ?? {}) : (node.offers ?? {});
      if (node.offers === undefined) {
        if (looksBuyable) {
          warn('structure', path, 'a Product with a buy button publishes no offer — correct only if this listing cannot take orders');
        }
      } else {
        if (offers.price === undefined) fail('structure', path, 'a Product offer has no price');
        if (!offers.seller && !node.brand && !node.seller) {
          fail('structure', path, 'a Product offer names no seller — a rich result would attribute it to the platform');
        }
      }
      const agg = node.aggregateRating;
      if (agg && (!agg.reviewCount || Number(agg.reviewCount) < 1)) {
        fail('structure', path, 'aggregateRating with no reviews behind it');
      }
    }
  }
}

/**
 * Column names that have no business being in a page a stranger can fetch.
 *
 * A React tree reaches the browser as JSON. Pass a whole database row to a
 * client component — an EventRow, an OrderRow, an organizer — and every field
 * on it travels with the page, including the ones the component never reads:
 * the seller's IBAN, their PayPal address, the private notes written for the
 * assistant. Nothing on this site does that today, and nothing about the way
 * it is written stops somebody doing it tomorrow by adding one 'use client'
 * to a file that already takes an `event` prop. This is the canary for that.
 *
 * A development server inlines React's own debug payload, which DOES carry
 * every server component's props — so on a dev build these names show up
 * legitimately. That case is reported as a warning naming the reason, because
 * failing there would train people to ignore the check that matters.
 */
const NEVER_PUBLIC = [
  'bankIban', 'bankAccountHolder', 'bankBic', 'paypalAccount', 'assistantContext',
  'payoutIban', 'payoutPaypal', 'passwordHash', 'buyerEmail', 'cardCode', 'shareCode',
];
function checkLeaks(path, html) {
  const isDevPayload = html.includes('webpack-internal');
  for (const field of NEVER_PUBLIC) {
    if (!html.includes(field)) continue;
    if (isDevPayload) {
      warn('leak', path, `"${field}" is in the HTML — via React's dev-only debug payload, so check this against a production build`);
    } else {
      fail('leak', path, `"${field}" is serialized into a public page — a database row is reaching a client component`);
    }
  }
}

const DEVANAGARI = /[\u0900-\u097F]/;

/**
 * Nepali text that has not been marked as Nepali.
 *
 * The document is lang="en". A screen reader meeting खाजा inside it applies
 * English pronunciation rules and produces noise — so the one part of a
 * heading written for a Nepali reader is the part a Nepali reader using a
 * screen reader cannot hear. Wrapping it in <span lang="ne"> (see
 * components/Np) fixes the voice and, as a side effect, stops some browsers
 * picking an English fallback font for it.
 *
 * A warning rather than a failure: the element-removal below is approximate —
 * it cannot see nesting the way a parser would — so a stubborn report here is
 * worth reading with your own eyes before believing it.
 */
function checkLang(path, html) {
  // The <head> is exempt, and not as a concession: <title> and
  // <meta content="…"> are plain text by definition — there is nowhere inside
  // them to put a lang, and a browser announces a title using the document's
  // language whatever we do. A page titled "यो हप्ता के छ — the weekly digest"
  // therefore cannot pass this check and should not be asked to.
  let rest = html
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    // …and the same tags wherever else they turn up. Next streams a page's
    // metadata into the BODY when the head has already been flushed, so
    // stripping <head> alone leaves an og:title behind and this check reports
    // a heading the page never rendered.
    .replace(/<title[\s\S]*?<\/title>/gi, ' ')
    .replace(/<meta\b[^>]*>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  // Drop every element that DOES declare Nepali, content and all, so whatever
  // Devanagari is left is Devanagari nobody marked.
  for (let pass = 0; pass < 6; pass++) {
    const before = rest;
    rest = rest.replace(/<([a-z0-9]+)\b[^>]*\blang="ne"[^>]*>[\s\S]*?<\/\1>/gi, ' ');
    if (rest === before) break;
  }
  if (!DEVANAGARI.test(text(rest))) return;
  const snippet = text(rest)
    .split(/\s+/)
    .filter((w) => DEVANAGARI.test(w))
    .slice(0, 6)
    .join(' ');
  warn('lang', path, `Nepali text outside any lang="ne": "${snippet}"`);
}

const WEIGHT_BUDGET = 400 * 1024;
const TIME_BUDGET = 2500;
function checkWeight(path, entry) {
  if (entry.bytes > WEIGHT_BUDGET) {
    warn('weight', path, `${Math.round(entry.bytes / 1024)} KB of HTML (budget ${WEIGHT_BUDGET / 1024} KB)`);
  }
  if (entry.ms > TIME_BUDGET) warn('weight', path, `${entry.ms} ms to first byte of HTML`);
}

/**
 * A third party the site's own code loads, that the site's own policy forbids.
 *
 * This one cost a day. Google Analytics was installed correctly, consented to,
 * deployed and present in the bundle — and the Content-Security-Policy said
 * `default-src 'self'` with no mention of googletagmanager.com, so the browser
 * refused to load it. CSP failures are silent apart from a console message
 * nobody is looking at, so from the outside it looked exactly like a tag that
 * had never been installed, and every other explanation got tried first.
 *
 * The check is deliberately narrow: the handful of third-party origins this
 * site actually talks to, each mapped to the directive that governs it. A
 * general "every https:// string in the JS must be allowed" would flag
 * schema.org, documentation links and anything else that happens to appear in
 * a string, and a check with false positives is a check nobody reads.
 */
const THIRD_PARTIES = [
  { host: 'www.googletagmanager.com', directive: 'script-src', what: 'Google Analytics loads its script from here' },
  { host: 'www.google-analytics.com', directive: 'connect-src', what: 'Google Analytics sends its beacons here' },
  { host: 'www.paypal.com', directive: 'script-src', what: 'the PayPal button' },
];

async function checkCsp(html) {
  const res = await fetch(base + '/market').catch(() => null);
  const policy = res?.headers.get('content-security-policy') ?? '';
  if (!policy) {
    warn('csp', '/market', 'no Content-Security-Policy header at all');
    return;
  }

  // What the site's own JavaScript actually references.
  const sheets = [...html.matchAll(/<script[^>]+src="(\/_next\/[^"]+)"/g)].map((m) => decode(m[1]));
  let code = '';
  for (const src of sheets.slice(0, 12)) {
    const chunk = await fetch(base + src).catch(() => null);
    if (chunk?.ok) code += await chunk.text();
  }

  for (const { host, directive, what } of THIRD_PARTIES) {
    if (!code.includes(host)) continue; // this deployment does not use it

    // The directive as written, falling back to default-src exactly as a
    // browser would.
    const named = new RegExp(`(?:^|;)\\s*${directive}\\s([^;]*)`).exec(policy);
    const fallback = /(?:^|;)\s*default-src\s([^;]*)/.exec(policy);
    const sources = (named?.[1] ?? fallback?.[1] ?? '').trim();

    const allowed =
      sources.includes(host) ||
      sources.includes(`*.${host.split('.').slice(-2).join('.')}`) ||
      sources.includes('*');
    if (!allowed) {
      fail(
        'csp',
        '/market',
        `the code loads ${host} (${what}) and ${directive} does not allow it — the browser will block it silently`
      );
    }
  }
}

/**
 * What a hand-edited URL does to the page that has the most of them.
 *
 * /market/items reads eight parameters — a search, a shelf, a town, a seller, a
 * price band, an in-stock flag, a sort and a page number — and every one of
 * them is a string somebody can type. Three things must hold for all of them,
 * and none is guaranteed by the framework:
 *
 *   · the page still answers 200. A filter page that 500s on ?page=0 is a
 *     broken page for anybody who ever edits a URL, and for every crawler that
 *     mangles one;
 *   · nothing typed comes back out as markup. React escapes by default, which
 *     makes this a check that a hand-built href or a dangerouslySetInnerHTML
 *     has not crept in later;
 *   · the answer is the honest empty state, not a wall of unfiltered results —
 *     a value that matches nothing must narrow to nothing, never widen.
 *
 * The SQL-shaped input is here for the same reason: the filters run in memory
 * today, and a future version that pushes them into a query should fail this
 * loudly rather than quietly.
 */
const HOSTILE_QUERIES = [
  'page=0',
  'page=-5',
  'page=abc',
  'page=99999',
  'band=nonsense',
  'sort=../../etc/passwd',
  'stock=maybe',
  'c=%00',
  'city=%3Cscript%3Ealert(1)%3C%2Fscript%3E',
  'shop=%22onmouseover%3D%22alert(2)',
  "shop='%3B%20DROP%20TABLE%20events%3B%20--",
  'q=%F0%9F%98%80',
];

async function checkHostileUrls() {
  for (const query of HOSTILE_QUERIES) {
    const path = `/market/items?${query}`;
    const res = await fetch(base + path).catch(() => null);
    if (!res) {
      fail('hostile', path, 'the request failed outright');
      continue;
    }
    if (res.status !== 200) {
      fail('hostile', path, `a hand-edited URL returned HTTP ${res.status}`);
      continue;
    }
    const html = await res.text();
    if (/<script>alert\(1\)<\/script>/.test(html) || /onmouseover="alert\(2\)"/.test(html)) {
      fail('hostile', path, 'a value from the URL was rendered as markup');
    }
  }

  // The events table is still there, and the site still works. Cheap, and the
  // only assertion that would catch the worst possible outcome above.
  const after = await fetch(base + '/market').catch(() => null);
  if (!after || !after.ok) fail('hostile', '/market', 'the bazaar stopped answering after the hostile URLs');
}

/**
 * A class name the HTML uses and no stylesheet defines.
 *
 * This is the only defect on the list that is completely invisible from the
 * server's side and nearly invisible from the browser's: the element renders,
 * it just renders unstyled, and unstyled in a dark-themed grid usually means
 * "looks slightly off" rather than "obviously broken". A typo in one class on
 * one branch of one component can sit there for months.
 *
 * Scoped to the prefixes this codebase actually owns. Checking EVERY class
 * would flag Next's own generated names and any utility the site borrows, and
 * a check with a dozen false positives is a check nobody reads.
 *
 * Only that one direction. See the note at the bottom of the function for why
 * the reverse — defined but unused — cannot be checked honestly from here.
 */
const OWNED_PREFIXES = ['bz-', 'skip-link', 'item-', 'tier-', 'feed-', 'event-', 'rail-', 'chip'];

async function checkCss(html) {
  const sheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => decode(m[1]));
  if (sheets.length === 0) {
    fail('css', '/', 'the page loads no stylesheet at all');
    return;
  }

  let css = '';
  for (const href of sheets) {
    const path = href.startsWith('http') ? new URL(href).pathname + new URL(href).search : href;
    const res = await fetch(base + path).catch(() => null);
    if (!res || !res.ok) {
      fail('css', path, `a stylesheet the pages load returns HTTP ${res?.status ?? 'nothing'}`);
      continue;
    }
    css += await res.text();
  }
  const defined = new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]));

  // Every class every audited page used, with where it was first seen.
  const used = new Map();
  for (const [path, entry] of seen) {
    if (!entry.html) continue;
    for (const m of entry.html.matchAll(/class="([^"]*)"/g)) {
      for (const name of m[1].split(/\s+/)) {
        if (!name || used.has(name)) continue;
        if (!OWNED_PREFIXES.some((p) => name.startsWith(p))) continue;
        used.set(name, path);
      }
    }
  }

  for (const [name, path] of used) {
    if (!defined.has(name)) {
      fail('css', path, `class "${name}" is used and no stylesheet defines it — the element renders unstyled`);
    }
  }

  // The reverse direction — defined and never used — is deliberately NOT
  // reported. This crawler never signs in, so it never sees the portal or the
  // admin, and it only reaches states something links to: it never renders an
  // empty search, a sold-out shop or a page with no reviews. Every class those
  // states need would be reported as dead code. Forty-three such warnings is
  // what the first version of this check produced, all of them wrong, which is
  // precisely how a checker teaches people to stop reading it.
}

/**
 * What a phone is allowed to keep, and what it must never keep.
 *
 * Two opposite mistakes, both invisible from the page and both expensive:
 *
 *   · a PHOTO served no-store, which means every visitor re-downloads every
 *     picture on every page view. This site shipped exactly that for a while —
 *     the media route asked for `immutable`, and a blanket rule over
 *     /api/:path* in next.config overruled it — on a platform whose audience
 *     is mostly on a phone and mostly on mobile data.
 *   · an API RESPONSE served cacheable, which is how one buyer's order lands
 *     in a shared proxy and is handed to the next person.
 *
 * So both directions are failures, and the reference list is the pictures the
 * audited pages actually asked for.
 */
async function checkCaching(imageUrls) {
  for (const url of imageUrls) {
    const res = await fetch(base + url).catch(() => null);
    const cc = res?.headers.get('cache-control') ?? '';
    if (!res || !res.ok) continue; // a broken image is the links check's job
    if (/no-store|no-cache/.test(cc)) {
      fail('caching', url, `a photo served \`${cc}\` — every visitor re-downloads it on every page`);
    }
  }

  // The other direction, on a route that answers with data rather than bytes.
  const res = await fetch(base + '/api/config').catch(() => null);
  const cc = res?.headers.get('cache-control') ?? '';
  if (res && res.ok && !/no-store/.test(cc)) {
    fail('caching', '/api/config', `an API response served \`${cc || 'no cache-control at all'}\``);
  }
}

/**
 * The sitemap and the pages, checked against each other in both directions.
 *
 * A sitemap is a request: "please index these". Two ways that goes wrong, and
 * this site's own sitemap.ts names both as rules it keeps —
 *
 *   · it lists a URL that 404s, which spends a crawler's budget on nothing and
 *     is the first symptom of a slug that changed;
 *   · it lists a URL whose own page says `noindex`, so the site is asking for
 *     two opposite things about one page and Google picks one.
 *
 * Both of those are failures. The third direction — a perfectly good page that
 * is NOT in the sitemap — is only a warning: a sitemap is allowed to be a
 * selection, and the pages left out here are usually left out on purpose.
 */
async function checkSitemap(auditedPaths) {
  const xml = await get('/sitemap.xml');
  if (xml.status !== 200) {
    fail('sitemap', '/sitemap.xml', `HTTP ${xml.status || xml.error} — nothing is being offered to Google`);
    return;
  }

  const listed = new Set();
  for (const m of xml.html.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    // The sitemap carries absolute URLs built from the deployment's own base,
    // which is not necessarily the origin being audited (a staging copy, this
    // demo). Compare paths, and let anything unparseable through as-is.
    try {
      listed.add(new URL(decode(m[1])).pathname || '/');
    } catch {
      listed.add(decode(m[1]));
    }
  }
  if (listed.size === 0) {
    fail('sitemap', '/sitemap.xml', 'the sitemap is empty');
    return;
  }

  for (const path of listed) {
    if (offLimits(path)) {
      fail('sitemap', path, 'the sitemap offers a page the site treats as private');
      continue;
    }
    const entry = await get(path);
    if (entry.status !== 200) {
      fail('sitemap', path, `the sitemap offers a URL that returns HTTP ${entry.status || entry.error}`);
      continue;
    }
    if (/<meta name="robots" content="[^"]*noindex/i.test(entry.html)) {
      fail('sitemap', path, 'the sitemap asks Google to index a page that tells it not to');
    }
  }

  for (const path of auditedPaths) {
    if (listed.has(path) || path.includes('?')) continue;
    const entry = seen.get(path);
    if (!entry || entry.status !== 200) continue;
    if (/<meta name="robots" content="[^"]*noindex/i.test(entry.html)) continue;
    warn('sitemap', path, 'an indexable page that the sitemap does not offer');
  }
}

/**
 * Two indexable pages wearing the same title, or the same description.
 *
 * This is how a site teaches Google that most of its pages are the same page.
 * It is also the first symptom of a template that forgot to interpolate
 * something — every department page titled "from Nepali sellers in Germany"
 * with the shelf missing, every shop item titled after its shop. Cheap to
 * check once every page has been fetched anyway, and it catches a class of
 * mistake nothing else here would notice.
 */
function checkDuplicates() {
  for (const field of ['title', 'description']) {
    const byValue = new Map();
    for (const entry of headSeen) {
      const value = entry[field];
      if (!value) continue;
      byValue.set(value, [...(byValue.get(value) ?? []), entry.path]);
    }
    for (const [value, paths] of byValue) {
      if (paths.length < 2) continue;
      fail(
        'duplicate',
        paths[0],
        `${paths.length} indexable pages share this ${field} ("${value.slice(0, 70)}…"): ${paths.slice(0, 4).join(', ')}`
      );
    }
  }
}

// -------------------------------------------------------------------- run

async function auditPage(path) {
  const entry = await get(path);
  if (entry.status === 0) {
    fail('links', path, `request failed: ${entry.error}`);
    return [];
  }
  if (entry.status !== 200) {
    fail('links', path, `HTTP ${entry.status}`);
    return [];
  }
  checkDisclosure(path, entry.html);
  checkExampleMarks(path, entry.html);
  checkRatings(path, entry.html);
  checkTogether(path, entry.html);
  checkUrls(path, entry.html);
  checkArtifacts(path, entry.html);
  checkAccessibility(path, entry.html);
  checkHead(path, entry.html);
  checkStructuredData(path, entry.html);
  checkShareCard(path, entry.html);
  checkLeaks(path, entry.html);
  checkLang(path, entry.html);
  checkWeight(path, entry);
  return links(entry.html);
}

async function main() {
  const queue = [...SEED_PATHS];
  const audited = new Set();
  const linkTargets = new Set();

  // Depth: the seeds, plus everything they link to that is a page of ours.
  // Two passes is enough to reach every shop and every item from /market
  // without turning into an unbounded crawl of a site that will one day hold
  // thousands of listings.
  for (let depth = 0; depth < 2; depth++) {
    const batch = queue.splice(0, queue.length);
    for (const path of batch) {
      if (audited.has(path) || offLimits(path) || notAPage(path)) continue;
      audited.add(path);
      const found = await auditPage(path);
      for (const href of found) {
        linkTargets.add(href);
        if (depth === 0 && !audited.has(href) && !offLimits(href) && !notAPage(href)) queue.push(href);
      }
    }
  }

  // Every link on every audited page resolves. Cheap because anything already
  // audited is cached, and the rest is one GET each.
  for (const href of linkTargets) {
    if (offLimits(href) || notAPage(href) || seen.has(href)) continue;
    const entry = await get(href);
    if (entry.status !== 200) fail('links', href, `linked from the bazaar, returns HTTP ${entry.status || entry.error}`);
  }

  // Every distinct picture the audited pages referenced — the honest sample
  // for the caching check, rather than a guess at what the site serves.
  const imageUrls = new Set();
  for (const [, entry] of seen) {
    if (!entry.html) continue;
    for (const m of entry.html.matchAll(/<img\b[^>]*\bsrc="(\/api\/media\/[^"]+)"/g)) {
      imageUrls.add(decode(m[1]));
    }
  }
  await checkCaching(imageUrls);
  await checkCss(seen.get('/market')?.html ?? '');
  await checkHostileUrls();
  await checkCsp(seen.get('/market')?.html ?? '');

  await checkSitemap(audited);
  checkDuplicates();

  const failures = findings.filter((f) => f.level === 'FAIL');
  const warnings = findings.filter((f) => f.level === 'WARN');

  if (asJson) {
    console.log(JSON.stringify({ base, pages: audited.size, links: linkTargets.size, findings }, null, 2));
  } else {
    const byCheck = new Map();
    for (const f of findings) byCheck.set(f.check, [...(byCheck.get(f.check) ?? []), f]);
    console.log(`\nAudited ${audited.size} pages and ${linkTargets.size} links on ${base}\n`);
    for (const [check, list] of [...byCheck].sort()) {
      console.log(`  ${check} — ${list.filter((f) => f.level === 'FAIL').length} failed, ${list.filter((f) => f.level === 'WARN').length} warned`);
      for (const f of list.slice(0, 8)) console.log(`    ${f.level === 'FAIL' ? '✗' : '·'} ${f.path}  ${f.detail}`);
      if (list.length > 8) console.log(`    … and ${list.length - 8} more`);
    }
    console.log(
      findings.length === 0
        ? '  Everything checked passed.\n'
        : `\n  ${failures.length} failed, ${warnings.length} warnings\n`
    );
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

/**
 * Only crawl when this file was RUN. Imported — by tests/audit.test.ts — it is
 * a library of checks instead.
 *
 * That test is not ceremony. Every one of the checks below reports by NOT
 * firing, and a check that has quietly stopped working looks exactly like a
 * site with nothing wrong: green, reassuring and worthless. The only way to
 * know the difference is to hand each one a page that breaks its rule and
 * insist it complains. So the functions are exported and the entry point is
 * guarded.
 */
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
  main().catch((e) => {
    console.error('The audit itself broke:', e);
    process.exit(2);
  });
}

/**
 * Run one check over a page of HTML and return what it said. Resets the
 * findings list first, so each call is independent of the last.
 */
export function runCheck(check, html, path = '/test') {
  findings.length = 0;
  check(path, html);
  return findings.map((f) => ({ ...f }));
}

export {
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
};
