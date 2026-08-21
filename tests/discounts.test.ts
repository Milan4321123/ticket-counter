/**
 * DISCOUNT AND VOUCHER RULES — lib/referrals, lib/promos, and the claim inside
 * lib/orders' createOrder.
 *
 * One column, orders.voucher_code, is the whole record of "what code part-paid
 * this order", and two very different things land in it: a referral voucher
 * the platform issued on the seller's behalf, and a promo code the seller
 * minted themselves. Everything here is about the promises that column has to
 * keep whichever kind is in it — that a code is spent exactly as many times as
 * it is worth, that the arithmetic a buyer was shown is the arithmetic they are
 * charged, and that giving a code back gives back exactly one of it.
 *
 * These are money rules, so every test drives the REAL function. A test that
 * recomputed a discount and compared it to itself would pass for ever while
 * the checkout quietly charged something else.
 *
 * ONE TEST IN THIS FILE FAILS ON PURPOSE. It is marked, at length, where it
 * sits: releaseVoucherForOrder hands a PAID order's voucher back, against its
 * own documented rule, and the fix belongs in src/ and not in the expectation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEvent, makeEventWithTier, makeOrganizer, makeOrder, makePaidOrder, makePromo, makeTier } from './helpers.ts';
import { getAvailability } from '../src/lib/inventory.ts';
import { discountCentsFor } from '../src/lib/money.ts';
import {
  cleanupOldPendingOrders,
  createOrder,
  expireOverdueTransferReservations,
  finalizePaidOrder,
  getOrder,
  markOrderFailed,
  markTransferOrderPaid,
  purgeMockOrders,
  type PaymentMethod,
} from '../src/lib/orders.ts';
import {
  CODE_NOT_USABLE,
  createPromoCode,
  getPromoCode,
  PromoError,
  previewDiscountCode,
  PROMO_NOTHING_TO_DISCOUNT,
  releaseDiscountCodeForOrder,
} from '../src/lib/promos.ts';
import {
  awardReferralVouchers,
  listUnredeemedVouchers,
  normalizeVoucherCode,
  setReferralRewardSettings,
  VOUCHER_NOTHING_TO_DISCOUNT,
  VoucherError,
  type VoucherRow,
} from '../src/lib/referrals.ts';

// ---------------- Local fixtures ----------------

/**
 * A seller with one listing, one paid tier, and room to spare.
 *
 * Every test builds its own — state accumulates within a test file (see
 * tests/README.md), and a redemption counter shared between tests would make
 * failures depend on the order they run in.
 */
function seller(priceCents = 1000, cap = 200) {
  const organizer = makeOrganizer();
  const { event, tier } = makeEventWithTier(
    { organizerId: organizer.id, totalCapacity: 1000 },
    { priceCents, cap }
  );
  return { organizerId: organizer.id, event, tier, listing: { id: event.id, organizerId: organizer.id } };
}

/**
 * REAL referral vouchers, minted the only way the product ever mints one:
 * switch rewards on, have somebody's share link bring in paid bookings, and
 * run the hook every "an order became paid" path runs.
 *
 * There is no createVoucher() to call — issuing is deliberately derived from
 * the referral count rather than handed out — so this walks the whole path.
 * Poking a row into referral_vouchers instead would test a row, and every
 * claim/release test built on it would still pass after issuing broke.
 */
function mintVouchers(
  organizerId: string,
  eventId: string,
  tierKey: string,
  count: number,
  amountCents = 1000
): VoucherRow[] {
  const referrerEmail = `referrer-${organizerId.slice(0, 8)}@example.test`;
  setReferralRewardSettings(organizerId, 1, amountCents); // one referral = one voucher
  const referrer = makePaidOrder({
    eventId,
    items: [{ tierId: tierKey, quantity: 1 }],
    buyerEmail: referrerEmail,
  });
  for (let i = 0; i < count; i++) {
    const friend = makePaidOrder({
      eventId,
      items: [{ tierId: tierKey, quantity: 1 }],
      referredBy: referrer.order.shareCode,
    });
    awardReferralVouchers(friend.order.id);
  }
  const vouchers = listUnredeemedVouchers(organizerId, referrerEmail);
  assert.equal(vouchers.length, count, 'fixture: the real issuing path produced the vouchers asked for');
  return vouchers;
}

/** One voucher, for the many tests that need exactly one. */
function mintVoucher(organizerId: string, eventId: string, tierKey: string, amountCents = 1000): VoucherRow {
  return mintVouchers(organizerId, eventId, tierKey, 1, amountCents)[0];
}

const ordersOn = (eventId: string): number =>
  (db().prepare(`SELECT COUNT(*) AS n FROM orders WHERE event_id = ?`).get(eventId) as { n: number }).n;

const ordersHolding = (code: string): number =>
  (db().prepare(`SELECT COUNT(*) AS n FROM orders WHERE voucher_code = ?`).get(code) as { n: number }).n;

const voucherById = (id: string): VoucherRow =>
  db().prepare(`SELECT id, redeemed_at AS redeemedAt, redeemed_order_id AS redeemedOrderId FROM referral_vouchers WHERE id = ?`).get(id) as VoucherRow;

/** Age a row so the expiry sweep can see it. No lib function ages an order. */
function ageOrder(orderId: string, days: number): void {
  db().prepare(`UPDATE orders SET created_at = datetime('now', ?) WHERE id = ?`).run(`-${days} days`, orderId);
}

// ---------------- A voucher is spendable exactly once ----------------

test('a referral voucher can be spent once, and the second buyer to try gets no order at all', () => {
  const { organizerId, event, tier, listing } = seller(2000);
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 1000);
  const before = ordersOn(event.id);
  const seatsBefore = getAvailability(event.id).tiers[tier.tierKey].remaining;

  // THE RACE, as the code would actually meet it. better-sqlite3 is
  // synchronous, so the thing to reproduce is not two threads but the
  // interleaving: two checkouts BOTH pass the preview (each browser was told
  // the code works), and only then does either of them try to spend it. The
  // claim lives inside createOrder's transaction precisely so the second one
  // fails closed rather than racing the first.
  assert.equal(previewDiscountCode(listing, voucher.code).code, voucher.code, 'checkout A was told yes');
  assert.equal(previewDiscountCode(listing, voucher.code).code, voucher.code, 'checkout B was told yes too');

  const winner = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: voucher.code });
  assert.throws(
    () => makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: voucher.code }),
    VoucherError,
    'the loser is refused'
  );

  assert.equal(winner.discountCents, 1000);
  assert.equal(winner.totalCents, 1000);
  assert.equal(ordersHolding(voucher.code), 1, 'exactly one order holds the code');
  // Fails CLOSED: the loser's whole order rolled back, seats included. An
  // order that existed at full price would have charged somebody who was told
  // their code applied.
  assert.equal(ordersOn(event.id), before + 1, "the loser's order does not exist");
  assert.equal(
    getAvailability(event.id).tiers[tier.tierKey].remaining,
    seatsBefore - 1,
    'the loser reserved no seats either'
  );
  assert.equal(voucherById(voucher.id).redeemedOrderId, winner.id, 'the voucher names the order that won');
});

test('a spent voucher is refused at the checkout preview too, not only at the claim', () => {
  const { organizerId, event, tier, listing } = seller(2000);
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 1000);
  makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: voucher.code });

  // One refusal for every reason, so an unauthenticated guesser learns nothing
  // about whether the code is real or whose it is.
  assert.throws(() => previewDiscountCode(listing, voucher.code), (e: unknown) => {
    assert.ok(e instanceof VoucherError);
    assert.equal(e.message, CODE_NOT_USABLE);
    return true;
  });
});

// ---------------- A promo's cap is a cap ----------------

test('a promo code is redeemed at most max_redemptions times, however many buyers race for the last one', () => {
  const { organizerId, event, tier, listing } = seller(2000);
  const promo = makePromo(organizerId, { code: 'LASTTWO24', kind: 'fixed', percent: 0, amountCents: 500, maxRedemptions: 2 });
  const before = ordersOn(event.id);

  // Three checkouts all previewed successfully while two redemptions were
  // free — the state every one of them would have been shown.
  for (let i = 0; i < 3; i++) assert.equal(previewDiscountCode(listing, 'LASTTWO24').source, 'promo');

  makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'LASTTWO24' });
  makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'LASTTWO24' });
  assert.throws(
    () => makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'LASTTWO24' }),
    VoucherError,
    'the third is refused'
  );

  const after = getPromoCode(organizerId, promo.id)!;
  assert.equal(after.redeemedCount, 2, 'the counter stopped at the cap');
  assert.ok(after.redeemedCount <= after.maxRedemptions, 'and can never be above it');
  assert.equal(ordersOn(event.id), before + 2, 'the refused order does not exist');
  assert.equal(ordersHolding('LASTTWO24'), 2);
});

test('a deactivated or expired promo is refused even though its cap is nowhere near', () => {
  const { organizerId, event, tier, listing } = seller(2000);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  // Minted with a valid date, then aged: validatePromoInput refuses a past
  // expiry at MINTING, but a live code has to stop working once the day passes.
  const promo = makePromo(organizerId, { code: 'EXPIRED24', kind: 'percent', percent: 10 });
  db().prepare(`UPDATE promo_codes SET expires_on = ? WHERE id = ?`).run(yesterday, promo.id);

  assert.throws(() => previewDiscountCode(listing, 'EXPIRED24'), VoucherError);
  assert.throws(
    () => makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'EXPIRED24' }),
    VoucherError
  );
  assert.equal(getPromoCode(organizerId, promo.id)!.redeemedCount, 0, 'nothing was counted against it');
});

// ---------------- The preview and the charge agree ----------------

test('the discount a buyer is shown at checkout is the discount the order records — percentages', () => {
  const { organizerId, event, tier, listing } = seller(333);
  makePromo(organizerId, { code: 'DASHAIN10', kind: 'percent', percent: 10 });

  // Quantities picked so the arithmetic rounds: 33.3, 66.6, 99.9, 233.1 cents.
  // Rounding is the whole reason this test exists — a second implementation
  // anywhere is how a page promises one number and the order records another.
  for (const [quantity, expected] of [[1, 34], [2, 67], [3, 100], [7, 234]] as const) {
    const subtotal = 333 * quantity;
    const preview = previewDiscountCode(listing, 'dashain 10'); // typed as a human would
    const shown = discountCentsFor(preview, subtotal);
    assert.equal(shown, expected, `${subtotal} cents at 10% is ${expected}, rounded the buyer's way`);

    const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity }], voucherCode: 'DASHAIN10' });
    assert.equal(order.discountCents, shown, 'the order charged what the checkout promised');
    assert.equal(order.totalCents, subtotal - shown);
  }
});

test('the discount a buyer is shown at checkout is the discount the order records — flat amounts', () => {
  const { organizerId, event, tier, listing } = seller(333);
  makePromo(organizerId, { code: 'FIVEOFF24', kind: 'fixed', percent: 0, amountCents: 500 });

  for (const [quantity, expected] of [[1, 333], [2, 500], [5, 500]] as const) {
    const subtotal = 333 * quantity;
    const shown = discountCentsFor(previewDiscountCode(listing, 'FIVEOFF24'), subtotal);
    assert.equal(shown, expected, 'a flat 5.00, capped at what the basket is worth');
    const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity }], voucherCode: 'FIVEOFF24' });
    assert.equal(order.discountCents, shown);
    assert.equal(order.totalCents, subtotal - shown);
  }
});

test('a referral voucher previews and charges the same too, though it is not a promo at all', () => {
  const { organizerId, event, tier, listing } = seller(333);
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 500);

  const preview = previewDiscountCode(listing, voucher.code);
  assert.equal(preview.source, 'voucher');
  assert.equal(preview.kind, 'fixed', 'a voucher is a flat amount, whatever the copy calls it');
  const shown = discountCentsFor(preview, 666);
  const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 2 }], voucherCode: voucher.code });
  assert.equal(shown, 500);
  assert.equal(order.discountCents, shown, 'both kinds of code go through one arithmetic');
  assert.equal(order.totalCents, 166);
});

// ---------------- A discount never exceeds the basket, and never goes negative ----------------

test('no discount can be larger than the basket, and no total can go below zero', () => {
  const { organizerId, event, tier, listing } = seller(1000);
  // Every way a code can be worth more than what is in front of it: a flat
  // amount well over the basket, and the full hundred percent.
  makePromo(organizerId, { code: 'HUGE-500', kind: 'fixed', percent: 0, amountCents: 50_000 });
  makePromo(organizerId, { code: 'ALLOFIT24', kind: 'percent', percent: 100 });
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 50_000);

  for (const code of ['HUGE-500', 'ALLOFIT24', voucher.code]) {
    const subtotal = 1000;
    assert.equal(discountCentsFor(previewDiscountCode(listing, code), subtotal), subtotal, `${code}: capped at the basket`);
    const order = makeOrder({
      eventId: event.id,
      items: [{ tierId: tier.tierKey, quantity: 1 }],
      voucherCode: code,
      paymentMode: 'free', // it costs nothing; see the free-order rule below
    });
    assert.equal(order.discountCents, subtotal, `${code}: the discount stopped at the basket`);
    assert.equal(order.totalCents, 0, `${code}: covered, never overpaid`);
    assert.ok(order.totalCents >= 0, `${code}: a total is never negative`);
    assert.equal(order.totalCents, subtotal - order.discountCents, `${code}: the three numbers agree`);
  }
});

test('a code is refused on a basket worth nothing rather than spent for 0.00', () => {
  // A mixed listing can put a free tier next to a paid one, so this is a
  // basket a buyer reaches by changing their mind — and burning a whole
  // reward on it would be irreversible, on an order that settles instantly.
  const { organizerId, event, tier } = seller(1000);
  const rsvp = makeTier(event.id, { tierKey: 'rsvp', priceCents: 0, cap: 50 }, 1);
  makePromo(organizerId, { code: 'FIVEOFF24', kind: 'fixed', percent: 0, amountCents: 500 });
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 1000);

  assert.throws(
    () => makeOrder({ eventId: event.id, items: [{ tierId: rsvp.tierKey, quantity: 2 }], voucherCode: 'FIVEOFF24', paymentMode: 'free' }),
    (e: unknown) => {
      assert.ok(e instanceof VoucherError);
      assert.equal(e.message, PROMO_NOTHING_TO_DISCOUNT);
      return true;
    }
  );
  assert.throws(
    () => makeOrder({ eventId: event.id, items: [{ tierId: rsvp.tierKey, quantity: 2 }], voucherCode: voucher.code, paymentMode: 'free' }),
    (e: unknown) => {
      assert.ok(e instanceof VoucherError);
      assert.equal(e.message, VOUCHER_NOTHING_TO_DISCOUNT);
      return true;
    }
  );
  assert.equal(voucherById(voucher.id).redeemedAt, null, 'the voucher is still the buyer’s');
});

/** The paid tier a `seller()` listing was built with. */
function getPaidTierKey(eventId: string): string {
  const row = db()
    .prepare(`SELECT tier_key AS k FROM event_tiers WHERE event_id = ? AND price_cents > 0 ORDER BY sort LIMIT 1`)
    .get(eventId) as { k: string };
  return row.k;
}

// ---------------- A fully-discounted order is free, not a 0.00 transfer ----------------

test('a code that covers the whole basket makes the order FREE — nobody is asked to transfer 0.00', () => {
  const { organizerId, event, tier, listing } = seller(2500);
  makePromo(organizerId, { code: 'ONTHEHOUSE', kind: 'percent', percent: 100 });

  // The decision itself, made by the same two real functions the checkout
  // route makes it with: preview the code, apply lib/money's arithmetic, and
  // what is left is what the buyer owes. Zero owed is an RSVP.
  const subtotal = 2500;
  const payable = Math.max(0, subtotal - discountCentsFor(previewDiscountCode(listing, 'ONTHEHOUSE'), subtotal));
  assert.equal(payable, 0, 'nothing is owed');
  const mode: PaymentMethod = payable === 0 ? 'free' : 'transfer';
  assert.equal(mode, 'free', 'so this is an RSVP, not a bank transfer');

  const order = createOrder({
    eventId: event.id,
    buyerName: 'Free Buyer',
    buyerEmail: 'free-buyer@example.test',
    voucherCode: 'ONTHEHOUSE',
    items: [{ tierId: tier.tierKey, quantity: 1 }],
    paymentMode: mode,
  });
  assert.equal(order.totalCents, 0);
  assert.equal(order.paymentMode, 'free');
  assert.notEqual(order.paymentMode, 'transfer', 'a 0.00 bank transfer is not a thing to ask anybody for');
  assert.equal(order.status, 'claimed', 'a free order reserves its seats immediately');

  // And it settles in the same breath, with real tickets — an RSVP does not
  // sit waiting for money that will never arrive.
  const tickets = finalizePaidOrder(order.id, null);
  assert.equal(tickets.length, 1);
  assert.equal(getOrder(order.id)!.status, 'paid');
  assert.equal(getOrder(order.id)!.totalCents, 0);
});

// ---------------- Release: give back exactly one, exactly once ----------------

test('a cancelled order gives its promo redemption back, and repeating the release gives back no more', () => {
  const { organizerId, event, tier } = seller(2000);
  const promo = makePromo(organizerId, { code: 'ONLYONE24', kind: 'fixed', percent: 0, amountCents: 500, maxRedemptions: 1 });
  const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'ONLYONE24' });
  assert.equal(getPromoCode(organizerId, promo.id)!.redeemedCount, 1);

  markOrderFailed(order.id, 'cancelled');
  assert.equal(getPromoCode(organizerId, promo.id)!.redeemedCount, 0, 'the seller did not silently give away one fewer discount');

  // Idempotent BY CONSTRUCTION: the counter and the order's own record of the
  // code are cleared together, so a second call finds nothing to credit. Three
  // calls used to credit three redemptions back for one order.
  releaseDiscountCodeForOrder(order.id);
  releaseDiscountCodeForOrder(order.id);
  markOrderFailed(order.id, 'cancelled');
  assert.equal(getPromoCode(organizerId, promo.id)!.redeemedCount, 0, 'still zero — never negative, never a free extra redemption');

  // And the cap still means one: the next buyer gets it, the one after does not.
  const next = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'ONLYONE24' });
  assert.equal(next.discountCents, 500);
  assert.equal(getPromoCode(organizerId, promo.id)!.redeemedCount, 1);
  assert.throws(
    () => makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'ONLYONE24' }),
    VoucherError
  );
});

test('a cancelled order gives its referral voucher back, and repeating the release does not mint a second one', () => {
  const { organizerId, event, tier } = seller(2000);
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 1000);
  const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: voucher.code });
  assert.equal(voucherById(voucher.id).redeemedOrderId, order.id);

  markOrderFailed(order.id, 'cancelled');
  const back = voucherById(voucher.id);
  assert.equal(back.redeemedAt, null, 'somebody who changed their mind did not lose the thank-you they earned');
  assert.equal(back.redeemedOrderId, null);

  releaseDiscountCodeForOrder(order.id);
  releaseDiscountCodeForOrder(order.id);
  assert.equal(voucherById(voucher.id).redeemedAt, null, 'still exactly one voucher, still unspent');
  assert.equal(
    (db().prepare(`SELECT COUNT(*) AS n FROM referral_vouchers WHERE organizer_id = ?`).get(organizerId) as { n: number }).n,
    1,
    'releasing never creates a voucher'
  );

  // It really works again — the point of handing it back.
  const again = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: voucher.code });
  assert.equal(again.discountCents, 1000);
});

test('a released order is back at its full list price, holding no code', () => {
  // Not cosmetic: an order still showing a discounted total while its code is
  // free again is exactly how one discount comes to pay for two orders — the
  // organizer confirms a late transfer against a number that is no longer true.
  const { organizerId, event, tier } = seller(2000);
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 1000);
  makePromo(organizerId, { code: 'TENOFF-NOW', kind: 'fixed', percent: 0, amountCents: 1000 });

  for (const code of [voucher.code, 'TENOFF-NOW']) {
    const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 3 }], voucherCode: code });
    assert.equal(order.totalCents, 5000, `${code}: 60.00 less 10.00`);
    assert.equal(order.discountCents, 1000);

    markOrderFailed(order.id, 'cancelled');
    const after = getOrder(order.id)!;
    assert.equal(after.voucherCode, '', `${code}: the order no longer names a code`);
    assert.equal(after.discountCents, 0, `${code}: and claims no discount`);
    assert.equal(after.totalCents, 6000, `${code}: back to the items total it was quoted from`);
  }
});

test('an expired reservation returns its code — the sweep releases, not just cancels', () => {
  const { organizerId, event, tier } = seller(2000);
  const promo = makePromo(organizerId, { code: 'EARLYBIRD', kind: 'fixed', percent: 0, amountCents: 500, maxRedemptions: 1 });
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 1000);

  const withPromo = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'EARLYBIRD', paymentMode: 'transfer' });
  const withVoucher = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: voucher.code, paymentMode: 'transfer' });
  assert.equal(withPromo.status, 'claimed');
  assert.equal(withVoucher.status, 'claimed');
  // The event's payWithinDays is 5, plus 2 grace days.
  ageOrder(withPromo.id, 30);
  ageOrder(withVoucher.id, 30);

  assert.equal(expireOverdueTransferReservations(event.id), 2, 'both reservations timed out');
  assert.equal(getPromoCode(organizerId, promo.id)!.redeemedCount, 0, "a promo's cap is not eaten by a booking nobody paid for");
  assert.equal(voucherById(voucher.id).redeemedAt, null, 'and the reward goes back to the person who earned it');
  assert.equal(getOrder(withPromo.id)!.totalCents, 2000, 'the expired order is back at its full price');
  assert.equal(getOrder(withVoucher.id)!.totalCents, 2000);
});

test('a deleted order takes no code with it — cleanup and the test-order purge both release first', () => {
  const { organizerId, event, tier } = seller(2000);
  const promo = makePromo(organizerId, { code: 'SPONSOR24', kind: 'fixed', percent: 0, amountCents: 500, maxRedemptions: 1 });
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 1000);

  // An abandoned PayPal checkout that never reached PayPal: deleted outright.
  const abandoned = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'SPONSOR24', paymentMode: 'paypal' });
  ageOrder(abandoned.id, 3);
  assert.equal(cleanupOldPendingOrders(1), 1);
  assert.equal(getOrder(abandoned.id), null, 'the row is gone');
  assert.equal(getPromoCode(organizerId, promo.id)!.redeemedCount, 0, 'and it did not take a redemption with it');

  // A test-mode order, deleted by the go-live purge. This one really is paid —
  // the one paid order whose code still has to come back, because the row that
  // recorded the redemption is about to stop existing.
  const mock = makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: voucher.code, paymentMode: 'mock' });
  assert.equal(mock.order.discountCents, 1000);
  assert.equal(voucherById(voucher.id).redeemedAt !== null, true, 'precondition: the test order spent it');
  purgeMockOrders();
  assert.equal(getOrder(mock.order.id), null);
  assert.equal(voucherById(voucher.id).redeemedAt, null, 'a purged test order must not burn a real voucher');
});

test('releasing one order gives back one redemption — it cannot eat another order’s', () => {
  // The exact shape of a bug this code carries a comment about: a paid TEST
  // order used to slip past the guard on the clearing UPDATE, so every extra
  // call decremented again — and once the counter was shared with a second
  // order, those extra decrements were spending somebody else's redemption.
  // Two orders make that visible; one order only ever hides it behind the
  // "never below zero" floor.
  const { organizerId, event, tier } = seller(2000);
  const promo = makePromo(organizerId, { code: 'SHARED-240', kind: 'fixed', percent: 0, amountCents: 500, maxRedemptions: 5 });
  const a = makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'SHARED-240', paymentMode: 'mock' });
  const b = makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'SHARED-240', paymentMode: 'mock' });
  assert.equal(getPromoCode(organizerId, promo.id)!.redeemedCount, 2);

  releaseDiscountCodeForOrder(a.order.id);
  releaseDiscountCodeForOrder(a.order.id);
  releaseDiscountCodeForOrder(a.order.id);

  assert.equal(getPromoCode(organizerId, promo.id)!.redeemedCount, 1, 'exactly one redemption came back, not three');
  assert.equal(getOrder(a.order.id)!.voucherCode, '', 'the released order names no code');
  assert.equal(getOrder(b.order.id)!.voucherCode, 'SHARED-240', 'and the other order still holds its own');
  assert.equal(getOrder(b.order.id)!.discountCents, 500);
});

// ---------------- Confirmed late: one code, one discount ----------------

test('a transfer that turns up after the reservation expired is confirmed at FULL price, not discounted twice', () => {
  // The sequence that would otherwise honour one code on two orders: A reserves
  // with a code, A times out (the code goes back), B spends the code, and only
  // then does A's transfer land on the organizer's statement. A is a real
  // payment and must become tickets — at what A is actually worth.
  const { organizerId, event, tier } = seller(2000);
  const promo = makePromo(organizerId, { code: 'ONLYONE24', kind: 'fixed', percent: 0, amountCents: 500, maxRedemptions: 1 });
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 1000);

  const late = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: voucher.code, paymentMode: 'transfer' });
  const latePromo = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'ONLYONE24', paymentMode: 'transfer' });
  ageOrder(late.id, 30);
  ageOrder(latePromo.id, 30);
  expireOverdueTransferReservations(event.id);

  // Somebody else takes both codes in the meantime.
  const otherVoucher = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: voucher.code });
  const otherPromo = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: 'ONLYONE24' });

  markTransferOrderPaid(late.id);
  markTransferOrderPaid(latePromo.id);

  for (const id of [late.id, latePromo.id]) {
    const confirmed = getOrder(id)!;
    assert.equal(confirmed.status, 'paid', 'the money arrived, so the tickets are minted');
    assert.equal(confirmed.discountCents, 0, 'but the code is somebody else’s now');
    assert.equal(confirmed.voucherCode, '');
    assert.equal(confirmed.totalCents, 2000, 'confirmed at its full list price');
  }
  assert.equal(otherVoucher.discountCents, 1000, 'the buyer who actually holds the voucher keeps it');
  assert.equal(otherPromo.discountCents, 500);
  assert.equal(voucherById(voucher.id).redeemedOrderId, otherVoucher.id, 'one voucher, one order');
  assert.equal(getPromoCode(organizerId, promo.id)!.redeemedCount, 1, 'and the cap of one still means one');
});

test('an order still naming a code whose voucher has since been spent is confirmed at full price, not honoured twice', () => {
  // markTransferOrderPaid's reclaim block exists for orders that were
  // cancelled BEFORE releasing took the discount off in the same breath —
  // "This runs for the orders that still hold one", as it says. No lib
  // function produces that row any more, so the raw UPDATE below reconstructs
  // it: this is the one state the conditional re-claim is the only guard for.
  const { organizerId, event, tier } = seller(2000);
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 1000);

  const stranded = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: voucher.code, paymentMode: 'transfer' });
  assert.equal(stranded.totalCents, 1000);
  db().prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).run(stranded.id); // cancelled, code still on it
  // …and the voucher itself found its way back to the buyer, who spent it.
  db().prepare(`UPDATE referral_vouchers SET redeemed_at = NULL, redeemed_order_id = NULL WHERE id = ?`).run(voucher.id);
  const elsewhere = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: voucher.code });

  markTransferOrderPaid(stranded.id);

  const confirmed = getOrder(stranded.id)!;
  assert.equal(confirmed.status, 'paid', 'the transfer was real, so it becomes tickets');
  assert.equal(confirmed.discountCents, 0, 'the code could not be re-claimed, so it comes off');
  assert.equal(confirmed.voucherCode, '');
  assert.equal(confirmed.totalCents, 2000, 'what the organizer sees is an ordinary underpayment, not a second discount');
  assert.equal(voucherById(voucher.id).redeemedOrderId, elsewhere.id, 'the voucher stays with the order that really spent it');
});

/**
 * FAILING ON PURPOSE — this is a real defect in src/lib/referrals.ts, not a
 * disagreement about what the test should expect.
 *
 * releaseVoucherForOrder's own contract says it: "a PAID order's voucher is
 * never touched here, because that one really was spent." Its promo twin,
 * releasePromoForOrder, enforces exactly that — `if (order.status === 'paid'
 * && order.paymentMode !== 'mock') return;` — and the test-order exception is
 * spelled out in both comments. The voucher half has no such guard: its
 * `UPDATE referral_vouchers SET redeemed_at = NULL WHERE redeemed_order_id = ?`
 * runs on any order at all.
 *
 * So calling the codebase's ONE release entry point on a paid, non-test order
 * un-spends the voucher while the order keeps its discount: the seller has
 * honoured 10.00 and the buyer is holding a working 10.00 code. The order's
 * own row is left correct (that UPDATE *is* guarded by `status != 'paid'`),
 * which is what makes the state unrecoverable rather than merely wrong — the
 * paid order still names the code, so nothing downstream can tell the reward
 * was handed back.
 *
 * No caller reaches it today (markOrderFailed, the expiry sweep and the
 * pending cleanup all filter on unpaid statuses first), so this is a loaded
 * gun rather than a fire: the guard the promo half needed is missing from the
 * half that gives away real money, and the next release path added — a refund,
 * a chargeback, an organizer un-confirming a transfer — walks straight into it.
 *
 * The fix is in src/lib/referrals.ts: give the voucher UPDATE the same
 * paid-and-not-mock guard the order UPDATE beneath it already has.
 */
test('releasing a PAID order does NOT hand its voucher back — that one really was spent', () => {
  const { organizerId, event, tier } = seller(2000);
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 1000);
  const { order } = makePaidOrder({
    eventId: event.id,
    items: [{ tierId: tier.tierKey, quantity: 1 }],
    voucherCode: voucher.code,
    paymentMode: 'transfer',
  });
  assert.equal(order.status, 'paid');
  assert.equal(order.discountCents, 1000, 'the seller really granted this discount');

  releaseDiscountCodeForOrder(order.id);

  const after = voucherById(voucher.id);
  assert.equal(after.redeemedAt !== null, true, 'a paid order keeps its voucher spent');
  assert.equal(after.redeemedOrderId, order.id, 'and the voucher still names the order that spent it');
  // The consequence, stated outright: one reward, two discounts.
  assert.throws(
    () => makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }], voucherCode: voucher.code }),
    VoucherError,
    'a voucher already honoured on a paid order cannot be spent a second time'
  );
});

// ---------------- The namespace rule: one typed code, one kind ----------------

test('a promo code and a referral voucher can never be the same code, however it is typed', () => {
  const { organizerId, event, tier } = seller(2000);
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 1000);
  const body = voucher.code.slice('THANKS-'.length);

  // Every spelling that normalises to this voucher has to be refused at
  // MINTING — that is what makes "one typed code means one kind of code" a
  // property of the data rather than of a lookup order somewhere.
  for (const spelling of [voucher.code, body, body.toLowerCase(), `thanks-${body}`, `${body.slice(0, 4)}-${body.slice(4)}`]) {
    assert.notEqual(normalizeVoucherCode(spelling), '', `precondition: ${spelling} reads as a voucher`);
    assert.throws(
      () =>
        createPromoCode(organizerId, {
          code: spelling,
          kind: 'percent',
          amountCents: 0,
          percent: 10,
          eventId: '',
          maxRedemptions: 0,
          expiresOn: '',
        }),
      PromoError,
      `${spelling} must not be mintable as a promo`
    );
  }
});

test('every code resolves to exactly one kind, and the two sets never overlap', () => {
  const { organizerId, event, tier, listing } = seller(2000);
  const voucher = mintVoucher(organizerId, event.id, tier.tierKey, 1000);
  const promos = ['DASHAIN10', 'EARLY-BIRD', 'SUMMER240'].map((code) => makePromo(organizerId, { code, kind: 'percent', percent: 10 }));

  for (const promo of promos) {
    assert.equal(normalizeVoucherCode(promo.code), '', `${promo.code} must not read as a voucher`);
    assert.equal(previewDiscountCode(listing, promo.code).source, 'promo');
  }
  assert.equal(previewDiscountCode(listing, voucher.code).source, 'voucher');
  // And no row of either kind shares a code with the other, in this database.
  const overlap = db()
    .prepare(
      `SELECT COUNT(*) AS n FROM promo_codes p JOIN referral_vouchers v
       ON v.organizer_id = p.organizer_id AND v.code = p.code`
    )
    .get() as { n: number };
  assert.equal(overlap.n, 0);
});

// ---------------- A code belongs to the seller who gave it out ----------------

test("one seller's promo code buys nothing at another seller's checkout", () => {
  const a = seller(2000);
  const b = seller(2000);
  makePromo(a.organizerId, { code: 'DASHAIN10', kind: 'percent', percent: 10 });
  const before = ordersOn(b.event.id);

  assert.throws(() => previewDiscountCode(b.listing, 'DASHAIN10'), (e: unknown) => {
    assert.ok(e instanceof VoucherError);
    assert.equal(e.message, CODE_NOT_USABLE, 'and the refusal says nothing about whose code it is');
    return true;
  });
  assert.throws(
    () => makeOrder({ eventId: b.event.id, items: [{ tierId: b.tier.tierKey, quantity: 1 }], voucherCode: 'DASHAIN10' }),
    VoucherError
  );
  assert.equal(ordersOn(b.event.id), before, 'no order was written at the stranger’s checkout');

  // It still works where it came from — the refusal is about the boundary,
  // not about the code being broken.
  const home = makeOrder({ eventId: a.event.id, items: [{ tierId: a.tier.tierKey, quantity: 1 }], voucherCode: 'DASHAIN10' });
  assert.equal(home.discountCents, 200);
});

test("one seller's referral voucher buys nothing at another seller's checkout, and is not spent trying", () => {
  const a = seller(2000);
  const b = seller(2000);
  const voucher = mintVoucher(a.organizerId, a.event.id, a.tier.tierKey, 1000);
  const before = ordersOn(b.event.id);

  assert.throws(() => previewDiscountCode(b.listing, voucher.code), VoucherError);
  assert.throws(
    () => makeOrder({ eventId: b.event.id, items: [{ tierId: b.tier.tierKey, quantity: 1 }], voucherCode: voucher.code }),
    VoucherError
  );
  assert.equal(ordersOn(b.event.id), before, 'nothing was written');
  assert.equal(voucherById(voucher.id).redeemedAt, null, 'and the reward was not burnt by the attempt');

  const home = makeOrder({ eventId: a.event.id, items: [{ tierId: a.tier.tierKey, quantity: 1 }], voucherCode: voucher.code });
  assert.equal(home.discountCents, 1000, 'it still works with the seller who gave it');
});

test('a promo scoped to one listing is refused on the same seller’s other listing', () => {
  const organizer = makeOrganizer();
  const scoped = makeEvent({ organizerId: organizer.id, tiers: [{ priceCents: 2000, cap: 50 }] });
  const other = makeEvent({ organizerId: organizer.id, tiers: [{ priceCents: 2000, cap: 50 }] });
  const scopedTier = getPaidTierKey(scoped.id);
  const otherTier = getPaidTierKey(other.id);
  const promo = makePromo(organizer.id, { code: 'THISONE24', kind: 'percent', percent: 10, eventId: scoped.id });

  assert.equal(previewDiscountCode({ id: scoped.id, organizerId: organizer.id }, 'THISONE24').source, 'promo');
  assert.throws(() => previewDiscountCode({ id: other.id, organizerId: organizer.id }, 'THISONE24'), VoucherError);
  assert.throws(
    () => makeOrder({ eventId: other.id, items: [{ tierId: otherTier, quantity: 1 }], voucherCode: 'THISONE24' }),
    VoucherError
  );
  assert.equal(getPromoCode(organizer.id, promo.id)!.redeemedCount, 0, 'the refused listing counted nothing');

  const ok = makeOrder({ eventId: scoped.id, items: [{ tierId: scopedTier, quantity: 1 }], voucherCode: 'THISONE24' });
  assert.equal(ok.discountCents, 200);
  assert.equal(getPromoCode(organizer.id, promo.id)!.redeemedCount, 1);
});
