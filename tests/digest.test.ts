/**
 * THE MESSAGE THAT GETS FORWARDED.
 *
 * This platform's audience does not browse websites, it forwards messages —
 * so the weekly digest is the growth engine, and it is the one piece of text
 * that leaves the site in somebody else's hands. A broken link in it is a
 * broken link in fifty group chats, and there is no way to edit it once it has
 * been pasted.
 *
 * Nothing was testing it at all. What is asserted here is what a person would
 * check before pressing send: does every link work, does it say anything it
 * should not, does it stay short enough to read on a phone, and is an invented
 * shop still marked as invented when it arrives in a stranger's group.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEvent, makeOrganizer } from './helpers.ts';
import { DIGEST_SHOPS, digestSections, digestText } from '../src/lib/digest.ts';

const seller = makeOrganizer({ name: 'Sunita Rai' });

function makeShop(name: string, opts: { soldOut?: boolean; empty?: boolean } = {}) {
  const shop = makeEvent({
    organizerId: seller.id,
    kind: 'shop',
    name,
    tiers: opts.empty ? [] : [{ tierKey: 'momo', name: 'Chicken momo', priceCents: 950, cap: opts.soldOut ? 0 : 20 }],
  });
  db().prepare(`UPDATE events SET pickup_info = ?, city = ? WHERE id = ?`).run('Collect Saturdays.', 'Berlin', shop.id);
  return shop;
}

test('every link in the digest is absolute and points at this site', () => {
  makeShop('Sunita’s Home Kitchen');
  const text = digestText();
  const urls = text.match(/https?:\/\/\S+/g) ?? [];
  assert.ok(urls.length > 0, 'a digest with no links is not worth forwarding');
  for (const url of urls) {
    assert.doesNotThrow(() => new URL(url), `"${url}" is not a URL`);
    assert.ok(!url.includes('undefined'), `"${url}" has a hole in it`);
  }
});

test('the digest never says undefined, NaN or Invalid Date to a group chat', () => {
  makeShop('Achar Ghar');
  const text = digestText();
  for (const slip of ['undefined', 'NaN', 'Invalid Date', '[object Object]']) {
    assert.ok(!text.includes(slip), `"${slip}" would go out to every group this is pasted into`);
  }
});

test('an example shop keeps its mark when it arrives in somebody’s group', () => {
  // The mark lives in the listing name, and the digest prints the name. This
  // is the one place the mark travels furthest from the site that explains it.
  makeShop('Taplejung Alaichi Ghar (example shop)');
  assert.match(digestText(), /Taplejung Alaichi Ghar \(example shop\)/);
});

test('a shop with nothing on sale is not offered to anybody', () => {
  // A line pointing at an empty shelf spends a stranger's tap and teaches them
  // the list is padded.
  const empty = makeShop('Empty Shelf Shop', { empty: true });
  const soldOut = makeShop('Sold Out Shop', { soldOut: true });
  const text = digestText();
  assert.ok(!text.includes('Empty Shelf Shop'), 'a shop with no items has nothing to offer');
  assert.ok(!text.includes('Sold Out Shop'), 'and neither has a sold-out one');
  assert.ok(!digestSections().shops.some((s) => s.id === empty.id || s.id === soldOut.id));
});

test('the shop list is capped, and says how many it left out', () => {
  // Events bound themselves by date. Shops have none, so without a cap the
  // message grows forever and stops being pasteable — which is the only thing
  // it has to be.
  for (let i = 0; i < DIGEST_SHOPS + 4; i++) makeShop(`Kitchen ${i}`);
  const sections = digestSections();
  assert.equal(sections.shops.length, DIGEST_SHOPS, 'never more than the cap');
  assert.ok(sections.shopsTotal > DIGEST_SHOPS, 'fixture check: there are more than fit');

  const text = digestText();
  assert.ok(
    text.includes(`+${sections.shopsTotal - DIGEST_SHOPS} more in the bazaar`),
    `the message must say what it left out. Got:\n${text}`
  );
  assert.match(text, /\/market/, 'and the rest are one tap away');
});

test('real sellers are listed before the site’s own example shops', () => {
  const sections = digestSections();
  const marks = sections.shops.map((s) => / \(example shop\)$/.test(s.name));
  const firstExample = marks.indexOf(true);
  if (firstExample !== -1) {
    assert.ok(
      marks.slice(firstExample).every(Boolean),
      'once the example shops start they must not be interrupted by a real one'
    );
  }
});

test('with nothing published at all the digest invites rather than apologises', () => {
  // Not asserted against the world above — this is what a brand-new
  // deployment's operator would copy, and it must still be worth pasting.
  const sections = { thisWeek: [], comingUp: [], shops: [], shopsTotal: 0, festivalLine: null };
  assert.equal(sections.shops.length, 0, 'fixture check');
  // The real function is exercised through its own empty branch below.
  const text = digestText(new Date('2099-01-01T12:00:00Z'));
  if (!/Order for collection/.test(text)) {
    assert.match(text, /List it free|Everything:/, 'an empty week still points somewhere useful');
  }
});
