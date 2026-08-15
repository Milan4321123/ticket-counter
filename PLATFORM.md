# Platform Owner's Manual

This is the business manual for **you, the platform owner**. It explains how the platform makes you money, how to onboard and support the event organizers who are your customers, and what to do when something goes wrong. The technical setup lives in [README.md](README.md) and [GO-LIVE.md](GO-LIVE.md) — this document is about running the business.

## 1. The business model in one paragraph

Event organizers pay **you** a fee **per event** to put it on your platform, and the fee is sized to the room they booked: **€1 for every 10 tickets the venue holds, minimum €15** — so a 500-person event costs **€50** and a 150-person one costs €15 (you set both numbers with `PLATFORM_FEE_PER_CUSTOMER_CENTS` and `PLATFORM_FEE_MIN_CENTS`). Small organizers can afford to start; big ones pay in proportion to what they stand to sell. Signing up and building a draft costs nothing; the fee falls due when they want to publish. In return they get a self-service portal where they build their event page, sell tickets, and check guests in at the door. The ticket money itself **never touches you**: buyers transfer it directly to each organizer's own bank account. Your revenue is the event fees; the organizers' revenue is their ticket sales. Two completely separate streams.

## 2. Why the money flows the way it does

This is the most important design decision on the platform, so it's worth understanding:

- **Ticket money goes straight from buyer to organizer.** Each event page shows the *organizer's own* IBAN. Buyers transfer directly to it with a personal payment reference; the organizer watches their own bank statement and confirms each payment in the portal, which mints and emails the QR tickets.
- **The platform never holds, forwards, or touches ticket money.** There is no wallet, no payout schedule, no balance — the site only keeps score of what organizers report as received.

Besides being simple, this keeps you out of dangerous territory: businesses that *hold other people's money in transit* (collect ticket revenue and pay it out later) are typically regulated as payment institutions, with licensing requirements you do not want. By never being in the money flow, you are selling **software access**, not payment services. (This is a design rationale, not legal advice — if you scale up, spend an hour with an accountant or lawyer in your country.)

The same logic applies to your event fees: organizers transfer them straight to your own account, **outside the platform**. The site only keeps score — you tick the event off as paid and its Publish button unlocks.

## 3. Onboarding a new organizer

Most organizers sign themselves up (section 8) — you only switch the account on. To create one by hand:

1. **Sign in to your admin area** at `/admin` (your password + emailed code).
2. **Open the organizer management page** at `/admin/organizers` and create the account: their **name** and their **email address** (this is their login). Accounts are free and never expire — there is no plan date to set, because the money comes per event.
3. **The site shows you a one-time password.** Copy it immediately — it is shown only once (though you can always reset it later to get a new one).
4. **Send the organizer their welcome message** with:
   - their login link: `https://your-domain.com/portal/login`
   - their email address (as the username) and the one-time password
   - a tip to change the password after first login, a note that ticket money will arrive on the bank account *they* enter in the portal, and that publishing an event costs your per-event fee.

That's it. They can immediately log in and build their first event; you get paid when they publish it (section 5).

## 4. What organizers can do in their portal

Everything at `/portal`, only ever for **their own** events (the server enforces this on every request):

- **Create and edit events** — name, artist, description, date, and the venue **address** (buyers get an "Open in Maps" link).
- **Upload photos** (up to 12 per event, one as the cover) and add a **video link** (YouTube, Vimeo, or a direct video file) that plays on the event page.
- **Set ticket tiers** — names, prices, per-tier caps, and an optional **student tier** (cheaper; door staff are reminded to check a student ID at check-in).
- **Enter their bank details** — account holder and IBAN. This is where their ticket money arrives. Until it's filled in, their checkout tells buyers payment isn't configured yet.
- **Design their page** — a manual theme picker, or (if you enabled the AI designer) they describe the vibe in their own words and the AI writes the headline, tagline, and highlights and picks colors to match.
- **Pay the event fee and publish** — the Publish tab shows what the event costs, your bank details, and that event's payment reference (`EVENT-…`); the same details are emailed to them. Once you confirm the transfer, the Publish button unlocks and the event appears in the public feed on your homepage, at `/e/their-event-name`.
- **Sell and confirm** — watch the "awaiting bank transfer" list, compare it with their bank statement, and confirm each payment as it arrives. Confirming mints the QR tickets and emails them to the buyer automatically. Unpaid reservations expire on their own and the seats go back on sale.
- **Answer visitor questions** — every event page has a question box. With `GEMINI_API_KEY` set (a free key from Google AI Studio; `ANTHROPIC_API_KEY` is the fallback), an AI assistant answers instantly from the organizer's own event content — description, tiers, FAQ, posts — and never invents anything beyond it. Whatever it isn't sure about, and every question when neither key is set, lands in the organizer's portal to answer by hand.
- **Run the door** — create time-limited **scanner links** for their door staff. A scanner link opens the check-in screen for *that event only* — no portal access, no buyer lists, nothing to leak.

## 5. Collecting the event fee

This is how you get paid, and it works exactly like the ticket payments your organizers handle — one transfer, one reference, one two-step confirm:

1. **The organizer finishes their event** and opens its **Publish** tab. Instead of a live event they see a fee card: the amount for *that* event (worked out from its capacity, with a line saying so), *your* account holder, IBAN, BIC and bank, and the event's own **Verwendungszweck** (`EVENT-1A2B3C4D`, derived from the event id). The Publish button is disabled with that reason, and the same details go to them by email.
2. **They transfer the fee** with that reference in the purpose line.
3. **You see it on your bank statement** — and in `/admin/organizers` under **Event fees**, where every unpaid event is listed with its organizer, amount and reference. The admin dashboard's Events card also flags how many fees are waiting.
4. **You click "Fee received"** and type the **last 4 characters of the reference**, exactly like confirming a ticket payment. Publishing unlocks instantly and the organizer gets a "your event can go live now" email.

Some practical notes:

- **Nothing expires.** Accounts are free and permanent; an organizer with no upcoming event simply pays you nothing. That is the point of per-event pricing — no renewal chasing, no lapsed-plan surprises mid-sale.
- **Already-published events are grandfathered.** Anything that was live before this pricing arrived counts as paid.
- **An event that was taken offline stays paid.** Publishing it again is free — the fee is per event, not per publish.
- **The quoted amount is locked at payment.** The fee is worked out and stored the moment the organizer is shown it. While it is unpaid, moving to a bigger or smaller venue re-quotes it (fair — no money has changed hands). Once you click *Fee received*, the amount is frozen: whatever they do to the capacity afterwards, they are never asked for a different number than the one they paid.
- **Misbehaviour** is still handled with **disable account** (section 6), not with pricing.

## 6. Support playbook

You are the support desk for your organizers; they are the support desk for their buyers. Keep that separation and support stays light.

**"I forgot my password."**
`/admin/organizers` → find them → **reset password**. The site generates a fresh one-time password; send it to them at the email on file (never to a different address someone gives you in a chat — that's how accounts get stolen).

**"Please change my login email."** Verify it's really them (e.g. reply from the old address), then update the account in `/admin/organizers`.

**An organizer behaves badly** (fake events, chargebacks against buyers, spam): set their account to **disabled** in `/admin/organizers`. They are logged out everywhere immediately and can't get back in. Re-enable just as easily if it was a misunderstanding.

**A buyer contacts *you* about a refund or a missing ticket:**
Redirect them to the event's organizer. The money went directly to the organizer's bank account — **only the organizer can refund it** (a plain bank transfer back to the buyer). You never hold ticket money, so you genuinely cannot refund anyone, and saying so honestly is the right answer. What you *can* do to help: look up the order in your admin area to tell the buyer which organizer to talk to.

**An organizer says "a buyer paid but I can't find the order":**
The buyer's payment reference (like `TICKETS-AB12CD34`) is on their bank statement's purpose line; the organizer can search for it in their portal. If the buyer forgot the reference, match by name and amount instead. References starting `TICKETS-S-` contain student tickets.

**"The tickets email never arrived":** almost always a spam folder, or the buyer mistyped their email. Every buyer also has a personal order page (linked in every email) where their tickets live; the organizer can resend the email or read the order's page link out to the buyer.

**You need to take a look yourself:** your admin area can see all events and orders across the platform — handy for settling "he said, she said" between an organizer and a buyer.

## 7. A few honest ground rules

- **Never share one organizer's data with another.** The portal enforces this technically; you should enforce it socially too.
- **Back up the data folder regularly** (see GO-LIVE.md) — it holds every organizer, event, order, ticket, and photo on the platform. That folder is your entire business.
- **Your admin password and inbox are the keys to everything.** The two-step admin login protects you, but only if the password is strong and the inbox is yours alone.
- **Be upfront with organizers about what the platform is:** a self-service ticketing tool where *they* receive the money and *they* are responsible to their buyers. Put that in your welcome message and you'll prevent 90% of support mail before it's written.

## 8. Self-service signups

Organizers can sign themselves up — no manual account creation needed. There's a public sales page at `/organizers` that pitches the platform (features, how it works, your per-event price), with a signup form at `/organizers/signup` where they pick their own password.

**How the flow works:**

1. The organizer signs up with their name, email, and a password. Their account is created as **pending** — free, but not usable until you switch it on.
2. They immediately see, at `/organizers/pay`, what an event costs: your bank details, the per-event amount, and their account reference like `NEPCON-1A2B3C4D`. **The same details are emailed to them** the moment they sign up, so they can't be lost. Signing in with a pending account shows the page again.
3. Every pending signup appears in a highlighted **"new signups to switch on"** section at `/admin/organizers`, and in the Organizers stat card on the admin dashboard.
4. Click **Activate account** and type the **last 4 characters of their reference** (the same deliberate two-step confirm used for money, so a stray click can't let anyone in). They can build events straight away — and each event they publish is where your fee comes from (section 5).

**Environment variables that drive it:**

| Variable | What it does |
| --- | --- |
| `PLATFORM_FEE_PER_CUSTOMER_CENTS` | What each person the venue holds adds to the fee, in cents (default `10` = €1.00 per 10 tickets). The event fee is `capacity × this`, rounded to whole euros. |
| `PLATFORM_FEE_MIN_CENTS` | The floor for small rooms, in cents (default `1500` = €15.00). With both defaults: 150 capacity → €15.00, 300 → €30.00, 500 → €50.00, 1000 → €100.00. Shown on `/organizers`, on each event's Publish tab, in `/admin/organizers`, and in the fee emails. |
| `PLATFORM_BANK_HOLDER` / `PLATFORM_BANK_IBAN` | **Your own** account for receiving fees (not any organizer's). Until both are set, the fee card and signup page show a friendly "being set up — contact us" note instead of bank details. |
| `PLATFORM_BANK_BIC` / `PLATFORM_BANK_NAME` | Optional — shown alongside your payment details when set. |

**The three emails you send automatically** (SMTP settings in README section 8; without them nothing breaks — the same details are always on screen):

| Email | Trigger | Contents |
| --- | --- | --- |
| Welcome / signup instructions | Someone completes `/organizers/signup` | The account is free, what an event costs, your bank box, their `NEPCON-…` account reference, portal link. |
| Event fee instructions | They try to publish an event whose fee hasn't arrived | Your bank box and that event's `EVENT-…` Verwendungszweck, plus a link to the Publish tab. |
| Your event can go live | You confirm that event's fee | Publishing is unlocked, with a link straight to the Publish tab. |

And the old way still works: you can always create accounts by hand in `/admin/organizers` for organizers who'd rather deal with you in person.

## 9. Custom page design requests

Some organizers want more than the self-service page — a festival landing page, sponsor logos, a look that is entirely theirs. That is **design work you sell separately**, priced by you, per job. The platform just collects the leads.

**Where they come from:** a public page at `/contact` with a short form (name, email, organization, "what would you like?"). It's linked from the pricing section on `/organizers` ("Want something more custom?"), from the site footer, and from the bottom of the Design tab in every organizer's event editor. Your contact address is shown as a plain mailto link on all of them, for people who'd rather just write an email.

**Where the requests land — both places, always:**

1. **`/admin/contact`** — the inbox. Every enquiry, newest first, with the sender's email as a mailto link and everything they wrote. When you've replied, click **Mark handled**. Nothing is ever deleted, so handled requests stay readable. The admin dashboard's **Page requests** button carries a "N new" badge whenever something is waiting.
2. **Your own inbox** — the enquiry is emailed to `PLATFORM_CONTACT_EMAIL` with **reply-to set to the sender**, so hitting reply in your mail client answers them directly. The sender simultaneously gets a friendly acknowledgement ("we'll reply within a couple of days") that also reminds them they can publish a self-service page right now for the standard per-event fee.

The database row is written **before** either email is attempted, so a broken SMTP setup can never cost you a lead — `/admin/contact` is the source of truth.

| Variable | What it does |
| --- | --- |
| `PLATFORM_CONTACT_EMAIL` | Where enquiries are emailed and the address shown publicly. Falls back to your first `ADMIN_EMAIL` address if unset. |

**Practical notes:**

- **Quote per job.** There is no price on the page on purpose — a two-day festival and a single club night are not the same work.
- **Say yes to the small stuff for free.** "Help me import my photos" costs you ten minutes and buys a lot of goodwill; it's the same organizer who pays your fee for every event afterwards.
- **The form is rate-limited and honeypotted** (3 messages per minute per visitor, plus a global hourly cap), so the inbox stays usable without a captcha.
