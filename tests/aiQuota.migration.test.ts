// The one-time rewrite of AI-cap counters written before addresses were
// hashed (lib/aiQuota). Its own file — and so its own fresh database — because
// the rewrite runs at the first takeAiQuota() of a process.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RAW_IP_MIGRATION, hashIp, takeAiQuota } from '../src/lib/aiQuota.ts';
import { db } from './helpers.ts';

describe('counters stored under raw IP addresses', () => {
  it('are rewritten under the hash (today) or deleted (older), once', () => {
    const today = new Date().toISOString().slice(0, 10);
    const old = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    const put = db().prepare(`INSERT INTO kv (key, value) VALUES (?, ?)`);
    put.run(`aiq:${today}:translate:ip:198.51.100.7`, '1499');
    put.run(`aiq:${old}:translate:ip:198.51.100.7`, '12');
    put.run(`aiq:${old}:ask:all`, '99');

    // The visitor already used 1499 of 1500 today: one more, then no.
    const bucket = { key: 'translate:ip:198.51.100.7', perDay: 1500 };
    assert.equal(takeAiQuota([bucket]), true);
    assert.equal(takeAiQuota([bucket]), false, "today's count survived the rewrite");

    const keys = (db().prepare(`SELECT key FROM kv WHERE key LIKE 'aiq:%'`).all() as { key: string }[]).map((r) => r.key);
    assert.deepEqual(keys, [`aiq:${today}:translate:ip:${hashIp('198.51.100.7')}`], 'no raw address, nothing from another day');
    assert.ok(db().prepare(`SELECT 1 FROM kv WHERE key = ?`).get(RAW_IP_MIGRATION));
  });
});
