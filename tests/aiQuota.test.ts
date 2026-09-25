// Daily AI caps (lib/aiQuota): every bucket must have room, and all count.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { takeAiQuota } from '../src/lib/aiQuota.ts';
import './helpers.ts';

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
