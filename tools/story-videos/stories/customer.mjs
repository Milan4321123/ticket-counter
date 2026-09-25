// The customer's side of MartNepali: find Nepali events and food, ask the
// homepage assistant in plain words, order momo ahead and pay the kitchen
// directly, watch the order get ready, book a concert, wish for something
// that is not on sale yet. Runs on the public site (no demo account); the
// seller's confirmations happen off camera through seller-side.ts.
import { dbGet, seller } from '../lib.mjs';

const SHOP = 'sunita-s-home-kitchen';
const ITEM = 'veg-momo-10-pcs';
const EVENT = 'jazz-night-berlin';
const WISH = '/e/newa-mithai-ghar/item/sel-roti-6';

export const meta = {
  id: 'customer',
  demo: false,
  warm: ['/api/wishes?eventId=x&tierKey=y', '/', '/market?q=momo&city=Berlin&max=10', `/e/${SHOP}`, `/e/${SHOP}/item/${ITEM}`, `/e/${SHOP}/checkout`, `/e/${EVENT}`, `/e/${EVENT}/checkout`, WISH],
  intro: { kicker: 'For you', title: 'Nepali events and food, near you', sub: 'Find it, ask for it, order it — in one app.' },
  outro: {
    title: 'Nepali events.<br />Nepali food.<br /><em>One app.</em>',
    chips: ['Pay the seller directly', 'QR tickets & pickup codes', 'English · Deutsch · नेपाली'],
    cta: '▶ Open martnepali.com',
    url: 'Free · no sign-up needed',
    vid: false,
  },
};

export const scenes = [
  {
    id: 'home',
    chapter: 'Discover',
    kicker: 'MartNepali',
    title: 'What’s on, near you',
    body: 'Concerts, Dashain and Tihar nights, and Nepali kitchens and shops — swipe through what is coming up.',
    tool: 'home',
  },
  {
    id: 'ask',
    chapter: 'Ask anything',
    kicker: 'The assistant',
    title: 'Just ask — in your words',
    body: '“Events in Berlin?”, “momo under 10 euro”, “only in Berlin” — in English, Deutsch, नेपाली or Roman Nepali. It remembers what you asked.',
    tool: 'ask',
  },
  {
    id: 'bazaar',
    chapter: 'The bazaar',
    kicker: 'Filtered for you',
    title: 'The bazaar opens with your filters',
    body: 'Food, sweets, groceries and crafts from Nepali shops — already narrowed to what you asked for.',
    tool: 'bazaar',
  },
  {
    id: 'order',
    chapter: 'Order ahead',
    kicker: 'Order',
    title: 'Order ahead, pay the kitchen',
    body: 'Pick what you want and pay the seller directly — by bank transfer with a QR for your banking app, or by card or PayPal where they offer it.',
    tool: 'order',
  },
  {
    id: 'ready',
    chapter: 'Watch it get ready',
    kicker: 'Your order',
    title: 'Watch it get ready',
    body: 'Paid → being prepared → ready. Your page updates by itself — then show the QR code at the counter.',
    tool: 'order',
  },
  {
    id: 'tickets',
    chapter: 'Tickets for a night out',
    kicker: 'Going out',
    title: 'Tickets in a minute',
    body: 'Choose your tickets, pay the organizer directly, and your QR tickets arrive — with a button to add the night to your calendar.',
    tool: 'tickets',
  },
  {
    id: 'wish',
    chapter: 'Wish list',
    kicker: 'Not on sale yet?',
    title: 'Wish for it',
    body: 'Tap “Add to wish list” — the seller sees how many people want it, and it stays in your saved list.',
    tool: 'wish',
  },
];

async function askChat(h, text) {
  await h.typeInto('.ab-input input', text, { delay: 42 });
  await h.tap('.ab-send', undefined, { after: 400 });
  await h.fastForward(() => h.page.waitForFunction(() => !document.querySelector('.ab-dots'), { timeout: 30000 }).catch(() => {}));
  await h.sleep(2200);
}

export async function run(h) {
  // ---- 1. Discover ----
  h.scene('home');
  await h.goto('/', { settle: 1600 });
  await h.dbg('home');
  await h.swipe(520, 1200);
  await h.sleep(900);
  await h.swipe(560, 1200);
  await h.sleep(900);
  await h.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await h.sleep(900);

  // ---- 2. The Ask chat ----
  h.scene('ask');
  await h.page.evaluate(() => sessionStorage.removeItem('ask:chat:v1'));
  await h.tap('.ab-pill', undefined, { after: 900 });
  await askChat(h, 'any events in Berlin?');
  await h.dbg('ask-events');
  await askChat(h, 'momo under 10 euro');
  await h.dbg('ask-momo');
  await askChat(h, 'only in Berlin');
  await h.dbg('ask-berlin');

  // ---- 3. The bazaar, filtered ----
  h.scene('bazaar');
  // The newest answer's button (the one with "in Berlin").
  const open = await h.page.evaluateHandle(() => [...document.querySelectorAll('.ab-link')].filter((a) => /Open the bazaar/.test(a.textContent)).at(-1));
  await h.tap(null, null, { el: open.asElement(), nav: true, after: 1400 });
  await h.dbg('bazaar');
  await h.swipe(360);
  await h.sleep(700);
  await h.tap(`a[href*="/e/${SHOP}/item/${ITEM}"]`, undefined, { nav: true, after: 1200 });
  await h.dbg('item');

  // ---- 4. Order ahead ----
  h.scene('order');
  await h.tap('a.btn-primary', 'Order', { nav: true, after: 1200 });
  await h.dbg('checkout');
  await h.typeInto('#buyer-name', 'Sita Gurung');
  await h.typeInto('#buyer-email', 'sita@example.com');
  await h.typeInto('#buyer-phone', '+49 30 23125 481', { delay: 30 }).catch(() => {});
  await h.tap('label.checkbox-row', 'agree', { after: 400 }).catch(() => {});
  await h.dbg('checkout-filled');
  await h.tap('main button.btn-primary.btn-block', undefined, { nav: true, ff: true, after: 1800 });
  await h.dbg('transfer');
  const orderId = h.page.url().match(/\/order\/([^/?#]+)/)?.[1];
  await h.swipe(380);
  await h.sleep(1400);

  // ---- 5. The kitchen confirms and cooks (off camera); the page follows ----
  h.scene('ready');
  seller('paid', orderId);
  seller('kitchen', orderId, 'cooking');
  await h.goto(`/order/${orderId}`, { settle: 2200 });
  await h.dbg('cooking');
  seller('kitchen', orderId, 'ready');
  await h.goto(`/order/${orderId}`, { settle: 1600 });
  await h.dbg('ready');
  await h.sleep(1400);
  // Down to their own pickup code — the QR they show at the counter.
  const code = await h.find('.ticket-card').catch(() => null);
  if (code) {
    await h.page.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' }), code);
    await h.sleep(2400);
  }

  // ---- 6. Tickets for a concert ----
  h.scene('tickets');
  await h.goto(`/e/${EVENT}`, { settle: 1000 });
  await h.dbg('event');
  await h.swipe(380);
  await h.sleep(500);
  await h.tap('a', 'Get tickets', { nav: true, after: 1200 }).catch(async () => h.goto(`/e/${EVENT}/checkout`));
  await h.dbg('ev-checkout');
  // Two standard tickets.
  await h.tap('main button[aria-label^="Add one"], main button', '+', { after: 400 }).catch(() => {});
  await h.tap('main button[aria-label^="Add one"], main button', '+', { after: 400 }).catch(() => {});
  await h.typeInto('#buyer-name', 'Sita Gurung');
  await h.typeInto('#buyer-email', 'sita@example.com');
  await h.tap('label.checkbox-row', 'agree', { after: 400 }).catch(() => {});
  await h.tap('main button.btn-primary.btn-block', undefined, { nav: true, ff: true, after: 1400 });
  const ticketOrder = h.page.url().match(/\/order\/([^/?#]+)/)?.[1];
  seller('paid', ticketOrder);
  await h.goto(`/order/${ticketOrder}`, { settle: 1600 });
  await h.dbg('tickets');
  await h.sleep(1000);
  // Their QR tickets, one per person.
  const cards = await h.page.$$('.ticket-card');
  for (const c of cards.slice(0, 2)) {
    await h.page.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' }), c);
    await h.sleep(1800);
  }

  // ---- 7. Wish list ----
  h.scene('wish');
  await h.goto(WISH, { settle: 1200 });
  await h.tap('.wish-btn', undefined, { after: 3200 });
  await h.dbg('wish');
  void dbGet;
}
