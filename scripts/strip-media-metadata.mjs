#!/usr/bin/env node
// Report on camera metadata (GPS, device, owner) left in stored uploads.
//
// The app cleans every upload on arrival and, once, sweeps the files stored
// before that (armMediaMetadataBackfill in src/lib/media.ts, armed from
// /api/media, progress in kv 'migration:media_metadata_strip_v1'). This script
// is the way to SEE that it worked — on a laptop or in the server's shell:
//
//   node scripts/strip-media-metadata.mjs            -> sweep progress + every stored
//                                                       original still carrying metadata
//
// READ-ONLY, on purpose. Cleaning belongs to the app's sweep, which also moves
// each photo's already-rendered variants to the new cache key; a bulk rewrite
// from outside would skip that and make the next page loads re-render the whole
// catalogue in sharp — the burst that once OOM-killed the 512 MB instance.
// To clean what this finds, just let the app run: any /api/media request arms
// the sweep. To force a second pass, delete the kv row and restart.
//
// It uses the app's own parser (src/lib/stripMetadata.ts, which imports only
// Node built-ins), so it needs a Node that runs TypeScript directly: 22.18+ /
// 23.6+, or older 22.x with --experimental-strip-types.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

let lib;
try {
  lib = await import('../src/lib/stripMetadata.ts');
} catch (e) {
  console.error(
    `Could not load src/lib/stripMetadata.ts (${e?.message ?? e}).\n` +
      'Run with a Node that strips TypeScript types: node --experimental-strip-types scripts/strip-media-metadata.mjs'
  );
  process.exit(2);
}
const { stripMetadata, sniffFormat, planIsoBmff, fdSource } = lib;

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'tickets.db');
if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${dbPath} (set DATA_DIR).`);
  process.exit(1);
}
const db = new Database(dbPath, { readonly: true, fileMustExist: true });

const marker = db.prepare(`SELECT value FROM kv WHERE key = 'migration:media_metadata_strip_v1'`).get();
console.log(`Sweep: ${marker ? marker.value : 'not started yet (arms on the first /api/media request)'}`);

/** Does the file still carry metadata? Photos read whole (capped at upload); videos header-walked. */
function dirty(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const src = fdSource(fd, size);
    const format = sniffFormat(src.read(0, 16));
    if (format === 'isobmff') {
      const patches = planIsoBmff(src);
      return patches === null ? 'unparseable' : patches.length > 0 ? format : null;
    }
    if (format === 'jpeg' || format === 'png' || format === 'webp') {
      const bytes = fs.readFileSync(file);
      return stripMetadata(bytes) === bytes ? null : format;
    }
    return null; // WebM and anything else are left alone by design
  } finally {
    fs.closeSync(fd);
  }
}

const rows = db.prepare(`SELECT id, event_id AS eventId, file_name AS fileName, mime FROM event_media ORDER BY id`).all();
let checked = 0;
let missing = 0;
const found = [];
for (const row of rows) {
  const file = path.join(dataDir, 'uploads', row.eventId, row.fileName);
  if (!fs.existsSync(file)) {
    missing++;
    continue;
  }
  checked++;
  const what = dirty(file);
  if (what) found.push(`${row.id}  ${row.mime}  ${what}  ${file}`);
}
db.close();

console.log(`Checked ${checked} stored originals (${missing} rows without a file).`);
if (found.length === 0) {
  console.log('None carries camera metadata.');
} else {
  console.log(`${found.length} still carry metadata:`);
  for (const line of found) console.log(`  ${line}`);
  process.exitCode = 1;
}
