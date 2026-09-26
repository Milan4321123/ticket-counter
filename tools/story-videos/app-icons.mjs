// The installed app's icons (public/icons/*-v2.png), drawn from the same 3D
// flag as the site's logo (src/components/Logo.tsx): lit crimson cloth with a
// bevelled blue border and thickness, on a metal pole with a gold finial, the
// flag's own crescent moon and rayed sun, over a dark neon backdrop.
//
// Rendered HERE, on a laptop, and committed as files — never on the server
// (image rendering on Render runs it out of memory).
//
//   node tools/story-videos/app-icons.mjs
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../../public/icons/', import.meta.url));

// The logo's waved pose (Logo.tsx POSES[1]) — an icon is a still of the flag in the wind.
const CLOTH = 'M4 1.5 Q13 5.3 24.3 14.1 Q17.6 12.2 11.5 13.5 Q19.6 19.6 26.2 29.9 Q15 30.7 4 29 Z';
const CRESCENT = 'M7.4 8.4 A2.6 2.6 0 0 0 12.6 8.4 A2.75 2.75 0 0 1 7.4 8.4 Z';

function rays(cx, cy, outer, inner, points) {
  const out = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    out.push(`${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`);
  }
  return out.join(' ');
}

/**
 * One icon, 512 units square. `scale` sizes the flag (the logo is drawn in a
 * 28x32 box): large for the plain icon, smaller for the maskable one, whose
 * picture must survive being cut to a circle 80% of the width.
 */
function iconSvg({ scale, grid = true }) {
  const w = 26.5 * scale;
  const h = 32 * scale;
  const tx = (512 - w) / 2 - 1.35 * scale;
  const ty = (512 - h) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="0.42" cy="0.34" r="0.8">
      <stop offset="0" stop-color="#4a0d24"/>
      <stop offset="0.45" stop-color="#170a22"/>
      <stop offset="1" stop-color="#06050b"/>
    </radialGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#dc143c" stop-opacity="0.45"/>
      <stop offset="0.6" stop-color="#7c3aed" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#7c3aed" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gridfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.55" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#fff" stop-opacity="1"/>
    </linearGradient>
    <mask id="gridmask"><rect width="512" height="512" fill="url(#gridfade)"/></mask>
    <linearGradient id="face" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff5c78"/>
      <stop offset="0.42" stop-color="#dc143c"/>
      <stop offset="1" stop-color="#860a26"/>
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4d7ff0"/>
      <stop offset="0.5" stop-color="#0a3a9e"/>
      <stop offset="1" stop-color="#001a52"/>
    </linearGradient>
    <linearGradient id="pole" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6b6b7c"/>
      <stop offset="0.35" stop-color="#f4f4fa"/>
      <stop offset="1" stop-color="#50505e"/>
    </linearGradient>
    <radialGradient id="gold" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#fff4c2"/>
      <stop offset="0.5" stop-color="#f5b700"/>
      <stop offset="1" stop-color="#8a5a00"/>
    </radialGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.34"/>
      <stop offset="0.45" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="cloth"><path d="${CLOTH}"/></clipPath>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="${(0.55).toFixed(2)}" stdDeviation="0.7" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  ${
    grid
      ? `<g mask="url(#gridmask)" stroke="#a78bfa" stroke-opacity="0.22" stroke-width="1.4" fill="none">
    ${Array.from({ length: 13 }, (_, i) => `<line x1="${256 + (i - 6) * 26}" y1="330" x2="${256 + (i - 6) * 110}" y2="512"/>`).join('')}
    ${[346, 368, 396, 432, 478].map((y) => `<line x1="0" y1="${y}" x2="512" y2="${y}"/>`).join('')}
  </g>`
      : ''
  }
  <circle cx="256" cy="250" r="${(h * 0.62).toFixed(1)}" fill="url(#halo)"/>
  <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale})" filter="url(#shadow)">
    <rect x="1.35" y="1.2" width="1.7" height="30.4" rx="0.85" fill="url(#pole)"/>
    <circle cx="2.2" cy="1.25" r="1.2" fill="url(#gold)"/>
    <path d="${CLOTH}" transform="translate(0.9 1.1)" fill="#3d0512"/>
    <path d="${CLOTH}" fill="url(#face)" stroke="url(#edge)" stroke-width="1.5" stroke-linejoin="round"/>
    <g clip-path="url(#cloth)">
      <rect width="28" height="32" fill="url(#gloss)"/>
      <rect x="9" y="-2" width="5" height="36" fill="url(#sheen)" transform="skewX(-18)"/>
    </g>
    <g transform="translate(0.25 0.45)">
      <g transform="translate(0.35 0.45)" fill="#5a0617" opacity="0.55">
        <path d="${CRESCENT}"/><polygon points="${rays(10, 8.6, 1.55, 0.8, 8)}"/><polygon points="${rays(10.5, 22.4, 3.2, 1.95, 12)}"/>
      </g>
      <g fill="#fff">
        <path d="${CRESCENT}"/><polygon points="${rays(10, 8.6, 1.55, 0.8, 8)}"/><polygon points="${rays(10.5, 22.4, 3.2, 1.95, 12)}"/>
        <circle cx="10.5" cy="22.4" r="1.45" fill="#fff6f7"/>
      </g>
    </g>
  </g>
</svg>`;
}

const ICONS = [
  { file: 'icon-512-v2.png', size: 512, scale: 11.2 },
  { file: 'icon-192-v2.png', size: 192, scale: 11.8, grid: false },
  { file: 'apple-touch-icon-v2.png', size: 180, scale: 11.8, grid: false },
  // Maskable: the launcher cuts it to its own shape, keeping only the middle
  // 80% circle for sure — so a smaller flag.
  { file: 'maskable-512-v2.png', size: 512, scale: 8.6 },
];

const browser = await puppeteer.launch({ executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', headless: 'new' });
const page = await browser.newPage();
for (const icon of ICONS) {
  await page.setViewport({ width: icon.size, height: icon.size, deviceScaleFactor: 1 });
  const svg = iconSvg(icon);
  await page.setContent(
    `<html><body style="margin:0;background:#06050b"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${icon.size}" height="${icon.size}" style="display:block"></body></html>`,
    { waitUntil: 'load' }
  );
  await page.screenshot({ path: OUT + icon.file, clip: { x: 0, y: 0, width: icon.size, height: icon.size } });
  console.log('wrote', icon.file);
}
await browser.close();
