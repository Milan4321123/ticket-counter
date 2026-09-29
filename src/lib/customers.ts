// Server-only: customer accounts. A buyer signs in with a six-digit code sent
// to their email, or with Google; either way what they prove is that they can
// read that mailbox, and the account IS that address. "My orders" is then the
// orders carrying it — safe to show, because the address is verified, which
// orders.buyer_email alone never is (see lib/buyerAccount.ts).
//
// Sessions are a signed cookie (id + expiry, HMAC with the site's signing
// secret), separate from the organizer and admin sessions.
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getSigningSecret } from './auth';
import { getDb } from './db';

export const CUSTOMER_COOKIE_NAME = 'customer_session';
export const CUSTOMER_SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

export interface Customer {
  id: string;
  email: string;
  name: string;
  googleSub: string | null;
  createdAt: string;
}

const COLS = `id, email, name, google_sub AS googleSub, created_at AS createdAt`;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(raw: unknown): string | null {
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return email.length > 3 && email.length <= 200 && EMAIL_RE.test(email) ? email : null;
}

function hmac(payload: string): string | null {
  const secret = getSigningSecret();
  return secret ? crypto.createHmac('sha256', secret).update(payload).digest('hex') : null;
}

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

/** A fresh six-digit code for this address (replacing any earlier one). */
export function createCustomerLoginCode(email: string): string {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const hash = hmac(`customer-code:${email}:${code}`);
  if (!hash) throw new Error('No signing secret configured');
  getDb()
    .prepare(
      `INSERT INTO customer_login_codes (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)
       ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`
    )
    .run(email, hash, Date.now() + CODE_TTL_MS);
  return code;
}

export type CodeVerdict = 'ok' | 'wrong' | 'expired' | 'too_many';

/** Check a code; a right one is spent, five wrong ones burn it. */
export function verifyCustomerLoginCode(email: string, rawCode: string): CodeVerdict {
  const db = getDb();
  const row = db.prepare(`SELECT code_hash AS hash, expires_at AS exp, attempts FROM customer_login_codes WHERE email = ?`).get(email) as
    | { hash: string; exp: number; attempts: number }
    | undefined;
  if (!row || row.exp < Date.now()) return 'expired';
  if (row.attempts >= MAX_CODE_ATTEMPTS) return 'too_many';
  const code = rawCode.replace(/\D/g, '');
  const hash = hmac(`customer-code:${email}:${code}`) ?? '';
  const ok = code.length === 6 && hash.length === row.hash.length && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(row.hash));
  if (!ok) {
    db.prepare(`UPDATE customer_login_codes SET attempts = attempts + 1 WHERE email = ?`).run(email);
    return row.attempts + 1 >= MAX_CODE_ATTEMPTS ? 'too_many' : 'wrong';
  }
  db.prepare(`DELETE FROM customer_login_codes WHERE email = ?`).run(email);
  return 'ok';
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export function getCustomer(id: string): Customer | null {
  return (getDb().prepare(`SELECT ${COLS} FROM customers WHERE id = ?`).get(id) as Customer | undefined) ?? null;
}

/** The account for a verified address — made on first sign-in. */
export function upsertCustomer(email: string, opts: { name?: string; googleSub?: string } = {}): Customer {
  const db = getDb();
  const name = (opts.name ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, 120);
  const existing = db.prepare(`SELECT ${COLS} FROM customers WHERE email = ?`).get(email) as Customer | undefined;
  if (existing) {
    db.prepare(
      `UPDATE customers SET last_login_at = datetime('now'),
         name = CASE WHEN name = '' THEN ? ELSE name END,
         google_sub = COALESCE(google_sub, ?)
       WHERE id = ?`
    ).run(name, opts.googleSub ?? null, existing.id);
    return getCustomer(existing.id)!;
  }
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO customers (id, email, name, google_sub, last_login_at) VALUES (?, ?, ?, ?, datetime('now'))`).run(
    id,
    email,
    name,
    opts.googleSub ?? null
  );
  return getCustomer(id)!;
}

export function setCustomerName(id: string, name: string): void {
  getDb()
    .prepare(`UPDATE customers SET name = ? WHERE id = ?`)
    .run(name.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120), id);
}

/**
 * Delete the account and everything that exists only because of it — the
 * saved basket and any sign-in code waiting for its address — in one
 * transaction. NOT the orders: those are the sellers' records (each seller is
 * the controller of its own sales) and are erased on their own clock by
 * lib/retention.ts, or earlier on request through the admin erase tool.
 *
 * Signing out is implied: a session cookie names the account id, and
 * currentCustomer() answers null once that row is gone. Returns false when
 * there was no such account.
 */
export function deleteCustomer(id: string): boolean {
  const db = getDb();
  return db.transaction(() => {
    const row = db.prepare(`SELECT email FROM customers WHERE id = ?`).get(id) as { email: string } | undefined;
    if (!row) return false;
    db.prepare(`DELETE FROM customer_baskets WHERE customer_id = ?`).run(id);
    db.prepare(`DELETE FROM customer_login_codes WHERE email = ?`).run(row.email);
    db.prepare(`DELETE FROM customers WHERE id = ?`).run(id);
    return true;
  })();
}

/** Delete every account for this address (there is at most one), with baskets and codes. */
export function deleteCustomersByEmail(email: string): { customers: number; baskets: number; loginCodes: number } {
  const db = getDb();
  const address = (email || '').trim();
  return db.transaction(() => {
    const ids = (db.prepare(`SELECT id FROM customers WHERE email = ?`).all(address) as { id: string }[]).map(
      (r) => r.id
    );
    let baskets = 0;
    for (const id of ids) baskets += db.prepare(`DELETE FROM customer_baskets WHERE customer_id = ?`).run(id).changes;
    const loginCodes = db.prepare(`DELETE FROM customer_login_codes WHERE email = ?`).run(address).changes;
    const customers = db.prepare(`DELETE FROM customers WHERE email = ?`).run(address).changes;
    return { customers, baskets, loginCodes };
  })();
}

/** The raw account row, for the customer's own data export. */
export function customerAccountRow(id: string): Record<string, unknown> | null {
  return (
    (getDb()
      .prepare(`SELECT id, email, name, google_sub AS googleSub, created_at AS createdAt, last_login_at AS lastLoginAt FROM customers WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined) ?? null
  );
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function createCustomerSessionToken(customerId: string): string {
  const exp = Date.now() + CUSTOMER_SESSION_TTL_MS;
  const sig = hmac(`customer:${customerId}:${exp}`);
  if (!sig) throw new Error('No signing secret configured');
  return `${customerId}.${exp}.${sig}`;
}

export function verifyCustomerSessionToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [id, expText, sig] = token.split('.');
  const exp = Number(expText);
  if (!id || !sig || !Number.isFinite(exp) || exp < Date.now()) return null;
  const want = hmac(`customer:${id}:${exp}`);
  if (!want || want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  return id;
}

/** The signed-in customer for this request, or null. */
export async function currentCustomer(): Promise<Customer | null> {
  const store = await cookies();
  const id = verifyCustomerSessionToken(store.get(CUSTOMER_COOKIE_NAME)?.value);
  return id ? getCustomer(id) : null;
}

export const customerCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: Math.floor(CUSTOMER_SESSION_TTL_MS / 1000),
};

// ---------------------------------------------------------------------------
// What the account shows
// ---------------------------------------------------------------------------

export interface CustomerOrder {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  paymentMode: string;
  eventName: string;
  eventSlug: string;
  kind: string;
  dateDisplay: string;
  items: number;
}

/** Every order carrying this (verified) address, newest first. */
export function ordersForCustomer(email: string): CustomerOrder[] {
  return getDb()
    .prepare(
      `SELECT o.id, o.status, o.total_cents AS totalCents, o.currency, o.created_at AS createdAt,
              o.payment_mode AS paymentMode, e.name AS eventName, e.slug AS eventSlug, e.kind,
              e.date_display AS dateDisplay,
              (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS items
       FROM orders o JOIN events e ON e.id = o.event_id
       WHERE o.buyer_email = ? COLLATE NOCASE AND o.buyer_erased_at IS NULL
         AND o.status IN ('paid', 'claimed', 'capturing')
       ORDER BY o.created_at DESC LIMIT 200`
    )
    .all(email) as CustomerOrder[];
}

export interface CustomerSubscription {
  token: string;
  eventName: string;
  everyDays: number;
  discountPct: number;
  nextOn: string;
  status: string;
}

export function subscriptionsForCustomer(email: string): CustomerSubscription[] {
  return getDb()
    .prepare(
      `SELECT s.token, e.name AS eventName, s.every_days AS everyDays, s.discount_pct AS discountPct,
              s.next_on AS nextOn, s.status
       FROM subscriptions s JOIN events e ON e.id = s.event_id
       WHERE s.buyer_email = ? COLLATE NOCASE AND s.status != 'cancelled'
       ORDER BY s.created_at DESC`
    )
    .all(email) as CustomerSubscription[];
}

// ---------------------------------------------------------------------------
// Google (optional — only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set)
// ---------------------------------------------------------------------------

export function googleSignInConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

// ---------------------------------------------------------------------------
// The basket, kept on the account so it follows the customer between devices.
// Stored as the browser sends it; it is only ever read back by its owner, and
// every price and limit in it is checked again by POST /api/orders at checkout.
// ---------------------------------------------------------------------------

export function getCustomerBasket(customerId: string): unknown[] {
  const row = getDb().prepare(`SELECT lines FROM customer_baskets WHERE customer_id = ?`).get(customerId) as { lines: string } | undefined;
  try {
    const parsed = row ? JSON.parse(row.lines) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCustomerBasket(customerId: string, lines: unknown[]): void {
  getDb()
    .prepare(
      `INSERT INTO customer_baskets (customer_id, lines, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(customer_id) DO UPDATE SET lines = excluded.lines, updated_at = excluded.updated_at`
    )
    .run(customerId, JSON.stringify(lines));
}
