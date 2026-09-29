// Only billed Gemini projects come with Google's data processing terms, so
// content that can hold personal data goes there only with a billed key
// (GEMINI_PAID_API_KEY or GEMINI_PAID_TIER — lib/gemini, lib/legal). These tests stand in for Google with a fake fetch and check what
// would have LEFT the server — not just what a function returned.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { PAID_BUCKET, PAID_TRANSLATE_BUCKET, geminiEnabled, geminiJson } from '../src/lib/gemini.ts';
import { answerWithBestModel } from '../src/lib/assistant.ts';
import { aiAssistantEnabled, answerVisitorQuestion, type AssistantContext } from '../src/lib/ai.ts';
import { transcribeAudio, transcriptionAvailable } from '../src/lib/transcribe.ts';
import { proposeSetup } from '../src/lib/setupAssistant.ts';
import { db } from './helpers.ts';

const sent: string[] = [];
/** Which key and which model each request went to. */
const hits: { key: string; model: string }[] = [];
const realFetch = globalThis.fetch;

function fakeGoogle(reply: unknown, status = 200) {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url));
    hits.push({ key: u.searchParams.get('key') ?? '', model: u.pathname.split('/models/')[1]?.split(':')[0] ?? '' });
    sent.push(String(init?.body ?? ''));
    const body = status === 200 ? { candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] } : { error: { code: status } };
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

const bucketUsed = (bucket: string) =>
  Number(
    (db().prepare(`SELECT value FROM kv WHERE key = ?`).get(`aiq:${new Date().toISOString().slice(0, 10)}:${bucket}`) as
      | { value: string }
      | undefined)?.value ?? 0
  );
const paidUsed = () => bucketUsed(PAID_BUCKET);
const translateUsed = () => bucketUsed(PAID_TRANSLATE_BUCKET);

beforeEach(() => {
  sent.length = 0;
  hits.length = 0;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_PAID_API_KEY;
  delete process.env.GEMINI_PAID_TIER;
  delete process.env.GEMINI_PAID_DAILY_CAP;
  delete process.env.GEMINI_PAID_TRANSLATE_DAILY_CAP;
  delete process.env.ANTHROPIC_API_KEY;
  db().prepare(`DELETE FROM kv WHERE key LIKE 'aiq:%'`).run();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const CTX: AssistantContext = {
  eventName: 'Dashain Night',
  artist: '',
  description: 'A night of Nepali music.',
  dateDisplay: 'Sat 10 Oct',
  venueName: 'Kulturhaus',
  address: 'Hauptstr. 1',
  city: 'Darmstadt',
  payWithinDays: 3,
  tiers: [],
  faqs: [],
  posts: [],
  answeredQuestions: [],
  organizerNotes: '',
};

describe('the personal switch', () => {
  it('no key: nothing is enabled', () => {
    assert.equal(geminiEnabled({ personal: false }), false);
    assert.equal(geminiEnabled({ personal: true }), false);
  });

  it('unpaid tier: published text may go, personal text may not — and is never sent', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    fakeGoogle({ ok: true });
    assert.equal(geminiEnabled({ personal: false }), true);
    assert.equal(geminiEnabled({ personal: true }), false);

    assert.equal(await geminiJson('Hi, I am Ram, call me on 0176 1234567', { personal: true }), null);
    assert.equal(sent.length, 0, 'a personal prompt never reaches Google');

    assert.deepEqual(await geminiJson('Translate: Collect on Saturdays', { personal: false }), { ok: true });
    assert.equal(sent.length, 1);
  });

  it('paid tier: personal text may go', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_PAID_TIER = '1';
    fakeGoogle({ ok: true });
    assert.equal(geminiEnabled({ personal: true }), true);
    assert.deepEqual(await geminiJson('a visitor question', { personal: true }), { ok: true });
    assert.equal(sent.length, 1);
  });
});

describe('features that carry personal data, on the unpaid tier', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    fakeGoogle({ confident: true, answer: 'Doors open at 7.' });
  });

  it('visitor Q&A behaves as with no key: unavailable, nothing sent', async () => {
    assert.equal(aiAssistantEnabled(), false);
    assert.deepEqual(await answerVisitorQuestion(CTX, 'When do doors open? I am Ram, 0176 1234567'), { kind: 'unavailable' });
    assert.equal(await answerWithBestModel('rules', 'VISITOR: is it free?', 'json'), null);
    assert.equal(sent.length, 0);
  });

  it('with the paid tier the same question is answered', async () => {
    process.env.GEMINI_PAID_TIER = 'true';
    assert.equal(aiAssistantEnabled(), true);
    assert.deepEqual(await answerVisitorQuestion(CTX, 'When do doors open?'), { kind: 'answered', answer: 'Doors open at 7.' });
    assert.equal(sent.length, 1);
  });

  it('the setup assistant falls back to its plain rules', async () => {
    const r = await proposeSetup('Dashain party in Berlin, standard 25€, VIP 45€, call Ram 0176 1234567', 'event');
    assert.equal(r.source, 'rules');
    assert.equal(sent.length, 0);
  });

  it('voice typing is off and says so, without sending the recording', async () => {
    assert.equal(transcriptionAvailable(), false);
    const r = await transcribeAudio('UklGRg==', 'audio/wav');
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.reason, 'disabled');
    assert.equal(sent.length, 0);
  });

  it('voice typing works again with the paid tier', async () => {
    process.env.GEMINI_PAID_TIER = '1';
    assert.equal(transcriptionAvailable(), true);
  });
});

describe('which key a call uses, and the paid cap', () => {
  it('a billed key, once configured, carries page text too (Google: EEA users need paid services) — each on its own bucket', async () => {
    process.env.GEMINI_API_KEY = 'free-key';
    process.env.GEMINI_PAID_API_KEY = 'paid-key';
    fakeGoogle({ ok: true });
    assert.equal(geminiEnabled({ personal: true }), true);

    await geminiJson('a visitor question', { personal: true });
    await geminiJson('Translate: Collect on Saturdays', { personal: false });
    assert.deepEqual(hits.map((h) => h.key), ['paid-key', 'paid-key']);
    assert.equal(paidUsed(), 1, 'the question counts against the question bucket');
    assert.equal(translateUsed(), 1, 'the translation against its own');
  });

  it('GEMINI_PAID_TIER: the one key carries everything, and every call counts', async () => {
    process.env.GEMINI_API_KEY = 'billed-key';
    process.env.GEMINI_PAID_TIER = '1';
    fakeGoogle({ ok: true });
    await geminiJson('a visitor question', { personal: true });
    await geminiJson('Translate: Doors open', { personal: false });
    assert.deepEqual(hits.map((h) => h.key), ['billed-key', 'billed-key']);
    assert.equal(paidUsed(), 1);
    assert.equal(translateUsed(), 1);
  });

  it('only a paid key: page text uses it too, and is counted as translation', async () => {
    process.env.GEMINI_PAID_API_KEY = 'paid-key';
    fakeGoogle({ ok: true });
    assert.equal(geminiEnabled({ personal: false }), true);
    await geminiJson('Translate: Doors open', { personal: false });
    assert.deepEqual(hits.map((h) => h.key), ['paid-key']);
    assert.equal(paidUsed(), 0);
    assert.equal(translateUsed(), 1);
  });

  it('a translation burst cannot use up the day\'s visitor questions, and has a ceiling of its own', async () => {
    process.env.GEMINI_PAID_API_KEY = 'paid-key';
    process.env.GEMINI_PAID_DAILY_CAP = '1';
    process.env.GEMINI_PAID_TRANSLATE_DAILY_CAP = '2';
    fakeGoogle({ ok: true });

    assert.deepEqual(await geminiJson('Translate: a', { personal: false }), { ok: true });
    assert.deepEqual(await geminiJson('Translate: b', { personal: false }), { ok: true });
    assert.equal(await geminiJson('Translate: c', { personal: false }), null, 'translation stops at its own cap');
    assert.equal(geminiEnabled({ personal: false }), false);

    assert.equal(geminiEnabled({ personal: true }), true, 'questions are untouched by it');
    assert.deepEqual(await geminiJson('a visitor question', { personal: true }), { ok: true });
    assert.equal(hits.length, 3, 'the refused translation never reached Google');
  });

  it('past the daily cap a paid call falls back like "not allowed" — page text carries on', async () => {
    process.env.GEMINI_API_KEY = 'free-key';
    process.env.GEMINI_PAID_API_KEY = 'paid-key';
    process.env.GEMINI_PAID_DAILY_CAP = '2';
    fakeGoogle({ confident: true, answer: 'Yes.' });

    assert.deepEqual(await geminiJson('q1', { personal: true }), { confident: true, answer: 'Yes.' });
    assert.deepEqual(await geminiJson('q2', { personal: true }), { confident: true, answer: 'Yes.' });
    assert.equal(geminiEnabled({ personal: true }), false, 'the cap is spent: the feature reads as off');
    assert.equal(aiAssistantEnabled(), false, 'visitor Q&A goes to the organizer, as with no key');
    assert.equal(transcriptionAvailable(), false, 'and the mic disappears');
    assert.equal(await geminiJson('q3', { personal: true }), null);
    assert.equal(hits.filter((h) => h.key === 'paid-key').length, 2, 'the third question never reached Google');

    assert.deepEqual(await geminiJson('Translate: Doors open', { personal: false }), { confident: true, answer: 'Yes.' });
    assert.equal(hits.at(-1)?.key, 'paid-key');
    assert.equal(translateUsed(), 1, 'on its own bucket');
  });
});

// Last in this file: busy models are benched for a minute, per process.
describe('paid calls climb only the lite rungs', () => {
  it('a paid call tries lite models only; a free one goes on to full flash', async () => {
    process.env.GEMINI_API_KEY = 'free-key';
    process.env.GEMINI_PAID_API_KEY = 'paid-key';
    fakeGoogle(null, 503); // every model busy

    assert.equal(await geminiJson('a visitor question', { personal: true }), null);
    const paidModels = hits.map((h) => h.model);
    assert.ok(paidModels.length >= 1);
    assert.ok(paidModels.every((m) => /lite/.test(m)), `paid call tried: ${paidModels.join(', ')}`);

    // Without a billed key, page text runs on the plain key and its full ladder.
    delete process.env.GEMINI_PAID_API_KEY;
    hits.length = 0;
    assert.equal(await geminiJson('Translate: Doors open', { personal: false }), null);
    assert.ok(hits.some((h) => !/lite/.test(h.model)), 'the free ladder still reaches full flash');
    assert.ok(hits.every((h) => h.key === 'free-key'));
  });
});
