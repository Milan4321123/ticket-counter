// Erasure and access ON REQUEST (lib/erasure.ts), the account's own delete
// (lib/customers.deleteCustomer), a listing's delete (lib/events
// deleteEventCompletely) and a buyer taking back their own review
// (lib/reviews.deleteOwnReview).
//
// Every test here builds its own people and listings and asserts on BOTH
// sides of a boundary: what had to go, and what had to stay — a second person
// with the same kinds of rows, a second organizer, a second listing. An
// erasure that also took a stranger's order would pass every "is it gone?"
// assertion; only the "is theirs still there?" half catches it.
process.env.PAYMENT_MODE = 'transfer';
process.env.APP_SECRET ??= 'erasure-test-secret-0123456789abcdef';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { issueCustomerCard } from '../src/lib/cards.ts';
import { createContactRequest, getContactRequest, linkContactRequestToOrganizer } from '../src/lib/contact.ts';
import {
  createCustomerLoginCode,
  deleteCustomer,
  getCustomer,
  getCustomerBasket,
  setCustomerBasket,
  upsertCustomer,
} from '../src/lib/customers.ts';
import {
  collectPersonalData,
  customerDataExport,
  deleteContactRequest,
  deleteOrganizerPermanently,
  erasePersonEverywhere,
  OrganizerDeletionError,
} from '../src/lib/erasure.ts';
import { createEventQuestion, deleteEventCompletely, getEventById } from '../src/lib/events.ts';
import { setOrderKitchenDetails } from '../src/lib/kitchen.ts';
import {
  claimAnnouncementSend,
  confirmMarketingConsent,
  getMarketingConsent,
  requestMarketingConsent,
} from '../src/lib/marketing.ts';
import { getOrder, setOrderPhone } from '../src/lib/orders.ts';
import { getOrganizer, setOrganizerStatus } from '../src/lib/organizers.ts';
import { createOrganizerResetCode } from '../src/lib/passwordReset.ts';
import { upsertConnection } from '../src/lib/paymentConnections.ts';
import { recordPayoutChange } from '../src/lib/payout.ts';
import { awardReferralVouchers, listUnredeemedVouchers, setReferralRewardSettings } from '../src/lib/referrals.ts';
import { ANONYMOUS_BUYER_NAME, ERASED_BUYER_EMAIL, ERASED_BUYER_NAME } from '../src/lib/retention.ts';
import {
  deleteOwnReview,
  reviewableItems,
  setReviewStatus,
  shortAuthorName,
  writeReview,
} from '../src/lib/reviews.ts';
import { createSubscription } from '../src/lib/subscriptions.ts';
import { joinWaitlist } from '../src/lib/waitlist.ts';
import { db, makeEvent, makeOrder, makeOrganizer, makePaidOrder, makePromo } from './helpers.ts';

const count = (sql: string, ...args: unknown[]) => (db().prepare(sql).get(...args) as { n: number }).n;

function uploadsDir(eventId: string): string {
  return path.join(process.env.DATA_DIR!, 'uploads', eventId);
}

/** A shop with one item, and a paid order on it for this person, with a review. */
function shopWithReviewedOrder(organizerId: string, buyer: { name: string; email: string }) {
  const shop = makeEvent({
    organizerId,
    kind: 'shop',
    name: 'Achar Corner',
    tiers: [{ tierKey: 'achar', name: 'Mango achar', priceCents: 800, cap: 50 }],
  });
  const paid = makePaidOrder({
    eventId: shop.id,
    items: [{ tierId: 'achar', quantity: 1 }],
    buyerName: buyer.name,
    buyerEmail: buyer.email,
    payerName: `${buyer.name} Senior`,
  });
  setOrderPhone(paid.order.id, '+49 170 1234567');
  setOrderKitchenDetails(paid.order.id, { pickupSlot: null, tableLabel: '', note: 'no nuts — allergic', choices: {} });
  writeReview({ orderId: paid.order.id, tierKey: 'achar', rating: 5, body: 'Hot and lovely.' });
  return { shop, paid };
}

// ---------------- deleteEventCompletely ----------------

test('deleting a listing takes its reviews, waitlist and subscriptions with it (they used to make it throw)', () => {
  const org = makeOrganizer();
  const { shop, paid } = shopWithReviewedOrder(org.id, { name: 'Sita Rai', email: 'sita@buyers.test' });
  const other = shopWithReviewedOrder(org.id, { name: 'Gita Rai', email: 'gita@buyers.test' });
  joinWaitlist(shop.id, 'wait@buyers.test');
  joinWaitlist(other.shop.id, 'wait@buyers.test');
  createSubscription({
    eventId: shop.id,
    buyerName: 'Sita Rai',
    buyerEmail: 'sita@buyers.test',
    items: [{ tierId: 'achar', quantity: 1 }],
    choices: null,
    note: 'leave at the door',
    everyDays: 14,
    discountPct: 10,
    firstOrderId: paid.order.id,
  });
  makePromo(org.id, { code: 'ONLYHERE10', eventId: shop.id });
  makePromo(org.id, { code: 'EVERYWHERE' });
  // A table a future feature adds, keyed by event_id: the safety net must
  // reach it without anybody remembering to list it.
  db().exec(`CREATE TABLE IF NOT EXISTS test_future_feature (event_id TEXT NOT NULL, note TEXT)`);
  db().prepare(`INSERT INTO test_future_feature (event_id, note) VALUES (?, 'x'), (?, 'y')`).run(shop.id, other.shop.id);
  fs.mkdirSync(uploadsDir(shop.id), { recursive: true });
  fs.writeFileSync(path.join(uploadsDir(shop.id), 'photo.jpg'), 'not really a jpeg');

  const summary = deleteEventCompletely(shop.id);
  assert.equal(summary.orders, 1);
  assert.equal(summary.reviews, 1);
  assert.equal(summary.waitlist, 1);
  assert.equal(summary.subscriptions, 1);

  assert.equal(getEventById(shop.id), null);
  assert.equal(count(`SELECT COUNT(*) AS n FROM item_reviews WHERE event_id = ?`, shop.id), 0);
  assert.equal(count(`SELECT COUNT(*) AS n FROM waitlist WHERE event_id = ?`, shop.id), 0);
  assert.equal(count(`SELECT COUNT(*) AS n FROM subscriptions WHERE event_id = ?`, shop.id), 0);
  assert.equal(count(`SELECT COUNT(*) AS n FROM promo_codes WHERE code = 'ONLYHERE10'`), 0, 'a code scoped to the gone listing');
  assert.equal(count(`SELECT COUNT(*) AS n FROM test_future_feature WHERE event_id = ?`, shop.id), 0);
  assert.equal(fs.existsSync(uploadsDir(shop.id)), false, 'the uploaded files go too');

  // The other listing is untouched, down to its review and its waitlist row.
  assert.ok(getEventById(other.shop.id));
  assert.equal(count(`SELECT COUNT(*) AS n FROM item_reviews WHERE event_id = ?`, other.shop.id), 1);
  assert.equal(count(`SELECT COUNT(*) AS n FROM waitlist WHERE event_id = ?`, other.shop.id), 1);
  assert.equal(count(`SELECT COUNT(*) AS n FROM promo_codes WHERE code = 'EVERYWHERE'`), 1, "the organizer's own code stays");
  assert.equal(count(`SELECT COUNT(*) AS n FROM test_future_feature WHERE event_id = ?`, other.shop.id), 1);
});

// ---------------- erasePersonEverywhere ----------------

test('erasing a person reaches every table they are in, and nobody else’s rows', () => {
  const org = makeOrganizer();
  const asha = { name: 'Asha Gurung', email: 'asha@buyers.test' };
  const bina = { name: 'Bina Gurung', email: 'bina@buyers.test' };
  const mine = shopWithReviewedOrder(org.id, asha);
  const theirs = shopWithReviewedOrder(org.id, bina);

  // An order still waiting for Asha's bank transfer: must be left alone.
  const pending = makeOrder({ eventId: mine.shop.id, items: [{ tierId: 'achar', quantity: 1 }], buyerName: asha.name, buyerEmail: 'ASHA@buyers.test' });
  assert.equal(getOrder(pending.id)!.status, 'claimed');

  for (const p of [asha, bina]) {
    const c = upsertCustomer(p.email, { name: p.name });
    setCustomerBasket(c.id, [{ tierKey: 'achar', qty: 1 }]);
    createCustomerLoginCode(p.email);
    joinWaitlist(mine.shop.id, p.email);
    createContactRequest({ name: p.name, email: p.email, message: 'Please call me.' });
    requestMarketingConsent({ organizerId: org.id, email: p.email, sourceOrderId: null as unknown as string });
    confirmMarketingConsent(org.id, p.email, getMarketingConsent(org.id, p.email)!.consentedAt);
    claimAnnouncementSend(getMarketingConsent(org.id, p.email)!.id, mine.shop.id);
    issueCustomerCard({ organizerId: org.id, email: p.email });
    const open = createEventQuestion(mine.shop.id, `Is it vegan? — ${p.name}`, p);
    const answered = createEventQuestion(mine.shop.id, `How hot is it? — ${p.name}`, p);
    db().prepare(`UPDATE event_questions SET status = 'answered', answer = 'Very.' WHERE id = ?`).run(answered.id);
    void open;
  }
  createSubscription({
    eventId: mine.shop.id,
    buyerName: asha.name,
    buyerEmail: asha.email,
    items: [{ tierId: 'achar', quantity: 1 }],
    choices: null,
    note: '',
    everyDays: 7,
    discountPct: 5,
    firstOrderId: mine.paid.order.id,
  });
  // A referral voucher Asha earned: Bina booked through Asha's link.
  setReferralRewardSettings(org.id, 1, 300);
  const referred = makePaidOrder({
    eventId: mine.shop.id,
    items: [{ tierId: 'achar', quantity: 1 }],
    buyerName: 'Chandra',
    buyerEmail: 'chandra@buyers.test',
    referredBy: mine.paid.order.shareCode,
  });
  awardReferralVouchers(referred.order.id);
  assert.equal(listUnredeemedVouchers(org.id, asha.email).length, 1, 'the fixture needs a real voucher');

  const report = erasePersonEverywhere('  Asha@Buyers.test ');

  // --- The report, table by table.
  assert.equal(report.orders, 1);
  assert.deepEqual(report.ordersInFlight.map((o) => o.orderId), [pending.id]);
  assert.equal(report.reviews, 1);
  assert.equal(report.subscriptions, 1);
  assert.equal(report.customers, 1);
  assert.equal(report.baskets, 1);
  assert.equal(report.loginCodes, 1);
  assert.equal(report.voucherEmails, 1);
  assert.equal(report.contactRequests, 1);
  assert.equal(report.waitlist, 1);
  assert.equal(report.questionsDeleted, 1);
  assert.equal(report.questionsAnonymised, 1);
  assert.equal(report.marketingConsents, 1);
  assert.equal(report.customerCards, 1);
  assert.equal(report.organizerAccount, false);

  // --- The paid order: the person is gone, the arithmetic is not.
  const row = db()
    .prepare(
      `SELECT buyer_name AS n, buyer_email AS e, buyer_phone AS p, payer_name AS pn, order_note AS note,
              buyer_erased_at AS at, total_cents AS total
       FROM orders WHERE id = ?`
    )
    .get(mine.paid.order.id) as Record<string, unknown>;
  assert.deepEqual(
    { n: row.n, e: row.e, p: row.p, pn: row.pn, note: row.note, total: row.total },
    { n: ERASED_BUYER_NAME, e: ERASED_BUYER_EMAIL, p: '', pn: '', note: '', total: 800 }
  );
  assert.ok(row.at);
  assert.equal(count(`SELECT COUNT(*) AS n FROM tickets WHERE order_id = ?`, mine.paid.order.id), 1, 'codes still scan');
  assert.equal(
    (db().prepare(`SELECT author_name AS a FROM item_reviews WHERE order_id = ?`).get(mine.paid.order.id) as { a: string }).a,
    ANONYMOUS_BUYER_NAME
  );
  // --- The in-flight order: untouched, so a late transfer can still be confirmed.
  assert.equal(getOrder(pending.id)!.buyerEmail, 'ASHA@buyers.test');
  assert.equal(getOrder(pending.id)!.buyerErasedAt, null);
  // --- The voucher still works as a code; it just names nobody.
  assert.equal(count(`SELECT COUNT(*) AS n FROM referral_vouchers WHERE organizer_id = ? AND referrer_email IS NULL`, org.id), 1);
  // --- The answered question stays public Q&A; the open one is gone.
  assert.equal(count(`SELECT COUNT(*) AS n FROM event_questions WHERE question LIKE '%Asha Gurung'`), 1);
  assert.equal(count(`SELECT COUNT(*) AS n FROM event_questions WHERE asker_email = ?`, asha.email), 0);

  // --- Bina, who shares every kind of row with Asha, keeps every one of them.
  assert.equal(getOrder(theirs.paid.order.id)!.buyerName, bina.name);
  assert.equal(getOrder(theirs.paid.order.id)!.payerName, `${bina.name} Senior`);
  assert.equal(count(`SELECT COUNT(*) AS n FROM customers WHERE email = ?`, bina.email), 1);
  assert.equal(count(`SELECT COUNT(*) AS n FROM customer_login_codes WHERE email = ?`, bina.email), 1);
  assert.equal(count(`SELECT COUNT(*) AS n FROM waitlist WHERE email = ?`, bina.email), 1);
  assert.equal(count(`SELECT COUNT(*) AS n FROM contact_requests WHERE email = ?`, bina.email), 1);
  assert.equal(count(`SELECT COUNT(*) AS n FROM marketing_consents WHERE email = ?`, bina.email), 1);
  assert.equal(count(`SELECT COUNT(*) AS n FROM customer_cards WHERE email = ?`, bina.email), 1);
  assert.equal(count(`SELECT COUNT(*) AS n FROM event_questions WHERE asker_email = ?`, bina.email), 2);
  assert.notEqual(
    (db().prepare(`SELECT author_name AS a FROM item_reviews WHERE order_id = ?`).get(theirs.paid.order.id) as { a: string }).a,
    ANONYMOUS_BUYER_NAME
  );

  // Running it again finds only the order it deliberately left.
  const again = erasePersonEverywhere(asha.email);
  assert.equal(again.orders, 0);
  assert.equal(again.ordersInFlight.length, 1);
});

test('erasing an address that owns an organizer account says so, and does not touch the account', () => {
  const org = makeOrganizer({ email: 'owner@organizers.test' });
  const report = erasePersonEverywhere('owner@organizers.test');
  assert.equal(report.organizerAccount, true);
  assert.ok(getOrganizer(org.id));
});

// ---------------- Access (Art. 15 / 20) ----------------

test("a customer's export holds their own rows and nothing of anybody else's", () => {
  const org = makeOrganizer();
  const dev = { name: 'Dev Tamang', email: 'dev@buyers.test' };
  const eve = { name: 'Eve Tamang', email: 'eve@buyers.test' };
  const mine = shopWithReviewedOrder(org.id, dev);
  shopWithReviewedOrder(org.id, eve);
  joinWaitlist(mine.shop.id, dev.email);
  joinWaitlist(mine.shop.id, eve.email);
  const customer = upsertCustomer(dev.email, { name: dev.name });
  setCustomerBasket(customer.id, [{ tierKey: 'achar', qty: 2 }]);

  const data = customerDataExport(customer);
  assert.equal((data.account as { email: string }).email, dev.email);
  assert.deepEqual(data.basket, [{ tierKey: 'achar', qty: 2 }]);
  assert.equal(data.orders.length, 1);
  const order = data.orders[0] as Record<string, unknown> & { items: unknown[]; tickets: { code: string }[] };
  assert.equal(order.buyerName, dev.name);
  assert.equal(order.orderNote, 'no nuts — allergic', 'the note they wrote is theirs to see');
  assert.equal(order.items.length, 1);
  assert.equal(order.tickets.length, 1);
  assert.equal(data.reviews.length, 1);
  assert.equal(data.waitlist.length, 1);
  assert.ok(data.about.orders.includes('days'), 'the retention rules travel with the data');

  // Nothing of Eve's, anywhere in the file.
  assert.equal(JSON.stringify(data).includes(eve.email), false);
  assert.equal(JSON.stringify(data).includes('Eve Tamang'), false);
  // Nor the seller's payout account, which sits on the same order row.
  assert.equal(JSON.stringify(data).includes('DE02120300000000202051'), false);

  // An erased order is no longer "about" the address, so it leaves the export.
  erasePersonEverywhere(dev.email);
  assert.equal(collectPersonalData(dev.email).orders.length, 0);
});

// ---------------- The customer's own delete ----------------

test('deleting a customer account takes the basket and pending codes, not the orders', () => {
  const org = makeOrganizer();
  const fay = { name: 'Fay Lama', email: 'fay@buyers.test' };
  const { paid } = shopWithReviewedOrder(org.id, fay);
  const c = upsertCustomer(fay.email, { name: fay.name });
  setCustomerBasket(c.id, [{ tierKey: 'achar', qty: 1 }]);
  createCustomerLoginCode(fay.email);
  const other = upsertCustomer('gopal@buyers.test');
  setCustomerBasket(other.id, [{ tierKey: 'achar', qty: 3 }]);

  assert.equal(deleteCustomer(c.id), true);
  assert.equal(getCustomer(c.id), null);
  assert.deepEqual(getCustomerBasket(c.id), []);
  assert.equal(count(`SELECT COUNT(*) AS n FROM customer_login_codes WHERE email = ?`, fay.email), 0);
  // The seller's record of the sale is not the customer's to delete.
  assert.equal(getOrder(paid.order.id)!.buyerEmail, fay.email);
  // Somebody else's account and basket are untouched.
  assert.ok(getCustomer(other.id));
  assert.equal(getCustomerBasket(other.id).length, 1);
  assert.equal(deleteCustomer(c.id), false, 'a second delete finds nothing');
});

// ---------------- Contact inbox ----------------

test('a contact request can be deleted on its own', () => {
  const a = createContactRequest({ name: 'Hari', email: 'hari@x.test', message: 'hello' });
  const b = createContactRequest({ name: 'Indra', email: 'indra@x.test', message: 'hello' });
  assert.equal(deleteContactRequest(a.id), true);
  assert.equal(getContactRequest(a.id), null);
  assert.ok(getContactRequest(b.id));
  assert.equal(deleteContactRequest(a.id), false);
});

// ---------------- Organizer deletion (Art. 28(3)(g)) ----------------

test('an organizer can only be deleted once disabled, and only with their email typed out', () => {
  const org = makeOrganizer({ email: 'still-active@organizers.test' });
  assert.throws(() => deleteOrganizerPermanently(org.id, org.email), OrganizerDeletionError);
  setOrganizerStatus(org.id, 'disabled');
  assert.throws(() => deleteOrganizerPermanently(org.id, 'someone-else@organizers.test'), OrganizerDeletionError);
  assert.throws(() => deleteOrganizerPermanently(org.id, ''), OrganizerDeletionError);
  assert.ok(getOrganizer(org.id), 'nothing was deleted by a refused attempt');
  assert.throws(() => deleteOrganizerPermanently('no-such-organizer', 'x@y.test'), OrganizerDeletionError);
});

test('deleting an organizer removes every listing, file and organizer-scoped row — and nobody else’s', () => {
  const gone = makeOrganizer({ email: 'leaving@organizers.test', name: 'Leaving Verein' });
  const stays = makeOrganizer({ email: 'staying@organizers.test' });

  function fill(org: { id: string }, buyerEmail: string) {
    const { shop, paid } = shopWithReviewedOrder(org.id, { name: 'Kiran', email: buyerEmail });
    const event = makeEvent({ organizerId: org.id, eventDate: '2027-01-01', tiers: [{ tierKey: 'ga', priceCents: 1000, cap: 10 }] });
    makePaidOrder({ eventId: event.id, items: [{ tierId: 'ga', quantity: 2 }], buyerEmail });
    joinWaitlist(event.id, buyerEmail);
    requestMarketingConsent({ organizerId: org.id, email: buyerEmail, sourceOrderId: paid.order.id });
    confirmMarketingConsent(org.id, buyerEmail, getMarketingConsent(org.id, buyerEmail)!.consentedAt);
    claimAnnouncementSend(getMarketingConsent(org.id, buyerEmail)!.id, event.id);
    issueCustomerCard({ organizerId: org.id, email: buyerEmail });
    makePromo(org.id);
    setReferralRewardSettings(org.id, 1, 200);
    const referred = makePaidOrder({
      eventId: shop.id,
      items: [{ tierId: 'achar', quantity: 1 }],
      buyerEmail: `friend-of-${buyerEmail}`,
      referredBy: paid.order.shareCode,
    });
    awardReferralVouchers(referred.order.id);
    upsertConnection({ organizerId: org.id, provider: 'stripe', publicId: '', secret: 'sk_test_x', accountLabel: 'Shop', sandbox: true });
    recordPayoutChange({ eventId: event.id, organizerId: org.id, field: 'bankIban', oldValue: '', newValue: 'DE02120300000000202051', factor: 'none' });
    createOrganizerResetCode(org.id);
    const req = createContactRequest({ name: 'Applicant', email: `applicant-${buyerEmail}`, message: 'Please open my account.', kind: 'organizer-account' });
    linkContactRequestToOrganizer(req.id, org.id);
    for (const id of [shop.id, event.id]) {
      fs.mkdirSync(uploadsDir(id), { recursive: true });
      fs.writeFileSync(path.join(uploadsDir(id), 'cover.jpg'), 'bytes');
    }
    return { shop, event };
  }
  const g = fill(gone, 'kiran@buyers.test');
  const s = fill(stays, 'kiran2@buyers.test');

  setOrganizerStatus(gone.id, 'disabled');
  const report = deleteOrganizerPermanently(gone.id, '  LEAVING@organizers.test ');
  assert.equal(report.events, 2);
  assert.equal(report.orders, 3);
  assert.equal(report.reviews, 1);
  assert.equal(report.waitlist, 1);
  assert.equal(report.marketingConsents, 1);
  assert.equal(report.customerCards, 1);
  assert.equal(report.promoCodes, 1);
  assert.equal(report.referralVouchers, 1);
  assert.equal(report.paymentConnections, 1);
  assert.equal(report.contactRequests, 1);

  assert.equal(getOrganizer(gone.id), null);
  for (const [table, col] of [
    ['events', 'organizer_id'],
    ['marketing_consents', 'organizer_id'],
    ['customer_cards', 'organizer_id'],
    ['promo_codes', 'organizer_id'],
    ['referral_vouchers', 'organizer_id'],
    ['organizer_payment_connections', 'organizer_id'],
    ['payout_changes', 'organizer_id'],
    ['organizer_password_reset', 'organizer_id'],
    ['contact_requests', 'organizer_id'],
  ] as const) {
    assert.equal(count(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`, gone.id), 0, `${table} is empty for them`);
    assert.ok(count(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`, stays.id) >= 1, `${table} keeps the other organizer's rows`);
  }
  assert.equal(count(`SELECT COUNT(*) AS n FROM orders WHERE event_id IN (?, ?)`, g.shop.id, g.event.id), 0);
  assert.equal(count(`SELECT COUNT(*) AS n FROM marketing_sends WHERE event_id = ?`, g.event.id), 0);
  assert.equal(fs.existsSync(uploadsDir(g.shop.id)), false);
  assert.equal(fs.existsSync(uploadsDir(g.event.id)), false);

  // The organizer who stays keeps everything, files included.
  assert.ok(getOrganizer(stays.id));
  assert.equal(count(`SELECT COUNT(*) AS n FROM orders WHERE event_id IN (?, ?)`, s.shop.id, s.event.id), 3);
  assert.equal(fs.existsSync(uploadsDir(s.shop.id)), true);
});

// ---------------- Reviews: the byline, and taking one back ----------------

test('the byline a buyer is shown before posting is exactly the one stored', () => {
  const org = makeOrganizer();
  const { paid } = shopWithReviewedOrder(org.id, { name: 'Janaki Devi Shrestha', email: 'janaki@buyers.test' });
  const items = reviewableItems(paid.order.id);
  assert.equal(items[0].byline, 'Janaki S.');
  assert.equal(items[0].byline, shortAuthorName('Janaki Devi Shrestha'));
  assert.equal(items[0].existing?.authorName, items[0].byline);
});

test('a buyer can delete their own review; a hidden one is emptied, not freed for a re-post', () => {
  const org = makeOrganizer();
  const a = shopWithReviewedOrder(org.id, { name: 'Laxmi Thapa', email: 'laxmi@buyers.test' });
  const b = shopWithReviewedOrder(org.id, { name: 'Maya Thapa', email: 'maya@buyers.test' });

  assert.equal(deleteOwnReview(a.paid.order.id, 'achar'), 'deleted');
  assert.equal(count(`SELECT COUNT(*) AS n FROM item_reviews WHERE order_id = ?`, a.paid.order.id), 0);
  assert.equal(deleteOwnReview(a.paid.order.id, 'achar'), 'none');
  assert.equal(count(`SELECT COUNT(*) AS n FROM item_reviews WHERE order_id = ?`, b.paid.order.id), 1, 'only their own');

  const hiddenId = (db().prepare(`SELECT id FROM item_reviews WHERE order_id = ?`).get(b.paid.order.id) as { id: string }).id;
  setReviewStatus(hiddenId, 'hidden', 'Spam');
  assert.equal(deleteOwnReview(b.paid.order.id, 'achar'), 'emptied');
  const row = db().prepare(`SELECT body, author_name AS a, status FROM item_reviews WHERE id = ?`).get(hiddenId) as {
    body: string;
    a: string;
    status: string;
  };
  assert.deepEqual(row, { body: '', a: ANONYMOUS_BUYER_NAME, status: 'hidden' });
  // Posting again edits the hidden husk; it does not become a fresh, visible review.
  assert.equal(writeReview({ orderId: b.paid.order.id, tierKey: 'achar', rating: 1, body: 'again' }).status, 'hidden');
});
