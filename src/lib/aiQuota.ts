// Server-only: daily caps on everything that costs an AI call.
//
// The per-minute limits in lib/ratelimit stop a burst, but they live in memory
// (a restart forgets them) and say nothing about a whole day — so one visitor
// asking a question every 13 seconds, or a script doing the same from many
// tabs, could still spend the day's AI allowance. These counters are in SQLite
// and reset at midnight UTC. Each call names several buckets (this visitor,
// this account or page, everybody); a request goes through only when every one
// of them still has room, and then counts against all of them at once.
//
// No IP address is ever written down. A bucket named `…:ip:<address>` is stored
// under a keyed hash of the address instead (hashIp): an HMAC whose key is
// derived from APP_SECRET and the day, so the same visitor still meets their
// own counter all day, a database copy cannot be turned back into addresses
// (there are only 2^32 IPv4 addresses — a plain hash would be reversed in
// minutes), and yesterday's hashes cannot be linked to today's.
import crypto from 'crypto';
import { getSigningSecret } from './auth';
import { getDb } from './db';

export interface QuotaBucket {
  /** e.g. `ask:ip:1.2.3.4`, `setup:org:…`, `ask:all`. The address after `:ip:` is hashed before storage. */
  key: string;
  perDay: number;
}

const today = () => new Date().toISOString().slice(0, 10);
let sweptFor = '';

/** Marks the one-time rewrite of counters stored under raw IP addresses. */
export const RAW_IP_MIGRATION = 'migration:aiquota_hashed_ip_v1';

/**
 * With no APP_SECRET (development without an admin password, tests) a random
 * key for this process: counters then restart with the server — harmless for
 * a daily cap, and still nothing reversible on disk.
 */
let processKey: string | null = null;
function secret(): string {
  return getSigningSecret() ?? (processKey ??= crypto.randomBytes(32).toString('hex'));
}

/** The stored stand-in for an IP address on `day`: HMAC-SHA256, key from APP_SECRET + the day, truncated. */
export function hashIp(ip: string, day: string = today()): string {
  const key = Buffer.from(crypto.hkdfSync('sha256', secret(), 'martnepali:ai-quota', `ip:${day}`, 32));
  return crypto.createHmac('sha256', key).update(ip.trim().toLowerCase()).digest('base64url').slice(0, 22);
}

/** The kv key a bucket is counted under on `day` — with the IP, if any, replaced by its hash. */
export function quotaKey(bucket: string, day: string = today()): string {
  const at = bucket.indexOf(':ip:');
  const stored = at < 0 ? bucket : `${bucket.slice(0, at + 4)}${hashIp(bucket.slice(at + 4), day)}`;
  return `aiq:${day}:${stored}`;
}

/**
 * Housekeeping, once per day per process: every counter from another day goes
 * (only today's are ever read, so nothing older than a day is kept), and —
 * once ever — counters written before addresses were hashed are rewritten.
 */
function sweep(day: string) {
  const db = getDb();
  db.transaction(() => {
    db.prepare(`DELETE FROM kv WHERE key LIKE 'aiq:%' AND key NOT LIKE ?`).run(`aiq:${day}:%`);
    if (!db.prepare(`SELECT 1 FROM kv WHERE key = ?`).get(RAW_IP_MIGRATION)) {
      // Before the marker exists every `:ip:` key holds a raw address.
      const raw = db.prepare(`SELECT key, value FROM kv WHERE key LIKE 'aiq:%:ip:%'`).all() as { key: string; value: string }[];
      const add = db.prepare(
        `INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + CAST(excluded.value AS INTEGER)`
      );
      const del = db.prepare(`DELETE FROM kv WHERE key = ?`);
      for (const r of raw) {
        del.run(r.key);
        const m = r.key.match(/^aiq:(\d{4}-\d{2}-\d{2}):(.*)$/);
        if (m && m[1] === day) add.run(quotaKey(m[2], day), String(Number(r.value) || 0));
      }
      db.prepare(`INSERT INTO kv (key, value) VALUES (?, ?)`).run(RAW_IP_MIGRATION, new Date().toISOString());
    }
  })();
}

function sweptToday(): string {
  const day = today();
  if (sweptFor !== day) {
    sweep(day);
    sweptFor = day;
  }
  return day;
}

/** Whether every bucket still has room today — counting nothing (e.g. to decide whether to show a feature). */
export function hasAiQuota(buckets: QuotaBucket[]): boolean {
  const day = sweptToday();
  const get = getDb().prepare(`SELECT value FROM kv WHERE key = ?`);
  return buckets.every((b) => {
    const row = get.get(quotaKey(b.key, day)) as { value: string } | undefined;
    return (row ? Number(row.value) || 0 : 0) < b.perDay;
  });
}

/** True — and counted — when every bucket still has room today. */
export function takeAiQuota(buckets: QuotaBucket[]): boolean {
  const db = getDb();
  const day = sweptToday();
  const keys = buckets.map((b) => quotaKey(b.key, day));
  const get = db.prepare(`SELECT value FROM kv WHERE key = ?`);
  const put = db.prepare(
    `INSERT INTO kv (key, value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`
  );
  return db.transaction(() => {
    for (let i = 0; i < buckets.length; i++) {
      const row = get.get(keys[i]) as { value: string } | undefined;
      if ((row ? Number(row.value) || 0 : 0) >= buckets[i].perDay) return false;
    }
    for (const k of keys) put.run(k);
    return true;
  })();
}

/** Said to a person who has used up their share for today. */
export const QUOTA_MESSAGE =
  'That is the limit of questions for today — thank you for your interest! Please try again tomorrow.';
