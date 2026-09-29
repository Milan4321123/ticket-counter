// The page translator's server side (lib/translate): what it will send on,
// and the one-time purge of a cache that held names from before the marks.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_BATCH, MAX_TEXT_LEN, PII_PURGE_MARKER, pageTextsToTranslate, translateTexts } from '../src/lib/translate.ts';
import { db } from './helpers.ts';

delete process.env.GEMINI_API_KEY;

describe('translation cache purge', () => {
  it('empties the cache once, marks it, and never again', async () => {
    // A cache as it was before the purge existed: the table, a leaked name.
    db().exec(`
      CREATE TABLE IF NOT EXISTS translations (
        lang TEXT NOT NULL, hash TEXT NOT NULL, src TEXT NOT NULL, out TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (lang, hash)
      )`);
    db().prepare(`INSERT INTO translations (lang, hash, src, out) VALUES ('de', 'x', 'Ram Sharma', 'Ram Sharma')`).run();

    assert.deepEqual(await translateTexts('de', ['Ram Sharma']), {}, 'the leaked row is gone before anything is read');
    assert.equal((db().prepare(`SELECT COUNT(*) AS n FROM translations`).get() as { n: number }).n, 0);
    assert.ok(db().prepare(`SELECT 1 FROM kv WHERE key = ?`).get(PII_PURGE_MARKER), 'the purge is recorded');

    // Anything cached after the purge stays.
    const hash = (await import('node:crypto')).createHash('sha1').update('Collect on Saturdays').digest('hex');
    db().prepare(`INSERT INTO translations (lang, hash, src, out) VALUES ('de', ?, 'Collect on Saturdays', 'Abholung samstags')`).run(hash);
    assert.deepEqual(await translateTexts('de', ['Collect on Saturdays']), { 'Collect on Saturdays': 'Abholung samstags' });
  });
});

describe('pageTextsToTranslate', () => {
  it('drops contact details and site codes, keeps page text', () => {
    assert.deepEqual(
      pageTextsToTranslate([
        'Collect on Saturdays',
        'ram@example.de',
        'Call 0176 12345678',
        'TICKETS-AB12CD34',
        'K7KQ-M3XP',
        'DE89 3704 0044 0532 0130 00',
        'Doors 18:00',
      ]),
      ['Collect on Saturdays', 'Doors 18:00']
    );
  });

  it('takes only strings, within the limits', () => {
    assert.deepEqual(pageTextsToTranslate('not a list'), []);
    assert.deepEqual(pageTextsToTranslate([1, null, '', '   ', 'x'.repeat(MAX_TEXT_LEN + 1), 'Hello']), ['Hello']);
    assert.equal(pageTextsToTranslate(Array.from({ length: MAX_BATCH + 20 }, (_, i) => `Line ${i}`)).length, MAX_BATCH);
  });
});
