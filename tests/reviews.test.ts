/**
 * VERIFIED-BUYER REVIEWS.
 *
 * The item page is about to print a star rating and the words "Verified
 * order". That sentence is only true because of the rules in lib/reviews.ts,
 * and every one of them is invisible on a bazaar that happens to be honest the
 * day you look at it: nothing on screen shows you that an unpaid reservation
 * cannot review, or that one order buys exactly one opinion, or that a token
 * for order A cannot rate the item in order B. They are all one `if` away from
 * being untrue, and the page would keep claiming them.
 *
 * So the fixture below is a small bazaar of things that LOOK reviewable and
 * are not — a reservation nobody paid, an event's ticket, an item the order
 * never contained, a tier key borrowed from the shop next door — and each one
 * is asserted as a REFUSAL rather than as an absence, because "no row was
 * written" also passes when the write silently did nothing.
 *
 * The aggregates get the same treatment. A zero average and a hidden review
 * counted in are both arithmetic nobody would notice going wrong, and both are
 * exactly what the honesty rules on the page forbid.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEvent, makeOrder, makeOrganizer, makePaidOrder } from './helpers.ts';
import { getEventTiers } from '../src/lib/events.ts';
import {
  anonymizeReviewsForOrder,
  listReviewsForItem,
  listReviewsForOrganizer,
  ratingForItem,
  listAllReviews,
  ratingForShop,
  ratingsForItems,
  reviewableItems,
  setReviewStatus,
  setSellerReply,
  writeReview,
  type RatingSummary,
} from '../src/lib/reviews.ts';
import {
  ANONYMOUS_BUYER_NAME,
  ERASED_BUYER_EMAIL,
  ERASED_BUYER_NAME,
  runBuyerDataRetentionSweep,
} from '../src/lib/retention.ts';

const seller = makeOrganizer({ name: 'Bazaar Seller' });

/** A shop with two things on its shelves. */
const kitchen = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Sunita’s Kitchen',
  tiers: [
    { tierKey: 'momo', name: 'Chicken momo', priceCents: 800 },
    { tierKey: 'sel', name: 'Sel roti', priceCents: 500 },
  ],
});

/** A second shop, so a tier key from one cannot be spent on the other. */
const spices = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Taplejung Spice',
  tiers: [{ tierKey: 'timur', name: 'Timur 100g', priceCents: 600 }],
});

/** An EVENT. Its tiers are seats in a room, not goods anybody can review. */
const night = makeEvent({
  organizerId: seller.id,
  kind: 'event',
  name: 'Dashain Night',
  eventDate: '2026-10-10',
  tiers: [{ tierKey: 'standard', name: 'Standard ticket', priceCents: 1500 }],
});

/** A paid order of ONE item from a shop, from a buyer with their own name. */
function buy(eventId: string, tierKey: string, buyerName: string) {
  return makePaidOrder({
    eventId,
    items: [{ tierId: tierKey, quantity: 1 }],
    buyerName,
  }).order;
}

// ---------------- Who may write one ----------------

test('a paid shop order can review what it bought, signed "First L."', () => {
  const order = buy(kitchen.id, 'momo', 'Sunita Thapa');
  const review = writeReview({ orderId: order.id, tierKey: 'momo', rating: 5, body: 'Hot, and still hot at home.' });

  assert.equal(review.eventId, kitchen.id);
  assert.equal(review.tierKey, 'momo');
  assert.equal(review.rating, 5);
  assert.equal(review.body, 'Hot, and still hot at home.');
  assert.equal(review.status, 'published');
  assert.equal(
    review.authorName,
    'Sunita T.',
    'a first name and an initial — never the email, never the whole surname'
  );
});

test('a one-word name keeps its whole self rather than growing an invented initial', () => {
  const order = buy(kitchen.id, 'sel', 'Sunita');
  assert.equal(writeReview({ orderId: order.id, tierKey: 'sel', rating: 4, body: '' }).authorName, 'Sunita');
});

test('an unpaid reservation is not a purchase and cannot review', () => {
  // 'claimed', not 'pending': a bank-transfer order holds its stock the moment
  // it is made and only becomes 'paid' when the seller confirms the money
  // arrived. That is exactly the state this rule has to refuse — the goods are
  // reserved, nobody has been paid, and nothing has changed hands to review.
  const pending = makeOrder({ eventId: kitchen.id, items: [{ tierId: 'momo', quantity: 1 }] });
  assert.notEqual(pending.status, 'paid');
  assert.throws(
    () => writeReview({ orderId: pending.id, tierKey: 'momo', rating: 5, body: 'Paid for none of it.' }),
    /paid/i,
    'money is what separates a review from an opinion of a photograph'
  );
  assert.equal(listReviewsForItem(kitchen.id, 'momo').some((r) => r.orderId === pending.id), false);
});

test('an EVENT ticket cannot be star-rated — it is not a thing that was sold', () => {
  const order = buy(night.id, 'standard', 'Ram Gurung');
  assert.throws(
    () => writeReview({ orderId: order.id, tierKey: 'standard', rating: 5, body: 'Lovely evening.' }),
    /shop/i
  );
  assert.equal(ratingForItem(night.id, 'standard'), null);
});

test('an item the order never contained is refused, even inside the same shop', () => {
  // The order bought momo. Without this rule the token in ITS email would rate
  // every other thing on the shelf, which is the whole shop from one purchase.
  const order = buy(kitchen.id, 'momo', 'Bikash Rai');
  assert.throws(() => writeReview({ orderId: order.id, tierKey: 'sel', rating: 1, body: '' }), /not on this order/i);
  assert.equal(ratingForItem(kitchen.id, 'sel')?.count, 1, 'only the genuine sel roti review from earlier');
});

test('a tier key borrowed from another shop is refused', () => {
  // 'timur' is a perfectly real tier key — it just belongs to a different
  // seller. The check is against the ORDER's own lines, so a key that exists
  // somewhere gets no further than one that exists nowhere.
  const order = buy(kitchen.id, 'momo', 'Maya Lama');
  assert.throws(() => writeReview({ orderId: order.id, tierKey: 'timur', rating: 5, body: '' }), /not on this order/i);
  assert.throws(() => writeReview({ orderId: order.id, tierKey: 'no-such-item', rating: 5, body: '' }), /not on this order/i);
  assert.equal(ratingForItem(spices.id, 'timur'), null, 'and nothing landed on the other shop’s item');
});

test('the stars are whole stars, one to five', () => {
  const order = buy(kitchen.id, 'momo', 'Kiran Shrestha');
  for (const rating of [0, 6, -1, 3.5]) {
    assert.throws(
      () => writeReview({ orderId: order.id, tierKey: 'momo', rating, body: '' }),
      /one and five/i,
      `${rating} is not a rating`
    );
  }
  assert.ok(writeReview({ orderId: order.id, tierKey: 'momo', rating: 3, body: '' }));
});

test('a second write is a change of mind, not a second voice', () => {
  const order = buy(kitchen.id, 'sel', 'Anita Basnet');
  writeReview({ orderId: order.id, tierKey: 'sel', rating: 2, body: 'Dry.' });
  const before = ratingForItem(kitchen.id, 'sel')!.count;

  writeReview({ orderId: order.id, tierKey: 'sel', rating: 5, body: 'The second batch was excellent.' });
  const after = ratingForItem(kitchen.id, 'sel')!;

  assert.equal(after.count, before, 'pressing submit twice must not stack two ratings');
  const mine = listReviewsForItem(kitchen.id, 'sel').filter((r) => r.orderId === order.id);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].rating, 5);
  assert.equal(mine[0].body, 'The second batch was excellent.');
});

test('reviewableItems answers the order page, and refuses to for an unpaid one', () => {
  const order = buy(kitchen.id, 'momo', 'Deepa Karki');
  const items = reviewableItems(order.id);
  assert.deepEqual(items.map((i) => i.tierKey), ['momo']);
  assert.equal(items[0].name, 'Chicken momo');
  assert.equal(items[0].existing, null, 'nothing written yet');

  writeReview({ orderId: order.id, tierKey: 'momo', rating: 4, body: 'Good.' });
  assert.equal(reviewableItems(order.id)[0].existing?.rating, 4, 'the buyer sees their own words back');

  const pending = makeOrder({ eventId: kitchen.id, items: [{ tierId: 'momo', quantity: 1 }] });
  assert.deepEqual(reviewableItems(pending.id), [], 'an unpaid order has nothing to review');
  assert.deepEqual(reviewableItems('no-such-order'), []);
});

// ---------------- What the aggregates are allowed to claim ----------------

test('an item nobody has reviewed has NO rating, not a rating of zero', () => {
  assert.equal(ratingForItem(spices.id, 'timur'), null);
  assert.equal(ratingForShop(spices.id), null);
  assert.equal(ratingsForItems([spices.id]).get(`${spices.id}:timur`), undefined, 'absent, not an empty summary');
});

test('a hidden review is off the page and out of the arithmetic', () => {
  const good = buy(spices.id, 'timur', 'Prakash Adhikari');
  const nasty = buy(spices.id, 'timur', 'Sita Magar');
  writeReview({ orderId: good.id, tierKey: 'timur', rating: 4, body: 'Properly fragrant.' });
  const hidden = writeReview({ orderId: nasty.id, tierKey: 'timur', rating: 1, body: 'Unrepeatable.' });

  const both = ratingForItem(spices.id, 'timur')!;
  assert.equal(both.count, 2);
  assert.equal(both.average, 2.5);

  assert.equal(setReviewStatus(hidden.id, 'hidden', 'Abuse, reported by the seller'), true);

  const left = ratingForItem(spices.id, 'timur')!;
  assert.equal(left.count, 1, 'the hidden one no longer counts');
  assert.equal(left.average, 4);
  assert.deepEqual(left.stars, [0, 0, 0, 1, 0], 'and nor does it show in the bars');
  assert.deepEqual(
    listReviewsForItem(spices.id, 'timur').map((r) => r.body),
    ['Properly fragrant.'],
    'the public list is the good one and nothing else'
  );

  // Restoring clears the reason: an old "hidden because…" note on a published
  // review would read as a warning about a review that is, in fact, fine.
  assert.equal(setReviewStatus(hidden.id, 'published', ''), true);
  assert.equal(ratingForItem(spices.id, 'timur')!.count, 2);
  assert.equal(listReviewsForItem(spices.id, 'timur').find((r) => r.id === hidden.id)?.hiddenReason, '');
  setReviewStatus(hidden.id, 'hidden', 'Abuse, reported by the seller');
});

/** Stars given, straight out of the distribution — no rounded average involved. */
function starsGiven(s: RatingSummary): number {
  return s.stars.reduce((sum, count, i) => sum + count * (i + 1), 0);
}

test('the bars and the average describe the same reviews', () => {
  const summary = ratingForItem(kitchen.id, 'momo')!;
  const inBars = summary.stars.reduce((n, count) => n + count, 0);
  assert.equal(inBars, summary.count, 'every counted review sits in exactly one bar');
  assert.equal(summary.average, Math.round((starsGiven(summary) / summary.count) * 10) / 10);
});

test('a shop’s rating counts every review once, not each item’s average again', () => {
  // An average of averages would give a jar one person bought the same weight
  // as the momo fifty people did, and would let a seller lift their score by
  // listing a well-reviewed item twice.
  const shop = ratingForShop(kitchen.id)!;
  const momo = ratingForItem(kitchen.id, 'momo')!;
  const sel = ratingForItem(kitchen.id, 'sel')!;
  assert.equal(shop.count, momo.count + sel.count);
  assert.equal(starsGiven(shop), starsGiven(momo) + starsGiven(sel));
  assert.equal(shop.average, Math.round((starsGiven(shop) / shop.count) * 10) / 10);
});

test('ratingsForItems says exactly what ratingForItem says, for every shop at once', () => {
  // The bazaar-wide pages read ONLY through this one. If it drifted from the
  // per-item reader the tiles and the page they link to would print different
  // scores for the same jar, and nothing would fail.
  const shops = [kitchen.id, spices.id, night.id];
  const bulk = ratingsForItems(shops);

  let checked = 0;
  for (const eventId of shops) {
    for (const tier of getEventTiers(eventId)) {
      const one = ratingForItem(eventId, tier.tierKey);
      const many = bulk.get(`${eventId}:${tier.tierKey}`) ?? null;
      assert.deepEqual(many, one, `${eventId}:${tier.tierKey}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 4, 'the comparison actually covered several shops’ items');
  assert.ok(
    [...bulk.values()].every((s: RatingSummary) => s.count > 0),
    'nothing rated appears in the map at all'
  );
  assert.deepEqual(ratingsForItems([]), new Map(), 'and no shops means no statement and no rows');
});

// ---------------- The seller's one power, and the platform's ----------------

test('a seller may answer a review of their own goods and nobody else’s', () => {
  const order = buy(spices.id, 'timur', 'Nabin Poudel');
  const review = writeReview({ orderId: order.id, tierKey: 'timur', rating: 3, body: 'Ground too coarse for me.' });

  const stranger = makeOrganizer({ name: 'Somebody Else' });
  assert.equal(setSellerReply(review.id, stranger.id, 'Nothing to do with me.'), false);
  assert.equal(setSellerReply(review.id, seller.id, 'We grind a finer batch on request — just ask.'), true);

  const shown = listReviewsForItem(spices.id, 'timur').find((r) => r.id === review.id)!;
  assert.equal(shown.sellerReply, 'We grind a finer batch on request — just ask.');
  assert.ok(shown.sellerReplyAt);
  assert.equal(shown.rating, 3, 'replying changes nothing about the review itself');

  // A seller may take their own words back down, and only their own words.
  assert.equal(setSellerReply(review.id, seller.id, '   '), true);
  const after = listReviewsForItem(spices.id, 'timur').find((r) => r.id === review.id)!;
  assert.equal(after.sellerReply, '');
  assert.equal(after.sellerReplyAt, null);
  assert.equal(after.body, 'Ground too coarse for me.');
});

test('the seller’s own screen shows hidden reviews too, with the item’s name', () => {
  const mine = listReviewsForOrganizer(seller.id);
  assert.ok(mine.length > 0);
  assert.ok(
    mine.some((r) => r.status === 'hidden'),
    'a review that vanished with no explanation would leave a seller arguing with a score they cannot see'
  );
  const momo = mine.find((r) => r.tierKey === 'momo')!;
  assert.equal(momo.tierName, 'Chicken momo');
  assert.equal(momo.eventName, 'Sunita’s Kitchen');
  assert.equal(momo.eventSlug, kitchen.slug);
  assert.deepEqual(listReviewsForOrganizer(makeOrganizer().id), [], 'and only their own');
});

// ---------------- Erasure ----------------

test('erasing a buyer takes their name off their review and leaves the words', () => {
  const order = buy(kitchen.id, 'momo', 'Bimala Tamang');
  const review = writeReview({
    orderId: order.id,
    tierKey: 'momo',
    rating: 5,
    body: 'Hotter than I expected, and the box arrived intact.',
  });
  assert.equal(review.authorName, 'Bimala T.');

  anonymizeReviewsForOrder(order.id);

  const after = listReviewsForItem(kitchen.id, 'momo').find((r) => r.id === review.id)!;
  assert.equal(after.authorName, ANONYMOUS_BUYER_NAME);
  assert.equal(
    after.body,
    'Hotter than I expected, and the box arrived intact.',
    'a review is about the goods, and the next shopper is still owed it'
  );
  assert.equal(after.rating, 5, 'and the seller’s score does not quietly improve');
});

test('the retention sweep does the same thing to a whole backlog', () => {
  const order = buy(kitchen.id, 'sel', 'Gopal Bhattarai');
  const review = writeReview({ orderId: order.id, tierKey: 'sel', rating: 4, body: 'Sweet enough, not too oily.' });
  assert.equal(review.authorName, 'Gopal B.');

  const countBefore = ratingForItem(kitchen.id, 'sel')!.count;

  // Age the order past the window the way the world would: paid long ago, and
  // every code collected — that is the clock a shop order runs on (see DUE_SQL
  // in lib/retention.ts).
  db().prepare(`UPDATE orders SET paid_at = datetime('now', '-400 days') WHERE id = ?`).run(order.id);
  db()
    .prepare(`UPDATE tickets SET checked_in_at = datetime('now', '-399 days') WHERE order_id = ?`)
    .run(order.id);

  runBuyerDataRetentionSweep(true);

  const after = listReviewsForItem(kitchen.id, 'sel').find((r) => r.id === review.id)!;
  assert.equal(after.authorName, ANONYMOUS_BUYER_NAME, 'the sweep signs it off the same way the direct path does');
  assert.equal(after.body, 'Sweet enough, not too oily.');
  assert.equal(ratingForItem(kitchen.id, 'sel')!.count, countBefore, 'nothing was deleted');
});

test('an erased buyer who writes a review is never re-named by it', () => {
  // Their emailed link keeps working past the sweep, so this really happens.
  const order = buy(kitchen.id, 'momo', 'Laxmi Chettri');
  db()
    .prepare(
      `UPDATE orders SET buyer_name = ?, buyer_email = ?, buyer_erased_at = datetime('now') WHERE id = ?`
    )
    .run(ERASED_BUYER_NAME, ERASED_BUYER_EMAIL, order.id);

  const review = writeReview({ orderId: order.id, tierKey: 'momo', rating: 4, body: 'Turned up warm.' });
  assert.equal(review.authorName, ANONYMOUS_BUYER_NAME);
  assert.equal(
    review.authorName.includes('Erased'),
    false,
    'the placeholder that keeps the column non-null must never reach a screen'
  );
});

test('the moderation screen sees EVERY review, hidden ones included', () => {
  // The one reader on the platform that is not scoped to anybody: the admin
  // has to be able to see a review in order to decide about it, and a hidden
  // one is precisely the row somebody is asking about. Every public reader
  // filters hidden rows out; this one must not, or the screen where a decision
  // is reviewed would be missing the decisions.
  const all = listAllReviews();
  const hidden = all.filter((r) => r.status === 'hidden');
  assert.ok(all.length > 0, 'fixture check: this file has written reviews');
  assert.ok(hidden.length > 0, 'fixture check: and hidden at least one');

  // Named, so a moderator is not looking at a rating attached to an id.
  for (const row of all) {
    assert.ok(row.eventName.length > 0, 'every row says which listing it is about');
    assert.ok(row.eventSlug.length > 0, 'and links to it');
  }
});

test('the moderation screen is newest first, and its limit cannot be talked into anything silly', () => {
  const all = listAllReviews();
  const dates = all.map((r) => r.createdAt);
  assert.deepEqual(dates, [...dates].sort().reverse(), 'newest first');

  // The limit is interpolated into the SQL rather than bound — it is a LIMIT,
  // which cannot be a parameter in SQLite — so what it accepts is the whole
  // guard. Anything that is not a sensible whole number falls back.
  for (const silly of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.doesNotThrow(() => listAllReviews(silly as number), `listAllReviews(${silly}) must not throw`);
  }
  assert.ok(listAllReviews(1).length <= 1, 'a real limit is honoured');
});
