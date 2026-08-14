# Concert Ticket Sales Website

## 1. What this is

This is a complete, self-contained website for selling tickets to your concert (around 600 seats). Buyers visit the site, pick their tickets — including a discounted Student tier that requires a student ID at the door — and pay by **bank transfer**: the site reserves their seats, shows them your IBAN, the amount, and a personal payment reference, and they transfer the money from their own bank. You confirm each payment in the admin panel when it appears on your bank statement, and the site instantly creates the QR-code tickets and emails them to the buyer. (PayPal support is also built in but optional — bank transfer is the default and needs no payment provider at all.)

Every ticket has a unique code, and the site guarantees you can never sell more tickets than you have: seat counts and prices are enforced on the server, so nobody can tamper with them from their browser.

You also get a private admin area with a live dashboard (tickets sold, money received, money on its way, per-tier numbers) and a door check-in page for event night. Staff scan a ticket's QR code with a phone camera or type the code in; each ticket works exactly once, so a screenshot forwarded to a friend won't get two people in. Everything is stored in a single database folder (`./data`) that you control — there are no monthly software fees.

## 2. Quick start (try it in 2 minutes)

You need [Node.js](https://nodejs.org) installed (version 18 or newer). Then, in the project folder:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Without any configuration the site runs in **TEST MODE**: payments are simulated (no real money moves) and a banner reminds you of it. Go ahead and "buy" a few tickets to see the whole flow, including the QR-code tickets at the end.

To try the real **bank-transfer flow** locally, create a file called `.env.local` in the project folder with at least:

```bash
PAYMENT_MODE=transfer
ADMIN_PASSWORD=pick-something-long-and-private
```

and make sure your IBAN is filled in `event.config.json` (see below). All available settings are listed in the [environment variable reference](#8-environment-variable-reference).

The admin area is at [http://localhost:3000/admin](http://localhost:3000/admin) — the password is your `ADMIN_PASSWORD`.

## 3. Put in your event details

All event settings live in one file: **`event.config.json`** in the project folder. Open it in any text editor. Here is what each field means:

| Field | What it does |
| --- | --- |
| `eventName` | The name shown in the header, on tickets, and in the browser tab. |
| `artist` | Who's performing. |
| `description` | A short blurb shown on the home page (good place for your terms, e.g. "all sales final"). |
| `dateDisplay` | The date/time exactly as you want it displayed, e.g. `"Saturday, October 17, 2026 · Doors 6:00 PM · Show 7:00 PM"`. |
| `venue` | Venue name and city. |
| `currency` | 3-letter currency code, e.g. `"EUR"`. |
| `totalCapacity` | The absolute maximum number of tickets that can ever be sold — your room's capacity (e.g. `600`). |
| `salesOpen` | `true` means people can buy; set it to `false` to pause or close sales (the site stays up, buying is disabled). |
| `maxTicketsPerOrder` | The most tickets one person can buy in a single order (e.g. `8`). |
| `bankTransfer` | Your bank details for pay-by-transfer — see below. |
| `tiers` | The list of ticket types — see below. |

The `bankTransfer` section is what buyers transfer money to:

- `accountHolder` — the name on your bank account, exactly as buyers should enter it.
- `iban` — your IBAN (spaces are fine). **Until this is filled in, checkout shows "payment not configured".**
- `bic` / `bankName` — optional; leave as `""` if you don't want to show them.
- `payWithinDays` — how many days buyers are asked to pay within (e.g. `5`). Reservations whose money never arrives are released again automatically, with 2 extra grace days on top so a transfer sent on the last day doesn't die in transit over a weekend.

Each entry in `tiers` has:

- `id` — a short internal name, lowercase letters/numbers/dashes only (e.g. `"general"`, `"student"`). Don't change ids after sales start.
- `name` — what buyers see (e.g. `"General Admission"`).
- `priceCents` — the price **in cents**: `2500` means €25.00, `1500` means €15.00. (Using cents avoids rounding errors.)
- `cap` — the maximum number of tickets of *this* type.
- `studentOnly` — `true` marks it as a student ticket; buyers are told a valid student ID will be checked at the entrance, and door staff see a reminder at check-in.
- `description` — a short line shown under the tier name.

**Tier caps vs. total capacity:** both limits are enforced. Tier caps can add up to more than `totalCapacity` if you like (e.g. General 500 + Student 100 with a total of 600) — the site simply stops selling once *either* a tier's cap or the overall total is reached. Whichever runs out first wins.

## 4. How payment works (bank transfer)

Set `PAYMENT_MODE=transfer` and fill in `bankTransfer` in `event.config.json`. The flow:

1. **The buyer reserves tickets at checkout.** Their seats are held immediately — nobody else can buy them while the reservation stands.
2. **They see (and receive by email) the payment instructions:** the amount, your account details, and a personal **payment reference** like `TICKETS-AB12CD34`. If the order contains student tickets, the reference is `TICKETS-S-AB12CD34` — the **`S-` marker** lets you spot student orders directly on your bank statement. Buyers are told the reference **must** go in the transfer's purpose line, and to pay within `payWithinDays` days.
3. **You watch your bank account.** When a transfer arrives, open the admin dashboard — the **"Awaiting bank transfer"** list shows every open reservation with its reference, buyer, and expected amount. You can also paste a reference straight into the order search on `/admin/orders`.
4. **Confirm the payment.** Click **Payment received** and type the **last 4 characters of the payment reference** as you read them from your bank statement. This little typing step is deliberate: a blind or accidental click can never mark an order paid — you're proving you actually looked at the statement. The site then mints the QR tickets and emails them to the buyer automatically.
5. **If no payment ever arrives**, the reservation expires on its own (after `payWithinDays` + 2 grace days) and the seats go back on sale. You can also cancel a reservation manually from the admin panel if the buyer changed their mind.

**Late payments are handled gracefully:** if money arrives after a reservation expired, marking it paid re-reserves the seats if any are left and issues the tickets as normal. Only if the event genuinely sold out in the meantime will the site refuse — then you transfer the money back.

The dashboard shows both sides of the money: **"Awaiting bank transfer"** is money on its way (reserved but unconfirmed), and **revenue** counts only confirmed, real payments.

## 5. Email (tickets + sign-in codes)

Fill in the SMTP settings so the site can send email:

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-api-key
EMAIL_FROM="Event Tickets <tickets@yourdomain.com>"
```

Email is used for three things:

- **Payment instructions** right after a buyer reserves (they also see the same details on their order page).
- **The tickets themselves** once you confirm a payment.
- **Admin sign-in codes** for the two-step login (next section).

If you leave SMTP blank, ticket sales still work — buyers see everything on their personal order page — but the two-step admin login can't deliver codes, so it falls back to password-only. For a real event, set up email. (`GO-LIVE.md` walks through SendGrid step by step.)

## 6. The admin area and its two-step login

Everything for you as organizer lives at **`/admin`**: dashboard, orders, and door check-in. It's protected by a two-step sign-in:

1. **Password** — from `ADMIN_PASSWORD`. In production it must be at least 10 characters and must not be a placeholder like `change-me`; the site refuses to run the admin area otherwise.
2. **One-time code** — after the correct password, a 6-digit code is emailed to the address(es) in `ADMIN_EMAIL` (comma-separated for more than one). The code expires in 10 minutes, works exactly once, and allows only a few wrong attempts before you need a fresh one. Only after the code is verified do you get a session (valid 12 hours).

So even if someone learns your password, they can't get in without your inbox. Notes:

- **During development** (`npm run dev`) each code is also printed to the server console, so you can sign in even with broken email settings.
- **`ADMIN_OTP=off`** disables the second step entirely (password-only login) — useful while debugging email problems. Turn it back on for a real event.
- If `ADMIN_EMAIL` is not set or SMTP is not configured, the second step is skipped automatically.
- Failed login attempts are rate-limited (per address and globally), so password guessing gets nowhere.

## 7. Event day: door check-in

Two ways to give people scanning power at the door:

**A. As the organizer:** log in to the admin area on your phone and open **`/admin/checkin`**.

**B. Scanner links for your staff (recommended):** from the admin area, create a **door-scanner link**. It's a special `/scan` link that gives whoever opens it access to the check-in screen only — **no dashboard, no orders, no buyer data beyond the scan result**, and no admin password to share. Details:

- You choose how long a link stays valid (1 hour up to 7 days; 24 hours by default) — make it cover the event night.
- Share it however you like: send it to staff, or let them scan the link's QR code straight off your screen.
- One click on **revoke** invalidates *every* scanner link ever issued, instantly — e.g. if a phone gets lost.

On the check-in screen itself:

- **Scan** the QR code on a buyer's ticket using the device camera, or **type** the short ticket code (like `K7KQ-M3XP`) — capitalization, spaces, and dashes don't matter.
- A big green **VALID** means they're in. **Each ticket scans exactly once** — a ticket that was already used shows a clear **ALREADY USED** warning with the time it was first scanned.
- **Student tickets show a reminder to check a valid student ID** before letting the person in.
- Several staff members can check people in from different phones at the same time — the once-only rule still holds.

## 8. Environment variable reference

There is no `.env.example` file — this table is the reference. Locally, put these in a file called `.env.local` in the project folder; on a hosting service, enter them in its environment-variables settings.

| Variable | Required? | What it does |
| --- | --- | --- |
| `PAYMENT_MODE` | **Yes, for real sales** | `transfer` = bank transfer (recommended). `paypal` = PayPal only. `mock` = fake test payments. `auto` (default) = PayPal if credentials exist, otherwise test mode in development. |
| `ADMIN_PASSWORD` | **Yes** | The admin password. Production requires 10+ characters and rejects placeholders. Without it, the admin area is disabled. |
| `APP_SECRET` | **Yes, in production** | A long random string used to sign login sessions and scanner links. Changing it logs everyone out. |
| `ADMIN_EMAIL` | Recommended | Where admin sign-in codes are emailed. Comma-separate multiple addresses. |
| `ADMIN_OTP` | No | Set to `off` to disable the emailed one-time code and log in with password only. |
| `NEXT_PUBLIC_BASE_URL` | **Yes, in production** | Your site's public address, e.g. `https://tickets.example.com` — used in emailed links and scanner links. |
| `DATA_DIR` | On hosted setups | Folder where the SQLite database lives. Defaults to `./data`. On a hosting service, point it at the persistent disk (e.g. `/data`). |
| `SMTP_HOST` | For email | Your email provider's SMTP server, e.g. `smtp.sendgrid.net`. |
| `SMTP_PORT` | For email | Usually `587` (or `465` for SSL). |
| `SMTP_USER` | For email | SMTP username (for SendGrid this is literally the word `apikey`). |
| `SMTP_PASS` | For email | SMTP password (for SendGrid: your API key). |
| `EMAIL_FROM` | For email | The sender, e.g. `"Event Tickets <tickets@yourdomain.com>"`. Emails don't send without it. |
| `PAYPAL_ENV` | PayPal only | `sandbox` or `live`. When `live`, test mode is always disabled. |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal only | Credentials from developer.paypal.com. Not needed for bank transfer. |
| `ALLOW_MOCK_PAYMENTS` | No | Extra safety latch: a production build only allows `PAYMENT_MODE=mock` if this is also `true`. Leave unset. |

## 9. Optional: PayPal instead of bank transfer

Bank transfer is the default, but PayPal support is built in. If you'd rather use it: create a PayPal Business account, get a Client ID and Secret from [developer.paypal.com](https://developer.paypal.com) (start with the **Sandbox** ones for testing), and set `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYMENT_MODE=paypal`. Buyers can then pay by card via PayPal's guest checkout, tickets are issued instantly, and the admin dashboard gains a "Fix stuck orders" button that resolves interrupted payments by asking PayPal what really happened. Safety net: with `PAYPAL_ENV=live`, test mode is always disabled, no matter what other settings say.

## 10. Going live

The complete, click-by-click launch guide — domain, hosting on Render, SendGrid, test run, and the event-day runbook — is in **[GO-LIVE.md](GO-LIVE.md)**. The short version of what the site needs:

- A host that runs **Node.js** with a **persistent disk** for the database (Render or Railway work well; **not** plain Vercel — serverless hosting wipes the SQLite file and loses your orders).
- `npm install && npm run build` to build, `npm start` to run.
- All environment variables from the table above, and HTTPS (hosts like Render handle that automatically).
- A **backup of the data folder** (`DATA_DIR`, locally `./data`) — that folder IS your ticket database: every order, ticket, and check-in.

Safety notes you don't have to configure — they're built in:

- Prices are always computed on the server from `event.config.json`; nothing a buyer does in their browser can change what they're charged.
- Overselling is blocked atomically on the server, even with many buyers at once.
- A production build **never** silently falls back to test mode.
- Order creation, admin login, and the code-verification step are rate-limited against bots and password guessing.

## 11. Refunds & support

- **Refunds:** with bank transfer, the money is already in your account — refunding is simply a bank transfer back to the buyer. The awaiting-transfer table and the order page show you their name and amount.
- **"I paid but got no tickets":** transfers take 1–2 business days, and tickets only go out after you confirm the money in the admin panel. If a payment is visible on your statement, mark the order paid; if the buyer paid without the reference, find them by name or email in the order search.
- **The payment arrived after the reservation expired:** mark it paid anyway — the site re-reserves the seats if any are left. If the event sold out in the meantime, it refuses and you transfer the money back.
- **"I lost my tickets":** every buyer has a personal order page at `/order/{their-order-id}` — the link is in both emails they got. You can also resend the ticket email from the admin orders list, or look them up by name at the door.

## 12. FAQ

**Do buyers need any account or app?**
No. They fill in name and email, get an IBAN and a reference, and pay with their normal banking app. Tickets arrive by email and live on their personal order page.

**What does the `S-` in a payment reference mean?**
The order contains student tickets. `TICKETS-S-AB12CD34` on your bank statement = student order; `TICKETS-AB12CD34` = regular. Handy for a quick tally, and door staff still get the student-ID reminder at check-in either way.

**How does the student discount work?**
Anyone can buy a Student ticket online at the lower price. The enforcement happens at the door: the ticket is clearly marked, the check-in screen reminds staff, and your staff asks for a valid student ID. No ID, no entry (or charge the difference — your call, just announce the policy up front).

**What if a buyer forgets the reference in their transfer?**
You'll see a payment on your statement with no matching purpose line. Match it by name and amount in the admin order search, then confirm it as usual (the confirmation still asks for the last 4 characters of the *order's* reference, shown right in the admin list).

**Is overselling possible?**
No. Seats are reserved inside the database, on the server, the moment an order is placed — even if two people grab the last ticket at the same instant, only one reservation succeeds. Tier caps and the total capacity are both enforced.

**What data does the site store, and where?**
Buyer name, email address, what they ordered, payment status, ticket codes, and check-in times — all in the SQLite database inside the data folder. No bank credentials of buyers are ever seen or stored (they pay from their own banking app). Treat the data folder as private personal data: back it up, don't share it, and delete or archive it responsibly after the event.
