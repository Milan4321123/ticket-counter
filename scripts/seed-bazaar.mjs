#!/usr/bin/env node
// Fill the bazaar with DEMONSTRATION shops, so the platform can be SHOWN.
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
// This file lives in a PUBLIC repository, so it is written on the assumption
// that somebody will eventually run it somewhere it should not be run. Every
// safeguard below is therefore structural — a refusal, a random secret, a
// locked column — and not a warning in a comment.
//
// ---------------------------------------------------------------------------
// EVERY SHOP THIS WRITES ANNOUNCES ITSELF AS A DEMONSTRATION, IN WORDS.
// ---------------------------------------------------------------------------
// The sellers are invented and so are their collection addresses, and these
// rows are PUBLISHED: they show up in the feed, on /market and in the sitemap,
// underneath copy that promises the buyer that every shop belongs to a real
// Nepali seller near them. A demo that hides inside that promise is a way to
// send somebody to a doorbell that does not exist. So each listing declares
// itself where a buyer cannot miss it:
//
//   · the listing NAME carries "(demo shop)" — it is the card title, the feed
//     entry, the page heading, the browser tab and the cover picture;
//   · the FIRST LINE of the description says nobody is cooking or packing;
//   · the FIRST LINE of the collection details says there is no address and
//     nobody to meet;
//   · the cover, tile and avatar art are stamped DEMONSTRATION;
//   · the seller's display name ends "(demo seller)", so the Veranstalter
//     named on the page is not mistaken for a person you could ring.
//
// The tone stays the site's own — warm, plain, not a legal banner — because a
// showcase that reads like a compliance notice showcases nothing.
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
// demo shops browse, open, and price exactly like real ones, and the checkout
// correctly refuses at the last step. Somebody clicking through the demo
// cannot accidentally send money into a shop that does not exist. That guard
// only speaks in ONE payment mode, which is why this script refuses to seed in
// any other — see "WHERE THIS REFUSES TO RUN" below.
//
// Empty payout columns are only half of it. Every seeded shop is also written
// with payout_locked = 1, the column src/app/api/portal/events/[id]/route.ts
// sets the first time a listing is published ("from the first publish onwards
// this event can take money"). payoutChangeIsDelayed() in src/lib/payout.ts
// reads exactly that flag, so a payout account added to one of these shops is
// parked in the pending_* columns for PAYOUT_DELAY_MS (24 hours), is written
// into the audit trail, and mails the organizer — precisely as it would on a
// real listing that has already sold. Seeding with the flag at 0 would have
// handed anyone who got into a demo account a published shop whose IBAN could
// be pointed anywhere and take effect the same second. It is the one place
// where "it's only demo data" would have been a live-listing-shaped hole.
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
// THE THREE DEMO ACCOUNTS: WHAT THEY CAN AND CANNOT DO.
// ---------------------------------------------------------------------------
// They are sign-in-able on purpose. Half of what this seed is for is walking
// somebody through the seller's side — the editor, the orders screen, the
// statement — and an account nobody can open cannot do that. So the risk is
// BOUNDED instead of removed:
//
//   CAN:    sign in at /portal/login with the password this run prints, look
//           at and edit the seeded demo listings, and be shown to a visitor.
//   CANNOT: reach any real organizer's listing, order or payout account (they
//           own nothing but seed-bazaar-* rows); take money (no payout route,
//           and checkout refuses); redirect money quietly (payout_locked = 1
//           means any account added waits 24 hours, is logged, and mails the
//           account); be recovered by email (the addresses are @seed.invalid,
//           so password-reset and sign-in codes have nowhere to arrive).
//
// The password is RANDOM PER RUN, from crypto.randomBytes, printed once at the
// end and never stored anywhere but the scrypt hash. There is deliberately no
// literal in this file: a password committed to a public repository is a
// standing account on every machine this has ever been run against, and a
// published shop plus a known password is exactly how a payout account gets
// pointed at a stranger. Lose it and you re-run the script; that is cheaper
// than the alternative in every way.
//
// ---------------------------------------------------------------------------
// WHERE THIS REFUSES TO RUN.
// ---------------------------------------------------------------------------
// Hard refusal, exit 1, nothing written:
//
//   · NODE_ENV=production. A production database holds real sellers and real
//     buyers, and there is no version of "invented shops in the live feed"
//     that is a good idea. No flag overrides this one.
//   · Any resolved payment mode other than 'transfer'. The refusal that makes
//     a payout-less shop harmless lives in ONE branch of POST /api/orders:
//     `mode === 'transfer' && !hasBankRoute && !hasPaypalRoute`. In 'paypal'
//     mode the order is created against the platform's own PayPal credentials
//     and a buyer really can pay for a shop that does not exist; in 'mock'
//     mode the order is not refused at all, it completes as fake-paid. So the
//     mode is resolved HERE, mirroring getPaymentMode() in src/lib/config.ts
//     (including the .env files Next would have loaded, which `node` does
//     not), and anything but 'transfer' stops the run with the reason spelled
//     out.
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
// Re-seeding also renders every picture BEFORE it removes the old seed, and
// swaps them in afterwards: see the comment above the render loop.
//
//   node scripts/seed-bazaar.mjs            -> (re)seed the demo bazaar
//   node scripts/seed-bazaar.mjs --clean    -> remove the demo bazaar and exit
//   npm run seed:bazaar
//   npm run seed:bazaar -- --clean
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
 * Appended to every listing name that goes into the database.
 *
 * The name is the loudest text a shop has: the card title on /market and in
 * the feed, the page heading, the browser tab, the sitemap entry, the share
 * preview. If the demo declares itself in exactly one place, this is the
 * place. (The cover art carries its own stamp — see stamp() below.)
 */
const DEMO_NAME_SUFFIX = ' (demo shop)';

/**
 * Prefixed to every assistant_context.
 *
 * assistant_context is read by the PUBLIC AI assistant, which answers buyers
 * on the listing page. It must be told that THIS LISTING is a demonstration —
 * and explicitly not that the platform cannot take payments, which was the old
 * wording. That sentence would have been repeated, verbatim and confidently,
 * on a site whose other listings are real sellers taking real money.
 */
const DEMO_ASSISTANT_NOTE =
  'THIS LISTING IS A DEMONSTRATION SHOP, not a real seller. The seller, the stock and the collection ' +
  'address are invented, the listing has no payout account, and an order placed on it is refused at ' +
  'checkout. If anyone asks about buying, collecting, paying or meeting the seller, say plainly that ' +
  'this particular listing is a demonstration and there is nothing to collect, and never offer a way ' +
  'to complete an order on it. This is true of THIS LISTING ONLY: other shops and events on this site ' +
  'belong to real sellers and organizers and take real orders, so never say that the site, the ' +
  'platform or its payments do not work. Everything after this note describes the products accurately ' +
  'and can be explained as written.';

/**
 * The demo password: RANDOM, every single run, printed once at the end.
 *
 * Never a literal in this file. A password in a public repository is not a
 * convenience, it is a standing credential on every machine the script has
 * ever touched — and these accounts own PUBLISHED shops, which is the shape of
 * account somebody wants. 24 base64url characters is far past
 * MIN_PASSWORD_LENGTH (src/lib/passwordPolicy.ts) and has no run or repeat to
 * trip its other rules, so it can also be re-typed into the change-password
 * form as-is. If it scrolls off the terminal, re-run the script: it re-seeds
 * with a fresh one.
 */
const DEMO_PASSWORD = randomBytes(18).toString('base64url');

const cleanOnly = process.argv.includes('--clean');

/** See "WHERE THIS REFUSES TO RUN" at the top. Deliberately verbose to type. */
const MOCK_OVERRIDE_FLAG = '--i-know-checkout-will-not-refuse';
const mockOverride = process.argv.includes(MOCK_OVERRIDE_FLAG);

// ---------------------------------------------------------------------------
// Refuse to run anywhere it could matter.
//
// This runs before the database is even opened, so a refusal cannot half-write
// anything. --clean is exempt: removing demo rows is safe everywhere, and a
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
 * getPaymentMode() from src/lib/config.ts, mirrored line for line.
 *
 * Kept as a mirror rather than an import because that module is TypeScript and
 * pulls in the whole app. If the original ever changes, this has to change
 * with it — the refusal below is only as true as this function is.
 */
function resolvePaymentMode() {
  const explicitMode = (process.env.PAYMENT_MODE || 'auto').toLowerCase();
  if (explicitMode === 'transfer') return 'transfer';
  if (process.env.PAYPAL_ENV === 'live') return 'paypal';
  const isProd = process.env.NODE_ENV === 'production';
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

if (!cleanOnly) {
  if (process.env.NODE_ENV === 'production') {
    refuse('NODE_ENV is production.', [
      'This script publishes a set of invented shops, with invented sellers and invented',
      'collection addresses, straight into the public feed, /market and the sitemap.',
      'A production database has real sellers and real buyers in it.',
      '',
      `There is no flag for this. If this really is a throwaway staging copy, run it`,
      'with NODE_ENV unset.',
    ]);
  }

  const paymentMode = resolvePaymentMode();
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
    if (paymentMode === 'mock' && mockOverride && process.env.PAYPAL_ENV !== 'live') {
      console.error('\n  ####################################################################');
      console.error(`  #  ${MOCK_OVERRIDE_FLAG}`);
      console.error('  #');
      console.error("  #  Seeding anyway with PAYMENT_MODE resolving to 'mock'. Checkout on");
      console.error('  #  these demo shops will NOT be refused — an order will complete as a');
      console.error('  #  fake-paid order against a seller who does not exist. No real money');
      console.error('  #  can move in mock mode, but do not show this to anybody as if the');
      console.error('  #  checkout were behaving correctly, and do not leave it seeded on a');
      console.error('  #  machine other people can reach.');
      console.error('  ####################################################################\n');
    } else {
      detail.push(
        '',
        paymentMode === 'mock'
          ? `On a dev machine only, ${MOCK_OVERRIDE_FLAG} seeds anyway and`
          : `${MOCK_OVERRIDE_FLAG} does NOT apply here — it covers`,
        paymentMode === 'mock'
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
// The display name carries "(demo seller)" because it is PUBLIC: it is the
// Veranstalter named on the listing and the name in "Ask … a question". A
// buyer must not come away thinking there is a Rajendra to ring.
// ---------------------------------------------------------------------------
const DEMO_SELLER_NOTE =
  'DEMO SELLER created by scripts/seed-bazaar.mjs. Not a real person; owns only seed-bazaar-* listings, ' +
  'which have no payout route and are payout_locked. Password is random per run and printed by that run ' +
  'only. Delete with `npm run seed:bazaar -- --clean`.';

const SELLERS = [
  {
    id: `${MARKER}seller-rajendra`,
    name: 'Rajendra Limbu (demo seller)',
    email: 'rajendra.limbu@seed.invalid',
    notes: DEMO_SELLER_NOTE,
  },
  {
    id: `${MARKER}seller-sarita`,
    name: 'Sarita Shrestha (demo seller)',
    email: 'sarita.shrestha@seed.invalid',
    notes: DEMO_SELLER_NOTE,
  },
  {
    id: `${MARKER}seller-bimala`,
    name: 'Bimala Gurung (demo seller)',
    email: 'bimala.gurung@seed.invalid',
    notes: DEMO_SELLER_NOTE,
  },
];

// ---------------------------------------------------------------------------
// The shops. `category` keys come from src/lib/categories.ts and are checked
// against it below, so a renamed shelf fails here instead of quietly filing
// every demo shop under "uncategorised".
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
    description: `This is a demonstration shop — there is no cardamom, and no Rajendra. Nobody is drying pods over a fire for this page and there is nothing to collect in Berlin; the seller, the flat and the sacks are all invented, and checkout will refuse an order. It is here so you can see exactly how a real shop reads, so please do read on — the spice below is described properly, and a real listing looks like this.

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
    pickupInfo: `Nothing to collect here — this is a demonstration shop, and there is no flat, no Saturday and nobody to meet. What follows is written the way a real seller writes it, so you can see what a buyer is told before they set off.

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
    description: `A demonstration shop — no tea, and no seller. Nobody is folding pouches for this page and there is nothing to collect in Berlin; the shop is invented and checkout will refuse an order. Read on anyway: the tea below is described the way a real seller would describe it, and a real listing looks exactly like this.

Orthodox tea from the gardens around Fikkal in Ilam — the next district over from the cardamom, though on hill roads that is a good half-day's drive, not a hop.

Orthodox means the leaf is rolled whole rather than cut to dust, so what ends up in your cup is a leaf you can see. First flush is picked in spring when the bushes wake up: light, a little floral, best drunk plain and not left standing. Second flush comes off in summer and is the one people describe as muscatel — rounder, darker, holds up to milk if that is how you take it. The green is pan-dried and grassy and forgives being brewed twice.

And because half the people who ask me want tea for a proper pot of chiya, not for a tasting: the CTC is here too. It is not fancy. It is what actually stands up to milk, ginger and a hard boil, and I would rather sell you the right leaf than the expensive one.

Brewing, briefly. First and second flush: water just off the boil, three minutes, no milk. Green: cooler water, two minutes, and stop there or it turns bitter. CTC: boil it with milk and ginger and be generous with the leaf.

Tea gets stale from air and light more than from time. Keep it in the pouch it comes in, folded shut, away from the spice shelf — it will pick up whatever is next to it.`,
    pickupInfo: `Nothing to collect — this is a demonstration shop, with no address behind it and nobody to meet. The rest is written as a real seller would write it, so you can see what a buyer is told.

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
    description: `A demonstration shop — nobody is cooking. There is no kitchen in Bockenheim, no Sarita, and no jars; the shop is invented and checkout will refuse an order, so please don't plan a Sunday around it. It is here to show how a real home kitchen's page reads, and the achar below is described exactly as one would be.

Achar the way it is made at home in a Frankfurt kitchen, in batches small enough that I still taste every one.

The lapsi achar is the one I am asked for most. Lapsi (Nepali hog plum) comes dried, gets soaked, cooked down with timur, chilli and a little mustard oil, and finishes sour first and hot second. The timur-golbheda is the tomato achar that belongs beside dal bhat — timur numbs the tongue slightly and that is meant to happen, it is not chilli.

Gundruk I ferment and dry myself: mustard and radish leaves, wilted, pressed into a jar, left to sour, then dried. Soak it fifteen minutes and it becomes gundruk ko jhol, or fry it into sadeko with tomato and dried chilli. Sinki is the same idea done with radish root and it is sharper.

Sukuti is buffalo, cut thin, spiced and air-dried slowly until it is properly hard. Eat it as it is with cold beer, or soften it in a pan with onion, timur and chilli for sukuti sadeko.

Everything is made in a home kitchen, not a factory. Jars keep two to three months in the fridge once opened. Nothing here is mild — if you cook for children, tell me when you order and I will make the next batch of tomato achar gentle.`,
    pickupInfo: `Nothing to collect — this is a demonstration shop. There is no kitchen door in Bockenheim and nobody waiting on a Tuesday evening. The rest is written as a real seller would write it, so you can see what a buyer is told.

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
    description: `A demonstration shop — nothing is being fried. There is no Saturday batch, no clay pots and nobody to collect from; the shop is invented and checkout will refuse an order. It sits here so you can see how a festival kitchen's page reads, and everything below is written the way a real one would write it.

Festival sweets, made to order, in the quantities a family actually eats.

Sel roti is rice-flour batter — soaked, ground, sweetened lightly, rested overnight — piped into hot ghee in a ring. Crisp at the edge, soft in the middle, and honest: it is best on the day it is fried and second-best warmed in a dry pan the next morning. Do not microwave it.

Juju dhau, "the king of yoghurts", is set in the clay pot it comes in, the way it is done in Bhaktapur. The clay pulls water out through the wall, so it sets thick enough to stand a spoon in and tastes faintly of the pot. Please keep the pot — bring it back and there is a euro off the next one.

Lakhamari is the hard, glazed Newari bread-sweet that belongs at weddings and at Mha Puja: not very sweet, meant to be broken and dipped in tea. Yomari appears in the weeks around Yomari Punhi — steamed rice-flour parcels of chaku and sesame, and they are shaped by hand, which is why the number is small.

I fry and steam on Fridays and Saturdays, so order by Thursday evening if you want it for the weekend. Everything here has ghee in it. Say the word and I'll do a batch in oil instead.`,
    pickupInfo: `Nothing to collect — this is a demonstration shop, and there is no address and nobody frying on Saturday morning. What follows is written the way a real seller writes it, so you can see what a buyer is told.

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
    description: `A demonstration shop — there is no suitcase and no Bimala. Nothing here can be bought, tried on or collected in Munich; the shop is invented and checkout will refuse an order. It is here to show how a real seller's page reads, and the dhaka below is described just as one would describe it.

Dhaka, woven on handlooms in Palpa and Tehrathum, brought over a suitcase at a time.

Dhaka is not a print. Every one of those geometric blocks is counted and picked into the warp by the weaver as she goes, which is why no two topis are quite identical and why the back of a good piece looks almost as tidy as the front. Look at the reverse before you buy anything called dhaka anywhere — that is the test.

The topis here are Palpali, stiffened properly so they hold their shape, in the usual sizes: tell me your hat size or the circumference of your head in centimetres when you order and I will pick from what I have. A topi that does not fit is a photo you don't take.

The shawls are wider, softer cotton, meant to be worn rather than folded in a drawer for Dashain. The cholo lengths are for anyone who has a tailor and knows what they want to do with 1.5 metres. The pashmina is a separate thing entirely — Kathmandu, 70% cashmere with 30% silk, which is the blend that gives it the shine and stops it pilling in a month.

Cold hand wash, no wringing, dry flat in the shade. Dhaka's dyes are good but they are not miracle-workers.`,
    pickupInfo: `Nothing to collect — this is a demonstration shop, and there is nobody in Munich to meet. The rest is written the way a real seller writes it, so you can see what a buyer is told.

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
    description: `A demonstration shop — no beads, no seller, nothing to collect. This listing is invented and checkout will refuse an order, so please don't come to Munich for it. It is here to show how a real bead-seller's page reads, and everything below is written the way a real one would write it.

Glass pote strung in Indrachowk, where the whole lane does nothing else.

If you have stood in that market you know the sound of it — trays and trays of glass beads, and a man who will thread the exact green you want in about four minutes while you wait. This is that work, brought over and sold here at something close to a sane price.

The plain strands come as seven threads with a proper clasp. Green is the everyday one; red is for the wedding photos and for Teej. Tell me if you want them longer or shorter than standard and I'll restring before you collect — it takes minutes and costs nothing.

The tilhari is the gold-plated cylinder on a pote strand, and I am honest about what it is: plated brass over a solid core, not gold. It looks right, it photographs beautifully, and it costs what a plated piece should cost. If someone is selling you "tilhari" at this price and calling it gold, walk away.

Jhumka are silver-plated with a hook, light enough to wear all evening. The rudraksha mala is five-mukhi, 108 beads plus the guru bead, strung on cotton.

Glass beads chip if you drop them on tile. Keep the strand in the pouch it comes in and it will outlast the outfit.`,
    pickupInfo: `Nothing to collect — this is a demonstration shop, and there is no table and nobody to measure a strand against you. The rest is written as a real seller would write it, so you can see what a buyer is told.

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
    description: `A demonstration shop — there are no bowls to come and play. Nothing here can be bought or collected; the seller and the Munich address are invented and checkout will refuse an order. It is here to show how a real craft seller's page reads, and everything below is written the way a real one would write it.

Lokta paper and singing bowls — the two things people ask me to bring back every single time.

Lokta is made from the bark of a Himalayan shrub that grows above 2,000 metres and regenerates from the cut stump in a few years, so the plant is not killed to make the paper. The bark is boiled, beaten and poured onto a frame to dry in the sun, which is why every sheet has a slightly different thickness and a deckle edge, and why it takes ink so well. Nepali government records were kept on this stuff for centuries; it does not yellow and it does not crumble.

The notebooks are hand-stitched with a cotton cord. The gift sheets are big enough to wrap a book or frame as they are.

The bowls are hand-hammered, not cast — you can see the hammer marks all round the outside and no two ring at the same pitch. The 12cm has a low, long note that keeps going for a surprisingly long time; the 9cm is brighter and easier to play, and comes with a cushion and a wooden striker. Run the striker slowly round the outside rim, pressing gently. If it rattles instead of singing, you are going too fast.

The felt is rolled and dyed by hand in Kathmandu, and I would rather tell you where the wool is from than let you assume: it is merino, imported from New Zealand, as nearly all Nepali felt is. It felts finer and takes the colours better than the local wool does. The hands are Nepali; the fleece flew in.`,
    pickupInfo: `Nothing to collect — this is a demonstration shop, with no address and nobody to meet. The rest is written the way a real seller writes it, so you can see what a buyer is told.

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
 * The stamp that says this shop is not real, drawn on every picture.
 *
 * The pictures travel further than the page does — the tile is what the feed,
 * /market and a shared link show, often with nothing but the name beside it.
 * A demo notice that only exists in the description is missing from exactly
 * the places a stranger meets these shops first.
 */
function demoStamp({ x, y, size, text, p, centred = false }) {
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
  // seller's cover photo carries no text either — only the demo stamp has to
  // survive here, because that one must be unmissable.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${ground(w, h, p)}
  <g opacity="0.6">
    <circle cx="${w - 90}" cy="${h / 2}" r="170" fill="none" stroke="${p.accent}" stroke-opacity="0.3" stroke-width="2"/>
    <circle cx="${w - 90}" cy="${h / 2}" r="250" fill="none" stroke="${p.accent}" stroke-opacity="0.17" stroke-width="2"/>
    <circle cx="${w - 90}" cy="${h / 2}" r="330" fill="none" stroke="${p.accent}" stroke-opacity="0.08" stroke-width="2"/>
  </g>
  ${demoStamp({ x, y: 128, size: 26, text: 'DEMONSTRATION SHOP · NOT A REAL SELLER', p })}
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
  ${demoStamp({ x: cx, y: 232, size: 32, text: 'DEMONSTRATION SHOP', p, centred: true })}
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
  ${demoStamp({ x: s / 2, y: 452, size: 30, text: 'DEMO', p, centred: true })}
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
 * Remove everything this script has ever written, and NOTHING else.
 *
 * Only rows whose primary key begins with MARKER are even looked at. Before
 * anything is deleted, the seeded listings are checked for real orders: a demo
 * shop cannot have any (it has no way to be paid), so if one does, something
 * has happened that a cleanup script has no business steamrolling — it stops
 * and says so instead.
 */
function removeSeed({ quiet = false } = {}) {
  const events = db.prepare(`SELECT id, name FROM events WHERE id LIKE ? || '%'`).all(MARKER);
  const sellers = db.prepare(`SELECT id, email FROM organizers WHERE id LIKE ? || '%'`).all(MARKER);
  if (!events.length && !sellers.length) {
    if (!quiet) console.log('No seeded bazaar found — nothing to remove.');
    return { events: 0, sellers: 0 };
  }

  // Real orders against a marker row: stop, loudly.
  for (const ev of events) {
    const orders = db.prepare(`SELECT count(*) AS c FROM orders WHERE event_id = ?`).get(ev.id).c;
    if (orders > 0) {
      console.error(
        `REFUSING TO DELETE. The seeded listing "${ev.name}" (${ev.id}) has ${orders} order(s) against it.\n` +
          `Demo shops have no payout route and cannot legitimately have orders, so this needs a human:\n` +
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

  const tx = db.transaction(() => {
    for (const id of eventIds) {
      // Let go of the pointers first: cover/poster/profile are plain columns,
      // but clearing them keeps the delete order obvious and survivable.
      db.prepare(
        `UPDATE events SET cover_media_id = NULL, poster_media_id = NULL, profile_media_id = NULL WHERE id = ?`
      ).run(id);
      db.prepare(`DELETE FROM event_media WHERE event_id = ?`).run(id);
      db.prepare(`DELETE FROM event_tiers WHERE event_id = ?`).run(id);
      db.prepare(`DELETE FROM events WHERE id = ?`).run(id);
    }
    for (const s of sellers) db.prepare(`DELETE FROM organizers WHERE id = ?`).run(s.id);
  });

  try {
    tx();
  } catch (e) {
    console.error(
      `Could not remove the seeded bazaar: ${e.message}\n` +
        `Something else in the database still references one of these rows (a question, a post, a stall, a waitlist entry).\n` +
        `Nothing has been changed — look at what points at ${MARKER}* and clear it by hand.`
    );
    process.exit(1);
  }

  // Files last: the rows are gone, so a half-deleted directory can never make
  // the app serve a broken image.
  for (const m of media) {
    try {
      fs.unlinkSync(path.join(dataDir, 'uploads', m.eventId, m.fileName));
    } catch {
      // Already gone. Fine.
    }
  }
  for (const id of eventIds) {
    fs.rmSync(path.join(dataDir, 'uploads', id), { recursive: true, force: true });
    fs.rmSync(path.join(dataDir, 'derived', id), { recursive: true, force: true }); // the variant cache
  }

  if (!quiet) {
    console.log(`Removed ${events.length} seeded shop(s), their tiers, ${media.length} image(s), and ${sellers.length} demo account(s).`);
  }
  return { events: events.length, sellers: sellers.length };
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
// than filing every demo shop under "uncategorised" and looking broken.
const categorySource = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'categories.ts'), 'utf8');
const knownCategories = new Set([...categorySource.matchAll(/key:\s*'([a-z-]+)'/g)].map((m) => m[1]));
for (const shop of SHOPS) {
  if (!knownCategories.has(shop.category)) {
    console.error(`"${shop.name}" uses category '${shop.category}', which src/lib/categories.ts no longer defines.`);
    process.exit(1);
  }
}

// A slug held by somebody else's listing is a collision we must not resolve by
// force — the demo would either fail to insert or, worse, be renamed into
// something nobody expects.
for (const shop of SHOPS) {
  const owner = db.prepare(`SELECT id FROM events WHERE slug = ?`).get(shop.slug);
  if (owner && !owner.id.startsWith(MARKER)) {
    console.error(`The slug "${shop.slug}" already belongs to a real listing (${owner.id}). Rename the demo shop in this script.`);
    process.exit(1);
  }
}

// scrypt, salt:hash hex — exactly the format hashPassword() in
// src/lib/organizers.ts writes, so verifyPassword() reads these accounts back
// with no special case.
const passwordHash = (() => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(DEMO_PASSWORD, salt, 64).toString('hex')}`;
})();

const PLAN_NEVER_EXPIRES = '9999-12-31'; // the sentinel from src/lib/organizers.ts

const insertOrganizer = db.prepare(
  `INSERT INTO organizers (id, email, name, password_hash, status, plan_paid_until, notes, must_change_password)
   VALUES (?, ?, ?, ?, 'active', ?, ?, 0)`
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
// the existing demo bazaar without writing a replacement: the shops were gone
// from /market, the images were gone from disk, and the fix was "run it again
// and hope the same thing does not happen". A seed script's worst case must be
// "nothing changed", not "the demo is now missing".
//
// So the order is: render every picture to a buffer, and only once every one
// of them is in hand remove the previous seed and swap the new bytes in. If a
// render throws, it throws HERE, before removeSeed(), and the database and the
// uploads directory are untouched.
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

// Every picture exists. NOW the old seed may go.
removeSeed({ quiet: true });

for (const { shop, ids, images } of rendered) {
  writeImage(shop.id, ids.cover, images.cover);
  writeImage(shop.id, ids.tile, images.tile);
  writeImage(shop.id, ids.avatar, images.avatar);
}

const seedAll = db.transaction(() => {
  for (const s of SELLERS) {
    insertOrganizer.run(s.id, s.email, s.name, passwordHash, PLAN_NEVER_EXPIRES, s.notes);
  }

  for (const { shop, ids } of rendered) {
    const totalCapacity = shop.tiers.reduce((sum, t) => sum + t.cap, 0);
    insertEvent.run({
      id: shop.id,
      organizerId: shop.seller,
      slug: shop.slug,
      // The demo declares itself in the name, the first line of the
      // description, the first line of the collection details, and to the
      // assistant. Four places, because a buyer only has to read one of them.
      name: `${shop.name}${DEMO_NAME_SUFFIX}`,
      description: shop.description,
      pickupInfo: shop.pickupInfo,
      category: shop.category,
      city: shop.city,
      totalCapacity,
      maxPerOrder: 6,
      payWithinDays: shop.payWithinDays,
      assistantContext: `${DEMO_ASSISTANT_NOTE}\n\n${shop.assistantContext}`,
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

seedAll();

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const euro = (cents) => `€${(cents / 100).toFixed(2)}`;

console.log(`\nSeeded the demo bazaar into ${dbPath}\n`);
console.log(`${SELLERS.length} demo seller accounts (status active, password set):`);
for (const s of SELLERS) console.log(`  ${s.name.padEnd(30)} ${s.email}`);
console.log(`\n  PASSWORD FOR ALL THREE, THIS RUN ONLY: ${DEMO_PASSWORD}`);
console.log(`  It is random, generated a moment ago, printed here and nowhere else — there is no`);
console.log(`  password in the script to find in the repository. Copy it now; if you lose it, just`);
console.log(`  re-run and get a new one.`);
console.log(`\n  What these accounts can do: sign in at /portal/login, open and edit the ${SHOPS.length} demo`);
console.log(`  listings, and be shown to somebody. What they cannot do: touch a real organizer's`);
console.log(`  listing, order or payout account (they own nothing but ${MARKER}* rows), take money`);
console.log(`  (no payout route, and checkout refuses), or quietly redirect money (payout_locked`);
console.log(`  is 1, so any account added waits 24 hours and is logged and mailed first).`);
console.log(`  The addresses are @seed.invalid — deliberately undeliverable, so nothing can ever`);
console.log(`  email a person who does not exist. (If you switch PORTAL_EMAIL_OTP on, these`);
console.log(`  accounts can no longer sign in at all, because their code has nowhere to go.)\n`);

console.log(`${SHOPS.length} shops, all published as DEMONSTRATION listings, sales open, EUR:`);
for (const shop of SHOPS) {
  const prices = shop.tiers.map((t) => t.price);
  console.log(
    `  ${(shop.name + DEMO_NAME_SUFFIX).padEnd(38)} ${shop.category.padEnd(18)} ` +
      `${String(shop.tiers.length).padStart(2)} products  ${euro(Math.min(...prices))}–${euro(Math.max(...prices))}  /e/${shop.slug}`
  );
}
console.log(`\n  Each one says so in its name, in the first line of its description, in the first`);
console.log(`  line of its collection details, on its cover art, and to the AI assistant — so a`);
console.log(`  buyer cannot arrange a collection with somebody who does not exist.`);

console.log(`\n${SHOPS.length * 3} cover images generated with sharp (wide cover, portrait tile, round mark)`);
console.log(`  under ${path.join(dataDir, 'uploads', `${MARKER}<shop>`)}/`);

console.log(`\n  ------------------------------------------------------------------`);
console.log(`  PAYMENT IS NOT CONFIGURED, AND THE PAYOUT ACCOUNT IS LOCKED.`);
console.log(`  ------------------------------------------------------------------`);
console.log(`  No IBAN, no account holder, no BIC, no bank name, no PayPal — on any`);
console.log(`  of them. This is a showcase, not a store: nothing here can take money`);
console.log(`  from anybody. The pages browse and price exactly like real shops, and`);
console.log(`  checkout correctly refuses the order at the last step ("Payment is not`);
console.log(`  configured yet"). That refusal is the platform working, not a fault —`);
console.log(`  and it is why this script refuses to run unless PAYMENT_MODE resolves`);
console.log(`  to 'transfer', the one mode in which that refusal happens.`);
console.log(`\n  payout_locked = 1 on every seeded shop, exactly as the portal sets it`);
console.log(`  the first time a real listing is published. So adding a payout account`);
console.log(`  to one of these does not take effect for 24 hours, is written to the`);
console.log(`  audit trail, and mails the account — the same protection a live`);
console.log(`  listing gets. A demo shop is not a shortcut around it.`);
console.log(`\n  Side effect worth knowing: the portal will not let you SAVE an edit to`);
console.log(`  one of these shops while it is published with priced items and has no`);
console.log(`  payout route. Move it to draft first, or add a payout route — that`);
console.log(`  guard exists to stop real sellers listing something nobody can pay for.`);

console.log(`\nHave a look: /market · / (the feed) · /portal/login`);
console.log(`Remove it all again with:  npm run seed:bazaar -- --clean\n`);

db.close();
