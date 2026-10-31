import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiTurn, detectKind, EMPTY_FIELDS, isIntentOnly, modelRequestState, modelTranscript, requestMessage, scriptedTurn, type ChatTurn, type CreatorFields } from '../src/lib/creatorChat';

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

/** Plays a whole scripted conversation; returns the fields and every reply. */
function converse(lines: string[]): { fields: CreatorFields; replies: string[] } {
  const msgs: ChatTurn[] = [{ from: 'bot', text: HELLO }];
  let fields = EMPTY_FIELDS;
  const replies: string[] = [];
  for (const line of lines) {
    msgs.push({ from: 'me', text: line });
    const t = scriptedTurn(msgs, fields);
    fields = t.fields;
    replies.push(t.reply);
    msgs.push({ from: 'bot', text: t.reply });
  }
  return { fields, replies };
}

test('a problem report is a message for the team — no event questions', () => {
  const { fields, replies } = converse(['there is a problem in your site', 'Ram', 'ram@example.de']);
  assert.equal(fields.kind, 'general');
  assert.equal(fields.summary, 'there is a problem in your site');
  assert.equal(fields.name, 'Ram');
  assert.equal(fields.eventName, '');
  assert.ok(replies.every((r) => !/Which event|When and where/.test(r)), replies.join(' | '));
  assert.match(replies[1], /so he can reply to you/);
});

test('"Something else" and "I have a question" ask for the message first, typos and all', () => {
  for (const opener of ['Something else', 'A question or a problem', 'nothing just ask general quesrions', 'Ich habe eine Frage', 'mero euta prashna cha']) {
    const { fields, replies } = converse([opener, 'Can I pay at the door?', 'Sita', 'sita@example.de']);
    assert.equal(fields.kind, 'general', opener);
    assert.equal(fields.summary, 'Can I pay at the door?', opener);
    assert.equal(fields.name, 'Sita', opener);
    assert.doesNotMatch(replies[0], /Which event|Lovely/, opener);
  }
});

test('wanting to sell asks what and under which name — not an event date', () => {
  const { fields, replies } = converse(['I want to sell here', 'Momo and sel roti from my kitchen', 'Himalaya Kitchen', 'Hari', 'hari@example.de']);
  assert.equal(fields.kind, 'organizer-account');
  assert.equal(fields.summary, 'Momo and sel roti from my kitchen');
  assert.equal(fields.eventName, 'Himalaya Kitchen');
  assert.equal(fields.name, 'Hari');
  assert.ok(replies.every((r) => !/When and where/.test(r)));
});

test('a page request still gets the event questions', () => {
  const { fields } = converse(['A custom page for my event', 'Dashain Night', '10 Oct', 'Ram', 'ram@example.de']);
  assert.equal(fields.kind, 'custom-design');
  assert.equal(fields.eventName, 'Dashain Night');
  assert.equal(fields.eventWhen, '10 Oct');
});

test('kind detection: "your site" is the platform, a website is a page request', () => {
  assert.equal(detectKind('there is a problem in your site'), 'general');
  assert.equal(detectKind('Auf eurer Seite funktioniert der Checkout nicht'), 'general');
  assert.equal(detectKind('A website for our festival'), 'custom-design');
  assert.equal(detectKind('I want to sell momo'), 'organizer-account');
  assert.equal(detectKind('My order confirmation never came'), 'general');
  // Video requests (the /contact?intent=video chips) are work to make, like a page.
  assert.equal(detectKind('A promo video for my event'), 'custom-design');
  assert.equal(detectKind('A walk-on intro for an artist'), 'custom-design');
  assert.equal(detectKind('Visuals for the stage screen'), 'custom-design');
  assert.equal(detectKind('मलाई भिडियो चाहियो'), 'custom-design');
  assert.equal(detectKind('the video on your site does not work'), 'general');
  assert.equal(isIntentOnly('Can I pay at the door?', 'general'), false);
  assert.equal(isIntentOnly('the checkout does not load', 'general'), false);
  assert.equal(isIntentOnly('Something else', 'general'), true);
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
