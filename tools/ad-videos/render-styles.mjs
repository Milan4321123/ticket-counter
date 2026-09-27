// node render-styles.mjs hype warm pov reasons neon → out/dashain/styles/<id>/frames/NNNNN.jpg (1080×1920, 30 fps)
// ONLY=0.5,4 renders just those seconds into out/dashain/styles/<id>/sample/.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../story-videos/package.json', import.meta.url));
const rootRequire = createRequire(new URL('../../package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const QRCode = rootRequire('qrcode');
const { S } = require('../ad-videos/styles/specs.js');

const HERE = new URL('./', import.meta.url).pathname.replace(/%20/g, ' ');
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(S);
const qr = await QRCode.toString('https://www.martnepali.com/e/dashainevent2026-with-sugam-pokhrel-bajagaja', {
  type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0b0b14', light: '#ffffff' },
});
const browser = await puppeteer.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: 'new',
  timeout: 180000,
  protocolTimeout: 600000,
  args: ['--hide-scrollbars', '--allow-file-access-from-files', '--font-render-hinting=none'],
});
for (const id of ids) {
  const outDir = `${HERE}out/dashain/styles/${id}/${only ? 'sample' : 'frames'}/`;
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log(`${id} page error:`, e.message));
  page.on('console', (m) => m.type() === 'error' && console.log(`${id} console:`, m.text()));
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto(`file://${HERE}styles/${id}.html?render`, { waitUntil: 'networkidle0' });
  await page.evaluate((q) => window.setup(q), qr);
  const times = only ?? Array.from({ length: Math.round(S[id].TOTAL * 30) }, (_, i) => i / 30);
  let n = 0;
  for (const t of times) {
    await page.evaluate((tt) => window.render(tt), t);
    const name = only ? `t${String(t).replace('.', '_')}` : String(n).padStart(5, '0');
    await page.screenshot({ path: `${outDir}${name}.jpg`, type: 'jpeg', quality: 92 });
    n++;
  }
  await page.close();
  console.log(`${id}: ${n} frames`);
}
await browser.close();
