import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faqFromNotes } from '../src/lib/faqFallback';

test('notes become the questions guests ask, answered in the organizer’s words', () => {
  const faqs = faqFromNotes('Free parking behind the shop. Momo are made fresh every Saturday. We have vegan options. Pay cash or PayPal at pickup.');
  assert.deepEqual(
    faqs.map((f) => f.question),
    ['Is there parking?', 'Is everything made fresh?', 'Are there vegetarian or vegan options?', 'How can I pay?']
  );
  assert.equal(faqs[0].answer, 'Free parking behind the shop.');
});

test('German notes get German questions; nothing is invented, nothing repeated', () => {
  const faqs = faqFromNotes('Parkplätze gibt es hinter der Halle. Kinder unter 12 sind kostenlos. Wir freuen uns!', ['Gibt es Parkplätze?']);
  assert.deepEqual(faqs, [{ question: 'Können Kinder mitkommen?', answer: 'Kinder unter 12 sind kostenlos.' }]);
  assert.deepEqual(faqFromNotes('We love music and dancing.'), []);
});
