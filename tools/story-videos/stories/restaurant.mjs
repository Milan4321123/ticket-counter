// A restaurant's evening on MartNepali, start to finish: the owner opens the
// app, a customer orders and pays, the order lands, the kitchen cooks it, the
// customer sees it is ready, it is handed over at the counter — then the live
// screen and the insights. Every chapter is one tool button's own story.
import { dbGet } from '../lib.mjs';

export const meta = {
  id: 'restaurant',
  intro: { kicker: 'For restaurants', title: 'A Friday evening at Didi’s Momo Kitchen', sub: 'Orders, kitchen and pickup — all from one phone.' },
  outro: { title: 'Your kitchen.<br />Your orders.<br /><em>Your money.</em>' },
};

/** The chapters, in order. `tool` = which tool button's "See how" plays it. */
export const scenes = [
  {
    id: 'home',
    chapter: 'Open your restaurant',
    kicker: '18:00 · Opening',
    title: 'Your restaurant, ready for tonight',
    body: 'Open MartNepali on your phone. Orders, kitchen, collection, the live screen and insights are each one tap away.',
    tool: 'overview',
  },
  {
    id: 'order',
    chapter: 'A customer orders',
    kicker: 'Your customer',
    title: 'Ordered from your page in a minute',
    body: 'They pick the dish, the spice level and a pickup time — then pay instantly by card or PayPal, or by bank transfer straight to your account.',
    tool: 'buyer',
  },
  {
    id: 'paid',
    chapter: 'Paid · QR code',
    kicker: 'Paid',
    title: 'Their QR code arrives at once',
    body: 'The money goes to you, never through us. The customer gets a QR code by email and can follow the order live.',
    tool: 'buyer',
  },
  {
    id: 'orders',
    chapter: 'New order!',
    kicker: 'Neue Bestellung',
    title: 'The order lands in Orders',
    body: 'Who ordered, what, when they collect, their note — and a green Call button if something changes.',
    tool: 'orders',
  },
  {
    id: 'transfer',
    chapter: 'Confirm a transfer',
    kicker: 'Paid by bank transfer?',
    title: 'Money in your account? One tap',
    body: 'When a transfer arrives, tap “Payment received” and check the reference — the customer’s QR code goes out automatically.',
    tool: 'orders',
  },
  {
    id: 'kitchen',
    chapter: 'Kitchen: cook it',
    kicker: 'Kitchen screen',
    title: 'New → Cooking → Ready',
    body: 'Every order is a card with its own stopwatch. It turns amber, then red, when an order waits too long.',
    tool: 'kitchen',
  },
  {
    id: 'ready',
    chapter: 'Customer sees “ready”',
    kicker: 'On the customer’s phone',
    title: 'They know the moment it’s ready',
    body: 'Their order page moves by itself: paid → being prepared → ready to collect, with the time and where to pick it up.',
    tool: 'buyer',
  },
  {
    id: 'collect',
    chapter: 'Hand it over',
    kicker: 'At the counter',
    title: 'Scan the code, hand it over',
    body: 'Scan their QR code with the phone camera — or type it. Each code works once, and the order is marked collected.',
    tool: 'checkin',
  },
  {
    id: 'live',
    chapter: 'Live screen',
    kicker: 'All evening',
    title: 'The live screen',
    body: 'Arrivals and sales as they happen — on the counter tablet or a big screen in the kitchen.',
    tool: 'live',
  },
  {
    id: 'insights',
    chapter: 'Insights',
    kicker: 'After closing',
    title: 'What sold, and when',
    body: 'Best sellers, busy days and hours, and what you earned — so you know what to cook next Friday.',
    tool: 'insights',
  },
];

export async function run(h, L) {
  const shop = L.restaurant;
  const P = `/portal/events/${shop.id}`;

  // ---- 1. The owner opens the app ----
  h.scene('home');
  await h.goto(P, { settle: 1400 });
  await h.dbg('home');
  await h.swipe(260, 900);
  await h.sleep(900);
  await h.swipe(-260, 700);

  // ---- 2. A customer orders from the page ----
  h.scene('order');
  await h.goto(`/e/${shop.slug}`, { settle: 1000 });
  await h.dbg('shop');
  const buy = await h.find('#tickets .tier-card-buy, #tickets a[href*="/checkout"]');
  await h.tap(null, null, { el: buy, nav: true, after: 1200 });
  await h.dbg('checkout');
  // Each dish asks how you want it: pick one of each.
  for (const choice of ['Medium', 'Tomato-sesame']) await h.tap('main button', choice, { after: 350 }).catch(() => {});
  await h.tap('button[class*="checkout_slot__"]:not([disabled])', undefined, { after: 500 }).catch(() => {});
  await h.typeInto('#buyer-name', 'Sita Gurung');
  await h.typeInto('#buyer-email', 'sita.gurung@gmail.com');
  await h.typeInto('#buyer-phone', '+49 30 23125 481', { delay: 30 }).catch(() => {});
  await h.tap('label.checkbox-row', 'agree', { after: 400 }).catch(() => {});
  await h.dbg('checkout-filled');

  // ---- 3. Paid → QR ----
  h.scene('paid');
  await h.tap('main button.btn-primary.btn-block', undefined, { nav: true, after: 1800 });
  await h.dbg('done');
  const orderId = h.page.url().match(/\/order\/([^/?#]+)/)?.[1];
  await h.swipe(420);
  await h.sleep(1200);

  // ---- 4. The owner: a new order ----
  h.scene('orders');
  await h.goto(`${P}/orders?show=paid`, { settle: 1200 });
  await h.dbg('orders');
  const card = await h.find('.oc', 'Sita Gurung').catch(() => null);
  if (card) {
    await h.reveal(card);
    const call = await card.$('.oc-call');
    if (call) {
      const { x, y } = await h.center(call);
      await h.page.evaluate((xx, yy) => window.__fmove(xx, yy), x, y);
    }
    await h.sleep(2200);
  }

  // ---- 5. A bank transfer to confirm ----
  h.scene('transfer');
  await h.goto(`${P}/orders`, { settle: 1000 });
  const row = await h.find('.action-row').catch(() => null);
  if (row) {
    const last4 = await row.evaluate((r) => (r.innerText.match(/[A-Z]+-([A-Z0-9]+)/)?.[1] || '').slice(-4));
    await h.tap('.action-row button', 'Payment received', { after: 700 });
    await h.typeInto('.action-row input', last4, { delay: 120 });
    await h.tap('.action-row button', 'Yes', { after: 2000 }).catch(() => {});
    await h.dbg('transfer');
  }

  // ---- 6. Kitchen ----
  h.scene('kitchen');
  // The kitchen board lives on the counter tablet.
  await h.device('tablet');
  await h.goto(`${P}/kitchen`, { settle: 1200 });
  await h.page.waitForSelector('.kb-card', { timeout: 30000 }).catch(() => {});
  await h.sleep(1500);
  await h.dbg('kitchen');
  const go = async () => {
    const card = await h.find('.kb-card', 'Sita Gurung');
    return card.$('.kb-go');
  };
  await h.tap(null, null, { el: await go(), after: 2600 }); // → Cooking
  await h.dbg('cooking');
  await h.tap(null, null, { el: await go(), after: 2600 }); // → Ready
  await h.dbg('ready');
  await h.device('phone');

  // ---- 7. The customer sees it ----
  h.scene('ready');
  await h.goto(`/order/${orderId}`, { settle: 1400 });
  await h.dbg('tracker');
  await h.sleep(1500);
  await h.swipe(380);
  await h.sleep(1200);

  // ---- 8. The counter ----
  h.scene('collect');
  const code = dbGet(`SELECT code FROM tickets WHERE order_id = ? ORDER BY code LIMIT 1`, orderId)?.code ?? '';
  await h.goto(`${P}/checkin`, { settle: 1000 });
  await h.typeInto('form input', code, { delay: 90 });
  await h.tap('form button[type=submit]', undefined, { after: 2400 });
  await h.dbg('collected');

  // ---- 9. Live screen ----
  h.scene('live');
  await h.device('tablet');
  await h.goto(`${P}/live`, { settle: 3500 });
  await h.dbg('live');
  await h.sleep(1500);
  await h.device('phone');

  // ---- 10. Insights ----
  h.scene('insights');
  await h.goto(`${P}/insights`, { settle: 1800 });
  await h.dbg('insights');
  await h.swipe(520);
  await h.sleep(900);
  await h.swipe(560);
  await h.sleep(1400);
}
