// The editor's setup assistant (lib/setupAssistant): the fixed rules.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normaliseProposal, proposeSetup, rulesProposal, sampleProposal, wantsSuggestions } from '../src/lib/setupAssistant.ts';

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
    // Line by line: the name from "Name — what it is", each item from its own clause.
    const shop = rulesProposal("k cha, sanchai xa? mero momo pasal cha\nDidi's Momo — home-made momo from Kathmandu\nchicken momo 9 euro, veg momo 8 euro", 'shop');
    assert.equal(shop.name, "Didi's Momo");
    assert.deepEqual(
      shop.tiers?.map((x) => [x.name, x.priceCents]),
      [
        ['Chicken momo', 900],
        ['Veg momo', 800],
      ]
    );
    assert.equal(rulesProposal('My shop is called Himal Spices, cardamom €4', 'shop').name, 'Himal Spices');
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

describe('setup assistant — Roman Nepali', () => {
  it('knows a request to invent, typed in English letters', async () => {
    const { wantsSuggestions } = await import('../src/lib/setupAssistant.ts');
    assert.equal(wantsSuggestions('tapai aafai euta nepali mithai pasal banaidinus, 5 wota saman'), true);
    assert.equal(wantsSuggestions('afai banaidinu hai'), true);
    assert.equal(wantsSuggestions('mero momo pasal cha, chicken momo 9 euro, sanibar lina aaunus'), false);
  });
});

describe('make one up — however it is typed', () => {
  it('recognises loose and misspelled requests', () => {
    for (const said of [
      'guve me dumm set',
      'create one event for me',
      'create one even tyouself come up wiht own data',
      'make something for me',
      'erstell mir einen laden',
      'aafai banaidinus',
    ]) {
      assert.equal(wantsSuggestions(said), true, said);
    }
    assert.equal(wantsSuggestions('chicken momo 9 euro, veg momo 8 euro'), false);
  });

  it('has a complete built-in sample for when the AI cannot answer', () => {
    const shop = sampleProposal('make one up', 'shop');
    assert.ok(shop.name && shop.pickupInfo && shop.description);
    assert.ok((shop.tiers ?? []).length >= 5);
    assert.equal(shop.address, undefined, 'never an address');
    const salon = sampleProposal('make me a salon', 'shop');
    assert.match(salon.name ?? '', /Beauty/);
    const event = sampleProposal('make up an event in Berlin', 'event');
    assert.ok(event.eventDate && event.eventDate > new Date().toISOString().slice(0, 10), 'a future date');
    assert.ok((event.tiers ?? []).length >= 3);
  });
});

describe('make one up — with the AI unavailable', () => {
  it('answers with the built-in sample, and says when the page is the other kind', async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const a = await proposeSetup('create one event for me', 'shop');
      assert.equal(a.source, 'sample');
      assert.equal(a.suggested, true);
      assert.ok((a.proposal.tiers ?? []).length > 0);
      assert.match(a.reply, /This page is a shop/);
      const b = await proposeSetup('hello', 'shop');
      assert.equal(b.source, 'rules');
      assert.match(b.reply, /make one up/);
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
    }
  });
});
