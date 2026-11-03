/**
 * NO MONEY OR HIRE WORDS IN ANY STUDIO DEMO, IN ANY LANGUAGE.
 *
 * The studio's operator is a student whose permit forbids self-employment:
 * nothing on /work may read like a price, a quote, a package or an offer to
 * hire. Each demo has its own stricter test (cardMaker, momoTruck, abcLetters,
 * …); this one is the net under all of them, including the demos without one.
 * It reads every string literal and JSX text in src/app/work/<demo>/content.ts
 * and page.tsx (the frame around each demo, the metadata) and the studio's
 * i18n keys (pj.* project names, dn.* prev / next, wk.* / dm.* / pf.* gallery
 * lines) — in English, Deutsch and नेपाली.
 *
 * A new hit should be fixed in the copy. The allowlist below is only for
 * matches that are not about money for the studio at all, each with a reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const WORK = path.join(ROOT, 'src/app/work');

const WORDS = new RegExp(
  [
    // English
    '€', String.raw`\$\s?\d`, String.raw`\beur\b`, String.raw`\beuros?\b`, String.raw`\bprices?\b`, String.raw`\bpricing`,
    String.raw`\bfees?\b`, String.raw`\bcosts?\b`, String.raw`\bcheap`, String.raw`\bquotes?\b`, String.raw`\brates?\b`,
    String.raw`\bpackages?\b`, String.raw`\bhire`, String.raw`\bhiring`, String.raw`\binvoice`, String.raw`\bbudgets?\b`,
    String.raw`\bper hour\b`, String.raw`\bhourly\b`,
    // Deutsch ("kostenlos" = free is fine; "Kosten" the noun is not)
    'preis', 'gebühr', String.raw`\bkosten\b`, String.raw`\bkostet\b`, String.raw`\bangebot`, 'honorar', String.raw`\bpaket`,
    'stundensatz', String.raw`\brechnung`, String.raw`\bbeauftrag`,
    // नेपाली ("निःशुल्क" = free is fine)
    '(?<!निः)शुल्क', 'मूल्य', String.raw`रु\.?\s?[०-९\d]`, 'रुपैयाँ', 'भाडा', 'बजेट', 'दररेट', 'प्याकेज',
  ].join('|'),
  'i'
);

/**
 * Harmless matches, as `file: exact string`. Each says why it is not money
 * for the studio.
 */
const ALLOW: Record<string, string> = {
  // The restaurant and momo demos say on screen that the menu shows no
  // prices — the one sentence where the word has to appear.
  'restaurant/content.ts: Prices hidden in this demo': 'says prices are hidden',
  'restaurant/content.ts: Preise sind in dieser Demo ausgeblendet': 'says prices are hidden',
  'restaurant/content.ts: यो डेमोमा मूल्य लुकाइएको छ': 'says prices are hidden',
  'momo/content.ts: Prices hidden in this demo': 'says prices are hidden',
  'momo/content.ts: Preise sind in dieser Demo ausgeblendet': 'says prices are hidden',
  'momo/content.ts: यो डेमोमा मूल्य लुकाइएको छ': 'says prices are hidden',
  'shop/content.ts: Prices hidden in this demo': 'says prices are hidden',
  'shop/content.ts: Preise sind in dieser Demo ausgeblendet': 'says prices are hidden',
  'shop/content.ts: यो डेमोमा मूल्य लुकाइएको छ': 'says prices are hidden',
  // A guest at the made-up restaurant's table asks the waiter for the bill
  // ("Bill, please" in English) — the restaurant's dinner, not the studio's.
  'restaurant/content.ts: Rechnung bitte': 'a table asks for its bill',
  'restaurant/content.ts: Möchte die Rechnung': 'a table asks for its bill',
  'restaurant/content.ts:  möchte die Rechnung': 'a table asks for its bill',
};

type Hit = { where: string; text: string; word: string };

function stringsIn(file: string): string[] {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, kind);
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isImportDeclaration(n)) return; // module paths
    if (ts.isJsxAttribute(n) && n.name.getText(src) === 'className') return;
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n)
    ) {
      out.push(n.text);
    } else if (ts.isJsxText(n)) {
      const s = n.getText(src).replace(/\s+/g, ' ').trim();
      if (s) out.push(s);
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

/** The studio's keys in lib/i18n.ts: every string under a 'pj.*' / 'dn.*' / 'wk.*' / 'dm.*' / 'pf.*' entry. */
function studioI18nStrings(): { key: string; text: string }[] {
  const file = path.join(ROOT, 'src/lib/i18n.ts');
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out: { key: string; text: string }[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isPropertyAssignment(n) && ts.isStringLiteral(n.name) && /^(pj|dn|wk|dm|pf)\./.test(n.name.text)) {
      const key = n.name.text;
      const inner = (m: ts.Node) => {
        if (ts.isStringLiteral(m) || ts.isNoSubstitutionTemplateLiteral(m)) out.push({ key, text: m.text });
        ts.forEachChild(m, inner);
      };
      inner(n.initializer);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

const demos = fs.readdirSync(WORK).filter((d) => fs.statSync(path.join(WORK, d)).isDirectory());

test('the scan finds every demo and plenty of text', () => {
  for (const d of ['wedding', 'artist', 'quiz', 'live', 'classes', 'samaj', 'restaurant', 'build', 'kite', 'card', 'booth', 'momo', 'cup', 'abc', 'radio', 'shop']) {
    assert.ok(demos.includes(d), `${d} is under src/app/work`);
    assert.ok(fs.existsSync(path.join(WORK, d, 'content.ts')), `${d} has a content.ts`);
  }
  const n = demos.reduce((sum, d) => sum + stringsIn(path.join(WORK, d, 'content.ts')).length, 0);
  assert.ok(n > 3000, `only ${n} strings found — is the scan still reading content.ts?`);
  assert.ok(studioI18nStrings().length > 60);
});

test('the word list catches what it should and lets "free" through', () => {
  for (const bad of ['Ask for a quote', 'Pakete ab 99 €', 'Preis auf Anfrage', 'Kosten: 10', 'रु ५००', 'मूल्य', 'सेवा शुल्क', 'hire us', 'Unser Angebot für dich']) {
    assert.match(bad, WORDS, bad);
  }
  for (const ok of ['Kostenlos, solange wir wachsen.', 'हामी बढ्दै गर्दा निःशुल्क।', 'Free while we grow.', 'on tour across Europe', 'Separate', 'Zahlen und Farben']) {
    assert.doesNotMatch(ok, WORDS, ok);
  }
});

test('no money or hire words in any demo’s content, frame or studio i18n key', () => {
  const hits: Hit[] = [];
  const used = new Set<string>();
  for (const d of demos) {
    for (const f of ['content.ts', 'page.tsx']) {
      const file = path.join(WORK, d, f);
      if (!fs.existsSync(file)) continue;
      for (const text of stringsIn(file)) {
        const m = text.match(WORDS);
        if (!m) continue;
        const id = `${d}/${f}: ${text}`;
        if (ALLOW[id]) {
          used.add(id);
          continue;
        }
        hits.push({ where: `${d}/${f}`, text: text.slice(0, 120), word: m[0] });
      }
    }
  }
  for (const { key, text } of studioI18nStrings()) {
    const m = text.match(WORDS);
    if (m) hits.push({ where: `i18n ${key}`, text, word: m[0] });
  }
  assert.deepEqual(hits, [], hits.map((h) => `${h.where} [${h.word}] ${h.text}`).join('\n'));
  // A stale allowlist line hides nothing, but should go.
  assert.deepEqual(Object.keys(ALLOW).filter((k) => !used.has(k)), [], 'unused allowlist entries');
});
