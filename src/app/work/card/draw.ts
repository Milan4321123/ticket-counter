// The pictures /work/card hands out: the business card (front and back in one
// PNG, 85 × 55 mm at 300 dpi per side) and a wallet-pass look-alike (just a
// PNG — clearly labelled as not a real Apple or Google Wallet pass). Drawn on
// a canvas in the visitor's browser; nothing is uploaded.

import QRCode from 'qrcode';
import { cardContacts, emblemLetters, pageColors, shade, type CardState } from './card';

export type DrawFonts = { head: string; body: string };
export type CardWords = { scan: string; noName: string };
export type PassWords = { kicker: string; phone: string; email: string; scan: string; foot: string; noName: string };

type Ctx = CanvasRenderingContext2D;
type Colors = ReturnType<typeof pageColors>;

const FACE_W = 1004;
const FACE_H = 650;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** Set the largest font (down to `min`) at which `text` fits `maxW`. */
function fit(ctx: Ctx, text: string, maxW: number, size: number, weight: number, family: string, min = 18): number {
  let s = size;
  for (; s > min; s -= 2) {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxW) return s;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return min;
}

/** Words into at most `max` lines of `maxW`; the last line gets an ellipsis if it had to be cut. */
function wrap(ctx: Ctx, text: string, maxW: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= max) return lines;
  const out = lines.slice(0, max);
  let last = out[max - 1];
  while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
  out[max - 1] = `${last}…`;
  return out;
}

function drawQr(ctx: Ctx, text: string, x: number, y: number, size: number, dark = '#111827') {
  const qr = QRCode.create(text, { errorCorrectionLevel: text.length > 400 ? 'L' : 'M' });
  const n = qr.modules.size;
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  ctx.fillStyle = '#ffffff';
  rr(ctx, x, y, size, size, size * 0.06);
  ctx.fill();
  ctx.fillStyle = dark;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.modules.get(r, c)) ctx.fillRect(Math.floor(x + (c + quiet) * cell), Math.floor(y + (r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
}

/** The theme's decoration, painted under everything else. */
function themeArt(ctx: Ctx, s: CardState, c: Colors, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c.bg);
  g.addColorStop(1, c.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  switch (s.theme) {
    case 'himalaya': {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(0, h);
      const peaks = [0, 0.72, 0.12, 0.5, 0.26, 0.64, 0.4, 0.42, 0.55, 0.6, 0.7, 0.38, 0.85, 0.58, 1, 0.5];
      for (let i = 0; i < peaks.length; i += 2) ctx.lineTo(peaks[i] * w, h * (0.55 + peaks[i + 1] * 0.45));
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'dhaka': {
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = Math.max(2, w / 300);
      const step = w / 12;
      for (let x = -step; x < w + step; x += step)
        for (let y = -step; y < h + step; y += step) {
          ctx.beginPath();
          ctx.moveTo(x, y - step / 2.6);
          ctx.lineTo(x + step / 2.6, y);
          ctx.lineTo(x, y + step / 2.6);
          ctx.lineTo(x - step / 2.6, y);
          ctx.closePath();
          ctx.stroke();
        }
      break;
    }
    case 'flags': {
      const cols = ['#2563eb', '#f8fafc', '#dc2626', '#16a34a', '#facc15'];
      const n = 11;
      const fw = w / n;
      ctx.strokeStyle = '#7c5c3b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.04);
      ctx.quadraticCurveTo(w / 2, h * 0.12, w, h * 0.04);
      ctx.stroke();
      for (let i = 0; i < n; i++) {
        const x = i * fw + fw * 0.12;
        const t = (i + 0.5) / n;
        const y = h * 0.04 + Math.sin(Math.PI * t) * h * 0.04;
        ctx.fillStyle = cols[i % 5];
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x, y, fw * 0.76, fw * 0.62);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.strokeRect(x, y, fw * 0.76, fw * 0.62);
      }
      break;
    }
    case 'night': {
      const warm = ['#fb923c', '#facc15', '#f472b6', '#fde68a'];
      for (let i = 0; i < 18; i++) {
        const x = ((i * 137) % 100) / 100;
        const y = ((i * 61) % 100) / 100;
        const r = (0.02 + ((i * 29) % 7) / 100) * w;
        const rg = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r);
        rg.addColorStop(0, warm[i % 4]);
        rg.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = rg;
        ctx.fillRect(x * w - r, y * h - r, r * 2, r * 2);
      }
      break;
    }
    case 'minimal': {
      ctx.fillStyle = c.accent;
      ctx.fillRect(0, 0, w, Math.max(6, h * 0.012));
      break;
    }
    case 'neon': {
      ctx.strokeStyle = c.accent;
      ctx.shadowColor = c.accent;
      ctx.shadowBlur = w / 40;
      ctx.lineWidth = Math.max(2, w / 260);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(w * 0.92, h * 0.12, w * 0.16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#f472b6';
      ctx.shadowColor = '#f472b6';
      ctx.beginPath();
      ctx.arc(w * 0.06, h * 0.95, w * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawEmblem(ctx: Ctx, s: CardState, c: Colors, img: HTMLImageElement | null, cx: number, cy: number, r: number, font: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + r * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = c.surface;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = c.accent;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const letters = emblemLetters(s);
    const n = Array.from(letters).length;
    ctx.fillStyle = c.emblemText;
    ctx.font = `800 ${Math.round(r * (n > 2 ? 0.62 : n > 1 ? 0.78 : 0.95))}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letters, cx, cy + r * 0.04);
  }
  ctx.restore();
}

async function ready(fonts: DrawFonts) {
  try {
    await Promise.all([document.fonts.load(`800 40px ${fonts.head}`), document.fonts.load(`500 24px ${fonts.body}`)]);
    await document.fonts.ready;
  } catch {
    // Fonts are a nicety; the system font draws the same picture.
  }
}

function cardFront(ctx: Ctx, s: CardState, c: Colors, img: HTMLImageElement | null, fonts: DrawFonts, words: CardWords) {
  const W = FACE_W;
  const H = FACE_H;
  themeArt(ctx, s, c, W, H);
  drawEmblem(ctx, s, c, img, 150, 175, 92, fonts.head);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = c.text;
  const name = s.name || words.noName;
  const ns = fit(ctx, name, W - 300, 66, 800, fonts.head, 30);
  ctx.fillText(name, 272, 160 + ns * 0.12);
  if (s.role) {
    ctx.font = `500 30px ${fonts.body}`;
    ctx.fillStyle = c.dim;
    wrap(ctx, s.role, W - 310, 2).forEach((l, i) => ctx.fillText(l, 274, 214 + i * 38));
  }
  const contacts = cardContacts(s);
  let y = H - 70 - (contacts.length - 1) * 50;
  for (const k of contacts) {
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(80, y - 10, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.text;
    fit(ctx, k.text, W - 160, 32, 600, fonts.body, 20);
    ctx.fillText(k.text, 104, y);
    y += 50;
  }
  ctx.fillStyle = c.accent;
  ctx.fillRect(0, H - 16, W, 16);
}

function cardBack(ctx: Ctx, s: CardState, c: Colors, fonts: DrawFonts, words: CardWords, qrText: string) {
  const W = FACE_W;
  const H = FACE_H;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, c.accent);
  g.addColorStop(1, shade(c.accent, -0.38));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawQr(ctx, qrText, 84, 125, 400);
  ctx.fillStyle = c.emblemText;
  ctx.textAlign = 'left';
  const x = 540;
  ctx.font = `700 34px ${fonts.body}`;
  const scan = wrap(ctx, words.scan, W - x - 60, 3);
  // The words, the name and the site as one block, centred on the QR.
  const blockH = scan.length * 44 + 70 + 40;
  let y = 125 + 200 - blockH / 2 + 30;
  scan.forEach((l) => {
    ctx.fillText(l, x, y);
    y += 44;
  });
  const name = s.name || words.noName;
  fit(ctx, name, W - x - 60, 44, 800, fonts.head, 22);
  ctx.fillText(name, x, y + 30);
  ctx.globalAlpha = 0.75;
  ctx.font = `500 22px ${fonts.body}`;
  ctx.fillText('martnepali.com · demo', x, y + 72);
  ctx.globalAlpha = 1;
}

/** Front above back on one picture, with a little room around them. */
export async function drawCard(s: CardState, fonts: DrawFonts, words: CardWords, qrText: string): Promise<HTMLCanvasElement> {
  await ready(fonts);
  const c = pageColors(s);
  const img = await loadImage(s.avatar);
  const pad = 48;
  const canvas = document.createElement('canvas');
  canvas.width = FACE_W + pad * 2;
  canvas.height = FACE_H * 2 + pad * 3;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e7e5e4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const [i, face] of (['front', 'back'] as const).entries()) {
    const y = pad + i * (FACE_H + pad);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#fff';
    rr(ctx, pad, y, FACE_W, FACE_H, 28);
    ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, pad, y, FACE_W, FACE_H, 28);
    ctx.clip();
    ctx.translate(pad, y);
    if (face === 'front') cardFront(ctx, s, c, img, fonts, words);
    else cardBack(ctx, s, c, fonts, words, qrText);
    ctx.restore();
  }
  return canvas;
}

/** A picture that looks like a wallet pass. Says on its face that it is not one. */
export async function drawPass(s: CardState, fonts: DrawFonts, words: PassWords, qrText: string): Promise<HTMLCanvasElement> {
  await ready(fonts);
  const c = pageColors(s);
  const img = await loadImage(s.avatar);
  const W = 720;
  const H = 1140;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);
  rr(ctx, 0, 0, W, H, 40);
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, c.accent);
  g.addColorStop(1, shade(c.accent, -0.45));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const on = c.emblemText;
  // header: emblem + "demo, not a real pass"
  drawEmblem(ctx, s, { ...c, surface: on, accent: shade(c.accent, -0.25) }, img, 84, 84, 40, fonts.head);
  ctx.fillStyle = on;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  fit(ctx, words.kicker, W - 180, 22, 700, fonts.body, 14);
  ctx.fillText(words.kicker, 144, 92);
  ctx.globalAlpha = 0.35;
  ctx.fillRect(48, 150, W - 96, 2);
  ctx.globalAlpha = 1;
  // name and role
  const name = s.name || words.noName;
  fit(ctx, name, W - 96, 60, 800, fonts.head, 28);
  ctx.fillText(name, 48, 236);
  if (s.role) {
    ctx.font = `500 26px ${fonts.body}`;
    ctx.globalAlpha = 0.85;
    wrap(ctx, s.role, W - 96, 2).forEach((l, i) => ctx.fillText(l, 48, 284 + i * 34));
    ctx.globalAlpha = 1;
  }
  // fields
  const contacts = cardContacts({ ...s, front: { phone: true, email: true, web: false } });
  let fx = 48;
  for (const k of contacts) {
    ctx.globalAlpha = 0.7;
    ctx.font = `700 18px ${fonts.body}`;
    ctx.fillText((k.kind === 'phone' ? words.phone : words.email).toUpperCase(), fx, 400);
    ctx.globalAlpha = 1;
    fit(ctx, k.text, (W - 96) / 2 - 16, 26, 600, fonts.body, 15);
    ctx.fillText(k.text, fx, 436);
    fx += (W - 96) / 2;
  }
  // QR
  const qs = 400;
  drawQr(ctx, qrText, (W - qs) / 2, 520, qs);
  ctx.fillStyle = on;
  ctx.textAlign = 'center';
  ctx.font = `600 24px ${fonts.body}`;
  ctx.fillText(words.scan, W / 2, 970);
  ctx.globalAlpha = 0.7;
  ctx.font = `500 18px ${fonts.body}`;
  wrap(ctx, words.foot, W - 120, 2).forEach((l, i) => ctx.fillText(l, W / 2, 1040 + i * 26));
  ctx.globalAlpha = 1;
  ctx.restore();
  return canvas;
}

export function canvasBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
