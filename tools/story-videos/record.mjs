// node record.mjs restaurant   → out/restaurant/rec (frames) + events.json
// Needs the dev server on :3000. Starts a fresh demo account for the story.
import { openRecorder } from './lib.mjs';

const id = process.argv[2];
if (!id) throw new Error('usage: node record.mjs <story>');
const story = await import(`./stories/${id}.mjs`);
const OUT = new URL(`./out/${id}`, import.meta.url).pathname.replace(/%20/g, ' ');

const h = await openRecorder(OUT);
// Seller stories run in a fresh demo account; the customer's runs on the
// public site and warms its own pages.
const L = story.meta.demo === false ? {} : await h.enterDemo();
if (L.organizerId) console.log('demo', L.organizerId);
for (const p of story.meta.warm ?? []) await h.warm(p);

// Warm every page the story visits (dev compiles on the first visit).
for (const l of [L.restaurant, L.event, L.grocery].filter(Boolean)) {
  for (const p of ['', '/orders', '/kitchen', '/checkin', '/live', '/insights']) await h.warm(`/portal/events/${l.id}${p}`);
  await h.warm(`/e/${l.slug}`);
  await h.warm(`/e/${l.slug}/checkout`);
}
await h.page.evaluate(() => sessionStorage.removeItem('__fvis'));

await h.start();
await story.run(h, L);
await h.stop();
