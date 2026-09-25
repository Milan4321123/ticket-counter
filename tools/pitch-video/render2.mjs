import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const FPS = 30;
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const dir = new URL('./', import.meta.url).pathname;
const outDir = dir + (only ? 'sample/' : 'frames2/');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir);
const tl = JSON.parse(fs.readFileSync(dir + 'timeline.json', 'utf8'));
const frames = JSON.parse(fs.readFileSync(dir + 'rec/frames.json', 'utf8'));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: 'new',
  args: ['--hide-scrollbars', '--allow-file-access-from-files'],
});
const page = await browser.newPage();
await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
await page.goto('file://' + dir + 'stage2.html', { waitUntil: 'networkidle0' });
await page.evaluate((a, b) => window.setup(a, b), tl, frames);
await page.evaluate(() => document.fonts.ready);
const times = only ?? Array.from({ length: Math.ceil(tl.TOTAL * FPS) }, (_, i) => i / FPS);
let n = 0;
for (const t of times) {
  await page.evaluate((tt) => window.render(tt), t);
  await page.screenshot({ path: `${outDir}${String(n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  if (n % 300 === 0) console.log(n, '/', times.length);
}
await browser.close();
console.log('frames', n);
