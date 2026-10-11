/**
 * lib/paypalLink.ts + paypalMeUrl — which PayPal values become a Pay button.
 *
 * Organizers may give a PayPal.Me link, the link inside their PayPal app's QR
 * code (read from a screenshot in the editor), or an email. Only PayPal's own
 * hosts may ever turn into an href; only PayPal.Me links get the amount added.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { isPaypalMeLink, paypalLinkFor } from '../src/lib/paypalLink.ts';
import { isValidPaypalAccount, paypalMeUrl, paypalPayee } from '../src/lib/events.ts';

const QR = 'https://www.paypal.com/qrcodes/p2pqrc/ABC123xyz';

test('a PayPal app QR link is accepted as a link, with or without the scheme', () => {
  assert.equal(paypalLinkFor(QR), QR);
  assert.equal(paypalLinkFor('www.paypal.com/qrcodes/p2pqrc/ABC123xyz'), QR);
  assert.equal(paypalLinkFor('https://paypal.com/qrcodes/managed/1b2c-3d4e?utm_source=app'), 'https://paypal.com/qrcodes/managed/1b2c-3d4e?utm_source=app');
  assert.equal(isValidPaypalAccount(QR), true);
});

test('lookalike hosts and other PayPal paths never become a link', () => {
  for (const bad of [
    'https://paypal.com.evil.example/qrcodes/p2pqrc/ABC',
    'https://evil.example/qrcodes/p2pqrc/ABC',
    'http://www.paypal.com/qrcodes/p2pqrc/ABC',
    'https://www.paypal.com/signin',
    'https://www.paypal.com/qrcodes/p2pqrc/ABC"><script>',
  ]) {
    assert.equal(paypalLinkFor(bad), null, bad);
    assert.equal(isValidPaypalAccount(bad), false, bad);
  }
});

test('the amount is added to PayPal.Me links only; a QR link opens as it is', () => {
  assert.equal(isPaypalMeLink('https://paypal.me/myband'), true);
  assert.equal(isPaypalMeLink(QR), false);
  assert.equal(paypalMeUrl(paypalPayee({ paypalAccount: 'paypal.me/myband' }), 2500, 'EUR'), 'https://paypal.me/myband/25.00EUR');
  assert.equal(paypalMeUrl(paypalPayee({ paypalAccount: QR }), 2500, 'EUR'), QR);
});

test('an email stays text — no link, no Pay button', () => {
  const payee = paypalPayee({ paypalAccount: 'band@example.com' });
  assert.equal(payee?.link, null);
  assert.equal(paypalMeUrl(payee, 2500, 'EUR'), null);
  assert.equal(isValidPaypalAccount('band@example.com'), true);
});
