// node render.mjs → out/dashain/frames/NNNNN.jpg (1080×1920, 30 fps)
// ONLY=1.5,14,40 renders just those seconds into out/dashain/sample/ to check a look.
// RANGE=516,636 re-renders only those frame numbers into frames/ (after a fix).
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../story-videos/package.json', import.meta.url));
const rootRequire = createRequire(new URL('../../package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const QRCode = rootRequire('qrcode');
const TL = require('../ad-videos/timeline.js');

const HERE = new URL('./', import.meta.url).pathname.replace(/%20/g, ' ');
const OUT = HERE + 'out/dashain/';
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const range = process.env.RANGE ? process.env.RANGE.split(',').map(Number) : null;
const outDir = OUT + (only ? 'sample/' : 'frames/');
if (!range) fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// The QR on the ticket and in the finale opens the event's page.
const qr = await QRCode.toString('https://www.martnepali.com/e/dashainevent2026-with-sugam-pokhrel-bajagaja', {
  type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0b0b14', light: '#ffffff' },
});

const browser = await puppeteer.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: 'new',
  args: ['--hide-scrollbars', '--allow-file-access-from-files', '--font-render-hinting=none'],
});
const page = await browser.newPage();
page.on('console', (m) => m.type() === 'error' && console.log('page:', m.text()));
page.on('pageerror', (e) => console.log('page error:', e.message));
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto('file://' + HERE + 'stage.html?render', { waitUntil: 'networkidle0' });
await page.evaluate((q) => window.setup(q), qr);
const all = Array.from({ length: Math.round(TL.TOTAL * TL.FPS) }, (_, i) => i / TL.FPS);
const times = only ?? (range ? all.slice(range[0], range[1] + 1) : all);
let n = range ? range[0] : 0;
for (const t of times) {
  await page.evaluate((tt) => window.render(tt), t);
  const name = only ? `t${String(t).replace('.', '_')}` : String(n).padStart(5, '0');
  await page.screenshot({ path: `${outDir}${name}.jpg`, type: 'jpeg', quality: 92 });
  if (++n % 150 === 0) console.log(n, '/', all.length);
}
await browser.close();
console.log('frames', n);
