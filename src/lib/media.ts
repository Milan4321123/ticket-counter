// Server-only: event photo + video storage. Files live under
// DATA_DIR/uploads/<eventId>/ with generated names; the database row is the
// only path source, so no user input ever reaches the filesystem path.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getDb } from './db';
import { getEventMedia, getEventVideos, getMediaById, type EventMediaRow } from './events';
import { deleteVariants } from './imageVariants';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per photo
export const MAX_PHOTOS_PER_EVENT = 12;
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 MB per video
export const MAX_VIDEOS_PER_EVENT = 6;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** The only video types we accept — both play natively in every modern browser. */
export const VIDEO_MIMES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export function allowedImageMime(mime: string): boolean {
  return mime in EXT_BY_MIME;
}

export function allowedVideoMime(mime: string): boolean {
  return mime in VIDEO_MIMES;
}

function uploadsDir(eventId: string): string {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  return path.join(dataDir, 'uploads', eventId);
}

/**
 * Guard rails on an image's SHAPE, not just its file size.
 *
 * A file's byte count says nothing about what it costs to process: a 4000x10
 * strip is 31 KB but forces the resizer to build an enormous intermediate, and
 * a 30000x30000 image is a decode bomb that compresses to almost nothing. Both
 * sail through a 5 MB limit. Neither is a real event photo.
 */
const MAX_IMAGE_PIXELS = 50_000_000; // 50 MP — comfortably above any phone or DSLR
const MAX_IMAGE_ASPECT = 20; // a strip 20x longer than it is tall is not a photo
const MIN_IMAGE_EDGE = 16; // anything thinner is a rendering artefact

/**
 * What sharp says the bytes ACTUALLY are -> the mime we store.
 *
 * The inverse of EXT_BY_MIME, and deliberately a whitelist: anything sharp can
 * decode but that is not on this list (svg, gif, tiff, avif, pdf, heif) is
 * refused, because the point is to keep a vector or an animation from ever
 * reaching the resizer.
 */
const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Store an uploaded photo and register it. Caller must have authorized the event. */
export async function saveEventPhoto(eventId: string, mime: string, bytes: Buffer): Promise<EventMediaRow> {
  if (!allowedImageMime(mime)) throw new Error('Only JPEG, PNG, and WebP photos are supported.');
  if (bytes.length === 0) throw new Error('The uploaded file is empty.');
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('Photos can be at most 5 MB.');
  if (getEventMedia(eventId).length >= MAX_PHOTOS_PER_EVENT) {
    throw new Error(`An event can have at most ${MAX_PHOTOS_PER_EVENT} photos — delete one first.`);
  }

  // Header only — metadata() does not decode the pixels, so this stays cheap
  // even for the pathological files it exists to reject.
  //
  // The FORMAT here is the security-relevant part, not just the dimensions.
  // Everything above this point trusts `mime`, which is the Content-Type the
  // browser put on the multipart part — attacker-controlled text, not evidence.
  // Believing it let an SVG be stored as `<uuid>.png` with mime image/png, and
  // an SVG's width/height are attacker-authored attributes rather than a real
  // raster size, so every shape guard below passed on a file that is a program.
  //
  // It detonated later, on an UNAUTHENTICATED request: GET /api/media/<id>?v=cover
  // rasterises through librsvg, a filter-heavy 6 KB file burns ~18 seconds of
  // CPU, and lib/imageVariants.ts only writes its cache on SUCCESS — so a
  // payload that never finishes is re-rendered from scratch on every request,
  // with no amortisation, in a single-process Node server shared by every
  // tenant. Ticket sales and door check-in stall with it.
  //
  // So the decoded format decides what this file is, and the client's label is
  // used for nothing but an early rejection.
  let width = 0;
  let height = 0;
  let realMime = '';
  try {
    const meta = await sharp(bytes).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
    realMime = MIME_BY_FORMAT[String(meta.format)] ?? '';
  } catch {
    throw new Error('That file does not look like a real photo — please re-save it and try again.');
  }
  if (!realMime) {
    // Names the three we take rather than what was sent: an organizer who
    // exported an SVG or a HEIC needs to know what to convert TO.
    throw new Error('Only JPEG, PNG, and WebP photos are supported — please re-save it as one of those.');
  }
  if (!width || !height) {
    throw new Error('That file does not look like a real photo — please re-save it and try again.');
  }
  if (width < MIN_IMAGE_EDGE || height < MIN_IMAGE_EDGE) {
    throw new Error(`Photos need to be at least ${MIN_IMAGE_EDGE} pixels on each side.`);
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    throw new Error('That photo is enormous — please export it at a normal size and try again.');
  }
  if (Math.max(width / height, height / width) > MAX_IMAGE_ASPECT) {
    throw new Error(
      'That image is an extremely long, thin strip. Please crop it to a normal photo shape and try again.'
    );
  }

  const id = crypto.randomUUID();
  // From the DECODED format, never the declared one, so what is on disk and what
  // the database says are both the truth about the bytes.
  const fileName = `${id}.${EXT_BY_MIME[realMime]}`;
  const dir = uploadsDir(eventId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), bytes);

  const sort = getEventMedia(eventId).length;
  getDb()
    .prepare(`INSERT INTO event_media (id, event_id, file_name, mime, sort) VALUES (?, ?, ?, ?, ?)`)
    .run(id, eventId, fileName, realMime, sort);
  return { id, eventId, fileName, mime: realMime, sort, createdAt: new Date().toISOString() };
}

/** Absolute file path for a media row (from DB values only). */
export function mediaFilePath(media: EventMediaRow): string {
  return path.join(uploadsDir(media.eventId), media.fileName);
}

/**
 * Let go of every reference to a media row so it can be deleted. Poster,
 * profile, and cover pointers are cleared when they pointed at it; the legacy
 * single-video pointer moves on to the next remaining video (or NULL); and any
 * update post that attached it keeps its text but loses the attachment.
 *
 * That last step is not optional: event_posts.media_id is a real foreign key,
 * so deleting an attached photo/video without it fails outright.
 *
 * Call inside the deleting transaction, BEFORE the row is removed.
 */
function releaseMediaReferences(eventId: string, mediaId: string): void {
  const db = getDb();
  // Fixed column names (never user input) — no interpolation risk.
  for (const col of ['poster_media_id', 'profile_media_id', 'cover_media_id'] as const) {
    db.prepare(`UPDATE events SET ${col} = NULL WHERE id = ? AND ${col} = ?`).run(eventId, mediaId);
  }
  db.prepare(`UPDATE event_posts SET media_id = NULL WHERE event_id = ? AND media_id = ?`).run(eventId, mediaId);

  const pointer =
    (db.prepare(`SELECT video_media_id AS id FROM events WHERE id = ?`).get(eventId) as
      | { id: string | null }
      | undefined)?.id ?? null;
  if (pointer === mediaId) {
    const next = getEventVideos(eventId).find((v) => v.id !== mediaId) ?? null;
    db.prepare(`UPDATE events SET video_media_id = ? WHERE id = ?`).run(next?.id ?? null, eventId);
  }
}

/**
 * Delete a media row (file + row) and clean up every pointer that referenced
 * it. Named for its main use — the photo grid — but the generic media-delete
 * API can aim it at a video row too, which is why the video pointer is
 * re-homed here as well.
 */
export function deleteEventPhoto(media: EventMediaRow): void {
  const db = getDb();
  try {
    fs.unlinkSync(mediaFilePath(media));
  } catch {
    // File already gone — still remove the row.
  }
  deleteVariants(media.eventId, media.id);
  const tx = db.transaction(() => {
    releaseMediaReferences(media.eventId, media.id);
    db.prepare(`DELETE FROM event_media WHERE id = ?`).run(media.id);
  });
  tx();
}

/**
 * Append an uploaded video to the event's ordered video collection (same
 * semantics as photos, capped at MAX_VIDEOS_PER_EVENT). Nothing is replaced.
 * events.video_media_id keeps working as the "first video" pointer for the
 * older single-video call sites: it is filled in only while it is still NULL.
 * Caller must have authorized the event and already validated the bytes
 * (magic-byte sniff happens in the route).
 */
export function saveEventVideo(eventId: string, mime: string, bytes: Buffer): EventMediaRow {
  if (!allowedVideoMime(mime)) throw new Error('Only MP4 and WebM videos are supported.');
  if (bytes.length === 0) throw new Error('The uploaded file is empty.');
  if (bytes.length > MAX_VIDEO_BYTES) throw new Error('Videos can be at most 60 MB — compress it and try again.');

  const existing = getEventVideos(eventId);
  if (existing.length >= MAX_VIDEOS_PER_EVENT) {
    throw new Error(`An event can have at most ${MAX_VIDEOS_PER_EVENT} videos — delete one first.`);
  }

  const db = getDb();
  const id = crypto.randomUUID();
  const fileName = `${id}.${VIDEO_MIMES[mime]}`;
  const sort = existing.length;
  const dir = uploadsDir(eventId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), bytes);

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO event_media (id, event_id, file_name, mime, sort) VALUES (?, ?, ?, ?, ?)`).run(
      id,
      eventId,
      fileName,
      mime,
      sort
    );
    // Legacy pointer: only claims the slot when nothing holds it yet.
    db.prepare(`UPDATE events SET video_media_id = ? WHERE id = ? AND video_media_id IS NULL`).run(id, eventId);
  });
  tx();

  return { id, eventId, fileName, mime, sort, createdAt: new Date().toISOString() };
}

/**
 * Delete one uploaded video (file + row). Pass the media id to target a
 * specific video; with no id the legacy behaviour applies and the event's
 * current video_media_id is removed. Pointers are re-homed afterwards, so the
 * legacy pointer lands on the next remaining video (or NULL).
 */
export function deleteEventVideo(eventId: string, mediaId?: string): boolean {
  const db = getDb();
  const targetId =
    mediaId ??
    ((db.prepare(`SELECT video_media_id AS id FROM events WHERE id = ?`).get(eventId) as
      | { id: string | null }
      | undefined)?.id ??
      null);
  if (!targetId) return false;

  const media = getMediaById(targetId);
  // Ownership + type guard: a video row of THIS event, never anything else.
  if (!media || media.eventId !== eventId || !media.mime.startsWith('video/')) {
    // The row is already gone — make sure no pointer is left dangling.
    db.transaction(() => releaseMediaReferences(eventId, targetId))();
    return false;
  }

  try {
    fs.unlinkSync(mediaFilePath(media));
  } catch {
    // File already gone — still remove the row.
  }
  const tx = db.transaction(() => {
    releaseMediaReferences(eventId, targetId);
    db.prepare(`DELETE FROM event_media WHERE id = ?`).run(targetId);
  });
  tx();
  return true;
}
