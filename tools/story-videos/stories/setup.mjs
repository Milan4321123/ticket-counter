// Making a page, and nothing else: from "Sell with us" on the homepage to a
// finished event page and its tools — the AI assistant doing the typing.
// (Running the business is the restaurant / shop / event stories.)
import { fileURLToPath } from 'node:url';

const POSTER = fileURLToPath(new URL('../assets/dashain-poster.jpg', import.meta.url));

export const meta = {
  id: 'setup',
  demo: false,
  warm: ['/organizers'],
  slowScroll: ['preview'],
  intro: { kicker: 'Create your page', title: 'Your page, step by step', sub: 'The AI fills it in — then make it yours: tickets, photos, updates, FAQ, colours.' },
  outro: { title: 'Say it once.<br />Make it yours.<br /><em>Share it.</em>' },
};

export const scenes = [
  { id: 'start', chapter: 'Create an event page', kicker: 'Sell with us', title: 'Tap “Create an event page”', body: 'On Sell with us, under the videos: one tap opens a blank page with the AI assistant ready — free, no sign-up to try it. (Shops and restaurants have their own button.)', tool: 'start' },
  { id: 'describe', chapter: 'Say it in one sentence', kicker: 'Step 1', title: 'Say it in one sentence', body: 'Name, date, place and ticket prices — type or speak it, in English, Deutsch or Nepali. Nepali in English letters works too.', tool: 'edit' },
  { id: 'fill', chapter: 'It fills in the form', kicker: 'Step 2', title: 'It fills in the form', body: 'Check what it understood and tap “Fill it in”. It saves your page and asks only for what is still missing — like the street address.', tool: 'edit' },
  { id: 'photo', chapter: 'Add your poster', kicker: 'Step 3', title: 'Add your poster and photos', body: 'Upload a poster or photos — the first becomes the cover. Short videos work too.', tool: 'edit' },
  { id: 'extras', chapter: 'What’s done, what’s optional', kicker: 'Step 4', title: 'What’s done — and what you can add', body: 'The assistant shows what your page has, and what would make it stronger. Every section is one tap away.', tool: 'edit' },
  { id: 'tickets', chapter: 'Ticket details', kicker: 'Tickets', title: 'The details of each ticket', body: 'Open a ticket to say what it includes, how many there are, student-only or a table for a group — or add one in a tap: VIP, early bird, student.', tool: 'edit' },
  { id: 'updates', chapter: 'Post an update', kicker: 'Updates', title: 'Post an update', body: 'News for everyone on your page and everyone who bought — “Doors open at 18:00”, a special guest, “only a few tickets left”.', tool: 'edit' },
  { id: 'faq', chapter: 'The AI writes your FAQ', kicker: 'FAQ', title: 'Tell it a few facts — it writes the FAQ', body: 'Parking, dinner, children, doors: note them once. “Suggest FAQ answers” turns them into questions and answers — check them, add them. Your page’s own assistant answers from them too.', tool: 'edit' },
  { id: 'design', chapter: 'Colours & style', kicker: 'Design', title: 'Your colours, your style', body: 'Pick a colour and a style — bold, elegant, party — or describe the vibe and let the AI designer do it.', tool: 'edit' },
  { id: 'preview', chapter: 'Your whole page', kicker: 'Ready', title: 'Your page, top to bottom', body: 'Poster, date and place, tickets, the update, about, FAQ — exactly as your guests will see it, in English, Deutsch and नेपाली. In your own account, “Publish” puts it live.', tool: 'edit' },
];

const lastBot = (h) => h.page.evaluate(() => [...document.querySelectorAll('.sa-msg.sa-bot')].at(-1)?.innerText ?? '');

async function say(h, text) {
  await h.typeInto('.sa-panel textarea, textarea', text, { delay: 32 });
  await h.tap('button', 'Send', { after: 300 });
}

/** Open an editor section from the section list, like a seller would. */
async function openSection(h, name, tab) {
  // Let a save finish first (the section re-renders when it lands).
  await h.page.waitForFunction(() => !/Saving…|Posting…/.test(document.querySelector('main')?.innerText ?? ''), { timeout: 20000 }).catch(() => {});
  const back = await h.find('button', 'All sections', 5000).catch(() => null);
  if (back) await h.tap(null, null, { el: back, after: 700 });
  const card = await h.page.evaluateHandle(
    (n) => [...document.querySelectorAll('.ed-card')].find((c) => c.offsetParent && c.innerText.split('\n').some((l) => l.trim() === n)) ?? null,
    name
  );
  const el = card.asElement();
  if (el) await h.tap(null, null, { el, after: 1100 });
  // The editor's own "go to section" (what its buttons use) if the card was not there.
  else await h.page.evaluate((t) => window.dispatchEvent(new CustomEvent('nc:goto-tab', { detail: t })), tab);
  await h.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await h.sleep(800);
}

export async function run(h) {
  // ---- 1. Create an event page ----
  h.scene('start');
  await h.goto('/organizers', { settle: 1400 });
  await h.dbg('organizers');
  await h.tap('form[action="/api/demo/start"] button', 'Create an event page', { nav: true, ff: true, after: 1500 });
  await h.page.waitForSelector('textarea', { timeout: 60000 });
  await h.sleep(1200);
  const eventId = h.page.url().match(/\/portal\/events\/([^/?#]+)/)?.[1];

  // ---- 2. One sentence ----
  h.scene('describe');
  await say(h, 'Dashain Night in Berlin on Saturday 17 October, doors 18:00, at Gemeinschaftssaal Kreuzberg — live music, dinner and dance. Standard ticket 25€, student 15€, table of 8 for 180€');
  await h.fastForward(() => h.page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Fill it in/.test(b.innerText)), { timeout: 90000 }));
  await h.sleep(900);
  const proposal = await h.find('.sa-proposal').catch(() => null);
  if (proposal) {
    await h.page.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' }), proposal);
    await h.sleep(2600);
  }

  // ---- 3. Fill it in; answer what it still asks ----
  h.scene('fill');
  await h.tap('button', 'Fill it in', { after: 400 });
  await h.fastForward(() =>
    h.page.waitForFunction(() => /filled in|Done ✓/i.test([...document.querySelectorAll('.sa-msg.sa-bot')].map((m) => m.innerText).join(' ')), { timeout: 90000 }).catch(() => {})
  );
  await h.sleep(2200);
  for (let i = 0; i < 4; i++) {
    const q = await lastBot(h);
    if (/photo/i.test(q)) break;
    if (/address|street/i.test(q)) await say(h, 'Oranienstraße 25, 10999 Berlin');
    else if (/done|anything to change/i.test(q)) await say(h, 'done');
    else if (/how many|capacity|people/i.test(q)) await say(h, '300');
    else break;
    await h.fastForward(() => h.sleep(2600));
  }
  await h.dbg('filled');

  // ---- 4. The poster ----
  h.scene('photo');
  await h.tap('.sa-goto', 'photo', { after: 1200 }).catch(async () => h.tap('button', 'Add a photo', { after: 1200 }));
  const input = await h.page.waitForSelector('input[type=file][accept*="image"]', { timeout: 20000 });
  await input.uploadFile(POSTER);
  await h.fastForward(() => h.page.waitForFunction(() => document.querySelectorAll('img[src*="/api/media/"]').length > 0, { timeout: 30000 }).catch(() => {}));
  await h.sleep(1800);
  await h.dbg('uploaded');
  await h.tap('button', 'Return to the chat', { after: 2200 });

  // ---- 5. What is done, what could be added ----
  h.scene('extras');
  await h.page.waitForSelector('.sa-progress', { timeout: 30000 }).catch(() => {});
  const card = await h.find('.sa-progress').catch(() => null);
  if (card) {
    await h.page.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' }), card);
    await h.sleep(3000);
  }
  await h.dbg('extras');

  // ---- 6. Ticket details ----
  h.scene('tickets');
  await openSection(h, 'Tickets', 'tickets');
  await h.tap('main button', 'Standard', { after: 900 });
  await h.typeInto('main input[placeholder="What does this ticket include?"], main textarea[placeholder="What does this ticket include?"]', 'Dinner and live music included', { delay: 34 }).catch(() => {});
  await h.tap('main button', '+ VIP', { after: 900 }).catch(() => {});
  await h.tap('main button', 'Save ticket types', { after: 1200 }).catch(() => {});
  // Back to the list, with the new VIP ticket in it.
  await h.page.evaluate(() => {
    const vip = [...document.querySelectorAll('main button')].find((b) => b.offsetParent && /VIP/.test(b.innerText) && /€/.test(b.innerText));
    vip?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  await h.sleep(1600);
  await h.dbg('tickets');

  // ---- 7. An update ----
  h.scene('updates');
  await openSection(h, 'Updates', 'updates');
  await h.tap('main button', 'Doors open at', { after: 500 });
  await h.page.focus('#pc-post').catch(() => {});
  await h.page.keyboard.press('End').catch(() => {});
  await h.page.keyboard.type(' 18:00 — dinner from 19:00 🍛', { delay: 36 });
  await h.sleep(500);
  await h.tap('main button', 'Post', { after: 1800 });
  await h.dbg('updates');

  // ---- 8. FAQ, written by the AI from a few notes ----
  h.scene('faq');
  await openSection(h, 'FAQ', 'faq');
  await h.typeInto('#assistant-context', 'Free parking behind the hall. Dinner is included in the standard ticket. Children under 12 come free. Doors 18:00, music from 20:00.', { delay: 24 });
  await h.tap('main button', 'Save notes', { after: 900 });
  await h.tap('main button', 'Suggest FAQ answers', { after: 400 });
  await h.fastForward(() =>
    h.page.waitForFunction(() => [...document.querySelectorAll('main button')].some((b) => /Add \d+ questions? to my FAQ/.test(b.innerText)), { timeout: 90000 }).catch(() => {})
  );
  await h.sleep(700);
  const add = await h.find('main button', 'to my FAQ', 5000).catch(() => null);
  if (add) {
    // Show what it wrote, then add it.
    await h.page.evaluate((e) => e.parentElement?.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' }), add);
    await h.sleep(2600);
    await h.tap(null, null, { el: add, after: 1200 });
    await h.tap('main button', 'Save FAQ', { after: 1600 }).catch(() => {});
  }
  await h.dbg('faq');

  // ---- 9. Colours & style ----
  h.scene('design');
  await openSection(h, 'Design', 'design');
  await h.tap('main button', 'Sunset', { after: 700 });
  await h.tap('main button', 'Party', { after: 700 });
  await h.tap('main button', 'Save', { after: 1600 });
  await h.dbg('design');

  // ---- 10. The whole page ----
  h.scene('preview');
  await h.goto(`/portal/events/${eventId}/edit`, { settle: 800 });
  await h.tap('a', 'Preview', { nav: true, after: 1600 });
  await h.dbg('preview');
  await h.sleep(1200);
  // Top to bottom: poster, date & place, tickets, the update, about, FAQ.
  await h.scrollThrough(600);
  await h.dbg('page-bottom');
  await h.sleep(800);
}
