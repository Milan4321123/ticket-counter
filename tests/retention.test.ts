// The storage limits the retention sweep enforces beyond "buyers after their
// event" (lib/retention.ts): payer names and notes, listings without a date,
// unanswered questions, shop waitlists, ended subscriptions, idle customer
// accounts, expired sign-in codes, old contact requests and spent vouchers'
// referrer addresses — each against the constant /privacy quotes.
//
// The sweep is GLOBAL, so every test builds its own rows and asserts on both
// sides of each clock: a row one day past the limit goes, a row inside it
// stays. A sweep that deleted everything would pass every "gone" assertion;
// only the "still here" half catches it.
process.env.PAYMENT_MODE = 'transfer';
process.env.APP_SECRET ??= 'retention-test-secret-0123456789abcdef';

import test from 'node:test';
import assert from 'node:assert/strict';

import { createContactRequest, getContactRequest } from '../src/lib/contact.ts';
import { createCustomerLoginCode, getCustomer, getCustomerBasket, setCustomerBasket, upsertCustomer } from '../src/lib/customers.ts';
import { createEventQuestion } from '../src/lib/events.ts';
import { setOrderKitchenDetails } from '../src/lib/kitchen.ts';
import { getOrder, markOrderFailed, setOrderPhone } from '../src/lib/orders.ts';
import { awardReferralVouchers, listUnredeemedVouchers, setReferralRewardSettings, voucherTotalsForOrganizer } from '../src/lib/referrals.ts';
import {
  BUYER_RETENTION_DAYS,
  CONTACT_REQUEST_RETENTION_DAYS,
  CUSTOMER_INACTIVE_DAYS,
  ERASED_BUYER_EMAIL,
  ERASED_BUYER_NAME,
  eraseOrderBuyer,
  REFERRAL_VOUCHER_RETENTION_DAYS,
  runBuyerDataRetentionSweep,
  SUBSCRIPTION_ENDED_RETENTION_DAYS,
  UNDATED_ORDER_RETENTION_DAYS,
  WAITLIST_SHOP_MAX_DAYS,
  withAnonymizedBuyer,
} from '../src/lib/retention.ts';
import { actOnSubscription, createSubscription, getSubscription } from '../src/lib/subscriptions.ts';
import { joinWaitlist } from '../src/lib/waitlist.ts';
import { db, makeEvent, makeOrder, makeOrganizer, makePaidOrder } from './helpers.ts';

/** 'YYYY-MM-DD', n days from today (negative = past). */
function isoDaysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

/** Move one row's clock column back by `days`. The rule under test then reads the real column. */
function age(table: string, column: string, idColumn: string, id: string, days: number): void {
  db()
    .prepare(`UPDATE ${table} SET ${column} = datetime('now', ?) WHERE ${idColumn} = ?`)
    .run(`-${days} days`, id);
}

const sweep = () => runBuyerDataRetentionSweep(true);

test('erasing an order takes the payer name, the phone and the free-text note too', () => {
  const event = makeEvent({
    eventDate: isoDaysFromNow(-(BUYER_RETENTION_DAYS + 5)),
    tiers: [{ tierKey: 'ga', priceCents: 1500, cap: 20 }],
  });
  const { order } = makePaidOrder({
    eventId: event.id,
    items: [{ tierId: 'ga', quantity: 1 }],
    buyerName: 'Nisha Magar',
    payerName: 'Her Father',
  });
  setOrderPhone(order.id, '+49 151 2345678');
  setOrderKitchenDetails(order.id, { pickupSlot: null, tableLabel: '', note: 'I am diabetic', choices: {} });

  const r = sweep();
  assert.ok(r.erased >= 1);
  // Erased by the erasure statement itself, not mopped up by the scrub step
  // behind it: nothing had been erased before this test, so the scrub must
  // have had nothing to do.
  assert.equal(r.scrubbed, 0);
  const row = db()
    .prepare(`SELECT buyer_name AS n, buyer_email AS e, buyer_phone AS p, payer_name AS pn, order_note AS note FROM orders WHERE id = ?`)
    .get(order.id);
  assert.deepEqual(row, { n: ERASED_BUYER_NAME, e: ERASED_BUYER_EMAIL, p: '', pn: '', note: '' });
});

test('an order erased by an older build loses its payer name and note on the next sweep, and never shows them meanwhile', () => {
  const event = makeEvent({ eventDate: isoDaysFromNow(60), tiers: [{ tierKey: 'ga', priceCents: 1000, cap: 20 }] });
  const { order } = makePaidOrder({ eventId: event.id, items: [{ tierId: 'ga', quantity: 1 }], payerName: 'Uncle Ram' });
  setOrderKitchenDetails(order.id, { pickupSlot: null, tableLabel: '', note: 'nut allergy', choices: {} });
  // What the pre-fix sweep wrote: name and email only.
  db()
    .prepare(`UPDATE orders SET buyer_name = ?, buyer_email = ?, buyer_erased_at = datetime('now') WHERE id = ?`)
    .run(ERASED_BUYER_NAME, ERASED_BUYER_EMAIL, order.id);

  // The read model degrades it before the scrub has run...
  const shown = withAnonymizedBuyer({ ...getOrder(order.id)!, orderNote: 'nut allergy' });
  assert.equal(shown.payerName, '');
  assert.equal(shown.orderNote, '');
  // ...and the sweep removes it from the database.
  assert.ok(sweep().scrubbed >= 1);
  assert.equal(getOrder(order.id)!.payerName, '');
  assert.equal(
    (db().prepare(`SELECT order_note AS n FROM orders WHERE id = ?`).get(order.id) as { n: string }).n,
    ''
  );
});

test(`a listing with no date erases its buyers ${UNDATED_ORDER_RETENTION_DAYS} days after each order — never one still payable`, () => {
  const event = makeEvent({ eventDate: null, tiers: [{ tierKey: 'ga', priceCents: 1000, cap: 50 }] });
  const oldPaid = makePaidOrder({ eventId: event.id, items: [{ tierId: 'ga', quantity: 1 }], buyerName: 'Old Paid' }).order;
  const youngPaid = makePaidOrder({ eventId: event.id, items: [{ tierId: 'ga', quantity: 1 }], buyerName: 'Young Paid' }).order;
  const oldCancelled = makeOrder({ eventId: event.id, items: [{ tierId: 'ga', quantity: 1 }], buyerName: 'Old Cancelled' });
  markOrderFailed(oldCancelled.id, 'cancelled');
  const oldStillClaimed = makeOrder({ eventId: event.id, items: [{ tierId: 'ga', quantity: 1 }], buyerName: 'Old Claimed' });
  for (const id of [oldPaid.id, oldCancelled.id, oldStillClaimed.id]) {
    age('orders', 'created_at', 'id', id, UNDATED_ORDER_RETENTION_DAYS + 20);
  }
  age('orders', 'created_at', 'id', youngPaid.id, UNDATED_ORDER_RETENTION_DAYS - 5);

  sweep();
  assert.equal(getOrder(oldPaid.id)!.buyerName, ERASED_BUYER_NAME);
  assert.equal(getOrder(oldCancelled.id)!.buyerName, ERASED_BUYER_NAME);
  assert.equal(getOrder(youngPaid.id)!.buyerName, 'Young Paid', 'inside the window');
  assert.equal(getOrder(oldStillClaimed.id)!.buyerName, 'Old Claimed', 'a reservation that can still be paid is never erased');
});

test('a question nobody answered is deleted after its event; an answered one keeps its words and loses its asker', () => {
  const past = makeEvent({ eventDate: isoDaysFromNow(-(BUYER_RETENTION_DAYS + 2)) });
  const future = makeEvent({ eventDate: isoDaysFromNow(30) });
  const open = createEventQuestion(past.id, 'Is there parking?', { name: 'Om', email: 'om@x.test' });
  const answered = createEventQuestion(past.id, 'Doors open when?', { name: 'Om', email: 'om@x.test' });
  db().prepare(`UPDATE event_questions SET status = 'answered', answer = '18:00' WHERE id = ?`).run(answered.id);
  const openFuture = createEventQuestion(future.id, 'Kids allowed?', { name: 'Pema', email: 'pema@x.test' });

  const r = sweep();
  assert.ok(r.questionsDeleted >= 1);
  const ids = (db().prepare(`SELECT id FROM event_questions`).all() as { id: string }[]).map((q) => q.id);
  assert.equal(ids.includes(open.id), false);
  assert.equal(ids.includes(openFuture.id), true, 'an upcoming event keeps its open question');
  const kept = db()
    .prepare(`SELECT question, answer, asker_email AS e FROM event_questions WHERE id = ?`)
    .get(answered.id);
  assert.deepEqual(kept, { question: 'Doors open when?', answer: '18:00', e: ERASED_BUYER_EMAIL });
});

test(`a shop waitlist address that never got its email goes after ${WAITLIST_SHOP_MAX_DAYS} days`, () => {
  const shop = makeEvent({ kind: 'shop' });
  joinWaitlist(shop.id, 'old@wait.test');
  joinWaitlist(shop.id, 'new@wait.test');
  db()
    .prepare(`UPDATE waitlist SET created_at = datetime('now', ?) WHERE email = ?`)
    .run(`-${WAITLIST_SHOP_MAX_DAYS + 1} days`, 'old@wait.test');
  db()
    .prepare(`UPDATE waitlist SET created_at = datetime('now', ?) WHERE email = ?`)
    .run(`-${WAITLIST_SHOP_MAX_DAYS - 10} days`, 'new@wait.test');

  sweep();
  const left = (db().prepare(`SELECT email FROM waitlist WHERE event_id = ?`).all(shop.id) as { email: string }[]).map((w) => w.email);
  assert.deepEqual(left, ['new@wait.test']);
});

test(`a cancelled subscription is deleted ${SUBSCRIPTION_ENDED_RETENTION_DAYS} days after it ended; live and paused ones stay`, () => {
  const shop = makeEvent({ kind: 'shop', tiers: [{ tierKey: 'dal', priceCents: 500, cap: 100 }] });
  const make = (name: string) =>
    createSubscription({
      eventId: shop.id,
      buyerName: name,
      buyerEmail: `${name.toLowerCase()}@subs.test`,
      items: [{ tierId: 'dal', quantity: 1 }],
      choices: null,
      note: 'ring twice',
      everyDays: 7,
      discountPct: 5,
      firstOrderId: makeOrder({ eventId: shop.id, items: [{ tierId: 'dal', quantity: 1 }] }).id,
    });
  const longCancelled = make('Long');
  const justCancelled = make('Just');
  const active = make('Active');
  const paused = make('Paused');
  actOnSubscription(longCancelled.token, 'cancel');
  actOnSubscription(justCancelled.token, 'cancel');
  actOnSubscription(paused.token, 'pause');
  for (const s of [longCancelled, active, paused]) {
    age('subscriptions', 'updated_at', 'id', s.id, SUBSCRIPTION_ENDED_RETENTION_DAYS + 1);
  }
  age('subscriptions', 'updated_at', 'id', justCancelled.id, SUBSCRIPTION_ENDED_RETENTION_DAYS - 3);

  sweep();
  assert.equal(getSubscription(longCancelled.id), null);
  assert.ok(getSubscription(justCancelled.id));
  assert.ok(getSubscription(active.id));
  assert.ok(getSubscription(paused.id), 'paused is not ended — the buyer can resume it');
});

test(`a customer account with no sign-in for ${CUSTOMER_INACTIVE_DAYS} days is deleted with its basket; expired codes go`, () => {
  const idle = upsertCustomer('idle@customers.test', { name: 'Idle' });
  const neverLoggedStamp = upsertCustomer('legacy@customers.test');
  const recent = upsertCustomer('recent@customers.test');
  setCustomerBasket(idle.id, [{ x: 1 }]);
  setCustomerBasket(recent.id, [{ x: 2 }]);
  age('customers', 'last_login_at', 'id', idle.id, CUSTOMER_INACTIVE_DAYS + 1);
  // An account with no last_login_at at all falls back to created_at.
  db().prepare(`UPDATE customers SET last_login_at = NULL WHERE id = ?`).run(neverLoggedStamp.id);
  age('customers', 'created_at', 'id', neverLoggedStamp.id, CUSTOMER_INACTIVE_DAYS + 1);
  age('customers', 'last_login_at', 'id', recent.id, CUSTOMER_INACTIVE_DAYS - 30);
  age('customers', 'created_at', 'id', recent.id, CUSTOMER_INACTIVE_DAYS + 300);

  createCustomerLoginCode('expired@customers.test');
  createCustomerLoginCode('fresh@customers.test');
  db().prepare(`UPDATE customer_login_codes SET expires_at = ? WHERE email = ?`).run(Date.now() - 1000, 'expired@customers.test');

  const r = sweep();
  assert.ok(r.customersDeleted >= 2);
  assert.equal(getCustomer(idle.id), null);
  assert.deepEqual(getCustomerBasket(idle.id), []);
  assert.equal(getCustomer(neverLoggedStamp.id), null);
  assert.ok(getCustomer(recent.id), 'signed in inside the window, however old the account');
  assert.equal(getCustomerBasket(recent.id).length, 1);
  const codes = (db().prepare(`SELECT email FROM customer_login_codes`).all() as { email: string }[]).map((c) => c.email);
  assert.equal(codes.includes('expired@customers.test'), false);
  assert.equal(codes.includes('fresh@customers.test'), true);
});

test(`contact requests are deleted ${CONTACT_REQUEST_RETENTION_DAYS} days after they arrived`, () => {
  const old = createContactRequest({ name: 'Old', email: 'old@contact.test', message: 'hi' });
  const young = createContactRequest({ name: 'Young', email: 'young@contact.test', message: 'hi' });
  age('contact_requests', 'created_at', 'id', old.id, CONTACT_REQUEST_RETENTION_DAYS + 1);
  age('contact_requests', 'created_at', 'id', young.id, CONTACT_REQUEST_RETENTION_DAYS - 1);
  sweep();
  assert.equal(getContactRequest(old.id), null);
  assert.ok(getContactRequest(young.id));
});

test('a spent voucher loses its referrer address — but not while their referrals still count, so no voucher is owed twice', () => {
  const org = makeOrganizer();
  const event = makeEvent({ organizerId: org.id, eventDate: isoDaysFromNow(200), tiers: [{ tierKey: 'ga', priceCents: 2000, cap: 100 }] });
  setReferralRewardSettings(org.id, 1, 500);
  const rita = 'rita@refs.test';
  const ritaFirst = makePaidOrder({ eventId: event.id, items: [{ tierId: 'ga', quantity: 1 }], buyerEmail: rita }).order;
  const friend = makePaidOrder({
    eventId: event.id,
    items: [{ tierId: 'ga', quantity: 1 }],
    buyerEmail: 'friend@refs.test',
    referredBy: ritaFirst.shareCode,
  }).order;
  awardReferralVouchers(friend.id);
  const voucher = listUnredeemedVouchers(org.id, rita)[0];
  assert.ok(voucher, 'the fixture needs a real voucher');
  // Rita spends it on a second ticket, and that was long ago.
  const spentOn = makePaidOrder({
    eventId: event.id,
    items: [{ tierId: 'ga', quantity: 1 }],
    buyerEmail: rita,
    voucherCode: voucher.code,
  }).order;
  db()
    .prepare(`UPDATE referral_vouchers SET redeemed_at = datetime('now', ?) WHERE id = ?`)
    .run(`-${REFERRAL_VOUCHER_RETENTION_DAYS + 5} days`, voucher.id);
  age('orders', 'paid_at', 'id', spentOn.id, REFERRAL_VOUCHER_RETENTION_DAYS + 5);

  const emailOf = () =>
    (db().prepare(`SELECT referrer_email AS e FROM referral_vouchers WHERE id = ?`).get(voucher.id) as { e: string | null }).e;

  // Rita still has live orders here, so her referral still counts — and the
  // voucher has to keep counting as hers, or it would be issued again.
  sweep();
  assert.equal(emailOf(), rita);
  awardReferralVouchers(friend.id);
  assert.equal(voucherTotalsForOrganizer(org.id).earned, 1);

  // Once her orders are erased, her referrals can never count again: now the
  // address goes, and re-running the award still owes nobody anything.
  eraseOrderBuyer(ritaFirst.id);
  eraseOrderBuyer(spentOn.id);
  assert.ok(sweep().voucherEmailsErased >= 1);
  assert.equal(emailOf(), null);
  awardReferralVouchers(friend.id);
  assert.equal(voucherTotalsForOrganizer(org.id).earned, 1, 'no second voucher for the same referral');
});

test('one step failing does not stop the others', () => {
  const old = createContactRequest({ name: 'Stuck', email: 'stuck@contact.test', message: 'hi' });
  age('contact_requests', 'created_at', 'id', old.id, CONTACT_REQUEST_RETENTION_DAYS + 1);
  const idle = upsertCustomer('idle-during-failure@customers.test');
  age('customers', 'last_login_at', 'id', idle.id, CUSTOMER_INACTIVE_DAYS + 1);

  // Take one step's table away: its statement throws.
  db().exec(`ALTER TABLE subscriptions RENAME TO subscriptions_away`);
  try {
    const r = sweep();
    assert.deepEqual(r.failed, ['subscriptions']);
    assert.ok(r.contactRequestsDeleted >= 1, 'a later step still ran');
    assert.ok(r.customersDeleted >= 1);
  } finally {
    db().exec(`ALTER TABLE subscriptions_away RENAME TO subscriptions`);
  }
  assert.equal(getContactRequest(old.id), null);
  assert.equal(getCustomer(idle.id), null);
  assert.deepEqual(sweep().failed, []);
});
