// node timeline.mjs restaurant → out/restaurant/timeline.json
// Recording time → video time: a little quicker overall, waits on the AI and
// page loads squeezed out, the camera pushing in on every tap and field, and
// each chapter's place in the finished video (the site's "See how" buttons
// play one chapter: chapters.json).
import fs from 'node:fs';

const id = process.argv[2];
const story = await import(`./stories/${id}.mjs`);
const DIR = new URL(`./out/${id}/`, import.meta.url).pathname.replace(/%20/g, ' ');
const ev = JSON.parse(fs.readFileSync(DIR + 'events.json', 'utf8'));
const frames = JSON.parse(fs.readFileSync(DIR + 'rec/frames.json', 'utf8'));
const recEnd = Math.min(ev.find((e) => e.type === 'end')?.t ?? frames.at(-1).t, frames.at(-1).t);

const INTRO = 3.2;
const OUTRO = 7.5;
const BASE_SPEED = 1.15;

// Stretches to squeeze: [from, to, how long they may take in the video].
const squeeze = [];
for (let i = 0; i < ev.length; i++) {
  const e = ev[i];
  if (e.type === 'ff-start') {
    const end = ev.slice(i).find((x) => x.type === 'ff-end');
    if (end) squeeze.push([e.t, end.t, 1.2]);
  }
  if (e.type === 'cut') {
    const end = ev.slice(i).find((x) => x.type === 'cut-end');
    if (end) squeeze.push([e.t, end.t, 0.45]);
  }
}
function speedAt(r) {
  for (const [a, b, d] of squeeze) if (r >= a && r < b) return Math.max(BASE_SPEED, (b - a) / d);
  return BASE_SPEED;
}
const map = [];
let out = INTRO;
for (let r = 0; r <= recEnd + 1e-9; r += 0.01) {
  map.push([r, out]);
  out += 0.01 / speedAt(r);
}
const recToOut = (r) => map[Math.max(0, Math.min(map.length - 1, Math.round(r / 0.01)))][1];
const TOTAL = out + OUTRO;

// Chapters (output time).
const sceneEvents = ev.filter((e) => e.type === 'scene');
const chapters = sceneEvents.map((e, i) => {
  const def = story.scenes.find((s) => s.id === e.id) ?? { chapter: e.id, kicker: '', title: e.id, body: '' };
  const start = recToOut(e.t);
  const end = i + 1 < sceneEvents.length ? recToOut(sceneEvents[i + 1].t) : TOTAL - OUTRO;
  return { id: e.id, tool: def.tool ?? '', chapter: def.chapter, kicker: def.kicker, title: def.title, body: def.body, start, end };
});

// Camera: typing → zoom on the field; a tap → push in just before it; a tap
// that opens a page → zoom through it.
const cams = [];
for (let i = 0; i < ev.length; i++) {
  const e = ev[i];
  if (e.type === 'type-start') {
    const end = ev.slice(i).find((x) => x.type === 'type-end') ?? e;
    cams.push({ a: recToOut(e.t) - 0.35, b: recToOut(end.t) + 0.3, z: 1.5, x: e.x, y: e.y, kind: 'type' });
  }
  if (e.type === 'tap') {
    const t = recToOut(e.t);
    cams.push({ a: t - 0.75, b: t + (e.nav ? 0.25 : 0.4), z: e.nav ? 1.3 : 1.25, x: e.x, y: e.y, kind: 'tap' });
    if (e.nav) cams.push({ a: t + 0.05, b: t + 0.55, z: 2.4, x: e.x, y: e.y, kind: 'through' });
  }
}
const taps = ev.filter((e) => e.type === 'tap').map((e) => ({ t: recToOut(e.t), nav: Boolean(e.nav) }));
const cuts = ev.filter((e) => e.type === 'cut').map((e) => recToOut(e.t));
const navs = [...taps.filter((t) => t.nav).map((t) => t.t + 0.08), ...cuts];

// When the screen turns into the counter tablet and back (output time).
const devices = ev.filter((e) => e.type === 'device').map((e) => ({ t: recToOut(e.t), kind: e.kind, w: e.w, h: e.h }));

const tl = {
  id,
  devices,
  INTRO,
  OUTRO,
  TOTAL,
  meta: story.meta,
  map: map.filter((_, i) => i % 5 === 0).map(([r, o]) => [+r.toFixed(3), +o.toFixed(4)]),
  chapters,
  cams,
  taps,
  cuts,
  navs,
  // For synth.mjs (shared with the pitch video's soundtrack).
  caps: [],
  sceneCut: null,
};
fs.writeFileSync(DIR + 'timeline.json', JSON.stringify(tl));
fs.writeFileSync(
  DIR + 'chapters.json',
  JSON.stringify(chapters.map(({ id, tool, chapter, start, end }) => ({ id, tool, chapter, start: +start.toFixed(2), end: +end.toFixed(2) })), null, 1)
);
console.log(`video ${TOTAL.toFixed(1)} s, ${chapters.length} chapters, ${cams.length} camera moves, ${cuts.length} cuts`);
