// The rules behind /work/instant — "Your website in 10 seconds": a visitor
// types a name, picks what they are (and a city, if they like) and a whole
// landing page writes, draws and lays itself out. Pure on purpose — no React,
// no DOM, no clock of its own — so tests/instantSite.test.ts can check every
// rule: the same name always gives the same site (seeded), each kind gets the
// sections that fit it, every style reads at 4.5 : 1 or better whatever colour
// is picked, every word a visitor types is HTML-escaped, and the whole site
// fits in a capped link.
//
// The generated site is ONE self-contained HTML document (siteHtml): inline
// CSS, inline SVG, a CSP that allows nothing else, no scripts. The preview
// shows it in a sandboxed iframe (srcdoc, no scripts) and the download is the
// very same string. Its words live in templates.ts, its drawings in art.ts.
//
// No prices anywhere — not in the studio's words and not inside the generated
// sites either (menus list dishes, services say what they are, never what they
// cost). The operator of the studio is a student; it is free while it grows.

import { BRIEF_MAX, cleanBrief } from '@/lib/ideaBrief';
import { cleanColor, cleanText, shade, slug } from '../build/idea';
import { contrast, emblemSvg, escapeXml, initialsFrom, type EmblemShape } from '../samaj/samaj';
import { avatarSvg, heroArt, iconSvg, mapSvg, tileArt, type IconId, type Ill } from './art';
import { WORDS, type KindWords, type SiteWords } from './templates';

export type Lang = 'en' | 'de' | 'ne';
export const LANG_IDS: Lang[] = ['en', 'de', 'ne'];

// ---------------- kinds & sections ----------------

export type KindId = 'restaurant' | 'shop' | 'verein' | 'artist' | 'tutor' | 'event' | 'salon' | 'handy' | 'other';
export const KIND_IDS: KindId[] = ['restaurant', 'shop', 'verein', 'artist', 'tutor', 'event', 'salon', 'handy', 'other'];

export type SectionId =
  | 'about'
  | 'menu'
  | 'products'
  | 'services'
  | 'hours'
  | 'gallery'
  | 'team'
  | 'timetable'
  | 'events'
  | 'testimonials'
  | 'faq'
  | 'contact';
export const SECTION_IDS: SectionId[] = ['about', 'menu', 'products', 'services', 'hours', 'gallery', 'team', 'timetable', 'events', 'testimonials', 'faq', 'contact'];

/**
 * Which sections each kind gets: `on` in this order by default, `extra` in the
 * list but switched off. The hero and the footer are always there.
 */
export const POOL: Record<KindId, { on: SectionId[]; extra: SectionId[] }> = {
  restaurant: { on: ['about', 'menu', 'hours', 'gallery', 'testimonials', 'faq', 'contact'], extra: ['events', 'team'] },
  shop: { on: ['about', 'products', 'hours', 'gallery', 'testimonials', 'contact'], extra: ['faq', 'events', 'team'] },
  verein: { on: ['about', 'events', 'team', 'gallery', 'faq', 'contact'], extra: ['timetable', 'testimonials'] },
  artist: { on: ['about', 'events', 'gallery', 'testimonials', 'contact'], extra: ['team', 'faq'] },
  tutor: { on: ['about', 'services', 'timetable', 'team', 'testimonials', 'faq', 'contact'], extra: ['gallery', 'hours'] },
  event: { on: ['about', 'timetable', 'team', 'gallery', 'faq', 'contact'], extra: ['testimonials'] },
  salon: { on: ['about', 'services', 'hours', 'team', 'gallery', 'testimonials', 'contact'], extra: ['faq'] },
  handy: { on: ['about', 'services', 'testimonials', 'faq', 'hours', 'contact'], extra: ['gallery', 'team'] },
  other: { on: ['about', 'services', 'gallery', 'testimonials', 'faq', 'contact'], extra: ['hours', 'team', 'events'] },
};

export function poolOf(kind: KindId): SectionId[] {
  return [...POOL[kind].on, ...POOL[kind].extra];
}

/** Where the hero's main button points, if that section is on. */
const CTA_TARGET: Record<KindId, SectionId> = {
  restaurant: 'menu',
  shop: 'products',
  verein: 'events',
  artist: 'events',
  tutor: 'services',
  event: 'timetable',
  salon: 'services',
  handy: 'services',
  other: 'services',
};

/** The logo's motif for each kind (samaj's emblem helper). */
const KIND_SHAPE: Record<KindId, EmblemShape> = {
  restaurant: 'sun',
  shop: 'star',
  verein: 'peaks',
  artist: 'star',
  tutor: 'lotus',
  event: 'sun',
  salon: 'lotus',
  handy: 'peaks',
  other: 'star',
};

// ---------------- styles ----------------

export type StyleId = 'himalaya' | 'chiya' | 'night' | 'garden' | 'editorial' | 'bazaar' | 'studio' | 'dusk';
export const STYLE_IDS: StyleId[] = ['himalaya', 'chiya', 'night', 'garden', 'editorial', 'bazaar', 'studio', 'dusk'];

const F_SANS = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "Kohinoor Devanagari", "Nirmala UI", "Noto Sans Devanagari", sans-serif`;
const F_SERIF = `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Noto Serif", "Kohinoor Devanagari", "Noto Serif Devanagari", serif`;
const F_DIDONE = `Didot, "Bodoni 72", "Bodoni MT", "Noto Serif Display", Georgia, "Kohinoor Devanagari", "Noto Serif Devanagari", serif`;
const F_ROUND = `ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", Nunito, "Varela Round", "Trebuchet MS", "Kohinoor Devanagari", "Noto Sans Devanagari", sans-serif`;
const F_GEO = `Futura, "Century Gothic", "Avenir Next", Avenir, "Trebuchet MS", "Kohinoor Devanagari", "Noto Sans Devanagari", sans-serif`;
const F_MONO = `ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", "Kohinoor Devanagari", "Noto Sans Devanagari", monospace`;
const F_HUMAN = `"Gill Sans", "Gill Sans MT", Seravek, Optima, Candara, "Noto Sans", "Kohinoor Devanagari", "Noto Sans Devanagari", sans-serif`;

export type StyleDef = {
  id: StyleId;
  dark: boolean;
  fonts: { head: string; body: string };
  /** Heading weight and letter-spacing. */
  hw: number;
  ls: string;
  /** Section labels and small headings in capitals. */
  upper: boolean;
  /** A small numbered label above each section heading. */
  kicker: boolean;
  radius: number;
  /** Button radius (a pill when large). */
  rb: number;
  hero: 'split' | 'center' | 'poster' | 'band';
  /** The illustration on the left (split only). */
  flip: boolean;
  /** 'brand': the hero is the picked colour; 'soft': a quiet tint with ink text. */
  heroMode: 'brand' | 'soft';
  cards: 'soft' | 'outline' | 'flat';
  align: 'left' | 'center';
  /** Every other section on the second surface. */
  bands: boolean;
  ill: Ill;
  base: { bg: string; surface: string; surface2: string; text: string; muted: string; border: string; primary: string; accent: string };
};

export const STYLES: StyleDef[] = [
  {
    id: 'himalaya',
    dark: false,
    fonts: { head: F_SANS, body: F_SANS },
    hw: 800,
    ls: '-0.02em',
    upper: false,
    kicker: false,
    radius: 14,
    rb: 12,
    hero: 'split',
    flip: false,
    heroMode: 'brand',
    cards: 'soft',
    align: 'left',
    bands: true,
    ill: 'flat',
    base: { bg: '#f5f8fc', surface: '#ffffff', surface2: '#e6eef9', text: '#0f1f3a', muted: '#4a5873', border: '#d4deec', primary: '#1d4b9c', accent: '#d6304a' },
  },
  {
    id: 'chiya',
    dark: false,
    fonts: { head: F_SERIF, body: F_HUMAN },
    hw: 700,
    ls: '0',
    upper: false,
    kicker: false,
    radius: 6,
    rb: 6,
    hero: 'center',
    flip: false,
    heroMode: 'soft',
    cards: 'outline',
    align: 'center',
    bands: true,
    ill: 'line',
    base: { bg: '#fbf5ec', surface: '#fffaf3', surface2: '#f3e5d0', text: '#3b1d12', muted: '#6e4a38', border: '#e2cdb2', primary: '#8e1f2b', accent: '#c98a1e' },
  },
  {
    id: 'night',
    dark: true,
    fonts: { head: F_GEO, body: F_SANS },
    hw: 800,
    ls: '-0.01em',
    upper: true,
    kicker: true,
    radius: 20,
    rb: 999,
    hero: 'poster',
    flip: false,
    heroMode: 'brand',
    cards: 'outline',
    align: 'left',
    bands: false,
    ill: 'geo',
    base: { bg: '#0d0f17', surface: '#161a26', surface2: '#1e2333', text: '#f1f3fa', muted: '#a9b1c6', border: '#2b3247', primary: '#5ad1e6', accent: '#ff5c8a' },
  },
  {
    id: 'garden',
    dark: false,
    fonts: { head: F_ROUND, body: F_ROUND },
    hw: 800,
    ls: '-0.01em',
    upper: false,
    kicker: false,
    radius: 26,
    rb: 999,
    hero: 'split',
    flip: true,
    heroMode: 'soft',
    cards: 'soft',
    align: 'left',
    bands: true,
    ill: 'blob',
    base: { bg: '#f1f8f3', surface: '#ffffff', surface2: '#dcefe2', text: '#12301f', muted: '#45604f', border: '#c8e0cf', primary: '#1f7a45', accent: '#f07a5a' },
  },
  {
    id: 'editorial',
    dark: false,
    fonts: { head: F_DIDONE, body: F_HUMAN },
    hw: 600,
    ls: '-0.01em',
    upper: true,
    kicker: true,
    radius: 0,
    rb: 0,
    hero: 'band',
    flip: false,
    heroMode: 'soft',
    cards: 'flat',
    align: 'left',
    bands: false,
    ill: 'line',
    base: { bg: '#ffffff', surface: '#ffffff', surface2: '#f2f0eb', text: '#111111', muted: '#555049', border: '#dedad2', primary: '#111111', accent: '#e0452b' },
  },
  {
    id: 'bazaar',
    dark: false,
    fonts: { head: F_GEO, body: F_SANS },
    hw: 800,
    ls: '0',
    upper: true,
    kicker: false,
    radius: 12,
    rb: 12,
    hero: 'poster',
    flip: false,
    heroMode: 'brand',
    cards: 'soft',
    align: 'center',
    bands: true,
    ill: 'stamp',
    base: { bg: '#fff6e5', surface: '#ffffff', surface2: '#ffe6b8', text: '#2a1240', muted: '#5d4a6b', border: '#f0d39a', primary: '#5b2a86', accent: '#e8337a' },
  },
  {
    id: 'studio',
    dark: false,
    fonts: { head: F_MONO, body: F_SANS },
    hw: 700,
    ls: '-0.03em',
    upper: false,
    kicker: true,
    radius: 4,
    rb: 4,
    hero: 'center',
    flip: false,
    heroMode: 'soft',
    cards: 'outline',
    align: 'left',
    bands: false,
    ill: 'geo',
    base: { bg: '#f2f2ef', surface: '#ffffff', surface2: '#e5e5df', text: '#1a1a1a', muted: '#555555', border: '#cfcfc8', primary: '#2a44c8', accent: '#ff6b2b' },
  },
  {
    id: 'dusk',
    dark: true,
    fonts: { head: F_SERIF, body: F_SANS },
    hw: 700,
    ls: '0',
    upper: false,
    kicker: false,
    radius: 16,
    rb: 999,
    hero: 'split',
    flip: true,
    heroMode: 'soft',
    cards: 'soft',
    align: 'center',
    bands: true,
    ill: 'blob',
    base: { bg: '#1a1020', surface: '#241729', surface2: '#2f1f35', text: '#f7eef6', muted: '#c4b1c3', border: '#43304a', primary: '#f2b84b', accent: '#e46a8d' },
  },
];

export const STYLE: Record<StyleId, StyleDef> = Object.fromEntries(STYLES.map((s) => [s.id, s])) as Record<StyleId, StyleDef>;

/** The colours a visitor can pick (besides the style's own and any custom one). */
export const SWATCHES: string[] = ['#dc143c', '#ea580c', '#b45309', '#15803d', '#0f766e', '#1d4ed8', '#7c3aed', '#db2777'];

export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
  /** Buttons and links; readable as text on bg, surface and surface2. */
  primary: string;
  onPrimary: string;
  /** Decoration (illustrations, rules, the quote mark); never body text. */
  accent: string;
  onAccent: string;
  /** The hero's two gradient stops and the text on it. */
  hero: string;
  hero2: string;
  onHero: string;
};

/** The WCAG minimum this page promises for every text colour pair. */
export const MIN_CONTRAST = 4.5;

function isLight(hex: string): boolean {
  return contrast(hex, '#000000') >= contrast(hex, '#ffffff');
}

/** White or black, whichever reads better on `hex` (always ≥ 4.58 : 1). */
export function bestOn(hex: string): string {
  return contrast(hex, '#ffffff') >= contrast(hex, '#000000') ? '#ffffff' : '#000000';
}

/**
 * The colour itself if it reads at `min` on every background, else the same
 * hue stepped toward black (light backgrounds) or white (dark ones) until it does.
 */
export function fitColor(hex: string, against: string[], min = MIN_CONTRAST): string {
  const c = cleanColor(hex) ?? '#1d4b9c';
  const toDark = isLight(against[0] ?? '#ffffff');
  for (let k = 0; k <= 20; k++) {
    const x = k === 0 ? c : shade(c, (toDark ? -1 : 1) * k * 0.05);
    if (against.every((b) => contrast(x, b) >= min)) return x;
  }
  return toDark ? '#000000' : '#ffffff';
}

/** A colour mixed with another (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const x = cleanColor(a) ?? '#000000';
  const y = cleanColor(b) ?? '#ffffff';
  const ch = [1, 3, 5].map((k) => {
    const p = parseInt(x.slice(k, k + 2), 16);
    const q = parseInt(y.slice(k, k + 2), 16);
    return Math.round(p + (q - p) * t)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${ch.join('')}`;
}

/** A style's colours with the visitor's colour (or its own), every text pair at ≥ 4.5 : 1. */
export function palette(style: StyleDef, color: string | null): Palette {
  const b = style.base;
  const grounds = [b.bg, b.surface, b.surface2];
  const text = fitColor(b.text, grounds);
  const muted = fitColor(b.muted, grounds);
  const primary = fitColor(color ?? b.primary, grounds);
  const onPrimary = bestOn(primary);
  const accent = b.accent;
  const onAccent = bestOn(accent);
  if (style.heroMode === 'brand') {
    // The second stop moves away from the text on it, so contrast only grows.
    const hero2 = onPrimary === '#ffffff' ? shade(primary, -0.3) : shade(primary, 0.3);
    return { ...b, text, muted, primary, onPrimary, accent, onAccent, hero: primary, hero2, onHero: onPrimary };
  }
  const hero = b.surface2;
  const hero2 = mix(b.surface2, b.bg, 0.6);
  return { ...b, text, muted, primary, onPrimary, accent, onAccent, hero, hero2, onHero: fitColor(b.text, [hero, hero2]) };
}

/** Every pair of colours the generated site puts text on, for the contrast test. */
export function textPairs(p: Palette): [string, string, string][] {
  return [
    ['text/bg', p.text, p.bg],
    ['text/surface', p.text, p.surface],
    ['text/surface2', p.text, p.surface2],
    ['muted/bg', p.muted, p.bg],
    ['muted/surface', p.muted, p.surface],
    ['muted/surface2', p.muted, p.surface2],
    ['primary/bg', p.primary, p.bg],
    ['primary/surface', p.primary, p.surface],
    ['primary/surface2', p.primary, p.surface2],
    ['onPrimary/primary', p.onPrimary, p.primary],
    ['onAccent/accent', p.onAccent, p.accent],
    ['onHero/hero', p.onHero, p.hero],
    ['onHero/hero2', p.onHero, p.hero2],
    ['bg/text (footer)', p.bg, p.text],
  ];
}

// ---------------- seeds ----------------

/** FNV-1a, 32 bit. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded random number generator (0 ≤ x < 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length) % arr.length];
}

/** `n` different items, in a seeded order. */
function pickN<T>(arr: readonly T[], n: number, r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

/** "  Chiya   GHAR " and "chiya ghar" are the same name. */
export function nameKey(s: string): string {
  return String(s ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function siteSeed(name: string, kind: KindId, city: string): number {
  return hash32(`${nameKey(name)}|${kind}|${nameKey(city)}`);
}

// ---------------- the site's state ----------------

export type EditKey = 'h' | 'b' | SectionId;
export const EDIT_KEYS: EditKey[] = ['h', 'b', ...SECTION_IDS];

export const LIMITS = { name: 40, city: 30, head: 60, sub: 140 } as const;
/** The longest #hash a share link carries (edits are dropped from the end to fit). */
export const HASH_MAX = 1800;
export const WORDS_MAX = 9999;

export type Site = {
  name: string;
  kind: KindId;
  city: string;
  /** Index into STYLES. */
  style: number;
  /** Which variant of every sentence (0 = the name's own). */
  words: number;
  /** The visitor's colour; null = the style's own. */
  color: string | null;
  /** Every section of the kind's pool, in the visitor's order. */
  order: SectionId[];
  /** The ones switched off. */
  off: SectionId[];
  /** Headings the visitor rewrote ('h' headline, 'b' the line under it). */
  edits: Partial<Record<EditKey, string>>;
};

/** A first site for a name: style and words from the name itself. */
export function newSite(name: string, kind: KindId, city = ''): Site {
  const n = cleanText(name, LIMITS.name).trim();
  const c = cleanText(city, LIMITS.city).trim();
  const k = KIND_IDS.includes(kind) ? kind : 'other';
  return {
    name: n,
    kind: k,
    city: c,
    style: siteSeed(n, k, c) % STYLES.length,
    words: 0,
    color: null,
    order: poolOf(k),
    off: [...POOL[k].extra],
    edits: {},
  };
}

export function onSections(s: Site): SectionId[] {
  return s.order.filter((id) => !s.off.includes(id));
}

function editLimit(k: EditKey): number {
  return k === 'b' ? LIMITS.sub : LIMITS.head;
}

/** Any object (a decoded link, localStorage) → a valid site, or null without a name. */
export function normalizeSite(raw: unknown): Site | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const name = cleanText(r.name, LIMITS.name).trim();
  if (!name) return null;
  const kind = KIND_IDS.includes(r.kind as KindId) ? (r.kind as KindId) : 'other';
  const pool = poolOf(kind);
  const order: SectionId[] = [];
  for (const id of Array.isArray(r.order) ? r.order : []) {
    if (pool.includes(id as SectionId) && !order.includes(id as SectionId)) order.push(id as SectionId);
  }
  for (const id of pool) if (!order.includes(id)) order.push(id);
  const offRaw = Array.isArray(r.off) ? r.off : POOL[kind].extra;
  const off = order.filter((id) => offRaw.includes(id));
  const edits: Partial<Record<EditKey, string>> = {};
  const e = (r.edits && typeof r.edits === 'object' ? r.edits : {}) as Record<string, unknown>;
  for (const k of EDIT_KEYS) {
    if (k !== 'h' && k !== 'b' && !pool.includes(k)) continue;
    const v = cleanText(e[k], editLimit(k)).trim();
    if (v) edits[k] = v;
  }
  const style = Number.isInteger(Number(r.style)) ? ((Number(r.style) % STYLES.length) + STYLES.length) % STYLES.length : 0;
  const w = Number(r.words);
  return {
    name,
    kind,
    city: cleanText(r.city, LIMITS.city).trim(),
    style,
    words: Number.isInteger(w) && w >= 0 ? Math.min(w, WORDS_MAX) : 0,
    color: cleanColor(r.color),
    order,
    off,
    edits,
  };
}

/** The site as a short query string for the link's #hash. */
export function encodeSite(s: Site): string {
  const base = (edits: [EditKey, string][]) => {
    const p = new URLSearchParams();
    p.set('n', s.name);
    p.set('k', s.kind);
    if (s.city) p.set('c', s.city);
    p.set('s', String(s.style));
    if (s.words) p.set('w', String(s.words));
    if (s.color) p.set('a', s.color.replace(/^#/, ''));
    const def = poolOf(s.kind);
    const sameOrder = s.order.join('.') === def.join('.');
    const sameOff = [...s.off].sort().join('.') === [...POOL[s.kind].extra].sort().join('.');
    if (!sameOrder || !sameOff) p.set('o', s.order.map((id) => (s.off.includes(id) ? `-${id}` : id)).join('.'));
    for (const [k, v] of edits) p.set(`e.${k}`, v);
    return p.toString();
  };
  let edits = EDIT_KEYS.filter((k) => s.edits[k]).map((k) => [k, s.edits[k]!] as [EditKey, string]);
  let out = base(edits);
  while (out.length > HASH_MAX && edits.length) {
    edits = edits.slice(0, -1);
    out = base(edits);
  }
  return out;
}

/** A link's #hash (or the bare string) → a site; null when it holds none. */
export function decodeSite(str: string): Site | null {
  const q = String(str ?? '')
    .replace(/^[#?]/, '')
    .slice(0, HASH_MAX * 3);
  if (!q || !/(^|&)n=/.test(q)) return null;
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(q);
  } catch {
    return null;
  }
  const o = p.get('o');
  const edits: Record<string, string> = {};
  for (const k of EDIT_KEYS) {
    const v = p.get(`e.${k}`);
    if (v) edits[k] = v;
  }
  return normalizeSite({
    name: p.get('n'),
    kind: p.get('k'),
    city: p.get('c'),
    style: p.get('s') ?? 0,
    words: p.get('w') ?? 0,
    color: p.get('a'),
    order: o ? o.split('.').map((x) => x.replace(/^-/, '')) : undefined,
    off: o
      ? o
          .split('.')
          .filter((x) => x.startsWith('-'))
          .map((x) => x.slice(1))
      : undefined,
    edits,
  });
}

// ----- remix moves (each returns a new site) -----

export function shuffleStyle(s: Site, dir = 1): Site {
  return { ...s, style: (((s.style + dir) % STYLES.length) + STYLES.length) % STYLES.length };
}
export function shuffleWords(s: Site): Site {
  return { ...s, words: s.words >= WORDS_MAX ? 1 : s.words + 1 };
}
export function toggleSection(s: Site, id: SectionId): Site {
  if (!s.order.includes(id)) return s;
  const off = s.off.includes(id) ? s.off.filter((x) => x !== id) : [...s.off, id];
  return { ...s, off: s.order.filter((x) => off.includes(x)) };
}
export function moveSection(s: Site, id: SectionId, by: number): Site {
  const i = s.order.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= s.order.length) return s;
  const order = [...s.order];
  order.splice(i, 1);
  order.splice(j, 0, id);
  return { ...s, order };
}
/** Drag and drop: put `id` where `target` is. */
export function placeSection(s: Site, id: SectionId, target: SectionId): Site {
  const i = s.order.indexOf(id);
  const j = s.order.indexOf(target);
  if (i < 0 || j < 0 || i === j) return s;
  return moveSection(s, id, j - i);
}
export function setEdit(s: Site, k: EditKey, v: string): Site {
  const text = cleanText(v, editLimit(k));
  const edits = { ...s.edits };
  if (text.trim()) edits[k] = text;
  else delete edits[k];
  return { ...s, edits };
}
export function setColor(s: Site, hex: string | null): Site {
  return { ...s, color: hex === null ? null : cleanColor(hex) };
}

// ---------------- generation ----------------

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export function num(v: number | string, lang: Lang): string {
  return lang === 'ne' ? String(v).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]) : String(v);
}

/**
 * A template → text. `{name}` / `{city}` are filled in one pass (so a name that
 * contains "{city}" stays as typed); `[[ … ]]` is kept only when there is a city.
 * The result is plain text — it is escaped where it goes into the HTML.
 */
export function fill(tpl: string, v: { name: string; city: string }): string {
  const s = tpl.replace(/\[\[([^\]]*)\]\]/g, (_, inner: string) => (inner.includes('{city}') && !v.city ? '' : inner));
  return s
    .replace(/\{(name|city)\}/g, (_, k: 'name' | 'city') => v[k])
    .replace(/\s+([,.!?।])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Made-up first names: [Latin, Devanagari]. */
const PEOPLE: [string, string][] = [
  ['Sita', 'सीता'],
  ['Anil', 'अनिल'],
  ['Maya', 'माया'],
  ['Bikash', 'विकास'],
  ['Anna', 'आना'],
  ['Jonas', 'योनास'],
  ['Priya', 'प्रिया'],
  ['Suman', 'सुमन'],
  ['Lena', 'लेना'],
  ['Ramesh', 'रमेश'],
  ['Kabita', 'कविता'],
  ['Tobias', 'टोबियास'],
  ['Asmita', 'अस्मिता'],
  ['Niraj', 'निरज'],
];
const INITIALS = ['K.', 'S.', 'M.', 'G.', 'B.', 'T.', 'R.', 'L.'];

const HOURS: Record<KindId, [number, number, string][][]> = {
  restaurant: [
    [[0, 0, ''], [1, 4, '11:30–22:00'], [5, 6, '12:00–23:00']],
    [[0, 3, '11:00–22:00'], [4, 5, '11:00–23:00'], [6, 6, '12:00–21:00']],
  ],
  shop: [
    [[0, 4, '10:00–19:00'], [5, 5, '10:00–16:00'], [6, 6, '']],
    [[0, 0, ''], [1, 5, '09:30–18:30'], [6, 6, '']],
  ],
  salon: [
    [[0, 0, ''], [1, 4, '09:00–19:00'], [5, 5, '09:00–15:00'], [6, 6, '']],
    [[0, 4, '10:00–20:00'], [5, 5, '09:00–16:00'], [6, 6, '']],
  ],
  handy: [
    [[0, 4, '07:30–18:00'], [5, 5, '09:00–13:00'], [6, 6, '']],
    [[0, 4, '08:00–17:00'], [5, 6, '']],
  ],
  tutor: [
    [[0, 4, '14:00–19:30'], [5, 5, '09:30–15:00'], [6, 6, '']],
    [[0, 3, '15:00–20:00'], [4, 4, '14:00–18:00'], [5, 5, '10:00–14:00'], [6, 6, '']],
  ],
  verein: [[[0, 4, '18:00–21:00'], [5, 6, '10:00–16:00']]],
  artist: [[[0, 4, '10:00–18:00'], [5, 6, '']]],
  event: [[[0, 6, '17:00–24:00']]],
  other: [
    [[0, 4, '09:00–18:00'], [5, 5, '10:00–14:00'], [6, 6, '']],
    [[0, 3, '09:00–17:00'], [4, 4, '09:00–15:00'], [5, 6, '']],
  ],
};

export type Gen = {
  seed: number;
  lang: Lang;
  style: StyleDef;
  pal: Palette;
  name: string;
  city: string;
  kind: KindId;
  initials: string;
  hero: { headline: string; sub: string; cta: string; ctaHref: string; cta2: string; cta2Href: string };
  nav: { id: SectionId; label: string }[];
  sections: GenSection[];
  /** The generated words behind each editable heading (the edit panel's placeholders). */
  defaults: Record<EditKey, string>;
};

export type GenSection =
  | { id: 'about'; heading: string; p1: string; p2: string; highlights: [IconId, string][] }
  | { id: 'menu'; heading: string; groups: { title: string; items: [string, string][] }[]; note: string }
  | { id: 'products' | 'services'; heading: string; items: [string, string][]; note: string }
  | { id: 'hours'; heading: string; rows: [string, string][]; note: string }
  | { id: 'gallery'; heading: string; tiles: string[] }
  | { id: 'team'; heading: string; people: { name: string; role: string; avatar: number }[] }
  | { id: 'timetable'; heading: string; rows: [string, string][] }
  | { id: 'events'; heading: string; items: { day: string; month: string; title: string; line: string }[] }
  | { id: 'testimonials'; heading: string; items: { text: string; by: string }[] }
  | { id: 'faq'; heading: string; items: [string, string][] }
  | { id: 'contact'; heading: string; lead: string; address: string; email: string };

function headingsFor(id: SectionId, kw: KindWords, w: SiteWords): string[] {
  return kw.heads?.[id] ?? w.heads[id];
}

/** Everything the site says and shows, before it becomes HTML. */
export function generate(site: Site, lang: Lang, opts: { month0?: number } = {}): Gen {
  const w = WORDS[lang];
  const kw = w.kinds[site.kind];
  const seed = siteSeed(site.name, site.kind, site.city);
  const vars = { name: site.name, city: site.city };
  // Every section has its own stream, so switching one off or moving it never
  // rewrites another; "shuffle words" moves them all.
  const rs = (key: string) => rng(hash32(`${seed}:${site.words}:${key}`));
  const f = (t: string) => fill(t, vars);
  const style = STYLES[site.style] ?? STYLES[0];
  const pal = palette(style, site.color);
  const pool = poolOf(site.kind);
  const on = onSections(site);

  const defaults = {} as Record<EditKey, string>;
  const rh = rs('hero');
  defaults.h = f(pick(kw.hero, rh));
  defaults.b = f(pick(kw.sub, rh));
  for (const id of SECTION_IDS) defaults[id] = pool.includes(id) ? f(pick(headingsFor(id, kw, w), rs(`h:${id}`))) : '';
  const head = (id: SectionId) => site.edits[id] || defaults[id];

  const target = on.includes(CTA_TARGET[site.kind]) ? CTA_TARGET[site.kind] : on.find((x) => x !== 'about' && x !== 'contact') ?? on[0];
  const month0 = Number.isInteger(opts.month0) ? ((opts.month0! % 12) + 12) % 12 : 0;

  const sections: GenSection[] = [];
  for (const id of on) {
    const r = rs(id);
    const heading = head(id);
    switch (id) {
      case 'about':
        sections.push({ id, heading, p1: f(pick(kw.about, r)), p2: f(pick(kw.about2, r)), highlights: pickN(kw.highlights, 3, r).map(([i, t]) => [i, f(t)]) });
        break;
      case 'menu':
        sections.push({
          id,
          heading,
          groups: w.menu.groups.map(([title, items]) => ({ title, items: pickN(items, 3, r) })),
          note: pick(w.menu.note, r),
        });
        break;
      case 'products':
        sections.push({ id, heading, items: pickN(w.products.items, 6, r), note: pick(w.products.note, r) });
        break;
      case 'services': {
        const list = kw.services ?? w.kinds.other.services!;
        sections.push({ id, heading, items: pickN(list, r() < 0.5 ? 4 : 6, r), note: pick(w.servicesNote, r) });
        break;
      }
      case 'hours': {
        const plan = pick(HOURS[site.kind], r);
        const rows = plan.map(([a, b, t]) => [a === b ? w.hours.days[a] : `${w.hours.days[a]}–${w.hours.days[b]}`, t ? num(t, lang) : w.hours.closed] as [string, string]);
        sections.push({ id, heading, rows, note: pick(w.hours.note, r) });
        break;
      }
      case 'gallery':
        sections.push({ id, heading, tiles: pickN(kw.gallery, 6, r).map(f) });
        break;
      case 'team': {
        const n = r() < 0.5 ? 3 : 4;
        const people = pickN(PEOPLE, n, r);
        sections.push({
          id,
          heading,
          people: people.map(([la, ne], i) => ({ name: lang === 'ne' ? ne : la, role: kw.roles[i % kw.roles.length], avatar: Math.floor(r() * 64) })),
        });
        break;
      }
      case 'timetable':
        sections.push({ id, heading, rows: (kw.timetable ?? w.kinds.verein.timetable!).map(([a, b]) => [a, f(b)] as [string, string]) });
        break;
      case 'events': {
        const list = kw.events ?? w.kinds.other.events!;
        const picked = pickN(list, 3, r);
        let day = 3 + Math.floor(r() * 10);
        sections.push({
          id,
          heading,
          items: picked.map(([title, line], i) => {
            day = ((day + 9 + Math.floor(r() * 12)) % 27) + 1;
            return { day: num(day, lang), month: w.months[(month0 + 1 + i) % 12], title: f(title), line: f(line) };
          }),
        });
        break;
      }
      case 'testimonials': {
        const people = pickN(PEOPLE, 3, r);
        sections.push({
          id,
          heading,
          items: pickN(kw.says, 3, r).map((text, i) => {
            const [la, ne] = people[i];
            const by = lang === 'ne' ? ne : `${la} ${pick(INITIALS, r)}`;
            return { text: f(text), by: site.city ? `${by}, ${site.city}` : by };
          }),
        });
        break;
      }
      case 'faq':
        sections.push({ id, heading, items: pickN(kw.faq, 3, r).map(([q, a]) => [f(q), f(a)] as [string, string]) });
        break;
      case 'contact': {
        const street = pick(w.contact.street, r);
        sections.push({
          id,
          heading,
          lead: f(pick(w.contact.lead, r)),
          address: site.city ? `${street}, ${site.city}` : street,
          email: `hallo@${slug(site.name, 'my-site')}.demo`,
        });
        break;
      }
    }
  }

  return {
    seed,
    lang,
    style,
    pal,
    name: site.name,
    city: site.city,
    kind: site.kind,
    initials: initialsFrom(site.name) || '✦',
    hero: {
      headline: site.edits.h || defaults.h,
      sub: site.edits.b || defaults.b,
      cta: kw.cta,
      ctaHref: `#${target}`,
      cta2: w.cta2,
      cta2Href: on.includes('contact') ? '#contact' : '',
    },
    nav: on.filter((id) => id !== 'contact').slice(0, 4).map((id) => ({ id, label: w.nav[id] })),
    sections,
    defaults,
  };
}

// ---------------- the HTML ----------------

/** HTML-escape text for an element or a quoted attribute. */
export function esc(s: string): string {
  return escapeXml(String(s ?? ''));
}

/** The site's pretend web address: "chiya-ghar.martnepali.demo". */
export function demoHost(name: string): string {
  return `${slug(name, 'your-name')}.martnepali.demo`;
}

/** The downloaded file's name. */
export function fileName(name: string): string {
  return `${slug(name, 'my-website')}-website-demo.html`;
}

/** The narration's steps: three for the look, one per section, then done. */
export const STEP_MS = 850;
export const INTRO_STEPS = ['palette', 'logo', 'welcome'] as const;
export type StepKey = (typeof INTRO_STEPS)[number] | SectionId | 'done';
export function timeline(sections: SectionId[]): { key: StepKey; at: number }[] {
  const keys: StepKey[] = [...INTRO_STEPS, ...sections];
  return [...keys.map((key, i) => ({ key, at: i * STEP_MS })), { key: 'done' as StepKey, at: keys.length * STEP_MS + 450 }];
}

/** The CSP every generated page carries: no scripts, no requests, only its own inline CSS and data: images. */
export const SITE_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

function css(st: StyleDef, p: Palette): string {
  const vars = [
    `--bg:${p.bg}`,
    `--surface:${p.surface}`,
    `--surface2:${p.surface2}`,
    `--text:${p.text}`,
    `--muted:${p.muted}`,
    `--border:${p.border}`,
    `--primary:${p.primary}`,
    `--on-primary:${p.onPrimary}`,
    `--accent:${p.accent}`,
    `--on-accent:${p.onAccent}`,
    `--hero:${p.hero}`,
    `--hero2:${p.hero2}`,
    `--on-hero:${p.onHero}`,
    `--head:${st.fonts.head}`,
    `--body:${st.fonts.body}`,
    `--hw:${st.hw}`,
    `--ls:${st.ls}`,
    `--r:${st.radius}px`,
    `--rb:${st.rb}px`,
    `--step:${STEP_MS}ms`,
  ].join(';');
  return `:root{${vars}}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--text);font:400 17px/1.6 var(--body);overflow-x:hidden}
svg{display:block;max-width:100%;height:auto}
a{color:var(--primary);text-underline-offset:3px}
a:focus-visible,summary:focus-visible{outline:3px solid var(--primary);outline-offset:3px}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
h1,h2,h3{font-family:var(--head);font-weight:var(--hw);letter-spacing:var(--ls);line-height:1.12;overflow-wrap:break-word;hyphens:auto}
.up h2,.up .kicker,.up .nav-links a,.up .tag{text-transform:uppercase;letter-spacing:.06em}
.nav{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--border)}
.nav .wrap{display:flex;align-items:center;gap:18px;min-height:66px}
.brand{display:flex;align-items:center;gap:10px;min-width:0;color:var(--text);text-decoration:none;font-family:var(--head);font-weight:var(--hw);font-size:1.08rem}
.brand .logo{width:42px;height:42px;flex:none}
.brand .logo svg{width:42px;height:42px}
.brand .bn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-links{display:flex;gap:22px;margin-left:auto}
.nav-links a{color:var(--text);text-decoration:none;font-size:.95rem}
.nav-links a:hover{color:var(--primary)}
.nav .btn{margin-left:6px;min-height:40px;padding:0 16px;font-size:.92rem}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:var(--rb);background:var(--primary);color:var(--on-primary);border:2px solid var(--primary);font-weight:700;text-decoration:none;white-space:nowrap}
.btn.ghost{background:transparent;color:var(--text);border-color:var(--text)}
.hero{background:linear-gradient(135deg,var(--hero),var(--hero2));color:var(--on-hero);padding:76px 0 84px;overflow:hidden}
.hero .wrap{display:grid;gap:44px;align-items:center}
.hero h1{font-size:clamp(2.1rem,5.4vw,3.9rem)}
.hero .sub{font-size:1.16rem;margin-top:18px;max-width:34em}
.hero .ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.brandhero .hero .btn{background:var(--on-hero);color:var(--hero);border-color:var(--on-hero)}
.hero .btn.ghost{background:transparent;color:var(--on-hero);border-color:var(--on-hero)}
.hero .city{display:inline-block;font-size:.85rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;padding:4px 12px;border:1.5px solid currentColor;border-radius:var(--rb)}
.art{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
.art svg{width:100%}
.big-logo{width:96px;height:96px;margin-bottom:20px}
.big-logo svg{width:96px;height:96px}
@media (min-width:860px){.h-split .hero .wrap{grid-template-columns:1.1fr .9fr}.flip .art{order:-1}}
.h-center .hero{text-align:center}
.h-center .hero .wrap{justify-items:center}
.h-center .hero .sub{margin-left:auto;margin-right:auto}
.h-center .hero .ctas{justify-content:center}
.h-center .big-logo{margin:0 auto 20px}
.h-center .art{max-width:560px;width:100%}
.h-poster .hero{padding:96px 0}
.h-poster .hero h1{font-size:clamp(2.6rem,7.6vw,5.6rem);line-height:1.02}
@media (min-width:860px){.h-poster .hero .wrap{grid-template-columns:1.5fr .7fr}}
.h-band .hero{padding:0 0 72px}
.h-band .band{border-bottom:1px solid var(--text);padding:14px 0;margin-bottom:56px;font-size:.8rem;letter-spacing:.24em;text-transform:uppercase;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.h-band .hero h1{font-size:clamp(2.4rem,6.6vw,5rem);font-style:italic}
@media (min-width:860px){.h-band .hero .wrap{grid-template-columns:1.25fr .75fr}}
.h-band .art{box-shadow:12px 12px 0 var(--accent)}
.sec{padding:76px 0}
.bands .sec:nth-of-type(even){background:var(--surface2)}
.rules .sec+.sec{border-top:1px solid var(--border)}
.sec h2{font-size:clamp(1.7rem,3.6vw,2.6rem);margin-bottom:12px}
.kicker{font-size:.8rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--primary);margin-bottom:10px}
.lead{color:var(--muted);max-width:40em;font-size:1.06rem}
.center .sec-head{text-align:center}
.center .sec-head .lead{margin:0 auto}
.grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));margin-top:34px}
.card{background:var(--surface);border-radius:var(--r);padding:24px}
.c-soft .card{box-shadow:0 14px 34px -22px rgba(0,0,0,.45)}
.c-outline .card{border:1.5px solid var(--border)}
.c-flat .card{background:transparent;border-radius:0;padding:0 0 20px;border-bottom:1px solid var(--text)}
.card h3{font-size:1.14rem;margin-bottom:6px}
.card p{color:var(--muted)}
.about{display:grid;gap:36px}
@media (min-width:860px){.about{grid-template-columns:1.2fr .8fr}}
.about p+p{margin-top:14px}
.hl{list-style:none;display:grid;gap:14px;align-content:start}
.hl li{display:flex;gap:14px;align-items:center;background:var(--surface);border-radius:var(--r);padding:14px 16px;font-weight:600}
.c-outline .hl li{border:1.5px solid var(--border)}
.c-flat .hl li{background:transparent;padding:6px 0;border-bottom:1px solid var(--border);border-radius:0}
.ico{width:40px;height:40px;flex:none;border-radius:50%;background:var(--surface2);display:grid;place-items:center}
.ico svg{width:22px;height:22px}
.menu{display:grid;gap:36px;margin-top:34px}
@media (min-width:760px){.menu{grid-template-columns:repeat(3,1fr)}}
.menu h3{font-size:1.2rem;padding-bottom:10px;margin-bottom:6px;border-bottom:2px solid var(--accent)}
.dish{padding:12px 0;border-bottom:1px dashed var(--border)}
.dish b{display:block;font-family:var(--head)}
.dish span{color:var(--muted);font-size:.95rem}
.note{margin-top:26px;color:var(--muted);font-style:italic}
.center .note{text-align:center}
.hours{width:100%;max-width:520px;border-collapse:collapse;margin-top:28px}
.center .hours{margin-left:auto;margin-right:auto}
.hours th,.hours td{text-align:left;padding:13px 4px;border-bottom:1px solid var(--border)}
.hours td{text-align:right;font-variant-numeric:tabular-nums}
.gal{display:grid;gap:16px;grid-template-columns:repeat(3,1fr);margin-top:34px}
@media (max-width:640px){.gal{grid-template-columns:repeat(2,1fr)}}
.gal figure{border-radius:var(--r);overflow:hidden;background:var(--surface);border:1px solid var(--border)}
.gal svg,.av svg{width:100%}
.gal figcaption{padding:10px 12px;font-size:.9rem;color:var(--muted)}
.team .card{text-align:center}
.av{width:104px;height:104px;margin:0 auto 14px;border-radius:50%;overflow:hidden}
.tt{list-style:none;margin-top:30px;max-width:760px}
.center .tt{margin-left:auto;margin-right:auto}
.tt li{display:grid;grid-template-columns:minmax(120px,210px) 1fr;gap:16px;padding:16px 0;border-bottom:1px solid var(--border)}
.tt b{color:var(--primary);font-variant-numeric:tabular-nums}
@media (max-width:520px){.tt li{grid-template-columns:1fr;gap:2px}}
.ev{list-style:none;display:grid;gap:16px;margin-top:32px}
.ev li{display:flex;gap:18px;align-items:center;background:var(--surface);border-radius:var(--r);padding:16px}
.c-outline .ev li{border:1.5px solid var(--border)}
.c-flat .ev li{background:transparent;border-bottom:1px solid var(--text);border-radius:0;padding:14px 0}
.date{flex:none;width:72px;height:72px;border-radius:var(--r);background:var(--primary);color:var(--on-primary);display:grid;place-content:center;text-align:center;line-height:1.05}
.date b{font-size:1.6rem;font-family:var(--head)}
.date span{font-size:.8rem;font-weight:700;text-transform:uppercase}
.ev h3{font-size:1.12rem}
.ev p{color:var(--muted)}
.say{position:relative;padding-top:40px}
.say:before{content:"\\201C";position:absolute;top:2px;left:20px;font:700 3.6rem/1 Georgia,serif;color:var(--accent)}
.c-flat .say:before{left:0}
.say p{color:var(--text);font-size:1.04rem}
.say figcaption{margin-top:14px;color:var(--muted);font-size:.92rem;font-weight:600}
.faq{max-width:780px;margin-top:30px}
.center .faq{margin-left:auto;margin-right:auto}
.faq details{border-bottom:1px solid var(--border);padding:4px 0}
.faq summary{cursor:pointer;font-weight:700;padding:14px 0;font-family:var(--head)}
.faq details p{color:var(--muted);padding:0 0 16px}
.contact{display:grid;gap:28px;margin-top:32px}
@media (min-width:860px){.contact{grid-template-columns:.9fr 1.1fr}}
.contact dl{display:grid;gap:4px}
.contact dt{font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:12px}
.contact dd{font-size:1.08rem}
.contact .ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}
.map{border-radius:var(--r);overflow:hidden;border:1px solid var(--border);background:var(--surface2)}
.map p{padding:10px 14px;font-size:.88rem;color:var(--muted);background:var(--surface)}
.foot{background:var(--text);color:var(--bg);padding:44px 0 36px}
.foot .wrap{display:grid;gap:14px}
.foot .fb{display:flex;align-items:center;gap:10px;font-family:var(--head);font-weight:var(--hw);font-size:1.1rem}
.foot a{color:var(--bg)}
.wm{display:inline-block;justify-self:start;margin-top:8px;padding:8px 14px;border:1.5px dashed var(--bg);border-radius:var(--rb);font-size:.9rem;font-weight:700}
.small{font-size:.86rem}
@media (max-width:760px){.nav-links{display:none}.nav .btn{margin-left:auto}.sec{padding:56px 0}.hero{padding:52px 0 60px}.h-poster .hero{padding:64px 0}.wrap{padding:0 18px}body{font-size:16px}}
@media (max-width:420px){.nav .btn{display:none}}
@keyframes rise{from{opacity:0;transform:translateY(34px)}to{opacity:1;transform:none}}
@keyframes pop{0%{opacity:0;transform:scale(.4) rotate(-40deg)}70%{transform:scale(1.08) rotate(4deg)}100%{opacity:1;transform:none}}
@keyframes wash{from{opacity:0}to{opacity:1}}
.gen .a{animation:rise .75s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i) * var(--step))}
.gen .nav,.gen .hero{animation:wash .7s ease-out both}
.gen .logo,.gen .big-logo{animation:pop .8s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--step)}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.gen .a,.gen .nav,.gen .hero,.gen .logo,.gen .big-logo{animation:none}}`;
}

export type HtmlOpts = {
  /** Play the build: each part slides in on the narration's beat. */
  animate?: boolean;
  /** Which month the "coming up" dates start after (0 = January). */
  month0?: number;
  /** A marker that forces the preview to reload (a replay). */
  run?: number;
};

export type FooterWords = { made: string; note: string; top: string; link: string };

/**
 * The whole generated website as one static HTML document: escaped text,
 * inline CSS and SVG, a CSP that allows nothing else, no script anywhere.
 */
export function siteHtml(site: Site, lang: Lang, opts: HtmlOpts = {}): string {
  const g = generate(site, lang, { month0: opts.month0 });
  const w = WORDS[lang];
  const st = g.style;
  const p = g.pal;
  const e = esc;
  const ill = st.ill;
  const emblem = (id: string, size: number) =>
    emblemSvg(
      {
        initials: g.initials,
        shape: KIND_SHAPE[g.kind],
        ring: g.name,
        look: 'himalaya',
        idPrefix: id,
        colors: { primary: p.primary, onPrimary: p.onPrimary, accent: p.accent, inner: bestOn(p.primary) === '#ffffff' ? shade(p.primary, -0.55) : shade(p.primary, -0.7), light: '#ffffff' },
      },
      size
    );
  const artPal = { primary: p.primary, accent: p.accent, text: p.text, surface: p.surface, surface2: p.surface2, bg: p.bg, muted: p.muted };

  const bodyClass = [
    `h-${st.hero}`,
    st.flip ? 'flip' : '',
    st.heroMode === 'brand' ? 'brandhero' : '',
    `c-${st.cards}`,
    st.align === 'center' ? 'center' : '',
    st.bands ? 'bands' : 'rules',
    st.upper ? 'up' : '',
    opts.animate ? 'gen' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const secHead = (i: number, id: SectionId, heading: string, lead?: string) =>
    `<div class="sec-head">${st.kicker ? `<p class="kicker">${num(String(i + 1).padStart(2, '0'), lang)} — ${e(w.nav[id])}</p>` : ''}<h2>${e(heading)}</h2>${lead ? `<p class="lead">${e(lead)}</p>` : ''}</div>`;

  const parts: string[] = [];
  g.sections.forEach((s, i) => {
    const step = INTRO_STEPS.length + i;
    let inner = '';
    switch (s.id) {
      case 'about':
        inner =
          `<div class="about"><div>${secHead(i, s.id, s.heading)}<p class="lead">${e(s.p1)}</p><p class="lead">${e(s.p2)}</p></div>` +
          `<ul class="hl">${s.highlights.map(([ic, t]) => `<li><span class="ico" aria-hidden="true">${iconSvg(ic, p.primary)}</span>${e(t)}</li>`).join('')}</ul></div>`;
        break;
      case 'menu':
        inner =
          secHead(i, s.id, s.heading) +
          `<div class="menu">${s.groups
            .map((gr) => `<div><h3>${e(gr.title)}</h3>${gr.items.map(([n, d]) => `<p class="dish"><b>${e(n)}</b><span>${e(d)}</span></p>`).join('')}</div>`)
            .join('')}</div><p class="note">${e(s.note)}</p>`;
        break;
      case 'products':
      case 'services':
        inner =
          secHead(i, s.id, s.heading) +
          `<div class="grid">${s.items
            .map(([n, d], k) => `<article class="card"><span class="ico" aria-hidden="true">${iconSvg(itemIcon(g.kind, s.id, k), p.primary)}</span><h3 style="margin-top:14px">${e(n)}</h3><p>${e(d)}</p></article>`)
            .join('')}</div><p class="note">${e(s.note)}</p>`;
        break;
      case 'hours':
        inner =
          secHead(i, s.id, s.heading) +
          `<table class="hours"><tbody>${s.rows.map(([d, t]) => `<tr><th scope="row">${e(d)}</th><td>${e(t)}</td></tr>`).join('')}</tbody></table><p class="note">${e(s.note)}</p>`;
        break;
      case 'gallery':
        inner =
          secHead(i, s.id, s.heading) +
          `<div class="gal">${s.tiles.map((cap, k) => `<figure>${tileArt(g.kind, k + (g.seed % 5), ill, artPal)}<figcaption>${e(cap)}</figcaption></figure>`).join('')}</div>`;
        break;
      case 'team':
        inner =
          secHead(i, s.id, s.heading) +
          `<div class="grid team">${s.people.map((m) => `<article class="card"><div class="av" aria-hidden="true">${avatarSvg(m.avatar, artPal)}</div><h3>${e(m.name)}</h3><p>${e(m.role)}</p></article>`).join('')}</div>`;
        break;
      case 'timetable':
        inner = secHead(i, s.id, s.heading) + `<ul class="tt">${s.rows.map(([a, b]) => `<li><b>${e(a)}</b><span>${e(b)}</span></li>`).join('')}</ul>`;
        break;
      case 'events':
        inner =
          secHead(i, s.id, s.heading) +
          `<ul class="ev">${s.items
            .map((x) => `<li><p class="date"><b>${e(x.day)}</b><span>${e(x.month)}</span></p><div><h3>${e(x.title)}</h3><p>${e(x.line)}</p></div></li>`)
            .join('')}</ul>`;
        break;
      case 'testimonials':
        inner =
          secHead(i, s.id, s.heading) +
          `<div class="grid">${s.items.map((x) => `<figure class="card say"><blockquote><p>${e(x.text)}</p></blockquote><figcaption>— ${e(x.by)}</figcaption></figure>`).join('')}</div>`;
        break;
      case 'faq':
        inner = secHead(i, s.id, s.heading) + `<div class="faq">${s.items.map(([q, a]) => `<details><summary>${e(q)}</summary><p>${e(a)}</p></details>`).join('')}</div>`;
        break;
      case 'contact':
        inner =
          secHead(i, s.id, s.heading, s.lead) +
          `<div class="contact"><div><dl><dt>${e(w.contact.address)}</dt><dd>${e(s.address)}</dd><dt>${e(w.contact.email)}</dt><dd>${e(s.email)}</dd></dl>` +
          `<p class="ctas"><a class="btn" href="#top">${e(w.contact.write)}</a><a class="btn ghost" href="#top">${e(w.contact.visit)}</a></p></div>` +
          `<figure class="map">${mapSvg(artPal)}<figcaption><p>${e(w.contact.mapLabel)}</p></figcaption></figure></div>`;
        break;
    }
    parts.push(`<section id="${s.id}" class="sec a" style="--i:${step}"><div class="wrap">${inner}</div></section>`);
  });

  const h = g.hero;
  const cityTag = g.city ? `<p class="city">${e(g.city)}</p>` : '';
  const art = `<div class="art a" style="--i:1" aria-hidden="true">${heroArt(g.kind, ill, artPal)}</div>`;
  const heroText =
    `<div class="a" style="--i:2">` +
    (st.hero === 'center' ? `<div class="big-logo" aria-hidden="true">${emblem('ins-hero', 96)}</div>` : '') +
    cityTag +
    `<h1>${e(h.headline)}</h1><p class="sub">${e(h.sub)}</p>` +
    `<p class="ctas"><a class="btn" href="${h.ctaHref}">${e(h.cta)}</a>${h.cta2Href ? `<a class="btn ghost" href="${h.cta2Href}">${e(h.cta2)}</a>` : ''}</p></div>`;
  // The editorial style's thin band (name · city) sits above the hero's grid on its own row.
  const band = st.hero === 'band' ? `<div class="wrap" style="display:block"><p class="band"><span>${e(g.name)}</span><span>${e(g.city || w.kindNoun[g.kind])}</span></p></div>` : '';
  const heroHtml = `<header class="hero" id="top">${band}<div class="wrap">${heroText}${art}</div></header>`;

  const nav =
    `<nav class="nav" aria-label="${e(w.navLabel)}"><div class="wrap"><a class="brand" href="#top"><span class="logo" aria-hidden="true">${emblem('ins-nav', 42)}</span><span class="bn">${e(g.name)}</span></a>` +
    `<div class="nav-links">${g.nav.map((n) => `<a href="#${n.id}">${e(n.label)}</a>`).join('')}</div>` +
    (h.cta2Href ? `<a class="btn" href="#contact">${e(w.nav.contact)}</a>` : '') +
    `</div></nav>`;

  const foot =
    `<footer class="foot"><div class="wrap"><p class="fb"><span aria-hidden="true">${emblem('ins-foot', 34)}</span>${e(g.name)}${g.city ? ` · ${e(g.city)}` : ''}</p>` +
    `<p class="small">${e(w.footer.note)}</p>` +
    `<p class="wm">${e(w.footer.made)} · <a href="https://www.martnepali.com/work/instant">martnepali.com/work/instant</a></p>` +
    `<p class="small"><a href="#top">${e(w.footer.top)}</a></p></div></footer>`;

  return (
    `<!doctype html><html lang="${lang}" translate="no"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta http-equiv="Content-Security-Policy" content="${SITE_CSP}">` +
    `<meta name="generator" content="MartNepali demo · /work/instant">` +
    `<title>${e(g.name)}</title><style>${css(st, p)}</style></head>` +
    `<body class="${bodyClass}"><!-- Demo by MartNepali${opts.run ? ` · ${opts.run}` : ''} -->` +
    nav +
    `<main>${heroHtml}${parts.join('')}</main>` +
    foot +
    `</body></html>`
  );
}

/** The little icon on a product / service card. */
function itemIcon(kind: KindId, id: SectionId, k: number): IconId {
  const sets: Partial<Record<KindId, IconId[]>> = {
    shop: ['leaf', 'cup', 'bowl', 'star', 'bag', 'heart'],
    tutor: ['book', 'globe', 'flag', 'chat', 'music', 'check'],
    salon: ['scissors', 'spark', 'heart', 'leaf', 'star', 'people'],
    handy: ['home', 'check', 'spark', 'clock', 'leaf', 'star'],
  };
  const set = sets[kind] ?? (id === 'products' ? sets.shop! : ['spark', 'people', 'check', 'heart', 'globe', 'star']);
  return set[k % set.length];
}

// ---------------- the brief for /contact ----------------

export type BriefWords = {
  opening: (kind: string, name: string, city: string) => string;
  kinds: Record<KindId, string>;
  style: (name: string) => string;
  sections: (list: string) => string;
  colour: (hex: string) => string;
  draft: string;
};

/**
 * What "Make it real — Kura garau" writes into the contact chat (unsent): the
 * name, the kind, the city, the style and sections they kept, and a link back
 * to the draft. Never longer than the chat takes; the link goes first if it
 * would be, then sections from the end.
 */
export function instantBrief(s: Site, w: BriefWords, styleName: string, sectionName: (id: SectionId) => string): string {
  const head = w.opening(w.kinds[s.kind], s.name, s.city);
  const plain = { ...s, edits: {} };
  const link = `${w.draft} /work/instant#${encodeSite(plain)}`;
  const build = (secs: SectionId[], withLink: boolean) =>
    [head, w.style(styleName), secs.length ? w.sections(secs.map(sectionName).join(', ')) : '', s.color ? w.colour(s.color) : '', withLink ? link : ''].filter(Boolean).join(' ');
  let secs = onSections(s);
  let text = build(secs, true);
  if (Array.from(text).length > BRIEF_MAX) text = build(secs, false);
  while (Array.from(text).length > BRIEF_MAX && secs.length > 1) {
    secs = secs.slice(0, -1);
    text = build(secs, false);
  }
  return cleanBrief(text);
}

export function contactHref(brief: string): string {
  return `/contact?intent=website&brief=${encodeURIComponent(brief)}`;
}

// ---------------- saved state ----------------

export const STORE_KEY = 'mn-demo:instant';
export type Device = 'desktop' | 'tablet' | 'phone';
export const DEVICES: { id: Device; width: number }[] = [
  { id: 'desktop', width: 1280 },
  { id: 'tablet', width: 820 },
  { id: 'phone', width: 390 },
];

export type Saved = { v: 1; site: string; device: Device };
export function cleanSaved(raw: unknown): { site: Site | null; device: Device } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const device = DEVICES.some((d) => d.id === r.device) ? (r.device as Device) : 'desktop';
  return { site: typeof r.site === 'string' ? decodeSite(r.site) : null, device };
}
