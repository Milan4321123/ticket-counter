#!/usr/bin/env node
// Fill the bazaar with EXAMPLE shops, so a Nepali seller can see their own.
//
// Why this exists: /market groups every published shop by its shelf, and a
// bazaar with one shop on one shelf does not look like a bazaar — it looks
// like an empty building with a table in it. Anybody being shown this
// platform (a seller deciding whether to list, a community group deciding
// whether to point their members at it) judges it in about four seconds, from
// the browse page. This script stocks that page: real Nepali products, prices
// a diaspora buyer would recognise as sane, collection details that sound like
// a person wrote them, and a cover picture per shop.
//
// The point is not "look, the software works". The point is THIS COULD BE YOUR
// SHOP. Every listing is written as an invitation to the seller reading it —
// here is what your cardamom, your achar, your dhaka would look like on this
// site, and you can have it, free, in an afternoon — and every one of them
// says so in the first paragraph and points at /organizers, the page that
// signs sellers up. The truth underneath is identical to the old wording; only
// the feeling changed, from a warning to an offer.
//
// This file lives in a PUBLIC repository, and it is meant to be run against
// the LIVE SITE. Every safeguard below is therefore structural — a refusal, a
// random secret nobody keeps, a locked column — and not a warning in a comment.
//
// ---------------------------------------------------------------------------
// EVERY SHOP THIS WRITES SAYS WHAT IT IS, IN WORDS, WHERE A BUYER LOOKS.
// ---------------------------------------------------------------------------
// The sellers are invented and so are their collection addresses, and these
// rows are PUBLISHED: they show up in the feed, on /market and in the sitemap,
// underneath copy that promises the buyer that every shop belongs to a real
// Nepali seller near them. An example that hides inside that promise is a way
// to send somebody to a doorbell that does not exist. So each listing declares
// itself where a buyer cannot miss it:
//
//   · the listing NAME carries "(example shop)" — it is the card title, the
//     feed entry, the /market tile, the page heading, the browser tab and the
//     sitemap entry;
//   · the FIRST PARAGRAPH of the description says, in the seller's own voice,
//     that nobody is cooking or packing, that nothing here ships, and that
//     checkout will refuse an order — and then invites the reader to open a
//     shop exactly like it, free, at /organizers;
//   · the FIRST PARAGRAPH of the collection details says there is no address
//     and nobody to meet, and invites the reader the same way;
//   · the cover, tile and avatar art are stamped — "AN EXAMPLE SHOP · THIS
//     COULD BE YOURS", "THIS COULD BE YOUR SHOP", "EXAMPLE" — because the
//     pictures travel further than the page does;
//   · the seller's display name ends "(example seller)", so the Veranstalter
//     named on the page is not mistaken for a person you could ring;
//   · assistant_context tells the public AI assistant the same thing, and
//     tells it to send a curious visitor to /organizers.
//
// The bar that does not move: a buyer must never be able to believe they can
// order from one of these, or arrange a collection with a person who exists.
// Everything AFTER those first paragraphs is genuine product copy, deliberately
// good, because that copy is the thing being shown off.
//
// ---------------------------------------------------------------------------
// PAYMENT IS LEFT UNCONFIGURED, AND THE PAYOUT ACCOUNT IS LOCKED.
// ---------------------------------------------------------------------------
// Every shop this script writes has bank_account_holder, bank_iban, bank_bic,
// bank_name and paypal_account EMPTY, and it never writes the pending_* payout
// columns either. This is a showcase, not a store. Nothing here may be able to
// take a single euro from anyone.
//
// That is not merely a wish: with no payout route, POST /api/orders answers
// every attempted order on these listings with "Payment is not configured yet"
// (see the mode === 'transfer' guard in src/app/api/orders/route.ts). So the
// example shops browse, open, and price exactly like real ones, and the
// checkout correctly refuses at the last step. Somebody clicking through
// cannot accidentally send money into a shop that does not exist. That guard
// only speaks in ONE payment mode, which is why this script refuses to seed in
// any other — on production too, with no override of any kind. See "WHERE THIS
// REFUSES TO RUN" below.
//
// ***************************************************************************
// TAKE THE EXAMPLE BAZAAR DOWN BEFORE YOU CHANGE HOW THE SITE TAKES MONEY.
//
//     npm run seed:bazaar -- --clean     <- BEFORE touching PAYMENT_MODE,
//                                           PAYPAL_ENV, or the PayPal keys.
//
// What makes these seven listings harmless is not a property of the ROWS. It
// is a property of the ENVIRONMENT they are standing in. The rows are
// published, priced and sales-open, exactly like a real shop; the only reason a
// buyer cannot be charged is the one branch in POST /api/orders that exists
// solely in 'transfer' mode. This script checks that branch once, at seed
// time, and can never check it again — and these rows are meant to STAY UP for
// months.
//
// So the day PAYMENT_MODE stops resolving to 'transfer' — a PayPal integration
// switched on, PAYPAL_CLIENT_ID/SECRET added, PAYPAL_ENV=live, ALLOW_MOCK_
// PAYMENTS set — seven invented shops with invented collection addresses
// become genuinely orderable, against the platform's own PayPal credentials,
// with nothing in the code left to stop it. Nobody gets a warning: the change
// is made in the hosting dashboard, and the shops just quietly start working.
//
// The one action that removes the dependency is taking them down first. Same
// note is in GO-LIVE.md (§8) and PLATFORM.md (§2), because that is where
// somebody stands when they decide to change how payments work.
// ***************************************************************************
//
// Empty payout columns are only half of it. Every seeded shop is also written
// with payout_locked = 1, the column src/app/api/portal/events/[id]/route.ts
// sets the first time a listing is published ("from the first publish onwards
// this event can take money"). payoutChangeIsDelayed() in src/lib/payout.ts
// reads exactly that flag, so a payout account added to one of these shops is
// parked in the pending_* columns for PAYOUT_DELAY_MS (24 hours) and written
// into the audit trail — precisely as it would on a real listing that has
// already sold. On a real listing the same code also mails the organizer; here
// it mails an @seed.invalid address, which nobody reads. So on THESE rows
// payout_locked buys the 24-hour delay and the payout_changes record, and not
// the alarm — worth saying, because the delay and the record are what an owner
// would actually notice this by. Seeding with the flag at 0 would have
// handed anyone who got into a seeded account a published shop whose IBAN could
// be pointed anywhere and take effect the same second. It is the one place
// where "it's only example data" would have been a live-listing-shaped hole.
//
// The consequence, stated plainly because it will otherwise look like a bug:
// the portal's publish checklist would REFUSE to publish a priced listing with
// no way to be paid, and the same rule re-runs on every save of a live listing
// (src/app/api/portal/events/[id]/route.ts). This script writes
// status='published' straight into the row and deliberately bypasses that
// gate. That gate is right and stays right — it protects real sellers from
// listing something nobody can pay for. It is bypassed here only because the
// point of these rows is to be unpayable. The visible cost: opening a seeded
// shop in the portal and pressing Save will be refused until you either add a
// payout route or move it back to draft. That refusal is the guard doing its
// job, not damage from this script.
//
// ---------------------------------------------------------------------------
// THE THREE SELLER ACCOUNTS: SIGN-IN-ABLE LOCALLY, DEAD ON PRODUCTION.
// ---------------------------------------------------------------------------
// The accounts have to EXIST wherever the shops exist. Each one is the public
// Veranstalter printed on its listings ("Sold by Sarita Shrestha (example
// seller)"), and the listing page reads that row to print the name — the VAT
// position (§3 Abs. 11 UStG) depends on the seller being named, so an example
// shop with no account behind it is not an option.
//
// LOCALLY (none of the production signals below) they are also sign-in-able,
// on purpose: half of what this seed is for is walking somebody through the
// seller's side — the editor, the orders screen, the statement — and an
// account nobody can open cannot do that. The password is RANDOM PER RUN, from
// crypto, printed once at the end and stored nowhere but the scrypt hash.
//
// ON PRODUCTION no password to these accounts exists anywhere. The run still
// generates a random secret and still hashes it, and then DISCARDS the
// plaintext: it is never printed, never written, never leaves the closure that
// made it. Nobody knows it, so nobody can type it, and the @seed.invalid
// addresses mean password-reset mail and sign-in codes have nowhere to arrive.
// A live site is not a place to leave three published storefronts standing
// behind a password somebody once read off a terminal.
//
// Stated plainly, because the older wording here said "nobody can sign in as
// them, INCLUDING THE OWNER", and that was not true: the OWNER CAN restore
// access whenever they like, from /admin/organizers — "Reset password" calls
// resetOrganizerPassword() and shows the new one on screen, and the status
// control calls setOrganizerStatus(id, 'active') (see
// src/app/api/admin/organizers/[id]/route.ts). Both are two clicks. What is
// true is narrower and still worth having: this SCRIPT hands nobody a way in,
// so a password of these accounts never exists in a scrollback, a screenshot
// or a paste, and reaching them requires the admin panel — which is to say,
// the owner's own second factor.
//
// On production they are additionally written with status = 'disabled'. That
// was CHECKED before choosing it, not assumed: listPublishedEvents()
// (src/lib/events.ts) selects on events.status alone and never joins
// organizers, and the public listing page (src/app/e/[slug]/page.tsx) touches
// the organizer row only through getOrganizer(), which returns a disabled row
// exactly like an active one. Organizer status is read only by portal sign-in,
// the session check and password reset (src/lib/organizers.ts). So disabling
// hides nothing — the shops still render in the feed, on /market, in the
// sitemap and on their own pages, and still name their seller — while shutting
// the one door the account could ever be opened through. Locally the accounts
// stay 'active', so the portal can still be demonstrated.
//
//   CAN:    be shown to a visitor as the seller behind an example shop; and,
//           on a NON-production run only, sign in at /portal/login with the
//           password that run prints, and edit the seeded listings. The owner
//           can also reopen them at any time from /admin/organizers (reset the
//           password, set the status back to active) — see above.
//   CANNOT: reach any real organizer's listing, order or payout account (they
//           own nothing but seed-bazaar-* rows); take money (no payout route,
//           and checkout refuses); redirect money IMMEDIATELY (payout_locked = 1
//           means any account added waits 24 hours and is written to the audit
//           trail — the warning email is sent to an @seed.invalid address, so
//           what this actually buys is the delay and the record, not a warning
//           anybody reads); be recovered by email (the addresses are
//           @seed.invalid, so password-reset and sign-in codes have nowhere to
//           arrive — only the owner's admin panel can reopen them).
//
// There is deliberately no password literal in this file: a password committed
// to a public repository is a standing account on every machine this has ever
// been run against, and a published shop plus a known password is exactly how
// a payout account gets pointed at a stranger. Lose the local one and re-run.
//
// ---------------------------------------------------------------------------
// WHERE THIS REFUSES TO RUN.
// ---------------------------------------------------------------------------
// Hard refusal, exit 1, nothing written:
//
//   · A RUN THAT LOOKS LIKE THE LIVE SITE, without --yes-seed-production.
//     "Looks like the live site" is deliberately NOT NODE_ENV alone: neither
//     `npm run` nor the bare `node scripts/…` command printed below sets
//     NODE_ENV, so a script that trusted it would have waved the plain command
//     through on the server. It is read instead from three things that ARE
//     true there — NEXT_PUBLIC_BASE_URL naming a deployed origin rather than
//     localhost, NODE_ENV=production, and a database outside this checkout's
//     own ./data (GO-LIVE.md sets DATA_DIR=/data). ANY ONE of them is enough,
//     because being wrong in the cautious direction costs a developer one flag
//     and being wrong the other way costs a live site three sign-in-able
//     published storefronts. See PRODUCTION_SIGNALS below.
//     Publishing invented shops into the live feed, /market and the sitemap,
//     beside real sellers' listings, is a real decision and must be a
//     deliberate one — so it takes a flag nobody types by accident. WITH the
//     flag, the run prints a boxed banner naming the database file, the site's
//     base URL, why it read the run as production, and everything that is
//     about to become publicly visible, and then proceeds.
//   · Any resolved payment mode other than 'transfer'. THIS ONE HAS NO
//     OVERRIDE, on production least of all. The refusal that makes a
//     payout-less shop harmless lives in ONE branch of POST /api/orders:
//     `mode === 'transfer' && !hasBankRoute && !hasPaypalRoute`. In 'paypal'
//     mode the order is created against the platform's own PayPal credentials
//     and a buyer really can pay for a shop that does not exist; in 'mock'
//     mode the order is not refused at all, it completes as fake-paid. On a
//     live site that one branch is the only thing standing between an example
//     shop and a real buyer's money. So the mode is resolved HERE, mirroring
//     getPaymentMode() in src/lib/config.ts (including the .env files Next
//     would have loaded, which `node` does not), and anything but 'transfer'
//     stops the run with the reason spelled out.
//
// The one escape hatch, --i-know-checkout-will-not-refuse, exists because the
// default local resolution with no PAYMENT_MODE set is 'mock', and a developer
// with a clean checkout should be able to see the bazaar without editing their
// env. It is narrow by construction: it applies ONLY to the payment-mode
// refusal, only when the resolved mode is 'mock', and never when NODE_ENV is
// production or PAYPAL_ENV is live — so it cannot be the flag that seeds a
// machine where real money moves. It prints a loud banner every time.
//
// ---------------------------------------------------------------------------
// SAFE TO RE-RUN, AND ONLY EVER TOUCHES ITS OWN ROWS.
// ---------------------------------------------------------------------------
// This database holds the owner's REAL events, REAL organizers and REAL
// orders. So every row this script creates carries an unmistakable marker: its
// primary key starts with `seed-bazaar-`. Nothing without that prefix is ever
// read for deletion, updated, or otherwise disturbed. Seeding first removes
// any previous seed (so re-running updates the content instead of doubling it)
// and then writes a fresh set, and it refuses loudly rather than deleting
// anything that has real orders standing against it.
//
// Re-seeding renders every picture BEFORE it touches the database, and then
// removes the old seed and writes the new one inside a SINGLE transaction, so
// an interrupted run leaves the site exactly as it found it rather than with
// no example shops at all: see the comment above the render loop.
//
//   node scripts/seed-bazaar.mjs            -> (re)seed the example bazaar
//   node scripts/seed-bazaar.mjs --clean    -> take it all down again, and exit
//   npm run seed:bazaar
//   npm run seed:bazaar -- --clean
//
// On the live server, from the app directory, with the same env the app runs
// with (so DATA_DIR and NEXT_PUBLIC_BASE_URL point at the real database and
// the real domain — which is also how the run knows it is production):
//
//   npm run seed:bazaar -- --yes-seed-production
//   npm run seed:bazaar -- --clean          -> takes it all down again
//
// --clean needs no flag anywhere, production included: removing these rows is
// safe everywhere, and a script that could create a mess it then refuses to
// clean up would be worse than useless.
//
// Images are generated here with sharp — no downloads, no stock photos. The
// server has no internet at runtime and a stock photo would be somebody's
// licence problem two years from now. They are written under
// DATA_DIR/uploads/<eventId>/ with the same `<mediaId>.<ext>` naming
// src/lib/media.ts uses, and registered in event_media so /api/media/<id>
// serves them and lib/imageVariants.ts can render its cover/card/avatar crops.
import { randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Paths, resolved exactly as scripts/backup.mjs resolves them — but only
// after the .env files are read, so DATA_DIR set in a file (rather than in the
// shell) points this script at the same database the app uses. Hoisted call:
// loadEnvFiles is a function declaration further down.
// ---------------------------------------------------------------------------
loadEnvFiles();

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'tickets.db');

/** The marker. Every id this script writes begins with it; nothing else does. */
const MARKER = 'seed-bazaar-';

/**
 * The base URL exactly as configured, before any fallback — read here because
 * the production test below asks about it, and resolveBaseUrl()'s own fallback
 * asks about the production test.
 */
const CONFIGURED_BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || '').trim();

/** localhost in each of the spellings a base URL is realistically written in. */
function isLocalHostname(hostname) {
  const h = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost');
}

/** True when NEXT_PUBLIC_BASE_URL names a real deployed origin rather than a dev one. */
function baseUrlLooksDeployed(raw) {
  if (!raw) return false; // unset says nothing either way; the other signals answer
  try {
    return !isLocalHostname(new URL(raw.replace(/[\s,;]+$/, '').replace(/\/$/, '')).hostname);
  } catch {
    // Unparseable. It is certainly not "http://localhost:3000", and reading a
    // typo as "this is only a dev box" is the wrong direction to fail in.
    return true;
  }
}

/** True when the database is NOT inside this checkout's own ./data folder. */
function dbIsOutsideRepo() {
  const repoData = path.resolve(process.cwd(), 'data');
  const resolved = path.resolve(dataDir);
  return resolved !== repoData && !resolved.startsWith(repoData + path.sep);
}

/**
 * Why this run believes it is (or is not) the live site. Empty = not production.
 *
 * NODE_ENV alone was not an answer, and this is the hinge every safeguard in
 * this file hangs off. `npm run` does not set NODE_ENV, and neither does the
 * bare `node scripts/seed-bazaar.mjs` printed in this file's own header — so on
 * the live server the plain command used to resolve to "not production" and
 * would have seeded ACTIVE seller accounts, PRINTED their password to the
 * terminal, skipped both the --yes-seed-production refusal and the banner, and
 * then told the operator it had not touched production. That is exactly the
 * takeover the header promises is impossible, available by typing the command
 * the header itself documents.
 *
 * So production is read from things that are actually TRUE on the server,
 * three of them, ORed. The only safe failure here is "treated as production
 * when it was not": that costs a developer one extra flag, while the other
 * direction costs a live site three sign-in-able published storefronts.
 *
 *   · NEXT_PUBLIC_BASE_URL names a deployed origin. GO-LIVE.md step 2.4 sets
 *     it to https://martnepali.com on the server; a developer's .env.local
 *     says http://localhost:3000.
 *   · NODE_ENV=production — the original signal, still true whenever it is set.
 *   · The database is outside this repo's ./data. GO-LIVE.md step 2.3 mounts a
 *     persistent disk and sets DATA_DIR=/data, so the live database is never
 *     inside the checkout, while a dev database always is.
 *
 * A developer's machine trips none of these. The live server trips at least
 * two of them no matter how the script is invoked.
 */
const PRODUCTION_SIGNALS = [
  baseUrlLooksDeployed(CONFIGURED_BASE_URL)
    ? `NEXT_PUBLIC_BASE_URL is a deployed origin (${CONFIGURED_BASE_URL})`
    : null,
  process.env.NODE_ENV === 'production' ? 'NODE_ENV=production' : null,
  dbIsOutsideRepo() ? `the database is outside this checkout (${dbPath})` : null,
].filter(Boolean);

/**
 * Is this the live site?
 *
 * Read once, here, because almost everything below branches on it: the banner,
 * the seller accounts' status, whether a password is printed, and the wording
 * of the report.
 */
const isProduction = PRODUCTION_SIGNALS.length > 0;

const cleanOnly = process.argv.includes('--clean');

/**
 * The production opt-in. Long, specific, and impossible to type by accident —
 * which is the entire specification for this flag. Without it a production run
 * refuses exactly as it always has; with it the run is a deliberate act, and
 * says so in a banner before it writes anything.
 */
const PRODUCTION_FLAG = '--yes-seed-production';
const productionOptIn = process.argv.includes(PRODUCTION_FLAG);

/** See "WHERE THIS REFUSES TO RUN" at the top. Deliberately verbose to type. */
const MOCK_OVERRIDE_FLAG = '--i-know-checkout-will-not-refuse';
const mockOverride = process.argv.includes(MOCK_OVERRIDE_FLAG);

/**
 * getBaseUrl() from src/lib/config.ts, mirrored — same reason resolvePaymentMode
 * is mirrored below. It is printed in the production banner (an owner about to
 * publish seven shops should see WHICH SITE they land on) and it supplies the
 * /organizers link written into every listing, so a locally seeded shop links
 * to localhost and a production one links to the real domain.
 */
function resolveBaseUrl() {
  const raw = CONFIGURED_BASE_URL;
  if (raw) {
    const normalized = raw.replace(/[\s,;]+$/, '').replace(/\/$/, '');
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname === 'martnepali.com') parsed.hostname = 'www.martnepali.com';
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return normalized;
    }
  }
  return isProduction ? 'https://www.martnepali.com' : 'http://localhost:3000';
}

const BASE_URL = resolveBaseUrl();

/**
 * Where every example shop sends the seller who liked what they saw.
 *
 * /organizers is the page that recruits sellers, so it is the one link this
 * whole seed exists to deliver. Written without the scheme because descriptions
 * render as PLAIN TEXT (`.event-prose`, white-space: pre-line) — nothing here
 * becomes a clickable anchor, so it has to read like something a person can
 * retype.
 */
const ORGANIZERS_LINK = `${BASE_URL.replace(/^https?:\/\//, '')}/organizers`;

/**
 * Appended to every listing name that goes into the database.
 *
 * The name is the loudest text a shop has: the card title on /market and in
 * the feed, the page heading, the browser tab, the sitemap entry, the share
 * preview. If the listing declares itself in exactly one place, this is the
 * place. "(example shop)" over "(demo shop)" on purpose: an example is
 * something you are invited to copy, a demo is something being performed at
 * you — and it is every bit as unmistakably not-a-real-seller. (The cover art
 * carries its own stamp — see exampleStamp() below.)
 */
const EXAMPLE_NAME_SUFFIX = ' (example shop)';

/**
 * Prefixed to every assistant_context.
 *
 * assistant_context is read by the PUBLIC AI assistant, which answers buyers
 * on the listing page. It must be told that THIS LISTING is an example — and
 * explicitly not that the platform cannot take payments. That sentence would
 * be repeated, verbatim and confidently, on a site whose other listings are
 * real sellers taking real money.
 *
 * It also carries the invitation, because the assistant is the one part of the
 * page that can answer "wait, could I have one of these?" the moment it is
 * asked.
 */
const EXAMPLE_ASSISTANT_NOTE =
  'THIS LISTING IS AN EXAMPLE SHOP, published by the site itself to show Nepali sellers what their own ' +
  'shop here could look like. The seller, the stock and the collection address are invented, nothing ' +
  'here ships or can be collected, the listing has no payout account, and an order placed on it is ' +
  'refused at checkout. If anyone asks about buying, collecting, paying or meeting the seller, say ' +
  'plainly and warmly that this particular listing is an example and there is nothing to collect, and ' +
  'never offer a way to complete an order on it. If they like it, tell them they can open a shop just ' +
  `like it themselves — it is free and takes an afternoon — at ${ORGANIZERS_LINK}. This is true of THIS ` +
  'LISTING ONLY: other shops and events on this site belong to real sellers and organizers and take ' +
  'real orders, so never say that the site, the platform or its payments do not work. Everything after ' +
  'this note describes the products accurately and can be explained as written — that copy is exactly ' +
  'what a real listing looks like, which is the point of showing it.';

// ---------------------------------------------------------------------------
// Refuse to run anywhere it could matter, and announce it where it does.
//
// This runs before the database is even opened, so a refusal cannot half-write
// anything. --clean is exempt: removing seeded rows is safe everywhere, and a
// script that could create a mess it then refuses to clean up would be worse
// than useless.
// ---------------------------------------------------------------------------

/**
 * The env Next would have seen.
 *
 * `node scripts/…` loads no .env file at all, while the running app loads
 * .env.local then .env. Resolving the payment mode from a bare process.env
 * would therefore answer for an environment that does not exist — typically
 * 'mock' on a machine whose .env.local actually says transfer, or, far worse,
 * missing the PAYPAL_ENV=live that should have stopped the run. Real values
 * already in process.env always win, exactly as they do for Next.
 */
function loadEnvFiles() {
  for (const file of ['.env.local', '.env']) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const key = m[1];
      if (key in process.env) continue; // a real env var beats a file, as in Next
      let value = m[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/, '').trim(); // trailing comment
      }
      process.env[key] = value;
    }
  }
}

/**
 * getPaymentMode() from src/lib/config.ts, mirrored line for line — with one
 * deliberate substitution.
 *
 * Kept as a mirror rather than an import because that module is TypeScript and
 * pulls in the whole app. If the original ever changes, this has to change
 * with it — the refusal below is only as true as this function is.
 *
 * THE SUBSTITUTION: the original reads process.env.NODE_ENV; this reads
 * isProduction, the broader signal above. It has to answer for the environment
 * the APP runs in, and the app on the live server runs with NODE_ENV=production
 * whether or not the shell that launched this script did. Every difference the
 * substitution makes is in the same direction — it disables mock mode and
 * resolves 'auto' to 'paypal', both of which STOP this script rather than let
 * it through.
 */
function resolvePaymentMode() {
  const explicitMode = (process.env.PAYMENT_MODE || 'auto').toLowerCase();
  if (explicitMode === 'transfer') return 'transfer';
  if (process.env.PAYPAL_ENV === 'live') return 'paypal';
  const isProd = isProduction;
  const mockAllowed = !isProd || process.env.ALLOW_MOCK_PAYMENTS === 'true';
  if (explicitMode === 'mock') return mockAllowed ? 'mock' : 'paypal';
  if (explicitMode === 'paypal') return 'paypal';
  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) return 'paypal';
  return isProd ? 'paypal' : 'mock';
}

function refuse(reason, detail) {
  console.error(`\nREFUSING TO SEED — ${reason}\n`);
  for (const line of detail) console.error(`  ${line}`);
  console.error('\nNothing has been written. The database is exactly as it was.\n');
  process.exit(1);
}

/**
 * The payment mode this run resolved, kept for the production banner — which
 * has to be printed further down, after the shops it counts are defined.
 */
let resolvedPaymentMode = null;

/**
 * The boxed banner a production run prints before it writes anything.
 *
 * An owner who types the flag should not have to remember what the flag does.
 * It names the file that is about to change, the site the rows will appear on,
 * and what a stranger will see there — and it ends with the way to undo it,
 * because that is the sentence you want on screen when you change your mind.
 */
function announceProductionRun(paymentMode) {
  const line = (s = '') => console.log(`  #  ${s}`);
  console.log('\n  ####################################################################');
  line(`SEEDING THE LIVE SITE — ${PRODUCTION_FLAG} was given.`);
  line();
  line(`Database : ${dbPath}`);
  line(`Site     : ${BASE_URL}`);
  line(`Payments : PAYMENT_MODE resolves to '${paymentMode}'`);
  line();
  line('Read as the live site because:');
  for (const signal of PRODUCTION_SIGNALS) line(`  · ${signal}`);
  line();
  line('About to become PUBLICLY VISIBLE, to everyone, immediately:');
  line(`  · ${SHOPS.length} published example shops, in the feed, on /market, on their`);
  line("    own /e/<slug> pages and in the sitemap, beside real sellers'");
  line('    listings;');
  line(`  · ${SHOPS.length * 3} generated images served from /api/media;`);
  line(`  · ${SELLERS.length} seller accounts, named as the Veranstalter on those pages.`);
  line();
  line('Each one carries "(example shop)" in its name, says what it is in the');
  line('first paragraph of its description and of its collection details,');
  line('is stamped on its cover art, tells the AI assistant the same thing,');
  line(`and invites the reader to open their own shop at ${ORGANIZERS_LINK}.`);
  line();
  line('None of them can take a euro TODAY: no payout route on any of them, and');
  line(`in '${paymentMode}' mode checkout refuses the order outright. payout_locked = 1.`);
  line('That refusal is a property of PAYMENT_MODE, not of these rows — take');
  line('the bazaar down with --clean BEFORE you ever change how the site takes');
  line('money, or seven invented shops quietly become orderable.');
  line();
  line('This run hands nobody a password to the seller accounts: it is random,');
  line("hashed, and discarded unprinted, and the rows are written 'disabled'.");
  line('You can still reopen them from /admin/organizers whenever you want.');
  line();
  line('TAKE IT ALL DOWN AGAIN WITH:  npm run seed:bazaar -- --clean');
  console.log('  ####################################################################\n');
}

if (!cleanOnly) {
  if (isProduction && !productionOptIn) {
    refuse('this looks like the LIVE SITE.', [
      ...PRODUCTION_SIGNALS.map((s) => `· ${s}`),
      '',
      'This script publishes a set of invented shops, with invented sellers and invented',
      'collection addresses, straight into the public feed, /market and the sitemap.',
      'A production database has real sellers and real buyers in it, and their listings',
      'sit beside whatever this writes.',
      '',
      'If that is genuinely what you want — the example shops are meant to be seen by',
      'sellers, and the live site is where sellers are — say so explicitly:',
      '',
      `    npm run seed:bazaar -- ${PRODUCTION_FLAG}`,
      '',
      'That run prints exactly what is about to become public before it writes, and',
      '`npm run seed:bazaar -- --clean` takes all of it down again afterwards.',
    ]);
  }

  const paymentMode = resolvePaymentMode();
  resolvedPaymentMode = paymentMode;
  if (paymentMode !== 'transfer') {
    const detail = [
      `PAYMENT_MODE resolves to '${paymentMode}' here (PAYMENT_MODE=${process.env.PAYMENT_MODE || 'unset'},`,
      `PAYPAL_ENV=${process.env.PAYPAL_ENV || 'unset'}, PayPal credentials ${
        process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET ? 'present' : 'absent'
      }).`,
      '',
      'The seeded shops have no payout account, and the ONLY thing that makes that',
      "safe is one branch of POST /api/orders: in 'transfer' mode an order against a",
      'shop with no bank route and no PayPal route is refused outright.',
      '',
      paymentMode === 'paypal'
        ? "In 'paypal' mode that branch never runs: the order is created against the"
        : "In 'mock' mode that branch never runs: the order is not refused, it completes",
      paymentMode === 'paypal'
        ? "platform's own PayPal credentials, and a buyer can really pay for a shop that"
        : 'as a fake-paid order against a seller who does not exist, and the buyer is',
      paymentMode === 'paypal' ? 'does not exist.' : 'shown a collection code for a doorbell nobody will answer.',
      '',
      'Set PAYMENT_MODE=transfer and run it again.',
    ];
    // The mock override is a DEV convenience and nothing else. On production it
    // does not apply at all — not with the production flag, not with anything —
    // because on a live site this refusal is the only thing between an example
    // shop and a real buyer's money.
    if (paymentMode === 'mock' && mockOverride && !isProduction && process.env.PAYPAL_ENV !== 'live') {
      console.error('\n  ####################################################################');
      console.error(`  #  ${MOCK_OVERRIDE_FLAG}`);
      console.error('  #');
      console.error("  #  Seeding anyway with PAYMENT_MODE resolving to 'mock'. Checkout on");
      console.error('  #  these example shops will NOT be refused — an order will complete as a');
      console.error('  #  fake-paid order against a seller who does not exist. No real money');
      console.error('  #  can move in mock mode, but do not show this to anybody as if the');
      console.error('  #  checkout were behaving correctly, and do not leave it seeded on a');
      console.error('  #  machine other people can reach.');
      console.error('  ####################################################################\n');
    } else {
      detail.push(
        '',
        isProduction
          ? `${MOCK_OVERRIDE_FLAG} does NOT apply on production, and neither does`
          : paymentMode === 'mock'
            ? `On a dev machine only, ${MOCK_OVERRIDE_FLAG} seeds anyway and`
            : `${MOCK_OVERRIDE_FLAG} does NOT apply here — it covers`,
        isProduction
          ? `${PRODUCTION_FLAG}. There is no override for this one, anywhere.`
          : paymentMode === 'mock'
            ? 'explains loudly what you are giving up. It never applies to a live PayPal env.'
            : "the 'mock' resolution only, never a mode where real money can move."
      );
      refuse('checkout could not be trusted to refuse an order here.', detail);
    }
  }
}

// ---------------------------------------------------------------------------
// The sellers. Three accounts, because a marketplace with one seller is a
// shop; the shops below are split between them the way a real family business
// splits — the grower's son sells what the hills produce, the Newari kitchen
// sells what it cooks, and the importer runs the three non-food storefronts.
//
// The display name carries "(example seller)" because it is PUBLIC: it is the
// Veranstalter named on the listing and the name in "Ask … a question". A
// buyer must not come away thinking there is a Rajendra to ring.
//
// SELLER_STATUS: 'active' locally so the portal side can be walked through,
// 'disabled' on production so nobody can sign in as a published storefront.
// Checked, not assumed — listPublishedEvents() filters on events.status alone,
// and the public page reads the organizer row only through getOrganizer() for
// the Veranstalter name, which a disabled row answers exactly like an active
// one. Disabling therefore hides nothing. See the header for the full note.
// ---------------------------------------------------------------------------
const SELLER_STATUS = isProduction ? 'disabled' : 'active';

const EXAMPLE_SELLER_NOTE =
  'EXAMPLE SELLER created by scripts/seed-bazaar.mjs. Not a real person; the public Veranstalter of the ' +
  'seed-bazaar-* example listings, which have no payout route and are payout_locked. ' +
  (isProduction
    ? "Seeded on production: the password was generated at random, hashed and thrown away unprinted, and this row is status='disabled' — nobody can sign in as it, and @seed.invalid makes password reset impossible. "
    : 'Password is random per run and printed by that run only. ') +
  'Delete with `npm run seed:bazaar -- --clean`.';

const SELLERS = [
  {
    id: `${MARKER}seller-rajendra`,
    name: 'Rajendra Limbu (example seller)',
    email: 'rajendra.limbu@seed.invalid',
    notes: EXAMPLE_SELLER_NOTE,
  },
  {
    id: `${MARKER}seller-sarita`,
    name: 'Sarita Shrestha (example seller)',
    email: 'sarita.shrestha@seed.invalid',
    notes: EXAMPLE_SELLER_NOTE,
  },
  {
    id: `${MARKER}seller-bimala`,
    name: 'Bimala Gurung (example seller)',
    email: 'bimala.gurung@seed.invalid',
    notes: EXAMPLE_SELLER_NOTE,
  },
];

// ---------------------------------------------------------------------------
// The shops. `category` keys come from src/lib/categories.ts and are checked
// against it below, so a renamed shelf fails here instead of quietly filing
// every example shop under "uncategorised".
// ---------------------------------------------------------------------------
const SHOPS = [
  // ------------------------------------------------------------------ HERO --
  {
    slug: 'taplejung-alaichi-ghar',
    id: `${MARKER}alaichi`,
    seller: `${MARKER}seller-rajendra`,
    name: 'Taplejung Alaichi Ghar',
    deva: 'ताप्लेजुङ अलैंची घर',
    mono: 'अ',
    kicker: 'Black cardamom · direct from the grower',
    foot: 'Smoke-dried over a wood fire in Taplejung · collect in Berlin',
    city: 'Berlin',
    category: 'groceries-spices',
    payWithinDays: 5,
    palette: { bg1: '#241a12', bg2: '#0e0b09', accent: '#d98a3d', ink: '#fdf6ec', sub: '#e8c79a' },
    description: `This shop could be yours. It is an example: there is no cardamom and no Rajendra, nobody is drying pods over a fire for this page, nothing ships, there is nothing to collect in Berlin, and checkout will refuse an order. What it is here for is to show you — if you grow something, cook something, or carry something back in a suitcase — what your own shop on this site would look like. You can have one exactly like it, free, set up in an afternoon: ${ORGANIZERS_LINK}. Now read on, because everything below is written the way I would write it for a real sack of alaichi, and that part is the whole point.

Large black cardamom — alaichi, अलैंची — grown by my family in Taplejung and dried the way it has always been dried on that hill.

The plants stand in the shade of alder up between roughly 1,400 and 2,000 metres, on the wet eastern ridges where the monsoon arrives hard and the mist sits in the valley until noon. Nepal grows more of this spice than anywhere else in the world, and it comes off the eastern hills — Taplejung and Ilam, and Panchthar, Sankhuwasabha, Terhathum and Bhojpur beside them. We cut in September and October, once the pods have gone deep red-brown at the base and the whole grove smells of it.

Then the fire, which is the part nobody sees. The pods go onto a bamboo rack over a slow wood fire — the bhatti — for two or three days, and the smoke goes into them. That smoke IS badi alaichi: woodsmoke, camphor, a little resin. It is why this is nothing like the small green elaichi that goes into mithai, and why a pod dried in a hot-air machine looks identical and tastes of almost nothing. We still dry over fire. It is slower, it is smokier, and it is the only version worth carrying this far.

How to use it, if it is new to you:
· One pod, cracked with the flat of a knife, into a pot of dal for the last ten minutes. Fish it out before serving.
· Two or three into a mutton or buff curry, in at the start with the onion, so the oil takes the smoke before anything else does.
· In the whole-spice bloom for biryani or pulao.
· Half a pod crushed with ginger in a pot of chiya on a cold morning. Half — a whole one will run the entire cup.

Keep the pods whole in a closed jar out of the sun and they hold for a year and more. Ground loses the top of its smell within a few months, which is exactly why the tin here is small.

We sell what we grow. When a size runs out it is out until my brother sends the next sack.`,
    pickupInfo: `Nothing to collect here — this is an example shop, so there is no flat, no Saturday and nobody to meet. What follows is the kind of thing you would write in this box for your own buyers, and what they would read before setting off to you. Your shop is free and takes an afternoon: ${ORGANIZERS_LINK}.

Collect on Saturdays, 3–7pm, from the flat in Neukölln — I'll send you the door and the bell name with your order.

I'm also at the Nepali mela stall in Tempelhof most months, and I bring pre-paid orders to the big Dashain and Tihar programmes in Berlin. Say which one you'd rather when you order and I'll hold it for you there.

Bring the QR code on your order — on your phone is fine, I scan it and that's it. If you can't make Saturday, message me and we'll find an evening; nothing here goes off in a week.`,
    assistantContext: `Harvest is September–October in Taplejung; stock is landed once or twice a year, so sizes sell out and come back. Whole pods keep 12–18 months in a sealed jar away from light; ground keeps about 3 months at full strength. This is LARGE black cardamom (badi alaichi / Amomum subulatum), not the small green cardamom used in sweets — it is smoky and savoury. Everything is smoke-dried over a wood fire, so a smoky smell in the packet is correct and not a fault. No shipping — collection in Berlin only. Packed by hand in a home kitchen that also handles tea and other whole spices, so nothing here is prepared in an allergen-controlled kitchen and no allergen-free claim is made; the gift box additionally contains a home-ground chiya masala (cardamom, clove, cinnamon, black pepper). Anyone avoiding a specific ingredient should be told to ask the seller before ordering.`,
    tiers: [
      {
        key: 'pods-100g',
        name: 'Whole pods · 100g',
        price: 1050,
        cap: 60,
        description: 'About 30–35 pods. The size to start with if you have never cooked with alaichi.',
      },
      {
        key: 'pods-250g',
        name: 'Whole pods · 250g',
        price: 2350,
        cap: 40,
        description: 'The jar most families come back for. Works out cheaper per gram than the 100g.',
      },
      {
        key: 'pods-500g',
        name: 'Whole pods · 500g',
        price: 4300,
        cap: 24,
        description: 'Half a kilo, for a big kitchen or for splitting between two or three households.',
      },
      {
        key: 'ground-60g',
        name: 'Ground alaichi tin · 60g',
        price: 950,
        cap: 30,
        description: 'Pods from the same sack, ground the week you collect. Small on purpose — ground fades fast.',
      },
      {
        key: 'gift-box',
        name: 'Gift box · pods, tin & chiya masala',
        price: 2800,
        cap: 18,
        description: '100g whole pods, the 60g ground tin and a small chiya masala, in a lokta paper box.',
      },
    ],
  },

  // ---------------------------------------------------------------- THE REST --
  {
    slug: 'ilam-orthodox-tea',
    id: `${MARKER}ilam-tea`,
    seller: `${MARKER}seller-rajendra`,
    name: 'Ilam Orthodox Tea',
    deva: 'इलाम चिया',
    mono: 'चि',
    kicker: 'Whole-leaf tea · Fikkal, Ilam',
    foot: 'Orthodox leaf from the Ilam gardens · collect in Berlin',
    city: 'Berlin',
    category: 'groceries-spices',
    payWithinDays: 5,
    palette: { bg1: '#12291d', bg2: '#08130d', accent: '#7fc98a', ink: '#f2fbf3', sub: '#bfe3c4' },
    description: `An example shop — and it could be yours. There is no tea and no seller here: nobody is folding pouches for this page, nothing ships, there is nothing to collect in Berlin, and checkout will refuse an order. It is published so a Nepali seller can see their own shop before they build it — your leaf, your prices, your collection days, on a page like this one, free and finished in an afternoon at ${ORGANIZERS_LINK}. Read on: the tea below is written exactly the way a real listing should be.

Orthodox tea from the gardens around Fikkal in Ilam — the next district over from the cardamom, though on hill roads that is a good half-day's drive, not a hop.

Orthodox means the leaf is rolled whole rather than cut to dust, so what ends up in your cup is a leaf you can see. First flush is picked in spring when the bushes wake up: light, a little floral, best drunk plain and not left standing. Second flush comes off in summer and is the one people describe as muscatel — rounder, darker, holds up to milk if that is how you take it. The green is pan-dried and grassy and forgives being brewed twice.

And because half the people who ask me want tea for a proper pot of chiya, not for a tasting: the CTC is here too. It is not fancy. It is what actually stands up to milk, ginger and a hard boil, and I would rather sell you the right leaf than the expensive one.

Brewing, briefly. First and second flush: water just off the boil, three minutes, no milk. Green: cooler water, two minutes, and stop there or it turns bitter. CTC: boil it with milk and ginger and be generous with the leaf.

Tea gets stale from air and light more than from time. Keep it in the pouch it comes in, folded shut, away from the spice shelf — it will pick up whatever is next to it.`,
    pickupInfo: `Nothing to collect — this is an example shop, with no address behind it and nobody to meet. The rest shows how a seller sets out their own collection days, and what a buyer is told before coming. Yours, free, at ${ORGANIZERS_LINK}.

Same collection as the cardamom shop: Saturdays 3–7pm in Neukölln, exact address sent with your order.

If you want to taste before you buy a whole pouch, come in the first hour — there is usually a pot going, and I would rather you drank a cup and picked the right one than guessed from a photo.`,
    assistantContext: `Orthodox whole-leaf tea from Ilam district, eastern Nepal (Fikkal area). First flush = spring, light and floral, drink without milk. Second flush = summer, muscatel, takes milk. Green = pan-dried, brew cooler and shorter. CTC dust is the everyday milk-tea leaf. All caffeinated; no herbal or decaf. Pouches are resealable; keep away from strong spices. Collection in Berlin only, no post.`,
    tiers: [
      {
        key: 'first-flush-100g',
        name: 'First flush 2026 · 100g',
        price: 1200,
        cap: 36,
        description: 'Spring picking, light and floral. No milk — it would bury it.',
      },
      {
        key: 'second-flush-100g',
        name: 'Second flush (muscatel) · 100g',
        price: 1050,
        cap: 42,
        description: 'Summer leaf, darker and rounder. The one most people end up buying twice.',
      },
      {
        key: 'ilam-green-100g',
        name: 'Ilam green · 100g',
        price: 850,
        cap: 64,
        description: 'Pan-dried and grassy. Cooler water, two minutes — it will take a second brew.',
      },
      {
        key: 'ctc-500g',
        name: 'Everyday CTC · 500g',
        price: 750,
        cap: 80,
        description: 'For real chiya: boiled hard with milk and ginger. Not fancy, and not trying to be.',
      },
      {
        key: 'chiya-masala-50g',
        name: 'Chiya masala · 50g',
        price: 550,
        cap: 45,
        description: 'Ground at home — cardamom, clove, cinnamon, a little black pepper. A pinch per pot.',
      },
    ],
  },

  {
    slug: 'achar-ghar-frankfurt',
    id: `${MARKER}achar`,
    seller: `${MARKER}seller-sarita`,
    name: 'Achar Ghar',
    deva: 'अचार घर',
    mono: 'अ',
    kicker: 'Achar, gundruk & sukuti · made at home',
    foot: 'Made in a home kitchen, in small batches · collect in Frankfurt',
    city: 'Frankfurt',
    category: 'khaja-food',
    payWithinDays: 2,
    palette: { bg1: '#3a1410', bg2: '#170807', accent: '#e5642f', ink: '#fff2ea', sub: '#f0b494' },
    description: `An example shop — nobody is cooking. There is no kitchen in Bockenheim, no Sarita and no jars, nothing ships, and checkout will refuse an order, so please don't plan a Sunday around it. It is here to show what a home kitchen's own page looks like on this site — and if you already cook for your community, you can have one exactly like it, free, in an afternoon: ${ORGANIZERS_LINK}. Read on; the achar below is written the way a real cook would write it, and that is the thing being shown off.

Achar the way it is made at home in a Frankfurt kitchen, in batches small enough that I still taste every one.

The lapsi achar is the one I am asked for most. Lapsi (Nepali hog plum) comes dried, gets soaked, cooked down with timur, chilli and a little mustard oil, and finishes sour first and hot second. The timur-golbheda is the tomato achar that belongs beside dal bhat — timur numbs the tongue slightly and that is meant to happen, it is not chilli.

Gundruk I ferment and dry myself: mustard and radish leaves, wilted, pressed into a jar, left to sour, then dried. Soak it fifteen minutes and it becomes gundruk ko jhol, or fry it into sadeko with tomato and dried chilli. Sinki is the same idea done with radish root and it is sharper.

Sukuti is buffalo, cut thin, spiced and air-dried slowly until it is properly hard. Eat it as it is with cold beer, or soften it in a pan with onion, timur and chilli for sukuti sadeko.

Everything is made in a home kitchen, not a factory. Jars keep two to three months in the fridge once opened. Nothing here is mild — if you cook for children, tell me when you order and I will make the next batch of tomato achar gentle.`,
    pickupInfo: `Nothing to collect — this is an example shop. There is no kitchen door in Bockenheim and nobody waiting on a Tuesday evening. The rest is how a cook fills in her own collection details, and what her buyers read before they come. Yours, free, at ${ORGANIZERS_LINK}.

Collect from my kitchen in Bockenheim, Frankfurt. Tuesday and Thursday evenings 6–9pm, or Sunday afternoon 2–6pm — whichever suits you, just tell me when you order.

I also bring orders to the Nepali Samaj gatherings and to the Teej programme, and if you work near the Hauptbahnhof I can meet you there on a weekday lunchtime.

Bring your QR code and a bag — the jars are heavier than people expect.`,
    assistantContext: `Home kitchen in Frankfurt-Bockenheim. Achar is made in small batches; jars keep 2–3 months refrigerated after opening. Lapsi achar is sour-then-hot; timur golbheda is a tomato achar with Sichuan-pepper tingle (numbing, not chilli heat). Gundruk and sinki are fermented, dried leaf/radish — soak before cooking. Sukuti is dried buffalo meat, not beef and not pork; contains no pork. Mustard oil is used. Nothing is mild by default; a milder tomato achar can be requested. Collection in Frankfurt only.`,
    tiers: [
      {
        key: 'lapsi-achar-200g',
        name: 'Lapsi ko achar · 200g',
        price: 650,
        cap: 24,
        description: 'Nepali hog plum with timur and mustard oil. Sour first, hot afterwards.',
      },
      {
        key: 'timur-golbheda-200g',
        name: 'Timur golbheda ko achar · 200g',
        price: 600,
        cap: 30,
        description: 'The tomato achar for dal bhat. The tingle is the timur — it is supposed to do that.',
      },
      {
        key: 'gundruk-100g',
        name: 'Gundruk · 100g',
        price: 500,
        cap: 66,
        description: 'Fermented and dried at home. Soak 15 minutes for jhol, or fry into sadeko.',
      },
      {
        key: 'sinki-150g',
        name: 'Mula ko sinki · 150g',
        price: 550,
        cap: 20,
        description: 'Radish-root sinki, sharper than gundruk. Wonderful in a winter soup.',
      },
      {
        key: 'sukuti-150g',
        name: 'Sukuti (buff) · 150g',
        price: 1200,
        cap: 18,
        description: 'Thin-cut buffalo, spiced and air-dried hard. Eat as it is, or pan-fry into sadeko.',
      },
    ],
  },

  {
    slug: 'newa-mithai-ghar',
    id: `${MARKER}mithai`,
    seller: `${MARKER}seller-sarita`,
    name: 'Newa Mithai Ghar',
    deva: 'नेवा मिठाई घर',
    mono: 'मि',
    kicker: 'Sel roti, juju dhau & lakhamari',
    foot: 'Fried and steamed to order on Saturdays · collect in Frankfurt',
    city: 'Frankfurt',
    category: 'sweets-bakery',
    payWithinDays: 2,
    palette: { bg1: '#4a2c07', bg2: '#1c1003', accent: '#f5b93f', ink: '#fff8e8', sub: '#f2d59a' },
    description: `An example shop — nothing is being fried. There is no Saturday batch, no clay pots and nobody to collect from, and checkout will refuse an order. It sits here to show a festival kitchen what its own page would look like: your sel roti, your Dashain and Tihar orders, your collection times, on a shop that is free and set up in an afternoon at ${ORGANIZERS_LINK}. Everything below is written the way a real one would write it — that is what there is to look at.

Festival sweets, made to order, in the quantities a family actually eats.

Sel roti is rice-flour batter — soaked, ground, sweetened lightly, rested overnight — piped into hot ghee in a ring. Crisp at the edge, soft in the middle, and honest: it is best on the day it is fried and second-best warmed in a dry pan the next morning. Do not microwave it.

Juju dhau, "the king of yoghurts", is set in the clay pot it comes in, the way it is done in Bhaktapur. The clay pulls water out through the wall, so it sets thick enough to stand a spoon in and tastes faintly of the pot. Please keep the pot — bring it back and there is a euro off the next one.

Lakhamari is the hard, glazed Newari bread-sweet that belongs at weddings and at Mha Puja: not very sweet, meant to be broken and dipped in tea. Yomari appears in the weeks around Yomari Punhi — steamed rice-flour parcels of chaku and sesame, and they are shaped by hand, which is why the number is small.

I fry and steam on Fridays and Saturdays, so order by Thursday evening if you want it for the weekend. Everything here has ghee in it. Say the word and I'll do a batch in oil instead.`,
    pickupInfo: `Nothing to collect — this is an example shop: no address, and nobody frying on Saturday morning. What follows is what a real festival kitchen puts in this box, and what its buyers are told. Open yours, free, at ${ORGANIZERS_LINK}.

Collect Saturday between 11am and 4pm from Bockenheim, Frankfurt — the address goes out with your order.

Sel roti is fried Saturday morning, so Saturday collection means it is still warm. Sunday collection is possible but you're eating it a day old, and I'd rather tell you that now than have you find out.

Big festival orders (Dashain, Tihar, Yomari Punhi) — message me a week ahead and I'll plan the batch around you.`,
    assistantContext: `Newari sweets made to order in a Frankfurt home kitchen. Frying happens Friday/Saturday; orders should be placed by Thursday evening for weekend collection. Sel roti is best the same day; reheat in a dry pan, never a microwave. Juju dhau is set in clay pots — pots are returnable for a discount, and it must be kept refrigerated and eaten within about 4 days. Lakhamari keeps 2–3 weeks in a tin. Yomari is seasonal, around Yomari Punhi (Dec). Contains ghee (dairy) and wheat in the lakhamari; sesame in the yomari filling; an oil-instead-of-ghee batch can be requested. Collection in Frankfurt only.`,
    tiers: [
      {
        key: 'sel-roti-6',
        name: 'Sel roti · 6 pieces',
        price: 600,
        cap: 72,
        description: 'Fried Saturday morning. Crisp edge, soft middle — eat it the same day if you can.',
      },
      {
        key: 'juju-dhau-400',
        name: 'Juju dhau · 400ml clay pot',
        price: 550,
        cap: 24,
        description: 'Set in the pot, Bhaktapur style. Bring the pot back for a euro off the next one.',
      },
      {
        key: 'lakhamari-250g',
        name: 'Lakhamari · 250g',
        price: 800,
        cap: 30,
        description: 'Hard, glazed, barely sweet. Break it into hot tea — that is how it is meant to be eaten.',
      },
      {
        key: 'yomari-4',
        name: 'Yomari · 4 pieces',
        price: 750,
        cap: 16,
        description: 'Steamed parcels of chaku and sesame. Shaped by hand, so never very many.',
      },
      {
        key: 'barfi-500g',
        name: 'Mixed barfi box · 500g',
        price: 1300,
        cap: 20,
        description: 'Milk barfi, coconut and pista, cut small. The box people take to somebody’s house.',
      },
    ],
  },

  {
    slug: 'dhaka-ghar-palpa',
    id: `${MARKER}dhaka`,
    seller: `${MARKER}seller-bimala`,
    name: 'Dhaka Ghar',
    deva: 'ढाका घर',
    mono: 'ढा',
    kicker: 'Handwoven dhaka · Palpa & Tehrathum',
    foot: 'Handwoven on looms in Palpa · collect in Munich',
    city: 'Munich',
    category: 'clothing-fabrics',
    payWithinDays: 5,
    palette: { bg1: '#1b1c46', bg2: '#0b0b1e', accent: '#e0568c', ink: '#f4f2ff', sub: '#bdbbe8' },
    description: `An example shop — there is no suitcase and no Bimala. Nothing here can be bought, tried on or collected in Munich, and checkout will refuse an order. It is here to show what your own shop could look like if you bring things back from home a suitcase at a time: the same page, your photographs, your prices, free and ready in an afternoon at ${ORGANIZERS_LINK}. The dhaka below is described just as a real seller would describe it.

Dhaka, woven on handlooms in Palpa and Tehrathum, brought over a suitcase at a time.

Dhaka is not a print. Every one of those geometric blocks is counted and picked into the warp by the weaver as she goes, which is why no two topis are quite identical and why the back of a good piece looks almost as tidy as the front. Look at the reverse before you buy anything called dhaka anywhere — that is the test.

The topis here are Palpali, stiffened properly so they hold their shape, in the usual sizes: tell me your hat size or the circumference of your head in centimetres when you order and I will pick from what I have. A topi that does not fit is a photo you don't take.

The shawls are wider, softer cotton, meant to be worn rather than folded in a drawer for Dashain. The cholo lengths are for anyone who has a tailor and knows what they want to do with 1.5 metres. The pashmina is a separate thing entirely — Kathmandu, 70% cashmere with 30% silk, which is the blend that gives it the shine and stops it pilling in a month.

Cold hand wash, no wringing, dry flat in the shade. Dhaka's dyes are good but they are not miracle-workers.`,
    pickupInfo: `Nothing to collect — this is an example shop, and there is nobody in Munich to meet. The rest is how a seller writes her own collection details, and what a buyer reads before coming. Yours takes an afternoon: ${ORGANIZERS_LINK}.

Collect from Munich — I'm ten minutes from Hauptbahnhof and I'm usually free evenings after 6pm and all day Sunday. Message me and we'll fix a time.

Please try the topi on when you collect. If it doesn't sit right I'll swap it there and then, and that is much easier than doing it afterwards.

I take a table at the Nepali cultural evenings in Munich and at Dashain in Stuttgart — pre-paid orders can be collected at either.`,
    assistantContext: `Handwoven dhaka fabric from Palpa and Tehrathum, Nepal, plus a Kathmandu pashmina (70% cashmere / 30% silk). Dhaka is handwoven, not printed — patterns vary slightly piece to piece and that is expected. Topis come in standard sizes; buyers should give head circumference in cm. Swaps for fit are possible at collection. Care: cold hand wash, dry flat in shade, do not wring or tumble dry. Cholo fabric is sold in 1.5m lengths, unstitched. Collection in Munich (also Stuttgart Dashain and Munich cultural evenings).`,
    tiers: [
      {
        key: 'dhaka-topi',
        name: 'Dhaka topi (Palpali)',
        price: 2600,
        cap: 30,
        description: 'Handwoven and properly stiffened. Give me your head size in cm when you order.',
      },
      {
        key: 'dhaka-shawl',
        name: 'Dhaka shawl',
        price: 4800,
        cap: 12,
        description: 'Soft cotton, wide enough to actually wear. Each one a different colourway.',
      },
      {
        key: 'dhaka-cholo-fabric',
        name: 'Dhaka cholo fabric · 1.5m',
        price: 3400,
        cap: 15,
        description: 'Unstitched length for your own tailor. Enough for a cholo with sleeves.',
      },
      {
        key: 'dhaka-muffler',
        name: 'Dhaka muffler',
        price: 2200,
        cap: 20,
        description: 'Narrow scarf, dhaka border at both ends. Wears well with a plain coat.',
      },
      {
        key: 'pashmina-70-30',
        name: 'Pashmina shawl · 70/30',
        price: 6500,
        cap: 8,
        description: '70% cashmere, 30% silk, from Kathmandu. The blend that keeps its shine.',
      },
    ],
  },

  {
    slug: 'pote-pasal-indrachowk',
    id: `${MARKER}pote`,
    seller: `${MARKER}seller-bimala`,
    name: 'Pote Pasal',
    deva: 'पोते पसल',
    mono: 'पो',
    kicker: 'Pote, tilhari & jhumka · Indrachowk beadwork',
    foot: 'Strung by hand in Indrachowk · collect in Munich',
    city: 'Munich',
    category: 'jewellery',
    payWithinDays: 5,
    palette: { bg1: '#10352c', bg2: '#061713', accent: '#3fbf9a', ink: '#effcf7', sub: '#a9e3d1' },
    description: `An example shop — no beads, no seller, nothing to collect, and checkout will refuse an order, so please don't come to Munich for it. It is here to show a bead-seller what her own page would look like on this site: your strands, your restringing, your Teej table, on a shop that costs nothing and is set up in an afternoon at ${ORGANIZERS_LINK}. Everything below is written the way a real one would write it.

Glass pote strung in Indrachowk, where the whole lane does nothing else.

If you have stood in that market you know the sound of it — trays and trays of glass beads, and a man who will thread the exact green you want in about four minutes while you wait. This is that work, brought over and sold here at something close to a sane price.

The plain strands come as seven threads with a proper clasp. Green is the everyday one; red is for the wedding photos and for Teej. Tell me if you want them longer or shorter than standard and I'll restring before you collect — it takes minutes and costs nothing.

The tilhari is the gold-plated cylinder on a pote strand, and I am honest about what it is: plated brass over a solid core, not gold. It looks right, it photographs beautifully, and it costs what a plated piece should cost. If someone is selling you "tilhari" at this price and calling it gold, walk away.

Jhumka are silver-plated with a hook, light enough to wear all evening. The rudraksha mala is five-mukhi, 108 beads plus the guru bead, strung on cotton.

Glass beads chip if you drop them on tile. Keep the strand in the pouch it comes in and it will outlast the outfit.`,
    pickupInfo: `Nothing to collect — this is an example shop, so there is no table and nobody to measure a strand against you. The rest shows how a seller fills in her own collection details, and what a buyer is told. Yours, free, at ${ORGANIZERS_LINK}.

Collection in Munich, near Hauptbahnhof, evenings after 6pm and Sundays — message me and we'll pick a time.

Restringing to your length is free and done while you wait, so if you're not sure how long you want a strand, come and we'll measure it against you.

I'm also at the Teej and Dashain programmes with a table — say so when you order and I'll bring it there instead.`,
    assistantContext: `Glass pote beadwork strung in Indrachowk, Kathmandu. Standard strands are 7 threads with a screw clasp; restringing to a different length is free at collection. The tilhari is GOLD-PLATED brass, not gold — stated openly. Jhumka are silver-plated, hook fitting. Rudraksha mala is 5-mukhi, 108 beads plus guru bead, on cotton thread. Glass beads chip if dropped; store in the pouch. Nickel-free hooks can be requested. Collection in Munich, or at Teej/Dashain programme tables.`,
    tiers: [
      {
        key: 'pote-green-7',
        name: 'Green pote · 7 strands',
        price: 1400,
        cap: 35,
        description: 'The everyday strand, with a screw clasp. Free restringing to your length.',
      },
      {
        key: 'pote-red-7',
        name: 'Red pote · 7 strands',
        price: 1200,
        cap: 75,
        description: 'For Teej and for wedding photographs. Deep red glass, not plastic.',
      },
      {
        key: 'tilhari',
        name: 'Tilhari on pote',
        price: 4800,
        cap: 10,
        description: 'Gold-plated cylinder on a green strand. Plated brass — said plainly, not gold.',
      },
      {
        key: 'jhumka',
        name: 'Jhumka earrings',
        price: 1900,
        cap: 22,
        description: 'Silver-plated, hook fitting, light enough to wear all evening.',
      },
      {
        key: 'rudraksha-mala',
        name: 'Rudraksha mala · 108',
        price: 2400,
        cap: 14,
        description: 'Five-mukhi beads, 108 plus the guru bead, strung on cotton.',
      },
    ],
  },

  {
    slug: 'himali-lokta-and-bowls',
    id: `${MARKER}lokta`,
    seller: `${MARKER}seller-bimala`,
    name: 'Himali Lokta & Bowls',
    deva: 'हिमाली लोक्ता',
    mono: 'लो',
    kicker: 'Lokta paper & hand-hammered bowls',
    foot: 'Bark paper and hammered bronze · collect in Munich',
    city: 'Munich',
    category: 'handicrafts',
    payWithinDays: 5,
    palette: { bg1: '#3d2b16', bg2: '#170f07', accent: '#c9a227', ink: '#fdf7e9', sub: '#e2cd9c' },
    description: `An example shop — there are no bowls to come and play. Nothing here can be bought or collected, the seller and the Munich address are invented, and checkout will refuse an order. It is here to show a craft seller what her own shop would look like: your paper, your bowls, your evenings, on a page like this one — free, and finished in an afternoon at ${ORGANIZERS_LINK}. Everything below is written the way a real seller would write it.

Lokta paper and singing bowls — the two things people ask me to bring back every single time.

Lokta is made from the bark of a Himalayan shrub that grows above 2,000 metres and regenerates from the cut stump in a few years, so the plant is not killed to make the paper. The bark is boiled, beaten and poured onto a frame to dry in the sun, which is why every sheet has a slightly different thickness and a deckle edge, and why it takes ink so well. Nepali government records were kept on this stuff for centuries; it does not yellow and it does not crumble.

The notebooks are hand-stitched with a cotton cord. The gift sheets are big enough to wrap a book or frame as they are.

The bowls are hand-hammered, not cast — you can see the hammer marks all round the outside and no two ring at the same pitch. The 12cm has a low, long note that keeps going for a surprisingly long time; the 9cm is brighter and easier to play, and comes with a cushion and a wooden striker. Run the striker slowly round the outside rim, pressing gently. If it rattles instead of singing, you are going too fast.

The felt is rolled and dyed by hand in Kathmandu, and I would rather tell you where the wool is from than let you assume: it is merino, imported from New Zealand, as nearly all Nepali felt is. It felts finer and takes the colours better than the local wool does. The hands are Nepali; the fleece flew in.`,
    pickupInfo: `Nothing to collect — this is an example shop, with no address and nobody to meet. The rest is what a real seller puts in this box so buyers know where to come. Set yours up, free, at ${ORGANIZERS_LINK}.

Munich, near Hauptbahnhof — evenings after 6pm and Sundays. Message me when you order and we'll fix a time.

Please come and play the bowls before you decide. They genuinely do not sound the same as each other, and the one that suits you is not always the biggest or the most expensive.

Also at the Munich Nepali cultural evenings; pre-paid orders can be picked up there.`,
    assistantContext: `Lokta paper is made from Himalayan Daphne bark, which regrows from the stump — the plant is not killed. Sheets vary in thickness and have deckle edges; that is inherent, not a defect. Notebooks are hand-stitched, A5, unlined. Singing bowls are hand-hammered (not cast), so each has its own pitch; the 12cm is deep and long-sustaining, the 9cm is brighter and comes with cushion and striker. Play by running the striker slowly round the outside rim with gentle pressure. Felt items are hand wet-felted and dyed in Kathmandu from imported New Zealand merino, not local wool — say so if asked about sourcing. Spot-clean only. Bowls can be played at collection before deciding. Collection in Munich.`,
    tiers: [
      {
        key: 'lokta-notebook-a5',
        name: 'Lokta notebook · A5',
        price: 1600,
        cap: 25,
        description: 'Hand-stitched, unlined, deckle edges. Takes fountain pen ink without bleeding.',
      },
      {
        key: 'lokta-sheets-3',
        name: 'Lokta gift sheets · 3',
        price: 900,
        cap: 70,
        description: 'Large block-printed sheets. Wrap a book, or frame one as it is.',
      },
      {
        key: 'felt-coasters-6',
        name: 'Felt ball coasters · set of 6',
        price: 1400,
        cap: 30,
        description: 'Hand-felted and dyed in Kathmandu, from imported merino. Survives a hot cup, unlike most nice things.',
      },
      {
        key: 'bowl-9cm',
        name: 'Singing bowl · 9cm, with cushion',
        price: 4800,
        cap: 9,
        description: 'Bright and easy to play. Comes with cushion and wooden striker.',
      },
      {
        key: 'bowl-12cm',
        name: 'Singing bowl · 12cm',
        price: 7200,
        cap: 6,
        description: 'Hand-hammered, low and long-sustaining. Come and play it before you choose.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// The production banner is printed HERE, and not up with the refusals, only
// because it counts the shops and sellers declared above (a `const` cannot be
// read before its declaration). Nothing has been written at this point — the
// database is not even open yet — so it still comes before the first INSERT,
// which is the property that matters.
// ---------------------------------------------------------------------------
if (!cleanOnly && isProduction) announceProductionRun(resolvedPaymentMode);

// ---------------------------------------------------------------------------
// Cover art. Generated, never downloaded: no internet at runtime, and a stock
// photo is a licence problem waiting to happen.
//
// Three renders per shop, one for each shape the site actually asks for (see
// VARIANTS in src/lib/imageVariants.ts). Each source is produced at EXACTLY the
// aspect of its variant, so the automatic crop has nothing to throw away and
// the composition survives intact:
//
//   cover  1600x740  (2.16:1)  -> the wide band across the top of the shop page
//   tile   1600x2000 (4:5)     -> the portrait card on /market and in the feed
//   avatar 512x512   (1:1)     -> the round profile mark over the cover
//
// That is also why no *_crop columns are written: a crop rectangle exists to
// rescue a photo that is the wrong shape, and these are the right shape.
// ---------------------------------------------------------------------------

const SANS = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const DEVA = 'Kohinoor Devanagari, Devanagari Sangam MN, Noto Sans Devanagari, Mangal, sans-serif';

/** XML-escape — shop names are ours, but a stray & would still break the SVG. */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

/**
 * Largest font size at which `text` still fits `maxWidth`.
 *
 * Rough on purpose: 0.55em average advance for this weight of Helvetica is
 * close enough, and erring small costs a little air rather than a title
 * running off the edge of the picture.
 */
function fitSize(text, maxWidth, maxSize) {
  const estimate = maxWidth / (Math.max(text.length, 1) * 0.55);
  return Math.max(24, Math.min(maxSize, Math.floor(estimate)));
}

/** Break a title into at most `maxLines` lines that each fit `maxChars`. */
function wrap(text, maxChars, maxLines) {
  const words = text.split(/\s+/);
  const lines = [''];
  for (const word of words) {
    const line = lines[lines.length - 1];
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || !line) lines[lines.length - 1] = candidate;
    else if (lines.length < maxLines) lines.push(word);
    else lines[lines.length - 1] = `${line} ${word}`;
  }
  return lines;
}

/**
 * The stamp on every picture: an invitation that is also the disclosure.
 *
 * The pictures travel further than the page does — the tile is what the feed,
 * /market and a shared link show, often with nothing but the name beside it.
 * A notice that only exists in the description is missing from exactly the
 * places a stranger meets these shops first. So the stamp stays, and the words
 * changed: "THIS COULD BE YOUR SHOP" tells a seller what to do with it and
 * tells a buyer, just as flatly as the old warning did, that this is not a
 * shop anyone is running.
 *
 * The pill is sized from the text length (0.92em per character covers this
 * weight plus its letter-spacing), so longer wording widens the box instead of
 * overflowing it — checked at all three sizes: 37 characters at 26px on the
 * 1600-wide cover, 23 at 32px centred on the 1600-wide tile, 7 at 30px on the
 * 512 avatar.
 */
function exampleStamp({ x, y, size, text, p, centred = false }) {
  const padX = Math.round(size * 0.9);
  const w = Math.round(text.length * size * 0.92) + padX * 2;
  const h = Math.round(size * 2.2);
  const rectX = centred ? Math.round(x - w / 2) : x;
  const textX = centred ? x : rectX + padX;
  return `<g>
    <rect x="${rectX}" y="${y - Math.round(h * 0.72)}" width="${w}" height="${h}" rx="${Math.round(h / 2)}"
          fill="${p.ink}" fill-opacity="0.1" stroke="${p.ink}" stroke-opacity="0.5" stroke-width="2"/>
    <text x="${textX}" y="${y}" text-anchor="${centred ? 'middle' : 'start'}" font-family="${SANS}"
          font-size="${size}" font-weight="700" letter-spacing="${(size * 0.18).toFixed(1)}"
          fill="${p.ink}" fill-opacity="0.9">${esc(text)}</text>
  </g>`;
}

/** The shared ground: gradient field, hatch texture, corner glow, floor shadow. */
function ground(w, h, p) {
  return `
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${p.bg1}"/>
      <stop offset="1" stop-color="${p.bg2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.2" cy="0.12" r="0.85">
      <stop offset="0" stop-color="${p.accent}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="${p.accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.bg2}" stop-opacity="0"/>
      <stop offset="1" stop-color="${p.bg2}" stop-opacity="0.85"/>
    </linearGradient>
    <pattern id="hatch" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
      <line x1="0" y1="0" x2="0" y2="16" stroke="${p.ink}" stroke-opacity="0.045" stroke-width="1.4"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#field)"/>
  <rect width="${w}" height="${h}" fill="url(#hatch)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <rect x="0" y="${Math.round(h * 0.45)}" width="${w}" height="${Math.round(h * 0.55)}" fill="url(#floor)"/>`;
}

/** The wide band at the top of the shop's own page. Left-aligned, roomy. */
function coverSvg(shop) {
  const w = 1600;
  const h = 740;
  const p = shop.palette;
  const x = 120;
  // No shop NAME on the cover on purpose: this image is the full-bleed hero
  // behind the page's own <h1>, so a baked-in title collides with it. A real
  // seller's cover photo carries no text either — only the stamp has to
  // survive here, because that one must be unmissable.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${ground(w, h, p)}
  <g opacity="0.6">
    <circle cx="${w - 90}" cy="${h / 2}" r="170" fill="none" stroke="${p.accent}" stroke-opacity="0.3" stroke-width="2"/>
    <circle cx="${w - 90}" cy="${h / 2}" r="250" fill="none" stroke="${p.accent}" stroke-opacity="0.17" stroke-width="2"/>
    <circle cx="${w - 90}" cy="${h / 2}" r="330" fill="none" stroke="${p.accent}" stroke-opacity="0.08" stroke-width="2"/>
  </g>
  ${exampleStamp({ x, y: 128, size: 26, text: 'AN EXAMPLE SHOP · THIS COULD BE YOURS', p })}
  <text x="${x}" y="242" font-family="${SANS}" font-size="26" font-weight="600" letter-spacing="7"
        fill="${p.accent}">${esc(shop.kicker.toUpperCase())}</text>
  <text x="${x}" y="330" font-family="${DEVA}" font-size="60" fill="${p.sub}">${esc(shop.deva)}</text>
  <rect x="${x}" y="384" width="132" height="5" fill="${p.accent}"/>
</svg>`;
}

/** The portrait card the browse page shows. Centred, stacked, quieter. */
function tileSvg(shop) {
  const w = 1600;
  const h = 2000;
  const p = shop.palette;
  const cx = w / 2;
  const lines = wrap(shop.name, 16, 2);
  const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), '');
  const titleSize = fitSize(longest, w - 300, 124);

  // Stacked from one cursor rather than from magic numbers, so a two-line name
  // pushes everything below it down instead of landing on top of it.
  let y = 1055; // first title baseline
  const titleY = lines.map((_, i) => y + i * Math.round(titleSize * 1.16));
  y = titleY[titleY.length - 1];
  const devaY = y + 128;
  const ruleY = devaY + 68;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${ground(w, h, p)}
  ${exampleStamp({ x: cx, y: 232, size: 32, text: 'THIS COULD BE YOUR SHOP', p, centred: true })}
  <g opacity="0.55">
    <circle cx="${cx}" cy="600" r="125" fill="none" stroke="${p.accent}" stroke-opacity="0.38" stroke-width="3"/>
    <circle cx="${cx}" cy="600" r="195" fill="none" stroke="${p.accent}" stroke-opacity="0.19" stroke-width="3"/>
    <circle cx="${cx}" cy="600" r="265" fill="none" stroke="${p.accent}" stroke-opacity="0.09" stroke-width="3"/>
  </g>
  <text x="${cx}" y="644" text-anchor="middle" font-family="${DEVA}" font-size="128"
        fill="${p.ink}" opacity="0.92">${esc(shop.mono)}</text>
  <text x="${cx}" y="930" text-anchor="middle" font-family="${SANS}" font-size="32" font-weight="600"
        letter-spacing="9" fill="${p.accent}">${esc(shop.kickerShort.toUpperCase())}</text>
  ${lines
    .map(
      (line, i) =>
        `<text x="${cx}" y="${titleY[i]}" text-anchor="middle" font-family="${SANS}" ` +
        `font-size="${titleSize}" font-weight="700" fill="${p.ink}">${esc(line)}</text>`
    )
    .join('\n  ')}
  <text x="${cx}" y="${devaY}" text-anchor="middle"
        font-family="${DEVA}" font-size="74" fill="${p.sub}">${esc(shop.deva)}</text>
  <rect x="${cx - 70}" y="${ruleY}" width="140" height="5" fill="${p.accent}"/>
  <text x="${cx}" y="1830" text-anchor="middle" font-family="${SANS}" font-size="34" letter-spacing="4"
        fill="${p.sub}" opacity="0.85">${esc(shop.city.toUpperCase())}</text>
</svg>`;
}

/** The round mark that sits over the cover. One Devanagari syllable, big. */
function avatarSvg(shop) {
  const s = 512;
  const p = shop.palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  ${ground(s, s, p)}
  <circle cx="${s / 2}" cy="${s / 2}" r="196" fill="none" stroke="${p.accent}" stroke-opacity="0.5" stroke-width="4"/>
  <text x="${s / 2}" y="${s / 2 + 40}" text-anchor="middle" font-family="${DEVA}" font-size="190"
        fill="${p.ink}">${esc(shop.mono)}</text>
  ${exampleStamp({ x: s / 2, y: 452, size: 30, text: 'EXAMPLE', p, centred: true })}
</svg>`;
}

/**
 * Render one SVG to JPEG bytes IN MEMORY.
 *
 * Deliberately not straight to disk: see the render loop below, where every
 * picture is produced before anything existing is removed.
 */
async function renderImage(svg) {
  return sharp(Buffer.from(svg)).jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toBuffer();
}

/**
 * Put rendered bytes where the app looks: DATA_DIR/uploads/<eventId>/, named
 * `<mediaId>.jpg` — the convention src/lib/media.ts writes and the only path
 * source the serving route trusts.
 */
function writeImage(eventId, mediaId, buffer) {
  const dir = path.join(dataDir, 'uploads', eventId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${mediaId}.jpg`);
  fs.writeFileSync(file, buffer);
  return file;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${dbPath} — start the app once so it creates and migrates one, then re-run.`);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

/**
 * Refuse to write into a schema that predates the columns we need.
 *
 * This script talks to SQLite directly, so it does NOT run the app's
 * migrations (those live in getDb() in src/lib/db.ts). Against an old file the
 * inserts would fail halfway with a raw SQLite error; this turns that into one
 * sentence the owner can act on.
 */
function requireColumns(table, columns) {
  const have = new Set(db.pragma(`table_info(${table})`).map((c) => c.name));
  const missing = columns.filter((c) => !have.has(c));
  if (missing.length) {
    console.error(
      `The ${table} table is missing ${missing.join(', ')} — this database predates them.\n` +
        `Start the app once (npm run dev) so its migrations run, then re-run this script.`
    );
    process.exit(1);
  }
}

requireColumns('events', [
  'kind',
  'pickup_info',
  'category',
  'cover_media_id',
  'poster_media_id',
  'profile_media_id',
  'paypal_account',
  'payout_locked',
  'assistant_context',
  'show_remaining',
  'fee_status',
  'fee_capacity',
]);
requireColumns('event_tiers', ['status', 'unlimited', 'seats_per_unit']);

/**
 * Does this table exist in the file in front of us?
 *
 * The delete list below names tables added at different times (event_stalls is
 * the newest). A database that predates one of them would otherwise fail the
 * cleanup with a raw "no such table" — and a cleanup that cannot run is the one
 * failure mode this whole script is written to avoid.
 */
const tableExists = (name) =>
  db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?`).get(name) !== undefined;

/**
 * Delete every row that hangs off one seeded listing, then the listing.
 *
 * foreign_keys is ON and NONE of the child tables in src/lib/db.ts declare
 * ON DELETE anything, so a single child row left behind does not warn — it
 * fails the DELETE with "FOREIGN KEY constraint failed" and takes the whole
 * transaction with it. The old version of this function deleted three tables
 * (event_media, event_tiers, events) out of the ten that point at events(id),
 * which meant ONE visitor question on an example shop permanently broke both
 * --clean AND re-seeding: on a live site, recoverable only by hand-written SQL.
 * A published listing invites visitor questions, waitlist sign-ups and stall
 * requests by existing, so this was not a remote possibility.
 *
 * The list and the ORDER are taken from deleteEventCompletely() in
 * src/lib/events.ts, which already solves exactly this problem for real
 * listings — posts before media (event_posts.media_id is a real foreign key
 * into event_media), sales rows before their orders. waitlist and promo_codes
 * are here and not there; if that ever turns out to be a bug in the app's own
 * delete, it is a bug there and not a reason for this to leak rows.
 *
 * Orders are deliberately NOT deleted here: removeSeed() refuses outright if a
 * seeded listing has any, because an example shop cannot legitimately have
 * been paid for and a cleanup script has no business steamrolling one.
 *
 * MUST be called inside a transaction — see the two callers.
 */
function deleteEventRows(id) {
  // Let go of the media pointers first: cover/poster/profile are plain columns,
  // but clearing them keeps the delete order obvious and survivable.
  db.prepare(
    `UPDATE events SET cover_media_id = NULL, poster_media_id = NULL, profile_media_id = NULL WHERE id = ?`
  ).run(id);

  db.prepare(`DELETE FROM event_posts WHERE event_id = ?`).run(id);
  db.prepare(`DELETE FROM event_media WHERE event_id = ?`).run(id);
  db.prepare(`DELETE FROM event_faqs WHERE event_id = ?`).run(id);
  db.prepare(`DELETE FROM event_questions WHERE event_id = ?`).run(id);
  db.prepare(`DELETE FROM event_tiers WHERE event_id = ?`).run(id);
  if (tableExists('waitlist')) db.prepare(`DELETE FROM waitlist WHERE event_id = ?`).run(id);
  if (tableExists('marketing_sends')) db.prepare(`DELETE FROM marketing_sends WHERE event_id = ?`).run(id);
  // No foreign key on these two, so they would not have blocked the delete —
  // they would have been left behind as rows describing a listing that no
  // longer exists. payout_changes holds IBANs IN FULL by design, which makes it
  // the one table that must never outlive its event (same reasoning as
  // deleteEventCompletely).
  if (tableExists('payout_changes')) db.prepare(`DELETE FROM payout_changes WHERE event_id = ?`).run(id);
  if (tableExists('promo_codes')) db.prepare(`DELETE FROM promo_codes WHERE event_id = ?`).run(id);
  if (tableExists('event_stalls')) {
    // A stall link points at a listing from EITHER side, so both directions go.
    db.prepare(`DELETE FROM event_stalls WHERE host_event_id = ? OR shop_event_id = ?`).run(id, id);
  }
  // The door-scanner revocation counter, keyed per event in lib/auth.
  db.prepare(`DELETE FROM kv WHERE key = ?`).run(`scan_epoch:${id}`);

  db.prepare(`DELETE FROM events WHERE id = ?`).run(id);
}

/**
 * Delete one seeded seller account and everything that references it.
 *
 * Same reasoning as deleteEventRows: organizer_password_reset and
 * organizer_login_code cascade on their own, but marketing_consents,
 * referral_vouchers, promo_codes and customer_cards all carry a plain
 * REFERENCES organizers(id) with no ON DELETE — any one of them would fail the
 * DELETE. A published storefront with a visible seller name can collect a
 * "keep me posted" consent or a customer card without anybody ordering
 * anything, so these are reachable, not theoretical.
 *
 * MUST be called inside a transaction.
 */
function deleteSellerRows(id) {
  if (tableExists('marketing_sends')) {
    db.prepare(
      `DELETE FROM marketing_sends WHERE consent_id IN (SELECT id FROM marketing_consents WHERE organizer_id = ?)`
    ).run(id);
  }
  if (tableExists('marketing_consents')) db.prepare(`DELETE FROM marketing_consents WHERE organizer_id = ?`).run(id);
  if (tableExists('referral_vouchers')) db.prepare(`DELETE FROM referral_vouchers WHERE organizer_id = ?`).run(id);
  if (tableExists('promo_codes')) db.prepare(`DELETE FROM promo_codes WHERE organizer_id = ?`).run(id);
  if (tableExists('customer_cards')) db.prepare(`DELETE FROM customer_cards WHERE organizer_id = ?`).run(id);
  db.prepare(`DELETE FROM organizers WHERE id = ?`).run(id);
}

/**
 * Everything this script has ever written, found and checked — but not yet
 * touched. Separated from the deleting so the seed path can do its checks,
 * open ONE transaction, and delete and re-insert inside it.
 *
 * Only rows whose primary key begins with MARKER are even looked at.
 */
function collectSeed() {
  const events = db.prepare(`SELECT id, name FROM events WHERE id LIKE ? || '%'`).all(MARKER);
  const sellers = db.prepare(`SELECT id, email FROM organizers WHERE id LIKE ? || '%'`).all(MARKER);

  // Real orders against a marker row: stop, loudly. An example shop has no way
  // to be paid, so if one has an order, something has happened that a cleanup
  // script has no business steamrolling.
  for (const ev of events) {
    const orders = db.prepare(`SELECT count(*) AS c FROM orders WHERE event_id = ?`).get(ev.id).c;
    if (orders > 0) {
      console.error(
        `REFUSING TO DELETE. The seeded listing "${ev.name}" (${ev.id}) has ${orders} order(s) against it.\n` +
          `Example shops have no payout route and cannot legitimately have orders, so this needs a human:\n` +
          `  sqlite3 "${dbPath}" "SELECT id, buyer_name, buyer_email, status, total_cents FROM orders WHERE event_id='${ev.id}';"\n` +
          `Nothing has been changed.`
      );
      process.exit(1);
    }
  }

  // A seeded seller must not own anything that is not seeded — deleting the
  // account would orphan (or refuse, via the foreign key) a real listing.
  for (const s of sellers) {
    const foreign = db
      .prepare(`SELECT count(*) AS c FROM events WHERE organizer_id = ? AND id NOT LIKE ? || '%'`)
      .get(s.id, MARKER).c;
    if (foreign > 0) {
      console.error(
        `REFUSING TO DELETE. The seeded account ${s.email} (${s.id}) owns ${foreign} listing(s) that are not seeded.\n` +
          `Move them to another organizer first. Nothing has been changed.`
      );
      process.exit(1);
    }
  }

  const eventIds = events.map((e) => e.id);
  const media = eventIds.length
    ? db
        .prepare(
          `SELECT id, event_id AS eventId, file_name AS fileName FROM event_media
            WHERE event_id IN (${eventIds.map(() => '?').join(',')})`
        )
        .all(...eventIds)
    : [];

  return { events, sellers, eventIds, media };
}

/** The database half of a removal. MUST be called inside a transaction. */
function deleteSeedRows({ eventIds, sellers }) {
  for (const id of eventIds) deleteEventRows(id);
  for (const s of sellers) deleteSellerRows(s.id);
}

/**
 * Every uploads/ or derived/ directory whose name carries the marker, read off
 * the FILESYSTEM rather than out of the database.
 *
 * The database is the wrong place to ask. A directory becomes an orphan
 * precisely when no row points at it any more — a run interrupted between the
 * files and the rows, a shop dropped from SHOPS, a slug renamed — so a sweep
 * driven by event_media can only ever find the ones that were never lost. The
 * marker is what makes scanning safe: nothing else on this disk is named
 * `seed-bazaar-*`, so nothing else can be matched by accident.
 */
function markerDirs(kind) {
  const root = path.join(dataDir, kind);
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith(MARKER))
      .map((e) => ({ id: e.name, full: path.join(root, e.name) }));
  } catch {
    return []; // no uploads/ or derived/ yet, which is a perfectly normal state
  }
}

/**
 * Remove marker-named image directories, EXCEPT the ones named in `keep`.
 *
 * `keep` is how a re-seed protects the pictures it has just written: the ids
 * are deterministic, so a re-seeded shop writes into the same directory it
 * already had.
 */
function sweepMarkerDirs(keep = new Set()) {
  let removed = 0;
  for (const kind of ['uploads', 'derived']) {
    for (const dir of markerDirs(kind)) {
      // The variant cache is a cache: dropping it for a re-seeded shop is
      // required, not optional, because the media ids stay the same while the
      // pictures behind them change.
      if (kind === 'uploads' && keep.has(dir.id)) continue;
      fs.rmSync(dir.full, { recursive: true, force: true });
      if (kind === 'uploads') removed += 1;
    }
  }
  return removed;
}

/**
 * Remove everything this script has ever written, and NOTHING else.
 *
 * The --clean path. The seed path does not call this: it needs the delete and
 * the re-insert inside ONE transaction (see below).
 */
function removeSeed({ quiet = false } = {}) {
  const seed = collectSeed();
  if (!seed.events.length && !seed.sellers.length) {
    // Rows gone but pictures left behind is exactly what an interrupted run
    // used to leave, so --clean sweeps the disk even when it finds no rows.
    const orphans = sweepMarkerDirs();
    if (!quiet) {
      console.log(
        orphans
          ? `No seeded bazaar in the database — removed ${orphans} leftover image folder(s).`
          : 'No seeded bazaar found — nothing to remove.'
      );
    }
    return { events: 0, sellers: 0 };
  }

  try {
    db.transaction(() => deleteSeedRows(seed))();
  } catch (e) {
    console.error(
      `Could not remove the seeded bazaar: ${e.message}\n` +
        `Something else in the database still references one of these rows.\n` +
        `Nothing has been changed — look at what points at ${MARKER}* and clear it by hand.`
    );
    process.exit(1);
  }

  // Files last: the rows are gone, so a half-deleted directory can never make
  // the app serve a broken image. The sweep is by marker and not by the media
  // list, so pictures whose rows went missing earlier go too.
  sweepMarkerDirs();

  if (!quiet) {
    console.log(
      `Removed ${seed.events.length} seeded shop(s), their tiers, ${seed.media.length} image(s), and ${seed.sellers.length} example seller account(s).`
    );
  }
  return { events: seed.events.length, sellers: seed.sellers.length };
}

if (cleanOnly) {
  removeSeed();
  db.close();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

// Categories are validated against the app's own list, read straight out of
// the TypeScript source. If a shelf is ever renamed, this fails here rather
// than filing every example shop under "uncategorised" and looking broken.
const categorySource = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'categories.ts'), 'utf8');
const knownCategories = new Set([...categorySource.matchAll(/key:\s*'([a-z-]+)'/g)].map((m) => m[1]));
for (const shop of SHOPS) {
  if (!knownCategories.has(shop.category)) {
    console.error(`"${shop.name}" uses category '${shop.category}', which src/lib/categories.ts no longer defines.`);
    process.exit(1);
  }
}

// A slug held by somebody else's listing is a collision we must not resolve by
// force — the example shop would either fail to insert or, worse, be renamed
// something nobody expects.
for (const shop of SHOPS) {
  const owner = db.prepare(`SELECT id FROM events WHERE slug = ?`).get(shop.slug);
  if (owner && !owner.id.startsWith(MARKER)) {
    console.error(`The slug "${shop.slug}" already belongs to a real listing (${owner.id}). Rename the example shop in this script.`);
    process.exit(1);
  }
}

/**
 * The seller accounts' password — random every run, and on production a secret
 * that stops existing the moment it has been hashed.
 *
 * The hash format is scrypt, salt:hash hex, exactly what hashPassword() in
 * src/lib/organizers.ts writes, so verifyPassword() reads these accounts back
 * with no special case.
 *
 * The plaintext never leaves this closure except as `printable`, and
 * `printable` is null on production. That is not decoration: these accounts own
 * PUBLISHED storefronts on a live site, and a password read off a terminal is a
 * password that ends up in a scrollback, a screenshot or a paste. Nobody
 * knowing it — not a stranger, not the owner — is the point, and the
 * @seed.invalid addresses mean it can never be reset into existence either.
 * Locally it is printed, because being able to sign in and show the seller's
 * side of the portal is half of what this seed is for.
 *
 * 24 base64url characters is far past MIN_PASSWORD_LENGTH
 * (src/lib/passwordPolicy.ts) with no run or repeat to trip its other rules, so
 * the local one can also be re-typed into the change-password form as-is.
 */
const ACCOUNT = (() => {
  const secret = randomBytes(18).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  const hash = `${salt}:${scryptSync(secret, salt, 64).toString('hex')}`;
  return { hash, printable: isProduction ? null : secret };
})();

const PLAN_NEVER_EXPIRES = '9999-12-31'; // the sentinel from src/lib/organizers.ts

const insertOrganizer = db.prepare(
  `INSERT INTO organizers (id, email, name, password_hash, status, plan_paid_until, notes, must_change_password)
   VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
);

const insertEvent = db.prepare(`
  INSERT INTO events (
    id, organizer_id, slug, status, kind, name, description,
    pickup_info, category, city, currency,
    total_capacity, capacity_unlimited, sales_open, show_remaining,
    max_per_order, pay_within_days,
    bank_account_holder, bank_iban, bank_bic, bank_name, paypal_account,
    payout_locked,
    assistant_context, fee_status, fee_paid_at, fee_cents, fee_capacity
  ) VALUES (
    @id, @organizerId, @slug, 'published', 'shop', @name, @description,
    @pickupInfo, @category, @city, 'EUR',
    @totalCapacity, 0, 1, 1,
    @maxPerOrder, @payWithinDays,
    '', '', '', '', '',
    1,
    @assistantContext, 'paid', datetime('now'), 0, @totalCapacity
  )
`);

const insertTier = db.prepare(`
  INSERT INTO event_tiers (id, event_id, tier_key, name, price_cents, cap, unlimited, status, student_only, description, sort, seats_per_unit)
  VALUES (?, ?, ?, ?, ?, ?, 0, 'on-sale', 0, ?, ?, 1)
`);

const insertMedia = db.prepare(
  `INSERT INTO event_media (id, event_id, file_name, mime, sort) VALUES (?, ?, ?, 'image/jpeg', ?)`
);

const setMediaPointers = db.prepare(
  `UPDATE events SET cover_media_id = ?, poster_media_id = ?, profile_media_id = ? WHERE id = ?`
);

// ---------------------------------------------------------------------------
// Render EVERYTHING first, into memory. Nothing is deleted until it worked.
//
// This used to remove the old seed and then render into the hole it had made.
// One failure inside sharp — a font that is not installed on this machine, a
// full disk, a typo in an SVG attribute — and the run died having destroyed
// the existing example bazaar without writing a replacement: the shops were gone
// from /market, the images were gone from disk, and the fix was "run it again
// and hope the same thing does not happen". A seed script's worst case must be
// "nothing changed", not "the bazaar is now missing".
//
// So the order is: render every picture to a buffer, and only once every one
// of them is in hand remove the previous seed and swap the new bytes in. If a
// render throws, it throws HERE, before the seeding transaction opens, and the
// database and the uploads directory are untouched.
//
// The rendering has to be finished before the database work in any case:
// sharp is async and a better-sqlite3 transaction is synchronous.
// ---------------------------------------------------------------------------
const rendered = [];
for (const shop of SHOPS) {
  // Short form of the kicker for the narrow tile, where the full line would
  // shrink to nothing: everything before the first middle dot.
  shop.kickerShort = shop.kicker.split('·')[0].trim();
  const ids = {
    cover: `${shop.id}-cover`,
    tile: `${shop.id}-tile`,
    avatar: `${shop.id}-avatar`,
  };
  const images = {
    cover: await renderImage(coverSvg(shop)),
    tile: await renderImage(tileSvg(shop)),
    avatar: await renderImage(avatarSvg(shop)),
  };
  rendered.push({ shop, ids, images });
}

// ---------------------------------------------------------------------------
// Every picture exists. NOW the old seed may go — inside the SAME transaction
// that puts the new one in.
//
// This used to be three steps with two commits between them: removeSeed()
// committed, then the images were written, then seedAll() committed. Ctrl-C,
// an OOM kill or a Render deploy landing in either gap left the LIVE site with
// no example shops at all and a set of uploads/seed-bazaar-*/ directories that
// a later --clean could no longer find, because the rows naming them were gone.
// The recovery was "run it again and hope", on a public site, in the dark.
//
// Both halves are synchronous — better-sqlite3 is, and so is fs.writeFileSync —
// so they fit in one transaction and the worst case really is "nothing
// changed". The refusal checks in collectSeed() run BEFORE it opens, so a
// refusal still cannot half-write anything.
//
// The file writes sit inside the transaction on purpose, even though the
// filesystem cannot roll back. The media ids are deterministic, so a re-seeded
// shop overwrites its own pictures in its own directory; if the transaction
// rolls back, the surviving rows point at those same directories and the same
// file names, and the only difference is freshly rendered art behind an
// unchanged page. Directories belonging to shops that this run would have
// dropped are NOT deleted here — they are swept after the commit, so a rollback
// leaves them in place for the rows that still name them.
// ---------------------------------------------------------------------------
const previousSeed = collectSeed();

const seedAll = db.transaction(() => {
  deleteSeedRows(previousSeed);

  for (const { shop, ids, images } of rendered) {
    writeImage(shop.id, ids.cover, images.cover);
    writeImage(shop.id, ids.tile, images.tile);
    writeImage(shop.id, ids.avatar, images.avatar);
  }

  for (const s of SELLERS) {
    insertOrganizer.run(s.id, s.email, s.name, ACCOUNT.hash, SELLER_STATUS, PLAN_NEVER_EXPIRES, s.notes);
  }

  for (const { shop, ids } of rendered) {
    const totalCapacity = shop.tiers.reduce((sum, t) => sum + t.cap, 0);
    insertEvent.run({
      id: shop.id,
      organizerId: shop.seller,
      slug: shop.slug,
      // The listing declares itself in the name, the first paragraph of the
      // description, the first paragraph of the collection details, and to the
      // assistant. Four places, because a buyer only has to read one of them —
      // and each of those four also says what to do about it: /organizers.
      name: `${shop.name}${EXAMPLE_NAME_SUFFIX}`,
      description: shop.description,
      pickupInfo: shop.pickupInfo,
      category: shop.category,
      city: shop.city,
      totalCapacity,
      maxPerOrder: 6,
      payWithinDays: shop.payWithinDays,
      assistantContext: `${EXAMPLE_ASSISTANT_NOTE}\n\n${shop.assistantContext}`,
    });

    shop.tiers.forEach((t, i) => {
      insertTier.run(`${shop.id}-tier-${t.key}`, shop.id, t.key, t.name, t.price, t.cap, t.description, i);
    });

    // sort 0 is the wide cover, 1 the portrait tile, 2 the round mark — the
    // order they appear in the shop's photo strip.
    insertMedia.run(ids.cover, shop.id, `${ids.cover}.jpg`, 0);
    insertMedia.run(ids.tile, shop.id, `${ids.tile}.jpg`, 1);
    insertMedia.run(ids.avatar, shop.id, `${ids.avatar}.jpg`, 2);
    setMediaPointers.run(ids.cover, ids.tile, ids.avatar, shop.id);
  }
});

try {
  seedAll();
} catch (e) {
  console.error(
    `\nCould not seed the example bazaar: ${e.message}\n` +
      `The transaction was rolled back — the database is exactly as it was, and any\n` +
      `example shops that were already there are still there.\n` +
      `If something in the database still references a ${MARKER}* row, find it and clear it by hand.\n`
  );
  db.close();
  process.exit(1);
}

// Committed. Pictures belonging to a shop this run no longer writes — one
// dropped from SHOPS, one renamed, or one left behind by an older interrupted
// run — are found by scanning the disk for the marker, not by asking the
// database, which by definition no longer names them. Derived variants are
// dropped for every seeded shop: those ids are unchanged while the pictures
// behind them are new, so a kept cache would serve last week's crop.
const orphanDirs = sweepMarkerDirs(new Set(SHOPS.map((s) => s.id)));

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const euro = (cents) => `€${(cents / 100).toFixed(2)}`;

console.log(`\nSeeded the example bazaar into ${dbPath}`);
console.log(`Site: ${BASE_URL}${isProduction ? '   (PRODUCTION — these are live and public now)' : ''}\n`);

console.log(`${SELLERS.length} example seller accounts (status '${SELLER_STATUS}'):`);
for (const s of SELLERS) console.log(`  ${s.name.padEnd(34)} ${s.email}`);

if (ACCOUNT.printable) {
  console.log(`\n  PASSWORD FOR ALL THREE, THIS RUN ONLY: ${ACCOUNT.printable}`);
  console.log(`  It is random, generated a moment ago, printed here and nowhere else — there is no`);
  console.log(`  password in the script to find in the repository. Copy it now; if you lose it, just`);
  console.log(`  re-run and get a new one.`);
  console.log(`\n  What these accounts can do: sign in at /portal/login, open and edit the ${SHOPS.length} example`);
  console.log(`  listings, and be shown to somebody. What they cannot do: touch a real organizer's`);
  console.log(`  listing, order or payout account (they own nothing but ${MARKER}* rows), take money`);
  console.log(`  (no payout route, and checkout refuses), or redirect money IMMEDIATELY (payout_locked`);
  console.log(`  is 1, so any account added waits 24 hours and is written to the audit trail; the`);
  console.log(`  warning email goes to @seed.invalid, so the delay and the record are the real`);
  console.log(`  protection here, not the alarm).`);
  console.log(`  The addresses are @seed.invalid — deliberately undeliverable, so nothing can ever`);
  console.log(`  email a person who does not exist. (If you switch PORTAL_EMAIL_OTP on, these`);
  console.log(`  accounts can no longer sign in at all, because their code has nowhere to go.)`);
  console.log(`\n  On a PRODUCTION run none of that applies: no password is generated for you to`);
  console.log(`  keep, and the accounts are written disabled. Sign-in is a local-only convenience.\n`);
} else {
  console.log(`\n  NO PASSWORD TO THESE ACCOUNTS EXISTS ANYWHERE.`);
  console.log(`  This was a production run: a random secret was generated, hashed into the row and`);
  console.log(`  thrown away without ever being printed or stored. Nobody knows it — not a stranger,`);
  console.log(`  not you — and the @seed.invalid addresses mean password reset and sign-in codes`);
  console.log(`  have nowhere to arrive. The rows are additionally status='disabled', so the portal`);
  console.log(`  would refuse them even with the right password.`);
  console.log(`\n  YOU can still reopen them, and that is deliberate: /admin/organizers resets the`);
  console.log(`  password (it shows you the new one) and sets the status back to active — two`);
  console.log(`  clicks, behind your admin sign-in. What this run guarantees is narrower and`);
  console.log(`  still worth having: no password of these accounts is ever left in a terminal,`);
  console.log(`  a scrollback or a screenshot, and there is no route in that does not go through`);
  console.log(`  your own admin panel.`);
  console.log(`\n  The shops still work perfectly: nothing public reads organizer status (checked —`);
  console.log(`  listPublishedEvents() filters on events.status alone, and the listing page reads`);
  console.log(`  the organizer only through getOrganizer(), for the Veranstalter name). So each`);
  console.log(`  example shop renders in the feed, on /market, in the sitemap and on its own page,`);
  console.log(`  and still names its seller — while being an account nobody else can open.`);
  console.log(`\n  If you want to demonstrate the SELLER's side of the portal, seed a local copy`);
  console.log(`  instead: a checkout with a localhost base URL and ./data trips none of the`);
  console.log(`  production signals, and that run prints a password.\n`);
}

console.log(`${SHOPS.length} shops, all published as EXAMPLE listings, sales open, EUR:`);
for (const shop of SHOPS) {
  const prices = shop.tiers.map((t) => t.price);
  console.log(
    `  ${(shop.name + EXAMPLE_NAME_SUFFIX).padEnd(41)} ${shop.category.padEnd(18)} ` +
      `${String(shop.tiers.length).padStart(2)} products  ${euro(Math.min(...prices))}–${euro(Math.max(...prices))}  /e/${shop.slug}`
  );
}
console.log(`\n  Each one says what it is in its name, in the first paragraph of its description,`);
console.log(`  in the first paragraph of its collection details, on its cover art and to the AI`);
console.log(`  assistant — so a buyer cannot arrange a collection with somebody who does not`);
console.log(`  exist. And each of those places says what to do about it: a seller who likes what`);
console.log(`  they see is sent to ${ORGANIZERS_LINK} to open their own, free.`);

console.log(`\n${SHOPS.length * 3} cover images generated with sharp (wide cover, portrait tile, round mark),`);
console.log(`  stamped "THIS COULD BE YOUR SHOP", under ${path.join(dataDir, 'uploads', `${MARKER}<shop>`)}/`);
if (orphanDirs) {
  console.log(`  Also removed ${orphanDirs} leftover "${MARKER}*" image folder(s) no listing points at.`);
}

console.log(`\n  ------------------------------------------------------------------`);
console.log(`  PAYMENT IS NOT CONFIGURED, AND THE PAYOUT ACCOUNT IS LOCKED.`);
console.log(`  ------------------------------------------------------------------`);
console.log(`  No IBAN, no account holder, no BIC, no bank name, no PayPal — on any`);
console.log(`  of them. This is a showcase, not a store: nothing here can take money`);
console.log(`  from anybody. The pages browse and price exactly like real shops, and`);
console.log(`  checkout correctly refuses the order at the last step ("Payment is not`);
console.log(`  configured yet"). That refusal is the platform working, not a fault —`);
console.log(`  and it is why this script refuses to run unless PAYMENT_MODE resolves`);
console.log(`  to 'transfer', the one mode in which that refusal happens. That guard`);
console.log(`  has no override anywhere, production least of all: on a live site it`);
console.log(`  is the only thing between an example shop and a real buyer's money.`);
console.log(`\n  ******************************************************************`);
console.log(`  *  THAT LAST SENTENCE IS ABOUT THE ENVIRONMENT, NOT THESE ROWS.`);
console.log(`  *`);
console.log(`  *  TAKE THE EXAMPLE BAZAAR DOWN BEFORE YOU CHANGE HOW THE SITE`);
console.log(`  *  TAKES MONEY:   npm run seed:bazaar -- --clean`);
console.log(`  *`);
console.log(`  *  These ${SHOPS.length} listings are published, priced and open for orders,`);
console.log(`  *  exactly like a real shop. The ONLY reason a buyer cannot be`);
console.log(`  *  charged is the one branch of POST /api/orders that exists in`);
console.log(`  *  'transfer' mode. This script checked that once, just now, and`);
console.log(`  *  can never check it again — and these rows are meant to stay up.`);
console.log(`  *`);
console.log(`  *  So the day PAYMENT_MODE stops resolving to 'transfer' — PayPal`);
console.log(`  *  switched on, PAYPAL_CLIENT_ID/SECRET added, PAYPAL_ENV=live,`);
console.log(`  *  ALLOW_MOCK_PAYMENTS set — these seven invented shops with their`);
console.log(`  *  invented collection addresses become genuinely orderable, and`);
console.log(`  *  nothing in the code is left to stop it. The change is made in`);
console.log(`  *  the hosting dashboard and nobody gets a warning.`);
console.log(`  *`);
console.log(`  *  Clean first, change payments, re-seed after if you still want`);
console.log(`  *  the showcase. Also written down in GO-LIVE.md (S8) and`);
console.log(`  *  PLATFORM.md (S2), where that decision actually gets made.`);
console.log(`  ******************************************************************`);
console.log(`\n  payout_locked = 1 on every seeded shop, exactly as the portal sets it`);
console.log(`  the first time a real listing is published. So adding a payout account`);
console.log(`  to one of these does not take effect for 24 hours and is written to the`);
console.log(`  audit trail — the same protection a live listing gets. The same code`);
console.log(`  also emails the account; on these rows that address is @seed.invalid,`);
console.log(`  so what you actually get is the 24-hour delay and the payout_changes`);
console.log(`  record, not an alarm anybody reads. An example shop is not a shortcut`);
console.log(`  around it.`);
console.log(`\n  Side effect worth knowing: the portal will not let you SAVE an edit to`);
console.log(`  one of these shops while it is published with priced items and has no`);
console.log(`  payout route. Move it to draft first, or add a payout route — that`);
console.log(`  guard exists to stop real sellers listing something nobody can pay for.`);

console.log(`\n  ##################################################################`);
console.log(`  #  TO TAKE THE WHOLE EXAMPLE BAZAAR DOWN AGAIN — ONE COMMAND:`);
console.log(`  #`);
console.log(`  #      npm run seed:bazaar -- --clean`);
console.log(`  #`);
console.log(`  #  Run it from this directory with the same environment (so DATA_DIR`);
console.log(`  #  still points at ${dbPath}).`);
console.log(`  #  It needs no flag and works on production exactly as it does here.`);
console.log(`  #`);
console.log(`  #  It removes the ${SHOPS.length} listings, their products, their ${SHOPS.length * 3} images, the`);
console.log(`  #  ${SELLERS.length} accounts, and everything that hangs off them — visitor`);
console.log(`  #  questions, FAQs, posts, waitlist entries, stall links, promo`);
console.log(`  #  codes, payout records — because with foreign keys on, one child`);
console.log(`  #  row left behind fails the whole delete. And nothing else, ever:`);
console.log(`  #  only rows tied to an id beginning "${MARKER}" are so much`);
console.log(`  #  as looked at. If one of them somehow has an ORDER against it, it`);
console.log(`  #  refuses and tells you, rather than deleting anything.`);
console.log(`  ##################################################################`);

console.log(`\nHave a look: ${BASE_URL}/market · ${BASE_URL}/ (the feed)${ACCOUNT.printable ? ` · ${BASE_URL}/portal/login` : ''}`);
console.log(`Re-run this script any time to update the copy in place — it re-seeds, it does not`);
console.log(`double up. Every picture is rendered before the database is touched, and the old`);
console.log(`seed is removed and the new one written in one transaction — an interrupted run`);
console.log(`changes nothing.`);
if (isProduction) {
  console.log(`\nThe live site now shows ${SHOPS.length} example shops. Every one of them is an invitation`);
  console.log(`to a Nepali seller to open a real one at ${ORGANIZERS_LINK}.`);
}
console.log('');

db.close();
