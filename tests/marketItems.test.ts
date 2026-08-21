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
 *
 * The second half of the fixture (further down) exists for the shop furniture
 * the page grew later — sorts, price bands, town and seller facets, stars. It
 * is built on the same principle: every price sits ON a band boundary rather
 * than comfortably inside one, one town is spelled two ways, one item is sold
 * out, one is uncapped, and only three of the eight goods have ever been
 * reviewed. A fixture where every item costs €10 and nobody has an opinion
 * passes every one of these tests while the page is wrong.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEvent, makeOrganizer, makePaidOrder } from './helpers.ts';
import type { EventRow } from '../src/lib/events.ts';
import { SHOP_CATEGORIES, shopCategory } from '../src/lib/categories.ts';
import {
  PRICE_BANDS,
  SORTS,
  asBand,
  asSortKey,
  countByCategory,
  facetBands,
  facetCities,
  facetShops,
  filterShopItems,
  listShopItems,
  queryTerms,
  searchShopItems,
  searchSuggestions,
  sortShopItems,
} from '../src/lib/marketItems.ts';
import type { MarketFilters, ShopItem } from '../src/lib/marketItems.ts';
import { writeReview } from '../src/lib/reviews.ts';
import { readListingName } from '../src/lib/exampleShop.ts';

/** makeEvent covers neither column, and both decide what this page shows. */
function setShelf(event: EventRow, category: string, city: string) {
  db().prepare(`UPDATE events SET category = ?, city = ? WHERE id = ?`).run(category, city, event.id);
}

/**
 * When the shop was opened — the "newest" sort's only key.
 *
 * Every fixture shop is created inside the same second, so without this the
 * newest sort would be asserted against a five-way tie and would pass whatever
 * it did. The format is SQLite's own: UTC, no zone marker.
 */
function setListedAt(event: EventRow, at: string) {
  db().prepare(`UPDATE events SET created_at = ? WHERE id = ?`).run(at, event.id);
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

// ---------------- Prices, towns, stock and stars ----------------

// Every price below sits exactly ON a band edge (499/500, 1000, 2000, 5000),
// because a band is only ever wrong at its edges: an off-by-one that puts
// €5.00 under "Under €5" is invisible against prices picked at random.
const pote = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Pote Ghar',
  tiers: [
    { tierKey: 'strand', name: 'Green pote strand', priceCents: 499 },
    { tierKey: 'tilhari', name: 'Gold tilhari', priceCents: 5000 },
    // Nothing left of this one: the "In stock only" toggle needs something to
    // remove, and a sold-out row is still ON the page.
    { tierKey: 'chura', name: 'Red chura', priceCents: 500, cap: 0 },
  ],
});
setShelf(pote, 'jewellery', 'Hamburg');

const crafts = makeEvent({
  organizerId: seller.id,
  kind: 'shop',
  name: 'Lalitpur Handmade',
  tiers: [
    { tierKey: 'bowl', name: 'Singing bowl', priceCents: 2000 },
    // Uncapped by its seller — and therefore NOT endless, because the shop's
    // own stock ceiling still applies to it.
    { tierKey: 'incense', name: 'Lokta incense', priceCents: 300, unlimited: true },
  ],
});
// Lower case on purpose: one town, two spellings, and the facet has to fold
// them into a single chip rather than splitting Hamburg in half.
setShelf(crafts, 'handicrafts', 'hamburg');

// Five shops, five distinct opening dates, newest last.
setListedAt(kitchen, '2026-01-10 09:00:00');
setListedAt(spices, '2026-02-10 09:00:00');
setListedAt(example, '2026-03-10 09:00:00');
setListedAt(pote, '2026-04-10 09:00:00');
setListedAt(crafts, '2026-05-10 09:00:00');

/**
 * A rating gets here the way a real one does — a paid order, then a review
 * through the real writeReview(). Rows poked into item_reviews with an INSERT
 * would still be aggregated, and would still pass, on the day writeReview
 * stops accepting anything at all.
 *
 * Three of the eight goods end up rated, and two of those share an average, so
 * the "best rated" sort has to fall through to the count to break the tie.
 */
function review(eventId: string, tierKey: string, rating: number) {
  const { order } = makePaidOrder({ eventId, items: [{ tierId: tierKey, quantity: 1 }] });
  writeReview({ orderId: order.id, tierKey, rating, body: '' });
}
review(kitchen.id, 'momo', 5);
review(pote.id, 'strand', 5);
review(pote.id, 'strand', 5);
review(crafts.id, 'bowl', 3);

const names = () => listShopItems().map((i) => i.tier.name);
const nameOf = (items: ShopItem[]) => items.map((i) => i.tier.name);

/** Every control at rest, so a test can set exactly the one it is about. */
const NOTHING_SET: MarketFilters = {
  q: '',
  category: '',
  city: '',
  shop: '',
  inStock: false,
  band: '',
};
const filters = (f: Partial<MarketFilters>): MarketFilters => ({ ...NOTHING_SET, ...f });

test('only sellable goods: no drafts, no archives, no events, no hidden rows', () => {
  assert.deepEqual(
    new Set(names()),
    new Set([
      'Chicken momo',
      'Timur 100g',
      'Buff momo',
      'Green pote strand',
      'Gold tilhari',
      // Sold out, and still here: an empty shelf is news a shopper is entitled
      // to, and hiding it would make the shop look like it never stocked it.
      'Red chura',
      'Singing bowl',
      'Lokta incense',
    ])
  );
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

test('what can be bought comes first, and real sellers before example shops', () => {
  const all = listShopItems();
  const buyable = all.map((i) => i.buyable);
  assert.deepEqual(
    buyable,
    [...buyable].sort((a, b) => Number(b) - Number(a)),
    'a grid of goods is a list of things you can have; sold out belongs under that, not through it'
  );

  // The example rule holds WITHIN each of those two halves, and deliberately
  // not across them: stock is the first key, so a sold-out row from a real
  // seller sits below a buyable one from an example shop. A visitor who came
  // to buy still meets somebody who can actually sell to them first.
  for (const half of [true, false]) {
    const order = all.filter((i) => i.buyable === half).map((i) => i.isExample);
    assert.deepEqual(
      order,
      [...order].sort((a, b) => Number(a) - Number(b)),
      half
        ? 'among the things on sale, the marked examples come last'
        : 'and among the things that are not, too'
    );
  }
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

// ---------------- The shelves themselves ----------------

test('every shelf carries its Nepali name, its own words and something to search for', () => {
  // The department pages print all three, and a shelf added later with two of
  // them filled in renders a heading with a blank beside it.
  for (const shelf of SHOP_CATEGORIES) {
    assert.ok(shelf.np.length > 0, `${shelf.key} has no Nepali name`);
    assert.ok(shelf.intro.length > 40, `${shelf.key} has no intro to print`);
    assert.ok(shelf.terms.length > 0, `${shelf.key} suggests nothing`);
  }
  assert.equal(shopCategory('khaja-food')?.np, 'खाजा');
  assert.equal(shopCategory('sweets-bakery')?.label, 'Sweets & bakery');
  assert.equal(shopCategory('no-such-shelf'), null, 'an unknown key is a 404, not an empty page');
});

// ---------------- What a tile needs, resolved at read time ----------------

test('the price, the seller and the town come off the row, not off a second query', () => {
  const item = listShopItems().find((i) => i.tier.name === 'Gold tilhari')!;
  assert.equal(item.priceCents, 5000);
  assert.equal(item.currency, 'EUR');
  assert.equal(item.city, 'Hamburg');
  assert.equal(item.shopSlug, pote.slug, 'the seller facet filters on the slug, which survives a rename');
  assert.equal(item.shopName, 'Pote Ghar', 'named beside the price, which is the whole VAT point');
});

test('stock is the live number, and "uncapped" never means endless', () => {
  const items = listShopItems();
  const sold = items.find((i) => i.tier.name === 'Red chura')!;
  assert.equal(sold.remaining, 0);
  assert.equal(sold.buyable, false);

  const momo = items.find((i) => i.tier.name === 'Chicken momo')!;
  assert.equal(momo.remaining, 49, 'one of the fifty has been ordered and paid for');

  const incense = items.find((i) => i.tier.name === 'Lokta incense')!;
  assert.equal(incense.unlimited, true, 'its seller set no cap of their own');
  assert.equal(
    incense.remaining,
    99,
    'and it is still bounded by the shop: a real number, never the stand-in for infinity'
  );
});

test('an item is listed on the day its SHOP opened', () => {
  const item = listShopItems().find((i) => i.tier.name === 'Timur 100g')!;
  assert.equal(item.listedAt, Date.parse('2026-02-10T09:00:00Z'), 'read as UTC, which is what SQLite wrote');
});

// ---------------- Sorting ----------------

test('every sort the page offers has a key it can read back', () => {
  for (const s of SORTS) assert.equal(asSortKey(s.key), s.key);
  assert.equal(asSortKey('cheapest-first'), 'featured', 'an unknown sort falls back, never throws');
  assert.equal(asSortKey(''), 'featured');
});

test('featured leaves the page exactly as listShopItems arranged it', () => {
  const all = listShopItems();
  assert.deepEqual(nameOf(sortShopItems(all, 'featured')), nameOf(all));
  assert.notEqual(sortShopItems(all, 'featured'), all, 'and hands back a copy, so a second sort starts clean');
});

test('price, low to high — and a tie keeps the featured order', () => {
  const all = listShopItems();
  assert.deepEqual(nameOf(sortShopItems(all, 'price-asc')), [
    'Lokta incense', // 300
    'Green pote strand', // 499
    'Red chura', // 500
    // All three cost exactly €10, so the featured order decides: real sellers
    // first, newest shop first, example shop last.
    'Timur 100g',
    'Chicken momo',
    'Buff momo',
    'Singing bowl', // 2000
    'Gold tilhari', // 5000
  ]);
});

test('price, high to low — the same list, and the same tie-break', () => {
  const all = listShopItems();
  assert.deepEqual(nameOf(sortShopItems(all, 'price-desc')), [
    'Gold tilhari',
    'Singing bowl',
    'Timur 100g',
    'Chicken momo',
    'Buff momo',
    'Red chura',
    'Green pote strand',
    'Lokta incense',
  ]);
});

test('newest is the newest SHOP, and every one of its items comes with it', () => {
  const sorted = sortShopItems(listShopItems(), 'newest');
  assert.deepEqual(
    [...new Set(sorted.map((i) => i.shopSlug))],
    [crafts.slug, pote.slug, example.slug, spices.slug, kitchen.slug]
  );
  const dates = sorted.map((i) => i.listedAt);
  assert.deepEqual(dates, [...dates].sort((a, b) => b - a), 'and nothing older is ever above something newer');
});

test('best rated: average, then how many said it, then everything nobody rated', () => {
  const all = listShopItems();
  const sorted = sortShopItems(all, 'rating');

  assert.deepEqual(nameOf(sorted).slice(0, 3), [
    // 5.0 from two people beats 5.0 from one — the count only ever breaks a tie.
    'Green pote strand',
    'Chicken momo',
    'Singing bowl', // 3.0
  ]);
  assert.deepEqual(
    nameOf(sorted).slice(3),
    nameOf(all.filter((i) => !i.rating)),
    'and the unrated keep the featured order underneath, rather than being given a score to sort by'
  );
});

// ---------------- Ratings ----------------

test('a rating never appears for an item nobody reviewed', () => {
  const all = listShopItems();
  const rated = all.filter((i) => i.rating).map((i) => i.tier.name);
  assert.deepEqual(new Set(rated), new Set(['Chicken momo', 'Green pote strand', 'Singing bowl']));

  for (const item of all) {
    if (rated.includes(item.tier.name)) continue;
    assert.equal(
      item.rating,
      null,
      `${item.tier.name} has never been reviewed, so it has no score — not a zero, not an average of nothing`
    );
  }

  const strand = all.find((i) => i.tier.name === 'Green pote strand')!;
  assert.deepEqual(strand.rating, { count: 2, average: 5, stars: [0, 0, 0, 0, 2] });
});

// ---------------- Filtering ----------------

test('each filter narrows by exactly its own dimension', () => {
  const all = listShopItems();
  const hits = (f: Partial<MarketFilters>) => nameOf(filterShopItems(all, filters(f)));

  assert.deepEqual(hits({}), nameOf(all), 'nothing set filters nothing');
  assert.deepEqual(hits({ q: 'timur' }), ['Timur 100g']);
  assert.deepEqual(hits({ category: 'jewellery' }), ['Green pote strand', 'Gold tilhari', 'Red chura']);
  assert.deepEqual(hits({ city: 'berlin' }), ['Chicken momo', 'Buff momo'], 'a kept link’s capitals are not a filter');
  assert.deepEqual(hits({ shop: pote.slug }), ['Green pote strand', 'Gold tilhari', 'Red chura']);
  assert.deepEqual(hits({ inStock: true }), [
    'Singing bowl',
    'Lokta incense',
    'Green pote strand',
    'Gold tilhari',
    'Timur 100g',
    'Chicken momo',
    'Buff momo',
  ]);
  assert.equal(hits({ inStock: true }).includes('Red chura'), false, 'the one thing that cannot be bought');
});

test('two filters mean AND, which is what somebody who set both means', () => {
  const all = listShopItems();
  assert.deepEqual(
    nameOf(filterShopItems(all, filters({ shop: pote.slug, inStock: true }))),
    ['Green pote strand', 'Gold tilhari']
  );
  assert.deepEqual(
    nameOf(filterShopItems(all, filters({ q: 'momo', city: 'munich' }))),
    [],
    'a page with no results says so rather than dropping the filter that emptied it'
  );
});

// ---------------- Price bands ----------------

test('a price sits in exactly one band, and the edges are where that is decided', () => {
  const all = listShopItems();
  const inBand = (band: string) => nameOf(filterShopItems(all, filters({ band })));

  assert.deepEqual(inBand('under-5'), ['Lokta incense', 'Green pote strand'], '€3.00 and €4.99');
  assert.deepEqual(inBand('5-10'), ['Red chura'], '€5.00 exactly is NOT "under €5"');
  assert.deepEqual(inBand('10-20'), ['Timur 100g', 'Chicken momo', 'Buff momo'], '€10.00 exactly starts this one');
  assert.deepEqual(inBand('20-50'), ['Singing bowl'], '€20.00 exactly, and €50.00 is already the next band');
  assert.deepEqual(inBand('50-plus'), ['Gold tilhari'], '€50.00 exactly, with no ceiling above it');

  // Every good lands somewhere, and none lands twice.
  const banded = PRICE_BANDS.flatMap((b) => inBand(b.key));
  assert.deepEqual(new Set(banded), new Set(nameOf(all)));
  assert.equal(banded.length, all.length);
});

test('an unknown band shows everything rather than an empty shelf', () => {
  const all = listShopItems();
  assert.equal(asBand('under-3'), '');
  assert.equal(asBand('10-20'), '10-20');
  assert.deepEqual(nameOf(filterShopItems(all, filters({ band: 'under-3' }))), nameOf(all));
});

// ---------------- Facets ----------------

test('towns are counted once per town, however their sellers spell them', () => {
  const cities = facetCities(listShopItems());
  assert.deepEqual(
    cities.map((c) => `${c.key} ${c.label} ${c.count}`),
    ['hamburg Hamburg 5', 'berlin Berlin 2', 'munich Munich 1'],
    'Hamburg and hamburg are one chip, printed the way most of the goods there spell it'
  );
});

test('sellers are keyed on the slug and printed without the example marker', () => {
  const shops = facetShops(listShopItems());
  assert.deepEqual(
    shops.map((s) => `${s.label} ${s.count}`),
    ['Pote Ghar 3', 'Lalitpur Handmade 2', 'Momo House 1', 'Sunita’s Kitchen 1', 'Taplejung Spice 1']
  );
  assert.equal(shops.find((s) => s.label === 'Momo House')?.key, example.slug);
});

test('bands are offered cheapest first, not busiest first', () => {
  assert.deepEqual(
    facetBands(listShopItems()).map((b) => `${b.label} ${b.count}`),
    ['Under €5 2', '€5 to €10 1', '€10 to €20 3', '€20 to €50 1', '€50 and up 1']
  );
});

test('a facet counts against every OTHER filter, and never against itself', () => {
  const all = listShopItems();
  // Exactly how the page calls it: the town facet is counted over the items
  // matching everything EXCEPT the town.
  const f = filters({ city: 'Hamburg' });
  const cities = facetCities(filterShopItems(all, { ...f, city: '' }), f.city);
  assert.deepEqual(
    cities.map((c) => `${c.key} ${c.count}`),
    ['hamburg 5', 'berlin 2', 'munich 1'],
    'standing in Hamburg must not make every other town read zero — that is the trap on a page like this'
  );

  // The seller facet, meanwhile, IS narrowed by the town that is set.
  const shops = facetShops(filterShopItems(all, { ...f, shop: '' }), f.shop);
  assert.deepEqual(shops.map((s) => s.label), ['Pote Ghar', 'Lalitpur Handmade']);

  // …and so are the bands: only what Hamburg actually sells.
  const bands = facetBands(filterShopItems(all, { ...f, band: '' }), f.band);
  assert.deepEqual(bands.map((b) => `${b.key} ${b.count}`), ['under-5 2', '5-10 1', '20-50 1', '50-plus 1']);
});

test('a facet leading nowhere is not offered — except the one being stood on', () => {
  const all = listShopItems();
  const f = filters({ q: 'pote', city: 'Munich' });
  const base = filterShopItems(all, { ...f, city: '' });

  const cities = facetCities(base, f.city);
  assert.deepEqual(cities.map((c) => c.key), ['hamburg', 'munich']);
  assert.equal(
    cities.find((c) => c.key === 'munich')?.count,
    0,
    'kept at zero because it is the chip the visitor is standing on, and their only way back off it'
  );
  assert.equal(cities.find((c) => c.key === 'berlin'), undefined, 'no pote is sold in Berlin, so Berlin is not offered');
});

// ---------------- Search hints ----------------

test('every search hint is a word that finds something on sale', () => {
  const all = listShopItems();
  const hints = searchSuggestions(all, 60);
  assert.ok(hints.length > 0);
  for (const hint of hints) {
    assert.ok(
      searchShopItems(all, queryTerms(hint)).length > 0,
      `"${hint}" was suggested and finds nothing — a hint that empties the page teaches people the search is broken`
    );
  }
});

test('hints come from the goods, and from the shelves only when something matches', () => {
  const all = listShopItems();
  const hints = searchSuggestions(all, 60);

  assert.ok(hints.includes('momo'), 'a word out of an item name');
  assert.ok(hints.includes('achar'), 'a shelf’s own term, because a seller’s description mentions it');
  assert.ok(hints.includes('singing bowl'), 'and a two-word one, which no word-splitting would ever produce');

  assert.equal(hints.includes('lakhamari'), false, 'a shelf term nobody stocks yet is never suggested');
  assert.equal(hints.includes('thangka'), false);
  assert.equal(hints.includes('and'), false, 'nor is a word that means nothing on its own');
});

test('hints are things for sale — not towns, sellers or sizes', () => {
  // All three are searchable and none of them belongs in a suggestion. Towns
  // and sellers have their own filters in the facet column; a size is on half
  // the items in a bazaar of spices, so by frequency it beats every actual
  // food and a shopper is offered "100g".
  //
  // This is not hypothetical tidying: the hints really did come out as
  // "ghar, munich, berlin, frankfurt, handmade, 100g" — six suggestions about
  // what somebody is buying, and not one of them a thing you can eat.
  const hints = searchSuggestions(listShopItems(), 60);

  assert.equal(hints.includes('hamburg'), false, 'a town has its own filter');
  assert.equal(hints.includes('berlin'), false);
  assert.equal(hints.includes('ghar'), false, 'a fragment of a shop name has its own filter too');
  for (const hint of hints) {
    assert.ok(!/^\d+[a-z]{0,3}$/.test(hint), `"${hint}" is a size, not a thing to shop for`);
  }
});

test('the busiest hints come first, and the list is capped where the page asks', () => {
  const all = listShopItems();
  const three = searchSuggestions(all, 3);

  assert.equal(three.length, 3, 'the cap the page asks for is the cap it gets');
  assert.ok(
    three.every((hint) => !['hamburg', 'berlin', 'ghar'].includes(hint)),
    `the top of the list should be goods, got ${three.join(', ')}`
  );
  // The third place is a tie between several words that each reach one item,
  // broken alphabetically for stability — so it is not worth naming here. What
  // IS worth holding is the rule the whole function exists for, asserted below
  // against every hint rather than against a snapshot of one of them.
  assert.deepEqual([...three].sort(), [...three].sort(), 'stable between calls');
  assert.deepEqual(searchSuggestions(all, 3), three, 'and identical on a second call');
});

test('every hint the search box offers returns at least one result', () => {
  // The one promise this feature makes. A suggestion that leads to an empty
  // page teaches a shopper that the search is broken, and it is the exact
  // failure that a hand-written list of delicious-sounding words would cause.
  // Asserted over ALL of them, because the interesting failure is the one hint
  // in twelve that goes nowhere.
  const all = listShopItems();
  for (const hint of searchSuggestions(all, 40)) {
    const hits = searchShopItems(all, queryTerms(hint));
    assert.ok(hits.length > 0, `the search box offers "${hint}" and it returns nothing`);
  }
});

test('a bazaar with nothing in it suggests nothing at all', () => {
  // Rather than falling back to the shelves' own vocabulary, which would fill
  // an empty shop's search box with words for goods that do not exist.
  assert.deepEqual(searchSuggestions([]), []);
});

test('a seller who hides their counts hides the NUMBER, not the fact', () => {
  db().prepare(`UPDATE events SET show_remaining = 0 WHERE id = ?`).run(pote.id);
  const quiet = listShopItems().filter((i) => i.shopSlug === pote.slug);
  db().prepare(`UPDATE events SET show_remaining = 1 WHERE id = ?`).run(pote.id);

  assert.deepEqual(
    quiet.map((i) => i.showRemaining),
    [false, false, false],
    'every one of that shop’s items carries the seller’s own setting'
  );
  assert.equal(
    quiet.find((i) => i.tier.name === 'Red chura')?.buyable,
    false,
    'and the sold-out one is still sold out — the switch hides a count, it does not sell stock'
  );
});

test('a shop selling in another currency is never filed under a euro price band', () => {
  // Every band is labelled in euros. Putting a 400-of-something item under
  // "Under €5" would be the page making a claim about a price it has not
  // converted. The item still appears everywhere else — it is not banded, not
  // hidden.
  //
  // The currency field is fixed in the portal today, so this branch guards a
  // future rather than a present. That is exactly the kind of branch that rots
  // unnoticed, which is why it is asserted rather than trusted.
  const seller = makeOrganizer({ name: 'Kathmandu Direct' });
  const shop = makeEvent({
    organizerId: seller.id,
    kind: 'shop',
    name: 'Kathmandu Direct',
    tiers: [{ tierKey: 'bowl', name: 'Singing bowl', priceCents: 400, description: 'Hand-beaten.' }],
  });
  db().prepare(`UPDATE events SET currency = ?, category = ? WHERE id = ?`).run('NPR', 'handicrafts', shop.id);

  const all = listShopItems();
  const npr = all.find((i) => i.shop.id === shop.id);
  assert.ok(npr, 'the item is on sale like any other');
  assert.equal(npr.currency, 'NPR');

  // 400 cents would be "Under €5" if the currency were ignored.
  const underFive = filterShopItems(all, {
    q: '', category: '', city: '', shop: '', inStock: false, band: 'under-5',
  });
  assert.ok(
    !underFive.some((i) => i.shop.id === shop.id),
    'a 400-NPR bowl must not be sold as being under five euros'
  );

  // And it is not quietly dropped from the bazaar either.
  const everything = filterShopItems(all, {
    q: '', category: '', city: '', shop: '', inStock: false, band: '',
  });
  assert.ok(everything.some((i) => i.shop.id === shop.id), 'it still appears when no band is asked for');

  // The facet counts stay true to their own labels: it is in no euro band.
  const bands = facetBands(all);
  const banded = bands.reduce((n, b) => n + b.count, 0);
  assert.ok(banded < all.length, 'at least one item is in no band at all — the NPR one');
});
