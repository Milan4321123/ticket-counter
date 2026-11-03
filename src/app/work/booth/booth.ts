// /work/booth — the photo booth's rules, with no DOM in them (tests/photoBooth.test.ts).
//
//   - formats and their layout: where the photo window, the title band and the
//     date / hashtag band sit on a square, story, 4×6 print or photo strip;
//   - "cover" cropping of a photo into its window, with zoom and pan;
//   - stickers: their box on the picture, hit testing with rotation and scale,
//     drag / pinch / corner-handle maths, keyboard nudges, layer order;
//   - fitting a line of text (Latin or Devanagari) into a width;
//   - the colour filters, as plain pixel maths;
//   - the saved state (one localStorage key) and the organizer's booth link.
//
// Nothing here uploads, fetches or stores anything by itself.

export type Lang = 'en' | 'de' | 'ne';
export const LANG_IDS: Lang[] = ['en', 'de', 'ne'];

export type FormatId = 'square' | 'story' | 'print';
export type LayoutId = FormatId | 'strip';
export const FORMAT_IDS: FormatId[] = ['square', 'story', 'print'];

export type FrameId = 'dashain' | 'tihar' | 'teej' | 'newyear' | 'concert' | 'wedding';
export const FRAME_IDS: FrameId[] = ['dashain', 'tihar', 'teej', 'newyear', 'concert', 'wedding'];

export type FilterId = 'none' | 'warm' | 'mono' | 'glow';
export const FILTER_IDS: FilterId[] = ['none', 'warm', 'mono', 'glow'];

export type StickerKind = 'topi' | 'shades' | 'momo' | 'flags' | 'woho' | 'heart' | 'tika';
export const STICKER_KINDS: StickerKind[] = ['topi', 'shades', 'momo', 'flags', 'woho', 'heart', 'tika'];

/** Width ÷ height of each sticker's box. */
export const STICKER_ASPECT: Record<StickerKind, number> = {
  topi: 1.3,
  shades: 2.6,
  momo: 1.25,
  flags: 2.4,
  woho: 1.7,
  heart: 1.08,
  tika: 0.62,
};

export type ShotMode = 'single' | 'strip';
export const STRIP_SHOTS = 3;

export const LIMITS = {
  title: 44,
  date: 44,
  tag: 30,
  stickers: 14,
  wall: 12,
  /** Thumbnails on the wall: longest side in px. */
  thumb: 120,
  /** Rough byte budget for everything under the one localStorage key. */
  storeBytes: 220_000,
  logoBytes: 90_000,
  /** A shot is kept at most this many px on its longest side. */
  shotMax: 1600,
  minScale: 0.3,
  maxScale: 4,
  zoomMin: 1,
  zoomMax: 3,
  brightness: 0.4,
  hash: 600,
} as const;

// ---------------- formats and layout ----------------

export type Rect = { x: number; y: number; w: number; h: number };

/** Pixel sizes. Print is 4×6 in at 300 dpi; the strip is 2×6 in at 360 dpi. */
export const SIZES: Record<LayoutId, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  print: { w: 1200, h: 1800 },
  strip: { w: 720, h: 2160 },
};

/** Bands as fractions of the width: side margin, title band, bottom band, gap between strip shots. */
const BANDS: Record<LayoutId, { margin: number; top: number; bottom: number; gap: number }> = {
  square: { margin: 0.055, top: 0.17, bottom: 0.15, gap: 0 },
  story: { margin: 0.055, top: 0.31, bottom: 0.27, gap: 0 },
  print: { margin: 0.055, top: 0.18, bottom: 0.15, gap: 0 },
  strip: { margin: 0.056, top: 0.36, bottom: 0.3, gap: 0.04 },
};

export type Layout = {
  id: LayoutId;
  w: number;
  h: number;
  margin: number;
  /** Where the photos go — one cell, or three for a strip. */
  cells: Rect[];
  /** The box around every cell: stickers live in it (normalised 0..1). */
  area: Rect;
  /** The band above the photo: greeting + event name. */
  title: Rect;
  /** The band below: date + hashtag. */
  meta: Rect;
  radius: number;
};

/** Equal cells stacked top to bottom inside `area`, with `gap` between them. */
export function stackCells(area: Rect, n: number, gap: number): Rect[] {
  const count = Math.max(1, Math.floor(n));
  const h = (area.h - gap * (count - 1)) / count;
  const out: Rect[] = [];
  for (let i = 0; i < count; i++) out.push({ x: area.x, y: area.y + i * (h + gap), w: area.w, h });
  return out;
}

export function layoutFor(id: LayoutId): Layout {
  const { w, h } = SIZES[id];
  const b = BANDS[id];
  const margin = Math.round(w * b.margin);
  const top = Math.round(w * b.top);
  const bottom = Math.round(w * b.bottom);
  const area: Rect = { x: margin, y: top, w: w - 2 * margin, h: h - top - bottom };
  const cells = stackCells(area, id === 'strip' ? STRIP_SHOTS : 1, Math.round(w * b.gap));
  const inset = Math.round(margin * 0.45);
  const gap = Math.round(margin * 0.3);
  return {
    id,
    w,
    h,
    margin,
    cells,
    area,
    title: { x: margin, y: inset, w: w - 2 * margin, h: top - inset - gap },
    meta: { x: margin, y: h - bottom + gap, w: w - 2 * margin, h: bottom - gap - inset },
    radius: Math.round(w * 0.022),
  };
}

export function layoutId(mode: ShotMode, format: FormatId): LayoutId {
  return mode === 'strip' ? 'strip' : format;
}

/** The size to show a w×h picture at inside a box, keeping its shape. */
export function fitBox(w: number, h: number, boxW: number, boxH: number): { w: number; h: number } {
  if (w <= 0 || h <= 0 || boxW <= 0 || boxH <= 0) return { w: 0, h: 0 };
  const s = Math.min(boxW / w, boxH / h);
  return { w: Math.floor(w * s), h: Math.floor(h * s) };
}

/** A pointer's client position → the picture's own pixel coordinates. */
export function toCanvas(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  w: number,
  h: number
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return { x: ((clientX - rect.left) / rect.width) * w, y: ((clientY - rect.top) / rect.height) * h };
}

// ---------------- cover crop, zoom and pan ----------------

export type Crop = { sx: number; sy: number; sw: number; sh: number };

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The part of a srcW×srcH photo that fills a dstW×dstH window ("cover"),
 * zoomed in by `zoom` (≥ 1) and moved by pan (-1 … 1 on each axis: -1 shows
 * the left / top edge, 1 the right / bottom edge).
 */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number, zoom = 1, panX = 0, panY = 0): Crop {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return { sx: 0, sy: 0, sw: Math.max(0, srcW), sh: Math.max(0, srcH) };
  const z = clamp(zoom, LIMITS.zoomMin, LIMITS.zoomMax);
  const scale = Math.max(dstW / srcW, dstH / srcH) * z;
  const sw = Math.min(srcW, dstW / scale);
  const sh = Math.min(srcH, dstH / scale);
  const slackX = srcW - sw;
  const slackY = srcH - sh;
  return {
    sx: slackX * (0.5 + clamp(panX, -1, 1) / 2),
    sy: slackY * (0.5 + clamp(panY, -1, 1) / 2),
    sw,
    sh,
  };
}

/** How much pan changes when the picture is dragged by dx, dy window pixels. */
export function panDelta(srcW: number, srcH: number, dstW: number, dstH: number, zoom: number, dx: number, dy: number): { x: number; y: number } {
  const c = coverCrop(srcW, srcH, dstW, dstH, zoom, 0, 0);
  const scale = dstW / c.sw;
  const slackX = srcW - c.sw;
  const slackY = srcH - c.sh;
  return {
    x: slackX > 0.5 ? (-2 * dx) / (scale * slackX) : 0,
    y: slackY > 0.5 ? (-2 * dy) / (scale * slackY) : 0,
  };
}

// ---------------- stickers ----------------

export type Sticker = {
  id: string;
  kind: StickerKind;
  /** Centre, 0..1 across / down the sticker area (the photo window). */
  u: number;
  v: number;
  /** Size factor: 1 = a quarter of the window's short side tall. */
  s: number;
  /** Rotation in radians. */
  r: number;
};

export const STICKER_BASE = 0.26;

export type Box = { cx: number; cy: number; w: number; h: number; r: number };

export function stickerBox(st: Sticker, area: Rect): Box {
  const h = STICKER_BASE * Math.min(area.w, area.h) * st.s;
  return { cx: area.x + st.u * area.w, cy: area.y + st.v * area.h, w: h * STICKER_ASPECT[st.kind], h, r: st.r };
}

/** A point in the sticker's own (unrotated, centred) frame. */
export function toLocal(box: Box, px: number, py: number): { x: number; y: number } {
  const dx = px - box.cx;
  const dy = py - box.cy;
  const c = Math.cos(-box.r);
  const s = Math.sin(-box.r);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

export function inBox(box: Box, px: number, py: number, pad = 0): boolean {
  const p = toLocal(box, px, py);
  return Math.abs(p.x) <= box.w / 2 + pad && Math.abs(p.y) <= box.h / 2 + pad;
}

/** The top-most sticker under a point (the list is bottom → top), or -1. */
export function hitSticker(list: Sticker[], area: Rect, px: number, py: number, pad = 0): number {
  for (let i = list.length - 1; i >= 0; i--) if (inBox(stickerBox(list[i], area), px, py, pad)) return i;
  return -1;
}

/** The rotate / resize handle: the box's bottom-right corner, turned with it. */
export function handlePoint(box: Box): { x: number; y: number } {
  const c = Math.cos(box.r);
  const s = Math.sin(box.r);
  const lx = box.w / 2;
  const ly = box.h / 2;
  return { x: box.cx + lx * c - ly * s, y: box.cy + lx * s + ly * c };
}

export function onHandle(box: Box, px: number, py: number, radius: number): boolean {
  const h = handlePoint(box);
  return Math.hypot(px - h.x, py - h.y) <= radius;
}

const TAU = Math.PI * 2;
/** An angle folded into -π … π. */
export function normAngle(a: number): number {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x < -Math.PI) x += TAU;
  return x;
}

export function clampSticker(st: Sticker): Sticker {
  return {
    ...st,
    u: clamp(st.u, 0, 1),
    v: clamp(st.v, 0, 1),
    s: clamp(st.s, LIMITS.minScale, LIMITS.maxScale),
    r: normAngle(st.r),
  };
}

/** One finger / the mouse dragging a sticker by dx, dy picture pixels. */
export function dragSticker(start: Sticker, dx: number, dy: number, area: Rect): Sticker {
  if (area.w <= 0 || area.h <= 0) return start;
  return clampSticker({ ...start, u: start.u + dx / area.w, v: start.v + dy / area.h });
}

type Pt = { x: number; y: number };

/**
 * Two fingers: the sticker follows their midpoint, grows with their distance
 * and turns with the line between them. a0, b0 = where the fingers started.
 */
export function pinchSticker(start: Sticker, a0: Pt, b0: Pt, a1: Pt, b1: Pt, area: Rect): Sticker {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const ratio = d0 > 4 ? d1 / d0 : 1;
  const ang = Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
  const mx = (a1.x + b1.x) / 2 - (a0.x + b0.x) / 2;
  const my = (a1.y + b1.y) / 2 - (a0.y + b0.y) / 2;
  const moved = dragSticker(start, mx, my, area);
  return clampSticker({ ...moved, s: start.s * ratio, r: start.r + ang });
}

/** The corner handle: turn and resize about the sticker's centre. */
export function handleSticker(start: Sticker, center: Pt, from: Pt, to: Pt): Sticker {
  const d0 = Math.hypot(from.x - center.x, from.y - center.y);
  const d1 = Math.hypot(to.x - center.x, to.y - center.y);
  const ratio = d0 > 4 ? d1 / d0 : 1;
  const ang = Math.atan2(to.y - center.y, to.x - center.x) - Math.atan2(from.y - center.y, from.x - center.x);
  return clampSticker({ ...start, s: start.s * ratio, r: start.r + ang });
}

export type NudgeKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | '+' | '=' | '-' | '_' | '[' | ']' | 'r' | 'R';
export const NUDGE_KEYS: string[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', '[', ']', 'r', 'R'];

/** Keyboard: arrows move (Shift = further), + / − resize, [ ] or r / R turn by 15°. */
export function nudgeSticker(st: Sticker, key: string, big = false): Sticker {
  const step = big ? 0.05 : 0.01;
  const turn = Math.PI / 12;
  switch (key) {
    case 'ArrowLeft':
      return clampSticker({ ...st, u: st.u - step });
    case 'ArrowRight':
      return clampSticker({ ...st, u: st.u + step });
    case 'ArrowUp':
      return clampSticker({ ...st, v: st.v - step });
    case 'ArrowDown':
      return clampSticker({ ...st, v: st.v + step });
    case '+':
    case '=':
      return clampSticker({ ...st, s: st.s * (big ? 1.25 : 1.1) });
    case '-':
    case '_':
      return clampSticker({ ...st, s: st.s / (big ? 1.25 : 1.1) });
    case '[':
    case 'r':
      return clampSticker({ ...st, r: st.r - turn });
    case ']':
    case 'R':
      return clampSticker({ ...st, r: st.r + turn });
    default:
      return st;
  }
}

/** Move a sticker one layer up (+1) or down (-1); the same list when it can't move. */
export function shiftLayer(list: Sticker[], id: string, d: 1 | -1): Sticker[] {
  const i = list.findIndex((s) => s.id === id);
  const j = i + d;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const out = list.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function nextStickerId(list: Sticker[]): string {
  let n = 1;
  for (const s of list) {
    const m = /^s(\d+)$/.exec(s.id);
    if (m) n = Math.max(n, Number(m[1]) + 1);
  }
  return `s${n}`;
}

/** A new sticker, placed a little apart from the last one so they don't stack exactly. */
export function addSticker(list: Sticker[], kind: StickerKind): Sticker[] {
  if (list.length >= LIMITS.stickers) return list;
  const k = list.length % 5;
  const spots: [number, number][] = [
    [0.5, 0.42],
    [0.32, 0.3],
    [0.68, 0.3],
    [0.35, 0.68],
    [0.66, 0.66],
  ];
  const [u, v] = spots[k];
  return [...list, { id: nextStickerId(list), kind, u, v, s: kind === 'flags' ? 1.1 : 1, r: 0 }];
}

// ---------------- text ----------------

/** Visible characters, so a cut never splits a Devanagari letter from its vowel sign. */
export function graphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(text), (x) => x.segment);
  // Fallback: keep combining marks (incl. Devanagari matras, virama, nukta) on the letter before.
  const out: string[] = [];
  for (const ch of Array.from(text)) {
    if (out.length && /[ऀ-ःऺ-ॏ॑-ॗॢॣ‌‍̀-ͯ]/.test(ch)) out[out.length - 1] += ch;
    else if (out.length && /्$/.test(out[out.length - 1])) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

export function hasDevanagari(text: string): boolean {
  return /[ऀ-ॿ]/.test(text);
}

/**
 * The font size (≤ max, ≥ min) at which `text` fits `maxW`, given a
 * measure(text, size) → width. Below min it keeps min and shortens the text
 * with "…", cutting only between whole letters.
 */
export function fitText(
  measure: (text: string, size: number) => number,
  text: string,
  maxW: number,
  max: number,
  min: number
): { size: number; text: string } {
  if (!text) return { size: max, text: '' };
  const w = measure(text, max);
  if (w <= maxW) return { size: max, text };
  let size = Math.floor((max * maxW) / w);
  while (size > min && measure(text, size) > maxW) size -= 1;
  if (size >= min && measure(text, size) <= maxW) return { size, text };
  const g = graphemes(text);
  while (g.length > 1) {
    g.pop();
    const t = `${g.join('').trimEnd()}…`;
    if (measure(t, min) <= maxW) return { size: min, text: t };
  }
  return { size: min, text: '…' };
}

/** Two lines for a long title: at " · " if there is one, else at the space nearest the middle. */
export function splitTwo(text: string): [string, string] | null {
  const t = text.trim();
  const dot = t.indexOf(' · ');
  if (dot > 0) return [t.slice(0, dot).trim(), t.slice(dot + 3).trim()];
  const g = graphemes(t);
  const mid = g.length / 2;
  let best = -1;
  for (let i = 1; i < g.length - 1; i++) if (g[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  if (best < 0) return null;
  return [g.slice(0, best).join('').trim(), g.slice(best + 1).join('').trim()];
}

/**
 * An event name in its band: one line when that is at least as big as two
 * lines would be, else two lines at the same size.
 */
export function fitTitle(
  measure: (text: string, size: number) => number,
  text: string,
  maxW: number,
  oneMax: number,
  twoMax: number,
  min: number
): { size: number; lines: string[] } {
  const one = fitText(measure, text, maxW, oneMax, min);
  const whole = one.text === text;
  if (!text || (whole && one.size >= twoMax)) return { size: one.size, lines: one.text ? [one.text] : [] };
  const sp = splitTwo(text);
  if (!sp || !sp[0] || !sp[1]) return { size: one.size, lines: [one.text] };
  const a = fitText(measure, sp[0], maxW, twoMax, min);
  const b = fitText(measure, sp[1], maxW, twoMax, min);
  const size = Math.min(a.size, b.size);
  if (whole && one.size >= size) return { size: one.size, lines: [one.text] };
  return { size, lines: [fitText(measure, sp[0], maxW, size, min).text, fitText(measure, sp[1], maxW, size, min).text] };
}

/** Visitor text: no control characters, single spaces, capped by visible letters. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001F\u007F-\u009F‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trimStart();
  const g = graphemes(s);
  return g.length > max ? g.slice(0, max).join('') : s;
}

/** A hashtag: no spaces or #s inside, one # in front (none when empty). */
export function cleanTag(v: unknown): string {
  const s = cleanText(v, LIMITS.tag + 4)
    .replace(/[\s#]+/g, '')
    .replace(/[^\p{L}\p{M}\p{N}_]/gu, '');
  const g = graphemes(s).slice(0, LIMITS.tag - 1).join('');
  return g ? `#${g}` : '';
}

// ---------------- filters (pixel maths) ----------------

/**
 * Applies a filter and brightness (-0.4 … 0.4) to RGBA pixels in place.
 * Same result in every browser (canvas `ctx.filter` is not everywhere).
 */
export function applyFilter(px: Uint8ClampedArray, filter: FilterId, brightness = 0): void {
  const b = 1 + clamp(brightness, -LIMITS.brightness, LIMITS.brightness);
  if (filter === 'none' && b === 1) return;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i];
    let g = px[i + 1];
    let bl = px[i + 2];
    if (filter === 'warm') {
      r = r * 1.07 + 12;
      g = g * 1.02 + 5;
      bl = bl * 0.86;
    } else if (filter === 'mono') {
      const y = 0.299 * r + 0.587 * g + 0.114 * bl;
      const c = (y - 128) * 1.12 + 128;
      r = g = bl = c;
    } else if (filter === 'glow') {
      const y = 0.299 * r + 0.587 * g + 0.114 * bl;
      // more colour, lifted shadows, a little gold in the highlights
      r = y + (r - y) * 1.32;
      g = y + (g - y) * 1.32;
      bl = y + (bl - y) * 1.32;
      r = r * 0.9 + 26;
      g = g * 0.9 + 18;
      bl = bl * 0.9 + 14;
    }
    px[i] = r * b;
    px[i + 1] = g * b;
    px[i + 2] = bl * b;
  }
}

// ---------------- saved state ----------------

export type BoothText = { title: string; date: string; tag: string };

export type WallItem = { id: string; src: string; at: number };

export type Saved = {
  lang: Lang | null;
  frame: FrameId;
  format: FormatId;
  mode: ShotMode;
  filter: FilterId;
  brightness: number;
  text: BoothText;
  edited: boolean;
  stickers: Sticker[];
  sound: boolean;
  logo: string;
  wall: WallItem[];
};

export const asLang = (v: unknown): Lang | null => (LANG_IDS.includes(v as Lang) ? (v as Lang) : null);
const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function normalizeSticker(v: unknown, i: number): Sticker | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!STICKER_KINDS.includes(o.kind as StickerKind)) return null;
  const id = typeof o.id === 'string' && /^s\d{1,4}$/.test(o.id) ? o.id : `s${i + 1}`;
  return clampSticker({ id, kind: o.kind as StickerKind, u: num(o.u, 0.5), v: num(o.v, 0.5), s: num(o.s, 1), r: num(o.r, 0) });
}

/** Small JPEG / PNG data URLs only (the wall's thumbnails, the organizer's logo). */
export function isSmallImage(v: unknown, maxBytes: number): v is string {
  return typeof v === 'string' && v.length <= maxBytes && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
}

export function normalizeSaved(v: unknown, defaults: Saved): Saved {
  if (!v || typeof v !== 'object') return defaults;
  const o = v as Record<string, unknown>;
  const t = (o.text && typeof o.text === 'object' ? o.text : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const stickers = (Array.isArray(o.stickers) ? o.stickers : [])
    .slice(0, LIMITS.stickers)
    .map(normalizeSticker)
    .filter((s): s is Sticker => !!s && !seen.has(s.id) && !!seen.add(s.id));
  const wall = (Array.isArray(o.wall) ? o.wall : [])
    .filter((w): w is Record<string, unknown> => !!w && typeof w === 'object')
    .filter((w) => isSmallImage(w.src, 24_000))
    .slice(0, LIMITS.wall)
    .map((w, i) => ({ id: typeof w.id === 'string' ? w.id.slice(0, 20) : `w${i}`, src: w.src as string, at: num(w.at, 0) }));
  const edited = o.edited === true;
  return {
    lang: asLang(o.lang),
    frame: pick(o.frame, FRAME_IDS, defaults.frame),
    format: pick(o.format, FORMAT_IDS, defaults.format),
    mode: pick(o.mode, ['single', 'strip'] as const, defaults.mode),
    filter: pick(o.filter, FILTER_IDS, defaults.filter),
    brightness: clamp(num(o.brightness, 0), -LIMITS.brightness, LIMITS.brightness),
    text: edited
      ? { title: cleanText(t.title, LIMITS.title), date: cleanText(t.date, LIMITS.date), tag: cleanTag(t.tag) }
      : defaults.text,
    edited,
    stickers: Array.isArray(o.stickers) ? stickers : defaults.stickers,
    sound: o.sound !== false,
    logo: isSmallImage(o.logo, LIMITS.logoBytes) ? o.logo : '',
    wall,
  };
}

/** Newest first, at most `cap`. */
export function pushWall(wall: WallItem[], item: WallItem, cap: number = LIMITS.wall): WallItem[] {
  return [item, ...wall.filter((w) => w.id !== item.id)].slice(0, Math.max(0, cap));
}

/** Drops the oldest thumbnails until the whole saved JSON fits `maxBytes`. */
export function trimToBudget(s: Saved, maxBytes: number = LIMITS.storeBytes): Saved {
  let out = s;
  while (JSON.stringify(out).length > maxBytes && out.wall.length) out = { ...out, wall: out.wall.slice(0, -1) };
  if (JSON.stringify(out).length > maxBytes) out = { ...out, logo: '' };
  return out;
}

// ---------------- the organizer's booth link ----------------

export type Preset = { frame: FrameId; text: BoothText };

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** The frame and words for the guests' booth, packed into a short #b=… code (no logo, no photos). */
export function encodePreset(p: Preset): string {
  return b64urlEncode(
    JSON.stringify({ f: p.frame, t: cleanText(p.text.title, LIMITS.title), d: cleanText(p.text.date, LIMITS.date), h: cleanTag(p.text.tag) })
  );
}

export function decodePreset(code: string): Preset | null {
  if (!code || code.length > LIMITS.hash) return null;
  const json = b64urlDecode(code);
  if (!json) return null;
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    if (!o || typeof o !== 'object' || !FRAME_IDS.includes(o.f as FrameId)) return null;
    return {
      frame: o.f as FrameId,
      text: { title: cleanText(o.t, LIMITS.title).trim(), date: cleanText(o.d, LIMITS.date).trim(), tag: cleanTag(o.h) },
    };
  } catch {
    return null;
  }
}

/** `#b=…` (or a whole URL ending in it) → a preset. */
export function readPresetHash(hash: string): Preset | null {
  const m = /#b=([A-Za-z0-9_-]+)/.exec(hash);
  return m ? decodePreset(m[1]) : null;
}

export function boothUrl(origin: string, p: Preset): string {
  return `${origin.replace(/\/+$/, '')}/work/booth#b=${encodePreset(p)}`;
}

// ---------------- names, numbers ----------------

export function slug(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'event'
  );
}

export function fileName(title: string, layout: LayoutId, ext: 'png' | 'jpg'): string {
  return `photo-booth-${slug(title)}-${layout}.${ext}`;
}

/** Small seeded random numbers, so the drawn art looks the same every time. */
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

/** The A4 poster: 150 dpi. */
export const POSTER = { w: 1240, h: 1754 } as const;
