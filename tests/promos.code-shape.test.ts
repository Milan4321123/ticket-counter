/**
 * lib/promos.ts — what a promo code is ALLOWED to look like.
 *
 * The shape rules are not cosmetic. Two of them are load-bearing:
 *
 *   - the 5-character floor exists because an unauthenticated endpoint answers
 *     yes/no to a guessed code, and a 3-character space is walkable;
 *   - a promo may not normalise to a referral voucher, because one checkout box
 *     accepts both kinds and a code that reads as either is a code that can be
 *     spent twice, or spent as the wrong thing.
 *
 * Anything that relaxes either rule must fail here.
 *
 * The last two tests go through the fixture layer and a real database — they
 * are also the proof that the harness itself works end to end.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPromoCode,
  generatePromoCode,
  GENERATED_PROMO_CODE_LENGTH,
  listPromoCodes,
  normalizePromoCode,
  PromoError,
  PROMO_CODE_SHAPE,
  validatePromoInput,
  type PromoInput,
} from '../src/lib/promos.ts';
import { normalizeVoucherCode } from '../src/lib/referrals.ts';
import { makeOrganizer, makePromo } from './helpers.ts';

const input = (over: Partial<PromoInput> = {}): PromoInput => ({
  code: 'DASHAIN10',
  kind: 'percent',
  amountCents: 0,
  percent: 10,
  eventId: '',
  maxRedemptions: 0,
  expiresOn: '',
  ...over,
});

// ---------------- normalizePromoCode ----------------

test('normalizePromoCode: accepts a well-formed code as-is', () => {
  assert.equal(normalizePromoCode('DASHAIN10'), 'DASHAIN10');
  assert.equal(normalizePromoCode('EARLY-BIRD'), 'EARLY-BIRD');
});

test('normalizePromoCode: is forgiving about case and stray characters', () => {
  assert.equal(normalizePromoCode('dashain10'), 'DASHAIN10');
  assert.equal(normalizePromoCode('  dashain 10 '), 'DASHAIN10');
  assert.equal(normalizePromoCode('dash@ain#10'), 'DASHAIN10');
});

test('normalizePromoCode: returns "" for anything outside the shape', () => {
  assert.equal(normalizePromoCode(''), '', 'empty');
  assert.equal(normalizePromoCode('VIP'), '', 'three characters is under the floor');
  assert.equal(normalizePromoCode('ABCD'), '', 'four characters is still under the floor');
  assert.equal(normalizePromoCode('A'.repeat(25)), '', 'twenty-five is over the ceiling');
  assert.equal(normalizePromoCode('!!!!!'), '', 'nothing legal survives the strip');
});

test('normalizePromoCode: the boundaries themselves are legal', () => {
  assert.equal(normalizePromoCode('ABCDE'), 'ABCDE', 'five is the floor, inclusive');
  assert.equal(normalizePromoCode('A'.repeat(24)), 'A'.repeat(24), 'twenty-four is the ceiling, inclusive');
});

test('normalizePromoCode: agrees with PROMO_CODE_SHAPE', () => {
  for (const raw of ['ABCDE', 'DASHAIN10', 'EARLY-BIRD', 'A'.repeat(24)]) {
    assert.ok(PROMO_CODE_SHAPE.test(raw), `${raw} should match the shape`);
    assert.equal(normalizePromoCode(raw), raw);
  }
  for (const raw of ['VIP', 'a b', 'A'.repeat(25)]) {
    assert.ok(!PROMO_CODE_SHAPE.test(raw), `${raw} should not match the shape`);
  }
});

// ---------------- the voucher collision ----------------

test('a code that would read as a referral voucher is refused', () => {
  // normalizeVoucherCode throws dashes away and re-prefixes any 8-character
  // body, so all four of these normalise to the same voucher.
  for (const collide of ['ABCD2345', 'THANKS-ABCD2345', 'AB-CD-23-45', 'thanks-abcd2345']) {
    assert.notEqual(normalizeVoucherCode(collide), '', `precondition: ${collide} reads as a voucher`);
    const problem = validatePromoInput(input({ code: collide }));
    assert.ok(problem, `${collide} must be refused, it reads as a voucher`);
    assert.match(problem, /voucher/i);
  }
});

test('the refusal is about LENGTH, not about the THANKS- prefix', () => {
  // Eight characters with no prefix at all still collides. A rule that only
  // reserved the literal prefix would let this through.
  assert.ok(validatePromoInput(input({ code: 'SUMMER24' })), 'eight characters collides');
  assert.equal(validatePromoInput(input({ code: 'SUMMER240' })), null, 'nine does not');
  assert.equal(validatePromoInput(input({ code: 'SUMMER2' })), null, 'seven does not');
});

test('generatePromoCode: produces a code its own validation accepts', () => {
  for (let i = 0; i < 200; i++) {
    const code = generatePromoCode();
    assert.equal(code.length, GENERATED_PROMO_CODE_LENGTH);
    assert.equal(normalizePromoCode(code), code, `${code} should survive normalisation unchanged`);
    assert.equal(normalizeVoucherCode(code), '', `${code} must not read as a voucher`);
    assert.equal(validatePromoInput(input({ code })), null, `${code} should be a valid promo code`);
  }
});

test('generatePromoCode: uses no easily-confused characters', () => {
  // I, L, O, 0 and 1 are excluded because this code is read off a poster and
  // typed by hand.
  for (let i = 0; i < 200; i++) {
    assert.doesNotMatch(generatePromoCode(), /[ILO01]/);
  }
});

// ---------------- validatePromoInput, the rest of the shape ----------------

test('validatePromoInput: a good percent code and a good fixed code pass', () => {
  assert.equal(validatePromoInput(input()), null);
  assert.equal(validatePromoInput(input({ kind: 'fixed', percent: 0, amountCents: 500 })), null);
});

test('validatePromoInput: a malformed code is refused before anything else', () => {
  const problem = validatePromoInput(input({ code: 'VIP' }));
  assert.ok(problem);
  assert.match(problem, /5 to 24/);
});

test('validatePromoInput: percent must be a whole 1..100', () => {
  assert.equal(validatePromoInput(input({ percent: 1 })), null, '1 is the floor, inclusive');
  assert.equal(validatePromoInput(input({ percent: 100 })), null, '100 is the ceiling, inclusive');
  assert.ok(validatePromoInput(input({ percent: 0 })), '0% is not a discount');
  assert.ok(validatePromoInput(input({ percent: 101 })), 'over 100% is not a discount');
  assert.ok(validatePromoInput(input({ percent: 10.5 })), 'fractions of a percent are refused');
});

test('validatePromoInput: a fixed amount must be a whole 1.00..500.00', () => {
  const fixed = (amountCents: number) => input({ kind: 'fixed', percent: 0, amountCents });
  assert.equal(validatePromoInput(fixed(100)), null, '1.00 is the floor, inclusive');
  assert.equal(validatePromoInput(fixed(50_000)), null, '500.00 is the ceiling, inclusive');
  assert.ok(validatePromoInput(fixed(99)), 'under 1.00 is refused');
  assert.ok(validatePromoInput(fixed(50_001)), 'over 500.00 is refused');
  assert.ok(validatePromoInput(fixed(500.5)), 'fractions of a cent are refused');
});

test('validatePromoInput: the redemption limit is a whole number, 0..100000', () => {
  assert.equal(validatePromoInput(input({ maxRedemptions: 0 })), null, '0 means no limit');
  assert.equal(validatePromoInput(input({ maxRedemptions: 100_000 })), null);
  assert.ok(validatePromoInput(input({ maxRedemptions: -1 })));
  assert.ok(validatePromoInput(input({ maxRedemptions: 1.5 })));
  assert.ok(validatePromoInput(input({ maxRedemptions: 100_001 })));
});

test('validatePromoInput: an expiry is an ISO date, today or later', () => {
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  assert.equal(validatePromoInput(input({ expiresOn: '' })), null, 'empty means never expires');
  assert.equal(validatePromoInput(input({ expiresOn: day(0) })), null, 'today is allowed');
  assert.equal(validatePromoInput(input({ expiresOn: day(30) })), null);
  assert.ok(validatePromoInput(input({ expiresOn: day(-1) })), 'yesterday is refused');
  assert.ok(validatePromoInput(input({ expiresOn: '31/12/2026' })), 'a non-ISO date is refused');
});

// ---------------- through the database ----------------

test('createPromoCode: stores the normalised code, not what was typed', () => {
  const organizer = makeOrganizer();
  const promo = createPromoCode(organizer.id, input({ code: '  early bird ' }));
  assert.equal(promo.code, 'EARLYBIRD');
  assert.equal(listPromoCodes(organizer.id).map((p) => p.code).join(), 'EARLYBIRD');
});

test('createPromoCode: refuses a shape validatePromoInput would refuse', () => {
  const organizer = makeOrganizer();
  assert.throws(() => createPromoCode(organizer.id, input({ code: 'VIP' })), PromoError);
  assert.throws(() => createPromoCode(organizer.id, input({ code: 'SUMMER24' })), PromoError);
  assert.equal(listPromoCodes(organizer.id).length, 0, 'nothing was written');
});

test('two organizers may each mint the same code; one organizer may not mint it twice', () => {
  const a = makeOrganizer();
  const b = makeOrganizer();
  makePromo(a.id, { code: 'DASHAIN10' });
  makePromo(b.id, { code: 'DASHAIN10' });
  assert.throws(() => makePromo(a.id, { code: 'DASHAIN10' }), PromoError);
  assert.equal(listPromoCodes(a.id).length, 1);
  assert.equal(listPromoCodes(b.id).length, 1);
});
