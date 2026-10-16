// Server-only: one-to-one conversations between members — always ABOUT
// something: a Sahayog help post ("I have a room", "flying to Kathmandu on
// the 20th") or a Kalakar profile ("are you free to sing on 14 Nov?").
//
// Tying every conversation to a post or a profile is deliberate: there is no
// way to message a stranger out of the blue, only to answer what they put up
// themselves. One conversation per (topic, person writing), so answering the
// same post twice continues the same thread.
//
// No phone numbers or emails are exchanged by the site; people can share them
// in a message once they trust each other, which the rules advise them to do
// carefully.
import crypto from 'crypto';
import { blockedBetween, cleanText, type Member } from './community';
import { getDb } from './db';

export type Topic = 'help' | 'talent';
export const MESSAGE_MAX = 1500;

interface ConversationRow {
  id: string;
  topic_type: Topic;
  topic_id: string;
  owner_id: string;
  other_id: string;
  owner_read_id: number;
  other_read_id: number;
  last_message_at: string;
}

/** Who owns a topic, its title and its page — or null when it is gone or closed to new conversations. */
function topicInfo(topic: Topic, topicId: string, forNew: boolean): { owner: string; title: string; href: string } | null {
  const db = getDb();
  if (topic === 'help') {
    const r = db.prepare(`SELECT author_id, title, status FROM help_posts WHERE id = ?`).get(topicId) as
      | { author_id: string; title: string; status: string }
      | undefined;
    if (!r || r.status === 'removed' || (forNew && r.status !== 'open')) return null;
    return { owner: r.author_id, title: r.title, href: `/sahayog/p/${topicId}` };
  }
  const r = db.prepare(`SELECT owner_id, name, slug, status FROM talent_profiles WHERE id = ?`).get(topicId) as
    | { owner_id: string; name: string; slug: string; status: string }
    | undefined;
  if (!r || r.status === 'removed' || (forNew && r.status !== 'live')) return null;
  return { owner: r.owner_id, title: r.name, href: `/kalakar/${r.slug}` };
}

export type StartResult = { ok: true; id: string } | { ok: false; error: string };

/** Open (or reopen) the viewer's conversation about a post or a profile. */
export function startConversation(viewer: Member, topic: unknown, topicId: unknown): StartResult {
  if (topic !== 'help' && topic !== 'talent') return { ok: false, error: 'Unknown topic.' };
  if (typeof topicId !== 'string' || topicId.length > 40) return { ok: false, error: 'Unknown topic.' };
  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM conversations WHERE topic_type = ? AND topic_id = ? AND other_id = ?`)
    .get(topic, topicId, viewer.id) as { id: string } | undefined;
  if (existing) return { ok: true, id: existing.id };
  const info = topicInfo(topic, topicId, true);
  if (!info) return { ok: false, error: 'This is no longer open.' };
  if (info.owner === viewer.id) return { ok: false, error: 'This is your own.' };
  if (blockedBetween(viewer.id, info.owner)) return { ok: false, error: 'You cannot write to this member.' };
  const id = crypto.randomBytes(9).toString('base64url');
  db.prepare(`INSERT INTO conversations (id, topic_type, topic_id, owner_id, other_id) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    topic,
    topicId,
    info.owner,
    viewer.id
  );
  return { ok: true, id };
}

function getRow(id: string): ConversationRow | null {
  if (typeof id !== 'string' || id.length > 40) return null;
  return (getDb().prepare(`SELECT * FROM conversations WHERE id = ?`).get(id) as ConversationRow | undefined) ?? null;
}

function side(row: ConversationRow, viewerId: string): 'owner' | 'other' | null {
  return row.owner_id === viewerId ? 'owner' : row.other_id === viewerId ? 'other' : null;
}

export interface ConvMessage {
  id: number;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface ConversationView {
  id: string;
  topicType: Topic;
  topicId: string;
  topicTitle: string;
  topicHref: string | null;
  otherName: string;
  otherHandle: string;
  iAmOwner: boolean;
  blocked: boolean;
  messages: ConvMessage[];
}

function messagesAfter(row: ConversationRow, viewerId: string, afterId: number): ConvMessage[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT id, body, created_at AS createdAt, sender_id FROM conversation_messages
         WHERE conversation_id = ? AND id > ? AND removed_at IS NULL ORDER BY id DESC LIMIT 300
       ) ORDER BY id ASC`
    )
    .all(row.id, afterId) as { id: number; body: string; createdAt: string; sender_id: string }[];
  if (rows.length) {
    const col = side(row, viewerId) === 'owner' ? 'owner_read_id' : 'other_read_id';
    db.prepare(`UPDATE conversations SET ${col} = MAX(${col}, ?) WHERE id = ?`).run(rows[rows.length - 1].id, row.id);
  }
  return rows.map((r) => ({ id: r.id, body: r.body, createdAt: r.createdAt, mine: r.sender_id === viewerId }));
}

/** A conversation as one of its two people sees it (marks it read). */
export function getConversation(viewer: Member, id: string): ConversationView | null {
  const row = getRow(id);
  if (!row) return null;
  const s = side(row, viewer.id);
  if (!s) return null;
  const otherId = s === 'owner' ? row.other_id : row.owner_id;
  const other = getDb().prepare(`SELECT community_name AS name, community_handle AS handle FROM customers WHERE id = ?`).get(otherId) as
    | { name: string; handle: string | null }
    | undefined;
  const info = topicInfo(row.topic_type, row.topic_id, false);
  return {
    id: row.id,
    topicType: row.topic_type,
    topicId: row.topic_id,
    topicTitle: info?.title ?? '(no longer there)',
    topicHref: info?.href ?? null,
    otherName: other?.name || 'a member',
    otherHandle: other?.handle ?? '',
    iAmOwner: s === 'owner',
    blocked: blockedBetween(viewer.id, otherId),
    messages: messagesAfter(row, viewer.id, 0),
  };
}

export function listConversationMessages(viewer: Member, id: string, afterId: number): ConvMessage[] | null {
  const row = getRow(id);
  if (!row || !side(row, viewer.id)) return null;
  return messagesAfter(row, viewer.id, afterId);
}

export type SendResult = { ok: true; message: ConvMessage } | { ok: false; error: string };

export function sendConversationMessage(viewer: Member, id: string, raw: unknown): SendResult {
  const row = getRow(id);
  const s = row ? side(row, viewer.id) : null;
  if (!row || !s) return { ok: false, error: 'Conversation not found.' };
  const otherId = s === 'owner' ? row.other_id : row.owner_id;
  if (blockedBetween(viewer.id, otherId)) return { ok: false, error: 'You cannot write to this member.' };
  if (!topicInfo(row.topic_type, row.topic_id, false)) return { ok: false, error: 'This was taken down, so the conversation is closed.' };
  const body = cleanText(raw, MESSAGE_MAX);
  if (!body) return { ok: false, error: 'Write something first.' };
  const db = getDb();
  const info = db.prepare(`INSERT INTO conversation_messages (conversation_id, sender_id, body) VALUES (?, ?, ?)`).run(id, viewer.id, body);
  const msgId = Number(info.lastInsertRowid);
  const col = s === 'owner' ? 'owner_read_id' : 'other_read_id';
  db.prepare(`UPDATE conversations SET last_message_at = datetime('now'), ${col} = ? WHERE id = ?`).run(msgId, id);
  return { ok: true, message: { id: msgId, body, createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '), mine: true } };
}

export function deleteConversationMessage(viewer: Member, messageId: number): boolean {
  return (
    getDb()
      .prepare(`UPDATE conversation_messages SET removed_at = datetime('now') WHERE id = ? AND sender_id = ? AND removed_at IS NULL`)
      .run(messageId, viewer.id).changes > 0
  );
}

export interface ConversationSummary {
  id: string;
  topicType: Topic;
  topicTitle: string;
  otherName: string;
  lastBody: string;
  lastAt: string;
  unread: number;
}

/** Every conversation the member is in, latest first, with unread counts. Empty ones they did not start are left out. */
export function listConversations(viewer: Member): ConversationSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, oc.community_name AS other_name,
              (SELECT body FROM conversation_messages m WHERE m.conversation_id = c.id AND m.removed_at IS NULL ORDER BY m.id DESC LIMIT 1) AS last_body,
              (SELECT COUNT(*) FROM conversation_messages m WHERE m.conversation_id = c.id AND m.removed_at IS NULL AND m.sender_id <> ?
                 AND m.id > CASE WHEN c.owner_id = ? THEN c.owner_read_id ELSE c.other_read_id END) AS unread
       FROM conversations c
       LEFT JOIN customers oc ON oc.id = CASE WHEN c.owner_id = ? THEN c.other_id ELSE c.owner_id END
       WHERE c.owner_id = ? OR c.other_id = ?
       ORDER BY c.last_message_at DESC LIMIT 200`
    )
    .all(viewer.id, viewer.id, viewer.id, viewer.id, viewer.id) as (ConversationRow & { other_name: string | null; last_body: string | null; unread: number })[];
  return rows
    .filter((r) => r.last_body !== null || r.other_id === viewer.id)
    .map((r) => ({
      id: r.id,
      topicType: r.topic_type,
      topicTitle: topicInfo(r.topic_type, r.topic_id, false)?.title ?? '(no longer there)',
      otherName: r.other_name || 'a member',
      lastBody: r.last_body ?? '',
      lastAt: r.last_message_at,
      unread: r.unread,
    }));
}

export function unreadConversations(viewer: Member): number {
  return (
    getDb()
      .prepare(
        `SELECT COUNT(*) AS n FROM conversation_messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE (c.owner_id = ? OR c.other_id = ?) AND m.removed_at IS NULL AND m.sender_id <> ?
           AND m.id > CASE WHEN c.owner_id = ? THEN c.owner_read_id ELSE c.other_read_id END`
      )
      .get(viewer.id, viewer.id, viewer.id, viewer.id) as { n: number }
  ).n;
}

/** The conversations about one topic that its owner has (for "3 people wrote to you" on a post). */
export function conversationCountFor(topic: Topic, topicId: string): number {
  return (
    getDb()
      .prepare(
        `SELECT COUNT(*) AS n FROM conversations c WHERE c.topic_type = ? AND c.topic_id = ?
           AND EXISTS (SELECT 1 FROM conversation_messages m WHERE m.conversation_id = c.id)`
      )
      .get(topic, topicId) as { n: number }
  ).n;
}
