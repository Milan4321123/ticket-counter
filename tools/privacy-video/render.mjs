// node render.mjs → out/frames/NNNNN.jpg (1080×1920, 30 fps)
// ONLY=0.5,9,20 renders just those seconds into out/sample/ to look at first.
// FROM=41 re-renders only the frames from second 41 on, keeping the rest.
//
// Same machinery as tools/ad-videos/render-brand.mjs: puppeteer-core from
// tools/story-videos, the system's Edge, one page, render(t) then screenshot.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../story-videos/package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const SPEC = require('../privacy-video/spec.js');

const HERE = new URL('./', import.meta.url).pathname.replace(/%20/g, ' ');
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const FPS = 30;
const from = Number(process.env.FROM || 0);
const outDir = `${HERE}out/${only ? 'sample' : 'frames'}/`;
if (!from) fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: 'new', timeout: 180000, protocolTimeout: 600000,
  args: ['--hide-scrollbars', '--allow-file-access-from-files', '--font-render-hinting=none'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('page error:', e.message));
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto(`file://${HERE}stage.html?render`, { waitUntil: 'networkidle0' });
await page.evaluate(() => window.setup());
const first = Math.round(from * FPS);
const times = only ?? Array.from({ length: Math.round(SPEC.TOTAL * FPS) - first }, (_, i) => (first + i) / FPS);
let n = only ? 0 : first;
for (const t of times) {
  await page.evaluate((tt) => window.render(tt), t);
  const name = only ? `t${String(t).replace('.', '_')}` : String(n).padStart(5, '0');
  await page.screenshot({ path: `${outDir}${name}.jpg`, type: 'jpeg', quality: 92 });
  n++;
  if (!only && n % 150 === 0) console.log(`${n}/${Math.round(SPEC.TOTAL * FPS)}`);
}
await browser.close();
console.log(`${n} frames → ${outDir}`);
