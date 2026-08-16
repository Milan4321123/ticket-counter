// Server-only: SQLite connection + schema.
import crypto from 'crypto';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  paypal_order_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | claimed | paid | failed | cancelled
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payment_mode TEXT NOT NULL, -- paypal | mock | transfer
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT,
  capture_id TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT NOT NULL REFERENCES orders(id),
  tier_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  PRIMARY KEY (order_id, tier_id)
);

CREATE TABLE IF NOT EXISTS tickets (
  code TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  tier_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  checked_in_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tickets_order ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- Single-row storage for the admin login one-time code (id is always 1).
CREATE TABLE IF NOT EXISTS admin_otp (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL, -- unix ms
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tiny key/value store for server settings (e.g. scanner-link revocation epoch).
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------- Platform (multi-organizer) tables ----------------

-- Event organizers: the platform's paying customers. Accounts are created by
-- the platform admin once the organizer has paid the platform fee.
CREATE TABLE IF NOT EXISTS organizers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '', -- scrypt 'salt:hash' hex; '' = login disabled until set
  status TEXT NOT NULL DEFAULT 'active',  -- active | disabled
  plan_paid_until TEXT,                   -- 'YYYY-MM-DD'; NULL/past = portal locked (events stay visible)
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Self-service "I forgot my password" codes for ORGANIZERS. Deliberately NOT
-- admin_otp: that single row is the platform owner's own login, and the two
-- must never share a table, a lifetime, or an attempt counter.
--
-- The code is stored hashed (never in the clear), expires within minutes, is
-- single-use via used_at, and dies with the account: ON DELETE CASCADE means a
-- deleted organizer cannot leave a working code behind.
CREATE TABLE IF NOT EXISTS organizer_password_reset (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL, -- unix ms
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_organizer_password_reset_org ON organizer_password_reset(organizer_id);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES organizers(id),
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | published | archived
  name TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  date_display TEXT NOT NULL DEFAULT '',
  event_date TEXT,                        -- 'YYYY-MM-DD' for feed ordering (optional)
  venue_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',       -- full street address (feeds the Open-in-Maps link)
  city TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'EUR',
  total_capacity INTEGER NOT NULL DEFAULT 100,
  sales_open INTEGER NOT NULL DEFAULT 1,
  max_per_order INTEGER NOT NULL DEFAULT 8,
  pay_within_days INTEGER NOT NULL DEFAULT 5,
  bank_account_holder TEXT NOT NULL DEFAULT '',
  bank_iban TEXT NOT NULL DEFAULT '',     -- the ORGANIZER's account: ticket money goes straight to them
  bank_bic TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  poster_media_id TEXT,                   -- event_media.id of the cover photo
  video_url TEXT NOT NULL DEFAULT '',     -- YouTube/Vimeo/mp4 link, embedded on the event page
  page_design TEXT NOT NULL DEFAULT '{}', -- JSON design spec (manual theme or AI-generated)
  fee_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid | paid: the PER-EVENT platform fee; publishing needs 'paid'
  fee_paid_at TEXT,                       -- when the platform owner confirmed the fee transfer
  fee_cents INTEGER,                      -- the amount QUOTED for this event (NULL = never quoted); frozen once paid
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- Ticket types per event. tier_key is the stable id used in order_items.tier_id
-- (scoped per event; two events can both have a 'general' tier).
CREATE TABLE IF NOT EXISTS event_tiers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  tier_key TEXT NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  cap INTEGER NOT NULL,
  student_only INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  UNIQUE (event_id, tier_key)
);

-- Uploaded photos for an event (files live under DATA_DIR/uploads/<event_id>/).
CREATE TABLE IF NOT EXISTS event_media (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  file_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_event_media_event ON event_media(event_id);

-- Organizer-written FAQ entries shown on the event page.
CREATE TABLE IF NOT EXISTS event_faqs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_event_faqs_event ON event_faqs(event_id);

-- Organizer updates ("posts") shown as a feed on the event page, like a
-- social page: text plus an optional photo from the event's media.
CREATE TABLE IF NOT EXISTS event_posts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  body TEXT NOT NULL,
  media_id TEXT REFERENCES event_media(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_posts_event ON event_posts(event_id);

-- Visitor questions from the event page's AI assistant. Questions the AI
-- could not answer wait here ('open') until the organizer replies; answered
-- ones are published on the event page and fed back to the AI as context.
CREATE TABLE IF NOT EXISTS event_questions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  question TEXT NOT NULL,
  answer TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open | answered | dismissed
  asked_at TEXT NOT NULL DEFAULT (datetime('now')),
  answered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_event_questions_event ON event_questions(event_id, status);

-- "Design my page for me" enquiries from the public contact form. Stored as
-- well as emailed, so a lead is never lost to a mail outage.
CREATE TABLE IF NOT EXISTS contact_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'custom-design',
  status TEXT NOT NULL DEFAULT 'new', -- new | handled
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contact_requests_created ON contact_requests(created_at);
`;

declare global {
  // eslint-disable-next-line no-var
  var __ticketDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'tickets.db'));

  // --- Durability + concurrency tuning for a traffic spike ---------------
  // better-sqlite3 is synchronous and this app uses a single shared connection,
  // so queries never race each other inside the process. WAL still lets the
  // checkpointer and any second connection (backups) read while we write.
  db.pragma('journal_mode = WAL');
  // NORMAL is the recommended, crash-safe setting under WAL and is far faster
  // on writes than FULL — the difference matters when hundreds of buyers
  // reserve seats in the same minute.
  db.pragma('synchronous = NORMAL');
  // If a checkpoint or backup ever holds the file briefly, wait up to 5s for
  // the lock instead of throwing SQLITE_BUSY at a buyer mid-checkout.
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  // Read-side speedups (help the availability/config query that every visitor
  // triggers): keep temp tables in memory, use a larger page cache (~64MB),
  // and memory-map the DB file (256MB) so hot reads avoid syscalls.
  db.pragma('temp_store = MEMORY');
  db.pragma('cache_size = -64000');
  db.pragma('mmap_size = 268435456');
  db.exec(SCHEMA);

  // Indexes that back the hottest queries. Overselling/availability joins
  // order_items to orders and filters by status; the admin dashboard and
  // reconciler scan orders by status. Without these, a spike turns every
  // availability check into a full table scan.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_status_mode ON orders(status, payment_mode);
    CREATE INDEX IF NOT EXISTS idx_order_items_tier ON order_items(tier_id);
  `);

  migrateToPlatform(db);
  return db;
}

/**
 * One-time, idempotent platform migration:
 *  1. Adds orders.event_id (older databases predate multi-event support).
 *  2. If no events exist yet, imports event.config.json as the platform's
 *     first event, owned by a seeded "platform owner" organizer account
 *     (login disabled until the platform admin sets a password).
 *  3. Backfills event_id on all pre-platform orders.
 */
function migrateToPlatform(db: Database.Database): void {
  const orderCols = (db.pragma(`table_info(orders)`) as { name: string }[]).map((c) => c.name);
  if (!orderCols.includes('event_id')) {
    db.exec(`ALTER TABLE orders ADD COLUMN event_id TEXT`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_event ON orders(event_id)`);
  }

  // Facebook-page-style profile photo (square avatar over the cover photo).
  const eventCols = (db.pragma(`table_info(events)`) as { name: string }[]).map((c) => c.name);
  if (!eventCols.includes('profile_media_id')) {
    db.exec(`ALTER TABLE events ADD COLUMN profile_media_id TEXT`);
  }
  // Self-hosted event videos (uploaded files in event_media, not YouTube links).
  // The column now means "the first/cover video" — events can hold several.
  if (!eventCols.includes('video_media_id')) {
    db.exec(`ALTER TABLE events ADD COLUMN video_media_id TEXT`);
  }
  // The cover: the one item shown first in the feed and at the top of the
  // event page. Unlike poster_media_id it may point at a PHOTO or a VIDEO row.
  if (!eventCols.includes('cover_media_id')) {
    db.exec(`ALTER TABLE events ADD COLUMN cover_media_id TEXT`);
  }
  // Per-event platform fee: every event needs its fee paid before it can be
  // published. Events that were ALREADY live when this landed are grandfathered
  // in — nobody gets charged retroactively for an event that is already selling.
  const feeColumnIsNew = !eventCols.includes('fee_status');
  if (feeColumnIsNew) {
    db.exec(`ALTER TABLE events ADD COLUMN fee_status TEXT NOT NULL DEFAULT 'unpaid'`);
  }
  if (!eventCols.includes('fee_paid_at')) {
    db.exec(`ALTER TABLE events ADD COLUMN fee_paid_at TEXT`);
  }
  if (feeColumnIsNew) {
    db.exec(`UPDATE events SET fee_status = 'paid', fee_paid_at = datetime('now') WHERE status = 'published'`);
  }
  // The fee now follows the event's capacity, so it is quoted per event and
  // stored here the moment the organizer is shown what to transfer. Once the
  // fee is paid this number never moves again — nobody is re-billed for an
  // amount they already settled. NULL means "not quoted yet".
  if (!eventCols.includes('fee_cents')) {
    db.exec(`ALTER TABLE events ADD COLUMN fee_cents INTEGER`);
  }

  // Where the organizer dragged each photo to sit inside its slot. Every slot is
  // a fixed shape that is always filled, so SOMETHING is always cropped away —
  // these say which part the organizer chose to keep, as JSON fractions of the
  // original ({"x":0.12,"y":0,"w":0.76,"h":1}; see parseCropRect). NULL means
  // they never repositioned it, and the automatic subject-finding crop applies.
  if (!eventCols.includes('cover_crop')) {
    db.exec(`ALTER TABLE events ADD COLUMN cover_crop TEXT`);
  }
  if (!eventCols.includes('profile_crop')) {
    db.exec(`ALTER TABLE events ADD COLUMN profile_crop TEXT`);
  }
  if (!eventCols.includes('poster_crop')) {
    db.exec(`ALTER TABLE events ADD COLUMN poster_crop TEXT`);
  }

  // A second way for a buyer to send the SAME money to the SAME person: the
  // organizer's own PayPal address (or PayPal.Me link). Deliberately not a
  // PayPal checkout integration — that would route ticket money through the
  // platform's merchant account, and this platform's whole promise is that it
  // never touches it. This is the IBAN's twin: details on screen, the same
  // reference, the organizer confirming what landed. Optional, so publishing
  // still only requires a bank account.
  if (!eventCols.includes('paypal_account')) {
    db.exec(`ALTER TABLE events ADD COLUMN paypal_account TEXT NOT NULL DEFAULT ''`);
  }

  // Everything the organizer knows that has no field of its own — parking,
  // food, age limits, dress code, cloakroom, when the doors really open. Free
  // text, written (or dictated) in the portal, and the ONLY extra source the
  // visitor assistant is allowed to answer from.
  if (!eventCols.includes('assistant_context')) {
    db.exec(`ALTER TABLE events ADD COLUMN assistant_context TEXT`);
  }

  // "Check your bank account" reminder emails for organizers: up to three
  // timers (days after a reservation) + per-order progress tracking.
  const orgCols = (db.pragma(`table_info(organizers)`) as { name: string }[]).map((c) => c.name);
  if (!orgCols.includes('reminder_days')) {
    db.exec(`ALTER TABLE organizers ADD COLUMN reminder_days TEXT NOT NULL DEFAULT '2,4,6'`);
  }
  if (!orgCols.includes('reminders_enabled')) {
    db.exec(`ALTER TABLE organizers ADD COLUMN reminders_enabled INTEGER NOT NULL DEFAULT 1`);
  }
  // Set whenever the PLATFORM picked the password (account approval, admin
  // reset), because that password travelled by email and the organizer never
  // chose it. The portal is unreachable until they replace it. Existing
  // accounts default to 0 — they already picked their own.
  if (!orgCols.includes('must_change_password')) {
    db.exec(`ALTER TABLE organizers ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0`);
  }
  if (!orderCols.includes('reminder_stage')) {
    db.exec(`ALTER TABLE orders ADD COLUMN reminder_stage INTEGER NOT NULL DEFAULT 0`);
  }
  // One friendly nudge to the BUYER when their transfer hasn't been confirmed
  // after a few days. Stamped once so nobody is ever nagged twice.
  if (!orderCols.includes('buyer_reminder_sent_at')) {
    db.exec(`ALTER TABLE orders ADD COLUMN buyer_reminder_sent_at TEXT`);
  }
  // When this order's buyer_name/buyer_email were overwritten because the event
  // is long past (see lib/retention.ts). NULL means "still identifiable" — it
  // is the stamp that makes the erasure sweep idempotent, and the partial index
  // keeps that sweep off a full table scan once most orders are erased.
  if (!orderCols.includes('buyer_erased_at')) {
    db.exec(`ALTER TABLE orders ADD COLUMN buyer_erased_at TEXT`);
  }
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_orders_pending_erasure
     ON orders(event_id) WHERE buyer_erased_at IS NULL`
  );

  // An organizer-account application has to carry enough for the owner to judge
  // it without a round of emails first. Every field is optional and free text —
  // "about 300" and "some time in November" are honest answers, so nothing here
  // is a number or a date.
  const contactCols = (db.pragma(`table_info(contact_requests)`) as { name: string }[]).map((c) => c.name);
  for (const col of ['phone', 'event_kind', 'event_when', 'event_where', 'expected_people']) {
    if (!contactCols.includes(col)) {
      db.exec(`ALTER TABLE contact_requests ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
    }
  }
  // The account this application was approved into. Once it is set the
  // application is spent, so approving twice cannot mint a second account.
  if (!contactCols.includes('organizer_id')) {
    db.exec(`ALTER TABLE contact_requests ADD COLUMN organizer_id TEXT`);
  }

  const haveEvents = (db.prepare(`SELECT COUNT(*) AS n FROM events`).get() as { n: number }).n > 0;
  if (!haveEvents) {
    const configPath = path.join(process.cwd(), 'event.config.json');
    if (fs.existsSync(configPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
          eventName?: string;
          artist?: string;
          description?: string;
          dateDisplay?: string;
          venue?: string;
          currency?: string;
          totalCapacity?: number;
          salesOpen?: boolean;
          maxTicketsPerOrder?: number;
          bankTransfer?: {
            accountHolder?: string;
            iban?: string;
            bic?: string;
            bankName?: string;
            payWithinDays?: number;
          };
          tiers?: {
            id?: string;
            name?: string;
            priceCents?: number;
            cap?: number;
            studentOnly?: boolean;
            description?: string;
          }[];
        };

        const organizerId = crypto.randomUUID();
        const eventId = crypto.randomUUID();
        const ownerEmail =
          (process.env.ADMIN_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || 'owner@localhost';
        const slugBase =
          (cfg.eventName || 'my-event')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'my-event';

        const tx = db.transaction(() => {
          db.prepare(
            `INSERT INTO organizers (id, email, name, password_hash, status, notes)
             VALUES (?, ?, ?, '', 'active', 'Platform owner (seeded from the original single-event setup).')`
          ).run(organizerId, ownerEmail, cfg.bankTransfer?.accountHolder || 'Platform Owner');

          db.prepare(
            `INSERT INTO events (id, organizer_id, slug, status, name, artist, description, date_display,
               venue_name, address, currency, total_capacity, sales_open, max_per_order, pay_within_days,
               bank_account_holder, bank_iban, bank_bic, bank_name)
             VALUES (?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            eventId,
            organizerId,
            slugBase,
            cfg.eventName || 'My Event',
            cfg.artist || '',
            cfg.description || '',
            cfg.dateDisplay || '',
            cfg.venue || '',
            cfg.venue || '', // venue string doubles as the address until edited
            (cfg.currency || 'EUR').toUpperCase(),
            Number.isInteger(cfg.totalCapacity) ? cfg.totalCapacity : 100,
            cfg.salesOpen === false ? 0 : 1,
            Number.isInteger(cfg.maxTicketsPerOrder) ? cfg.maxTicketsPerOrder : 8,
            Number.isInteger(cfg.bankTransfer?.payWithinDays) ? (cfg.bankTransfer!.payWithinDays as number) : 5,
            cfg.bankTransfer?.accountHolder || '',
            cfg.bankTransfer?.iban || '',
            cfg.bankTransfer?.bic || '',
            cfg.bankTransfer?.bankName || ''
          );

          const insTier = db.prepare(
            `INSERT INTO event_tiers (id, event_id, tier_key, name, price_cents, cap, student_only, description, sort)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          (cfg.tiers || []).forEach((t, i) => {
            if (!t.id || !t.name) return;
            insTier.run(
              crypto.randomUUID(),
              eventId,
              t.id,
              t.name,
              Number.isInteger(t.priceCents) ? t.priceCents : 0,
              Number.isInteger(t.cap) ? t.cap : 0,
              t.studentOnly ? 1 : 0,
              t.description || '',
              i
            );
          });

          // Every pre-platform order belongs to the migrated event.
          db.prepare(`UPDATE orders SET event_id = ? WHERE event_id IS NULL`).run(eventId);
        });
        tx();
        console.log(`Platform migration: imported "${cfg.eventName}" as event ${slugBase} (${eventId})`);
      } catch (e) {
        console.error('Platform migration failed (continuing with empty platform):', e);
      }
    }
  } else {
    // Safety net: any order still missing event_id gets the oldest event.
    const orphan = db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE event_id IS NULL`).get() as { n: number };
    if (orphan.n > 0) {
      const first = db.prepare(`SELECT id FROM events ORDER BY created_at ASC LIMIT 1`).get() as
        | { id: string }
        | undefined;
      if (first) db.prepare(`UPDATE orders SET event_id = ? WHERE event_id IS NULL`).run(first.id);
    }
  }
}

// Singleton that survives Next.js dev-server hot reloads.
export function getDb(): Database.Database {
  if (!global.__ticketDb) global.__ticketDb = createDb();
  return global.__ticketDb;
}
