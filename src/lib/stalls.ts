// Server-only: stall links — a shop (slice 1) standing at a host event, with
// the host organizer's consent.
//
// A stall is NOT a new kind of listing. It is one row in event_stalls tying an
// existing kind='shop' listing to an existing kind='event' listing: the shop
// owner requests, the host approves or revokes, and the event page gains a
// curated card linking OUT to the shop's own page. The link is consent and
// placement only — orders stay on the shop row, pay the shop's own account,
// and are scanned by the shop's own scanner link. Nothing in this file may
// ever be read by money-facing code (createOrder, effectivePayout,
// paymentReference), and nothing here computes, holds, splits, or forwards
// money. Booth rent between host and vendor is their offline business; the
// platform never handles or mediates any payment between them.
import crypto from 'crypto';
import { getDb } from './db';
import { getEventById, type EventRow } from './events';

export type StallLinkStatus = 'requested' | 'approved' | 'declined' | 'revoked' | 'withdrawn';

export interface StallLinkRow {
  id: string;
  hostEventId: string;
  shopEventId: string;
  status: StallLinkStatus;
  /** 'shop' today; 'host' is reserved for host-initiated invites (not built). */
  initiatedBy: 'shop' | 'host';
  /** The stall owner's note to the host, shown once in the host portal. */
  message: string;
  /** Where buyers find the stall AT THIS EVENT ("Stall 4, from 17:00"), or ''. */
  stallPickupInfo: string;
  /** Host's display order; no UI yet — lists order by (sort, decided_at). */
  sort: number;
  requestedAt: string;
  decidedAt: string | null;
  endedAt: string | null;
}

const STALL_COLS = `id, host_event_id AS hostEventId, shop_event_id AS shopEventId, status,
  initiated_by AS initiatedBy, message, stall_pickup_info AS stallPickupInfo, sort,
  requested_at AS requestedAt, decided_at AS decidedAt, ended_at AS endedAt`;

/**
 * Friendly refusal from requestStallLink — the message is written for the
 * shop owner's screen, so the API route can pass it straight through as a 400.
 */
export class StallActionError extends Error {}

/**
 * A shop may hold at most this many undecided requests at once, so one account
 * cannot paper every host portal on the platform with pending rows.
 */
const MAX_OPEN_REQUESTS_PER_SHOP = 10;

/** Same day arithmetic as festivals.ts: dates compare as ISO yyyy-mm-dd strings. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------- The single visibility rule ----------------
//
// The listingDetailChecks pattern: ONE function, read by the public event page
// AND the host-portal preview, so the two can never disagree about whether a
// card is showing. Visibility is computed, never stored — an approved link
// survives either side unpublishing and simply hides until they republish.

/** Whether this stall's card shows in the host event page's "Order ahead" section. */
export function stallVisibleOnEventPage(
  link: Pick<StallLinkRow, 'status'>,
  host: Pick<EventRow, 'status' | 'eventDate'>,
  shop: Pick<EventRow, 'status'>,
  todayIso: string
): boolean {
  return (
    link.status === 'approved' &&
    host.status === 'published' &&
    shop.status === 'published' &&
    // Cards hide once the host event's date passes — the stall is history, not
    // an offer. Published events always carry a date (the publish gate requires
    // it), so a NULL here is a hand-edited row and fails toward hidden.
    host.eventDate !== null &&
    host.eventDate >= todayIso
  );
}

/**
 * Whether the "Find us at {host event}" banner shows on the shop's OWN page.
 * Same rule minus the shop-published test — it is the shop's own page, so the
 * shop being visible is already a given.
 */
export function stallBannerVisibleOnShopPage(
  link: Pick<StallLinkRow, 'status'>,
  host: Pick<EventRow, 'status' | 'eventDate'>,
  todayIso: string
): boolean {
  return (
    link.status === 'approved' &&
    host.status === 'published' &&
    host.eventDate !== null &&
    host.eventDate >= todayIso
  );
}

// ---------------- Writes ----------------
//
// Every write takes the ACTING organizer's id and verifies ownership itself
// (the answerEventQuestion discipline: scope the statement, never trust the
// caller), so a leaked link id alone can never act across tenants — even if a
// future route forgets its own guard.

/**
 * The shop owner asks a host event for a stall (or re-asks after a decline or
 * a withdrawal — the UNIQUE(host, shop) row is reused, never duplicated).
 *
 * Refusals throw StallActionError with a message fit for their screen.
 * State machine:
 *
 *   (none)    --request--> requested (or straight to approved, see below)
 *   declined  --re-request--> requested   (reset message/requested_at, clear stamps)
 *   withdrawn --re-request--> requested   (same)
 *   revoked   --re-request--> REFUSED     (the host removed them; only a human
 *                                          conversation should restart that)
 */
export function requestStallLink(
  shopOrganizerId: string,
  shopEventId: string,
  hostEventId: string,
  message: string
): StallLinkRow {
  const shop = getEventById(shopEventId);
  // An ownership miss reads exactly like a missing listing — same 404 doctrine
  // as requireOwnedEvent, so probing ids learns nothing.
  if (!shop || shop.organizerId !== shopOrganizerId) {
    throw new StallActionError('We could not find that shop.');
  }
  if (shop.kind !== 'shop') {
    throw new StallActionError('Only a shop can take a stall at an event.');
  }
  // The host must be able to open the REAL public page before saying yes — a
  // draft shop has nothing to judge.
  if (shop.status !== 'published') {
    throw new StallActionError('Publish your shop first — the host decides by looking at your public page.');
  }

  const host = getEventById(hostEventId);
  // Unpublished and nonexistent hosts answer identically: drafts are not
  // discoverable, and this route must not become the way to enumerate them.
  if (!host || host.kind !== 'event' || host.status !== 'published') {
    throw new StallActionError('We could not find that event.');
  }
  // A try-it-yourself demo (lib/demo.ts) may only link its OWN listings: a
  // demo shop asking a real host would email a real organizer, and a real shop
  // asking a demo event would be reaching into a sandbox nobody else can see.
  // Same wording as a missing event, for the same no-enumeration reason.
  if ((shop.isDemo || host.isDemo) && shop.organizerId !== host.organizerId) {
    throw new StallActionError('We could not find that event.');
  }
  if (host.eventDate === null || host.eventDate < todayIso()) {
    throw new StallActionError('That event has already happened.');
  }

  // Asking yourself for permission is noise: when one account runs both sides,
  // the link is written directly as approved.
  const autoApprove = shop.organizerId === host.organizerId;

  const db = getDb();
  const trimmed = message.trim();

  // One transaction so the open-request cap and the reused-row check cannot
  // race a concurrent request into an extra row.
  const linkId = db.transaction((): string => {
    const existing = db
      .prepare(`SELECT ${STALL_COLS} FROM event_stalls WHERE host_event_id = ? AND shop_event_id = ?`)
      .get(hostEventId, shopEventId) as StallLinkRow | undefined;

    if (existing) {
      if (existing.status === 'requested') {
        throw new StallActionError('You already asked this host — they have not decided yet.');
      }
      if (existing.status === 'approved') {
        throw new StallActionError('This stall is already approved for that event.');
      }
      // Revoked is terminal for the shop side: the host actively removed them,
      // and only talking to the host — not a retry button — should undo that.
      if (existing.status === 'revoked') {
        throw new StallActionError('The host removed this stall — please talk to them directly.');
      }
    }

    if (!autoApprove) {
      const open = (
        db
          .prepare(`SELECT COUNT(*) AS n FROM event_stalls WHERE shop_event_id = ? AND status = 'requested'`)
          .get(shopEventId) as { n: number }
      ).n;
      if (open >= MAX_OPEN_REQUESTS_PER_SHOP) {
        throw new StallActionError(
          `This shop already has ${MAX_OPEN_REQUESTS_PER_SHOP} requests waiting — let some hosts decide first.`
        );
      }
    }

    const status: StallLinkStatus = autoApprove ? 'approved' : 'requested';
    if (existing) {
      // Re-request reuses the row (declined/withdrawn only, refused above):
      // message and requested_at reset, the decide/end stamps clear, so the
      // host sees a fresh request and never a haunted old one.
      db.prepare(
        `UPDATE event_stalls
         SET status = ?, initiated_by = 'shop', message = ?,
             requested_at = datetime('now'),
             decided_at = ${autoApprove ? `datetime('now')` : 'NULL'},
             ended_at = NULL
         WHERE id = ?`
      ).run(status, trimmed, existing.id);
      return existing.id;
    }

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO event_stalls (id, host_event_id, shop_event_id, status, initiated_by, message, decided_at)
       VALUES (?, ?, ?, ?, 'shop', ?, ${autoApprove ? `datetime('now')` : 'NULL'})`
    ).run(id, hostEventId, shopEventId, status, trimmed);
    return id;
  })();

  return getStallLink(linkId)!;
}

/** The host says yes to a pending request. */
export function approveStallLink(hostOrganizerId: string, linkId: string): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE event_stalls SET status = 'approved', decided_at = datetime('now')
         WHERE id = ? AND status = 'requested'
           AND host_event_id IN (SELECT id FROM events WHERE organizer_id = ?)`
      )
      .run(linkId, hostOrganizerId).changes > 0
  );
}

/** The host says no to a pending request. The shop may re-request later. */
export function declineStallLink(hostOrganizerId: string, linkId: string): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE event_stalls SET status = 'declined', decided_at = datetime('now')
         WHERE id = ? AND status = 'requested'
           AND host_event_id IN (SELECT id FROM events WHERE organizer_id = ?)`
      )
      .run(linkId, hostOrganizerId).changes > 0
  );
}

/**
 * The host removes an approved stall. Terminal for the shop side — see
 * requestStallLink. Deliberately touches NO orders: money already went
 * buyer → stall, so honouring or refunding pre-orders is the stall owner's
 * job; the platform's role stops at the warning count and the email (PR 2).
 */
export function revokeStallLink(hostOrganizerId: string, linkId: string): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE event_stalls SET status = 'revoked', ended_at = datetime('now')
         WHERE id = ? AND status = 'approved'
           AND host_event_id IN (SELECT id FROM events WHERE organizer_id = ?)`
      )
      .run(linkId, hostOrganizerId).changes > 0
  );
}

/** The shop owner pulls out — of a pending request or an approved stall alike. */
export function withdrawStallLink(shopOrganizerId: string, linkId: string): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE event_stalls SET status = 'withdrawn', ended_at = datetime('now')
         WHERE id = ? AND status IN ('requested', 'approved')
           AND shop_event_id IN (SELECT id FROM events WHERE organizer_id = ?)`
      )
      .run(linkId, shopOrganizerId).changes > 0
  );
}

/**
 * The per-event collection note ("Stall 4, food row, from 17:00"). Editable by
 * the shop owner at any time with no re-approval — it is collection logistics,
 * not page content the host consented to.
 */
export function setStallPickupInfo(shopOrganizerId: string, linkId: string, text: string): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE event_stalls SET stall_pickup_info = ?
         WHERE id = ? AND shop_event_id IN (SELECT id FROM events WHERE organizer_id = ?)`
      )
      .run(text.trim(), linkId, shopOrganizerId).changes > 0
  );
}

// ---------------- Reads ----------------

/** Every link on a host event, all statuses — the host portal's "Stalls" panel. */
export function listStallLinksForHostEvent(hostEventId: string): StallLinkRow[] {
  return getDb()
    .prepare(
      `SELECT ${STALL_COLS} FROM event_stalls WHERE host_event_id = ?
       ORDER BY sort, decided_at, requested_at`
    )
    .all(hostEventId) as StallLinkRow[];
}

/** Every link a shop holds, all statuses — the shop portal's "Events" panel. */
export function listStallLinksForShop(shopEventId: string): StallLinkRow[] {
  return getDb()
    .prepare(
      `SELECT ${STALL_COLS} FROM event_stalls WHERE shop_event_id = ?
       ORDER BY sort, decided_at, requested_at`
    )
    .all(shopEventId) as StallLinkRow[];
}

/**
 * The stalls a BUYER should see on the host event page, shop rows included —
 * already filtered through stallVisibleOnEventPage, so callers render what
 * they get and never re-derive visibility themselves.
 */
export function listVisibleStallsForEvent(hostEventId: string): { link: StallLinkRow; shop: EventRow }[] {
  const host = getEventById(hostEventId);
  if (!host) return [];
  const today = todayIso();
  const links = getDb()
    .prepare(
      `SELECT ${STALL_COLS} FROM event_stalls WHERE host_event_id = ? AND status = 'approved'
       ORDER BY sort, decided_at`
    )
    .all(hostEventId) as StallLinkRow[];
  const visible: { link: StallLinkRow; shop: EventRow }[] = [];
  for (const link of links) {
    const shop = getEventById(link.shopEventId);
    if (shop && stallVisibleOnEventPage(link, host, shop, today)) visible.push({ link, shop });
  }
  return visible;
}

export function getStallLink(linkId: string): StallLinkRow | null {
  return (
    (getDb().prepare(`SELECT ${STALL_COLS} FROM event_stalls WHERE id = ?`).get(linkId) as
      | StallLinkRow
      | undefined) ?? null
  );
}
