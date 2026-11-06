// The contact chat's optional Grok / Groq service (lib/chatAi).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chatAiJson, chatAiProvider, parseJsonReply } from '../src/lib/chatAi.ts';

describe('chatAi', () => {
  it('picks the service from whichever key is set — xAI, then Groq, then OpenRouter, else none', () => {
    const saved = { x: process.env.XAI_API_KEY, g: process.env.GROQ_API_KEY, o: process.env.OPENROUTER_API_KEY };
    delete process.env.XAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    assert.equal(chatAiProvider(), null);
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    assert.equal(chatAiProvider()?.id, 'openrouter');
    assert.match(chatAiProvider()!.model, /:free$/);
    process.env.GROQ_API_KEY = 'gsk_test';
    assert.equal(chatAiProvider()?.id, 'groq');
    process.env.XAI_API_KEY = 'xai_test';
    assert.equal(chatAiProvider()?.id, 'xai');
    process.env.XAI_API_KEY = saved.x ?? '';
    process.env.GROQ_API_KEY = saved.g ?? '';
    if (!saved.x) delete process.env.XAI_API_KEY;
    if (!saved.g) delete process.env.GROQ_API_KEY;
    if (saved.o) process.env.OPENROUTER_API_KEY = saved.o;
    else delete process.env.OPENROUTER_API_KEY;
  });

  it('reads the JSON object out of a reply, fences and all', () => {
    assert.deepEqual(parseJsonReply('```json\n{"reply":"Hi","fields":{}}\n```'), { reply: 'Hi', fields: {} });
    assert.equal(parseJsonReply('no json here'), null);
    assert.equal(parseJsonReply('{broken'), null);
  });

  it('does nothing without a key', async () => {
    delete process.env.XAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    assert.equal(await chatAiJson('hello'), null);
  });
});
