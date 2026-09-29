/**
 * AN ORGANIZER'S AUTHENTICATOR SECRET IS SEALED AT REST.
 *
 * The TOTP secret is the whole of the second factor: whoever holds it can mint
 * every future code. It used to sit in organizers.totp_secret as plain base32,
 * so a database backup or a stray `.dump` handed out working second factors.
 * It is now sealed with lib/secretBox (the box that already holds sellers'
 * payment credentials). Rows written before that change still hold plaintext;
 * they must keep working and are re-sealed the first time they are read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// secretBox derives its key from APP_SECRET, read lazily at call time.
process.env.APP_SECRET ??= 'test-app-secret-for-organizer-totp-0123456789';

import { totpCode, base32Encode } from '../src/lib/totp.ts';
import {
  confirmOrganizerTotp,
  organizerTotpEnabled,
  organizerTotpPending,
  startOrganizerTotpEnrolment,
  verifyOrganizerTotp,
} from '../src/lib/organizerTotp.ts';
import { db, makeOrganizer } from './helpers.ts';

/** RFC 4648 base32 decode — the test's own, so it does not trust the code under test. */
function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of str) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** The code an authenticator app would show `offsetSteps` windows from now. */
function codeFor(secret: string, offsetSteps = 0): string {
  return totpCode(base32Decode(secret), Math.floor(Date.now() / 1000) + offsetSteps * 30);
}

function storedSecret(organizerId: string): string | null {
  return (db().prepare(`SELECT totp_secret AS s FROM organizers WHERE id = ?`).get(organizerId) as { s: string | null }).s;
}

test('a new enrolment stores the secret sealed, never in the clear', () => {
  const org = makeOrganizer();
  const secret = startOrganizerTotpEnrolment(org.id);
  assert.match(secret, /^[A-Z2-7]{32}$/, 'the organizer is still shown plain base32 to type or scan');

  const stored = storedSecret(org.id) ?? '';
  assert.ok(stored.startsWith('v1.'), `expected a sealed value, got ${stored.slice(0, 12)}…`);
  assert.ok(!stored.includes(secret), 'the plaintext secret must not appear in the row');

  assert.equal(organizerTotpPending(org.id), true);
  assert.equal(confirmOrganizerTotp(org.id, codeFor(secret)), true, 'a code from the sealed secret confirms');
  assert.equal(organizerTotpEnabled(org.id), true);
  assert.equal(verifyOrganizerTotp(org.id, codeFor(secret, 1)), true, 'and signs in with the next code');
});

test('a legacy plaintext secret keeps working and is re-sealed on first read', () => {
  const org = makeOrganizer();
  const secret = base32Encode(crypto.randomBytes(20));
  db().prepare(`UPDATE organizers SET totp_secret = ?, totp_enabled = 1, totp_last_step = 0 WHERE id = ?`).run(secret, org.id);

  assert.equal(organizerTotpEnabled(org.id), true);
  const after = storedSecret(org.id) ?? '';
  assert.ok(after.startsWith('v1.'), 'reading it sealed it');
  assert.ok(!after.includes(secret));

  assert.equal(verifyOrganizerTotp(org.id, codeFor(secret)), true, 'the same authenticator still works');
  assert.equal(verifyOrganizerTotp(org.id, codeFor(secret)), false, 'and a code is still single-use');
});

test('a secret that cannot be opened fails CLOSED — login still demands a code', () => {
  // What a changed APP_SECRET looks like: a sealed value no key here opens.
  const org = makeOrganizer();
  const secret = startOrganizerTotpEnrolment(org.id);
  confirmOrganizerTotp(org.id, codeFor(secret));
  const stored = storedSecret(org.id) ?? '';
  const [v, iv, enc, tag] = stored.split('.');
  const broken = [v, iv, enc, (tag.startsWith('A') ? 'B' : 'A') + tag.slice(1)].join('.');
  db().prepare(`UPDATE organizers SET totp_secret = ? WHERE id = ?`).run(broken, org.id);

  assert.equal(organizerTotpEnabled(org.id), true, 'an unreadable secret must not silently switch 2FA off');
  assert.equal(verifyOrganizerTotp(org.id, codeFor(secret, 1)), false, 'and no code verifies against it');
  assert.throws(() => startOrganizerTotpEnrolment(org.id), 'nor is an enrolled account silently re-keyed');
});
