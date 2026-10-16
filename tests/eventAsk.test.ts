// Instant answers on a listing's page (lib/eventAsk): the basics never end in
// "I could not find that", and they only ever state the listing's own facts.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { quickAnswer } from '../src/lib/askFaq.ts';
import { eventIntent, fallbackEventAnswer, instantEventAnswer, type EventAskInput } from '../src/lib/eventAsk.ts';

const event: EventAskInput = {
  kind: 'event',
  name: 'Dashain Night 2026',
  artist: 'Sugam Pokhrel',
  description: 'A night of Nepali music and dance to celebrate Dashain together. Dinner included.',
  dateDisplay: 'Saturday, 24 October 2026',
  showTime: '18:00',
  venueName: 'Bürgerhaus',
  address: 'Hauptstraße 1',
  city: 'Heidelberg',
  payWithinDays: 5,
  organizerName: 'NPJOE',
  sellerLegalName: 'Nepali Progressive Youth e.V.',
  tiers: [
    { name: 'Standard', priceDisplay: '€25.00', studentOnly: false, soldOut: false, free: false },
    { name: 'Student', priceDisplay: '€18.00', studentOnly: true, soldOut: false, free: false },
  ],
  faqs: [{ question: 'Is there parking at the venue?', answer: 'Yes, free parking behind the hall.' }],
};

describe('event instant answers', () => {
  it('answers "what is this about" from the listing, with the tickets', () => {
    const a = instantEventAnswer(event, 'what is this all about?')!;
    assert.match(a.answer, /Dashain Night 2026/);
    assert.match(a.answer, /Sugam Pokhrel/);
    assert.match(a.answer, /Tickets from €25\.00/);
    assert.deepEqual(a.links, [{ label: 'Get tickets', href: '#tickets' }]);
  });

  it('names who is responsible, legal name included', () => {
    const a = instantEventAnswer(event, 'who is responsible for the event')!;
    assert.match(a.answer, /NPJOE \(Nepali Progressive Youth e\.V\.\)/);
    assert.equal(eventIntent('wer veranstaltet das?'), 'organizer');
    assert.equal(eventIntent('yo event ko aayojak ko ho?'), 'organizer');
  });

  it('sends "I want my own page or video" to the team', () => {
    const a = instantEventAnswer(event, 'can you make a promo video for my event?')!;
    assert.deepEqual(a.links.map((l) => l.href), ['/contact', '/studio']);
    assert.equal(eventIntent('how do I start selling here'), 'custom');
  });

  it('uses the organizer FAQ when it clearly matches', () => {
    assert.equal(instantEventAnswer(event, 'Is there parking near the venue?')!.answer, 'Yes, free parking behind the hall.');
  });

  it('prices, sold out, and the language of the question', () => {
    assert.match(instantEventAnswer(event, 'how much are tickets')!.answer, /Student: €18\.00 \(students, ID at the door\)/);
    const sold = { ...event, tiers: event.tiers.map((t) => ({ ...t, soldOut: true })) };
    const a = instantEventAnswer(sold, 'when is it')!;
    assert.match(a.answer, /waitlist/);
    assert.deepEqual(a.links, []);
    assert.match(instantEventAnswer(event, 'kahile ho?')!.answer, / ma cha\./);
  });

  it('leaves anything else to the AI, and the fallback still helps', () => {
    assert.equal(instantEventAnswer(event, 'is the hall heated?'), null);
    const f = fallbackEventAnswer(event, 'is the hall heated?');
    assert.match(f, /not have that detail/);
    assert.match(f, /Organized by NPJOE/);
  });
});

describe('placeholder names', () => {
  it('never says "organized by Unknown"', () => {
    const a = instantEventAnswer({ ...event, organizerName: 'Unknown', sellerLegalName: '' }, 'who organizes this?')!;
    assert.match(a.answer, /organized by the organizer/);
  });
});

describe('homepage Ask', () => {
  it('points custom work to the team', () => {
    assert.match(quickAnswer('can you make a website for my restaurant?')!, /\(\/contact\)/);
  });
});
