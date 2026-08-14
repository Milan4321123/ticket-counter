# Go-Live Guide — from your computer to selling real tickets

This guide takes you from "the site runs on my laptop" to "people are buying tickets at my own web address", step by step. No prior hosting experience needed. Set aside a quiet hour, and do the steps in order.

A quick map of what you're about to set up:

1. [A domain](#1-buy-a-domain) — your web address.
2. [Hosting on Render](#2-put-the-site-on-the-internet-render) — the computer that runs the site 24/7.
3. [SendGrid](#3-set-up-email-sendgrid) — so ticket emails actually arrive.
4. [The admin panel: security and the hidden address](#4-the-admin-panel-security-and-the-hidden-address) — what protects it, plus the optional secret URL.
5. [A full test run](#5-test-run-before-you-announce-anything) — before you announce.
6. [The event-day runbook](#6-event-day-runbook) — what to do at the door.
7. [Money handling](#7-money-where-it-goes-and-how-to-read-the-dashboard) — where it goes and how to read the dashboard.

---

## 1. Buy a domain

Your domain is the address people type, e.g. `oktober-konzert.com` or `tickets-yourband.de`.

1. Go to any domain registrar — Namecheap, Cloudflare, IONOS, GoDaddy, and Porkbun are all fine.
2. Search for a name you like and buy it. A normal `.com` or `.de` costs about **10–15 EUR per year**.
3. That's it for now — you'll connect it to the site in step 2.7.

Tip: keep it short and easy to say out loud — you'll be telling people this address in person and on posters.

## 2. Put the site on the internet (Render)

We recommend **[Render](https://render.com)** (its sibling **Railway** works very similarly). Render runs your site 24/7, gives it HTTPS automatically, and — crucially — offers a **persistent disk**, which this site needs for its database.

### 2.1 Put the project folder on GitHub first

Render installs your site from GitHub, so the project folder needs to live there.

- **Easiest way:** install [GitHub Desktop](https://desktop.github.com), sign in (create a free GitHub account if needed), choose **Add local repository**, pick this project folder, then **Publish repository**. Keep it set to **Private**.
- **Or with the command line**, from inside the project folder:

  ```bash
  git init
  git add .
  git commit -m "Ticket site"
  git branch -M main
  git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
  git push -u origin main
  ```

  (Create the empty repository on github.com first — the "…or push an existing repository" box there shows you these exact lines with your names filled in.)

Don't worry: your `.env.local` file with passwords is ignored by git and never uploaded. Secrets go into Render's settings instead, in step 2.5.

### 2.2 Create the web service

1. Create a free account at [render.com](https://render.com) (you can sign in with GitHub directly).
2. Click **New → Web Service** and pick your repository.
3. Fill in:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
4. Pick an instance type. The smallest **paid** tier is right for a 600-person sale — the free tier goes to sleep between visits and doesn't keep a disk.

### 2.3 Attach a persistent disk — do not skip this

**CRITICAL:** the SQLite database with every order, ticket, and check-in lives on this disk. Without it, every restart or deploy would wipe your sales.

1. In the service settings, find **Disks** and click **Add disk**.
2. **Mount path:** `/data` — a size of 1 GB is plenty.
3. In the next step you'll set the environment variable `DATA_DIR=/data`, which tells the site to keep its database there.

### 2.4 Set the environment variables

In the service's **Environment** tab, add these (values without quotes unless shown):

| Key | Value |
| --- | --- |
| `PAYMENT_MODE` | `transfer` |
| `NEXT_PUBLIC_BASE_URL` | `https://yourdomain.com` — your real address from step 1, with `https://` |
| `DATA_DIR` | `/data` |
| `APP_SECRET` | A long random string, 40+ characters. On a Mac, run `openssl rand -hex 32` in Terminal and paste the result. Never reuse a password here. |
| `ADMIN_PASSWORD` | A strong password, **at least 10 characters** — the site refuses weak or placeholder passwords in production. |
| `ADMIN_EMAIL` | Your email address — admin sign-in codes are sent here. |
| `ADMIN_GATE_PATH` | *(optional)* A secret word like `backstage-88907cbe`. When set, `/admin` shows a 404 to everyone; you unlock it by visiting `https://yourdomain.com/backstage-88907cbe` once per device. See step 4. |
| `ADMIN_PHONE` | *(optional)* Your mobile in full international format, e.g. `+4915155551234`. When set (with the Twilio keys below), your admin sign-in code is also texted to you. See step 4. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | *(optional)* From your Twilio account — needed only if you want the login code by SMS. |
| `SMTP_HOST` | `smtp.sendgrid.net` (from step 3) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `apikey` (literally that word — see step 3) |
| `SMTP_PASS` | Your SendGrid API key (from step 3) |
| `EMAIL_FROM` | `Event Tickets <tickets@yourdomain.com>` — must be the address you verify in step 3 |

Double-check `event.config.json` in the project too: your real event name, date, venue, prices, and — most importantly — **your real IBAN** under `bankTransfer`. That file is part of the project, so changes to it are uploaded via GitHub (commit + push), after which Render redeploys automatically.

### 2.5 Deploy

Click **Create Web Service** / **Deploy**. Render builds the site (a few minutes) and gives you a temporary address like `https://something.onrender.com`. Open it — your site should be live there.

### 2.6 Connect your domain

1. In Render: **Settings → Custom Domains → Add** and enter your domain.
2. Render shows you a **CNAME** record. In your domain registrar's DNS settings, add exactly that record (usually: type `CNAME`, name `www` or `@`, value `something.onrender.com`).
3. Wait a bit (minutes to a few hours). Render then issues an HTTPS certificate **automatically** — no configuration, no cost.
4. When `https://yourdomain.com` shows your site with a lock icon in the browser, update nothing else — you already set `NEXT_PUBLIC_BASE_URL` to this address.

## 3. Set up email (SendGrid)

Ticket emails must not land in spam. **[SendGrid](https://sendgrid.com)** is a service built for exactly this, with a free tier (100 emails/day) that covers most single events.

1. Create a SendGrid account.
2. **Verify your sender.** In SendGrid: **Settings → Sender Authentication**.
   - Quickest: **Single Sender Verification** — enter the exact address you'll send from (e.g. `tickets@yourdomain.com`), click the confirmation link SendGrid emails you. This address must match your `EMAIL_FROM`.
   - Better (fewer spam folders): **Domain Authentication** — SendGrid gives you a few DNS records to add at your registrar, like in step 2.6. Do this if you have 15 spare minutes.
3. **Create an API key.** **Settings → API Keys → Create API Key**, "Full Access" or at least "Mail Send". Copy the key immediately — it's shown only once.
4. Now the two odd-looking SMTP values make sense:
   - `SMTP_USER` is literally the word **`apikey`** — for everyone, always. It is not your username.
   - `SMTP_PASS` is the **API key** you just created (starts with `SG.`).
5. Enter these in Render (step 2.4) and redeploy if it doesn't restart by itself.

The same email setup powers three things at once: payment instructions to buyers, the QR-ticket emails, and your own admin sign-in codes.

## 4. The admin panel: security and the hidden address

Your admin panel lives at `https://yourdomain.com/admin` — same site, same domain. First, understand what actually protects it: **knowing the URL is not access.** Anyone who finds the login form still needs:

1. your **admin password**, and
2. the **one-time code** that is emailed to *your* inbox at that moment, and
3. patience, because failed attempts are **rate-limited** — a handful of wrong tries locks the door for 15 minutes, for guessing bots too.

Password + emailed code is the real protection. Your part of the deal: **keep `ADMIN_PASSWORD` strong and private** — a password manager suggestion of 16+ random characters is perfect, and don't reuse it from anywhere else.

**On top of that, you can hide the panel entirely** with the `ADMIN_GATE_PATH` setting (step 2.4). When it is set:

- `/admin` shows the site's normal "page not found" to everyone — bots and curious visitors never even see a login form.
- To unlock it on *your* device, visit `https://yourdomain.com/<your-gate-path>` once (e.g. `/backstage-88907cbe`). That silently sets a 30-day cookie and takes you to the login. After that, `/admin` works normally on that device; when it ever shows 404 again (new phone, cleared cookies, 30 days passed), just open the unlock link once more.
- Treat the gate path like a password: don't post it anywhere, and pick something unguessable (add a random suffix, not just `secret-admin`). If it ever leaks, change the value in Render's environment settings — old cookies become invalid instantly, because they're cryptographically tied to your `APP_SECRET`.
- Scanner links for door staff are **not affected** — staff never need the unlock URL.
- Leave `ADMIN_GATE_PATH` empty to switch the feature off and use plain `/admin` again.

One honest caveat: this hides the door, it doesn't strengthen the lock. The password + emailed code remain what actually keeps people out.

### Getting your sign-in code by text message (optional)

By default the 6-digit sign-in code arrives by email. If you'd also like it texted to your phone — handy if your email is slow, or as a second place to receive it — set `ADMIN_PHONE` and the three `TWILIO_*` values (step 2.4). With those in place the code is sent to **both** your email and your phone, and you can use whichever arrives first. Two-step login stays on as long as *either* email or SMS can deliver a code. To get the Twilio values: create a free account at [twilio.com](https://www.twilio.com), buy (or trial) a sending number, and copy the Account SID, Auth Token, and that number from the Twilio Console. Leave these blank to keep email-only login.

### A couple of built-in safety behaviors worth knowing

- **"Log out" signs you out everywhere.** Clicking log out doesn't just clear the current browser — it instantly invalidates every admin session on every device. So if you ever sign in on a shared or borrowed computer and forget to log out there, logging out anywhere (even later, from your own phone) locks that other session out immediately.
- **Failed sign-ins are rate-limited**, both per device and overall, so password- and code-guessing bots get locked out for 15 minutes after a handful of tries.
- **Requesting sign-in codes is throttled** — repeatedly hitting the login page won't flood your inbox/phone with codes (or run up a Twilio bill); while a code is still valid, the same one stays in effect until you use it or it expires.

## 5. Test run before you announce anything

Do one complete dress rehearsal on the real site. Have your phone and your inbox ready.

1. **Buy like a buyer.** On `https://yourdomain.com`, reserve 1 ticket using your own name and email.
2. **Check the instructions email.** Within a minute you should get "Reserved: your tickets …" with the amount, your IBAN, and a reference like `TICKETS-AB12CD34`. Check the spam folder too — if it's there, revisit step 3.2 (domain authentication helps).
3. **Confirm the payment in the admin panel.** Log in at `/admin` (password, then the emailed code). Your reservation sits under **Awaiting bank transfer**. Click **Payment received** and type the **last 4 characters of the reference** — exactly what you'll later read off your real bank statement. (You know no money actually moved; the site doesn't — that's fine for the test. No need to transfer yourself 1 EUR.)
4. **Check the ticket email.** The QR-ticket email should arrive; open its button link — your order page with the QR code.
5. **Test the door scanner.** In the admin area, create a **scanner link**, open it on a second phone if you have one, and scan the QR ticket from the first phone's screen. You should see **VALID — welcome!** Scan the same ticket again: **ALREADY USED**. That's the once-only protection working.
6. **Clean up — read this part carefully.**
   - If your dashboard shows a warning about **test-mode orders** (from playing with the site before configuring payment), click **Delete test orders**. That button only removes *test-mode (mock)* orders — pretend purchases with no real money behind them.
   - Your dress-rehearsal order from step 1 is a **real bank-transfer order**, so that button does not touch it — real orders are deliberately never deletable. Because you marked it paid, it now counts in your stats as 1 paid order with money you never actually received. That's the honest cost of a full rehearsal: just remember "my numbers start at 1 order / one ticket too high", or:
   - **Zero-footprint alternative:** run steps 1–2 only, then in the admin panel click **Cancel** on the reservation instead of confirming it. The seats are released and nothing is counted — you just don't get to rehearse the ticket email and scanner with a real ticket that way.
7. **Back up the database** once now, so you know how: download/copy the contents of the `/data` disk (Render's disk tab or a one-off job). Repeat before event day.

When all of this works, announce your ticket link.

## 6. Event-day runbook

The evening before:

- In the admin panel, **create scanner links** for your door staff — set the validity long enough to cover the whole night (e.g. 24 hours). Send each person the link, or have them scan the link's QR code from your screen. Staff with a scanner link can *only* check tickets in — they can't see your dashboard, orders, or revenue, and there's no password to leak.
- Make sure everyone's **phone is charged** (bring a power bank), knows the venue wifi, and has mobile data as backup — the scanner needs an internet connection to verify tickets.
- Take a **fresh backup** of the database (step 5.7).

At the door:

- Staff open their scanner link and scan each guest's QR code — from a phone screen or a printout, both work.
- **Camera won't cooperate, or the QR is scratched/dim?** Type the short code printed under it (like `K7KQ-M3XP`) — capitalization, spaces, and dashes don't matter. This manual entry is the built-in fallback; it's exactly as valid as scanning.
- What the results mean:
  - **VALID — welcome!** (green): let them in. For **student tickets** the screen reminds staff to check a valid student ID.
  - **ALREADY USED** (amber): this exact ticket was scanned before, with the time shown. Usually a shared screenshot or an accidental double-scan seconds ago (check the time — if it was 10 seconds ago at your own door, it was you). Otherwise, whoever scanned it first is inside.
  - **TEST ticket — do not admit** (red): a leftover from test mode; no real payment behind it. These are also blocked automatically — this result exists so nobody talks their way in with one.
  - **Order not paid** (red): a reservation whose bank transfer was never confirmed. Do not admit; send the person to the organizer — you can check the statement and mark the order paid on the spot from your own phone if the money did arrive.
  - **Ticket not found** (red): a typo, or a code that never existed. Re-type it carefully once before drawing conclusions.
- If a scanner phone is lost or a link ends up in the wrong hands, one click on **revoke scanner links** in the admin panel kills every scanner link instantly. Create fresh ones for your staff afterwards.

## 7. Money: where it goes and how to read the dashboard

- **Ticket money lands directly in your bank account** — the one whose IBAN is in `event.config.json`. There is no middleman holding your money and no payout schedule: each buyer's transfer arrives like any other transfer, with their reference in the purpose line.
- On the dashboard:
  - **Awaiting bank transfer** — reservations whose money is still on its way. The sum tells you how much should be appearing on your statement over the next days. Compare statement and list, confirm matches with **Payment received**.
  - **Revenue (real payments)** — money you have confirmed received. This only grows when *you* mark orders paid, so it never counts money that isn't actually in your account.
  - References starting with **`TICKETS-S-`** are orders that include student tickets — you can tally student sales straight off your bank statement.
- **Refunds are manual bank transfers back.** The site never moves money, so it can't refund either — you simply transfer the amount back to the buyer's account (you can see it on your statement, next to their payment). Do this for: cancelled events, payments that arrived after a sell-out, or your own goodwill policy — whatever you announced.
- After the event, keep the database backup and your bank statements together — that's your complete, auditable record of the sale.

Have a great show!
