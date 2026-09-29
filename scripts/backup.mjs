#!/usr/bin/env node
// Take a consistent backup of the database and (optionally) the uploads.
//
// Why this exists: the whole platform's records — every organizer, order, and
// issued ticket — live in one SQLite file on the server's disk. That file is
// fine for the load this app sees, but a disk that dies or an instance that is
// recreated without its volume takes the business with it. This is the safety
// net.
//
// Uses SQLite's own `VACUUM INTO`, which produces a fully consistent copy of a
// live database WITHOUT stopping the server. Copying the .db file with `cp`
// while the app is running does NOT give you that: you can capture a torn page
// mid-write, plus the -wal file holds committed data the .db does not yet have.
//
//   node scripts/backup.mjs                  -> data/backups/tickets-<stamp>.db
//   node scripts/backup.mjs --out /mnt/x     -> writes there instead
//   node scripts/backup.mjs --with-uploads   -> also tars the uploaded media
//   node scripts/backup.mjs --keep 14        -> prune backups older than N days
//   node scripts/backup.mjs --prune-only --dry-run -> list what the age limit would delete
//
// AGE LIMIT, ALWAYS ON: backups older than MAX_BACKUP_AGE_DAYS (30) are deleted
// on every run, whether or not --keep is given — a backup is a copy of every
// buyer's details, and the retention sweep erasing them in the live database
// means little if a months-old copy still holds them. --keep can only make the
// window SHORTER. The number mirrors BACKUP_RETENTION_DAYS in
// src/lib/retention.ts, which /privacy quotes: change one, change both. (This
// is a plain .mjs script run outside Next, so it cannot import that file.)
//
// Restore: stop the app, put the backup file at data/tickets.db (delete any
// leftover tickets.db-wal / tickets.db-shm beside it), start the app.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

/** Mirrors BACKUP_RETENTION_DAYS in src/lib/retention.ts — see the note above. */
const MAX_BACKUP_AGE_DAYS = 30;

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'tickets.db');
const outDir = typeof arg('out') === 'string' ? arg('out') : path.join(dataDir, 'backups');

/**
 * When a backup was taken: the stamp in its own name (tickets-2026-08-16T21-42-12.db),
 * which survives a copy or a restore from elsewhere; the file's mtime only when
 * the name carries no readable stamp.
 */
function takenAtMs(file, full) {
  const m = /^(?:tickets|uploads)-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/.exec(file);
  if (m) {
    const t = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
    if (Number.isFinite(t)) return t;
  }
  return fs.statSync(full).mtimeMs;
}

/**
 * Delete every backup older than `days` in outDir (only files this script
 * names: tickets-* and uploads-*). With dryRun, only lists them.
 */
function pruneOlderThan(days, dryRun) {
  if (!fs.existsSync(outDir)) return [];
  const cutoff = Date.now() - days * 86_400_000;
  const pruned = [];
  for (const entry of fs.readdirSync(outDir)) {
    if (!/^(tickets|uploads)-/.test(entry)) continue;
    const full = path.join(outDir, entry);
    if (takenAtMs(entry, full) < cutoff) {
      if (!dryRun) fs.unlinkSync(full);
      pruned.push(entry);
    }
  }
  return pruned;
}

function runPrune(dryRun) {
  const keep = Number(arg('keep'));
  const days = Number.isFinite(keep) && keep > 0 ? Math.min(keep, MAX_BACKUP_AGE_DAYS) : MAX_BACKUP_AGE_DAYS;
  const pruned = pruneOlderThan(days, dryRun);
  if (pruned.length) {
    console.log(
      `${dryRun ? 'Would prune' : 'Pruned'} ${pruned.length} backup file(s) older than ${days} days:\n  ` + pruned.join('\n  ')
    );
  } else {
    console.log(`No backups older than ${days} days.`);
  }
}

if (arg('prune-only')) {
  runPrune(Boolean(arg('dry-run')));
  process.exit(0);
}

if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${dbPath} — nothing to back up.`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

// Colons are illegal in filenames on Windows and awkward everywhere else.
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const target = path.join(outDir, `tickets-${stamp}.db`);

const db = new Database(dbPath, { readonly: true });
try {
  // Consistent, online, and it compacts as it copies.
  db.prepare('VACUUM INTO ?').run(target);
} finally {
  db.close();
}

// Prove the copy is readable and not truncated before claiming success.
const check = new Database(target, { readonly: true });
const integrity = check.pragma('integrity_check', { simple: true });
const counts = {};
for (const { name } of check
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
  .all()) {
  counts[name] = check.prepare(`SELECT count(*) AS c FROM "${name}"`).get().c;
}
check.close();

if (integrity !== 'ok') {
  console.error(`Backup failed its integrity check (${integrity}) — removing it.`);
  fs.unlinkSync(target);
  process.exit(1);
}

const mb = (fs.statSync(target).size / 1048576).toFixed(2);
console.log(`Database backed up -> ${target} (${mb} MB, integrity ok)`);
console.log(
  `  ${counts.orders ?? 0} orders · ${counts.tickets ?? 0} tickets · ` +
    `${counts.events ?? 0} events · ${counts.organizers ?? 0} organizers`
);

if (arg('with-uploads')) {
  const uploads = path.join(dataDir, 'uploads');
  if (fs.existsSync(uploads)) {
    const tar = path.join(outDir, `uploads-${stamp}.tar.gz`);
    // Photos and videos are NOT in the database — a database-only backup would
    // restore events whose images are all missing.
    execFileSync('tar', ['-czf', tar, '-C', dataDir, 'uploads'], { stdio: 'inherit' });
    console.log(`Uploads backed up -> ${tar} (${(fs.statSync(tar).size / 1048576).toFixed(2)} MB)`);
  } else {
    console.log('No uploads directory yet — skipping media backup.');
  }
}

// Always, after a successful backup: the age limit (and --keep, if shorter).
// The backup just taken is seconds old, so it can never be the one pruned.
runPrune(Boolean(arg('dry-run')));
