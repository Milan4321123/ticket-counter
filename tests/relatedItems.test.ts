/**
 * RELATED GOODS — the two shelf rails and "often bought together".
 *
 * Three things are worth testing here and they fail in three different ways.
 *
 * The two rails are pure functions, so their whole risk is what they let
 * through: the item you are already reading turning up in its own rail, the
 * shop you are already in filling the cross-shop rail, and an item nobody has
 * filed on a shelf dragging in every other unfiled item under a heading that
 * says they belong together. All three look perfectly fine on the page. So the
 * assertions below are sets and sequences of NAMES, never counts — a rail of
 * the right length can be the wrong rail.
 *
 * The rails are also deliberately fed a SCRAMBLED array. They promise "in stock
 * first, real sellers before example shops" and they are handed whatever the
 * page happens to be holding, which one day will be a list somebody has sorted
 * by price. A test that passed the rails an already-correctly-ordered array
 * would be testing listShopItems' sort, and would keep passing on the day the
 * rails stopped doing their own.
 *
 * boughtTogether fails differently: it is the only block on an item page that
 * makes a claim about other people, and every way it can be wrong is a way of
 * overstating. So it is held to all four of its conditions separately — paid
 * only, this shop only, not the item itself, and never on a single basket —
 * with fixtures built so that dropping any one of them changes an answer here.
 *
 * Everything goes through the real readers: the rails are given genuine rows
 * from listShopItems() rather than hand-built objects, so this file cannot
 * quietly keep passing against a ShopItem shape the app no longer produces.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEvent, makeOrder, makeOrganizer, makePaidOrder } from './helpers.ts';
import type { EventRow } from '../src/lib/events.ts';
import { listShopItems } from '../src/lib/marketItems.ts';
import type { ShopItem } from '../src/lib/marketItems.ts';
import { boughtTogether, moreFromShop, othersOnShelf } from '../src/lib/relatedItems.ts';

/** makeEvent covers neither column, and both decide which rail an item joins. */
function setShelf(event: EventRow, category: string, city: string) {
  db().prepare(`UPDATE events SET category = ?, city = ? WHERE id = ?`).run(category, city, event.id);
}

const seller = makeOrganizer({ name: 'Bazaar Seller' });

// ---------------- The shelves ----------------

// The shop being looked at: one item on sale, one more on sale, and one
// announced but not yet buyable.
const kitchen = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Sunita’s Kitchen',
  tiers: [
    { tierKey: 'momo', name: 'Chicken momo' },
    { tierKey: 'sel', name: 'Sel roti' },
    { tierKey: 'chiya', name: 'Masala chiya', status: 'coming-soon' },
  ],
});
setShelf(kitchen, 'khaja-food', 'Berlin');

// Another real seller on the same shelf, in another town — what the cross-shop
// rail exists to surface. One buyable item, one not.
const lumbini = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Lumbini Kitchen',
  tiers: [
    { tierKey: 'gundruk', name: 'Gundruk' },
    { tierKey: 'festival-sel', name: 'Festival sel roti', status: 'coming-soon' },
  ],
});
setShelf(lumbini, 'khaja-food', 'Hamburg');

// The site's own example shop, on that same shelf. It belongs in the rail — a
// visitor should see the shelf is not empty — but behind anybody who can
// actually take an order.
const example = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Momo House (example shop)',
  tiers: [{ tierKey: 'ex-momo', name: 'Buff momo' }],
});
setShelf(example, 'khaja-food', 'Berlin');

// A different shelf entirely: near neither rail.
const spice = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Taplejung Spice',
  tiers: [{ tierKey: 'timur', name: 'Timur 100g' }],
});
setShelf(spice, 'groceries-spices', 'Munich');

// ---------------- The baskets ----------------

// A shop whose seller never picked a shelf — which is also where the
// co-purchase fixtures live, so both facts get exercised on real rows.
const pantry = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Corner Pantry',
  tiers: [
    { tierKey: 'momo-set', name: 'Momo set' },
    { tierKey: 'achar', name: 'Tomato achar' },
    { tierKey: 'bhatmas', name: 'Bhatmas sadeko' },
    { tierKey: 'gundruk', name: 'Gundruk packet' },
    { tierKey: 'chiya', name: 'Chiya leaves' },
  ],
});

const line = (tierId: string) => ({ tierId, quantity: 1 });

// Three paid baskets hold the momo set with the achar; two of those also hold
// bhatmas and gundruk. So: achar 3, bhatmas 2, gundruk 2 — and chiya 1, which
// is the number the floor exists to refuse.
makePaidOrder({ eventId: pantry.id, items: [line('momo-set'), line('achar'), line('bhatmas'), line('gundruk')] });
makePaidOrder({ eventId: pantry.id, items: [line('momo-set'), line('achar'), line('bhatmas'), line('gundruk')] });
makePaidOrder({ eventId: pantry.id, items: [line('momo-set'), line('achar')] });
makePaidOrder({ eventId: pantry.id, items: [line('momo-set'), line('chiya')] });

// Two more baskets pairing the momo set with chiya, neither of them paid for.
// If unpaid orders counted, chiya would clear the floor at three baskets and
// appear beside the others — which is exactly what must not happen.
makeOrder({ eventId: pantry.id, items: [line('momo-set'), line('chiya')] });
makeOrder({ eventId: pantry.id, items: [line('momo-set'), line('chiya')] });

// A second shop keying its items exactly the same way, because sellers do.
// Tier keys are unique only within a listing, so this is the fixture that
// catches a query that forgot to say which shop it was asking about.
const rival = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Rival Pantry',
  tiers: [
    { tierKey: 'momo-set', name: 'Momo set' },
    { tierKey: 'achar', name: 'Chilli achar' },
  ],
});
makePaidOrder({ eventId: rival.id, items: [line('momo-set'), line('achar')] });
makePaidOrder({ eventId: rival.id, items: [line('momo-set'), line('achar')] });

// ---------------- Helpers ----------------

const all = () => listShopItems();
const find = (name: string): ShopItem => all().find((i) => i.tier.name === name)!;
const names = (items: ShopItem[]) => items.map((i) => i.tier.name);

/**
 * The bazaar handed over in an order the rails must not depend on. Reversed
 * rather than shuffled so a failure is reproducible rather than occasional.
 */
const scrambled = () => [...all()].reverse();

// ---------------- More from this shop ----------------

test('the rail of a shop’s own goods never contains the item you are reading', () => {
  const momo = find('Chicken momo');
  const rail = moreFromShop(scrambled(), momo);
  assert.deepEqual(
    new Set(names(rail)),
    new Set(['Sel roti', 'Masala chiya']),
    'everything else this seller stocks, and nothing else'
  );
  assert.equal(
    names(rail).includes('Chicken momo'),
    false,
    'the tile a visitor is already looking at is not a suggestion'
  );
});

test('“more from this shop” means this shop, and no other', () => {
  const momo = find('Chicken momo');
  for (const item of moreFromShop(scrambled(), momo)) {
    assert.equal(item.shop.id, kitchen.id, `${item.tier.name} belongs to ${item.shopName}`);
  }
});

test('what a shopper can buy comes first, whatever order the page held', () => {
  // Masala chiya is announced but not on sale yet. It stays in the rail —
  // nothing is hidden — and it goes last.
  assert.deepEqual(names(moreFromShop(scrambled(), find('Chicken momo'))), ['Sel roti', 'Masala chiya']);
});

test('the cap takes the front of the rail, not an arbitrary slice of it', () => {
  assert.deepEqual(names(moreFromShop(scrambled(), find('Chicken momo'), 1)), ['Sel roti']);
  assert.deepEqual(moreFromShop(scrambled(), find('Chicken momo'), 0), []);
});

// ---------------- Others on this shelf ----------------

test('the shelf rail crosses shops and excludes the one you are in', () => {
  const rail = othersOnShelf(scrambled(), find('Chicken momo'));
  assert.deepEqual(
    new Set(names(rail)),
    new Set(['Gundruk', 'Buff momo', 'Festival sel roti']),
    'the same shelf at every OTHER seller'
  );
  for (const item of rail) {
    assert.notEqual(item.shop.id, kitchen.id, 'this seller already has a rail of their own above');
  }
});

test('a shelf rail holds the shelf, not the whole bazaar', () => {
  const rail = othersOnShelf(scrambled(), find('Chicken momo'));
  assert.equal(names(rail).includes('Timur 100g'), false, 'spices are not on the food shelf');
});

test('in stock first, then real sellers before the site’s own example shops', () => {
  assert.deepEqual(
    names(othersOnShelf(scrambled(), find('Chicken momo'))),
    ['Gundruk', 'Buff momo', 'Festival sel roti'],
    'somebody who came to buy meets a seller who can take the order first'
  );
});

test('an item nobody filed on a shelf gets no shelf rail at all', () => {
  // Corner Pantry's seller picked no category. Matching on the empty shelf
  // would gather up everything else nobody filed either and present it as
  // related; it is not related, it is merely also unlabelled.
  assert.deepEqual(othersOnShelf(scrambled(), find('Momo set')), []);
});

// ---------------- Often bought together ----------------

test('a pairing seen in two paid baskets shows up; one seen in a single basket does not', () => {
  const rows = boughtTogether(pantry.id, 'momo-set');
  assert.deepEqual(rows, [
    { tierKey: 'achar', orders: 3 },
    { tierKey: 'bhatmas', orders: 2 },
    { tierKey: 'gundruk', orders: 2 },
  ]);
  assert.equal(
    rows.some((r) => r.tierKey === 'chiya'),
    false,
    'one shared basket is a coincidence, and the page must not call it a pattern'
  );
});

test('the count is baskets, and it decides the order; ties fall back to the key', () => {
  // bhatmas and gundruk are level at two, so the tie-break is the only thing
  // that can be deciding this order — and it has to decide it the same way on
  // every render, not however the planner feels.
  assert.deepEqual(
    boughtTogether(pantry.id, 'momo-set').map((r) => r.tierKey),
    ['achar', 'bhatmas', 'gundruk']
  );
});

test('an order nobody has paid for is not a purchase', () => {
  // Two more baskets pair chiya with the momo set, and neither has been paid
  // for. Counting them would take chiya to three baskets and straight past the
  // floor — a pattern built entirely out of people who changed their minds.
  assert.deepEqual(boughtTogether(pantry.id, 'chiya'), []);
  assert.equal(
    boughtTogether(pantry.id, 'momo-set').some((r) => r.tierKey === 'chiya'),
    false
  );
});

test('another shop’s orders never leak in, however it keys its items', () => {
  // Rival Pantry sells its own 'achar' under the same key, in two paid orders.
  assert.deepEqual(boughtTogether(pantry.id, 'momo-set')[0], { tierKey: 'achar', orders: 3 });
  assert.deepEqual(boughtTogether(rival.id, 'momo-set'), [{ tierKey: 'achar', orders: 2 }]);
});

test('an item is never bought together with itself', () => {
  assert.equal(
    boughtTogether(pantry.id, 'momo-set').some((r) => r.tierKey === 'momo-set'),
    false,
    'that row would win every time and say nothing'
  );
});

test('an item with no purchase history at all gets an empty block, not a guess', () => {
  assert.deepEqual(boughtTogether(kitchen.id, 'momo'), []);
  assert.deepEqual(boughtTogether(pantry.id, 'no-such-item'), []);
});

test('the cap keeps the strongest pairings', () => {
  assert.deepEqual(boughtTogether(pantry.id, 'momo-set', 2), [
    { tierKey: 'achar', orders: 3 },
    { tierKey: 'bhatmas', orders: 2 },
  ]);
});
