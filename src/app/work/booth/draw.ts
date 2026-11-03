// /work/booth — everything painted on a canvas: the six festive frames, the
// stickers, the sample scene (silhouettes only, no real people), the photo
// layer with its filter, and the organizer's A4 QR poster. All of it is drawn
// here in code — there are no bundled images.
//
// Every function works in the layout's own pixels (1080 wide for a square
// picture, …); the caller scales the context for a smaller preview.

import QRCode from 'qrcode';
import {
  STICKER_ASPECT,
  applyFilter,
  coverCrop,
  fitText,
  fitTitle,
  handlePoint,
  hasDevanagari,
  mulberry32,
  stickerBox,
  type BoothText,
  type FilterId,
  type FrameId,
  type Layout,
  type Rect,
  type Sticker,
  type StickerKind,
} from './booth';
import { GREETING } from './content';

export type Ctx = CanvasRenderingContext2D;
export type DrawFonts = { head: string; body: string };
export type Pic = HTMLCanvasElement | HTMLImageElement | ImageBitmap;

type Pal = { bg0: string; bg1: string; ink: string; sub: string; accent: string; photoBg: string; serif?: boolean };

export const PALETTES: Record<FrameId, Pal> = {
  dashain: { bg0: '#fff3d6', bg1: '#ffc96b', ink: '#7a1010', sub: '#8a3b0c', accent: '#c2410c', photoBg: '#f5deb3' },
  tihar: { bg0: '#2a0b4a', bg1: '#12062a', ink: '#fde68a', sub: '#f5d0fe', accent: '#fb923c', photoBg: '#3b1660' },
  teej: { bg0: '#c8102e', bg1: '#7f0a1f', ink: '#fff7d6', sub: '#bbf7d0', accent: '#86efac', photoBg: '#5c0a17' },
  newyear: { bg0: '#fff1e6', bg1: '#ffc2b3', ink: '#7f1d1d', sub: '#9a3412', accent: '#be123c', photoBg: '#fde2d4' },
  concert: { bg0: '#14002e', bg1: '#030309', ink: '#ffffff', sub: '#67e8f9', accent: '#f472b6', photoBg: '#1e1b3a' },
  wedding: { bg0: '#8f0b16', bg1: '#4f050c', ink: '#fbe7b5', sub: '#f3c97a', accent: '#f0c46c', photoBg: '#3d0409', serif: true },
};

/** A swatch for the frame chips. */
export function frameSwatch(f: FrameId): string {
  const p = PALETTES[f];
  return `linear-gradient(135deg, ${p.bg0}, ${p.bg1} 60%, ${p.accent})`;
}

// ---------------- small helpers ----------------

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function circle(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function glowDot(ctx: Ctx, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A flower of `n` round petals (marigold, rangoli, laliguras). */
function flower(ctx: Ctx, x: number, y: number, r: number, n: number, petal: string, centre: string, rot = 0) {
  ctx.fillStyle = petal;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.3, a, 0, Math.PI * 2);
    ctx.fill();
  }
  circle(ctx, x, y, r * 0.32, centre);
}

function marigold(ctx: Ctx, x: number, y: number, r: number, light = '#fbbf24', dark = '#ea580c') {
  circle(ctx, x, y, r, dark);
  circle(ctx, x, y, r * 0.78, light);
  ctx.fillStyle = dark;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    circle(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.14, dark);
  }
  circle(ctx, x, y, r * 0.3, '#f59e0b');
}

/** Points along a hanging garland between two points. */
function sag(x0: number, y0: number, x1: number, y1: number, drop: number, t: number) {
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * drop };
}

function measureWith(ctx: Ctx, weight: string, family: string, style = '') {
  return (text: string, size: number) => {
    ctx.font = `${style}${weight} ${size}px ${family}`;
    return ctx.measureText(text).width;
  };
}

// ---------------- the frames ----------------

function background(ctx: Ctx, L: Layout, p: Pal) {
  const g = ctx.createLinearGradient(0, 0, L.w * 0.3, L.h);
  g.addColorStop(0, p.bg0);
  g.addColorStop(1, p.bg1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.w, L.h);
}

function kite(ctx: Ctx, x: number, y: number, s: number, rot: number, a: string, b: string, tail: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.8, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.8, 0);
  ctx.closePath();
  ctx.fillStyle = a;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.8, 0);
  ctx.lineTo(0, s);
  ctx.closePath();
  ctx.fillStyle = b;
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,20,0,0.55)';
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(0, s);
  ctx.moveTo(-s * 0.8, 0);
  ctx.lineTo(s * 0.8, 0);
  ctx.stroke();
  // tail
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.lineTo(-s * 0.22, s * 1.35);
  ctx.lineTo(s * 0.22, s * 1.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function jamara(ctx: Ctx, x: number, y: number, s: number, rand: () => number) {
  // a small clay pot of barley shoots
  ctx.save();
  for (let i = 0; i < 22; i++) {
    const bx = x + (rand() - 0.5) * s * 0.7;
    const hgt = s * (0.8 + rand() * 0.9);
    const lean = (rand() - 0.5) * s * 0.7;
    ctx.strokeStyle = i % 3 === 0 ? '#d9e36a' : i % 3 === 1 ? '#b5cf3a' : '#e8e08a';
    ctx.lineWidth = s * (0.035 + rand() * 0.03);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(bx + lean * 0.3, y - hgt * 0.6, bx + lean, y - hgt);
    ctx.stroke();
  }
  ctx.fillStyle = '#9a3412';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y - s * 0.05);
  ctx.lineTo(x + s * 0.5, y - s * 0.05);
  ctx.lineTo(x + s * 0.36, y + s * 0.45);
  ctx.lineTo(x - s * 0.36, y + s * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c2410c';
  ctx.fillRect(x - s * 0.55, y - s * 0.12, s * 1.1, s * 0.12);
  ctx.restore();
}

function tikaDot(ctx: Ctx, x: number, y: number, s: number, rand: () => number) {
  ctx.fillStyle = '#d1131f';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.6, s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff8e7';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(x + (rand() - 0.5) * s * 0.8, y + (rand() - 0.5) * s * 1.4, s * 0.16, s * 0.08, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function diyo(ctx: Ctx, x: number, y: number, s: number) {
  glowDot(ctx, x, y - s * 0.9, s * 1.6, 'rgba(253,186,116,0.55)');
  // flame
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.25);
  ctx.quadraticCurveTo(x + s * 0.32, y - s * 0.6, x, y - s * 0.32);
  ctx.quadraticCurveTo(x - s * 0.32, y - s * 0.6, x, y - s * 1.25);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.5, s * 0.1, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // clay bowl
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.8, y - s * 0.3);
  ctx.quadraticCurveTo(x, y + s * 0.65, x + s * 0.8, y - s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.3, s * 0.8, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  for (let i = -2; i <= 2; i++) circle(ctx, x + i * s * 0.28, y + s * 0.02, s * 0.05, '#fbbf24');
}

function rangoli(ctx: Ctx, x: number, y: number, r: number) {
  const rings: [number, number, string][] = [
    [1, 16, '#ec4899'],
    [0.78, 12, '#facc15'],
    [0.56, 10, '#22d3ee'],
    [0.34, 8, '#f97316'],
  ];
  for (const [k, n, c] of rings) flower(ctx, x, y, r * k, n, c, 'rgba(0,0,0,0)', k * 2);
  circle(ctx, x, y, r * 0.14, '#ffffff');
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    circle(ctx, x + Math.cos(a) * r * 1.12, y + Math.sin(a) * r * 1.12, r * 0.04, '#ffffff');
  }
}

function bangles(ctx: Ctx, x: number, y: number, r: number, rot: number) {
  const colors = ['#16a34a', '#dc2626', '#facc15', '#15803d', '#ef4444', '#22c55e', '#eab308'];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  colors.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = r * 0.13;
    ctx.beginPath();
    ctx.ellipse(i * r * 0.17 - r * 0.5, 0, r * 0.32, r, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = r * 0.025;
    ctx.beginPath();
    ctx.ellipse(i * r * 0.17 - r * 0.5, 0, r * 0.32, r * 0.95, 0, Math.PI * 1.1, Math.PI * 1.5);
    ctx.stroke();
  });
  ctx.restore();
}

function laliguras(ctx: Ctx, x: number, y: number, r: number, rand: () => number) {
  ctx.fillStyle = '#166534';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, r * 0.75, r * 0.28, a, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const fx = x + Math.cos(a) * r * 0.7 + (rand() - 0.5) * r * 0.2;
    const fy = y + Math.sin(a) * r * 0.7 + (rand() - 0.5) * r * 0.2;
    flower(ctx, fx, fy, r * 0.62, 5, i % 2 ? '#dc2626' : '#e11d48', '#fde68a', rand() * 2);
  }
  flower(ctx, x, y, r * 0.7, 5, '#be123c', '#fde68a', 0.4);
}

function mountains(ctx: Ctx, x0: number, x1: number, base: number, hgt: number, color: string, snow: string, seed: number) {
  const rand = mulberry32(seed);
  const pts: [number, number][] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) pts.push([x0 + ((x1 - x0) * i) / n, base - hgt * (i % 2 ? 0.55 + rand() * 0.45 : 0.15 + rand() * 0.25)]);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, base);
  for (const [px, py] of pts) ctx.lineTo(px, py);
  ctx.lineTo(x1, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = snow;
  for (let i = 1; i < pts.length - 1; i += 2) {
    const [px, py] = pts[i];
    const w = (x1 - x0) / n;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + w * 0.28, py + hgt * 0.16);
    ctx.lineTo(px + w * 0.08, py + hgt * 0.12);
    ctx.lineTo(px - w * 0.05, py + hgt * 0.18);
    ctx.lineTo(px - w * 0.26, py + hgt * 0.15);
    ctx.closePath();
    ctx.fill();
  }
}

function goldCorner(ctx: Ctx, x: number, y: number, s: number, sx: number, sy: number, gold: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.strokeStyle = gold;
  ctx.fillStyle = gold;
  ctx.lineWidth = s * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.lineTo(0, 0);
  ctx.lineTo(s, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.32, s * 0.32, s * 0.24, Math.PI * 0.9, Math.PI * 2.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.6, s * 0.12, s * 0.14, Math.PI * 0.2, Math.PI * 1.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.12, s * 0.6, s * 0.14, Math.PI * 1.1, Math.PI * 2.3);
  ctx.stroke();
  circle(ctx, s * 0.32, s * 0.32, s * 0.07, gold);
  circle(ctx, s * 0.82, s * 0.06, s * 0.04, gold);
  circle(ctx, s * 0.06, s * 0.82, s * 0.04, gold);
  // a little paisley
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.5);
  ctx.bezierCurveTo(s * 0.85, s * 0.35, s * 0.85, s * 0.8, s * 0.55, s * 0.78);
  ctx.bezierCurveTo(s * 0.42, s * 0.76, s * 0.44, s * 0.6, s * 0.5, s * 0.5);
  ctx.stroke();
  ctx.restore();
}

/** Painted under the photo. */
function frameBack(ctx: Ctx, L: Layout, f: FrameId) {
  const p = PALETTES[f];
  const u = L.w / 1080;
  const A = L.area;
  const rand = mulberry32(7);
  background(ctx, L, p);
  ctx.save();
  switch (f) {
    case 'dashain': {
      // soft sun rays behind everything
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#ffffff';
      const cx = L.w / 2;
      const cy = A.y + A.h / 2;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, L.h, a, a + 0.07);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 6 * u;
      ctx.strokeRect(L.margin * 0.35, L.margin * 0.35, L.w - L.margin * 0.7, L.h - L.margin * 0.7);
      ctx.lineWidth = 2 * u;
      ctx.strokeRect(L.margin * 0.5, L.margin * 0.5, L.w - L.margin, L.h - L.margin);
      // kite strings from the top corners
      ctx.strokeStyle = 'rgba(122,16,16,0.45)';
      ctx.lineWidth = 2.5 * u;
      ctx.beginPath();
      ctx.moveTo(L.margin * 1.6, L.title.y + L.title.h * 0.55);
      ctx.quadraticCurveTo(L.margin * 0.4, L.title.y + L.title.h, -10, A.y + A.h * 0.3);
      ctx.moveTo(L.w - L.margin * 1.6, L.title.y + L.title.h * 0.4);
      ctx.quadraticCurveTo(L.w - L.margin * 0.2, L.title.y + L.title.h * 1.2, L.w + 10, A.y + A.h * 0.45);
      ctx.stroke();
      break;
    }
    case 'tihar': {
      for (let i = 0; i < 70; i++) circle(ctx, rand() * L.w, rand() * L.h, (1 + rand() * 2.5) * u, `rgba(253,230,138,${0.25 + rand() * 0.5})`);
      glowDot(ctx, L.w / 2, L.h, L.w * 0.7, 'rgba(251,146,60,0.28)');
      break;
    }
    case 'teej': {
      ctx.fillStyle = 'rgba(253,224,71,0.35)';
      for (let y = 18 * u; y < L.h; y += 36 * u)
        for (let x = ((y / (36 * u)) % 2) * 18 * u; x < L.w; x += 36 * u) circle(ctx, x, y, 2.4 * u, 'rgba(253,224,71,0.3)');
      // green borders like pote beads
      for (const side of [0, 1]) {
        const x = side ? L.w - L.margin * 0.45 : L.margin * 0.45;
        for (let y = L.margin * 0.5; y < L.h - L.margin * 0.4; y += 13 * u) circle(ctx, x, y, 5.5 * u, (y / (13 * u)) % 6 < 1 ? '#facc15' : '#16a34a');
      }
      break;
    }
    case 'newyear': {
      // first light of the year: soft rays from behind the photo's top edge
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 18; i++) {
        const a = Math.PI + (i / 17) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(L.w / 2, A.y + A.h * 0.2);
        ctx.arc(L.w / 2, A.y + A.h * 0.2, L.h, a - 0.045, a + 0.045);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const base = L.h;
      mountains(ctx, -20, L.w + 20, base, L.meta.h * 0.95 + L.margin * 0.5, '#fecdd3', '#ffffff', 3);
      mountains(ctx, -40, L.w + 40, base, L.meta.h * 0.6 + L.margin * 0.3, '#fda4af', '#fff1f2', 11);
      break;
    }
    case 'concert': {
      // stage beams
      const beams: [number, string][] = [
        [0.1, 'rgba(244,114,182,0.32)'],
        [0.9, 'rgba(103,232,249,0.3)'],
        [0.5, 'rgba(167,139,250,0.22)'],
      ];
      for (const [bx, c] of beams) {
        const g = ctx.createLinearGradient(0, 0, 0, L.h * 0.8);
        g.addColorStop(0, c);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(L.w * bx - 14 * u, 0);
        ctx.lineTo(L.w * bx + 14 * u, 0);
        ctx.lineTo(L.w * (0.5 + (0.5 - bx) * 0.9) + 160 * u, L.h * 0.8);
        ctx.lineTo(L.w * (0.5 + (0.5 - bx) * 0.9) - 160 * u, L.h * 0.8);
        ctx.closePath();
        ctx.fill();
      }
      // equalizer bars along the bottom
      const bars = 26;
      const bw = L.w / bars;
      for (let i = 0; i < bars; i++) {
        const hh = L.margin * (0.3 + rand() * 1.1);
        const g = ctx.createLinearGradient(0, L.h - hh, 0, L.h);
        g.addColorStop(0, i % 2 ? '#f472b6' : '#67e8f9');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(i * bw + bw * 0.18, L.h - hh, bw * 0.64, hh);
      }
      break;
    }
    case 'wedding': {
      ctx.strokeStyle = 'rgba(240,196,108,0.12)';
      ctx.lineWidth = 2 * u;
      for (let i = -L.h; i < L.w; i += 44 * u) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + L.h, L.h);
        ctx.stroke();
      }
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 5 * u;
      ctx.strokeRect(L.margin * 0.3, L.margin * 0.3, L.w - L.margin * 0.6, L.h - L.margin * 0.6);
      ctx.lineWidth = 1.6 * u;
      ctx.strokeRect(L.margin * 0.48, L.margin * 0.48, L.w - L.margin * 0.96, L.h - L.margin * 0.96);
      break;
    }
  }
  ctx.restore();
  // the photo's own backing, a hair bigger than the window
  ctx.fillStyle = p.photoBg;
  for (const c of L.cells) {
    rr(ctx, c.x - 6 * u, c.y - 6 * u, c.w + 12 * u, c.h + 12 * u, L.radius + 6 * u);
    ctx.fill();
  }
}

/** Painted over the photo's edges. */
function frameFront(ctx: Ctx, L: Layout, f: FrameId) {
  const p = PALETTES[f];
  const u = L.w / 1080;
  const A = L.area;
  const rand = mulberry32(21);
  ctx.save();
  // a thin edge on every cell
  ctx.strokeStyle = f === 'dashain' || f === 'newyear' ? 'rgba(255,255,255,0.95)' : p.accent;
  ctx.lineWidth = (f === 'wedding' ? 5 : 7) * u;
  for (const c of L.cells) {
    rr(ctx, c.x, c.y, c.w, c.h, L.radius);
    ctx.stroke();
  }
  switch (f) {
    case 'dashain': {
      const k = Math.min(L.title.h * 0.32, 74 * u);
      kite(ctx, L.margin * 1.6, L.title.y + L.title.h * 0.48, k, -0.35, '#dc2626', '#facc15', '#16a34a');
      kite(ctx, L.w - L.margin * 1.6, L.title.y + L.title.h * 0.38, k * 0.85, 0.3, '#2563eb', '#f8fafc', '#dc2626');
      const j = Math.min(L.meta.h * 0.55, 92 * u);
      jamara(ctx, A.x + j * 0.35, A.y + A.h + j * 0.1, j, rand);
      jamara(ctx, A.x + A.w - j * 0.35, A.y + A.h + j * 0.1, j, rand);
      break;
    }
    case 'tihar': {
      // marigold garlands swagging across the top of the photo
      const swags = L.id === 'strip' ? 2 : 3;
      const r = 13 * u;
      for (let s = 0; s < swags; s++) {
        const x0 = A.x + (A.w * s) / swags;
        const x1 = A.x + (A.w * (s + 1)) / swags;
        const drop = (x1 - x0) * 0.18;
        const n = Math.round((x1 - x0) / (r * 1.6));
        for (let i = 0; i <= n; i++) {
          const q = sag(x0, A.y, x1, A.y, drop, i / n);
          marigold(ctx, q.x, q.y, r, i % 2 ? '#fbbf24' : '#fb923c', i % 2 ? '#ea580c' : '#c2410c');
        }
        // tassel
        const t = sag(x0, A.y, x1, A.y, drop, 0);
        for (let i = 1; i < 4; i++) marigold(ctx, t.x, t.y + i * r * 1.7, r * 0.9);
      }
      const t = sag(A.x + A.w, A.y, A.x + A.w, A.y, 0, 0);
      for (let i = 1; i < 4; i++) marigold(ctx, t.x, t.y + i * r * 1.7, r * 0.9);
      // diyos along the bottom band edges
      const d = Math.min(L.meta.h * 0.34, 44 * u);
      diyo(ctx, A.x + d * 1.2, L.meta.y + L.meta.h * 0.55, d);
      diyo(ctx, A.x + A.w - d * 1.2, L.meta.y + L.meta.h * 0.55, d);
      // rangoli in the title band corners
      const rg = Math.min(L.title.h * 0.32, 70 * u);
      rangoli(ctx, L.margin + rg * 0.6, L.title.y + L.title.h * 0.5, rg);
      rangoli(ctx, L.w - L.margin - rg * 0.6, L.title.y + L.title.h * 0.5, rg);
      break;
    }
    case 'teej': {
      const b = Math.min(L.w * 0.09, 100 * u);
      bangles(ctx, A.x + b * 0.3, A.y + A.h - b * 0.2, b * 0.8, -0.5);
      bangles(ctx, A.x + A.w - b * 0.3, A.y + b * 0.1, b * 0.8, 0.6);
      // mehendi dots by the title
      for (const side of [-1, 1]) {
        const cx = L.w / 2 + side * L.title.w * 0.46;
        const cy = L.title.y + L.title.h * 0.55;
        const r = Math.min(L.title.h * 0.2, 40 * u);
        flower(ctx, cx, cy, r, 8, '#86efac', '#facc15');
        circle(ctx, cx, cy, r * 0.12, '#c8102e');
      }
      break;
    }
    case 'newyear': {
      const r = Math.min(L.title.h * 0.2, 48 * u);
      laliguras(ctx, A.x + r * 0.4, A.y + r * 0.2, r, rand);
      laliguras(ctx, A.x + A.w - r * 0.4, A.y + r * 0.2, r, rand);
      break;
    }
    case 'concert': {
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 24 * u;
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 4 * u;
      for (const c of L.cells) {
        rr(ctx, c.x - 12 * u, c.y - 12 * u, c.w + 24 * u, c.h + 24 * u, L.radius + 12 * u);
        ctx.stroke();
      }
      ctx.shadowColor = '#67e8f9';
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2.5 * u;
      for (const c of L.cells) {
        rr(ctx, c.x - 22 * u, c.y - 22 * u, c.w + 44 * u, c.h + 44 * u, L.radius + 22 * u);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      // LIVE badge on the photo's top-right corner
      const bh = 46 * u;
      const bw = 128 * u;
      const bx = A.x + A.w - bw - 18 * u;
      const by = A.y + 18 * u;
      ctx.fillStyle = '#e11d48';
      rr(ctx, bx, by, bw, bh, bh / 2);
      ctx.fill();
      circle(ctx, bx + bh * 0.5, by + bh / 2, bh * 0.16, '#ffffff');
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${bh * 0.56}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('LIVE', bx + bh * 0.85, by + bh / 2 + 1);
      break;
    }
    case 'wedding': {
      const s = Math.min(A.w * 0.16, 120 * u);
      const o = 16 * u;
      goldCorner(ctx, A.x - o, A.y - o, s, 1, 1, p.accent);
      goldCorner(ctx, A.x + A.w + o, A.y - o, s, -1, 1, p.accent);
      goldCorner(ctx, A.x - o, A.y + A.h + o, s, 1, -1, p.accent);
      goldCorner(ctx, A.x + A.w + o, A.y + A.h + o, s, -1, -1, p.accent);
      marigold(ctx, A.x - o + s * 0.32, A.y - o + s * 0.32, s * 0.12);
      marigold(ctx, A.x + A.w + o - s * 0.32, A.y + A.h + o - s * 0.32, s * 0.12);
      break;
    }
  }
  ctx.restore();
}

function titleFamily(f: FrameId, text: string, fonts: DrawFonts) {
  if (PALETTES[f].serif && !hasDevanagari(text)) return { family: `Georgia, 'Times New Roman', serif`, weight: '700', style: 'italic ' };
  return { family: fonts.head, weight: '800', style: '' };
}

function frameText(ctx: Ctx, L: Layout, f: FrameId, text: BoothText, fonts: DrawFonts, logo: Pic | null) {
  const p = PALETTES[f];
  const u = L.w / 1080;
  const T = L.title;
  const M = L.meta;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = L.w / 2;
  const sideArt = f === 'dashain' || f === 'tihar' || f === 'teej' ? 0.62 : f === 'concert' ? 0.86 : 0.8;
  let maxW = T.w * sideArt;
  // the organizer's logo, as a round badge left of the words
  if (logo) {
    const r = Math.min(T.h * 0.26, 64 * u);
    const lx = L.w / 2 - maxW / 2 + r;
    const ly = T.y + T.h * 0.6;
    maxW -= r * 2.4 * 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10 * u;
    circle(ctx, lx, ly, r, '#ffffff');
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(lx, ly, r * 0.86, 0, Math.PI * 2);
    ctx.clip();
    const lw = 'naturalWidth' in logo ? logo.naturalWidth : logo.width;
    const lh = 'naturalHeight' in logo ? logo.naturalHeight : logo.height;
    const k = Math.min((r * 1.72) / lw, (r * 1.72) / lh);
    ctx.drawImage(logo, lx - (lw * k) / 2, ly - (lh * k) / 2, lw * k, lh * k);
    ctx.restore();
  }
  // greeting
  const gSize = Math.min(T.h * 0.25, 50 * u);
  ctx.font = `700 ${gSize}px ${fonts.body}`;
  ctx.fillStyle = p.accent;
  const greet = GREETING[f];
  const gY = T.y + T.h * 0.16;
  ctx.fillText(greet, cx, gY);
  if (f === 'dashain') {
    const gw = ctx.measureText(greet).width;
    const rand = mulberry32(5);
    tikaDot(ctx, cx - gw / 2 - gSize * 0.7, gY, gSize * 0.32, rand);
    tikaDot(ctx, cx + gw / 2 + gSize * 0.7, gY, gSize * 0.32, rand);
  }
  // event name
  const title = text.title.trim();
  if (title) {
    const fam = titleFamily(f, title, fonts);
    const space = T.h - (gY - T.y) - gSize * 0.7;
    const fitted = fitTitle(measureWith(ctx, fam.weight, fam.family, fam.style), title, maxW, Math.min(space * 0.7, 120 * u), space * 0.44, Math.max(18 * u, space * 0.2));
    ctx.font = `${fam.style}${fam.weight} ${fitted.size}px ${fam.family}`;
    ctx.fillStyle = p.ink;
    if (f === 'concert') {
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 18 * u;
    }
    const lh = fitted.size * 1.08;
    const top = gY + gSize * 0.7 + (space - lh * fitted.lines.length) / 2 + lh / 2;
    fitted.lines.forEach((line, i) => ctx.fillText(line, cx, top + i * lh));
    ctx.shadowBlur = 0;
  }
  // date and hashtag
  const metaW = M.w * (f === 'tihar' ? 0.66 : 0.9);
  const date = text.date.trim();
  const tag = text.tag.trim();
  const rows = (date ? 1 : 0) + (tag ? 1 : 0);
  const rowH = M.h / Math.max(1.6, rows + 0.1);
  let y = M.y + (M.h - rowH * rows) / 2 + rowH / 2;
  if (date) {
    const d = fitText(measureWith(ctx, '600', fonts.body), date, metaW, Math.min(rowH * 0.66, 52 * u), 14 * u);
    ctx.font = `600 ${d.size}px ${fonts.body}`;
    ctx.fillStyle = p.sub;
    ctx.fillText(d.text, cx, y);
    y += rowH;
  }
  if (tag) {
    const h = fitText(measureWith(ctx, '800', fonts.head), tag, metaW, Math.min(rowH * 0.8, 62 * u), 14 * u);
    ctx.font = `800 ${h.size}px ${fonts.head}`;
    ctx.fillStyle = f === 'dashain' || f === 'newyear' ? p.accent : p.ink;
    ctx.fillText(h.text, cx, y);
  }
  ctx.restore();
}

// ---------------- stickers ----------------

/** Draws a sticker centred on 0,0 in a w×h box. */
export function drawSticker(ctx: Ctx, kind: StickerKind, w: number, h: number, fonts: DrawFonts) {
  const edge = Math.max(2, h * 0.05);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.32)';
  ctx.shadowBlur = h * 0.08;
  ctx.shadowOffsetY = h * 0.03;
  switch (kind) {
    case 'topi': {
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(-w * 0.47, h * 0.4);
        ctx.lineTo(-w * 0.4, -h * 0.18);
        ctx.quadraticCurveTo(-w * 0.1, -h * 0.5, w * 0.36, -h * 0.34);
        ctx.lineTo(w * 0.47, h * 0.4);
        ctx.quadraticCurveTo(0, h * 0.5, -w * 0.47, h * 0.4);
        ctx.closePath();
      };
      path();
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = edge * 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#f7efe1';
      ctx.fill();
      ctx.save();
      path();
      ctx.clip();
      const cols = ['#b91c1c', '#111827', '#ea580c', '#15803d', '#1d4ed8', '#b91c1c'];
      const cell = h * 0.14;
      for (let r = 0; r < 10; r++)
        for (let c = 0; c < 14; c++) {
          const x = -w / 2 + c * cell + (r % 2) * cell * 0.5;
          const y = -h / 2 + r * cell;
          ctx.fillStyle = cols[(r + c * 2) % cols.length];
          ctx.beginPath();
          ctx.moveTo(x, y - cell * 0.38);
          ctx.lineTo(x + cell * 0.3, y);
          ctx.lineTo(x, y + cell * 0.38);
          ctx.lineTo(x - cell * 0.3, y);
          ctx.closePath();
          ctx.fill();
        }
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-w / 2, h * 0.24, w, h * 0.3);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-w / 2, h * 0.24, w, h * 0.025);
      ctx.restore();
      path();
      ctx.strokeStyle = '#3f1d0d';
      ctx.lineWidth = edge * 0.5;
      ctx.stroke();
      break;
    }
    case 'shades': {
      const lens = (sx: number) => {
        ctx.beginPath();
        ctx.moveTo(sx * w * 0.06, -h * 0.28);
        ctx.lineTo(sx * w * 0.46, -h * 0.3);
        ctx.quadraticCurveTo(sx * w * 0.48, h * 0.42, sx * w * 0.26, h * 0.4);
        ctx.quadraticCurveTo(sx * w * 0.06, h * 0.38, sx * w * 0.06, -h * 0.28);
        ctx.closePath();
      };
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = edge * 2.2;
      lens(-1);
      ctx.stroke();
      lens(1);
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      for (const sx of [-1, 1]) {
        lens(sx);
        const g = ctx.createLinearGradient(0, -h * 0.3, 0, h * 0.4);
        g.addColorStop(0, '#1f2937');
        g.addColorStop(1, '#030712');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = '#d4a017';
        ctx.lineWidth = edge * 0.7;
        ctx.stroke();
        ctx.save();
        lens(sx);
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.moveTo(sx * w * 0.14, -h * 0.3);
        ctx.lineTo(sx * w * 0.26, -h * 0.3);
        ctx.lineTo(sx * w * 0.12, h * 0.4);
        ctx.lineTo(sx * w * 0.02, h * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = '#d4a017';
      ctx.lineWidth = edge * 0.9;
      ctx.beginPath();
      ctx.moveTo(-w * 0.07, -h * 0.2);
      ctx.quadraticCurveTo(0, -h * 0.34, w * 0.07, -h * 0.2);
      ctx.moveTo(-w * 0.46, -h * 0.28);
      ctx.lineTo(-w * 0.5, -h * 0.32);
      ctx.moveTo(w * 0.46, -h * 0.28);
      ctx.lineTo(w * 0.5, -h * 0.32);
      ctx.stroke();
      break;
    }
    case 'momo': {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, h * 0.3, w * 0.48, h * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = edge * 0.6;
      ctx.beginPath();
      ctx.ellipse(0, h * 0.3, w * 0.4, h * 0.12, 0, 0, Math.PI * 2);
      ctx.stroke();
      const one = (x: number, y: number, s: number) => {
        ctx.fillStyle = '#fbf3e2';
        ctx.strokeStyle = '#c9a77a';
        ctx.lineWidth = s * 0.05;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y);
        ctx.bezierCurveTo(x - s * 0.55, y - s * 0.55, x - s * 0.12, y - s * 0.72, x, y - s * 0.72);
        ctx.bezierCurveTo(x + s * 0.12, y - s * 0.72, x + s * 0.55, y - s * 0.55, x + s * 0.5, y);
        ctx.quadraticCurveTo(x, y + s * 0.16, x - s * 0.5, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        for (const k of [-0.32, -0.15, 0.15, 0.32]) {
          ctx.moveTo(x + k * s, y - s * 0.12);
          ctx.quadraticCurveTo(x + k * s * 0.5, y - s * 0.5, x, y - s * 0.7);
        }
        ctx.stroke();
      };
      one(-w * 0.22, h * 0.26, h * 0.5);
      one(w * 0.22, h * 0.26, h * 0.5);
      one(0, h * 0.32, h * 0.56);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = edge * 0.8;
      for (const sx of [-0.16, 0, 0.16]) {
        ctx.beginPath();
        ctx.moveTo(sx * w, -h * 0.12);
        ctx.bezierCurveTo(sx * w - h * 0.08, -h * 0.22, sx * w + h * 0.08, -h * 0.32, sx * w, -h * 0.46);
        ctx.stroke();
      }
      break;
    }
    case 'flags': {
      const colors = ['#2563eb', '#f8fafc', '#dc2626', '#16a34a', '#facc15'];
      const x0 = -w * 0.48;
      const x1 = w * 0.48;
      const y0 = -h * 0.38;
      const drop = h * 0.22;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = edge * 1.4;
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const q = sag(x0, y0, x1, y0, drop, i / 20);
        if (i) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
      }
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = edge * 0.4;
      ctx.stroke();
      const fw = w * 0.15;
      for (let i = 0; i < 5; i++) {
        const t = 0.1 + i * 0.2;
        const q = sag(x0, y0, x1, y0, drop, t);
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate((t - 0.5) * 0.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-fw / 2 - edge * 0.5, -edge * 0.2, fw + edge, h * 0.62 + edge * 0.6);
        ctx.fillStyle = colors[i];
        ctx.fillRect(-fw / 2, 0, fw, h * 0.6);
        ctx.fillStyle = i === 1 ? 'rgba(30,64,175,0.5)' : 'rgba(255,255,255,0.55)';
        circle(ctx, 0, h * 0.24, fw * 0.18, ctx.fillStyle as string);
        ctx.fillRect(-fw * 0.3, h * 0.38, fw * 0.6, h * 0.025);
        ctx.fillRect(-fw * 0.3, h * 0.44, fw * 0.6, h * 0.025);
        ctx.restore();
      }
      break;
    }
    case 'woho': {
      const bubble = () => {
        rr(ctx, -w * 0.48, -h * 0.44, w * 0.96, h * 0.7, h * 0.3);
        ctx.moveTo(-w * 0.24, h * 0.22);
        ctx.lineTo(-w * 0.34, h * 0.48);
        ctx.lineTo(-w * 0.06, h * 0.24);
      };
      ctx.fillStyle = '#ffffff';
      bubble();
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = edge * 0.9;
      rr(ctx, -w * 0.48, -h * 0.44, w * 0.96, h * 0.7, h * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.235, h * 0.26);
      ctx.lineTo(-w * 0.34, h * 0.48);
      ctx.lineTo(-w * 0.07, h * 0.26);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-w * 0.22, h * 0.2, w * 0.14, h * 0.06);
      const size = fitText(measureWith(ctx, '800', fonts.head), 'Wo-ho!', w * 0.8, h * 0.44, 6).size;
      ctx.font = `800 ${size}px ${fonts.head}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = edge * 0.8;
      ctx.strokeStyle = '#7f1d1d';
      ctx.strokeText('Wo-ho!', 0, -h * 0.07);
      ctx.fillStyle = '#dc2626';
      ctx.fillText('Wo-ho!', 0, -h * 0.07);
      break;
    }
    case 'heart': {
      const heart = () => {
        ctx.beginPath();
        ctx.moveTo(0, h * 0.42);
        ctx.bezierCurveTo(-w * 0.62, -h * 0.02, -w * 0.4, -h * 0.62, 0, -h * 0.2);
        ctx.bezierCurveTo(w * 0.4, -h * 0.62, w * 0.62, -h * 0.02, 0, h * 0.42);
        ctx.closePath();
      };
      heart();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = edge * 2;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      const g = ctx.createLinearGradient(0, -h * 0.4, 0, h * 0.4);
      g.addColorStop(0, '#fb7185');
      g.addColorStop(1, '#be123c');
      ctx.fillStyle = g;
      heart();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(-w * 0.2, -h * 0.18, w * 0.08, h * 0.05, -0.7, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'tika': {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.48, h * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      const g = ctx.createRadialGradient(-w * 0.1, -h * 0.1, 0, 0, 0, h * 0.45);
      g.addColorStop(0, '#ef233c');
      g.addColorStop(1, '#a4000f');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.4, h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      const rand = mulberry32(3);
      ctx.fillStyle = '#fffaf0';
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.ellipse((rand() - 0.5) * w * 0.55, (rand() - 0.5) * h * 0.6, w * 0.07, w * 0.035, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

function drawStickers(ctx: Ctx, L: Layout, list: Sticker[], fonts: DrawFonts, selected: string | null) {
  for (const st of list) {
    const b = stickerBox(st, L.area);
    ctx.save();
    ctx.translate(b.cx, b.cy);
    ctx.rotate(b.r);
    drawSticker(ctx, st.kind, b.w, b.h, fonts);
    ctx.restore();
  }
  const sel = list.find((s) => s.id === selected);
  if (sel) {
    const b = stickerBox(sel, L.area);
    const u = L.w / 1080;
    ctx.save();
    ctx.translate(b.cx, b.cy);
    ctx.rotate(b.r);
    ctx.setLineDash([12 * u, 9 * u]);
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4 * u;
    ctx.strokeRect(-b.w / 2 - 8 * u, -b.h / 2 - 8 * u, b.w + 16 * u, b.h + 16 * u);
    ctx.restore();
    const hp = handlePoint({ ...b, w: b.w + 16 * u, h: b.h + 16 * u });
    circle(ctx, hp.x, hp.y, 24 * u, '#ffffff');
    circle(ctx, hp.x, hp.y, 17 * u, '#7c3aed');
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.4 * u;
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, 8 * u, -Math.PI * 0.9, Math.PI * 0.4);
    ctx.stroke();
  }
}

/** Handle radius in layout pixels (for hit testing). */
export const HANDLE_PAD = 16;

// ---------------- the photo layer ----------------

export type PhotoOpts = {
  zoom: number;
  panX: number;
  panY: number;
  filter: FilterId;
  brightness: number;
  frame: FrameId;
  fonts: DrawFonts;
  emptyLabel: (i: number) => string;
};

/**
 * Photos in their cells, with the filter applied, onto `target` (resized
 * only when needed). Cached by the caller — it's the slow part.
 */
export function renderPhotoLayer(target: HTMLCanvasElement, L: Layout, scale: number, shots: (Pic | null)[], o: PhotoOpts) {
  const W = Math.max(1, Math.round(L.w * scale));
  const H = Math.max(1, Math.round(L.h * scale));
  if (target.width !== W) target.width = W;
  if (target.height !== H) target.height = H;
  const ctx = target.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  const single = L.cells.length === 1;
  L.cells.forEach((c, i) => {
    const shot = shots[i] ?? null;
    ctx.save();
    rr(ctx, c.x, c.y, c.w, c.h, L.radius);
    ctx.clip();
    if (shot) {
      const sw = shot instanceof HTMLImageElement ? shot.naturalWidth : shot.width;
      const sh = shot instanceof HTMLImageElement ? shot.naturalHeight : shot.height;
      const k = single ? coverCrop(sw, sh, c.w, c.h, o.zoom, o.panX, o.panY) : coverCrop(sw, sh, c.w, c.h);
      ctx.drawImage(shot, k.sx, k.sy, k.sw, k.sh, c.x, c.y, c.w, c.h);
    } else emptyCell(ctx, c, o.frame, o.fonts, o.emptyLabel(i));
    ctx.restore();
  });
  if (o.filter !== 'none' || o.brightness !== 0) {
    const a = L.area;
    const x = Math.max(0, Math.floor(a.x * scale));
    const y = Math.max(0, Math.floor(a.y * scale));
    const w = Math.min(W - x, Math.ceil(a.w * scale));
    const h = Math.min(H - y, Math.ceil(a.h * scale));
    if (w > 0 && h > 0) {
      const img = ctx.getImageData(x, y, w, h);
      applyFilter(img.data, o.filter, o.brightness);
      ctx.putImageData(img, x, y);
    }
  }
  if (o.filter === 'glow') {
    ctx.save();
    ctx.beginPath();
    for (const c of L.cells) {
      rr(ctx, c.x, c.y, c.w, c.h, L.radius);
      ctx.save();
      ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(c.x + c.w * 0.2, c.y, 0, c.x + c.w * 0.2, c.y, c.w * 0.9);
      g.addColorStop(0, 'rgba(255,170,80,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      const rand = mulberry32(17);
      for (let i = 0; i < 14; i++) {
        const bx = c.x + rand() * c.w;
        const by = c.y + rand() * c.h * 0.55;
        glowDot(ctx, bx, by, c.w * (0.03 + rand() * 0.05), i % 3 ? 'rgba(255,200,120,0.4)' : 'rgba(255,120,180,0.35)');
      }
      ctx.globalCompositeOperation = 'multiply';
      const v = ctx.createRadialGradient(c.x + c.w / 2, c.y + c.h / 2, Math.min(c.w, c.h) * 0.35, c.x + c.w / 2, c.y + c.h / 2, Math.max(c.w, c.h) * 0.75);
      v.addColorStop(0, 'rgba(255,255,255,1)');
      v.addColorStop(1, 'rgba(120,60,90,1)');
      ctx.fillStyle = v;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.restore();
    }
    ctx.restore();
  }
}

function emptyCell(ctx: Ctx, c: Rect, f: FrameId, fonts: DrawFonts, label: string) {
  const p = PALETTES[f];
  ctx.fillStyle = p.photoBg;
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(c.x, c.y, c.w, c.h);
  const s = Math.min(c.w, c.h) * 0.16;
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2 - s * 0.3;
  ctx.strokeStyle = p.sub;
  ctx.fillStyle = p.sub;
  ctx.lineWidth = s * 0.1;
  rr(ctx, cx - s, cy - s * 0.6, s * 2, s * 1.4, s * 0.25);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.1, s * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillRect(cx - s * 0.4, cy - s * 0.8, s * 0.8, s * 0.22);
  ctx.font = `700 ${s * 0.5}px ${fonts.body}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + s * 1.35);
}

// ---------------- the whole picture ----------------

export type RenderInput = {
  layout: Layout;
  frame: FrameId;
  text: BoothText;
  stickers: Sticker[];
  logo: Pic | null;
  fonts: DrawFonts;
  photoLayer: HTMLCanvasElement | null;
  /** Shows the dashed outline + handle (preview only). */
  selected: string | null;
};

/** Paints the framed picture on ctx, which is already sized; `scale` maps layout px → canvas px. */
export function renderBooth(ctx: Ctx, scale: number, r: RenderInput) {
  const L = r.layout;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  frameBack(ctx, L, r.frame);
  if (r.photoLayer) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(r.photoLayer, 0, 0);
    ctx.restore();
  }
  frameFront(ctx, L, r.frame);
  frameText(ctx, L, r.frame, r.text, r.fonts, r.logo);
  drawStickers(ctx, L, r.stickers, r.fonts, r.selected);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------------- the sample scene ----------------

/**
 * A festival evening drawn from scratch: dusk sky, mountains, string lights,
 * a lit stage and a crowd of silhouettes (no real people). Three variants.
 */
export function drawSample(c: HTMLCanvasElement, variant: number) {
  const S = 1200;
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const rand = mulberry32(101 + variant * 31);
  const skies = [
    ['#1b1446', '#6d2a7a', '#f08a3c'],
    ['#0f1e4a', '#3b3a8f', '#f472b6'],
    ['#2a103e', '#8a2f5a', '#fbbf24'],
  ][variant % 3];
  const sky = ctx.createLinearGradient(0, 0, 0, S * 0.7);
  sky.addColorStop(0, skies[0]);
  sky.addColorStop(0.6, skies[1]);
  sky.addColorStop(1, skies[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) circle(ctx, rand() * S, rand() * S * 0.35, rand() * 2 + 0.6, `rgba(255,255,255,${0.3 + rand() * 0.6})`);
  mountains(ctx, -40, S + 40, S * 0.6, S * 0.24, 'rgba(48,26,80,0.9)', 'rgba(255,230,240,0.55)', 5 + variant);
  // stage
  const sx = S * (0.3 + rand() * 0.1);
  const sw = S * 0.4;
  const sy = S * 0.42;
  const stg = ctx.createLinearGradient(0, sy, 0, sy + S * 0.22);
  stg.addColorStop(0, '#2b1238');
  stg.addColorStop(1, '#120716');
  ctx.fillStyle = stg;
  rr(ctx, sx, sy, sw, S * 0.22, 16);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(sx, sy, sw, 10);
  for (let i = 0; i < 5; i++) {
    const bx = sx + sw * (0.1 + i * 0.2);
    const g = ctx.createLinearGradient(bx, sy, bx, S);
    g.addColorStop(0, i % 2 ? 'rgba(255,200,120,0.35)' : 'rgba(244,114,182,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx - 6, sy + 10);
    ctx.lineTo(bx + 6, sy + 10);
    ctx.lineTo(bx + 140 + (i - 2) * 60, S);
    ctx.lineTo(bx - 140 + (i - 2) * 60, S);
    ctx.closePath();
    ctx.fill();
    glowDot(ctx, bx, sy + 12, 34, 'rgba(255,240,200,0.9)');
  }
  // string lights
  const lightCols = ['#fde047', '#fb923c', '#f472b6', '#67e8f9', '#86efac'];
  for (let row = 0; row < 3; row++) {
    const y0 = S * (0.08 + row * 0.11 + rand() * 0.03);
    const drop = S * (0.06 + rand() * 0.05);
    ctx.strokeStyle = 'rgba(20,10,20,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const q = sag(-20, y0, S + 20, y0 + S * 0.03 * (row - 1), drop, i / 30);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    }
    ctx.stroke();
    for (let i = 1; i < 22; i++) {
      const q = sag(-20, y0, S + 20, y0 + S * 0.03 * (row - 1), drop, i / 22);
      const col = lightCols[(i + row) % lightCols.length];
      glowDot(ctx, q.x, q.y + 8, 30, `${col}88`);
      circle(ctx, q.x, q.y + 8, 7, col);
    }
  }
  // crowd: three rows of silhouettes, front row biggest
  const rows = [
    { y: S * 0.7, s: 46, n: 16, col: '#1c0f24' },
    { y: S * 0.82, s: 72, n: 11, col: '#120916' },
    { y: S * 0.98, s: 120, n: 6, col: '#07040a' },
  ];
  rows.forEach((r, ri) => {
    for (let i = 0; i < r.n; i++) {
      const x = ((i + 0.5 + (rand() - 0.5) * 0.6) / r.n) * S;
      const y = r.y + (rand() - 0.5) * r.s * 0.4;
      const s = r.s * (0.85 + rand() * 0.3);
      ctx.fillStyle = r.col;
      // shoulders
      rr(ctx, x - s * 0.62, y - s * 0.1, s * 1.24, s * 1.6, s * 0.5);
      ctx.fill();
      // head
      circle(ctx, x, y - s * 0.42, s * 0.36, r.col);
      // rim light from the stage
      ctx.strokeStyle = `rgba(255,190,140,${0.18 + ri * 0.08})`;
      ctx.lineWidth = Math.max(1.5, s * 0.04);
      ctx.beginPath();
      ctx.arc(x, y - s * 0.42, s * 0.36, Math.PI * 1.1, Math.PI * 1.75);
      ctx.stroke();
      // some raised hands, some phones up
      const roll = rand();
      if (roll < 0.28) {
        const side = rand() < 0.5 ? -1 : 1;
        ctx.strokeStyle = r.col;
        ctx.lineWidth = s * 0.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + side * s * 0.45, y);
        ctx.lineTo(x + side * s * 0.75, y - s * 1.1);
        ctx.stroke();
        circle(ctx, x + side * s * 0.78, y - s * 1.2, s * 0.15, r.col);
      } else if (roll < 0.42) {
        const px = x + (rand() - 0.5) * s * 0.6;
        const py = y - s * 1.15;
        ctx.strokeStyle = r.col;
        ctx.lineWidth = s * 0.18;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(px, py + s * 0.2);
        ctx.stroke();
        glowDot(ctx, px, py, s * 0.5, 'rgba(180,220,255,0.35)');
        ctx.fillStyle = '#cfe8ff';
        rr(ctx, px - s * 0.13, py - s * 0.22, s * 0.26, s * 0.42, s * 0.05);
        ctx.fill();
      }
    }
  });
  // confetti
  for (let i = 0; i < 90; i++) {
    ctx.save();
    ctx.translate(rand() * S, rand() * S * 0.75);
    ctx.rotate(rand() * 3);
    ctx.fillStyle = lightCols[i % lightCols.length];
    ctx.globalAlpha = 0.75;
    ctx.fillRect(-5, -2.5, 10, 5);
    ctx.restore();
  }
}

// ---------------- the A4 QR poster ----------------

export type PosterInput = {
  frame: FrameId;
  text: BoothText;
  logo: Pic | null;
  qrText: string;
  fonts: DrawFonts;
  words: { scan: string; steps: [string, string, string]; foot: string; stepNum: (n: number) => string };
};

function drawQr(ctx: Ctx, text: string, x: number, y: number, size: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#111827';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.modules.get(r, c)) ctx.fillRect(Math.floor(x + (c + quiet) * cell), Math.floor(y + (r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
}

/** The A4 poster (1240 × 1754 at scale 1): headline, event, a big QR, three steps. */
export function renderPoster(ctx: Ctx, scale: number, p: PosterInput) {
  const W = 1240;
  const H = 1754;
  const pal = PALETTES[p.frame];
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  // reuse the frame's art around a white card that holds the QR
  const card: Rect = { x: 250, y: 640, w: 740, h: 820 };
  const fake: Layout = {
    id: 'print',
    w: W,
    h: H,
    margin: 70,
    cells: [card],
    area: card,
    title: { x: 70, y: 40, w: W - 140, h: 360 },
    meta: { x: 70, y: H - 190, w: W - 140, h: 150 },
    radius: 30,
  };
  frameBack(ctx, fake, p.frame);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffffff';
  rr(ctx, card.x, card.y, card.w, card.h, 30);
  ctx.fill();
  ctx.restore();
  frameFront(ctx, fake, p.frame);
  const qs = 600;
  drawQr(ctx, p.qrText, card.x + (card.w - qs) / 2, card.y + 50, qs);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // hashtag under the QR
  if (p.text.tag) {
    const h = fitText(measureWith(ctx, '800', p.fonts.head), p.text.tag, card.w - 80, 64, 24);
    ctx.font = `800 ${h.size}px ${p.fonts.head}`;
    ctx.fillStyle = '#111827';
    ctx.fillText(h.text, W / 2, card.y + 50 + qs + 82);
  }
  // headline + event
  let y = 150;
  if (p.logo) {
    const r = 62;
    circle(ctx, W / 2, 112, r, '#ffffff');
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, 112, r * 0.88, 0, Math.PI * 2);
    ctx.clip();
    const lw = 'naturalWidth' in p.logo ? p.logo.naturalWidth : p.logo.width;
    const lh = 'naturalHeight' in p.logo ? p.logo.naturalHeight : p.logo.height;
    const k = Math.min((r * 1.76) / lw, (r * 1.76) / lh);
    ctx.drawImage(p.logo, W / 2 - (lw * k) / 2, 112 - (lh * k) / 2, lw * k, lh * k);
    ctx.restore();
    y = 225;
  }
  ctx.font = `700 40px ${p.fonts.body}`;
  ctx.fillStyle = pal.accent;
  ctx.fillText(GREETING[p.frame], W / 2, y);
  const head = fitTitle(measureWith(ctx, '800', p.fonts.head), p.words.scan, W - 380, 96, 80, 44);
  ctx.font = `800 ${head.size}px ${p.fonts.head}`;
  ctx.fillStyle = pal.ink;
  head.lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 95 + i * head.size * 1.08));
  y += 95 + head.lines.length * head.size * 1.08 + 10;
  const title = p.text.title.trim();
  if (title) {
    const fam = titleFamily(p.frame, title, p.fonts);
    const t = fitText(measureWith(ctx, '700', fam.family, fam.style), title, W - 380, 56, 26);
    ctx.font = `${fam.style}700 ${t.size}px ${fam.family}`;
    ctx.fillStyle = pal.sub;
    ctx.fillText(t.text, W / 2, Math.min(y, 560));
  }
  if (p.text.date) {
    const d = fitText(measureWith(ctx, '600', p.fonts.body), p.text.date, W - 380, 38, 20);
    ctx.font = `600 ${d.size}px ${p.fonts.body}`;
    ctx.fillStyle = pal.sub;
    ctx.fillText(d.text, W / 2, Math.min(y + 58, 610));
  }
  // three steps
  const sy = card.y + card.h + 95;
  const colW = (W - 200) / 3;
  p.words.steps.forEach((s, i) => {
    const cx = 100 + colW * i + colW / 2;
    circle(ctx, cx, sy, 34, pal.accent);
    ctx.font = `800 36px ${p.fonts.head}`;
    ctx.fillStyle = pal.bg1;
    ctx.fillText(p.words.stepNum(i + 1), cx, sy + 2);
    const f = fitText(measureWith(ctx, '700', p.fonts.body), s, colW - 20, 42, 18);
    ctx.font = `700 ${f.size}px ${p.fonts.body}`;
    ctx.fillStyle = pal.ink;
    ctx.fillText(f.text, cx, sy + 66);
  });
  const ft = fitText(measureWith(ctx, '500', p.fonts.body), p.words.foot, W - 200, 30, 14);
  ctx.font = `500 ${ft.size}px ${p.fonts.body}`;
  ctx.fillStyle = pal.sub;
  ctx.fillText(ft.text, W / 2, H - 70);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Waits for the page fonts (Latin + Devanagari) so the canvas text uses them. */
export async function fontsReady(fonts: DrawFonts): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`800 40px ${fonts.head}`, 'Aa शुभ दशैं'),
      document.fonts.load(`700 40px ${fonts.body}`, 'Aa शुभ दशैं'),
      document.fonts.load(`600 40px ${fonts.body}`, 'Aa २०८३'),
      document.fonts.load(`500 40px ${fonts.body}`, 'Aa'),
    ]);
    await document.fonts.ready;
  } catch {
    /* system fonts are fine too */
  }
}

export function canvasBlob(c: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number): Promise<Blob | null> {
  return new Promise((res) => c.toBlob((b) => res(b), type, quality));
}

export { STICKER_ASPECT };
