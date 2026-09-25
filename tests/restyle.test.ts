import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLookRequest, restyledDesign } from '../src/lib/restyle';

test('look requests are read, with the layout they name', () => {
  assert.deepEqual(readLookRequest('make it festival style'), { layout: 'festival' });
  assert.deepEqual(readLookRequest('Neon look'), { layout: 'neon' });
  assert.deepEqual(readLookRequest('Festival-Look'), { layout: 'festival' });
  assert.deepEqual(readLookRequest('can you give it an elegant magazine look?'), { layout: 'editorial' });
  assert.deepEqual(readLookRequest('make my page look better'), {});
  assert.deepEqual(readLookRequest('the page looks boring'), {});
  assert.deepEqual(readLookRequest('mach die Seite schöner'), {});
});

test('page content is never taken for a look request', () => {
  assert.equal(readLookRequest('Nepali style chicken momo 9€'), null);
  assert.equal(readLookRequest('Dashain festival with live music and dinner'), null);
  assert.equal(readLookRequest('cool, thanks'), null);
  assert.equal(readLookRequest('make the description longer'), null);
  assert.equal(readLookRequest('design festival on 17 October'), null);
});

test('the named layout wins; otherwise the frame always changes', () => {
  assert.equal(restyledDesign({ layout: 'neon' }, { layout: 'poster' }, { layout: 'festival', headline: 'Hi' }).layout, 'poster');
  assert.equal(restyledDesign({}, { layout: 'classic' }, null).layout, undefined);
  for (let i = 0; i < 20; i++) {
    const d = restyledDesign({ layout: 'neon', headline: 'Keep me' }, {}, null);
    assert.notEqual(d.layout, 'neon');
    assert.ok(d.layout);
    assert.equal(d.headline, 'Keep me');
  }
});
