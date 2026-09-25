// An organizer's Dashain Night on MartNepali: tickets on sale, a guest picks
// seats on the seat map and pays, the booking lands, a bank transfer is
// confirmed, sales are followed day by day — then on the night, tickets are
// scanned at the door and the live screen counts everyone in.
import { dbGet } from '../lib.mjs';

export const meta = {
  id: 'event',
  intro: { kicker: 'For event organizers', title: 'Dashain Night — from first ticket to a full hall', sub: 'Seats, payments and the door — all from one phone.' },
  outro: { title: 'Your event.<br />Your guests.<br /><em>Your money.</em>' },
};

export const scenes = [
  {
    id: 'home',
    chapter: 'Tickets on sale',
    kicker: 'Two weeks before',
    title: 'Your event, ready to sell',
    body: 'Your event’s tool home: orders, insights, the door check-in and the live screen — each one tap away.',
    tool: 'overview',
  },
  {
    id: 'order',
    chapter: 'A guest picks seats',
    kicker: 'Your guest',
    title: 'They pick their own seats',
    body: 'Right on your seat map — VIP rows, standard, tables. Then they pay by card or PayPal, or by bank transfer straight to your account.',
    tool: 'buyer',
  },
  {
    id: 'paid',
    chapter: 'QR tickets',
    kicker: 'Booked',
    title: 'One QR ticket per seat',
    body: 'Every seat gets its own QR ticket by email, with the seat on it — and a button to put the night in their calendar.',
    tool: 'buyer',
  },
  {
    id: 'orders',
    chapter: 'New booking',
    kicker: 'Neue Buchung',
    title: 'The booking lands in Orders',
    body: 'Who booked, which tickets and seats, how much — and a Call button if anything changes.',
    tool: 'orders',
  },
  {
    id: 'transfer',
    chapter: 'Confirm a transfer',
    kicker: 'Paid by bank transfer?',
    title: 'Money in? One tap',
    body: 'Check the reference on your bank statement and tap “Payment received” — the guest’s QR tickets go out automatically.',
    tool: 'orders',
  },
  {
    id: 'insights',
    chapter: 'Sales day by day',
    kicker: 'Every morning',
    title: 'How the night is selling',
    body: 'Tickets sold per day and per type, money in and on its way, who brought friends — at a glance.',
    tool: 'insights',
  },
  {
    id: 'door',
    chapter: 'Scan at the door',
    kicker: 'Event night',
    title: 'Scan tickets at the door',
    body: 'Door staff scan each QR with their phone. Every ticket works once — a copy shows “Already used”.',
    tool: 'checkin',
  },
  {
    id: 'live',
    chapter: 'Live screen',
    kicker: 'Doors open',
    title: 'Who is in, live',
    body: 'Arrivals as they happen — on a tablet at the entrance or the big screen backstage.',
    tool: 'live',
  },
];

export async function run(h, L) {
  const ev = L.event;
  const P = `/portal/events/${ev.id}`;

  // ---- 1. The organizer's tool home ----
  h.scene('home');
  await h.goto(P, { settle: 1400 });
  await h.dbg('home');
  await h.swipe(260, 900);
  await h.sleep(800);
  await h.swipe(-260, 700);

  // ---- 2. A guest picks seats and pays ----
  h.scene('order');
  await h.goto(`/e/${ev.slug}`, { settle: 1000 });
  await h.dbg('event');
  await h.swipe(420);
  await h.sleep(500);
  await h.goto(`/e/${ev.slug}/checkout`, { settle: 1200 });
  await h.dbg('checkout');
  // Two free seats side by side, in the middle of the hall.
  const pair = await h.page.evaluateHandle(() => {
    const rows = [...document.querySelectorAll('.seatmap-row')];
    const mid = rows.slice(Math.floor(rows.length / 3)).concat(rows);
    for (const row of mid) {
      const seats = [...row.querySelectorAll('button.seat')];
      for (let i = Math.floor(seats.length / 3); i < seats.length - 1; i++) {
        if (seats[i].classList.contains('seat-free') && seats[i + 1].classList.contains('seat-free')) return [seats[i], seats[i + 1]];
      }
    }
    return [];
  });
  const seatEls = await pair.getProperties();
  for (const [, handle] of seatEls) {
    const el = handle.asElement();
    if (el) await h.tap(null, null, { el, after: 600 });
  }
  await h.dbg('seats');
  await h.typeInto('#buyer-name', 'Pooja Rai');
  await h.typeInto('#buyer-email', 'pooja.rai@gmail.com');
  await h.typeInto('#buyer-phone', '+49 30 23125 734', { delay: 30 }).catch(() => {});
  await h.tap('label.checkbox-row', 'agree', { after: 400 }).catch(() => {});
  await h.dbg('checkout-filled');

  // ---- 3. Paid → QR tickets ----
  h.scene('paid');
  await h.tap('main button.btn-primary.btn-block', undefined, { nav: true, after: 1800 });
  await h.dbg('done');
  const orderId = h.page.url().match(/\/order\/([^/?#]+)/)?.[1];
  await h.swipe(460);
  await h.sleep(900);
  await h.swipe(420);
  await h.sleep(900);

  // ---- 4. The organizer: a new booking ----
  h.scene('orders');
  await h.goto(`${P}/orders?show=paid`, { settle: 1200 });
  const card = await h.find('.oc', 'Pooja Rai').catch(() => null);
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

  // ---- 5. Confirm a bank transfer ----
  h.scene('transfer');
  await h.goto(`${P}/orders`, { settle: 1000 });
  const row = await h.find('.action-row').catch(() => null);
  if (row) {
    const last4 = await row.evaluate((r) => (r.innerText.match(/[A-Z]+-(?:S-)?([A-Z0-9]+)/)?.[1] || '').slice(-4));
    await h.tap('.action-row button', 'Payment received', { after: 700 });
    await h.typeInto('.action-row input', last4, { delay: 120 });
    await h.tap('.action-row button', 'Yes', { after: 2000 }).catch(() => {});
  }
  await h.dbg('transfer');

  // ---- 6. Insights ----
  h.scene('insights');
  await h.goto(`${P}/insights`, { settle: 1800 });
  await h.dbg('insights');
  await h.swipe(520);
  await h.sleep(900);
  await h.swipe(560);
  await h.sleep(1200);

  // ---- 7. The door ----
  h.scene('door');
  const code = dbGet(`SELECT code FROM tickets WHERE order_id = ? ORDER BY code LIMIT 1`, orderId)?.code ?? '';
  await h.goto(`${P}/checkin`, { settle: 1000 });
  await h.typeInto('form input', code, { delay: 90 });
  await h.tap('form button[type=submit]', undefined, { after: 2200 });
  await h.dbg('door-ok');
  // The same ticket again: refused.
  await h.typeInto('form input', code, { delay: 60 });
  await h.tap('form button[type=submit]', undefined, { after: 2200 });
  await h.dbg('door-again');

  // ---- 8. Live screen, on the tablet at the entrance ----
  h.scene('live');
  await h.device('tablet');
  await h.goto(`${P}/live`, { settle: 3500 });
  await h.dbg('live');
  await h.sleep(1500);
  await h.device('phone');
}
