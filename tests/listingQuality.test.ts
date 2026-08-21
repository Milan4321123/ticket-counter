/**
 * THE ADVICE A SELLER GETS AFTER THEY HAVE PUBLISHED.
 *
 * lib/events' checklist is the publish gate: without a name, a way to be paid
 * and collection details, a listing would mislead somebody, so it cannot go
 * out. This is the other half — a shop can pass every one of those and still
 * arrive in the bazaar as a wall of grey initials with no shelf and no town,
 * and its seller has no way of knowing why nobody is buying.
 *
 * Two things are asserted throughout, because both are ways this feature could
 * quietly become useless:
 *
 *   · a shop that is doing everything gets NOTHING. A panel that always finds
 *     something to complain about is a panel sellers learn to close.
 *   · the advice is about THIS shop. A hint that fires on data it did not
 *     measure is worse than no hint, because the seller goes looking for a
 *     problem that is not there.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEvent, makeOrganizer } from './helpers.ts';
import { getEventMedia, getEventTiers } from '../src/lib/events.ts';
import { shopQualityHints, qualitySummary } from '../src/lib/listingQuality.ts';

const seller = makeOrganizer({ name: 'Sunita Rai' });

function makeShop(opts: {
  category?: string;
  city?: string;
  tiers?: { tierKey: string; name: string; details?: string; status?: 'on-sale' | 'hidden' }[];
}) {
  const shop = makeEvent({
    organizerId: seller.id,
    kind: 'shop',
    name: 'Sunita’s Home Kitchen',
    tiers: opts.tiers ?? [
      { tierKey: 'momo', name: 'Chicken momo', details: 'Folded by hand on Friday night.' },
      { tierKey: 'achar', name: 'Tomato achar', details: 'Timur from Taplejung, ground at home.' },
    ],
  });
  db()
    .prepare(`UPDATE events SET category = ?, city = ? WHERE id = ?`)
    .run(opts.category ?? 'khaja-food', opts.city ?? 'Berlin', shop.id);
  return { ...shop, category: opts.category ?? 'khaja-food', city: opts.city ?? 'Berlin' };
}

const hintsFor = (shop: ReturnType<typeof makeShop>) =>
  shopQualityHints(shop, getEventTiers(shop.id), getEventMedia(shop.id)).map((h) => h.key);

test('a shop with no shelf is told what it is missing out on', () => {
  const shop = makeShop({ category: '' });
  assert.ok(hintsFor(shop).includes('no-shelf'));
  // …and the same shop WITH a shelf is not told anything about shelves.
  assert.ok(!hintsFor(makeShop({ category: 'khaja-food' })).includes('no-shelf'));
});

test('a shop with no town is told, and one with a town is not', () => {
  assert.ok(hintsFor(makeShop({ city: '' })).includes('no-town'));
  assert.ok(!hintsFor(makeShop({ city: 'Hamburg' })).includes('no-town'));
});

test('photo-less items are counted, and the count is the number of REAL items', () => {
  const shop = makeShop({
    tiers: [
      { tierKey: 'a', name: 'Momo', details: 'x' },
      { tierKey: 'b', name: 'Achar', details: 'x' },
      // Hidden: off the seller's own page, so it must not be counted as a
      // photo-less item a shopper is looking at.
      { tierKey: 'c', name: 'Old stock', details: 'x', status: 'hidden' },
    ],
  });
  const hints = shopQualityHints(shop, getEventTiers(shop.id), getEventMedia(shop.id));
  const photos = hints.find((h) => h.key === 'items-without-photos');
  assert.ok(photos, 'no shop in this fixture has photos, so the hint must fire');
  assert.match(photos.label, /Add a photo/);
  assert.ok(
    !photos.why.includes('Old stock'),
    'a hidden item is not something a shopper sees, so it must not be in the advice'
  );
});

test('a shop with one item is nudged to add a second; two is not nudged', () => {
  assert.ok(hintsFor(makeShop({ tiers: [{ tierKey: 'a', name: 'Momo', details: 'x' }] })).includes('single-item'));
  assert.ok(!hintsFor(makeShop({})).includes('single-item'));
});

test('items with no write-up are named, and ones with a write-up are not', () => {
  assert.ok(hintsFor(makeShop({ tiers: [{ tierKey: 'a', name: 'Momo' }, { tierKey: 'b', name: 'Achar' }] }))
    .includes('items-without-detail'));
  assert.ok(!hintsFor(makeShop({})).includes('items-without-detail'));
});

test('an EVENT is never given shop advice', () => {
  // None of this is how an event gets found, and inventing an event version
  // would be advice made up to fill a panel.
  const event = makeEvent({ organizerId: seller.id, name: 'Dashain Night', tiers: [{ tierKey: 'x', name: 'Entry' }] });
  assert.deepEqual(shopQualityHints(event, getEventTiers(event.id), getEventMedia(event.id)), []);
});

test('the summary reads as praise when there is nothing to say', () => {
  const shop = makeShop({});
  assert.match(qualitySummary([], shop), /set up well/);
  assert.match(qualitySummary([], shop), /Khaja & cooked food/, 'and names the shelf it is on');
  assert.match(qualitySummary(shopQualityHints(shop, getEventTiers(shop.id), getEventMedia(shop.id)), shop), /easier to buy from/);
});
