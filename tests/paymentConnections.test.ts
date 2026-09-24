// Seller-connected instant payments: what is stored, what a listing offers,
// what a Stripe order does when Stripe answers — all against the real lib
// functions on a throwaway database (tests/register.mjs).
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { openSecret, sealSecret } from '../src/lib/secretBox.ts';
import {
  anyPaymentRoute,
  getConnection,
  listConnections,
  paymentOptionsFor,
  paypalCredentialsFor,
  removeConnection,
  resolvePaymentRoute,
  stripeCredentialsFor,
  upsertConnection,
} from '../src/lib/paymentConnections.ts';
import { ROUTE_FEES, providerCutCents, routeFee, sellerNetCents } from '../src/lib/paymentFees.ts';
import { stripeSessionLooksPaid } from '../src/lib/stripe.ts';
import { settleStripeOrder } from '../src/lib/stripeOrders.ts';
import { createOrder, getOrder, getTicketsForOrder, setOrderPaymentConnection, setStripeSession } from '../src/lib/orders.ts';
import { getEventById } from '../src/lib/events.ts';
import { db, makeEvent, makeOrganizer } from './helpers.ts';

process.env.PAYMENT_MODE = 'transfer';
// Credentials are sealed with a key derived from APP_SECRET (lib/secretBox);
// read lazily at call time, so setting it here is early enough.
process.env.APP_SECRET ??= 'test-app-secret-for-payment-connections-0123456789';

describe('secretBox', () => {
  it('round-trips and refuses tampering', () => {
    const sealed = sealSecret('sk_test_abc123');
    assert.notEqual(sealed, 'sk_test_abc123');
    assert.equal(openSecret(sealed), 'sk_test_abc123');
    const [v, iv, enc, tag] = sealed.split('.');
    // Change the FIRST character of the authentication tag. Not the last: in
    // base64url the final character of a 16-byte tag carries padding bits the
    // decoder ignores, so swapping it can decode to the very same bytes.
    const flipped = (tag.startsWith('A') ? 'B' : 'A') + tag.slice(1);
    assert.equal(openSecret([v, iv, enc, flipped].join('.')), null);
    assert.equal(openSecret('garbage'), null);
  });
});

describe('connections', () => {
  it('stores a connection without ever listing the secret, and opens it for the API clients', () => {
    const org = makeOrganizer();
    const saved = upsertConnection({
      organizerId: org.id,
      provider: 'paypal',
      publicId: 'AXclient',
      secret: 'EXsecret',
      accountLabel: 'PayPal live app',
      sandbox: false,
    });
    assert.equal(saved.provider, 'paypal');
    assert.ok(!('secret' in saved) && !('secretEnc' in saved));
    assert.deepEqual(
      listConnections(org.id).map((c) => c.provider),
      ['paypal']
    );
    assert.deepEqual(paypalCredentialsFor(getConnection(org.id, 'paypal')!), {
      clientId: 'AXclient',
      clientSecret: 'EXsecret',
      sandbox: false,
    });
    assert.equal(stripeCredentialsFor(getConnection(org.id, 'paypal')!), null);

    // Replacing gets a NEW id: an order pinned to the old one can never settle
    // against the new credentials by accident.
    const replaced = upsertConnection({
      organizerId: org.id,
      provider: 'paypal',
      publicId: 'AXother',
      secret: 'EXother',
      accountLabel: 'PayPal live app',
      sandbox: false,
    });
    assert.notEqual(replaced.id, saved.id);
    assert.equal(listConnections(org.id).length, 1);

    assert.equal(removeConnection(org.id, 'paypal'), true);
    assert.equal(getConnection(org.id, 'paypal'), null);
  });
});

describe('paymentOptionsFor', () => {
  it('offers transfer only when the listing ticks it AND an account exists', () => {
    const withBank = makeEvent();
    assert.equal(paymentOptionsFor(withBank).transfer, true);
    assert.equal(paymentOptionsFor(withBank).bank, true);

    const noAccount = makeEvent({ payout: { bankIban: '', bankAccountHolder: '', paypalAccount: '' } });
    assert.equal(paymentOptionsFor(noAccount).transfer, false);
    assert.equal(anyPaymentRoute(paymentOptionsFor(noAccount)), false);

    db().prepare(`UPDATE events SET pay_transfer = 0 WHERE id = ?`).run(withBank.id);
    assert.equal(paymentOptionsFor(getEventById(withBank.id)!).transfer, false);
  });

  it('offers an instant route only with the seller’s own connection behind the tick', () => {
    const org = makeOrganizer();
    const event = makeEvent({ organizerId: org.id });
    db().prepare(`UPDATE events SET pay_paypal = 1, pay_stripe = 1 WHERE id = ?`).run(event.id);
    let options = paymentOptionsFor(getEventById(event.id)!);
    assert.equal(options.paypal, null, 'ticked but not connected offers nothing');
    assert.equal(options.stripe, null);

    upsertConnection({ organizerId: org.id, provider: 'stripe', publicId: '', secret: 'sk_test_x', accountLabel: 'Momo GmbH', sandbox: true });
    options = paymentOptionsFor(getEventById(event.id)!);
    assert.equal(options.paypal, null);
    assert.ok(options.stripe && options.stripe.sandbox === true);

    // Another seller's connection never counts for this listing.
    const other = makeOrganizer();
    upsertConnection({ organizerId: other.id, provider: 'paypal', publicId: 'AX', secret: 'EX', accountLabel: '', sandbox: false });
    assert.equal(paymentOptionsFor(getEventById(event.id)!).paypal, null);
  });

  it('resolves the requested route only when it is offered', () => {
    const options = { transfer: true, paypalMe: false, bank: true, paypal: null, stripe: { connectionId: 'c', sandbox: false }, mock: false };
    assert.equal(resolvePaymentRoute(options, 'stripe'), 'stripe');
    assert.equal(resolvePaymentRoute(options, 'transfer'), 'transfer');
    assert.equal(resolvePaymentRoute(options, 'paypal'), null, 'not offered -> refused, never substituted');
    assert.equal(resolvePaymentRoute(options, 'mock'), null);
    assert.equal(resolvePaymentRoute(options, undefined), 'transfer', 'absent -> the safe default');
    assert.equal(resolvePaymentRoute({ ...options, transfer: false }, undefined), 'stripe');
    assert.equal(resolvePaymentRoute({ ...options, transfer: false, stripe: null }, undefined), null);
  });
});

describe('fees', () => {
  it('computes the provider cut the way the providers round it', () => {
    assert.equal(providerCutCents(2500, routeFee('transfer')), 0);
    assert.equal(sellerNetCents(2500, routeFee('transfer')), 2500);
    // PayPal Checkout 2.99 % + 0.39: 74.75 + 39 = 113.75 -> 114
    assert.equal(providerCutCents(2500, routeFee('paypal')), 114);
    // Stripe 1.5 % + 0.25, plus 19 % VAT on the fee: (37.5 + 25) * 1.19 = 74.375 -> 74
    assert.equal(providerCutCents(2500, routeFee('stripe')), 74);
    assert.equal(sellerNetCents(2500, routeFee('stripe')), 2426);
    assert.equal(providerCutCents(0, routeFee('stripe')), 0);
    for (const fee of ROUTE_FEES) assert.match(fee.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('stripe settlement', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function stubSession(body: Record<string, unknown>) {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  }

  function stripeOrder() {
    const org = makeOrganizer();
    const conn = upsertConnection({ organizerId: org.id, provider: 'stripe', publicId: '', secret: 'sk_test_x', accountLabel: '', sandbox: true });
    const event = makeEvent({ organizerId: org.id, tiers: [{ tierKey: 'std', priceCents: 1500, cap: 5 }] });
    const order = createOrder({
      eventId: event.id,
      buyerName: 'Buyer',
      buyerEmail: 'buyer@example.com',
      items: [{ tierId: 'std', quantity: 2 }],
      paymentMode: 'stripe',
    });
    assert.equal(order.status, 'claimed', 'a stripe order holds its seats from creation');
    setOrderPaymentConnection(order.id, conn.id);
    setStripeSession(order.id, 'cs_test_1', 'https://checkout.stripe.com/c/pay/cs_test_1');
    return order;
  }

  it('mints codes only when Stripe says paid, for the exact amount', async () => {
    const order = stripeOrder();
    stubSession({ id: 'cs_test_1', status: 'complete', payment_status: 'paid', amount_total: 3000, currency: 'eur', payment_intent: 'pi_1' });
    assert.equal(await settleStripeOrder(order.id), 'paid');
    assert.equal(getOrder(order.id)!.status, 'paid');
    assert.equal(getTicketsForOrder(order.id).length, 2);
    // Idempotent.
    assert.equal(await settleStripeOrder(order.id), 'paid');
    assert.equal(getTicketsForOrder(order.id).length, 2);
  });

  it('holds the seats on a mismatched amount and keeps them while the page is open', async () => {
    const order = stripeOrder();
    stubSession({ id: 'cs_test_1', status: 'complete', payment_status: 'paid', amount_total: 100, currency: 'eur', payment_intent: 'pi_1' });
    assert.equal(await settleStripeOrder(order.id), 'unclear');
    assert.equal(getOrder(order.id)!.status, 'capturing', 'possibly-paid money is never released on a guess');
    assert.equal(getTicketsForOrder(order.id).length, 0);

    const open = stripeOrder();
    stubSession({ id: 'cs_test_1', status: 'open', payment_status: 'unpaid', amount_total: 3000, currency: 'eur', payment_intent: null });
    assert.equal(await settleStripeOrder(open.id), 'unpaid');
    assert.equal(getOrder(open.id)!.status, 'claimed', 'still payable: the hold goes back to claimed');
  });

  it('releases the seats once Stripe says the session expired', async () => {
    const order = stripeOrder();
    stubSession({ id: 'cs_test_1', status: 'expired', payment_status: 'unpaid', amount_total: 3000, currency: 'eur', payment_intent: null });
    assert.equal(await settleStripeOrder(order.id), 'expired');
    assert.equal(getOrder(order.id)!.status, 'cancelled');
  });

  it('does not touch an order whose connection is gone', async () => {
    const order = stripeOrder();
    const conn = getOrder(order.id)!.paymentConnectionId!;
    db().prepare(`DELETE FROM organizer_payment_connections WHERE id = ?`).run(conn);
    assert.equal(await settleStripeOrder(order.id), 'unclear');
    assert.equal(getOrder(order.id)!.status, 'claimed');
  });

  it('stripeSessionLooksPaid checks status, amount and currency', () => {
    const base = { id: 's', url: null, status: 'complete', payment_status: 'paid', amount_total: 3000, currency: 'eur', payment_intent: 'pi', client_reference_id: null };
    assert.equal(stripeSessionLooksPaid(base, 3000, 'EUR'), true);
    assert.equal(stripeSessionLooksPaid({ ...base, payment_status: 'unpaid' }, 3000, 'EUR'), false);
    assert.equal(stripeSessionLooksPaid({ ...base, amount_total: 2999 }, 3000, 'EUR'), false);
    assert.equal(stripeSessionLooksPaid({ ...base, currency: 'usd' }, 3000, 'EUR'), false);
  });
});
