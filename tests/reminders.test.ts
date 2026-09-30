// Buyer payment reminders (lib/reminders.ts): when the automatic one goes out,
// and the organizer's "Remind buyer" button (remindBuyerNow).
//
// The sweep is GLOBAL, so every test builds its own orders and asserts only on
// those — and on both sides of each clock: a reservation just past its timer
// is reminded, one just short of it is not. A sweep that reminded everybody
// would pass every "was reminded" assertion; only the "was not" half catches it.
process.env.PAYMENT_MODE = 'transfer';

import test from 'node:test';
import assert from 'node:assert/strict';

import nodemailer from 'nodemailer';
import { db, makeEventWithTier, makeOrder } from './helpers.ts';

/** Every message the code under test tried to send. */
const sent: { to?: string; subject?: string; html?: string; text?: string }[] = [];
/** When set, the next sends fail the way SendGrid does for an unverified From. */
let smtpError: string | null = null;

(nodemailer as unknown as { createTransport: unknown }).createTransport = () => ({
  sendMail: async (message: { to?: string; subject?: string; html?: string; text?: string }) => {
    if (smtpError) throw new Error(smtpError);
    sent.push(message);
    return { messageId: 'test' };
  },
});

process.env.SMTP_HOST = 'smtp.test';
process.env.EMAIL_FROM = 'MartNepali <hello@test.invalid>';
process.env.NEXT_PUBLIC_BASE_URL = 'https://martnepali.test';
process.env.APP_SECRET ??= 'reminders-test-secret-0123456789abcdef';

const { buyerReminderDelayHours, automaticReminderAt, remindBuyerNow, runTransferReminderSweep } = await import(
  '../src/lib/reminders.ts'
);
const { getOrder } = await import('../src/lib/orders.ts');

/** A transfer reservation, `hoursAgo` old, on an event with these settings. */
function reservation(opts: { payWithinDays?: number; eventDate?: string | null; hoursAgo: number }) {
  const { event, tier } = makeEventWithTier({ payWithinDays: opts.payWithinDays ?? 5, eventDate: opts.eventDate ?? null });
  const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  db().prepare(`UPDATE orders SET status = 'claimed', created_at = datetime('now', ?) WHERE id = ?`).run(
    `-${opts.hoursAgo} hours`,
    order.id
  );
  return getOrder(order.id)!;
}

const remindedTo = (email: string) => sent.some((m) => m.to === email && /^Reminder:/.test(m.subject ?? ''));
const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

test('the automatic reminder lands before the pay-within deadline, whatever the window', () => {
  assert.equal(buyerReminderDelayHours(1), 12);
  assert.equal(buyerReminderDelayHours(2), 24);
  assert.equal(buyerReminderDelayHours(3), 48);
  assert.equal(buyerReminderDelayHours(4), 72);
  assert.equal(buyerReminderDelayHours(5), 96);
  assert.equal(buyerReminderDelayHours(14), 96);
  for (let days = 1; days <= 30; days++) {
    assert.ok(buyerReminderDelayHours(days) < days * 24, `window of ${days} days`);
  }
});

test('the sweep reminds on each side of the timer correctly', async () => {
  const short = reservation({ payWithinDays: 2, hoursAgo: 25 }); // due at 24 h
  const shortEarly = reservation({ payWithinDays: 2, hoursAgo: 20 });
  const normal = reservation({ payWithinDays: 5, hoursAgo: 97 }); // due at 96 h
  const normalEarly = reservation({ payWithinDays: 5, hoursAgo: 72 });
  const soon = reservation({ payWithinDays: 5, eventDate: isoDay(1), hoursAgo: 7 }); // event tomorrow: 6 h
  const soonTooFresh = reservation({ payWithinDays: 5, eventDate: isoDay(1), hoursAgo: 2 });
  const over = reservation({ payWithinDays: 5, eventDate: isoDay(-3), hoursAgo: 100 });

  await runTransferReminderSweep(true);

  assert.ok(remindedTo(short.buyerEmail), 'two-day window, 25 h old');
  assert.ok(!remindedTo(shortEarly.buyerEmail), 'two-day window, 20 h old');
  assert.ok(remindedTo(normal.buyerEmail), 'five-day window, 97 h old');
  assert.ok(!remindedTo(normalEarly.buyerEmail), 'five-day window, 72 h old');
  assert.ok(remindedTo(soon.buyerEmail), 'event tomorrow, 7 h old');
  assert.ok(!remindedTo(soonTooFresh.buyerEmail), 'event tomorrow, 2 h old');
  assert.ok(!remindedTo(over.buyerEmail), 'event already over');

  // Once, ever: a second sweep sends nothing new to the same buyers.
  const before = sent.length;
  await runTransferReminderSweep(true);
  assert.ok(
    sent.slice(before).every((m) => ![short, normal, soon].some((o) => o.buyerEmail === m.to)),
    'reminded twice'
  );
});

test('automaticReminderAt agrees with the sweep', () => {
  const at = (createdAgoH: number, pw: number, date: string | null) =>
    automaticReminderAt(
      new Date(Date.now() - createdAgoH * 3_600_000).toISOString().slice(0, 19).replace('T', ' '),
      pw,
      date
    );
  const now = Date.now();
  const inHours = (ms: number | null) => (ms === null ? null : Math.round((ms - now) / 3_600_000));
  assert.equal(inHours(at(0, 5, null)), 96);
  assert.equal(inHours(at(0, 2, null)), 24);
  assert.equal(inHours(at(0, 5, isoDay(1))), 6, 'event tomorrow');
  assert.equal(at(0, 5, isoDay(-2)), null, 'event over');
});

test('Remind buyer sends now, stamps the order, and refuses a second press the same day', async () => {
  const order = reservation({ hoursAgo: 1 });

  const first = await remindBuyerNow(order.id);
  assert.equal(first.sent, true);
  assert.ok(remindedTo(order.buyerEmail));
  assert.ok(getOrder(order.id)!.buyerReminderSentAt, 'stamped');

  const second = await remindBuyerNow(order.id);
  assert.equal(second.sent, false);
  assert.equal(second.reason, 'reminded-recently');

  // …and the automatic sweep does not send it again on top.
  db().prepare(`UPDATE orders SET created_at = datetime('now', '-100 hours') WHERE id = ?`).run(order.id);
  const before = sent.filter((m) => m.to === order.buyerEmail).length;
  await runTransferReminderSweep(true);
  assert.equal(sent.filter((m) => m.to === order.buyerEmail).length, before);
});

test('Remind buyer refuses an order that is not waiting for a transfer', async () => {
  const order = reservation({ hoursAgo: 1 });
  db().prepare(`UPDATE orders SET status = 'paid' WHERE id = ?`).run(order.id);
  const result = await remindBuyerNow(order.id);
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'order-not-awaiting-transfer');
});

test('a mail-server refusal comes back with its words and leaves the order unstamped', async () => {
  const order = reservation({ hoursAgo: 1 });
  smtpError = '550 The from address does not match a verified Sender Identity.';
  try {
    const result = await remindBuyerNow(order.id);
    assert.equal(result.sent, false);
    assert.equal(result.reason, 'send-failed');
    assert.match(result.detail ?? '', /Sender Identity/);
    assert.equal(getOrder(order.id)!.buyerReminderSentAt, null, 'a failed send must not use up the reminder');
  } finally {
    smtpError = null;
  }
  assert.equal((await remindBuyerNow(order.id)).sent, true, 'works once mail is fixed');
});

test('past the pay-within date, the reminder gives the release date, not a date already gone', async () => {
  // 3-day window, reserved 4 days ago: the deadline was yesterday, the
  // reservation is released tomorrow (pay_within_days + 2).
  const order = reservation({ payWithinDays: 3, hoursAgo: 96 });
  assert.equal((await remindBuyerNow(order.id)).sent, true);
  const mail = sent.filter((m) => m.to === order.buyerEmail).at(-1)!;
  const release = new Date(Date.now() + 86_400_000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  assert.ok(mail.text?.includes(release), `expected ${release} in the reminder`);
});
