// Draws a festival greeting card onto a <canvas>, entirely in the browser.
//
// Everything is painted from code — kites, jamara, diyo, rangoli, sayapatri —
// so there are no image files to fetch and nothing to render on the server
// (the host has 512 MB and has been OOM-killed by image work before). A
// visitor's photo is drawn from their own device and never sent anywhere.
//
// Randomness (stars, rice grains, petals) comes from a seeded generator, one
// per layer, so the card does not shimmer as the person types their name, and
// adding a photo does not reshuffle the sky.
import type { CardLook } from '@/lib/greetingCards';

export interface CardFonts {
  /** The big Devanagari greeting (a display serif). */
  display: string;
  /** Kicker, English line, tag. */
  body: string;
  /** The handwritten "from" name. */
  script: string;
}

export interface CardPhoto {
  image: CanvasImageSource;
  width: number;
  height: number;
  /** 1 = the photo just fills the circle; larger zooms in. */
  zoom: number;
  /** Which point of the photo sits in the middle of the circle, 0..1 each way. */
  focusX: number;
  focusY: number;
}

export interface CardSpec {
  look: CardLook;
  /** The festival slug — picks the palette of the 'festive' look. */
  festival: string;
  width: number;
  height: number;
  kicker: string;
  greeting: string;
  message: string;
  /** Who sends it; '' leaves the sign-off out. */
  from: string;
  photo: CardPhoto | null;
  fonts: CardFonts;
}

type C2D = CanvasRenderingContext2D;
interface Paint {
  ctx: C2D;
  W: number;
  H: number;
  rnd: () => number;
}
interface Hero {
  x: number;
  y: number;
  r: number;
}

interface Theme {
  greeting: string;
  message: string;
  from: string;
  kicker: string;
  tag: string;
  /** Text shadow for busy backgrounds; null on calm ones. */
  shadow: string | null;
  ring: string;
  /** Height kept clear above the tag for bottom ornaments, as a share of H. */
  bottomBand: number;
  /** Where the kicker line sits, as a share of H (garlands push it down). */
  kickerY: number;
  background(p: Paint): void;
  ornaments(p: Paint, hero: Hero): void;
  /** The picture in the circle when there is no photo. */
  heroArt(p: Paint, hero: Hero): void;
  /** Drawn behind the photo when there is one. */
  photoFrame(p: Paint, hero: Hero): void;
}

const TAU = Math.PI * 2;

/** mulberry32 — small, fast, and the same numbers every time for a seed. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where the photo (or the hero picture) sits. Shared with the maker's sliders. */
export function heroFor(W: number, H: number): Hero {
  const story = H / W > 1.5;
  return { x: W / 2, y: H * (story ? 0.24 : 0.235), r: W * (story ? 0.19 : 0.145) };
}

// ---------------------------------------------------------------------------
// Small drawing helpers
// ---------------------------------------------------------------------------

function circle(ctx: C2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.closePath();
}

/** A teardrop petal pointing up (−y) from the origin. */
function petal(ctx: C2D, len: number, width: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(width, -len * 0.35, width * 0.6, -len * 0.85, 0, -len);
  ctx.bezierCurveTo(-width * 0.6, -len * 0.85, -width, -len * 0.35, 0, 0);
  ctx.closePath();
}

function petalRing(ctx: C2D, x: number, y: number, n: number, len: number, width: number, color: string, offset = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate(offset + (i / n) * TAU);
    petal(ctx, len, width);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function dotRing(ctx: C2D, x: number, y: number, n: number, radius: number, dot: number, color: string): void {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    circle(ctx, x + Math.cos(a) * radius, y + Math.sin(a) * radius, dot);
    ctx.fill();
  }
}

/** A rangoli-style mandala, rings of petals in the given colours. */
function mandala(ctx: C2D, x: number, y: number, R: number, colors: string[]): void {
  const c = (i: number) => colors[i % colors.length];
  dotRing(ctx, x, y, 32, R * 1.07, R * 0.018, c(4));
  petalRing(ctx, x, y, 16, R, R * 0.13, c(0));
  petalRing(ctx, x, y, 16, R * 0.78, R * 0.11, c(1), Math.PI / 16);
  petalRing(ctx, x, y, 8, R * 0.58, R * 0.14, c(2));
  petalRing(ctx, x, y, 8, R * 0.4, R * 0.1, c(3), Math.PI / 8);
  ctx.fillStyle = c(1);
  circle(ctx, x, y, R * 0.16);
  ctx.fill();
  ctx.fillStyle = c(2);
  circle(ctx, x, y, R * 0.08);
  ctx.fill();
}

function glow(ctx: C2D, x: number, y: number, r: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** '#rrggbb' + alpha → 'rgba(…)'. */
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function fillAll(p: Paint, style: string | CanvasGradient): void {
  p.ctx.fillStyle = style;
  p.ctx.fillRect(0, 0, p.W, p.H);
}

function speckles(p: Paint, n: number, colors: string[], maxR: number, alpha: [number, number]): void {
  const { ctx, W, H, rnd } = p;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = withAlpha(colors[i % colors.length], alpha[0] + rnd() * (alpha[1] - alpha[0]));
    circle(ctx, rnd() * W, rnd() * H, W * 0.0008 + rnd() * maxR);
    ctx.fill();
  }
}

/** Point on a quadratic curve. */
function quad(t: number, a: number, c: number, b: number): number {
  return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
}

// ---------------------------------------------------------------------------
// Motifs
// ---------------------------------------------------------------------------

/** A Nepali changa: a square diamond in two colours, eye in the middle, small tail. */
function kite(ctx: C2D, x: number, y: number, s: number, rot: number, a: string, b: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = a;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s, 0);
  ctx.lineTo(-s, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = b;
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.lineTo(s, 0);
  ctx.lineTo(0, s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,30,20,0.35)';
  ctx.lineWidth = Math.max(1.5, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(0, s);
  ctx.moveTo(-s, 0);
  ctx.quadraticCurveTo(0, -s * 0.35, s, 0);
  ctx.stroke();
  ctx.fillStyle = a === '#ffffff' ? b : '#ffffff';
  circle(ctx, 0, 0, s * 0.17);
  ctx.fill();
  ctx.fillStyle = a;
  ctx.beginPath();
  ctx.moveTo(-s * 0.22, s * 1.28);
  ctx.lineTo(s * 0.22, s * 1.28);
  ctx.lineTo(0, s * 0.94);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** One soft cloud: the puffs are a single path, so their overlaps do not darken. */
function cloud(ctx: C2D, x: number, y: number, s: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = s * 0.6;
  ctx.beginPath();
  for (const [dx, dy, r] of [
    [0, 0, 1],
    [0.95, 0.2, 0.72],
    [-0.95, 0.25, 0.68],
    [0.4, -0.42, 0.72],
    [-0.35, -0.3, 0.6],
  ]) {
    ctx.moveTo(x + dx * s + r * s, y + dy * s);
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU);
  }
  ctx.fill();
  ctx.restore();
}

/** A clay diyo with its flame at the spout. s = half the bowl's width. */
function diyo(ctx: C2D, x: number, y: number, s: number): void {
  const fx = x + s * 1.05;
  const fy = y - s * 0.22;
  glow(ctx, fx, fy - s * 0.4, s * 2.4, '#ffb347', 0.45);
  ctx.save();
  const bowl = ctx.createLinearGradient(0, y - s * 0.2, 0, y + s * 0.6);
  bowl.addColorStop(0, '#d9733b');
  bowl.addColorStop(1, '#6e2a10');
  ctx.fillStyle = bowl;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.quadraticCurveTo(x, y + s * 1.15, x + s, y);
  ctx.lineTo(x + s * 1.25, y - s * 0.2);
  ctx.lineTo(x + s * 0.7, y - s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8925a';
  ctx.beginPath();
  ctx.ellipse(x, y, s, s * 0.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#4a1c08';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.78, s * 0.12, 0, 0, TAU);
  ctx.fill();
  // The flame.
  const fh = s * 1.15;
  const fw = s * 0.36;
  const flame = ctx.createLinearGradient(0, fy - fh, 0, fy);
  flame.addColorStop(0, '#fff8d6');
  flame.addColorStop(0.45, '#ffd166');
  flame.addColorStop(1, '#f3722c');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(fx, fy - fh);
  ctx.bezierCurveTo(fx + fw, fy - fh * 0.35, fx + fw * 0.7, fy, fx, fy);
  ctx.bezierCurveTo(fx - fw * 0.7, fy, fx - fw, fy - fh * 0.35, fx, fy - fh);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const MARIGOLD = {
  orange: ['#f77f00', '#fcbf49', '#c45500'],
  yellow: ['#ffc300', '#ffe066', '#d99a00'],
};

/** A sayapatri (marigold) head: ruffled petals, lighter inside, a dark heart. */
function marigold(ctx: C2D, x: number, y: number, r: number, kind: 'orange' | 'yellow'): void {
  const [base, light, dark] = MARIGOLD[kind];
  ctx.fillStyle = dark;
  circle(ctx, x, y, r);
  ctx.fill();
  ctx.fillStyle = base;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    circle(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.42);
    ctx.fill();
  }
  ctx.fillStyle = light;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3;
    circle(ctx, x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, r * 0.3);
    ctx.fill();
  }
  ctx.fillStyle = dark;
  circle(ctx, x, y, r * 0.16);
  ctx.fill();
}

/** A makhamali (globe amaranth) bloom — the Bhai Tika mala flower. */
function makhamali(ctx: C2D, x: number, y: number, r: number, color = '#b5179e'): void {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#f7a6e0');
  g.addColorStop(0.35, color);
  g.addColorStop(1, '#5c0a4f');
  ctx.fillStyle = g;
  circle(ctx, x, y, r);
  ctx.fill();
}

/** Flowers strung along a sagging swag from (x0,y0) to (x1,y1). */
function swag(
  ctx: C2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sag: number,
  step: number,
  flower: (x: number, y: number, i: number) => void
): void {
  const cx = (x0 + x1) / 2;
  const cy = Math.max(y0, y1) + sag * 2;
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, sag * 1.6) / step));
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  ctx.restore();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    flower(quad(t, x0, cx, x1), quad(t, y0, cy, y1), i);
  }
}

function brassPlate(ctx: C2D, x: number, y: number, r: number): void {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#fbe7a1');
  g.addColorStop(0.6, '#d4a017');
  g.addColorStop(1, '#8a6110');
  ctx.fillStyle = g;
  circle(ctx, x, y, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,190,0.7)';
  ctx.lineWidth = r * 0.025;
  circle(ctx, x, y, r * 0.86);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// The looks
// ---------------------------------------------------------------------------

const kites: Theme = {
  greeting: '#ffffff',
  message: '#f4f7ff',
  from: '#ffe8a3',
  kicker: '#ffe8a3',
  tag: 'rgba(255,255,255,0.85)',
  shadow: 'rgba(8,20,48,0.5)',
  ring: '#ffe8a3',
  bottomBand: 0.06,
  kickerY: 0.065,
  background(p) {
    const { ctx, W, H, rnd } = p;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0f3460');
    g.addColorStop(0.45, '#2f6fb0');
    g.addColorStop(0.8, '#f0a35e');
    g.addColorStop(1, '#f9c784');
    fillAll(p, g);
    glow(ctx, W * 0.5, H * 0.98, W * 0.8, '#ffe196', 0.7);
    // A few clouds, kept to the edges so the greeting has clear sky.
    for (let i = 0; i < 4; i++) {
      const left = i % 2 === 0;
      const x = left ? W * (0.02 + rnd() * 0.18) : W * (0.8 + rnd() * 0.18);
      cloud(ctx, x, H * (0.18 + rnd() * 0.5), W * (0.04 + rnd() * 0.035), 'rgba(255,255,255,0.13)');
    }
    // The hills the kites are flown from.
    ctx.fillStyle = 'rgba(28,58,44,0.92)';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.93);
    ctx.quadraticCurveTo(W * 0.25, H * 0.875, W * 0.5, H * 0.925);
    ctx.quadraticCurveTo(W * 0.78, H * 0.965, W, H * 0.9);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#13281e';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.968);
    ctx.quadraticCurveTo(W * 0.35, H * 0.935, W * 0.62, H * 0.962);
    ctx.quadraticCurveTo(W * 0.85, H * 0.985, W, H * 0.955);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  },
  ornaments(p) {
    const { ctx, W, H } = p;
    const list: [number, number, number, number, string, string][] = [
      [0.14, 0.13, 0.085, -0.35, '#e63946', '#ffd166'],
      [0.86, 0.11, 0.07, 0.3, '#ffd166', '#1d3557'],
      [0.8, 0.3, 0.05, 0.15, '#2a9d8f', '#ffffff'],
      [0.2, 0.33, 0.045, -0.2, '#f77f00', '#ffffff'],
      [0.69, 0.165, 0.032, 0.2, '#e63946', '#ffffff'],
      [0.3, 0.19, 0.028, -0.15, '#ffffff', '#e63946'],
    ];
    // Strings run down and OUT to the flyers on the hills at either side, so
    // they never cross the greeting in the middle.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(1.5, W * 0.0016);
    for (const [fx, fy, fs, rot] of list) {
      const x = fx * W;
      const y = fy * H + fs * W * Math.cos(rot);
      const left = fx < 0.5;
      const ex = left ? W * 0.02 : W * 0.98;
      const ey = H * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(left ? Math.min(x, W * 0.12) : Math.max(x, W * 0.88), (y + ey) / 2 + H * 0.12, ex, ey);
      ctx.stroke();
    }
    ctx.restore();
    for (const [fx, fy, fs, rot, a, b] of list) kite(ctx, fx * W, fy * H, fs * W, rot, a, b);
  },
  heroArt(p, hero) {
    const { ctx } = p;
    glow(ctx, hero.x, hero.y, hero.r * 1.5, '#ffe8a3', 0.35);
    kite(ctx, hero.x, hero.y - hero.r * 0.1, hero.r * 0.75, 0.12, '#dc143c', '#ffd166');
  },
  photoFrame(p, hero) {
    glow(p.ctx, hero.x, hero.y, hero.r * 1.55, '#ffe8a3', 0.35);
  },
};

const tika: Theme = {
  greeting: '#ffe08a',
  message: '#fff1db',
  from: '#ffd166',
  kicker: '#f6d58e',
  tag: 'rgba(255,236,200,0.8)',
  shadow: 'rgba(40,0,0,0.5)',
  ring: '#e9c46a',
  bottomBand: 0.02,
  kickerY: 0.07,
  background(p) {
    const { ctx, W, H } = p;
    const g = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, H * 0.85);
    g.addColorStop(0, '#c81d25');
    g.addColorStop(0.55, '#8f0d14');
    g.addColorStop(1, '#4f060b');
    fillAll(p, g);
    speckles(p, 170, ['#f6d58e'], W * 0.003, [0.12, 0.45]);
    const m = W * 0.035;
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = W * 0.004;
    ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
    const m2 = W * 0.05;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = W * 0.0015;
    ctx.strokeRect(m2, m2, W - 2 * m2, H - 2 * m2);
    ctx.globalAlpha = 1;
    for (const [x, y] of [
      [m2, m2],
      [W - m2, m2],
      [m2, H - m2],
      [W - m2, H - m2],
    ]) {
      petalRing(ctx, x, y, 8, W * 0.026, W * 0.006, '#e9c46a');
      ctx.fillStyle = '#8f0d14';
      circle(ctx, x, y, W * 0.006);
      ctx.fill();
    }
  },
  ornaments(p) {
    const { ctx, W, H, rnd } = p;
    // Jamara — the barley shoots grown in the dark for Dashain — in two
    // bundles at the bottom corners, tied with a red thread.
    // They lean outwards, into the corners, so the sign-off stays clear.
    for (const [x0, dir] of [
      [W * 0.085, -1],
      [W * 0.915, 1],
    ]) {
      const y0 = H * 0.975;
      ctx.lineCap = 'round';
      for (let i = 0; i < 64; i++) {
        const a = -Math.PI / 2 + dir * (rnd() * 0.42 - 0.06);
        const len = H * (0.07 + rnd() * 0.12);
        const bend = dir * W * (0.006 + rnd() * 0.03);
        const ex = x0 + Math.cos(a) * len;
        const ey = y0 + Math.sin(a) * len;
        ctx.strokeStyle = ['#f6f8c4', '#e4ee8f', '#d4e46c', '#c5d958', '#fff6c2'][i % 5];
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = W * (0.0025 + rnd() * 0.003);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 + Math.cos(a) * len * 0.5 + bend, y0 + Math.sin(a) * len * 0.55, ex, ey);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#d00000';
      ctx.beginPath();
      ctx.ellipse(x0, y0 - H * 0.008, W * 0.022, W * 0.009, 0, 0, TAU);
      ctx.fill();
    }
  },
  heroArt(p, hero) {
    const { ctx, rnd } = p;
    const { x, y, r } = hero;
    glow(ctx, x, y, r * 1.6, '#ffd166', 0.3);
    brassPlate(ctx, x, y, r);
    // The tika: red rice, heaped in the middle of the plate.
    const t = r * 0.55;
    const red = ctx.createRadialGradient(x - t * 0.3, y - t * 0.3, t * 0.1, x, y, t);
    red.addColorStop(0, '#ff3b3b');
    red.addColorStop(1, '#a4161a');
    ctx.fillStyle = red;
    circle(ctx, x, y, t);
    ctx.fill();
    for (let i = 0; i < 260; i++) {
      const a = rnd() * TAU;
      const d = Math.sqrt(rnd()) * t * 0.95;
      ctx.save();
      ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d);
      ctx.rotate(rnd() * Math.PI);
      ctx.fillStyle = rnd() < 0.75 ? `rgba(255,236,224,${0.2 + rnd() * 0.4})` : 'rgba(120,8,12,0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 0, t * 0.065, t * 0.028, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    dotRing(ctx, x, y, 28, r * 1.12, r * 0.022, '#e9c46a');
  },
  photoFrame(p, hero) {
    glow(p.ctx, hero.x, hero.y, hero.r * 1.6, '#ffd166', 0.28);
    dotRing(p.ctx, hero.x, hero.y, 32, hero.r * 1.16, hero.r * 0.02, '#e9c46a');
  },
};

const classic: Theme = {
  greeting: '#a4132a',
  message: '#3f312b',
  from: '#a4132a',
  kicker: '#a07a35',
  tag: '#7b6a5d',
  shadow: null,
  ring: '#b5172f',
  bottomBand: 0,
  kickerY: 0.07,
  background(p) {
    const { ctx, W, H } = p;
    fillAll(p, '#fbf4e6');
    speckles(p, 900, ['#7a5a3c'], W * 0.0012, [0.03, 0.07]);
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, 'rgba(160,110,60,0)');
    v.addColorStop(1, 'rgba(160,110,60,0.16)');
    fillAll(p, v);
    ctx.strokeStyle = '#b5172f';
    ctx.lineWidth = W * 0.016;
    const m = W * 0.035;
    ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = W * 0.003;
    const m2 = W * 0.06;
    ctx.strokeRect(m2, m2, W - 2 * m2, H - 2 * m2);
    for (const [x, y] of [
      [m2, m2],
      [W - m2, m2],
      [m2, H - m2],
      [W - m2, H - m2],
    ]) {
      petalRing(ctx, x, y, 12, W * 0.05, W * 0.011, '#b5172f');
      petalRing(ctx, x, y, 12, W * 0.034, W * 0.009, '#c9a227', Math.PI / 12);
      ctx.fillStyle = '#fbf4e6';
      circle(ctx, x, y, W * 0.008);
      ctx.fill();
    }
  },
  ornaments() {},
  heroArt(p, hero) {
    mandala(p.ctx, hero.x, hero.y, hero.r * 0.95, ['#c8102e', '#d4a017', '#f28c28', '#a4132a', '#d4a017']);
  },
  photoFrame(p, hero) {
    dotRing(p.ctx, hero.x, hero.y, 36, hero.r * 1.14, hero.r * 0.018, '#c9a227');
  },
};

const diyoLook: Theme = {
  greeting: '#ffd36e',
  message: '#fdf0d5',
  from: '#ffd36e',
  kicker: '#f9c74f',
  tag: 'rgba(255,240,210,0.8)',
  shadow: 'rgba(0,0,0,0.55)',
  ring: '#f9c74f',
  bottomBand: 0.075,
  kickerY: 0.088,
  background(p) {
    const { ctx, W, H, rnd } = p;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070a1f');
    g.addColorStop(0.6, '#160f3a');
    g.addColorStop(1, '#2a0d34');
    fillAll(p, g);
    speckles(p, 150, ['#ffffff'], W * 0.0022, [0.25, 0.9]);
    for (let i = 0; i < 9; i++) {
      const x = rnd() * W;
      const y = rnd() * H * 0.75;
      glow(ctx, x, y, W * 0.02, '#ffffff', 0.5);
    }
    glow(ctx, W / 2, H * 1.02, W * 0.85, '#ff9a3c', 0.4);
  },
  ornaments(p) {
    const { ctx, W, H } = p;
    // A string of lights along the top, as on every house at Tihar.
    const colors = ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#f77f00'];
    const x0 = -W * 0.02;
    const x1 = W * 1.02;
    const y0 = H * 0.012;
    const cy = H * 0.07;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(W / 2, cy, x1, y0);
    ctx.stroke();
    ctx.restore();
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = quad(t, x0, W / 2, x1);
      const y = quad(t, y0, cy, y0) + W * 0.008;
      const c = colors[i % colors.length];
      glow(ctx, x, y, W * 0.024, c, 0.6);
      ctx.fillStyle = c;
      circle(ctx, x, y, W * 0.0065);
      ctx.fill();
    }
    // A row of diyo along the bottom, above the address.
    const s = W * 0.045;
    const y = H - W * 0.105;
    const count = 5;
    for (let i = 0; i < count; i++) diyo(ctx, W * (0.13 + (0.74 * i) / (count - 1)) - s * 0.15, y, s);
  },
  heroArt(p, hero) {
    const { ctx } = p;
    glow(ctx, hero.x, hero.y, hero.r * 1.6, '#ffb347', 0.35);
    dotRing(ctx, hero.x, hero.y, 30, hero.r * 1.02, hero.r * 0.022, '#f9c74f');
    diyo(ctx, hero.x - hero.r * 0.12, hero.y + hero.r * 0.38, hero.r * 0.5);
  },
  photoFrame(p, hero) {
    glow(p.ctx, hero.x, hero.y, hero.r * 1.7, '#ffb347', 0.4);
  },
};

const RANGOLI = ['#ff9f1c', '#ffbf69', '#e71d36', '#2ec4b6', '#ffffff'];

const rangoli: Theme = {
  greeting: '#ffd23f',
  message: '#ffffff',
  from: '#ffbf69',
  kicker: '#ffbf69',
  tag: 'rgba(255,255,255,0.8)',
  shadow: 'rgba(30,0,30,0.55)',
  ring: '#ffd23f',
  bottomBand: 0,
  kickerY: 0.065,
  background(p) {
    const { ctx, W, H } = p;
    const g = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, H * 0.9);
    g.addColorStop(0, '#8e1457');
    g.addColorStop(0.6, '#5a0f4a');
    g.addColorStop(1, '#2c0730');
    fillAll(p, g);
    speckles(p, 320, RANGOLI, W * 0.003, [0.08, 0.25]);
    for (const [x, y] of [
      [0, 0],
      [W, 0],
      [0, H],
      [W, H],
    ]) {
      mandala(ctx, x, y, W * 0.17, RANGOLI);
    }
  },
  ornaments() {},
  heroArt(p, hero) {
    mandala(p.ctx, hero.x, hero.y, hero.r * 1.12, RANGOLI);
  },
  photoFrame(p, hero) {
    mandala(p.ctx, hero.x, hero.y, hero.r * 1.42, RANGOLI);
  },
};

const marigoldLook: Theme = {
  greeting: '#ffd166',
  message: '#f1faee',
  from: '#ffb703',
  kicker: '#ffd166',
  tag: 'rgba(241,250,238,0.8)',
  shadow: 'rgba(0,0,0,0.45)',
  ring: '#ffb703',
  bottomBand: 0,
  kickerY: 0.072,
  background(p) {
    const g = p.ctx.createRadialGradient(p.W / 2, p.H * 0.42, 0, p.W / 2, p.H * 0.42, p.H * 0.85);
    g.addColorStop(0, '#1a6b50');
    g.addColorStop(0.6, '#0f4434');
    g.addColorStop(1, '#082a20');
    fillAll(p, g);
    speckles(p, 90, ['#ffd166'], p.W * 0.002, [0.1, 0.35]);
  },
  ornaments(p) {
    const { ctx, W, H } = p;
    const fr = W * 0.017;
    const flower = (x: number, y: number, i: number) => marigold(ctx, x, y, fr, i % 2 ? 'yellow' : 'orange');
    // Malas swagged along the top, as over a doorway at Tihar…
    swag(ctx, -W * 0.02, H * 0.008, W * 0.35, H * 0.008, H * 0.025, fr * 1.7, flower);
    swag(ctx, W * 0.33, H * 0.008, W * 0.67, H * 0.008, H * 0.025, fr * 1.7, flower);
    swag(ctx, W * 0.65, H * 0.008, W * 1.02, H * 0.008, H * 0.025, fr * 1.7, flower);
    // …and strands hanging down both sides.
    for (const x of [W * 0.045, W * 0.955]) {
      const n = Math.floor((H * 0.42) / (fr * 1.75));
      for (let i = 0; i < n; i++) flower(x, H * 0.02 + i * fr * 1.75, i);
      ctx.fillStyle = '#2d6a4f';
      ctx.beginPath();
      ctx.ellipse(x, H * 0.02 + n * fr * 1.75 + fr * 0.6, fr * 0.45, fr * 1.1, 0, 0, TAU);
      ctx.fill();
    }
  },
  heroArt(p, hero) {
    const { ctx } = p;
    glow(ctx, hero.x, hero.y, hero.r * 1.5, '#ffb703', 0.3);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      marigold(ctx, hero.x + Math.cos(a) * hero.r * 1.0, hero.y + Math.sin(a) * hero.r * 1.0, hero.r * 0.13, i % 2 ? 'yellow' : 'orange');
    }
    marigold(ctx, hero.x, hero.y, hero.r * 0.62, 'orange');
  },
  photoFrame(p, hero) {
    // A mala around the photo.
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      marigold(p.ctx, hero.x + Math.cos(a) * hero.r * 1.1, hero.y + Math.sin(a) * hero.r * 1.1, hero.r * 0.12, i % 2 ? 'yellow' : 'orange');
    }
  },
};

/** The seven colours of the Bhai Tika tika, in the order they are laid. */
const PANCHARANGI = ['#d00000', '#ffba08', '#3a86ff', '#38b000', '#ffffff', '#ff6d00', '#7209b7'];

const bhaitika: Theme = {
  greeting: '#9d0208',
  message: '#3d2c2e',
  from: '#9d0208',
  kicker: '#a4137d',
  tag: '#6c584c',
  shadow: null,
  ring: '#b5179e',
  bottomBand: 0,
  kickerY: 0.072,
  background(p) {
    const { ctx, W, H } = p;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#fff4e8');
    g.addColorStop(1, '#ffdcc2');
    fillAll(p, g);
    glow(ctx, W / 2, H * 0.4, W * 0.7, '#ffb4d9', 0.35);
    speckles(p, 160, ['#b5179e', '#ff6d00', '#ffba08'], W * 0.002, [0.06, 0.18]);
  },
  ornaments(p) {
    const { ctx, W, H } = p;
    const fr = W * 0.016;
    const flower = (x: number, y: number, i: number) =>
      i % 5 === 2 ? marigold(ctx, x, y, fr * 1.05, 'orange') : makhamali(ctx, x, y, fr, i % 7 === 4 ? '#f1f1f1' : '#b5179e');
    swag(ctx, -W * 0.02, H * 0.008, W * 0.52, H * 0.008, H * 0.03, fr * 1.8, flower);
    swag(ctx, W * 0.48, H * 0.008, W * 1.02, H * 0.008, H * 0.03, fr * 1.8, flower);
  },
  heroArt(p, hero) {
    const { ctx } = p;
    const { x, y, r } = hero;
    brassPlate(ctx, x, y, r);
    // The seven-colour tika, as it sits on a brother's forehead.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.3, r * 0.68, 0, 0, TAU);
    ctx.clip();
    const w = (r * 0.6) / PANCHARANGI.length;
    PANCHARANGI.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(x - r * 0.3 + i * w, y - r * 0.7, w + 1, r * 1.4);
    });
    ctx.restore();
    ctx.strokeStyle = '#9d0208';
    ctx.lineWidth = r * 0.02;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.3, r * 0.68, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      makhamali(ctx, x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1, r * 0.085);
    }
  },
  photoFrame(p, hero) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      makhamali(p.ctx, hero.x + Math.cos(a) * hero.r * 1.1, hero.y + Math.sin(a) * hero.r * 1.1, hero.r * 0.075);
    }
  },
};

interface Palette {
  bg: [string, string, string];
  dots: string[];
  text: string;
  accent: string;
}

const LHOSAR: Palette = { bg: ['#0b3d91', '#082a66', '#041a40'], dots: ['#ffd166', '#e63946', '#2a9d8f', '#ffffff'], text: '#ffd166', accent: '#e63946' };

const PALETTES: Record<string, Palette> = {
  teej: { bg: ['#c1121f', '#8d0801', '#4a0404'], dots: ['#2d6a4f', '#ffba08', '#ff4d6d', '#95d5b2'], text: '#ffe8a3', accent: '#95d5b2' },
  chhath: { bg: ['#ff9e00', '#e85d04', '#6a040f'], dots: ['#ffd60a', '#ffba08', '#fff3b0', '#dc2f02'], text: '#fff3b0', accent: '#ffd60a' },
  'nepali-new-year': { bg: ['#1d4ed8', '#0b2e83', '#071a4d'], dots: ['#dc143c', '#ffd166', '#ffffff', '#4cc9f0'], text: '#ffffff', accent: '#ffd166' },
  holi: { bg: ['#3c096c', '#240046', '#10002b'], dots: ['#ff006e', '#fb5607', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0'], text: '#ffffff', accent: '#ffbe0b' },
  'sonam-lhosar': LHOSAR,
  'tamu-lhosar': LHOSAR,
  'gyalpo-lhosar': LHOSAR,
  'saraswati-puja': { bg: ['#e9a800', '#b07d00', '#5c3d00'], dots: ['#fff3b0', '#ffffff', '#ffd166', '#e76f51'], text: '#fffbea', accent: '#ffffff' },
  'buddha-jayanti': { bg: ['#f4a261', '#e76f51', '#7f2e1d'], dots: ['#ffe8d6', '#2ec4b6', '#ffbf69', '#ffffff'], text: '#fffaf0', accent: '#2ec4b6' },
};
const BRAND: Palette = { bg: ['#dc143c', '#8b0f2f', '#003893'], dots: ['#ffd166', '#ffffff', '#4cc9f0'], text: '#ffffff', accent: '#ffd166' };

function festive(festival: string): Theme {
  const pal = PALETTES[festival] ?? BRAND;
  return {
    greeting: pal.text,
    message: '#ffffff',
    from: pal.text,
    kicker: pal.accent,
    tag: 'rgba(255,255,255,0.82)',
    shadow: 'rgba(0,0,0,0.45)',
    ring: pal.accent,
    bottomBand: 0,
    kickerY: 0.065,
    background(p) {
      const { ctx, W, H, rnd } = p;
      const g = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, H * 0.9);
      g.addColorStop(0, pal.bg[0]);
      g.addColorStop(0.55, pal.bg[1]);
      g.addColorStop(1, pal.bg[2]);
      fillAll(p, g);
      if (festival === 'holi') {
        // Clouds of gulal thrown in from the edges.
        for (let i = 0; i < 9; i++) {
          const edge = i % 4;
          const x = edge === 0 ? 0 : edge === 1 ? W : rnd() * W;
          const y = edge === 2 ? 0 : edge === 3 ? H : rnd() * H;
          glow(ctx, x, y, W * (0.25 + rnd() * 0.2), pal.dots[i % pal.dots.length], 0.6);
        }
      }
      for (let i = 0; i < 30; i++) glow(ctx, rnd() * W, rnd() * H, W * (0.01 + rnd() * 0.05), pal.dots[i % pal.dots.length], 0.18 + rnd() * 0.2);
    },
    ornaments(p) {
      const { ctx, W, H, rnd } = p;
      for (let i = 0; i < 70; i++) {
        const top = i % 2 === 0;
        ctx.save();
        ctx.translate(rnd() * W, top ? rnd() * H * 0.1 : H * (0.86 + rnd() * 0.05));
        ctx.rotate(rnd() * Math.PI);
        ctx.fillStyle = pal.dots[i % pal.dots.length];
        ctx.globalAlpha = 0.75;
        ctx.fillRect(-W * 0.006, -W * 0.0025, W * 0.012, W * 0.005);
        ctx.restore();
      }
    },
    heroArt(p, hero) {
      mandala(p.ctx, hero.x, hero.y, hero.r * 1.05, [pal.dots[0], pal.dots[1], pal.dots[2] ?? pal.accent, pal.dots[3] ?? pal.accent, '#ffffff']);
    },
    photoFrame(p, hero) {
      dotRing(p.ctx, hero.x, hero.y, 36, hero.r * 1.14, hero.r * 0.02, pal.accent);
    },
  };
}

function themeFor(look: CardLook, festival: string): Theme {
  switch (look) {
    case 'kites':
      return kites;
    case 'tika':
      return tika;
    case 'diyo':
      return diyoLook;
    case 'rangoli':
      return rangoli;
    case 'marigold':
      return marigoldLook;
    case 'bhaitika':
      return bhaitika;
    case 'classic':
      return classic;
    default:
      return festive(festival);
  }
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function greedy(ctx: C2D, words: string[], maxW: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (!line || ctx.measureText(t).width <= maxW) line = t;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Greedy wrapping leaves "विजया दशमीको हार्दिक मंगलमय / शुभकामना!" — one long
 * line and an orphan. A card wants its lines even, so find the narrowest width
 * that still needs no more lines than greedy wrapping at full width does.
 */
function balancedWrap(ctx: C2D, text: string, maxW: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const target = greedy(ctx, words, maxW);
  if (target.length < 2) return target;
  let lo = maxW / target.length;
  let hi = maxW;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (greedy(ctx, words, mid).length <= target.length) hi = mid;
    else lo = mid;
  }
  return greedy(ctx, words, hi);
}

function font(weight: number, size: number, family: string): string {
  return `${weight} ${Math.round(size)}px ${family}`;
}

function withShadow(ctx: C2D, shadow: string | null, W: number, draw: () => void): void {
  ctx.save();
  if (shadow) {
    ctx.shadowColor = shadow;
    ctx.shadowBlur = W * 0.018;
    ctx.shadowOffsetY = W * 0.003;
  }
  draw();
  ctx.restore();
}

/** The Nepal-flag pennant from the wordmark, as a tiny mark beside the address. */
function pennant(ctx: C2D, x: number, y: number, h: number): void {
  const w = h * 0.82;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, h * 0.46);
  ctx.lineTo(w * 0.38, h * 0.46);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = '#dc143c';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, h * 0.09);
  ctx.strokeStyle = '#003893';
  ctx.stroke();
  ctx.restore();
}

function photoRect(photo: CardPhoto, hero: Hero): { left: number; top: number; dw: number; dh: number } {
  const { x, y, r } = hero;
  const base = Math.max((2 * r) / photo.width, (2 * r) / photo.height);
  const s = base * Math.max(1, photo.zoom);
  const dw = photo.width * s;
  const dh = photo.height * s;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  // The chosen point goes to the centre, but never so far that the circle
  // shows past the photo's edge.
  const left = clamp(x - dw * photo.focusX, x + r - dw, x - r);
  const top = clamp(y - dh * photo.focusY, y + r - dh, y - r);
  return { left, top, dw, dh };
}

function drawPhoto(ctx: C2D, photo: CardPhoto, hero: Hero, ring: string, W: number): void {
  const { x, y, r } = hero;
  const { left, top, dw, dh } = photoRect(photo, hero);
  ctx.save();
  circle(ctx, x, y, r);
  ctx.clip();
  ctx.drawImage(photo.image, left, top, dw, dh);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = ring;
  ctx.lineWidth = W * 0.012;
  circle(ctx, x, y, r + W * 0.006);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = W * 0.0028;
  circle(ctx, x, y, r + W * 0.024);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------

export function drawCard(ctx: C2D, spec: CardSpec): void {
  const W = spec.width;
  const H = spec.height;
  const story = H / W > 1.5;
  const theme = themeFor(spec.look, spec.festival);
  const hero = heroFor(W, H);
  const paint = (seed: number): Paint => ({ ctx, W, H, rnd: rng(seed) });

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  theme.background(paint(11));
  theme.ornaments(paint(23), hero);
  if (spec.photo) {
    theme.photoFrame(paint(37), hero);
    drawPhoto(ctx, spec.photo, hero, theme.ring, W);
  } else {
    theme.heroArt(paint(37), hero);
  }

  // Kicker — "Happy Dashain 2026".
  const kickerSize = W * 0.034;
  ctx.font = font(700, kickerSize, spec.fonts.body);
  ctx.fillStyle = theme.kicker;
  withShadow(ctx, theme.shadow, W, () => ctx.fillText(spec.kicker, W / 2, H * theme.kickerY + kickerSize * 0.35));

  // The bottom: the address, any ornament band above it, the sign-off above that.
  const tagY = H - W * 0.042;
  const bandTop = H - W * 0.09 - theme.bottomBand * H;
  const from = spec.from.trim();
  const fromNameSize = W * 0.056;
  const fromBlock = from ? W * 0.13 : 0;
  const textBottom = bandTop - fromBlock - W * 0.03;
  const textTop = hero.y + hero.r * (spec.photo && spec.look === 'rangoli' ? 1.42 : 1.0) + W * 0.075;
  const avail = Math.max(W * 0.2, textBottom - textTop);
  const maxW = W * 0.84;

  // The English line has a fixed size; the greeting shrinks until both fit.
  const msgSize = W * (story ? 0.04 : 0.036);
  ctx.font = font(500, msgSize, spec.fonts.body);
  let msgLines = spec.message.trim() ? balancedWrap(ctx, spec.message, maxW) : [];
  if (msgLines.length > 4) {
    msgLines = msgLines.slice(0, 4);
    msgLines[3] = `${msgLines[3].replace(/\s*\S+$/, '')}…`;
  }
  const msgLineH = msgSize * 1.38;
  const msgH = msgLines.length * msgLineH;
  const gap = msgLines.length ? W * 0.035 : 0;

  let size = W * (story ? 0.12 : 0.105);
  let lines: string[] = [];
  const lineH = (s: number) => s * 1.34;
  for (;;) {
    ctx.font = font(400, size, spec.fonts.display);
    lines = spec.greeting.trim() ? balancedWrap(ctx, spec.greeting, maxW) : [];
    const fits =
      lines.length <= 3 &&
      lines.every((l) => ctx.measureText(l).width <= maxW) &&
      lines.length * lineH(size) + gap + msgH <= avail;
    if (fits || size <= W * 0.045) break;
    size -= W * 0.003;
  }
  const blockH = lines.length * lineH(size) + gap + msgH;
  let y = textTop + Math.max(0, (avail - blockH) / 2);

  ctx.font = font(400, size, spec.fonts.display);
  ctx.fillStyle = theme.greeting;
  withShadow(ctx, theme.shadow, W, () => {
    for (const l of lines) {
      ctx.fillText(l, W / 2, y + size * 1.0);
      y += lineH(size);
    }
  });
  y += gap;
  ctx.font = font(500, msgSize, spec.fonts.body);
  ctx.fillStyle = theme.message;
  withShadow(ctx, theme.shadow, W, () => {
    for (const l of msgLines) {
      ctx.fillText(l, W / 2, y + msgSize * 1.0);
      y += msgLineH;
    }
  });

  // Sign-off: "शुभेच्छुक" (well-wisher), the way Nepali cards are signed.
  if (from) {
    const top = bandTop - fromBlock;
    ctx.font = font(500, W * 0.03, spec.fonts.body);
    ctx.fillStyle = theme.message;
    ctx.globalAlpha = 0.85;
    withShadow(ctx, theme.shadow, W, () => ctx.fillText('शुभेच्छुक', W / 2, top + W * 0.035));
    ctx.globalAlpha = 1;
    let nameSize = fromNameSize;
    ctx.font = font(700, nameSize, spec.fonts.script);
    while (ctx.measureText(from).width > W * 0.72 && nameSize > W * 0.03) {
      nameSize -= W * 0.002;
      ctx.font = font(700, nameSize, spec.fonts.script);
    }
    ctx.fillStyle = theme.from;
    withShadow(ctx, theme.shadow, W, () => ctx.fillText(from, W / 2, top + W * 0.035 + nameSize * 1.25));
  }

  // The address, small, at the very bottom: what makes a forwarded card
  // bring the next person here.
  const tagSize = W * 0.026;
  const main = 'martnepali.com';
  const rest = '  ·  make yours free';
  ctx.font = font(700, tagSize, spec.fonts.body);
  const mainW = ctx.measureText(main).width;
  ctx.font = font(500, tagSize, spec.fonts.body);
  const restW = ctx.measureText(rest).width;
  const markH = tagSize * 0.95;
  const total = markH * 0.82 + tagSize * 0.45 + mainW + restW;
  let x = W / 2 - total / 2;
  pennant(ctx, x, tagY - markH * 0.82, markH);
  x += markH * 0.82 + tagSize * 0.45;
  ctx.textAlign = 'left';
  ctx.fillStyle = theme.tag;
  ctx.font = font(700, tagSize, spec.fonts.body);
  withShadow(ctx, theme.shadow, W, () => ctx.fillText(main, x, tagY));
  ctx.font = font(500, tagSize, spec.fonts.body);
  ctx.globalAlpha = 0.8;
  withShadow(ctx, theme.shadow, W, () => ctx.fillText(rest, x + mainW, tagY));
  ctx.restore();
}
