/**
 * THE BAZAAR'S BILINGUAL SEARCH.
 *
 * The bazaar sells things whose names arrive in three spellings — alaichi,
 * अलैंची, cardamom — and the people buying them are split across all three. A
 * search that only matched the seller's own spelling told a German neighbour
 * typing "cardamom" that nobody on the site sells it, next to five listings of
 * it. lib/bazaarWords is the hand-written list that fixes that.
 *
 * The risk it introduces is the reason for this file. A synonym list that
 * over-reaches is worse than none: it returns things a shopper cannot see the
 * reason for, and it quietly makes the search untrustworthy. So the assertions
 * below are as much about what must NOT match as about what must.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEvent, makeOrganizer } from './helpers.ts';
import { BAZAAR_WORDS, containsWord, expansionsFor, relatedWords } from '../src/lib/bazaarWords.ts';
import { listShopItems, queryTerms, searchShopItems } from '../src/lib/marketItems.ts';

test('a word is only found on its own, never inside another', () => {
  assert.ok(containsWord('taplejung ko alaichi', 'alaichi'));
  assert.ok(containsWord('alaichi', 'alaichi'));
  assert.ok(containsWord('pote necklace', 'pote'));
  // The whole reason detection is boundary-aware: these must not match.
  assert.equal(containsWord('the potential of this shop', 'pote'), false);
  assert.equal(containsWord('sandalwood incense', 'dal'), false);
  assert.equal(containsWord('chiurastan', 'chiura'), false);
});

test('Devanagari is matched as a whole word too, where \\b would not help', () => {
  assert.ok(containsWord('ताजा मोमो बिक्रीमा', 'मोमो'));
  assert.ok(containsWord('मोमो', 'मोमो'));
  assert.equal(containsWord('मोमोहरू', 'मोमो'), false);
});

test('a seller writing one spelling gets all of them', () => {
  const related = relatedWords('taplejung ko alaichi, whole pods');
  assert.ok(related.includes('cardamom'), 'the English name a neighbour would type');
  assert.ok(related.includes('अलैंची'), 'the Devanagari an auntie would type');
  assert.ok(related.includes('elaichi'), 'the other romanisation');
  assert.equal(relatedWords('a plain wooden spoon').length, 0, 'nothing it does not recognise');
});

test('every group is self-consistent — no word claimed by two things', () => {
  const owner = new Map<string, string>();
  for (const group of BAZAAR_WORDS) {
    for (const word of group.words) {
      const already = owner.get(word);
      assert.equal(
        already,
        undefined,
        `"${word}" is in both "${already}" and "${group.label}" — one word cannot mean two things here`
      );
      owner.set(word, group.label);
    }
  }
});

test('the explanation names only the connections a shopper could not guess', () => {
  // Typed the sellers' own word: nothing to explain.
  assert.deepEqual(expansionsFor(['alaichi']), []);
  assert.deepEqual(expansionsFor(['momo']), []);
  // Typed the other language: say so.
  assert.deepEqual(expansionsFor(['cardamom']), [{ typed: 'cardamom', label: 'alaichi (cardamom)' }]);
  assert.deepEqual(expansionsFor(['dumplings']), [{ typed: 'dumplings', label: 'momo (dumplings)' }]);
  // A word nobody has taught it stays a word nobody has taught it.
  assert.deepEqual(expansionsFor(['bicycle']), []);
});

test('searching in English finds goods a seller labelled in Nepali, and back', () => {
  const seller = makeOrganizer({ name: 'Rajendra Limbu' });
  const shop = makeEvent({
    organizerId: seller.id,
    kind: 'shop',
    // Deliberately NOT "Alaichi Ghar": the shop name is part of every one of
    // its items' search text, so a shop named after its own goods matches
    // every query about them and the assertions below would pass without the
    // dictionary doing anything at all.
    name: 'Taplejung Pasal',
    tiers: [
      { tierKey: 'pods', name: 'Whole pods · 100g', description: 'Taplejung ko alaichi, picked this season.' },
      { tierKey: 'momo', name: 'मोमो · 20 pieces', description: 'Steamed, with tomato achar.' },
      { tierKey: 'spoon', name: 'Wooden spoon', description: 'A plain spoon.' },
    ],
  });
  db().prepare(`UPDATE events SET category = ?, city = ? WHERE id = ?`).run('groceries-spices', 'Berlin', shop.id);

  const all = listShopItems();
  const find = (q: string) => searchShopItems(all, queryTerms(q)).map((i) => i.tier.tierKey).sort();

  assert.deepEqual(find('cardamom'), ['pods'], 'the English name finds the Nepali label');
  assert.deepEqual(find('alaichi'), ['pods'], 'and the Nepali name still works');
  assert.deepEqual(find('अलैंची'), ['pods'], 'and so does the Devanagari');
  assert.deepEqual(find('dumplings'), ['momo'], 'the English name finds the Devanagari label');
  assert.deepEqual(find('मोमो'), ['momo']);
  assert.deepEqual(find('spoon'), ['spoon'], 'an ordinary word is unaffected');
  assert.deepEqual(find('bicycle'), [], 'and nothing is invented');
});
