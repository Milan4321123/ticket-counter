import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiTurn, EMPTY_FIELDS, modelRequestState, modelTranscript, requestMessage, scriptedTurn } from '../src/lib/creatorChat';

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

// ---- What the model may see (lib/creatorChat + lib/personalText) ----

test('the model reads the conversation with addresses and numbers taken out', () => {
  const t = modelTranscript([
    { from: 'bot', text: HELLO },
    { from: 'me', text: 'Reach me at ram.sharma@example.de or +49 176 1234567, thanks' },
  ]);
  assert.match(t, /Reach me at \[email\] or \[phone\], thanks/);
  assert.doesNotMatch(t, /ram\.sharma|1234567/);
});

test('the model is told which fields are filled — never what is in them', () => {
  const state = modelRequestState({
    ...EMPTY_FIELDS,
    summary: 'A festival website',
    name: 'Ram Sharma',
    email: 'ram@example.de',
    phone: '0176 1234567',
    organization: 'Samaj Darmstadt',
    budget: 'about 800 euro',
  });
  assert.match(state, /already filled: summary, budget, name, organization, email, phone/);
  assert.match(state, /still missing: eventName/);
  for (const value of ['A festival', 'Ram', 'ram@', '1234567', 'Samaj', '800']) assert.ok(!state.includes(value), value);
});

test('the scripted chat files a phone number as the phone, not as the answer', () => {
  const t = scriptedTurn(
    [
      { from: 'bot', text: 'Great — who should Milan reply to? Your name, please.' },
      { from: 'me', text: 'Ram Sharma 0176 1234567' },
    ],
    { ...EMPTY_FIELDS, summary: 'A website for our Dashain festival', eventName: 'Dashain Mela', eventWhen: 'October' }
  );
  assert.equal(t.fields.name, 'Ram Sharma');
  assert.equal(t.fields.phone, '0176 1234567');
});

test('on the paid tier the AI turn never sends the collected values, and contact details are read locally', async () => {
  const sent: string[] = [];
  const realFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_PAID_TIER = '1';
  globalThis.fetch = (async (_u: string | URL | Request, init?: RequestInit) => {
    sent.push(String(init?.body ?? ''));
    const reply = {
      reply: 'Thanks! I noted [email]. It is ready to send.',
      // The model only ever saw placeholders — and must not be able to write them into the request.
      fields: { kind: 'custom-design', summary: '', name: '', email: '[email]', phone: '[phone]', budget: 'filled' },
    };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const fields = { ...EMPTY_FIELDS, summary: 'A website for our Dashain festival', name: 'Sita Gurung', budget: '900 euro' };
    const turn = await aiTurn(
      [
        { from: 'bot', text: 'And your email address?' },
        { from: 'me', text: 'sita.g@example.org, or call 0151 98765432' },
      ],
      fields,
      'Milan'
    );
    assert.ok(turn);
    assert.equal(sent.length, 1);
    for (const secret of ['sita.g@example.org', '98765432', 'Sita Gurung', '900 euro', 'A website for our Dashain']) {
      assert.ok(!sent[0].includes(secret), `not sent: ${secret}`);
    }
    assert.equal(turn.fields.email, 'sita.g@example.org', 'the email was picked up locally');
    assert.equal(turn.fields.phone, '0151 98765432');
    assert.equal(turn.fields.name, 'Sita Gurung', 'kept, not blanked by the model');
    assert.equal(turn.fields.budget, '900 euro', 'a placeholder from the model does not overwrite a value');
    assert.doesNotMatch(turn.reply, /\[email\]/);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_PAID_TIER;
  }
});

test('on the unpaid tier the AI turn is not taken at all', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  process.env.GEMINI_API_KEY = 'test-key';
  globalThis.fetch = (async () => {
    calls++;
    return new Response('{}', { status: 500 });
  }) as typeof fetch;
  try {
    assert.equal(await aiTurn([{ from: 'me', text: 'hello, I am Ram' }], EMPTY_FIELDS, 'Milan'), null);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
  }
});
