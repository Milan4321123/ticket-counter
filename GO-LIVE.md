# Go-Live Guide — from your computer to a live ticket platform

This guide takes you from "the site runs on my laptop" to "organizers are selling tickets at my own web address", step by step. No prior hosting experience needed. Set aside a quiet hour, and do the steps in order.

A quick map of what you're about to set up:

1. [Name your platform and buy a domain](#1-name-your-platform-and-buy-a-domain)
2. [Hosting on Render](#2-put-the-site-on-the-internet-render) — the computer that runs the site 24/7, with a persistent disk.
3. [SendGrid](#3-set-up-email-sendgrid) — so ticket emails actually arrive.
4. [The admin panel: security and the hidden address](#4-the-admin-panel-security-and-the-hidden-address)
5. [Your first organizer (and the migrated event)](#5-your-first-organizer-and-the-migrated-event)
6. [A full test run](#6-test-run-before-you-announce-anything) — before you announce.
7. [The event-day runbook](#7-event-day-runbook) — what happens at the door.
8. [Money handling](#8-money-who-gets-what) — who gets what.

---

## 1. Name your platform and buy a domain

You're launching a platform, so it needs a name — the name organizers will recommend to each other and buyers will see on their tickets. This platform's name is **MartNepali**, and its domain is **martnepali.com** — the domain *is* the platform name, which is the ideal.

1. Set the name as the `PLATFORM_NAME` environment variable (step 2.4) — it appears in the site header, page titles, and emails. (`MartNepali` is also the built-in default, so leaving it unset shows the same name.)
2. Go to any domain registrar — Namecheap, Cloudflare, IONOS, GoDaddy, and Porkbun are all fine — and buy the matching domain. A normal `.com` or `.de` costs about **10–15 EUR per year**.
3. That's it for now — you'll connect the domain to the site in step 2.6.

## 2. Put the site on the internet (Render)

We recommend **[Render](https://render.com)** (its sibling **Railway** works very similarly). Render runs your site 24/7, gives it HTTPS automatically, and — crucially — offers a **persistent disk**, which this platform needs for its data.

### 2.1 Put the project folder on GitHub first

Render installs your site from GitHub, so the project folder needs to live there.

- **Easiest way:** install [GitHub Desktop](https://desktop.github.com), sign in (create a free GitHub account if needed), choose **Add local repository**, pick this project folder, then **Publish repository**. Keep it set to **Private**.
- **Or with the command line**, from inside the project folder:

  ```bash
  git init
  git add .
  git commit -m "Ticket platform"
  git branch -M main
  git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
  git push -u origin main
  ```

  (Create the empty repository on github.com first — the "…or push an existing repository" box there shows you these exact lines with your names filled in.)

Don't worry: your `.env.local` file with passwords is ignored by git and never uploaded. Secrets go into Render's settings instead, in step 2.4.

### 2.2 Create the web service

1. Create a free account at [render.com](https://render.com) (you can sign in with GitHub directly).
2. Click **New → Web Service** and pick your repository.
3. Fill in:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
4. Pick an instance type. The smallest **paid** tier is the right starting point — the free tier goes to sleep between visits and doesn't keep a disk.

### 2.3 Attach a persistent disk — do not skip this

**CRITICAL:** the disk holds the SQLite database (every organizer, event, order, ticket, and check-in) **and all uploaded event photos**. Without it, every restart or deploy would wipe the platform clean.

1. In the service settings, find **Disks** and click **Add disk**.
2. **Mount path:** `/data`. Size it with photos in mind: each event can carry up to 12 photos of up to 5 MB — **5 GB** is a comfortable start and can be grown later.
3. In the next step you'll set the environment variable `DATA_DIR=/data`, which tells the site to keep everything there.

### 2.4 Set the environment variables

In the service's **Environment** tab, add these (values without quotes unless shown):

| Key | Value |
| --- | --- |
| `PLATFORM_NAME` | Your platform's name from step 1: `MartNepali` (also the built-in default) |
| `PAYMENT_MODE` | `transfer` |
| `NEXT_PUBLIC_BASE_URL` | `https://martnepali.com` — your real address from step 1, with `https://` |
| `DATA_DIR` | `/data` |
| `APP_SECRET` | A long random string, 40+ characters. On a Mac, run `openssl rand -hex 32` in Terminal and paste the result. Never reuse a password here. |
| `ADMIN_PASSWORD` | A strong password, **at least 10 characters** — the site refuses weak or placeholder passwords in production. |
| `ADMIN_EMAIL` | Your email address — admin sign-in codes are sent here. |
| `ANTHROPIC_API_KEY` | *(optional)* An API key from [console.anthropic.com](https://console.anthropic.com) — switches on the AI page designer for your organizers. Leave it out and they use the manual theme picker. |
| `ADMIN_GATE_PATH` | *(optional)* A secret word like `backstage-88907cbe`. When set, `/admin` shows a 404 to everyone; you unlock it by visiting `https://yourdomain.com/backstage-88907cbe` once per device. See step 4. |
| `ADMIN_PHONE` | *(optional)* Your mobile in full international format, e.g. `+4915155551234`. When set (with the Twilio keys below), your admin sign-in code is also texted to you. See step 4. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | *(optional)* From your Twilio account — needed only if you want the login code by SMS. |
| `SMTP_HOST` | `smtp.sendgrid.net` (from step 3) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `apikey` (literally that word — see step 3) |
| `SMTP_PASS` | Your SendGrid API key (from step 3) |
| `EMAIL_FROM` | `MartNepali <support@eventsticketbuy.com>` — must be the address you verify in step 3. (The support mailbox stays at the old domain for now; swap it for a `martnepali.com` address once mail there is authenticated **and** can receive.) |

Note what is *not* in this list anymore: event details and bank accounts. Those now live in the database — each organizer enters their own event details and **their own IBAN** in their portal. You never configure anyone's bank details.

### 2.5 Deploy

Click **Create Web Service** / **Deploy**. Render builds the site (a few minutes) and gives you a temporary address like `https://something.onrender.com`. Open it — your platform should be live there (an empty feed at first is normal).

### 2.5b If video uploads fail after deploying, it's an upload size limit

Organizers upload videos up to 60 MB. Several hosting setups quietly cut off big uploads long before that, and the symptom is confusing: small clips upload fine, real phone videos fail with *"The upload did not come through."*

The app itself is already configured correctly (`middlewareClientMaxBodySize` in `next.config.mjs`). What can still block it is whatever sits *in front* of the app:

| If you host behind… | Raise this |
| --- | --- |
| Render, Railway, Fly.io | Usually fine out of the box — no change needed |
| Your own **nginx** | `client_max_body_size 80m;` (the default is **1 MB** and will break uploads immediately) |
| Your own **Caddy** | `request_body { max_size 80MB }` |
| Cloudflare proxy (orange cloud) | Free plan caps uploads at **100 MB** — fine for 60 MB videos, but note it applies before your server sees anything |

If you ever want a different video limit, change `MAX_VIDEO_BYTES` in `src/lib/media.ts`, keep `middlewareClientMaxBodySize` comfortably above it, and raise the proxy limit to match.

### 2.6 Connect your domain

1. In Render: **Settings → Custom Domains → Add** and enter your domain.
2. Render shows you a **CNAME** record. In your domain registrar's DNS settings, add exactly that record (usually: type `CNAME`, name `www` or `@`, value `something.onrender.com`).
3. Wait a bit (minutes to a few hours). Render then issues an HTTPS certificate **automatically** — no configuration, no cost.
4. When `https://yourdomain.com` shows your site with a lock icon in the browser, you're done — you already set `NEXT_PUBLIC_BASE_URL` to this address.

## 3. Set up email (SendGrid)

Ticket emails must not land in spam. **[SendGrid](https://sendgrid.com)** is a service built for exactly this, with a free tier (100 emails/day) that covers a small platform's start. Once several organizers sell at the same time, watch that daily limit — the first paid tier is cheap and removes it.

1. Create a SendGrid account.
2. **Verify your sender.** In SendGrid: **Settings → Sender Authentication**.
   - Quickest: **Single Sender Verification** — enter the exact address you'll send from (e.g. `tickets@yourdomain.com`), click the confirmation link SendGrid emails you. This address must match your `EMAIL_FROM`.
   - Better (fewer spam folders): **Domain Authentication** — SendGrid gives you a few DNS records to add at your registrar, like in step 2.6. Do this if you have 15 spare minutes.
3. **Create an API key.** **Settings → API Keys → Create API Key**, "Full Access" or at least "Mail Send". Copy the key immediately — it's shown only once.
4. Now the two odd-looking SMTP values make sense:
   - `SMTP_USER` is literally the word **`apikey`** — for everyone, always. It is not your username.
   - `SMTP_PASS` is the **API key** you just created (starts with `SG.`).
5. Enter these in Render (step 2.4) and redeploy if it doesn't restart by itself.

The same email setup powers everything at once: payment instructions to buyers, the QR-ticket emails, and your own admin sign-in codes — for every organizer on the platform.

## 4. The admin panel: security and the hidden address

Your admin panel lives at `https://yourdomain.com/admin` — and it now controls a whole platform, not just one event, so its security matters even more. First, understand what actually protects it: **knowing the URL is not access.** Anyone who finds the login form still needs:

1. your **admin password**, and
2. the **one-time code** that is emailed to *your* inbox at that moment, and
3. patience, because failed attempts are **rate-limited** — a handful of wrong tries locks the door for 15 minutes, for guessing bots too.

Password + emailed code is the real protection. Your part of the deal: **keep `ADMIN_PASSWORD` strong and private** — a password manager suggestion of 16+ random characters is perfect, and don't reuse it from anywhere else.

**On top of that, you can hide the panel entirely** with the `ADMIN_GATE_PATH` setting (step 2.4). When it is set:

- `/admin` shows the site's normal "page not found" to everyone — bots and curious visitors never even see a login form.
- To unlock it on *your* device, visit `https://yourdomain.com/<your-gate-path>` once (e.g. `/backstage-88907cbe`). That silently sets a 30-day cookie and takes you to the login. After that, `/admin` works normally on that device; when it ever shows 404 again (new phone, cleared cookies, 30 days passed), just open the unlock link once more.
- Treat the gate path like a password: don't post it anywhere, and pick something unguessable (add a random suffix, not just `secret-admin`). If it ever leaks, change the value in Render's environment settings — old cookies become invalid instantly, because they're cryptographically tied to your `APP_SECRET`.
- Organizer portal logins and scanner links are **not affected** — organizers and door staff never need the unlock URL.
- Leave `ADMIN_GATE_PATH` empty to switch the feature off and use plain `/admin` again.

One honest caveat: this hides the door, it doesn't strengthen the lock. The password + emailed code remain what actually keeps people out.

### Getting your sign-in code by text message (optional)

By default the 6-digit sign-in code arrives by email. If you'd also like it texted to your phone — handy if your email is slow, or as a second place to receive it — set `ADMIN_PHONE` and the three `TWILIO_*` values (step 2.4). With those in place the code is sent to **both** your email and your phone, and you can use whichever arrives first. Two-step login stays on as long as *either* email or SMS can deliver a code. To get the Twilio values: create a free account at [twilio.com](https://www.twilio.com), buy (or trial) a sending number, and copy the Account SID, Auth Token, and that number from the Twilio Console. Leave these blank to keep email-only login.

### A couple of built-in safety behaviors worth knowing

- **"Log out" signs you out everywhere.** Clicking log out doesn't just clear the current browser — it instantly invalidates every admin session on every device. So if you ever sign in on a shared or borrowed computer and forget to log out there, logging out anywhere (even later, from your own phone) locks that other session out immediately.
- **Failed sign-ins are rate-limited**, both per device and overall, so password- and code-guessing bots get locked out for 15 minutes after a handful of tries.
- **Requesting sign-in codes is throttled** — repeatedly hitting the login page won't flood your inbox/phone with codes (or run up a Twilio bill); while a code is still valid, the same one stays in effect until you use it or it expires.

## 5. Your first organizer (and the migrated event)

Organizers apply for an account through the site — the sales page at `/organizers` sends them to the application form at `/contact?intent=account`, and you approve the application from `/admin/contact` (one click creates the account and emails them their sign-in details) — or **you** create the account by hand. Either way it's free: the account, publishing, everything — the platform charges organizers nothing; see [PLATFORM.md](PLATFORM.md) for the whole playbook. The short version of creating one yourself:

1. Sign in at `/admin` and open **`/admin/organizers`**.
2. Create the account: name and email. Accounts never expire, so there is no plan date to pick.
3. Copy the **one-time password** the site shows you and send it to the organizer along with their login link:

   ```
   https://yourdomain.com/portal/login
   ```

4. From there they do everything themselves: create their event, upload photos, set tiers and prices, enter **their own IBAN**, and publish.

### If you ran the old single-event version

The earlier version of this site sold tickets for exactly one event, configured in `event.config.json`. The platform migrates that automatically on first start with your existing database:

- Your original event now lives as the **first published event** on the platform, with its tiers, bank details, and **all existing orders and tickets** intact — buyers' order pages and tickets keep working at the same addresses.
- It is owned by a seeded **"platform owner" organizer account** (using the first address from your `ADMIN_EMAIL`). That account **cannot log in yet** — it has no password on purpose.
- To manage the migrated event from the portal, open `/admin/organizers`, find the platform-owner account, click **reset password**, and use the fresh password at `/portal/login`. While you're in the portal, give the event a proper street address (the migration reuses the old venue text) so the "Open in Maps" link points somewhere real.

Fresh installs without an old database simply start with an empty platform — nothing to migrate.

## 6. Test run before you announce anything

Do one complete dress rehearsal on the real site, wearing all four hats: admin, organizer, buyer, door staff. Have your phone and your inbox ready.

1. **As admin:** create a test organizer account for yourself (use your own email).
2. **As organizer:** log in at `/portal/login` and create a small test event — a photo, one or two tiers, your own IBAN. Publishing is free: the Publish tab shows a checklist of anything still missing (a way to be paid for priced tiers, and the authenticator app the portal asks every selling account to set up); finish it and publish. Check the event appears in the feed and its page at `/e/…` looks right (address link, photos, video).
3. **As buyer:** reserve 1 ticket using your own name and email. Within a minute you should get the payment-instructions email with the amount, the IBAN, and a reference like `TICKETS-AB12CD34`. Check the spam folder too — if it's there, revisit step 3.2 (domain authentication helps).
4. **As organizer again:** your reservation appears in the portal's awaiting-transfer list. Confirm it as paid — exactly what you'll later do while reading your real bank statement. (You know no money actually moved; the site doesn't — that's fine for the test.)
5. **Check the ticket email.** The QR-ticket email should arrive; open its button link — the order page with the QR code.
6. **As door staff:** from the portal, create a **scanner link** for the test event, open it on a second phone if you have one, and scan the QR ticket from the first phone's screen. You should see **VALID**. Scan the same ticket again: **ALREADY USED**. That's the once-only protection working.
7. **Clean up.** Cancel any leftover open reservations, then unpublish or archive the test event so it disappears from the feed. (Confirmed test orders stay in the books — real orders are deliberately never deletable — so remember your stats start one test ticket high, or skip step 4 and cancel the reservation instead if you want a zero-footprint test.)
8. **Take a backup** once now, so you know how — see the next section. Do it before you have anything to lose, not after.

When all of this works, you're ready to onboard your first paying organizer.

### The two-minute check before any deploy

The dress rehearsal above is for the first time. After that, three commands catch
the things a person reading a page will not:

```bash
npm test          # the logic: pricing, tenancy, inventory, reviews, retention
npm run typecheck # nothing broken by a rename
npm run audit     # the RUNNING site, from outside
```

`npm run audit` crawls a running copy — `npm run audit` on its own checks
`http://localhost:3000`, or pass a URL: `npm run audit -- https://martnepali.com`.
It fetches only public pages (never `/admin`, `/portal`, `/order` or a ticket)
and it fails the run, with exit code 1, when it finds any of these:

- a price shown without naming the seller it belongs to — the VAT rule this whole
  platform's structure depends on;
- an example shop appearing anywhere without its mark;
- a star rating with no reviews behind it, or "often bought together" without the
  orders it claims;
- a link on a public page that 404s, or a sitemap entry that does;
- an image with no `alt`, a form control with no name, a page with no `<main>` or
  no skip link, two `<h1>`s, or a duplicate `id`;
- a page with no title, no description, or two canonical links;
- **a database column reaching the browser** — an IBAN or a private note serialised
  into a page because a row was handed to a client component;
- a photo served `no-store` (every visitor re-downloading every picture), or an
  API response served cacheable;
- two indexable pages sharing a title, or a page that would arrive in a WhatsApp
  group as a grey box.

Run it against production after a deploy too. It only reads.

## 6b. Backups — the one thing you must not skip

Every organizer, order and issued ticket lives in a single file on the server's disk. The app is not the risk; losing that file is. A ticketing platform that cannot say who paid is finished, so treat this as part of going live, not as housekeeping.

Take one with:

```bash
npm run backup
```

That writes a database snapshot **and** a compressed copy of the uploaded photos and videos into `data/backups/`, then verifies the snapshot opens cleanly and prints the row counts so you can see it worked. It runs safely while the site is live — it uses SQLite's own online-snapshot command, so nobody gets an error mid-purchase.

Two things worth knowing:

- **Never back up by copying `tickets.db` with `cp` while the app is running.** You can catch the file mid-write, and recent orders live in a separate `-wal` file that a plain copy misses. The command above handles both.
- **The photos are not in the database.** A database-only backup restores events whose images are all broken, which is why the default includes them.

**Automate it.** On Render, add a **Cron Job** service pointing at the same repo and disk, schedule `0 3 * * *` (3am daily), command `npm run backup`. Then copy the newest file off the server periodically — a backup that only exists on the machine you are protecting against is not a backup.

**To restore:** stop the app, copy a `tickets-*.db` file to `data/tickets.db`, delete any `tickets.db-wal` and `tickets.db-shm` sitting beside it, unpack the matching `uploads-*.tar.gz` into `data/`, and start the app.

## 7. Event-day runbook

Event day belongs to the **organizer**, not to you — share this section with them (or point them at their portal's help text). What matters:

The evening before:

- The organizer creates **scanner links** for their door staff in the portal — with a validity long enough to cover the whole night (e.g. 24 hours). Each staff member gets the link by message, or scans its QR code straight off the organizer's screen. A scanner link opens the check-in screen for **that one event only** — no portal, no buyer lists, no revenue, and no password to leak.
- Everyone's **phone charged** (bring a power bank), venue wifi known, mobile data as backup — the scanner needs an internet connection to verify tickets.

At the door:

- Staff open their scanner link and scan each guest's QR code — from a phone screen or a printout, both work.
- **Camera won't cooperate, or the QR is scratched or dim?** Type the short code printed under it (like `K7KQ-M3XP`) — capitalization, spaces, and dashes don't matter. Manual entry is exactly as valid as scanning.
- What the results mean:
  - **VALID** (green): let them in. For **student tickets** the screen reminds staff to check a valid student ID.
  - **ALREADY USED** (amber): this exact ticket was scanned before, with the time shown. Usually a shared screenshot or an accidental double-scan seconds ago (check the time — 10 seconds ago at your own door means it was you). Otherwise, whoever scanned it first is inside.
  - **Wrong event** (red): a real ticket — but for a *different* event on the platform. Do not admit; the guest is at the wrong door or the wrong night.
  - **Order not paid** (red): a reservation whose bank transfer was never confirmed. Do not admit; send the person to the organizer, who can check their statement and confirm the order on the spot from their own phone if the money did arrive.
  - **Test ticket** (red): a leftover from test mode; no real payment behind it. Do not admit.
  - **Ticket not found** (red): a typo, or a code that never existed. Re-type it carefully once before drawing conclusions.
- If a scanner phone is lost or a link ends up in the wrong hands, the organizer **revokes their scanner links** with one click and issues fresh ones.

## 8. Money: who gets what

- **Ticket money goes directly to each organizer's own account** — never through you or the platform: no middleman, no payout schedule. There are two ways it gets there, and each organizer chooses per listing under *How you get paid*:
  - **Bank transfer / PayPal.Me (free).** Buyers reserve, transfer to the organizer's IBAN (or send to their PayPal.Me link) with a personal reference in the purpose line, and the organizer confirms the payment in the portal — that confirmation mints and emails the QR codes. References starting with `TICKETS-S-` contain student tickets.
  - **Instant payment through the organizer's OWN PayPal or Stripe account.** Under *Settings → Get paid instantly* an organizer pastes the credentials of their own PayPal REST app or their own Stripe API key (stored encrypted with `APP_SECRET`). Buyers then get a "Pay now" option; the charge is created on the *organizer's* PayPal/Stripe account, the money is theirs the same second, and the codes go out automatically. The platform holds no PayPal or Stripe account of its own and the `PAYPAL_*` environment variables are no longer used. The provider keeps its published fee (shown to the organizer, dated, in the same panel); the platform still takes nothing.
- **The platform itself takes nothing.** There is no event fee and no cut of sales — the platform is free for organizers while it grows (the why is in [PLATFORM.md](PLATFORM.md)). No money ever flows to you as the platform owner, so there is no platform bank account to configure and nothing for you to confirm.
- **Refunds are between organizer and buyer.** The platform never moves money, so it can't refund either — the organizer transfers the amount back, or refunds from their own PayPal/Stripe dashboard. You, the platform owner, never refund ticket money, because you never had it.
- **Rotating `APP_SECRET` invalidates every stored PayPal/Stripe credential** (they are encrypted with a key derived from it). Organizers then have to paste theirs in again — say so before you rotate.
- After each event, the organizer's bank/PayPal/Stripe statements plus your database backup are the complete, auditable record of the sale.

### The example bazaar: take it down before you change how payments work

The site can publish an **example shop** — one invented Nepali storefront, with an invented seller and an invented collection address — so that a seller being shown `/market` can see what their own shop here would look like instead of an empty room. It is created and removed by one script:

```
npm run seed:bazaar -- --yes-seed-production   # put it up
npm run seed:bazaar -- --clean                 # take it down
```

One, not seven: `/market` is where the real sellers list, and invented storefronts standing beside them bury the people actually trading. Six further example shops are kept in the script and seeded only with `--all-shops`, if you ever want a fuller demo. Everything below applies to whichever number is up.

**If those shops are up, run `--clean` BEFORE you change `PAYMENT_MODE` or `ALLOW_MOCK_PAYMENTS` — and put them back afterwards if you still want them.**

Why: those listings are published, priced and open for orders, exactly like a real shop. The only thing that stops a buyer being charged is that they have **no payout account and no instant-payment connection**, and the site runs in `PAYMENT_MODE=transfer`, where an order against a listing with no way to pay is refused outright. Switch the site to mock payments and the order is no longer refused: it completes as a fake-paid order, and an invented shop with an invented address hands out collection codes for a doorbell nobody answers. (Instant payments cannot reach the example shops: they run on each seller's *own* PayPal/Stripe connection, and the example sellers never get one.)

The seeding script checks the payment mode once, at the moment it runs, and refuses to seed in any other mode. It has no way to check again afterwards, and these rows are meant to stay up for months. `--clean` is the one action that removes the dependency. It needs no flag, works on production exactly as it does locally, and removes only rows whose id begins with `seed-bazaar-`.

Have a great launch!
