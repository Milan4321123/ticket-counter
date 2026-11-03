// The rules of "Ka Kha Ga" (/work/abc), a kids' Nepali alphabet app: the
// letters with their example words, Devanagari syllables (aksharas) as
// grapheme clusters, the tracing score, the three games, stars, stickers and
// the day streak. Pure — no DOM, no storage, no clock — so
// tests/abcLetters.test.ts can pin all of it. The app (AbcApp.tsx) only draws
// what this module decides.
//
// Nothing here is ever sent anywhere: progress lives in the child's browser
// under one localStorage key, and the only name kept is an optional first
// name the parent types in.

export type Lang = 'en' | 'de' | 'ne';
export type LetterKind = 'vowel' | 'consonant';

/** Picture ids — each one is drawn in art.tsx. */
export type PicId =
  | 'pomegranate' | 'mango' | 'well' | 'lamp' | 'owl' | 'wool' | 'sage' | 'one' | 'mirror' | 'walnut' | 'ring' | 'grapes' | 'six'
  | 'lotus' | 'rabbit' | 'pot' | 'house' | 'fan' | 'bird' | 'umbrella' | 'plane' | 'bag' | 'glove'
  | 'tomato' | 'cart' | 'damaru' | 'dhol' | 'arrow' | 'scales' | 'plate' | 'tooth' | 'bow' | 'coconut'
  | 'butterfly' | 'flower' | 'cat' | 'bear' | 'fish' | 'yak' | 'tree' | 'top' | 'forest'
  | 'conch' | 'hexagon' | 'sun' | 'elephant' | 'horizon' | 'trident' | 'book' | 'namaste';

export type Letter = {
  /** The letter as written (क्ष, त्र, ज्ञ, अं and अः are more than one code point). */
  ch: string;
  kind: LetterKind;
  /** A simple, kid-friendly romanisation (capital T/D/N = tongue curled back). */
  tr: string;
  /** The example word, as in a Nepali primer. */
  word: string;
  wordTr: string;
  pic: PicId;
  /** No Nepali word starts with this letter, so the example has it inside. */
  inside?: boolean;
  en: string;
  de: string;
};

const L = (ch: string, kind: LetterKind, tr: string, word: string, wordTr: string, pic: PicId, en: string, de: string, inside?: boolean): Letter =>
  inside ? { ch, kind, tr, word, wordTr, pic, en, de, inside } : { ch, kind, tr, word, wordTr, pic, en, de };

/** स्वर — the 13 vowels as Nepali primers teach them. */
export const VOWELS: Letter[] = [
  L('अ', 'vowel', 'a', 'अनार', 'anaar', 'pomegranate', 'pomegranate', 'Granatapfel'),
  L('आ', 'vowel', 'aa', 'आँप', 'aanp', 'mango', 'mango', 'Mango'),
  L('इ', 'vowel', 'i', 'इनार', 'inaar', 'well', 'well', 'Brunnen'),
  L('ई', 'vowel', 'ii', 'ईश्वर', 'iishwar', 'lamp', 'God (a prayer lamp)', 'Gott (ein Gebetslicht)'),
  L('उ', 'vowel', 'u', 'उल्लु', 'ullu', 'owl', 'owl', 'Eule'),
  L('ऊ', 'vowel', 'uu', 'ऊन', 'uun', 'wool', 'wool', 'Wolle'),
  L('ऋ', 'vowel', 'ri', 'ऋषि', 'rishi', 'sage', 'wise old sage', 'weiser Rishi'),
  L('ए', 'vowel', 'e', 'एक', 'ek', 'one', 'one', 'eins'),
  L('ऐ', 'vowel', 'ai', 'ऐना', 'aina', 'mirror', 'mirror', 'Spiegel'),
  L('ओ', 'vowel', 'o', 'ओखर', 'okhar', 'walnut', 'walnut', 'Walnuss'),
  L('औ', 'vowel', 'au', 'औँठी', 'aunthi', 'ring', 'ring', 'Ring'),
  L('अं', 'vowel', 'am', 'अंगुर', 'angur', 'grapes', 'grapes', 'Weintrauben'),
  L('अः', 'vowel', 'ah', 'छः', 'chhah', 'six', 'six', 'sechs', true),
];

/** व्यञ्जन — the 36 consonants, क to ज्ञ. */
export const CONSONANTS: Letter[] = [
  L('क', 'consonant', 'ka', 'कमल', 'kamal', 'lotus', 'lotus flower', 'Lotusblume'),
  L('ख', 'consonant', 'kha', 'खरायो', 'kharaayo', 'rabbit', 'rabbit', 'Hase'),
  L('ग', 'consonant', 'ga', 'गमला', 'gamalaa', 'pot', 'flower pot', 'Blumentopf'),
  L('घ', 'consonant', 'gha', 'घर', 'ghar', 'house', 'house', 'Haus'),
  L('ङ', 'consonant', 'nga', 'पङ्खा', 'pankhaa', 'fan', 'fan', 'Ventilator', true),
  L('च', 'consonant', 'cha', 'चरा', 'charaa', 'bird', 'bird', 'Vogel'),
  L('छ', 'consonant', 'chha', 'छाता', 'chhaataa', 'umbrella', 'umbrella', 'Regenschirm'),
  L('ज', 'consonant', 'ja', 'जहाज', 'jahaaj', 'plane', 'aeroplane', 'Flugzeug'),
  L('झ', 'consonant', 'jha', 'झोला', 'jholaa', 'bag', 'cloth bag', 'Stofftasche'),
  L('ञ', 'consonant', 'nya', 'पञ्जा', 'panjaa', 'glove', 'glove', 'Handschuh', true),
  L('ट', 'consonant', 'Ta', 'टमाटर', 'Tamaatar', 'tomato', 'tomato', 'Tomate'),
  L('ठ', 'consonant', 'Tha', 'ठेला', 'Thelaa', 'cart', 'handcart', 'Handkarren'),
  L('ड', 'consonant', 'Da', 'डमरु', 'Damaru', 'damaru', 'damaru drum', 'Damaru-Trommel'),
  L('ढ', 'consonant', 'Dha', 'ढोल', 'Dhol', 'dhol', 'big drum', 'große Trommel'),
  L('ण', 'consonant', 'Na', 'बाण', 'baaN', 'arrow', 'arrow', 'Pfeil', true),
  L('त', 'consonant', 'ta', 'तराजु', 'taraaju', 'scales', 'scales', 'Waage'),
  L('थ', 'consonant', 'tha', 'थाल', 'thaal', 'plate', 'big plate', 'großer Teller'),
  L('द', 'consonant', 'da', 'दाँत', 'daant', 'tooth', 'tooth', 'Zahn'),
  L('ध', 'consonant', 'dha', 'धनुष', 'dhanush', 'bow', 'bow', 'Bogen'),
  L('न', 'consonant', 'na', 'नरिवल', 'nariwal', 'coconut', 'coconut', 'Kokosnuss'),
  L('प', 'consonant', 'pa', 'पुतली', 'putali', 'butterfly', 'butterfly', 'Schmetterling'),
  L('फ', 'consonant', 'pha', 'फूल', 'phuul', 'flower', 'flower', 'Blume'),
  L('ब', 'consonant', 'ba', 'बिरालो', 'biraalo', 'cat', 'cat', 'Katze'),
  L('भ', 'consonant', 'bha', 'भालु', 'bhaalu', 'bear', 'bear', 'Bär'),
  L('म', 'consonant', 'ma', 'माछा', 'maachhaa', 'fish', 'fish', 'Fisch'),
  L('य', 'consonant', 'ya', 'याक', 'yaak', 'yak', 'yak', 'Yak'),
  L('र', 'consonant', 'ra', 'रुख', 'rukh', 'tree', 'tree', 'Baum'),
  L('ल', 'consonant', 'la', 'लट्टु', 'lattu', 'top', 'spinning top', 'Kreisel'),
  L('व', 'consonant', 'wa', 'वन', 'wan', 'forest', 'forest', 'Wald'),
  L('श', 'consonant', 'sha', 'शङ्ख', 'shankha', 'conch', 'conch shell', 'Muschelhorn'),
  L('ष', 'consonant', 'Sha', 'षट्कोण', 'Shatkon', 'hexagon', 'hexagon', 'Sechseck'),
  L('स', 'consonant', 'sa', 'सूर्य', 'suurya', 'sun', 'sun', 'Sonne'),
  L('ह', 'consonant', 'ha', 'हात्ती', 'haatti', 'elephant', 'elephant', 'Elefant'),
  L('क्ष', 'consonant', 'ksha', 'क्षितिज', 'kshitij', 'horizon', 'horizon', 'Horizont'),
  L('त्र', 'consonant', 'tra', 'त्रिशूल', 'trishuul', 'trident', 'trident', 'Dreizack'),
  L('ज्ञ', 'consonant', 'gya', 'ज्ञानी', 'gyaani', 'book', 'wise and good', 'klug und lieb'),
];

export const LETTERS: Letter[] = [...VOWELS, ...CONSONANTS];
const BY_CH = new Map(LETTERS.map((l) => [l.ch, l]));
export function letter(ch: string): Letter | undefined {
  return BY_CH.get(ch);
}
export function letterIndex(ch: string): number {
  return LETTERS.findIndex((l) => l.ch === ch);
}

// ---------- graphemes and aksharas ----------

export const VIRAMA = '्';
const MARK = /\p{M}/u;
const JOINER = /[‌‍]/;
const CONSONANT = /^[क-हक़-य़]/;
/** Dependent vowel signs and the nasal / visarga marks that ride on a syllable. */
const SIGNS = /[ऺ-ौॎॏॕ-ॗॢॣऀ-ः]+$/;

type SegmenterLike = { segment(s: string): Iterable<{ segment: string }> };
function intlSegmenter(): SegmenterLike | null {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: 'grapheme' }) => SegmenterLike }).Segmenter;
  if (typeof Seg !== 'function') return null;
  try {
    return new Seg('ne', { granularity: 'grapheme' });
  } catch {
    return null;
  }
}

/**
 * User-perceived characters. Intl.Segmenter where the browser has it, else a
 * small fallback: every combining mark (matra, virama, anusvara, visarga,
 * chandrabindu, nukta) and joiner stays with the character before it.
 */
export function graphemes(s: string, useIntl = true): string[] {
  const seg = useIntl ? intlSegmenter() : null;
  if (seg) return Array.from(seg.segment(s), (x) => x.segment);
  const out: string[] = [];
  for (const ch of Array.from(s)) {
    if (out.length && (MARK.test(ch) || JOINER.test(ch))) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/**
 * Syllables as a child writes them: grapheme clusters, with a cluster that
 * ends in a virama (्) joined to the consonant after it — so नमस्ते is
 * न · म · स्ते and पङ्खा is प · ङ्खा, whether or not the browser's segmenter
 * already keeps conjuncts together.
 */
export function aksharas(s: string, useIntl = true): string[] {
  const out: string[] = [];
  for (const g of graphemes(s, useIntl)) {
    const prev = out[out.length - 1];
    if (prev !== undefined && /्‍?$/.test(prev) && CONSONANT.test(g)) out[out.length - 1] = prev + g;
    else out.push(g);
  }
  return out;
}

/** The alphabet letter a syllable is built on: कि → क, क्षि → क्ष, आँ → आ, अं → अं. */
export function baseLetter(akshara: string): string {
  if (akshara.startsWith('अं') || akshara.startsWith('अः')) return akshara.slice(0, 2);
  if (!CONSONANT.test(akshara)) return Array.from(akshara)[0] ?? '';
  return akshara.replace(/़/g, '').replace(SIGNS, '');
}

/** The letter a word starts with, read the way a child reads it. */
export function firstLetter(word: string, useIntl = true): string {
  const first = aksharas(word, useIntl)[0];
  return first ? baseLetter(first) : '';
}

/** Does the word carry this letter somewhere (for ङ ञ ण अः, which no word starts with)? */
export function hasLetterInside(word: string, ch: string, useIntl = true): boolean {
  if (ch === 'अः') return word.includes('ः');
  if (ch === 'अं') return word.includes('ं');
  return aksharas(word, useIntl).some((a) => a.includes(ch));
}

/** Where to highlight the letter inside its example word: [start, end) in aksharas. */
export function highlightIndex(l: Letter, useIntl = true): number {
  const parts = aksharas(l.word, useIntl);
  if (!l.inside) return 0;
  const mark = l.ch === 'अः' ? 'ः' : l.ch;
  return Math.max(0, parts.findIndex((a) => a.includes(mark)));
}

// ---------- speech: picking a voice ----------

export type VoiceLike = { lang: string; name: string; localService?: boolean };
export type VoiceKind = 'ne' | 'hi' | 'none';

/**
 * A Nepali voice if the device has one, else Hindi (same script, close
 * sounds), else none. Only voices that run on the device: a network voice
 * would send what the child taps to a speech server.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[]): { voice: V | null; kind: VoiceKind } {
  const local = voices.filter((v) => v.localService !== false);
  const norm = (v: V) => v.lang.toLowerCase().replace('_', '-');
  const ne = local.find((v) => norm(v) === 'ne-np') ?? local.find((v) => norm(v).startsWith('ne'));
  if (ne) return { voice: ne, kind: 'ne' };
  const hi = local.find((v) => norm(v) === 'hi-in') ?? local.find((v) => norm(v).startsWith('hi'));
  if (hi) return { voice: hi, kind: 'hi' };
  return { voice: null, kind: 'none' };
}

/** What is said when a letter is tapped: the letter, a pause, the word. */
export function sayLine(l: Letter): string {
  return `${l.ch}। ${l.word}।`;
}

// ---------- tracing ----------

/** A square grid of cells, 1 where something is. */
export type Mask = { w: number; h: number; d: Uint8Array };
export type Pt = { x: number; y: number };
/** The grid the guide and the child's ink are compared on. */
export const GRID = 64;
/** The brush radius as a share of the canvas side (drawn and scored the same). */
export const BRUSH = 0.042;

export function emptyMask(w: number, h = w): Mask {
  return { w, h, d: new Uint8Array(w * h) };
}

export function countMask(m: Mask): number {
  let n = 0;
  for (let i = 0; i < m.d.length; i++) n += m.d[i];
  return n;
}

/** Grow a mask by r cells (a round brush). */
export function dilate(m: Mask, r: number): Mask {
  if (r <= 0) return { w: m.w, h: m.h, d: m.d.slice() };
  const out = emptyMask(m.w, m.h);
  const offs: [number, number][] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) offs.push([dx, dy]);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (!m.d[y * m.w + x]) continue;
      for (const [dx, dy] of offs) {
        const X = x + dx;
        const Y = y + dy;
        if (X >= 0 && Y >= 0 && X < m.w && Y < m.h) out.d[Y * m.w + X] = 1;
      }
    }
  return out;
}

/** Paint strokes (points in 0..1 of the canvas side) onto a grid with a round brush. */
export function rasterize(strokes: Pt[][], w = GRID, brush = BRUSH): Mask {
  const m = emptyMask(w, w);
  const r = brush * w;
  const stamp = (cx: number, cy: number) => {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(w - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) m.d[y * w + x] = 1;
      }
  };
  for (const s of strokes) {
    if (!s.length) continue;
    stamp(s[0].x * w, s[0].y * w);
    for (let i = 1; i < s.length; i++) {
      const ax = s[i - 1].x * w;
      const ay = s[i - 1].y * w;
      const bx = s[i].x * w;
      const by = s[i].y * w;
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.5));
      for (let k = 1; k <= steps; k++) stamp(ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps);
    }
  }
  return m;
}

/** A mask from RGBA pixels (an offscreen canvas of size w × h): alpha above the cut-off. */
export function maskFromAlpha(rgba: ArrayLike<number>, w: number, h: number, cut = 110): Mask {
  const m = emptyMask(w, h);
  for (let i = 0; i < w * h; i++) m.d[i] = rgba[i * 4 + 3] > cut ? 1 : 0;
  return m;
}

export type TraceScore = {
  /** Share of the letter the child went over (0..1). */
  coverage: number;
  /** Share of the child's ink that is off the letter (0..1). */
  outside: number;
  inkCells: number;
  guideCells: number;
};

/**
 * How well the ink covers the guide: coverage = guide cells within `tol` of
 * ink / all guide cells; outside = ink cells further than `tol` from the guide
 * / all ink cells. A little slack on both sides, because fingers are wide.
 */
export function scoreTrace(guide: Mask, ink: Mask, tol = 1): TraceScore {
  if (guide.w !== ink.w || guide.h !== ink.h) throw new Error('mask sizes differ');
  const inkWide = dilate(ink, tol);
  const guideWide = dilate(guide, tol + 1);
  let g = 0;
  let covered = 0;
  let k = 0;
  let out = 0;
  for (let i = 0; i < guide.d.length; i++) {
    if (guide.d[i]) {
      g++;
      if (inkWide.d[i]) covered++;
    }
    if (ink.d[i]) {
      k++;
      if (!guideWide.d[i]) out++;
    }
  }
  return { coverage: g ? covered / g : 0, outside: k ? out / k : 0, inkCells: k, guideCells: g };
}

export type Stars = 0 | 1 | 2 | 3;
export const STAR_RULES: { stars: Stars; coverage: number; outside: number }[] = [
  { stars: 3, coverage: 0.66, outside: 0.25 },
  { stars: 2, coverage: 0.46, outside: 0.4 },
  { stars: 1, coverage: 0.26, outside: 0.6 },
];
export function traceStars(s: TraceScore): Stars {
  if (s.inkCells < 4) return 0;
  for (const r of STAR_RULES) if (s.coverage >= r.coverage && s.outside <= r.outside) return r.stars;
  return 0;
}

/** Which nudge to give: go over more of it, or stay on the lines. */
export function traceHint(s: TraceScore): 'more' | 'inside' | 'great' {
  const st = traceStars(s);
  if (st === 3) return 'great';
  return s.outside > 0.25 ? 'inside' : 'more';
}

// ---------- random, seeded ----------

export type Rng = () => number;
export function rng(seed: number): Rng {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(xs: readonly T[], r: Rng): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickN<T>(xs: readonly T[], n: number, r: Rng): T[] {
  return shuffle(xs, r).slice(0, n);
}

// ---------- the games ----------

export type GameId = 'find' | 'match' | 'build';
export const GAMES: GameId[] = ['find', 'match', 'build'];
export const FIND_PER_ROUND = 5;
export const MATCH_PER_ROUND = 3;
export const BUILD_PER_ROUND = 3;

export type FindQ = { target: string; options: string[] };
/** "Find the letter": five letters to find, each among four balloons. */
export function findRound(r: Rng, n = FIND_PER_ROUND, pool: readonly Letter[] = LETTERS): FindQ[] {
  const targets = pickN(pool, n, r);
  return targets.map((t) => {
    const others = pickN(
      pool.filter((l) => l.ch !== t.ch),
      3,
      r
    );
    return { target: t.ch, options: shuffle([t, ...others], r).map((l) => l.ch) };
  });
}

/** "Match the picture": three letters whose words start with them, three different pictures. */
export function matchRound(r: Rng, k = MATCH_PER_ROUND): string[] {
  return pickN(
    LETTERS.filter((l) => !l.inside),
    k,
    r
  ).map((l) => l.ch);
}

export type BuildWord = { word: string; tr: string; pic: PicId; en: string; de: string };
/** "Build a word": short words whose syllables come apart cleanly. */
export const BUILD_WORDS: BuildWord[] = [
  { word: 'घर', tr: 'ghar', pic: 'house', en: 'house', de: 'Haus' },
  { word: 'फूल', tr: 'phuul', pic: 'flower', en: 'flower', de: 'Blume' },
  { word: 'याक', tr: 'yaak', pic: 'yak', en: 'yak', de: 'Yak' },
  { word: 'चरा', tr: 'charaa', pic: 'bird', en: 'bird', de: 'Vogel' },
  { word: 'कमल', tr: 'kamal', pic: 'lotus', en: 'lotus flower', de: 'Lotusblume' },
  { word: 'माछा', tr: 'maachhaa', pic: 'fish', en: 'fish', de: 'Fisch' },
  { word: 'भालु', tr: 'bhaalu', pic: 'bear', en: 'bear', de: 'Bär' },
  { word: 'छाता', tr: 'chhaataa', pic: 'umbrella', en: 'umbrella', de: 'Regenschirm' },
  { word: 'गमला', tr: 'gamalaa', pic: 'pot', en: 'flower pot', de: 'Blumentopf' },
  { word: 'खरायो', tr: 'kharaayo', pic: 'rabbit', en: 'rabbit', de: 'Hase' },
  { word: 'बिरालो', tr: 'biraalo', pic: 'cat', en: 'cat', de: 'Katze' },
  { word: 'हात्ती', tr: 'haatti', pic: 'elephant', en: 'elephant', de: 'Elefant' },
  { word: 'टमाटर', tr: 'Tamaatar', pic: 'tomato', en: 'tomato', de: 'Tomate' },
  { word: 'नमस्ते', tr: 'namaste', pic: 'namaste', en: 'hello (namaste)', de: 'Hallo (Namaste)' },
];
/** Easy syllables to mix in as extra tiles. */
export const SPARE_TILES = ['क', 'मा', 'ल', 'प', 'सा', 'त', 'रा', 'न', 'बा', 'दि', 'गो', 'हा', 'जा', 'मे'];

export type BuildTask = { word: string; answer: string[]; tiles: string[] };
/** Three words, shortest first, each with its syllables shuffled and one or two extra tiles. */
export function buildRound(r: Rng, k = BUILD_PER_ROUND): BuildTask[] {
  const chosen = pickN(BUILD_WORDS, k, r).sort((a, b) => aksharas(a.word).length - aksharas(b.word).length);
  return chosen.map((w) => {
    const answer = aksharas(w.word);
    const spare = pickN(
      SPARE_TILES.filter((t) => !answer.includes(t)),
      answer.length >= 3 ? 2 : 1,
      r
    );
    let tiles = shuffle([...answer, ...spare], r);
    // Never hand the answer over already in order.
    if (tiles.slice(0, answer.length).join('') === answer.join('')) tiles = [...tiles.slice(1), tiles[0]];
    return { word: w.word, answer, tiles };
  });
}
export function buildWord(word: string): BuildWord | undefined {
  return BUILD_WORDS.find((w) => w.word === word);
}
/** Is what the child placed the word? (Joined, so two equal tiles can swap.) */
export function buildCorrect(task: BuildTask, placed: string[]): boolean {
  return placed.length === task.answer.length && placed.join('') === task.word;
}

// ---------- progress: stars, stickers, streak ----------

export type Wins = Record<GameId, number>;
export type Progress = {
  v: 1;
  lang: Lang;
  /** Optional first name, set by a parent; only ever kept on this device. */
  name: string;
  /** Best tracing stars per letter. */
  stars: Record<string, Stars>;
  wins: Wins;
  /** Days (YYYY-MM-DD, local) with some practice, newest last, at most 60. */
  days: string[];
  sound: boolean;
  /** How many stickers the child has already seen arrive. */
  seen: number;
};

export const NAME_MAX = 20;
export const DAYS_KEPT = 60;

export function fresh(lang: Lang): Progress {
  return { v: 1, lang, name: '', stars: {}, wins: { find: 0, match: 0, build: 0 }, days: [], sound: true, seen: 0 };
}

/** A first name only: letters, spaces, hyphens and apostrophes, trimmed and short. */
export function cleanName(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s
    .replace(/[^\p{L}\p{M}\s'’-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const asLang = (v: unknown): Lang | null => (v === 'en' || v === 'de' || v === 'ne' ? v : null);
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(9999, Math.floor(v)) : 0);

/** Whatever was in localStorage, made safe (unknown letters, bad numbers and junk dropped). */
export function normalize(raw: unknown, lang: Lang): Progress {
  const p = fresh(lang);
  if (!raw || typeof raw !== 'object') return p;
  const o = raw as Record<string, unknown>;
  p.lang = asLang(o.lang) ?? lang;
  p.name = cleanName(o.name);
  if (o.stars && typeof o.stars === 'object')
    for (const [k, v] of Object.entries(o.stars as Record<string, unknown>))
      if (BY_CH.has(k) && (v === 1 || v === 2 || v === 3)) p.stars[k] = v;
  if (o.wins && typeof o.wins === 'object') {
    const w = o.wins as Record<string, unknown>;
    for (const g of GAMES) p.wins[g] = count(w[g]);
  }
  if (Array.isArray(o.days)) p.days = Array.from(new Set(o.days.filter(isDay))).sort().slice(-DAYS_KEPT);
  p.sound = o.sound !== false;
  p.seen = Math.min(count(o.seen), STICKERS.length);
  return p;
}

/** Local date as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function prevDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1, 12));
}

export function markDay(p: Progress, today: string): Progress {
  if (p.days[p.days.length - 1] === today || p.days.includes(today)) return p;
  return { ...p, days: [...p.days, today].sort().slice(-DAYS_KEPT) };
}

/** Days in a row with practice, ending today — or yesterday, so a streak is not lost before today's go. */
export function streak(days: readonly string[], today: string): number {
  const set = new Set(days);
  let d = set.has(today) ? today : prevDay(today);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = prevDay(d);
  }
  return n;
}

/** Keep the best stars for a letter (a worse go never takes stars away). */
export function recordTrace(p: Progress, ch: string, stars: Stars, today: string): Progress {
  if (!BY_CH.has(ch)) return p;
  const next = markDay(p, today);
  const best = Math.max(next.stars[ch] ?? 0, stars) as Stars;
  if (best === 0) return next;
  return { ...next, stars: { ...next.stars, [ch]: best } };
}

export function recordWin(p: Progress, game: GameId, today: string): Progress {
  const next = markDay(p, today);
  return { ...next, wins: { ...next.wins, [game]: next.wins[game] + 1 } };
}

export function totalStars(p: Progress): number {
  return Object.values(p.stars).reduce<number>((a, b) => a + b, 0);
}
export function lettersTraced(p: Progress): number {
  return Object.values(p.stars).filter((s) => s > 0).length;
}
/** Points fill the sticker book: one per tracing star, two per game round won. */
export const WIN_POINTS = 2;
export function points(p: Progress): number {
  return totalStars(p) + WIN_POINTS * (p.wins.find + p.wins.match + p.wins.build);
}

export type StickerId = 'hello' | 'topi' | 'kite' | 'book' | 'momo' | 'star' | 'madal' | 'balloon' | 'garland' | 'mountain' | 'moon' | 'crown';
/** The sticker book, in the order stickers arrive, and the points each needs. */
export const STICKERS: { id: StickerId; at: number }[] = [
  { id: 'hello', at: 1 },
  { id: 'topi', at: 4 },
  { id: 'kite', at: 8 },
  { id: 'book', at: 12 },
  { id: 'momo', at: 17 },
  { id: 'star', at: 23 },
  { id: 'madal', at: 30 },
  { id: 'balloon', at: 38 },
  { id: 'garland', at: 47 },
  { id: 'mountain', at: 57 },
  { id: 'moon', at: 68 },
  { id: 'crown', at: 80 },
];
export function stickersUnlocked(pts: number): number {
  return STICKERS.filter((s) => pts >= s.at).length;
}
/** Points still needed for the next sticker, or null when the book is full. */
export function nextStickerIn(pts: number): number | null {
  const next = STICKERS.find((s) => pts < s.at);
  return next ? next.at - pts : null;
}
/** Stickers that arrived since the child last looked (to celebrate once). */
export function newStickers(p: Progress): number {
  return Math.max(0, stickersUnlocked(points(p)) - p.seen);
}
