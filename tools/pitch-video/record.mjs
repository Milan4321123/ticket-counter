// A real, continuous screen recording of one seller's journey through the
// demo, phone-sized, with a finger drawn on the page that moves to every
// element before it is really tapped. Frames come from the browser's own
// screencast (rec/NNNNN.jpg + rec/frames.json with timestamps); events.json
// marks the captions and the stretches to fast-forward (waiting on the AI).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = new URL('./', import.meta.url).pathname;
const W = 390, H = 844;
const DEBUG = process.env.DEBUG === '1';

fs.rmSync(DIR + 'rec', { recursive: true, force: true });
fs.mkdirSync(DIR + 'rec');
fs.mkdirSync(DIR + 'dbg', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: 'new',
  args: ['--no-first-run', '--hide-scrollbars', '--lang=en', '--disable-features=Translate'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.setCookie({ name: 'lang', value: 'en', url: BASE });
page.on('dialog', (d) => void d.accept());
// Links that open a new tab open here instead — one continuous screen.
await page.evaluateOnNewDocument(() => {
  document.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a[target="_blank"]');
    if (a) a.removeAttribute('target');
  }, true);
});

// ---- What the film shows is the real site, not the test machine ----
await page.evaluateOnNewDocument(() => {
  const fix = (s) =>
    s.replace(/https?:\/\/localhost:3000/g, 'https://martnepali.com')
      .replace(/localhost:3000/g, 'martnepali.com')
      .replace(/[\w.+-]+@demo\.invalid/g, 'anita@momocorner.de');
  const walk = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (/localhost:3000|@demo\.invalid/.test(n.nodeValue)) n.nodeValue = fix(n.nodeValue);
    }
  };
  const start = () => {
    walk(document.body);
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((x) => (x.nodeType === 3 ? (/localhost:3000|@demo\.invalid/.test(x.nodeValue) && (x.nodeValue = fix(x.nodeValue))) : x.nodeType === 1 && walk(x))))).observe(document.body, { childList: true, subtree: true, characterData: false });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
});

// ---- The finger, living inside every page ----
await page.evaluateOnNewDocument(() => {
  const CSS = `
    nextjs-portal, [data-nextjs-toast] { display: none !important; }
    .demo-banner, .preview-bar { display: none !important; }
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
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const ts = metadata.timestamp;
  if (t0 === null) t0 = ts;
  const name = String(frames.length).padStart(5, '0') + '.jpg';
  fs.writeFileSync(DIR + 'rec/' + name, Buffer.from(data, 'base64'));
  frames.push({ name, t: ts - t0 });
  try {
    await cdp.send('Page.screencastFrameAck', { sessionId });
  } catch {}
});
const now = () => (t0 === null ? 0 : Date.now() / 1000 - wallStart);
let wallStart = 0;
const events = [];
const mark = (type, extra = {}) => events.push({ type, t: now(), ...extra });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let step = 0;
async function dbg(label) {
  if (!DEBUG) return;
  await page.screenshot({ path: `${DIR}dbg/${String(++step).padStart(2, '0')}-${label}.png` });
}

/** Find an element by selector (+ optional text), scroll it into view smoothly. */
async function find(sel, text) {
  const handle = await page.waitForFunction(
    (s, tx) => {
      const els = [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null || e.getClientRects().length);
      const hits = tx ? els.filter((e) => e.innerText && e.innerText.replace(/\s+/g, ' ').includes(tx)) : els;
      // Prefer the copy actually on screen (endless carousels hold three).
      const onScreen = hits.find((e) => {
        const r = e.getBoundingClientRect();
        return r.left >= -2 && r.right <= innerWidth + 2 && !e.closest('[aria-hidden="true"]');
      });
      return onScreen || hits.find((e) => !e.closest('[aria-hidden="true"]')) || hits[0] || null;
    },
    { timeout: 60000 },
    sel,
    text ?? null
  );
  return handle.asElement();
}
async function reveal(el) {
  // Centre it — scrolling every box it sits in (the chat log scrolls inside
  // the page), smoothly, unless it is already comfortably on screen.
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
}
async function center(el) {
  return page.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, el);
}
/** Move the finger to it, press, really tap it. */
async function tap(sel, text, { hold = 350, after = 700, nav = false } = {}) {
  const el = await find(sel, text);
  await reveal(el);
  const { x, y } = await center(el);
  await page.evaluate((xx, yy) => window.__fmove(xx, yy), x, y);
  await sleep(650);
  mark('tap', { x, y, nav });
  await page.evaluate((xx, yy) => window.__fpress(xx, yy, true), x, y);
  await sleep(110);
  const navP = nav ? page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}) : null;
  await page.touchscreen.tap(x, y);
  await page.evaluate((xx, yy) => window.__fpress(xx, yy, false), x, y).catch(() => {});
  if (navP) await navP;
  await sleep(after);
  return el;
}
/** Type like a person: the finger taps the field, then letters appear. */
async function typeInto(sel, text, { delay = 38 } = {}) {
  const el = await tap(sel, undefined, { after: 250 });
  await el.evaluate((e) => (e.spellcheck = false));
  const c = await center(el);
  mark('type-start', c);
  await page.keyboard.type(text, { delay });
  mark('type-end', c);
  await sleep(400);
}
/** A smooth scroll by dy with the finger swiping. */
async function swipe(dy, ms = 1100) {
  mark('swipe-start');
  await page.evaluate(() => window.__fmove(280, 640, 300));
  await sleep(320);
  await page.evaluate((d) => window.__fmove(280, 640 - Math.min(260, Math.abs(d)) * Math.sign(d), 600), dy);
  await page.evaluate(async (d, dur) => {
    const t0 = performance.now();
    let done = 0;
    while (true) {
      const k = Math.min(1, (performance.now() - t0) / dur);
      const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const want = d * e;
      window.scrollBy(0, want - done);
      done = want;
      if (k >= 1) break;
      await new Promise((r) => requestAnimationFrame(r));
    }
  }, dy, ms);
  mark('swipe-end');
  await sleep(350);
}
async function goto(path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(600);
}

// ---- Warm every route first (dev compiles on first visit) ----
await goto('/organizers');
await page.evaluate(() => {
  const f = document.createElement('form');
  f.method = 'POST';
  f.action = '/api/demo/start';
  f.innerHTML = '<input name="to" value="portal">';
  document.body.append(f);
  f.submit();
});
await sleep(8000);
await goto('/portal');
const ids = await page.evaluate(() => {
  const out = {};
  for (const a of document.querySelectorAll('a[href^="/portal/events/"]')) {
    const m = a.getAttribute('href').match(/^\/portal\/events\/([^/?#]+)$/);
    if (!m) continue;
    const text = (a.closest('.dp-card, .hub-card, a')?.innerText || '').toLowerCase();
    if (text.includes('momo') && !out.shop) out.shop = m[1];
    else if ((text.includes('dashain') || text.includes('night')) && !out.event) out.event = m[1];
  }
  return out;
});
for (const p of [`/portal/events/${ids.shop}`, `/portal/events/${ids.shop}/kitchen`, `/portal/events/${ids.shop}/orders`, `/portal/events/${ids.shop}/edit`]) await goto(p);
const shopSlug = await page.evaluate(() => (document.querySelector('a[href^="/e/"]')?.getAttribute('href') || '').split('/')[2]);
if (shopSlug) {
  await goto(`/e/${shopSlug}`);
  await goto(`/e/${shopSlug}/checkout`);
}
await goto('/portal');
await page.evaluate(() => sessionStorage.removeItem('__fvis'));
await goto('/portal');
console.log('warm', ids, shopSlug);

// ================= RECORDING =================
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 });
await sleep(300);
wallStart = Date.now() / 1000;
t0 = null;

// 1. The seller's home → create a new shop with the AI helper
mark('cap', { k: 'Your seller hub', title: 'Start a new shop' });
await sleep(900);
await dbg('home');
const sec = await find('#new');
await reveal(sec);
await tap('#new .ks-mode', 'A shop', { after: 400 });
await typeInto('#new input.bf-big', "Didi's Momo Corner");
mark('cap', { k: 'Step 1', title: 'Let the AI help' });
await tap('#new button[type=submit]', 'AI helper', { nav: true, after: 1400 });
await dbg('editor-chat');

// 2. Tell the AI what you sell
mark('cap', { k: 'Step 1', title: 'Just say what you sell' });
await typeInto('textarea', 'Momo shop in Berlin — chicken momo 9€, veg momo 8€, jhol momo 10€, collect on Saturdays 4–7pm', { delay: 30 });
await tap('button', 'Send', { after: 300 });
mark('ff-start');
await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Fill it in/.test(b.innerText)), { timeout: 90000 });
mark('ff-end');
await sleep(600);
await dbg('proposal');
mark('cap', { k: 'Step 2', title: 'It fills in your page' });
await tap('button', 'Fill it in', { after: 400 });
// Wait until it is really saved (the page refreshes with the new name and address).
await page.waitForFunction(() => /Done ✓|filled in/i.test(document.body.innerText) && !/Filling/.test(document.body.innerText), { timeout: 60000 }).catch(() => {});
await sleep(2500);
await dbg('filled');

// 3. See the page
mark('cap', { k: 'Step 3', title: 'Preview your page' });
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await sleep(700);
await tap('a', 'Preview', { nav: true, after: 1200 });
await dbg('preview');
await swipe(520);
await swipe(560);
await sleep(500);

// 4. Back home → the restaurant → kitchen
mark('cap', { k: 'Run it', title: 'Your restaurant, live' });
await page.evaluate(() => window.scrollTo({ top: 0 }));
await sleep(300);
await tap('header a[href="/portal"], a[href="/portal"]', undefined, { nav: true, after: 900 }).catch(async () => {
  await goto('/portal');
});
await dbg('home2');
await tap('.dp-card', 'Restaurant', { nav: true, after: 1000 });
await dbg('board');
mark('cap', { k: 'Restaurants', title: 'Orders land in the kitchen' });
await tap('.hub-board-tool', 'Kitchen', { nav: true, after: 1400 });
await dbg('kitchen');
await tap('.kb-card-tap', undefined, { after: 1800 }).catch((e) => console.log('kitchen tap', e.message));
await dbg('kitchen-moved');
await page.goBack({ waitUntil: 'networkidle2' });
await sleep(700);

// 5. Orders → confirm a payment
mark('cap', { k: 'Get paid', title: 'Money straight to you' });
await tap('.hub-board-tool', 'Orders', { nav: true, after: 1200 });
await dbg('orders');
const refRow = await find('.action-row');
const last4 = await refRow.evaluate((row) => (row.innerText.match(/[A-Z]+-([A-Z0-9]+)/)?.[1] || '').slice(-4));
await tap('.action-row button', 'Payment received', { after: 700 });
await typeInto('.action-row input', last4, { delay: 120 });
await tap('.action-row button', 'Yes — money received', { after: 2200 }).catch(() => {});
await dbg('paid');

// 6. The buyer's side: the page → order → checkout → QR
mark('cap', { k: 'Your buyers', title: 'They order in seconds' });
await goto(`/e/${shopSlug}`);
await sleep(400);
await tap('#tickets a[href*="/checkout"]', undefined, { nav: true, after: 1200 });
await dbg('checkout');
mark('cap', { k: 'Checkout', title: 'Pay in a tap' });
await typeInto('#buyer-name', 'Sita Gurung');
await typeInto('#buyer-email', 'sita@example.com');
const consent = await page.$('input[type=checkbox]');
if (consent) {
  // The privacy tick — tap its label.
  await tap('label.checkbox-row', 'agree', { after: 400 }).catch(() => {});
}
// Each dish asks how you want it: the first choice of each.
for (const choice of ['Mild', 'Tomato-sesame']) {
  await tap('main button', choice, { after: 350 }).catch(() => {});
}
// A shop order needs a pickup time: the first free one.
await tap('button[class*="checkout_slot__"]:not([disabled])', undefined, { after: 500 }).catch(() => {});
await dbg('checkout-filled');
await tap('main button.btn-primary.btn-block', undefined, { nav: true, after: 3000 }).catch(() => {});
mark('cap', { k: 'Done', title: 'Their QR code, instantly' });
await dbg('done');
await sleep(1500);
await swipe(380);
await sleep(1200);
mark('end');

await cdp.send('Page.stopScreencast');
await sleep(300);
fs.writeFileSync(DIR + 'rec/frames.json', JSON.stringify(frames));
fs.writeFileSync(DIR + 'events.json', JSON.stringify(events, null, 1));
await browser.close();
console.log('recorded', frames.length, 'frames over', frames.at(-1)?.t.toFixed(1), 's; events', events.length);
