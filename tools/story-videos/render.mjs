// node render.mjs restaurant  → out/restaurant/frames/NNNNN.jpg (1920×1080, 30 fps)
// ONLY=12.5,40 renders just those seconds into out/<id>/sample/ to check a look.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const FPS = 30;
const id = process.argv[2];
const DIR = new URL(`./out/${id}/`, import.meta.url).pathname.replace(/%20/g, ' ');
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const outDir = DIR + (only ? 'sample/' : 'frames/');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir);
const tl = JSON.parse(fs.readFileSync(DIR + 'timeline.json', 'utf8'));
const frames = JSON.parse(fs.readFileSync(DIR + 'rec/frames.json', 'utf8'));
// The stage page loads the recording's frames relative to itself.
fs.copyFileSync(new URL('./stage.html', import.meta.url), DIR + 'stage.html');
const browser = await puppeteer.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: 'new',
  args: ['--hide-scrollbars', '--allow-file-access-from-files'],
});
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });
await page.goto('file://' + DIR + 'stage.html', { waitUntil: 'networkidle0' });
await page.evaluate((a, b) => window.setup(a, b), tl, frames);
await page.evaluate(() => document.fonts.ready);
const times = only ?? Array.from({ length: Math.ceil(tl.TOTAL * FPS) }, (_, i) => i / FPS);
let n = 0;
for (const t of times) {
  await page.evaluate((tt) => window.render(tt), t);
  await page.screenshot({ path: `${outDir}${String(n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 });
  if (n % 300 === 0) console.log(n, '/', times.length);
}
await browser.close();
console.log('frames', n);
