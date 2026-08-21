/**
 * MARKING NEPALI AS NEPALI.
 *
 * The document is lang="en" and half the words on this site are not. A screen
 * reader meeting अलैंची inside an English sentence reads it with English
 * phonemes, so the one word written for a Nepali reader is the one they cannot
 * hear. Headings the site writes itself are marked by hand (components/Np);
 * text the SELLER typed cannot be, so it is segmented on the way out.
 *
 * What matters is where the cuts fall, so that is what is asserted — and in
 * particular that a line with no Devanagari in it comes back as one untouched
 * piece, because that is nearly every line on the site and it must cost
 * nothing and change nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { scriptRuns } from '../src/lib/nepaliText.ts';

test('an all-Latin line is left completely alone', () => {
  assert.deepEqual(scriptRuns('Whole pods · 100g'), [{ text: 'Whole pods · 100g', nepali: false }]);
  assert.deepEqual(scriptRuns(''), []);
});

test('a Devanagari run inside English is picked out', () => {
  assert.deepEqual(scriptRuns('Taplejung ko अलैंची, whole pods'), [
    { text: 'Taplejung ko ', nepali: false },
    { text: 'अलैंची', nepali: true },
    { text: ', whole pods', nepali: false },
  ]);
});

test('a phrase stays one run — punctuation between Nepali words is Nepali', () => {
  // "मोमो, टिमुर" is one phrase. Splitting it at the comma would have a screen
  // reader announce two separate labels with a language switch between them.
  assert.deepEqual(scriptRuns('मोमो, टिमुर and chiya'), [
    { text: 'मोमो, टिमुर', nepali: true },
    { text: ' and chiya', nepali: false },
  ]);
});

test('an entirely Nepali line is one Nepali run, with no empty pieces round it', () => {
  assert.deepEqual(scriptRuns('नेपाली बजार'), [{ text: 'नेपाली बजार', nepali: true }]);
});

test('a single Devanagari character still counts', () => {
  assert.deepEqual(scriptRuns('a अ b'), [
    { text: 'a ', nepali: false },
    { text: 'अ', nepali: true },
    { text: ' b', nepali: false },
  ]);
});

test('romanised Nepali is left as Latin, deliberately', () => {
  // "chiya" and "momo" are Latin script. Guessing at them from spelling would
  // mean deciding that "chia seeds" is Nepali too.
  assert.deepEqual(scriptRuns('chiya, momo, sel roti'), [
    { text: 'chiya, momo, sel roti', nepali: false },
  ]);
});

test('every piece put back together is exactly the string that went in', () => {
  for (const line of [
    'Taplejung ko अलैंची, whole pods',
    'मोमो, टिमुर and chiya',
    'no devanagari at all',
    'ढाका टोपी · dhaka topi',
    '',
  ]) {
    assert.equal(scriptRuns(line).map((r) => r.text).join(''), line);
  }
});
