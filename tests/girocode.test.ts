/**
 * lib/girocode.ts — the payment QR, and the one place a wrong number is not a
 * bug report but a transfer.
 *
 * Everything else in the app SHOWS a buyer a figure; this file HANDS their bank
 * a filled-in form. A buyer who scans is not checking arithmetic — they are
 * confirming a screen their own bank drew for them. So the properties pinned
 * here are the four a scan cannot un-send:
 *
 *   - the IBAN is the account this order was told to pay, character for
 *     character, and no other account can appear in the payload at all;
 *   - the amount is the order's own total to the cent, never a multiple of it;
 *   - the currency is the order's, or there is no code;
 *   - the reference is the buyer's, so the money lands identifiable.
 *
 * The layout tests are exact-string, not "contains", because EPC069-12 is
 * POSITIONAL: every line counts, including the two empty ones, and a field
 * inserted or dropped silently reassigns every field below it — the amount
 * becomes the purpose, the reference becomes nothing. A "contains the IBAN"
 * assertion passes happily through that.
 *
 * The last group goes through a real order. That is where the rule that
 * actually protects a seller lives: the payload is built from the order's OWN
 * frozen payout snapshot (orderPayout), never the event's current columns, so
 * an IBAN edited after the fact cannot rewrite an instruction already issued.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { girocodePayload, type GirocodeInput } from '../src/lib/girocode.ts';
import { effectivePayout, orderPayout, queuePayoutChange, PAYOUT_DELAY_MS } from '../src/lib/payout.ts';
import { getEventById } from '../src/lib/events.ts';
import { getOrder, paymentReference } from '../src/lib/orders.ts';
import { db, makeEventWithTier, makeOrder } from './helpers.ts';

/** A complete, ordinary German transfer. Each test varies one field of it. */
const base: GirocodeInput = {
  accountHolder: 'Milan Adhikari',
  iban: 'DE02 1203 0000 0000 2020 51',
  bic: 'BYLADEM1001',
  amountCents: 3702,
  currency: 'EUR',
  reference: 'TICKETS-1A2B3C4D',
};

/** The payload, split back into the specification's fields. Fails loudly rather than returning null. */
function fields(input: Partial<GirocodeInput> = {}): string[] {
  const payload = girocodePayload({ ...base, ...input });
  assert.ok(payload !== null, 'expected a payload, got null');
  return payload.split('\n');
}

// The specification's field positions, named — an index typo in a test is
// otherwise indistinguishable from the bug the test is looking for.
const SERVICE_TAG = 0;
const VERSION = 1;
const CHARSET = 2;
const PURPOSE = 3;
const BIC = 4;
const HOLDER = 5;
const IBAN = 6;
const AMOUNT = 7;
const REMITTANCE = 10;

// ---------------------------------------------------------------------------
// The layout, exactly
// ---------------------------------------------------------------------------

test('the payload is the EPC069-12 field layout, line for line', () => {
  // Written out in full deliberately: this single assertion is what makes an
  // added, removed or reordered line impossible to land quietly, and it is the
  // only form of the test that catches a field being shifted rather than
  // changed.
  assert.equal(
    girocodePayload(base),
    [
      'BCD',
      '002',
      '1',
      'SCT',
      'BYLADEM1001',
      'Milan Adhikari',
      'DE02120300000000202051',
      'EUR37.02',
      '',
      '',
      'TICKETS-1A2B3C4D',
    ].join('\n')
  );
});

test('the header fields say SEPA credit transfer, version 002, UTF-8 — and nothing else', () => {
  const f = fields();
  assert.equal(f[SERVICE_TAG], 'BCD');
  assert.equal(f[VERSION], '002'); // what makes the BIC optional
  assert.equal(f[CHARSET], '1'); // UTF-8
  assert.equal(f[PURPOSE], 'SCT');
  // Eleven fields, not twelve: the trailing note is omitted so the code stays
  // small enough to scan in poor light.
  assert.equal(f.length, 11);
  // The two empty ones are structural, not decorative — the reference is
  // unstructured text and must not also be claimed as a structured one.
  assert.equal(f[8], '');
  assert.equal(f[9], '');
});

// ---------------------------------------------------------------------------
// The IBAN — whose account this is
// ---------------------------------------------------------------------------

test('the IBAN line is the account passed in, and no other account appears anywhere', () => {
  const f = fields();
  assert.equal(f[IBAN], 'DE02120300000000202051');
  // Nothing that looks like a second IBAN may be hiding in another field: a
  // payload carrying a foreign account somewhere a buyer does not read is
  // exactly the failure this file exists to prevent.
  const ibanLike = girocodePayload(base)!.match(/[A-Z]{2}\d{2}[A-Z0-9]{10,30}/g) ?? [];
  assert.deepEqual(ibanLike, ['DE02120300000000202051']);
});

test('a different account produces a different IBAN line — the account is never a constant', () => {
  // The mutation this kills is a hardcoded destination: a payload that ignores
  // its input still passes every "shape" assertion, so the test has to prove
  // the field TRACKS the argument.
  const accounts = [
    { given: 'AT48 3200 0000 1234 5864', wire: 'AT483200000012345864' },
    { given: 'NL91ABNA0417164300', wire: 'NL91ABNA0417164300' },
    { given: 'de02120300000000202051', wire: 'DE02120300000000202051' },
  ];
  for (const { given, wire } of accounts) {
    assert.equal(fields({ iban: given })[IBAN], wire, `IBAN line for ${given}`);
  }
});

test('no IBAN, or one longer than the format allows, is no code at all', () => {
  assert.equal(girocodePayload({ ...base, iban: '' }), null);
  assert.equal(girocodePayload({ ...base, iban: '   ' }), null);
  assert.equal(girocodePayload({ ...base, iban: 'DE' + '1'.repeat(40) }), null);
  // A payee name is as load-bearing as the account: a bank app showing money
  // going to nobody is not an instruction anyone should confirm.
  assert.equal(girocodePayload({ ...base, accountHolder: '  ' }), null);
});

// ---------------------------------------------------------------------------
// The amount — how much leaves the buyer's account
// ---------------------------------------------------------------------------

test('the amount is the cents given, to the cent, in EUR', () => {
  // Every one of these is checked as a NUMBER as well as a string, because the
  // dangerous mutation is not a formatting slip — it is a factor. A 10x amount
  // still renders as a perfectly well-formed "EUR370.20".
  const cases: [number, string][] = [
    [1, 'EUR0.01'],
    [99, 'EUR0.99'],
    [100, 'EUR1.00'],
    [3702, 'EUR37.02'],
    [123456, 'EUR1234.56'],
  ];
  for (const [cents, expected] of cases) {
    const line = fields({ amountCents: cents })[AMOUNT];
    assert.equal(line, expected, `${cents} cents`);
    assert.equal(Math.round(Number(line.slice(3)) * 100), cents, `${cents} cents, read back`);
  }
});

test('a zero or negative total has no code — that is not a payment', () => {
  assert.equal(girocodePayload({ ...base, amountCents: 0 }), null);
  assert.equal(girocodePayload({ ...base, amountCents: -500 }), null);
  assert.equal(girocodePayload({ ...base, amountCents: Number.NaN }), null);
  // Above what the format can express. Refusing beats printing a code the
  // buyer's bank will reject with them standing there.
  assert.equal(girocodePayload({ ...base, amountCents: 1e12 }), null);
});

test('only EUR gets a code — SCT settles in euro and the payload cannot say otherwise', () => {
  assert.equal(girocodePayload({ ...base, currency: 'GBP' }), null);
  assert.equal(girocodePayload({ ...base, currency: 'CHF' }), null);
  assert.equal(girocodePayload({ ...base, currency: '' }), null);
  // Case is the caller's business, not the buyer's problem.
  assert.equal(fields({ currency: 'eur' })[AMOUNT], 'EUR37.02');
});

// ---------------------------------------------------------------------------
// The reference — the field the organizer actually matches on
// ---------------------------------------------------------------------------

test('the reference is carried verbatim in the unstructured remittance field', () => {
  assert.equal(fields({ reference: 'TICKETS-S-9F8E7D6C' })[REMITTANCE], 'TICKETS-S-9F8E7D6C');
});

test('a newline in a field cannot shift the fields below it', () => {
  // The payload is newline-delimited, so this is a structural attack, not a
  // cosmetic one: one stray line and the bank reads the amount as the purpose.
  const f = fields({ accountHolder: 'Milan\nAdhikari', reference: 'TICKETS-1A2B3C4D\nEUR999.00' });
  assert.equal(f.length, 11);
  assert.equal(f[HOLDER], 'Milan Adhikari');
  assert.equal(f[AMOUNT], 'EUR37.02');
  assert.equal(f[REMITTANCE], 'TICKETS-1A2B3C4D EUR999.00');
});

test('an over-long reference is cut to the format cap rather than overflowing the payload', () => {
  assert.equal(fields({ reference: 'A'.repeat(200) })[REMITTANCE], 'A'.repeat(140));
});

// ---------------------------------------------------------------------------
// Against a real order: the frozen snapshot, not the event's columns
// ---------------------------------------------------------------------------

/**
 * The order page's own composition, in one place.
 *
 * Mirrors app/order/[id]/page.tsx and lib/email.ts: the payout comes from
 * orderPayout(order, event), the amount from the order's total, the reference
 * from paymentReference. Recomputing any of those from the event here would
 * make the test agree with the very substitution it is meant to catch.
 */
function payloadForOrder(orderId: string): string {
  const order = getOrder(orderId)!;
  const event = getEventById(order.eventId);
  const payout = orderPayout(order, event);
  const payload = girocodePayload({
    accountHolder: payout.holder,
    iban: payout.iban,
    bic: payout.bic,
    amountCents: order.totalCents,
    currency: order.currency,
    reference: paymentReference(order.id),
  });
  assert.ok(payload !== null, 'expected a payload for a complete bank route');
  return payload;
}

test("a real order's code carries that order's own IBAN, total and reference", () => {
  const { event, tier } = makeEventWithTier(
    { payout: { bankAccountHolder: 'Dashain Nights UG', bankIban: 'DE02120300000000202051', bankBic: 'BYLADEM1001' } },
    { priceCents: 1234 }
  );
  const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 3 }] });

  const f = payloadForOrder(order.id).split('\n');
  assert.equal(f[HOLDER], 'Dashain Nights UG');
  assert.equal(f[IBAN], 'DE02120300000000202051');
  // 3 × 12.34 — asserted against the order's stored total, so a pricing change
  // in the fixture cannot make this test agree with a wrong QR.
  assert.equal(getOrder(order.id)!.totalCents, 3702);
  assert.equal(f[AMOUNT], 'EUR37.02');
  assert.equal(f[REMITTANCE], paymentReference(order.id));
});

test('editing the event afterwards does not rewrite a code already issued', () => {
  const { event, tier } = makeEventWithTier(
    { payout: { bankAccountHolder: 'Dashain Nights UG', bankIban: 'DE02120300000000202051' } },
    { priceCents: 2000 }
  );
  const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });
  const before = payloadForOrder(order.id);

  // The attack this defends against: the live columns are overwritten with a
  // stranger's account long after the buyer got their instructions.
  db()
    .prepare(`UPDATE events SET bank_account_holder = ?, bank_iban = ? WHERE id = ?`)
    .run('Not The Organizer', 'AT483200000012345864', event.id);

  const after = payloadForOrder(order.id);
  assert.equal(after, before, 'the issued code must be byte-identical after the event was edited');
  assert.equal(after.split('\n')[IBAN], 'DE02120300000000202051');

  // And the substitution really would have been visible — proof that the
  // assertion above is not passing because nothing changed at all.
  const live = effectivePayout(getEventById(event.id)!);
  assert.equal(live.iban, 'AT483200000012345864');
  assert.notEqual(after.split('\n')[IBAN], live.iban);
});

test('a payout change that has since matured does not reach an older order either', () => {
  const { event, tier } = makeEventWithTier(
    { payout: { bankAccountHolder: 'Dashain Nights UG', bankIban: 'DE02120300000000202051' } },
    { priceCents: 2000 }
  );
  const order = makeOrder({ eventId: event.id, items: [{ tierId: tier.tierKey, quantity: 1 }] });

  // Queued and already past its waiting period: the event now answers with the
  // new account, and this order still must not.
  queuePayoutChange(
    event.id,
    { holder: 'Somebody Else', iban: 'NL91ABNA0417164300', bic: '', bankName: '', paypal: '' },
    Date.now() - PAYOUT_DELAY_MS
  );

  assert.equal(effectivePayout(getEventById(event.id)!).iban, 'NL91ABNA0417164300');
  assert.equal(payloadForOrder(order.id).split('\n')[IBAN], 'DE02120300000000202051');
});
