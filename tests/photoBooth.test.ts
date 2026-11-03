/**
 * THE PHOTO BOOTH'S MATHS HOLDS — AND IT NEVER TALKS MONEY.
 *
 * /work/booth draws a guest's photo into a festive frame on a canvas. These pin
 * the pure rules in booth.ts that the canvas trusts: where the photo window and
 * the text bands sit on each format and on a photo strip, "cover" cropping with
 * zoom and pan, sticker hit testing under rotation and scale, the drag / pinch
 * / corner-handle maths, keyboard nudges and layer order, fitting Latin and
 * Devanagari text into a width, the pixel filters, the saved state (one key,
 * capped thumbnails) and the organizer's #b= booth link — plus that every word
 * exists in all three languages and none of them is about money or hiring.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTER_IDS,
  FORMAT_IDS,
  FRAME_IDS,
  LIMITS,
  SIZES,
  STICKER_ASPECT,
  STICKER_KINDS,
  addSticker,
  applyFilter,
  boothUrl,
  cleanTag,
  cleanText,
  coverCrop,
  decodePreset,
  dragSticker,
  encodePreset,
  fileName,
  fitBox,
  fitText,
  fitTitle,
  graphemes,
  handlePoint,
  handleSticker,
  hitSticker,
  inBox,
  layoutFor,
  normalizeSaved,
  nudgeSticker,
  onHandle,
  panDelta,
  pinchSticker,
  pushWall,
  readPresetHash,
  shiftLayer,
  splitTwo,
  stackCells,
  stickerBox,
  toCanvas,
  trimToBudget,
  type Rect,
  type Saved,
  type Sticker,
} from '../src/app/work/booth/booth.ts';
import { COPY, DEFAULT_TEXT, FRAME, GREETING } from '../src/app/work/booth/content.ts';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const inside = (r: Rect, outer: { x: number; y: number; w: number; h: number }) =>
  r.x >= outer.x - 1e-9 && r.y >= outer.y - 1e-9 && r.x + r.w <= outer.x + outer.w + 1e-9 && r.y + r.h <= outer.y + outer.h + 1e-9;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// ---------------- layout ----------------

test('each format has its real pixel size, print is 4×6 at 300 dpi', () => {
  assert.deepEqual(SIZES.square, { w: 1080, h: 1080 });
  assert.deepEqual(SIZES.story, { w: 1080, h: 1920 });
  assert.deepEqual(SIZES.print, { w: 1200, h: 1800 });
  near(SIZES.print.w / SIZES.print.h, 4 / 6);
  near(SIZES.strip.w / SIZES.strip.h, 2 / 6);
});

test('photo window, title band and date band sit inside the picture and never overlap', () => {
  for (const id of [...FORMAT_IDS, 'strip' as const]) {
    const L = layoutFor(id);
    const page = { x: 0, y: 0, w: L.w, h: L.h };
    assert.equal(L.w, SIZES[id].w);
    assert.ok(inside(L.area, page), `${id} area`);
    assert.ok(inside(L.title, page), `${id} title`);
    assert.ok(inside(L.meta, page), `${id} meta`);
    assert.ok(!overlap(L.title, L.area), `${id} title/photo`);
    assert.ok(!overlap(L.meta, L.area), `${id} meta/photo`);
    assert.ok(L.title.h > 0 && L.meta.h > 0);
    // the photo is the main thing: at least half the picture
    assert.ok((L.area.w * L.area.h) / (L.w * L.h) > 0.5, `${id} photo share`);
    // centred left-right
    near(L.area.x, L.w - L.area.x - L.area.w);
    for (const c of L.cells) assert.ok(inside(c, L.area), `${id} cell`);
  }
});

test('a single photo has one cell, the strip three equal cells in order with gaps', () => {
  assert.equal(layoutFor('square').cells.length, 1);
  const S = layoutFor('strip');
  assert.equal(S.cells.length, 3);
  for (let i = 0; i < 3; i++) {
    near(S.cells[i].w, S.cells[0].w);
    near(S.cells[i].h, S.cells[0].h);
    near(S.cells[i].x, S.area.x);
    if (i) {
      assert.ok(S.cells[i].y > S.cells[i - 1].y + S.cells[i - 1].h, 'gap between shots');
      assert.ok(!overlap(S.cells[i], S.cells[i - 1]));
    }
  }
  near(S.cells[2].y + S.cells[2].h, S.area.y + S.area.h);
  // three landscape-ish shots, like a booth strip
  assert.ok(S.cells[0].w / S.cells[0].h > 1);
});

test('stackCells fills the area exactly', () => {
  const area = { x: 10, y: 20, w: 300, h: 1000 };
  for (const n of [1, 2, 3, 4]) {
    const cells = stackCells(area, n, 12);
    assert.equal(cells.length, n);
    const used = cells.reduce((s, c) => s + c.h, 0) + 12 * (n - 1);
    near(used, 1000);
  }
  assert.equal(stackCells(area, 0, 5).length, 1);
});

test('fitBox keeps the shape; toCanvas maps client px to picture px', () => {
  assert.deepEqual(fitBox(1080, 1920, 360, 2000), { w: 360, h: 640 });
  assert.deepEqual(fitBox(1080, 1920, 1000, 640), { w: 360, h: 640 });
  assert.deepEqual(fitBox(0, 10, 10, 10), { w: 0, h: 0 });
  const p = toCanvas({ left: 100, top: 50, width: 360, height: 640 }, 280, 370, 1080, 1920);
  near(p.x, 540);
  near(p.y, 960);
});

// ---------------- crop ----------------

test('cover crop keeps the window shape, stays inside the photo, zooms and pans', () => {
  const c = coverCrop(4000, 3000, 962, 1315);
  near(c.sw / c.sh, 962 / 1315, 1e-9);
  assert.ok(c.sx >= 0 && c.sy >= 0 && c.sx + c.sw <= 4000 + 1e-9 && c.sy + c.sh <= 3000 + 1e-9);
  near(c.sh, 3000); // portrait window on a landscape photo: full height, centred
  near(c.sx, (4000 - c.sw) / 2);
  const z = coverCrop(4000, 3000, 962, 1315, 2);
  near(z.sw, c.sw / 2);
  const left = coverCrop(4000, 3000, 962, 1315, 1, -1, 0);
  const right = coverCrop(4000, 3000, 962, 1315, 1, 1, 0);
  near(left.sx, 0);
  near(right.sx + right.sw, 4000);
  // pan beyond the edge is clamped, zoom beyond the limit too
  assert.deepEqual(coverCrop(4000, 3000, 962, 1315, 1, 5, 0), right);
  near(coverCrop(4000, 3000, 500, 500, 99).sw, coverCrop(4000, 3000, 500, 500, LIMITS.zoomMax).sw);
  // zero sizes do not divide by zero
  assert.ok(Number.isFinite(coverCrop(0, 0, 10, 10).sw));
});

test('dragging the photo right moves the crop left, and stops when there is no slack', () => {
  const d = panDelta(4000, 3000, 962, 1315, 1, 50, 0);
  assert.ok(d.x < 0, 'content follows the finger');
  assert.equal(d.y, 0, 'no vertical slack on a full-height crop');
  const sq = panDelta(1000, 1000, 500, 500, 1, 30, 30);
  assert.deepEqual(sq, { x: 0, y: 0 });
});

// ---------------- stickers ----------------

const area: Rect = { x: 100, y: 200, w: 800, h: 600 };
const st = (o: Partial<Sticker> = {}): Sticker => ({ id: 's1', kind: 'heart', u: 0.5, v: 0.5, s: 1, r: 0, ...o });

test('a sticker box is sized from the window and its own shape', () => {
  for (const kind of STICKER_KINDS) {
    const b = stickerBox(st({ kind, s: 2 }), area);
    near(b.h, 0.26 * 600 * 2);
    near(b.w / b.h, STICKER_ASPECT[kind]);
    near(b.cx, 500);
    near(b.cy, 500);
  }
});

test('hit testing follows rotation: a long sticker turned 90° is hit above, not beside', () => {
  const flat = st({ kind: 'shades' }); // 2.6 : 1
  const b = stickerBox(flat, area);
  assert.ok(inBox(b, b.cx + b.w * 0.45, b.cy));
  assert.ok(!inBox(b, b.cx, b.cy + b.w * 0.45));
  const turned = stickerBox({ ...flat, r: Math.PI / 2 }, area);
  assert.ok(!inBox(turned, turned.cx + b.w * 0.45, turned.cy));
  assert.ok(inBox(turned, turned.cx, turned.cy + b.w * 0.45));
  // 45°: the corner direction
  const diag = stickerBox(st({ r: Math.PI / 4 }), area);
  assert.ok(inBox(diag, diag.cx, diag.cy - diag.h * 0.6), 'a diamond reaches further up');
  assert.ok(!inBox(diag, diag.cx + diag.w * 0.5, diag.cy - diag.h * 0.5), 'but not into the old corner');
});

test('hit testing grows with scale and picks the top-most sticker', () => {
  const small = st({ id: 's1', s: 0.5 });
  const p = { x: 500 + stickerBox(st(), area).w * 0.4, y: 500 };
  assert.equal(hitSticker([small], area, p.x, p.y), -1);
  assert.equal(hitSticker([st({ id: 's1', s: 1 })], area, p.x, p.y), 0);
  const list = [st({ id: 's1' }), st({ id: 's2' }), st({ id: 's3', u: 0.1 })];
  assert.equal(hitSticker(list, area, 500, 500), 1, 'later in the list = on top');
  assert.equal(hitSticker(list, area, 5, 5), -1);
  assert.equal(hitSticker(list, area, 500, 500 + stickerBox(st(), area).h / 2 + 4, 6), 1, 'padding for fingers');
});

test('the corner handle turns with the sticker', () => {
  const b = stickerBox(st(), area);
  const h0 = handlePoint(b);
  near(h0.x, b.cx + b.w / 2);
  near(h0.y, b.cy + b.h / 2);
  const h90 = handlePoint({ ...b, r: Math.PI / 2 });
  near(h90.x, b.cx - b.h / 2);
  near(h90.y, b.cy + b.w / 2);
  assert.ok(onHandle(b, h0.x + 3, h0.y - 3, 10));
  assert.ok(!onHandle(b, b.cx, b.cy, 10));
});

test('drag moves in window fractions and stays inside the window', () => {
  const d = dragSticker(st(), 80, -60, area);
  near(d.u, 0.6);
  near(d.v, 0.4);
  const far = dragSticker(st(), 5000, 5000, area);
  assert.equal(far.u, 1);
  assert.equal(far.v, 1);
});

test('pinch: fingers apart = bigger, turning = rotation, moving = follows the midpoint', () => {
  const s0 = st();
  const a0 = { x: 400, y: 500 };
  const b0 = { x: 600, y: 500 };
  const bigger = pinchSticker(s0, a0, b0, { x: 300, y: 500 }, { x: 700, y: 500 }, area);
  near(bigger.s, 2);
  near(bigger.u, 0.5);
  const turned = pinchSticker(s0, a0, b0, { x: 500, y: 400 }, { x: 500, y: 600 }, area);
  near(turned.r, Math.PI / 2);
  near(turned.s, 1);
  const moved = pinchSticker(s0, a0, b0, { x: 480, y: 560 }, { x: 680, y: 560 }, area);
  near(moved.u, 0.6);
  near(moved.v, 0.6);
  // the size stays within limits
  const huge = pinchSticker(s0, a0, b0, { x: -5000, y: 500 }, { x: 5000, y: 500 }, area);
  assert.equal(huge.s, LIMITS.maxScale);
});

test('the corner handle resizes and turns about the centre', () => {
  const s0 = st();
  const c = { x: 500, y: 500 };
  const r = handleSticker(s0, c, { x: 600, y: 500 }, { x: 500, y: 650 });
  near(r.s, 1.5);
  near(r.r, Math.PI / 2);
  assert.equal(r.u, s0.u);
});

test('keyboard nudges move, resize and turn, within limits', () => {
  const s = st();
  near(nudgeSticker(s, 'ArrowRight').u, 0.51);
  near(nudgeSticker(s, 'ArrowUp', true).v, 0.45);
  near(nudgeSticker(s, '+').s, 1.1);
  near(nudgeSticker(s, '-').s, 1 / 1.1);
  near(nudgeSticker(s, ']').r, Math.PI / 12);
  near(nudgeSticker(s, '[').r, -Math.PI / 12);
  assert.equal(nudgeSticker(s, 'x'), s);
  let tiny = s;
  for (let i = 0; i < 60; i++) tiny = nudgeSticker(tiny, '-');
  assert.equal(tiny.s, LIMITS.minScale);
  let spun = s;
  for (let i = 0; i < 30; i++) spun = nudgeSticker(spun, ']');
  assert.ok(Math.abs(spun.r) <= Math.PI + 1e-9, 'angle stays folded');
});

test('layer order moves one step and stops at the ends; new stickers get fresh ids', () => {
  const list = [st({ id: 's1' }), st({ id: 's2' }), st({ id: 's3' })];
  assert.deepEqual(shiftLayer(list, 's1', 1).map((s) => s.id), ['s2', 's1', 's3']);
  assert.deepEqual(shiftLayer(list, 's3', -1).map((s) => s.id), ['s1', 's3', 's2']);
  assert.equal(shiftLayer(list, 's3', 1), list);
  assert.equal(shiftLayer(list, 's1', -1), list);
  assert.equal(shiftLayer(list, 'nope', 1), list);
  const added = addSticker(list, 'momo');
  assert.equal(added.length, 4);
  assert.equal(added[3].id, 's4');
  assert.equal(added[3].kind, 'momo');
  let full: Sticker[] = [];
  for (let i = 0; i < LIMITS.stickers + 5; i++) full = addSticker(full, 'heart');
  assert.equal(full.length, LIMITS.stickers);
  assert.equal(new Set(full.map((s) => s.id)).size, full.length);
});

// ---------------- text ----------------

// a fake font: every letter is 0.55 em wide
const measure = (t: string, size: number) => graphemes(t).length * size * 0.55;

test('fitText keeps the size when it fits and shrinks when it does not', () => {
  assert.deepEqual(fitText(measure, 'Tihar', 1000, 100, 20), { size: 100, text: 'Tihar' });
  const r = fitText(measure, 'Dashain Milan Frankfurt', 600, 100, 20);
  assert.ok(r.size < 100 && r.size >= 20);
  assert.ok(measure(r.text, r.size) <= 600);
  assert.equal(r.text, 'Dashain Milan Frankfurt');
  assert.deepEqual(fitText(measure, '', 100, 50, 10), { size: 50, text: '' });
});

test('fitText shortens with … below the minimum, never splitting a Devanagari letter', () => {
  const long = 'नयाँ वर्षको शुभकामना सबैलाई धेरै धेरै'; // many conjuncts and vowel signs
  const r = fitText(measure, long, 200, 60, 30);
  assert.equal(r.size, 30);
  assert.ok(r.text.endsWith('…'));
  assert.ok(measure(r.text, 30) <= 200);
  const body = r.text.slice(0, -1).trimEnd();
  assert.ok(long.startsWith(body));
  // the cut lands on a grapheme boundary
  const g = graphemes(long);
  let acc = '';
  const bounds = new Set<string>(['']);
  for (const x of g) bounds.add((acc += x));
  assert.ok(bounds.has(body) || bounds.has(body + ' '), `cut inside a letter: ${body}`);
  // vowel signs and the virama stay attached
  assert.deepEqual(graphemes('कि'), ['कि']);
  assert.equal(graphemes('शुभ').length, 2);
});

test('a long title goes onto two lines at " · " when that is bigger', () => {
  assert.deepEqual(splitTwo('Dashain Milan · Frankfurt'), ['Dashain Milan', 'Frankfurt']);
  assert.deepEqual(splitTwo('Tihar Night Live'), ['Tihar', 'Night Live']);
  assert.equal(splitTwo('Wo-ho!'), null);
  const two = fitTitle(measure, 'Dashain Milan · Frankfurt', 400, 120, 80, 20);
  assert.equal(two.lines.length, 2);
  for (const l of two.lines) assert.ok(measure(l, two.size) <= 400);
  const one = fitTitle(measure, 'Teej', 400, 120, 80, 20);
  assert.deepEqual(one, { size: 120, lines: ['Teej'] });
  assert.deepEqual(fitTitle(measure, '', 400, 120, 80, 20).lines, []);
});

test('visitor text is cleaned: no control or bidi characters, capped by letters; hashtags tidy', () => {
  assert.equal(cleanText('a\u0000b‮c\n d', 40), 'a b c d');
  assert.equal(graphemes(cleanText('क्षत्रिय'.repeat(20), 10)).length, 10);
  assert.equal(cleanText(42, 10), '');
  assert.equal(cleanTag('Dashain Milan 2026'), '#DashainMilan2026');
  assert.equal(cleanTag('##tihar'), '#tihar');
  assert.equal(cleanTag('#तिहार'), '#तिहार');
  assert.equal(cleanTag('<script>'), '#script');
  assert.equal(cleanTag('  '), '');
  assert.ok(graphemes(cleanTag('x'.repeat(100))).length <= LIMITS.tag);
});

// ---------------- filters ----------------

const px = () => new Uint8ClampedArray([200, 120, 60, 255, 10, 20, 30, 255, 255, 255, 255, 128]);

test('natural at brightness 0 changes nothing', () => {
  const a = px();
  applyFilter(a, 'none', 0);
  assert.deepEqual(a, px());
});

test('mono is grey, warm is warmer, brightness brightens, alpha untouched, values clamp', () => {
  const m = px();
  applyFilter(m, 'mono');
  for (let i = 0; i < m.length; i += 4) assert.ok(m[i] === m[i + 1] && m[i + 1] === m[i + 2]);
  const w = px();
  applyFilter(w, 'warm');
  assert.ok(w[0] - w[2] > 200 - 60, 'more red than blue than before');
  const b = px();
  applyFilter(b, 'none', 0.3);
  assert.ok(b[4] > 10 && b[0] > 200);
  assert.equal(b[8], 255, 'clamped');
  for (const f of FILTER_IDS) {
    const a = px();
    applyFilter(a, f, 0.4);
    assert.equal(a[3], 255);
    assert.equal(a[11], 128);
  }
  const g = px();
  applyFilter(g, 'glow');
  assert.ok(g[4] > 10, 'glow lifts shadows');
});

// ---------------- saved state ----------------

const base: Saved = {
  lang: null,
  frame: 'dashain',
  format: 'square',
  mode: 'single',
  filter: 'none',
  brightness: 0,
  text: { title: 'A', date: 'B', tag: '#C' },
  edited: false,
  stickers: [],
  sound: true,
  logo: '',
  wall: [],
};
const thumb = 'data:image/jpeg;base64,' + 'A'.repeat(4000);

test('a saved state from storage is cleaned and anything odd falls back', () => {
  assert.equal(normalizeSaved(null, base), base);
  const s = normalizeSaved(
    {
      lang: 'xx',
      frame: 'nope',
      format: 'story',
      mode: 'strip',
      filter: 'glow',
      brightness: 9,
      edited: true,
      text: { title: 'x'.repeat(200), date: 'd', tag: 'big night' },
      stickers: [{ id: 's9', kind: 'momo', u: 7, v: -2, s: 99, r: 1 }, { kind: 'bomb' }, { id: 's9', kind: 'heart' }],
      sound: false,
      logo: 'javascript:alert(1)',
      wall: [{ id: 'w1', src: thumb, at: 1 }, { id: 'w2', src: 'https://evil.example/x.png' }],
    },
    base
  );
  assert.equal(s.lang, null);
  assert.equal(s.frame, 'dashain');
  assert.equal(s.format, 'story');
  assert.equal(s.mode, 'strip');
  assert.equal(s.brightness, LIMITS.brightness);
  assert.equal(graphemes(s.text.title).length, LIMITS.title);
  assert.equal(s.text.tag, '#bignight');
  assert.equal(s.stickers.length, 1, 'bad kinds and duplicate ids dropped');
  assert.deepEqual([s.stickers[0].u, s.stickers[0].v, s.stickers[0].s], [1, 0, LIMITS.maxScale]);
  assert.equal(s.sound, false);
  assert.equal(s.logo, '');
  assert.deepEqual(s.wall.map((w) => w.id), ['w1'], 'only small data: images');
  // unedited words are not taken from storage
  assert.equal(normalizeSaved({ text: { title: 'Z' } }, base).text, base.text);
});

test('the wall keeps the newest few, and the whole state fits its byte budget', () => {
  let wall = base.wall;
  for (let i = 0; i < 30; i++) wall = pushWall(wall, { id: `w${i}`, src: thumb, at: i });
  assert.equal(wall.length, LIMITS.wall);
  assert.equal(wall[0].id, 'w29');
  assert.equal(pushWall(wall, { id: 'w29', src: thumb, at: 99 }).length, LIMITS.wall, 'no duplicates');
  const big = trimToBudget({ ...base, wall }, 20_000);
  assert.ok(JSON.stringify(big).length <= 20_000);
  assert.ok(big.wall.length < wall.length && big.wall.length > 0);
  assert.equal(big.wall[0].id, 'w29', 'the oldest go first');
  const noLogo = trimToBudget({ ...base, logo: 'data:image/png;base64,' + 'A'.repeat(50_000) }, 10_000);
  assert.equal(noLogo.logo, '');
});

// ---------------- the organizer's link ----------------

test('the booth link round-trips frame and words, Devanagari included, and rejects junk', () => {
  const p = { frame: 'tihar' as const, text: { title: 'देउसी भैलो साँझ · कोलोन', date: 'कात्तिक २२', tag: '#TiharTogether' } };
  const code = encodePreset(p);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodePreset(code), p);
  const url = boothUrl('https://www.martnepali.com/', p);
  assert.ok(url.startsWith('https://www.martnepali.com/work/booth#b='));
  assert.deepEqual(readPresetHash(new URL(url).hash), p);
  assert.equal(decodePreset('!!!'), null);
  assert.equal(decodePreset(Buffer.from('{"f":"rave"}').toString('base64url')), null);
  assert.equal(decodePreset(Buffer.from('not json').toString('base64url')), null);
  assert.equal(decodePreset('A'.repeat(LIMITS.hash + 1)), null);
  const evil = decodePreset(Buffer.from(JSON.stringify({ f: 'wedding', t: 'x‮y'.repeat(40), d: 5, h: 'a b#c' })).toString('base64url'));
  assert.ok(evil);
  assert.ok(!/‮/.test(evil!.text.title));
  assert.equal(evil!.text.date, '');
  assert.equal(evil!.text.tag, '#abc');
  // every frame's starting words fit in a QR-sized link
  for (const f of FRAME_IDS) for (const l of ['en', 'de', 'ne'] as const) assert.ok(boothUrl('https://www.martnepali.com', { frame: f, text: DEFAULT_TEXT[f][l] }).length < 400);
});

test('file names are tidy', () => {
  assert.equal(fileName('Dashain Milan · Frankfurt', 'story', 'png'), 'photo-booth-dashain-milan-frankfurt-story.png');
  assert.equal(fileName('दशैं मिलन', 'strip', 'jpg'), 'photo-booth-event-strip.jpg');
});

// ---------------- words ----------------

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') {
    const r = (v as (...a: string[]) => unknown)('1', '2');
    if (typeof r === 'string') out.push(r);
  } else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

test('every word is there in all three languages, and none is about money or hiring', () => {
  const money =
    /€|\$|\beur\b|euro|\bprices?\b|\bpricing|\bfees?\b|\bcosts?\b|\bcheap|\bbudgets?\b|\bestimat\w*|\bquotes?\b|\brates?\b|\bpackages?\b|\bhire|\bhiring|\bpay\b|\bpaid\b|\binvoice|preis|gebühr|\bkosten\b|budget|angebot|honorar|bezahl|rechnung|\bpaket|(?<!निः)शुल्क|मूल्य|भुक्तानी|पैसा|रुपैयाँ|(?<![ऀ-ॿ])दाम|बजेट|खर्च|भाडा/i;
  const keys = Object.keys(COPY.en).sort();
  for (const lang of ['de', 'ne'] as const) assert.deepEqual(Object.keys(COPY[lang]).sort(), keys, lang);
  for (const lang of ['en', 'de', 'ne'] as const) {
    for (const k of keys) {
      const v = (COPY[lang] as Record<string, unknown>)[k];
      assert.ok(strings(v).every((s) => s.trim().length > 0), `${lang}.${k} is empty`);
    }
    for (const s of strings(COPY[lang])) assert.doesNotMatch(s, money, `${lang}: ${s}`);
    for (const s of strings(FRAME[lang])) assert.doesNotMatch(s, money, `${lang}: ${s}`);
    for (const f of FRAME_IDS) assert.ok(COPY[lang].frames[f]);
    for (const k of STICKER_KINDS) assert.ok(COPY[lang].stickers[k]);
  }
  for (const s of strings(DEFAULT_TEXT)) assert.doesNotMatch(s, money, s);
  for (const f of FRAME_IDS) {
    assert.match(GREETING[f], /[ऀ-ॿ]/, 'greetings are in Nepali');
    for (const l of ['en', 'de', 'ne'] as const) {
      const d = DEFAULT_TEXT[f][l];
      assert.equal(cleanTag(d.tag), d.tag, `${f}.${l} tag is already tidy`);
      assert.ok(graphemes(d.title).length <= LIMITS.title && graphemes(d.date).length <= LIMITS.date);
    }
  }
  assert.equal(FRAME.en.talk, 'Kura garau');
  assert.match(FRAME.en.free, /free/i);
});
