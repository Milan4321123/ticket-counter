// The editor's setup assistant (lib/setupAssistant): the fixed rules.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normaliseProposal, rulesProposal } from '../src/lib/setupAssistant.ts';

describe('setup assistant — fixed rules', () => {
  it('keeps what is valid and drops what breaks a rule', () => {
    const p = normaliseProposal(
      {
        name: '  Dashain Night  ',
        eventDate: '2020-01-01', // in the past
        venueName: 'Kulturhaus',
        totalCapacity: 999999999, // out of range
        category: 'sweets', // shops only
        tiers: [
          { name: 'Standard', priceCents: 2500 },
          { name: 'VIP' }, // no price said -> not proposed
          { name: 'Student', priceCents: 1500, cap: 20 },
        ],
        invented: 'nope',
      },
      'event'
    );
    assert.equal(p.name, 'Dashain Night');
    assert.equal(p.eventDate, undefined, 'a past date is not proposed');
    assert.equal(p.venueName, 'Kulturhaus');
    assert.equal(p.totalCapacity, undefined);
    assert.equal(p.category, undefined);
    assert.deepEqual(p.tiers?.map((t) => [t.name, t.priceCents, t.cap, t.studentOnly]), [
      ['Standard', 2500, 0, false],
      ['Student', 1500, 20, true],
    ]);
    assert.equal((p as Record<string, unknown>).invented, undefined);
  });

  it('a shop gets a shelf only from the fixed list, and no event date', () => {
    const shop = normaliseProposal({ category: 'not-a-shelf', eventDate: '2099-01-01', pickupInfo: 'Saturdays 4–7pm' }, 'shop');
    assert.equal(shop.category, undefined);
    assert.equal(shop.eventDate, undefined);
    assert.equal(shop.pickupInfo, 'Saturdays 4–7pm');
  });

  it('the plain-rules reader picks out prices, a date, capacity and a city', () => {
    const p = rulesProposal('Dashain party on 10 October 2099 in Berlin, 200 people, Standard 25€ and VIP 45 euro', 'event');
    assert.equal(p.eventDate, '2099-10-10');
    assert.equal(p.totalCapacity, 200);
    assert.equal(p.city, 'Berlin');
    assert.deepEqual(p.tiers?.map((t) => [t.name, t.priceCents]), [
      ['Standard', 2500],
      ['VIP', 4500],
    ]);
  });

  it('says nothing rather than guessing', () => {
    assert.deepEqual(rulesProposal('hello, I want to sell stuff', 'shop'), {});
  });
});

describe('setup assistant — when it may invent', () => {
  it('only when the seller asks it to', async () => {
    const { wantsSuggestions } = await import('../src/lib/setupAssistant.ts');
    assert.equal(wantsSuggestions('You can come up with your own idea, just give me final'), true);
    assert.equal(wantsSuggestions('create me a demo shop with 10 items'), true);
    assert.equal(wantsSuggestions('you decide the prices'), true);
    assert.equal(wantsSuggestions('Momo 9€ and sel roti 6€, collect in Berlin on Saturdays'), false);
    assert.equal(wantsSuggestions('Dashain Night on 10 October at Kulturhaus, standard 25€'), false);
  });
});
