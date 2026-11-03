// The rules behind the /work/samaj demo — a website kit for a Nepali
// association (Verein). Pure on purpose: no React, no DOM, no clock of its own
// (callers pass `now`), so tests/samajSite.test.ts can play every story.
//
// What lives here: the three looks (colours checked for contrast in the
// tests), the logo maker's emblem as an SVG string, the programme calendar,
// the multi-step membership form's validation, the confirmation a visitor
// downloads, the members' poll and RSVPs, and the one localStorage state with
// its normalize(). The association, its people and its dates are all made up;
// words for the screen live in content.ts.
//
// No money anywhere: no fees, dues, bank details or amounts — not even made-up
// ones (the studio's operator is a student; see app/studio/page.tsx).

import { adToBs, formatBs, formatBsNe } from '@/lib/patro';

export type Lang = 'en' | 'de' | 'ne';
export const LANG_IDS: Lang[] = ['en', 'de', 'ne'];

export const ORG = {
  name: 'Saathi Samaj Main-Neckar e.V.',
  nameNe: 'साथी समाज माइन-नेकार',
  short: 'Saathi Samaj',
  founded: 2012,
} as const;

// ---------------- looks ----------------

export type LookId = 'himalaya' | 'dhaka' | 'modern';
export const LOOK_IDS: LookId[] = ['himalaya', 'dhaka', 'modern'];

export type Look = {
  id: LookId;
  dark: boolean;
  /** Headings in a serif (Dhaka) or the sans (the others). */
  serif: boolean;
  radius: number;
  colors: {
    bg: string;
    surface: string;
    surface2: string;
    text: string;
    muted: string;
    border: string;
    /** Buttons, links, the emblem's ground. Readable as text on bg/surface. */
    primary: string;
    onPrimary: string;
    /** Highlights: badges, the emblem's motif, today's dot. */
    accent: string;
    onAccent: string;
    heroFrom: string;
    heroTo: string;
    onHero: string;
  };
};

export const LOOKS: Record<LookId, Look> = {
  himalaya: {
    id: 'himalaya',
    dark: false,
    serif: false,
    radius: 14,
    colors: {
      bg: '#f4f7fb',
      surface: '#ffffff',
      surface2: '#e7eef8',
      text: '#0f2140',
      muted: '#475672',
      border: '#d3deee',
      primary: '#1d4b9c',
      onPrimary: '#ffffff',
      accent: '#c41e3a',
      onAccent: '#ffffff',
      heroFrom: '#12336e',
      heroTo: '#245bb0',
      onHero: '#ffffff',
    },
  },
  dhaka: {
    id: 'dhaka',
    dark: false,
    serif: true,
    radius: 6,
    colors: {
      bg: '#fbf3e8',
      surface: '#fffaf2',
      surface2: '#f5e4cf',
      text: '#3a1310',
      muted: '#6b4436',
      border: '#e6cdb0',
      primary: '#9b1b27',
      onPrimary: '#ffffff',
      accent: '#d4a237',
      onAccent: '#2a1205',
      heroFrom: '#6e0d18',
      heroTo: '#a3202c',
      onHero: '#fff4dc',
    },
  },
  modern: {
    id: 'modern',
    dark: true,
    serif: false,
    radius: 18,
    colors: {
      bg: '#0c0e13',
      surface: '#151920',
      surface2: '#1d222c',
      text: '#eef1f7',
      muted: '#a6afc0',
      border: '#2a303c',
      primary: '#7aaeff',
      onPrimary: '#0a1222',
      accent: '#ff7a66',
      onAccent: '#1d0905',
      heroFrom: '#0f131b',
      heroTo: '#1c2638',
      onHero: '#ffffff',
    },
  },
};

export function asLook(v: unknown): LookId {
  return LOOK_IDS.includes(v as LookId) ? (v as LookId) : 'himalaya';
}

/** The CSS custom properties a look sets on the site's root element. */
export function lookVars(id: LookId): Record<string, string> {
  const l = LOOKS[id];
  const c = l.colors;
  return {
    '--sj-bg': c.bg,
    '--sj-surface': c.surface,
    '--sj-surface2': c.surface2,
    '--sj-text': c.text,
    '--sj-muted': c.muted,
    '--sj-border': c.border,
    '--sj-primary': c.primary,
    '--sj-on-primary': c.onPrimary,
    '--sj-accent': c.accent,
    '--sj-on-accent': c.onAccent,
    '--sj-hero-from': c.heroFrom,
    '--sj-hero-to': c.heroTo,
    '--sj-on-hero': c.onHero,
    '--sj-radius': `${l.radius}px`,
  };
}

function channel(hex: string, i: number): number {
  const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}
/** WCAG contrast ratio of two #rrggbb colours (1–21). */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// ---------------- logo maker ----------------

export type EmblemShape = 'peaks' | 'lotus' | 'sun' | 'star';
export const EMBLEM_SHAPES: EmblemShape[] = ['peaks', 'lotus', 'sun', 'star'];
export const RING_MAX = 44;

function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment);
  return Array.from(s);
}

/** Letters only (Latin or Devanagari), upper-cased, at most 3 characters as a reader counts them. */
export function cleanInitials(s: string): string {
  const kept = String(s ?? '')
    .normalize('NFC')
    .replace(/[^A-Za-zÀ-ɏऀ-ॿ]/g, '')
    .toUpperCase();
  // A lone Devanagari mark cannot start an emblem.
  return graphemes(kept.replace(/^[ऀ-ःऺ-ॏ॑-ॗॢॣ]+/, ''))
    .slice(0, 3)
    .join('');
}

/** "Saathi Samaj Main-Neckar e.V." → "SSM" (the legal form is not a word). */
export function initialsFrom(name: string): string {
  const words = String(name ?? '')
    .split(/\s+/)
    .filter((w) => w && !/^(e\.?\s?v\.?|ev|e\.v)$/i.test(w));
  return cleanInitials(words.map((w) => graphemes(w)[0] ?? '').join(''));
}

export function cleanRing(s: string): string {
  return graphemes(String(s ?? '').replace(/\s+/g, ' ').trim()).slice(0, RING_MAX).join('');
}

export function escapeXml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export type EmblemInput = {
  initials: string;
  shape: EmblemShape;
  ring: string;
  look: LookId;
  /** Prefix for the ids inside the SVG, so two emblems on one page do not clash. */
  idPrefix?: string;
  /**
   * Another palette's colours instead of the look's (the /work/instant site
   * generator draws its logos with this helper in its own styles).
   * `inner` is the disc behind the motif, `light` the initials on it.
   */
  colors?: { primary: string; onPrimary: string; accent: string; inner: string; light: string };
};

function motif(shape: EmblemShape, accent: string, light: string): string {
  switch (shape) {
    case 'peaks':
      return (
        `<path d="M54 116 L80 76 L92 92 L110 62 L146 116 Z" fill="${accent}"/>` +
        `<path d="M110 62 L118 74 L112 72 L106 78 L102 74 Z M80 76 L86 85 L80 83 L75 87 Z" fill="${light}"/>`
      );
    case 'lotus': {
      const petals = [-60, -30, 0, 30, 60]
        .map((r) => `<path d="M100 112 C88 96 90 74 100 62 C110 74 112 96 100 112 Z" transform="rotate(${r} 100 112)" fill="${accent}" opacity="${r === 0 ? 1 : 0.82}"/>`)
        .join('');
      return petals + `<path d="M66 114 Q100 124 134 114" stroke="${accent}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
    case 'sun': {
      const rays = Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const x1 = 100 + Math.cos(a) * 26;
        const y1 = 90 + Math.sin(a) * 26;
        const x2 = 100 + Math.cos(a) * 36;
        const y2 = 90 + Math.sin(a) * 36;
        return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
      }).join('');
      return `<g stroke="${accent}" stroke-width="4" stroke-linecap="round">${rays}</g><circle cx="100" cy="90" r="19" fill="${accent}"/>`;
    }
    case 'star': {
      const pts = Array.from({ length: 16 }, (_, i) => {
        const r = i % 2 === 0 ? 30 : 13;
        const a = (i * Math.PI) / 8 - Math.PI / 2;
        return `${(100 + Math.cos(a) * r).toFixed(1)},${(90 + Math.sin(a) * r).toFixed(1)}`;
      }).join(' ');
      return `<polygon points="${pts}" fill="${accent}"/><circle cx="100" cy="90" r="6" fill="${light}"/>`;
    }
  }
}

/**
 * The association's emblem: a round seal in the look's colours, a motif, the
 * initials, and the name running round the ring. Returned as an SVG string so
 * the page, the downloaded logo file and the downloaded confirmation all use
 * exactly the same picture.
 */
export function emblemSvg(input: EmblemInput, size = 200): string {
  const lc = LOOKS[input.look].colors;
  const c = input.colors ?? {
    primary: lc.primary,
    onPrimary: lc.onPrimary,
    accent: lc.accent,
    inner: input.look === 'modern' ? lc.surface : lc.heroFrom,
    light: input.look === 'modern' ? '#ffffff' : '#fdf7ec',
  };
  const ini = cleanInitials(input.initials) || 'SS';
  const n = graphemes(ini).length;
  const fs = n <= 1 ? 50 : n === 2 ? 44 : 34;
  const ring = escapeXml(cleanRing(input.ring).toUpperCase());
  const id = `${(input.idPrefix ?? 'sj').replace(/[^a-z0-9-]/gi, '')}-ring`;
  const light = c.light;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${escapeXml(ini)}">` +
    `<defs><path id="${id}" d="M100 100 m-80 0 a80 80 0 1 1 160 0 a80 80 0 1 1 -160 0"/></defs>` +
    `<circle cx="100" cy="100" r="98" fill="${c.primary}"/>` +
    `<circle cx="100" cy="100" r="92" fill="none" stroke="${c.onPrimary}" stroke-opacity="0.35" stroke-width="1.5"/>` +
    `<circle cx="100" cy="100" r="68" fill="${c.inner}"/>` +
    `<circle cx="100" cy="100" r="68" fill="none" stroke="${c.accent}" stroke-width="2.5"/>` +
    (ring
      ? `<text font-family="Mukta, 'Noto Sans Devanagari', system-ui, sans-serif" font-size="12.5" font-weight="700" letter-spacing="1.5" fill="${c.onPrimary}">` +
        `<textPath href="#${id}" startOffset="50%" text-anchor="middle">${ring}</textPath></text>`
      : '') +
    motif(input.shape, c.accent, light) +
    `<text x="100" y="${n <= 2 ? 150 : 148}" text-anchor="middle" font-family="Mukta, 'Noto Sans Devanagari', system-ui, sans-serif" font-size="${fs}" font-weight="800" fill="${light}" letter-spacing="1">${escapeXml(ini)}</text>` +
    `</svg>`
  );
}

// ---------------- dates & the programme ----------------

export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
/** 0 = Monday … 6 = Sunday. */
export function weekdayMon(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

export type EventKind = 'festival' | 'sports' | 'school' | 'meeting' | 'community';
export type EventId =
  | 'maghe'
  | 'agm'
  | 'holi'
  | 'newyear'
  | 'sports'
  | 'picnic'
  | 'teej'
  | 'dashain'
  | 'tihar';

export type EventDef = {
  id: EventId;
  date: string;
  start: string;
  end: string;
  kind: EventKind;
  place: 'hall' | 'club' | 'park' | 'field' | 'tbd';
  /** Members already going in the demo (made up), for the RSVP counts. */
  going: number;
};

/** The 2027 programme — every date made up (festivals land on a nearby Saturday). */
export const EVENTS: EventDef[] = [
  { id: 'maghe', date: '2027-01-16', start: '17:00', end: '21:00', kind: 'community', place: 'club', going: 46 },
  { id: 'agm', date: '2027-03-14', start: '14:00', end: '17:00', kind: 'meeting', place: 'club', going: 38 },
  { id: 'holi', date: '2027-03-20', start: '13:00', end: '18:00', kind: 'festival', place: 'park', going: 71 },
  { id: 'newyear', date: '2027-04-17', start: '16:00', end: '23:00', kind: 'festival', place: 'hall', going: 128 },
  { id: 'sports', date: '2027-06-26', start: '10:00', end: '18:00', kind: 'sports', place: 'field', going: 64 },
  { id: 'picnic', date: '2027-07-25', start: '11:00', end: '18:00', kind: 'community', place: 'tbd', going: 52 },
  { id: 'teej', date: '2027-09-04', start: '15:00', end: '22:00', kind: 'festival', place: 'hall', going: 97 },
  { id: 'dashain', date: '2027-10-16', start: '16:00', end: '23:30', kind: 'festival', place: 'hall', going: 186 },
  { id: 'tihar', date: '2027-10-30', start: '17:00', end: '23:30', kind: 'festival', place: 'hall', going: 143 },
];

export function eventById(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}

/** The Saturday language school: two terms, no class on a big festival day. */
export const SCHOOL = { start: '10:00', end: '12:00', terms: [['2027-01-09', '2027-07-03'], ['2027-09-11', '2027-12-18']] as const };

export function schoolDays(): string[] {
  const busy = new Set(EVENTS.map((e) => e.date));
  const out: string[] = [];
  for (const [from, to] of SCHOOL.terms) {
    for (let d = from as string; d <= to; d = addDays(d, 7)) if (!busy.has(d)) out.push(d);
  }
  return out;
}
const SCHOOL_SET = new Set(schoolDays());
export function isSchoolDay(iso: string): boolean {
  return SCHOOL_SET.has(iso);
}

export function eventsOn(iso: string): EventDef[] {
  return EVENTS.filter((e) => e.date === iso);
}

/** The next programme event that has not started yet (null after the last one). */
export function nextEvent(now: Date): EventDef | null {
  const today = isoDate(now);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return EVENTS.find((e) => e.date > today || (e.date === today && e.start > hhmm)) ?? null;
}

/** Monday-first weeks of a month; days outside it are null. Always whole weeks. */
export function monthGrid(year: number, month0: number): (string | null)[][] {
  const first = isoDate(new Date(year, month0, 1));
  const days = new Date(year, month0 + 1, 0).getDate();
  const cells: (string | null)[] = Array(weekdayMon(first)).fill(null);
  for (let d = 1; d <= days; d++) cells.push(isoDate(new Date(year, month0, d)));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Calendar months shown: January to December 2027. */
export const FIRST_MONTH = { y: 2027, m: 0 };
export const LAST_MONTH = { y: 2027, m: 11 };
export function clampMonth(y: number, m: number): { y: number; m: number } {
  const k = y * 12 + m;
  const lo = FIRST_MONTH.y * 12 + FIRST_MONTH.m;
  const hi = LAST_MONTH.y * 12 + LAST_MONTH.m;
  const c = Math.min(hi, Math.max(lo, k));
  return { y: Math.floor(c / 12), m: c % 12 };
}

/** The Bikram Sambat date the way the hall's wall calendar shows it. */
export function bsLabel(iso: string, lang: Lang): string {
  const bs = adToBs(iso);
  if (!bs) return '';
  return lang === 'ne' ? formatBsNe(bs) : formatBs(bs);
}

// ---------------- membership form ----------------

export type Relation = 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
export const RELATIONS: Relation[] = ['spouse', 'child', 'parent', 'sibling', 'other'];
export const FAMILY_MAX = 6;
export const NAME_MAX = 60;

export type FamilyMember = { name: string; relation: Relation; born: string };

export type Application = {
  first: string;
  last: string;
  email: string;
  phone: string;
  town: string;
  family: FamilyMember[];
  consentData: boolean;
  photos: 'yes' | 'no' | null;
  newsletter: boolean;
};

export const EMPTY_APPLICATION: Application = {
  first: '',
  last: '',
  email: '',
  phone: '',
  town: '',
  family: [],
  consentData: false,
  photos: null,
  newsletter: false,
};

export const STEPS = ['personal', 'family', 'consent', 'review'] as const;
export type StepId = (typeof STEPS)[number];

export type FieldError = 'required' | 'name' | 'email' | 'phone' | 'year' | 'tooLong' | 'consent' | 'choose';
export type Errors = Record<string, FieldError>;

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ()/-]{6,20}$/;

function checkName(v: string, required = true): FieldError | null {
  const s = v.trim();
  if (!s) return required ? 'required' : null;
  if (s.length > NAME_MAX) return 'tooLong';
  if (!NAME_RE.test(s) || /\.\w{2,}\//.test(s)) return 'name';
  return null;
}

/** Errors for one step of the form, keyed by field ("first", "family.2.name", …). */
export function validateStep(step: StepId, a: Application, nowYear: number): Errors {
  const e: Errors = {};
  const put = (k: string, v: FieldError | null) => {
    if (v) e[k] = v;
  };
  if (step === 'personal' || step === 'review') {
    put('first', checkName(a.first));
    put('last', checkName(a.last));
    const em = a.email.trim();
    put('email', !em ? 'required' : em.length > 120 ? 'tooLong' : EMAIL_RE.test(em) ? null : 'email');
    const ph = a.phone.trim();
    put('phone', ph && !PHONE_RE.test(ph) ? 'phone' : null);
    put('town', checkName(a.town));
  }
  if (step === 'family' || step === 'review') {
    if (a.family.length > FAMILY_MAX) e.family = 'tooLong';
    a.family.forEach((f, i) => {
      put(`family.${i}.name`, checkName(f.name));
      if (!RELATIONS.includes(f.relation)) e[`family.${i}.relation`] = 'choose';
      const b = f.born.trim();
      if (b && (!/^\d{4}$/.test(b) || Number(b) < 1920 || Number(b) > nowYear)) e[`family.${i}.born`] = 'year';
    });
  }
  if (step === 'consent' || step === 'review') {
    if (!a.consentData) e.consentData = 'consent';
    if (a.photos !== 'yes' && a.photos !== 'no') e.photos = 'choose';
  }
  return e;
}

export function stepOk(step: StepId, a: Application, nowYear: number): boolean {
  return Object.keys(validateStep(step, a, nowYear)).length === 0;
}

/** The first step with a problem, or 'review' when everything is filled in. */
export function firstOpenStep(a: Application, nowYear: number): StepId {
  return (['personal', 'family', 'consent'] as const).find((s) => !stepOk(s, a, nowYear)) ?? 'review';
}

export function addFamily(a: Application): Application {
  if (a.family.length >= FAMILY_MAX) return a;
  return { ...a, family: [...a.family, { name: '', relation: 'child', born: '' }] };
}
export function removeFamily(a: Application, i: number): Application {
  return { ...a, family: a.family.filter((_, j) => j !== i) };
}

export function tidyApplication(a: Application): Application {
  const t = (s: string) => s.replace(/\s+/g, ' ').trim();
  return {
    ...a,
    first: t(a.first),
    last: t(a.last),
    email: a.email.trim(),
    phone: t(a.phone),
    town: t(a.town),
    family: a.family.map((f) => ({ ...f, name: t(f.name), born: f.born.trim() })),
  };
}

/** "SSM-2026-0148": the made-up register already has 147 households. */
export const REGISTER_START = 147;
export function memberNumber(seq: number, year: number): string {
  return `SSM-${year}-${String(seq).padStart(4, '0')}`;
}

export type Member = { app: Application; number: string; joined: string };

export function join(a: Application, now: Date): { member?: Member; errors?: Errors } {
  const tidy = tidyApplication(a);
  const errors = validateStep('review', tidy, now.getFullYear());
  if (Object.keys(errors).length) return { errors };
  return { member: { app: tidy, number: memberNumber(REGISTER_START + 1, now.getFullYear()), joined: isoDate(now) } };
}

export type ConfirmationText = {
  lang: Lang;
  title: string;
  org: string;
  welcome: (first: string) => string;
  numberLabel: string;
  joinedLabel: string;
  nameLabel: string;
  emailLabel: string;
  townLabel: string;
  familyLabel: string;
  relations: Record<Relation, string>;
  photosLabel: string;
  photos: { yes: string; no: string };
  newsletterLabel: string;
  yesNo: { yes: string; no: string };
  consentLine: string;
  demoNote: string;
  footer: string;
  joined: string;
};

/**
 * The membership confirmation as a self-contained HTML file, built in the
 * visitor's browser and saved or printed from there. Every value the visitor
 * typed is escaped; the file says it is a demo and that nothing was sent.
 */
export function confirmationHtml(m: Member, t: ConfirmationText, emblem: string): string {
  const h = escapeXml;
  const a = m.app;
  const fam = a.family.length
    ? `<ul>${a.family.map((f) => `<li>${h(f.name)} · ${h(t.relations[f.relation])}${f.born ? ` · ${h(f.born)}` : ''}</li>`).join('')}</ul>`
    : '<p>—</p>';
  const row = (k: string, v: string) => `<tr><th>${h(k)}</th><td>${v}</td></tr>`;
  return `<!doctype html>
<html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(t.title)} · ${h(m.number)}</title>
<style>
body{font-family:Mukta,'Noto Sans Devanagari',system-ui,sans-serif;color:#1d2433;background:#f4f5f8;margin:0;padding:24px}
main{max-width:640px;margin:0 auto;background:#fff;border:1px solid #d9dde6;border-radius:14px;padding:28px}
header{display:flex;gap:16px;align-items:center;border-bottom:2px solid #1d2433;padding-bottom:14px;margin-bottom:18px}
header svg{width:84px;height:84px;flex:none}
h1{font-size:1.5rem;margin:0}.org{margin:2px 0 0;color:#4b5568}
.num{font-size:1.25rem;font-weight:800;letter-spacing:.06em}
table{border-collapse:collapse;width:100%;margin:12px 0}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e6e9ef;vertical-align:top}th{width:38%;color:#4b5568;font-weight:600}
ul{margin:0;padding-left:18px}.demo{margin-top:18px;padding:10px 12px;border:1px dashed #b7791f;background:#fff8e6;border-radius:10px;font-size:.92rem}
footer{margin-top:16px;color:#4b5568;font-size:.85rem}
@media print{body{background:#fff;padding:0}main{border:0}}
</style></head>
<body><main>
<header>${emblem}<div><h1>${h(t.title)}</h1><p class="org">${h(t.org)}</p></div></header>
<p>${h(t.welcome(a.first))}</p>
<table>
${row(t.numberLabel, `<span class="num">${h(m.number)}</span>`)}
${row(t.joinedLabel, h(t.joined))}
${row(t.nameLabel, `${h(a.first)} ${h(a.last)}`)}
${row(t.emailLabel, h(a.email))}
${row(t.townLabel, h(a.town))}
${row(t.familyLabel, fam)}
${row(t.photosLabel, h(a.photos === 'yes' ? t.photos.yes : t.photos.no))}
${row(t.newsletterLabel, h(a.newsletter ? t.yesNo.yes : t.yesNo.no))}
</table>
<p>${h(t.consentLine)}</p>
<p class="demo">${h(t.demoNote)}</p>
<footer>${h(t.footer)}</footer>
</main></body></html>`;
}

// ---------------- members' area: poll and RSVPs ----------------

export type PollOption = 'riverside' | 'citypark' | 'lake' | 'forest';
export const POLL_OPTIONS: PollOption[] = ['riverside', 'citypark', 'lake', 'forest'];
/** Votes other (made-up) members already cast. */
export const POLL_SEED: Record<PollOption, number> = { riverside: 23, citypark: 17, lake: 29, forest: 12 };

export function pollCounts(mine: PollOption | null): Record<PollOption, number> {
  const out = { ...POLL_SEED };
  if (mine) out[mine] += 1;
  return out;
}

/** Percentages that always add up to 100 (largest remainder), in option order. */
export function pollResults(counts: Record<PollOption, number>): { id: PollOption; count: number; pct: number }[] {
  const total = POLL_OPTIONS.reduce((s, o) => s + counts[o], 0);
  if (!total) return POLL_OPTIONS.map((id) => ({ id, count: 0, pct: 0 }));
  const raw = POLL_OPTIONS.map((id) => ({ id, count: counts[id], exact: (counts[id] * 100) / total }));
  const res = raw.map((r) => ({ ...r, pct: Math.floor(r.exact) }));
  let left = 100 - res.reduce((s, r) => s + r.pct, 0);
  [...res].sort((x, y) => y.exact - y.pct - (x.exact - x.pct) || POLL_OPTIONS.indexOf(x.id) - POLL_OPTIONS.indexOf(y.id)).forEach((r) => {
    if (left > 0) {
      r.pct += 1;
      left -= 1;
    }
  });
  return res.map(({ id, count, pct }) => ({ id, count, pct }));
}

export function pollLeader(counts: Record<PollOption, number>): PollOption {
  return POLL_OPTIONS.reduce((best, o) => (counts[o] > counts[best] ? o : best), POLL_OPTIONS[0]);
}

export type Rsvp = 'yes' | 'maybe' | 'no';
export const RSVPS: Rsvp[] = ['yes', 'maybe', 'no'];
export const PEOPLE_MAX = 8;
export type RsvpEntry = { answer: Rsvp; people: number };

/** Members going to an event, with the visitor's own household if they said yes. */
export function goingCount(e: EventDef, mine: RsvpEntry | undefined): number {
  return e.going + (mine?.answer === 'yes' ? mine.people : 0);
}

export function clampPeople(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(PEOPLE_MAX, Math.max(1, v)) : 1;
}

// ---------------- the one saved state ----------------

export type Logo = { initials: string; shape: EmblemShape; ring: string };
export const DEFAULT_LOGO: Logo = {
  initials: initialsFrom(ORG.name),
  shape: 'peaks',
  ring: `${ORG.name} · ${ORG.founded}`,
};

export type SamajState = {
  v: 1;
  lang: Lang;
  look: LookId;
  logo: Logo;
  draft: Application;
  step: StepId;
  member: Member | null;
  loggedIn: boolean;
  rsvps: Partial<Record<EventId, RsvpEntry>>;
  vote: PollOption | null;
};

export function seedState(lang: Lang = 'en'): SamajState {
  return {
    v: 1,
    lang,
    look: 'himalaya',
    logo: { ...DEFAULT_LOGO },
    draft: { ...EMPTY_APPLICATION, family: [] },
    step: 'personal',
    member: null,
    loggedIn: false,
    rsvps: {},
    vote: null,
  };
}

const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '');

function asApplication(v: unknown): Application {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const fam = Array.isArray(o.family) ? o.family.slice(0, FAMILY_MAX) : [];
  return {
    first: str(o.first, NAME_MAX + 20),
    last: str(o.last, NAME_MAX + 20),
    email: str(o.email, 140),
    phone: str(o.phone, 30),
    town: str(o.town, NAME_MAX + 20),
    family: fam.map((f) => {
      const x = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
      return {
        name: str(x.name, NAME_MAX + 20),
        relation: RELATIONS.includes(x.relation as Relation) ? (x.relation as Relation) : 'other',
        born: str(x.born, 4),
      };
    }),
    consentData: o.consentData === true,
    photos: o.photos === 'yes' || o.photos === 'no' ? o.photos : null,
    newsletter: o.newsletter === true,
  };
}

/** Whatever localStorage held → a state the page can draw. Anything odd falls back to the seed. */
export function normalize(raw: unknown, lang: Lang = 'en'): SamajState {
  const base = seedState(lang);
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return base;
  const logoRaw = (o.logo && typeof o.logo === 'object' ? o.logo : {}) as Record<string, unknown>;
  const logo: Logo = {
    initials: cleanInitials(str(logoRaw.initials, 20)) || DEFAULT_LOGO.initials,
    shape: EMBLEM_SHAPES.includes(logoRaw.shape as EmblemShape) ? (logoRaw.shape as EmblemShape) : DEFAULT_LOGO.shape,
    ring: typeof logoRaw.ring === 'string' ? cleanRing(logoRaw.ring) : DEFAULT_LOGO.ring,
  };
  let member: Member | null = null;
  if (o.member && typeof o.member === 'object') {
    const m = o.member as Record<string, unknown>;
    const app = tidyApplication(asApplication(m.app));
    const number = str(m.number, 20);
    const joined = str(m.joined, 10);
    if (/^SSM-\d{4}-\d{4}$/.test(number) && /^\d{4}-\d{2}-\d{2}$/.test(joined) && stepOk('review', app, Number(joined.slice(0, 4)))) {
      member = { app, number, joined };
    }
  }
  const rsvps: SamajState['rsvps'] = {};
  if (o.rsvps && typeof o.rsvps === 'object') {
    for (const [k, v] of Object.entries(o.rsvps as Record<string, unknown>)) {
      const e = eventById(k);
      const x = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      if (e && RSVPS.includes(x.answer as Rsvp)) rsvps[e.id] = { answer: x.answer as Rsvp, people: clampPeople(x.people) };
    }
  }
  return {
    v: 1,
    lang: LANG_IDS.includes(o.lang as Lang) ? (o.lang as Lang) : lang,
    look: asLook(o.look),
    logo,
    draft: asApplication(o.draft),
    step: STEPS.includes(o.step as StepId) ? (o.step as StepId) : 'personal',
    member,
    loggedIn: o.loggedIn === true,
    rsvps,
    vote: POLL_OPTIONS.includes(o.vote as PollOption) ? (o.vote as PollOption) : null,
  };
}

export function setRsvp(s: SamajState, id: string, answer: Rsvp, people: number): SamajState {
  const e = eventById(id);
  if (!e || !RSVPS.includes(answer)) return s;
  return { ...s, rsvps: { ...s.rsvps, [e.id]: { answer, people: clampPeople(people) } } };
}

export function castVote(s: SamajState, opt: PollOption): SamajState {
  if (!s.loggedIn || !POLL_OPTIONS.includes(opt)) return s;
  return { ...s, vote: opt };
}
