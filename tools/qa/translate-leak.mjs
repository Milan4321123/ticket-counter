#!/usr/bin/env node
// Typed text never reaches the auto-translator (or any other host).
//
// The site translates its own words for Deutsch / नेपाली visitors through
// /api/translate (components/AutoTranslate → Gemini, plus a cache shared by
// every visitor). What a visitor TYPES in a studio demo — a child's name, an
// RSVP note, a link page, a team name, a shout-out — must never make that
// trip. Each demo marks its own root translate="no"; this check proves it.
//
// For every /work route, in DE and in NE: open the page with the `lang`
// cookie set, then a few rounds of "type a marker into every visible text
// field, click every button in the page" (downloads denied, print / share /
// window.open stubbed, wandering off the route is undone). Every request is
// watched:
//   - a request to /api/translate whose body holds the marker   → LEAK
//   - a request to another host whose URL or body holds it       → LEAK
//   - a same-origin request that holds it (e.g. "send my idea")  → noted
//   - a text field on the page outside any translate="no"         → LEAK
// /api/translate is answered locally with an empty map, so nothing reaches
// Gemini or the shared cache while this runs — on production too.
//
//   node tools/qa/translate-leak.mjs                       # http://localhost:3001
//   node tools/qa/translate-leak.mjs https://www.martnepali.com
//   node tools/qa/translate-leak.mjs http://localhost:3001 /work/card /work/abc
//
// Needs Microsoft Edge and tools/story-videos' puppeteer-core (npm i there).
// Exit code 1 on any leak.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../story-videos/package.json'));
const puppeteer = require('puppeteer-core');

const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const ROUTES = [
  '/work',
  '/work/wedding',
  '/work/artist',
  '/work/quiz',
  '/work/live',
  '/work/classes',
  '/work/samaj',
  '/work/restaurant',
  '/work/kite',
  '/work/card',
  '/work/booth',
  '/work/momo',
  '/work/cup',
  '/work/abc',
  '/work/radio',
  '/work/build',
];
const LANGS = ['de', 'ne'];
/** Letters only, so it reads like a name: the browser-side filter (lib/personalText) must not be what saves us. */
const MARK = 'Quokkavelt';
const ROUNDS = 3;
const MAX_CLICKS = 160;

const base = (process.argv[2] ?? 'http://localhost:3001').replace(/\/$/, '');
const only = process.argv.slice(3);
const routes = only.length ? only : ROUTES;
const origin = new URL(base).origin;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const letters = (n) => {
  let s = '';
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--mute-audio', '--deny-permission-prompts'] });
const leaks = [];
const notes = [];
const summary = [];

try {
  for (const lang of LANGS) {
    for (const route of routes) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.setCookie({ name: 'lang', value: lang, url: origin });
      try {
        const cdp = await page.createCDPSession();
        await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny' });
      } catch {
        /* older protocol: downloads land nowhere visible anyway */
      }
      await page.evaluateOnNewDocument((mark) => {
        window.print = () => {};
        window.open = () => null;
        window.alert = () => {};
        window.confirm = () => true;
        try {
          Object.defineProperty(navigator, 'share', { value: () => Promise.reject(new Error('no share')), configurable: true });
          Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
        } catch {}
        // The alphabet app keeps the child's name in localStorage; seed one so its greeting shows it.
        try {
          if (location.pathname === '/work/abc' && !localStorage.getItem('mn-demo:abc')) {
            localStorage.setItem('mn-demo:abc', JSON.stringify({ v: 1, name: mark + 'kid' }));
          }
        } catch {}
      }, MARK);

      let translateCalls = 0;
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const url = req.url();
        const body = req.postData() ?? '';
        const hit = url.includes(MARK) || body.includes(MARK) || decodeURIComponent(url).includes(MARK);
        let u;
        try {
          u = new URL(url);
        } catch {
          u = null;
        }
        if (u && u.origin === origin && u.pathname === '/api/translate') {
          translateCalls++;
          if (hit) leaks.push({ lang, route, kind: 'translate', url, body: body.slice(0, 400) });
          req.respond({ status: 200, contentType: 'application/json', body: '{"map":{}}' });
          return;
        }
        if (hit) {
          if (u && (u.protocol === 'data:' || u.protocol === 'blob:')) {
            // In-browser only (a canvas picture, a download blob).
          } else if (u && u.origin === origin) notes.push({ lang, route, url: url.slice(0, 200), method: req.method() });
          else leaks.push({ lang, route, kind: 'external', url: url.slice(0, 300), body: body.slice(0, 300) });
        }
        req.continue();
      });

      const target = base + route;
      await page.goto(target, { waitUntil: 'load', timeout: 60000 });
      await sleep(1200);

      let typed = 0;
      let clicks = 0;
      const clicked = new Set();
      let n = 0;

      const backHome = async () => {
        const now = new URL(page.url());
        if (now.pathname !== route) {
          await page.goto(target, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
          await sleep(800);
        }
      };

      const fill = async () => {
        const fields = await page.$$(
          'main input:not([type]), main input[type=text], main input[type=search], main input[type=email], main input[type=tel], main input[type=url], main textarea, body > div input[type=text], body > div textarea'
        );
        for (const f of fields) {
          const ok = await f
            .evaluate((el) => {
              if (el.closest('header.site-header, footer.site-footer, .buddy, [class*="buddy"]')) return false;
              if (el.disabled || el.readOnly) return false;
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
            })
            .catch(() => false);
          if (!ok) continue;
          const already = await f.evaluate((el, m) => el.value.includes(m), MARK).catch(() => true);
          if (already) continue;
          try {
            await f.evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await f.click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.keyboard.type(`${MARK} ${letters(n++)}`, { delay: 4 });
            typed++;
            await sleep(150);
          } catch {
            /* detached or covered: the next round tries again */
          }
        }
      };

      const clickAll = async () => {
        const buttons = await page.$$('main button, main [role=button], main [role=tab], body > div[role=dialog] button, body > div button');
        for (const b of buttons) {
          if (clicks >= MAX_CLICKS) return;
          const key = await b
            .evaluate((el) => {
              if (el.closest('header.site-header, footer.site-footer, .buddy, [class*="buddy"], nav.dnav')) return null;
              if (el.disabled || el.getAttribute('aria-disabled') === 'true') return null;
              const r = el.getBoundingClientRect();
              if (!(r.width > 0 && r.height > 0)) return null;
              const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40);
              const where = el.closest('[class]')?.className?.toString().split(' ')[0] ?? '';
              return `${where}|${label}`;
            })
            .catch(() => null);
          if (!key || clicked.has(key)) continue;
          clicked.add(key);
          try {
            await b.evaluate((el) => el.click());
            clicks++;
            await sleep(120);
            await page.keyboard.press('Escape').catch(() => {});
          } catch {
            /* gone after a re-render */
          }
          await backHome();
          await fill();
        }
      };

      for (let round = 0; round < ROUNDS; round++) {
        await fill();
        await clickAll();
        await backHome();
      }
      await fill();
      await sleep(1500);
      const shown = await page.evaluate((m) => document.body.innerText.includes(m), MARK).catch(() => false);
      // Belt and braces: every text field the crawl met sits inside translate="no",
      // so whatever echoes it nearby is kept home too.
      const open = await page
        .evaluate(() =>
          [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]), textarea')]
            .filter((el) => !el.closest('header.site-header, footer.site-footer, .buddy, [class*="buddy"]'))
            .filter((el) => !el.closest('[translate="no"], [data-private], .notranslate'))
            .map((el) => el.outerHTML.slice(0, 120))
        )
        .catch(() => []);
      for (const html of open) leaks.push({ lang, route, kind: 'unguarded field', url: route, body: html });
      summary.push({ lang, route, typed, clicks, translateCalls, markerOnScreen: shown });
      console.log(`${lang} ${route.padEnd(18)} typed ${String(typed).padStart(3)} · clicks ${String(clicks).padStart(3)} · translate calls ${String(translateCalls).padStart(3)} · marker on screen ${shown ? 'yes' : 'no'}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

if (notes.length) {
  console.log('\nSame-origin requests that carried typed text (deliberate sends, not translation):');
  for (const n of notes) console.log(`  ${n.lang} ${n.route}: ${n.method} ${n.url}`);
}
if (leaks.length) {
  console.log(`\nLEAKS (${leaks.length}):`);
  for (const l of leaks) console.log(`  ${l.lang} ${l.route} [${l.kind}] ${l.url}\n    ${l.body}`);
  process.exit(1);
}
console.log(`\nNo typed text reached /api/translate or another host (${summary.length} page runs).`);
