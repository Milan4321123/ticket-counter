// The press kit, made in the visitor's browser: a one-sheet PNG drawn on a
// canvas, a plain-text bio and a .vcf booking card. Nothing goes to a server.

import { BOOKING_EMAIL, COPY, TOUR, fmtNum, showDate, type ArtistLang } from './content';

const PAGE_URL = 'https://www.martnepali.com/work/artist';

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------- text files ----------

export function bioText(lang: ArtistLang): string {
  const t = COPY[lang];
  const lines = [
    `${t.artist} — ${t.withBand}`,
    t.kicker,
    '',
    `[${t.sheetDemo}]`,
    '',
    t.oneLine,
    '',
    ...t.bio.flatMap((p) => [p, '']),
    t.stats.map((s) => `${fmtNum(s.value.toFixed(s.decimals), lang)}${s.suffix} ${s.label}`).join(' · '),
    `(${t.statsNote})`,
    '',
    t.sheetTour,
    ...TOUR.map((stop) => {
      const d = showDate(stop.date, lang);
      const p = t.stops[stop.id];
      return `  ${d.full} · ${p.city}, ${p.country} · ${p.venue} · ${t.status[stop.status]}`;
    }),
    `(${t.tourDemo})`,
    '',
    `${t.sheetBooking}: ${BOOKING_EMAIL}`,
    PAGE_URL,
  ];
  return lines.join('\r\n') + '\r\n';
}

function vcfText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

export function contactCard(lang: ArtistLang): string {
  const t = COPY[lang];
  return (
    [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${vcfText(`${t.artist} · ${t.sheetBooking} (${t.demo})`)}`,
      `N:${vcfText(t.sheetBooking)};${vcfText(t.artist)};;;`,
      `ORG:${vcfText(`${t.band} (${t.demo})`)}`,
      `EMAIL;TYPE=INTERNET,WORK:${BOOKING_EMAIL}`,
      `URL:${PAGE_URL}`,
      `NOTE:${vcfText(t.sheetDemo)}`,
      'END:VCARD',
    ].join('\r\n') + '\r\n'
  );
}

// ---------- the one-sheet ----------

function cssFont(root: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(root).getPropertyValue(name).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

function svgImage(svg: SVGSVGElement): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', '800');
      clone.setAttribute('height', '1000');
      const src = new XMLSerializer().serializeToString(clone);
      const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => {
        resolve(img);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      img.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw the one-sheet (1080 × 1350) and resolve with a PNG blob. */
export async function oneSheet(lang: ArtistLang, root: HTMLElement): Promise<Blob | null> {
  const t = COPY[lang];
  const ne = lang === 'ne';
  const display = ne ? cssFont(root, '--ar-deva', 'serif') : cssFont(root, '--ar-display', 'sans-serif');
  const body = ne ? cssFont(root, '--ar-deva-body', 'sans-serif') : 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  try {
    await Promise.all([document.fonts.load(`700 80px ${display}`), document.fonts.load(`400 28px ${body}`)]);
    await document.fonts.ready;
  } catch {
    /* draw with whatever fonts are there */
  }

  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, '#1b1150');
  bg.addColorStop(0.5, '#0d0a22');
  bg.addColorStop(1, '#22092e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.75, 280, 10, W * 0.75, 280, 620);
  glow.addColorStop(0, 'rgba(255,179,71,0.28)');
  glow.addColorStop(1, 'rgba(255,179,71,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Portrait, right, in a rounded frame.
  const svg = document.getElementById('ar-portrait') as SVGSVGElement | null;
  const img = svg ? await svgImage(svg) : null;
  const px = 580;
  const py = 70;
  const pw = 440;
  const ph = 550;
  if (img) {
    ctx.save();
    roundRect(ctx, px, py, pw, ph, 28);
    ctx.clip();
    ctx.drawImage(img, px, py, pw, ph);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,227,166,0.35)';
    ctx.lineWidth = 2;
    roundRect(ctx, px, py, pw, ph, 28);
    ctx.stroke();
  }

  // Name and lines, left.
  const L = 64;
  const colW = px - L - 36;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffb347';
  ctx.font = `600 24px ${body}`;
  ctx.fillText(t.kicker.toUpperCase(), L, 118);

  // The name, one word per line, as big as fits next to the portrait.
  ctx.fillStyle = '#fff7ea';
  const nameParts = t.artist.split(' ');
  let size = ne ? 86 : 92;
  ctx.font = `800 ${size}px ${display}`;
  const widest = Math.max(...nameParts.map((p) => ctx.measureText(p).width));
  if (widest > colW) {
    size = Math.floor((size * colW) / widest);
    ctx.font = `800 ${size}px ${display}`;
  }
  const lineH = Math.round(size * (ne ? 1.2 : 1.05));
  nameParts.forEach((p, i) => ctx.fillText(p, L, 220 + i * lineH));
  let y = 220 + (nameParts.length - 1) * lineH + 58;

  ctx.fillStyle = '#c9b8ff';
  ctx.font = `600 28px ${body}`;
  ctx.fillText(t.withBand, L, y);
  y += 56;

  ctx.fillStyle = '#e9e4ff';
  ctx.font = `400 27px ${body}`;
  for (const line of wrap(ctx, t.oneLine, colW)) {
    ctx.fillText(line, L, y);
    y += 40;
  }
  y += 14;
  ctx.fillStyle = 'rgba(233,228,255,0.78)';
  ctx.font = `400 22px ${body}`;
  // As much of the bio as fits above the numbers, cut at a word with "…".
  const bioLines = wrap(ctx, t.bio[1], colW);
  const room = Math.max(0, Math.floor((650 - y) / 33) + 1);
  bioLines.slice(0, room).forEach((line, i) => {
    const cut = i === room - 1 && bioLines.length > room;
    ctx.fillText(cut ? `${line.replace(/[\s,.;:—-]+\S*$/, '')}…` : line, L, y);
    y += 33;
  });

  // Numbers.
  let sy = 690;
  const cellW = (W - 2 * L) / 4;
  t.stats.forEach((s, i) => {
    const x = L + i * cellW;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, x, sy, cellW - 16, 118, 18);
    ctx.fill();
    ctx.fillStyle = '#ffd27a';
    // Rozha One draws Devanagari digits like Latin ones, so नेपाली numbers use Mukta.
    const statFont = (px: number) => (ne ? `600 ${px}px ${body}` : `800 ${px}px ${cssFont(root, '--ar-display', 'sans-serif')}`);
    const v = fmtNum(s.value.toFixed(s.decimals), lang) + s.suffix;
    // "4,2 Mio." runs wider than "4.2M": shrink to the cell rather than spill into the next one.
    let px = ne ? 50 : 48;
    ctx.font = statFont(px);
    const room = cellW - 16 - 44;
    if (ctx.measureText(v).width > room) {
      px = Math.floor((px * room) / ctx.measureText(v).width);
      ctx.font = statFont(px);
    }
    ctx.fillText(v, x + 22, sy + 62);
    ctx.fillStyle = '#d6d0f5';
    ctx.font = `500 21px ${body}`;
    ctx.fillText(s.label, x + 22, sy + 96);
  });
  sy += 170;

  // Tour, two columns.
  ctx.fillStyle = '#ff8fb1';
  ctx.font = `700 26px ${body}`;
  ctx.fillText(t.sheetTour, L, sy);
  sy += 22;
  const colX = [L, L + (W - 2 * L) / 2 + 10];
  TOUR.forEach((stop, i) => {
    const d = showDate(stop.date, lang);
    const p = t.stops[stop.id];
    const x = colX[i < 4 ? 0 : 1];
    const ry = sy + 46 + (i % 4) * 48;
    ctx.fillStyle = '#fff7ea';
    ctx.font = `700 24px ${body}`;
    ctx.fillText(d.short, x, ry);
    const dw = ne ? 150 : lang === 'de' ? 132 : 110;
    ctx.fillStyle = '#d6d0f5';
    ctx.font = `400 23px ${body}`;
    ctx.fillText(`${p.city} · ${p.venue}`, x + dw, ry);
  });
  sy += 46 + 4 * 48 + 20;

  // One press line.
  ctx.fillStyle = '#ffe3a6';
  ctx.font = `italic 400 26px ${body}`;
  const q = t.press[0];
  for (const line of wrap(ctx, `“${q.line}” — ${q.outlet}`, W - 2 * L)) {
    ctx.fillText(line, L, sy);
    sy += 36;
  }

  // Footer: booking + demo band.
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, H - 150, W, 150);
  ctx.fillStyle = '#fff7ea';
  ctx.font = `700 26px ${body}`;
  ctx.fillText(`${t.sheetBooking}: ${BOOKING_EMAIL}`, L, H - 96);
  ctx.fillStyle = '#c9b8ff';
  ctx.font = `400 22px ${body}`;
  ctx.fillText('martnepali.com/work/artist', L, H - 60);
  ctx.fillStyle = '#ffb347';
  ctx.font = `700 20px ${body}`;
  const demo = t.sheetDemo;
  ctx.fillText(demo, W - L - ctx.measureText(demo).width, H - 60);

  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}
