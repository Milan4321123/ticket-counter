// Server-only: the generated pictures a demo account comes with.
//
// They used to be drawn with sharp (SVG → PNG) every time a visitor started a
// demo: about fifteen rasterisations per click, on the 512 MB Render instance,
// for pictures that never change. Now each one is drawn ONCE, on a developer
// machine, and shipped as a file in scripts/demo-art/ named after the hash of
// its SVG. Production only reads files — it never draws.
//
// Changed a title, a palette or the template? Start one demo locally
// (npm run dev, then the button on /demo): the missing files are drawn there
// and written to scripts/demo-art/. Commit them with the change.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface Palette {
  a: string;
  b: string;
  ink: string;
  accent: string;
}

const ART_DIR = path.join(process.cwd(), 'scripts', 'demo-art');

/** A simple generated picture: a gradient, a big word, a small line. No external files. */
function pictureSvg(title: string, sub: string, p: Palette, w: number, h: number): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const size = Math.max(48, Math.min(120, Math.floor((w * 1.4) / Math.max(title.length, 6))));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/>
    </linearGradient>
    <radialGradient id="r" cx="0.25" cy="0.2" r="0.8">
      <stop offset="0" stop-color="${p.accent}" stop-opacity="0.45"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#r)"/>
  <circle cx="${w * 0.82}" cy="${h * 0.25}" r="${h * 0.32}" fill="${p.accent}" opacity="0.12"/>
  <text x="50%" y="52%" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800"
        font-size="${size}" fill="${p.ink}">${esc(title)}</text>
  <text x="50%" y="${52 + 11}%" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="600"
        font-size="${Math.round(size * 0.32)}" fill="${p.ink}" opacity="0.8" letter-spacing="4">${esc(sub.toUpperCase())}</text>
  <text x="${w - 28}" y="${h - 26}" text-anchor="end" font-family="Helvetica Neue, Arial, sans-serif" font-weight="700"
        font-size="22" fill="${p.ink}" opacity="0.55" letter-spacing="3">DEMO</text>
</svg>`;
}

/**
 * The PNG for one demo picture, read from scripts/demo-art/. Outside
 * production a missing file is drawn and saved there; in production a missing
 * file is an error (the demo then fails to start) rather than a render.
 */
export async function picture(title: string, sub: string, p: Palette, w = 960, h = 720): Promise<Buffer> {
  const svg = pictureSvg(title, sub, p, w, h);
  const file = path.join(ART_DIR, `${crypto.createHash('sha256').update(svg).digest('hex').slice(0, 16)}.png`);
  try {
    return fs.readFileSync(file);
  } catch {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Demo picture "${title}" is missing from scripts/demo-art/ — start a demo locally and commit the file.`);
    }
  }
  const { default: sharp } = await import('sharp');
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  fs.mkdirSync(ART_DIR, { recursive: true });
  fs.writeFileSync(file, png);
  return png;
}
