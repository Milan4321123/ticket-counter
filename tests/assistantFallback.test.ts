// The chatbot's built-in answers, used only when no AI model responds.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fallbackAnswer } from '../src/lib/assistantFallback.ts';

describe('fallbackAnswer', () => {
  it('answers the common questions', () => {
    assert.match(fallbackAnswer('How much does it cost to sell tickets?')!, /free/i);
    assert.match(fallbackAnswer('How do I pay for a ticket?')!, /directly/i);
    assert.match(fallbackAnswer('Can I get a refund?')!, /organizer or seller/i);
    assert.match(fallbackAnswer('How do I open a shop?')!, /\/contact\?intent=account/);
    assert.match(fallbackAnswer('What is this website?')!, /Nepali events/);
    assert.match(fallbackAnswer('Wie kann ich bezahlen?')!, /directly/i);
  });

  it('answers two topics when a question asks two things', () => {
    const a = fallbackAnswer('how do I pay and can I get a refund?')!;
    assert.match(a, /directly/i);
    assert.match(a, /Refunds/);
  });

  it('does not guess at questions it has no topic for', () => {
    assert.equal(fallbackAnswer('Is parking available at the Berlin concert?'), null);
    assert.equal(fallbackAnswer('hello'), null);
  });
});
