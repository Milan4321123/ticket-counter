// node make-plan.mjs → out/studio/posting-plan.md + order.json
// Orders the 30 studio ads into a 30-day posting plan (no two days in a row
// share a module or a look), with each day's file, caption, hashtags and a
// good cover frame.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const STUDIO = require('./studio/scripts.js');
const TAGS = {
  buy: '#MartNepali #NepalisInGermany #NepaliBazaar #momo',
  sell: '#MartNepali #NepaliBusiness #SmallBusiness #NepalisInGermany',
  events: '#MartNepali #NepaliEvents #Dashain #NepalisInGermany',
  food: '#MartNepali #NepaliFood #momo #NepaliRestaurant',
  all: '#MartNepali #NepaliCommunity #NepalisInGermany #Nepal',
};
const MOD = { buy: 'Buying (customers)', sell: 'Selling (shops)', events: 'Events (organizers)', food: 'Restaurants', all: 'MartNepali (everyone)' };
const LOOK = { blob: 'Tech promo (blobs)', kinetic: 'Hype (black & white)', paper: 'Warm paper (folk)', swiss: 'Infographic', neon: 'Neon night', pov: 'TikTok POV', cinema: 'Cinematic' };

// Greedy: each day a module and a look different from yesterday's, cycling modules.
const left = [...STUDIO.ADS];
const order = [];
const mods = ['buy', 'sell', 'events', 'food', 'all'];
let prev = null, mi = 0;
while (left.length) {
  let pick = null;
  for (let tries = 0; tries < 5 && !pick; tries++) {
    const m = mods[(mi + tries) % 5];
    pick = left.find((a) => a.module === m && (!prev || (a.skin !== prev.skin && a.module !== prev.module)));
  }
  pick = pick || left.find((a) => !prev || a.skin !== prev.skin) || left[0];
  left.splice(left.indexOf(pick), 1);
  order.push(pick);
  prev = pick; mi = (mods.indexOf(pick.module) + 1) % 5;
}
// A cover: the moment the first headline has fully landed (or the logo).
const cover = (a) => {
  const s = a.shots.find((x) => ['words', 'emoji', 'qa', 'burst', 'poster', 'chat'].includes(x.type)) || a.shots[0];
  return +(s.t + Math.min(s.d - 0.2, s.type === 'burst' ? s.d * 0.9 : 1.8)).toFixed(1);
};
const file = (a, i) => `day-${String(i + 1).padStart(2, '0')}-${a.id}.mp4`;
let md = `# MartNepali — 30 days of videos\n\nOne video a day. Vertical 1080×1920, 12–18 s, with sound. Post on TikTok, Instagram Reels, Facebook Reels and YouTube Shorts.\nPut **martnepali.com** in your bio / link sticker. Pick the "cover" second as the thumbnail.\n\n| Day | File | For | Look · tone | Cover |\n|---|---|---|---|---|\n`;
order.forEach((a, i) => { md += `| ${i + 1} | ${file(a, i)} | ${MOD[a.module]} | ${LOOK[a.skin]} · ${a.tone} | ${cover(a)} s |\n`; });
md += '\n## Captions (copy & paste)\n\n';
order.forEach((a, i) => { md += `**Day ${i + 1} — ${file(a, i)}**\n\n${a.caption}\n\n${TAGS[a.module]}\n\n`; });
md += `## Bonus videos (made earlier)

- **~/Desktop/martnepali-ads/** — 5 × 20 s brand ads (customer, seller, restaurant, organizer, general) in the "tech promo" style. Good for pinned posts / profile highlights.
- **~/Desktop/dashain-styles/** — 5 × 15 s ads for the **Dashain Heidelberg show (Sat 10 Oct)** — hype, warm family, POV, 3 reasons, neon. **Post these before 10 October**, alongside the daily video (e.g. one every other day until the show).
- **~/Desktop/dashain-heidelberg-ad.mp4** — the 59 s Dashain ad (NPJOE's programmes + how to buy). Good for Facebook and YouTube.
`;
fs.mkdirSync('out/studio', { recursive: true });
fs.writeFileSync('out/studio/posting-plan.md', md);
fs.writeFileSync('out/studio/order.json', JSON.stringify(order.map((a, i) => ({ day: i + 1, id: a.id, file: file(a, i), cover: cover(a) })), null, 1));
console.log(order.map((a, i) => `${i + 1}. ${a.id} (${a.skin})`).join('\n'));
