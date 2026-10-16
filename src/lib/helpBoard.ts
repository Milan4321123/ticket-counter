// Server-only: Sahayog (सहयोग, "help") — the community's help board.
//
// What the Facebook groups do today, organised: "need a room in Frankfurt
// from December", "driving Heidelberg → Darmstadt Saturday, 3 seats", "flying
// to Kathmandu on the 20th, 5 kg free", "can someone help with my Anmeldung?".
// Every post is an ASK or an OFFER in one category and one town, and it
// leaves the board by itself — on its travel date, or after 30 days — so the
// board never fills up with rooms let two years ago.
//
// Members only. Answers are private (lib/conversations): nobody posts their
// phone number under a post for the whole community to read.
//
// Nothing here handles money. A ride shares fuel costs between the people in
// the car, a room is between tenant and landlord; the site connects people
// and stays out of what they agree.
import crypto from 'crypto';
import { cityKey, cityName } from './cities';
import { addDays, berlinNow, cleanLine, cleanText, notBlockedSql, type Member } from './community';
import { getDb } from './db';

export interface HelpCategory {
  key: string;
  label: string;
  emoji: string;
  /** Shown on every post in the category, and on the form. */
  tip: string;
  /** Whether the post is about a day (a ride, a flight). */
  dated: boolean;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    key: 'room',
    label: 'Rooms & flats',
    emoji: '🏠',
    tip: 'Never pay a deposit or rent before you have seen the room and signed a contract. Scams with "I am abroad, send the deposit first" are common.',
    dated: false,
  },
  {
    key: 'rides',
    label: 'Rides',
    emoji: '🚗',
    tip: 'Share fuel costs only — offering paid rides as a business needs a licence in Germany.',
    dated: true,
  },
  {
    key: 'luggage',
    label: 'Luggage to & from Nepal',
    emoji: '✈️',
    tip: 'Only carry what you packed or checked yourself, never a closed package. Customs and airline rules apply to the person carrying it.',
    dated: true,
  },
  {
    key: 'papers',
    label: 'Papers & offices',
    emoji: '📄',
    tip: 'Never hand anyone your passport, residence card or bank details. Official translations need a sworn translator.',
    dated: false,
  },
  {
    key: 'jobs',
    label: 'Jobs & Ausbildung',
    emoji: '💼',
    tip: 'A real job never costs money to get. Do not pay "agents" or "fees" for a job or a contract.',
    dated: false,
  },
  {
    key: 'newcomers',
    label: 'New in Germany',
    emoji: '🛬',
    tip: 'Meet in public the first time, and tell a friend who is picking you up.',
    dated: false,
  },
  {
    key: 'study',
    label: 'Study & university',
    emoji: '🎓',
    tip: 'Check anything about visas or admission with the university or the authority itself.',
    dated: false,
  },
  {
    key: 'other',
    label: 'Anything else',
    emoji: '🤝',
    tip: 'Keep private details private until you trust someone.',
    dated: false,
  },
];

export function helpCategory(key: string): HelpCategory {
  return HELP_CATEGORIES.find((c) => c.key === key) ?? HELP_CATEGORIES[HELP_CATEGORIES.length - 1];
}

/** How long an undated post stays up. */
export const HELP_POST_DAYS = 30;
export const HELP_OPEN_MAX = 5;
export const HELP_PER_DAY = 5;

export interface HelpPost {
  id: string;
  kind: 'ask' | 'offer';
  category: string;
  city: string;
  title: string;
  body: string;
  whenDate: string | null;
  expiresOn: string;
  status: string;
  statusNote: string;
  createdAt: string;
  authorName: string;
  authorHandle: string;
  mine: boolean;
}

interface Row {
  id: string;
  author_id: string;
  kind: 'ask' | 'offer';
  category: string;
  city: string;
  title: string;
  body: string;
  when_date: string | null;
  expires_on: string;
  status: string;
  status_note: string;
  created_at: string;
  author_name: string | null;
  author_handle: string | null;
}

function toPost(r: Row, viewerId: string): HelpPost {
  return {
    id: r.id,
    kind: r.kind,
    category: r.category,
    city: r.city,
    title: r.title,
    body: r.body,
    whenDate: r.when_date,
    expiresOn: r.expires_on,
    status: r.status,
    statusNote: r.status_note,
    createdAt: r.created_at,
    authorName: r.author_name || 'a member',
    authorHandle: r.author_handle ?? '',
    mine: r.author_id === viewerId,
  };
}

const SELECT = `SELECT p.*, c.community_name AS author_name, c.community_handle AS author_handle
                FROM help_posts p JOIN customers c ON c.id = p.author_id`;

export interface BoardFilter {
  kind?: string;
  category?: string;
  city?: string;
}

/** Open posts on the board for one member, newest first, filtered. */
export function listHelpPosts(viewer: Member, filter: BoardFilter = {}): HelpPost[] {
  const today = berlinNow().slice(0, 10);
  const where = [`p.status = 'open'`, `p.expires_on >= ?`, `c.community_banned_at IS NULL`, notBlockedSql('p.author_id')];
  const args: (string | number)[] = [today, viewer.id, viewer.id];
  if (filter.kind === 'ask' || filter.kind === 'offer') {
    where.push(`p.kind = ?`);
    args.push(filter.kind);
  }
  if (filter.category && HELP_CATEGORIES.some((c) => c.key === filter.category)) {
    where.push(`p.category = ?`);
    args.push(filter.category);
  }
  const rows = getDb()
    .prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC LIMIT 300`)
    .all(...args) as Row[];
  const key = filter.city ? cityKey(filter.city) : '';
  return rows.filter((r) => !key || cityKey(r.city) === key).map((r) => toPost(r, viewer.id));
}

/** Open posts per town key, for the city chips (and the count everyone may see). */
export function helpPostCities(): { key: string; name: string; n: number }[] {
  const today = berlinNow().slice(0, 10);
  const rows = getDb().prepare(`SELECT city FROM help_posts WHERE status = 'open' AND expires_on >= ?`).all(today) as { city: string }[];
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

export function openHelpPostCount(): number {
  const today = berlinNow().slice(0, 10);
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM help_posts WHERE status = 'open' AND expires_on >= ?`).get(today) as { n: number }).n;
}

export function getHelpPost(viewer: Member, id: string): HelpPost | null {
  if (typeof id !== 'string' || id.length > 40) return null;
  const row = getDb()
    .prepare(`${SELECT} WHERE p.id = ? AND (p.author_id = ? OR ${notBlockedSql('p.author_id')})`)
    .get(id, viewer.id, viewer.id, viewer.id) as Row | undefined;
  if (!row) return null;
  if (row.status === 'removed' && row.author_id !== viewer.id) return null;
  return toPost(row, viewer.id);
}

export function myHelpPosts(viewer: Member): HelpPost[] {
  return (getDb().prepare(`${SELECT} WHERE p.author_id = ? ORDER BY p.created_at DESC LIMIT 50`).all(viewer.id) as Row[]).map((r) =>
    toPost(r, viewer.id)
  );
}

export type HelpResult = { ok: true; id: string } | { ok: false; error: string };

export function createHelpPost(author: Member, raw: Record<string, unknown>): HelpResult {
  const kind = raw.kind === 'offer' ? 'offer' : raw.kind === 'ask' ? 'ask' : null;
  if (!kind) return { ok: false, error: 'Are you asking for help or offering it?' };
  const cat = HELP_CATEGORIES.find((c) => c.key === raw.category);
  if (!cat) return { ok: false, error: 'Pick what it is about.' };
  const title = cleanLine(raw.title, 90);
  if (title.length < 4) return { ok: false, error: 'Say in one line what you need or offer.' };
  const body = cleanText(raw.body, 1500);
  const city = cityName(cleanLine(raw.city, 60));
  if (!city) return { ok: false, error: 'Which town is it about?' };
  const today = berlinNow().slice(0, 10);
  let whenDate: string | null = null;
  if (typeof raw.whenDate === 'string' && raw.whenDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.whenDate) || raw.whenDate < today || raw.whenDate > addDays(today, 365)) {
      return { ok: false, error: 'Pick a date between today and a year from now.' };
    }
    whenDate = raw.whenDate;
  }
  if (cat.dated && !whenDate) return { ok: false, error: cat.key === 'rides' ? 'Which day is the ride?' : 'Which day is the flight?' };
  // A dated post leaves the board the day after its date; others after 30 days.
  const expiresOn = whenDate ? addDays(whenDate, 1) : addDays(today, HELP_POST_DAYS);
  const db = getDb();
  const open = (db.prepare(`SELECT COUNT(*) AS n FROM help_posts WHERE author_id = ? AND status = 'open' AND expires_on >= ?`).get(author.id, today) as { n: number }).n;
  if (open >= HELP_OPEN_MAX) return { ok: false, error: `You have ${open} posts up — close one that is solved first.` };
  const recent = (db.prepare(`SELECT COUNT(*) AS n FROM help_posts WHERE author_id = ? AND created_at >= datetime('now', '-1 day')`).get(author.id) as { n: number }).n;
  if (recent >= HELP_PER_DAY) return { ok: false, error: 'That is a lot of posts for one day — try again tomorrow.' };
  const id = crypto.randomBytes(9).toString('base64url');
  db.prepare(
    `INSERT INTO help_posts (id, author_id, kind, category, city, title, body, when_date, expires_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, author.id, kind, cat.key, city, title, body, whenDate, expiresOn);
  return { ok: true, id };
}

/** The author closes their post ("solved") or puts it back up. */
export function setHelpPostOpen(author: Member, id: string, open: boolean): boolean {
  const today = berlinNow().slice(0, 10);
  const db = getDb();
  if (!open) {
    return (
      db
        .prepare(`UPDATE help_posts SET status = 'closed', status_note = 'Closed by the author', updated_at = datetime('now') WHERE id = ? AND author_id = ? AND status = 'open'`)
        .run(id, author.id).changes > 0
    );
  }
  // Reopening gives an undated post a fresh 30 days; a dated one keeps its date.
  return (
    db
      .prepare(
        `UPDATE help_posts SET status = 'open', status_note = '', updated_at = datetime('now'),
           expires_on = CASE WHEN when_date IS NULL THEN ? ELSE expires_on END
         WHERE id = ? AND author_id = ? AND status = 'closed' AND (when_date IS NULL OR when_date >= ?)`
      )
      .run(addDays(today, HELP_POST_DAYS), id, author.id, today).changes > 0
  );
}

/** The author deletes their post and every conversation about it. */
export function deleteHelpPost(author: Member, id: string): boolean {
  const db = getDb();
  return db.transaction(() => {
    const ok = db.prepare(`DELETE FROM help_posts WHERE id = ? AND author_id = ?`).run(id, author.id).changes > 0;
    if (ok) {
      db.prepare(`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE topic_type = 'help' AND topic_id = ?)`).run(id);
      db.prepare(`DELETE FROM conversations WHERE topic_type = 'help' AND topic_id = ?`).run(id);
    }
    return ok;
  })();
}

/** "Sat 24 Oct" from 'YYYY-MM-DD'. */
export function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "today", "yesterday", "3 days ago" from SQLite's UTC 'YYYY-MM-DD HH:MM:SS'. */
export function agoLabel(createdAt: string, now: Date = new Date()): string {
  const then = new Date(`${createdAt.replace(' ', 'T')}Z`).getTime();
  const days = Math.floor((now.getTime() - then) / 86_400_000);
  if (!Number.isFinite(days) || days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
