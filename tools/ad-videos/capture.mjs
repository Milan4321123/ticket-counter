// node capture.mjs → out/dashain/shots/*.png + shots.json
//
// Films the two real sites for the Dashain ad on a phone-sized browser:
// progressive-youth.de (the organizer's own site) and the event's checkout on
// martnepali.com. Nothing is ever submitted — the "Reserve" tap at the end is
// drawn, not pressed, so no reservation lands on the live event. Each page is
// shot without its sticky header (the header is shot on its own and laid over
// the top of the phone), so the stage can scroll the page under it.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../story-videos/package.json', import.meta.url));
const puppeteer = require('puppeteer-core');

const OUT = new URL('./out/dashain/', import.meta.url).pathname.replace(/%20/g, ' ');
const SHOTS = OUT + 'shots/';
const MEDIA = OUT + 'media/';
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(MEDIA, { recursive: true });

const NPJOE = 'https://www.progressive-youth.de';
const MART = 'https://www.martnepali.com';
const EVENT = '/e/dashainevent2026-with-sugam-pokhrel-bajagaja';
const W = 390, H = 844;

const browser = await puppeteer.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: 'new',
  args: ['--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setUserAgent(
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
);
await page.setViewport({ width: W, height: H, deviceScaleFactor: +(process.env.DPR || 2), isMobile: true, hasTouch: true });
// No banners: the visitor already said no to analytics, and the NPJOE site
// already knows the language. The WhatsApp / chat bubbles carry a person's
// photo and are hidden outright.
await page.evaluateOnNewDocument(() => {
  try {
    localStorage.setItem('martnepali.consent.v1', JSON.stringify({ choice: 'denied', at: Date.now() }));
    localStorage.setItem('npjoe.lang', 'en');
  } catch {}
  const css = `.skip-link, .contact-fab, .chat-fab, .event-cta-bar, [class*="cookie"], [class*="consent"] { display: none !important; }
    *, *::before, *::after { caret-color: transparent !important; }`;
  const add = () => {
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  };
  if (document.head) add();
  else document.addEventListener('DOMContentLoaded', add);
});

const shots = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Hides anything fixed/sticky that still carries the privacy text (banners we did not name). */
async function hideBanners() {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('div, section, aside, dialog')) {
      const cs = getComputedStyle(el);
      if ((cs.position === 'fixed' || cs.position === 'sticky') && /privacy on this site|may we count this visit/i.test(el.textContent) && el.textContent.length < 800)
        el.style.setProperty('display', 'none', 'important');
    }
  });
}

/** Scrolls the page to the bottom slowly (so count-ups and reveals play), then back to the top. */
async function wakeUp() {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 300) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await wait(160);
  }
  await wait(1800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(600);
}

/** The sticky header alone, then the whole page without it. Returns the header's height. */
async function shootPage(name, headerSel, cropTo) {
  const hdr = await page.$(headerSel);
  const hb = await hdr.boundingBox();
  await page.screenshot({ path: `${SHOTS}${name}-header.png`, clip: { x: 0, y: 0, width: W, height: hb.y + hb.height } });
  const topH = Math.round(hb.y + hb.height);
  await page.evaluate((sel) => {
    const h = document.querySelector(sel);
    // Keep its room so nothing moves up; only make it invisible.
    h.style.setProperty('visibility', 'hidden', 'important');
    const bar = document.querySelector('.topbar');
    if (bar) bar.style.setProperty('visibility', 'hidden', 'important');
  }, headerSel);
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  const height = Math.min(full, cropTo ?? full);
  await page.screenshot({ path: `${SHOTS}${name}.png`, clip: { x: 0, y: 0, width: W, height }, captureBeyondViewport: true });
  await page.evaluate((sel) => {
    document.querySelector(sel).style.removeProperty('visibility');
    const bar = document.querySelector('.topbar');
    if (bar) bar.style.removeProperty('visibility');
  }, headerSel);
  return { header: topH, height };
}

/** Where things are on the page (document coordinates, CSS px). */
async function rects(map) {
  return page.evaluate((m) => {
    const out = {};
    for (const [k, [sel, text]] of Object.entries(m)) {
      const els = [...document.querySelectorAll(sel)].filter((e) => !text || e.textContent.replace(/\s+/g, ' ').includes(text));
      const el = els.find((e) => e.getBoundingClientRect().width > 0);
      if (!el) { out[k] = null; continue; }
      const r = el.getBoundingClientRect();
      out[k] = { x: r.x, y: r.y + scrollY, w: r.width, h: r.height };
    }
    return out;
  }, map);
}

// ---------------- The organizer's site ----------------
await page.goto(NPJOE + '/', { waitUntil: 'networkidle0' });
await hideBanners();
await wakeUp();
await hideBanners();
const npLogo = await page.evaluate(() => document.querySelector('.brand-mark')?.outerHTML ?? '');
fs.writeFileSync(OUT + 'npjoe-logo.svg', npLogo.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
const npRects = await rects({
  firstAid: ['section', 'First Aid Campaign'],
  oneDay: ['section, article, div', 'Programme 01'],
  oneEuro: ['section, article, div', 'Programme 03'],
  fields: ['section', 'Twelve fields'],
  membership: ['section', 'A voice in the association'],
});
const npStats = await page.evaluate(() =>
  [...document.querySelectorAll('main *')]
    .filter((e) => /^(Students trained|Teachers as trainers|Partner schools|Schools by 2030)$/.test(e.textContent.trim()))
    .map((e) => e.parentElement.innerText.replace(/\s+/g, ' ').trim())
);
shots.npjoe = { ...(await shootPage('npjoe', 'header.site-header', 5200)), rects: npRects, stats: npStats };
console.log('npjoe', shots.npjoe);

// Their photos: last Dashain and this year's Naya Barsha, the first-aid stand.
const PHOTOS = [
  'naya-barsha-2026/live-concert.jpg',
  'naya-barsha-2026/members-at-concert.jpg',
  'naya-barsha-2026/band-with-team.jpg',
  'naya-barsha-2026/guests-at-table.jpg',
  'naya-barsha-2026/arriving-guests.jpg',
  'dashain-2024/stage-programme.jpg',
  'dashain-2024/community-meal.jpg',
  'dashain-2024/trophy-presentation.jpg',
  'dashain-2024/dashain-banner.jpg',
  'dashain-2024/sel-roti-moment.jpg',
  'erste-hilfe-nrna-cup/pitchside-treatment.jpg',
  'erste-hilfe-nrna-cup/team-and-stand.jpg',
  'erste-hilfe-nrna-cup/stand-wide.jpg',
  'erste-hilfe-nrna-cup/campaign-shirt.jpg',
];
for (const p of PHOTOS) {
  const res = await fetch(`${NPJOE}/assets/media/${p}`);
  if (!res.ok) { console.log('missing', p, res.status); continue; }
  fs.writeFileSync(MEDIA + p.replace('/', '__'), Buffer.from(await res.arrayBuffer()));
}

// ---------------- MartNepali: home → event → checkout ----------------
await page.goto(MART + '/', { waitUntil: 'load' });
await wait(1500);
await hideBanners();
const mnLogo = await page.evaluate(() => document.querySelector('.logo-mark')?.outerHTML ?? '');
fs.writeFileSync(OUT + 'martnepali-logo.svg', mnLogo.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
const homeRects = await rects({ card: [`a[href="${EVENT}"]`, ''] });
await page.screenshot({ path: `${SHOTS}home.png` });
shots.home = { rects: homeRects };

await page.goto(MART + EVENT, { waitUntil: 'load' });
await wait(1500);
await hideBanners();
// The event's poster, full size, for the motion graphics.
const posterSrc = await page.evaluate(() => {
  const imgs = [...document.images].filter((i) => i.naturalWidth > 600).sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight);
  return imgs[0]?.currentSrc ?? null;
});
if (posterSrc) fs.writeFileSync(MEDIA + 'poster.jpg', Buffer.from(await (await fetch(posterSrc)).arrayBuffer()));
const evRects = await rects({ getTickets: ['a', 'Get tickets'], title: ['h1', ''] });
shots.event = { ...(await shootPage('event', 'header', 2600)), rects: evRects, poster: posterSrc };
console.log('event', shots.event);

await page.goto(MART + EVENT + '/checkout', { waitUntil: 'load' });
await wait(1200);
await hideBanners();
shots.cityCheck = { rects: await rects({ yes: ['button', 'Heidelberg is right'] }) };
await page.screenshot({ path: `${SHOTS}city-check.png` });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Heidelberg is right/.test(b.textContent))?.click());
await wait(900);

// The ticket row: two Standard Phase 2 tickets, one "+" at a time.
const plusSel = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('li, div')].filter((e) => /Phase 2/.test(e.textContent) && e.querySelectorAll('button').length >= 2 && e.textContent.length < 200);
  const row = rows.sort((a, b) => a.textContent.length - b.textContent.length)[0];
  const plus = [...row.querySelectorAll('button')].find((b) => /\+/.test(b.textContent) || /increase|mehr|add/i.test(b.getAttribute('aria-label') ?? ''));
  plus.setAttribute('data-ad', 'plus');
  return '[data-ad=plus]';
});
const ck0 = await rects({ plus: [plusSel, ''], name: ['input[autocomplete="name"], input[name*="name" i]', ''], email: ['input[type="email"]', ''] });
const s0 = await shootPage('checkout-0', 'header', 2400);
await page.click(plusSel);
await wait(350);
const s1 = await shootPage('checkout-1', 'header', 2400);
await page.click(plusSel);
await wait(350);
const s2 = await shootPage('checkout-2', 'header', 2400);
// A made-up buyer, typed into the form (never sent).
const NAME = 'Sita Gurung', MAIL = 'sita.gurung@example.com';
for (const [sel, text] of [['input[autocomplete="name"], input[name*="name" i]', NAME], ['input[type="email"]', MAIL]]) {
  const el = await page.$(sel);
  if (el) { await el.click(); await el.type(text, { delay: 10 }); }
}
await page.evaluate(() => document.activeElement?.blur());
// Tick the organizer-consent box (drawn as part of filling in the form).
await page.evaluate(() => {
  const box = [...document.querySelectorAll('input[type=checkbox]')].find((c) => /passed to the organizer/i.test(c.closest('label')?.textContent ?? ''));
  box?.click();
});
await wait(500);
const ck3 = await rects({
  reserve: ['button', 'Reserve tickets'],
  total: ['*', 'Nothing selected yet'],
  details: ['h2, h3, legend', 'Your details'],
  payment: ['h2, h3, legend', 'Payment'],
});
const s3 = await shootPage('checkout-3', 'header', 4200);
// The family order for the shorts: two more "+" → 3 and 4 tickets (the
// form is already filled in, below the fold).
await page.click(plusSel);
await wait(350);
const q3 = await shootPage('checkout-q3', 'header', 4200);
await page.click(plusSel);
await wait(350);
const q4 = await shootPage('checkout-q4', 'header', 4200);
const q4r = await rects({ reserve: ['button', 'Reserve tickets'], plus: [plusSel, ''] });
shots.checkout = { s0, s1, s2, s3, q3, q4, rects: { ...ck0, ...ck3 }, q4rects: q4r, buyer: { NAME, MAIL } };
console.log('checkout', shots.checkout);

fs.writeFileSync(OUT + 'shots.json', JSON.stringify(shots, null, 2));
await browser.close();
console.log('done');
