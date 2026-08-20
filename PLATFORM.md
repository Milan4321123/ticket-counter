# Platform Owner's Manual

This is the business manual for **you, the platform owner** of **MartNepali** ([martnepali.com](https://martnepali.com)). It explains what the platform costs organizers (nothing — and why), how to onboard and support the event organizers who are your customers, and what to do when something goes wrong. The technical setup lives in [README.md](README.md) and [GO-LIVE.md](GO-LIVE.md) — this document is about running the platform.

## 1. The business model in one paragraph

There isn't one — **on purpose, for now**. The platform is **completely free for organizers**: accounts are free, publishing is free, and the platform takes no cut of ticket sales. There used to be a per-event fee (a base amount plus a per-ticket rate on the venue's capacity, paid before an event could go live); all of that machinery was **deliberately deleted** — the platform is free while it grows, and if pricing ever returns it should return as a decision, not as a leftover (the header comment in `src/lib/platform.ts` records this). What organizers get: a self-service portal where they build their event page, sell tickets, and check guests in at the door. The ticket money **never touches you**: buyers transfer it directly to each organizer's own bank account. The organizers' revenue is their ticket sales; yours, for now, is nothing — growth is the goal.

## 2. Why the money flows the way it does

This is the most important design decision on the platform, so it's worth understanding:

- **Ticket money goes straight from buyer to organizer.** Each event page shows the *organizer's own* IBAN. Buyers transfer directly to it with a personal payment reference; the organizer watches their own bank statement and confirms each payment in the portal, which mints and emails the QR tickets.
- **The platform never holds, forwards, or touches ticket money.** There is no wallet, no payout schedule, no balance — the site only keeps score of what organizers report as received.

Besides being simple, this keeps you out of dangerous territory: businesses that *hold other people's money in transit* (collect ticket revenue and pay it out later) are typically regulated as payment institutions, with licensing requirements you do not want. By never being in the money flow, you are selling **software access**, not payment services. (This is a design rationale, not legal advice — if you scale up, spend an hour with an accountant or lawyer in your country.)

And since the platform charges nothing itself, there is no platform bank account anywhere in the system: **the organizers' own payout details are the only bank accounts the site knows about.**

**One consequence to hold on to, if the example bazaar is up.** The site can publish seven *example shops* (`npm run seed:bazaar`) so a seller browsing `/market` sees a real-looking bazaar rather than an empty room. Those listings are published, priced and open for orders like any other; the only reason a buyer cannot be charged on them is that they have no payout account and the site runs in `PAYMENT_MODE=transfer`, where an order against a listing with no payout account is refused. **That refusal exists in transfer mode only.** So if the money model above ever changes — PayPal switched on, PayPal credentials added, `PAYPAL_ENV=live`, mock payments enabled — **take the example bazaar down first with `npm run seed:bazaar -- --clean`**, or seven invented shops with invented collection addresses quietly become genuinely orderable, against the platform's own PayPal account. The full note is in [GO-LIVE.md](GO-LIVE.md) §8 and in the header of `scripts/seed-bazaar.mjs`.

## 3. Onboarding a new organizer

Most organizers apply through the site (section 8) — you approve the application and the site creates the account and emails the sign-in details. To create one by hand:

1. **Sign in to your admin area** at `/admin` (your password + emailed code).
2. **Open the organizer management page** at `/admin/organizers` and create the account: their **name** and their **email address** (this is their login). Accounts are free and never expire.
3. **The site shows you a one-time password.** Copy it immediately — it is shown only once (though you can always reset it later to get a new one).
4. **Send the organizer their welcome message** with:
   - their login link: `https://martnepali.com/portal/login`
   - their email address (as the username) and the one-time password
   - a note that ticket money will arrive on the bank account *they* enter in the portal, and that everything — the account, publishing, all of it — is free. (The portal makes them replace the one-time password at first sign-in, so no tip needed there.)

That's it. They can immediately log in, build their first event, and publish it themselves — nothing to pay, nothing for you to unlock.

## 4. What organizers can do in their portal

Everything at `/portal`, only ever for **their own** events (the server enforces this on every request):

- **Create and edit events** — name, artist, description, date, and the venue **address** (buyers get an "Open in Maps" link).
- **Upload photos** (up to 12 per event, one as the cover) and add a **video link** (YouTube, Vimeo, or a direct video file) that plays on the event page.
- **Set ticket tiers** — names, prices, per-tier caps, and an optional **student tier** (cheaper; door staff are reminded to check a student ID at check-in).
- **Enter their bank details** — account holder and IBAN. This is where their ticket money arrives. Until it's filled in, their checkout tells buyers payment isn't configured yet.
- **Design their page** — a manual theme picker, or (if you enabled the AI designer) they describe the vibe in their own words and the AI writes the headline, tagline, and highlights and picks colors to match.
- **Publish — free** — the Publish tab is a checklist, not a paywall: it lists whatever is still missing (a way to be paid when any ticket costs money, the authenticator app every selling account needs), and the moment the list is done the organizer presses Publish themselves. The event appears in the public feed on your homepage, at `/e/their-event-name`.
- **Sell and confirm** — watch the "awaiting bank transfer" list, compare it with their bank statement, and confirm each payment as it arrives. Confirming mints the QR tickets and emails them to the buyer automatically. Unpaid reservations expire on their own and the seats go back on sale.
- **Answer visitor questions** — every event page has a question box. With `GEMINI_API_KEY` set (a free key from Google AI Studio; `ANTHROPIC_API_KEY` is the fallback), an AI assistant answers instantly from the organizer's own event content — description, tiers, FAQ, posts — and never invents anything beyond it. Whatever it isn't sure about, and every question when neither key is set, lands in the organizer's portal to answer by hand.
- **Run the door** — create time-limited **scanner links** for their door staff. A scanner link opens the check-in screen for *that event only* — no portal access, no buyer lists, nothing to leak.

## 5. Why the platform is free (and what that means for you)

There is no event fee, no subscription, and no cut of ticket sales. The per-event fee that used to live here was **removed deliberately, machinery and all** — not zeroed, deleted — so that if pricing ever returns, it returns as a fresh decision rather than as a leftover switch someone flips (the reasoning is written down in `src/lib/platform.ts`). The platform stays free while it grows.

What that means for running it day to day:

- **Nothing to confirm.** There is no "Event fees" list in `/admin/organizers` and no fee card on any Publish tab. Organizers publish themselves the moment their listing checklist is done — you are not in that loop.
- **Nothing to configure.** There are no `PLATFORM_FEE_*` or `PLATFORM_BANK_*` environment variables any more; the only bank accounts in the system are the organizers' own payout details.
- **Nothing expires.** Accounts are free and permanent; there is no renewal chasing and no lapsed-plan surprise mid-sale.
- **Misbehaviour** is handled with **disable account** (section 6), not with pricing.
- **Be straightforward about it.** "Free, and buyers pay you directly" is the pitch, and it happens to be the literal truth — the signup pages and welcome emails already say exactly that.

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

## 8. Account applications

Organizers apply through the site — there is no open self-service signup, so every account passes your eyes once. The public sales page at `/organizers` pitches the platform (features, how it works, and that it is **free**); its "get an account" buttons lead to the application form at `/contact?intent=account`.

**How the flow works:**

1. The organizer applies with their name and email (plus whatever they tell you about what they organize). The application lands in your inbox at `/admin/contact` and is also emailed to `PLATFORM_CONTACT_EMAIL` — the sender gets a friendly acknowledgement that a real person will reply within a couple of days, and that the account and publishing are free.
2. **You approve it** from `/admin/contact` with one click. That creates the account, generates a one-time password (the portal forces them to replace it at first sign-in), and **emails them their sign-in details**. The password is also shown to you in the admin UI, so a broken SMTP setup can never strand a half-created account — you can pass it on by hand.
3. An application can never mint a second account: approving it twice, or approving one whose email already has an account, is refused with a pointer to reset that account's password instead.

**Pending accounts from the old signup flow:** the platform used to let organizers sign themselves up, landing as **pending** until you switched them on, and some may still sit in that state. They appear in the highlighted **"new signups to switch on"** section at `/admin/organizers` (and in the Organizers stat card on the dashboard). Click **Activate account** and type the **last 4 characters of their account reference** — a deliberate two-step confirm, so a stray click can't let anyone in. That reference still looks like `NEPCON-1A2B3C4D`: it was born as the Verwendungszweck for the old account fee and the prefix was **kept on purpose** — existing pending signups already carry it, and the activation confirm step reads from it. A pending organizer who signs in is shown a friendly "we're switching your account on" page at `/organizers/pay` (that URL, too, survives from the fee era on purpose — links to it are sitting in old inboxes).

And the old way still works: you can always create accounts by hand in `/admin/organizers` for organizers who'd rather deal with you in person.

## 9. Custom page design requests

Some organizers want more than the self-service page — a festival landing page, sponsor logos, a look that is entirely theirs. That is **design work you sell separately**, priced by you, per job. The platform just collects the leads.

**Where they come from:** a public page at `/contact` with a short form (name, email, organization, "what would you like?"). It's linked from `/organizers` ("Want something more custom?"), from the site footer, and from the bottom of the Design tab in every organizer's event editor. Your contact address is shown as a plain mailto link on all of them, for people who'd rather just write an email.

**Where the requests land — both places, always:**

1. **`/admin/contact`** — the inbox. Every enquiry, newest first, with the sender's email as a mailto link and everything they wrote. When you've replied, click **Mark handled**. Nothing is ever deleted, so handled requests stay readable. The admin dashboard's **Page requests** button carries a "N new" badge whenever something is waiting.
2. **Your own inbox** — the enquiry is emailed to `PLATFORM_CONTACT_EMAIL` with **reply-to set to the sender**, so hitting reply in your mail client answers them directly. The sender simultaneously gets a friendly acknowledgement ("we'll reply within a couple of days") that also reminds them everything the platform itself does — the page, ticket sales, door scanning — is free and already included; what you quote them for is the design work on top.

The database row is written **before** either email is attempted, so a broken SMTP setup can never cost you a lead — `/admin/contact` is the source of truth.

| Variable | What it does |
| --- | --- |
| `PLATFORM_CONTACT_EMAIL` | Where enquiries are emailed and the address shown publicly. Falls back to `EMAIL_FROM_ORGANIZERS`, then `EMAIL_FROM`; with none set the pages simply omit the address. It deliberately does **not** fall back to `ADMIN_EMAIL` any more — that is the inbox your own sign-in codes arrive in, and printing it on a public page told anyone minded to phish you exactly which mailbox to aim at. |

**Practical notes:**

- **Quote per job.** There is no price on the page on purpose — a two-day festival and a single club night are not the same work.
- **Say yes to the small stuff for free.** "Help me import my photos" costs you ten minutes and buys a lot of goodwill; it's the same organizer who brings their next event — and their organizer friends — to the platform.
- **The form is rate-limited and honeypotted** (3 messages per minute per visitor, plus a global hourly cap), so the inbox stays usable without a captcha.
