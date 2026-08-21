/**
 * THE CROSS-SHOP GOODS VIEW (/market/items).
 *
 * This page is the one surface that reaches into EVERY published listing at
 * once, which makes it the one surface where a missing filter is loudest: a
 * draft shop's prices on a public page, a withdrawn item still orderable from a
 * URL somebody kept, an event's ticket tiers swamping a page of food. Each of
 * those is one forgotten condition in lib/marketItems, and none of them is
 * visible on a bazaar that happens to hold two shops the day you look.
 *
 * So the fixture below is built to LOOK correct while being wrong in five
 * different ways at once — a draft shop, an archived one, a hidden item, an
 * event with tickets, a shop with nothing on its shelves — and every assertion
 * is a set of names rather than a count, because a count of 4 passes just as
 * happily when it is the wrong 4.
 *
 * The sort and the search are asserted here too, and deliberately as ORDER and
 * as MEMBERSHIP: the page prints a sentence claiming what the order is, and a
 * sentence a test does not hold to is a sentence that goes stale.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEvent, makeOrganizer } from './helpers.ts';
import type { EventRow } from '../src/lib/events.ts';
import {
  countByCategory,
  listShopItems,
  queryTerms,
  searchShopItems,
} from '../src/lib/marketItems.ts';
import { readListingName } from '../src/lib/exampleShop.ts';

/** makeEvent covers neither column, and both decide what this page shows. */
function setShelf(event: EventRow, category: string, city: string) {
  db().prepare(`UPDATE events SET category = ?, city = ? WHERE id = ?`).run(category, city, event.id);
}

const seller = makeOrganizer({ name: 'Bazaar Seller' });

// A real shop, on a shelf, with one item on sale and one withdrawn.
const kitchen = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Sunita’s Kitchen',
  tiers: [
    { tierKey: 'momo', name: 'Chicken momo', description: 'Steamed, with tomato achar.' },
    { tierKey: 'old-sel', name: 'Last year’s sel roti', status: 'hidden' },
  ],
});
setShelf(kitchen, 'khaja-food', 'Berlin');

// A second real shop, different shelf, different town.
const spices = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Taplejung Spice',
  tiers: [{ tierKey: 'timur', name: 'Timur 100g', details: 'Hand-picked in Taplejung.' }],
});
setShelf(spices, 'groceries-spices', 'Munich');

// The site's own example shop — marked in its NAME, which is the only place
// the marker lives (see lib/exampleShop).
const example = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Momo House (example shop)',
  tiers: [{ tierKey: 'ex-momo', name: 'Buff momo', description: 'An example item.' }],
});
setShelf(example, 'khaja-food', 'Berlin');

// Four ways to be invisible, all of them plausible-looking rows.
makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  status: 'draft',
  name: 'Half-built shop',
  tiers: [{ tierKey: 'secret', name: 'Unannounced pickle' }],
});
makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  status: 'archived',
  name: 'Closed shop',
  tiers: [{ tierKey: 'gone', name: 'Retired dhaka topi' }],
});
makeEvent({
  organizerId: seller.id,
  kind: 'event',
  name: 'Dashain Night',
  tiers: [{ tierKey: 'standard', name: 'Standard ticket' }],
});
makeEvent({ organizerId: seller.id, kind: 'shop', name: 'Empty shelves' });

const names = () => listShopItems().map((i) => i.tier.name);

test('only sellable goods: no drafts, no archives, no events, no hidden rows', () => {
  assert.deepEqual(new Set(names()), new Set(['Chicken momo', 'Timur 100g', 'Buff momo']));
});

test('a hidden item is off this page exactly as it is off the shop’s own', () => {
  // Stated separately from the set above because it is the one exclusion whose
  // row belongs to a perfectly public shop — the easiest to lose in a refactor.
  assert.equal(
    names().includes('Last year’s sel roti'),
    false,
    'a withdrawn item must not be reachable from a bazaar-wide page'
  );
});

test('the example shop is marked, and its name is printed without the marker', () => {
  const item = listShopItems().find((i) => i.tier.name === 'Buff momo')!;
  assert.equal(item.isExample, true);
  assert.equal(item.shopName, 'Momo House', 'the tile prints the name, the chip carries the fact');

  const real = listShopItems().find((i) => i.tier.name === 'Chicken momo')!;
  assert.equal(real.isExample, false);
  assert.equal(real.shopName, 'Sunita’s Kitchen');
});

test('real sellers come before example shops', () => {
  const order = listShopItems().map((i) => i.isExample);
  assert.deepEqual(
    order,
    [...order].sort((a, b) => Number(a) - Number(b)),
    'a visitor who came to buy meets somebody who can actually sell to them first'
  );
});

test('each item links to its own page, not to the shop', () => {
  const item = listShopItems().find((i) => i.tier.name === 'Timur 100g')!;
  assert.equal(item.href, `/e/${spices.slug}/item/timur`);
});

test('search matches the item name, the write-up, the shop and the town', () => {
  const all = listShopItems();
  const hits = (q: string) => searchShopItems(all, queryTerms(q)).map((i) => i.tier.name);

  assert.deepEqual(hits('timur'), ['Timur 100g'], 'the item name');
  assert.deepEqual(hits('achar'), ['Chicken momo'], 'the seller’s own one-line description');
  assert.deepEqual(hits('hand-picked'), ['Timur 100g'], 'the longer write-up');
  assert.deepEqual(hits('sunita'), ['Chicken momo'], 'the shop’s name');
  assert.deepEqual(hits('munich'), ['Timur 100g'], 'the shop’s town');
  assert.deepEqual(hits('TIMUR'), ['Timur 100g'], 'case is not a filter');
});

test('two words mean AND, which is what somebody typing them means', () => {
  const all = listShopItems();
  assert.deepEqual(
    searchShopItems(all, queryTerms('momo berlin')).map((i) => i.tier.name),
    ['Chicken momo', 'Buff momo'],
    'both terms have to land, but they may land in different fields'
  );
  assert.deepEqual(
    searchShopItems(all, queryTerms('momo munich')).map((i) => i.tier.name),
    [],
    'no momo is sold in Munich here, and a near miss is not a match'
  );
});

test('an empty query filters nothing rather than everything', () => {
  const all = listShopItems();
  assert.equal(searchShopItems(all, queryTerms('   ')).length, all.length);
});

test('searching cannot be tricked by the example marker in a stored name', () => {
  // The marker is stripped before it reaches the haystack: with it left in,
  // "shop" would return every example listing on the site and nothing else.
  const all = listShopItems();
  assert.deepEqual(searchShopItems(all, queryTerms('example shop')).map((i) => i.tier.name), []);
});

test('the shelf counts describe the SHOP’s shelf, for every item on it', () => {
  const counts = countByCategory(listShopItems());
  assert.equal(counts.get('khaja-food'), 2, 'the real kitchen and the example momo house');
  assert.equal(counts.get('groceries-spices'), 1);
  assert.equal(counts.get('clothing-fabrics'), undefined, 'an unstocked shelf is absent, not zero');
});

test('a listing name with no marker is left exactly as its seller wrote it', () => {
  // Including one that merely mentions the words — only the trailing
  // parenthetical is the marker, and a shop is not demoted for its own name.
  assert.deepEqual(readListingName('Example Shop Berlin'), {
    name: 'Example Shop Berlin',
    isExample: false,
  });
  assert.deepEqual(readListingName('Momo House (example shop)'), {
    name: 'Momo House',
    isExample: true,
  });
});
