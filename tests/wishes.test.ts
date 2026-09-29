/**
 * A WISH IS A COUNT, NEVER A PROFILE.
 *
 * Each "♡ Wish list" tap is one row per item per device. The device column used
 * to hold sha256('wish:' + token) — the same value on every item one browser
 * wished for, which made the table a list of "this device wanted these
 * things". It now holds a keyed hash that differs per item, and the rows from
 * before the change are rewritten in place so nobody's dedup is reset.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.APP_SECRET ??= 'test-app-secret-for-wishes-0123456789abcdef';

import { deviceKey, hasWished, setWish, wishCount } from '../src/lib/wishes.ts';
import { db } from './helpers.ts';

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const legacy = (token: string) => crypto.createHash('sha256').update(`wish:${token}`).digest('hex').slice(0, 32);

// FIRST, before anything opens the wishes table: rows as the old code wrote
// them. The migration runs when lib/wishes first touches its table.
test('rows written under the old cross-item hash are unlinked, and still dedupe', () => {
  db().exec(`
    CREATE TABLE IF NOT EXISTS item_wishes (
      event_id TEXT NOT NULL,
      tier_key TEXT NOT NULL,
      device TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (event_id, tier_key, device)
    );
  `);
  const insert = db().prepare(`INSERT INTO item_wishes (event_id, tier_key, device) VALUES (?, ?, ?)`);
  insert.run('ev-old', 'momo', legacy(TOKEN));
  insert.run('ev-old', 'chiya', legacy(TOKEN));

  // The device that wished before the change is still recognised…
  assert.equal(hasWished('ev-old', 'momo', deviceKey(TOKEN, 'ev-old', 'momo')!), true);
  assert.equal(hasWished('ev-old', 'chiya', deviceKey(TOKEN, 'ev-old', 'chiya')!), true);
  // …wishing again does not count twice…
  assert.equal(setWish('ev-old', 'momo', deviceKey(TOKEN, 'ev-old', 'momo')!, true), 1);

  // …and the two rows no longer share anything.
  const devices = (db().prepare(`SELECT device FROM item_wishes WHERE event_id = 'ev-old'`).all() as { device: string }[]).map(
    (r) => r.device
  );
  assert.equal(devices.length, 2);
  assert.equal(new Set(devices).size, 2, 'one browser, two items, two unrelated values');
  assert.ok(!devices.includes(legacy(TOKEN)), 'no row still carries the cross-item hash');
});

test('one browser gets a different, unkeyable value on every item', () => {
  const a = deviceKey(TOKEN, 'ev-1', 'momo');
  const b = deviceKey(TOKEN, 'ev-1', 'chiya');
  const c = deviceKey(TOKEN, 'ev-2', 'momo');
  assert.ok(a && b && c);
  assert.equal(new Set([a, b, c]).size, 3);
  for (const v of [a, b, c]) {
    assert.notEqual(v, legacy(TOKEN));
    assert.ok(!v.includes(TOKEN), 'the raw token is never stored');
  }
  assert.equal(deviceKey(TOKEN, 'ev-1', 'momo'), a, 'but stable for the same item');
  assert.equal(deviceKey('not a token!', 'ev-1', 'momo'), null);
});

test('"has this device wished this item" still works, and a wish is one row per device', () => {
  const dev = deviceKey(TOKEN, 'ev-3', 'momo')!;
  assert.equal(hasWished('ev-3', 'momo', dev), false);
  assert.equal(setWish('ev-3', 'momo', dev, true), 1);
  assert.equal(setWish('ev-3', 'momo', dev, true), 1, 'a second tap by the same device is not a second person');
  assert.equal(hasWished('ev-3', 'momo', dev), true);
  assert.equal(hasWished('ev-3', 'momo', deviceKey('ffffffffffffffffffffffffffffffff', 'ev-3', 'momo')!), false);
  assert.equal(setWish('ev-3', 'momo', dev, false), 0);
  assert.equal(wishCount('ev-3', 'momo'), 0);
});
