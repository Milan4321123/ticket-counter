// Server-only: take the camera's metadata out of an uploaded photo or video.
//
// A phone photo carries far more than pixels. Its Exif block records WHERE it
// was taken (GPS to a few metres), WHEN, on WHICH device (make, model, serial
// numbers, owner name), and often a thumbnail of the UNCROPPED original. A home
// seller photographing a jar of achar on their kitchen table publishes their
// home address with it. Videos do the same in their 'udta'/'meta' boxes
// (Apple's ©xyz / com.apple.quicktime.location.ISO6709, 3GPP 'loci').
//
// Everything here is BYTE-LEVEL: segments and chunks are dropped or blanked,
// pixels are never decoded or re-encoded. That is deliberate, twice over:
//   - it is lossless — the picture that arrives is the picture that ships;
//   - it is cheap. Decoding with sharp costs tens of MB per photo, and bulk
//     sharp work inside the 512 MB production instance has already OOM-killed
//     it into a crash loop once. Walking a JPEG's segment list costs nothing.
//
// The contract every function here keeps: NEVER make a file worse. On any
// doubt about the structure — a length that overruns, a missing terminator, a
// format we do not recognise — the input comes back untouched (the SAME Buffer
// object, so callers can tell nothing happened) and the reason is logged once.
// A photo that still has its Exif is a privacy gap; a photo that no longer
// opens is a broken listing, and the organizer cannot fix it.
//
// Every strip is idempotent: running it over its own output changes nothing.
//
// What is kept, per format, and why:
//   JPEG — APP0 JFIF, APP2 ICC_PROFILE (the colour profile), APP14 Adobe (its
//          transform flag decides how the colour channels decode). A non-1
//          Exif Orientation is written back as a minimal Exif holding ONLY that
//          tag: browsers rotate by it, and without it every portrait phone
//          photo would lie on its side. Everything after EOI is dropped too —
//          that is where Motion Photos keep their MP4 and gain maps their
//          second JPEG, both with metadata of their own.
//   PNG  — every chunk except eXIf, tEXt, zTXt, iTXt, tIME and caBX (C2PA
//          provenance manifest). iCCP/gAMA/cHRM/sRGB/pHYs/tRNS/APNG chunks all
//          stay. Orientation is kept the same way as JPEG.
//   WebP — every chunk except EXIF and XMP; VP8X flags and the RIFF size are
//          fixed to match. Orientation kept the same way.
//   MP4/MOV (ISO BMFF) — see planIsoBmff: metadata boxes are renamed to 'free'
//          and zero-filled IN PLACE, so not a single byte moves and every chunk
//          offset in stco/co64 stays valid.
//   WebM — left alone, on purpose. See stripMetadata().
import crypto from 'crypto';
import fs from 'fs';

export type MediaFormat = 'jpeg' | 'png' | 'webp' | 'isobmff' | 'webm' | 'unknown';

// ---------------- logging ----------------

const warned = new Set<string>();

/** One line per distinct reason per process — a bad batch must not flood the log. */
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[stripMetadata] ${message} — left unchanged.`);
}

/** Give up on this file: hand back the input untouched. */
function doubt<T>(format: string, reason: string, input: T): T {
  warnOnce(`${format}:${reason}`, `${format}: ${reason}`);
  return input;
}

// ---------------- sniffing ----------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Top-level box types a real ISO BMFF file can open with. 'ftyp' for anything
 * modern; the rest for old QuickTime files that predate it.
 */
const ISO_FIRST_BOXES = new Set(['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide', 'pnot', 'styp']);

/** What the bytes are, from their magic numbers — never from a declared mime. */
export function sniffFormat(head: Buffer): MediaFormat {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head.length >= 8 && head.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (head.length >= 12 && head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') {
    return 'webp';
  }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'webm';
  if (head.length >= 8 && ISO_FIRST_BOXES.has(head.toString('latin1', 4, 8))) return 'isobmff';
  return 'unknown';
}

// ---------------- Exif orientation ----------------

const TAG_ORIENTATION = 0x0112;
const EXIF_PREFIX = Buffer.from('Exif\0\0', 'latin1');

/** An Exif payload may or may not open with "Exif\0\0" before its TIFF header. */
function tiffOf(payload: Buffer): Buffer {
  return payload.length >= 6 && payload.toString('latin1', 0, 5) === 'Exif\0' ? payload.subarray(6) : payload;
}

/**
 * The Orientation tag from IFD0 of a TIFF-structured Exif block, in either
 * byte order, or null when there is none or it cannot be read.
 *
 * Mirrors what browsers accept (a SHORT with a count of one, valued 1-8): an
 * orientation a browser would ignore is not one worth preserving.
 */
export function readTiffOrientation(tiff: Buffer): number | null {
  if (tiff.length < 8) return null;
  const order = tiff.toString('latin1', 0, 2);
  const le = order === 'II';
  if (!le && order !== 'MM') return null;
  const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o: number) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  if (u16(2) !== 42) return null;
  const ifd = u32(4);
  if (ifd < 8 || ifd + 2 > tiff.length) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > tiff.length) return null;
    if (u16(e) !== TAG_ORIENTATION) continue;
    if (u16(e + 2) !== 3 || u32(e + 4) !== 1) return null;
    const v = u16(e + 8);
    return v >= 1 && v <= 8 ? v : null;
  }
  return null;
}

/**
 * The smallest Exif that still says which way up the picture goes: a
 * big-endian TIFF header and an IFD0 holding the Orientation tag and nothing
 * else — no GPS pointer, no Exif sub-IFD, no thumbnail (IFD1).
 */
export function orientationOnlyTiff(orientation: number): Buffer {
  const t = Buffer.alloc(26);
  t.write('MM', 0, 'latin1');
  t.writeUInt16BE(42, 2);
  t.writeUInt32BE(8, 4); // IFD0 right after the header
  t.writeUInt16BE(1, 8); // one entry
  t.writeUInt16BE(TAG_ORIENTATION, 10);
  t.writeUInt16BE(3, 12); // SHORT
  t.writeUInt32BE(1, 14); // count
  t.writeUInt16BE(orientation, 18); // value, left-justified in its 4 bytes
  t.writeUInt32BE(0, 22); // no next IFD
  return t;
}

// ---------------- JPEG ----------------

/** A JPEG APPn/COM segment worth keeping, judged by marker and identifier. */
function keepJpegSegment(marker: number, payload: Buffer): boolean {
  const id = (s: string) => payload.length >= s.length && payload.toString('latin1', 0, s.length) === s;
  if (marker === 0xe0) return id('JFIF\0'); // not JFXX: that one is a thumbnail
  if (marker === 0xe2) return id('ICC_PROFILE\0');
  if (marker === 0xee) return id('Adobe');
  if (marker >= 0xe0 && marker <= 0xef) return false; // every other APPn: Exif, XMP, IPTC, MPF, FPXR, C2PA...
  if (marker === 0xfe) return false; // COM
  return true; // tables, frame, scan, restart interval: the picture itself
}

function jpegOrientationSegment(orientation: number): Buffer {
  const tiff = orientationOnlyTiff(orientation);
  const seg = Buffer.alloc(4 + EXIF_PREFIX.length + tiff.length);
  seg[0] = 0xff;
  seg[1] = 0xe1;
  seg.writeUInt16BE(2 + EXIF_PREFIX.length + tiff.length, 2);
  EXIF_PREFIX.copy(seg, 4);
  tiff.copy(seg, 4 + EXIF_PREFIX.length);
  return seg;
}

export function stripJpeg(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return doubt('jpeg', 'no SOI marker', buf);
  const parts: Buffer[] = [buf.subarray(0, 2)];
  let orientation: number | null = null;
  let exifSlot = -1;
  let pos = 2;
  let finished = false;

  while (pos < buf.length) {
    if (buf[pos] !== 0xff) return doubt('jpeg', 'bytes between segments', buf);
    // Any number of 0xFF fill bytes may precede a marker.
    let m = pos + 1;
    while (m < buf.length && buf[m] === 0xff) m++;
    if (m >= buf.length) return doubt('jpeg', 'ends inside a marker', buf);
    const marker = buf[m];

    if (marker === 0xd9) {
      // EOI. Whatever follows is not part of this picture (Motion Photo MP4,
      // gain map, MPO second frame, appended junk) and goes.
      parts.push(buf.subarray(m - 1, m + 1));
      finished = true;
      break;
    }
    if (marker === 0x00 || marker === 0xd8) return doubt('jpeg', 'unexpected marker', buf);
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      // Standalone markers carry no length.
      parts.push(buf.subarray(m - 1, m + 1));
      pos = m + 1;
      continue;
    }

    if (m + 3 > buf.length) return doubt('jpeg', 'truncated segment header', buf);
    const len = buf.readUInt16BE(m + 1);
    const end = m + 1 + len;
    if (len < 2 || end > buf.length) return doubt('jpeg', 'segment overruns the file', buf);
    const payload = buf.subarray(m + 3, end);

    if (keepJpegSegment(marker, payload)) {
      parts.push(buf.subarray(m - 1, end));
    } else if (marker === 0xe1 && exifSlot < 0 && payload.toString('latin1', 0, 5) === 'Exif\0') {
      // The first Exif block decides the orientation, and its place in the
      // file is where the orientation-only replacement goes.
      orientation = readTiffOrientation(tiffOf(payload));
      exifSlot = parts.length;
    }
    pos = end;

    if (marker === 0xda) {
      // Entropy-coded scan data follows SOS. Inside it 0xFF is always followed
      // by 0x00 (stuffing) or a restart marker, so the next other marker is the
      // first byte that is not scan data. Copy up to it and carry on — later
      // segments (progressive scans' tables, stray APPn) are judged like any.
      let q = pos;
      for (;;) {
        const ff = buf.indexOf(0xff, q);
        if (ff < 0 || ff + 1 >= buf.length) {
          // No EOI: a truncated file. Its header is already cleaned; the rest
          // is copied as-is, so it renders exactly as far as it did before.
          parts.push(buf.subarray(pos));
          pos = buf.length;
          finished = true;
          break;
        }
        const next = buf[ff + 1];
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          q = ff + 2;
          continue;
        }
        if (next === 0xff) {
          q = ff + 1;
          continue;
        }
        parts.push(buf.subarray(pos, ff));
        pos = ff;
        break;
      }
      if (finished) break;
    }
  }
  if (!finished) return doubt('jpeg', 'no image data', buf);

  if (orientation !== null && orientation !== 1) parts.splice(exifSlot, 0, jpegOrientationSegment(orientation));
  const out = Buffer.concat(parts);
  return out.equals(buf) ? buf : out;
}

// ---------------- PNG ----------------

/**
 * Chunks that describe the photo rather than draw it. Everything else stays —
 * colour (iCCP, gAMA, cHRM, sRGB, cICP), transparency, physical size, and the
 * APNG animation chunks are all ancillary but change what is shown.
 */
const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME', 'caBX']);

let crcTable: Uint32Array | null = null;
function crc32(data: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 'latin1');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

export function stripPng(buf: Buffer): Buffer {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return doubt('png', 'no signature', buf);
  const parts: Buffer[] = [buf.subarray(0, 8)];
  let orientation: number | null = null;
  let exifSlot = -1;
  let pos = 8;
  let sawEnd = false;

  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) return doubt('png', 'malformed chunk type', buf);
    if (len > 0x7fffffff || pos + 12 + len > buf.length) return doubt('png', 'chunk overruns the file', buf);
    const end = pos + 12 + len;
    if (PNG_DROP.has(type)) {
      if (type === 'eXIf' && exifSlot < 0) {
        orientation = readTiffOrientation(tiffOf(buf.subarray(pos + 8, pos + 8 + len)));
        exifSlot = parts.length;
      }
    } else {
      parts.push(buf.subarray(pos, end));
    }
    pos = end;
    if (type === 'IEND') {
      sawEnd = true;
      break; // anything after IEND is not part of the image
    }
  }
  if (!sawEnd) return doubt('png', 'no IEND chunk', buf);

  if (orientation !== null && orientation !== 1) parts.splice(exifSlot, 0, pngChunk('eXIf', orientationOnlyTiff(orientation)));
  const out = Buffer.concat(parts);
  return out.equals(buf) ? buf : out;
}

// ---------------- WebP ----------------

const VP8X_FLAG_EXIF = 0x08;
const VP8X_FLAG_XMP = 0x04;

export function stripWebp(buf: Buffer): Buffer {
  if (buf.length < 20 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') {
    return doubt('webp', 'no RIFF/WEBP header', buf);
  }
  const riffEnd = 8 + buf.readUInt32LE(4);
  if (riffEnd > buf.length || riffEnd < 12) return doubt('webp', 'RIFF size overruns the file', buf);

  const parts: Buffer[] = [];
  let vp8x = -1;
  let orientation: number | null = null;
  let exifSlot = -1;
  let exifPrefixed = false;
  let pos = 12;

  while (pos < riffEnd) {
    if (pos + 8 > riffEnd) return doubt('webp', 'truncated chunk header', buf);
    const fourcc = buf.toString('latin1', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const dataEnd = pos + 8 + size;
    if (dataEnd > riffEnd) return doubt('webp', 'chunk overruns the file', buf);
    // Chunks are padded to even length; a writer may omit the very last pad.
    const next = Math.min(dataEnd + (size & 1), riffEnd);
    if (fourcc === 'EXIF' || fourcc === 'XMP ') {
      if (fourcc === 'EXIF' && exifSlot < 0) {
        const payload = buf.subarray(pos + 8, dataEnd);
        exifPrefixed = payload.toString('latin1', 0, 5) === 'Exif\0';
        orientation = readTiffOrientation(tiffOf(payload));
        exifSlot = parts.length;
      }
    } else {
      if (fourcc === 'VP8X') vp8x = parts.length;
      parts.push(buf.subarray(pos, next));
    }
    pos = next;
  }

  const keepOrientation = orientation !== null && orientation !== 1;
  if (keepOrientation) {
    // Written back in the same dialect the file used (libvips prefixes
    // "Exif\0\0", the WebP spec does not) — the reader that honoured it before
    // will honour it after. Both payloads are even-sized, so no pad byte.
    const tiff = orientationOnlyTiff(orientation as number);
    const payload = exifPrefixed ? Buffer.concat([EXIF_PREFIX, tiff]) : tiff;
    const head = Buffer.alloc(8);
    head.write('EXIF', 0, 'latin1');
    head.writeUInt32LE(payload.length, 4);
    parts.splice(exifSlot, 0, Buffer.concat([head, payload]));
    if (vp8x >= exifSlot) vp8x++;
  }
  if (vp8x >= 0) {
    // The extended header advertises which metadata chunks exist; say only
    // what is still true. A copy — the input is never written to.
    const chunk = Buffer.from(parts[vp8x]);
    if (chunk.length < 9) return doubt('webp', 'short VP8X chunk', buf);
    chunk[8] &= ~VP8X_FLAG_XMP;
    if (keepOrientation) chunk[8] |= VP8X_FLAG_EXIF;
    else chunk[8] &= ~VP8X_FLAG_EXIF;
    parts[vp8x] = chunk;
  }

  const body = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(4 + body.length, 4);
  header.write('WEBP', 8, 'latin1');
  const out = Buffer.concat([header, body]);
  return out.equals(buf) ? buf : out;
}

// ---------------- ISO BMFF (MP4 / MOV) ----------------

/** Random access to the bytes of a file or a buffer — only what is asked for is read. */
export interface ByteSource {
  readonly size: number;
  read(pos: number, len: number): Buffer;
}

export function bufferSource(buf: Buffer): ByteSource {
  return { size: buf.length, read: (pos, len) => buf.subarray(pos, Math.min(pos + len, buf.length)) };
}

export function fdSource(fd: number, size: number): ByteSource {
  return {
    size,
    read(pos, len) {
      const out = Buffer.alloc(Math.max(0, Math.min(len, size - pos)));
      let got = 0;
      while (got < out.length) {
        const n = fs.readSync(fd, out, got, out.length - got, pos + got);
        if (n <= 0) break;
        got += n;
      }
      return out.subarray(0, got);
    },
  };
}

/** One box rewritten in place: renamed to 'free' (unless it already is) and its payload zeroed. */
export interface BoxPatch {
  /** Offset of the 4-byte type field. */
  typeAt: number;
  rename: boolean;
  /** Zero [zeroFrom, zeroTo). Starts right after the size field(s). */
  zeroFrom: number;
  zeroTo: number;
}

interface BoxHeader {
  type: string;
  start: number;
  end: number;
  /** Size fields only (8, or 16 with a 64-bit largesize) — where zeroing starts. */
  sizeLen: number;
  /** Full header including a uuid's 16-byte usertype — where children start. */
  headerLen: number;
  userType: string;
}

/**
 * Where location and identity live in a video: 'udta' (user data: ©xyz, loci,
 * ©mak/©mod, Samsung smta...), 'meta' (Apple's mdta keys, incl.
 * com.apple.quicktime.location.ISO6709), and the location atoms themselves in
 * case a muxer put one loose. ©xyz is 0xA9 'x' 'y' 'z', read here as latin1.
 */
const ISO_META_TYPES = new Set(['udta', 'meta', 'loci', '©xyz']);
/** Adobe XMP-in-MP4. */
const XMP_UUID = 'be7acfcb97a942e89c71999491e3afac';
/** Padding boxes worth scrubbing if something left bytes inside them (bounded read). */
const MAX_FREE_SCAN = 1024 * 1024;

type HeaderResult = BoxHeader | 'end' | 'bad';

function readBoxHeader(src: ByteSource, pos: number, limit: number, topLevel: boolean): HeaderResult {
  // Fewer than 8 bytes left in a container is trailing padding (QuickTime
  // writes a 32-bit zero terminator into some lists), not a box.
  if (limit - pos < 8) return 'end';
  const h = src.read(pos, Math.min(32, limit - pos));
  if (h.length < 8) return 'bad';
  const size32 = h.readUInt32BE(0);
  const type = h.toString('latin1', 4, 8);
  let size: number;
  let sizeLen = 8;
  if (size32 === 1) {
    if (h.length < 16) return 'bad';
    const big = h.readBigUInt64BE(8);
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) return 'bad';
    size = Number(big);
    sizeLen = 16;
  } else if (size32 === 0) {
    // "Extends to the end of the file" — only meaningful at the top level.
    // Inside a container a zero size is the QuickTime terminator.
    if (!topLevel) return 'end';
    size = limit - pos;
  } else {
    size = size32;
  }
  let headerLen = sizeLen;
  let userType = '';
  if (type === 'uuid') {
    if (h.length < sizeLen + 16) return 'bad';
    userType = h.toString('hex', sizeLen, sizeLen + 16);
    headerLen += 16;
  }
  if (size < headerLen || pos + size > limit) return 'bad';
  return { type, start: pos, end: pos + size, sizeLen, headerLen, userType };
}

/** Does [from, to) hold anything but zeros? Read in bounded slices. */
function hasNonZero(src: ByteSource, from: number, to: number): boolean {
  for (let p = from; p < to; p += 64 * 1024) {
    const chunk = src.read(p, Math.min(64 * 1024, to - p));
    for (let i = 0; i < chunk.length; i++) if (chunk[i] !== 0) return true;
    if (chunk.length === 0) break;
  }
  return false;
}

/**
 * A 'meta' whose handler is 'pict' is a HEIF image's item table, not
 * metadata — removing it would destroy the picture. Never the case for an MP4
 * video, but cheap to rule out.
 */
function isImageMeta(src: ByteSource, box: BoxHeader): boolean {
  const head = src.read(box.start + box.headerLen, Math.min(48, box.end - box.start - box.headerLen));
  const at = head.indexOf('hdlr', 0, 'latin1');
  return at >= 0 && at + 16 <= head.length && head.toString('latin1', at + 12, at + 16) === 'pict';
}

function metadataPatch(src: ByteSource, box: BoxHeader): BoxPatch | null {
  const isMeta =
    ISO_META_TYPES.has(box.type) || (box.type === 'uuid' && box.userType === XMP_UUID);
  if (isMeta) {
    if (box.type === 'meta' && isImageMeta(src, box)) return null;
    return { typeAt: box.start + 4, rename: true, zeroFrom: box.start + box.sizeLen, zeroTo: box.end };
  }
  // Already padding — but padding can still hold bytes: a tool that "deleted"
  // metadata by renaming it, a muxer's banner, or our own run interrupted
  // between the rename and the zeroing. Scrub those too (bounded).
  if (
    (box.type === 'free' || box.type === 'skip') &&
    box.end - box.start <= MAX_FREE_SCAN &&
    hasNonZero(src, box.start + box.sizeLen, box.end)
  ) {
    return { typeAt: box.start + 4, rename: false, zeroFrom: box.start + box.sizeLen, zeroTo: box.end };
  }
  return null;
}

/** Walk one container's direct children; descend moov -> trak only. False on doubt. */
function walkChildren(src: ByteSource, parent: BoxHeader, kind: 'moov' | 'trak', patches: BoxPatch[]): boolean {
  let pos = parent.start + parent.headerLen;
  while (pos < parent.end) {
    const box = readBoxHeader(src, pos, parent.end, false);
    if (box === 'end') break;
    if (box === 'bad') return false;
    const patch = metadataPatch(src, box);
    if (patch) patches.push(patch);
    else if (kind === 'moov' && box.type === 'trak' && !walkChildren(src, box, 'trak', patches)) return false;
    pos = box.end;
  }
  return true;
}

/**
 * Which bytes to overwrite to remove a video's metadata, or null on doubt.
 *
 * Nothing is removed and nothing moves. A metadata box keeps its size and
 * position, becomes a 'free' box (which every player skips by definition), and
 * has its payload zeroed — renaming alone would leave the coordinates sitting
 * in the file for anyone with a hex editor. Because no byte shifts, the chunk
 * offset tables (stco/co64) that point into mdat stay exactly right, and a
 * 60 MB video is fixed by writing a few hundred bytes.
 *
 * Only the top level, moov's children and each trak's children are visited —
 * that is where udta/meta live. The walk reads box HEADERS, never media data.
 */
export function planIsoBmff(src: ByteSource): BoxPatch[] | null {
  const patches: BoxPatch[] = [];
  let pos = 0;
  let first = true;
  while (pos < src.size) {
    const box = readBoxHeader(src, pos, src.size, true);
    if (box === 'end') break;
    if (box === 'bad') return doubt('isobmff', 'box overruns its container', null);
    if (first) {
      if (!ISO_FIRST_BOXES.has(box.type)) return doubt('isobmff', 'not an ISO BMFF file', null);
      first = false;
    }
    if (box.type === 'moov') {
      if (!walkChildren(src, box, 'moov', patches)) return doubt('isobmff', 'box overruns its container', null);
    } else {
      const patch = metadataPatch(src, box);
      if (patch) patches.push(patch);
    }
    pos = box.end;
  }
  if (first) return doubt('isobmff', 'empty file', null);
  return patches;
}

const FREE = Buffer.from('free', 'latin1');

function applyToBuffer(out: Buffer, patches: BoxPatch[]): void {
  for (const p of patches) {
    if (p.rename) FREE.copy(out, p.typeAt);
    out.fill(0, p.zeroFrom, p.zeroTo);
  }
}

/**
 * Rename FIRST, then zero: if the process dies between the two, the file holds
 * a valid 'free' box with leftover bytes (which the next run scrubs), never a
 * metadata box full of zeros that a parser would choke on.
 */
function applyToFd(fd: number, patches: BoxPatch[]): void {
  const zeros = Buffer.alloc(64 * 1024);
  for (const p of patches) {
    if (p.rename) fs.writeSync(fd, FREE, 0, 4, p.typeAt);
    for (let at = p.zeroFrom; at < p.zeroTo; at += zeros.length) {
      fs.writeSync(fd, zeros, 0, Math.min(zeros.length, p.zeroTo - at), at);
    }
  }
}

export function stripIsoBmff(buf: Buffer): Buffer {
  let patches: BoxPatch[] | null;
  try {
    patches = planIsoBmff(bufferSource(buf));
  } catch {
    return doubt('isobmff', 'unreadable structure', buf);
  }
  if (!patches || patches.length === 0) return buf;
  const out = Buffer.from(buf);
  applyToBuffer(out, patches);
  return out;
}

// ---------------- entry points ----------------

/**
 * The same bytes without their metadata, or the input itself (same object)
 * when there was nothing to remove or the format is not one we can safely edit.
 * Pure: the input is never written to.
 *
 * WebM is returned untouched ON PURPOSE. No phone camera records WebM (they
 * record MP4/MOV — the formats that carry GPS); WebM comes from browsers'
 * MediaRecorder and ffmpeg, which do not write a location. Its only metadata
 * home, the Tags element, is usually reached through a SeekHead and often sits
 * behind unknown-size Clusters from live recording — blanking it safely needs a
 * full EBML walk, and a demuxer that seeks to a Tags position and finds a Void
 * there is exactly the kind of corruption this module exists never to cause.
 */
export function stripMetadata(buf: Buffer): Buffer {
  try {
    switch (sniffFormat(buf)) {
      case 'jpeg':
        return stripJpeg(buf);
      case 'png':
        return stripPng(buf);
      case 'webp':
        return stripWebp(buf);
      case 'isobmff':
        return stripIsoBmff(buf);
      default:
        return buf;
    }
  } catch (e) {
    return doubt('media', `parser error (${e instanceof Error ? e.message : String(e)})`, buf);
  }
}

export type StripFileOutcome =
  /** Metadata was found and removed. */
  | 'stripped'
  /** Nothing to remove (or a structure we would not touch — logged). */
  | 'clean'
  /** A format we deliberately leave alone (WebM, anything unrecognised). */
  | 'unsupported'
  /** An image larger than we are willing to hold in memory at once. */
  | 'too-large'
  | 'missing'
  | 'failed';

/** Photos are read whole; far above the 5 MB upload cap, far below trouble. */
const DEFAULT_MAX_IMAGE_BYTES = 32 * 1024 * 1024;

/**
 * Strip a stored file on disk, with a bounded memory cost:
 *   - photos are read whole (they are capped at upload) and replaced
 *     atomically — written to a temp file and renamed over the original, so a
 *     request serving it at that moment sees the old file or the new one,
 *     never half of one;
 *   - videos are patched IN PLACE through a file descriptor: box headers are
 *     read one at a time and only the metadata boxes are written, so a 60 MB
 *     video costs a few KB of memory.
 * Synchronous on purpose: the caller runs it inside one tick, so no request
 * handler in this process can delete or replace the file halfway through.
 */
export function stripMetadataFile(
  filePath: string,
  opts: { maxImageBytes?: number } = {}
): StripFileOutcome {
  let fd: number;
  try {
    fd = fs.openSync(filePath, 'r');
  } catch {
    return 'missing';
  }
  let format: MediaFormat;
  let size: number;
  try {
    size = fs.fstatSync(fd).size;
    format = sniffFormat(fdSource(fd, size).read(0, 16));
  } catch {
    return 'failed';
  } finally {
    fs.closeSync(fd);
  }

  if (format === 'jpeg' || format === 'png' || format === 'webp') {
    if (size > (opts.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES)) return 'too-large';
    let tmp = '';
    try {
      const bytes = fs.readFileSync(filePath);
      const out = stripMetadata(bytes);
      if (out === bytes) return 'clean';
      tmp = `${filePath}.${process.pid}.${crypto.randomUUID()}.strip.tmp`;
      fs.writeFileSync(tmp, out);
      fs.renameSync(tmp, filePath);
      return 'stripped';
    } catch {
      if (tmp) {
        try {
          fs.unlinkSync(tmp);
        } catch {
          // never written
        }
      }
      return 'failed';
    }
  }

  if (format === 'isobmff') {
    let wfd: number | null = null;
    try {
      wfd = fs.openSync(filePath, 'r+');
      const src = fdSource(wfd, fs.fstatSync(wfd).size);
      const patches = planIsoBmff(src);
      if (!patches || patches.length === 0) return 'clean';
      applyToFd(wfd, patches);
      return 'stripped';
    } catch {
      return 'failed';
    } finally {
      if (wfd !== null) fs.closeSync(wfd);
    }
  }

  return 'unsupported';
}
