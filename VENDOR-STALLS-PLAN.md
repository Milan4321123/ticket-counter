# Vendor Stalls — Slice 2 design (build-ready)

**Repo:** `/Users/milanadhokari/ticket counter` · **Date:** 2026-08-19 · **Status:** design only, nothing implemented

## 0. One-paragraph summary

A *stall* is not a new thing — it is an existing `kind='shop'` row (slice 1) **linked** to a host `kind='event'` row through one new table, `event_stalls`, whose rows are created by the stall owner and approved/revoked by the host organizer. Buyers order from the stall's *own* page and checkout, so every order keeps `orders.event_id = the shop's id`, the payout snapshot keeps freezing the *stall's* IBAN/PayPal, the payment reference keeps landing in the *stall owner's* portal, and each stall keeps scanning its own collection codes through its own event-scoped scanner link. The host event page merely gains a curated "Order ahead" section of cards that link out to approved stalls, each card naming the specific seller. **Zero new money code, zero new scan code, zero platform revenue** — the entire slice is one link table, its state machine, two portal panels, and two buyer-facing surfaces.

## 1. Grounding — what already exists and is reused unchanged

| Machinery | Where | Why it already does the job |
|---|---|---|
| Shops as listings | `events.kind = 'event' \| 'shop'`, `events.pickup_info` (`src/lib/db.ts`, `src/lib/types.ts`) | A stall IS a shop. No new listing kind. |
| Vocabulary split | `src/lib/vocab.ts` (`vocabFor(kind)`) | Stall surfaces say "items / collection code / the counter" for free. |
| Per-seller money | `createOrder()` in `src/lib/orders.ts` freezes `payout_*` from `effectivePayout(event)`; reference `TICKETS-XXXXXXXX` from `paymentReference()` | An order placed on the shop row pays the stall's own account, always. Host never appears in the money path. |
| Disclosed-agent naming | `/e/[slug]/page.tsx` line ~826: `{isShop ? 'Sold by' : 'Presented by'} <strong>{organizerDisplayName}</strong>` + "your payment goes straight to their own account" | Every buyer surface already names the seller; slice 2 must extend this to the new cards, never dilute it. |
| Scanner scoping | `createScanToken(eventId, …)` / `verifyScanToken` in `src/lib/auth.ts`; per-event `scan_epoch:<eventId>` in `kv`; `checkInTicket(code, {eventId})` returns `wrong_event` cross-event (`src/lib/orders.ts`, `src/app/api/admin/checkin/route.ts`) | Each stall's scan link only redeems that stall's codes. A shared venue needs no new auth. |
| Publish gating | `listingDetailChecks()` in `src/lib/events.ts` + the gate in `src/app/api/portal/events/[id]/route.ts` (~line 624): details + ≥1 item + payment route if priced + authenticator | Shops already can't go live half-configured. Slice 2 adds **no** new publish requirements. |
| Orderability states | `src/lib/ticketState.ts` (`ticketState`, `visibleTiers`, `fromPriceCents`), `events.sales_open` | Stall cards reuse these for "from €X / Orders closed / Sold out". |
| Notifications | `src/lib/email.ts` (many `send*Email` helpers, all fail-soft) | Three new mails follow the existing pattern. |
| Event deletion | `deleteEventCompletely()` in `src/lib/events.ts` | Gains one DELETE for the link table (both sides). |

## 2. Data model

One new table, created in `migrateToPlatform()` in `src/lib/db.ts` (same `CREATE TABLE IF NOT EXISTS` style as `platform_posts` / `payout_changes`):

```sql
-- A shop standing at an event, with the host organizer's consent.
-- The link is CONSENT + PLACEMENT ONLY. It carries no money: orders stay on
-- the shop row, pay the shop's own account, and are matched by the shop's
-- owner. Nothing in this table may ever be read by money-facing code.
CREATE TABLE IF NOT EXISTS event_stalls (
  id TEXT PRIMARY KEY,
  host_event_id TEXT NOT NULL REFERENCES events(id),   -- kind='event'
  shop_event_id TEXT NOT NULL REFERENCES events(id),   -- kind='shop'
  status TEXT NOT NULL DEFAULT 'requested',
    -- requested | approved | declined | revoked | withdrawn
  initiated_by TEXT NOT NULL DEFAULT 'shop',           -- 'shop' now; 'host' reserved for invites (not slice 2)
  message TEXT NOT NULL DEFAULT '',                    -- stall owner's note to the host, shown once in the host portal
  stall_pickup_info TEXT NOT NULL DEFAULT '',          -- optional: where/when to collect AT THIS EVENT ("Stall 4, from 17:00")
  sort INTEGER NOT NULL DEFAULT 0,                     -- host's display order; UI deferred (order by sort, decided_at)
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,                                     -- approve/decline stamp
  ended_at TEXT,                                       -- revoke/withdraw stamp
  UNIQUE (host_event_id, shop_event_id)
);
CREATE INDEX IF NOT EXISTS idx_event_stalls_host ON event_stalls(host_event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_stalls_shop ON event_stalls(shop_event_id, status);
```

Notes:
- **`UNIQUE (host, shop)`** — one row per pair, ever. Re-requests reuse the row (see state machine). No history table; `payout_changes`-style forensics are not needed for a consent flag.
- **Kind constraints enforced in lib code**, not CHECKs (matches codebase style): host must be `kind='event'`, shop must be `kind='shop'`. Reject anything else at request time.
- **No columns on `orders`.** An order-ahead order is indistinguishable from any other shop order — deliberately (see §11 for what that costs and why it's fine).

## 3. Domain layer — new file `src/lib/stalls.ts` (server-only)

```ts
export type StallLinkStatus = 'requested' | 'approved' | 'declined' | 'revoked' | 'withdrawn';

export interface StallLinkRow {
  id: string; hostEventId: string; shopEventId: string;
  status: StallLinkStatus; initiatedBy: 'shop' | 'host';
  message: string; stallPickupInfo: string; sort: number;
  requestedAt: string; decidedAt: string | null; endedAt: string | null;
}

// -- writes (every one takes the ACTING organizer id and verifies ownership itself,
//    mirroring how answerEventQuestion scopes by event) --
requestStallLink(shopOrganizerId, shopEventId, hostEventId, message): StallLinkRow
approveStallLink(hostOrganizerId, linkId): boolean
declineStallLink(hostOrganizerId, linkId): boolean
revokeStallLink(hostOrganizerId, linkId): boolean       // approved -> revoked
withdrawStallLink(shopOrganizerId, linkId): boolean     // requested|approved -> withdrawn
setStallPickupInfo(shopOrganizerId, linkId, text): boolean

// -- reads --
listStallLinksForHostEvent(hostEventId): StallLinkRow[]          // all statuses, host portal
listStallLinksForShop(shopEventId): StallLinkRow[]               // all statuses, shop portal
listVisibleStallsForEvent(hostEventId): { link, shop: EventRow }[] // buyer surface, see §8
getStallLink(linkId): StallLinkRow | null

// -- the single visibility rule (the listingDetailChecks pattern: one function,
//    read by the public page AND the portal preview, so they can never disagree) --
stallVisibleOnEventPage(link, host: EventRow, shop: EventRow, todayIso): boolean
  // = link.status === 'approved'
  //   && host.status === 'published' && shop.status === 'published'
  //   && host.eventDate !== null && host.eventDate >= todayIso
stallBannerVisibleOnShopPage(link, host, todayIso): boolean
  // same, minus the shop-published test (it's the shop's own page)
```

### State machine (all transitions validated in `stalls.ts`, one place)

```
(none) --request--> requested --approve--> approved --revoke--> revoked   [terminal for the shop]
                        |                      |
                        |--decline--> declined |--withdraw--> withdrawn
                        |--withdraw--> withdrawn
declined  --re-request--> requested   (same row: reset message/requested_at, clear decided/ended)
withdrawn --re-request--> requested   (same)
revoked   --re-request--> REFUSED     ("the host removed this stall — please talk to them directly")
```

Rules baked into `requestStallLink`:
- Host must be `kind='event'`, `status='published'`, with `event_date >= today` (you can't request a past or invisible event; published events always have a date — the publish gate requires it).
- Shop must be `kind='shop'` and `status='published'` — the host must be able to open the real public page before saying yes.
- **Same-owner auto-approve:** if `shop.organizer_id === host.organizer_id`, the row is written directly as `approved` (asking yourself for permission is noise). This is also what makes the October event trivial if Milan's seed organizer runs both sides.
- Rate limit via `src/lib/ratelimit.ts` like other portal POSTs, plus a hard cap: a shop may hold at most ~10 rows in `requested` at once.

Also in PR 1: `deleteEventCompletely()` gains `DELETE FROM event_stalls WHERE host_event_id = ? OR shop_event_id = ?` inside the existing transaction (before `DELETE FROM events`).

## 4. API routes (portal, all behind `currentOrganizer()` like existing `/api/portal/events/[id]/*`)

| Route | Actor owns | Body | Effect |
|---|---|---|---|
| `POST /api/portal/events/[id]/stall-requests` | the **shop** `[id]` | `{ hostEventId, message? }` | `requestStallLink` (or auto-approve) |
| `PATCH /api/portal/events/[id]/stall-requests/[linkId]` | the **shop** `[id]` | `{ action: 'withdraw' }` or `{ stallPickupInfo }` | withdraw / edit pickup note |
| `PATCH /api/portal/events/[id]/stalls/[linkId]` | the **host** `[id]` | `{ action: 'approve' \| 'decline' \| 'revoke' }` | host decision |
| `GET` variants piggyback on the portal pages (server components read `stalls.ts` directly — no fetch needed) | | | |

Every handler re-verifies that `[linkId]` actually belongs to `[id]` (the `getEventQuestion(eventId, questionId)` pattern), so a link id alone can never reach across tenants.

## 5. The approval flow — who sees what

**Stall owner initiates** (they have the motivation; host-initiated invites are deferred, `initiated_by` column reserved).

### Shop owner's portal (on their shop's editor — a new "Events" / "Take this shop to an event" panel)
- A picker listing **published, upcoming** events (from `listPublishedEvents()` filtered to `kind='event'`, `event_date >= today`) with name, date, city — plus an optional one-line message to the host.
- Their existing links listed with plain-language status: *"Requested — waiting for {host organizer name}"*, *"Approved — you're on the event page"*, *"Declined"*, *"Removed by the host"*, each with Withdraw where legal.
- On an approved link: a text field for `stall_pickup_info` ("Where do buyers find you at the event? e.g. 'Stall 4, food row, from 17:00'") — editable any time, no re-approval (it's collection logistics, not page content).

### Host organizer's portal (on their event — a new "Stalls" panel)
- **Pending requests:** shop name → links to the *public* shop page `/e/<shop-slug>` (so the host judges exactly what buyers would see), seller's account name, the message, Approve / Decline buttons.
- **Approved stalls:** the live list, each with a Remove (revoke) button. Revoke confirms with: *"This stall already has N paid orders awaiting collection"* (from the existing `countPaidOrdersForEvent(shopId)` — shop-wide count, and the copy must say so honestly; see §11). No buyer names ever cross the tenant line — the host sees aggregates only, same rule as the platform admin (`EventSalesSummary` doctrine in `orders.ts`).
- A one-line scanner note: *"Each stall scans its own collection codes with its own scanner link from their portal — your door scanner only checks in tickets."*

### Notifications (three fail-soft helpers in `src/lib/email.ts`, existing style)
- `sendStallRequestEmail(hostOrganizer, hostEvent, shop, message)` — "…wants a stall at… view the shop, approve in your portal."
- `sendStallDecisionEmail(shopOrganizer, hostEvent, approved|declined)`
- `sendStallRevokedEmail(shopOrganizer, hostEvent)` — includes the "you may have pre-orders to honour or refund" sentence.

### Revocation semantics
Revoke removes the stall from the event page **immediately** (next render — everything is `force-dynamic`). It does **not** touch orders: money already went buyer → stall, so honouring or refunding those orders is the stall owner's job, with the platform's role limited to the warning count and the email. This is the boring, no-escrow answer that the free-platform constraint forces, and it should be said plainly in the portal copy.

## 6. Buyer UX

### 6a. Host event page (`/e/[slug]/page.tsx`, `kind='event'` only) — the "Order ahead" section
- New section (anchor `id="stalls"`, added to `SectionNav`) rendered when `listVisibleStallsForEvent()` is non-empty. Suggested placement: after tickets, before the posts feed.
- Heading suggestion: **"Order ahead from the stalls"** with the subline *"Pre-order and skip the queue — collect at their stall at the event."* (final wording is Milan's, see open questions).
- One card per stall: cover thumb (`mediaUrl(coverMediaId, 'card', …)`), shop name, **"Sold by {organizer name}"** (the disclosed-agent line, non-negotiable per the VAT posture — each card names the specific seller and the copy near the section repeats *"you pay each seller directly"*), `fromPriceCents` ("from €4"), the `stall_pickup_info` line if set, and the state chip: orderable / "Orders closed" (`!salesOpen`) / "Sold out" (via `ticketState`).
- **The card links to the stall's own page `/e/<shop-slug>`** — not straight to checkout. That page carries the full seller identity, pickup info, gallery, WhatsApp bubble, and its own `Order` CTA into the existing `/e/<shop-slug>/checkout`. One click more, and every claim a buyer relies on is made by the seller's own page. No basket, no embedded cross-tenant checkout.

### 6b. Stall's own page (`kind='shop'`) — the host banner
- For each link where `stallBannerVisibleOnShopPage()` holds: a banner in/above the "How to collect" logistics card: **"Find us at {host event name} — {host date_display}"**, linking to `/e/<host-slug>`, followed by `stall_pickup_info` when set.
- The shop's generic `pickup_info` stays untouched below it — home pickup and event pickup can coexist truthfully.

### 6c. Orders, payment, references — unchanged by design
Checkout, `createOrder`, GiroCode/PayPal.Me, transfer confirmation, reminder mails, the order page: all untouched. The order is a shop order; the payout snapshot freezes the stall's account; the reference lands in the stall owner's portal; retention/erasure applies as today. **There is no code path in slice 2 that computes, holds, splits, or forwards money.**

## 7. Scanner scoping at the shared venue

Nothing to build — this section exists to be explicit about it:
- The host's door staff scan **tickets** via the host event's scanner link; a collection code presented at the door returns `wrong_event` with zero buyer details (existing `checkInTicket` scope).
- Each stall owner opens their own scanner link (existing per-event scan links work for shops today — slice 1 verified this) on their own phone at their stall; a host ticket scanned there also returns `wrong_event`.
- Revocation stays per-listing (`scan_epoch:<eventId>`): the host revoking their door links never logs a stall out, and vice versa.
- Late bank transfers at the counter: the stall owner can confirm an order on the spot from their portal orders list (mark-paid via reference last-4 **or** `senderNameMatches`) and then scan — worth one sentence of portal copy, no code.

## 8. Publish / readiness gating

- **No new publish requirements** on either side. `listingDetailChecks()` is untouched.
- Visibility is computed, never stored: `stallVisibleOnEventPage()` (§3) is the one rule, read by the public event page and by the host-portal preview list ("visible now / hidden because…"), so a portal tick can never disagree with the page — the same discipline `listingDetailChecks` established.
- An `approved` link **survives** the shop unpublishing and republishing (no re-approval churn; the host keeps Revoke as the actual control). It equally survives the host unpublishing/republishing.

## 9. Edge cases (behavior table)

| Situation | Behavior |
|---|---|
| Host unpublishes | Event page is gone (404s for buyers as today); stall banners hide (`host.status !== 'published'`). Link stays `approved`; everything returns on republish. |
| Host event date passes | Section and banners hide (`eventDate < today`, ISO compare as in `festivals.ts`). Link untouched — it's now inert history. |
| Host archived / deleted | Archived = not published → hidden. Deleted → `deleteEventCompletely` removes the link rows on both sides. |
| Stall unpublishes | Card disappears (`shop.status !== 'published'`). Paid orders keep working: order pages and `checkInTicket` don't consult listing status. |
| Stall pauses orders (`sales_open=0`) | Card **stays** with an "Orders closed" chip — presence at the event is still true; only orderability changed. |
| Stall items sold out | Existing `ticketState` renders the state; card shows "Sold out". |
| Revoke/withdraw with paid pre-orders | Confirm dialog shows the paid-order count (shop-wide, honestly labeled); revocation email to the stall owner says buyers may need to be contacted/refunded. Platform automates nothing further. |
| Buyer's transfer unconfirmed on event day | No collection code exists yet (codes mint only on `paid`). Stall owner confirms at the counter (see §7) or the reservation expires normally. |
| Same organizer owns host + shop | Allowed; request auto-approves (§3). |
| Duplicate request | `UNIQUE(host, shop)` + state machine: re-request only from `declined`/`withdrawn`; `revoked` is terminal for the shop side. |
| Host tries to see stall buyers | Impossible by construction: no route exposes another tenant's orders; host surfaces show shop metadata + aggregate counts only. |

## 10. Deliberately NOT in slice 2

1. **Host-initiated invites** (`initiated_by='host'` reserved). One direction keeps the UI and the state machine half the size.
2. **Order attribution to the host event** (`orders.source_event_id` or similar) and any per-event sales breakdown for stalls. Costs a column and analytics UI; buys nothing the October event needs.
3. **Stall fees / booth rent between host and vendor.** The platform is free and must stay out of every money flow (student-permit constraint). Booth rent is their offline business; the portal copy should say so once, plainly.
4. **Cross-stall basket / combined checkout.** One order pays one seller into one account — a basket across sellers is impossible without a payment processor and would destroy the disclosed-agent posture. Never build without Stripe-Connect-class infrastructure, which is out until studies end.
5. **Pickup time slots / queue management.** `stall_pickup_info` free text is the whole answer for now.
6. **Host scanning stall codes** or any shared scanner: it would leak stall buyers to the host and blur who redeemed what.
7. **Sort/feature UI** for the host (column exists; ordering is `sort, decided_at`).
8. **Admin moderation queue.** Host approval is the moderation. Admin gets, at most, a read-only links list later.

## 11. Known accepted costs

- The revoke warning's paid-order count is **shop-wide**, not per-host-event, because orders carry no host attribution (item 2 above). The copy must say "this shop has N paid orders awaiting collection", not "N orders for your event". Acceptable at this scale; fix only if real confusion shows up.
- A shop linked to two overlapping events shows both banners and one shared `pickup_info`; `stall_pickup_info` is per-link, which covers the practical part. The UI doesn't prevent multi-linking — the data model is already right if it happens.

## 12. Implementation order — four PR-sized steps

**PR 1 — Link table + domain + API (no UI).**
`event_stalls` migration in `db.ts`; `src/lib/stalls.ts` (state machine, ownership checks, auto-approve, visibility rules); delete cascade in `deleteEventCompletely`; the three portal routes with rate limits. Verifiable end-to-end with curl against two test organizers (demo accounts exist per memory).

**PR 2 — Portal panels + emails.**
Shop editor "Take this shop to an event" panel (picker, status list, withdraw, `stall_pickup_info` field); host event "Stalls" panel (requests, approve/decline, approved list, revoke + warning count); the three `email.ts` helpers wired to request/decide/revoke.

**PR 3 — Buyer surfaces.**
Event page "Order ahead" section (SectionNav anchor, cards with Sold-by line and state chips, section-level "you pay each seller directly" copy per the VAT posture); stall page host banner + per-event pickup line.

**PR 4 — Edges, copy, docs, E2E.**
Past/unpublish visibility tests; scanner-scoping copy in both portals; counter-confirmation hint for stall owners; PLATFORM.md/README section; full two-organizer E2E: request → approve → buyer pre-orders from the event page → pays stall's account → stall scans collection code at the "venue" → host ticket at the stall returns `wrong_event` → revoke removes the card.

## 13. Invariants to hold in review (the things that must never regress)

1. `event_stalls` is never read by `createOrder`, `effectivePayout`, `paymentReference`, or anything else money-facing.
2. Every buyer surface that shows a stall names its seller (card, shop page, checkout, order page, emails) — disclosed-agent posture.
3. No host surface can reach a stall's buyer names/emails; aggregates only.
4. `stallVisibleOnEventPage()` is the only visibility rule, and both the public page and the portal read it.
5. Scan tokens stay listing-scoped; no slice-2 code touches `auth.ts`.
6. No fee, no charge, no platform payment of any kind appears anywhere in this slice.


## Open questions for Milan

- Approval direction for launch: is stall-owner-requests / host-approves the right social flow for the October event, or do you want to invite specific sellers yourself (host-initiated invites)? The design defers invites — confirm that's acceptable for October.
- After a host DECLINES or REVOKES: the spec lets a shop re-request after a decline but makes revoke terminal (shop can never re-request; host would have to be the one to restart it). Is that the etiquette you want?
- Should the host see any numbers about a stall at all — the spec gives them one aggregate paid-order count in the revoke warning — or strictly nothing?
- Public wording and placement: what should the section be called on the event page ('Order ahead from the stalls'? 'Food & stalls'? a Nepali term like 'mela stalls'?), and does it sit above or below the organizer's posts feed? Brand voice is yours.
- Should stall cards keep showing on the event page after the event day as a 'was here' record, or disappear (the spec hides them once event_date passes)?
- One shop at several events at once: the data model allows it and the shop page would show multiple banners — fine, or should the UI enforce one live event per shop for now?
- Booth rent between host and stall: do you want explicit portal copy stating the platform never handles or mediates any payment between organizer and vendor (safest for the student-permit posture), or stay silent about it?
- For the October seed event specifically: will the host organizer genuinely operate the approve/decline panel themselves, or will you be doing it for them from their account? If the latter, PR 2's host UI can be minimal and polish can move to the buyer surfaces.
