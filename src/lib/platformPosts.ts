// Server-only: the platform owner's own announcements, and the identity shown
// on the "talk to us" card.
//
// These are NOT an organizer's event updates. An event post belongs to one
// event and is read by people already interested in it; these belong to the
// site and are read by everyone browsing. Keeping them apart means an
// announcement never has to pretend to be an event, and deleting an event can
// never take a platform notice with it.
import crypto from 'crypto';
import { getDb } from './db';

export interface PlatformPostRow {
  id: string;
  body: string;
  /** '' when the announcement has no picture. */
  photoUrl: string;
  createdAt: string;
}

/**
 * Newest first — a feed nobody scrolls to the bottom of.
 *
 * Never throws. See getPlatformContact() below for why that matters: these are
 * read from the ROOT LAYOUT and from the home page, both of which Next renders
 * during `next build`, when the production disk is not mounted and opening
 * SQLite fails outright.
 */
export function listPlatformPosts(limit = 5): PlatformPostRow[] {
  try {
    return getDb()
    .prepare(
      `SELECT id, body, photo_url AS photoUrl, created_at AS createdAt FROM platform_posts
       ORDER BY created_at DESC LIMIT ?`
    )
      .all(limit) as PlatformPostRow[];
  } catch {
    return [];
  }
}

export function createPlatformPost(body: string): PlatformPostRow {
  const id = crypto.randomUUID();
  getDb().prepare(`INSERT INTO platform_posts (id, body) VALUES (?, ?)`).run(id, body.trim());
  return getDb()
    .prepare(`SELECT id, body, photo_url AS photoUrl, created_at AS createdAt FROM platform_posts WHERE id = ?`)
    .get(id) as PlatformPostRow;
}

/** Attach (or clear) the picture on one announcement. */
export function setPlatformPostPhoto(id: string, photoUrl: string): void {
  getDb().prepare(`UPDATE platform_posts SET photo_url = ? WHERE id = ?`).run(photoUrl, id);
}

export function deletePlatformPost(id: string): boolean {
  return getDb().prepare(`DELETE FROM platform_posts WHERE id = ?`).run(id).changes > 0;
}

// ---------------- The person behind the platform ----------------

function readKv(key: string): string | null {
  const row = getDb().prepare(`SELECT value FROM kv WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function writeKv(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO kv (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value);
}

const NAME_KEY = 'platform_contact_name';
const ROLE_KEY = 'platform_contact_role';
const PHOTO_KEY = 'platform_contact_photo';
const FOCUS_KEY = 'platform_contact_focus';

export interface PlatformContact {
  name: string;
  role: string;
  /** A URL to the photo, or '' when none has been set. */
  photoUrl: string;
  /**
   * Which part of the photo stays in the circle, as CSS object-position — e.g.
   * '50% 30%' to pull a face up out of the middle.
   *
   * A focus point rather than a stored crop: the whole photo is kept on disk,
   * so moving it re-renders nothing and costs no quality. The event cropper
   * extracts a rectangle because those slots have several different shapes; this
   * one is always a circle, and a circle only needs a centre.
   */
  focus: string;
}

/**
 * Who a visitor is invited to talk to.
 *
 * A name and a face, because "contact us" is a form and "talk to Milan" is a
 * person — and on a platform whose whole pitch is that a real human designs
 * your page, the difference is the pitch. Falls back to the platform name so
 * the card is never half-empty on a fresh install.
 */
export function getPlatformContact(): PlatformContact {
  // MUST NOT THROW. This is called from the root layout, which Next renders for
  // every page during `next build`. On Render the persistent disk is not
  // mounted at build time, so opening the database there fails — and because
  // this sits in the layout, that failure took the ENTIRE BUILD down rather
  // than one page. Four deploys failed with "exited with status 1" before the
  // cause was found. An empty contact simply hides the bubble; a thrown error
  // ships nothing at all.
  try {
    return {
      name: readKv(NAME_KEY) ?? '',
      role: readKv(ROLE_KEY) ?? 'Designer & founder',
      photoUrl: readKv(PHOTO_KEY) ?? '',
      focus: readKv(FOCUS_KEY) || '50% 50%',
    };
  } catch {
    return { name: '', role: 'Designer & founder', photoUrl: '', focus: '50% 50%' };
  }
}

export function setPlatformContact(next: Partial<PlatformContact>): void {
  if (next.name !== undefined) writeKv(NAME_KEY, next.name.trim().slice(0, 80));
  if (next.role !== undefined) writeKv(ROLE_KEY, next.role.trim().slice(0, 80));
  if (next.photoUrl !== undefined) writeKv(PHOTO_KEY, next.photoUrl.trim().slice(0, 500));
  // Percentages only — this string is written straight into a style attribute.
  if (next.focus !== undefined && /^\d{1,3}% \d{1,3}%$/.test(next.focus)) writeKv(FOCUS_KEY, next.focus);
}
