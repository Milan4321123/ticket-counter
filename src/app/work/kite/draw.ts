// Everything Changa Chet! draws, procedurally, on a 2D canvas: an autumn sky
// over the valley, a Himalaya silhouette, hills with a little stupa, Kathmandu
// rooftops (brick, black water tanks, prayer flags, power poles), the flyers
// on their roofs, strings and the kites themselves. Coordinates are world
// units (kite.ts: H = 1000 tall, W wide); the caller sets the transform.
// The heavy, still parts are drawn once into layers and reused every frame.

import { H, PLAYER_SLOT, SLOTS, anchorAt, type KiteLook, type Vec, type Wire } from './kite';

type Ctx = CanvasRenderingContext2D;

export type House = { x: number; w: number; top: number; color: string; tank: number | null; stair: number | null; seed: number };
export type Cloud = { x: number; y: number; s: number; v: number };
export type FarKite = { x: number; y: number; s: number; look: KiteLook; ph: number };
export type FlagLine = { a: Vec; b: Vec };
export type Scene = {
  W: number;
  pad: number;
  peaks: Vec[];
  ridge: Vec[];
  hills: Vec[];
  back: House[];
  front: House[];
  clouds: Cloud[];
  far: FarKite[];
  flags: FlagLine[];
  sock: Vec;
  roofOf: (x: number) => number;
};

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FRONT_COLORS = ['#b4533c', '#c98a3e', '#d8908a', '#e6d2a8', '#7e93a6', '#9c6b4e', '#c7b299', '#a9472f', '#d9b36c'];
const BACK_COLORS = ['#a07f74', '#a3967f', '#8f9aa6', '#b3998a', '#968478'];
const FAR_COLORS = ['#e23d3d', '#1f7ae0', '#f2b705', '#14a37f', '#8e44ad', '#ff7a1a', '#e84393'];

export function makeScene(W: number, seed = 7): Scene {
  const r = rng(seed + Math.round(W));
  const pad = 70;

  // Himalaya: a few big snowy peaks with smaller ones between.
  const peaks: Vec[] = [{ x: -pad, y: 600 }];
  let x = -pad;
  while (x < W + pad) {
    x += 40 + r() * 70;
    const big = r() < 0.3;
    peaks.push({ x, y: big ? 455 + r() * 45 : 520 + r() * 50 });
    x += 30 + r() * 50;
    peaks.push({ x, y: 560 + r() * 40 });
  }
  const ridge: Vec[] = [];
  for (let xx = -pad; xx <= W + pad + 60; xx += 60) ridge.push({ x: xx, y: 610 + Math.sin(xx * 0.011 + 1) * 14 + r() * 12 });
  const hills: Vec[] = [];
  for (let xx = -pad; xx <= W + pad + 40; xx += 40) hills.push({ x: xx, y: 712 + Math.sin(xx * 0.006) * 22 + Math.sin(xx * 0.017 + 2) * 8 });

  // Far row of houses (behind), then the front row with every flyer's roof.
  const back: House[] = [];
  for (let xx = -pad; xx < W + pad; ) {
    const w = 38 + r() * 56;
    back.push({ x: xx, w, top: 772 + r() * 50, color: BACK_COLORS[Math.floor(r() * BACK_COLORS.length)], tank: null, stair: null, seed: Math.floor(r() * 1e6) });
    xx += w + 2;
  }
  const spots = [PLAYER_SLOT, ...SLOTS].map((s) => ({ ...anchorAt(s.fx, s.y, W), me: s === PLAYER_SLOT }));
  const front: House[] = spots.map((s) => {
    const w = s.me ? 150 : 124;
    return {
      x: s.x - w / 2,
      w,
      top: s.y + 26,
      color: s.me ? '#c4573d' : FRONT_COLORS[Math.floor(r() * FRONT_COLORS.length)],
      tank: s.me ? null : r() < 0.6 ? (r() < 0.5 ? 0.12 : 0.74) : null,
      stair: s.me ? 0.72 : null,
      seed: Math.floor(r() * 1e6),
    };
  });
  front.sort((a, b) => a.x - b.x);
  const gaps: House[] = [];
  let edge = -pad - 10;
  for (const h of [...front, { x: W + pad + 10, w: 0 } as House]) {
    let gx = edge + 2;
    while (h.x - gx > 30) {
      const w = Math.min(h.x - gx - 2, 60 + r() * 70);
      gaps.push({
        x: gx,
        w,
        top: 878 + r() * 64,
        color: FRONT_COLORS[Math.floor(r() * FRONT_COLORS.length)],
        tank: r() < 0.5 ? 0.2 + r() * 0.5 : null,
        stair: r() < 0.35 ? 0.15 + r() * 0.5 : null,
        seed: Math.floor(r() * 1e6),
      });
      gx += w + 2;
    }
    edge = Math.max(edge, h.x + h.w);
  }
  const all = [...front, ...gaps].sort((a, b) => a.x - b.x);
  const roofOf = (px: number) => all.find((h) => px >= h.x && px <= h.x + h.w)?.top ?? 940;

  const clouds: Cloud[] = Array.from({ length: 6 }, () => ({ x: r() * (W + 400), y: 70 + r() * 330, s: 0.6 + r() * 0.9, v: 4 + r() * 8 }));
  const far: FarKite[] = Array.from({ length: 8 }, () => ({
    x: r() * W,
    y: 90 + r() * 360,
    s: 5 + r() * 6,
    look: { main: FAR_COLORS[Math.floor(r() * FAR_COLORS.length)], accent: '#f5f0e6', pattern: 'stripes' },
    ph: r() * 6,
  }));

  // Prayer flags strung between neighbouring roofs.
  const flags: FlagLine[] = [];
  for (let i = 0; i < all.length - 1; i++) {
    if (r() < 0.45) continue;
    const a = all[i];
    const b = all[i + 1];
    flags.push({ a: { x: a.x + a.w * 0.6, y: a.top - 34 }, b: { x: b.x + b.w * 0.4, y: b.top - 30 } });
  }
  const me = anchorAt(PLAYER_SLOT.fx, PLAYER_SLOT.y, W);
  return { W, pad, peaks, ridge, hills, back, front: all, clouds, far, flags, sock: { x: me.x + 52, y: me.y + 26 }, roofOf };
}

// ---------- sky and far layers ----------

export function drawSky(ctx: Ctx, W: number, x0 = -200, w = W + 400) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2c5b9a');
  g.addColorStop(0.42, '#78aad8');
  g.addColorStop(0.68, '#f2cfa2');
  g.addColorStop(0.82, '#f0a974');
  g.addColorStop(1, '#e48a5c');
  ctx.fillStyle = g;
  ctx.fillRect(x0, -50, w, H + 100);
  // A low autumn sun.
  const sx = W * 0.82;
  const sy = 190;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 200);
  sg.addColorStop(0, 'rgba(255,248,220,0.95)');
  sg.addColorStop(0.18, 'rgba(255,236,180,0.7)');
  sg.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sx - 200, sy - 200, 400, 400);
}

export function drawMountains(ctx: Ctx, sc: Scene) {
  const g = ctx.createLinearGradient(0, 450, 0, 640);
  g.addColorStop(0, '#fbfcff');
  g.addColorStop(0.32, '#dfe6f5');
  g.addColorStop(0.55, '#a9b6d6');
  g.addColorStop(1, '#8394be');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-sc.pad, 700);
  for (const p of sc.peaks) ctx.lineTo(p.x, p.y);
  ctx.lineTo(sc.W + sc.pad, 700);
  ctx.closePath();
  ctx.fill();
  // Shadow sides of the peaks.
  ctx.fillStyle = 'rgba(80,96,150,0.18)';
  for (let i = 1; i < sc.peaks.length - 1; i++) {
    const p = sc.peaks[i];
    if (p.y > 520) continue;
    const n = sc.peaks[i + 1];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(n.x, n.y);
    ctx.lineTo(n.x - 14, 640);
    ctx.lineTo(p.x + 4, 640);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#6f80ab';
  ctx.beginPath();
  ctx.moveTo(-sc.pad, 720);
  for (const p of sc.ridge) ctx.lineTo(p.x, p.y);
  ctx.lineTo(sc.W + sc.pad + 60, 720);
  ctx.closePath();
  ctx.fill();
}

export function drawMid(ctx: Ctx, sc: Scene) {
  // Valley haze.
  const hz = ctx.createLinearGradient(0, 640, 0, 760);
  hz.addColorStop(0, 'rgba(240,190,150,0)');
  hz.addColorStop(1, 'rgba(240,190,150,0.35)');
  ctx.fillStyle = hz;
  ctx.fillRect(-sc.pad, 620, sc.W + sc.pad * 2, 160);
  // Green hills.
  const hg = ctx.createLinearGradient(0, 690, 0, 820);
  hg.addColorStop(0, '#5a8a72');
  hg.addColorStop(1, '#3f6655');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(-sc.pad, 900);
  for (const p of sc.hills) ctx.lineTo(p.x, p.y);
  ctx.lineTo(sc.W + sc.pad + 40, 900);
  ctx.closePath();
  ctx.fill();
  // A little white stupa on a hilltop.
  const sx = sc.W * 0.27;
  const sy = 716 + Math.sin(sx * 0.006) * 22 + Math.sin(sx * 0.017 + 2) * 8 - 6;
  ctx.fillStyle = '#f4efe4';
  ctx.beginPath();
  ctx.ellipse(sx, sy, 22, 16, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(sx - 26, sy - 1, 52, 6);
  ctx.fillStyle = '#e8dcc0';
  ctx.fillRect(sx - 6, sy - 24, 12, 9);
  ctx.fillStyle = '#26324a';
  ctx.fillRect(sx - 4, sy - 21, 2.4, 1.6);
  ctx.fillRect(sx + 1.6, sy - 21, 2.4, 1.6);
  ctx.fillStyle = '#d9a52b';
  ctx.beginPath();
  ctx.moveTo(sx - 5, sy - 24);
  ctx.lineTo(sx, sy - 50);
  ctx.lineTo(sx + 5, sy - 24);
  ctx.closePath();
  ctx.fill();
  // Far houses.
  for (const h of sc.back) {
    ctx.fillStyle = h.color;
    ctx.fillRect(h.x, h.top, h.w, H - h.top);
    ctx.fillStyle = 'rgba(40,30,30,0.35)';
    const r = rng(h.seed);
    for (let y = h.top + 12; y < 900; y += 22) for (let x = h.x + 8; x < h.x + h.w - 8; x += 16) if (r() < 0.7) ctx.fillRect(x, y, 6, 9);
  }
  // A pagoda temple roof among them.
  const tx = sc.W * 0.74;
  const ty = 800;
  ctx.fillStyle = '#7b5a43';
  ctx.fillRect(tx - 30, ty - 6, 60, 60);
  const tier = (w: number, y: number, h: number) => {
    ctx.fillStyle = '#4a2f22';
    ctx.beginPath();
    ctx.moveTo(tx - w, y + h);
    ctx.lineTo(tx - w * 0.45, y);
    ctx.lineTo(tx + w * 0.45, y);
    ctx.lineTo(tx + w, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(tx - w, y + h - 3, w * 2, 3);
  };
  tier(54, ty - 22, 18);
  ctx.fillStyle = '#7b5a43';
  ctx.fillRect(tx - 20, ty - 40, 40, 20);
  tier(40, ty - 58, 16);
  ctx.fillRect(tx - 12, ty - 74, 24, 16);
  tier(28, ty - 90, 14);
  ctx.fillStyle = '#e1b23a';
  ctx.beginPath();
  ctx.moveTo(tx - 5, ty - 90);
  ctx.lineTo(tx, ty - 112);
  ctx.lineTo(tx + 5, ty - 90);
  ctx.closePath();
  ctx.fill();
  // Haze over the far town so the front roofs read clearly.
  const fz = ctx.createLinearGradient(0, 760, 0, 880);
  fz.addColorStop(0, 'rgba(244,206,170,0.05)');
  fz.addColorStop(1, 'rgba(244,206,170,0.4)');
  ctx.fillStyle = fz;
  ctx.fillRect(-sc.pad, 760, sc.W + sc.pad * 2, 140);
}

export function drawFront(ctx: Ctx, sc: Scene, wires: Wire[]) {
  for (const h of sc.front) drawHouse(ctx, h);
  // Power poles and lines (a stray old kite caught on the left one).
  for (const w of wires) {
    const ends = [w.pts[0], w.pts[w.pts.length - 1]];
    for (const e of ends) {
      ctx.fillStyle = '#6d6a66';
      ctx.fillRect(e.x - 4, e.y - 14, 8, H - e.y + 14);
      ctx.fillStyle = '#4c4946';
      ctx.fillRect(e.x - 16, e.y - 6, 32, 5);
      ctx.fillRect(e.x - 12, e.y + 14, 24, 4);
    }
    ctx.strokeStyle = '#26221f';
    ctx.lineWidth = 2.6;
    for (const dy of [0, 20]) {
      ctx.beginPath();
      w.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + dy) : ctx.moveTo(p.x, p.y + dy)));
      ctx.stroke();
    }
  }
  const w0 = wires[0];
  if (w0) {
    const p = w0.pts[2];
    ctx.globalAlpha = 0.75;
    drawKite(ctx, p.x, p.y + 12, 2.6, { main: '#c9b48a', accent: '#8a6a3a', pattern: 'stripes' }, 11);
    ctx.globalAlpha = 1;
  }
}

function drawHouse(ctx: Ctx, h: House) {
  const r = rng(h.seed);
  ctx.fillStyle = h.color;
  ctx.fillRect(h.x, h.top, h.w, H - h.top + 2);
  // Shade on the right edge, parapet on top.
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(h.x + h.w - 8, h.top, 8, H - h.top);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(h.x - 2, h.top - 6, h.w + 4, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(h.x - 2, h.top - 6, h.w + 4, 2);
  // Windows with carved-wood frames.
  for (let y = h.top + 26; y < H - 10; y += 50) {
    for (let x = h.x + 12; x + 18 < h.x + h.w - 8; x += 34) {
      if (r() < 0.15) continue;
      ctx.fillStyle = '#5b3420';
      ctx.fillRect(x - 3, y - 3, 22, 30);
      ctx.fillStyle = r() < 0.25 ? '#f6d48a' : '#2a2421';
      ctx.fillRect(x, y, 16, 24);
      ctx.fillStyle = '#5b3420';
      ctx.fillRect(x + 7, y, 2, 24);
    }
  }
  // A stair head room and a black water tank on the roof.
  if (h.stair !== null) {
    const sx = h.x + h.w * h.stair - 18;
    ctx.fillStyle = h.color;
    ctx.fillRect(sx, h.top - 34, 36, 34);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(sx, h.top - 34, 36, 34);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(sx - 2, h.top - 38, 40, 5);
    ctx.fillStyle = '#3a2a22';
    ctx.fillRect(sx + 10, h.top - 26, 14, 26);
  }
  if (h.tank !== null) {
    const tx = h.x + h.w * h.tank;
    ctx.fillStyle = '#1d1d22';
    ctx.fillRect(tx - 13, h.top - 36, 26, 30);
    ctx.beginPath();
    ctx.ellipse(tx, h.top - 36, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(tx - 9, h.top - 33, 3, 24);
    ctx.fillStyle = '#3a3a40';
    ctx.fillRect(tx - 15, h.top - 7, 30, 3);
  }
  // Rails and an antenna now and then.
  ctx.strokeStyle = 'rgba(40,30,25,0.55)';
  ctx.lineWidth = 1.5;
  if (r() < 0.5) {
    ctx.beginPath();
    ctx.moveTo(h.x + 4, h.top - 16);
    ctx.lineTo(h.x + h.w - 4, h.top - 16);
    for (let x = h.x + 4; x <= h.x + h.w - 4; x += 14) {
      ctx.moveTo(x, h.top - 16);
      ctx.lineTo(x, h.top - 6);
    }
    ctx.stroke();
  }
  if (r() < 0.35) {
    const ax = h.x + h.w * (0.2 + r() * 0.6);
    ctx.beginPath();
    ctx.moveTo(ax, h.top - 6);
    ctx.lineTo(ax, h.top - 52);
    ctx.moveTo(ax - 10, h.top - 44);
    ctx.lineTo(ax + 10, h.top - 44);
    ctx.moveTo(ax - 7, h.top - 36);
    ctx.lineTo(ax + 7, h.top - 36);
    ctx.stroke();
  }
}

// ---------- live parts ----------

export function drawClouds(ctx: Ctx, sc: Scene, t: number, wind: number) {
  const span = sc.W + 400;
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  for (const c of sc.clouds) {
    let x = (c.x + t * (c.v + wind * 0.06)) % span;
    if (x < 0) x += span;
    x -= 200;
    const s = c.s;
    ctx.beginPath();
    ctx.ellipse(x, c.y, 60 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 30 * s, c.y - 8 * s, 28 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 10 * s, c.y - 18 * s, 34 * s, 26 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 42 * s, c.y - 6 * s, 24 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawFarKites(ctx: Ctx, sc: Scene, t: number, wind: number) {
  for (const k of sc.far) {
    const x = k.x + Math.sin(t * 0.7 + k.ph) * 14 + wind * 0.08;
    const y = k.y + Math.cos(t * 0.9 + k.ph) * 8;
    ctx.strokeStyle = 'rgba(60,50,60,0.18)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 40, y + 200, x + 20 - (k.x - sc.W / 2) * 0.1, 820);
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    drawKite(ctx, x, y, Math.sin(t * 1.3 + k.ph) * 0.35, k.look, k.s, { simple: true });
    ctx.globalAlpha = 1;
  }
}

const FLAG_COLORS = ['#2f62c9', '#f4f1e8', '#d63a2f', '#2d9b55', '#f2c230'];

export function drawFlags(ctx: Ctx, sc: Scene, t: number, wind: number, calm: boolean) {
  const flutter = calm ? 0.3 : 1;
  ctx.lineWidth = 1;
  for (const f of sc.flags) {
    const mx = (f.a.x + f.b.x) / 2;
    const my = (f.a.y + f.b.y) / 2 + 16;
    ctx.strokeStyle = 'rgba(40,30,30,0.6)';
    ctx.beginPath();
    ctx.moveTo(f.a.x, f.a.y);
    ctx.quadraticCurveTo(mx, my, f.b.x, f.b.y);
    ctx.stroke();
    const len = Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y);
    const n = Math.max(3, Math.floor(len / 15));
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const x = (1 - u) * (1 - u) * f.a.x + 2 * (1 - u) * u * mx + u * u * f.b.x;
      const y = (1 - u) * (1 - u) * f.a.y + 2 * (1 - u) * u * my + u * u * f.b.y;
      const sway = (wind * 0.07 + Math.sin(t * 6 + i * 1.7) * 1.6 * flutter) * flutter;
      ctx.fillStyle = FLAG_COLORS[i % 5];
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x + 4 + sway, y + 11);
      ctx.lineTo(x - 4 + sway, y + 11);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** The wind sock on your roof: points downwind, droops in a lull. */
export function drawSock(ctx: Ctx, sc: Scene, t: number, wind: number, calm: boolean) {
  const { x, y } = sc.sock;
  const top = y - 70;
  ctx.strokeStyle = '#3b3530';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x, top);
  ctx.stroke();
  const dir = wind >= 0 ? 1 : -1;
  const str = Math.min(1, Math.abs(wind) / 90);
  const len = 26 + 26 * str;
  const droop = 22 * (1 - str);
  const wob = calm ? 0 : Math.sin(t * 9) * 2.5 * str;
  const segs = 3;
  for (let i = 0; i < segs; i++) {
    const u0 = i / segs;
    const u1 = (i + 1) / segs;
    const w0 = 8 * (1 - u0 * 0.5);
    const w1 = 8 * (1 - u1 * 0.5);
    const x0 = x + dir * len * u0;
    const x1 = x + dir * len * u1;
    const y0 = top + 6 + droop * u0 * u0 + wob * u0;
    const y1 = top + 6 + droop * u1 * u1 + wob * u1;
    ctx.fillStyle = i % 2 ? '#f6f2ea' : '#e0412f';
    ctx.beginPath();
    ctx.moveTo(x0, y0 - w0);
    ctx.lineTo(x1, y1 - w1);
    ctx.lineTo(x1, y1 + w1);
    ctx.lineTo(x0, y0 + w0);
    ctx.closePath();
    ctx.fill();
  }
}

/** A flyer on their roof; the hand is the string's anchor. */
export function drawFlyer(ctx: Ctx, hand: Vec, shirt: string, cap: string, t: number, me: boolean, pulling: boolean) {
  const roof = hand.y + 26;
  const bx = hand.x - 15;
  const tug = pulling ? Math.sin(t * 22) * 1.5 : 0;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#2c2522';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(bx - 4, roof);
  ctx.lineTo(bx - 1, roof - 20);
  ctx.moveTo(bx + 5, roof);
  ctx.lineTo(bx + 1, roof - 20);
  ctx.stroke();
  ctx.strokeStyle = shirt;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(bx, roof - 20);
  ctx.lineTo(bx, roof - 38);
  ctx.stroke();
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(bx + 2, roof - 36);
  ctx.lineTo(hand.x, hand.y + tug);
  ctx.moveTo(bx - 2, roof - 34);
  ctx.lineTo(bx - 8, roof - 22);
  ctx.stroke();
  // The latai (spool) in the other hand.
  ctx.fillStyle = '#c99a4b';
  ctx.fillRect(bx - 14, roof - 26, 10, 8);
  ctx.fillStyle = '#7a4e22';
  ctx.fillRect(bx - 15, roof - 27, 12, 2);
  ctx.fillRect(bx - 15, roof - 19, 12, 2);
  ctx.fillStyle = '#7a5236';
  ctx.beginPath();
  ctx.arc(bx, roof - 46, 7, 0, Math.PI * 2);
  ctx.fill();
  // Dhaka-style cap.
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.moveTo(bx - 7, roof - 49);
  ctx.lineTo(bx - 5, roof - 57);
  ctx.lineTo(bx + 6, roof - 56);
  ctx.lineTo(bx + 7, roof - 49);
  ctx.closePath();
  ctx.fill();
  ctx.lineCap = 'butt';
  if (me) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(bx - 6, roof - 72);
    ctx.lineTo(bx + 6, roof - 72);
    ctx.lineTo(bx, roof - 64);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawString(ctx: Ctx, a: Vec, k: Vec, tension: number, wind: number, color: string, width: number) {
  const len = Math.hypot(k.x - a.x, k.y - a.y);
  const sag = (1 - tension) * len * 0.12 + len * 0.015;
  const mx = (a.x + k.x) / 2 + wind * 0.25 * (1 - tension);
  const my = (a.y + k.y) / 2 + sag;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(mx, my, k.x, k.y);
  ctx.stroke();
}

type KiteOpts = { simple?: boolean; outline?: string };

function diamond(ctx: Ctx, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.08);
  ctx.lineTo(r * 0.98, -r * 0.06);
  ctx.lineTo(0, r * 1.08);
  ctx.lineTo(-r * 0.98, -r * 0.06);
  ctx.closePath();
}

/** A Nepali changa: a square kite flown corner-up, bow spar, little tail. */
export function drawKite(ctx: Ctx, x: number, y: number, a: number, look: KiteLook, r: number, opts: KiteOpts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  // tail
  ctx.fillStyle = look.accent;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.95);
  ctx.lineTo(-r * 0.34, r * 1.48);
  ctx.lineTo(r * 0.34, r * 1.48);
  ctx.closePath();
  ctx.fill();
  diamond(ctx, r);
  ctx.fillStyle = look.main;
  ctx.fill();
  if (!opts.simple) {
    ctx.save();
    diamond(ctx, r);
    ctx.clip();
    drawPattern(ctx, look, r);
    ctx.restore();
  } else {
    ctx.fillStyle = look.accent;
    ctx.fillRect(-r, -r * 0.06, r * 2, r * 0.3);
  }
  diamond(ctx, r);
  ctx.strokeStyle = opts.outline ?? 'rgba(30,20,15,0.45)';
  ctx.lineWidth = Math.max(0.6, r * 0.07);
  ctx.stroke();
  if (!opts.simple) {
    ctx.strokeStyle = 'rgba(70,45,20,0.55)';
    ctx.lineWidth = Math.max(0.6, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.08);
    ctx.lineTo(0, r * 1.08);
    ctx.moveTo(-r * 0.98, -r * 0.06);
    ctx.quadraticCurveTo(0, -r * 0.78, r * 0.98, -r * 0.06);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPattern(ctx: Ctx, look: KiteLook, r: number) {
  const { main, accent, pattern } = look;
  if (pattern === 'stripes') {
    ctx.save();
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = accent;
    for (let k = -4; k <= 4; k += 2) ctx.fillRect(-r * 2, k * r * 0.24 - r * 0.12, r * 4, r * 0.24);
    ctx.restore();
    return;
  }
  if (pattern === 'eye') {
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, r * 0.05);
    ctx.quadraticCurveTo(0, -r * 0.62, r * 0.72, r * 0.05);
    ctx.quadraticCurveTo(0, r * 0.62, -r * 0.72, r * 0.05);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, r * 0.05, r * 0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#141414';
    ctx.beginPath();
    ctx.arc(0, r * 0.05, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(r * 0.07, -r * 0.02, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = r * 0.1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.42);
    ctx.quadraticCurveTo(0, -r * 0.78, r * 0.6, -r * 0.42);
    ctx.stroke();
    return;
  }
  if (pattern === 'sunmoon') {
    // A crescent moon above and a rayed sun below, inside a border.
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.arc(0, -r * 0.34, r * 0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.arc(0, -r * 0.45, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const an = (i / 12) * Math.PI * 2;
      const ro = r * 0.27;
      const ri = r * 0.17;
      const a2 = an + Math.PI / 12;
      ctx.lineTo(Math.cos(an) * ro, r * 0.38 + Math.sin(an) * ro);
      ctx.lineTo(Math.cos(a2) * ri, r * 0.38 + Math.sin(a2) * ri);
    }
    ctx.closePath();
    ctx.fill();
    diamond(ctx, r);
    ctx.strokeStyle = accent;
    ctx.lineWidth = r * 0.24;
    ctx.stroke();
    return;
  }
  // mandala
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = main;
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i / 8) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.36, r * 0.11, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,250,240,0.8)';
  ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawBird(ctx: Ctx, x: number, y: number, t: number, ph: number, dir: number) {
  const f = Math.sin(t * 12 + ph) * 7;
  ctx.strokeStyle = '#26232c';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 13, y - f);
  ctx.quadraticCurveTo(x - 6, y - 7 - f * 0.3, x, y);
  ctx.quadraticCurveTo(x + 6, y - 7 - f * 0.3, x + 13, y - f);
  ctx.stroke();
  ctx.fillStyle = '#26232c';
  ctx.beginPath();
  ctx.arc(x + dir * 2, y + 1, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'butt';
}

/** The share picture (1080 × 1080): your kite over the roofs and your score. */
export function drawShareCard(
  ctx: Ctx,
  o: { look: KiteLook; title: string; big: string; line: string; foot: string; font: string }
) {
  const S = 1080;
  const W = H; // a square world, scaled up to the picture
  const sc = makeScene(W, 3);
  ctx.save();
  ctx.scale(S / H, S / H);
  drawSky(ctx, W, 0, W);
  drawClouds(ctx, sc, 40, 20);
  drawMountains(ctx, sc);
  drawMid(ctx, sc);
  drawFarKites(ctx, sc, 3, 20);
  drawFront(ctx, sc, []);
  drawFlags(ctx, sc, 1, 20, true);
  const hand = anchorAt(PLAYER_SLOT.fx, PLAYER_SLOT.y, W);
  drawString(ctx, hand, { x: W * 0.62, y: 520 }, 0.7, 20, 'rgba(255,255,255,0.9)', 2.4);
  drawFlyer(ctx, hand, '#1f7ae0', '#e0412f', 0, false, false);
  drawKite(ctx, W * 0.62, 520, 0.35, o.look, 92);
  ctx.restore();
  // Text panel.
  ctx.fillStyle = 'rgba(18,22,44,0.55)';
  ctx.fillRect(0, 0, S, 330);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd36b';
  ctx.font = `800 64px ${o.font}`;
  ctx.fillText(o.title, S / 2, 96);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 132px ${o.font}`;
  ctx.fillText(o.big, S / 2, 228);
  ctx.font = `600 38px ${o.font}`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(o.line, S / 2, 294);
  ctx.fillStyle = 'rgba(18,22,44,0.6)';
  ctx.fillRect(0, S - 74, S, 74);
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 32px ${o.font}`;
  ctx.fillText(o.foot, S / 2, S - 26);
}
