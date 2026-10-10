// node render-studio.mjs [ids…] → out/studio/<id>/frames/NNNNN.jpg (1080×1920, 30 fps), several ads at once.
// ONLY=0.5,4 renders just those seconds into out/studio/<id>/sample/. JOBS=3 sets how many at once.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../story-videos/package.json', import.meta.url));
const rootRequire = createRequire(new URL('../../package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const QRCode = rootRequire('qrcode');
const STUDIO = require('../ad-videos/studio/scripts.js');
require('../ad-videos/studio/dashain-scripts.js');

const HERE = new URL('./', import.meta.url).pathname.replace(/%20/g, ' ');
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const jobs = +(process.env.JOBS || 3);
const set = process.env.SET; // e.g. SET=dashain renders just that set
const ids = process.argv.slice(2).length ? process.argv.slice(2) : STUDIO.ADS.filter((a) => (set ? a.set === set : !a.set)).map((a) => a.id);
const qrFor = (url) => QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0b0b14', light: '#ffffff' } });
// One browser per worker: headless tabs in the background don't paint, so
// several pages in one browser stall each other's screenshots.
const launch = () => puppeteer.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: 'new', timeout: 180000, protocolTimeout: 900000,
  args: ['--hide-scrollbars', '--allow-file-access-from-files', '--font-render-hinting=none', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const order = fs.existsSync(`${HERE}out/studio/order.json`) ? Object.fromEntries(JSON.parse(fs.readFileSync(`${HERE}out/studio/order.json`, 'utf8')).map((d) => [d.id, d.file])) : {};
const queue = [...ids];
async function worker() {
  const browser = await launch();
  while (queue.length) {
    const id = queue.shift();
    const ad = STUDIO.byId[id];
    if (!ad) { console.log('unknown', id); continue; }
    const outDir = `${HERE}out/studio/${id}/${only ? 'sample' : 'frames'}/`;
    const want = Math.round(ad.TOTAL * 30);
    const mp4 = ad.set ? `${HERE}out/${ad.set}20/mp4/${id}.mp4` : order[id] && `${HERE}out/studio/mp4/${order[id]}`;
    if (!only && !process.env.FORCE && ((fs.existsSync(outDir) && fs.readdirSync(outDir).length === want) || (mp4 && fs.existsSync(mp4)))) { console.log(`${id}: done already`); continue; }
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log(`${id} page error:`, e.message));
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await page.goto(`file://${HERE}studio/stage.html?render&id=${id}`, { waitUntil: 'networkidle0' });
    await page.evaluate((q) => window.setup(q), await qrFor(ad.qrUrl || 'https://www.martnepali.com'));
    const times = only ?? Array.from({ length: Math.round(ad.TOTAL * 30) }, (_, i) => i / 30);
    let n = 0;
    for (const t of times) {
      await page.evaluate((tt) => window.render(tt), t);
      const name = only ? `t${String(t).replace('.', '_')}` : String(n).padStart(5, '0');
      await page.screenshot({ path: `${outDir}${name}.jpg`, type: 'jpeg', quality: 92 });
      n++;
    }
    await page.close();
    console.log(`${id}: ${n} frames`);
    // Encode right away and drop the frames: they are big, the disk is not.
    if (!only && mp4 && fs.existsSync(`${HERE}out/studio/${id}/audio.wav`)) {
      fs.mkdirSync(mp4.replace(/[^/]+$/, ''), { recursive: true });
      try {
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', `${outDir}%05d.jpg`, '-i', `${HERE}out/studio/${id}/audio.wav`,
          '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '9M', '-bufsize', '18M',
          '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-shortest', mp4]);
        fs.rmSync(outDir, { recursive: true, force: true });
        console.log(`${id}: encoded`);
      } catch (e) { console.log(`${id}: encode error ${e.message}`); }
    }
  }
  await browser.close();
}
await Promise.all(Array.from({ length: jobs }, worker));
