// The rules behind /work/card — a link-in-bio page and a digital business
// card for a small business, an artist, a momo stall, a tutor or a DJ. Pure on
// purpose: no React, no DOM, no clock, so tests/cardMaker.test.ts can check
// every rule. Words for the screen (and the starter templates) live in
// content.ts, the downloadable pictures in draw.ts.
//
// Safety, in one place:
//   - every link a visitor types goes through linkHref(): it becomes an
//     http(s), mailto: or tel: address (wa.me is plain https) or it is refused;
//     safeHref() is the last gate before an href reaches the page;
//   - text is cleaned to one plain line (no control or bidi characters) and
//     capped; React escapes it when it is shown;
//   - a published link (#p=…) is decoded into the same cleaned state and its
//     links are checked again — a link never carries an href, only what the
//     visitor typed, so nothing in it can skip linkHref().
//
// Nothing here talks money: no prices, menus with prices, packages or "hire"
// wording (the studio's operator is a student; it is free while it grows).

import { cleanColor, cleanText, onColor, shade, slug } from '../build/idea';
import { cleanInitials, contrast, initialsFrom } from '../samaj/samaj';

export { cleanColor, cleanText, onColor, shade, slug };

export type Lang = 'en' | 'de' | 'ne';
export const LANG_IDS: Lang[] = ['en', 'de', 'ne'];
export function asLang(v: unknown): Lang | null {
  return v === 'en' || v === 'de' || v === 'ne' ? v : null;
}

// ---------------- links ----------------

export type LinkType = 'website' | 'whatsapp' | 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'email' | 'phone' | 'maps' | 'event' | 'menu';
export const LINK_TYPES: LinkType[] = ['website', 'whatsapp', 'instagram', 'tiktok', 'youtube', 'facebook', 'email', 'phone', 'maps', 'event', 'menu'];

/** Two-letter codes for the link in a published URL (keeps it short). */
const TYPE_CODE: Record<LinkType, string> = {
  website: 'w',
  whatsapp: 'wa',
  instagram: 'ig',
  tiktok: 'tt',
  youtube: 'yt',
  facebook: 'fb',
  email: 'em',
  phone: 'ph',
  maps: 'mp',
  event: 'ev',
  menu: 'mn',
};
const CODE_TYPE: Record<string, LinkType> = Object.fromEntries(LINK_TYPES.map((t) => [TYPE_CODE[t], t]));

export type LinkItem = {
  id: string;
  type: LinkType;
  /** What the visitor typed: a web address, a handle, a number, an email, an address. */
  value: string;
  /** The words on the button; empty = the type's default words. */
  label: string;
};

export const LIMITS = { name: 40, role: 60, bio: 140, label: 40, value: 300, links: 12 } as const;

export type LinkError = 'empty' | 'scheme' | 'invalid' | 'email' | 'phone' | 'host';
export type LinkCheck = { ok: true; href: string; display: string } | { ok: false; error: LinkError };

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];
const CONTROL = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g;

/**
 * The last gate before an href reaches the page: only http(s), mailto and
 * tel; no spaces or control characters anywhere; web addresses need a real
 * host name and may not hide a user name in front of it (https://bank.com@evil).
 */
export function safeHref(href: unknown): string | null {
  if (typeof href !== 'string' || !href || href.length > 2048) return null;
  if (/[\u0000- \u007F-\u009F]/.test(href)) return null;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (!ALLOWED_PROTOCOLS.includes(u.protocol)) return null;
  if (u.protocol === 'http:' || u.protocol === 'https:') {
    if (u.username || u.password) return null;
    if (!/^([a-z0-9-]+\.)+[a-z0-9-]{2,}$/i.test(u.hostname)) return null;
  }
  return u.href;
}

/** One line of what the visitor typed: no control characters, trimmed, capped. */
function cleanValue(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // Control characters become spaces ("java\tscript:" is then not a scheme and
  // not a web address); invisible formatting characters just go.
  const s = raw
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(CONTROL, '');
  return Array.from(s.replace(/\s+/g, ' ').trim())
    .slice(0, LIMITS.value)
    .join('');
}

function hostOf(href: string): string {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function shortDisplay(href: string): string {
  try {
    const u = new URL(href);
    const s = (u.hostname.replace(/^www\./, '') + u.pathname + u.search).replace(/\/$/, '');
    return s.length > 42 ? `${s.slice(0, 41)}…` : s;
  } catch {
    return href;
  }
}

const SCHEME = /^([a-z][a-z0-9+-]*):/i;

/** A web address: http(s) only; a bare "site.com/x" gets https:// in front. */
function webUrl(v: string): LinkCheck {
  if (/\s/.test(v)) return { ok: false, error: 'invalid' };
  const m = SCHEME.exec(v);
  let s = v;
  if (m) {
    const sc = m[1].toLowerCase();
    if (sc !== 'http' && sc !== 'https') return { ok: false, error: 'scheme' };
  } else if (s.startsWith('//')) {
    s = `https:${s}`;
  } else {
    s = `https://${s}`;
  }
  const href = safeHref(s);
  if (!href || !/^https?:/.test(href)) return { ok: false, error: 'invalid' };
  return { ok: true, href, display: shortDisplay(href) };
}

function isHost(host: string, ...domains: string[]): boolean {
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** "@momo.corner", "momo.corner" → the handle; null when it is not one (a URL, a path). */
function handle(v: string, re: RegExp): string | null {
  if (v.includes('/') || SCHEME.test(v.replace(/^@/, ''))) return null;
  const m = re.exec(v);
  return m ? m[1] : null;
}

function phoneDigits(v: string): string | null {
  const s = v.replace(/^tel:/i, '').trim();
  if (!/^\+?[0-9 ()./-]+$/.test(s)) return null;
  let d = s.replace(/[^0-9]/g, '');
  const plus = s.startsWith('+') || d.startsWith('00');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length < 6 || d.length > 15) return null;
  return plus ? `+${d}` : d;
}

const EMAIL = /^[A-Za-z0-9.!#$%&'*+=^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/**
 * What a visitor typed for a link → the address its button opens, or why it
 * cannot be used. Handles become profile addresses, a number becomes tel: or
 * wa.me, an address becomes a map search; anything with a scheme other than
 * http(s) / mailto / tel (javascript:, data:, file:, …) is refused.
 */
export function linkHref(type: LinkType, raw: unknown): LinkCheck {
  const v = cleanValue(raw);
  if (!v) return { ok: false, error: 'empty' };
  switch (type) {
    case 'website':
    case 'menu':
      return webUrl(v);
    case 'event': {
      if (v.startsWith('/') && !v.startsWith('//')) return webUrl(`https://www.martnepali.com${v}`);
      const r = webUrl(v);
      if (r.ok && !isHost(hostOf(r.href), 'martnepali.com')) return { ok: false, error: 'host' };
      return r;
    }
    case 'instagram': {
      const h = handle(v, /^@?([A-Za-z0-9._]{1,30})$/);
      if (h) return { ok: true, href: `https://www.instagram.com/${h}/`, display: `@${h}` };
      return webUrl(v);
    }
    case 'tiktok': {
      const h = handle(v, /^@?([A-Za-z0-9._]{2,24})$/);
      if (h) return { ok: true, href: `https://www.tiktok.com/@${h}`, display: `@${h}` };
      return webUrl(v);
    }
    case 'youtube': {
      const h = handle(v, /^@?([A-Za-z0-9._-]{3,30})$/);
      if (h) return { ok: true, href: `https://www.youtube.com/@${h}`, display: `@${h}` };
      return webUrl(v);
    }
    case 'facebook': {
      const h = handle(v, /^@?([A-Za-z0-9.]{3,50})$/);
      if (h) return { ok: true, href: `https://www.facebook.com/${h}`, display: h };
      return webUrl(v);
    }
    case 'whatsapp': {
      const d = phoneDigits(v);
      if (d) return { ok: true, href: `https://wa.me/${d.replace('+', '')}`, display: v };
      if (/^[+0-9 ()./-]+$/.test(v)) return { ok: false, error: 'phone' };
      const r = webUrl(v);
      if (r.ok && !isHost(hostOf(r.href), 'wa.me', 'whatsapp.com')) return { ok: false, error: 'host' };
      return r;
    }
    case 'email': {
      const s = v.replace(/^mailto:/i, '');
      if (!EMAIL.test(s) || s.length > 254) return { ok: false, error: 'email' };
      const href = safeHref(`mailto:${s}`);
      return href ? { ok: true, href, display: s } : { ok: false, error: 'email' };
    }
    case 'phone': {
      if (SCHEME.test(v) && !/^tel:/i.test(v)) return { ok: false, error: 'scheme' };
      const d = phoneDigits(v);
      if (!d) return { ok: false, error: 'phone' };
      const href = safeHref(`tel:${d}`);
      return href ? { ok: true, href, display: v.replace(/^tel:/i, '').trim() } : { ok: false, error: 'phone' };
    }
    case 'maps': {
      // A map link stays a link; anything else is an address to search for. A
      // "scheme" is only one when it is written like one (no space before the
      // colon) — "javascript:…" is refused, "Opening times: Sat" is an address.
      const m = SCHEME.exec(v);
      if (m || /^(www\.|maps\.|goo\.gl\/)/i.test(v) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(v)) {
        if (m && !['http', 'https'].includes(m[1].toLowerCase())) return { ok: false, error: 'scheme' };
        return webUrl(v);
      }
      const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
      return { ok: true, href, display: v.length > 42 ? `${v.slice(0, 41)}…` : v };
    }
  }
}

/** The href for a saved link, or null when it is not (yet) usable. */
export function hrefOf(l: Pick<LinkItem, 'type' | 'value'>): string | null {
  const r = linkHref(l.type, l.value);
  return r.ok ? safeHref(r.href) : null;
}

/** The rel and target every visitor link is rendered with. */
export const LINK_REL = 'noopener noreferrer nofollow';

// ---------------- the list: add, edit, reorder, delete ----------------

/** A fresh id that is not in the list yet: l1, l2, … */
export function nextLinkId(links: Pick<LinkItem, 'id'>[]): string {
  let n = 0;
  for (const l of links) {
    const m = /^l(\d+)$/.exec(l.id);
    if (m) n = Math.max(n, Number(m[1]));
  }
  return `l${n + 1}`;
}

/** Add a link at the end (no more than LIMITS.links). */
export function addLink(links: LinkItem[], item: Omit<LinkItem, 'id'>): LinkItem[] {
  if (links.length >= LIMITS.links) return links;
  return [...links, { id: nextLinkId(links), type: item.type, value: cleanValue(item.value), label: cleanText(item.label, LIMITS.label) }];
}

export function updateLink(links: LinkItem[], id: string, patch: Partial<Omit<LinkItem, 'id'>>): LinkItem[] {
  return links.map((l) =>
    l.id === id
      ? {
          ...l,
          type: patch.type && LINK_TYPES.includes(patch.type) ? patch.type : l.type,
          value: patch.value !== undefined ? Array.from(String(patch.value).replace(CONTROL, '')).slice(0, LIMITS.value).join('') : l.value,
          label: patch.label !== undefined ? cleanText(patch.label, LIMITS.label) : l.label,
        }
      : l
  );
}

export function removeLink(links: LinkItem[], id: string): LinkItem[] {
  return links.filter((l) => l.id !== id);
}

/** Move the link at `from` to `to` (both clamped); the same list when nothing moves. */
export function moveLink<T>(links: T[], from: number, to: number): T[] {
  const n = links.length;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= n) return links;
  const t = Math.max(0, Math.min(n - 1, to));
  if (t === from) return links;
  const out = links.slice();
  const [x] = out.splice(from, 1);
  out.splice(t, 0, x);
  return out;
}

/** Up (-1) or down (+1) by one, for the arrow buttons. */
export function moveLinkBy(links: LinkItem[], id: string, delta: number): LinkItem[] {
  const i = links.findIndex((l) => l.id === id);
  return i < 0 ? links : moveLink(links, i, i + delta);
}

// ---------------- looks ----------------

export type ThemeId = 'himalaya' | 'dhaka' | 'flags' | 'night' | 'minimal' | 'neon';
export const THEME_IDS: ThemeId[] = ['himalaya', 'dhaka', 'flags', 'night', 'minimal', 'neon'];

export type Theme = {
  /** Page background, top and bottom of the gradient. */
  bg: string;
  bg2: string;
  text: string;
  dim: string;
  /** The default accent: buttons and the emblem. */
  accent: string;
  /** Behind the profile picture and on cards. */
  surface: string;
  dark: boolean;
};

export const THEMES: Record<ThemeId, Theme> = {
  himalaya: { bg: '#dbeafe', bg2: '#f8fafc', text: '#0f1e3d', dim: '#3b4a66', accent: '#1d4ed8', surface: '#ffffff', dark: false },
  dhaka: { bg: '#7f1d1d', bg2: '#450a0a', text: '#fff7ed', dim: '#fcd9b6', accent: '#f59e0b', surface: '#991b1b', dark: true },
  flags: { bg: '#fffaf0', bg2: '#fdf2e0', text: '#2a1a0c', dim: '#6b4f33', accent: '#c2410c', surface: '#ffffff', dark: false },
  night: { bg: '#141a33', bg2: '#0a0d1c', text: '#fdf4e3', dim: '#c8c2d8', accent: '#fb923c', surface: '#1f2747', dark: true },
  minimal: { bg: '#ffffff', bg2: '#f4f4f5', text: '#18181b', dim: '#52525b', accent: '#18181b', surface: '#ffffff', dark: false },
  neon: { bg: '#09090b', bg2: '#1a0b2e', text: '#fafafa', dim: '#c4b5fd', accent: '#22d3ee', surface: '#18181b', dark: true },
};

export type ButtonStyle = 'pill' | 'square' | 'outline';
export const BUTTON_STYLES: ButtonStyle[] = ['pill', 'square', 'outline'];

export type FontId = 'clean' | 'friendly' | 'classic' | 'type';
export const FONT_IDS: FontId[] = ['clean', 'friendly', 'classic', 'type'];

/** What the front of the business card shows besides the name. */
export type CardFront = { phone: boolean; email: boolean; web: boolean };

export type CardState = {
  name: string;
  /** One line under the name: what you do. */
  role: string;
  bio: string;
  /** Emblem letters; empty = from the name. */
  initials: string;
  /** A data:image URL made in the browser (≤ 256 px), or ''. Never uploaded. */
  avatar: string;
  theme: ThemeId;
  /** #rrggbb; '' = the theme's own accent. */
  accent: string;
  button: ButtonStyle;
  font: FontId;
  /** Moving background (still under prefers-reduced-motion either way). */
  animated: boolean;
  links: LinkItem[];
  front: CardFront;
};

export const EMPTY_STATE: CardState = {
  name: '',
  role: '',
  bio: '',
  initials: '',
  avatar: '',
  theme: 'himalaya',
  accent: '',
  button: 'pill',
  font: 'clean',
  animated: false,
  links: [],
  front: { phone: true, email: true, web: true },
};

export function accentOf(s: Pick<CardState, 'theme' | 'accent'>): string {
  return cleanColor(s.accent) ?? THEMES[s.theme].accent;
}

/** The colours a page is painted with: theme + accent + button style. */
export function pageColors(s: Pick<CardState, 'theme' | 'accent' | 'button'>) {
  const th = THEMES[s.theme];
  const accent = accentOf(s);
  const outline = s.button === 'outline';
  // An outline button needs its border to show on the page; if the accent is
  // too close to the background, the text colour draws it instead.
  const edge = contrast(accent, th.bg) >= 2.2 ? accent : th.text;
  return {
    ...th,
    accent,
    btnBg: outline ? 'transparent' : accent,
    btnText: outline ? th.text : onColor(accent),
    btnBorder: outline ? edge : accent,
    emblemText: onColor(accent),
  };
}

/** The emblem's letters: the visitor's own, else from the name, else ✦. */
export function emblemLetters(s: Pick<CardState, 'initials' | 'name'>): string {
  return cleanInitials(s.initials) || initialsFrom(s.name) || '✦';
}

// ---------------- cleaning a state (localStorage, a published link) ----------------

const AVATAR_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
/** A 256 px JPEG is ~20–40 KB as a data URL; anything far bigger is not ours. */
export const AVATAR_MAX = 160_000;

export function cleanAvatar(v: unknown): string {
  return typeof v === 'string' && v.length <= AVATAR_MAX && AVATAR_RE.test(v) ? v : '';
}

/**
 * Any object → a valid state. `strictLinks` (a published link) drops links
 * that are not usable; the editor's own saved state keeps them so the visitor
 * can finish typing.
 */
export function normalizeState(raw: unknown, strictLinks = false): CardState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const links: LinkItem[] = [];
  for (const x of Array.isArray(r.links) ? r.links : []) {
    if (links.length >= LIMITS.links) break;
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const type = LINK_TYPES.includes(o.type as LinkType) ? (o.type as LinkType) : null;
    if (!type) continue;
    const item: LinkItem = {
      id: typeof o.id === 'string' && /^l\d{1,4}$/.test(o.id) && !links.some((l) => l.id === o.id) ? o.id : nextLinkId(links),
      type,
      value: cleanValue(o.value),
      label: cleanText(o.label, LIMITS.label).trim(),
    };
    if (strictLinks && !hrefOf(item)) continue;
    links.push(item);
  }
  const f = (r.front && typeof r.front === 'object' ? r.front : {}) as Record<string, unknown>;
  const theme = THEME_IDS.includes(r.theme as ThemeId) ? (r.theme as ThemeId) : EMPTY_STATE.theme;
  return {
    name: cleanText(r.name, LIMITS.name).trim(),
    role: cleanText(r.role, LIMITS.role).trim(),
    bio: cleanText(r.bio, LIMITS.bio).trim(),
    initials: cleanInitials(typeof r.initials === 'string' ? r.initials : ''),
    avatar: cleanAvatar(r.avatar),
    theme,
    accent: cleanColor(r.accent) ?? '',
    button: BUTTON_STYLES.includes(r.button as ButtonStyle) ? (r.button as ButtonStyle) : 'pill',
    font: FONT_IDS.includes(r.font as FontId) ? (r.font as FontId) : 'clean',
    animated: r.animated === true,
    links,
    front: { phone: f.phone !== false, email: f.email !== false, web: f.web !== false },
  };
}

// ---------------- the published link: #p=<base64url JSON> ----------------

/** The longest #p=… a published link may carry (characters after "p="). */
export const HASH_MAX = 8000;
/** Never even try to decode more than this. */
const DECODE_MAX = 400_000;

function toB64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(code: string): string | null {
  if (!code || code.length > DECODE_MAX || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (code.length % 4)) % 4);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** The state as short JSON: one-letter keys, defaults left out, links as [type, value, label?]. */
function pack(s: CardState, withAvatar: boolean, linkCount = s.links.length): Record<string, unknown> {
  const p: Record<string, unknown> = { v: 1, n: s.name };
  if (s.role) p.r = s.role;
  if (s.bio) p.b = s.bio;
  if (s.initials) p.i = s.initials;
  if (withAvatar && s.avatar) p.a = s.avatar;
  if (s.theme !== 'himalaya') p.t = s.theme;
  if (s.accent) p.c = s.accent.replace('#', '');
  if (s.button !== 'pill') p.s = s.button;
  if (s.font !== 'clean') p.f = s.font;
  if (s.animated) p.m = 1;
  const fr = (s.front.phone ? '' : 'p') + (s.front.email ? '' : 'e') + (s.front.web ? '' : 'w');
  if (fr) p.h = fr;
  p.l = s.links
    .filter((l) => hrefOf(l))
    .slice(0, linkCount)
    .map((l) => (l.label ? [TYPE_CODE[l.type], l.value, l.label] : [TYPE_CODE[l.type], l.value]));
  return p;
}

export function encodeState(s: CardState, withAvatar = true): string {
  return toB64Url(JSON.stringify(pack(s, withAvatar)));
}

export type LinkPack = { code: string; droppedAvatar: boolean; droppedLinks: number };

/**
 * The state for a shareable link, within `max` characters: with the picture if
 * it fits, else without it (and says so), else with links left off the end.
 */
export function encodeForLink(s: CardState, max = HASH_MAX): LinkPack {
  if (s.avatar) {
    const code = encodeState(s, true);
    if (code.length <= max) return { code, droppedAvatar: false, droppedLinks: 0 };
  }
  const usable = s.links.filter((l) => hrefOf(l)).length;
  for (let n = usable; n >= 0; n--) {
    const code = toB64Url(JSON.stringify(pack(s, false, n)));
    if (code.length <= max || n === 0) return { code, droppedAvatar: !!s.avatar, droppedLinks: usable - n };
  }
  /* c8 ignore next */
  return { code: '', droppedAvatar: !!s.avatar, droppedLinks: usable };
}

/** A #p=… code → a cleaned, read-only state; null for anything that is not one. */
export function decodeState(code: string): CardState | null {
  const json = fromB64Url(code);
  if (!json) return null;
  let p: unknown;
  try {
    p = JSON.parse(json);
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object' || Array.isArray(p) || (p as { v?: unknown }).v !== 1) return null;
  const o = p as Record<string, unknown>;
  const h = typeof o.h === 'string' ? o.h : '';
  return normalizeState(
    {
      name: o.n,
      role: o.r,
      bio: o.b,
      initials: o.i,
      avatar: o.a,
      theme: o.t,
      accent: typeof o.c === 'string' ? o.c : '',
      button: o.s,
      font: o.f,
      animated: o.m === 1,
      front: { phone: !h.includes('p'), email: !h.includes('e'), web: !h.includes('w') },
      links: (Array.isArray(o.l) ? o.l : []).map((x) => (Array.isArray(x) ? { type: CODE_TYPE[String(x[0])], value: x[1], label: x[2] } : null)),
    },
    true
  );
}

/** location.hash → the published state, or null when the hash is not a published page. */
export function readHash(hash: string): CardState | null {
  const m = /^#?p=([A-Za-z0-9_-]+)$/.exec(String(hash ?? ''));
  return m ? decodeState(m[1]) : null;
}

export function publishedUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}/work/card#p=${code}`;
}

/** The QR on the card holds at most this many characters (still scannable printed small). */
export const QR_MAX = 1400;

/** What the card's QR points to: the page link if it is short enough, else the fallback. */
export function qrTarget(pageUrl: string, fallback: string): { text: string; full: boolean } {
  return pageUrl.length <= QR_MAX ? { text: pageUrl, full: true } : { text: fallback, full: false };
}

// ---------------- the vCard ----------------

/** RFC 6350 text escaping: backslash, newline, comma and semicolon. */
export function vcardEscape(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Fold a content line at 75 octets (UTF-8), never inside a character; continuations start with a space. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // a continuation's leading space counts
    if (bytes + b > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function firstOf(s: CardState, type: LinkType): LinkItem | undefined {
  return s.links.find((l) => l.type === type && hrefOf(l));
}

/** The contact lines on the card's front, in order: phone, email, website. */
export function cardContacts(s: CardState): { kind: 'phone' | 'email' | 'web'; text: string }[] {
  const out: { kind: 'phone' | 'email' | 'web'; text: string }[] = [];
  const ph = firstOf(s, 'phone') ?? firstOf(s, 'whatsapp');
  if (s.front.phone && ph) {
    const r = linkHref(ph.type, ph.value);
    if (r.ok) out.push({ kind: 'phone', text: r.display });
  }
  const em = firstOf(s, 'email');
  if (s.front.email && em) {
    const r = linkHref('email', em.value);
    if (r.ok) out.push({ kind: 'email', text: r.display });
  }
  const web = firstOf(s, 'website') ?? firstOf(s, 'menu') ?? firstOf(s, 'instagram');
  if (s.front.web && web) {
    const r = linkHref(web.type, web.value);
    if (r.ok) out.push({ kind: 'web', text: r.display });
  }
  return out;
}

/**
 * A vCard 3.0 for "save to contacts": name, what you do, phone, email, web
 * and social links, the link page, and the picture if there is one. Every
 * text value is escaped and every line folded, CRLF line ends.
 */
export function buildVCard(s: CardState, pageUrl?: string): string {
  const name = s.name.trim() || 'MartNepali demo';
  const words = name.split(/\s+/);
  const family = words.length > 1 ? words[words.length - 1] : '';
  const given = words.length > 1 ? words.slice(0, -1).join(' ') : words[0];
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vcardEscape(family)};${vcardEscape(given)};;;`, `FN:${vcardEscape(name)}`];
  if (s.role) lines.push(`TITLE:${vcardEscape(s.role)}`);
  if (s.bio) lines.push(`NOTE:${vcardEscape(s.bio)}`);
  const seen = new Set<string>();
  for (const l of s.links) {
    const r = linkHref(l.type, l.value);
    if (!r.ok || seen.has(r.href)) continue;
    seen.add(r.href);
    const href = r.href.replace(/[\r\n]/g, '');
    if (l.type === 'phone') lines.push(`TEL;TYPE=CELL:${vcardEscape(href.replace(/^tel:/, ''))}`);
    else if (l.type === 'email') lines.push(`EMAIL;TYPE=INTERNET:${vcardEscape(r.display)}`);
    else if (['instagram', 'tiktok', 'youtube', 'facebook'].includes(l.type)) lines.push(`X-SOCIALPROFILE;TYPE=${l.type}:${href}`);
    else lines.push(`URL:${href}`);
  }
  if (pageUrl && safeHref(pageUrl)) lines.push(`URL:${pageUrl}`);
  const photo = /^data:image\/(jpeg|png);base64,(.+)$/.exec(s.avatar);
  if (photo) lines.push(`PHOTO;ENCODING=b;TYPE=${photo[1] === 'png' ? 'PNG' : 'JPEG'}:${photo[2]}`);
  lines.push('END:VCARD');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** "Tato Momo Corner" → "tato-momo-corner" for file names. */
export function fileName(s: Pick<CardState, 'name'>, ext: string): string {
  return `${slug(s.name, 'my-card')}.${ext}`;
}

// ---------------- simulated stats ----------------

/** A small seeded random number generator (the same visitors every time for one seed). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Stats = { views: number; clicks: Record<string, number> };

/** Made-up starting numbers: the first links get more clicks, like real link pages. */
export function seedStats(links: Pick<LinkItem, 'id'>[], rnd: () => number): Stats {
  const clicks: Record<string, number> = {};
  let total = 0;
  links.forEach((l, i) => {
    const n = Math.round((40 + rnd() * 60) / (1 + i * 0.45));
    clicks[l.id] = n;
    total += n;
  });
  return { views: Math.round(total * (1.8 + rnd() * 0.6)) + 12, clicks };
}

/** One tick: a visitor or two, sometimes a click. Links that are gone drop out; new ones start at 0. */
export function tickStats(st: Stats, links: Pick<LinkItem, 'id'>[], rnd: () => number): Stats {
  const clicks: Record<string, number> = {};
  for (const l of links) clicks[l.id] = st.clicks[l.id] ?? 0;
  const views = st.views + 1 + Math.floor(rnd() * 2);
  if (links.length && rnd() < 0.75) {
    // Weighted to the top of the list.
    const w = links.map((_, i) => 1 / (1 + i * 0.6));
    let x = rnd() * w.reduce((a, b) => a + b, 0);
    let k = 0;
    while (k < w.length - 1 && x > w[k]) x -= w[k++];
    clicks[links[k].id] += 1;
  }
  return { views, clicks };
}
