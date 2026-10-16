// Server-only: Kalakar (कलाकार, "artist") — profiles for the people the
// community books: singers, bands, DJs, dancers, MCs, photographers, makeup
// and mehendi artists, caterers, pandits, decorators, teachers, and small
// Nepali businesses.
//
// The one PUBLIC part of the community: a profile is something its owner
// publishes on purpose, to be found — by an organizer planning the next
// Dashain night, by a family looking for a pandit, by Google. Everything else
// about the owner stays private: the profile shows what they typed into it,
// never their member name, town or email, and enquiries go through a private
// conversation (lib/conversations), never an address on the page.
//
// Always free: no paid listings, no "featured" placement for money. The only
// mark that orders the list is "verified" — set by the platform after
// checking the person is who the profile says (an artist's own page, a known
// organizer vouching), so nobody can pass themselves off as a famous singer.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { cityKey, cityName } from './cities';
import { cleanLine, cleanText, type Member } from './community';
import { unlinkTalentPhotos } from './communityData';
import { getDb } from './db';
import { listPublishedEvents, videoEmbedUrl, type EventRow } from './events';
import { sniffFormat, stripJpeg, stripPng, stripWebp } from './stripMetadata';

export const TALENT_KINDS: { key: string; label: string; emoji: string }[] = [
  { key: 'singer', label: 'Singer', emoji: '🎤' },
  { key: 'band', label: 'Band & musicians', emoji: '🎸' },
  { key: 'dj', label: 'DJ', emoji: '🎧' },
  { key: 'dancer', label: 'Dancer & dance group', emoji: '💃' },
  { key: 'mc', label: 'MC & host', emoji: '🎙️' },
  { key: 'photo', label: 'Photo & video', emoji: '📸' },
  { key: 'makeup', label: 'Makeup & mehendi', emoji: '💄' },
  { key: 'food', label: 'Catering & cooks', emoji: '🍛' },
  { key: 'pandit', label: 'Pandit & puja', emoji: '🪔' },
  { key: 'decor', label: 'Decoration & stage', emoji: '🎊' },
  { key: 'teacher', label: 'Teacher: dance, music, Nepali', emoji: '📚' },
  { key: 'business', label: 'Shop & business', emoji: '🏪' },
  { key: 'other', label: 'Something else', emoji: '✨' },
];

export function talentKind(key: string) {
  return TALENT_KINDS.find((k) => k.key === key) ?? TALENT_KINDS[TALENT_KINDS.length - 1];
}

export const TALENT_PHOTO_MAX_BYTES = 1_500_000;
const MAX_LINKS = 5;

export interface TalentLink {
  label: string;
  url: string;
}

export interface TalentProfile {
  id: string;
  slug: string;
  name: string;
  kind: string;
  city: string;
  areas: string;
  bio: string;
  links: TalentLink[];
  videoUrl: string;
  photoUrl: string | null;
  status: string;
  statusNote: string;
  verified: boolean;
  ownerHandle: string;
  mine: boolean;
  updatedAt: string;
}

interface Row {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  kind: string;
  city: string;
  areas: string;
  bio: string;
  links: string;
  video_url: string;
  photo: string;
  status: string;
  status_note: string;
  verified_at: string | null;
  updated_at: string;
  owner_handle: string | null;
}

function parseLinks(raw: string): TalentLink[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((l) => l && typeof l.url === 'string' && typeof l.label === 'string').slice(0, MAX_LINKS) : [];
  } catch {
    return [];
  }
}

export function talentPhotoUrl(file: string): string | null {
  return file ? `/api/community/talent/photo/${file}` : null;
}

function toProfile(r: Row, viewerId: string | null): TalentProfile {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    kind: r.kind,
    city: r.city,
    areas: r.areas,
    bio: r.bio,
    links: parseLinks(r.links),
    videoUrl: r.video_url,
    photoUrl: talentPhotoUrl(r.photo),
    status: r.status,
    statusNote: r.status_note,
    verified: Boolean(r.verified_at),
    ownerHandle: r.owner_handle ?? '',
    mine: viewerId !== null && r.owner_id === viewerId,
    updatedAt: r.updated_at,
  };
}

const SELECT = `SELECT t.*, c.community_handle AS owner_handle
                FROM talent_profiles t JOIN customers c ON c.id = t.owner_id`;

/** Live profiles for the directory, verified first, then the most recently updated. */
export function listTalent(filter: { kind?: string; city?: string } = {}): TalentProfile[] {
  const where = [`t.status = 'live'`, `c.community_banned_at IS NULL`];
  const args: string[] = [];
  if (filter.kind && TALENT_KINDS.some((k) => k.key === filter.kind)) {
    where.push(`t.kind = ?`);
    args.push(filter.kind);
  }
  const rows = getDb()
    .prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY (t.verified_at IS NULL), t.updated_at DESC LIMIT 500`)
    .all(...args) as Row[];
  const key = filter.city ? cityKey(filter.city) : '';
  return rows.filter((r) => !key || cityKey(r.city) === key).map((r) => toProfile(r, null));
}

export function talentCities(): { key: string; name: string; n: number }[] {
  const rows = getDb()
    .prepare(`SELECT t.city FROM talent_profiles t JOIN customers c ON c.id = t.owner_id WHERE t.status = 'live' AND c.community_banned_at IS NULL`)
    .all() as { city: string }[];
  const map = new Map<string, { key: string; name: string; n: number }>();
  for (const r of rows) {
    const key = cityKey(r.city);
    if (!key) continue;
    const row = map.get(key) ?? { key, name: cityName(r.city), n: 0 };
    row.n += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.n - a.n);
}

/** A profile by its URL: live for everyone, any state for its owner. */
export function talentBySlug(slug: string, viewerId: string | null): TalentProfile | null {
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  const row = getDb().prepare(`${SELECT} WHERE t.slug = ?`).get(slug) as Row | undefined;
  if (!row) return null;
  if (row.owner_id !== viewerId && row.status !== 'live') return null;
  return toProfile(row, viewerId);
}

export function myTalent(owner: Member): TalentProfile | null {
  const row = getDb().prepare(`${SELECT} WHERE t.owner_id = ?`).get(owner.id) as Row | undefined;
  return row ? toProfile(row, owner.id) : null;
}

export function liveTalentSlugs(): { slug: string; updatedAt: string }[] {
  return getDb()
    .prepare(
      `SELECT t.slug, t.updated_at AS updatedAt FROM talent_profiles t JOIN customers c ON c.id = t.owner_id
       WHERE t.status = 'live' AND c.community_banned_at IS NULL`
    )
    .all() as { slug: string; updatedAt: string }[];
}

const LINK_LABELS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)(facebook\.com|fb\.com)$/, 'Facebook'],
  [/(^|\.)spotify\.com$/, 'Spotify'],
  [/(^|\.)soundcloud\.com$/, 'SoundCloud'],
];

/** Only https links, to a real host, at most five; labelled by where they go. */
export function checkLinks(raw: unknown): TalentLink[] | { error: string } {
  const list = Array.isArray(raw) ? raw : [];
  const out: TalentLink[] = [];
  for (const item of list) {
    const text = cleanLine(item, 300);
    if (!text) continue;
    let u: URL;
    try {
      u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    } catch {
      return { error: `That link does not look right: ${text}` };
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: 'Links must be web addresses.' };
    if (!u.hostname.includes('.') || u.username || u.password) return { error: `That link does not look right: ${text}` };
    u.protocol = 'https:';
    const host = u.hostname.toLowerCase();
    const label = LINK_LABELS.find(([re]) => re.test(host))?.[1] ?? 'Website';
    out.push({ label, url: u.toString() });
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

function slugFrom(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  // A name written only in Devanagari has no Latin letters to make a slug of.
  return base.length >= 2 ? base : `artist-${crypto.randomBytes(3).toString('hex')}`;
}

function uniqueSlug(name: string): string {
  const db = getDb();
  const base = slugFrom(name);
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!db.prepare(`SELECT 1 FROM talent_profiles WHERE slug = ?`).get(slug)) return slug;
  }
}

export type SaveResult = { ok: true; slug: string } | { ok: false; error: string };

/** Create or update the member's one profile. The URL is fixed when it is first made. */
export function saveTalent(owner: Member, raw: Record<string, unknown>): SaveResult {
  const name = cleanLine(raw.name, 60);
  if (name.length < 2) return { ok: false, error: 'What name should people find you by?' };
  const kind = TALENT_KINDS.some((k) => k.key === raw.kind) ? (raw.kind as string) : '';
  if (!kind) return { ok: false, error: 'Pick what you do.' };
  const city = cityName(cleanLine(raw.city, 60));
  if (!city) return { ok: false, error: 'Which town are you based in?' };
  const areas = cleanLine(raw.areas, 80);
  const bio = cleanText(raw.bio, 1500);
  if (bio.length < 20) return { ok: false, error: 'Write a few lines about what you do — at least a sentence.' };
  const links = checkLinks(raw.links);
  if ('error' in links) return { ok: false, error: links.error };
  const video = cleanLine(raw.videoUrl, 300);
  const embed = video ? videoEmbedUrl(video) : null;
  if (video && (!embed || embed.kind === 'file')) return { ok: false, error: 'The video must be a YouTube or Vimeo link.' };
  const db = getDb();
  const existing = db.prepare(`SELECT id, slug FROM talent_profiles WHERE owner_id = ?`).get(owner.id) as { id: string; slug: string } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE talent_profiles SET name = ?, kind = ?, city = ?, areas = ?, bio = ?, links = ?, video_url = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(name, kind, city, areas, bio, JSON.stringify(links), video, existing.id);
    return { ok: true, slug: existing.slug };
  }
  const slug = uniqueSlug(name);
  db.prepare(
    `INSERT INTO talent_profiles (id, owner_id, slug, name, kind, city, areas, bio, links, video_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), owner.id, slug, name, kind, city, areas, bio, JSON.stringify(links), video);
  return { ok: true, slug };
}

/** The owner hides their profile (or shows it again). A removed one stays removed. */
export function setTalentVisible(owner: Member, visible: boolean): boolean {
  return (
    getDb()
      .prepare(`UPDATE talent_profiles SET status = ?, updated_at = datetime('now') WHERE owner_id = ? AND status = ?`)
      .run(visible ? 'live' : 'hidden', owner.id, visible ? 'hidden' : 'live').changes > 0
  );
}

/** The owner deletes their profile, its photo, and every enquiry about it. */
export function deleteTalent(owner: Member): boolean {
  const db = getDb();
  let photo = '';
  const ok = db.transaction(() => {
    const row = db.prepare(`SELECT id, photo FROM talent_profiles WHERE owner_id = ?`).get(owner.id) as { id: string; photo: string } | undefined;
    if (!row) return false;
    photo = row.photo;
    db.prepare(`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE topic_type = 'talent' AND topic_id = ?)`).run(row.id);
    db.prepare(`DELETE FROM conversations WHERE topic_type = 'talent' AND topic_id = ?`).run(row.id);
    db.prepare(`DELETE FROM talent_profiles WHERE id = ?`).run(row.id);
    return true;
  })();
  if (photo) unlinkTalentPhotos([photo]);
  return ok;
}

function talentDir(): string {
  const dir = path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'talent');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export type PhotoResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Store a profile photo. The browser has already cut it to a square and
 * re-encoded it (so it arrives small and without camera metadata); here the
 * bytes are checked to really be an image and stripped of metadata once more
 * — byte-level, no image library, nothing heavy on the host.
 */
export function setTalentPhoto(owner: Member, bytes: Buffer): PhotoResult {
  const row = getDb().prepare(`SELECT id, photo FROM talent_profiles WHERE owner_id = ?`).get(owner.id) as { id: string; photo: string } | undefined;
  if (!row) return { ok: false, error: 'Save your profile first, then add a photo.' };
  if (bytes.length > TALENT_PHOTO_MAX_BYTES) return { ok: false, error: 'That photo is too big.' };
  const format = sniffFormat(bytes.subarray(0, 32));
  let clean: Buffer;
  let ext: string;
  try {
    if (format === 'jpeg') {
      clean = stripJpeg(bytes);
      ext = 'jpg';
    } else if (format === 'png') {
      clean = stripPng(bytes);
      ext = 'png';
    } else if (format === 'webp') {
      clean = stripWebp(bytes);
      ext = 'webp';
    } else {
      return { ok: false, error: 'Please use a JPEG, PNG or WebP photo.' };
    }
  } catch {
    return { ok: false, error: 'That photo could not be read — try another one.' };
  }
  const file = `${row.id.slice(0, 8)}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(talentDir(), file), clean);
  getDb().prepare(`UPDATE talent_profiles SET photo = ?, updated_at = datetime('now') WHERE id = ?`).run(file, row.id);
  if (row.photo) unlinkTalentPhotos([row.photo]);
  return { ok: true, url: talentPhotoUrl(file)! };
}

export function readTalentPhoto(file: string): { bytes: Buffer; type: string } | null {
  if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(file)) return null;
  // Only a file a profile still points at is served.
  const row = getDb().prepare(`SELECT 1 FROM talent_profiles WHERE photo = ? AND status <> 'removed'`).get(file);
  if (!row) return null;
  try {
    const bytes = fs.readFileSync(path.join(talentDir(), file));
    const type = file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return { bytes, type };
  } catch {
    return null;
  }
}

/**
 * Published events this profile's name appears in — "upcoming shows". A plain
 * name match on the event's artist line and title; short names are skipped,
 * because "DJ" or "Ram" would match half the calendar.
 */
export function upcomingShowsFor(profile: TalentProfile, today: string): EventRow[] {
  const name = profile.name.trim().toLowerCase();
  if (name.length < 4) return [];
  return listPublishedEvents()
    .filter((e) => e.kind !== 'shop' && e.eventDate && e.eventDate.slice(0, 10) >= today)
    .filter((e) => `${e.artist} ${e.name}`.toLowerCase().includes(name))
    .slice(0, 6);
}

/** The platform marks (or unmarks) a profile as checked. Admin only. */
export function setTalentVerified(id: string, on: boolean): boolean {
  return (
    getDb()
      .prepare(`UPDATE talent_profiles SET verified_at = CASE WHEN ? THEN datetime('now') ELSE NULL END WHERE id = ?`)
      .run(on ? 1 : 0, id).changes > 0
  );
}

export function listAllTalentForAdmin(): (TalentProfile & { ownerName: string })[] {
  const rows = getDb()
    .prepare(`SELECT t.*, c.community_handle AS owner_handle, c.community_name AS owner_name FROM talent_profiles t JOIN customers c ON c.id = t.owner_id ORDER BY t.created_at DESC LIMIT 300`)
    .all() as (Row & { owner_name: string })[];
  return rows.map((r) => ({ ...toProfile(r, null), ownerName: r.owner_name }));
}
