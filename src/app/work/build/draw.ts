// "Download as image" on /work/build: the sketch and the summary, drawn on a
// 1200 × 800 canvas (a PNG to keep or send around). Browser-only — it is
// called from a click, never on the server.

import { FEATURE, kindOf, onColor, shade, type Idea } from './idea';
import type { Copy } from './content';

type Names = { name: string; tagline: string; initials: string; kindLabel: string; makeLabel: string };

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Text cut with an ellipsis to fit `max` pixels. */
function fit(ctx: CanvasRenderingContext2D, s: string, max: number): string {
  if (ctx.measureText(s).width <= max) return s;
  const chars = Array.from(s);
  while (chars.length > 1 && ctx.measureText(`${chars.join('')}…`).width > max) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

/** Words wrapped into at most `lines` lines of `max` pixels. */
function wrap(ctx: CanvasRenderingContext2D, s: string, max: number, lines: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= max || !line) line = next;
    else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = fit(ctx, `${kept[lines - 1]} ${out.slice(lines).join(' ')}`, max);
    return kept;
  }
  return out.map((l) => fit(ctx, l, max));
}

export function drawIdea(idea: Idea, t: Copy, n: Names, font: string): HTMLCanvasElement {
  const W = 1200;
  const H = 800;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const c = idea.color;
  const on = onColor(c);
  const deep = shade(c, -0.45);
  const f = (weight: number, size: number) => `${weight} ${size}px ${font}, system-ui, -apple-system, 'Segoe UI', sans-serif`;
  const emoji = (size: number) => `${size}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`;

  // Background: night with a glow of their colour.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b0c14');
  bg.addColorStop(1, shade(c, -0.82));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(280, 240, 20, 280, 240, 520);
  glow.addColorStop(0, `${c}66`);
  glow.addColorStop(1, `${c}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ---- The phone ----
  const px = 110;
  const py = 70;
  const pw = 330;
  const ph = 660;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  rr(ctx, px, py, pw, ph, 50);
  ctx.fillStyle = '#16171f';
  ctx.fill();
  ctx.restore();
  const sx = px + 12;
  const sy = py + 12;
  const sw = pw - 24;
  const sh = ph - 24;
  ctx.save();
  rr(ctx, sx, sy, sw, sh, 40);
  ctx.clip();
  ctx.fillStyle = '#f7f6f3';
  ctx.fillRect(sx, sy, sw, sh);
  // App header in their colour.
  const head = ctx.createLinearGradient(sx, sy, sx + sw, sy + 130);
  head.addColorStop(0, c);
  head.addColorStop(1, deep);
  ctx.fillStyle = head;
  ctx.fillRect(sx, sy, sw, 132);
  // Emblem.
  const ex = sx + 46;
  const ey = sy + 78;
  ctx.beginPath();
  ctx.arc(ex, ey, 26, 0, Math.PI * 2);
  ctx.fillStyle = on;
  ctx.fill();
  ctx.fillStyle = c;
  ctx.font = f(800, n.initials.length > 2 ? 15 : 19);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(n.initials, ex, ey + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = onColor(c);
  ctx.font = f(800, 21);
  ctx.fillText(fit(ctx, n.name, sw - 100), sx + 84, sy + 76);
  ctx.globalAlpha = 0.85;
  ctx.font = f(500, 13);
  ctx.fillText(fit(ctx, n.tagline, sw - 100), sx + 84, sy + 96);
  ctx.globalAlpha = 1;

  // Hero card.
  let y = sy + 150;
  const hero = ctx.createLinearGradient(sx + 16, y, sx + sw - 16, y + 96);
  hero.addColorStop(0, shade(c, 0.82));
  hero.addColorStop(1, shade(c, 0.6));
  rr(ctx, sx + 16, y, sw - 32, 92, 18);
  ctx.fillStyle = hero;
  ctx.fill();
  ctx.font = emoji(34);
  ctx.fillStyle = '#000';
  ctx.fillText(kindOf(idea).icon, sx + 32, y + 58);
  ctx.fillStyle = '#1c1917';
  ctx.font = f(800, 17);
  ctx.fillText(fit(ctx, t.mock.welcome, sw - 120), sx + 84, y + 42);
  ctx.font = f(500, 13);
  ctx.fillStyle = '#57534e';
  ctx.fillText(fit(ctx, n.kindLabel, sw - 120), sx + 84, y + 62);
  y += 108;

  // One row per feature.
  const rows = idea.features.slice(0, 6);
  for (const id of rows) {
    rr(ctx, sx + 16, y, sw - 32, 50, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.stroke();
    rr(ctx, sx + 26, y + 9, 32, 32, 10);
    ctx.fillStyle = shade(c, 0.85);
    ctx.fill();
    ctx.font = emoji(18);
    ctx.fillStyle = '#000';
    ctx.fillText(FEATURE[id].icon, sx + 32, y + 32);
    ctx.font = f(700, 14);
    ctx.fillStyle = '#1c1917';
    ctx.fillText(fit(ctx, t.features[id].label, sw - 110), sx + 70, y + 30);
    y += 58;
  }
  if (idea.features.length > rows.length) {
    ctx.font = f(700, 13);
    ctx.fillStyle = c;
    ctx.fillText(`+${idea.features.length - rows.length}`, sx + 26, y + 16);
  }
  if (!idea.features.length) {
    ctx.font = f(500, 13);
    ctx.fillStyle = '#78716c';
    for (const [i, l] of wrap(ctx, t.mock.emptyApp, sw - 48, 2).entries()) ctx.fillText(l, sx + 24, y + 18 + i * 18);
  }

  // Tab bar.
  const tabs = ['🏠', ...idea.features.slice(0, 4).map((id) => FEATURE[id].icon)];
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx, sy + sh - 64, sw, 64);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.fillRect(sx, sy + sh - 64, sw, 1);
  ctx.font = emoji(20);
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  tabs.forEach((ic, i) => ctx.fillText(ic, sx + (sw / tabs.length) * (i + 0.5), sy + sh - 26));
  ctx.textAlign = 'left';
  ctx.restore();

  // ---- The card ----
  const rx = 520;
  const rw = W - rx - 80;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = f(700, 16);
  ctx.fillText('MARTNEPALI STUDIO', rx, 112);
  ctx.fillStyle = shade(c, 0.45);
  ctx.font = f(700, 22);
  ctx.fillText(t.image.title, rx, 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = f(800, 50);
  let ty = 210;
  for (const l of wrap(ctx, n.name, rw, 2)) {
    ctx.fillText(l, rx, ty);
    ty += 58;
  }
  if (n.tagline) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = f(500, 22);
    ctx.fillText(fit(ctx, n.tagline, rw), rx, ty - 8);
    ty += 34;
  }
  // Chips: what, make, colour.
  ty += 6;
  let cx = rx;
  ctx.font = f(700, 16);
  for (const label of [n.kindLabel, n.makeLabel, idea.color]) {
    const w = ctx.measureText(label).width + (label === idea.color ? 52 : 32);
    rr(ctx, cx, ty, w, 38, 19);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    let tx = cx + 16;
    if (label === idea.color) {
      ctx.beginPath();
      ctx.arc(cx + 22, ty + 19, 9, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      tx = cx + 38;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, tx, ty + 25);
    cx += w + 10;
  }
  ty += 72;
  // Features, in two columns.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = f(700, 15);
  ctx.fillText(t.summary.features.toUpperCase(), rx, ty);
  ty += 16;
  const colW = rw / 2;
  const list = idea.features.length ? idea.features : [];
  list.forEach((id, i) => {
    const col = list.length > 6 ? i % 2 : 0;
    const row = list.length > 6 ? Math.floor(i / 2) : i;
    const fx = rx + col * colW;
    const fy = ty + 14 + row * 40;
    if (fy > H - 120) return;
    ctx.font = emoji(20);
    ctx.fillStyle = '#000';
    ctx.fillText(FEATURE[id].icon, fx, fy + 22);
    ctx.font = f(600, 17);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(fit(ctx, t.features[id].label, (list.length > 6 ? colW : rw) - 44), fx + 34, fy + 21);
  });
  if (!list.length) {
    ctx.font = f(500, 17);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(t.summary.none, rx, ty + 34);
  }
  // Footer.
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(rx, H - 96, rw, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = f(500, 16);
  ctx.fillText(fit(ctx, t.image.footer, rw), rx, H - 62);
  return canvas;
}
