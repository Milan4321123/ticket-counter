import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FIELDS, requestMessage, scriptedTurn } from '../src/lib/creatorChat';

const HELLO = 'Namaste 🙏 What would you like us to make?';

test('small talk gets an answer, and never becomes part of the request', () => {
  const t1 = scriptedTurn([{ from: 'bot', text: HELLO }, { from: 'me', text: 'k chha sanchia xa' }], EMPTY_FIELDS);
  assert.equal(t1.fields.summary, '');
  assert.match(t1.reply, /^Namaste 🙏 Sanchai chu/);
  const t2 = scriptedTurn(
    [
      { from: 'bot', text: t1.reply },
      { from: 'me', text: 'k cha? hamro Dashain party ko lagi website chahiyo' },
    ],
    t1.fields
  );
  assert.equal(t2.fields.summary, 'hamro Dashain party ko lagi website chahiyo');
  assert.match(t2.reply, /Kun event/);
});

test('the request sent on is the brief and the notes — not the chat', () => {
  const msg = requestMessage({ ...EMPTY_FIELDS, summary: 'A website for our Dashain festival', eventName: 'Dashain Mela', eventWhere: 'Berlin' });
  assert.match(msg, /^A website for our Dashain festival/);
  assert.match(msg, /Event \/ business: Dashain Mela/);
  assert.doesNotMatch(msg, /Namaste|›|‹/);
});
