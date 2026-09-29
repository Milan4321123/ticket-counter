/**
 * THE LEGAL GATE IN FRONT OF PUBLISHING.
 *
 * Before a listing goes live, the organizer must (1) say who they legally are —
 * the seller every buyer page and email names, and the controller in the AVV —
 * and (2) accept the platform terms and conclude the Auftragsverarbeitungs-
 * vertrag (Art. 28 GDPR) in the CURRENT version. The publish route in
 * api/portal/events/[id] asks legalPublishBlocker() and refuses while it
 * returns a sentence; the checklist on the Publish tab asks legalStepsMissing().
 * Both are exercised here through the real writers (setOrganizerLegalDetails,
 * acceptLegalTerms), so a broken writer fails these tests too.
 *
 * What is deliberately NOT gated, and must stay that way: a listing that is
 * already live. Nothing in lib/organizers touches events at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { completeLegal, db, makeEvent, makeOrganizer } from './helpers.ts';
import { LEGAL_TERMS_VERSION } from '../src/lib/legal.ts';
import { getEventById } from '../src/lib/events.ts';
import {
  acceptLegalTerms,
  getOrganizer,
  legalDetailsComplete,
  legalPublishBlocker,
  legalStepsMissing,
  legalTermsCurrent,
  organizerLegalExempt,
  setOrganizerLegalDetails,
  validateLegalDetails,
} from '../src/lib/organizers.ts';
import { getSellerIdentitiesBulk, getSellerIdentity, sellerAddressOneLine } from '../src/lib/sellerIdentity.ts';

const DETAILS = {
  legalName: 'Nepali Samaj Darmstadt e.V.',
  legalAddress: 'Musterstraße 1\n64283 Darmstadt',
  legalRepresentative: 'Ram Sharma (1. Vorsitzender)',
  legalRegister: 'Amtsgericht Darmstadt, VR 1234',
  legalContactEmail: 'vorstand@example.test',
};

test('a brand-new account may not publish: both legal steps are missing', () => {
  const o = makeOrganizer();
  assert.deepEqual(legalStepsMissing(o), ['details', 'accept']);
  const blocker = legalPublishBlocker(o);
  assert.ok(blocker, 'the publish route must be handed a reason to refuse');
  assert.match(blocker, /legal name and address/);
  assert.match(blocker, /\/portal\/legal/, 'the refusal says where to fix it');
});

test('acceptance is refused until the AVV has a controller to name', () => {
  const o = makeOrganizer();
  const early = acceptLegalTerms(o.id);
  assert.equal(early.ok, false, 'no name, no address — no contract');
  assert.equal(getOrganizer(o.id)!.legalAcceptedVersion, null, 'and nothing was recorded');

  // A name alone is still not an identity a buyer can find.
  setOrganizerLegalDetails(o.id, { ...DETAILS, legalAddress: '' });
  assert.equal(acceptLegalTerms(o.id).ok, false);
  assert.deepEqual(legalStepsMissing(getOrganizer(o.id)!), ['details', 'accept']);

  setOrganizerLegalDetails(o.id, DETAILS);
  const detailsOnly = getOrganizer(o.id)!;
  assert.deepEqual(legalStepsMissing(detailsOnly), ['accept'], 'details alone do not open the gate');
  assert.match(legalPublishBlocker(detailsOnly)!, /accept the terms/);

  const accepted = acceptLegalTerms(o.id, new Date('2026-09-29T10:00:00Z'));
  assert.equal(accepted.ok, true);
  const after = getOrganizer(o.id)!;
  assert.equal(after.legalAcceptedVersion, LEGAL_TERMS_VERSION);
  assert.equal(after.legalAcceptedAt, '2026-09-29T10:00:00.000Z');
  assert.deepEqual(legalStepsMissing(after), []);
  assert.equal(legalPublishBlocker(after), null, 'the publish route lets it through');
});

test('a new terms version asks everyone again — and leaves live listings alone', () => {
  const o = completeLegal(makeOrganizer().id);
  const live = makeEvent({ organizerId: o.id, status: 'published' });
  assert.equal(legalPublishBlocker(o), null);

  // What bumping LEGAL_TERMS_VERSION does to an account that accepted before:
  // its stored version no longer matches the published one.
  db().prepare(`UPDATE organizers SET legal_accepted_version = ? WHERE id = ?`).run('2020-01-01', o.id);
  const stale = getOrganizer(o.id)!;
  assert.equal(legalTermsCurrent(stale), false);
  assert.deepEqual(legalStepsMissing(stale), ['accept'], 'details stay; only the acceptance is asked for');
  assert.match(legalPublishBlocker(stale)!, /updated terms/, 'and the organizer is told WHY again');
  assert.match(legalPublishBlocker(stale)!, new RegExp(LEGAL_TERMS_VERSION));

  assert.equal(getEventById(live.id)!.status, 'published', 'a terms update never takes a live listing down');

  assert.equal(acceptLegalTerms(o.id).ok, true);
  assert.equal(legalPublishBlocker(getOrganizer(o.id)!), null, 're-accepting reopens the gate');
});

test('clearing the legal name closes the gate again, even with a current acceptance', () => {
  const o = completeLegal(makeOrganizer().id);
  setOrganizerLegalDetails(o.id, { ...DETAILS, legalName: '' });
  const cleared = getOrganizer(o.id)!;
  assert.equal(legalTermsCurrent(cleared), true);
  assert.equal(legalDetailsComplete(cleared), false);
  assert.deepEqual(legalStepsMissing(cleared), ['details']);
});

test('demo and example-shop accounts are exempt — they never sell to real buyers', () => {
  const demo = makeOrganizer();
  db().prepare(`UPDATE organizers SET is_demo = 1 WHERE id = ?`).run(demo.id);
  const demoRow = getOrganizer(demo.id)!;
  assert.equal(organizerLegalExempt(demoRow), true);
  assert.deepEqual(legalStepsMissing(demoRow), []);

  const example = makeOrganizer({ email: `example-${process.pid}@seed.invalid` });
  assert.deepEqual(legalStepsMissing(example), []);

  const real = makeOrganizer({ email: `someone-${process.pid}@invalid.example.test` });
  assert.equal(organizerLegalExempt(real), false, 'only the seed script’s own domain is exempt');
});

test('the form is cleaned and bounded before anything is stored', () => {
  const ok = validateLegalDetails({
    legalName: '  Nepali   Samaj\nDarmstadt e.V. ',
    legalAddress: ' Musterstraße 1 \r\n\r\n 64283   Darmstadt \n',
    legalRepresentative: ' Ram Sharma ',
    legalRegister: '',
    legalContactEmail: ' Vorstand@Example.TEST ',
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.legalName, 'Nepali Samaj Darmstadt e.V.', 'one line, single spaces');
    assert.equal(ok.value.legalAddress, 'Musterstraße 1\n64283 Darmstadt', 'one entry per line, blanks dropped');
    assert.equal(ok.value.legalRepresentative, 'Ram Sharma');
    assert.equal(ok.value.legalContactEmail, 'vorstand@example.test');
  }

  // Every field may be empty: a half-filled form still saves.
  assert.equal(validateLegalDetails({}).ok, true);

  const refusals: [unknown, RegExp][] = [
    [{ legalName: 'x'.repeat(121) }, /at most 120/],
    [{ legalAddress: 'y'.repeat(301) }, /at most 300/],
    [{ legalAddress: 'a\nb\nc\nd\ne\nf\ng' }, /6 lines/],
    [{ legalRepresentative: 'z'.repeat(161) }, /at most 160/],
    [{ legalRegister: 'r'.repeat(81) }, /at most 80/],
    [{ legalContactEmail: 'not-an-email' }, /email/],
    [{ legalName: 42 }, /text/],
    [{ legalName: 'Bad\u0007Name' }, /special characters/],
    [null, /Nothing to save/],
    [['a'], /Nothing to save/],
  ];
  for (const [input, message] of refusals) {
    const r = validateLegalDetails(input);
    assert.equal(r.ok, false, `should refuse ${JSON.stringify(input)}`);
    if (!r.ok) assert.match(r.error, message);
  }
});

test('buyers see the legal name once given, the account name until then', () => {
  const o = makeOrganizer({ name: 'Ram' });
  const before = getSellerIdentity(o.id)!;
  assert.equal(before.displayName, 'Ram', 'falls back to the account name');
  assert.equal(before.hasLegalDetails, false, 'so no Veranstalter block renders yet');
  assert.deepEqual(before.addressLines, []);

  setOrganizerLegalDetails(o.id, DETAILS);
  const after = getSellerIdentity(o.id)!;
  assert.equal(after.displayName, 'Nepali Samaj Darmstadt e.V.');
  assert.equal(after.hasLegalDetails, true);
  assert.deepEqual(after.addressLines, ['Musterstraße 1', '64283 Darmstadt']);
  assert.equal(sellerAddressOneLine(after), 'Musterstraße 1, 64283 Darmstadt');
  assert.equal(after.representative, DETAILS.legalRepresentative);
  assert.equal(after.register, DETAILS.legalRegister);
  assert.equal(after.contactEmail, DETAILS.legalContactEmail);

  assert.equal(getSellerIdentity('no-such-organizer'), null);
});

test('many sellers are read in one go, and agree with the single read', () => {
  const a = completeLegal(makeOrganizer({ name: 'A' }).id, { legalName: 'Verein A e.V.' });
  const b = makeOrganizer({ name: 'B' });
  const bulk = getSellerIdentitiesBulk([a.id, b.id, a.id, 'missing']);
  assert.equal(bulk.size, 2, 'duplicates collapse, missing ids are simply absent');
  assert.deepEqual(bulk.get(a.id), getSellerIdentity(a.id));
  assert.deepEqual(bulk.get(b.id), getSellerIdentity(b.id));
  assert.equal(bulk.get(a.id)!.displayName, 'Verein A e.V.');
  assert.equal(getSellerIdentitiesBulk([]).size, 0);
});
