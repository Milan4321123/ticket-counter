'use client';

// "I'm going" — a 9:16 story picture for Instagram and WhatsApp status, made
// in the buyer's browser from the event's own poster. The moment a buyer holds
// their tickets is the moment they most want to say so, and a story with the
// poster on it carries the event to everyone who follows them — with the
// buyer's referral link in the caption, so the organizer sees who they brought.
//
// Drawn on a canvas here, never on the server (the host has no memory to spare
// for image work); the poster comes from this site's own media route, so the
// canvas stays exportable.
import { useState } from 'react';

interface Props {
  title: string;
  when: string;
  where: string;
  /** Same-origin poster URL, or null for a drawn background. */
  image: string | null;
  /** The event link to share (with the buyer's ?ref=). */
  url: string;
  free: boolean;
  slug: string;
}

const W = 1080;
const H = 1920;
const FONT = `system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Devanagari', sans-serif`;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
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
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
    return kept;
  }
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

async function draw(p: Props): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = p.image ? await loadImage(p.image) : null;

  // Background: the poster, enlarged and blurred, darkened — or the brand sky.
  if (img) {
    const s = Math.max(W / img.width, H / img.height) * 1.15;
    ctx.filter = 'blur(38px) saturate(1.3)';
    ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    ctx.filter = 'none';
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#450a0a');
    g.addColorStop(0.55, '#dc143c');
    g.addColorStop(1, '#003893');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0.55)');
  shade.addColorStop(0.45, 'rgba(0,0,0,0.25)');
  shade.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 104px ${FONT}`;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 24;
  ctx.fillText(p.free ? "I'm going! 🙌" : "I'm going! 🎟", W / 2, 230);
  ctx.shadowBlur = 0;

  // The poster itself, as a card in the middle.
  const cardW = 860;
  let cardH = 860;
  if (img) cardH = Math.min(1000, Math.max(520, (img.height / img.width) * cardW));
  const cx = (W - cardW) / 2;
  const cy = 320;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 20;
  roundRect(ctx, cx, cy, cardW, cardH, 40);
  ctx.fillStyle = '#111';
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, cx, cy, cardW, cardH, 40);
  ctx.clip();
  if (img) {
    const s = Math.max(cardW / img.width, cardH / img.height);
    ctx.drawImage(img, cx + (cardW - img.width * s) / 2, cy + (cardH - img.height * s) / 2, img.width * s, img.height * s);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(cx, cy, cardW, cardH);
    ctx.font = `300px ${FONT}`;
    ctx.fillText('🎟', W / 2, cy + cardH / 2 + 100);
  }
  ctx.restore();

  // What, when, where.
  let y = cy + cardH + 120;
  ctx.font = `800 68px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  for (const line of wrap(ctx, p.title, 940, 2)) {
    ctx.fillText(line, W / 2, y);
    y += 82;
  }
  ctx.font = `700 46px ${FONT}`;
  ctx.fillStyle = '#ffd166';
  ctx.fillText(p.when, W / 2, y + 10);
  if (p.where) {
    ctx.font = `500 40px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const line of wrap(ctx, p.where, 940, 1)) ctx.fillText(line, W / 2, y + 72);
  }

  // The invitation and the address.
  ctx.font = `700 42px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(p.free ? 'Come with me — it’s free' : 'Come with me — get your ticket', W / 2, H - 190);
  ctx.font = `600 38px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`martnepali.com/e/${p.slug}`, W / 2, H - 120);
  return canvas;
}

export default function StoryCardButton(props: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function make() {
    setBusy(true);
    setNote('');
    try {
      const canvas = await draw(props);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw new Error('no picture');
      const file = new File([blob], `going-${props.slug}.jpg`, { type: 'image/jpeg' });
      const text = props.free ? `I'm going to ${props.title} — it's free! ${props.url}` : `I'm going to ${props.title}! Get your tickets: ${props.url}`;
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text });
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
      setNote('Saved — post it as your story and add the link.');
    } catch {
      setNote('The picture could not be made — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn" onClick={make} disabled={busy}>
        {busy ? 'Making…' : '📸 Post it as a story'}
      </button>
      {note && (
        <span className="muted small" role="status" style={{ marginLeft: 8 }}>
          {note}
        </span>
      )}
    </>
  );
}
