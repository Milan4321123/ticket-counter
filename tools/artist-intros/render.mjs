// node render.mjs sugam → out/sugam/frames/NNNNN.jpg (1920×1080, 30 fps)
// ONLY=1,4.5,12.6 renders just those seconds into out/sugam/sample/ to look at.
// FRAMES=318-340 re-renders just those frames in place (the rest are kept).
// JOBS=2 splits the frames over that many browsers (one tab each — background
// tabs in one browser stall because they don't paint).
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../story-videos/package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const HERE = new URL('./', import.meta.url).pathname.replace(/%20/g, ' ');
const id = process.argv[2] || 'sugam';
const A = require(`${HERE}${id}.js`);
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const JOBS = Number(process.env.JOBS || 2);
const range = process.env.FRAMES ? process.env.FRAMES.split('-').map(Number) : null;
const outDir = `${HERE}out/${id}/${only ? 'sample' : 'frames'}/`;
if (!range) fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const all = only ?? Array.from({ length: Math.round(A.TOTAL * 30) }, (_, i) => i / 30);
const pick = range ? all.map((_, i) => i).filter((i) => i >= range[0] && i <= range[1]) : all.map((_, i) => i);
const name = (t, i) => (only ? `t${String(t).replace('.', '_')}` : String(i).padStart(5, '0'));
async function worker(w) {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    headless: 'new', timeout: 180000, protocolTimeout: 600000,
    args: ['--hide-scrollbars', '--allow-file-access-from-files', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log(`page error:`, e.message));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`file://${HERE}${id}.html?render`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => window.setup());
  let n = 0;
  for (let j = w; j < pick.length; j += JOBS) {
    const i = pick[j];
    await page.evaluate((tt) => window.render(tt), all[i]);
    await page.screenshot({ path: `${outDir}${name(all[i], i)}.jpg`, type: 'jpeg', quality: 93 });
    if (++n % 60 === 0) console.log(`worker ${w}: ${n} frames`);
  }
  await browser.close();
}
const t0 = Date.now();
await Promise.all(Array.from({ length: Math.min(JOBS, pick.length) }, (_, w) => worker(w)));
console.log(`${id}: ${pick.length} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${outDir}`);
