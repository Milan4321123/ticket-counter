// A grocery shop's week on MartNepali: customers order rice, spices and
// noodles online and pick them up at the counter — the order lands, a bank
// transfer is confirmed, the goods are handed over with a scan, the wish list
// shows what people want next, and insights show what sells.
import { dbGet, writeCameraFeed } from '../lib.mjs';

export const meta = {
  id: 'shop',
  intro: { kicker: 'For shops', title: 'Didi’s Kirana — order online, pick up at the counter', sub: 'Groceries, spices, crafts — all from one phone.' },
  outro: { title: 'Your shop.<br />Your customers.<br /><em>Your money.</em>' },
};

export const scenes = [
  {
    id: 'home',
    chapter: 'Open your shop',
    kicker: 'Monday morning',
    title: 'Your shop, open for orders',
    body: 'Everything for the week on one screen: orders to confirm, the counter scanner, insights — and what people are wishing for.',
    tool: 'overview',
  },
  {
    id: 'order',
    chapter: 'A customer orders',
    kicker: 'Your customer',
    title: 'Ordered from your shop page',
    body: 'Photos, prices and stock on your own page. They pick what they need and pay by card or PayPal, or by bank transfer to your account.',
    tool: 'buyer',
  },
  {
    id: 'paid',
    chapter: 'Paid · pickup code',
    kicker: 'Paid',
    title: 'A QR code to pick it up',
    body: 'The customer gets a pickup code by email, and a page that shows when the order is ready and where to collect it.',
    tool: 'buyer',
  },
  {
    id: 'orders',
    chapter: 'New order!',
    kicker: 'Neue Bestellung',
    title: 'The order lands in Orders',
    body: 'Who ordered, what, the total — and a Call button if something is out of stock.',
    tool: 'orders',
  },
  {
    id: 'transfer',
    chapter: 'Confirm a transfer',
    kicker: 'Paid by bank transfer?',
    title: 'Money in? One tap',
    body: 'Match the reference on your bank statement, tap “Payment received” — the pickup code goes out by itself.',
    tool: 'orders',
  },
  {
    id: 'collect',
    chapter: 'Hand it over',
    kicker: 'At the counter',
    title: 'Scan, hand it over',
    body: 'The customer shows the QR; you scan it with your phone (or type it). Each code works once — no mix-ups.',
    tool: 'checkin',
  },
  {
    id: 'wishes',
    chapter: 'What people want',
    kicker: 'The wish list',
    title: '14 people want the Dashain box',
    body: 'Show things before they are on sale — customers tap “Add to wish list”, and you see how many would buy it.',
    tool: 'overview',
  },
  {
    id: 'insights',
    chapter: 'Insights',
    kicker: 'Saturday evening',
    title: 'What sold this week',
    body: 'Best sellers, busy days and hours, and what you earned — so you know what to restock.',
    tool: 'insights',
  },
];

export async function run(h, L) {
  const shop = L.grocery;
  const P = `/portal/events/${shop.id}`;

  h.scene('home');
  await h.goto(P, { settle: 1400 });
  await h.dbg('home');
  await h.swipe(240, 900);
  await h.sleep(700);
  await h.swipe(-240, 700);

  h.scene('order');
  await h.goto(`/e/${shop.slug}`, { settle: 1000 });
  await h.dbg('shop');
  await h.swipe(430);
  await h.sleep(600);
  const buy = await h.find('#tickets .tier-card-buy, #tickets a[href*="/checkout"]');
  await h.tap(null, null, { el: buy, nav: true, after: 1200 });
  await h.dbg('checkout');
  // One more of it, and something else from the "add more" row.
  await h.tap('main button', '+', { after: 500 }).catch(() => {});
  await h.tap('main button', '+ Add', { after: 700 }).catch(() => {});
  await h.typeInto('#buyer-name', 'Ramesh Thapa');
  await h.typeInto('#buyer-email', 'ramesh.thapa@gmail.com');
  await h.typeInto('#buyer-phone', '+49 30 23125 612', { delay: 30 }).catch(() => {});
  await h.tap('label.checkbox-row', 'agree', { after: 400 }).catch(() => {});
  await h.dbg('checkout-filled');

  h.scene('paid');
  await h.tap('main button.btn-primary.btn-block', undefined, { nav: true, after: 1800 });
  await h.dbg('done');
  const orderId = h.page.url().match(/\/order\/([^/?#]+)/)?.[1];
  await h.swipe(420);
  await h.sleep(1000);

  h.scene('orders');
  await h.goto(`${P}/orders?show=paid`, { settle: 1200 });
  const card = await h.find('.oc', 'Ramesh Thapa').catch(() => null);
  if (card) {
    await h.reveal(card);
    const call = await card.$('.oc-call');
    if (call) {
      const { x, y } = await h.center(call);
      await h.page.evaluate((xx, yy) => window.__fmove(xx, yy), x, y);
    }
    await h.sleep(2200);
  }
  await h.dbg('orders');

  h.scene('transfer');
  await h.goto(`${P}/orders`, { settle: 1000 });
  const row = await h.find('.action-row').catch(() => null);
  if (row) {
    const last4 = await row.evaluate((r) => (r.innerText.match(/[A-Z]+-([A-Z0-9]+)/)?.[1] || '').slice(-4));
    await h.tap('.action-row button', 'Payment received', { after: 700 });
    await h.typeInto('.action-row input', last4, { delay: 120 });
    await h.tap('.action-row button', 'Yes', { after: 2000 }).catch(() => {});
  }
  await h.dbg('transfer');

  h.scene('collect');
  const code = dbGet(`SELECT code FROM tickets WHERE order_id = ? ORDER BY code LIMIT 1`, orderId)?.code ?? '';
  await h.goto(`${P}/checkin`, { settle: 1000 });
  // The camera sees the customer's phone with this order's QR code on it.
  await h.fastForward(() => writeCameraFeed(code, 'Basmati rice · Didi’s Kirana'));
  await h.scanWithCamera();
  await h.dbg('collected');

  h.scene('wishes');
  await h.goto(P, { settle: 1000 });
  const wish = await h.find('.wish-board').catch(() => null);
  if (wish) {
    await h.reveal(wish);
    await h.sleep(2600);
  }
  await h.dbg('wishes');

  h.scene('insights');
  await h.goto(`${P}/insights`, { settle: 1800 });
  await h.dbg('insights');
  await h.swipe(520);
  await h.sleep(900);
  await h.swipe(560);
  await h.sleep(1300);
}
