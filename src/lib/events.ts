// Server-only: platform events — the multi-organizer replacement for the old
// single event.config.json. Every read/write of events, tiers, and media goes
// through here so tenant scoping stays in one place.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from './db';
import { deleteVariants } from './imageVariants';
import { paypalLinkFor } from './paypalLink';
import { chunkIds } from './sqlIn';
import { asEventKind, type EventKind } from './types';

export type EventStatus = 'draft' | 'published' | 'archived';

// Re-exported so server code that already reaches for events.ts keeps one import.
export type { EventKind } from './types';
export { asEventKind, isShop } from './types';

export interface EventRow {
  id: string;
  organizerId: string;
  slug: string;
  status: EventStatus;
  kind: EventKind;
  name: string;
  artist: string;
  description: string;
  dateDisplay: string;
  eventDate: string | null;
  venueName: string;
  /**
   * Shops only: where and when to collect, free text. Stands in for both the
   * date and the venue block, which is why a shop is never asked for those.
   * '' on every event, and on rows written before the column existed.
   */
  pickupInfo: string;
  /**
   * Shops only: which shelf of the /market bazaar this shop sits on — a key
   * from lib/categories.ts, whitelisted on write. '' means uncategorised
   * (always legal), and is what every event and every pre-column row carries.
   */
  category: string;
  address: string;
  city: string;
  currency: string;
  totalCapacity: number;
  /** False hides the "only N left" countdown from buyers entirely. */
  showRemaining: boolean;
  salesOpen: boolean;
  /**
   * The organizer's WhatsApp number, digits only, or ''. Never rendered raw —
   * every use goes through lib/whatsapp.ts.
   */
  whatsapp: string;
  /** Name shown on the WhatsApp bubble. '' falls back to the account name. */
  whatsappName: string;
  /**
   * Served URL of the bubble's own photo, or ''. Deliberately NOT the page's
   * profile photo: the two are chosen separately, and this one never joins the
   * event's public gallery.
   */
  whatsappPhoto: string;
  /** Which part of that photo sits in the circle, as CSS object-position. */
  whatsappFocus: string;
  maxPerOrder: number;
  payWithinDays: number;
  bankAccountHolder: string;
  bankIban: string;
  bankBic: string;
  bankName: string;
  /**
   * The organizer's own PayPal address, or their PayPal.Me link — '' when they
   * have not offered one. A SECOND route for the same money to the same person,
   * never a checkout integration: see paypalPayee() for why that distinction is
   * the whole point.
   */
  paypalAccount: string;
  /**
   * A payout change that has been confirmed but is WAITING. Until
   * pendingPayoutEffectiveAt passes, buyers are still quoted the live columns
   * above. Never read these directly — lib/payout.ts decides which of the two
   * sets is the answer, and money-facing code must go through it.
   */
  pendingBankAccountHolder: string | null;
  pendingBankIban: string | null;
  pendingBankBic: string | null;
  pendingBankName: string | null;
  pendingPaypalAccount: string | null;
  /** Unix ms; NULL when nothing is queued. */
  pendingPayoutEffectiveAt: number | null;
  /** 1 once the event could ever take money. Never cleared — see lib/payout.ts. */
  payoutLocked: number;
  /**
   * Which ways to pay THIS listing offers. A tick alone offers nothing: the
   * transfer route needs a bank account or PayPal.Me link set above, and the
   * instant routes need the seller's own connection (lib/paymentConnections).
   * paymentOptionsFor() is the only reader that combines the two.
   */
  payTransfer: boolean;
  payPaypal: boolean;
  payStripe: boolean;
  /**
   * Owned by a try-it-yourself demo account (lib/demo.ts). DERIVED from the
   * owner on every read rather than stored on the listing, so a listing a demo
   * account creates later can never forget to carry it. A demo listing is
   * never public: it is left out of every list, and only its owner's session
   * may open its pages (lib/demo listingOpenTo).
   */
  isDemo: boolean;
  /** Collection time slots, raw JSON — read with parseSlotConfig() in lib/kitchen. NULL = never set. */
  pickupSlots: string | null;
  /** How many tables have an order-from-the-table QR code (lib/kitchen). 0 = none. */
  tableCount: number;
  /** Reserved seating map, raw JSON — read with parseSeatMap() in lib/seats. NULL = unreserved. */
  seatMap: string | null;
  /** Subscribe & save: % off every repeat order of this shop (lib/subscriptions). 0 = not offered. */
  subscribePct: number;
  posterMediaId: string | null;
  profileMediaId: string | null;
  /** First/legacy uploaded video — an event can now hold several. */
  videoMediaId: string | null;
  /** The item shown first (feed thumbnail + top of the page): photo OR video. */
  coverMediaId: string | null;
  videoUrl: string;
  pageDesign: string; // raw JSON string; parse with parsePageDesign()
  /**
   * The organizer's own notes for the visitor assistant — parking, food, age
   * limits, doors, anything that has no field of its own. Plain text, shown to
   * nobody but the model. '' when they have not written any (the column is
   * NULL on rows that predate it; rowToEvent normalizes that away).
   */
  assistantContext: string;
  /**
   * The organizer's chosen framing for each fixed-shape slot, as raw JSON —
   * parse with parseCropRect(). NULL means "never repositioned": fall back to
   * the automatic crop.
   */
  coverCrop: string | null;
  profileCrop: string | null;
  posterCrop: string | null;
  createdAt: string;
}

export interface EventFaqRow {
  id: string;
  eventId: string;
  question: string;
  answer: string;
  sort: number;
}

export interface EventPostRow {
  id: string;
  eventId: string;
  body: string;
  mediaId: string | null;
  createdAt: string;
}

/**
 * What an organizer has decided about ONE ticket type.
 *
 *  on-sale     — buyable, subject to its cap and the room's.
 *  coming-soon — on the page with a green badge, refused everywhere a purchase
 *                is attempted. For a line-up announced before it goes on sale.
 *  hidden      — not on the page at all. For a type kept for next time, or one
 *                the organizer has stopped offering, without deleting it and
 *                losing the orders attached to it.
 */
export type TierStatus = 'on-sale' | 'coming-soon' | 'hidden';

export interface EventTierRow {
  id: string;
  eventId: string;
  tierKey: string;
  name: string;
  priceCents: number;
  cap: number;
  /** True when this ticket type is not capped — `cap` is then ignored. */
  unlimited: boolean;
  /**
   * How many people ONE sold unit of this tier admits (a "Table of 8" is one
   * booking, eight seats, eight QR tickets). `cap` counts UNITS of the tier;
   * the room's total_capacity counts SEATS — every place that converts between
   * the two multiplies by this. 1 on every ordinary ticket. Range 1..20,
   * enforced on write and re-clamped on read.
   */
  seatsPerUnit: number;
  /**
   * Announced but not yet on sale. Shown on the event page with a "Coming soon"
   * badge and refused by every purchase path — see the guard in api/orders.
   */
  status: TierStatus;
  studentOnly: boolean;
  /** The ONE line on the card. Stays short — the grid has room for a sentence. */
  description: string;
  /**
   * The long "about this item" prose behind the item page, or ''. Separate from
   * `description` on purpose: the card needs a line, the item page needs a
   * write-up, and collapsing the two would either bury the write-up in a grid
   * or shrink the card's line to nothing.
   */
  details: string;
  /**
   * Free choices a buyer makes for this item — "Spice: Mild, Medium, Hot" —
   * as raw JSON; read with parseChoices() in lib/kitchen. NULL = none. Never a
   * price: choosing never changes what is paid.
   */
  choices: string | null;
  /**
   * This item's photo: the id of one of the SAME listing's event_media rows,
   * or null. Never trust it raw — a photo can be deleted after a tier points at
   * it, and a hand-written row could name another listing's photo. tierPhoto()
   * is the only sanctioned way to turn it into something to render.
   */
  mediaId: string | null;
  sort: number;
}

export interface EventMediaRow {
  id: string;
  eventId: string;
  fileName: string;
  mime: string;
  sort: number;
  createdAt: string;
}

/**
 * Page design spec: either picked manually by the organizer or generated by
 * the AI designer. Only these constrained fields exist — the design can never
 * contain raw HTML/CSS/JS, so an organizer can't inject code into the site.
 */
export interface PageDesign {
  /** Named accent palette; the event page maps this onto safe CSS tokens. */
  accent?: 'violet' | 'sunset' | 'ocean' | 'emerald' | 'gold' | 'crimson';
  /** Overall mood; adjusts hero treatment. */
  vibe?: 'bold' | 'elegant' | 'party' | 'minimal';
  headline?: string; // short punchy line for the hero (defaults to event name)
  tagline?: string; // one sentence under the headline
  highlights?: string[]; // up to 5 short bullet highlights
  aboutTitle?: string; // heading for the description section
}

const EVENT_COLS = `
  id,
  organizer_id AS organizerId,
  slug,
  status,
  kind,
  name,
  artist,
  description,
  date_display AS dateDisplay,
  event_date AS eventDate,
  venue_name AS venueName,
  pickup_info AS pickupInfo,
  category,
  address,
  city,
  currency,
  total_capacity AS totalCapacity,
  show_remaining AS showRemaining,
  sales_open AS salesOpen,
  whatsapp,
  whatsapp_name AS whatsappName,
  whatsapp_photo AS whatsappPhoto,
  whatsapp_focus AS whatsappFocus,
  max_per_order AS maxPerOrder,
  pay_within_days AS payWithinDays,
  bank_account_holder AS bankAccountHolder,
  bank_iban AS bankIban,
  bank_bic AS bankBic,
  bank_name AS bankName,
  paypal_account AS paypalAccount,
  pending_bank_account_holder AS pendingBankAccountHolder,
  pending_bank_iban AS pendingBankIban,
  pending_bank_bic AS pendingBankBic,
  pending_bank_name AS pendingBankName,
  pending_paypal_account AS pendingPaypalAccount,
  pending_payout_effective_at AS pendingPayoutEffectiveAt,
  payout_locked AS payoutLocked,
  pay_transfer AS payTransfer,
  pay_paypal AS payPaypal,
  pay_stripe AS payStripe,
  (SELECT is_demo FROM organizers o WHERE o.id = events.organizer_id) AS isDemo,
  pickup_slots AS pickupSlots,
  table_count AS tableCount,
  seat_map AS seatMap,
  subscribe_pct AS subscribePct,
  poster_media_id AS posterMediaId,
  profile_media_id AS profileMediaId,
  video_media_id AS videoMediaId,
  cover_media_id AS coverMediaId,
  video_url AS videoUrl,
  page_design AS pageDesign,
  assistant_context AS assistantContext,
  cover_crop AS coverCrop,
  profile_crop AS profileCrop,
  poster_crop AS posterCrop,
  created_at AS createdAt
`;

/**
 * `50% 50%` and nothing else — two integer percentages.
 *
 * This string is written by an organizer and ends up inside a style attribute,
 * so it is never stored or read back without being matched against this. A
 * whitelist of the exact shape leaves no room for a second declaration, a url(),
 * or a closing quote.
 */
export const FOCUS_RE = /^(?:100|\d{1,2})% (?:100|\d{1,2})%$/;

function rowToEvent(row: Record<string, unknown> | undefined): EventRow | null {
  if (!row) return null;
  return {
    ...(row as unknown as EventRow),
    salesOpen: Boolean(row.salesOpen),
    // Added by migration and free text, so old rows read NULL. Both fall back
    // to what those rows have always meant: an event, with nothing to collect.
    kind: asEventKind(row.kind),
    pickupInfo: (row.pickupInfo as string | null) ?? '',
    category: (row.category as string | null) ?? '',
    // Added by migration, and a free-text column, so anything unrecognised
    // falls back to the wording that is always safe to show.
    whatsapp: (row.whatsapp as string | null) ?? '',
    whatsappName: (row.whatsappName as string | null) ?? '',
    whatsappPhoto: (row.whatsappPhoto as string | null) ?? '',
    // Re-validated on the way out too: this lands in a style attribute, so a
    // row written before the whitelist existed must not reach one unchecked.
    whatsappFocus: FOCUS_RE.test(String(row.whatsappFocus ?? '')) ? String(row.whatsappFocus) : '50% 50%',
    showRemaining: Boolean(row.showRemaining),
    // Added by migration, so it is NULL on every event created before it.
    assistantContext: (row.assistantContext as string | null) ?? '',
    paypalAccount: (row.paypalAccount as string | null) ?? '',
    payoutLocked: Number(row.payoutLocked ?? 0),
    // Rows from before the columns existed read NULL: transfer was the only
    // route then, so it stays on and the instant ones stay off.
    payTransfer: row.payTransfer === null || row.payTransfer === undefined ? true : Boolean(row.payTransfer),
    payPaypal: Boolean(row.payPaypal),
    payStripe: Boolean(row.payStripe),
    isDemo: Boolean(row.isDemo),
    pickupSlots: (row.pickupSlots as string | null) ?? null,
    tableCount: Number(row.tableCount ?? 0),
    seatMap: (row.seatMap as string | null) ?? null,
    subscribePct: Number(row.subscribePct ?? 0),
  };
}

/** One line of the publish checklist: what to do, and whether it is done. */
export interface ListingCheck {
  ok: boolean;
  /** Imperative and sentence-case, e.g. "Add a date". */
  label: string;
}

/**
 * What a listing has to say about ITSELF before it can go public.
 *
 * The kinds ask for different things, and each only for what its own buyers
 * genuinely need:
 *
 *   event — a date and a venue. Nobody can turn up to either without both.
 *   shop  — collection details. There is no date to turn up on, so this is the
 *           ONLY thing telling a buyer when to come and get what they paid for;
 *           the address stays optional because many of these shops are run out
 *           of someone's home and that is theirs to publish or not.
 *
 * Money, stock and the authenticator are NOT here — they belong to other parts
 * of the form, and the callers that show a full checklist add them around this.
 *
 * The editor's progress ticks, the Publish tab's checklist and the gate that
 * actually refuses to publish all read this one function, so a green tick can
 * never mean something different from what publishing will accept.
 */
export function listingDetailChecks(event: {
  kind: EventKind;
  name: string;
  description: string;
  dateDisplay: string;
  eventDate: string | null;
  venueName: string;
  address: string;
  pickupInfo: string;
}): ListingCheck[] {
  const checks: ListingCheck[] = [{ ok: Boolean(event.name.trim()), label: 'Give it a name' }];
  if (event.kind === 'shop') {
    checks.push({
      ok: Boolean(event.pickupInfo.trim()),
      label: 'Say how and when buyers collect their order',
    });
  } else {
    checks.push(
      // The CALENDAR date specifically, not the display text. The free-text
      // line ("Doors 6 PM · Show 7 PM") is what humans read, but the
      // machine-readable date is what orders the feed, drives reminders, and —
      // above all — starts the clock on the /privacy promise to erase buyer
      // details after the event. Accepting display text alone published events
      // whose buyers could never be erased, which made that promise false.
      { ok: Boolean(event.eventDate), label: 'Pick the event date in the calendar' },
      { ok: Boolean(event.venueName.trim() && event.address.trim()), label: 'Add the venue name and address' }
    );
  }
  checks.push({ ok: Boolean(event.description.trim()), label: 'Write a short description' });
  return checks;
}

/**
 * The unfinished checks as sentence fragments, ready to be joined into
 * "before publishing, please add a date, write a short description."
 */
export function missingListingDetails(event: Parameters<typeof listingDetailChecks>[0]): string[] {
  return listingDetailChecks(event)
    .filter((c) => !c.ok)
    .map((c) => c.label.charAt(0).toLowerCase() + c.label.slice(1));
}

/** True when nothing on the listing's own details is outstanding. */
export function listingDetailsComplete(event: Parameters<typeof listingDetailChecks>[0]): boolean {
  return listingDetailChecks(event).every((c) => c.ok);
}

export function getEventById(id: string): EventRow | null {
  return rowToEvent(getDb().prepare(`SELECT ${EVENT_COLS} FROM events WHERE id = ?`).get(id) as Record<string, unknown>);
}

export function getEventBySlug(slug: string): EventRow | null {
  return rowToEvent(
    getDb().prepare(`SELECT ${EVENT_COLS} FROM events WHERE slug = ?`).get(slug.toLowerCase().trim()) as Record<
      string,
      unknown
    >
  );
}

/** Feed: published events, soonest event_date first (undated ones last, newest first). */
export function listPublishedEvents(): EventRow[] {
  const rows = getDb()
    .prepare(
      `SELECT ${EVENT_COLS} FROM events WHERE status = 'published'
       AND organizer_id NOT IN (SELECT id FROM organizers WHERE is_demo = 1)
       ORDER BY event_date IS NULL, event_date ASC, created_at DESC`
    )
    .all() as Record<string, unknown>[];
  return rows.map((r) => rowToEvent(r)!) ;
}

export function listEventsForOrganizer(organizerId: string): EventRow[] {
  const rows = getDb()
    .prepare(`SELECT ${EVENT_COLS} FROM events WHERE organizer_id = ? ORDER BY created_at DESC`)
    .all(organizerId) as Record<string, unknown>[];
  return rows.map((r) => rowToEvent(r)!);
}

export function listAllEvents(): EventRow[] {
  const rows = getDb().prepare(`SELECT ${EVENT_COLS} FROM events ORDER BY created_at DESC`).all() as Record<
    string,
    unknown
  >[];
  return rows.map((r) => rowToEvent(r)!);
}

/** The oldest event — used by legacy single-event routes until fully migrated. */
export function getPrimaryEvent(): EventRow | null {
  return rowToEvent(
    getDb().prepare(`SELECT ${EVENT_COLS} FROM events ORDER BY created_at ASC LIMIT 1`).get() as Record<string, unknown>
  );
}

// ---------------- Tiers ----------------

/**
 * The 1..20 clamp below, written in SQL, for the seat counters that read
 * event_tiers directly instead of through getEventTiers.
 *
 * Those counters (lib/orders.ts's per-address ceilings and its awaiting-tickets
 * tile) SUM the column across a join, so they cannot borrow the reader's
 * clamp — and an unclamped 0 there makes every hold weigh nothing, which lets
 * one address hold a whole event past the anti-hoarding ceiling, while an
 * unclamped 100 refuses buyers over seats the room never sold. Sharing the
 * expression is what keeps the ceiling and the room describing the same event.
 *
 * Takes the table's alias because every caller joins event_tiers under one;
 * COALESCE first so a LEFT JOIN miss (a deleted tier) still weighs one seat,
 * exactly as lib/inventory.ts counts it.
 */
export function seatsPerUnitSql(tierAlias: string): string {
  return `MIN(20, MAX(1, CAST(ROUND(COALESCE(${tierAlias}.seats_per_unit, 1)) AS INTEGER)))`;
}

const TIER_COLS = `id, event_id AS eventId, tier_key AS tierKey, name, price_cents AS priceCents,
              cap, unlimited, status, student_only AS studentOnly, description, details,
              media_id AS mediaId, sort, seats_per_unit AS seatsPerUnit, choices`;

/** How a stored tier row arrives before normalization — see toTierRow. */
type RawTierRow = Omit<EventTierRow, 'studentOnly' | 'unlimited' | 'details'> & {
  studentOnly: number;
  unlimited: number;
  // NOT NULL with a default, but rows can predate the ALTER on a database
  // restored from an older dump — typed as it really arrives.
  details: string | null;
};

/**
 * The single normalization every tier read goes through, whether it came from
 * getEventTiers or the batch reader below. Shared rather than copied: these
 * three defences (status whitelist, seats clamp, details default) decide what
 * can be sold and how many seats it eats, so two readers of the same table must
 * not be able to disagree about them.
 */
function toTierRow(r: RawTierRow): EventTierRow {
  return {
    ...r,
    studentOnly: Boolean(r.studentOnly),
    unlimited: Boolean(r.unlimited),
    // NULL on every row written before the column existed, and on every tier
    // whose organizer has not written one — normalized here so no caller has
    // to spell `?? ''` before measuring or rendering it.
    details: r.details ?? '',
    mediaId: r.mediaId ?? null,
    choices: r.choices ?? null,
    // Whitelisted on the way out as well as in: an unrecognised value must not
    // silently hide a ticket type an organizer is trying to sell.
    status: r.status === 'coming-soon' || r.status === 'hidden' ? r.status : 'on-sale',
    // Re-clamped on read for the same reason status is whitelisted: this number
    // multiplies seat consumption and ticket minting, so a hand-edited row must
    // never be able to zero out (or explode) an event's inventory arithmetic.
    // seatsPerUnitSql() above is this same clamp, for the counters that sum the
    // column in SQL rather than reading tiers through here.
    seatsPerUnit: Math.min(20, Math.max(1, Math.round(Number(r.seatsPerUnit) || 1))),
  };
}

export function getEventTiers(eventId: string): EventTierRow[] {
  const rows = getDb()
    .prepare(`SELECT ${TIER_COLS} FROM event_tiers WHERE event_id = ? ORDER BY sort, tier_key`)
    .all(eventId) as RawTierRow[];
  return rows.map(toTierRow);
}

/**
 * Tiers for MANY events in one statement, keyed by event id.
 *
 * For listing pages, which hold every row they are about to render and used to
 * ask for each one's tiers separately — twice per tile, once for the prices and
 * once inside getAvailability. Same ordering per event as getEventTiers, so a
 * tile built from this map lists its ticket types in the organizer's order.
 * Events with no tiers are simply absent; callers default to an empty list.
 */
export function getEventTiersBulk(eventIds: string[]): Map<string, EventTierRow[]> {
  const out = new Map<string, EventTierRow[]>();
  for (const batch of chunkIds(eventIds)) {
    const rows = getDb()
      .prepare(
        `SELECT ${TIER_COLS} FROM event_tiers
         WHERE event_id IN (${batch.map(() => '?').join(',')})
         ORDER BY event_id, sort, tier_key`
      )
      .all(...batch) as RawTierRow[];
    for (const r of rows) {
      const list = out.get(r.eventId);
      if (list) list.push(toTierRow(r));
      else out.set(r.eventId, [toTierRow(r)]);
    }
  }
  return out;
}

export function getEventTier(eventId: string, tierKey: string): EventTierRow | null {
  return getEventTiers(eventId).find((t) => t.tierKey === tierKey) ?? null;
}

/**
 * The photo this tier may actually show, or null.
 *
 * `photos` is THIS listing's own photo list (getEventMedia), and an id that is
 * not in it — deleted since it was picked, or belonging to another listing —
 * comes back as null. Degrading to no picture rather than throwing is the same
 * posture the cover/poster/profile slots already take on the event page: a
 * dangling pointer costs a thumbnail, never a page.
 *
 * The same check runs on save (see the tiers block in the portal's update
 * route), so this is the second of two locks, not the only one. It is still
 * required: the photo can be deleted long after the tier was saved.
 */
export function tierPhoto(tier: EventTierRow, photos: EventMediaRow[]): EventMediaRow | null {
  if (!tier.mediaId) return null;
  return photos.find((p) => p.id === tier.mediaId) ?? null;
}

/**
 * This listing's photos MINUS every picture a tier has claimed as its own.
 *
 * An item photo is an ordinary row in the listing's shared media pool — that is
 * what lets a tier point at one without a second upload path or a second place
 * to delete from. The cost is that any gallery built from the raw pool shows
 * the product art too: a shop with five items advertised eight "photos of the
 * shop", five of which were jars, and the item page's own rail offered the 500 g
 * jar and the gift box as more views of the 100 g jar somebody was deciding on.
 * A picture that belongs to one product belongs on that product's page and
 * nowhere else, so the generic rails are built from what is left here.
 *
 * Pass ALL tiers (getEventTiers), not just the visible ones: a hidden row is off
 * the page entirely, and its picture should not be the way back onto it.
 */
export function unclaimedPhotos(tiers: EventTierRow[], photos: EventMediaRow[]): EventMediaRow[] {
  const claimed = new Set(tiers.map((t) => t.mediaId).filter((id): id is string => !!id));
  return photos.filter((p) => !claimed.has(p.id));
}

/**
 * Is this row worth a page of its own — linked from the card, and offered to
 * Google in the sitemap?
 *
 * /e/[slug]/item/[tierKey] RENDERS for any visible tier regardless (a link
 * that was shared or indexed must not start 404ing the day a seller clears the
 * prose). This is the narrower question of whether anything should point at it.
 *
 *  - A SHOP: always. A shop sells goods, goods have product pages, and the
 *    item page carries things the grid cannot — the disclosed seller, the
 *    collection details, the picture at a size you can actually judge. "Read
 *    more" that is sometimes there and sometimes not is worse than plain.
 *  - An EVENT: only when the ticket has a picture or a write-up. A ticket tier
 *    is a line in a picker, not a product; with no photo and no details the
 *    page would repeat the card word for word, which costs a tap on the way to
 *    checkout and asks Google to index a page that duplicates the listing. So
 *    an ordinary event regresses to precisely today's card, and an organizer
 *    who writes a real description of their VIP table gets the page for it.
 */
export function tierHasItemPage(
  kind: EventKind,
  tier: EventTierRow,
  photo: EventMediaRow | null
): boolean {
  return kind === 'shop' || photo !== null || tier.details.trim().length > 0;
}

// ---------------- Media ----------------

/**
 * Photos only. Uploaded videos live in the same table but are listed by
 * getEventVideos(), so they never show up in photo galleries, poster
 * fallbacks, or the photo cap.
 */
export function getEventMedia(eventId: string): EventMediaRow[] {
  return getDb()
    .prepare(
      `SELECT id, event_id AS eventId, file_name AS fileName, mime, sort, created_at AS createdAt
       FROM event_media WHERE event_id = ? AND mime NOT LIKE 'video/%' ORDER BY sort, created_at`
    )
    .all(eventId) as EventMediaRow[];
}

/**
 * Photos for MANY events in one statement, keyed by event id — the batch
 * companion to getEventMedia, with the same photos-only filter and the same
 * ordering, for listing pages that resolve a tile picture per row.
 */
export function getEventMediaBulk(eventIds: string[]): Map<string, EventMediaRow[]> {
  const out = new Map<string, EventMediaRow[]>();
  for (const batch of chunkIds(eventIds)) {
    const rows = getDb()
      .prepare(
        `SELECT id, event_id AS eventId, file_name AS fileName, mime, sort, created_at AS createdAt
         FROM event_media
         WHERE event_id IN (${batch.map(() => '?').join(',')}) AND mime NOT LIKE 'video/%'
         ORDER BY event_id, sort, created_at`
      )
      .all(...batch) as EventMediaRow[];
    for (const r of rows) {
      const list = out.get(r.eventId);
      if (list) list.push(r);
      else out.set(r.eventId, [r]);
    }
  }
  return out;
}

/**
 * Videos only — the mirror image of getEventMedia, ordered the same way. An
 * event can hold several; events.video_media_id just points at the first one
 * for the older single-video call sites.
 */
export function getEventVideos(eventId: string): EventMediaRow[] {
  return getDb()
    .prepare(
      `SELECT id, event_id AS eventId, file_name AS fileName, mime, sort, created_at AS createdAt
       FROM event_media WHERE event_id = ? AND mime LIKE 'video/%' ORDER BY sort, created_at`
    )
    .all(eventId) as EventMediaRow[];
}

export function getMediaById(mediaId: string): EventMediaRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT id, event_id AS eventId, file_name AS fileName, mime, sort, created_at AS createdAt
         FROM event_media WHERE id = ?`
      )
      .get(mediaId) as EventMediaRow) ?? null
  );
}

/**
 * Public URL for a stored photo or video (served by /api/media/[id]).
 *
 * A variant asks the media route for a copy rendered to that slot's exact
 * shape, so an odd-sized upload still fills the frame with its subject in it
 * (see lib/imageVariants). Videos ignore it and serve the original.
 *
 * `tag` is the slot's framing stamp from cropTag() — the route ignores it, it
 * exists purely so a repositioned photo gets a URL of its own.
 */
export function mediaUrl(mediaId: string, variant?: VariantSlot, tag?: string | null): string {
  if (!variant) return `/api/media/${mediaId}`;
  return `/api/media/${mediaId}?v=${variant}${tag ? `&c=${tag}` : ''}`;
}

// ---------------- Slot framing (the organizer's chosen crop) ----------------

/** The rendered variants callers may ask for — see lib/imageVariants VARIANTS. */
export type VariantSlot = 'cover' | 'avatar' | 'card' | 'gallery';

/**
 * The part of a photo that stays visible inside a fixed-shape slot, as
 * FRACTIONS of the original image: x/y is the top-left corner, w/h the size.
 * {x:0,y:0,w:1,h:1} is the whole picture.
 */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The three slots an organizer can frame by hand; one column each. */
export type CropSlot = 'cover' | 'profile' | 'poster';

/** Column pairs per slot: where the framing lives, and which photo it applies to. */
const CROP_COLUMNS: Record<CropSlot, { crop: string; media: string }> = {
  cover: { crop: 'cover_crop', media: 'cover_media_id' },
  profile: { crop: 'profile_crop', media: 'profile_media_id' },
  poster: { crop: 'poster_crop', media: 'poster_media_id' },
};

/**
 * Parse a stored framing, rejecting anything that is not a usable rectangle.
 *
 * These fractions become pixel offsets handed to sharp's extract(), so this is
 * the only thing between a hand-edited row (or a future format change) and a
 * render that throws. Anything non-numeric, out of range, zero-sized, or
 * reaching past the image's edge returns null — which means the same as an
 * empty column, so a bad value degrades to the automatic crop rather than a
 * broken picture.
 */
export function parseCropRect(raw: string | null | undefined): CropRect | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const r = parsed as Record<string, unknown>;
  const values: number[] = [];
  for (const key of ['x', 'y', 'w', 'h'] as const) {
    const v = r[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    values.push(v);
  }
  const [x, y, w, h] = values;
  if (w <= 0 || h <= 0 || x < 0 || y < 0) return null;
  // A hair of tolerance past the far edge, then clamped: the browser sends
  // rounded fractions, so a rectangle flush against the right edge arrives as
  // x + w = 1.00003 and is a legitimate crop, not a malformed one.
  if (x + w > 1.0001 || y + h > 1.0001) return null;
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}

/**
 * Short, URL-safe stamp for a slot's framing, or null when there is none.
 *
 * Media responses are cached hard by browsers (a day, immutable) and the crop
 * is invisible in the URL — so without this, an organizer who repositions their
 * cover keeps seeing yesterday's framing and concludes the save did nothing.
 * Folding the rectangle into the query string makes new framing a new URL.
 */
export function cropTag(crop: CropRect | null): string | null {
  if (!crop) return null;
  return [crop.x, crop.y, crop.w, crop.h].map((n) => n.toFixed(4)).join('-');
}

/**
 * The framing chosen for whichever event uses this photo in this slot. Null
 * when no event does: a photo asked for as a cover that is nobody's cover has
 * no framing, and falls back to the automatic crop.
 */
export function getCropForSlot(mediaId: string, slot: CropSlot): CropRect | null {
  const cols = CROP_COLUMNS[slot];
  // Fixed column names from the table above — no request input is interpolated.
  const row = getDb()
    .prepare(`SELECT ${cols.crop} AS crop FROM events WHERE ${cols.media} = ?`)
    .get(mediaId) as { crop: string | null } | undefined;
  return parseCropRect(row?.crop);
}

// ---------------- FAQ & posts (organizer page content) ----------------

export function getEventFaqs(eventId: string): EventFaqRow[] {
  return getDb()
    .prepare(
      `SELECT id, event_id AS eventId, question, answer, sort
       FROM event_faqs WHERE event_id = ? ORDER BY sort, rowid`
    )
    .all(eventId) as EventFaqRow[];
}

/**
 * Point this event's WhatsApp bubble at a photo, or '' to clear it.
 *
 * Kept beside the other event writers rather than inside the upload route, so
 * the DELETE handler and the POST handler cannot drift on how it is stored.
 */
export function setEventWhatsappPhoto(eventId: string, url: string): void {
  getDb().prepare(`UPDATE events SET whatsapp_photo = ? WHERE id = ?`).run(url, eventId);
}

/** Replace the event's FAQ list wholesale (portal editor semantics). */
export function setEventFaqs(eventId: string, faqs: { question: string; answer: string }[]): EventFaqRow[] {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM event_faqs WHERE event_id = ?`).run(eventId);
    const ins = db.prepare(`INSERT INTO event_faqs (id, event_id, question, answer, sort) VALUES (?, ?, ?, ?, ?)`);
    faqs.forEach((f, i) => ins.run(crypto.randomUUID(), eventId, f.question, f.answer, i));
  });
  tx();
  return getEventFaqs(eventId);
}

export function listEventPosts(eventId: string): EventPostRow[] {
  return getDb()
    .prepare(
      `SELECT id, event_id AS eventId, body, media_id AS mediaId, created_at AS createdAt
       FROM event_posts WHERE event_id = ? ORDER BY created_at DESC, rowid DESC`
    )
    .all(eventId) as EventPostRow[];
}

export function createEventPost(eventId: string, body: string, mediaId: string | null): EventPostRow {
  const id = crypto.randomUUID();
  getDb()
    .prepare(`INSERT INTO event_posts (id, event_id, body, media_id) VALUES (?, ?, ?, ?)`)
    .run(id, eventId, body, mediaId);
  return listEventPosts(eventId).find((p) => p.id === id)!;
}

export function deleteEventPost(eventId: string, postId: string): boolean {
  return getDb().prepare(`DELETE FROM event_posts WHERE id = ? AND event_id = ?`).run(postId, eventId).changes > 0;
}

// ---------------- Visitor questions (AI assistant escalations) ----------------

export interface EventQuestionRow {
  id: string;
  eventId: string;
  question: string;
  answer: string | null;
  status: 'open' | 'answered' | 'dismissed';
  askedAt: string;
  answeredAt: string | null;
  /** '' when the question was asked anonymously. */
  askerName: string;
  /** '' when they did not want the answer emailed. */
  askerEmail: string;
  answerEmailedAt: string | null;
  askerErasedAt: string | null;
}

const QUESTION_COLS = `id, event_id AS eventId, question, answer, status, asked_at AS askedAt,
  answered_at AS answeredAt, asker_name AS askerName, asker_email AS askerEmail,
  answer_emailed_at AS answerEmailedAt, asker_erased_at AS askerErasedAt`;

export function createEventQuestion(
  eventId: string,
  question: string,
  asker: { name?: string; email?: string } = {}
): EventQuestionRow {
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO event_questions (id, event_id, question, asker_name, asker_email) VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, eventId, question, (asker.name ?? '').trim(), (asker.email ?? '').trim().toLowerCase());
  return getDb().prepare(`SELECT ${QUESTION_COLS} FROM event_questions WHERE id = ?`).get(id) as EventQuestionRow;
}

/** One question by id, scoped to its event so an id alone cannot reach across events. */
export function getEventQuestion(eventId: string, questionId: string): EventQuestionRow | null {
  return (
    (getDb()
      .prepare(`SELECT ${QUESTION_COLS} FROM event_questions WHERE id = ? AND event_id = ?`)
      .get(questionId, eventId) as EventQuestionRow | undefined) ?? null
  );
}

/**
 * Record that the answer reached the asker. Only ever called after a send
 * actually succeeded — an unset stamp is what lets the portal tell the
 * organizer their reply never went out.
 */
export function markQuestionAnswerEmailed(questionId: string): void {
  getDb()
    .prepare(`UPDATE event_questions SET answer_emailed_at = datetime('now') WHERE id = ?`)
    .run(questionId);
}

export function listEventQuestions(eventId: string, status?: EventQuestionRow['status']): EventQuestionRow[] {
  if (status) {
    return getDb()
      .prepare(`SELECT ${QUESTION_COLS} FROM event_questions WHERE event_id = ? AND status = ? ORDER BY asked_at DESC`)
      .all(eventId, status) as EventQuestionRow[];
  }
  return getDb()
    .prepare(`SELECT ${QUESTION_COLS} FROM event_questions WHERE event_id = ? ORDER BY asked_at DESC`)
    .all(eventId) as EventQuestionRow[];
}

/** Organizer answers an open question — it becomes public Q&A + AI context. */
export function answerEventQuestion(eventId: string, questionId: string, answer: string): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE event_questions SET answer = ?, status = 'answered', answered_at = datetime('now')
         WHERE id = ? AND event_id = ?`
      )
      .run(answer, questionId, eventId).changes > 0
  );
}

export function dismissEventQuestion(eventId: string, questionId: string): boolean {
  return (
    getDb()
      .prepare(`UPDATE event_questions SET status = 'dismissed' WHERE id = ? AND event_id = ? AND status = 'open'`)
      .run(questionId, eventId).changes > 0
  );
}

/**
 * How many questions are still waiting on an answer, per event, in one
 * statement — the badge on every row of the organizer's dashboard.
 *
 * A COUNT rather than listEventQuestions(...).length per event: that read the
 * whole question row, asker name and email included, for a number the page
 * prints next to the word "question". Fewer statements and less personal data
 * off the disk for exactly the same badge.
 *
 * Events with nothing open are absent; callers default to 0.
 */
export function countOpenQuestionsByEvent(eventIds: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const batch of chunkIds(eventIds)) {
    const rows = getDb()
      .prepare(
        `SELECT event_id AS eventId, COUNT(*) AS n FROM event_questions
         WHERE status = 'open' AND event_id IN (${batch.map(() => '?').join(',')})
         GROUP BY event_id`
      )
      .all(...batch) as { eventId: string; n: number }[];
    for (const r of rows) out.set(r.eventId, r.n);
  }
  return out;
}

/** Count of open visitor questions across all of an organizer's events. */
export function countOpenQuestionsForOrganizer(organizerId: string): number {
  return (
    getDb()
      .prepare(
        `SELECT COUNT(*) AS n FROM event_questions q JOIN events e ON e.id = q.event_id
         WHERE e.organizer_id = ? AND q.status = 'open'`
      )
      .get(organizerId) as { n: number }
  ).n;
}

// ---------------- Deleting an event ----------------

/**
 * Orders for this event that are already paid: buyers who transferred real
 * money and are holding a real ticket. Deleting the event destroys those
 * tickets, so this count is what the portal shows before the delete button and
 * what the delete API refuses to act on without an explicit acknowledgement.
 */
export function countPaidOrdersForEvent(eventId: string): number {
  return (
    getDb().prepare(`SELECT COUNT(*) AS n FROM orders WHERE event_id = ? AND status = 'paid'`).get(eventId) as {
      n: number;
    }
  ).n;
}

/** What a deletion actually removed — for the server log and the confirmation. */
export interface DeletedEventSummary {
  orders: number;
  tickets: number;
  media: number;
  /** Payout-audit rows removed with the event — they hold IBANs in full. */
  payoutChanges: number;
}

/**
 * The event's two folders: uploaded originals and cached crops. Null when the
 * id could not be turned into a safe path — the id always comes from the
 * database, but this builds a path that a recursive delete then follows, so
 * anything that could climb out of DATA_DIR is refused rather than trusted.
 */
function eventFileDirs(eventId: string): { uploads: string; derived: string } | null {
  if (!/^[A-Za-z0-9_-]+$/.test(eventId)) return null;
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  return {
    uploads: path.join(dataDir, 'uploads', eventId),
    derived: path.join(dataDir, 'derived', eventId),
  };
}

/**
 * Delete an event and every trace of it — rows AND files. There is no undo, so
 * the CALLER owns the authorization: it must already have established that the
 * event belongs to whoever is asking, and collected their confirmation.
 *
 * All rows go in ONE transaction, children before parents (foreign keys are on,
 * and enforced immediately), so any failure leaves the event whole instead of
 * half-erased. Files are unlinked AFTER that transaction commits: the
 * filesystem cannot take part in it, and a leftover file on disk is a far
 * smaller problem than photos destroyed for an event that then failed to
 * delete. Each unlink is best-effort for the same reason — a file that is
 * already gone, or locked, must never turn a finished delete into an error.
 */
export function deleteEventCompletely(eventId: string): DeletedEventSummary {
  const db = getDb();
  // Read the media ids before the rows go: the derivative cache is keyed by id.
  const media = db.prepare(`SELECT id FROM event_media WHERE event_id = ?`).all(eventId) as { id: string }[];
  const summary: DeletedEventSummary = {
    orders: (db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE event_id = ?`).get(eventId) as { n: number }).n,
    tickets: (
      db
        .prepare(`SELECT COUNT(*) AS n FROM tickets t JOIN orders o ON o.id = t.order_id WHERE o.event_id = ?`)
        .get(eventId) as { n: number }
    ).n,
    media: media.length,
    payoutChanges: (
      db.prepare(`SELECT COUNT(*) AS n FROM payout_changes WHERE event_id = ?`).get(eventId) as { n: number }
    ).n,
  };

  const tx = db.transaction(() => {
    // Sales: tickets and items hang off orders, so they go first.
    db.prepare(`DELETE FROM seat_holds WHERE event_id = ?`).run(eventId);
    db.prepare(`DELETE FROM tickets WHERE order_id IN (SELECT id FROM orders WHERE event_id = ?)`).run(eventId);
    db.prepare(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE event_id = ?)`).run(eventId);
    db.prepare(`DELETE FROM orders WHERE event_id = ?`).run(eventId);

    // Page content: posts carry a real foreign key to event_media, so an
    // attached photo cannot be removed while the post that shows it survives.
    db.prepare(`DELETE FROM event_posts WHERE event_id = ?`).run(eventId);
    db.prepare(`DELETE FROM event_media WHERE event_id = ?`).run(eventId);
    db.prepare(`DELETE FROM event_faqs WHERE event_id = ?`).run(eventId);
    db.prepare(`DELETE FROM event_questions WHERE event_id = ?`).run(eventId);
    db.prepare(`DELETE FROM event_tiers WHERE event_id = ?`).run(eventId);
    // Wishes (lib/wishes) — the table exists only once somebody has wished.
    if (db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'item_wishes'`).get()) {
      db.prepare(`DELETE FROM item_wishes WHERE event_id = ?`).run(eventId);
    }

    // The payout audit trail. It holds IBANs and PayPal addresses IN FULL — that
    // is deliberate, because a masked forensic record is useless — which makes
    // it the one table that must not outlive the event it describes. Without
    // this, deleting an event left payout details on disk for something that no
    // longer exists, readable by nothing and deletable by no one.
    db.prepare(`DELETE FROM payout_changes WHERE event_id = ?`).run(eventId);

    // Announcement send-tracking rows point at this event (foreign key), so
    // they go with it. The CONSENTS deliberately do NOT: a buyer's "keep me
    // posted" tick was about the ORGANIZER's future listings, not about this
    // one event, so deleting an event must never silence a subscription the
    // buyer still wants. See lib/marketing.ts.
    db.prepare(`DELETE FROM marketing_sends WHERE event_id = ?`).run(eventId);

    // The door-scanner revocation counter is keyed per event (lib/auth), so it
    // would otherwise outlive every link it was ever counting for.
    db.prepare(`DELETE FROM kv WHERE key = ?`).run(`scan_epoch:${eventId}`);

    // Stall links (lib/stalls.ts) reference this listing from EITHER side —
    // as the host event or as the shop — so both directions go with it. The
    // link is consent only, never money, so nothing here needs a husk.
    db.prepare(`DELETE FROM event_stalls WHERE host_event_id = ? OR shop_event_id = ?`).run(eventId, eventId);

    db.prepare(`DELETE FROM events WHERE id = ?`).run(eventId);
  });
  tx();

  for (const m of media) {
    try {
      deleteVariants(eventId, m.id);
    } catch {
      // Best effort — the whole cache folder is removed below anyway.
    }
  }
  const dirs = eventFileDirs(eventId);
  if (dirs) {
    for (const dir of [dirs.uploads, dirs.derived]) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Leftover bytes with no row pointing at them: harmless, and never a
        // reason to report a completed delete as a failure.
      }
    }
  }

  return summary;
}

// ---------------- Helpers ----------------

// ---------------- PayPal (the organizer's own account) ----------------

/**
 * What the buyer is shown so they can send the money by PayPal instead of by
 * bank transfer.
 *
 * This is NOT a PayPal checkout. A checkout integration would collect the money
 * into whichever merchant account owns the client ID — the platform's — and the
 * platform would then owe every organizer a payout it has no machinery to make.
 * The site tells buyers, truthfully, that their money goes straight to the
 * organizer and never passes through us, and that has to keep being true
 * whichever button they press. So PayPal here works exactly as the IBAN does:
 * the organizer's own address, the same payment reference, and the organizer
 * confirming what actually arrived.
 */
export interface PaypalPayee {
  /** Exactly what the organizer entered — an address or a PayPal.Me link. */
  handle: string;
  /** A tappable link, when they gave one. Null for a plain address. */
  link: string | null;
}

const PAYPAL_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
/** paypal.me/name and PayPal's own newer paypal.com/paypalme/name form. */
/**
 * Normalize what an organizer typed into something safe to render.
 *
 * "paypal.me/myband" without the scheme is what people actually paste, so it is
 * completed rather than rejected. Anything that is neither a plausible address
 * nor a PayPal link comes back as a handle with no link: it is still shown for
 * the buyer to read, but it never becomes an href — an arbitrary string from an
 * organizer must not turn into a clickable destination.
 *
 * The link rule itself lives in lib/paypalLink, so the organizer's editor can
 * tell them which of the two they have typed before they ever publish.
 */
export function paypalPayee(event: Pick<EventRow, 'paypalAccount'>): PaypalPayee | null {
  const raw = (event.paypalAccount || '').trim();
  if (!raw) return null;
  return { handle: raw, link: paypalLinkFor(raw) };
}

/**
 * A PayPal.Me link with the amount already in it, or null.
 *
 * PayPal.Me accepts a trailing amount — /25.00EUR — so the buyer lands on a page
 * that already knows what to charge. Worth having, and worth being honest about
 * its limit: the link carries the amount and nothing else. There is no field in
 * a PayPal.Me URL for the payment reference, so the buyer still has to type
 * TICKETS-XXXXXXXX into PayPal's message box themselves, and the organizer
 * still has to match it by hand afterwards.
 *
 * That is the opposite of what the GiroCode does, and the difference is not
 * cosmetic: a GiroCode fills in the reference, which is the one field that
 * actually costs somebody an evening when it goes missing.
 *
 * Null for a plain PayPal address, because an email is not a destination — see
 * paypalPayee(), which deliberately refuses to turn arbitrary organizer input
 * into a clickable link.
 */
export function paypalMeUrl(
  payee: PaypalPayee | null,
  amountCents: number,
  currency: string,
): string | null {
  if (!payee?.link) return null;

  const cents = Math.round(amountCents);
  if (!Number.isFinite(cents) || cents < 1) return null;

  // PayPal.Me reads the currency straight off the end of the path. Anything it
  // does not recognise silently becomes the account's default currency, which
  // would quietly show a buyer the wrong number — so only pass a code that
  // looks like one.
  const code = (currency || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;

  return `${payee.link.replace(/\/$/, '')}/${(cents / 100).toFixed(2)}${code}`;
}

/** True for input this platform will accept in the PayPal field. */
export function isValidPaypalAccount(raw: string): boolean {
  const value = raw.trim();
  if (!value) return true; // optional — empty simply means "no PayPal"
  if (PAYPAL_EMAIL_RE.test(value)) return true;
  return paypalLinkFor(value) !== null;
}

/** Universal "Open in Maps" link — opens the native maps app on phones. */
export function mapsUrl(event: Pick<EventRow, 'address' | 'venueName' | 'city'>): string | null {
  const query = [event.venueName, event.address, event.city].filter(Boolean).join(', ').trim();
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Safe embed URL for the event video (YouTube/Vimeo page links -> embeds). */
export function videoEmbedUrl(raw: string): { kind: 'youtube' | 'vimeo' | 'file'; url: string } | null {
  const url = (raw || '').trim();
  if (!url || !/^https:\/\//i.test(url)) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v') || (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : null);
      if (id && /^[\w-]{5,20}$/.test(id)) return { kind: 'youtube', url: `https://www.youtube-nocookie.com/embed/${id}` };
      return null;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (id && /^[\w-]{5,20}$/.test(id)) return { kind: 'youtube', url: `https://www.youtube-nocookie.com/embed/${id}` };
      return null;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.slice(1).split('/')[0];
      if (id && /^\d{4,15}$/.test(id)) return { kind: 'vimeo', url: `https://player.vimeo.com/video/${id}` };
      return null;
    }
    if (/\.(mp4|webm)$/i.test(u.pathname)) return { kind: 'file', url };
    return null;
  } catch {
    return null;
  }
}

const ACCENTS = new Set(['violet', 'sunset', 'ocean', 'emerald', 'gold', 'crimson']);
const VIBES = new Set(['bold', 'elegant', 'party', 'minimal']);

/** Parse + sanitize a stored page design. Unknown/invalid fields are dropped. */
export function parsePageDesign(raw: string | null | undefined): PageDesign {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || '{}');
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};
  const d = parsed as Record<string, unknown>;
  const clean: PageDesign = {};
  if (typeof d.accent === 'string' && ACCENTS.has(d.accent)) clean.accent = d.accent as PageDesign['accent'];
  if (typeof d.vibe === 'string' && VIBES.has(d.vibe)) clean.vibe = d.vibe as PageDesign['vibe'];
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
  const headline = str(d.headline, 90);
  const tagline = str(d.tagline, 200);
  const aboutTitle = str(d.aboutTitle, 60);
  if (headline) clean.headline = headline;
  if (tagline) clean.tagline = tagline;
  if (aboutTitle) clean.aboutTitle = aboutTitle;
  if (Array.isArray(d.highlights)) {
    const hl = d.highlights
      .map((h) => (typeof h === 'string' ? h.trim().slice(0, 90) : ''))
      .filter(Boolean)
      .slice(0, 5);
    if (hl.length) clean.highlights = hl;
  }
  return clean;
}

/** Slugify an event name; ensures uniqueness by suffixing -2, -3, … */
export function makeUniqueSlug(name: string, excludeEventId?: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'event';
  const db = getDb();
  let candidate = base;
  for (let i = 2; ; i++) {
    const row = db.prepare(`SELECT id FROM events WHERE slug = ?`).get(candidate) as { id: string } | undefined;
    if (!row || row.id === excludeEventId) return candidate;
    candidate = `${base}-${i}`;
  }
}

export function newId(): string {
  return crypto.randomUUID();
}
