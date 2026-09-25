// A festive event poster for the page-creation story's photo upload — drawn
// here once, on the developer's machine (never on the server), and kept as a
// file: assets/dashain-poster.png.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const sharp = require('sharp');

const W = 1080, H = 1350;
const kite = (x, y, s, rot, c1, c2) => `
  <g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <path d="M0 -60 L44 0 L0 60 L-44 0 Z" fill="${c1}"/>
    <path d="M0 -60 L44 0 L0 0 Z" fill="${c2}" opacity=".85"/>
    <path d="M0 60 C 10 110, -20 140, 8 190" stroke="${c1}" stroke-width="3" fill="none" opacity=".7"/>
  </g>`;
const rings = Array.from({ length: 7 }, (_, i) => `<circle cx="540" cy="520" r="${150 + i * 46}" fill="none" stroke="#fbbf24" stroke-opacity="${0.22 - i * 0.025}" stroke-width="2" stroke-dasharray="${4 + i * 2} ${8 + i * 3}"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.35" r="0.85">
      <stop offset="0" stop-color="#7a1030"/><stop offset="0.55" stop-color="#3a0616"/><stop offset="1" stop-color="#12030a"/>
    </radialGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fde68a"/><stop offset="0.6" stop-color="#f59e0b"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" x2="1"><stop offset="0" stop-color="#fcd34d"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  ${rings}
  <circle cx="540" cy="520" r="150" fill="url(#sun)" opacity=".9"/>
  ${kite(170, 230, 1.3, -18, '#f43f5e', '#fb923c')}
  ${kite(900, 190, 1.0, 16, '#a855f7', '#f472b6')}
  ${kite(880, 700, 0.8, -10, '#22c55e', '#facc15')}
  ${kite(200, 760, 0.7, 12, '#38bdf8', '#a78bfa')}
  <text x="540" y="540" text-anchor="middle" font-family="Kohinoor Devanagari, Devanagari MT, sans-serif" font-weight="700" font-size="120" fill="#3a0616" opacity=".85">दशैं</text>
  <text x="540" y="930" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="118" fill="#fff" letter-spacing="2">DASHAIN</text>
  <text x="540" y="1040" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="118" fill="url(#gold)" letter-spacing="2">NIGHT 2026</text>
  <text x="540" y="1112" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="600" font-size="38" fill="#fde2e8" letter-spacing="6">LIVE MUSIC · DINNER · DANCE</text>
  <rect x="250" y="1150" width="580" height="2" fill="#fbbf24" opacity=".6"/>
  <text x="540" y="1215" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="700" font-size="40" fill="#fff">Saturday 17 October · Doors 18:00</text>
  <text x="540" y="1270" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="500" font-size="34" fill="#fde2e8" opacity=".85">Gemeinschaftssaal Kreuzberg · Berlin</text>
</svg>`;
await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(fileURLToPath(new URL('./dashain-poster.jpg', import.meta.url)));
console.log('poster written');
