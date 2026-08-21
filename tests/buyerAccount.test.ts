/**
 * lib/buyerAccount.ts — the one door between an ORDER and the ACCOUNT behind
 * the address on it.
 *
 * The rule these tests exist to hold: `orders.buyer_email` is an UNVERIFIED
 * claim. POST /api/orders only format-checks the address and hands the new
 * order id straight back in its response, and GET /order/<id> asks for nothing
 * but that id. So anybody can mint an order carrying anybody's address and
 * then open its page — and the two things keyed off that address are worth
 * stealing:
 *
 *   · the referrer's unredeemed VOUCHER CODES, which are bearer tokens
 *     redeemable for money off that seller's listings;
 *   · the CUSTOMER CARD CODE, which is the sole secret guarding /c/<cardCode>
 *     and with it the holder's whole history with that seller.
 *
 * The order page therefore reads neither directly — it asks
 * buyerAccountForOrder(), which opens only for an HMAC order access token
 * (lib/orders.ts). That token travels ONLY inside email sent to the address on
 * the order, so holding it is proof of reading that mailbox. Which is also why
 * a token minted at order creation would be worthless: the attacker creates
 * orders too. The tests below are written as the attack and as the legitimate
 * buyer, side by side, because the fix is only correct if it says yes to one
 * and no to the other.
 *
 * The token helpers themselves live in lib/orders.ts (with the other ways an
 * order can be named) but are exercised here rather than in their own file:
 * they have no other caller, and a key tested apart from its lock proves
 * nothing about whether the lock is shut.
 */
// getSigningSecret() returns null outside production without one, and then
// every token is null and every panel stays shut — which would make the
// "a real buyer still gets in" half of these tests pass for the wrong reason.
// Set before any module that reads it is imported, as tenancy.test.ts does.
process.env.APP_SECRET = 'buyer-account-test-secret';

import test from 'node:test';
import assert from 'node:assert/strict';

import { buyerAccountForOrder, issueCardForOrder } from '../src/lib/buyerAccount.ts';
import { closeCustomerCard, getCustomerCard, issueCustomerCard } from '../src/lib/cards.ts';
import {
  getOrder,
  orderAccessToken,
  orderUrlForBuyerEmail,
  verifyOrderAccessToken,
  type OrderRow,
} from '../src/lib/orders.ts';
import {
  awardReferralVouchers,
  listUnredeemedVouchers,
  setReferralRewardSettings,
} from '../src/lib/referrals.ts';
import { makeEventWithTier, makeOrganizer, makePaidOrder } from './helpers.ts';

const VICTIM = 'victim@example.test';

interface World {
  organizerId: string;
  eventId: string;
  tierId: string;
  /** The victim's own paid order — the one their confirmation email links to. */
  victimOrder: OrderRow;
  /** The voucher code the victim is holding, which must never leak. */
  voucherCode: string;
  /** The victim's card code, which is the whole secret behind /c/<code>. */
  cardCode: string;
}

/**
 * A seller who thanks referrers, a victim who has earned one voucher and holds
 * a card, and nothing else. Everything goes through the real lib functions, so
 * a break anywhere in the chain shows up here as a missing secret rather than
 * as a test that quietly asserts against nothing.
 */
function world(): World {
  const organizer = makeOrganizer();
  const { event, tier } = makeEventWithTier({ organizerId: organizer.id }, { priceCents: 5000 });
  // One friend is enough for a voucher, so the fixture stays two orders long.
  setReferralRewardSettings(organizer.id, 1, 500);

  const victimOrder = makePaidOrder({
    eventId: event.id,
    items: [{ tierId: tier.tierKey, quantity: 1 }],
    buyerEmail: VICTIM,
  }).order;

  // A friend books through the victim's share link and pays — the real way a
  // voucher comes into existence.
  const friend = makePaidOrder({
    eventId: event.id,
    items: [{ tierId: tier.tierKey, quantity: 1 }],
    buyerEmail: 'friend@example.test',
    referredBy: victimOrder.shareCode,
  }).order;
  awardReferralVouchers(friend.id);

  const vouchers = listUnredeemedVouchers(organizer.id, VICTIM);
  assert.equal(vouchers.length, 1, 'fixture: the victim should be holding exactly one voucher');

  const card = issueCustomerCard({ organizerId: organizer.id, email: VICTIM });

  return {
    organizerId: organizer.id,
    eventId: event.id,
    tierId: tier.tierKey,
    victimOrder,
    voucherCode: vouchers[0].code,
    cardCode: card.cardCode,
  };
}

/** The attack: an order on the seller's listing carrying the victim's address. */
function attackerOrder(w: World): OrderRow {
  return makePaidOrder({
    eventId: w.eventId,
    items: [{ tierId: w.tierId, quantity: 1 }],
    buyerName: 'Not The Victim',
    buyerEmail: VICTIM,
  }).order;
}

// =================================================================
// 1. The attack itself
// =================================================================

test('an order created with somebody else’s address exposes none of their vouchers', () => {
  const w = world();
  const view = buyerAccountForOrder(attackerOrder(w), null);

  assert.equal(view.mailboxProven, false);
  assert.equal(view.rewards, null, 'the victim’s referral progress must not be readable');
  // Belt and braces: the code itself must appear nowhere in what the page is
  // handed, however the view is later reshaped.
  assert.ok(
    !JSON.stringify(view).includes(w.voucherCode),
    'the victim’s voucher code leaked into the order page’s data'
  );
});

test('an order created with somebody else’s address exposes none of their card', () => {
  const w = world();
  const view = buyerAccountForOrder(attackerOrder(w), null);

  assert.equal(view.card, null, 'the victim’s card must not be readable');
  assert.ok(
    !JSON.stringify(view).includes(w.cardCode),
    'the victim’s card code leaked — it is the only secret guarding /c/<cardCode>'
  );
});

test('the order id is not itself a key to the account behind the address', () => {
  const w = world();
  const attacker = attackerOrder(w);
  // Everything the attacker holds: the id they were handed at creation, its
  // prefix (the payment reference), and the victim's address they typed in.
  for (const guess of [attacker.id, attacker.id.slice(0, 8), VICTIM, '', 'x'.repeat(64)]) {
    assert.equal(verifyOrderAccessToken(attacker.id, guess), false, `accepted ${JSON.stringify(guess)}`);
    assert.equal(buyerAccountForOrder(attacker, guess).rewards, null);
    assert.equal(buyerAccountForOrder(attacker, guess).card, null);
  }
});

test('a token for one order does not open another order', () => {
  const w = world();
  const attacker = attackerOrder(w);
  // The victim's own token — the strongest thing an attacker could get hold
  // of short of the mailbox — must not unlock a different order, and the
  // attacker's own order must not be unlocked by anything but its own token.
  const victimToken = orderAccessToken(w.victimOrder.id)!;
  assert.equal(verifyOrderAccessToken(attacker.id, victimToken), false);
  assert.equal(buyerAccountForOrder(attacker, victimToken).mailboxProven, false);
  assert.equal(buyerAccountForOrder(attacker, victimToken).card, null);
});

// =================================================================
// 2. The legitimate buyer still gets everything
// =================================================================

test('the real buyer, arriving from their confirmation email, sees their vouchers and card', () => {
  const w = world();
  const token = orderAccessToken(w.victimOrder.id)!;
  const view = buyerAccountForOrder(w.victimOrder, token);

  assert.equal(view.mailboxProven, true);
  assert.equal(view.rewards?.paidReferrals, 1);
  assert.deepEqual(view.rewards?.vouchers.map((v) => v.code), [w.voucherCode]);
  assert.equal(view.card?.cardCode, w.cardCode);
});

test('the link the ticket email carries is the link that works', () => {
  const w = world();
  // The token is not re-derived here: whatever orderUrlForBuyerEmail() puts in
  // the mail is pulled back out and fed to the verifier, so the two halves
  // cannot drift apart without this failing.
  const url = orderUrlForBuyerEmail(w.victimOrder.id);
  const token = new URL(url).searchParams.get('token');
  assert.ok(token, 'the mailed order link must carry a token');
  assert.equal(new URL(url).pathname, `/order/${w.victimOrder.id}`);
  assert.equal(buyerAccountForOrder(w.victimOrder, token).card?.cardCode, w.cardCode);
});

// =================================================================
// 3. The write side: nobody gets a card they did not ask for
// =================================================================

test('a stranger cannot conjure a customer card in the victim’s name', () => {
  const organizer = makeOrganizer();
  const { event, tier } = makeEventWithTier({ organizerId: organizer.id }, { priceCents: 5000 });
  const attacker = makePaidOrder({
    eventId: event.id,
    items: [{ tierId: tier.tierKey, quantity: 1 }],
    buyerEmail: VICTIM,
  }).order;

  assert.equal(issueCardForOrder(attacker.id, null), null);
  assert.equal(issueCardForOrder(attacker.id, attacker.id), null);
  assert.equal(
    getCustomerCard(organizer.id, VICTIM),
    null,
    'a card was created for an address whose mailbox nobody proved'
  );
});

test('a closed card cannot be reopened by a stranger, only by its owner', () => {
  const w = world();
  // Closing DESTROYS the code on purpose (see lib/cards.ts). Re-issuing mints
  // a NEW one, so an attacker who could trigger it would both create a card
  // the person had deliberately closed and hand themselves its fresh secret.
  assert.equal(closeCustomerCard(w.cardCode), true);
  const attacker = attackerOrder(w);
  assert.equal(issueCardForOrder(attacker.id, null), null);
  assert.equal(getCustomerCard(w.organizerId, VICTIM), null);

  // The owner, from their own email link, still can.
  const reissued = issueCardForOrder(w.victimOrder.id, orderAccessToken(w.victimOrder.id));
  assert.ok(reissued, 'the buyer who proved the mailbox must still be able to keep a card');
  assert.notEqual(reissued.cardCode, w.cardCode, 'a re-issued card must be a new secret');
});

// =================================================================
// 4. The other doors that must stay shut even with a valid token
// =================================================================

test('an unpaid order shows no account data even with its own valid token', () => {
  const w = world();
  const pending = getOrder(w.victimOrder.id)!;
  // Same order, walked back to the state it was in before the seller
  // confirmed the money. Nothing on the account side is a thank-you for a
  // purchase that has not happened.
  const unpaid: OrderRow = { ...pending, status: 'pending' };
  const view = buyerAccountForOrder(unpaid, orderAccessToken(unpaid.id));
  assert.equal(view.mailboxProven, false);
  assert.equal(view.rewards, null);
  assert.equal(view.card, null);
});

test('an erased buyer shows no account data even with a valid token', () => {
  const w = world();
  // After the retention sweep the address on the row is a shared placeholder,
  // so anything keyed off it would be a crowd of strangers rather than one
  // person — see lib/retention.ts.
  const erased: OrderRow = { ...w.victimOrder, buyerErasedAt: '2026-01-01 00:00:00' };
  const view = buyerAccountForOrder(erased, orderAccessToken(erased.id));
  assert.equal(view.rewards, null);
  assert.equal(view.card, null);
  assert.equal(view.cardPossible, false, 'nothing to offer, so nothing to explain');
});
