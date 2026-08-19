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
  payer_name TEXT NOT NULL DEFAULT '',    -- whose name the money will arrive under, when not the buyer's
  confirmed_via TEXT NOT NULL DEFAULT '', -- reference | sender: how the organizer matched the payment
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

-- The emailed second factor at organizer sign-in, for accounts with no
-- authenticator. Its own table, not organizer_password_reset: a reset code is
-- handed to somebody locked OUT, this one to somebody halfway IN, and a code
-- minted for one must never open the other's door.
CREATE TABLE IF NOT EXISTS organizer_login_code (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL, -- unix ms
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_organizer_login_code_org ON organizer_login_code(organizer_id);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES organizers(id),
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | published | archived
  kind TEXT NOT NULL DEFAULT 'event',     -- event (dated, venued) | shop (pickup_info instead)
  name TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  date_display TEXT NOT NULL DEFAULT '',
  event_date TEXT,                        -- 'YYYY-MM-DD' for feed ordering (optional)
  venue_name TEXT NOT NULL DEFAULT '',
  pickup_info TEXT NOT NULL DEFAULT '',   -- shops only: where and when to collect
  address TEXT NOT NULL DEFAULT '',       -- full street address (feeds the Open-in-Maps link)
  city TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'EUR',
  total_capacity INTEGER NOT NULL DEFAULT 100,
  sales_open INTEGER NOT NULL DEFAULT 1,
  closed_message TEXT NOT NULL DEFAULT 'closed', -- RETIRED, nothing reads it: see the migration note
  whatsapp TEXT NOT NULL DEFAULT '',      -- organizer's WhatsApp, digits only (see lib/whatsapp.ts)
  whatsapp_name TEXT NOT NULL DEFAULT '', -- who the bubble says you are; '' = the account name
  whatsapp_photo TEXT NOT NULL DEFAULT '', -- served URL of the bubble's OWN face; '' = none
  whatsapp_focus TEXT NOT NULL DEFAULT '50% 50%', -- which part of it sits in the circle
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
  // How many seats the PAID fee covers.
  //
  // The fee is base + per-ticket x capacity and freezes when the owner confirms
  // the transfer — but nothing stopped the capacity being raised afterwards, so
  // an organizer could pay for 100 seats and then sell 200,000. The amount was
  // frozen; what it bought was not written down anywhere.
  //
  // Existing paid events are backfilled at their CURRENT capacity: they are
  // grandfathered at the size they are, which is also the size their fee was
  // quoted from. Their fee_cents is NULL (never re-quoted), so it cannot be
  // divided back into a seat count — this column is why the rule works for them
  // at all.
  if (!eventCols.includes('fee_capacity')) {
    db.exec(`ALTER TABLE events ADD COLUMN fee_capacity INTEGER`);
  }
  // Run EVERY boot, not only when the column is new. The ALTER and this UPDATE
  // are separate statements with no transaction around them, so a process
  // killed between the two would otherwise leave the column committed and empty
  // — and empty means feeCapacity is null, which switches the ceiling OFF for
  // every paid event, silently and permanently. Idempotent and a no-op
  // afterwards, so it self-heals instead of failing open.
  db.exec(`UPDATE events SET fee_capacity = total_capacity WHERE fee_status = 'paid' AND fee_capacity IS NULL`);
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

  // Ticket types that are not capped at all — a free community night in a hall
  // nobody counts, a donation ticket, an outdoor event. The cap column stays
  // (it is NOT NULL and every existing row has one), and this flag says to
  // ignore it. Defaulting to 0 keeps every event created before today exactly
  // as limited as it was.
  const tierCols = (db.pragma(`table_info(event_tiers)`) as { name: string }[]).map((c) => c.name);
  if (!tierCols.includes('unlimited')) {
    db.exec(`ALTER TABLE event_tiers ADD COLUMN unlimited INTEGER NOT NULL DEFAULT 0`);
  }
  // Announce a ticket type before it goes on sale.
  //
  // Organizers want the whole line-up visible while only part of it is
  // sellable — early bird now, standard from next month — and the only way to
  // do that was to leave the tier out of the page entirely and add it on the
  // day. It shows with a "Coming soon" badge and is refused everywhere a
  // purchase is attempted, including by a request that names it directly.
  if (!tierCols.includes('coming_soon')) {
    db.exec(`ALTER TABLE event_tiers ADD COLUMN coming_soon INTEGER NOT NULL DEFAULT 0`);
  }
  // ONE status per ticket type: 'on-sale' | 'coming-soon' | 'hidden'.
  //
  // Replaces the coming_soon flag, which could only say two things. An
  // organizer with an early bird, a standard and a student ticket needs to say
  // something different about each — this one is selling, that one is announced,
  // that one is not on offer at all — and a boolean forced them to delete a
  // ticket type to take it off the page. coming_soon is RETIRED: it is migrated
  // across once, below, and nothing reads it afterwards.
  if (!tierCols.includes('status')) {
    db.exec(`ALTER TABLE event_tiers ADD COLUMN status TEXT NOT NULL DEFAULT 'on-sale'`);
    db.exec(`UPDATE event_tiers SET status = 'coming-soon' WHERE coming_soon = 1`);
  }
  // RETIRED. It let an organizer choose whether a PAUSE read "Sales closed" or
  // "Tickets coming soon" — a second way to say what the per-ticket status
  // below already says, and it overrode every ticket type at once. An organizer
  // who set one ticket to coming-soon and another to on-sale watched both go
  // green and could not tell which control had won. The pause now always reads
  // "Sales closed"; "coming soon" is a property of a TICKET. Column kept so no
  // migration has to rewrite the table; nothing reads it.
  if (!eventCols.includes('closed_message')) {
    db.exec(`ALTER TABLE events ADD COLUMN closed_message TEXT NOT NULL DEFAULT 'closed'`);
  }
  // The organizer's own WhatsApp, so a buyer can reach a PERSON before paying.
  //
  // The one question buyers actually stop on is "is this bank account really
  // yours" — and the only person who can answer it is the organizer whose
  // account it is. Stored digits-only; see lib/whatsapp.ts for why.
  if (!eventCols.includes('whatsapp')) {
    db.exec(`ALTER TABLE events ADD COLUMN whatsapp TEXT NOT NULL DEFAULT ''`);
  }
  // Who the bubble says you are. Separate from the account name because the
  // person on WhatsApp is often not the person the account is registered to —
  // a team's ticket phone, or a first name where the account is a company.
  if (!eventCols.includes('whatsapp_name')) {
    db.exec(`ALTER TABLE events ADD COLUMN whatsapp_name TEXT NOT NULL DEFAULT ''`);
  }
  // The bubble's OWN face, separate from the page's profile photo.
  //
  // It cannot be an event_media row: the event page builds its gallery from
  // every photo in that table, so a headshot uploaded for a chat bubble would
  // appear in the public gallery next to the poster. Stored as its own file
  // with the URL kept here, the same way the platform's contact bubble works.
  if (!eventCols.includes('whatsapp_photo')) {
    db.exec(`ALTER TABLE events ADD COLUMN whatsapp_photo TEXT NOT NULL DEFAULT ''`);
  }
  // Which part of that photo lands in the circle, as CSS object-position.
  //
  // A focus POINT, not a stored crop: the upload keeps the whole photo (it is
  // bounded, never cut), so moving the circle re-renders nothing and costs no
  // quality — and a circle only needs a centre. The event cropper stores
  // rectangles because those slots have several different shapes; this one is
  // always round.
  if (!eventCols.includes('whatsapp_focus')) {
    db.exec(`ALTER TABLE events ADD COLUMN whatsapp_focus TEXT NOT NULL DEFAULT '50% 50%'`);
  }
  // The same choice for the event as a whole. total_capacity is NOT dropped
  // when this is set: it stays on as the organizer's EXPECTED attendance, which
  // is what the platform fee is priced from — an event with no ceiling still
  // has a size, and the fee has to be quoted from something.
  // RETIRED. An event could opt out of having a ceiling at all, which meant the
  // organizer paid a fee priced on the number they typed and could then sell
  // past it without limit — the fee and the tickets stopped describing the same
  // event. Every event now states a capacity, and hiding the COUNT from buyers
  // (which is what organizers actually wanted here) is show_remaining instead.
  //
  // The column stays because SQLite makes dropping one awkward and nothing
  // reads it any more; it is forced to 0 so a stale reader cannot find a stray
  // 1 and start honouring it again.
  if (!eventCols.includes('capacity_unlimited')) {
    db.exec(`ALTER TABLE events ADD COLUMN capacity_unlimited INTEGER NOT NULL DEFAULT 0`);
  } else {
    db.exec(`UPDATE events SET capacity_unlimited = 0 WHERE capacity_unlimited != 0`);
  }

  // Who the money will actually arrive from.
  //
  // A payment reference is the reliable way to match a transfer to an order,
  // and on a bank transfer it is filled in for the buyer by the GiroCode. On
  // PayPal it is not: a PayPal.Me link carries the amount and has nowhere to
  // put a reference, so plenty of buyers pay with no reference at all and the
  // organizer is left looking at a name and an amount.
  //
  // payer_name is the buyer's own answer to "whose name will this show up
  // under" — for anyone paying from a partner's, a parent's or a shared
  // account, where even the buyer's own name would not have matched. Optional
  // and usually '': most people pay from an account in their own name, and
  // asking is a courtesy, not a requirement.
  const orderCols2 = (db.pragma(`table_info(orders)`) as { name: string }[]).map((c) => c.name);
  if (!orderCols2.includes('payer_name')) {
    db.exec(`ALTER TABLE orders ADD COLUMN payer_name TEXT NOT NULL DEFAULT ''`);
  }
  // Which of the two routes the organizer used to confirm — 'reference' or
  // 'sender'. Recorded rather than inferred, so a disputed order can be asked
  // what the person confirming it actually matched on.
  if (!orderCols2.includes('confirmed_via')) {
    db.exec(`ALTER TABLE orders ADD COLUMN confirmed_via TEXT NOT NULL DEFAULT ''`);
  }

  // What KIND of thing this listing is. Everything here began life as an event
  // — a thing that happens once, at a place, on a date — and the whole model
  // underneath (a page, priced types with a cap, an order, a QR code, someone
  // scanning it at the door) turned out to describe a small shop just as well:
  // a seller lists items, a buyer pays ahead, and the code is what they show
  // when they come to collect.
  //
  //   event — dated and venued. Unchanged, and the default, so every row that
  //           predates this column is exactly what it always was.
  //   shop  — no date and no venue; pickup_info says where and when to collect
  //           instead. Sells items rather than tickets.
  //
  // Deliberately ONE table rather than a parallel one: the page, gallery,
  // posts, FAQ, assistant, orders, payouts and scanning are identical for
  // both, and splitting them would mean maintaining each of those twice to
  // buy nothing but a tidier-looking schema.
  if (!eventCols.includes('kind')) {
    db.exec(`ALTER TABLE events ADD COLUMN kind TEXT NOT NULL DEFAULT 'event'`);
  }
  // Free text: where to collect, and when. A shop's answer to the venue block
  // and the date, which is why publishing a shop asks for this and not those.
  if (!eventCols.includes('pickup_info')) {
    db.exec(`ALTER TABLE events ADD COLUMN pickup_info TEXT NOT NULL DEFAULT ''`);
  }

  // Who asked a question, so the answer can be emailed back rather than only
  // appearing on the page — nobody re-opens an event page on the off-chance
  // that the thing they asked about has been answered.
  //
  // Both contact columns are OPTIONAL and default to ''. A question asked
  // without an address still works exactly as it did: it is answered publicly
  // and nothing is sent. That keeps asking anonymously a real choice rather
  // than a price of admission.
  const questionCols = (db.pragma(`table_info(event_questions)`) as { name: string }[]).map((c) => c.name);
  if (!questionCols.includes('asker_name')) {
    db.exec(`ALTER TABLE event_questions ADD COLUMN asker_name TEXT NOT NULL DEFAULT ''`);
  }
  if (!questionCols.includes('asker_email')) {
    db.exec(`ALTER TABLE event_questions ADD COLUMN asker_email TEXT NOT NULL DEFAULT ''`);
  }
  // Stamped when the answer actually reached them. Separate from answered_at
  // because answering and emailing can fail independently — without this, a
  // send that failed is indistinguishable from one that was never due, and the
  // organizer has no way to know their reply went nowhere.
  if (!questionCols.includes('answer_emailed_at')) {
    db.exec(`ALTER TABLE event_questions ADD COLUMN answer_emailed_at TEXT`);
  }
  // The asker's address is personal data with the same expiry as a buyer's —
  // see lib/retention.ts. Stamped when it has been erased.
  if (!questionCols.includes('asker_erased_at')) {
    db.exec(`ALTER TABLE event_questions ADD COLUMN asker_erased_at TEXT`);
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
  // Platform-wide announcements from the owner, shown on the browse page.
  // Deliberately its own table rather than a row in kv: these are a LIST that
  // grows, each with its own timestamp, and kv is a single-value store.
  db.exec(`
    CREATE TABLE IF NOT EXISTS platform_posts (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // An optional picture on a platform announcement. Stored as the URL we serve
  // it from rather than a file name, so the serving route can change without a
  // migration.
  const ppCols = (db.pragma(`table_info(platform_posts)`) as { name: string }[]).map((c) => c.name);
  if (!ppCols.includes('photo_url')) {
    db.exec(`ALTER TABLE platform_posts ADD COLUMN photo_url TEXT NOT NULL DEFAULT ''`);
  }

  // Whether the public page counts down the remaining tickets.
  //
  // Defaults to 1, which is what every event did before this existed. It is a
  // CHOICE because the honest answer depends on how the event is priced: on an
  // early-bird event "only 8 left" is read as "this event is nearly sold out"
  // when it only means the cheap tier is nearly gone, and that scares people
  // off an event with hundreds of seats free.
  if (!eventCols.includes('show_remaining')) {
    db.exec(`ALTER TABLE events ADD COLUMN show_remaining INTEGER NOT NULL DEFAULT 1`);
  }

  // Authenticator-app second factor, PER ORGANIZER. The admin has had this for
  // a while (see lib/totp.ts); organizers had nothing but a password.
  //
  // An authenticator is the right second factor here rather than an emailed
  // code: it needs no mail delivery at all, so it keeps working on a platform
  // whose outbound email is unreliable — and an emailed login code on a broken
  // mail path locks everybody out instead of protecting them.
  if (!orgCols.includes('totp_secret')) {
    db.exec(`ALTER TABLE organizers ADD COLUMN totp_secret TEXT`);
  }
  if (!orgCols.includes('totp_enabled')) {
    db.exec(`ALTER TABLE organizers ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`);
  }

  // Set whenever the PLATFORM picked the password (account approval, admin
  // reset), because that password travelled by email and the organizer never
  // chose it. The portal is unreachable until they replace it. Existing
  // accounts default to 0 — they already picked their own.
  // The last authenticator step this account spent, so a code cannot be spent
  // twice. See lib/organizerTotp.ts.
  if (!orgCols.includes('totp_last_step')) {
    db.exec(`ALTER TABLE organizers ADD COLUMN totp_last_step INTEGER NOT NULL DEFAULT 0`);
  }
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

  // ---- Where THIS order's money was sent, frozen at the moment it was made --
  //
  // The order page and the transfer emails used to read the event's CURRENT
  // bank details. That meant changing an event's IBAN silently rewrote the
  // payment instructions of every order already placed: a buyer who ordered
  // last week, opening their order page today, would be shown a different
  // account under the same reference — and would pay it. One edit could
  // redirect the entire unpaid book, not just future sales.
  //
  // An order now carries its own copy. It is a receipt: what it says is what
  // the buyer was told, and nothing edited later can rewrite history. Orders
  // written before this column existed keep '' and fall back to the event, so
  // old orders still render (see lib/payout.ts).
  for (const col of ['payout_holder', 'payout_iban', 'payout_bic', 'payout_bank_name', 'payout_paypal']) {
    if (!orderCols.includes(col)) {
      db.exec(`ALTER TABLE orders ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
    }
  }

  // ---- A payout change on a selling event waits before it takes effect ------
  //
  // Proving who you are at the moment of the change can only ever be as strong
  // as the factor used, and every factor can in principle be taken. So the
  // second defence does not try to be a better proof — it removes the two
  // things the attacker actually needs, speed and silence. The new account is
  // parked here, the old one keeps being quoted to buyers, and both the
  // organizer and the platform owner get a day in which to say no.
  for (const col of [
    'pending_bank_account_holder',
    'pending_bank_iban',
    'pending_bank_bic',
    'pending_bank_name',
    'pending_paypal_account',
  ]) {
    if (!eventCols.includes(col)) {
      db.exec(`ALTER TABLE events ADD COLUMN ${col} TEXT`);
    }
  }
  if (!eventCols.includes('pending_payout_effective_at')) {
    db.exec(`ALTER TABLE events ADD COLUMN pending_payout_effective_at INTEGER`); // unix ms
  }

  // Monotonic: set the first time an event could ever have taken money, and
  // NEVER cleared. It has to be its own flag rather than a look at status,
  // because status can be moved back: unpublish, change the IBAN with no delay,
  // republish would have walked straight around the waiting period.
  const payoutLockIsNew = !eventCols.includes('payout_locked');
  if (payoutLockIsNew) {
    db.exec(`ALTER TABLE events ADD COLUMN payout_locked INTEGER NOT NULL DEFAULT 0`);
    // Everything already selling, or already holding an order, starts locked.
    db.exec(
      `UPDATE events SET payout_locked = 1
        WHERE status = 'published'
           OR id IN (SELECT DISTINCT event_id FROM orders WHERE event_id IS NOT NULL)`
    );
  }

  // ---- The record of every payout move ------------------------------------
  //
  // Until now the old IBAN was overwritten and gone. After an incident nobody
  // could say what the account had been, when it changed, or what was used to
  // authorise it — not the organizer, not their bank, not the police. This is
  // append-only and deliberately keeps the values IN FULL: it is the forensic
  // record, it is never shown to a buyer, and a masked audit trail would be
  // useless for the one job it exists to do.
  db.exec(`
    CREATE TABLE IF NOT EXISTS payout_changes (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      organizer_id TEXT NOT NULL,
      field TEXT NOT NULL,             -- bankIban | bankAccountHolder | paypalAccount
      old_value TEXT NOT NULL DEFAULT '',
      new_value TEXT NOT NULL DEFAULT '',
      factor TEXT NOT NULL DEFAULT '', -- authenticator | password | none (first-time set)
      actor TEXT NOT NULL DEFAULT 'organizer',
      effective_at INTEGER,            -- unix ms; NULL = applied immediately
      cancelled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_payout_changes_event ON payout_changes(event_id, created_at);
  `);

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
