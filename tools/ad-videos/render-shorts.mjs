// node render-shorts.mjs 1 2 3 4 5 → out/dashain/shorts/v<n>/frames/NNNNN.jpg (1080×1920, 30 fps)
// ONLY=0.4,3.5 renders just those seconds into out/dashain/shorts/v<n>/sample/.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../story-videos/package.json', import.meta.url));
const rootRequire = createRequire(new URL('../../package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const QRCode = rootRequire('qrcode');
const X = require('../ad-videos/shorts.js');

const HERE = new URL('./', import.meta.url).pathname.replace(/%20/g, ' ');
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const which = process.argv.slice(2).map(Number);
const qr = await QRCode.toString('https://www.martnepali.com/e/dashainevent2026-with-sugam-pokhrel-bajagaja', {
  type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0b0b14', light: '#ffffff' },
});
const browser = await puppeteer.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: 'new',
  args: ['--hide-scrollbars', '--allow-file-access-from-files', '--font-render-hinting=none'],
});
for (const v of which.length ? which : [1, 2, 3, 4, 5]) {
  const outDir = `${HERE}out/dashain/shorts/v${v}/${only ? 'sample' : 'frames'}/`;
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log(`v${v} page error:`, e.message));
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto(`file://${HERE}shorts.html?render&v=${v}`, { waitUntil: 'networkidle0' });
  await page.evaluate((q) => window.setup(q), qr);
  const times = only ?? Array.from({ length: Math.round(X.TOTAL * X.FPS) }, (_, i) => i / X.FPS);
  let n = 0;
  for (const t of times) {
    await page.evaluate((tt) => window.render(tt), t);
    const name = only ? `t${String(t).replace('.', '_')}` : String(n).padStart(5, '0');
    await page.screenshot({ path: `${outDir}${name}.jpg`, type: 'jpeg', quality: 92 });
    n++;
  }
  await page.close();
  console.log(`v${v}: ${n} frames`);
}
await browser.close();
