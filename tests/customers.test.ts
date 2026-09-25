// Customer accounts (lib/customers): codes, sessions, and what "my orders" shows.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createCustomerLoginCode,
  createCustomerSessionToken,
  normaliseEmail,
  ordersForCustomer,
  upsertCustomer,
  verifyCustomerLoginCode,
  verifyCustomerSessionToken,
} from '../src/lib/customers.ts';
import { createOrder, finalizePaidOrder } from '../src/lib/orders.ts';
import { makeEvent } from './helpers.ts';

process.env.PAYMENT_MODE = 'transfer';
process.env.APP_SECRET ??= 'test-secret-for-customer-accounts';

describe('customer sign-in codes', () => {
  it('accepts the right code once, and only once', () => {
    const email = 'asha@example.de';
    const code = createCustomerLoginCode(email);
    assert.match(code, /^\d{6}$/);
    assert.equal(verifyCustomerLoginCode(email, code), 'ok');
    assert.equal(verifyCustomerLoginCode(email, code), 'expired', 'a used code is gone');
  });

  it('burns the code after five wrong tries', () => {
    const email = 'bina@example.de';
    const code = createCustomerLoginCode(email);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) assert.equal(verifyCustomerLoginCode(email, wrong), 'wrong');
    assert.equal(verifyCustomerLoginCode(email, wrong), 'too_many');
    assert.equal(verifyCustomerLoginCode(email, code), 'too_many', 'even the right code is refused now');
  });

  it('a new code replaces the old one', () => {
    const email = 'chandra@example.de';
    const first = createCustomerLoginCode(email);
    const second = createCustomerLoginCode(email);
    if (first !== second) assert.equal(verifyCustomerLoginCode(email, first), 'wrong');
    assert.equal(verifyCustomerLoginCode(email, second), 'ok');
  });

  it('normalises addresses', () => {
    assert.equal(normaliseEmail('  Sita@Example.DE '), 'sita@example.de');
    assert.equal(normaliseEmail('not-an-email'), null);
  });
});

describe('customer sessions and accounts', () => {
  it('signs a session and refuses a tampered one', () => {
    const c = upsertCustomer('dipa@example.de', { name: 'Dipa Rai' });
    const token = createCustomerSessionToken(c.id);
    assert.equal(verifyCustomerSessionToken(token), c.id);
    const [id, exp, sig] = token.split('.');
    assert.equal(verifyCustomerSessionToken(`${id}.${Number(exp) + 1}.${sig}`), null);
    assert.equal(verifyCustomerSessionToken(`someone-else.${exp}.${sig}`), null);
    assert.equal(verifyCustomerSessionToken('garbage'), null);
  });

  it('one account per address, keeping the first name it was given', () => {
    const a = upsertCustomer('esha@example.de', { name: 'Esha' });
    const b = upsertCustomer('ESHA@example.de', { name: 'Someone else' });
    assert.equal(a.id, b.id);
    assert.equal(b.name, 'Esha');
  });

  it('lists the orders carrying the address — any case — and not failed ones', () => {
    const ev = makeEvent({ kind: 'shop', tiers: [{ tierKey: 'tea', priceCents: 900, cap: 50 }] });
    const paid = createOrder({ eventId: ev.id, buyerName: 'F', buyerEmail: 'Farah@Example.de', items: [{ tierId: 'tea', quantity: 2 }], paymentMode: 'transfer' });
    finalizePaidOrder(paid.id, null);
    createOrder({ eventId: ev.id, buyerName: 'F', buyerEmail: 'farah@example.de', items: [{ tierId: 'tea', quantity: 1 }], paymentMode: 'transfer' });
    createOrder({ eventId: ev.id, buyerName: 'G', buyerEmail: 'other@example.de', items: [{ tierId: 'tea', quantity: 1 }], paymentMode: 'transfer' });
    const mine = ordersForCustomer('farah@example.de');
    assert.equal(mine.length, 2);
    assert.ok(mine.some((o) => o.status === 'paid' && o.items === 2));
    assert.ok(mine.every((o) => o.eventSlug === ev.slug));
  });
});
