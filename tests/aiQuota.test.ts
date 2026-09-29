// Daily AI caps (lib/aiQuota): every bucket must have room, and all count.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashIp, quotaKey, takeAiQuota } from '../src/lib/aiQuota.ts';
import { db } from './helpers.ts';

describe('daily AI caps', () => {
  it('stops a visitor at their cap without touching the others', () => {
    const me = { key: `t:ip:${Math.random()}`, perDay: 3 };
    const all = { key: `t:all:${Math.random()}`, perDay: 10 };
    assert.equal(takeAiQuota([me, all]), true);
    assert.equal(takeAiQuota([me, all]), true);
    assert.equal(takeAiQuota([me, all]), true);
    assert.equal(takeAiQuota([me, all]), false, 'the fourth question of the day is refused');
    const someoneElse = { key: `t:ip:${Math.random()}`, perDay: 3 };
    assert.equal(takeAiQuota([someoneElse, all]), true, 'another visitor still gets through');
  });

  it('a full shared bucket stops everybody, and a refusal counts nothing', () => {
    const all = { key: `t:all:${Math.random()}`, perDay: 1 };
    const a = { key: `t:ip:${Math.random()}`, perDay: 5 };
    const b = { key: `t:ip:${Math.random()}`, perDay: 1 };
    assert.equal(takeAiQuota([a, all]), true);
    assert.equal(takeAiQuota([b, all]), false);
    // b was not charged for the refused request.
    assert.equal(takeAiQuota([b, { key: `t:all:${Math.random()}`, perDay: 5 }]), true);
  });
});

describe('no IP address on disk', () => {
  const today = new Date().toISOString().slice(0, 10);
  const kvKeys = () => (db().prepare(`SELECT key FROM kv WHERE key LIKE 'aiq:%'`).all() as { key: string }[]).map((r) => r.key);

  it('stores a visitor bucket under a keyed hash of the address, and still counts it', () => {
    const ip = '203.0.113.77';
    const me = { key: `ask:ip:${ip}`, perDay: 2 };
    assert.equal(takeAiQuota([me]), true);
    assert.equal(takeAiQuota([me]), true);
    assert.equal(takeAiQuota([me]), false, 'the same visitor meets the same counter');
    assert.ok(!kvKeys().some((k) => k.includes(ip)), 'the raw address is nowhere in kv');
    assert.ok(kvKeys().includes(`aiq:${today}:ask:ip:${hashIp(ip)}`));
  });

  it('hashes IPv6 whole, and differently each day', () => {
    const v6 = '2001:db8::1';
    assert.equal(quotaKey(`t:ip:${v6}`, '2026-09-29'), `aiq:2026-09-29:t:ip:${hashIp(v6, '2026-09-29')}`);
    assert.notEqual(hashIp(v6, '2026-09-29'), hashIp(v6, '2026-09-30'), 'yesterday cannot be linked to today');
    assert.equal(quotaKey('ask:all', '2026-09-29'), 'aiq:2026-09-29:ask:all', 'buckets without an address are unchanged');
  });
});
