/**
 * TENANT ISOLATION AND PRIVACY.
 *
 * Every other suite here asks "is the arithmetic right?". This one asks the
 * question that has no second chance: does one seller's page ever show another
 * seller's people? A wrong total is embarrassing and fixable. A buyer list that
 * quietly grew somebody else's customers is a breach, and no later release
 * un-shows it.
 *
 * So the world below is built to LOOK like it should leak. Two organizers with
 * the same-shaped listings, the same tier keys, the same promo code string, and
 * — the part that actually catches dropped WHERE clauses — literally the SAME
 * BUYERS: ana@ and bob@ shop with both sellers. A query that forgets its
 * organizer scope does not return an empty list here, it returns a plausible
 * one with the wrong numbers in it. That is why the assertions below are
 * numbers (`totalPaidCents === 2000`) rather than "some rows came back": the
 * only thing that distinguishes "correctly scoped" from "leaking" in this
 * fixture is the value.
 *
 * The shared world's events are all dated in the FUTURE on purpose. The
 * retention sweep is global — it walks every order in the database — so the
 * erasure tests at the bottom must be the only rows it can find, or they would
 * quietly erase the world the isolation tests above are still reading.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// The scan-token tests sign real HMACs, and lib/auth reads this lazily on every
// call (never at import time), so setting it here is early enough. Without it
// getSecret() returns null outside production and createScanToken refuses.
process.env.APP_SECRET = 'tenancy-test-secret';

import { db, makeEvent, makeOrder, makeOrganizer, makePaidOrder, makePromo, makeTier } from './helpers.ts';
import { bumpScanEpoch, createScanToken, verifyScanToken } from '../src/lib/auth.ts';
import {
  listBuyers,
  paymentSplit,
  returningBuyerCount,
  salesByDay,
  topReferrers,
  waitlistWaitingCount,
} from '../src/lib/analytics.ts';
import {
  cardAtCounter,
  cardOrderCount,
  cardOrders,
  cardView,
  closeCustomerCard,
  getCardByCode,
  getCustomerCard,
  issueCustomerCard,
} from '../src/lib/cards.ts';
import { getEventMedia, getEventTier, getEventTiers, tierPhoto } from '../src/lib/events.ts';
import {
  listReviewsForItem,
  listReviewsForOrganizer,
  ratingForItem,
  ratingsForItems,
  setReviewStatus,
  setSellerReply,
  writeReview,
} from '../src/lib/reviews.ts';
import {
  activeConsentCount,
  claimAnnouncementSend,
  confirmMarketingConsent,
  getMarketingConsent,
  listAnnouncementAudience,
  releaseAnnouncementSend,
  requestMarketingConsent,
} from '../src/lib/marketing.ts';
import { checkInTicket, getStats, listOrders, type TicketRow } from '../src/lib/orders.ts';
import { listPromoCodes, promoTotalsForOrganizer, promoUsageForEvent } from '../src/lib/promos.ts';
import { VoucherError } from '../src/lib/referrals.ts';
import {
  BUYER_RETENTION_DAYS,
  ERASED_BUYER_EMAIL,
  ERASED_BUYER_NAME,
  runBuyerDataRetentionSweep,
} from '../src/lib/retention.ts';
import {
  approveStallLink,
  declineStallLink,
  getStallLink,
  listStallLinksForHostEvent,
  requestStallLink,
  withdrawStallLink,
} from '../src/lib/stalls.ts';
import { monthlyStatement } from '../src/lib/statements.ts';
import { joinWaitlist } from '../src/lib/waitlist.ts';

// ---------------- Time helpers ----------------

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** The month a just-confirmed order lands in — paid_at is stamped in UTC. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The label a read model must never print. Both halves, so either one bites. */
function assertNoPlaceholder(where: string, value: unknown): void {
  const json = JSON.stringify(value);
  assert.ok(
    !json.includes(ERASED_BUYER_NAME),
    `${where} printed the erasure placeholder name: ${json}`
  );
  assert.ok(
    !json.includes(ERASED_BUYER_EMAIL),
    `${where} printed the erasure placeholder address: ${json}`
  );
}

// ---------------- The two sellers ----------------

const ANA = { name: 'Ana Sharma', email: 'ana@buyers.test' };
const BOB = { name: 'Bob Thapa', email: 'bob@buyers.test' };

/**
 * One seller, twice over. Same listing shapes, same tier key, same prices —
 * the only difference between Alpha's world and Beta's is who owns it, which
 * is exactly the difference every query in this file is being asked to respect.
 */
function makeSeller(label: string) {
  const organizer = makeOrganizer({ name: `${label} Sounds` });
  const autumn = makeEvent({
    organizerId: organizer.id,
    name: `${label} Autumn`,
    eventDate: isoDaysFromNow(90),
    tiers: [{ tierKey: 'ga', name: 'General', priceCents: 2000, cap: 50 }],
  });
  const winter = makeEvent({
    organizerId: organizer.id,
    name: `${label} Winter`,
    eventDate: isoDaysFromNow(180),
    tiers: [{ tierKey: 'ga', name: 'General', priceCents: 2000, cap: 50 }],
  });
  return { organizer, autumn, winter };
}

const alpha = makeSeller('Alpha');
const beta = makeSeller('Beta');

// Alpha's sales. Ana buys at BOTH Alpha listings (she is Alpha's returning
// buyer); Bob buys two seats at Alpha Autumn and one at Beta — he must never
// count as returning for either.
const anaAtAlphaAutumn = makePaidOrder({
  eventId: alpha.autumn.id,
  items: [{ tierId: 'ga', quantity: 1 }],
  buyerName: ANA.name,
  buyerEmail: ANA.email,
});
makePaidOrder({
  eventId: alpha.winter.id,
  items: [{ tierId: 'ga', quantity: 1 }],
  buyerName: ANA.name,
  buyerEmail: ANA.email,
});
makePaidOrder({
  eventId: alpha.autumn.id,
  items: [{ tierId: 'ga', quantity: 2 }],
  buyerName: BOB.name,
  buyerEmail: BOB.email,
});
// Carol arrived through Ana's Alpha link — Alpha's one real referral.
makePaidOrder({
  eventId: alpha.autumn.id,
  items: [{ tierId: 'ga', quantity: 1 }],
  buyerName: 'Carol Gurung',
  buyerEmail: 'carol@buyers.test',
  referredBy: anaAtAlphaAutumn.order.shareCode,
});

// Beta's sales: the same two people, different amounts, plus Beta's own
// referral chain under the very same person.
const anaAtBetaAutumn = makePaidOrder({
  eventId: beta.autumn.id,
  items: [{ tierId: 'ga', quantity: 3 }],
  buyerName: ANA.name,
  buyerEmail: ANA.email,
});
makePaidOrder({
  eventId: beta.autumn.id,
  items: [{ tierId: 'ga', quantity: 1 }],
  buyerName: BOB.name,
  buyerEmail: BOB.email,
});
makePaidOrder({
  eventId: beta.autumn.id,
  items: [{ tierId: 'ga', quantity: 1 }],
  buyerName: 'Dina Rai',
  buyerEmail: 'dina@buyers.test',
  referredBy: anaAtBetaAutumn.order.shareCode,
});

// ---------------- Analytics ----------------

test('a seller\'s buyer list contains only the buyers of their own listing', () => {
  const buyers = listBuyers(alpha.autumn.id);
  assert.deepEqual(
    buyers.map((b) => b.email).sort(),
    ['ana@buyers.test', 'bob@buyers.test', 'carol@buyers.test'],
    'Dina bought from Beta and must not appear on an Alpha page'
  );
  const beta_ = listBuyers(beta.autumn.id);
  assert.deepEqual(
    beta_.map((b) => b.email).sort(),
    ['ana@buyers.test', 'bob@buyers.test', 'dina@buyers.test'],
    'Carol bought from Alpha and must not appear on a Beta page'
  );
});

test('a buyer who shops with both sellers is counted separately by each, never summed', () => {
  // The assertion that actually bites: Ana spent 2000 at this listing and 6000
  // at Beta's. A query that lost its event/organizer scope returns her here
  // with a bigger, entirely plausible number.
  const ana = listBuyers(alpha.autumn.id).find((b) => b.email === ANA.email)!;
  assert.equal(ana.orders, 1);
  assert.equal(ana.units, 1);
  assert.equal(ana.totalPaidCents, 2000);

  const anaAtBeta = listBuyers(beta.autumn.id).find((b) => b.email === ANA.email)!;
  assert.equal(anaAtBeta.orders, 1);
  assert.equal(anaAtBeta.units, 3);
  assert.equal(anaAtBeta.totalPaidCents, 6000);

  // And the seats: Bob's two Alpha seats are two, not the three he holds
  // across the platform.
  const bob = listBuyers(alpha.autumn.id).find((b) => b.email === BOB.email)!;
  assert.equal(bob.units, 2);
  assert.equal(bob.totalPaidCents, 4000);
});

test('buying from ANOTHER seller never makes somebody a returning buyer here', () => {
  // Ana bought at Alpha Autumn AND Alpha Winter, so she is Alpha's one
  // returning buyer. Bob bought at Alpha Autumn and at BETA — a different
  // seller's history is not this seller's loyalty.
  assert.equal(returningBuyerCount(alpha.autumn.id, alpha.organizer.id), 1);
  // Beta has sold nothing at their second listing, so nobody has come back to
  // them — even though both of their buyers are regulars somewhere else.
  assert.equal(returningBuyerCount(beta.autumn.id, beta.organizer.id), 0);
});

test('the money on a seller\'s charts is only their own listing\'s money', () => {
  const days = salesByDay(alpha.autumn.id);
  const revenue = days.reduce((s, d) => s + d.revenueCents, 0);
  const orders = days.reduce((s, d) => s + d.ordersPaid, 0);
  assert.equal(revenue, 8000, '2000 (Ana) + 4000 (Bob) + 2000 (Carol)');
  assert.equal(orders, 3);
  assert.deepEqual(paymentSplit(alpha.autumn.id), { transfer: 3, paypal: 0, free: 0 });
  assert.deepEqual(paymentSplit(beta.autumn.id), { transfer: 3, paypal: 0, free: 0 });
  assert.equal(getStats(alpha.autumn.id).revenueCents, 8000);
});

test('a referral code minted by another seller\'s buyer names nobody in this seller\'s chain', () => {
  // The forged case: a code that IS somebody's — Ana's, at Beta — typed into
  // an Alpha checkout. Alpha may see that a booking arrived through a link;
  // Alpha may NOT be told whose, because that person is Beta's customer.
  makePaidOrder({
    eventId: alpha.autumn.id,
    items: [{ tierId: 'ga', quantity: 1 }],
    buyerName: 'Elin Magar',
    buyerEmail: 'elin@buyers.test',
    referredBy: anaAtBetaAutumn.order.shareCode,
  });

  const chain = topReferrers(alpha.autumn.id);
  const json = JSON.stringify(chain);
  assert.ok(!json.includes(ANA.email), 'a foreign referrer\'s address must not appear');
  assert.ok(!json.includes('Dina Rai'), 'nor anyone from the other seller\'s chain');

  // Ana's ALPHA code is hers with Alpha, so that row is correctly named.
  const named = chain.referrers.find((r) => r.name === ANA.name);
  assert.ok(named, 'Ana referred Carol at Alpha and must be named for it');
  assert.equal(named.referredOrders, 1);
  assert.deepEqual(named.bookings.map((b) => b.name), ['Carol Gurung']);

  // The Beta code resolves to nobody Alpha is allowed to know.
  const anonymous = chain.referrers.find((r) => r.name === 'a past guest');
  assert.ok(anonymous, 'the foreign code still counts, as an unnamed referrer');
  assert.equal(anonymous.referredOrders, 1);
  assert.deepEqual(anonymous.bookings.map((b) => b.name), ['Elin Magar']);

  // And the reverse direction, so this is not an accident of who was built first.
  const betaChain = topReferrers(beta.autumn.id);
  assert.deepEqual(betaChain.referrers.map((r) => r.name), [ANA.name]);
  assert.deepEqual(betaChain.referrers[0].bookings.map((b) => b.name), ['Dina Rai']);
  assert.ok(!JSON.stringify(betaChain).includes('Carol Gurung'));
});

test('the waiting count on a listing counts only that listing\'s waitlist', () => {
  joinWaitlist(alpha.winter.id, 'hopeful@buyers.test');
  joinWaitlist(alpha.winter.id, 'patient@buyers.test');
  joinWaitlist(beta.winter.id, 'other@buyers.test');
  assert.equal(waitlistWaitingCount(alpha.winter.id), 2);
  assert.equal(waitlistWaitingCount(beta.winter.id), 1);
});

// ---------------- Statements ----------------

test('a monthly statement contains only the money that reached THIS seller\'s accounts', () => {
  const month = currentMonth();
  const alphaStatement = monthlyStatement(alpha.organizer.id, month);
  const betaStatement = monthlyStatement(beta.organizer.id, month);

  const alphaEvents = new Set(alphaStatement.sections.map((s) => s.eventId));
  assert.deepEqual([...alphaEvents].sort(), [alpha.autumn.id, alpha.winter.id].sort());
  const betaEvents = new Set(betaStatement.sections.map((s) => s.eventId));
  assert.deepEqual([...betaEvents].sort(), [beta.autumn.id].sort());

  // Alpha: 2000 + 4000 + 2000 (Autumn) + 2000 (Carol's referred order was
  // Autumn too) ... spelled out rather than derived, so a leak changes it.
  const alphaLines = alphaStatement.sections.flatMap((s) => s.lines);
  const betaLines = betaStatement.sections.flatMap((s) => s.lines);
  const alphaIds = new Set(alphaLines.map((l) => l.orderId));
  const betaIds = new Set(betaLines.map((l) => l.orderId));
  for (const id of betaIds) {
    assert.ok(!alphaIds.has(id), 'no order may be booked to two sellers');
  }

  assert.deepEqual(alphaStatement.totals, [{ currency: 'EUR', cents: 12_000 }]);
  assert.deepEqual(betaStatement.totals, [{ currency: 'EUR', cents: 10_000 }]);
});

test('a statement never names a buyer at all — not even before erasure', () => {
  // Bookkeeping outlives retention, so the statement is built from columns the
  // sweep cannot touch. If a name ever appears here it would go stale (and
  // then wrong) the day the sweep runs.
  const statement = monthlyStatement(alpha.organizer.id, currentMonth());
  const json = JSON.stringify(statement);
  for (const person of [ANA.name, ANA.email, BOB.name, BOB.email, 'Carol Gurung', 'carol@buyers.test']) {
    assert.ok(!json.includes(person), `the statement leaked ${person}`);
  }
});

// ---------------- Discount codes ----------------

test('two sellers may mint the SAME code string and neither can see the other\'s', () => {
  const alphaCode = makePromo(alpha.organizer.id, { code: 'DASHAIN10', percent: 10 });
  const betaCode = makePromo(beta.organizer.id, { code: 'DASHAIN10', percent: 50 });
  assert.notEqual(alphaCode.id, betaCode.id);

  const alphaList = listPromoCodes(alpha.organizer.id);
  assert.deepEqual(alphaList.map((p) => p.id), [alphaCode.id]);
  assert.equal(alphaList[0].percent, 10, 'and not the neighbour\'s 50');
  assert.deepEqual(listPromoCodes(beta.organizer.id).map((p) => p.id), [betaCode.id]);

  assert.equal(promoTotalsForOrganizer(alpha.organizer.id).minted, 1);
  assert.equal(promoTotalsForOrganizer(beta.organizer.id).minted, 1);
});

test('a code minted by one seller buys nothing at another seller\'s checkout', () => {
  const betaOnly = makePromo(beta.organizer.id, { code: 'BETAONLYX', kind: 'fixed', amountCents: 500 });

  assert.throws(
    () =>
      makeOrder({
        eventId: alpha.autumn.id,
        items: [{ tierId: 'ga', quantity: 1 }],
        buyerEmail: 'thief@buyers.test',
        voucherCode: 'BETAONLYX',
      }),
    (e: unknown) => e instanceof VoucherError,
    'Beta\'s code must be refused at Alpha\'s till'
  );

  // Refused means REFUSED, not "counted and then rejected": Beta's cap is
  // untouched, so a stranger cannot burn a seller's redemptions from outside.
  const [reread] = listPromoCodes(beta.organizer.id).filter((p) => p.id === betaOnly.id);
  assert.equal(reread.redeemedCount, 0);
  assert.equal(promoTotalsForOrganizer(beta.organizer.id).redeemed, 0);
  // And it discounted nothing on Alpha's books.
  assert.deepEqual(promoUsageForEvent(alpha.autumn.id), { orders: 0, discountCents: 0 });
});

// ---------------- Photos ----------------

/** RAW SQL: there is no lib constructor for a media row (the upload route writes it inline). */
function makePhoto(eventId: string, fileName: string): string {
  const id = crypto.randomUUID();
  db()
    .prepare(`INSERT INTO event_media (id, event_id, file_name, mime, sort) VALUES (?, ?, ?, 'image/jpeg', 0)`)
    .run(id, eventId, fileName);
  return id;
}

test('a tier\'s photo id can never resolve to another listing\'s picture', () => {
  const ownPhoto = makePhoto(alpha.autumn.id, 'alpha-own.jpg');
  const foreignPhoto = makePhoto(beta.autumn.id, 'beta-secret.jpg');

  // The positive control first, so "returns null" below cannot pass by simply
  // never resolving anything.
  db().prepare(`UPDATE event_tiers SET media_id = ? WHERE event_id = ? AND tier_key = 'ga'`)
    .run(ownPhoto, alpha.autumn.id);
  const withOwn = getEventTier(alpha.autumn.id, 'ga')!;
  assert.equal(tierPhoto(withOwn, getEventMedia(alpha.autumn.id))?.id, ownPhoto);

  // Now the stale/hand-edited pointer at somebody else's upload.
  db().prepare(`UPDATE event_tiers SET media_id = ? WHERE event_id = ? AND tier_key = 'ga'`)
    .run(foreignPhoto, alpha.autumn.id);
  const withForeign = getEventTier(alpha.autumn.id, 'ga')!;
  assert.equal(withForeign.mediaId, foreignPhoto, 'the row really does point across the boundary');
  assert.equal(
    tierPhoto(withForeign, getEventMedia(alpha.autumn.id)),
    null,
    'and the resolver refuses to follow it'
  );

  // The listing\'s own photo list never contained it in the first place.
  assert.deepEqual(getEventMedia(alpha.autumn.id).map((p) => p.id), [ownPhoto]);

  // Leave the fixture clean for anything that reads tiers later.
  db().prepare(`UPDATE event_tiers SET media_id = NULL WHERE event_id = ? AND tier_key = 'ga'`)
    .run(alpha.autumn.id);
});

// ---------------- Scanning ----------------

test('a ticket from one listing is refused at another listing\'s door, with no details attached', () => {
  const { tickets } = makePaidOrder({
    eventId: alpha.autumn.id,
    items: [{ tierId: 'ga', quantity: 1 }],
    buyerName: 'Gita Shrestha',
    buyerEmail: 'gita@buyers.test',
  });
  const code = tickets[0].code;

  const wrong = checkInTicket(code, { eventId: beta.autumn.id });
  assert.equal(wrong.result, 'wrong_event');
  assert.equal(wrong.ticket, undefined, 'a refused scan hands back NO buyer data');
  assert.ok(!JSON.stringify(wrong).includes('Gita'));

  // Refusing did not consume the ticket, and its own door still works.
  const right = checkInTicket(code, { eventId: alpha.autumn.id });
  assert.equal(right.result, 'ok');
  assert.equal(right.ticket?.buyerName, 'Gita Shrestha');

  // Once used, the foreign door still says 'wrong_event' — never
  // 'already_checked_in', which would confirm the code is real and spent.
  const again = checkInTicket(code, { eventId: beta.autumn.id });
  assert.equal(again.result, 'wrong_event');
  assert.equal(again.ticket, undefined);
});

test('a scanner link grants exactly one listing, and revoking it leaves other listings alone', () => {
  const alphaToken = createScanToken(alpha.autumn.id, 4);
  const betaToken = createScanToken(beta.autumn.id, 4);

  assert.deepEqual(verifyScanToken(alphaToken), { eventId: alpha.autumn.id });
  assert.deepEqual(verifyScanToken(betaToken), { eventId: beta.autumn.id });

  // A token cannot be re-aimed: swapping the event id in the payload breaks
  // the MAC, so door staff of one listing can never scan at another.
  const parts = alphaToken.split('.');
  const reaimed = [parts[0], parts[1], beta.autumn.id, parts[3]].join('.');
  assert.equal(verifyScanToken(reaimed), null);

  // Epochs are per listing: revoking Alpha's scanner links must not log out
  // Beta's door staff.
  bumpScanEpoch(alpha.autumn.id);
  assert.equal(verifyScanToken(alphaToken), null);
  assert.deepEqual(verifyScanToken(betaToken), { eventId: beta.autumn.id });
});

// ---------------- Customer cards ----------------

test('a customer card is per-seller: one address holds two unrelated cards', () => {
  const withAlpha = issueCustomerCard({ organizerId: alpha.organizer.id, email: ANA.email });
  const withBeta = issueCustomerCard({ organizerId: beta.organizer.id, email: ANA.email });

  assert.notEqual(withAlpha.id, withBeta.id);
  assert.notEqual(withAlpha.cardCode, withBeta.cardCode, 'two cards, two secrets');
  assert.equal(getCustomerCard(alpha.organizer.id, ANA.email)!.id, withAlpha.id);
  assert.equal(getCustomerCard(beta.organizer.id, ANA.email)!.id, withBeta.id);

  // The history behind each card stops at its own seller. Ana has TWO
  // confirmed orders with Alpha and ONE with Beta; the platform-wide answer
  // (three) is the one no card may ever give.
  assert.equal(cardOrderCount(withAlpha), 2);
  assert.equal(cardOrderCount(withBeta), 1);
  const alphaEventIds = new Set(cardOrders(withAlpha).map((o) => o.eventId));
  assert.deepEqual([...alphaEventIds].sort(), [alpha.autumn.id, alpha.winter.id].sort());
  assert.deepEqual(cardOrders(withBeta).map((o) => o.eventId), [beta.autumn.id]);

  // And the whole card page read model, not just the order list.
  const view = cardView(withAlpha, alpha.organizer.name);
  assert.equal(view.orders.length, 2);
  assert.ok(!JSON.stringify(view).includes(beta.autumn.id), 'the other seller\'s listing must not appear');
});

test('one seller\'s card is invisible at another seller\'s counter', () => {
  const withAlpha = getCustomerCard(alpha.organizer.id, ANA.email)!;
  assert.equal(
    cardAtCounter(withAlpha.cardCode, beta.organizer.id),
    null,
    'holding somebody else\'s card code buys a rival seller nothing'
  );
  const seen = cardAtCounter(withAlpha.cardCode, alpha.organizer.id);
  assert.ok(seen, 'the owning seller still recognises their own regular');
  assert.equal(seen.confirmedOrders, 2, 'their history with THIS seller, not the platform\'s three');
  assert.equal(seen.email, ANA.email);
});

test('closing a card DELETES it, and touches no other seller\'s card', () => {
  const withAlpha = getCustomerCard(alpha.organizer.id, ANA.email)!;
  const withBeta = getCustomerCard(beta.organizer.id, ANA.email)!;

  assert.equal(closeCustomerCard(withAlpha.cardCode), true);
  assert.equal(getCardByCode(withAlpha.cardCode), null, 'the old QR opens nothing');
  assert.equal(getCustomerCard(alpha.organizer.id, ANA.email), null);
  assert.equal(cardAtCounter(withAlpha.cardCode, alpha.organizer.id), null);

  // Deleted, not flagged: an emptied husk would still be a row about a person
  // who asked to be gone.
  const left = db()
    .prepare(`SELECT COUNT(*) AS n FROM customer_cards WHERE card_code = ?`)
    .get(withAlpha.cardCode) as { n: number };
  assert.equal(left.n, 0);

  // Closing with one seller says nothing to any other.
  assert.equal(getCustomerCard(beta.organizer.id, ANA.email)!.id, withBeta.id);

  // Closing twice is honestly false — "already gone" is not "just closed".
  assert.equal(closeCustomerCard(withAlpha.cardCode), false);

  // A card asked for again is a NEW secret: the destroyed QR must stay dead.
  const reissued = issueCustomerCard({ organizerId: alpha.organizer.id, email: ANA.email });
  assert.notEqual(reissued.cardCode, withAlpha.cardCode);
  assert.equal(getCardByCode(withAlpha.cardCode), null);
});

test('two tabs asking for a card mint ONE secret, not two', () => {
  // The race, as better-sqlite3 lets us see it: both presses arrive, both run
  // the real issuer. UNIQUE(organizer_id, email) is what makes the second one
  // return the first one's row instead of a second private URL for one person.
  const email = 'doubleclick@buyers.test';
  const first = issueCustomerCard({ organizerId: alpha.organizer.id, email });
  const second = issueCustomerCard({ organizerId: alpha.organizer.id, email });
  assert.equal(second.id, first.id);
  assert.equal(second.cardCode, first.cardCode);
  const rows = db()
    .prepare(`SELECT COUNT(*) AS n FROM customer_cards WHERE organizer_id = ? AND email = ?`)
    .get(alpha.organizer.id, email) as { n: number };
  assert.equal(rows.n, 1);

  // The same address at the OTHER seller is a different person's business and
  // gets its own row — the constraint scopes per seller, it does not globally
  // deduplicate people.
  const elsewhere = issueCustomerCard({ organizerId: beta.organizer.id, email });
  assert.notEqual(elsewhere.id, first.id);
});

// ---------------- Announcements ----------------

test('a subscriber gets ONE announcement per listing, whichever press gets there first', () => {
  const email = 'subscriber@buyers.test';
  assert.equal(
    requestMarketingConsent({ organizerId: alpha.organizer.id, email, sourceOrderId: anaAtAlphaAutumn.order.id }),
    'confirmation-needed'
  );
  const pending = getMarketingConsent(alpha.organizer.id, email)!;
  assert.equal(confirmMarketingConsent(alpha.organizer.id, email, pending.consentedAt), true);
  const consent = getMarketingConsent(alpha.organizer.id, email)!;

  // Two racing button presses, exactly as the announce route would interleave
  // them: both read the audience, both try to claim. The claim is what decides.
  const audienceBefore = listAnnouncementAudience(alpha.organizer.id, alpha.winter.id);
  assert.ok(audienceBefore.some((r) => r.id === consent.id));
  assert.equal(claimAnnouncementSend(consent.id, alpha.winter.id), true, 'the first press owns the send');
  assert.equal(claimAnnouncementSend(consent.id, alpha.winter.id), false, 'the loser fails closed');

  // And the audience shrinks by exactly that person, so the count promised and
  // the count sent cannot drift.
  const after = listAnnouncementAudience(alpha.organizer.id, alpha.winter.id);
  assert.ok(!after.some((r) => r.id === consent.id));

  // A FAILED send gives the claim back rather than burning the one email.
  releaseAnnouncementSend(consent.id, alpha.winter.id);
  assert.equal(claimAnnouncementSend(consent.id, alpha.winter.id), true);
});

test('a subscriber of one seller is not on any other seller\'s list', () => {
  const email = 'subscriber@buyers.test';
  // The same address subscribes to Beta too — two separate consents, because
  // the tick was about ONE seller's future listings.
  requestMarketingConsent({ organizerId: beta.organizer.id, email, sourceOrderId: anaAtBetaAutumn.order.id });
  const betaPending = getMarketingConsent(beta.organizer.id, email)!;
  assert.notEqual(betaPending.id, getMarketingConsent(alpha.organizer.id, email)!.id);

  // Alpha's confirmation does not confirm Beta's request.
  assert.equal(betaPending.confirmedAt, null);
  assert.equal(activeConsentCount(beta.organizer.id), 0);
  assert.equal(activeConsentCount(alpha.organizer.id), 1);
  assert.deepEqual(listAnnouncementAudience(beta.organizer.id, beta.winter.id), []);

  // Nor does Alpha's already-sent claim block Beta from ever writing to them.
  confirmMarketingConsent(beta.organizer.id, email, betaPending.consentedAt);
  const betaConsent = getMarketingConsent(beta.organizer.id, email)!;
  assert.deepEqual(
    listAnnouncementAudience(beta.organizer.id, beta.winter.id).map((r) => r.id),
    [betaConsent.id]
  );
  assert.equal(claimAnnouncementSend(betaConsent.id, beta.winter.id), true);
});

// ---------------- Stalls ----------------

const host = makeSeller('Host');
const vendor = makeOrganizer({ name: 'Vendor Pickles' });
const vendorShop = makeEvent({
  organizerId: vendor.id,
  kind: 'shop',
  name: 'Vendor Pickles',
  eventDate: null,
  tiers: [{ tierKey: 'jar', name: 'Pickle jar', priceCents: 1500, cap: 20 }],
});

test('a stall link is decided by the host and withdrawn by the shop — never the other way round', () => {
  const link = requestStallLink(vendor.id, vendorShop.id, host.autumn.id, 'We would love a table');
  assert.equal(link.status, 'requested');

  // A stranger holding the link id gets nothing: every write scopes itself.
  assert.equal(approveStallLink(alpha.organizer.id, link.id), false);
  assert.equal(declineStallLink(alpha.organizer.id, link.id), false);
  assert.equal(withdrawStallLink(alpha.organizer.id, link.id), false);
  // The host cannot use the SHOP's exit, and the shop cannot use the host's.
  assert.equal(withdrawStallLink(host.organizer.id, link.id), false);
  assert.equal(approveStallLink(vendor.id, link.id), false);
  assert.equal(getStallLink(link.id)!.status, 'requested', 'and none of that moved the row');

  assert.equal(approveStallLink(host.organizer.id, link.id), true);
  assert.equal(getStallLink(link.id)!.status, 'approved');
});

test('two racing decisions on one stall request: exactly one lands, the loser fails closed', () => {
  // better-sqlite3 is synchronous, so the interleaving is written out rather
  // than timed: both the approve and the decline were composed against a row
  // that read 'requested'. Each statement carries `status = 'requested'` in its
  // own WHERE, so whichever executes second matches nothing and reports false —
  // it does not overwrite the decision that already happened.
  const secondHost = makeSeller('Second');
  const shopTwo = makeEvent({
    organizerId: vendor.id,
    kind: 'shop',
    name: 'Vendor Pickles Two',
    eventDate: null,
  });
  const link = requestStallLink(vendor.id, shopTwo.id, secondHost.autumn.id, 'Table please');

  assert.equal(approveStallLink(secondHost.organizer.id, link.id), true);
  assert.equal(declineStallLink(secondHost.organizer.id, link.id), false, 'the loser changes nothing');
  assert.equal(getStallLink(link.id)!.status, 'approved');

  // The mirror image, so this is a compare-and-set and not an ordering fluke.
  const shopThree = makeEvent({
    organizerId: vendor.id,
    kind: 'shop',
    name: 'Vendor Pickles Three',
    eventDate: null,
  });
  const other = requestStallLink(vendor.id, shopThree.id, secondHost.autumn.id, 'Table please');
  assert.equal(declineStallLink(secondHost.organizer.id, other.id), true);
  assert.equal(approveStallLink(secondHost.organizer.id, other.id), false);
  assert.equal(getStallLink(other.id)!.status, 'declined');
});

test('a host organizer can never read a stall\'s buyers', () => {
  const { order } = makePaidOrder({
    eventId: vendorShop.id,
    items: [{ tierId: 'jar', quantity: 2 }],
    buyerName: 'Greta Lama',
    buyerEmail: 'greta@buyers.test',
  });
  assert.equal(order.totalCents, 3000);

  // The stall is approved and standing at the host's event — and the host's
  // every read model still stops at their own listing.
  assert.equal(getStallLink(listStallLinksForHostEvent(host.autumn.id)[0].id)!.status, 'approved');

  assert.deepEqual(listBuyers(host.autumn.id), []);
  assert.deepEqual(listOrders({ eventId: vendorShop.id, organizerId: host.organizer.id }), []);
  assert.deepEqual(listOrders({ organizerId: host.organizer.id }), []);
  assert.equal(getStats(host.autumn.id).revenueCents, 0);
  assert.deepEqual(monthlyStatement(host.organizer.id, currentMonth()).sections, []);

  // The panel the host DOES get is consent and placement only.
  const links = listStallLinksForHostEvent(host.autumn.id);
  const json = JSON.stringify(links);
  assert.ok(!json.includes('greta@buyers.test'));
  assert.ok(!json.includes('Greta Lama'));
  assert.ok(!json.includes('3000'), 'and carries no money either');

  // The shop's own seller of course still sees their sale.
  assert.equal(listOrders({ organizerId: vendor.id }).length, 1);
  assert.equal(monthlyStatement(vendor.id, currentMonth()).totals[0].cents, 3000);
});

// ---------------- Retention and erasure ----------------
//
// Everything below runs the GLOBAL sweep, so it lives at the bottom and builds
// the only past-dated listing in the database.

const past = makeOrganizer({ name: 'Rimal Events' });
const pastEvent = makeEvent({
  organizerId: past.id,
  name: 'Rimal Retro',
  eventDate: isoDaysFromNow(-(BUYER_RETENTION_DAYS + 30)),
  tiers: [{ tierKey: 'ga', name: 'General', priceCents: 2500, cap: 50 }],
});
const erika = { name: 'Erika Sharma', email: 'erika@buyers.test' };
const erikaOrder = makePaidOrder({
  eventId: pastEvent.id,
  items: [{ tierId: 'ga', quantity: 2 }],
  buyerName: erika.name,
  buyerEmail: erika.email,
});
const frankOrder = makePaidOrder({
  eventId: pastEvent.id,
  items: [{ tierId: 'ga', quantity: 1 }],
  buyerName: 'Frank Lama',
  buyerEmail: 'frank@buyers.test',
  referredBy: erikaOrder.order.shareCode,
});
const erikaCard = issueCustomerCard({ organizerId: past.id, email: erika.email });

// Erika ticked "keep me posted" and confirmed it from her inbox. Someone else's
// address was typed in and never confirmed; a third request is fresh.
requestMarketingConsent({ organizerId: past.id, email: erika.email, sourceOrderId: erikaOrder.order.id });
confirmMarketingConsent(past.id, erika.email, getMarketingConsent(past.id, erika.email)!.consentedAt);
// Backdated AFTER confirming (the token has to match the live stamp), so her
// subscription is as old as the listing it was given at. Without this the row
// would be too young for any date-based sweep to reach and the test below
// would pass whatever the sweep deleted.
db()
  .prepare(`UPDATE marketing_consents SET consented_at = datetime('now', ?) WHERE organizer_id = ? AND email = ?`)
  .run(`-${BUYER_RETENTION_DAYS + 40} days`, past.id, erika.email);
requestMarketingConsent({ organizerId: past.id, email: 'mistyped@buyers.test', sourceOrderId: frankOrder.order.id });
db()
  .prepare(`UPDATE marketing_consents SET consented_at = datetime('now', ?) WHERE organizer_id = ? AND email = ?`)
  .run(`-${BUYER_RETENTION_DAYS + 10} days`, past.id, 'mistyped@buyers.test');
requestMarketingConsent({ organizerId: past.id, email: 'justnow@buyers.test', sourceOrderId: frankOrder.order.id });

joinWaitlist(pastEvent.id, 'waiting1@buyers.test');
joinWaitlist(pastEvent.id, 'waiting2@buyers.test');

// Snapshots taken BEFORE the sweep, so "the money is untouched" is a
// comparison and not a re-derivation.
const statsBefore = getStats(pastEvent.id);
const statementBefore = monthlyStatement(past.id, currentMonth());
const erikaTickets: TicketRow[] = erikaOrder.tickets;

/**
 * Alpha's numbers as they stand the instant BEFORE the sweep runs — read
 * inside the test rather than up here, because the tests above sell Alpha a
 * few more tickets after this module is evaluated.
 */
let alphaStatsBefore: ReturnType<typeof getStats>;

test('the retention sweep erases the buyers of a listing that is long over', () => {
  alphaStatsBefore = getStats(alpha.autumn.id);
  const sweepResult = runBuyerDataRetentionSweep(true);
  assert.equal(sweepResult.erased, 2, 'both orders on the past listing, and nothing else');

  for (const id of [erikaOrder.order.id, frankOrder.order.id]) {
    const row = db()
      .prepare(`SELECT buyer_name AS name, buyer_email AS email, buyer_erased_at AS erasedAt FROM orders WHERE id = ?`)
      .get(id) as { name: string; email: string; erasedAt: string | null };
    assert.equal(row.name, ERASED_BUYER_NAME);
    assert.equal(row.email, ERASED_BUYER_EMAIL);
    assert.ok(row.erasedAt, 'and the row is stamped, so a re-run writes nothing new');
  }

  // Overwritten IN PLACE: the row, its tickets and its check-in history all
  // survive — only the person behind it stops being identifiable.
  const orderStillThere = db()
    .prepare(`SELECT total_cents AS totalCents FROM orders WHERE id = ?`)
    .get(erikaOrder.order.id) as { totalCents: number };
  assert.equal(orderStillThere.totalCents, 5000);
  const ticketsLeft = db()
    .prepare(`SELECT COUNT(*) AS n FROM tickets WHERE order_id = ?`)
    .get(erikaOrder.order.id) as { n: number };
  assert.equal(ticketsLeft.n, erikaTickets.length);
  assert.equal(ticketsLeft.n, 2);

  // Running it again is a no-op, not a second erasure.
  assert.equal(runBuyerDataRetentionSweep(true).erased, 0);
});

test('erasure leaves the counts and the money exactly as they were', () => {
  assert.deepEqual(getStats(pastEvent.id), statsBefore);
  assert.deepEqual(monthlyStatement(past.id, currentMonth()), statementBefore);
  assert.equal(getStats(pastEvent.id).revenueCents, 7500);
});

test('the sweep reaches only the listing whose date has passed', () => {
  // The global sweep walks every order in the database. A future-dated
  // listing's buyers must still be there afterwards, or the sweep is erasing
  // people whose event has not happened yet.
  assert.deepEqual(getStats(alpha.autumn.id), alphaStatsBefore);
  const ana = listBuyers(alpha.autumn.id).find((b) => b.email === ANA.email);
  assert.ok(ana, 'Ana still has a name at a listing that has not happened');
  assert.equal(ana.name, ANA.name);
});

test('the sweep DELETES waitlist addresses — an emptied husk would preserve nothing', () => {
  const left = db()
    .prepare(`SELECT COUNT(*) AS n FROM waitlist WHERE event_id = ?`)
    .get(pastEvent.id) as { n: number };
  assert.equal(left.n, 0);
  assert.equal(waitlistWaitingCount(pastEvent.id), 0);

  // …and only that listing's. The future listings' waitlists are still owed
  // their one email.
  assert.equal(waitlistWaitingCount(alpha.winter.id), 2);
  assert.equal(waitlistWaitingCount(beta.winter.id), 1);
});

test('a CONFIRMED marketing consent survives the buyer erasure — its owner asked for that', () => {
  const consent = getMarketingConsent(past.id, erika.email);
  assert.ok(consent, 'the confirmed subscription must outlive the order that carried the tick');
  assert.ok(
    consent.consentedAt < new Date(Date.now() - BUYER_RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10),
    'and it is older than the retention window, so any date-based sweep WOULD have reached it'
  );
  assert.ok(consent.confirmedAt);
  assert.equal(consent.unsubscribedAt, null);
  assert.equal(activeConsentCount(past.id), 1);
  assert.deepEqual(
    listAnnouncementAudience(past.id, alpha.winter.id).map((r) => r.email),
    [erika.email]
  );
});

test('an UNCONFIRMED keep-me-posted request is deleted once its confirmation email is stale', () => {
  assert.equal(
    getMarketingConsent(past.id, 'mistyped@buyers.test'),
    null,
    'an address whose owner never pressed the button must not sit here forever'
  );
  assert.ok(
    getMarketingConsent(past.id, 'justnow@buyers.test'),
    'but a request made today is still waiting for its click'
  );
});

test('a customer card survives the erasure, and stops naming anybody', () => {
  // The card is the other record its holder explicitly asked for, so the sweep
  // leaves it alone — but everything it could say about them is now gone.
  const card = getCustomerCard(past.id, erika.email);
  assert.ok(card, 'the card the holder asked for outlives the retention sweep');
  assert.equal(card.id, erikaCard.id);
  assert.deepEqual(cardOrders(card), [], 'erased orders are excluded, never shown as blanks');
  assert.equal(cardOrderCount(card), 0);
  assert.equal(cardAtCounter(card.cardCode, past.id)!.holderName, '');
  assertNoPlaceholder('cardView', cardView(card, 'Rimal Events'));
  assertNoPlaceholder('cardAtCounter', cardAtCounter(card.cardCode, past.id));
});

test('an erased buyer never renders as the placeholder in the seller\'s insights', () => {
  const buyers = listBuyers(pastEvent.id);
  assert.deepEqual(buyers, [], 'an erased row identifies nobody, so it lists nobody');

  const chain = topReferrers(pastEvent.id);
  assertNoPlaceholder('topReferrers', chain);
  // The COUNTS survive — the seats Erika brought are the seller's arithmetic —
  // but the person is 'a past guest', the one label every read model degrades to.
  assert.equal(chain.referrers.length, 1);
  assert.equal(chain.referrers[0].name, 'a past guest');
  assert.equal(chain.referrers[0].referredOrders, 1);
  assert.equal(chain.referrers[0].referredSeats, 1);
  assert.deepEqual(chain.referrers[0].bookings.map((b) => b.name), ['a past guest']);
  assert.equal(chain.referrers[0].bookings[0].broughtOnward, 0, 'no identity to sum on');

  assertNoPlaceholder('salesByDay', salesByDay(pastEvent.id));
  assertNoPlaceholder('monthlyStatement', monthlyStatement(past.id, currentMonth()));
});

/**
 * The two tests below FAIL ON PURPOSE. They are written to the rule as
 * lib/analytics.ts states it, not to what lib/orders.ts does today:
 *
 *   "The erased row keeps a placeholder NAME and ADDRESS in the database so
 *    the columns stay non-null; NEITHER MAY EVER REACH A SCREEN, so every read
 *    model here degrades to this one label instead."
 *
 * analytics.ts and cards.ts keep that promise — they drop the row or print
 * 'a past guest'. orders.ts's own read models do not: they hand
 * 'Erased after event' / 'erased@erased.invalid' straight to the pages that
 * render them, where the placeholder reads as a person's name and address.
 *
 * Do not "fix" these by relaxing the assertion. The fix is in src/: degrade
 * the buyer fields in the read models below the same way analytics.ts does.
 */

test('an erased buyer never renders as the placeholder in the seller\'s orders list', () => {
  // listOrders feeds the portal's orders page, which prints o.buyerName and
  // o.buyerEmail into the "Buyer" and "Email" columns verbatim (see
  // src/app/portal/events/[id]/orders/page.tsx). After the sweep those columns
  // read "Erased after event" and "erased@erased.invalid" — a placeholder
  // sitting exactly where a person's details were, on a screen, which is the
  // one thing the rule says must never happen.
  assertNoPlaceholder('listOrders', listOrders({ organizerId: past.id }));
});

test('an erased buyer never renders as the placeholder at the counter either', () => {
  // checkInTicket's response is a screen too: /admin/checkin renders
  // result.ticket.buyerName beside every scan, and /ticket/[code] prints the
  // same field as "Ticket holder".
  //
  // Reachable, not theoretical. A SHOP order is erased 30 days after its last
  // code is collected — or 365 days after payment if it never was — so an
  // uncollected pre-order scanned at the counter after the long-stop shows the
  // seller "Erased after event" where a customer's name belongs.
  const stillValid = db()
    .prepare(`SELECT code FROM tickets WHERE order_id = ? LIMIT 1`)
    .get(frankOrder.order.id) as { code: string };
  const scan = checkInTicket(stillValid.code, { eventId: pastEvent.id });
  assert.equal(scan.result, 'ok');
  assertNoPlaceholder('checkInTicket', scan);
});

// ---------------------------------------------------------------------------
// REVIEWS
// ---------------------------------------------------------------------------
//
// Reviews are the one thing on this platform a seller is not allowed to
// control, which makes them the one thing a seller has a motive to reach
// across the fence for: silence a bad word on a rival's shop, or quietly
// answer on a review that is not theirs. Both are one dropped WHERE clause
// away, and neither would ever be noticed by the seller it happened to.
//
// Two shops selling items under the SAME tier key, so a query missing its
// owner scope returns a plausible row rather than nothing.
//
// Their own sellers, deliberately NOT alpha and beta: those two are the
// fixture the money and buyer-list tests above measure to the cent, and paid
// orders added here would quietly change their totals. A test that breaks a
// neighbouring test's arithmetic is a test that will be deleted rather than
// read.

const rivalA = makeOrganizer({ name: 'Rival A' });
const rivalB = makeOrganizer({ name: 'Rival B' });

const shopA = makeEvent({
  organizerId: rivalA.id,
  kind: 'shop',
  name: 'Alpha Kitchen',
  tiers: [{ tierKey: 'momo', name: 'Chicken momo', priceCents: 950, cap: 50 }],
});
const shopB = makeEvent({
  organizerId: rivalB.id,
  kind: 'shop',
  name: 'Beta Kitchen',
  tiers: [{ tierKey: 'momo', name: 'Chicken momo', priceCents: 950, cap: 50 }],
});

const reviewA = (() => {
  const { order } = makePaidOrder({ eventId: shopA.id, items: [{ tierId: 'momo', quantity: 1 }], buyerName: ANA.name, buyerEmail: ANA.email });
  return writeReview({ orderId: order.id, tierKey: 'momo', rating: 5, body: 'Alpha\u2019s momo, wonderful.' });
})();
const reviewB = (() => {
  const { order } = makePaidOrder({ eventId: shopB.id, items: [{ tierId: 'momo', quantity: 1 }], buyerName: BOB.name, buyerEmail: BOB.email });
  return writeReview({ orderId: order.id, tierKey: 'momo', rating: 2, body: 'Beta\u2019s momo, cold.' });
})();

test('a seller cannot reply to a review of another seller\u2019s goods', () => {
  // The check lives in the UPDATE's own WHERE clause rather than in the route,
  // so it holds for every caller there will ever be.
  assert.equal(
    setSellerReply(reviewB.id, rivalA.id, 'Actually ours are excellent.'),
    false,
    'A must not be able to answer on B\u2019s shop'
  );
  assert.equal(listReviewsForItem(shopB.id, 'momo')[0].sellerReply, '', 'and nothing was written');

  // …and the same call on their own review works, so the refusal above is
  // isolation and not a broken function.
  assert.equal(setSellerReply(reviewA.id, rivalA.id, 'Thank you!'), true);
  assert.equal(listReviewsForItem(shopA.id, 'momo')[0].sellerReply, 'Thank you!');
});

test('a seller\u2019s review screen shows only reviews of their own goods', () => {
  const mine = listReviewsForOrganizer(rivalA.id);
  assert.ok(mine.length > 0, 'fixture check: A has one');
  assert.ok(
    mine.every((r) => r.eventId === shopA.id),
    `A\u2019s screen showed a review from another seller: ${JSON.stringify(mine.map((r) => r.eventName))}`
  );
  // B's two-star review is the one that would be most tempting to see.
  assert.ok(!mine.some((r) => r.body.includes('cold')), 'B\u2019s bad review is none of A\u2019s business');
});

test('a rating never pools two sellers\u2019 reviews, even under the same tier key', () => {
  // Both shops sell 'momo'. A key collision here would average a 5 and a 2 into
  // 3.5 on both shops, which is the shape of bug that looks like an opinion.
  assert.equal(ratingForItem(shopA.id, 'momo')?.average, 5);
  assert.equal(ratingForItem(shopA.id, 'momo')?.count, 1);
  assert.equal(ratingForItem(shopB.id, 'momo')?.average, 2);
  assert.equal(ratingForItem(shopB.id, 'momo')?.count, 1);

  const bulk = ratingsForItems([shopA.id, shopB.id]);
  assert.equal(bulk.get(`${shopA.id}:momo`)?.average, 5);
  assert.equal(bulk.get(`${shopB.id}:momo`)?.average, 2);
});

test('a review can only ever land on the listing its own order was placed with', () => {
  // There is no parameter here that could aim a review at another shop: the
  // ORDER decides, and writeReview re-reads it. Both shops sell a tier called
  // 'momo', so if the tier key were ever trusted on its own, B’s buyer could
  // score A’s kitchen. Asserted as "the row landed on B and A is unchanged"
  // rather than as an exception, because the design makes the attempt
  // unexpressible rather than refused — which is the stronger property.
  const before = ratingForItem(shopA.id, 'momo')!;
  const { order } = makePaidOrder({ eventId: shopB.id, items: [{ tierId: 'momo', quantity: 1 }], buyerName: BOB.name, buyerEmail: BOB.email });
  const written = writeReview({ orderId: order.id, tierKey: 'momo', rating: 1, body: 'One star.' });

  assert.equal(written.eventId, shopB.id, 'the order\u2019s own listing, always');
  assert.equal(ratingForItem(shopA.id, 'momo')!.count, before.count, 'A\u2019s score is untouched');
  assert.equal(ratingForItem(shopA.id, 'momo')!.average, before.average);
  assert.equal(ratingForItem(shopB.id, 'momo')!.count, 2, 'and B now carries both');
});

test('hiding is the platform\u2019s power, and it is not scoped to a seller at all', () => {
  // Deliberately asserting the ASYMMETRY: a seller cannot make a review go
  // away, and the admin can — which is the whole reason a rating here is worth
  // reading. setReviewStatus takes no organizer id, and no seller route
  // reaches it.
  const before = ratingForItem(shopB.id, 'momo')!.count;
  assert.equal(setReviewStatus(reviewB.id, 'hidden', 'Contains a phone number'), true);
  assert.equal(
    listReviewsForItem(shopB.id, 'momo').some((r) => r.id === reviewB.id),
    false,
    'a hidden row leaves the public page'
  );
  assert.equal(ratingForItem(shopB.id, 'momo')!.count, before - 1, 'and stops counting toward the score');

  assert.equal(setReviewStatus(reviewB.id, 'published', ''), true);
  assert.equal(ratingForItem(shopB.id, 'momo')!.count, before, 'restoring brings it back');
});
