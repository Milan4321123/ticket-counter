// Server-only: the community — who is a member, the rules they accepted, and
// the report / block machinery that keeps Bhetghat, Sahayog and Kalakar civil.
//
// A member is a signed-in customer (a verified email, lib/customers) who opted
// in: they chose the name other members see — never their checkout name —
// gave a home town, confirmed they are 16 or over, and accepted the rules.
// Everything members post is visible to other signed-in members only, except
// a Kalakar profile, which its owner publishes on purpose.
//
// Blocks are mutual invisibility: once either person blocks the other,
// neither sees the other's meetups, posts or messages, and neither can join
// the other's meetups or write to them. That is simpler to reason about than
// a one-way mute, and it is what someone who blocks a person actually wants.
import crypto from 'crypto';
import { cityName } from './cities';
import { currentCustomer, type Customer } from './customers';
import { getDb } from './db';

export const COMMUNITY_RULES_VERSION = 1;
export const COMMUNITY_MIN_AGE = 16;

export const COMMUNITY_RULES: { title: string; text: string }[] = [
  {
    title: 'Be kind',
    text: 'Treat people the way you would at a community gathering. No insults, hate or bullying — about caste, religion, ethnicity, gender or anything else.',
  },
  {
    title: 'Meet in public',
    text: 'Meetups happen in public places — a café, a park, a hall. Never post your home address; share private details only once you trust someone.',
  },
  {
    title: 'No scams, no selling',
    text: 'Goods for sale belong in the bazaar. Never send money in advance, never pay a deposit before you have seen a room and a contract, and never pay to get a job.',
  },
  {
    title: 'Carry only what you packed',
    text: 'Taking something to or from Nepal for someone? Only carry what you checked yourself — customs rules apply to you, not to the sender.',
  },
  {
    title: 'Be yourself',
    text: 'One account per person, your own name or a nickname, and never pretend to be someone else — especially not an artist.',
  },
  {
    title: 'Report, don’t argue',
    text: 'If something is wrong, press Report. Every report is read, and what breaks these rules is taken down.',
  },
];

export interface Member {
  /** The customer id — never shown to other members, never in a URL. */
  id: string;
  handle: string;
  name: string;
  city: string;
  joinedAt: string;
}

export type CommunityState =
  | { kind: 'signed-out' }
  | { kind: 'not-joined'; customer: Customer; draft: { name: string; city: string } }
  | { kind: 'banned'; customer: Customer }
  | { kind: 'member'; customer: Customer; member: Member };

interface MemberRow {
  id: string;
  handle: string | null;
  name: string;
  city: string;
  joinedAt: string | null;
  bannedAt: string | null;
  rulesVersion: number;
}

const MEMBER_COLS = `id, community_handle AS handle, community_name AS name, community_city AS city,
  community_joined_at AS joinedAt, community_banned_at AS bannedAt, community_rules_version AS rulesVersion`;

function asMember(row: MemberRow | undefined): Member | null {
  if (!row || !row.handle || !row.joinedAt || row.bannedAt) return null;
  if (row.rulesVersion < COMMUNITY_RULES_VERSION) return null;
  return { id: row.id, handle: row.handle, name: row.name, city: row.city, joinedAt: row.joinedAt };
}

/** The member behind a customer account, or null (not joined, banned, or rules out of date). */
export function getMember(customerId: string): Member | null {
  return asMember(getDb().prepare(`SELECT ${MEMBER_COLS} FROM customers WHERE id = ?`).get(customerId) as MemberRow | undefined);
}

export function memberByHandle(handle: string): Member | null {
  if (!/^[a-z0-9]{6,16}$/.test(handle)) return null;
  return asMember(
    getDb().prepare(`SELECT ${MEMBER_COLS} FROM customers WHERE community_handle = ?`).get(handle) as MemberRow | undefined
  );
}

/** Who is looking at a community page: signed out, signed in but not joined, banned, or a member. */
export async function communityState(): Promise<CommunityState> {
  const customer = await currentCustomer();
  if (!customer) return { kind: 'signed-out' };
  const row = getDb().prepare(`SELECT ${MEMBER_COLS} FROM customers WHERE id = ?`).get(customer.id) as MemberRow | undefined;
  if (row?.bannedAt) return { kind: 'banned', customer };
  const member = asMember(row);
  if (member) return { kind: 'member', customer, member };
  // A first name from checkout is a reasonable suggestion, never a default
  // that is saved without them seeing it.
  const first = customer.name.split(/\s+/)[0] ?? '';
  return { kind: 'not-joined', customer, draft: { name: row?.name || first, city: row?.city || '' } };
}

// ---------------------------------------------------------------------------
// Text and time
// ---------------------------------------------------------------------------

/** One line of member text: control characters out, spaces collapsed, capped. */
export function cleanLine(raw: unknown, max: number): string {
  return (typeof raw === 'string' ? raw : '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** A paragraph of member text: line breaks kept (at most one blank line), capped. */
export function cleanText(raw: unknown, max: number): string {
  return (typeof raw === 'string' ? raw : '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/** Wall-clock time in Germany as 'YYYY-MM-DDTHH:MM' — what meetups are written in. */
export function berlinNow(at: Date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Sat 24 Oct · 18:30" from a 'YYYY-MM-DDTHH:MM' wall-clock value. */
export function whenLabel(startsAt: string): string {
  const d = new Date(`${startsAt.slice(0, 10)}T12:00:00Z`);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const time = startsAt.slice(11, 16);
  return time ? `${day} · ${time}` : day;
}

// ---------------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------------

const HANDLE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function newHandle(): string {
  const db = getDb();
  for (;;) {
    const bytes = crypto.randomBytes(8);
    const handle = Array.from(bytes, (b) => HANDLE_ALPHABET[b % HANDLE_ALPHABET.length]).join('');
    if (!db.prepare(`SELECT 1 FROM customers WHERE community_handle = ?`).get(handle)) return handle;
  }
}

function checkName(raw: unknown): { name: string } | { error: string } {
  const name = cleanLine(raw, 40);
  if (name.length < 2) return { error: 'Choose the name other members will see — 2 to 40 letters.' };
  if (/@|https?:|www\.|\d{6,}/i.test(name)) return { error: 'Just a name, please — no email, links or phone numbers.' };
  return { name };
}

export type JoinResult = { ok: true; member: Member } | { ok: false; error: string };

/** Opt a customer into the community, or update their member name and town. */
export function joinCommunity(
  customerId: string,
  input: { name: unknown; city: unknown; age?: unknown; rules?: unknown },
  opts: { requireConsent: boolean } = { requireConsent: true }
): JoinResult {
  const checked = checkName(input.name);
  if ('error' in checked) return { ok: false, error: checked.error };
  const city = cityName(cleanLine(input.city, 60));
  if (!city) return { ok: false, error: 'Which town do you live in? It decides what you see first.' };
  if (opts.requireConsent) {
    if (input.age !== true) return { ok: false, error: `You need to be ${COMMUNITY_MIN_AGE} or older to join.` };
    if (input.rules !== true) return { ok: false, error: 'Please read and accept the community rules.' };
  }
  const db = getDb();
  const row = db.prepare(`SELECT ${MEMBER_COLS} FROM customers WHERE id = ?`).get(customerId) as MemberRow | undefined;
  if (!row) return { ok: false, error: 'Please sign in again.' };
  if (row.bannedAt) return { ok: false, error: 'Your community access was removed.' };
  if (!opts.requireConsent && !asMember(row)) return { ok: false, error: 'Join the community first.' };
  db.prepare(
    `UPDATE customers SET community_name = ?, community_city = ?, community_handle = ?,
       community_joined_at = COALESCE(community_joined_at, datetime('now')),
       community_rules_version = CASE WHEN ? THEN ? ELSE community_rules_version END
     WHERE id = ?`
  ).run(checked.name, city, row.handle ?? newHandle(), opts.requireConsent ? 1 : 0, COMMUNITY_RULES_VERSION, customerId);
  const member = getMember(customerId);
  return member ? { ok: true, member } : { ok: false, error: 'Could not join — please try again.' };
}

/**
 * Leave the community without deleting the customer account: everything they
 * posted goes (lib/communityData), the member name and town are cleared, and
 * they can join again later as if new.
 */
export function leaveCommunity(customerId: string, erase: (id: string) => void): void {
  const db = getDb();
  db.transaction(() => {
    erase(customerId);
    db.prepare(
      `UPDATE customers SET community_name = '', community_city = '', community_handle = NULL,
         community_joined_at = NULL, community_rules_version = 0
       WHERE id = ?`
    ).run(customerId);
  })();
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/**
 * SQL that is true when the row's author (`col`) and the viewer have NOT
 * blocked each other. Takes two parameters, both the viewer's id.
 */
export function notBlockedSql(col: string): string {
  return `NOT EXISTS (SELECT 1 FROM community_blocks cb
            WHERE (cb.blocker_id = ? AND cb.blocked_id = ${col}) OR (cb.blocked_id = ? AND cb.blocker_id = ${col}))`;
}

export function blockedBetween(a: string, b: string): boolean {
  return Boolean(
    getDb()
      .prepare(
        `SELECT 1 FROM community_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`
      )
      .get(a, b, b, a)
  );
}

export function blockMember(blockerId: string, handle: string): boolean {
  const target = memberByHandle(handle);
  if (!target || target.id === blockerId) return false;
  getDb().prepare(`INSERT OR IGNORE INTO community_blocks (blocker_id, blocked_id) VALUES (?, ?)`).run(blockerId, target.id);
  return true;
}

export function unblockMember(blockerId: string, handle: string): boolean {
  const row = getDb().prepare(`SELECT id FROM customers WHERE community_handle = ?`).get(handle) as { id: string } | undefined;
  if (!row) return false;
  return getDb().prepare(`DELETE FROM community_blocks WHERE blocker_id = ? AND blocked_id = ?`).run(blockerId, row.id).changes > 0;
}

export function listBlocked(blockerId: string): { handle: string; name: string }[] {
  return getDb()
    .prepare(
      `SELECT c.community_handle AS handle, c.community_name AS name
       FROM community_blocks b JOIN customers c ON c.id = b.blocked_id
       WHERE b.blocker_id = ? AND c.community_handle IS NOT NULL ORDER BY b.created_at DESC`
    )
    .all(blockerId) as { handle: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const REPORT_REASONS: Record<string, string> = {
  scam: 'Scam, or asking for money',
  hate: 'Hate, insults or bullying',
  unsafe: 'Feels unsafe',
  spam: 'Spam or advertising',
  fake: 'Fake, or pretending to be someone',
  private: "Shares someone's private details",
  other: 'Something else',
};

export const REPORT_TARGETS = ['meetup', 'meetup_message', 'help_post', 'message', 'talent', 'member'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

/**
 * Three separate members reporting the same thing takes it down until it has
 * been looked at. One report is somebody's opinion; three is a pattern, and
 * waiting for a person to read it would leave a scam up all weekend.
 */
export const AUTO_HOLD_REPORTS = 3;
const HELD = 'Held after reports — waiting for review';

/** Who wrote the thing being reported, or null when it does not exist. */
function ownerOf(type: ReportTarget, id: string): string | null {
  const db = getDb();
  const q = (sql: string, arg: string | number) => (db.prepare(sql).get(arg) as { owner: string } | undefined)?.owner ?? null;
  switch (type) {
    case 'meetup':
      return q(`SELECT host_id AS owner FROM meetups WHERE id = ?`, id);
    case 'meetup_message':
      return q(`SELECT customer_id AS owner FROM meetup_messages WHERE id = ?`, Number(id) || 0);
    case 'help_post':
      return q(`SELECT author_id AS owner FROM help_posts WHERE id = ?`, id);
    case 'message':
      return q(`SELECT sender_id AS owner FROM conversation_messages WHERE id = ?`, Number(id) || 0);
    case 'talent':
      return q(`SELECT owner_id AS owner FROM talent_profiles WHERE id = ?`, id);
    case 'member':
      return q(`SELECT id AS owner FROM customers WHERE community_handle = ?`, id);
  }
}

function hold(type: ReportTarget, id: string): void {
  const db = getDb();
  switch (type) {
    case 'meetup':
      db.prepare(`UPDATE meetups SET status = 'removed', status_note = ?, updated_at = datetime('now') WHERE id = ? AND status = 'open'`).run(HELD, id);
      break;
    case 'meetup_message':
      db.prepare(`UPDATE meetup_messages SET removed_at = datetime('now') WHERE id = ? AND removed_at IS NULL`).run(Number(id) || 0);
      break;
    case 'help_post':
      db.prepare(`UPDATE help_posts SET status = 'removed', status_note = ?, updated_at = datetime('now') WHERE id = ? AND status = 'open'`).run(HELD, id);
      break;
    case 'message':
      db.prepare(`UPDATE conversation_messages SET removed_at = datetime('now') WHERE id = ? AND removed_at IS NULL`).run(Number(id) || 0);
      break;
    case 'talent':
      db.prepare(`UPDATE talent_profiles SET status = 'removed', status_note = ?, updated_at = datetime('now') WHERE id = ? AND status = 'live'`).run(HELD, id);
      break;
    case 'member':
      // A person is never taken down automatically — that is a decision.
      break;
  }
}

export type ReportResult = { ok: true; held: boolean } | { ok: false; error: string };

export function reportContent(reporterId: string, type: unknown, targetId: unknown, reason: unknown, note: unknown): ReportResult {
  if (typeof type !== 'string' || !(REPORT_TARGETS as readonly string[]).includes(type)) return { ok: false, error: 'Unknown thing to report.' };
  if (typeof reason !== 'string' || !REPORT_REASONS[reason]) return { ok: false, error: 'Choose a reason.' };
  const id = cleanLine(targetId, 64);
  const target = type as ReportTarget;
  const owner = ownerOf(target, id);
  if (!owner) return { ok: false, error: 'That is no longer there.' };
  if (owner === reporterId) return { ok: false, error: 'That is your own.' };
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO community_reports (id, reporter_id, target_type, target_id, reason, note) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), reporterId, target, id, reason, cleanText(note, 500));
  const open = (
    db
      .prepare(`SELECT COUNT(DISTINCT reporter_id) AS n FROM community_reports WHERE target_type = ? AND target_id = ? AND status = 'open'`)
      .get(target, id) as { n: number }
  ).n;
  const held = open >= AUTO_HOLD_REPORTS;
  if (held) hold(target, id);
  return { ok: true, held };
}

// ---------------------------------------------------------------------------
// Moderation (admin)
// ---------------------------------------------------------------------------

export interface ReportGroup {
  targetType: ReportTarget;
  targetId: string;
  count: number;
  firstAt: string;
  reasons: { reason: string; note: string; createdAt: string }[];
  preview: { title: string; body: string; author: string; authorHandle: string; state: string; link: string | null };
}

function previewOf(type: ReportTarget, id: string): ReportGroup['preview'] {
  const db = getDb();
  const empty = { title: '(gone)', body: '', author: '', authorHandle: '', state: 'gone', link: null };
  const author = (cid: string) =>
    (db.prepare(`SELECT community_name AS name, community_handle AS handle FROM customers WHERE id = ?`).get(cid) as
      | { name: string; handle: string | null }
      | undefined) ?? { name: '(deleted)', handle: null };
  switch (type) {
    case 'meetup': {
      const r = db.prepare(`SELECT host_id, title, about, status, status_note FROM meetups WHERE id = ?`).get(id) as
        | { host_id: string; title: string; about: string; status: string; status_note: string }
        | undefined;
      if (!r) return empty;
      const a = author(r.host_id);
      return { title: r.title, body: r.about, author: a.name, authorHandle: a.handle ?? '', state: r.status, link: `/bhetghat/m/${id}` };
    }
    case 'meetup_message': {
      const r = db
        .prepare(`SELECT mm.customer_id, mm.body, mm.removed_at, mm.meetup_id, m.title FROM meetup_messages mm LEFT JOIN meetups m ON m.id = mm.meetup_id WHERE mm.id = ?`)
        .get(Number(id) || 0) as { customer_id: string; body: string; removed_at: string | null; meetup_id: string; title: string | null } | undefined;
      if (!r) return empty;
      const a = author(r.customer_id);
      return {
        title: `Message in “${r.title ?? 'a meetup'}”`,
        body: r.body,
        author: a.name,
        authorHandle: a.handle ?? '',
        state: r.removed_at ? 'removed' : 'live',
        link: `/bhetghat/m/${r.meetup_id}`,
      };
    }
    case 'help_post': {
      const r = db.prepare(`SELECT author_id, title, body, status FROM help_posts WHERE id = ?`).get(id) as
        | { author_id: string; title: string; body: string; status: string }
        | undefined;
      if (!r) return empty;
      const a = author(r.author_id);
      return { title: r.title, body: r.body, author: a.name, authorHandle: a.handle ?? '', state: r.status, link: `/sahayog/p/${id}` };
    }
    case 'message': {
      const r = db.prepare(`SELECT sender_id, body, removed_at FROM conversation_messages WHERE id = ?`).get(Number(id) || 0) as
        | { sender_id: string; body: string; removed_at: string | null }
        | undefined;
      if (!r) return empty;
      const a = author(r.sender_id);
      return { title: 'Private message', body: r.body, author: a.name, authorHandle: a.handle ?? '', state: r.removed_at ? 'removed' : 'live', link: null };
    }
    case 'talent': {
      const r = db.prepare(`SELECT owner_id, name, bio, status, slug FROM talent_profiles WHERE id = ?`).get(id) as
        | { owner_id: string; name: string; bio: string; status: string; slug: string }
        | undefined;
      if (!r) return empty;
      const a = author(r.owner_id);
      return { title: r.name, body: r.bio, author: a.name, authorHandle: a.handle ?? '', state: r.status, link: `/kalakar/${r.slug}` };
    }
    case 'member': {
      const r = db.prepare(`SELECT community_name AS name, community_city AS city, community_banned_at AS banned FROM customers WHERE community_handle = ?`).get(id) as
        | { name: string; city: string; banned: string | null }
        | undefined;
      if (!r) return empty;
      return { title: `Member: ${r.name}`, body: r.city, author: r.name, authorHandle: id, state: r.banned ? 'banned' : 'member', link: null };
    }
  }
}

export function listReportGroups(): ReportGroup[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT target_type AS targetType, target_id AS targetId, reason, note, created_at AS createdAt
       FROM community_reports WHERE status = 'open' ORDER BY created_at ASC LIMIT 500`
    )
    .all() as { targetType: ReportTarget; targetId: string; reason: string; note: string; createdAt: string }[];
  const groups = new Map<string, ReportGroup>();
  for (const r of rows) {
    const key = `${r.targetType}:${r.targetId}`;
    let g = groups.get(key);
    if (!g) {
      g = { targetType: r.targetType, targetId: r.targetId, count: 0, firstAt: r.createdAt, reasons: [], preview: previewOf(r.targetType, r.targetId) };
      groups.set(key, g);
    }
    g.count += 1;
    g.reasons.push({ reason: r.reason, note: r.note, createdAt: r.createdAt });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.firstAt.localeCompare(b.firstAt));
}

export type ModerationAction = 'dismiss' | 'remove' | 'restore' | 'ban';

/**
 * Close every open report on one target with a decision:
 * dismiss (nothing wrong — and a held item goes back up), remove (take it
 * down), restore (undo an earlier removal), or ban (take the AUTHOR out of
 * the community: everything they have up comes down, and they cannot rejoin).
 */
export function moderate(type: ReportTarget, id: string, action: ModerationAction): boolean {
  const db = getDb();
  const owner = ownerOf(type, id);
  const table = type === 'meetup' ? 'meetups' : type === 'help_post' ? 'help_posts' : type === 'talent' ? 'talent_profiles' : null;
  const liveStatus = type === 'talent' ? 'live' : 'open';
  return db.transaction(() => {
    const note = 'Removed by the MartNepali team';
    if (action === 'remove' || action === 'ban') {
      hold(type, id);
      if (table) db.prepare(`UPDATE ${table} SET status_note = ? WHERE id = ? AND status = 'removed'`).run(note, id);
    }
    if (action === 'dismiss' || action === 'restore') {
      // Only a hold or an earlier removal is undone; a host's own cancellation
      // or an author closing their post is theirs to keep.
      if (table) db.prepare(`UPDATE ${table} SET status = ?, status_note = '' WHERE id = ? AND status = 'removed'`).run(liveStatus, id);
      if (type === 'meetup_message') db.prepare(`UPDATE meetup_messages SET removed_at = NULL WHERE id = ?`).run(Number(id) || 0);
      if (type === 'message') db.prepare(`UPDATE conversation_messages SET removed_at = NULL WHERE id = ?`).run(Number(id) || 0);
    }
    if (action === 'ban' && owner) {
      db.prepare(`UPDATE customers SET community_banned_at = datetime('now') WHERE id = ?`).run(owner);
      db.prepare(`UPDATE meetups SET status = 'removed', status_note = ? WHERE host_id = ? AND status = 'open'`).run(note, owner);
      db.prepare(`UPDATE help_posts SET status = 'removed', status_note = ? WHERE author_id = ? AND status = 'open'`).run(note, owner);
      db.prepare(`UPDATE talent_profiles SET status = 'removed', status_note = ? WHERE owner_id = ? AND status = 'live'`).run(note, owner);
    }
    const status = action === 'dismiss' || action === 'restore' ? 'dismissed' : 'actioned';
    const changed = db
      .prepare(`UPDATE community_reports SET status = ?, handled_at = datetime('now') WHERE target_type = ? AND target_id = ? AND status = 'open'`)
      .run(status, type, id).changes;
    return changed > 0 || action === 'restore';
  })();
}

/** Lift a ban (admin). Their removed posts stay removed; they may post again. */
export function unbanMember(handle: string): boolean {
  return getDb().prepare(`UPDATE customers SET community_banned_at = NULL WHERE community_handle = ?`).run(handle).changes > 0;
}

/** Counts for the admin dashboard's community card. */
export function communityCounts(): { members: number; openReports: number; meetups: number; helpPosts: number; profiles: number } {
  const db = getDb();
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    members: one(`SELECT COUNT(*) AS n FROM customers WHERE community_joined_at IS NOT NULL AND community_banned_at IS NULL`),
    openReports: one(`SELECT COUNT(DISTINCT target_type || ':' || target_id) AS n FROM community_reports WHERE status = 'open'`),
    meetups: one(`SELECT COUNT(*) AS n FROM meetups WHERE status = 'open'`),
    helpPosts: one(`SELECT COUNT(*) AS n FROM help_posts WHERE status = 'open'`),
    profiles: one(`SELECT COUNT(*) AS n FROM talent_profiles WHERE status = 'live'`),
  };
}
