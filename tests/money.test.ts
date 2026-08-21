/**
 * lib/money.ts — discountCentsFor().
 *
 * This is the single arithmetic every discount in the platform passes through:
 * the checkout preview a buyer reads and the server that writes the row both
 * call it, so a change here silently changes what people are charged. The
 * cases below are written from the rules the function's own comment states —
 * percent rounds UP (the buyer's favour), fixed is capped at the basket, the
 * answer is never negative — so that a change to any of those rules FAILS
 * rather than quietly re-prices every code in the system.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { discountCentsFor } from '../src/lib/money.ts';

const percent = (p: number) => ({ kind: 'percent' as const, amountCents: 0, percent: p });
const fixed = (c: number) => ({ kind: 'fixed' as const, amountCents: c, percent: 0 });

test('percent: an exact share needs no rounding', () => {
  assert.equal(discountCentsFor(percent(10), 1000), 100);
  assert.equal(discountCentsFor(percent(25), 2000), 500);
});

test('percent: a fraction of a cent rounds UP, in the buyer’s favour', () => {
  // 10% of 1999 = 199.9 cents. Rounding down would take 199 and hand the
  // seller the fraction; the rule is that it goes the buyer's way.
  assert.equal(discountCentsFor(percent(10), 1999), 200);
  // 33% of 1000 = 330.0 — already whole, so nothing is added.
  assert.equal(discountCentsFor(percent(33), 1000), 330);
  // 1% of 101 = 1.01 -> 2. The smallest possible discount still rounds up.
  assert.equal(discountCentsFor(percent(1), 101), 2);
});

test('percent: never rounds up past the basket', () => {
  // 100% is the whole basket and not a cent more, however it rounds.
  assert.equal(discountCentsFor(percent(100), 1999), 1999);
  assert.equal(discountCentsFor(percent(100), 1), 1);
});

test('percent: out-of-range percentages are clamped to 0..100', () => {
  assert.equal(discountCentsFor(percent(150), 1000), 1000, 'over 100% cannot exceed the basket');
  assert.equal(discountCentsFor(percent(-10), 1000), 0, 'a negative percentage takes nothing off');
});

test('fixed: takes the stated amount when the basket is bigger', () => {
  assert.equal(discountCentsFor(fixed(500), 2000), 500);
});

test('fixed: is capped at the subtotal — no change, no carried remainder', () => {
  assert.equal(discountCentsFor(fixed(5000), 2000), 2000);
  assert.equal(discountCentsFor(fixed(2000), 2000), 2000);
});

test('fixed: a negative amount takes nothing off', () => {
  assert.equal(discountCentsFor(fixed(-500), 2000), 0);
});

test('a zero or negative subtotal discounts nothing, of either kind', () => {
  assert.equal(discountCentsFor(percent(50), 0), 0);
  assert.equal(discountCentsFor(fixed(500), 0), 0);
  assert.equal(discountCentsFor(percent(50), -100), 0);
  assert.equal(discountCentsFor(fixed(500), -100), 0);
});

test('the result is never negative and never exceeds the subtotal', () => {
  // A sweep rather than more examples: the two invariants above are what the
  // rest of the codebase relies on when it does `total - discount`, and they
  // must hold for every input, not only the ones somebody thought to write.
  const subtotals = [0, 1, 7, 99, 100, 101, 999, 1000, 1999, 123_456];
  const codes = [
    ...[0, 1, 3, 7, 33, 50, 99, 100].map(percent),
    ...[0, 1, 99, 100, 999, 100_000].map(fixed),
  ];
  for (const subtotal of subtotals) {
    for (const code of codes) {
      const d = discountCentsFor(code, subtotal);
      assert.ok(Number.isInteger(d), `${JSON.stringify(code)} @ ${subtotal} gave a non-integer: ${d}`);
      assert.ok(d >= 0, `${JSON.stringify(code)} @ ${subtotal} gave a negative discount: ${d}`);
      assert.ok(
        d <= Math.max(0, subtotal),
        `${JSON.stringify(code)} @ ${subtotal} discounted more than the basket: ${d}`
      );
    }
  }
});

test('a percent discount never leaves the buyer worse off than rounding down', () => {
  // The stated rule, as a property: the discount is always at least the exact
  // share, and never more than one cent above it.
  for (let subtotal = 1; subtotal <= 400; subtotal++) {
    for (const p of [1, 5, 10, 17, 50, 99]) {
      const exact = (subtotal * p) / 100;
      const d = discountCentsFor(percent(p), subtotal);
      assert.ok(d >= exact, `${p}% of ${subtotal}: ${d} is less than the exact ${exact}`);
      assert.ok(d < exact + 1, `${p}% of ${subtotal}: ${d} overshoots the exact ${exact} by a cent or more`);
    }
  }
});
