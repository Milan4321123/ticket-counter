import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatLang, greetBack, splitGreeting } from '../src/lib/smallTalk';

test('a greeting is split from the message after it', () => {
  assert.deepEqual(splitGreeting('k cha, sanchai xa? mero momo pasal cha'), { greeting: true, askedHow: true, rest: 'mero momo pasal cha' });
  assert.deepEqual(splitGreeting('k chha sanchia xa'), { greeting: true, askedHow: true, rest: '' });
  assert.deepEqual(splitGreeting('Hello! I want a page for our Dashain party'), {
    greeting: true,
    askedHow: false,
    rest: 'I want a page for our Dashain party',
  });
  assert.equal(splitGreeting('namaste dai 🙏').rest, '');
  assert.equal(splitGreeting('Hallo, wie geht’s?').greeting, true);
  assert.equal(splitGreeting('के छ? मेरो पसल छ').rest, 'मेरो पसल छ');
  assert.equal(splitGreeting('k ramro').greeting, true);
});

test('content is never taken for a greeting', () => {
  assert.equal(splitGreeting('hiana').greeting, false);
  assert.equal(splitGreeting('Himalayan momo 9€').greeting, false);
  assert.equal(splitGreeting('Dashain Night on 17 October').greeting, false);
  assert.equal(splitGreeting('dai ko pasal').greeting, false);
  assert.equal(splitGreeting('how do I get paid?').greeting, false);
  // "thik cha" is "OK, done" in the chat — an answer, not a greeting.
  assert.equal(splitGreeting('thik cha').greeting, false);
});

test('small talk is answered in the language it came in', () => {
  assert.equal(chatLang('k cha, sanchai xa?'), 'rn');
  assert.equal(chatLang('Hallo, wie geht’s?'), 'de');
  assert.equal(chatLang('के छ?'), 'ne');
  assert.equal(chatLang('hello, how are you'), 'en');
  assert.match(greetBack('rn', true), /Sanchai chu/);
});
