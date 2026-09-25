// Server-only: daily caps on everything that costs an AI call.
//
// The per-minute limits in lib/ratelimit stop a burst, but they live in memory
// (a restart forgets them) and say nothing about a whole day — so one visitor
// asking a question every 13 seconds, or a script doing the same from many
// tabs, could still spend the day's AI allowance. These counters are in SQLite
// and reset at midnight UTC. Each call names several buckets (this visitor,
// this account or page, everybody); a request goes through only when every one
// of them still has room, and then counts against all of them at once.
import { getDb } from './db';

export interface QuotaBucket {
  /** e.g. `ask:ip:1.2.3.4`, `setup:org:…`, `ask:all`. */
  key: string;
  perDay: number;
}

const today = () => new Date().toISOString().slice(0, 10);
let sweptFor = '';

/** True — and counted — when every bucket still has room today. */
export function takeAiQuota(buckets: QuotaBucket[]): boolean {
  const db = getDb();
  const day = today();
  if (sweptFor !== day) {
    // Yesterday's counters are no use to anybody.
    db.prepare(`DELETE FROM kv WHERE key LIKE 'aiq:%' AND key NOT LIKE ?`).run(`aiq:${day}:%`);
    sweptFor = day;
  }
  const get = db.prepare(`SELECT value FROM kv WHERE key = ?`);
  const put = db.prepare(
    `INSERT INTO kv (key, value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`
  );
  return db.transaction(() => {
    for (const b of buckets) {
      const row = get.get(`aiq:${day}:${b.key}`) as { value: string } | undefined;
      if ((row ? Number(row.value) || 0 : 0) >= b.perDay) return false;
    }
    for (const b of buckets) put.run(`aiq:${day}:${b.key}`);
    return true;
  })();
}

/** Said to a person who has used up their share for today. */
export const QUOTA_MESSAGE =
  'That is the limit of questions for today — thank you for your interest! Please try again tomorrow.';
