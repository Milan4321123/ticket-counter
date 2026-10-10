// node render.mjs → out/frames/NNNNN.jpg (1920×1080, 30 fps)
// ONLY=4.5,10.2 renders just those seconds into out/sample/.
// The stage is served from the repo root, so three.js loads from node_modules.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../story-videos/package.json', import.meta.url));
const rootRequire = createRequire(new URL('../../package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const QRCode = rootRequire('qrcode');
const FILM = require('../event-film/film.js');

const HERE = new URL('./', import.meta.url).pathname.replace(/%20/g, ' ');
const ROOT = path.resolve(HERE, '../..');
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const outDir = `${HERE}out/${only ? 'sample' : 'frames'}/`;
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;

// The end card's QR: martnepali.com/contact ("Tell us what you want to build").
const qr = await QRCode.toString('https://www.martnepali.com/contact', { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0b0b14', light: '#ffffff' } });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: 'new', timeout: 180000, protocolTimeout: 600000,
  args: ['--hide-scrollbars', '--font-render-hinting=none', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('page error:', e.message));
page.on('response', (r) => { if (r.status() >= 400) console.log('http', r.status(), r.url()); });
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
await page.setViewport({ width: FILM.W, height: FILM.H, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/tools/event-film/stage.html?render`, { waitUntil: 'networkidle0' });
await page.waitForFunction('window.stageReady === true');
await page.evaluate((q) => window.setup(q), qr);
const times = only ?? Array.from({ length: Math.round(FILM.TOTAL * FILM.FPS) }, (_, i) => i / FILM.FPS);
let n = 0;
const t0 = Date.now();
for (const t of times) {
  await page.evaluate((tt) => window.render(tt), t);
  const name = only ? `t${String(t).replace('.', '_')}` : String(n).padStart(5, '0');
  await page.screenshot({ path: `${outDir}${name}.jpg`, type: 'jpeg', quality: 93 });
  if (++n % 150 === 0) console.log(`${n}/${times.length} frames · ${((Date.now() - t0) / n).toFixed(0)} ms/frame`);
}
console.log(`${n} frames → ${outDir}`);
await browser.close();
server.close();
