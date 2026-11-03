// The rules behind /work/build — "Build your idea": what a visitor can pick,
// how a pick is cleaned, how the whole idea fits into a link (#k=…&f=…) and
// the short brief that goes with them to /contact. Pure on purpose — no React,
// no DOM — so tests/buildIdea.test.ts can check every rule. Words for the
// screen live in content.ts.
//
// It is an idea sketch, nothing more: no prices, estimates, budgets, timelines
// or packages anywhere (the studio's operator is a student and it is free
// while it grows — see app/studio/page.tsx).

import { PROJECTS, demoHref } from '@/lib/projects';
import { BRIEF_MAX, cleanBrief } from '@/lib/ideaBrief';
import { cleanInitials, contrast, initialsFrom } from '../samaj/samaj';

export type Lang = 'en' | 'de' | 'ne';

export type KindId = 'restaurant' | 'shop' | 'association' | 'artist' | 'organizer' | 'school' | 'other';
export const KIND_IDS: KindId[] = ['restaurant', 'shop', 'association', 'artist', 'organizer', 'school', 'other'];

export type MakeId = 'app' | 'web' | 'both';
export const MAKE_IDS: MakeId[] = ['app', 'web', 'both'];

export type FeatureId =
  | 'tickets'
  | 'menu'
  | 'shop'
  | 'booking'
  | 'members'
  | 'quiz'
  | 'dashboard'
  | 'lang'
  | 'chat'
  | 'news'
  | 'gallery'
  | 'video'
  | 'stage';

export type ColorId = 'crimson' | 'saffron' | 'green' | 'blue' | 'violet';

/** The five preset colours; any other #rrggbb is the visitor's own. */
export const COLORS: { id: ColorId; hex: string }[] = [
  { id: 'crimson', hex: '#dc143c' },
  { id: 'saffron', hex: '#ea580c' },
  { id: 'green', hex: '#15803d' },
  { id: 'blue', hex: '#1d4ed8' },
  { id: 'violet', hex: '#7c3aed' },
];

export type Kind = {
  icon: string;
  color: string;
  /** Features that usually fit this kind (shown as "Suggested"). */
  suggest: FeatureId[];
};

export const KINDS: Record<KindId, Kind> = {
  restaurant: { icon: '🍛', color: '#ea580c', suggest: ['menu', 'lang', 'chat', 'gallery'] },
  shop: { icon: '🛍️', color: '#15803d', suggest: ['shop', 'news', 'lang', 'chat'] },
  association: { icon: '🏔️', color: '#1d4ed8', suggest: ['members', 'tickets', 'gallery', 'lang'] },
  artist: { icon: '🎤', color: '#7c3aed', suggest: ['tickets', 'gallery', 'video', 'stage'] },
  organizer: { icon: '🎟️', color: '#dc143c', suggest: ['tickets', 'dashboard', 'quiz', 'video'] },
  school: { icon: '📚', color: '#1d4ed8', suggest: ['booking', 'members', 'lang', 'news'] },
  other: { icon: '✨', color: '#7c3aed', suggest: ['chat', 'lang', 'gallery', 'news'] },
};
/** Before a kind is picked. */
export const NO_KIND: Kind = { icon: '✨', color: '#7c3aed', suggest: [] };

export type Feature = {
  id: FeatureId;
  icon: string;
  /** The PROJECTS entry whose /work/* demo shows this working, if one does. */
  demo?: string;
};

export const FEATURES: Feature[] = [
  { id: 'tickets', icon: '🎟️', demo: 'live' },
  { id: 'menu', icon: '🍽️', demo: 'tables' },
  { id: 'shop', icon: '🛍️' },
  { id: 'booking', icon: '📅', demo: 'classes' },
  { id: 'members', icon: '🪪', demo: 'samaj' },
  { id: 'quiz', icon: '🧠', demo: 'quiz' },
  { id: 'dashboard', icon: '📊', demo: 'live' },
  { id: 'lang', icon: '🌐', demo: 'samaj' },
  { id: 'chat', icon: '💬' },
  { id: 'news', icon: '📣' },
  { id: 'gallery', icon: '🖼️', demo: 'wedding' },
  { id: 'video', icon: '🎬' },
  { id: 'stage', icon: '🎆' },
];
export const FEATURE_IDS: FeatureId[] = FEATURES.map((f) => f.id);
export const FEATURE: Record<FeatureId, Feature> = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<FeatureId, Feature>;

/** "See it working →": the live demo for a feature, from lib/projects (never a second list of URLs). */
export function featureDemoHref(id: FeatureId): string | undefined {
  const pid = FEATURE[id]?.demo;
  const p = pid ? PROJECTS.find((x) => x.id === pid) : undefined;
  return p ? demoHref(p) : undefined;
}

export type Idea = {
  kind: KindId | '';
  /** "Other": what they are, in their words. */
  other: string;
  name: string;
  tagline: string;
  /** Emblem letters; empty = from the name. */
  initials: string;
  /** #rrggbb */
  color: string;
  make: MakeId;
  /** In the order they were switched on (the newest is last in the phone). */
  features: FeatureId[];
};

export const LIMITS = { other: 40, name: 40, tagline: 60 } as const;

export const EMPTY_IDEA: Idea = { kind: '', other: '', name: '', tagline: '', initials: '', color: NO_KIND.color, make: 'app', features: [] };

export function kindOf(i: Pick<Idea, 'kind'>): Kind {
  return i.kind ? KINDS[i.kind] : NO_KIND;
}

/** One line of plain text: no control characters or markup, within `max` characters. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  const s = v
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F-\u009F​‎‏‪-‮⁦-⁩﻿<>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/, '');
  return Array.from(s).slice(0, max).join('');
}

export function cleanColor(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/^#/, '').toLowerCase();
  return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : null;
}

/** Any object (a decoded link, localStorage) → a valid idea. */
export function normalizeIdea(raw: unknown): Idea {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kind = KIND_IDS.includes(r.kind as KindId) ? (r.kind as KindId) : '';
  const features: FeatureId[] = [];
  for (const f of Array.isArray(r.features) ? r.features : []) {
    if (FEATURE_IDS.includes(f as FeatureId) && !features.includes(f as FeatureId)) features.push(f as FeatureId);
  }
  return {
    kind,
    other: kind === 'other' ? cleanText(r.other, LIMITS.other) : '',
    name: cleanText(r.name, LIMITS.name),
    tagline: cleanText(r.tagline, LIMITS.tagline),
    initials: cleanInitials(typeof r.initials === 'string' ? r.initials : ''),
    color: cleanColor(r.color) ?? kindOf({ kind }).color,
    make: MAKE_IDS.includes(r.make as MakeId) ? (r.make as MakeId) : 'app',
    features,
  };
}

/** The idea as a short query string for the link's #hash: k=restaurant&n=…&c=ea580c&m=app&f=menu.lang */
export function encodeIdea(i: Idea): string {
  const p = new URLSearchParams();
  if (i.kind) p.set('k', i.kind);
  if (i.kind === 'other' && i.other.trim()) p.set('o', i.other.trim());
  if (i.name.trim()) p.set('n', i.name.trim());
  if (i.tagline.trim()) p.set('t', i.tagline.trim());
  if (i.initials) p.set('i', i.initials);
  p.set('c', i.color.replace(/^#/, ''));
  p.set('m', i.make);
  if (i.features.length) p.set('f', i.features.join('.'));
  return p.toString();
}

/** A link's #hash (or ?query, or the bare string) → an idea; null when it holds none. */
export function decodeIdea(s: string): Idea | null {
  const q = String(s ?? '').replace(/^[#?]/, '');
  if (!q || !/(^|&)(k|m|c|f|n)=/.test(q)) return null;
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(q);
  } catch {
    return null;
  }
  return normalizeIdea({
    kind: p.get('k'),
    other: p.get('o'),
    name: p.get('n'),
    tagline: p.get('t'),
    initials: p.get('i'),
    color: p.get('c'),
    make: p.get('m'),
    features: (p.get('f') ?? '').split('.').filter(Boolean),
  });
}

/** Turning a feature on adds it at the end; off takes it out. */
export function toggleFeature(i: Idea, f: FeatureId): Idea {
  return { ...i, features: i.features.includes(f) ? i.features.filter((x) => x !== f) : [...i.features, f] };
}

/** Picking a kind re-themes the sketch: its colour comes with it. */
export function pickKind(i: Idea, kind: KindId): Idea {
  return { ...i, kind, other: kind === 'other' ? i.other : '', color: KINDS[kind].color };
}

/** The emblem's letters: the visitor's own, else from the name, else the fallback. */
export function emblemInitials(i: Idea, fallbackName: string): string {
  return i.initials || initialsFrom(i.name.trim() || fallbackName) || '✦';
}

/** White or near-black text on a colour, whichever reads better. */
export function onColor(hex: string): string {
  return contrast(hex, '#ffffff') >= 3 ? '#ffffff' : '#1c1917';
}

/** A colour mixed toward black (amount < 0) or white (amount > 0), for gradients. */
export function shade(hex: string, amount: number): string {
  const c = cleanColor(hex) ?? '#7c3aed';
  const to = amount < 0 ? 0 : 255;
  const a = Math.min(1, Math.abs(amount));
  const ch = [1, 3, 5].map((k) => {
    const v = parseInt(c.slice(k, k + 2), 16);
    return Math.round(v + (to - v) * a)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${ch.join('')}`;
}

/** "Himalayan Chulo" → "himalayan-chulo" (a file name or a pretend web address). */
export function slug(s: string, fallback = 'my-idea'): string {
  const out = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/, '');
  return out || fallback;
}

export type BriefWords = {
  /** "an app" / "a website" / "an app and a website" */
  make: Record<MakeId, string>;
  /** "for my restaurant" … ; `other` takes the visitor's words */
  forKind: Record<KindId, string>;
  forOther: (what: string) => string;
  /** The whole opening: what, for whom, called what. */
  opening: (make: string, forKind: string, name: string, tagline: string) => string;
  colour: (hex: string) => string;
  withList: (list: string) => string;
  noFeatures: string;
  sketch: string;
  features: Record<FeatureId, string>;
};

/**
 * The brief the "Send this to us" button carries to /contact: one readable
 * paragraph, in the visitor's language, with a link back to the sketch. Never
 * longer than the chat's input; when it would be, the link goes first, then
 * features from the end.
 */
export function ideaBrief(i: Idea, w: BriefWords): string {
  const forKind = i.kind === 'other' ? (i.other.trim() ? w.forOther(i.other.trim()) : '') : i.kind ? w.forKind[i.kind] : '';
  const head = w.opening(w.make[i.make], forKind, i.name.trim(), i.tagline.trim());
  const link = `${w.sketch} /work/build#${encodeIdea(i)}`;
  const build = (features: FeatureId[], withLink: boolean) =>
    [
      head,
      features.length ? w.withList(features.map((f) => w.features[f]).join(', ')) : w.noFeatures,
      w.colour(i.color),
      withLink ? link : '',
    ]
      .filter(Boolean)
      .join(' ');
  let text = build(i.features, true);
  if (Array.from(text).length > BRIEF_MAX) text = build(i.features, false);
  let fs = i.features;
  while (Array.from(text).length > BRIEF_MAX && fs.length > 1) {
    fs = fs.slice(0, -1);
    text = build(fs, false);
  }
  return cleanBrief(text);
}

/** Where the "Send this to us" button goes. */
export function contactHref(i: Idea, brief: string): string {
  const intent = i.make === 'web' ? 'website' : 'app';
  return `/contact?intent=${intent}&brief=${encodeURIComponent(brief)}`;
}
