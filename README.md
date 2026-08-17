# Multi-Organizer Ticket Platform

## 1. What this is

A complete, self-contained **ticketing platform for multiple event organizers**. You — the platform owner — charge organizers a fee **per event** they publish: €15 to publish, plus €0.15 for every ticket the venue holds, so a 500-person event costs €90 (accounts are free). Each organizer gets a self-service portal where they build their event page (photos, video, description, address, ticket tiers), publish it to the public feed, and sell tickets. Buyers pay by **bank transfer directly to the organizer's own bank account** — the platform never holds ticket money. When the organizer sees the money on their bank statement, they confirm the payment and the site instantly creates QR-code tickets and emails them to the buyer.

Every ticket has a unique code and scans exactly once at the door. Seat counts and prices are enforced on the server, so nobody can oversell an event or tamper with prices from a browser. Everything is stored in a single data folder that you control — no monthly software fees, no third-party ticketing cut.

Three kinds of people use the site, in three separate areas:

| Who | Where | What they do |
| --- | --- | --- |
| **Buyers** | `/` and `/e/…` | Browse events, buy tickets, receive QR tickets by email. No account needed. |
| **Organizers** | `/portal` | Manage their events, tiers, photos, bank details; confirm payments; create door-scanner links. |
| **You (platform owner)** | `/admin` | Manage organizer accounts, confirm event fees, oversee everything. |
| **Door staff** | `/scan` | Check tickets in via a time-limited scanner link — nothing else. |

**New here?** The business side (fees, onboarding organizers, support) is in **[PLATFORM.md](PLATFORM.md)**. The click-by-click launch guide is in **[GO-LIVE.md](GO-LIVE.md)**.

## 2. Quick start (try it in 2 minutes)

You need [Node.js](https://nodejs.org) installed (version 18 or newer). Then, in the project folder:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To try the real flows locally, create a file called `.env.local` in the project folder:

```bash
PAYMENT_MODE=transfer
ADMIN_PASSWORD=pick-something-long-and-private
APP_SECRET=any-long-random-string-for-local-testing
```

Then:

1. Sign in to the admin area at [http://localhost:3000/admin](http://localhost:3000/admin) with your `ADMIN_PASSWORD`. (During development, emailed sign-in codes are also printed to the server console, so broken email settings never lock you out.)
2. Create an organizer account under **/admin/organizers** — the site shows you a one-time password.
3. Log in as that organizer at [http://localhost:3000/portal/login](http://localhost:3000/portal/login), create an event, and give it a tier and an IBAN (any test value). Publishing is locked until the event fee is confirmed — hop back to **/admin/organizers → Event fees**, click *Fee received*, type the last 4 characters of the event's `EVENT-…` reference, then publish from the portal.
4. Visit the homepage, buy a ticket as a buyer, then confirm the "payment" from the portal and watch the QR ticket arrive.

## 3. How the site fits together

- **`/` — the public feed.** Every published event from every organizer, newest first.
- **`/e/[slug]` — event pages.** Each event's own page: photos, video, description, an "Open in Maps" address link, and the ticket shop. Organizers style it with a theme — or, if the AI designer is enabled, describe the vibe in their own words and let the AI pick the look and write the copy.
- **`/checkout`, `/order/[id]`, `/ticket/[code]` — the buyer flow.** Reserve seats, see payment instructions (amount, the organizer's IBAN, a personal reference like `TICKETS-AB12CD34`), then find the QR tickets on the personal order page and in email. References containing `S-` mark orders with student tickets, visible right on the bank statement.
- **`/portal` — the organizer portal.** Email + password login (accounts are created by the platform admin). Organizers see only their own events and orders — ownership is checked on the server for every single request.
- **`/admin` — the platform admin.** Password plus emailed one-time code. Manage organizer accounts (create, activate, reset password, disable), confirm the per-event fees that unlock publishing, and oversee platform-wide activity.
- **`/scan` — door check-in.** Opened via time-limited scanner links that organizers (or you) generate per event. A scanner link gives access to that one event's check-in screen only: staff scan a ticket's QR code or type its short code; each ticket works exactly once, student tickets show a "check student ID" reminder, and a ticket from a different event is clearly rejected.

## 4. How payment works (bank transfer)

1. **The buyer reserves tickets at checkout.** Seats are held immediately — nobody else can buy them while the reservation stands.
2. **They see (and receive by email) the payment instructions:** the amount, the *organizer's* bank details, and a personal payment reference. They transfer the money from their own banking app within the event's pay-within window.
3. **The organizer watches their own bank statement.** The portal shows every open reservation with its reference, buyer, and expected amount.
4. **The organizer confirms the payment.** The site mints the QR tickets and emails them to the buyer automatically.
5. **If no payment arrives**, the reservation expires on its own (pay-within days + 2 grace days) and the seats go back on sale. Late payments are handled gracefully: marking an expired reservation paid re-reserves the seats if any are left.

The platform itself is never in the money flow — ticket revenue goes buyer → organizer, and organizers pay the platform owner a per-event fee separately. Why that matters (and how to run it as a business) is explained in [PLATFORM.md](PLATFORM.md).

### The event fee (how you get paid)

Your own revenue runs on the same bank-transfer idea, one event at a time:

1. **An organizer builds an event** in their portal. Drafts are free and unlimited.
2. **The Publish tab shows the fee card**: the amount for *that* event, *your* bank details, and that event's Verwendungszweck — a reference like `EVENT-1A2B3C4D` derived from the event id. The Publish button stays locked, and the same details are emailed to the organizer.
   The amount is €15.00 to publish plus €0.15 for every ticket the venue holds, so a 500-person event costs €90.00 (`PLATFORM_FEE_BASE_CENTS` / `PLATFORM_FEE_PER_TICKET_CENTS`). It is charged on the capacity the organizer states, not on tickets sold: the platform never touches ticket money, so there is nothing to deduct a per-sale fee from and nothing left to invoice afterwards. It is quoted the moment the organizer is shown it and stored on the event, so the Publish tab, the email, and your confirm screen always name the same number. While the fee is unpaid, changing the capacity re-quotes it; once you confirm the payment the amount is frozen.
3. **They transfer the fee** with that reference in the purpose line.
4. **You confirm it** at `/admin/organizers` → **Event fees**: click *Fee received* and type the last 4 characters of the reference from your bank statement (the same two-step confirm as ticket payments). Publishing unlocks instantly and the organizer gets a "your event can go live" email.

Events that were already published before this pricing landed are grandfathered in as paid — nobody is charged retroactively.

Three emails carry this flow (all fail silently when SMTP is unset, since every detail is on screen too):

| Email | When | What's in it |
| --- | --- | --- |
| Signup instructions | Right after someone signs up at `/organizers/signup` | Welcome, "the account is free, events cost X", your bank box, their account reference, portal link. |
| Event fee instructions | When they try to publish an event whose fee hasn't arrived | Your bank box and that event's `EVENT-…` Verwendungszweck, plus a link to the Publish tab. |
| Event can go live | When you confirm that event's fee | "Publishing is unlocked" and a link straight to the Publish tab. |

## 5. Email

Fill in the SMTP settings so the site can send email:

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-api-key
EMAIL_FROM="Your Platform <tickets@yourdomain.com>"
```

Email is used for payment instructions after a reservation, the QR-ticket emails after a confirmed payment, and the platform admin's sign-in codes. If SMTP is blank, sales still work (buyers see everything on their order page), but for a real launch set it up — [GO-LIVE.md](GO-LIVE.md) walks through SendGrid step by step.

## 6. The AI page designer (optional)

If you set `ANTHROPIC_API_KEY`, organizers get an extra option when designing their event page: they describe the look and feel they want in plain words ("dark and moody, it's a metal night" / "elegant, classical, gold"), and the AI picks a matching color mood and page treatment and writes a headline, tagline, and highlight lines from the event's real details. The AI can only choose from the site's fixed design options — it never injects its own code or styling into your pages. Without the key, the manual theme picker covers everyone.

The **visitor Q&A assistants** (the question box on event pages, and the platform help bot at `POST /api/platform/ask`) run on Google Gemini's free tier instead: set `GEMINI_API_KEY` with a free key from [Google AI Studio](https://aistudio.google.com). When that key is missing — or the free quota runs out — they fall back to `ANTHROPIC_API_KEY`. With neither key set, nothing breaks: event-page questions go straight to the organizer to answer in the portal, and the help bot politely points visitors at the platform contact.

## 7. Environment variable reference

Locally these go in `.env.local`; on a hosting service, into its environment-variables settings.

| Variable | Required? | What it does |
| --- | --- | --- |
| `PLATFORM_NAME` | Recommended | Your platform's public name, shown in the site header, page titles, and emails. |
| `PLATFORM_FEE_BASE_CENTS` | No | The flat part, in cents (default `1500` = €15.00) — what it costs to publish at all. |
| `PLATFORM_FEE_PER_TICKET_CENTS` | No | The per-ticket part, in cents (default `15` = €0.15), charged on the capacity the organizer states. With both defaults: 100 capacity → €30.00, 300 → €60.00, 500 → €90.00, 1000 → €165.00. Charged once per event, before it can be published — organizer accounts themselves are free. Shown on `/organizers`, on each event's Publish tab, in `/admin/organizers`, and in the fee emails. |
| `PLATFORM_BANK_HOLDER` / `PLATFORM_BANK_IBAN` | For collecting fees | **Your own** bank account, shown to organizers paying an event fee. Until both are set, the fee card and signup page show a "being set up — contact us" note instead. |
| `PLATFORM_BANK_BIC` / `PLATFORM_BANK_NAME` | No | Optional BIC and bank name shown alongside your payment details. |
| `PLATFORM_CONTACT_EMAIL` | Recommended | Where organizers reach you about a **custom-designed page**: shown as a mailto link on `/contact` and `/organizers`, and used as the recipient of every enquiry from the contact form. Falls back to the first `ADMIN_EMAIL` address, then to a demo address. |
| `PAYMENT_MODE` | **Yes, for real sales** | `transfer` = bank transfer (the platform's payment model). `mock` = fake test payments for development. |
| `ADMIN_PASSWORD` | **Yes** | The platform admin password. Production requires 10+ characters and rejects placeholders. Without it, `/admin` is disabled. |
| `APP_SECRET` | **Yes, in production** | A long random string used to sign admin sessions, organizer sessions, and scanner links. Changing it logs everyone out. |
| `ADMIN_EMAIL` | Recommended | Where admin sign-in codes are emailed. Comma-separate multiple addresses. Also used as the seeded owner account's email on first migration. |
| `ADMIN_OTP` | No | Set to `off` to disable the emailed one-time code (password-only admin login). |
| `NEXT_PUBLIC_BASE_URL` | **Yes, in production** | The site's public address, e.g. `https://tickets.example.com` — used in emailed links and scanner links. |
| `DATA_DIR` | On hosted setups | The data folder — SQLite database **and uploaded event photos**. Defaults to `./data`. Point it at the persistent disk (e.g. `/data`). |
| `GEMINI_API_KEY` | No | Free key from Google AI Studio — powers the Q&A assistants (the event-page question box and the platform help bot); falls back to `ANTHROPIC_API_KEY`, or to organizer-answered questions when neither is set. |
| `ANTHROPIC_API_KEY` | No | Enables the AI page designer for organizers (section 6). Also the fallback model for the Q&A assistants when `GEMINI_API_KEY` is unset or over quota. Leave unset to offer the manual theme picker only. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | For email | Your email provider's SMTP settings (for SendGrid: host `smtp.sendgrid.net`, port `587`, user literally `apikey`, pass = your API key). |
| `EMAIL_FROM` | For email | The sender, e.g. `"Your Platform <tickets@yourdomain.com>"`. Emails don't send without it. |
| `ADMIN_GATE_PATH` | No | A secret word that hides `/admin` behind a 404 until you visit `https://yourdomain.com/<gate-path>` once per device. |
| `ADMIN_PHONE` + `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | No | Also text the admin sign-in code to your phone via Twilio. |
| `ADMIN_MASTER_OTP` | No | A fixed code accepted in place of the emailed one — for testing only. Leave unset in production. |
| `PAYPAL_ENV` / `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | No | Legacy PayPal checkout support from the single-event version. Not used in the bank-transfer platform model. |
| `ALLOW_MOCK_PAYMENTS` | No | Safety latch: a production build only allows `PAYMENT_MODE=mock` if this is also `true`. Leave unset. |

## 8. Where the data lives

Everything is under one folder — `DATA_DIR` (locally `./data`):

- **`tickets.db`** — the SQLite database: organizers, events, ticket tiers, orders, tickets, check-ins.
- **`uploads/`** — every uploaded event photo, in a subfolder per event.

That folder **is** the platform. Back it up regularly, treat it as private personal data (it contains buyer names and emails), and on any hosting service make sure it sits on a **persistent disk** — serverless hosts that wipe the filesystem between requests (like plain Vercel) will lose your orders.

Built-in safety you don't have to configure:

- Prices and seat counts are always enforced on the server; overselling is blocked atomically even with many simultaneous buyers.
- Every portal and API request checks ownership — an organizer can never see or touch another organizer's events, orders, or photos.
- Order creation, logins, and code verification are rate-limited against bots and password guessing.
- A production build never silently falls back to test mode.

## 9. Migrating from the single-event version

If you used the earlier single-event version of this site: on first start, the platform automatically imports your `event.config.json` as the platform's **first published event**, keeps all existing orders and tickets attached to it, and creates a seeded "platform owner" organizer account that owns it. That account can't log in until you set its password — do that from `/admin/organizers` with **reset password**. Details in [GO-LIVE.md](GO-LIVE.md).

## 10. Going live

The complete launch guide — domain, hosting on Render, SendGrid, creating your first organizer, the test run, and the event-day runbook — is in **[GO-LIVE.md](GO-LIVE.md)**. The short version of what the platform needs:

- A host that runs **Node.js** with a **persistent disk** for `DATA_DIR`.
- `npm install && npm run build` to build, `npm start` to run.
- The environment variables from the table above, and HTTPS (hosts like Render handle that automatically).
- Regular **backups of the data folder**.
