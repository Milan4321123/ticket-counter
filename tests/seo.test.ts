/**
 * WHAT THE SITE TELLS GOOGLE, AND WHETHER THE PAGE AGREES WITH IT.
 *
 * Structured data is the one place where a mistake is not visible to anybody
 * looking at the site. A wrong <h1> gets noticed the first time somebody
 * loads the page; a Product claiming four and a half stars on an item nobody
 * has reviewed looks perfect in a browser and quietly costs rich results
 * across the whole domain when Google checks the claim against the page.
 *
 * So the two properties asserted here are both "the markup says what the page
 * says":
 *
 *   1. aggregateRating exists only where a real rating does, and reads the
 *      same number the page prints.
 *   2. The breadcrumb trail in the markup is the trail the page draws — which
 *      for a shop item means it hangs off the bazaar and its shelf, not off
 *      the events feed.
 *
 * The second one is here because it was WRONG: every shop item told Google it
 * lived under "Events", while the page above it said "The bazaar › Groceries
 * & spices › …". Google grants the breadcrumb rich result only when the two
 * agree, so the site was quietly failing to earn it on every item page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEvent, makeOrganizer, makePaidOrder } from './helpers.ts';
import { getEventTiers } from '../src/lib/events.ts';
import { itemBreadcrumbJsonLd, itemDescription, itemJsonLd } from '../src/lib/seo.ts';
import { ratingForItem, writeReview } from '../src/lib/reviews.ts';

const seller = makeOrganizer({ name: 'Sunita Rai' });

/** A published shop on a shelf, with one thing on sale. */
function makeShop(category: string) {
  const shop = makeEvent({
    organizerId: seller.id,
    kind: 'shop',
    name: 'Sunita’s Home Kitchen',
    tiers: [{ tierKey: 'momo', name: 'Chicken momo · 20 pieces', description: 'With tomato achar.' }],
  });
  db().prepare(`UPDATE events SET category = ?, city = ? WHERE id = ?`).run(category, 'Berlin', shop.id);
  return { shop, tier: getEventTiers(shop.id)[0] };
}

function product(shop: ReturnType<typeof makeShop>, rating: { count: number; average: number } | null) {
  return itemJsonLd({
    event: { ...shop.shop, category: 'khaja-food' },
    tiers: [shop.tier],
    tier: shop.tier,
    remaining: 5,
    totalRemaining: 5,
    images: [],
    sellerName: 'Sunita Rai',
    url: 'https://example.test/e/x/item/momo',
    rating,
  });
}

test('no reviews means no aggregateRating in the markup at all', () => {
  const shop = makeShop('khaja-food');
  assert.equal(ratingForItem(shop.shop.id, 'momo'), null, 'fixture check: nobody has reviewed it');
  assert.equal(product(shop, null).aggregateRating, undefined);
  // The shape ratingForItem actually returns must be accepted as-is, so the
  // page never has to translate between the two.
  assert.equal(product(shop, ratingForItem(shop.shop.id, 'momo')).aggregateRating, undefined);
});

test('a rating in the markup is the same number the page prints', () => {
  const shop = makeShop('khaja-food');
  for (const rating of [5, 4]) {
    const { order } = makePaidOrder({ eventId: shop.shop.id, items: [{ tierId: 'momo', quantity: 1 }] });
    writeReview({ orderId: order.id, tierKey: 'momo', rating, body: 'Good.' });
  }

  const summary = ratingForItem(shop.shop.id, 'momo');
  assert.ok(summary, 'fixture check: two reviews were written');
  assert.equal(summary.count, 2);
  assert.equal(summary.average, 4.5);

  const agg = product(shop, summary).aggregateRating as Record<string, unknown>;
  assert.equal(agg.ratingValue, '4.5', 'the markup must print the same average as the page');
  assert.equal(agg.reviewCount, 2);
  assert.equal(agg.bestRating, 5);
});

test('a shop item hangs off the bazaar and its shelf, not off the events feed', () => {
  const shop = makeShop('khaja-food');
  const trail = itemBreadcrumbJsonLd({ ...shop.shop, category: 'khaja-food' }, shop.tier)
    .itemListElement as { position: number; name: string; item: string }[];

  assert.deepEqual(
    trail.map((s) => s.name),
    ['The bazaar', 'Khaja & cooked food', 'Sunita’s Home Kitchen', 'Chicken momo · 20 pieces'],
    'the markup trail must be the trail the page draws above the title'
  );
  assert.deepEqual(trail.map((s) => s.position), [1, 2, 3, 4]);
  assert.match(trail[0].item, /\/market$/);
  assert.match(trail[1].item, /\/market\/c\/khaja-food$/);
});

test('a shop with no shelf gets a shorter trail, never an empty rung', () => {
  const shop = makeShop('');
  const trail = itemBreadcrumbJsonLd({ ...shop.shop, category: '' }, shop.tier)
    .itemListElement as { position: number; name: string; item: string }[];

  assert.deepEqual(trail.map((s) => s.name), ['The bazaar', 'Sunita’s Home Kitchen', 'Chicken momo · 20 pieces']);
  assert.deepEqual(trail.map((s) => s.position), [1, 2, 3], 'positions renumber rather than skipping 2');
});

test('the example mark is a rendering decision, not part of the structured name', () => {
  const shop = makeShop('khaja-food');
  const marked = { ...shop.shop, name: 'Taplejung Alaichi Ghar (example shop)', category: 'khaja-food' };
  const trail = itemBreadcrumbJsonLd(marked, shop.tier).itemListElement as { name: string }[];
  assert.equal(
    trail[2].name,
    'Taplejung Alaichi Ghar',
    'the mark belongs beside the name on the page, not inside the name everywhere it is quoted'
  );
});

test('an event item still hangs off the events feed', () => {
  const event = makeEvent({
    organizerId: seller.id,
    name: 'Dashain Night 2026',
    tiers: [{ tierKey: 'early', name: 'Early bird' }],
  });
  const tier = getEventTiers(event.id)[0];
  const trail = itemBreadcrumbJsonLd(event, tier).itemListElement as { name: string }[];
  assert.deepEqual(trail.map((s) => s.name), ['Events', 'Dashain Night 2026', 'Early bird']);
});

test('a seller’s one short line gets the shop and town added; a long one does not', () => {
  const shop = makeShop('khaja-food');
  const tier = shop.tier;

  // What a real seller on this site actually wrote. On its own it is a
  // 27-character meta description, which Google treats as thin and replaces.
  const short = itemDescription({ ...shop.shop, city: 'Berlin' }, {
    ...tier,
    description: 'Steamed, with tomato achar.',
    details: '',
  });
  assert.match(short, /^Steamed, with tomato achar\./);
  assert.match(short, /Sunita’s Home Kitchen/, 'the shop name is worth searching for');
  assert.match(short, /Berlin/, 'and so is the town');
  assert.ok(short.length > 50, `still too thin at ${short.length} characters`);

  // A seller who wrote properly is not interrupted to repeat their own shop
  // name — that would push a real sentence out of a result that shows ~155.
  const long =
    'The jar most families come back for, and the reason is arithmetic: it is noticeably ' +
    'cheaper per gram than the 100g and it lasts a household that cooks dal most nights half a year.';
  const written = itemDescription({ ...shop.shop, city: 'Berlin' }, { ...tier, description: '', details: long });
  assert.ok(!written.includes('Sunita’s Home Kitchen'), 'their words, not ours');
  assert.ok(written.length <= 156, `a meta description must fit a result, got ${written.length}`);
});

test('an item nobody described at all still reads like a listing', () => {
  const shop = makeShop('khaja-food');
  const bare = itemDescription({ ...shop.shop, city: 'Berlin' }, { ...shop.tier, description: '', details: '' });
  assert.match(bare, /Chicken momo/);
  assert.match(bare, /Sunita’s Home Kitchen/);
  assert.match(bare, /Berlin/);
});

test('the example mark never leaks into a search result', () => {
  const shop = makeShop('khaja-food');
  const marked = { ...shop.shop, name: 'Taplejung Alaichi Ghar (example shop)', city: 'Berlin' };
  const text = itemDescription(marked, { ...shop.tier, description: 'Whole pods.', details: '' });
  assert.ok(!text.includes('(example shop)'), 'the mark is a rendering decision, not part of the name');
  assert.match(text, /Taplejung Alaichi Ghar/);
});
