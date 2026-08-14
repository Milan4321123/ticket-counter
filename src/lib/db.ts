// Server-only: SQLite connection + schema.
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
  return db;
}

// Singleton that survives Next.js dev-server hot reloads.
export function getDb(): Database.Database {
  if (!global.__ticketDb) global.__ticketDb = createDb();
  return global.__ticketDb;
}
