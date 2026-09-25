// Server-only: try-it-yourself demo accounts.
//
// A visitor presses "Try the organizer demo" and gets their OWN organizer
// account, already full: an upcoming event with ticket types, a shop with
// items and photos, a few weeks of orders, collection codes being scanned,
// reviews, a promo code, referral rewards. Every portal page then works on
// real rows, because they ARE real rows.
//
// What makes that safe is a wall, and every brick of it lives in one of three
// places:
//
//   1. INVISIBLE. listPublishedEvents() leaves demo-owned listings out, so they
//      never reach the feed, the bazaar, the sitemap, festival pages or search.
//      Every public route that opens a listing by id or slug asks
//      listingOpenTo(), which only lets a demo listing through for the demo
//      account's own session. Nobody else can see a demo page, so nothing a
//      demo visitor types can be shown to a stranger.
//   2. NO MONEY. paymentOptionsFor() gives a demo listing one route — a
//      simulated payment — and the portal refuses payout details and payment
//      connections for demo accounts. There is no account for money to reach.
//   3. NO EMAIL. The demo account's address, and every buyer / waitlist /
//      question address typed into a demo listing, is rewritten to the reserved
//      `.invalid` domain, and sendMailAs() never sends to it.
//
// Uploads and cross-account actions (vendor stalls) are refused for demo
// accounts too, and the whole account deletes itself after DEMO_TTL_MS.
import crypto from 'crypto';
import sharp from 'sharp';
import { getDb } from './db';
import { deleteEventCompletely, getEventById, makeUniqueSlug, newId, type EventRow } from './events';
import { SoldOutError } from './inventory';
import { saveEventPhoto } from './media';
import { createOrder, finalizePaidOrder, getTicketsForOrder } from './orders';
import { currentOrganizer, hashPassword, PLAN_NEVER_EXPIRES } from './organizers';
import { createPromoCode } from './promos';
import { setReferralRewardSettings } from './referrals';
import { setSellerReply, writeReview } from './reviews';
import { holdSeats, normaliseSeatMap, sectionSeats, syncSeatedCaps } from './seats';
import { getEventTiers } from './events';

/** How long a demo account lives. */
export const DEMO_TTL_MS = 24 * 60 * 60 * 1000;

/** Live demo accounts across the whole site — a ceiling on what a script can make us build. */
export const MAX_LIVE_DEMOS = 300;

export const DEMO_EMAIL_DOMAIN = 'demo.invalid';

/** A fresh address nobody can receive mail at — see isUndeliverableAddress() in lib/email. */
export function demoAddress(tag: string): string {
  return `${tag}-${crypto.randomBytes(4).toString('hex')}@${DEMO_EMAIL_DOMAIN}`;
}

// ---------------- Who may open a listing ----------------

/**
 * May the person making THIS request open this listing's public pages
 * (event page, checkout, item pages, order-related APIs)?
 *
 * Published and not a demo: anyone. A demo listing: only the demo account that
 * owns it. Everything else (drafts, archived): nobody through this door — the
 * event page keeps its own owner-preview path for drafts.
 */
export async function listingOpenTo(event: EventRow | null | undefined): Promise<boolean> {
  if (!event || event.status !== 'published') return false;
  if (!event.isDemo) return true;
  const viewer = await currentOrganizer();
  return viewer !== null && viewer.id === event.organizerId;
}

// ---------------- Cleanup ----------------

const SWEEP_EVERY_MS = 10 * 60_000;
let lastSweepAt = 0;

/**
 * Delete demo accounts whose day is up, with every row they own. Throttled,
 * and cheap when there is nothing to do; called from the demo start route and
 * the portal guard, so it runs whenever anyone is using either.
 */
export function sweepExpiredDemos(force = false): number {
  const now = Date.now();
  if (!force && now - lastSweepAt < SWEEP_EVERY_MS) return 0;
  lastSweepAt = now;
  const expired = getDb()
    .prepare(`SELECT id FROM organizers WHERE is_demo = 1 AND demo_expires_at <= datetime('now')`)
    .all() as { id: string }[];
  let removed = 0;
  for (const { id } of expired) {
    try {
      deleteDemoAccount(id);
      removed++;
    } catch (e) {
      console.error(`Demo sweep: could not delete demo account ${id}:`, e);
    }
  }
  return removed;
}

/** Remove one demo account and everything it owns. Refuses anything that is not a demo. */
export function deleteDemoAccount(organizerId: string): void {
  const db = getDb();
  const row = db.prepare(`SELECT is_demo AS isDemo FROM organizers WHERE id = ?`).get(organizerId) as
    | { isDemo: number }
    | undefined;
  if (!row) return;
  if (!row.isDemo) throw new Error('Refusing to delete a real organizer account as a demo');

  const events = db.prepare(`SELECT id FROM events WHERE organizer_id = ?`).all(organizerId) as { id: string }[];
  for (const { id } of events) {
    // Rows deleteEventCompletely leaves alone (it keeps buyers' reviews and
    // waitlist entries for a real listing's own reasons) — a demo keeps nothing.
    for (const table of ['item_reviews', 'waitlist', 'promo_codes']) {
      const exists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table);
      if (exists) db.prepare(`DELETE FROM ${table} WHERE event_id = ?`).run(id);
    }
    deleteEventCompletely(id);
  }
  const tx = db.transaction(() => {
    for (const table of [
      'promo_codes',
      'referral_vouchers',
      'customer_cards',
      'marketing_consents',
      'contact_requests',
      'organizer_password_reset',
      'organizer_step_up',
      'organizer_login_code',
      'organizer_payment_connections',
      'payout_changes',
    ]) {
      // Some of these are created lazily by their own feature, so a fresh
      // database may not have them yet.
      const exists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table);
      if (exists) db.prepare(`DELETE FROM ${table} WHERE organizer_id = ?`).run(organizerId);
    }
    db.prepare(`DELETE FROM organizers WHERE id = ? AND is_demo = 1`).run(organizerId);
  });
  tx();
}

export function liveDemoCount(): number {
  return (
    getDb()
      .prepare(`SELECT COUNT(*) AS n FROM organizers WHERE is_demo = 1 AND demo_expires_at > datetime('now')`)
      .get() as { n: number }
  ).n;
}

// ---------------- Where "Try it" links land ----------------

export const DEMO_TARGETS = [
  'portal',
  'event',
  'shop',
  'orders',
  'insights',
  'checkin',
  'statements',
  'promos',
  'settings',
  'reviews',
  'buyer-event',
  'buyer-shop',
  'checkout',
  'kitchen',
  'kitchen-setup',
  'live',
  'appointments',
  'buyer-salon',
  'tools-event',
  'tools-shop',
  'tools-salon',
  'assistant',
] as const;
export type DemoTarget = (typeof DEMO_TARGETS)[number];

export function isDemoTarget(value: unknown): value is DemoTarget {
  return typeof value === 'string' && (DEMO_TARGETS as readonly string[]).includes(value);
}

/** The page a target means inside THIS demo account. */
export function demoTargetPath(organizerId: string, target: DemoTarget): string {
  const rows = getDb()
    .prepare(`SELECT id, slug, kind FROM events WHERE organizer_id = ? ORDER BY created_at ASC`)
    .all(organizerId) as { id: string; slug: string; kind: string }[];
  const event = rows.find((r) => r.kind !== 'shop');
  const shop = rows.find((r) => r.kind === 'shop' && r.slug.endsWith('-momo-kitchen')) ?? rows.find((r) => r.kind === 'shop');
  const salon = rows.find((r) => r.kind === 'shop' && r.slug.endsWith('-glow-beauty'));
  switch (target) {
    case 'assistant': {
      // A blank shop draft of the demo's own, with the setup assistant open —
      // the whole "describe it, it fills the form" flow from an empty page.
      // Reused while it is still blank, so a second visit does not stack drafts.
      const blank = getDb()
        .prepare(
          `SELECT id FROM events WHERE organizer_id = ? AND kind = 'shop' AND status = 'draft'
             AND description = '' AND id NOT IN (SELECT event_id FROM event_tiers)
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(organizerId) as { id: string } | undefined;
      let id = blank?.id;
      if (!id) {
        id = newId();
        getDb()
          .prepare(
            `INSERT INTO events (id, organizer_id, slug, status, kind, name, currency, total_capacity, sales_open, max_per_order, pay_within_days)
             VALUES (?, ?, ?, 'draft', 'shop', 'My new shop', 'EUR', 100, 1, 8, 5)`
          )
          .run(id, organizerId, makeUniqueSlug('My new shop'));
      }
      return `/portal/events/${id}/edit?assistant=1`;
    }
    case 'tools-event':
      return event ? `/portal/events/${event.id}` : '/portal';
    case 'tools-shop':
      return shop ? `/portal/events/${shop.id}` : '/portal';
    case 'tools-salon':
      return salon ? `/portal/events/${salon.id}` : '/portal';
    case 'event':
      return event ? `/portal/events/${event.id}/edit` : '/portal';
    case 'shop':
      return shop ? `/portal/events/${shop.id}/edit` : '/portal';
    case 'orders':
      return event ? `/portal/events/${event.id}/orders` : '/portal';
    case 'insights':
      return event ? `/portal/events/${event.id}/insights` : '/portal';
    case 'checkin':
      return shop ? `/portal/events/${shop.id}/checkin` : '/portal';
    case 'statements':
      return '/portal/statements';
    case 'promos':
      return '/portal/promos';
    case 'settings':
      return '/portal/settings';
    case 'reviews':
      return '/portal/reviews';
    case 'buyer-event':
      return event ? `/e/${event.slug}` : '/portal';
    case 'buyer-shop':
      return shop ? `/e/${shop.slug}` : '/portal';
    case 'checkout':
      return event ? `/e/${event.slug}/checkout` : '/portal';
    case 'kitchen':
      return shop ? `/portal/events/${shop.id}/kitchen` : '/portal';
    case 'appointments':
      return salon ? `/portal/events/${salon.id}/kitchen` : '/portal';
    case 'buyer-salon':
      return salon ? `/e/${salon.slug}` : '/portal';
    case 'live':
      return shop ? `/portal/events/${shop.id}/live` : '/portal';
    case 'kitchen-setup':
      return shop ? `/portal/events/${shop.id}/edit?tab=kitchen` : '/portal';
    default:
      return '/portal';
  }
}

// ---------------- Building a sandbox ----------------

const BUYERS = [
  'Sushma Karki', 'Bikash Thapa', 'Anjali Shrestha', 'Rohan Gurung', 'Pooja Rai', 'Suman Magar',
  'Nirmala Tamang', 'Prakash Adhikari', 'Sabina Lama', 'Dipesh KC', 'Kabita Basnet', 'Ramesh Poudel',
  'Asmita Sherpa', 'Nabin Bhandari', 'Laxmi Joshi', 'Sagar Limbu', 'Manisha Bista', 'Kiran Dahal',
  'Jenny Müller', 'Tobias Weber', 'Priya Sharma', 'Aarav Khadka', 'Sita Neupane', 'Hari Oli',
];

interface Palette {
  a: string;
  b: string;
  ink: string;
  accent: string;
}

/** A simple generated picture: a gradient, a big word, a small line. No external files. */
async function picture(title: string, sub: string, p: Palette, w = 960, h = 720): Promise<Buffer> {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const size = Math.max(48, Math.min(120, Math.floor((w * 1.4) / Math.max(title.length, 6))));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/>
    </linearGradient>
    <radialGradient id="r" cx="0.25" cy="0.2" r="0.8">
      <stop offset="0" stop-color="${p.accent}" stop-opacity="0.45"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#r)"/>
  <circle cx="${w * 0.82}" cy="${h * 0.25}" r="${h * 0.32}" fill="${p.accent}" opacity="0.12"/>
  <text x="50%" y="52%" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800"
        font-size="${size}" fill="${p.ink}">${esc(title)}</text>
  <text x="50%" y="${52 + 11}%" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="600"
        font-size="${Math.round(size * 0.32)}" fill="${p.ink}" opacity="0.8" letter-spacing="4">${esc(sub.toUpperCase())}</text>
  <text x="${w - 28}" y="${h - 26}" text-anchor="end" font-family="Helvetica Neue, Arial, sans-serif" font-weight="700"
        font-size="22" fill="${p.ink}" opacity="0.55" letter-spacing="3">DEMO</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function isoDaysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** SQLite's 'YYYY-MM-DD HH:MM:SS' for a moment `daysAgo` days back (fractions allowed). */
function sqliteAgo(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
}

function pick<T>(items: T[], i: number): T {
  return items[i % items.length];
}

/** Deterministic-enough spread: the i-th of n values between lo and hi. */
function spread(i: number, n: number, lo: number, hi: number): number {
  return lo + ((hi - lo) * ((i * 7919) % n)) / Math.max(1, n - 1);
}

export interface DemoSandbox {
  organizerId: string;
  eventId: string;
  shopId: string;
}

/**
 * Build one visitor's demo account and everything in it. Takes a second or so
 * (the pictures are rendered with sharp). The caller signs the visitor in.
 */
export async function createDemoSandbox(): Promise<DemoSandbox> {
  const db = getDb();
  const organizerId = crypto.randomUUID();
  const short = organizerId.slice(0, 6);
  const expiresAt = new Date(Date.now() + DEMO_TTL_MS).toISOString().replace('T', ' ').slice(0, 19);

  db.prepare(
    `INSERT INTO organizers (id, email, name, password_hash, status, plan_paid_until, notes, must_change_password,
                             is_demo, demo_expires_at, referral_rewards_since)
     VALUES (?, ?, ?, ?, 'active', ?, ?, 0, 1, ?, datetime('now', '-30 days'))`
  ).run(
    organizerId,
    demoAddress('organizer'),
    'Anita Shrestha',
    // A random password nobody is told: the demo is entered by its session
    // cookie only, and there is no way to sign in to it again once that ends.
    hashPassword(crypto.randomBytes(24).toString('base64url')),
    PLAN_NEVER_EXPIRES,
    'Try-it-yourself demo account (lib/demo.ts). Deleted automatically.',
    expiresAt
  );

  try {
    const eventId = await buildDemoEvent(organizerId, short);
    const shopId = await buildDemoShop(organizerId, short);
    seedEventOrders(eventId);
    seedSeating(eventId);
    seedShopOrders(shopId);
    seedKitchen(shopId);
    await buildDemoSalon(organizerId, short);
    createPromoCode(organizerId, {
      code: 'DASHAIN10',
      kind: 'percent',
      amountCents: 0,
      percent: 10,
      eventId: '',
      maxRedemptions: 100,
      expiresOn: isoDaysFromNow(60),
    });
    setReferralRewardSettings(organizerId, 3, 500);
    return { organizerId, eventId, shopId };
  } catch (e) {
    // Half a demo is worse than none: take it all down and let the visitor retry.
    try {
      deleteDemoAccount(organizerId);
    } catch {
      /* best effort */
    }
    throw e;
  }
}

const EXAMPLE_IBAN = 'DE89370400440532013000'; // the published documentation example IBAN
const DEMO_NOTE =
  'This is a DEMO listing inside a try-it-yourself account. It is visible only to the person who opened the demo, ' +
  'payments are simulated, no emails are sent, and it is deleted after 24 hours.';

async function buildDemoEvent(organizerId: string, short: string): Promise<string> {
  const db = getDb();
  const id = crypto.randomUUID();
  const date = isoDaysFromNow(12);
  db.prepare(
    `INSERT INTO events (id, organizer_id, slug, status, kind, name, artist, description, date_display, event_date,
       venue_name, address, city, currency, total_capacity, sales_open, max_per_order, pay_within_days,
       bank_account_holder, bank_iban, bank_bic, bank_name, show_remaining, assistant_context, payout_locked,
       pay_transfer, pay_paypal, pay_stripe)
     VALUES (?, ?, ?, 'published', 'event', ?, ?, ?, ?, ?, ?, ?, ?, 'EUR', 300, 1, 8, 5, ?, ?, '', 'Demo Bank', 1, ?, 1, 1, 0, 0)`
  ).run(
    id,
    organizerId,
    `demo-${short}-dashain-night`,
    'Dashain Night — Live Music & Dinner',
    'The Kathmandu Collective',
    'A full evening for Dashain: live Nepali folk and modern songs, a dinner of sel roti, goat curry and achar, ' +
      'and a dance floor until late. Families welcome — children under 6 go free.\n\n' +
      'Doors open at 18:00, dinner from 18:30, music from 20:00.\n\n' +
      `(${DEMO_NOTE})`,
    'Saturday evening · Doors 18:00 · Music 20:00',
    date,
    'Gemeinschaftssaal Kreuzberg',
    'Oranienstraße 1, 10999 Berlin',
    'Berlin',
    'Anita Shrestha',
    EXAMPLE_IBAN,
    'Parking: street parking on Oranienstraße, U-Bahn Kottbusser Tor is 5 minutes away. Dinner includes a vegetarian option. ' +
      'Age: all ages. Tickets are not refundable but can be passed to a friend.'
  );

  const tiers: [string, string, number, number, number, number, string][] = [
    // key, name, price, cap, student, seatsPerUnit, description
    ['standard', 'Standard', 2500, 180, 0, 1, 'Entry, dinner and the whole evening.'],
    ['student', 'Student', 1500, 60, 1, 1, 'Same as Standard — bring your student ID to the door.'],
    ['table8', 'Table of 8', 18000, 8, 0, 8, 'A reserved table for eight near the stage — one booking, eight QR tickets.'],
    ['vip', 'VIP front row', 4500, 20, 0, 1, 'Front-row seats, welcome drink and a meet & greet after the show.'],
  ];
  const insTier = db.prepare(
    `INSERT INTO event_tiers (id, event_id, tier_key, name, price_cents, cap, unlimited, status, student_only,
       description, details, media_id, sort, seats_per_unit)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'on-sale', ?, ?, '', NULL, ?, ?)`
  );
  tiers.forEach(([key, name, price, cap, student, spu, desc], i) =>
    insTier.run(crypto.randomUUID(), id, key, name, price, cap, student, desc, i, spu)
  );

  const warm: Palette = { a: '#3b0a18', b: '#12051a', ink: '#fff5f7', accent: '#ff4d6d' };
  const cover = await saveEventPhoto(id, 'image/png', await picture('Dashain Night', 'Live music · Dinner · Berlin', warm));
  const avatar = await saveEventPhoto(
    id,
    'image/png',
    await picture('KC', 'The Kathmandu Collective', { a: '#1b1035', b: '#0b0717', ink: '#f3edff', accent: '#8b5cf6' }, 600, 600)
  );
  await saveEventPhoto(id, 'image/png', await picture('Dinner', 'Sel roti · Goat curry · Achar', { ...warm, accent: '#f59e0b' }));
  await saveEventPhoto(id, 'image/png', await picture('On stage', 'Folk & modern Nepali songs', { ...warm, accent: '#22d3ee' }));
  db.prepare(`UPDATE events SET cover_media_id = ?, poster_media_id = ?, profile_media_id = ? WHERE id = ?`).run(
    cover.id,
    cover.id,
    avatar.id,
    id
  );

  db.prepare(`INSERT INTO event_faqs (id, event_id, question, answer, sort) VALUES (?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(), id, 'Is dinner included?', 'Yes — every ticket includes dinner, with a vegetarian option.', 0
  );
  db.prepare(`INSERT INTO event_faqs (id, event_id, question, answer, sort) VALUES (?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(), id, 'Can children come?', 'Of course. Children under 6 go free and do not need a ticket.', 1
  );
  db.prepare(`INSERT INTO event_posts (id, event_id, body, media_id) VALUES (?, ?, ?, NULL)`).run(
    crypto.randomUUID(),
    id,
    'Table bookings are almost gone — only a few tables of 8 left. Thank you all for the love! 🙏'
  );
  db.prepare(
    `INSERT INTO event_questions (id, event_id, question, asker_name, asker_email) VALUES (?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), id, 'Is there a place to leave coats?', 'Sabina', demoAddress('asker'));
  return id;
}

const SHOP_ITEMS: [string, string, number, number, string, Palette][] = [
  ['chicken-momo', 'Chicken momo (10 pcs)', 900, 40, 'Steamed, with tomato-sesame achar on the side.', { a: '#3a1a08', b: '#120904', ink: '#fff7ed', accent: '#fb923c' }],
  ['veg-momo', 'Veg momo (10 pcs)', 800, 40, 'Cabbage, paneer and spring onion, with achar.', { a: '#0f2e17', b: '#06120a', ink: '#f0fdf4', accent: '#4ade80' }],
  ['jhol-momo', 'Jhol momo (10 pcs)', 1050, 25, 'Momo in a warm sesame-tomato soup.', { a: '#3b1d05', b: '#140a03', ink: '#fffbeb', accent: '#f59e0b' }],
  ['sel-roti', 'Sel roti (6 pcs)', 700, 30, 'Made fresh the morning you collect.', { a: '#3a2a07', b: '#130e03', ink: '#fefce8', accent: '#facc15' }],
  ['aloo-achar', 'Aloo achar (500 g)', 650, 4, 'Potato achar with timur and sesame. Only a few left.', { a: '#3a0f0f', b: '#140505', ink: '#fef2f2', accent: '#f87171' }],
  ['family-box', 'Family box — 40 momo + achar', 3200, 12, 'Feeds 4–5 people. Mix chicken and veg.', { a: '#1e1b4b', b: '#0b0a1f', ink: '#eef2ff', accent: '#818cf8' }],
];

async function buildDemoShop(organizerId: string, short: string): Promise<string> {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO events (id, organizer_id, slug, status, kind, name, description, city, currency, total_capacity,
       sales_open, max_per_order, pay_within_days, bank_account_holder, bank_iban, bank_bic, bank_name, show_remaining,
       pickup_info, category, payout_locked, pay_transfer, pay_paypal, pay_stripe, address)
     VALUES (?, ?, ?, 'published', 'shop', ?, ?, 'Berlin', 'EUR', 500, 1, 10, 3, ?, ?, '', 'Demo Bank', 1, ?, 'khaja-food', 1, 1, 0, 0, '')`
  ).run(
    id,
    organizerId,
    `demo-${short}-momo-kitchen`,
    "Didi's Momo Kitchen",
    'Hand-folded momo, sel roti and achar from a small home kitchen in Neukölln. Order by Thursday, collect on ' +
      `Saturday.\n\n(${DEMO_NOTE})`,
    'Anita Shrestha',
    EXAMPLE_IBAN,
    'Collect on Saturdays, 12:00–17:00, from the kitchen in Neukölln — the address comes with your order. ' +
      'Show the QR code on your phone and we hand your order over.'
  );

  const cover = await saveEventPhoto(
    id,
    'image/png',
    await picture("Didi's Momo", 'Order ahead · Collect Saturday', { a: '#3a1a08', b: '#120904', ink: '#fff7ed', accent: '#fb923c' })
  );
  db.prepare(`UPDATE events SET cover_media_id = ?, poster_media_id = ?, profile_media_id = ? WHERE id = ?`).run(
    cover.id,
    cover.id,
    cover.id,
    id
  );

  const insTier = db.prepare(
    `INSERT INTO event_tiers (id, event_id, tier_key, name, price_cents, cap, unlimited, status, student_only,
       description, details, media_id, sort, seats_per_unit)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'on-sale', 0, ?, ?, ?, ?, 1)`
  );
  for (const [i, [key, name, price, cap, desc, palette]] of SHOP_ITEMS.entries()) {
    const photo = await saveEventPhoto(id, 'image/png', await picture(name.split(' (')[0].split(' —')[0], 'Didi’s Momo Kitchen', palette, 800, 800));
    insTier.run(crypto.randomUUID(), id, key, name, price, cap, desc, `${desc} Cooked the morning of collection.`, photo.id, i);
  }
  return id;
}

/** ~30 ticket orders over the last three weeks: most paid, a few awaiting a transfer. */
function seedEventOrders(eventId: string): void {
  const db = getDb();
  const plan: [string, number][] = [
    ['standard', 2], ['standard', 1], ['student', 1], ['standard', 4], ['vip', 2], ['standard', 2],
    ['table8', 1], ['student', 2], ['standard', 3], ['standard', 2], ['vip', 1], ['standard', 1],
    ['student', 1], ['standard', 2], ['standard', 5], ['table8', 1], ['standard', 2], ['student', 3],
    ['standard', 2], ['vip', 2], ['standard', 1], ['standard', 3], ['student', 1], ['standard', 2],
    ['standard', 2], ['standard', 1], ['student', 2], ['standard', 4],
  ];
  const n = plan.length;
  plan.forEach(([tier, qty], i) => {
    const name = pick(BUYERS, i * 5 + 3);
    const order = createOrder({
      eventId,
      buyerName: name,
      buyerEmail: demoAddress(name.split(' ')[0].toLowerCase()),
      items: [{ tierId: tier, quantity: qty }],
      paymentMode: 'transfer',
    });
    const ago = spread(i, n, 0.3, 21);
    db.prepare(`UPDATE orders SET created_at = ? WHERE id = ?`).run(sqliteAgo(ago), order.id);
    // The newest four are still waiting for their transfer — something for the
    // demo visitor to confirm on the Orders page.
    if (i >= n - 4) return;
    finalizePaidOrder(order.id, null);
    db.prepare(`UPDATE orders SET paid_at = ?, confirmed_via = 'reference' WHERE id = ?`).run(
      sqliteAgo(Math.max(0.1, ago - 1.2)),
      order.id
    );
  });
}

/** ~20 shop orders: paid, most collected (scanned), a few awaiting, with reviews. */
function seedShopOrders(shopId: string): void {
  const db = getDb();
  const keys = SHOP_ITEMS.map((s) => s[0]);
  const reviews: [number, string][] = [
    [5, 'Best momo I have had outside Kathmandu. The achar is perfect.'],
    [5, 'Ordered the family box for a birthday — everyone loved it.'],
    [4, 'Really good, collection was quick and easy with the QR code.'],
    [5, 'Sel roti exactly like my mother makes. Will order again for Tihar.'],
    [4, 'Jhol momo was great, would love a spicier option.'],
  ];
  const n = 20;
  let reviewed = 0;
  for (let i = 0; i < n; i++) {
    const name = pick(BUYERS, i * 7 + 1);
    const a = pick(keys, i);
    const b = pick(keys, i + 2);
    const items = a === b ? [{ tierId: a, quantity: 2 }] : [{ tierId: a, quantity: 1 + (i % 2) }, { tierId: b, quantity: 1 }];
    let order;
    try {
      order = createOrder({
        eventId: shopId,
        buyerName: name,
        buyerEmail: demoAddress(name.split(' ')[0].toLowerCase()),
        items,
        paymentMode: 'transfer',
      });
    } catch (e) {
      // A small-stock item (the achar) sells out partway — which is the point
      // of it. Skip this order rather than abandon the whole demo.
      if (e instanceof SoldOutError) continue;
      throw e;
    }
    const ago = spread(i, n, 0.5, 26);
    db.prepare(`UPDATE orders SET created_at = ? WHERE id = ?`).run(sqliteAgo(ago), order.id);
    if (i >= n - 3) continue; // awaiting payment
    finalizePaidOrder(order.id, null);
    db.prepare(`UPDATE orders SET paid_at = ?, confirmed_via = 'sender' WHERE id = ?`).run(
      sqliteAgo(Math.max(0.1, ago - 0.6)),
      order.id
    );
    // Collected on the Saturday after — except the most recent few, still to be picked up.
    if (i < n - 7) {
      for (const t of getTicketsForOrder(order.id)) {
        db.prepare(`UPDATE tickets SET checked_in_at = ? WHERE code = ?`).run(sqliteAgo(Math.max(0.05, ago - 2)), t.code);
      }
    }
    if (reviewed < reviews.length && i % 3 === 0) {
      const [rating, body] = reviews[reviewed++];
      try {
        const review = writeReview({ orderId: order.id, tierKey: a, rating, body });
        if (reviewed === 1) {
          const shop = getEventById(shopId);
          if (shop) setSellerReply(review.id, shop.organizerId, 'Thank you so much! See you on Saturday 🙏');
        }
      } catch (e) {
        console.error('Demo seed: review skipped:', e instanceof Error ? e.message : e);
      }
    }
  }
}

/** When this demo account is deleted (Unix ms), or null for a real account. */
export function demoExpiresAt(organizerId: string): number | null {
  const row = getDb()
    .prepare(`SELECT demo_expires_at AS at FROM organizers WHERE id = ? AND is_demo = 1`)
    .get(organizerId) as { at: string | null } | undefined;
  if (!row?.at) return null;
  const ms = Date.parse(`${row.at.replace(' ', 'T')}Z`);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The restaurant pack in the demo shop (lib/kitchen): collection slots every
 * day, eight tables, choices on the momo — and today's recent orders spread
 * across the kitchen board so it is alive the moment it opens.
 */
function seedKitchen(shopId: string): void {
  const db = getDb();
  db.prepare(`UPDATE events SET pickup_slots = ?, table_count = 8 WHERE id = ?`).run(
    JSON.stringify({ enabled: true, days: [0, 1, 2, 3, 4, 5, 6], start: '10:00', end: '22:00', stepMin: 30, perSlot: 6, leadMin: 30, daysAhead: 7 }),
    shopId
  );
  const momoChoices = JSON.stringify([
    { name: 'Spice', options: ['Mild', 'Medium', 'Hot'] },
    { name: 'Achar', options: ['Tomato-sesame', 'Timur', 'No achar'] },
  ]);
  for (const key of ['chicken-momo', 'veg-momo', 'jhol-momo', 'family-box']) {
    db.prepare(`UPDATE event_tiers SET choices = ? WHERE event_id = ? AND tier_key = ?`).run(momoChoices, shopId, key);
  }

  // A service's worth of fresh paid orders, so the board is busy on arrival.
  const rush: [string, number, string][] = [
    ['chicken-momo', 2, 'Sushma Karki'],
    ['jhol-momo', 1, 'Bikash Thapa'],
    ['veg-momo', 3, 'Jenny Müller'],
    ['family-box', 1, 'Rohan Gurung'],
    ['chicken-momo', 1, 'Asmita Sherpa'],
    ['sel-roti', 2, 'Hari Oli'],
    ['veg-momo', 1, 'Tobias Weber'],
  ];
  for (const [tierId, quantity, name] of rush) {
    try {
      const order = createOrder({
        eventId: shopId,
        buyerName: name,
        buyerEmail: demoAddress(name.split(' ')[0].toLowerCase()),
        items: [{ tierId, quantity }],
        paymentMode: 'transfer',
      });
      finalizePaidOrder(order.id, null);
    } catch (e) {
      if (!(e instanceof SoldOutError)) throw e;
    }
  }

  // A few collections in the last hour, so the live screen has a pulse.
  const recentCodes = db
    .prepare(
      `SELECT t.code FROM tickets t JOIN orders o ON o.id = t.order_id
       WHERE o.event_id = ? AND t.checked_in_at IS NOT NULL ORDER BY t.code LIMIT 9`
    )
    .all(shopId) as { code: string }[];
  recentCodes.forEach(({ code }, i) =>
    db.prepare(`UPDATE tickets SET checked_in_at = datetime('now', ?) WHERE code = ?`).run(`-${3 + i * 6} minutes`, code)
  );

  // The paid orders nobody has collected yet: make them today's service.
  const open = db
    .prepare(
      `SELECT o.id FROM orders o
       WHERE o.event_id = ? AND o.status = 'paid'
         AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.order_id = o.id AND t.checked_in_at IS NOT NULL)
       ORDER BY o.created_at DESC`
    )
    .all(shopId) as { id: string }[];
  const berlin = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date());
  const get = (t: string) => berlin.find((p) => p.type === t)?.value ?? '00';
  const today = `${get('year')}-${get('month')}-${get('day')}`;
  const nowMin = Number(get('hour')) * 60 + Number(get('minute'));
  const statuses = ['new', 'new', 'cooking', 'new', 'cooking', 'ready', 'cooking', 'ready', 'new', 'cooking', 'new'];
  const notes = ['', 'Extra achar please 🙏', '', 'I will be 10 minutes late', '', '', 'One without coriander', '', 'Birthday — could you add a candle?', '', ''];
  const picks = ['Hot|Timur', 'Mild|Tomato-sesame', 'Medium|No achar', 'Hot|Tomato-sesame'];
  open.slice(0, 11).forEach(({ id }, i) => {
    const m = Math.min(23 * 60 + 30, Math.ceil((nowMin + 15 + i * 15) / 30) * 30);
    const slot = `${today}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const table = i === 1 ? '3' : i === 5 ? '7' : i === 8 ? '5' : '';
    const items = db.prepare(`SELECT tier_id AS tierId FROM order_items WHERE order_id = ?`).all(id) as { tierId: string }[];
    const chosen: Record<string, Record<string, string>> = {};
    for (const it of items) {
      if (!['chicken-momo', 'veg-momo', 'jhol-momo', 'family-box'].includes(it.tierId)) continue;
      const [spice, achar] = pick(picks, i).split('|');
      chosen[it.tierId] = { Spice: spice, Achar: achar };
    }
    db.prepare(
      `UPDATE orders SET pickup_slot = ?, table_label = ?, order_note = ?, item_choices = ?, kitchen_status = ?,
              kitchen_updated_at = datetime('now', ?), paid_at = datetime('now', ?)
       WHERE id = ?`
    ).run(
      table ? null : slot,
      table,
      pick(notes, i),
      Object.keys(chosen).length ? JSON.stringify(chosen) : null,
      pick(statuses, i),
      `-${5 + i * 3} minutes`,
      `-${15 + i * 9} minutes`,
      id
    );
  });
}

/**
 * Reserved seating in the demo event (lib/seats): VIP front rows and a
 * Standard block, with the seeded Standard/VIP orders given real seats so the
 * map arrives part-sold, the way a hall looks a week before the show.
 */
function seedSeating(eventId: string): void {
  const db = getDb();
  const map = normaliseSeatMap(
    {
      enabled: true,
      stageLabel: 'Stage',
      sections: [
        { id: 'VIP', name: 'VIP front rows', tierKey: 'vip', rows: 2, seatsPerRow: 10, firstRow: 'A', aislesAfter: [5], blocked: [] },
        { id: 'STD', name: 'Standard', tierKey: 'standard', rows: 9, seatsPerRow: 16, firstRow: 'C', aislesAfter: [4, 12], blocked: ['STD-K-1', 'STD-K-16'] },
      ],
    },
    ['vip', 'standard']
  );
  if (!map) return;
  db.prepare(`UPDATE events SET seat_map = ? WHERE id = ?`).run(JSON.stringify(map), eventId);
  syncSeatedCaps(eventId, map, getEventTiers(eventId));

  // Hand out seats to the orders that already exist: each group together,
  // with a seat or two left between groups, the way a hall really fills.
  const pools = new Map<string, string[]>();
  for (const section of map.sections) pools.set(section.tierKey, sectionSeats(section).map((x) => x.id));
  const lines = db
    .prepare(
      `SELECT oi.order_id AS orderId, oi.tier_id AS tierId, oi.quantity FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.event_id = ? AND o.status IN ('claimed', 'paid') AND oi.tier_id IN ('vip', 'standard')
       ORDER BY o.created_at`
    )
    .all(eventId) as { orderId: string; tierId: string; quantity: number }[];
  for (const line of lines) {
    const pool = pools.get(line.tierId) ?? [];
    const picked = pool.splice(0, line.quantity);
    pool.splice(0, 1 + (line.quantity % 2)); // a gap before the next group
    if (picked.length === line.quantity) holdSeats(eventId, line.orderId, picked);
  }
}

/**
 * The appointment side of the restaurant pack: a beauty salon whose items are
 * services and whose time slots are appointments, one client at a time, with
 * today's bookings already on its board.
 */
async function buildDemoSalon(organizerId: string, short: string): Promise<string> {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO events (id, organizer_id, slug, status, kind, name, description, city, currency, total_capacity,
       sales_open, max_per_order, pay_within_days, bank_account_holder, bank_iban, bank_bic, bank_name, show_remaining,
       pickup_info, category, payout_locked, pay_transfer, pay_paypal, pay_stripe, address, pickup_slots)
     VALUES (?, ?, ?, 'published', 'shop', ?, ?, 'Berlin', 'EUR', 400, 1, 3, 3, ?, ?, '', 'Demo Bank', 0, ?, 'other', 1, 1, 0, 0, '', ?)`
  ).run(
    id,
    organizerId,
    `demo-${short}-glow-beauty`,
    'Glow Threading & Beauty',
    'Threading, mehendi and bridal make-up by appointment, in a small studio in Wedding. Book a time, pay ahead, ' +
      `and show your code when you arrive.\n\n(${DEMO_NOTE})`,
    'Anita Shrestha',
    EXAMPLE_IBAN,
    'The studio is in Wedding, five minutes from Leopoldplatz — the address comes with your booking. Please arrive five minutes early.',
    JSON.stringify({ enabled: true, days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '21:00', stepMin: 30, perSlot: 1, leadMin: 30, daysAhead: 14, purpose: 'appointment' })
  );
  const palette: Palette = { a: '#3b0a2e', b: '#12051a', ink: '#fdf2f8', accent: '#f472b6' };
  const cover = await saveEventPhoto(id, 'image/png', await picture('Glow Beauty', 'Threading · Mehendi · Make-up', palette));
  db.prepare(`UPDATE events SET cover_media_id = ?, poster_media_id = ?, profile_media_id = ? WHERE id = ?`).run(cover.id, cover.id, cover.id, id);
  const services: [string, string, number, string][] = [
    ['brows', 'Eyebrow threading', 800, '15 minutes. Clean, sharp shape.'],
    ['full-face', 'Full face threading', 1800, '30 minutes. Brows, upper lip, chin and sides.'],
    ['mehendi', 'Mehendi — both hands', 2500, 'About an hour. Traditional or Arabic design.'],
    ['hair', 'Haircut & blow-dry', 2200, '45 minutes, for any length.'],
    ['bridal-trial', 'Bridal make-up trial', 6000, 'Two hours, with the look photographed for you.'],
  ];
  const ins = db.prepare(
    `INSERT INTO event_tiers (id, event_id, tier_key, name, price_cents, cap, unlimited, status, student_only,
       description, details, media_id, sort, seats_per_unit, choices)
     VALUES (?, ?, ?, ?, ?, 0, 1, 'on-sale', 0, ?, ?, NULL, ?, 1, ?)`
  );
  services.forEach(([key, name, price, desc], i) =>
    ins.run(
      crypto.randomUUID(),
      id,
      key,
      name,
      price,
      desc,
      desc,
      i,
      key === 'mehendi' ? JSON.stringify([{ name: 'Design', options: ['Traditional Nepali', 'Arabic', 'Minimal'] }]) : null
    )
  );

  // Today's book: a handful of appointments across the day.
  const berlin = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (t: string) => berlin.find((p) => p.type === t)?.value ?? '00';
  const today = `${get('year')}-${get('month')}-${get('day')}`;
  const nowMin = Number(get('hour')) * 60 + Number(get('minute'));
  const book: [string, string, string, number][] = [
    ['brows', 'Laxmi Joshi', 'cooking', -30],
    ['mehendi', 'Nirmala Tamang', 'new', 30],
    ['full-face', 'Kabita Basnet', 'new', 90],
    ['hair', 'Priya Sharma', 'new', 150],
    ['bridal-trial', 'Sita Neupane', 'new', 210],
    ['brows', 'Manisha Bista', 'ready', -90],
  ];
  for (const [tierId, name, status, offset] of book) {
    const order = createOrder({
      eventId: id,
      buyerName: name,
      buyerEmail: demoAddress(name.split(' ')[0].toLowerCase()),
      items: [{ tierId, quantity: 1 }],
      paymentMode: 'transfer',
    });
    finalizePaidOrder(order.id, null);
    const m = Math.max(0, Math.min(23 * 60 + 30, Math.round((nowMin + offset) / 30) * 30));
    const slot = `${today}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    db.prepare(
      `UPDATE orders SET pickup_slot = ?, kitchen_status = ?, kitchen_updated_at = datetime('now'), item_choices = ? WHERE id = ?`
    ).run(slot, status, tierId === 'mehendi' ? JSON.stringify({ mehendi: { Design: 'Traditional Nepali' } }) : null, order.id);
  }
  return id;
}

// ---------------- Applying with a demo page ----------------

/** How long a demo that has been sent as an application waits for an answer. */
export const DEMO_APPLICATION_KEEP_DAYS = 30;

/**
 * A demo visitor sent their demo as an account application: keep it (and so
 * the page they built) for DEMO_APPLICATION_KEEP_DAYS instead of 24 hours, so
 * it is still there when the platform owner gets round to deciding.
 */
export function keepDemoForApplication(organizerId: string): void {
  getDb()
    .prepare(
      `UPDATE organizers SET demo_expires_at = datetime('now', ?) WHERE id = ? AND is_demo = 1`
    )
    .run(`+${DEMO_APPLICATION_KEEP_DAYS} days`, organizerId);
}

/**
 * Move a page built in a demo into a real, newly approved account, as a
 * PRIVATE DRAFT — the platform owner approved the person, and publishing is
 * still theirs to do from their own account.
 *
 * What moves: the page itself — texts, items, photos, design, FAQs, posts.
 * What does not: anything the demo made up or simulated — orders, tickets,
 * seat holds, reviews, questions, waitlist, codes — and the demo's example
 * payout account; the new owner enters their own. Returns false (and changes
 * nothing) when the listing is gone or no longer belongs to a demo.
 */
export function adoptDemoListing(eventId: string, organizerId: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT e.id FROM events e JOIN organizers o ON o.id = e.organizer_id WHERE e.id = ? AND o.is_demo = 1`
    )
    .get(eventId);
  if (!row) return false;
  const has = (table: string) =>
    Boolean(db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table));
  db.transaction(() => {
    // Reviews point at orders, so they go before the orders do.
    for (const table of ['event_questions', 'item_reviews', 'waitlist', 'promo_codes', 'payout_changes', 'marketing_sends']) {
      if (has(table)) db.prepare(`DELETE FROM ${table} WHERE event_id = ?`).run(eventId);
    }
    if (has('seat_holds')) db.prepare(`DELETE FROM seat_holds WHERE event_id = ?`).run(eventId);
    db.prepare(`DELETE FROM tickets WHERE order_id IN (SELECT id FROM orders WHERE event_id = ?)`).run(eventId);
    db.prepare(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE event_id = ?)`).run(eventId);
    db.prepare(`DELETE FROM orders WHERE event_id = ?`).run(eventId);
    if (has('event_stalls')) {
      db.prepare(`DELETE FROM event_stalls WHERE host_event_id = ? OR shop_event_id = ?`).run(eventId, eventId);
    }
    db.prepare(`DELETE FROM kv WHERE key = ?`).run(`scan_epoch:${eventId}`);
    db.prepare(
      `UPDATE events SET
         organizer_id = ?, status = 'draft', payout_locked = 0,
         bank_account_holder = '', bank_iban = '', bank_bic = '', bank_name = '', paypal_account = '',
         pending_bank_account_holder = NULL, pending_bank_iban = NULL, pending_bank_bic = NULL,
         pending_bank_name = NULL, pending_paypal_account = NULL, pending_payout_effective_at = NULL,
         pay_transfer = 1, pay_paypal = 0, pay_stripe = 0
       WHERE id = ?`
    ).run(organizerId, eventId);
  })();
  return true;
}
