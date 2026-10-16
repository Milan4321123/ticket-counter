'use client';

// The weekly digest as a picture — "यो हप्ता के छ?" with this week's events —
// for the groups and statuses where a picture travels further than a message.
// Drawn in the browser, like every other card on the site.
import { useState } from 'react';

export interface DigestCardItem {
  when: string;
  title: string;
  city: string;
}

const W = 1080;
const H = 1350;
const FONT = `system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Devanagari', sans-serif`;

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function draw(items: DigestCardItem[], festival: string | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#12051f');
  g.addColorStop(0.5, '#4a0d2c');
  g.addColorStop(1, '#0b1f4d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // A few soft lights, so it reads as a poster, not a spreadsheet.
  for (const [x, y, r, c] of [
    [180, 160, 380, 'rgba(220,20,60,0.35)'],
    [940, 420, 420, 'rgba(0,56,147,0.35)'],
    [520, 1300, 460, 'rgba(255,209,102,0.18)'],
  ] as [number, number, number, string][]) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd166';
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText('THIS WEEK · NEPALI EVENTS', 80, 130);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 96px ${FONT}`;
  ctx.fillText('यो हप्ता के छ?', 80, 245);

  let y = 340;
  const shown = items.slice(0, 6);
  for (const it of shown) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect?.(80, y, W - 160, 128, 26);
    if (!ctx.roundRect) ctx.rect(80, y, W - 160, 128);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(fit(ctx, it.when, 230), 112, y + 74);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(fit(ctx, it.title, W - 160 - 300), 360, y + 60);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `500 32px ${FONT}`;
    ctx.fillText(fit(ctx, it.city || ' ', W - 160 - 300), 360, y + 102);
    y += 150;
  }
  if (items.length > shown.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(`+ ${items.length - shown.length} more on martnepali.com`, 80, y + 20);
    y += 60;
  }
  if (festival) {
    ctx.fillStyle = '#ffd166';
    ctx.font = `700 36px ${FONT}`;
    ctx.fillText(fit(ctx, festival, W - 160), 80, Math.min(y + 40, H - 170));
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText('Tickets & everything on martnepali.com', W / 2, H - 80);
  return canvas;
}

export default function DigestCardButton({ items, festival }: { items: DigestCardItem[]; festival: string | null }) {
  const [busy, setBusy] = useState(false);
  if (items.length === 0) return null;

  async function make() {
    setBusy(true);
    try {
      const canvas = draw(items, festival);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) return;
      const file = new File([blob], 'yo-hapta-ke-cha.jpg', { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: 'यो हप्ता के छ? — martnepali.com' });
          return;
        } catch (e) {
          if ((e as Error)?.name === 'AbortError') return;
        }
      }
      const href = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = href;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 5000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn" onClick={make} disabled={busy}>
      {busy ? 'Making…' : '🖼 As a picture'}
    </button>
  );
}
