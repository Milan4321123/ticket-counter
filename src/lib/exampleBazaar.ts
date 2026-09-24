// Server-only: running scripts/seed-bazaar.mjs from inside the app — for the
// admin panel's "Example bazaar" button, and for the one automatic run that
// puts the example shops up on a fresh hosted site.
//
// The script keeps every one of its own safety rules (it refuses unless
// checkout provably cannot take money for an example shop; on production it
// makes DISABLED seller accounts with no known password). This module only
// starts it in the background — rendering ~80 pictures takes minutes — and
// remembers how it went.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getDb } from './db';

export interface SeedJob {
  action: 'seed' | 'clean';
  startedAt: number;
  finishedAt: number | null;
  ok: boolean | null;
  note: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __exampleBazaarJob: SeedJob | undefined;
}

/** How many example shops are up right now (the seed script's id marker). */
export function exampleShopCount(): number {
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM events WHERE id LIKE 'seed-bazaar-%'`).get() as { n: number }).n;
}

export function currentSeedJob(): SeedJob | null {
  return global.__exampleBazaarJob ?? null;
}

/** Start the script in the background. Null when a run is already going. */
export function startExampleBazaarJob(action: 'seed' | 'clean', onDone?: (ok: boolean) => void): SeedJob | null {
  const running = global.__exampleBazaarJob;
  if (running && running.finishedAt === null) return null;
  const script = path.join(process.cwd(), 'scripts', 'seed-bazaar.mjs');
  const args = action === 'clean' ? [script, '--clean'] : [script, '--all-shops', '--yes-seed-production'];
  const job: SeedJob = { action, startedAt: Date.now(), finishedAt: null, ok: null, note: '' };
  global.__exampleBazaarJob = job;
  let output = '';
  const child = spawn(process.execPath, args, { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const collect = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-20_000);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  const finish = (ok: boolean, note: string) => {
    if (job.finishedAt !== null) return;
    job.finishedAt = Date.now();
    job.ok = ok;
    job.note = note;
    console.log(`[example-bazaar] ${action} ${ok ? 'finished' : 'FAILED'}:\n${output.slice(-4000)}`);
    onDone?.(ok);
  };
  child.on('close', (code) =>
    finish(code === 0, code === 0 ? '' : /REFUSING TO SEED[^\n]*/.exec(output)?.[0] ?? output.trim().split('\n').slice(-3).join(' ').slice(0, 400))
  );
  child.on('error', (e) => finish(false, String(e)));
  return job;
}

const AUTO_KEY = 'example_bazaar_autoseed';

/**
 * Put the example bazaar up ONCE on a site that has never had it — so a fresh
 * hosted site shows a stocked /market without anyone opening a terminal.
 *
 * "Once" is recorded in the kv table before the run starts, so it never loops:
 * if the owner later takes the shops down from /admin they stay down, and a
 * failed run is not retried automatically (the admin button can). Cheap to
 * call on every bazaar request: one indexed read.
 */
export function ensureExampleBazaarOnce(): void {
  try {
    if (process.env.EXAMPLE_BAZAAR_AUTOSEED === 'off') return;
    const db = getDb();
    const row = db.prepare(`SELECT value FROM kv WHERE key = ?`).get(AUTO_KEY) as { value: string } | undefined;
    if (row) {
      // A run that started but never finished was cut off by a restart (a
      // deploy kills the child process) — after 20 minutes, try again. A run
      // that failed gets one more try after six hours. Anything else — done,
      // already present, or taken down by the owner — stays as it is.
      const [state, ts] = row.value.split(':');
      const age = Date.now() - Number(ts || 0);
      const running = global.__exampleBazaarJob && global.__exampleBazaarJob.finishedAt === null;
      const stale = (state === 'started' && age > 20 * 60_000 && !running) || (state === 'failed' && age > 6 * 3_600_000);
      if (!stale || exampleShopCount() > 0) return;
      db.prepare(`DELETE FROM kv WHERE key = ? AND value = ?`).run(AUTO_KEY, row.value);
    }
    if (exampleShopCount() > 0) {
      db.prepare(`INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)`).run(AUTO_KEY, 'already-present');
      return;
    }
    const claimed = db.prepare(`INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)`).run(AUTO_KEY, `started:${Date.now()}`).changes;
    if (claimed === 0) return; // another request got there first
    const job = startExampleBazaarJob('seed', (ok) => {
      db.prepare(`UPDATE kv SET value = ? WHERE key = ?`).run(ok ? `done:${Date.now()}` : `failed:${Date.now()}`, AUTO_KEY);
    });
    if (!job) db.prepare(`UPDATE kv SET value = ? WHERE key = ?`).run('busy', AUTO_KEY);
  } catch (e) {
    console.error('ensureExampleBazaarOnce failed:', e);
  }
}
