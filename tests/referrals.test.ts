/**
 * lib/referrals.ts — who has earned a thank-you, and what it is worth.
 *
 * This module decides, with real money, three things:
 *
 *   1. WHICH bookings count as a referral somebody was actually paid for;
 *   2. WHO a share code belongs to, and how far that ownership reaches;
 *   3. HOW MANY vouchers that person should be holding right now — a number
 *      that is DERIVED from (1) and (2) every time the hook fires, never
 *      incremented.
 *
 * Because the third is derived, every test here that asserts a voucher count
 * is also asserting the first two. And because a voucher is a real discount on
 * a real organizer's real prices, each of the rules below is a promise made to
 * a person: getting one wrong either mints money out of nothing or quietly
 * takes away a reward somebody earned.
 *
 * The counts, the buyer's progress reader and the issuing side are driven from
 * the SAME fixtures throughout and asserted equal, because the one failure
 * nobody would notice is the three of them drifting apart.
 */
// Set before the orders route reads it (getPaymentMode() reads env at call
// time). The self-referral guard lives in that route, and a deterministic
// payment mode keeps the one test that drives it from depending on whether
// PayPal credentials happen to be present in the shell.
process.env.PAYMENT_MODE = 'transfer';

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import Database from 'better-sqlite3';

import { topReferrers } from '../src/lib/analytics.ts';
import { getEventTiers } from '../src/lib/events.ts';
import { getAvailability } from '../src/lib/inventory.ts';
import { getOrder, getPaidOrderByReferralCode, type OrderRow } from '../src/lib/orders.ts';
import { previewDiscountCode } from '../src/lib/promos.ts';
import {
  awardReferralVouchers,
  claimVoucherForOrder,
  countPaidReferrals,
  countsAsPaidReferral,
  getReferralRewardSettings,
  listUnredeemedVouchers,
  normalizeVoucherCode,
  referralProgressFor,
  referralRewardsReachable,
  referrerEmailForCode,
  requireRedeemableVoucher,
  setReferralRewardSettings,
  validateReferralRewardSettings,
  VoucherError,
  voucherTotalsForOrganizer,
} from '../src/lib/referrals.ts';
import { ERASED_BUYER_EMAIL, runBuyerDataRetentionSweep } from '../src/lib/retention.ts';
import {
  db,
  makeEvent,
  makeEventWithTier,
  makeOrder,
  makeOrganizer,
  makePaidOrder,
  makePromo,
} from './helpers.ts';

// ---------------- Local fixtures ----------------

/** A published listing with one 50.00 ticket, on a brand-new organizer. */
function world(over: { eventDate?: string | null; priceCents?: number } = {}) {
  const organizer = makeOrganizer();
  const { event, tier } = makeEventWithTier(
    { organizerId: organizer.id, eventDate: over.eventDate ?? null },
    { priceCents: over.priceCents ?? 5000 }
  );
  return { organizerId: organizer.id, event, tierId: tier.tierKey };
}

/** One booking, paid for in full, by `email`. Its shareCode is the referral link. */
function books(
  eventId: string,
  tierId: string,
  email: string,
  over: { referredBy?: string; voucherCode?: string; paymentMode?: 'transfer' | 'mock' | 'free' } = {}
): OrderRow {
  return makePaidOrder({
    eventId,
    items: [{ tierId, quantity: 1 }],
    buyerEmail: email,
    referredBy: over.referredBy,
    voucherCode: over.voucherCode,
    paymentMode: over.paymentMode ?? 'transfer',
  }).order;
}

/**
 * Move an order's clock backwards.
 *
 * Raw SQL, deliberately: SQLite's datetime('now') has ONE-SECOND resolution,
 * so a booking made and a promise made in the same test tick carry the same
 * timestamp — and "before the promise" and "after the promise" collapse into
 * one instant. Every since-clock rule below is about a strict before/after, so
 * the fixtures have to be genuinely older than the promise. Nothing else about
 * the row is touched, and no rule is simulated: the real queries then read the
 * real columns.
 */
function ageOrder(orderId: string, modifier: string): void {
  db()
    .prepare(`UPDATE orders SET created_at = datetime('now', ?), paid_at = datetime('now', ?) WHERE id = ?`)
    .run(modifier, modifier, orderId);
}

/** The same one-second problem, applied to the organizer's reward clock. */
function ageRewardClock(organizerId: string, modifier: string): void {
  db()
    .prepare(`UPDATE organizers SET referral_rewards_since = datetime('now', ?) WHERE id = ?`)
    .run(modifier, organizerId);
}

/** And to vouchers already earned, which the issuing side windows the same way. */
function ageVouchers(organizerId: string, email: string, modifier: string): void {
  db()
    .prepare(
      `UPDATE referral_vouchers SET earned_at = datetime('now', ?)
       WHERE organizer_id = ? AND lower(referrer_email) = ?`
    )
    .run(modifier, organizerId, email);
}

/** How many vouchers this person holds unspent with this organizer. */
function held(organizerId: string, email: string): number {
  return listUnredeemedVouchers(organizerId, email).length;
}

// =================================================================
// 1. What counts as a referral somebody was actually PAID for
// =================================================================

test('a confirmed, fully paid booking that arrived through a link is a referral', () => {
  const w = world();
  const alice = books(w.event.id, w.tierId, 'alice@example.test');
  const bob = books(w.event.id, w.tierId, 'bob@example.test', { referredBy: alice.shareCode });

  assert.equal(countPaidReferrals(w.organizerId, 'alice@example.test'), 1);
  assert.equal(countsAsPaidReferral(bob), true, 'the TypeScript rule must agree with the SQL one');
});

test('a reservation is a promise, not a booking — an unpaid order refers nobody', () => {
  const w = world();
  const alice = books(w.event.id, w.tierId, 'alice2@example.test');
  // A real transfer reservation: seats held, money still in transit.
  const pending = makeOrder({
    eventId: w.event.id,
    items: [{ tierId: w.tierId, quantity: 1 }],
    buyerEmail: 'notyet@example.test',
    referredBy: alice.shareCode,
  });

  assert.notEqual(pending.status, 'paid');
  assert.equal(countsAsPaidReferral(getOrder(pending.id)!), false);
  assert.equal(countPaidReferrals(w.organizerId, 'alice2@example.test'), 0);
});

test('a test-mode booking is not a real booking, and earns nobody a referral', () => {
  const w = world();
  const alice = books(w.event.id, w.tierId, 'alice3@example.test');
  const mock = books(w.event.id, w.tierId, 'mock@example.test', {
    referredBy: alice.shareCode,
    paymentMode: 'mock',
  });

  assert.equal(mock.status, 'paid', 'the fixture really did finalize — this is not an unpaid order in disguise');
  assert.equal(countsAsPaidReferral(mock), false);
  assert.equal(countPaidReferrals(w.organizerId, 'alice3@example.test'), 0);
});

test('a free RSVP is a real referral for insights, but was never PAID for, so it earns nothing', () => {
  // The two rules this module exports are deliberately different widths, and
  // this is the case that separates them. Both are driven here, over one set of
  // rows, so a change that collapsed them into one would fail.
  const w = world({ priceCents: 0 });
  const alice = books(w.event.id, w.tierId, 'alice4@example.test', { paymentMode: 'free' });
  const rsvp = books(w.event.id, w.tierId, 'guest@example.test', {
    referredBy: alice.shareCode,
    paymentMode: 'free',
  });

  assert.equal(rsvp.totalCents, 0);
  // The WIDER rule (confirmedReferralSql, via Insights): this happened.
  const chain = topReferrers(w.event.id);
  assert.equal(chain.referrers.length, 1, 'Insights must still show who brought whom on a free listing');
  assert.equal(chain.referrers[0].referredOrders, 1);
  // The NARROWER rule (paidReferralSql): nobody paid, so nobody earned.
  assert.equal(countsAsPaidReferral(rsvp), false);
  assert.equal(countPaidReferrals(w.organizerId, 'alice4@example.test'), 0);
});

test('a booking a voucher part-paid never funds the next voucher', () => {
  // "A voucher cannot breed the next one." Two addresses trading a 40.00
  // voucher against a 50.00 ticket would otherwise pay 10.00 each time, count
  // the order, earn the next voucher, and run that loop forever.
  const w = world();
  setReferralRewardSettings(w.organizerId, 1, 4000); // 1 referral = 40.00, so vouchers are easy to come by
  const alice = books(w.event.id, w.tierId, 'alice5@example.test');
  const bob = books(w.event.id, w.tierId, 'bob5@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(bob.id);

  const voucher = listUnredeemedVouchers(w.organizerId, 'alice5@example.test')[0];
  assert.ok(voucher, 'the fixture needs a real earned voucher to spend');
  assert.equal(countPaidReferrals(w.organizerId, 'alice5@example.test'), 1);

  // Carol books through Alice's link AND pays with the voucher Alice earned.
  const carol = books(w.event.id, w.tierId, 'carol5@example.test', {
    referredBy: alice.shareCode,
    voucherCode: voucher.code,
  });
  assert.equal(carol.discountCents, 4000, 'the voucher really was spent on this order');
  assert.equal(countsAsPaidReferral(carol), false);
  assert.equal(countPaidReferrals(w.organizerId, 'alice5@example.test'), 1, 'the loop must not close');

  awardReferralVouchers(carol.id);
  // Counted as EARNED, not as held: Carol has just spent the first voucher, so
  // "unredeemed" would read 0 whether or not a second one was minted.
  assert.equal(
    voucherTotalsForOrganizer(w.organizerId).earned,
    1,
    'no second voucher may be minted by the first'
  );
});

test("a booking the organizer's own promo code part-paid earns nothing either", () => {
  // Same column, same test, by construction: an organizer handing out a
  // 90%-off code has not thereby built a voucher machine.
  const w = world();
  setReferralRewardSettings(w.organizerId, 1, 1000);
  const promo = makePromo(w.organizerId, { kind: 'percent', percent: 90 });
  const alice = books(w.event.id, w.tierId, 'alice6@example.test');
  const dan = books(w.event.id, w.tierId, 'dan6@example.test', {
    referredBy: alice.shareCode,
    voucherCode: promo.code,
  });

  assert.equal(dan.discountCents, 4500, 'the promo really was applied');
  assert.equal(dan.totalCents, 500);
  assert.equal(countsAsPaidReferral(dan), false);
  assert.equal(countPaidReferrals(w.organizerId, 'alice6@example.test'), 0);
  awardReferralVouchers(dan.id);
  assert.equal(held(w.organizerId, 'alice6@example.test'), 0);
});

test('countsAsPaidReferral and the SQL count agree, row for row', () => {
  // The two spellings of one rule. They are used by different callers (a row
  // already in hand vs. a tally over the table), and the day they disagree is
  // the day the progress a buyer reads stops matching what they are issued.
  const w = world();
  const alice = books(w.event.id, w.tierId, 'alice7@example.test');
  const ref = alice.shareCode;
  const promo = makePromo(w.organizerId, { kind: 'fixed', amountCents: 1000, percent: 0 });

  const rows: OrderRow[] = [
    books(w.event.id, w.tierId, 'p1@example.test', { referredBy: ref }),
    books(w.event.id, w.tierId, 'p2@example.test', { referredBy: ref }),
    books(w.event.id, w.tierId, 'm1@example.test', { referredBy: ref, paymentMode: 'mock' }),
    books(w.event.id, w.tierId, 'c1@example.test', { referredBy: ref, voucherCode: promo.code }),
    getOrder(
      makeOrder({
        eventId: w.event.id,
        items: [{ tierId: w.tierId, quantity: 1 }],
        buyerEmail: 'u1@example.test',
        referredBy: ref,
      }).id
    )!,
  ];

  const byHandRule = rows.filter((o) => countsAsPaidReferral(o)).length;
  assert.equal(byHandRule, 2, 'two of these five are genuinely paid, unreferred-by-a-code bookings');
  assert.equal(countPaidReferrals(w.organizerId, 'alice7@example.test'), byHandRule);
});

// =================================================================
// 2. Where the offer may be advertised at all
// =================================================================

test('a listing where a buyer cannot spend money never advertises a thank-you', () => {
  const w = world({ priceCents: 0 });
  assert.equal(referralRewardsReachable(getEventTiers(w.event.id)), false);
});

test('a hidden paid ticket type does not make the offer reachable', () => {
  // A hidden tier is not on the page and cannot be put in a basket — it is
  // often last season's paid ticket kept for next time. Counting it made free
  // RSVP listings advertise a reward no booking on them could ever earn.
  const event = makeEvent({
    tiers: [
      { name: 'RSVP', priceCents: 0 },
      { name: 'Last season’s ticket', priceCents: 5000, status: 'hidden' },
    ],
  });

  const tiers = getEventTiers(event.id);
  assert.equal(tiers.length, 2, 'the fixture really does have both tiers');
  assert.equal(referralRewardsReachable(tiers), false);
});

test('an announced (coming soon) paid ticket type DOES make the offer reachable', () => {
  // Blinking the offer out until the early bird opens would take it away
  // precisely while people are sharing the page.
  const w = world();
  db().prepare(`UPDATE event_tiers SET status = 'coming-soon' WHERE event_id = ?`).run(w.event.id);
  assert.equal(referralRewardsReachable(getEventTiers(w.event.id)), true);
});

// =================================================================
// 3. Self-referral
// =================================================================

/**
 * The checkout, driven for real.
 *
 * The self-referral rule is enforced in POST /api/orders — it is the only
 * layer that knows WHO is buying, and lib/createOrder documents that it trusts
 * its caller to have made this check. So this one test reaches for the route
 * rather than restating the rule against a fixture the route would never
 * produce. Distinct x-forwarded-for values per call because the endpoint is
 * rate limited per IP, which is not what is under test here.
 */
async function checkout(body: Record<string, unknown>, ip: string) {
  const { POST } = await import('../src/app/api/orders/route.ts');
  const res = await POST(
    new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

test('a buyer cannot refer themselves: their own code credits nobody', async () => {
  const w = world();
  const alice = books(w.event.id, w.tierId, 'selfie@example.test');

  const mine = await checkout(
    {
      eventId: w.event.id,
      buyerName: 'Alice',
      buyerEmail: 'SELFIE@example.test', // same person, shouted
      items: [{ tierId: w.tierId, quantity: 1 }],
      ref: alice.shareCode,
    },
    '203.0.113.10'
  );
  assert.equal(mine.status, 200, mine.body.error as string);
  assert.equal(getOrder(mine.body.orderId as string)!.referredBy, '', 'the code must not even be stored');

  // The control: the very same code, used by somebody else, is accepted. Without
  // this the test above would pass just as well on a route that dropped every ref.
  const theirs = await checkout(
    {
      eventId: w.event.id,
      buyerName: 'Friend',
      buyerEmail: 'friend@example.test',
      items: [{ tierId: w.tierId, quantity: 1 }],
      ref: alice.shareCode,
    },
    '203.0.113.11'
  );
  assert.equal(theirs.status, 200, theirs.body.error as string);
  assert.equal(getOrder(theirs.body.orderId as string)!.referredBy, alice.shareCode);
});

// =================================================================
// 4. How far a code reaches
// =================================================================

test("a code earned at one listing still names its owner at the same organizer's next one", () => {
  // The reward accrues per ORGANIZER, so the code has to resolve there too, or
  // it would silently stop working at the calendar.
  const organizer = makeOrganizer();
  const march = makeEventWithTier({ organizerId: organizer.id }, { priceCents: 5000 });
  const april = makeEventWithTier({ organizerId: organizer.id }, { priceCents: 5000 });
  const alice = books(march.event.id, march.tier.tierKey, 'alice8@example.test');

  assert.equal(referrerEmailForCode(organizer.id, alice.shareCode), 'alice8@example.test');
  assert.ok(getPaidOrderByReferralCode(april.event.id, alice.shareCode), 'and the checkout must resolve it too');

  books(april.event.id, april.tier.tierKey, 'friend8@example.test', { referredBy: alice.shareCode });
  assert.equal(countPaidReferrals(organizer.id, 'alice8@example.test'), 1);
});

test("a code never resolves across organizers — somebody else's referrals buy nothing here", () => {
  const mine = world();
  const theirs = world();
  const alice = books(mine.event.id, mine.tierId, 'alice9@example.test');

  assert.equal(referrerEmailForCode(theirs.organizerId, alice.shareCode), null);
  assert.equal(getPaidOrderByReferralCode(theirs.event.id, alice.shareCode), null);
  assert.equal(referrerEmailForCode(mine.organizerId, alice.shareCode), 'alice9@example.test');
});

test("referrals never cross an organizer boundary in the count either", () => {
  const mine = world();
  const theirs = world();
  const alice = books(mine.event.id, mine.tierId, 'alice10@example.test');
  // The same person, the same code, brought to a DIFFERENT seller's listing.
  books(theirs.event.id, theirs.tierId, 'friend10@example.test', { referredBy: alice.shareCode });

  assert.equal(countPaidReferrals(mine.organizerId, 'alice10@example.test'), 0);
  assert.equal(countPaidReferrals(theirs.organizerId, 'alice10@example.test'), 0);
});

test('a code that names an unpaid order names nobody', () => {
  const w = world();
  const pending = makeOrder({
    eventId: w.event.id,
    items: [{ tierId: w.tierId, quantity: 1 }],
    buyerEmail: 'unpaid@example.test',
  });
  assert.ok(pending.shareCode, 'every order mints a code, paid or not');
  assert.equal(referrerEmailForCode(w.organizerId, pending.shareCode), null);
  assert.equal(getPaidOrderByReferralCode(w.event.id, pending.shareCode), null);
});

test('a code that is not eight characters of A-Z0-9 names nobody', () => {
  const w = world();
  for (const junk of ['', '   ', 'ABC', 'ABCDEFGHI', 'ABCDEF-H', "' OR 1=1--"]) {
    assert.equal(referrerEmailForCode(w.organizerId, junk), null, `"${junk}" must fail closed`);
  }
});

test('a code two paid orders somehow share names nobody — a coin toss is worse than silence', () => {
  // No lib function can produce this state (codes are random and unconstrained),
  // and the rule is precisely about what happens if it ever occurs. Raw SQL is
  // the only way to build the collision the code says it defends against.
  const w = world();
  const one = books(w.event.id, w.tierId, 'twin-a@example.test');
  const two = books(w.event.id, w.tierId, 'twin-b@example.test');
  db().prepare(`UPDATE orders SET share_code = ? WHERE id = ?`).run(one.shareCode, two.id);

  assert.equal(referrerEmailForCode(w.organizerId, one.shareCode), null);
  assert.equal(getPaidOrderByReferralCode(w.event.id, one.shareCode), null);
});

// =================================================================
// 5. Issuing: floor(count / threshold), and never more
// =================================================================

test('vouchers are issued as floor(referrals / threshold) — not one per referral', () => {
  const w = world();
  setReferralRewardSettings(w.organizerId, 3, 1000); // 3 referrals = 10.00
  const alice = books(w.event.id, w.tierId, 'alice11@example.test');

  const expected = [0, 0, 1, 1, 1, 2];
  for (let i = 0; i < expected.length; i++) {
    const friend = books(w.event.id, w.tierId, `friend11-${i}@example.test`, { referredBy: alice.shareCode });
    awardReferralVouchers(friend.id);
    assert.equal(countPaidReferrals(w.organizerId, 'alice11@example.test', getReferralRewardSettings(w.organizerId).since), i + 1);
    assert.equal(held(w.organizerId, 'alice11@example.test'), expected[i], `after ${i + 1} referrals`);
  }
});

test('the reward hook firing twice for one order issues nothing the second time', () => {
  const w = world();
  setReferralRewardSettings(w.organizerId, 2, 1500);
  const alice = books(w.event.id, w.tierId, 'alice12@example.test');
  books(w.event.id, w.tierId, 'f12a@example.test', { referredBy: alice.shareCode });
  const second = books(w.event.id, w.tierId, 'f12b@example.test', { referredBy: alice.shareCode });

  awardReferralVouchers(second.id);
  assert.equal(held(w.organizerId, 'alice12@example.test'), 1);
  // A retried confirm, or a reconcile pass crossing a capture.
  awardReferralVouchers(second.id);
  awardReferralVouchers(second.id);
  assert.equal(held(w.organizerId, 'alice12@example.test'), 1, 'a repeated hook must mint nothing');
});

test('two confirmations crossing the threshold at once still issue exactly one voucher', () => {
  // The interleaving a double confirm actually produces: two orders, each of
  // which alone leaves the referrer under the line, both hooks firing against
  // the same referrer row. Because the count is DERIVED and not incremented,
  // whichever order they run in, the answer is one.
  const w = world();
  setReferralRewardSettings(w.organizerId, 2, 2000);
  const alice = books(w.event.id, w.tierId, 'alice13@example.test');
  const a = books(w.event.id, w.tierId, 'f13a@example.test', { referredBy: alice.shareCode });
  const b = books(w.event.id, w.tierId, 'f13b@example.test', { referredBy: alice.shareCode });

  awardReferralVouchers(a.id);
  awardReferralVouchers(b.id);
  awardReferralVouchers(b.id);
  awardReferralVouchers(a.id);
  assert.equal(held(w.organizerId, 'alice13@example.test'), 1);
});

test('an order that does not itself count never triggers an issue for anybody', () => {
  const w = world();
  setReferralRewardSettings(w.organizerId, 1, 1000);
  const alice = books(w.event.id, w.tierId, 'alice14@example.test');
  const mock = books(w.event.id, w.tierId, 'f14@example.test', {
    referredBy: alice.shareCode,
    paymentMode: 'mock',
  });
  awardReferralVouchers(mock.id);
  assert.equal(held(w.organizerId, 'alice14@example.test'), 0);
});

test('a voucher freezes the reward that was promised when it was earned', () => {
  const w = world();
  setReferralRewardSettings(w.organizerId, 1, 1000);
  const alice = books(w.event.id, w.tierId, 'alice15@example.test');
  const first = books(w.event.id, w.tierId, 'f15a@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(first.id);

  // The organizer becomes more generous. What is already earned does not move.
  setReferralRewardSettings(w.organizerId, 1, 2500);
  const second = books(w.event.id, w.tierId, 'f15b@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(second.id);

  const amounts = listUnredeemedVouchers(w.organizerId, 'alice15@example.test')
    .map((v) => v.amountCents)
    .sort((x, y) => x - y);
  assert.deepEqual(amounts, [1000, 2500]);
});

test('rewards that are switched off issue nothing, however many referrals arrive', () => {
  const w = world();
  assert.equal(getReferralRewardSettings(w.organizerId).enabled, false, 'an account never asked for rewards');
  const alice = books(w.event.id, w.tierId, 'alice16@example.test');
  for (let i = 0; i < 4; i++) {
    const f = books(w.event.id, w.tierId, `f16-${i}@example.test`, { referredBy: alice.shareCode });
    awardReferralVouchers(f.id);
  }
  assert.equal(held(w.organizerId, 'alice16@example.test'), 0);
  assert.deepEqual(referralProgressFor(w.organizerId, 'alice16@example.test').vouchers, []);
});

test('half a settings pair is refused rather than silently completed', () => {
  assert.equal(validateReferralRewardSettings(0, 0), null, 'zero/zero is the way OFF');
  assert.equal(validateReferralRewardSettings(5, 1000), null);
  assert.ok(validateReferralRewardSettings(0, 1000), 'a reward nobody can reach');
  assert.ok(validateReferralRewardSettings(5, 0), 'a threshold with nothing behind it');
  assert.ok(validateReferralRewardSettings(5, 50), 'under 1.00 is not worth giving');
  assert.ok(validateReferralRewardSettings(101, 1000), 'above the ceiling it is not a thank-you');
  assert.ok(validateReferralRewardSettings(2.5, 1000), 'a fraction of a referral is not a number');
});

// =================================================================
// 6. Spending a voucher: the race two checkouts really run
// =================================================================

test('two checkouts that both read one voucher as usable: the loser fails closed', () => {
  // This is the production interleaving, not a simulated one. Both checkouts
  // PREVIEW the code (that is what the buyer is shown), then both try to
  // commit. better-sqlite3 is synchronous, so "at the same time" means the two
  // previews happen before either claim — exactly the stale read the
  // conditional UPDATE inside claimVoucherForOrder exists to survive.
  const w = world();
  setReferralRewardSettings(w.organizerId, 1, 3000);
  const alice = books(w.event.id, w.tierId, 'alice17@example.test');
  const f = books(w.event.id, w.tierId, 'f17@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(f.id);
  const voucher = listUnredeemedVouchers(w.organizerId, 'alice17@example.test')[0];
  assert.ok(voucher);

  const listing = { id: w.event.id, organizerId: w.organizerId };
  const previewA = previewDiscountCode(listing, voucher.code);
  const previewB = previewDiscountCode(listing, voucher.code);
  assert.equal(previewA.amountCents, 3000);
  assert.equal(previewB.amountCents, 3000, 'both buyers were shown the same discount');

  const before = getAvailability(w.event.id).totalRemaining;
  const winner = makeOrder({
    eventId: w.event.id,
    items: [{ tierId: w.tierId, quantity: 1 }],
    buyerEmail: 'race-a@example.test',
    voucherCode: voucher.code,
  });
  assert.equal(winner.discountCents, 3000);

  assert.throws(
    () =>
      makeOrder({
        eventId: w.event.id,
        items: [{ tierId: w.tierId, quantity: 1 }],
        buyerEmail: 'race-b@example.test',
        voucherCode: voucher.code,
      }),
    VoucherError,
    'the loser must be refused, not quietly charged full price'
  );

  // Failing closed means the whole order rolled back: no row, and no seats.
  const holders = db()
    .prepare(`SELECT COUNT(*) AS n FROM orders WHERE voucher_code = ?`)
    .get(voucher.code) as { n: number };
  assert.equal(holders.n, 1, 'exactly one order may hold this code');
  const loserRows = db()
    .prepare(`SELECT COUNT(*) AS n FROM orders WHERE buyer_email = ?`)
    .get('race-b@example.test') as { n: number };
  assert.equal(loserRows.n, 0, 'no half-order may survive the refusal');
  assert.equal(getAvailability(w.event.id).totalRemaining, before - 1, "the loser's seats were never taken");
  // And the voucher is spent against the winner, once.
  assert.throws(() => requireRedeemableVoucher(w.organizerId, voucher.code), VoucherError);
  const after = db()
    .prepare(`SELECT redeemed_order_id AS orderId FROM referral_vouchers WHERE id = ?`)
    .get(voucher.id) as { orderId: string };
  assert.equal(after.orderId, winner.id);
});

test('a voucher spent by ANOTHER PROCESS mid-checkout takes the whole order down with it', () => {
  // Real concurrency, not a simulation: a second better-sqlite3 connection to
  // the same file is a second web worker. The interleaving matters because the
  // database is in WAL mode — our checkout's transaction holds a SNAPSHOT, so
  // after the other worker commits, our connection STILL READS THE VOUCHER AS
  // UNREDEEMED. Every in-process check therefore passes, and the only thing
  // standing between the buyer and a discount nobody is funding is that the
  // claim happens inside the same transaction that writes the order.
  const w = world();
  setReferralRewardSettings(w.organizerId, 1, 2000);
  const alice = books(w.event.id, w.tierId, 'alice17b@example.test');
  const f = books(w.event.id, w.tierId, 'f17b@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(f.id);
  const voucher = listUnredeemedVouchers(w.organizerId, 'alice17b@example.test')[0];

  const otherWorker = new Database(path.join(process.env.DATA_DIR!, 'tickets.db'));
  try {
    assert.throws(() =>
      db().transaction(() => {
        // Our checkout reads the code as usable — this fixes our snapshot.
        const read = requireRedeemableVoucher(w.organizerId, voucher.code);
        assert.equal(read.redeemedAt, null);
        // The other worker spends it and commits, right now.
        const stolen = otherWorker
          .prepare(
            `UPDATE referral_vouchers SET redeemed_at = datetime('now'), redeemed_order_id = 'other-worker'
             WHERE id = ? AND redeemed_at IS NULL`
          )
          .run(voucher.id).changes;
        assert.equal(stolen, 1, 'the other worker really did win');
        assert.equal(
          requireRedeemableVoucher(w.organizerId, voucher.code).redeemedAt,
          null,
          'our snapshot cannot see it — this is why the in-transaction claim has to be the guard'
        );
        // Writing the order that carries the discount must now fail.
        makeOrder({
          eventId: w.event.id,
          items: [{ tierId: w.tierId, quantity: 1 }],
          buyerEmail: 'snapshot-loser@example.test',
          voucherCode: voucher.code,
        });
      })()
    );
  } finally {
    otherWorker.close();
  }

  const orphan = db()
    .prepare(`SELECT COUNT(*) AS n FROM orders WHERE buyer_email = ?`)
    .get('snapshot-loser@example.test') as { n: number };
  assert.equal(orphan.n, 0, 'no order may exist holding a discount it never took');
  const owner = db()
    .prepare(`SELECT redeemed_order_id AS orderId FROM referral_vouchers WHERE id = ?`)
    .get(voucher.id) as { orderId: string };
  assert.equal(owner.orderId, 'other-worker', 'one voucher, one order, whoever got there first');
});

test('a voucher already spent cannot be claimed again, even by a caller holding a fresh read of it', () => {
  const w = world();
  setReferralRewardSettings(w.organizerId, 1, 2000);
  const alice = books(w.event.id, w.tierId, 'alice18@example.test');
  const f = books(w.event.id, w.tierId, 'f18@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(f.id);
  const voucher = listUnredeemedVouchers(w.organizerId, 'alice18@example.test')[0];

  // Both callers hold a row that says "unredeemed" — the stale read.
  const readA = requireRedeemableVoucher(w.organizerId, voucher.code);
  const readB = requireRedeemableVoucher(w.organizerId, voucher.code);
  assert.equal(readA.redeemedAt, null);
  assert.equal(readB.redeemedAt, null);

  const claimed = claimVoucherForOrder(w.organizerId, voucher.code, 'order-a', 5000);
  assert.equal(claimed.discountCents, 2000);
  assert.throws(() => claimVoucherForOrder(w.organizerId, voucher.code, 'order-b', 5000), VoucherError);
});

test("a voucher is one seller's discount and is refused at another seller's checkout", () => {
  const mine = world();
  const theirs = world();
  setReferralRewardSettings(mine.organizerId, 1, 2000);
  const alice = books(mine.event.id, mine.tierId, 'alice19@example.test');
  const f = books(mine.event.id, mine.tierId, 'f19@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(f.id);
  const voucher = listUnredeemedVouchers(mine.organizerId, 'alice19@example.test')[0];

  assert.throws(() => requireRedeemableVoucher(theirs.organizerId, voucher.code), VoucherError);
  assert.equal(normalizeVoucherCode(voucher.code), voucher.code, 'the code itself is well formed');
});

// =================================================================
// 7. The since-clock
// =================================================================

test('switching rewards on does not retroactively owe anybody for past referrals', () => {
  const w = world();
  const alice = books(w.event.id, w.tierId, 'alice20@example.test');
  const history: OrderRow[] = [];
  for (let i = 0; i < 5; i++) {
    const f = books(w.event.id, w.tierId, `f20-${i}@example.test`, { referredBy: alice.shareCode });
    ageOrder(f.id, '-30 days');
    history.push(f);
  }
  ageOrder(alice.id, '-40 days');

  // Lifetime, they really did bring five people.
  assert.equal(countPaidReferrals(w.organizerId, 'alice20@example.test', null), 5);

  // The promise is made TODAY.
  setReferralRewardSettings(w.organizerId, 2, 1000);
  const settings = getReferralRewardSettings(w.organizerId);
  assert.ok(settings.since, 'switching on has to stamp a clock');
  assert.equal(countPaidReferrals(w.organizerId, 'alice20@example.test', settings.since), 0);

  for (const order of history) awardReferralVouchers(order.id);
  assert.equal(held(w.organizerId, 'alice20@example.test'), 0, 'a year of history must not become a pile of vouchers');
  assert.equal(referralProgressFor(w.organizerId, 'alice20@example.test').paidReferrals, 0);
});

test('lowering the threshold restarts the window — no retroactive burst', () => {
  const w = world();
  const alice = books(w.event.id, w.tierId, 'alice21@example.test');
  ageOrder(alice.id, '-10 days');
  setReferralRewardSettings(w.organizerId, 10, 1000); // "10 referrals = 10.00"
  ageRewardClock(w.organizerId, '-5 days');
  const firstSince = getReferralRewardSettings(w.organizerId).since!;

  const earned: OrderRow[] = [];
  for (let i = 0; i < 4; i++) {
    const f = books(w.event.id, w.tierId, `f21-${i}@example.test`, { referredBy: alice.shareCode });
    ageOrder(f.id, '-1 day');
    earned.push(f);
  }
  assert.equal(countPaidReferrals(w.organizerId, 'alice21@example.test', firstSince), 4);
  for (const o of earned) awardReferralVouchers(o.id);
  assert.equal(held(w.organizerId, 'alice21@example.test'), 0, '4 of 10 is not a voucher yet');

  // The organizer gets more generous: 2 referrals per voucher. Under a lifetime
  // count those same four bookings would instantly become TWO vouchers.
  setReferralRewardSettings(w.organizerId, 2, 1000);
  const secondSince = getReferralRewardSettings(w.organizerId).since!;
  assert.notEqual(secondSince, firstSince, 'lowering the threshold has to restart the clock');
  assert.equal(countPaidReferrals(w.organizerId, 'alice21@example.test', secondSince), 0);

  for (const o of earned) awardReferralVouchers(o.id);
  assert.equal(held(w.organizerId, 'alice21@example.test'), 0, 'no burst');

  // And the new promise works from here — one booking at a time, so the
  // countdown is genuinely observed crossing the line rather than jumped over.
  const a = books(w.event.id, w.tierId, 'f21-new-a@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(a.id);
  assert.equal(held(w.organizerId, 'alice21@example.test'), 0, 'one of two is not a voucher');
  const b = books(w.event.id, w.tierId, 'f21-new-b@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(b.id);
  assert.equal(held(w.organizerId, 'alice21@example.test'), 1);
});

test('a restarted clock does not leave old vouchers blocking new ones', () => {
  // The other half of the window rule, and the one that costs a real person a
  // real reward if it breaks: the count and the vouchers-already-held are
  // compared against each other, so BOTH have to read the same period. Count
  // the referrals since the new promise but the vouchers since forever, and
  // somebody who earned five under the old deal can never earn a sixth.
  const w = world();
  const alice = books(w.event.id, w.tierId, 'alice28@example.test');
  ageOrder(alice.id, '-10 days');
  setReferralRewardSettings(w.organizerId, 2, 1000);
  ageRewardClock(w.organizerId, '-5 days');

  const old: OrderRow[] = [];
  for (let i = 0; i < 4; i++) {
    const f = books(w.event.id, w.tierId, `f28-${i}@example.test`, { referredBy: alice.shareCode });
    ageOrder(f.id, '-1 day');
    old.push(f);
  }
  for (const o of old) awardReferralVouchers(o.id);
  assert.equal(held(w.organizerId, 'alice28@example.test'), 2, 'two earned under the old promise');
  ageVouchers(w.organizerId, 'alice28@example.test', '-1 day'); // they were earned back then, not now

  // A new, more generous promise. The clock restarts; her old vouchers stay.
  setReferralRewardSettings(w.organizerId, 1, 1000);
  assert.equal(countPaidReferrals(w.organizerId, 'alice28@example.test', getReferralRewardSettings(w.organizerId).since), 0);

  const fresh = books(w.event.id, w.tierId, 'f28-new@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(fresh.id);
  assert.equal(held(w.organizerId, 'alice28@example.test'), 3, 'one referral, one voucher, under the new promise');
});

test('raising the threshold claws nothing back and takes away no progress', () => {
  const w = world();
  setReferralRewardSettings(w.organizerId, 2, 1000);
  const since = getReferralRewardSettings(w.organizerId).since!;
  const alice = books(w.event.id, w.tierId, 'alice22@example.test');
  const a = books(w.event.id, w.tierId, 'f22a@example.test', { referredBy: alice.shareCode });
  const b = books(w.event.id, w.tierId, 'f22b@example.test', { referredBy: alice.shareCode });
  const c = books(w.event.id, w.tierId, 'f22c@example.test', { referredBy: alice.shareCode });
  for (const o of [a, b, c]) awardReferralVouchers(o.id);
  assert.equal(held(w.organizerId, 'alice22@example.test'), 1);

  setReferralRewardSettings(w.organizerId, 5, 1000);
  assert.equal(getReferralRewardSettings(w.organizerId).since, since, 'raising must NOT restart the clock');
  assert.equal(
    countPaidReferrals(w.organizerId, 'alice22@example.test', since),
    3,
    'progress people already made stays'
  );
  for (const o of [a, b, c]) awardReferralVouchers(o.id);
  assert.equal(held(w.organizerId, 'alice22@example.test'), 1, 'the voucher already given is never taken back');
});

test('changing only what a voucher is worth leaves the clock and everyone’s progress alone', () => {
  const w = world();
  setReferralRewardSettings(w.organizerId, 4, 1000);
  const since = getReferralRewardSettings(w.organizerId).since!;
  const alice = books(w.event.id, w.tierId, 'alice23@example.test');
  const f = books(w.event.id, w.tierId, 'f23@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(f.id);

  setReferralRewardSettings(w.organizerId, 4, 4000);
  assert.equal(getReferralRewardSettings(w.organizerId).since, since);
  assert.equal(countPaidReferrals(w.organizerId, 'alice23@example.test', since), 1);
});

test('switching rewards off and on again starts a new promise, from today', () => {
  const w = world();
  setReferralRewardSettings(w.organizerId, 2, 1000);
  ageRewardClock(w.organizerId, '-5 days');
  const firstSince = getReferralRewardSettings(w.organizerId).since!;
  const alice = books(w.event.id, w.tierId, 'alice24@example.test');
  ageOrder(alice.id, '-4 days');
  const f = books(w.event.id, w.tierId, 'f24@example.test', { referredBy: alice.shareCode });
  ageOrder(f.id, '-1 day');
  assert.equal(countPaidReferrals(w.organizerId, 'alice24@example.test', firstSince), 1);

  setReferralRewardSettings(w.organizerId, 0, 0);
  assert.equal(getReferralRewardSettings(w.organizerId).enabled, false);
  setReferralRewardSettings(w.organizerId, 2, 1000);
  const secondSince = getReferralRewardSettings(w.organizerId).since!;
  assert.notEqual(secondSince, firstSince);
  assert.equal(countPaidReferrals(w.organizerId, 'alice24@example.test', secondSince), 0);
});

// =================================================================
// 8. An erased referrer
// =================================================================

test('an erased referrer stops accruing, but the vouchers they hold still work', () => {
  // Their address is now a shared placeholder, so accruing would credit one
  // imaginary, very busy person. A voucher already given stands on its own
  // code and must not evaporate because a privacy sweep ran.
  const w = world({ eventDate: '2026-01-01' }); // long past: the sweep is due
  setReferralRewardSettings(w.organizerId, 1, 2000);
  const alice = books(w.event.id, w.tierId, 'alice25@example.test');
  const f = books(w.event.id, w.tierId, 'f25@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(f.id);
  const voucher = listUnredeemedVouchers(w.organizerId, 'alice25@example.test')[0];
  assert.ok(voucher, 'she earned one before the sweep');

  const swept = runBuyerDataRetentionSweep(true);
  assert.ok(swept.erased > 0, 'the real sweep really did erase this listing’s buyers');
  assert.equal(getOrder(alice.id)!.buyerEmail, ERASED_BUYER_EMAIL);

  // Accrual stops, on every surface.
  assert.equal(referrerEmailForCode(w.organizerId, alice.shareCode), null);
  assert.equal(countPaidReferrals(w.organizerId, 'alice25@example.test'), 0);
  const later = books(w.event.id, w.tierId, 'f25-late@example.test', { referredBy: alice.shareCode });
  awardReferralVouchers(later.id);
  assert.equal(held(w.organizerId, 'alice25@example.test'), 1, 'no NEW voucher');

  // The one she already holds still spends.
  const spent = makeOrder({
    eventId: w.event.id,
    items: [{ tierId: w.tierId, quantity: 1 }],
    buyerEmail: 'alice25-again@example.test',
    voucherCode: voucher.code,
  });
  assert.equal(spent.discountCents, 2000);
  assert.equal(spent.totalCents, 3000);
});

// =================================================================
// 9. The three readers agree
// =================================================================

test('the count, the progress a buyer reads and what was issued all describe one thing', () => {
  // Driven from ONE set of fixtures on purpose. Each of these numbers is shown
  // to somebody — the referrer's order page, the organizer's Insights, the
  // voucher list in an inbox — and the failure nobody would notice is the
  // three of them drifting apart.
  const w = world();
  const threshold = 3;
  const rewardCents = 1200;
  setReferralRewardSettings(w.organizerId, threshold, rewardCents);
  const settings = getReferralRewardSettings(w.organizerId);
  const alice = books(w.event.id, w.tierId, 'alice26@example.test');

  for (let n = 1; n <= 7; n++) {
    const f = books(w.event.id, w.tierId, `f26-${n}@example.test`, { referredBy: alice.shareCode });
    awardReferralVouchers(f.id);

    const counted = countPaidReferrals(w.organizerId, 'alice26@example.test', settings.since);
    const progress = referralProgressFor(w.organizerId, 'alice26@example.test');
    const totals = voucherTotalsForOrganizer(w.organizerId);

    assert.equal(counted, n, `after ${n} referrals the count is ${n}`);
    assert.equal(progress.paidReferrals, counted, 'the buyer reads the same count');
    assert.equal(progress.toNextReward, threshold - (counted % threshold), 'and a matching countdown');
    assert.equal(progress.vouchers.length, Math.floor(counted / threshold), 'holding exactly what was earned');
    assert.equal(totals.earned, Math.floor(counted / threshold), 'and Insights agrees with both');
    assert.equal(totals.earnedCents, Math.floor(counted / threshold) * rewardCents);
    assert.equal(totals.redeemed, 0);
    assert.equal(progress.settings.threshold, threshold);
    assert.equal(progress.currency, 'EUR');
  }
});

test('the progress reader shows nothing at all when the organizer is not rewarding referrals', () => {
  const w = world();
  const alice = books(w.event.id, w.tierId, 'alice27@example.test');
  books(w.event.id, w.tierId, 'f27@example.test', { referredBy: alice.shareCode });

  const progress = referralProgressFor(w.organizerId, 'alice27@example.test');
  assert.equal(progress.settings.enabled, false);
  assert.equal(progress.paidReferrals, 0, 'no promise, no progress bar');
  assert.equal(progress.toNextReward, 0);
  assert.deepEqual(progress.vouchers, []);
});
