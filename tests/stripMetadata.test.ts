/**
 * THE CAMERA'S METADATA NEVER REACHES THE PUBLIC.
 *
 * A seller's phone photo of a jar on their kitchen table carries the GPS
 * position of that kitchen, and /api/media serves originals to anybody. These
 * tests pin down that the metadata goes — and, just as hard, that the picture
 * does NOT change: same pixels, same colour profile, same way up. A strip that
 * lost the orientation would put every portrait on its side; one that
 * corrupted a file would break a listing its organizer cannot fix.
 *
 * Pixel identity is checked by decoding with sharp and comparing the raw
 * buffers — the strongest statement available that nothing but metadata moved.
 */
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';

import { db, makeEvent } from './helpers.ts';
import {
  stripMetadata,
  stripMetadataFile,
  sniffFormat,
} from '../src/lib/stripMetadata.ts';
import {
  mediaFilePath,
  runMediaMetadataBackfillStep,
  saveEventPhoto,
  saveEventVideo,
} from '../src/lib/media.ts';
import { getVariant } from '../src/lib/imageVariants.ts';
import { getMediaById } from '../src/lib/events.ts';

// ---------------- fixtures ----------------

const GPS = {
  GPSLatitudeRef: 'N',
  GPSLatitude: '49/1 24/1 3348/100',
  GPSLongitudeRef: 'E',
  GPSLongitude: '8/1 41/1 1524/100',
};
const IDENTITY = { Make: 'PhoneCo', Model: 'X1 Pro', Artist: 'Milan Home' };

function base(width = 48, height = 32) {
  // A gradient-ish picture rather than a flat fill, so a pixel comparison
  // would notice a real change.
  return sharp({ create: { width, height, channels: 3, background: '#c0392b' } }).composite([
    {
      input: Buffer.from(
        `<svg width="${width}" height="${height}"><rect x="4" y="4" width="${width / 2}" height="${height / 2}" fill="#2ecc71"/></svg>`
      ),
      top: 0,
      left: 0,
    },
  ]);
}

async function dirtyJpeg(orientation = 6): Promise<Buffer> {
  return base()
    .jpeg({ quality: 90 })
    .withExif({ IFD0: IDENTITY, IFD3: GPS })
    .withMetadata({ orientation })
    .toBuffer();
}

async function rawPixels(buf: Buffer): Promise<Buffer> {
  return sharp(buf).raw().toBuffer();
}

/** JPEG segments before the first scan: [marker, payload]. */
function jpegSegments(buf: Buffer): { marker: number; payload: Buffer }[] {
  const out: { marker: number; payload: Buffer }[] = [];
  let p = 2;
  while (p + 4 <= buf.length) {
    const marker = buf[p + 1];
    const len = buf.readUInt16BE(p + 2);
    out.push({ marker, payload: buf.subarray(p + 4, p + 2 + len) });
    if (marker === 0xda) break;
    p += 2 + len;
  }
  return out;
}

function segment(marker: number, payload: Buffer | string): Buffer {
  const body = typeof payload === 'string' ? Buffer.from(payload, 'latin1') : payload;
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
}

/** Insert segments right after SOI. */
function withSegments(jpeg: Buffer, ...segs: Buffer[]): Buffer {
  return Buffer.concat([jpeg.subarray(0, 2), ...segs, jpeg.subarray(2)]);
}

/** Tags in IFD0 of a TIFF block (either byte order) — the test's own reader. */
function ifd0Tags(tiff: Buffer): number[] {
  const le = tiff.toString('latin1', 0, 2) === 'II';
  const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o: number) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const ifd = u32(4);
  const n = u16(ifd);
  return Array.from({ length: n }, (_, i) => u16(ifd + 2 + i * 12));
}

function exifTiff(payload: Buffer): Buffer {
  return payload.toString('latin1', 0, 5) === 'Exif\0' ? payload.subarray(6) : payload;
}

/** A little-endian TIFF with Orientation, a GPS IFD pointer and a GPS IFD. */
function leExifWithGps(orientation: number): Buffer {
  const t = Buffer.alloc(8 + 2 + 2 * 12 + 4 + 2 + 12 + 4);
  t.write('II', 0, 'latin1');
  t.writeUInt16LE(42, 2);
  t.writeUInt32LE(8, 4);
  t.writeUInt16LE(2, 8);
  // Orientation SHORT
  t.writeUInt16LE(0x0112, 10);
  t.writeUInt16LE(3, 12);
  t.writeUInt32LE(1, 14);
  t.writeUInt16LE(orientation, 18);
  // GPSInfo LONG -> offset of the GPS IFD
  const gpsIfd = 8 + 2 + 24 + 4;
  t.writeUInt16LE(0x8825, 22);
  t.writeUInt16LE(4, 24);
  t.writeUInt32LE(1, 26);
  t.writeUInt32LE(gpsIfd, 30);
  t.writeUInt32LE(0, 34); // no IFD1
  // GPS IFD: GPSLatitudeRef = "N"
  t.writeUInt16LE(1, gpsIfd);
  t.writeUInt16LE(0x0001, gpsIfd + 2);
  t.writeUInt16LE(2, gpsIfd + 4);
  t.writeUInt32LE(2, gpsIfd + 6);
  t.write('N\0', gpsIfd + 10, 'latin1');
  t.writeUInt32LE(0, gpsIfd + 14);
  return Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), t]);
}

function pngChunks(buf: Buffer): { type: string; data: Buffer }[] {
  const out: { type: string; data: Buffer }[] = [];
  let p = 8;
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    out.push({ type, data: buf.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}

function pngChunk(type: string, data: Buffer | string): Buffer {
  const body = typeof data === 'string' ? Buffer.from(data, 'latin1') : data;
  const c = Buffer.alloc(12 + body.length);
  c.writeUInt32BE(body.length, 0);
  c.write(type, 4, 'latin1');
  body.copy(c, 8);
  c.writeUInt32BE(zlib.crc32(c.subarray(4, 8 + body.length)), 8 + body.length);
  return c;
}

/** Insert chunks right after IHDR. */
function withPngChunks(png: Buffer, ...chunks: Buffer[]): Buffer {
  const ihdrEnd = 8 + 12 + png.readUInt32BE(8);
  return Buffer.concat([png.subarray(0, ihdrEnd), ...chunks, png.subarray(ihdrEnd)]);
}

function webpChunks(buf: Buffer): { fourcc: string; data: Buffer }[] {
  const out: { fourcc: string; data: Buffer }[] = [];
  let p = 12;
  while (p + 8 <= buf.length) {
    const size = buf.readUInt32LE(p + 4);
    out.push({ fourcc: buf.toString('latin1', p, p + 4), data: buf.subarray(p + 8, p + 8 + size) });
    p += 8 + size + (size & 1);
  }
  return out;
}

// ---- ISO BMFF ----

function box(type: string, ...content: (Buffer | string)[]): Buffer {
  const body = Buffer.concat(content.map((c) => (typeof c === 'string' ? Buffer.from(c, 'latin1') : c)));
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + body.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, body]);
}

function largeBox(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(16);
  head.writeUInt32BE(1, 0);
  head.write(type, 4, 'latin1');
  head.writeBigUInt64BE(BigInt(16 + body.length), 8);
  return Buffer.concat([head, body]);
}

const XYZ = '©xyz';
const WHERE = '+49.4093+008.6937/';
const XMP_UUID = Buffer.from('be7acfcb97a942e89c71999491e3afac', 'hex');

/**
 * A minimal but structurally real MP4: the metadata sits where iPhones and
 * Android phones put it — moov/udta/©xyz, moov/meta (Apple's mdta keys), a
 * per-track udta — plus Google's banner in a top-level free box, an XMP uuid
 * box and a 64-bit mdat.
 */
function dirtyMp4(): Buffer {
  return Buffer.concat([
    box('ftyp', 'isom', Buffer.from([0, 0, 2, 0]), 'isommp41'),
    box('free', 'IsoMedia File Produced by Google'),
    largeBox('mdat', Buffer.from('MEDIA-SAMPLES-0123456789'.repeat(4), 'latin1')),
    box(
      'moov',
      box('mvhd', Buffer.alloc(100)),
      box('trak', box('tkhd', Buffer.alloc(84)), box('mdia', box('mdhd', Buffer.alloc(24))), box('udta', box(XYZ, WHERE))),
      box('udta', box(XYZ, WHERE), box('©mak', 'PhoneCo')),
      box(
        'meta',
        Buffer.alloc(4),
        box('hdlr', Buffer.alloc(8), 'mdta', Buffer.alloc(12)),
        box('keys', 'com.apple.quicktime.location.ISO6709'),
        box('ilst', WHERE)
      )
    ),
    box('uuid', XMP_UUID, '<x:xmpmeta>Milan Home</x:xmpmeta>'),
  ]);
}

/** Top-level boxes: [type, offset, size]. */
function topBoxes(buf: Buffer): [string, number, number][] {
  const out: [string, number, number][] = [];
  let p = 0;
  while (p + 8 <= buf.length) {
    let size = buf.readUInt32BE(p);
    if (size === 1) size = Number(buf.readBigUInt64BE(p + 8));
    if (size === 0) size = buf.length - p;
    out.push([buf.toString('latin1', p + 4, p + 8), p, size]);
    p += size;
  }
  return out;
}

function childBoxes(buf: Buffer, start: number, end: number): [string, number, number][] {
  const out: [string, number, number][] = [];
  let p = start;
  while (p + 8 <= end) {
    const size = buf.readUInt32BE(p);
    out.push([buf.toString('latin1', p + 4, p + 8), p, size]);
    p += size;
  }
  return out;
}

function silenceWarnings(t: TestContext) {
  return t.mock.method(console, 'warn', () => {});
}

async function webpFixture(): Promise<Buffer> {
  return base().webp().withExif({ IFD0: IDENTITY }).toBuffer();
}

// ---------------- JPEG ----------------

test('JPEG: GPS, device and owner go; the orientation stays, and so do the pixels and the colour profile', async () => {
  const dirty = await dirtyJpeg(6);
  const before = await sharp(dirty).metadata();
  // The fixture really is dirty — otherwise the rest proves nothing.
  assert.ok(dirty.includes('PhoneCo'));
  assert.ok(ifd0Tags(exifTiff(before.exif!)).includes(0x8825), 'fixture has a GPS IFD pointer');
  assert.equal(before.orientation, 6);

  const clean = stripMetadata(dirty);
  assert.notEqual(clean, dirty);
  assert.ok(!clean.includes('PhoneCo'));
  assert.ok(!clean.includes('Milan Home'));

  const app1 = jpegSegments(clean).filter((s) => s.marker === 0xe1);
  assert.equal(app1.length, 1, 'exactly one APP1 left: the orientation-only Exif');
  assert.deepEqual(ifd0Tags(exifTiff(app1[0].payload)), [0x0112], 'IFD0 holds Orientation and nothing else');

  const after = await sharp(clean).metadata();
  assert.equal(after.orientation, 6, 'a portrait phone photo must not end up on its side');
  assert.equal(after.width, before.width);
  assert.equal(after.height, before.height);
  assert.ok(after.icc && before.icc && after.icc.equals(before.icc), 'ICC profile kept byte-for-byte');
  assert.ok((await rawPixels(clean)).equals(await rawPixels(dirty)), 'pixels identical');
  // Rendered upright, it has the rotated shape — the browser's view.
  assert.equal(after.autoOrient.width, before.height);
});

test('JPEG: stripping is idempotent — a clean file comes back as the very same buffer', async () => {
  const once = stripMetadata(await dirtyJpeg(6));
  assert.equal(stripMetadata(once), once);
  const upright = stripMetadata(await dirtyJpeg(1));
  assert.equal(stripMetadata(upright), upright);
});

test('JPEG: an upright photo keeps no Exif at all', async () => {
  const clean = stripMetadata(await dirtyJpeg(1));
  assert.equal(jpegSegments(clean).filter((s) => s.marker === 0xe1).length, 0);
  assert.equal((await sharp(clean).metadata()).exif, undefined);
});

test('JPEG: XMP, IPTC, comments and trailing data after EOI all go; JFIF and Adobe stay', async () => {
  const plain = await base().jpeg().toBuffer();
  const dirty = Buffer.concat([
    withSegments(
      plain,
      segment(0xe0, Buffer.from([0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0])), // JFIF 1.01
      segment(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>Milan Home</x:xmpmeta>'),
      segment(0xed, 'Photoshop 3.0\x008BIM Milan Home'),
      segment(0xfe, 'shot at Milan Home'),
      segment(0xee, Buffer.from('Adobe\0\x64\0\0\0\0\x01', 'latin1'))
    ),
    Buffer.from('trailing Motion Photo MP4 at Milan Home', 'latin1'),
  ]);
  const clean = stripMetadata(dirty);
  assert.ok(!clean.includes('Milan Home'));
  const markers = jpegSegments(clean).map((s) => s.marker);
  assert.ok(!markers.includes(0xe1) && !markers.includes(0xed) && !markers.includes(0xfe));
  assert.ok(markers.includes(0xee), 'Adobe APP14 kept (it decides colour decoding)');
  assert.ok(markers.includes(0xe0), 'JFIF APP0 kept');
  assert.equal(clean[clean.length - 2], 0xff);
  assert.equal(clean[clean.length - 1], 0xd9, 'ends at EOI');
  assert.ok((await rawPixels(clean)).equals(await rawPixels(dirty)));
});

test('JPEG: a little-endian Exif (Intel byte order) keeps its orientation too', async () => {
  const plain = await base().jpeg().toBuffer();
  const dirty = withSegments(plain, segment(0xe1, leExifWithGps(8)));
  assert.equal((await sharp(dirty).metadata()).orientation, 8);
  const clean = stripMetadata(dirty);
  const app1 = jpegSegments(clean).filter((s) => s.marker === 0xe1);
  assert.equal(app1.length, 1);
  assert.deepEqual(ifd0Tags(exifTiff(app1[0].payload)), [0x0112]);
  assert.equal((await sharp(clean).metadata()).orientation, 8);
});

// ---------------- PNG ----------------

test('PNG: eXIf, tEXt, iTXt and tIME go; colour and orientation stay', async () => {
  const withExif = await base()
    .png()
    .withExif({ IFD0: IDENTITY, IFD3: GPS })
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const dirty = withPngChunks(
    withExif,
    pngChunk('tEXt', 'Author\0Milan Home'),
    pngChunk('iTXt', 'Location\0\0\0\0\0Milan Home'),
    pngChunk('tIME', Buffer.from([7, 234, 9, 29, 12, 0, 0]))
  );
  const before = await sharp(dirty).metadata();
  assert.equal(before.orientation, 6);
  assert.ok(dirty.includes('PhoneCo') && dirty.includes('Milan Home'));

  const clean = stripMetadata(dirty);
  assert.ok(!clean.includes('PhoneCo') && !clean.includes('Milan Home'));
  const types = pngChunks(clean).map((c) => c.type);
  for (const gone of ['tEXt', 'iTXt', 'tIME']) assert.ok(!types.includes(gone), `${gone} removed`);
  const exif = pngChunks(clean).filter((c) => c.type === 'eXIf');
  assert.equal(exif.length, 1);
  assert.deepEqual(ifd0Tags(exifTiff(exif[0].data)), [0x0112]);
  // Kept: everything that draws the picture.
  for (const kept of pngChunks(dirty).map((c) => c.type)) {
    if (!['eXIf', 'tEXt', 'iTXt', 'tIME'].includes(kept)) assert.ok(types.includes(kept), `${kept} kept`);
  }

  const after = await sharp(clean).metadata();
  assert.equal(after.orientation, 6);
  assert.ok((await rawPixels(clean)).equals(await rawPixels(dirty)));
  assert.equal(stripMetadata(clean), clean, 'idempotent');
});

// ---------------- WebP ----------------

test('WebP: EXIF and XMP chunks go, VP8X flags and RIFF size follow', async () => {
  const dirty = await base()
    .webp({ quality: 80 })
    .withExif({ IFD0: IDENTITY, IFD3: GPS })
    .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Milan Home</dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>')
    .withMetadata({ orientation: 6 })
    .toBuffer();
  assert.ok(webpChunks(dirty).some((c) => c.fourcc === 'XMP '));
  assert.equal((await sharp(dirty).metadata()).orientation, 6);

  const clean = stripMetadata(dirty);
  assert.ok(!clean.includes('PhoneCo') && !clean.includes('Milan Home'));
  assert.equal(clean.readUInt32LE(4), clean.length - 8, 'RIFF size matches');
  const chunks = webpChunks(clean);
  assert.ok(!chunks.some((c) => c.fourcc === 'XMP '));
  const exif = chunks.filter((c) => c.fourcc === 'EXIF');
  assert.equal(exif.length, 1);
  assert.deepEqual(ifd0Tags(exifTiff(exif[0].data)), [0x0112]);
  const flags = chunks.find((c) => c.fourcc === 'VP8X')!.data[0];
  assert.equal(flags & 0x04, 0, 'XMP flag cleared');
  assert.equal(flags & 0x08, 0x08, 'EXIF flag still true');

  assert.equal((await sharp(clean).metadata()).orientation, 6);
  assert.ok((await rawPixels(clean)).equals(await rawPixels(dirty)));
  assert.equal(stripMetadata(clean), clean, 'idempotent');
});

test('WebP: an upright photo loses its EXIF chunk and the flag with it', async () => {
  const dirty = await base().webp().withExif({ IFD0: IDENTITY, IFD3: GPS }).toBuffer();
  const clean = stripMetadata(dirty);
  const chunks = webpChunks(clean);
  assert.ok(!chunks.some((c) => c.fourcc === 'EXIF'));
  assert.equal(chunks.find((c) => c.fourcc === 'VP8X')!.data[0] & 0x08, 0);
  assert.ok((await rawPixels(clean)).equals(await rawPixels(dirty)));
});

// ---------------- MP4 ----------------

test('MP4: metadata boxes become zero-filled free boxes in place — no byte moves', () => {
  const dirty = dirtyMp4();
  assert.equal(sniffFormat(dirty), 'isobmff');
  const clean = stripMetadata(dirty);

  assert.equal(clean.length, dirty.length, 'length unchanged');
  assert.ok(!clean.includes(WHERE), 'coordinates gone from the bytes, not just renamed');
  assert.ok(!clean.includes('PhoneCo'));
  assert.ok(!clean.includes('Milan Home'));
  assert.ok(!clean.includes('com.apple.quicktime.location'));
  assert.ok(!clean.includes('Produced by Google'), 'text in padding scrubbed');

  const before = topBoxes(dirty);
  const after = topBoxes(clean);
  assert.deepEqual(
    after.map(([, o, s]) => [o, s]),
    before.map(([, o, s]) => [o, s]),
    'every top-level box keeps its offset and size'
  );
  assert.deepEqual(
    after.map(([t]) => t),
    ['ftyp', 'free', 'mdat', 'moov', 'free']
  );

  // mdat — what stco/co64 point into — is byte-identical at the same offset.
  const [, mdatAt, mdatSize] = before.find(([t]) => t === 'mdat')!;
  assert.ok(clean.subarray(mdatAt, mdatAt + mdatSize).equals(dirty.subarray(mdatAt, mdatAt + mdatSize)));

  const [, moovAt, moovSize] = after.find(([t]) => t === 'moov')!;
  const moovKids = childBoxes(clean, moovAt + 8, moovAt + moovSize);
  assert.deepEqual(moovKids.map(([t]) => t), ['mvhd', 'trak', 'free', 'free']);
  const [, trakAt, trakSize] = moovKids.find(([t]) => t === 'trak')!;
  assert.deepEqual(childBoxes(clean, trakAt + 8, trakAt + trakSize).map(([t]) => t), ['tkhd', 'mdia', 'free']);

  // Every byte that changed is inside a box that is now 'free' (and zero).
  for (let i = 0; i < dirty.length; i++) {
    if (dirty[i] === clean[i]) continue;
    const inFree = [...after, ...moovKids, ...childBoxes(clean, trakAt + 8, trakAt + trakSize)].some(
      ([t, o, s]) => t === 'free' && i >= o + 4 && i < o + s
    );
    assert.ok(inFree, `byte ${i} changed outside a neutralised box`);
  }

  assert.equal(stripMetadata(clean), clean, 'idempotent');
});

test('MP4: the on-disk path patches through a file descriptor and matches the buffer path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strip-mp4-'));
  const file = path.join(dir, 'v.mp4');
  const dirty = dirtyMp4();
  fs.writeFileSync(file, dirty);
  assert.equal(stripMetadataFile(file), 'stripped');
  assert.ok(fs.readFileSync(file).equals(stripMetadata(dirty)));
  assert.equal(stripMetadataFile(file), 'clean', 'second run writes nothing');
});

test('MP4: a size-0 (to end of file) mdat is walked correctly', () => {
  const tail = Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('mdat', 'latin1'), Buffer.alloc(64, 7)]);
  const dirty = Buffer.concat([box('ftyp', 'isom'), box('moov', box('mvhd', Buffer.alloc(100)), box('udta', box(XYZ, WHERE))), tail]);
  const clean = stripMetadata(dirty);
  assert.equal(clean.length, dirty.length);
  assert.ok(!clean.includes(WHERE));
  assert.ok(clean.subarray(clean.length - tail.length).equals(tail));
});

// ---------------- never corrupt ----------------

test('malformed or unknown input comes back untouched (the same buffer)', async (t) => {
  silenceWarnings(t);
  const jpeg = await dirtyJpeg(6);
  const cases: [string, Buffer][] = [
    ['empty', Buffer.alloc(0)],
    ['random bytes', Buffer.from('definitely not a picture, just some words', 'latin1')],
    ['JPEG with a segment longer than the file', Buffer.concat([jpeg.subarray(0, 4), Buffer.from([0xff, 0xff]), jpeg.subarray(6, 40)])],
    ['JPEG cut off before any image data', jpeg.subarray(0, 6 + jpegSegments(jpeg)[0].payload.length)],
    ['PNG without IEND', (await base().png().withExif({ IFD0: IDENTITY }).toBuffer()).subarray(0, 60)],
    ['WebP whose RIFF size overruns', await (async () => {
      const w = Buffer.from(await webpFixture());
      w.writeUInt32LE(w.length + 100, 4);
      return w;
    })()],
    ['MP4 with a child box overrunning moov', Buffer.concat([
      box('ftyp', 'isom'),
      (() => {
        const m = box('moov', box('udta', box(XYZ, WHERE)));
        m.writeUInt32BE(9999, 8); // udta claims more than moov holds
        return m;
      })(),
    ])],
    ['WebM (left alone on purpose)', Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01])],
  ];
  for (const [name, input] of cases) {
    assert.equal(stripMetadata(input), input, name);
  }
});

test('a doubt is logged once per reason, not once per file', async (t) => {
  const warn = silenceWarnings(t);
  const bad = Buffer.from(await webpFixture());
  bad.writeUInt32LE(3, 4); // RIFF size smaller than its own header
  stripMetadata(bad);
  stripMetadata(bad);
  assert.ok(warn.mock.callCount() <= 1);
});

// ---------------- the real upload path ----------------

test('saveEventPhoto stores the photo without its metadata, still upright', async () => {
  db();
  const event = makeEvent();
  const media = await saveEventPhoto(event.id, 'image/jpeg', await dirtyJpeg(6));
  const stored = fs.readFileSync(mediaFilePath(media));
  assert.ok(!stored.includes('PhoneCo'));
  const meta = await sharp(stored).metadata();
  assert.equal(meta.orientation, 6);
  assert.deepEqual(ifd0Tags(exifTiff(meta.exif!)), [0x0112]);
});

test('saveEventVideo stores the video without its location, same length', () => {
  const event = makeEvent();
  const dirty = dirtyMp4();
  const media = saveEventVideo(event.id, 'video/mp4', dirty);
  const stored = fs.readFileSync(mediaFilePath(media));
  assert.equal(stored.length, dirty.length);
  assert.ok(!stored.includes(WHERE));
});

// ---------------- the backfill ----------------

test('the backfill cleans stored originals, resumes from its cursor, and keeps rendered variants', async () => {
  const event = makeEvent();
  // Stored as they were before this fix: upload normally, then put the dirty
  // bytes back on disk underneath the rows.
  const dirtyPhoto = await dirtyJpeg(6);
  const photos = [
    await saveEventPhoto(event.id, 'image/jpeg', dirtyPhoto),
    await saveEventPhoto(event.id, 'image/jpeg', dirtyPhoto),
  ];
  const video = saveEventVideo(event.id, 'video/mp4', dirtyMp4());
  const all = (db().prepare(`SELECT id FROM event_media ORDER BY id`).all() as { id: string }[]).map(
    (r) => getMediaById(r.id)!
  );
  const makeDirty = (m: { mime: string }) => (m.mime.startsWith('video/') ? dirtyMp4() : dirtyPhoto);
  // Every row in this file's database, including earlier tests' uploads.
  for (const m of all) fs.writeFileSync(mediaFilePath(m), makeDirty(m));
  assert.ok(all.some((m) => m.id === video.id));

  // A variant already rendered from a dirty original — of a photo the sweep
  // will not see first (that one gets re-dirtied below).
  const target = photos.find((p) => p.id !== all[0].id)!;
  const variant = await getVariant(target, 'card');
  assert.ok(variant);
  const derivedDir = path.dirname(variant.filePath);
  const cardFiles = () => fs.readdirSync(derivedDir).filter((f) => f.startsWith(`${target.id}-card-`));
  assert.equal(cardFiles().length, 1);

  db().prepare(`DELETE FROM kv WHERE key = 'migration:media_metadata_strip_v1'`).run();

  // One file, then "a restart": that first file is made dirty again behind
  // the sweep's back. Resuming from the saved cursor must not revisit it.
  assert.deepEqual(runMediaMetadataBackfillStep(1), { done: false, processed: 1 });
  assert.ok(!fs.readFileSync(mediaFilePath(all[0])).includes('PhoneCo'));
  fs.writeFileSync(mediaFilePath(all[0]), makeDirty(all[0]));

  for (let i = 0; i < 100 && !runMediaMetadataBackfillStep(2).done; i++);
  const state = JSON.parse(
    (db().prepare(`SELECT value FROM kv WHERE key = 'migration:media_metadata_strip_v1'`).get() as { value: string }).value
  );
  assert.ok(state.done, 'marked done');
  assert.equal(state.scanned, all.length, 'every row visited exactly once');
  assert.equal(state.stripped, all.length, 'every dirty file cleaned');
  assert.deepEqual(runMediaMetadataBackfillStep(), { done: true, processed: 0 }, 'a finished sweep does nothing');

  const first = fs.readFileSync(mediaFilePath(all[0]));
  assert.ok(first.includes('PhoneCo'), 'resumed past the cursor rather than restarting');
  for (const m of all.slice(1)) {
    const bytes = fs.readFileSync(mediaFilePath(m));
    assert.ok(!bytes.includes('PhoneCo') && !bytes.includes(WHERE), `${m.mime} ${m.id} cleaned`);
  }
  // Still upright after the sweep.
  assert.equal((await sharp(mediaFilePath(target)).metadata()).orientation, 6);

  // The rendered card was carried over to the new cache key, not re-rendered.
  const again = await getVariant(target, 'card');
  assert.ok(again);
  assert.notEqual(again.filePath, variant.filePath, 'the key moved with the source bytes');
  assert.deepEqual(cardFiles(), [path.basename(again.filePath)], 'renamed, not rendered a second time');
});
