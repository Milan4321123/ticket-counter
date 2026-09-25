// Server-only: machine translation of the site's visible text into German or
// Nepali, for everything the hand-written dictionary (lib/i18n) does not
// cover — long copy, and what sellers write themselves (descriptions, items).
//
// Every string is translated ONCE per language and kept in SQLite, so the
// second visitor to see "Collect on Saturdays" in German gets it from disk,
// instantly and for free. New strings are capped per day (DAILY_NEW_LIMIT) so a
// bot cannot run up the AI bill; over the cap, the English simply stays.
import crypto from 'crypto';
import { getDb } from './db';
import { geminiJson } from './gemini';
import type { Lang } from './i18n';

export const MAX_TEXT_LEN = 1200;
export const MAX_BATCH = 80;
const DAILY_NEW_LIMIT = 20_000;
// Small batches: a long JSON list is where a reply gets cut off mid-string —
// and a cut-off reply loses the WHOLE batch, not just its last line.
const MODEL_CHUNK = 15;
const PARALLEL = 3;

let ready = false;
function db() {
  const d = getDb();
  if (!ready) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS translations (
        lang TEXT NOT NULL,
        hash TEXT NOT NULL,
        src TEXT NOT NULL,
        out TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (lang, hash)
      )
    `);
    ready = true;
  }
  return d;
}

const hashOf = (s: string) => crypto.createHash('sha1').update(s).digest('hex');

const LANG_NAME: Record<Exclude<Lang, 'en'>, string> = {
  de: 'German (informal "du", as a friendly German website would write)',
  ne: 'Nepali, written in Devanagari script',
};

/** Spend from today's budget of new strings; false once it is used up. */
function takeBudget(n: number): boolean {
  const d = db();
  const key = `translate_budget:${new Date().toISOString().slice(0, 10)}`;
  const row = d.prepare(`SELECT value FROM kv WHERE key = ?`).get(key) as { value: string } | undefined;
  const used = row ? Number(row.value) || 0 : 0;
  if (used + n > DAILY_NEW_LIMIT) return false;
  d.prepare(`INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(
    key,
    String(used + n)
  );
  return true;
}

async function modelTranslate(lang: Exclude<Lang, 'en'>, texts: string[]): Promise<(string | null)[]> {
  const prompt = `Translate each string of this website (MartNepali: Nepali events, tickets and a bazaar of Nepali shops in Germany) into ${LANG_NAME[lang]}.

Rules:
- Return ONLY a JSON array of strings, the same length and order as the input.
- Keep unchanged: brand names (MartNepali), names of people, shops, venues and cities, prices, numbers, dates' digits, emojis, URLs, email addresses, and placeholders like {n}.
- Food and goods with a Nepali name (momo, sel roti, dhaka topi, timur…) keep that name${lang === 'ne' ? ' in Devanagari' : ''}.
- Keep it short and natural — these are buttons, headings and page text, not a document.
- A string that is already in the target language, or has nothing to translate, comes back unchanged.

Input:
${JSON.stringify(texts)}`;
  const out = await geminiJson(prompt, { maxOutputTokens: 8192, timeoutMs: 25_000 });
  if (!Array.isArray(out) || out.length !== texts.length) return texts.map(() => null);
  return out.map((v) => (typeof v === 'string' && v.trim() ? v : null));
}

/**
 * Translations for `texts`, as a map from each input to its translation.
 * Cached ones come from disk; the rest go to the model in chunks (when the
 * day's budget allows). A string with no translation is left out of the map —
 * the caller keeps the English.
 */
export async function translateTexts(lang: Lang, texts: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (lang === 'en') return result;
  const d = db();
  const unique = [...new Set(texts.filter((t) => t && t.length <= MAX_TEXT_LEN))];
  const get = d.prepare(`SELECT out FROM translations WHERE lang = ? AND hash = ?`);
  const missing: string[] = [];
  for (const t of unique) {
    const row = get.get(lang, hashOf(t)) as { out: string } | undefined;
    if (row) result[t] = row.out;
    else missing.push(t);
  }
  if (missing.length === 0 || !process.env.GEMINI_API_KEY || !takeBudget(missing.length)) return result;

  const put = d.prepare(
    `INSERT INTO translations (lang, hash, src, out) VALUES (?, ?, ?, ?) ON CONFLICT(lang, hash) DO NOTHING`
  );
  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += MODEL_CHUNK) chunks.push(missing.slice(i, i + MODEL_CHUNK));
  const runChunk = async (chunk: string[]) => {
    let outs = await modelTranslate(lang, chunk);
    // A failed batch is tried once more in halves before giving up on it.
    if (outs.every((o) => !o) && chunk.length > 3) {
      const half = Math.ceil(chunk.length / 2);
      outs = [...(await modelTranslate(lang, chunk.slice(0, half))), ...(await modelTranslate(lang, chunk.slice(half)))];
    }
    chunk.forEach((src, i) => {
      const out = outs[i];
      if (!out) return;
      result[src] = out;
      put.run(lang, hashOf(src), src, out);
    });
  };
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    await Promise.all(chunks.slice(i, i + PARALLEL).map(runChunk));
  }
  return result;
}
