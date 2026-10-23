/**
 * lib/payout.ts — the waiting period, and who the money is quoted to while it runs.
 *
 * This module is not about correctness of a number; it is about TIME. The whole
 * defence against a stolen portal session is that a new IBAN does not become
 * the answer the moment it is typed: the old account keeps being quoted for a
 * day, the organizer gets an alarm, and there is a "no, that was not me" button
 * that still works. Remove the delay and every other control here still passes
 * its own tests while the money moves quietly.
 *
 * So three things are pinned, and each is pinned twice — once as the constant,
 * once as the behaviour that depends on it:
 *
 *   1. PAYOUT_DELAY_MS is a real interval, not zero and not a token minute.
 *   2. A change queued the way the portal queues it is NOT the effective
 *      account until its moment passes — and IS the moment it does.
 *   3. Buyers, all the way through the wait, are given the OLD account, and an
 *      order created during the wait freezes the OLD one onto itself for good.
 *
 * Rule 3 goes through the real createOrder rather than calling effectivePayout
 * twice: the buyer-facing promise is about what lands in the order's snapshot
 * columns, and a test that only asked the function would still pass if the
 * checkout stopped asking it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyQueuedPayoutNow,
  cancelQueuedPayoutChange,
  effectivePayout,
  isValidIban,
  livePayout,
  lockPayoutChanges,
  parkedPayout,
  payoutChangeIsDelayed,
  queuePayoutChange,
  queuedChangeKeepsDestination,
  queuedPayoutChange,
  settleDuePayout,
  PAYOUT_DELAY_MS,
  type PayoutAccount,
} from '../src/lib/payout.ts';
import { getEventById } from '../src/lib/events.ts';
import { getOrder } from '../src/lib/orders.ts';
import { db, makeEventWithTier, makeOrder, makePaidOrder } from './helpers.ts';

/** The organizer's real account, and the one an attacker would swap it for. */
const OLD: PayoutAccount = {
  holder: 'Dashain Nights UG',
  iban: 'DE02120300000000202051',
  bic: 'BYLADEM1001',
  bankName: 'Test Bank',
  paypal: '',
};
const NEW: PayoutAccount = {
  holder: 'Somebody Else',
  iban: 'NL91ABNA0417164300',
  bic: 'ABNANL2A',
  bankName: 'Other Bank',
  paypal: '',
};

/** An event that has sold before, with OLD as its live account. */
function eventWithOldAccount() {
  const { event, tier } = makeEventWithTier(
    {
      payout: {
        bankAccountHolder: OLD.holder,
        bankIban: OLD.iban,
        bankBic: OLD.bic,
        bankName: OLD.bankName,
        paypalAccount: OLD.paypal,
      },
      totalCapacity: 200,
    },
    { priceCents: 2000, cap: 100 }
  );
  lockPayoutChanges(event.id);
  return { event: getEventById(event.id)!, tier };
}

/**
 * Queue a change the way PATCH /api/portal/events/[id] queues one.
 *
 * `Date.now() + PAYOUT_DELAY_MS` is copied from that route on purpose: it is
 * what makes the constant load-bearing here rather than merely asserted. A
 * PAYOUT_DELAY_MS of zero turns every "not yet" assertion below red, which is
 * exactly the alarm that was missing.
 */
function queueLikeThePortal(eventId: string, next: PayoutAccount = NEW): number {
  const effectiveAt = Date.now() + PAYOUT_DELAY_MS;
  queuePayoutChange(eventId, next, effectiveAt);
  return effectiveAt;
}

const reread = (eventId: string) => getEventById(eventId)!;

// ---------------------------------------------------------------------------
// The delay itself
// ---------------------------------------------------------------------------

test('the waiting period is a full day — a real interval, not zero', () => {
  // The exact value, because the comment in payout.ts argues for a DAY
  // specifically: long enough that an organizer asleep or at the venue still
  // gets a chance to see the alarm.
  assert.equal(PAYOUT_DELAY_MS, 24 * 60 * 60 * 1000);
  // And the property that value exists for, stated separately so a future
  // retune to (say) 12 hours has to be a deliberate edit of the line above
  // rather than something that silently collapses toward nothing.
  assert.ok(PAYOUT_DELAY_MS >= 60 * 60 * 1000, 'a waiting period under an hour defends nobody');
});

// ---------------------------------------------------------------------------
// Before, at, and after the moment
// ---------------------------------------------------------------------------

test('a change queued now is NOT the effective account — the old one still is', () => {
  const { event } = eventWithOldAccount();
  queueLikeThePortal(event.id);

  const row = reread(event.id);
  assert.deepEqual(effectivePayout(row), OLD);
  // Parked, visible, and warnable — the change exists, it simply is not the
  // answer yet. Without this pair, "returns OLD" could mean the change was
  // never written at all.
  assert.equal(parkedPayout(row)?.iban, NEW.iban);
  assert.equal(queuedPayoutChange(row)?.iban, NEW.iban);
  assert.deepEqual(livePayout(row), OLD);
});

test('the effective account only flips once the moment has actually passed', () => {
  const { event } = eventWithOldAccount();

  // A minute short of the deadline: still the old account. This is the shape of
  // the whole defence — one instant before maturity behaves exactly like the
  // first instant of the wait.
  queuePayoutChange(event.id, NEW, Date.now() + 60_000);
  assert.deepEqual(effectivePayout(reread(event.id)), OLD);

  // At the moment itself (effectiveAt <= now), and after it.
  queuePayoutChange(event.id, NEW, Date.now());
  assert.deepEqual(effectivePayout(reread(event.id)), NEW);

  queuePayoutChange(event.id, NEW, Date.now() - 1);
  assert.deepEqual(effectivePayout(reread(event.id)), NEW);
  // Matured means no longer a WARNING — the two readers must not both claim it.
  assert.equal(queuedPayoutChange(reread(event.id)), null);
});

test('maturity is decided by the clock, not by settleDuePayout having run', () => {
  const { event } = eventWithOldAccount();
  queuePayoutChange(event.id, NEW, Date.now() - 1);

  // Already the answer before any housekeeping.
  assert.deepEqual(effectivePayout(reread(event.id)), NEW);
  settleDuePayout(event.id);
  // And the tidy-up changes nothing observable — it only folds the parked
  // columns into the live ones.
  const after = reread(event.id);
  assert.deepEqual(effectivePayout(after), NEW);
  assert.deepEqual(livePayout(after), NEW);
  assert.equal(parkedPayout(after), null);
});

test('settleDuePayout refuses to fold a change that has not matured', () => {
  const { event } = eventWithOldAccount();
  queueLikeThePortal(event.id);

  settleDuePayout(event.id);

  const after = reread(event.id);
  assert.deepEqual(livePayout(after), OLD);
  assert.equal(parkedPayout(after)?.iban, NEW.iban);
  assert.deepEqual(effectivePayout(after), OLD);
});

test('cancelling during the wait leaves the old account untouched and the queue empty', () => {
  const { event } = eventWithOldAccount();
  queueLikeThePortal(event.id);

  cancelQueuedPayoutChange(event.id);

  const after = reread(event.id);
  assert.equal(parkedPayout(after), null);
  assert.equal(queuedPayoutChange(after), null);
  assert.deepEqual(effectivePayout(after), OLD);
});

test('the delay is owed to an event that has EVER been able to take money, whatever its status now', () => {
  // A brand-new listing that has never sold owes nobody a wait — a first-time
  // setup must not take a day.
  const fresh = makeEventWithTier().event;
  assert.equal(payoutChangeIsDelayed(reread(fresh.id)), false);

  const { event } = eventWithOldAccount();
  assert.equal(payoutChangeIsDelayed(reread(event.id)), true);

  // Unpublishing does not clear the flag: "unpublish, change, republish" must
  // not be a way around the whole mechanism.
  db().prepare(`UPDATE events SET status = 'draft' WHERE id = ?`).run(event.id);
  assert.equal(payoutChangeIsDelayed(reread(event.id)), true);
});

// ---------------------------------------------------------------------------
// What buyers are told while the wait runs
// ---------------------------------------------------------------------------

test('buyers are quoted the OLD account for the whole waiting period', () => {
  const { event, tier } = eventWithOldAccount();
  const effectiveAt = queueLikeThePortal(event.id);

  // Sampled across the wait rather than only at its start: re-queueing the same
  // change with a nearer deadline is the same row an hour later would be.
  for (const remaining of [PAYOUT_DELAY_MS, PAYOUT_DELAY_MS / 2, 60_000, 1_000]) {
    queuePayoutChange(event.id, NEW, Date.now() + remaining);
    const row = reread(event.id);
    assert.deepEqual(effectivePayout(row), OLD, `${remaining}ms before the change is due`);

    // The buyer-facing half: a real order created at this instant freezes the
    // OLD account onto itself.
    const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
    const stored = getOrder(order.id)!;
    assert.equal(stored.payoutIban, OLD.iban, `order IBAN ${remaining}ms before the change is due`);
    assert.equal(stored.payoutHolder, OLD.holder);
  }

  assert.ok(effectiveAt > Date.now(), 'the portal really did park it in the future');
});

test('an order made during the wait keeps the old account even after the change lands', () => {
  const { event, tier } = eventWithOldAccount();
  queueLikeThePortal(event.id);

  const during = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  assert.equal(getOrder(during.id)!.payoutIban, OLD.iban);

  // The wait ends.
  queuePayoutChange(event.id, NEW, Date.now() - 1);
  assert.deepEqual(effectivePayout(reread(event.id)), NEW);

  // New buyers get the new account; the buyer who already holds instructions
  // keeps theirs. Both halves matter: the first proves the change ever takes
  // effect, the second that it cannot reach backwards.
  const after = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  assert.equal(getOrder(after.id)!.payoutIban, NEW.iban);
  assert.equal(getOrder(during.id)!.payoutIban, OLD.iban);
});

// ---------------------------------------------------------------------------
// The account has to be an account at all
// ---------------------------------------------------------------------------

test('an IBAN with a broken checksum is not a payout account', () => {
  // The two check digits are the only thing standing between a transposed pair
  // of digits and money arriving at somebody real.
  assert.equal(isValidIban('DE02 1203 0000 0000 2020 51'), true);
  assert.equal(isValidIban('DE00 0000 0000 0000 0000 00'), false);
  assert.equal(isValidIban('DE02120300000000202015'), false); // last two transposed
  assert.equal(isValidIban('DE0212030000000020205'), false); // one short for DE
  assert.equal(isValidIban('NL91ABNA0417164300'), true);
  assert.equal(isValidIban(''), true); // "not set yet" is a different question
});

// ---------------- The owner's early approval ----------------

test('owner can apply a holder-name fix early; same IBAN, unpaid orders get the corrected name', () => {
  const { event, tier } = eventWithOldAccount();
  const unpaid = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  const { order: paid } = makePaidOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });

  const fixed: PayoutAccount = { ...OLD, holder: 'Dashain Nights GmbH', iban: 'de02 1203 0000 0000 2020 51' };
  queuePayoutChange(event.id, fixed, Date.now() + PAYOUT_DELAY_MS);
  const queued = getEventById(event.id)!;
  assert.equal(queuedChangeKeepsDestination(queued), true);

  const updated = applyQueuedPayoutNow(event.id, queued, event.organizerId);
  assert.equal(updated, 1);

  const after = getEventById(event.id)!;
  assert.equal(after.bankAccountHolder, 'Dashain Nights GmbH');
  assert.equal(after.pendingPayoutEffectiveAt, null);
  assert.equal(getOrder(unpaid.id)!.payoutHolder, 'Dashain Nights GmbH');
  assert.equal(getOrder(paid.id)!.payoutHolder, OLD.holder, 'a paid order keeps what it was told');
});

test('owner can NOT apply early when the IBAN changes', () => {
  const { event } = eventWithOldAccount();
  queuePayoutChange(event.id, NEW, Date.now() + PAYOUT_DELAY_MS);
  const queued = getEventById(event.id)!;
  assert.equal(queuedChangeKeepsDestination(queued), false);
  assert.throws(() => applyQueuedPayoutNow(event.id, queued, event.organizerId));
  assert.equal(effectivePayout(getEventById(event.id)!).iban, OLD.iban);
});
