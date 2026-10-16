// Server-only: Bhetghat (भेटघाट, "a get-together") — small, free meetups and
// invitations any community member can start: karaoke night, laser tag,
// Sunday futsal, a momo night, a hike, "new in Darmstadt, coffee?".
//
// Members only, all of it: a meetup, who is going and its group chat are seen
// by signed-in members and nobody else, and never by search engines. Free by
// construction — there is no price field, and no money code reads any of this
// (the platform stays free; see the student-permit note in PLATFORM.md). A
// host may write what it costs ("€12 each, pay at the venue"); people pay the
// venue themselves.
//
// Three ways in, chosen by the host:
//   open     — in the deck; tap "I'm in" and you are going.
//   ask      — in the deck; tapping sends a request, the host says yes or no.
//   private  — never listed; only someone holding the invite link can open
//              it, and opening the link is the invitation.
// Who is going is shown only to people who are going (and the host): someone
// who has merely asked sees how many, never who.
//
// Times are wall-clock time in Germany, 'YYYY-MM-DDTHH:MM', like the kitchen
// slots: a meetup "at 18:00" means 18:00 where it happens, whatever the server
// clock says.
import crypto from 'crypto';
import { cityKey, cityName } from './cities';
import { addDays, berlinNow, blockedBetween, cleanLine, cleanText, notBlockedSql, type Member } from './community';
import { getDb } from './db';

export const MEETUP_CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: 'nightout', label: 'Karaoke, games & nights out', emoji: '🎤' },
  { key: 'food', label: 'Food & momo', emoji: '🥟' },
  { key: 'sports', label: 'Futsal & sports', emoji: '⚽' },
  { key: 'outdoors', label: 'Hiking & outdoors', emoji: '🥾' },
  { key: 'culture', label: 'Music, dance & culture', emoji: '🎶' },
  { key: 'festival', label: 'Festival together', emoji: '🪔' },
  { key: 'study', label: 'Study & career', emoji: '📚' },
  { key: 'newcomers', label: 'New in town', emoji: '👋' },
  { key: 'family', label: 'Kids & family', emoji: '🧒' },
  { key: 'other', label: 'Something else', emoji: '✨' },
];

export function meetupCategory(key: string): { key: string; label: string; emoji: string } {
  return MEETUP_CATEGORIES.find((c) => c.key === key) ?? MEETUP_CATEGORIES[MEETUP_CATEGORIES.length - 1];
}

/** One-tap starting points for the form: a title, a kind and a sensible minimum. */
export const MEETUP_IDEAS: { emoji: string; title: string; category: string; min: number; about: string }[] = [
  { emoji: '🎤', title: 'Karaoke night', category: 'nightout', min: 6, about: 'Nepali, Hindi and English songs. We book a room for two hours and split it.' },
  { emoji: '🎯', title: 'Laser tag', category: 'nightout', min: 6, about: 'Two teams, a few rounds, dinner after if people want.' },
  { emoji: '🎳', title: 'Bowling', category: 'nightout', min: 4, about: 'A lane or two, everyone welcome — no skill needed.' },
  { emoji: '⚽', title: 'Sunday futsal', category: 'sports', min: 10, about: 'Friendly game, all levels. We split into teams there.' },
  { emoji: '🏏', title: 'Cricket in the park', category: 'sports', min: 10, about: 'Tape ball, bring a bat if you have one.' },
  { emoji: '🎬', title: 'Nepali movie night', category: 'nightout', min: 4, about: 'A new Nepali film together — snacks welcome.' },
  { emoji: '🥟', title: 'Momo making together', category: 'food', min: 4, about: 'We make and eat momo together. Bring a filling idea!' },
  { emoji: '🎲', title: 'Board games & chiya', category: 'nightout', min: 4, about: 'Carrom, cards, Ludo and plenty of tea.' },
  { emoji: '🥾', title: 'Hike + tea', category: 'outdoors', min: 3, about: 'An easy walk, then tea. Good shoes and water.' },
  { emoji: '🧺', title: 'Picnic in the park', category: 'outdoors', min: 4, about: 'Everyone brings something to share.' },
  { emoji: '💃', title: 'Teej dance practice', category: 'culture', min: 4, about: 'Practising for the programme — all levels.' },
  { emoji: '🗣️', title: 'Nepali ↔ German language exchange', category: 'study', min: 2, about: 'Half the time in German, half in Nepali.' },
  { emoji: '👋', title: 'New in town — coffee?', category: 'newcomers', min: 2, about: 'Just arrived? Meet a few people who have been here a while.' },
];

export type JoinMode = 'open' | 'ask' | 'private';
export const JOIN_MODES: JoinMode[] = ['open', 'ask', 'private'];

/** How far ahead a meetup can be planned. */
export const MEETUP_MAX_DAYS_AHEAD = 180;
/** A member can start this many meetups in a day — enough for anyone real. */
export const MEETUPS_PER_DAY = 5;
/** Shown in the deck until this long after it started (people arrive late). */
const STILL_ON_MIN = 120;
export const MEETUP_MESSAGE_MAX = 1000;

export interface MeetupInput {
  title: string;
  about: string;
  category: string;
  city: string;
  place: string;
  date: string;
  time: string;
  capacity: number;
  joinMode: JoinMode;
  minPeople: number;
  costNote: string;
}

export type MeetupCheck = { ok: true; value: MeetupInput } | { ok: false; error: string };

export function checkMeetupInput(raw: Record<string, unknown>, now: string = berlinNow()): MeetupCheck {
  const title = cleanLine(raw.title, 80);
  if (title.length < 4) return { ok: false, error: 'Give it a short name — what are you doing?' };
  const about = cleanText(raw.about, 1000);
  const category = typeof raw.category === 'string' && MEETUP_CATEGORIES.some((c) => c.key === raw.category) ? raw.category : 'other';
  const city = cityName(cleanLine(raw.city, 60));
  if (!city) return { ok: false, error: 'Which town is it in?' };
  const place = cleanLine(raw.place, 120);
  if (place.length < 3) return { ok: false, error: 'Where exactly? A café, a park, a hall — somewhere public.' };
  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : '';
  const time = typeof raw.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time) ? raw.time : '';
  if (!date || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) return { ok: false, error: 'Pick the day.' };
  if (!time) return { ok: false, error: 'Pick the time.' };
  const startsAt = `${date}T${time}`;
  if (startsAt < now) return { ok: false, error: 'That time has already passed.' };
  if (date > addDays(now, MEETUP_MAX_DAYS_AHEAD)) return { ok: false, error: 'Plan at most six months ahead.' };
  const cap = Number(raw.capacity);
  const capacity = Number.isFinite(cap) && cap >= 2 ? Math.min(200, Math.floor(cap)) : 0;
  const joinMode: JoinMode = JOIN_MODES.includes(raw.joinMode as JoinMode) ? (raw.joinMode as JoinMode) : 'open';
  const min = Number(raw.minPeople);
  const minPeople = Number.isFinite(min) && min >= 2 ? Math.min(200, Math.floor(min)) : 0;
  if (capacity && minPeople > capacity) return { ok: false, error: 'The minimum cannot be more than the limit.' };
  const costNote = cleanLine(raw.costNote, 80);
  return { ok: true, value: { title, about, category, city, place, date, time, capacity, joinMode, minPeople, costNote } };
}

export interface MeetupCard {
  id: string;
  title: string;
  about: string;
  category: string;
  city: string;
  place: string;
  startsAt: string;
  capacity: number;
  going: number;
  hostName: string;
  joined: boolean;
  requested: boolean;
  isHost: boolean;
  joinMode: JoinMode;
  minPeople: number;
  costNote: string;
}

interface MeetupRow {
  id: string;
  host_id: string;
  title: string;
  about: string;
  category: string;
  city: string;
  place: string;
  starts_at: string;
  capacity: number;
  status: string;
  status_note: string;
  join_mode: JoinMode;
  invite_code: string | null;
  min_people: number;
  cost_note: string;
}

/** A row on the list that counts: going, and not taken off. */
const IS_GOING = `status = 'going' AND removed_at IS NULL`;
const GOING_SQL = `(SELECT COUNT(*) FROM meetup_members mm WHERE mm.meetup_id = m.id AND mm.status = 'going' AND mm.removed_at IS NULL)`;

function cutoff(now: string = berlinNow()): string {
  const d = new Date(`${now}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() - STILL_ON_MIN);
  return d.toISOString().slice(0, 16);
}

function goingCount(id: string): number {
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM meetup_members WHERE meetup_id = ? AND ${IS_GOING}`).get(id) as { n: number }).n;
}

type CardRow = MeetupRow & { going: number; host_name: string; joined: number; requested: number };

function toCard(r: CardRow, viewerId: string): MeetupCard {
  return {
    id: r.id,
    title: r.title,
    about: r.about,
    category: r.category,
    city: r.city,
    place: r.place,
    startsAt: r.starts_at,
    capacity: r.capacity,
    going: r.going,
    hostName: r.host_name,
    joined: Boolean(r.joined),
    requested: Boolean(r.requested),
    isHost: r.host_id === viewerId,
    joinMode: r.join_mode,
    minPeople: r.min_people,
    costNote: r.cost_note,
  };
}

/**
 * Open and ask-to-join meetups from now on, soonest first, for one member's
 * deck and the "What's on" list: never a private one, never one whose host
 * they have blocked (or who blocked them), never one they were taken off or
 * turned down for. Their own, the ones they joined and the ones they asked
 * for are included and flagged — the deck skips them, "My plans" lists them.
 */
export function listUpcomingMeetups(viewer: Member, limit = 200): MeetupCard[] {
  const rows = getDb()
    .prepare(
      `SELECT m.*, ${GOING_SQL} AS going, h.community_name AS host_name,
              EXISTS (SELECT 1 FROM meetup_members x WHERE x.meetup_id = m.id AND x.customer_id = ? AND x.status = 'going' AND x.removed_at IS NULL) AS joined,
              EXISTS (SELECT 1 FROM meetup_members x WHERE x.meetup_id = m.id AND x.customer_id = ? AND x.status = 'requested' AND x.removed_at IS NULL) AS requested
       FROM meetups m JOIN customers h ON h.id = m.host_id
       WHERE m.status = 'open' AND m.starts_at >= ? AND m.join_mode IN ('open', 'ask')
         AND h.community_banned_at IS NULL
         AND ${notBlockedSql('m.host_id')}
         AND NOT EXISTS (SELECT 1 FROM meetup_members r WHERE r.meetup_id = m.id AND r.customer_id = ? AND r.removed_at IS NOT NULL)
       ORDER BY m.starts_at ASC LIMIT ?`
    )
    .all(viewer.id, viewer.id, cutoff(), viewer.id, viewer.id, viewer.id, limit) as CardRow[];
  return rows.map((r) => toCard(r, viewer.id));
}

/** Listed meetups from now on — the signed-out teaser counts these, nothing more. */
export function upcomingMeetupCount(): number {
  return (
    getDb()
      .prepare(`SELECT COUNT(*) AS n FROM meetups WHERE status = 'open' AND join_mode <> 'private' AND starts_at >= ?`)
      .get(cutoff()) as { n: number }
  ).n;
}

export function upcomingMeetupCountIn(city: string): number {
  const key = cityKey(city);
  const rows = getDb()
    .prepare(`SELECT city FROM meetups WHERE status = 'open' AND join_mode <> 'private' AND starts_at >= ?`)
    .all(cutoff()) as { city: string }[];
  return rows.filter((r) => cityKey(r.city) === key).length;
}

function meetupsStartedToday(hostId: string): number {
  return (
    getDb()
      .prepare(`SELECT COUNT(*) AS n FROM meetups WHERE host_id = ? AND created_at >= datetime('now', '-1 day')`)
      .get(hostId) as { n: number }
  ).n;
}

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

function newInviteCode(): string {
  return crypto.randomBytes(9).toString('base64url');
}

export function createMeetup(host: Member, raw: Record<string, unknown>): CreateResult {
  const checked = checkMeetupInput(raw);
  if (!checked.ok) return checked;
  if (meetupsStartedToday(host.id) >= MEETUPS_PER_DAY) return { ok: false, error: 'That is a lot of meetups for one day — try again tomorrow.' };
  const v = checked.value;
  const id = crypto.randomBytes(9).toString('base64url');
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO meetups (id, host_id, title, about, category, city, place, starts_at, capacity, join_mode, invite_code, min_people, cost_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, host.id, v.title, v.about, v.category, v.city, v.place, `${v.date}T${v.time}`, v.capacity, v.joinMode, newInviteCode(), v.minPeople, v.costNote);
    // The host is the first one going.
    db.prepare(`INSERT INTO meetup_members (meetup_id, customer_id, status) VALUES (?, ?, 'going')`).run(id, host.id);
  })();
  return { ok: true, id };
}

function getRow(id: string): MeetupRow | null {
  if (typeof id !== 'string' || id.length > 40) return null;
  return (getDb().prepare(`SELECT * FROM meetups WHERE id = ?`).get(id) as MeetupRow | undefined) ?? null;
}

export function updateMeetup(host: Member, id: string, raw: Record<string, unknown>): CreateResult {
  const row = getRow(id);
  if (!row || row.host_id !== host.id) return { ok: false, error: 'Only the host can change this meetup.' };
  if (row.status !== 'open') return { ok: false, error: 'This meetup is no longer open.' };
  const checked = checkMeetupInput(raw);
  if (!checked.ok) return checked;
  const v = checked.value;
  const going = goingCount(id);
  if (v.capacity && v.capacity < going) return { ok: false, error: `${going} people are already going — the limit cannot be lower than that.` };
  getDb()
    .prepare(
      `UPDATE meetups SET title = ?, about = ?, category = ?, city = ?, place = ?, starts_at = ?, capacity = ?,
         join_mode = ?, min_people = ?, cost_note = ?, invite_code = COALESCE(invite_code, ?), updated_at = datetime('now') WHERE id = ?`
    )
    .run(v.title, v.about, v.category, v.city, v.place, `${v.date}T${v.time}`, v.capacity, v.joinMode, v.minPeople, v.costNote, newInviteCode(), id);
  return { ok: true, id };
}

export function cancelMeetup(host: Member, id: string): boolean {
  const row = getRow(id);
  if (!row || row.host_id !== host.id || row.status !== 'open') return false;
  getDb().prepare(`UPDATE meetups SET status = 'cancelled', status_note = 'Cancelled by the host', updated_at = datetime('now') WHERE id = ?`).run(id);
  return true;
}

/** A new invite link: the old one stops working (for a link forwarded too far). */
export function resetInviteCode(host: Member, id: string): boolean {
  const row = getRow(id);
  if (!row || row.host_id !== host.id) return false;
  getDb().prepare(`UPDATE meetups SET invite_code = ? WHERE id = ?`).run(newInviteCode(), id);
  return true;
}

function codeMatches(row: MeetupRow, code: unknown): boolean {
  if (typeof code !== 'string' || !row.invite_code || code.length !== row.invite_code.length) return false;
  return crypto.timingSafeEqual(Buffer.from(code), Buffer.from(row.invite_code));
}

export type JoinOutcome = 'ok' | 'already' | 'requested' | 'pending' | 'full' | 'past' | 'closed' | 'removed' | 'blocked' | 'not-found';

export const JOIN_MESSAGES: Record<Exclude<JoinOutcome, 'ok' | 'already' | 'requested' | 'pending'>, string> = {
  full: 'This meetup is full.',
  past: 'This meetup has already happened.',
  closed: 'This meetup was cancelled.',
  removed: 'You cannot join this meetup.',
  blocked: 'You cannot join this meetup.',
  'not-found': 'This meetup is no longer there.',
};

/**
 * "I'm in". An open meetup: you are going (if there is room). An ask-to-join
 * one: a request goes to the host. A private one: only with its invite code —
 * the link IS the invitation, so it lets you straight in.
 */
export function joinMeetup(member: Member, id: string, code?: unknown): JoinOutcome {
  const db = getDb();
  return db.transaction((): JoinOutcome => {
    const row = getRow(id);
    if (!row || row.status === 'removed') return 'not-found';
    const mine = db.prepare(`SELECT status, removed_at FROM meetup_members WHERE meetup_id = ? AND customer_id = ?`).get(id, member.id) as
      | { status: string; removed_at: string | null }
      | undefined;
    if (row.join_mode === 'private' && !mine && !codeMatches(row, code)) return 'not-found';
    if (row.status !== 'open') return 'closed';
    if (row.starts_at < cutoff()) return 'past';
    if (mine?.removed_at) return 'removed';
    if (mine?.status === 'going') return 'already';
    if (mine?.status === 'requested') return 'pending';
    if (blockedBetween(member.id, row.host_id)) return 'blocked';
    if (row.join_mode === 'ask') {
      db.prepare(`INSERT INTO meetup_members (meetup_id, customer_id, status) VALUES (?, ?, 'requested')`).run(id, member.id);
      return 'requested';
    }
    if (row.capacity > 0 && goingCount(id) >= row.capacity) return 'full';
    db.prepare(`INSERT INTO meetup_members (meetup_id, customer_id, status) VALUES (?, ?, 'going')`).run(id, member.id);
    return 'ok';
  })();
}

/** Leave a meetup, or take back a request. The host cannot leave their own — they cancel it. */
export function leaveMeetup(member: Member, id: string): boolean {
  const row = getRow(id);
  if (!row || row.host_id === member.id) return false;
  return getDb().prepare(`DELETE FROM meetup_members WHERE meetup_id = ? AND customer_id = ? AND removed_at IS NULL`).run(id, member.id).changes > 0;
}

function memberIdByHandle(handle: string): string | null {
  const r = getDb().prepare(`SELECT id FROM customers WHERE community_handle = ?`).get(handle) as { id: string } | undefined;
  return r?.id ?? null;
}

/** The host takes someone off (or turns a request down); they cannot come back. */
export function removeFromMeetup(host: Member, id: string, handle: string): boolean {
  const row = getRow(id);
  if (!row || row.host_id !== host.id) return false;
  const target = memberIdByHandle(handle);
  if (!target || target === host.id) return false;
  return (
    getDb()
      .prepare(`UPDATE meetup_members SET removed_at = datetime('now') WHERE meetup_id = ? AND customer_id = ? AND removed_at IS NULL`)
      .run(id, target).changes > 0
  );
}

export type ApproveOutcome = 'ok' | 'full' | 'not-found';

/** The host says yes to a request — if there is still room. */
export function approveRequest(host: Member, id: string, handle: string): ApproveOutcome {
  const db = getDb();
  return db.transaction((): ApproveOutcome => {
    const row = getRow(id);
    if (!row || row.host_id !== host.id || row.status !== 'open') return 'not-found';
    const target = memberIdByHandle(handle);
    if (!target) return 'not-found';
    if (row.capacity > 0 && goingCount(id) >= row.capacity) return 'full';
    const changed = db
      .prepare(`UPDATE meetup_members SET status = 'going', joined_at = datetime('now') WHERE meetup_id = ? AND customer_id = ? AND status = 'requested' AND removed_at IS NULL`)
      .run(id, target).changes;
    return changed ? 'ok' : 'not-found';
  })();
}

export interface Person {
  handle: string;
  name: string;
  isHost: boolean;
  isMe: boolean;
}

export interface MeetupDetail extends MeetupCard {
  status: string;
  statusNote: string;
  hostHandle: string;
  past: boolean;
  removedMe: boolean;
  /** Who is going — empty unless the viewer is going or hosting. */
  people: Person[];
  /** Waiting for a yes — the host only. */
  requests: Person[];
  /** The invite link's secret — for the host, and for people going to a non-private meetup. */
  inviteCode: string | null;
}

/**
 * One meetup as a member sees it, or null when they may not: blocked, gone,
 * or a private meetup they were not invited to (no row, no valid code).
 */
export function getMeetupForMember(viewer: Member, id: string, code?: unknown): MeetupDetail | null {
  const db = getDb();
  const row = getRow(id);
  if (!row) return null;
  const isHost = row.host_id === viewer.id;
  if (row.status === 'removed' && !isHost) return null;
  if (!isHost && blockedBetween(viewer.id, row.host_id)) return null;
  const mine = db.prepare(`SELECT status, removed_at FROM meetup_members WHERE meetup_id = ? AND customer_id = ?`).get(id, viewer.id) as
    | { status: string; removed_at: string | null }
    | undefined;
  if (row.join_mode === 'private' && !isHost && !mine && !codeMatches(row, code)) return null;
  const host = db.prepare(`SELECT community_name AS name, community_handle AS handle FROM customers WHERE id = ?`).get(row.host_id) as
    | { name: string; handle: string | null }
    | undefined;
  const going = !!mine && !mine.removed_at && mine.status === 'going';
  const requested = !!mine && !mine.removed_at && mine.status === 'requested';
  const list = (status: string) =>
    (
      db
        .prepare(
          `SELECT c.id, c.community_handle AS handle, c.community_name AS name
           FROM meetup_members mm JOIN customers c ON c.id = mm.customer_id
           WHERE mm.meetup_id = ? AND mm.status = ? AND mm.removed_at IS NULL AND c.community_handle IS NOT NULL
             AND ${notBlockedSql('c.id')}
           ORDER BY mm.joined_at ASC`
        )
        .all(id, status, viewer.id, viewer.id) as { id: string; handle: string; name: string }[]
    ).map((p) => ({ handle: p.handle, name: p.name, isHost: p.id === row.host_id, isMe: p.id === viewer.id }));
  return {
    ...toCard({ ...row, going: goingCount(id), host_name: host?.name ?? 'a member', joined: going ? 1 : 0, requested: requested ? 1 : 0 }, viewer.id),
    status: row.status,
    statusNote: row.status_note,
    hostHandle: host?.handle ?? '',
    past: row.starts_at < cutoff(),
    removedMe: Boolean(mine?.removed_at),
    people: isHost || going ? list('going') : [],
    requests: isHost ? list('requested') : [],
    inviteCode: isHost || (going && row.join_mode !== 'private') ? row.invite_code : null,
  };
}

/** The meetup's fields as the edit form wants them. Host only. */
export function meetupForEdit(host: Member, id: string): (MeetupInput & { id: string }) | null {
  const row = getRow(id);
  if (!row || row.host_id !== host.id || row.status !== 'open') return null;
  return {
    id: row.id,
    title: row.title,
    about: row.about,
    category: row.category,
    city: row.city,
    place: row.place,
    date: row.starts_at.slice(0, 10),
    time: row.starts_at.slice(11, 16),
    capacity: row.capacity,
    joinMode: row.join_mode,
    minPeople: row.min_people,
    costNote: row.cost_note,
  };
}

/** Requests waiting on the host's own meetups — for the inbox. */
export function pendingRequestsFor(host: Member): { meetupId: string; title: string; name: string }[] {
  return getDb()
    .prepare(
      `SELECT m.id AS meetupId, m.title, c.community_name AS name
       FROM meetup_members mm JOIN meetups m ON m.id = mm.meetup_id JOIN customers c ON c.id = mm.customer_id
       WHERE m.host_id = ? AND m.status = 'open' AND m.starts_at >= ? AND mm.status = 'requested' AND mm.removed_at IS NULL
       ORDER BY mm.joined_at ASC`
    )
    .all(host.id, cutoff()) as { meetupId: string; title: string; name: string }[];
}

// ---------------------------------------------------------------------------
// The group chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: number;
  body: string;
  createdAt: string;
  name: string;
  handle: string;
  mine: boolean;
  host: boolean;
}

function canChat(viewer: Member, id: string): MeetupRow | null {
  const row = getRow(id);
  if (!row || row.status === 'removed') return null;
  const mine = getDb()
    .prepare(`SELECT 1 FROM meetup_members WHERE meetup_id = ? AND customer_id = ? AND ${IS_GOING}`)
    .get(id, viewer.id);
  return mine ? row : null;
}

/**
 * Messages after `afterId` (all of them on first load, newest 200), for
 * people going only. Messages from anyone the viewer blocked — or who
 * blocked them — are left out. Marks what was returned as read.
 */
export function listMeetupMessages(viewer: Member, id: string, afterId = 0): ChatMessage[] | null {
  const row = canChat(viewer, id);
  if (!row) return null;
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT mm.id, mm.body, mm.created_at AS createdAt, c.community_name AS name, c.community_handle AS handle, mm.customer_id AS cid
         FROM meetup_messages mm JOIN customers c ON c.id = mm.customer_id
         WHERE mm.meetup_id = ? AND mm.id > ? AND mm.removed_at IS NULL AND ${notBlockedSql('mm.customer_id')}
         ORDER BY mm.id DESC LIMIT 200
       ) ORDER BY id ASC`
    )
    .all(id, afterId, viewer.id, viewer.id) as { id: number; body: string; createdAt: string; name: string; handle: string | null; cid: string }[];
  if (rows.length) {
    db.prepare(`UPDATE meetup_members SET last_read_id = MAX(last_read_id, ?) WHERE meetup_id = ? AND customer_id = ?`).run(
      rows[rows.length - 1].id,
      id,
      viewer.id
    );
  }
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt,
    name: r.name || 'a member',
    handle: r.handle ?? '',
    mine: r.cid === viewer.id,
    host: r.cid === row.host_id,
  }));
}

export type PostResult = { ok: true; message: ChatMessage } | { ok: false; error: string };

export function postMeetupMessage(viewer: Member, id: string, raw: unknown): PostResult {
  const row = canChat(viewer, id);
  if (!row) return { ok: false, error: 'Join the meetup to write in its chat.' };
  // After the day the chat stays open for the thank-yous and the photos; only
  // a cancelled meetup's chat closes.
  if (row.status === 'cancelled') return { ok: false, error: 'This meetup was cancelled.' };
  const body = cleanText(raw, MEETUP_MESSAGE_MAX);
  if (!body) return { ok: false, error: 'Write something first.' };
  const info = getDb().prepare(`INSERT INTO meetup_messages (meetup_id, customer_id, body) VALUES (?, ?, ?)`).run(id, viewer.id, body);
  const msgId = Number(info.lastInsertRowid);
  getDb().prepare(`UPDATE meetup_members SET last_read_id = ? WHERE meetup_id = ? AND customer_id = ?`).run(msgId, id, viewer.id);
  return {
    ok: true,
    message: { id: msgId, body, createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '), name: viewer.name, handle: viewer.handle, mine: true, host: row.host_id === viewer.id },
  };
}

/** A member deletes their own message. */
export function deleteMeetupMessage(viewer: Member, messageId: number): boolean {
  return (
    getDb()
      .prepare(`UPDATE meetup_messages SET removed_at = datetime('now') WHERE id = ? AND customer_id = ? AND removed_at IS NULL`)
      .run(messageId, viewer.id).changes > 0
  );
}

// ---------------------------------------------------------------------------
// My plans
// ---------------------------------------------------------------------------

export interface MyMeetup extends MeetupCard {
  status: string;
  unread: number;
}

/** Meetups the member hosts, joined or asked to join: upcoming, plus the last week's, for the thank-yous. */
export function myMeetups(viewer: Member): MyMeetup[] {
  const since = addDays(berlinNow(), -7);
  const rows = getDb()
    .prepare(
      `SELECT m.*, ${GOING_SQL} AS going, h.community_name AS host_name,
              me.status = 'going' AS joined, me.status = 'requested' AS requested,
              CASE WHEN me.status = 'going' THEN
                (SELECT COUNT(*) FROM meetup_messages x WHERE x.meetup_id = m.id AND x.id > me.last_read_id
                   AND x.removed_at IS NULL AND x.customer_id <> ?) ELSE 0 END AS unread
       FROM meetup_members me JOIN meetups m ON m.id = me.meetup_id JOIN customers h ON h.id = m.host_id
       WHERE me.customer_id = ? AND me.removed_at IS NULL AND m.status <> 'removed' AND m.starts_at >= ?
       ORDER BY m.starts_at ASC`
    )
    .all(viewer.id, viewer.id, since) as (CardRow & { unread: number })[];
  return rows.map((r) => ({ ...toCard(r, viewer.id), status: r.status, unread: r.unread }));
}

/** Unread group-chat messages across a member's meetups, plus requests waiting on their own — for the badge. */
export function unreadMeetupMessages(viewer: Member): number {
  const unread = (
    getDb()
      .prepare(
        `SELECT COUNT(*) AS n FROM meetup_members me JOIN meetup_messages x ON x.meetup_id = me.meetup_id
         WHERE me.customer_id = ? AND me.status = 'going' AND me.removed_at IS NULL AND x.id > me.last_read_id
           AND x.removed_at IS NULL AND x.customer_id <> ?`
      )
      .get(viewer.id, viewer.id) as { n: number }
  ).n;
  return unread + pendingRequestsFor(viewer).length;
}
