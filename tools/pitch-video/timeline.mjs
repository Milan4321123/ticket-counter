// Turns the recording's event log into the edit: how recording time maps to
// video time (fast-forward the AI's thinking, a little quicker overall), where
// the camera zooms, the captions, and the moments that get a sound.
import fs from 'node:fs';

const DIR = new URL('./', import.meta.url).pathname;
const ev = JSON.parse(fs.readFileSync(DIR + 'events.json', 'utf8'));
const frames = JSON.parse(fs.readFileSync(DIR + 'rec/frames.json', 'utf8'));
const recEnd = Math.min(ev.find((e) => e.type === 'end')?.t ?? frames.at(-1).t, frames.at(-1).t);

const INTRO = 2.6;          // title card before the phone
const OUTRO = 7.0;          // closing card after it
const BASE_SPEED = 1.2;

// The buyer part starts with a scene change: the phone swings out and in.
const buyerCap = ev.find((e) => e.type === 'cap' && /order in seconds/i.test(e.title));
const SCENE_CUT = buyerCap ? buyerCap.t : null;

// Speed segments in recording time.
const segs = [];
const ffS = ev.find((e) => e.type === 'ff-start'), ffE = ev.find((e) => e.type === 'ff-end');
function speedAt(r) {
  if (ffS && ffE && r >= ffS.t && r < ffE.t) return (ffE.t - ffS.t) / 1.3; // whole wait → 1.3 s
  // Between the orders page and the buyer's page the recording reloads a
  // page: squeeze it, the swing transition covers it.
  if (SCENE_CUT && r >= SCENE_CUT && r < SCENE_CUT + 3.2) return 3.2 / 0.9;
  return BASE_SPEED;
}
// Integrate: output time for each recording time, sampled every 10 ms.
const map = [];
let out = INTRO;
for (let r = 0; r <= recEnd + 1e-9; r += 0.01) {
  map.push([r, out]);
  out += 0.01 / speedAt(r);
}
const recToOut = (r) => {
  const i = Math.max(0, Math.min(map.length - 1, Math.round(r / 0.01)));
  return map[i][1];
};
const recDurOut = out - INTRO;
const TOTAL = out + OUTRO;

// Captions (output time).
const caps = ev.filter((e) => e.type === 'cap').map((e) => ({ t: recToOut(e.t), k: kickerFor(e.title), title: e.title }));
if (ffS) caps.push({ t: recToOut(ffS.t) + 0.05, k: 'AI', title: 'Thinking…', until: recToOut(ffE.t) });
caps.sort((a, b) => a.t - b.t);
function kickerFor(title) {
  const k = { 'Start a new shop': 'Your seller hub', 'Let the AI help': 'Step 1', 'Just say what you sell': 'Step 1',
    'It fills in your page': 'Step 2', 'Preview your page': 'Step 3', 'Your restaurant, live': 'Run it',
    'Orders land in the kitchen': 'Restaurants', 'Money straight to you': 'Get paid',
    'They order in seconds': 'Meanwhile, your buyer…', 'Pay in a tap': 'Checkout', 'Their QR code, instantly': 'Done' };
  return k[title] || '';
}

// Camera moves (output time): typing → zoom on the field; a tap → push in a
// little just before; a tap that opens a page → zoom THROUGH it.
const cams = [];
for (let i = 0; i < ev.length; i++) {
  const e = ev[i];
  if (e.type === 'type-start') {
    const end = ev.slice(i).find((x) => x.type === 'type-end') ?? e;
    cams.push({ a: recToOut(e.t) - 0.35, b: recToOut(end.t) + 0.3, z: 1.42, x: e.x, y: e.y, kind: 'type' });
  }
  if (e.type === 'tap') {
    const t = recToOut(e.t);
    cams.push({ a: t - 0.75, b: t + (e.nav ? 0.25 : 0.35), z: e.nav ? 1.28 : 1.22, x: e.x, y: e.y, kind: 'tap' });
    if (e.nav) cams.push({ a: t + 0.05, b: t + 0.55, z: 2.4, x: e.x, y: e.y, kind: 'through' });
  }
}

const taps = ev.filter((e) => e.type === 'tap').map((e) => ({ t: recToOut(e.t), nav: Boolean(e.nav) }));
const navs = taps.filter((t) => t.nav).map((t) => t.t + 0.08);

const tl = {
  INTRO, OUTRO, TOTAL, recEnd, recDurOut,
  sceneCut: SCENE_CUT ? recToOut(SCENE_CUT) : null,
  map: map.filter((_, i) => i % 5 === 0).map(([r, o]) => [+r.toFixed(3), +o.toFixed(4)]),
  caps, cams, taps, navs,
};
fs.writeFileSync(DIR + 'timeline.json', JSON.stringify(tl));
console.log(`video ${TOTAL.toFixed(1)} s (recording ${recEnd.toFixed(1)} s → ${recDurOut.toFixed(1)} s), ${caps.length} captions, ${cams.length} camera moves, ${taps.length} taps`);
