/**
 * lib/sameAct.ts — "is the same act playing somewhere else, and should this
 * page say so?"
 *
 * The module's whole value is being RIGHT about a claim it makes on a buyer's
 * behalf seconds before they pay, so the tests are weighted towards the false
 * positive: a banner that invents a second show, or that names the wrong city,
 * is worse than no banner at all. The pair driving most of these is the real
 * one from the live site — one singer booked into Heidelberg and Lisbon nine
 * days apart by two organizers who each typed the billing differently.
 *
 * Every test bills its OWN act. The whole file shares one database, and these
 * listings are all published by design, so a shared name would leave each test
 * matching the leftovers of the one before it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeEvent } from './helpers.ts';
import { getEventById } from '../src/lib/events.ts';
import {
  actTokens,
  cityLabel,
  looksLikeSameAct,
  otherShowsByAct,
  shortDateLabel,
} from '../src/lib/sameAct.ts';

test('the two live listings that started this read as the same act', () => {
  assert.equal(
    looksLikeSameAct('Sugam Pokhrel & Bajagaja', 'Sugam Pokhrel bajagaja and Binay Karki'),
    true
  );
});

test('one shared first name is NOT a match — that is the false positive to fear', () => {
  assert.equal(looksLikeSameAct('Binay Karki', 'Binay Shrestha'), false);
  assert.equal(looksLikeSameAct('Sugam Pokhrel', 'Sugam Thapa'), false);
});

test('two acts sharing only billing words are not the same act', () => {
  assert.equal(looksLikeSameAct('The Live Band', 'Live Music Group'), false);
  assert.deepEqual(actTokens('feat. DJ X & The Band'), [], 'billing, not a name');
});

test('accents and punctuation are not identity', () => {
  assert.equal(looksLikeSameAct('Anju Śrestha Pāṇḍey', 'anju shrestha pandey'), true);
});

test('an empty artist line matches nothing, in either direction', () => {
  assert.equal(looksLikeSameAct('', 'Sugam Pokhrel Bajagaja'), false);
  assert.equal(looksLikeSameAct('Sugam Pokhrel Bajagaja', '   '), false);
});

test('the other city is found across organizers, and points the right way', () => {
  const heidelberg = makeEvent({
    name: 'DashainEvent2026',
    artist: 'Sugam Pokhrel & Bajagaja',
    city: '69126 Heidelberg',
    eventDate: '2026-10-10',
  });
  // A DIFFERENT organizer, exactly as on the live site.
  const lisbon = makeEvent({
    name: 'Dasain Show Sugam pokhrel bajagaja and binay Karki Lisbon',
    artist: 'Sugam Pokhrel bajagaja and Binay Karki',
    city: 'Lisbon',
    eventDate: '2026-10-19',
  });

  assert.deepEqual(
    otherShowsByAct(getEventById(heidelberg.id)!).map((e) => e.id),
    [lisbon.id]
  );
  assert.deepEqual(
    otherShowsByAct(getEventById(lisbon.id)!).map((e) => e.id),
    [heidelberg.id],
    'both pages warn — the buyer can land on either one first'
  );
});

test('two nights in the same city are not a wrong-city risk', () => {
  const act = 'Kamana Rasaili Gurung';
  const first = makeEvent({ artist: act, city: 'Berlin', eventDate: '2026-10-10' });
  makeEvent({ artist: act, city: 'berlin', eventDate: '2026-10-11' });
  assert.deepEqual(otherShowsByAct(getEventById(first.id)!), []);
});

test('a postcode in front of the city does not make it a different city', () => {
  const act = 'Prabisha Adhikari Trio';
  const first = makeEvent({ artist: act, city: '69126 Heidelberg', eventDate: '2026-10-10' });
  makeEvent({ artist: act, city: 'Heidelberg', eventDate: '2026-10-17' });
  assert.deepEqual(otherShowsByAct(getEventById(first.id)!), [], 'same place, typed twice');
});

test('a booking a season away is not the same trip', () => {
  const act = 'Nabin Bhattarai Ensemble';
  const october = makeEvent({ artist: act, city: 'Heidelberg', eventDate: '2026-10-10' });
  makeEvent({ artist: act, city: 'Lisbon', eventDate: '2027-04-03' });
  assert.deepEqual(otherShowsByAct(getEventById(october.id)!), []);
});

test('a listing with no machine date is still warned about', () => {
  // event_date is optional on this site: plenty of listings carry only the
  // organizer's own date text. Silence there would drop exactly the sloppily
  // filled-in listing most likely to be confused for another.
  const act = 'Sabin Rai Pharaoh';
  const dated = makeEvent({ artist: act, city: 'Heidelberg', eventDate: '2026-10-10' });
  const undated = makeEvent({ artist: act, city: 'Lisbon', eventDate: null });
  assert.deepEqual(
    otherShowsByAct(getEventById(dated.id)!).map((e) => e.id),
    [undated.id]
  );
});

test('drafts, archived listings and shops never appear in a banner', () => {
  const act = 'Deepak Bajracharya Band';
  const live = makeEvent({ artist: act, city: 'Heidelberg', eventDate: '2026-10-10' });
  makeEvent({ artist: act, city: 'Lisbon', eventDate: '2026-10-19', status: 'draft' });
  makeEvent({ artist: act, city: 'Porto', eventDate: '2026-10-19', status: 'archived' });
  makeEvent({ artist: act, city: 'Braga', eventDate: '2026-10-19', kind: 'shop' });
  assert.deepEqual(otherShowsByAct(getEventById(live.id)!), []);
});

test('a listing with no city on either side says nothing', () => {
  const act = 'Anuprastha Kathmandu';
  const noCity = makeEvent({ artist: act, city: '', eventDate: '2026-10-10' });
  makeEvent({ artist: act, city: 'Lisbon', eventDate: '2026-10-19' });
  assert.deepEqual(otherShowsByAct(getEventById(noCity.id)!), [], 'nothing to name, so nothing said');
});

test('several other cities come back in date order', () => {
  const act = 'Sajjan Raj Vaidya';
  const first = makeEvent({ artist: act, city: 'Heidelberg', eventDate: '2026-10-10' });
  const later = makeEvent({ artist: act, city: 'Porto', eventDate: '2026-10-25' });
  const sooner = makeEvent({ artist: act, city: 'Lisbon', eventDate: '2026-10-19' });
  assert.deepEqual(
    otherShowsByAct(getEventById(first.id)!).map((e) => e.id),
    [sooner.id, later.id]
  );
});

test('the city label drops the postcode but never blanks the line', () => {
  assert.equal(cityLabel('69126 Heidelberg'), 'Heidelberg');
  assert.equal(cityLabel('Lisbon'), 'Lisbon');
  assert.equal(cityLabel('1100-062'), '1100-062', 'a city typed as digits is still shown');
});

test('the short date is built from the machine date, never the free text', () => {
  const event = makeEvent({ eventDate: '2026-10-19' });
  assert.equal(shortDateLabel(getEventById(event.id)!), 'Mon 19 Oct');
  const undated = makeEvent({ eventDate: null });
  assert.equal(shortDateLabel(getEventById(undated.id)!), '');
});
