// Server-only: the community's data duties in one place — erase a member,
// export a member, and the retention sweep for everything people post.
//
// Kept apart from lib/community.ts on purpose: lib/customers.ts must call the
// erasure inside its own delete transaction, and lib/community.ts imports
// lib/customers.ts, so the erasure lives where it imports nothing but the
// database. Every function here takes the connection it runs on, so it joins
// whatever transaction the caller is in.
import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';

function talentDir(): string {
  return path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'talent');
}

/** Delete profile photos by file name. Never throws: a missing file is already gone. */
export function unlinkTalentPhotos(files: string[]): void {
  for (const f of files) {
    if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(f)) continue;
    try {
      fs.unlinkSync(path.join(talentDir(), f));
    } catch {
      /* already gone */
    }
  }
}

/** Reports whose target no longer exists have nothing left to judge. */
export function pruneOrphanReports(db: Database.Database): number {
  return db
    .prepare(
      `DELETE FROM community_reports WHERE
         (target_type = 'meetup' AND target_id NOT IN (SELECT id FROM meetups))
         OR (target_type = 'meetup_message' AND CAST(target_id AS INTEGER) NOT IN (SELECT id FROM meetup_messages))
         OR (target_type = 'help_post' AND target_id NOT IN (SELECT id FROM help_posts))
         OR (target_type = 'message' AND CAST(target_id AS INTEGER) NOT IN (SELECT id FROM conversation_messages))
         OR (target_type = 'talent' AND target_id NOT IN (SELECT id FROM talent_profiles))
         OR (target_type = 'member' AND target_id NOT IN
               (SELECT community_handle FROM customers WHERE community_handle IS NOT NULL))`
    )
    .run().changes;
}

/**
 * Every community row of one account, on the caller's connection (and so in
 * the caller's transaction). The person's meetups go with their group chats
 * — the host leaving ends the meetup — and every conversation they were in
 * goes whole, because half a conversation is still about them.
 *
 * Returns the profile-photo files to unlink once the transaction commits.
 */
export function eraseCommunityRows(db: Database.Database, customerId: string): { photos: string[]; rows: number } {
  const photos = (
    db.prepare(`SELECT photo FROM talent_profiles WHERE owner_id = ? AND photo <> ''`).all(customerId) as { photo: string }[]
  ).map((r) => r.photo);
  let rows = 0;
  const run = (sql: string, ...args: string[]) => {
    rows += db.prepare(sql).run(...args).changes;
  };
  const id = customerId;
  run(`DELETE FROM meetup_messages WHERE customer_id = ? OR meetup_id IN (SELECT id FROM meetups WHERE host_id = ?)`, id, id);
  run(`DELETE FROM meetup_members WHERE customer_id = ? OR meetup_id IN (SELECT id FROM meetups WHERE host_id = ?)`, id, id);
  run(`DELETE FROM meetups WHERE host_id = ?`, id);
  run(
    `DELETE FROM conversation_messages WHERE conversation_id IN
       (SELECT id FROM conversations WHERE owner_id = ? OR other_id = ?)`,
    id,
    id
  );
  run(`DELETE FROM conversations WHERE owner_id = ? OR other_id = ?`, id, id);
  run(`DELETE FROM help_posts WHERE author_id = ?`, id);
  run(`DELETE FROM talent_profiles WHERE owner_id = ?`, id);
  run(`DELETE FROM community_reports WHERE reporter_id = ?`, id);
  run(`DELETE FROM community_blocks WHERE blocker_id = ? OR blocked_id = ?`, id, id);
  rows += pruneOrphanReports(db);
  return { photos, rows };
}

export interface CommunityRetentionLimits {
  /** A meetup, its members and its chat: this many days after it took place. */
  meetupDays: number;
  /** A help post and its conversations: this many days after it left the board. */
  helpPostDays: number;
  /** Any conversation: this many days after its last message. */
  conversationDays: number;
  /** A report: this many days after it was handled. */
  reportDays: number;
}

export interface CommunityRetentionResult {
  orphans: number;
  meetups: number;
  helpPosts: number;
  conversations: number;
  reports: number;
}

/**
 * The community's half of the retention sweep (lib/retention.ts runs it as
 * one step and supplies the limits, which the privacy page quotes).
 *
 * First the orphans: an account deleted by the inactivity rule in
 * lib/retention.ts goes by plain SQL, without lib/customers' erasure, so its
 * community rows are swept here instead. Then the clocks.
 */
export function runCommunityRetention(db: Database.Database, limits: CommunityRetentionLimits): CommunityRetentionResult {
  const result: CommunityRetentionResult = { orphans: 0, meetups: 0, helpPosts: 0, conversations: 0, reports: 0 };
  let orphanPhotos: string[] = [];
  db.transaction(() => {
    const gone = `NOT IN (SELECT id FROM customers)`;
    orphanPhotos = (
      db.prepare(`SELECT photo FROM talent_profiles WHERE owner_id ${gone} AND photo <> ''`).all() as { photo: string }[]
    ).map((r) => r.photo);
    for (const sql of [
      `DELETE FROM meetup_messages WHERE customer_id ${gone} OR meetup_id IN (SELECT id FROM meetups WHERE host_id ${gone})`,
      `DELETE FROM meetup_members WHERE customer_id ${gone} OR meetup_id IN (SELECT id FROM meetups WHERE host_id ${gone})`,
      `DELETE FROM meetups WHERE host_id ${gone}`,
      `DELETE FROM conversation_messages WHERE conversation_id IN
         (SELECT id FROM conversations WHERE owner_id ${gone} OR other_id ${gone})`,
      `DELETE FROM conversations WHERE owner_id ${gone} OR other_id ${gone}`,
      `DELETE FROM help_posts WHERE author_id ${gone}`,
      `DELETE FROM talent_profiles WHERE owner_id ${gone}`,
      `DELETE FROM community_reports WHERE reporter_id ${gone}`,
      `DELETE FROM community_blocks WHERE blocker_id ${gone} OR blocked_id ${gone}`,
    ]) {
      result.orphans += db.prepare(sql).run().changes;
    }

    // Meetups: a month after the day itself — long enough to swap photos in
    // the chat afterwards, short enough that nobody's Saturday plans are kept.
    const oldMeetups = `SELECT id FROM meetups WHERE date(substr(starts_at, 1, 10)) <= date('now', '-${limits.meetupDays} days')`;
    db.prepare(`DELETE FROM meetup_messages WHERE meetup_id IN (${oldMeetups})`).run();
    db.prepare(`DELETE FROM meetup_members WHERE meetup_id IN (${oldMeetups})`).run();
    result.meetups = db.prepare(`DELETE FROM meetups WHERE id IN (${oldMeetups})`).run().changes;

    // Help posts: once off the board (expired or closed) for helpPostDays.
    const oldPosts = `SELECT id FROM help_posts WHERE
        date(expires_on) <= date('now', '-${limits.helpPostDays} days')
        OR (status <> 'open' AND date(updated_at) <= date('now', '-${limits.helpPostDays} days'))`;
    db.prepare(
      `DELETE FROM conversation_messages WHERE conversation_id IN
         (SELECT id FROM conversations WHERE topic_type = 'help' AND topic_id IN (${oldPosts}))`
    ).run();
    db.prepare(`DELETE FROM conversations WHERE topic_type = 'help' AND topic_id IN (${oldPosts})`).run();
    result.helpPosts = db.prepare(`DELETE FROM help_posts WHERE id IN (${oldPosts})`).run().changes;

    // Any conversation that has been quiet for a long time, or whose post or
    // profile is gone.
    const staleConv = `SELECT id FROM conversations WHERE
        date(last_message_at) <= date('now', '-${limits.conversationDays} days')
        OR (topic_type = 'help' AND topic_id NOT IN (SELECT id FROM help_posts))
        OR (topic_type = 'talent' AND topic_id NOT IN (SELECT id FROM talent_profiles))`;
    db.prepare(`DELETE FROM conversation_messages WHERE conversation_id IN (${staleConv})`).run();
    result.conversations = db.prepare(`DELETE FROM conversations WHERE id IN (${staleConv})`).run().changes;

    result.reports = db
      .prepare(
        `DELETE FROM community_reports WHERE status <> 'open'
           AND date(handled_at) <= date('now', '-${limits.reportDays} days')`
      )
      .run().changes;
    result.reports += pruneOrphanReports(db);
  })();
  // Files only once the rows are certainly gone.
  unlinkTalentPhotos(orphanPhotos);
  return result;
}

/**
 * Everything the community holds about one member, for their own export
 * (Art. 15 / 20). Their own words in full; other people's messages in a
 * conversation they were part of are included too, because the conversation
 * is theirs as much as the other person's — but by display name only.
 */
export function communityExport(db: Database.Database, customerId: string) {
  const member = db
    .prepare(
      `SELECT community_name AS name, community_city AS city, community_handle AS handle,
              community_joined_at AS joinedAt, community_rules_version AS rulesVersion
       FROM customers WHERE id = ?`
    )
    .get(customerId);
  const conversations = db
    .prepare(`SELECT id, topic_type AS topicType, topic_id AS topicId, created_at AS createdAt FROM conversations WHERE owner_id = ? OR other_id = ?`)
    .all(customerId, customerId) as { id: string }[];
  return {
    member,
    meetupsHosted: db
      .prepare(`SELECT title, about, category, city, place, starts_at AS startsAt, capacity, status, created_at AS createdAt FROM meetups WHERE host_id = ?`)
      .all(customerId),
    meetupsJoined: db
      .prepare(
        `SELECT m.title, m.starts_at AS startsAt, mm.joined_at AS joinedAt, mm.removed_at AS removedAt
         FROM meetup_members mm JOIN meetups m ON m.id = mm.meetup_id WHERE mm.customer_id = ?`
      )
      .all(customerId),
    meetupMessages: db
      .prepare(
        `SELECT m.title AS meetup, mm.body, mm.created_at AS createdAt
         FROM meetup_messages mm JOIN meetups m ON m.id = mm.meetup_id WHERE mm.customer_id = ?`
      )
      .all(customerId),
    helpPosts: db
      .prepare(`SELECT kind, category, city, title, body, when_date AS whenDate, expires_on AS expiresOn, status, created_at AS createdAt FROM help_posts WHERE author_id = ?`)
      .all(customerId),
    talentProfile: db
      .prepare(`SELECT name, kind, city, areas, bio, links, video_url AS videoUrl, status, created_at AS createdAt FROM talent_profiles WHERE owner_id = ?`)
      .get(customerId) ?? null,
    conversations: conversations.map((c) => ({
      ...c,
      messages: db
        .prepare(
          `SELECT CASE WHEN cm.sender_id = ? THEN 'you' ELSE COALESCE(NULLIF(cu.community_name, ''), 'a member') END AS sender,
                  cm.body, cm.created_at AS createdAt
           FROM conversation_messages cm LEFT JOIN customers cu ON cu.id = cm.sender_id
           WHERE cm.conversation_id = ? ORDER BY cm.id`
        )
        .all(customerId, c.id),
    })),
    reportsFiled: db
      .prepare(`SELECT target_type AS targetType, reason, note, status, created_at AS createdAt FROM community_reports WHERE reporter_id = ?`)
      .all(customerId),
    blocked: db
      .prepare(
        `SELECT COALESCE(NULLIF(c.community_name, ''), 'a member') AS name, b.created_at AS createdAt
         FROM community_blocks b LEFT JOIN customers c ON c.id = b.blocked_id WHERE b.blocker_id = ?`
      )
      .all(customerId),
  };
}
