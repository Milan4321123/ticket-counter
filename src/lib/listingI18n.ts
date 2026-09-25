// Server-only: an event's or shop's OWN words — description, how to collect,
// the date line, every ticket/item, the FAQ, the page's headline and
// highlights — in German and Nepali, ready BEFORE anybody switches language.
//
// The site-wide translator (components/AutoTranslate) works in the browser
// after the page has loaded, which is fine for buttons and headings that are
// the same on every page, but an event's description is long, unique, and the
// first thing a visitor reads. So each listing is translated ahead of time:
// after every save (warmListingTranslations, in the background), and on the
// first view in a language if nobody has warmed it yet. The page then renders
// the translation on the server — no flash of English, no waiting.
//
// Each row remembers a hash of the English it was made from. When the
// organizer edits the English, the old translation stops being shown (never a
// translation of text that is no longer there) and is made again. An organizer
// can correct any translation by hand in the editor's Languages section
// (`manual`); a manual row is kept until the English under it changes.
import crypto from 'crypto';
import { getDb } from './db';
import {
  getEventById,
  getEventFaqs,
  getEventTiers,
  parsePageDesign,
  type EventFaqRow,
  type EventRow,
  type PageDesign,
} from './events';
import type { Lang } from './i18n';
import { translateTexts } from './translate';

export const LISTING_LANGS: Exclude<Lang, 'en'>[] = ['de', 'ne'];

let ready = false;
function db() {
  const d = getDb();
  if (!ready) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS listing_translations (
        event_id TEXT NOT NULL,
        lang TEXT NOT NULL,
        field TEXT NOT NULL,
        src_hash TEXT NOT NULL,
        text TEXT NOT NULL,
        manual INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (event_id, lang, field)
      )
    `);
    ready = true;
  }
  return d;
}

const hashOf = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

/** A field of a listing that is shown to buyers, with its English text. */
export interface ListingField {
  field: string;
  /** What the organizer sees in the Languages section. */
  label: string;
  text: string;
}

/**
 * Everything on a listing's page that the organizer wrote and a buyer reads.
 * The listing's NAME, the artist and the venue stay as written — they are
 * names, and a name translated is a different name.
 */
export function listingFields(eventId: string): ListingField[] {
  const event = getEventById(eventId);
  if (!event) return [];
  const out: ListingField[] = [];
  const add = (field: string, label: string, text: string | undefined | null) => {
    const t = (text ?? '').trim();
    if (t && /\p{L}/u.test(t)) out.push({ field, label, text: t });
  };
  add('description', 'Description', event.description);
  add('pickupInfo', 'How to collect', event.kind === 'shop' ? event.pickupInfo : '');
  add('dateDisplay', 'Date line', event.kind === 'event' ? event.dateDisplay : '');
  for (const t of getEventTiers(eventId)) {
    add(`tier:${t.tierKey}:name`, `${t.name} — name`, t.name);
    add(`tier:${t.tierKey}:description`, `${t.name} — one line`, t.description);
    add(`tier:${t.tierKey}:details`, `${t.name} — about`, t.details);
  }
  getEventFaqs(eventId).forEach((f, i) => {
    add(`faq:${i}:q`, `FAQ ${i + 1} — question`, f.question);
    add(`faq:${i}:a`, `FAQ ${i + 1} — answer`, f.answer);
  });
  const design = parsePageDesign(event.pageDesign);
  add('design:headline', 'Headline', design.headline);
  add('design:tagline', 'Tagline', design.tagline);
  add('design:aboutTitle', 'Description heading', design.aboutTitle);
  (design.highlights ?? []).forEach((h, i) => add(`design:highlight:${i}`, `Highlight ${i + 1}`, h));
  return out;
}

/** The current translations of a listing for one language, keyed by field. */
export function listingTranslations(eventId: string, lang: Lang): Map<string, string> {
  const map = new Map<string, string>();
  if (lang === 'en') return map;
  const fields = listingFields(eventId);
  const rows = db()
    .prepare(`SELECT field, src_hash AS srcHash, text FROM listing_translations WHERE event_id = ? AND lang = ?`)
    .all(eventId, lang) as { field: string; srcHash: string; text: string }[];
  const byField = new Map(rows.map((r) => [r.field, r]));
  for (const f of fields) {
    const row = byField.get(f.field);
    // Only a translation of the English that is there NOW.
    if (row && row.srcHash === hashOf(f.text)) map.set(f.field, row.text);
  }
  return map;
}

/** Rows for the editor: English, the translation, and whether it was hand-edited. */
export function listingTranslationRows(
  eventId: string,
  lang: Exclude<Lang, 'en'>
): { field: string; label: string; english: string; text: string; manual: boolean; current: boolean }[] {
  const rows = db()
    .prepare(`SELECT field, src_hash AS srcHash, text, manual FROM listing_translations WHERE event_id = ? AND lang = ?`)
    .all(eventId, lang) as { field: string; srcHash: string; text: string; manual: number }[];
  const byField = new Map(rows.map((r) => [r.field, r]));
  return listingFields(eventId).map((f) => {
    const row = byField.get(f.field);
    const current = Boolean(row && row.srcHash === hashOf(f.text));
    return { field: f.field, label: f.label, english: f.text, text: current ? row!.text : '', manual: Boolean(current && row!.manual), current };
  });
}

/** The organizer's own wording for some fields (Languages section). */
export function saveManualTranslations(eventId: string, lang: Exclude<Lang, 'en'>, edits: Record<string, string>): number {
  const fields = new Map(listingFields(eventId).map((f) => [f.field, f.text]));
  const put = db().prepare(
    `INSERT INTO listing_translations (event_id, lang, field, src_hash, text, manual, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
     ON CONFLICT(event_id, lang, field) DO UPDATE SET src_hash = excluded.src_hash, text = excluded.text,
       manual = 1, updated_at = excluded.updated_at`
  );
  const del = db().prepare(`DELETE FROM listing_translations WHERE event_id = ? AND lang = ? AND field = ?`);
  let n = 0;
  db().transaction(() => {
    for (const [field, raw] of Object.entries(edits)) {
      const english = fields.get(field);
      if (english === undefined) continue;
      const text = String(raw ?? '').trim().slice(0, 8000);
      // Emptied = "translate it for me again".
      if (!text) del.run(eventId, lang, field);
      else put.run(eventId, lang, field, hashOf(english), text);
      n++;
    }
  })();
  return n;
}

const inFlight = new Set<string>();
/** Saved again while being translated: run once more when this pass ends. */
const again = new Set<string>();
const lastWarm = new Map<string, number>();

/**
 * Make sure every field of this listing has a current translation in German
 * and Nepali. Only what is missing or out of date is sent to the AI (and the
 * shared cache in lib/translate answers repeated sentences for free). A hand-
 * edited row is left alone while its English is unchanged. `force` re-makes
 * the machine rows too (the editor's "Translate again").
 */
export async function warmListingTranslations(eventId: string, opts: { force?: boolean } = {}): Promise<void> {
  if (inFlight.has(eventId)) {
    again.add(eventId);
    return;
  }
  inFlight.add(eventId);
  lastWarm.set(eventId, Date.now());
  try {
    const fields = listingFields(eventId);
    if (fields.length === 0) return;
    const put = db().prepare(
      `INSERT INTO listing_translations (event_id, lang, field, src_hash, text, manual, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
       ON CONFLICT(event_id, lang, field) DO UPDATE SET src_hash = excluded.src_hash, text = excluded.text,
         manual = 0, updated_at = excluded.updated_at`
    );
    for (const lang of LISTING_LANGS) {
      const rows = db()
        .prepare(`SELECT field, src_hash AS srcHash, manual FROM listing_translations WHERE event_id = ? AND lang = ?`)
        .all(eventId, lang) as { field: string; srcHash: string; manual: number }[];
      const byField = new Map(rows.map((r) => [r.field, r]));
      const todo = fields.filter((f) => {
        const row = byField.get(f.field);
        if (!row || row.srcHash !== hashOf(f.text)) return true;
        return Boolean(opts.force) && !row.manual;
      });
      if (todo.length === 0) continue;
      // Already in the target language (a Nepali description on the Nepali
      // side) is kept as written rather than sent away.
      const map = await translateTexts(
        lang,
        todo.map((f) => f.text)
      );
      db().transaction(() => {
        for (const f of todo) {
          const out = map[f.text] ?? (lang === 'ne' && /[ऀ-ॿ]/.test(f.text) ? f.text : undefined);
          if (out) put.run(eventId, lang, f.field, hashOf(f.text), out);
        }
      })();
    }
  } catch (e) {
    console.error(`Translating listing ${eventId} failed:`, e);
  } finally {
    inFlight.delete(eventId);
    if (again.delete(eventId)) void warmListingTranslations(eventId);
  }
}

/** Fire-and-forget warm, at most every few minutes per listing unless forced. */
export function warmSoon(eventId: string, minGapMs = 5 * 60_000): void {
  const last = lastWarm.get(eventId) ?? 0;
  if (Date.now() - last < minGapMs) return;
  void warmListingTranslations(eventId);
}

/**
 * The listing as a buyer reading `lang` should see it: every field that has a
 * current translation swapped in, everything else as written. Also starts a
 * background warm when something is still missing, so the next view has it.
 */
export function localizeListing<T extends { tierKey: string; name: string; description: string; details?: string }>(
  event: EventRow,
  tiers: T[],
  faqs: EventFaqRow[],
  design: PageDesign,
  lang: Lang
): { event: EventRow; tiers: T[]; faqs: EventFaqRow[]; design: PageDesign; translated: boolean } {
  if (lang === 'en') return { event, tiers, faqs, design, translated: false };
  const map = listingTranslations(event.id, lang);
  const need = listingFields(event.id).some((f) => !map.has(f.field));
  if (need) warmSoon(event.id);
  if (map.size === 0) return { event, tiers, faqs, design, translated: false };
  const pick = (field: string, fallback: string) => map.get(field) ?? fallback;
  return {
    translated: true,
    event: {
      ...event,
      description: pick('description', event.description),
      pickupInfo: pick('pickupInfo', event.pickupInfo),
      dateDisplay: pick('dateDisplay', event.dateDisplay),
    },
    tiers: tiers.map((t) => ({
      ...t,
      name: pick(`tier:${t.tierKey}:name`, t.name),
      description: pick(`tier:${t.tierKey}:description`, t.description),
      ...(t.details !== undefined ? { details: pick(`tier:${t.tierKey}:details`, t.details) } : {}),
    })),
    faqs: faqs.map((f, i) => ({ ...f, question: pick(`faq:${i}:q`, f.question), answer: pick(`faq:${i}:a`, f.answer) })),
    design: {
      ...design,
      headline: design.headline ? pick('design:headline', design.headline) : design.headline,
      tagline: design.tagline ? pick('design:tagline', design.tagline) : design.tagline,
      aboutTitle: design.aboutTitle ? pick('design:aboutTitle', design.aboutTitle) : design.aboutTitle,
      highlights: design.highlights?.map((h, i) => pick(`design:highlight:${i}`, h)),
    },
  };
}
