// The recorder's toolkit: a phone-sized browser on the real dev server, a
// finger drawn on every page that moves to each element before it is really
// tapped, the browser's own screencast as frames, and an event log (scenes,
// taps, typing, fast-forwards) that timeline.mjs turns into the edit.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../package.json', import.meta.url));
const Database = require('better-sqlite3');
const DB_PATH = fileURLToPath(new URL('../../data/tickets.db', import.meta.url));

/** The newest demo account's listings (the one this recorder just made), by what they are. */
export function demoListings() {
  const db = new Database(DB_PATH, { readonly: true });
  const org = db.prepare(`SELECT id FROM organizers WHERE is_demo = 1 ORDER BY created_at DESC LIMIT 1`).get();
  const rows = db.prepare(`SELECT id, slug, kind, name FROM events WHERE organizer_id = ? ORDER BY created_at`).all(org.id);
  db.close();
  return {
    organizerId: org.id,
    event: rows.find((r) => r.kind === 'event'),
    restaurant: rows.find((r) => r.kind === 'shop' && r.slug.endsWith('-momo-kitchen')),
    salon: rows.find((r) => r.kind === 'shop' && r.slug.endsWith('-glow-beauty')),
    grocery: rows.find((r) => r.kind === 'shop' && r.slug.endsWith('-kirana')),
  };
}

/** Read-only look into the database (a ticket code, an order id). */
export function dbGet(sql, ...args) {
  const db = new Database(DB_PATH, { readonly: true });
  const row = db.prepare(sql).get(...args);
  db.close();
  return row;
}

export const BASE = 'http://localhost:3000';
export const W = 390;
export const H = 844;

export async function openRecorder(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir + '/rec', { recursive: true });
  fs.mkdirSync(outDir + '/dbg', { recursive: true });
  const DEBUG = process.env.DEBUG === '1';

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    headless: 'new',
    args: ['--no-first-run', '--hide-scrollbars', '--lang=en', '--disable-features=Translate', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setCookie({ name: 'lang', value: 'en', url: BASE });
  page.on('dialog', (d) => void d.accept());

  // One continuous screen: links that open a tab open here.
  await page.evaluateOnNewDocument(() => {
    document.addEventListener(
      'click',
      (e) => {
        const a = e.target?.closest?.('a[target="_blank"]');
        if (a) a.removeAttribute('target');
      },
      true
    );
  });

  // What the film shows is the real site, not the test machine.
  await page.evaluateOnNewDocument(() => {
    const fix = (s) =>
      s
        .replace(/https?:\/\/localhost:3000/g, 'https://martnepali.com')
        .replace(/localhost:3000/g, 'martnepali.com')
        .replace(/[\w.+-]+@demo\.invalid/g, (m) => m.split('-')[0].split('@')[0] + '@gmail.com');
    const bad = /localhost:3000|@demo\.invalid/;
    const walk = (root) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (bad.test(n.nodeValue)) n.nodeValue = fix(n.nodeValue);
    };
    const start = () => {
      walk(document.body);
      new MutationObserver((ms) =>
        ms.forEach((m) => {
          if (m.type === 'characterData') {
            if (bad.test(m.target.nodeValue)) m.target.nodeValue = fix(m.target.nodeValue);
            return;
          }
          m.addedNodes.forEach((x) => (x.nodeType === 3 ? bad.test(x.nodeValue) && (x.nodeValue = fix(x.nodeValue)) : x.nodeType === 1 && walk(x)));
        })
      ).observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  });

  // The finger, living inside every page; dev overlays and demo banners hidden.
  await page.evaluateOnNewDocument(() => {
    const CSS = `
      nextjs-portal, [data-nextjs-toast] { display: none !important; }
      .demo-banner, .preview-bar, .dm-bar { display: none !important; }
      input, textarea { caret-color: transparent; }
      #__f { position: fixed; z-index: 2147483647; left: 0; top: 0; pointer-events: none; width: 0; height: 0;
        transition: transform .55s cubic-bezier(.45,.05,.25,1), opacity .25s; will-change: transform; }
      #__f .d { position: absolute; left: -21px; top: -21px; width: 42px; height: 42px; border-radius: 50%;
        background: rgba(255,255,255,.30); box-shadow: 0 0 0 2px rgba(255,255,255,.6); transition: transform .12s; }
      #__f .h { position: absolute; left: -16px; top: -5px; font-size: 50px; line-height: 1; transition: transform .12s;
        filter: drop-shadow(0 6px 10px rgba(0,0,0,.55)); }
      #__f.p .d { transform: scale(.8); } #__f.p .h { transform: scale(.9) translateY(3px); }
      .__r { position: fixed; z-index: 2147483646; pointer-events: none; border-radius: 50%;
        border: 3px solid rgba(255,255,255,.95); animation: __r .55s ease-out forwards; }
      @keyframes __r { from { width: 16px; height: 16px; margin: -8px 0 0 -8px; opacity: 1 } to { width: 90px; height: 90px; margin: -45px 0 0 -45px; opacity: 0 } }
    `;
    const init = () => {
      if (document.getElementById('__f')) return;
      const st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);
      const f = document.createElement('div');
      f.id = '__f';
      f.innerHTML = '<div class="d"></div><div class="h">👆</div>';
      const last = JSON.parse(sessionStorage.getItem('__fpos') || '[300,760]');
      f.style.transition = 'none';
      f.style.transform = `translate(${last[0]}px, ${last[1]}px)`;
      f.style.opacity = sessionStorage.getItem('__fvis') === '1' ? '1' : '0';
      document.documentElement.appendChild(f);
      requestAnimationFrame(() => (f.style.transition = ''));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.__fmove = (x, y, ms = 550) => {
      const f = document.getElementById('__f');
      if (!f) return;
      f.style.transitionDuration = `${ms}ms, 250ms`;
      f.style.opacity = '1';
      f.style.transform = `translate(${x}px, ${y}px)`;
      sessionStorage.setItem('__fpos', JSON.stringify([x, y]));
      sessionStorage.setItem('__fvis', '1');
    };
    window.__fhide = () => {
      const f = document.getElementById('__f');
      if (f) f.style.opacity = '0';
      sessionStorage.setItem('__fvis', '0');
    };
    window.__fpress = (x, y, on) => {
      const f = document.getElementById('__f');
      if (f) f.classList.toggle('p', on);
      if (on) {
        const r = document.createElement('div');
        r.className = '__r';
        r.style.left = x + 'px';
        r.style.top = y + 'px';
        document.documentElement.appendChild(r);
        setTimeout(() => r.remove(), 700);
      }
    };
  });

  // ---- Screencast ----
  const cdp = await page.createCDPSession();
  const frames = [];
  let t0 = null;
  let recording = false;
  let dev = 'phone';
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    if (recording) {
      const ts = metadata.timestamp;
      if (t0 === null) t0 = ts;
      const name = String(frames.length).padStart(5, '0') + '.jpg';
      fs.writeFileSync(`${outDir}/rec/${name}`, Buffer.from(data, 'base64'));
      frames.push({ name, t: ts - t0, dev });
    }
    try {
      await cdp.send('Page.screencastFrameAck', { sessionId });
    } catch {}
  });
  let wallStart = 0;
  const now = () => (recording ? Date.now() / 1000 - wallStart : 0);
  const events = [];
  const mark = (type, extra = {}) => events.push({ type, t: now(), ...extra });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let step = 0;

  const h = {
    page,
    sleep,
    mark,
    async dbg(label) {
      if (DEBUG) await page.screenshot({ path: `${outDir}/dbg/${String(++step).padStart(2, '0')}-${label}.png` });
    },
    /** A story chapter starts here (see stories/*.mjs `scenes`). */
    scene(id) {
      mark('scene', { id });
      console.log('scene', id, now().toFixed(1));
    },
    async find(sel, text, timeout = 45000) {
      const handle = await page.waitForFunction(
        (s, tx) => {
          const els = [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null || e.getClientRects().length);
          const hits = tx ? els.filter((e) => e.innerText && e.innerText.replace(/\s+/g, ' ').includes(tx)) : els;
          const onScreen = hits.find((e) => {
            const r = e.getBoundingClientRect();
            return r.left >= -2 && r.right <= innerWidth + 2 && !e.closest('[aria-hidden="true"]');
          });
          return onScreen || hits.find((e) => !e.closest('[aria-hidden="true"]')) || hits[0] || null;
        },
        { timeout },
        sel,
        text ?? null
      );
      return handle.asElement();
    },
    async reveal(el) {
      const visible = await page.evaluate((e) => {
        const r = e.getBoundingClientRect();
        let ok = r.top > 70 && r.bottom < innerHeight - 50 && r.left >= 0 && r.right <= innerWidth;
        for (let p = e.parentElement; p && ok; p = p.parentElement) {
          if (p.scrollHeight > p.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) {
            const pr = p.getBoundingClientRect();
            ok = r.top >= pr.top && r.bottom <= pr.bottom;
          }
        }
        return ok;
      }, el);
      if (visible) return;
      await page.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }), el);
      await sleep(900);
    },
    async center(el) {
      return page.evaluate((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, el);
    },
    /** Finger to it, press, really tap it. */
    async tap(sel, text, { hold = 110, after = 700, nav = false, el: given } = {}) {
      const el = given ?? (await h.find(sel, text));
      await h.reveal(el);
      const { x, y } = await h.center(el);
      await page.evaluate((xx, yy) => window.__fmove(xx, yy), x, y);
      await sleep(650);
      mark('tap', { x, y, nav });
      await page.evaluate((xx, yy) => window.__fpress(xx, yy, true), x, y);
      await sleep(hold);
      const navP = nav ? page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}) : null;
      await page.touchscreen.tap(x, y);
      await page.evaluate((xx, yy) => window.__fpress(xx, yy, false), x, y).catch(() => {});
      if (navP) await navP;
      await sleep(after);
      return el;
    },
    /** Type like a person: tap the field, then the letters appear. */
    async typeInto(sel, text, { delay = 38 } = {}) {
      const el = await h.tap(sel, undefined, { after: 250 });
      await el.evaluate((e) => (e.spellcheck = false));
      const c = await h.center(el);
      mark('type-start', c);
      await page.keyboard.type(text, { delay });
      mark('type-end', c);
      await sleep(400);
    },
    /** A smooth scroll by dy with the finger swiping. */
    async swipe(dy, ms = 1100) {
      mark('swipe-start');
      await page.evaluate(() => window.__fmove(280, 640, 300));
      await sleep(320);
      await page.evaluate((d) => window.__fmove(280, 640 - Math.min(260, Math.abs(d)) * Math.sign(d), 600), dy);
      await page.evaluate(
        async (d, dur) => {
          const t0 = performance.now();
          let done = 0;
          while (true) {
            const k = Math.min(1, (performance.now() - t0) / dur);
            const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            const want = d * e;
            window.scrollBy(0, want - done);
            done = want;
            if (k >= 1) break;
            await new Promise((r) => requestAnimationFrame(r));
          }
        },
        dy,
        ms
      );
      mark('swipe-end');
      await sleep(350);
    },
    /** A new screen: the video cuts here (no finger, the camera swings). */
    async goto(path, { settle = 700 } = {}) {
      mark('cut');
      await page.evaluate(() => window.__fhide?.()).catch(() => {});
      await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 90000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(250);
      mark('cut-end');
      await sleep(Math.max(0, settle - 250));
    },
    /**
     * Switch the screen: 'tablet' (the counter tablet: kitchen board, live
     * screen) or back to 'phone'. The stage turns the device round to match.
     */
    async device(kind) {
      const dims =
        kind === 'tablet'
          ? { width: 1180, height: 820, deviceScaleFactor: 1.5, isMobile: false, hasTouch: true }
          : { width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
      mark('cut');
      await page.evaluate(() => window.__fhide?.()).catch(() => {});
      await cdp.send('Page.stopScreencast').catch(() => {});
      await page.setViewport(dims);
      dev = kind;
      await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 88,
        maxWidth: Math.round(dims.width * dims.deviceScaleFactor),
        maxHeight: Math.round(dims.height * dims.deviceScaleFactor),
        everyNthFrame: 1,
      });
      mark('device', { kind, w: dims.width, h: dims.height });
      await sleep(300);
    },
    /** Waiting on the server or the AI: this stretch is fast-forwarded. */
    async fastForward(fn) {
      mark('ff-start');
      const out = await fn();
      mark('ff-end');
      return out;
    },
    async start() {
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 });
      await sleep(300);
      recording = true;
      wallStart = Date.now() / 1000;
      t0 = null;
    },
    async stop() {
      mark('end');
      await sleep(400);
      recording = false;
      await cdp.send('Page.stopScreencast');
      fs.writeFileSync(`${outDir}/rec/frames.json`, JSON.stringify(frames));
      fs.writeFileSync(`${outDir}/events.json`, JSON.stringify(events, null, 1));
      await browser.close();
      console.log('recorded', frames.length, 'frames over', frames.at(-1)?.t.toFixed(1), 's;', events.length, 'events');
    },
    /** Warm a route (dev compiles on first visit) without recording it. */
    async warm(path) {
      await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 120000 }).catch(() => {});
    },
    /** Start (or re-enter) this browser's demo account. */
    async enterDemo() {
      await page.goto(BASE + '/demo', { waitUntil: 'networkidle2', timeout: 120000 });
      await page.evaluate(() => {
        const f = document.createElement('form');
        f.method = 'POST';
        f.action = '/api/demo/start';
        f.innerHTML = '<input name="to" value="portal">';
        document.body.append(f);
        f.submit();
      });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }).catch(() => {});
      await sleep(1000);
      return demoListings();
    },
  };
  return h;
}
