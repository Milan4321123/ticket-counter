/**
 * WHERE ANALYTICS IS ALLOWED TO LOOK.
 *
 * The private half of this site is not protected by a login. It is protected
 * by its URL being a secret: /order/<id>?token=<hmac> unlocks a buyer's own
 * order, /ticket/<code> IS the scannable QR payload, /c/<code> is a customer
 * card whose code is the entire security model. Google Analytics reports
 * `page_location` — the whole URL — so a tag on any of those pages would put a
 * working key to a stranger's order into a report nobody can un-send.
 *
 * The interesting failure is not "the check is wrong today". It is somebody
 * adding a private area next year and remembering two of the three places it
 * has to be listed. So the last test here READS next.config.mjs and
 * scripts/audit-bazaar.mjs and insists the three lists agree.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { ANALYTICS_PRIVATE_PREFIXES, analyticsCommands, isPrivatePath } from '../src/lib/analyticsScope.ts';

const REPO = path.resolve(import.meta.dirname, '..');

test('every page whose URL is itself a credential is excluded', () => {
  const secrets = [
    '/order/48c1c14d-f9e1-4e6f-8884-68de99a38542',
    '/ticket/ABCD-1234',
    '/c/9f2b8c1d4e6a7b3c5d8e9f0a1b2c3d4e',
    '/scan',
    '/scan/session',
  ];
  for (const pathname of secrets) {
    assert.equal(isPrivatePath(pathname), true, `${pathname} carries a credential and must never be tagged`);
  }
});

test('the back offices are excluded, landing page included', () => {
  for (const pathname of ['/admin', '/admin/reviews', '/portal', '/portal/events/x/edit']) {
    assert.equal(isPrivatePath(pathname), true, `${pathname} is nobody's analytics business`);
  }
});

test('the public bazaar is NOT excluded — this must not switch the whole site off', () => {
  // A guard that matches everything is a guard that quietly turns the feature
  // off, and nobody notices until they wonder why the reports are empty.
  const publicPages = [
    '/',
    '/market',
    '/market/items',
    '/market/c/jewellery',
    '/market/saved',
    '/e/sunita-s-home-kitchen',
    '/e/sunita-s-home-kitchen/item/chicken-momo',
    '/e/sunita-s-home-kitchen/checkout',
    '/organizers',
    '/festivals',
    '/patro',
    '/digest',
    '/privacy',
    '/contact',
    '/teej',
  ];
  for (const pathname of publicPages) {
    assert.equal(isPrivatePath(pathname), false, `${pathname} is public and should be counted`);
  }
});

test('a public path that merely starts with a private word is still public', () => {
  // '/contact' begins with '/c' — the customer-card prefix is '/c/' with the
  // slash for exactly this reason, and it is the kind of detail a rewrite
  // loses.
  assert.equal(isPrivatePath('/contact'), false);
  assert.equal(isPrivatePath('/checkout'), false);
  assert.equal(isPrivatePath('/c/abc'), true, '…but a real card still is private');
});

test('the admin gate’s rewrite target is excluded too', () => {
  // middleware.ts answers /admin by REWRITING to /gate-hidden-404 with a 404
  // status. A rewrite keeps the browser URL and renders the other route, so
  // the path seen while rendering on the server is the target — which looked
  // public, and put Google's script into the HTML of an admin page. This is
  // the kind of thing only a real build shows you.
  assert.equal(isPrivatePath('/gate-hidden-404'), true);

  const middleware = fs.readFileSync(path.join(REPO, 'src', 'middleware.ts'), 'utf8');
  const targets = [...middleware.matchAll(/rewrite\(new URL\('(\/[^']+)'/g)].map((m) => m[1]);
  assert.ok(targets.length > 0, 'fixture check: middleware rewrites somewhere');
  for (const target of targets) {
    assert.equal(
      isPrivatePath(target),
      true,
      `middleware rewrites to ${target}; analytics would tag it as if it were a public page`
    );
  }
});

test('the three lists of private areas agree with each other', () => {
  // next.config.mjs marks these `no-store` so no proxy caches them.
  // scripts/audit-bazaar.mjs refuses to crawl them.
  // lib/analyticsScope refuses to tag them.
  // Three files, one fact. This is the test that catches the fourth private
  // area somebody adds to two of them.
  const config = fs.readFileSync(path.join(REPO, 'next.config.mjs'), 'utf8');
  const audit = fs.readFileSync(path.join(REPO, 'scripts', 'audit-bazaar.mjs'), 'utf8');

  // Every route next.config gives `no-store`, other than the API (which is not
  // a page and cannot be tagged anyway).
  const noStore = [...config.matchAll(/source:\s*'(\/[^']*)'[^}]*?Cache-Control'[^}]*?no-store/gs)]
    .map((m) => m[1])
    .filter((source) => !source.startsWith('/api'));
  assert.ok(noStore.length >= 4, `fixture check: expected several no-store routes, found ${noStore.length}`);

  for (const source of noStore) {
    // '/order/:path*' -> '/order/x'
    const sample = source.replace('/:path*', '/x');
    assert.equal(
      isPrivatePath(sample),
      true,
      `next.config.mjs treats ${source} as private and analytics does not — add it to ANALYTICS_PRIVATE_PREFIXES`
    );
  }

  // And the auditor's own list, which is written as regexes.
  const offLimits = [...audit.matchAll(/\/\^\\\/([a-z]+)\\b?/g)].map((m) => m[1]);
  for (const area of new Set(offLimits)) {
    if (['api', 'unsubscribe'].includes(area)) continue; // not pages a visitor lands on
    assert.ok(
      ANALYTICS_PRIVATE_PREFIXES.some((p) => p.startsWith(`/${area}`)),
      `the audit refuses to crawl /${area} but analytics would tag it`
    );
  }
});

// ---------------------------------------------------------------------------
// WHAT IS SENT, AND IN WHAT ORDER
// ---------------------------------------------------------------------------
//
// This is the bug that reached production and sat there reporting nothing.
// gtag reads dataLayer in sequence and DROPS an event that arrives before a
// `config` for its measurement ID. The page view was being pushed from a
// useEffect while the config was injected by next/script's deferred
// afterInteractive — so the view lost the race, was thrown away, and with
// send_page_view switched off there was nothing else to send. The property
// received nothing at all and looked exactly like an uninstalled tag.
//
// The order is now a pure function, and these are the assertions that would
// have caught it.

const BASE = { measurementId: 'G-TEST123', origin: 'https://martnepali.test' };

test('the FIRST render configures, and lets config send the opening page view', () => {
  const commands = analyticsCommands({ ...BASE, pathname: '/market', configured: false });

  assert.equal(commands.length, 2, 'js, then config — nothing else');
  assert.equal(commands[0][0], 'js');
  assert.equal(commands[1][0], 'config', 'config must come before anything that could be an event');
  assert.equal(commands[1][1], 'G-TEST123');

  const options = commands[1][2] as Record<string, unknown>;
  assert.equal(
    options.send_page_view,
    true,
    'the opening view is config’s job — sending it by hand is what raced and lost'
  );
});

test('no page_view is ever emitted before a config', () => {
  // The rule in one line. If a future change reintroduces a hand-sent first
  // view, this is the assertion that fails.
  const first = analyticsCommands({ ...BASE, pathname: '/market', configured: false });
  assert.ok(
    !first.some(([name, , ]) => name === 'event'),
    `an event was queued before config: ${JSON.stringify(first)}`
  );
});

test('LATER renders send the view themselves, because the site does not reload', () => {
  const commands = analyticsCommands({ ...BASE, pathname: '/market/items', configured: true });
  assert.deepEqual(commands.map((c) => c[0]), ['event']);
  assert.equal(commands[0][1], 'page_view');
  const params = commands[0][2] as Record<string, unknown>;
  assert.equal(params.page_path, '/market/items');
});

test('nothing at all without a measurement ID', () => {
  assert.deepEqual(analyticsCommands({ ...BASE, measurementId: '', pathname: '/', configured: false }), []);
});

test('a query string can never reach a report, on either path', () => {
  // page_location is built from the pathname, never from location.href, so a
  // ?ref= share code or a ?token= pasted into the wrong place cannot ride
  // along even on a page analytics is allowed to run on.
  for (const configured of [false, true]) {
    const commands = analyticsCommands({ ...BASE, pathname: '/e/shop/item/momo', configured });
    const params = commands[commands.length - 1][commands.length === 2 ? 2 : 2] as Record<string, unknown>;
    const location = String(params.page_location);
    assert.ok(!location.includes('?'), `page_location carried a query string: ${location}`);
    assert.equal(location, 'https://martnepali.test/e/shop/item/momo');
  }
});
