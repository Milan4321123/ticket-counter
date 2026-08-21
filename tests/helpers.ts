/**
 * Fixtures for the suite. One rule shapes everything here: a fixture goes
 * through the REAL lib function wherever one exists.
 *
 * A test that builds its world with hand-written INSERTs is testing the
 * INSERTs. It will still pass after createOrder() stops claiming a discount
 * code, because the fixture never called createOrder() — which is exactly the
 * silent, expensive break this harness exists to catch. So makePaidOrder()
 * really does run createOrder -> claimInventory -> finalizePaidOrder, and
 * makeOrganizer() really does run createOrganizer.
 *
 * Raw SQL appears in exactly one place, marked below: events and ticket tiers
 * have no lib constructor at all — they are written inline by the portal's
 * route handlers. Those two INSERTs mirror the handlers' own; everything is
 * then read back through the real lib readers (getEventById, getEventTiers),
 * so the mapping from columns to objects is still the app's.
 *
 * The database itself is set up by tests/register.mjs, which runs before this
 * module is even parsed. Nothing here may be imported into application code.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getDb } from '../src/lib/db.ts';
import {
  getEventById,
  getEventTier,
  getEventTiers,
  type EventRow,
  type EventTierRow,
  type TierStatus,
} from '../src/lib/events.ts';
import { claimInventory } from '../src/lib/inventory.ts';
import { createOrder, finalizePaidOrder, getOrder, type OrderRow, type PaymentMethod, type TicketRow } from '../src/lib/orders.ts';
import { createOrganizer, type OrganizerRow } from '../src/lib/organizers.ts';
import { createPromoCode, type PromoInput, type PromoRow } from '../src/lib/promos.ts';
import type { EventKind } from '../src/lib/types.ts';

// ---------------- The guard ----------------

/**
 * Proof, at the moment the connection opens, that the tests are not pointed at
 * anybody's real data. Cheap, and the one mistake in this file that would be
 * unrecoverable rather than merely annoying.
 */
export function db() {
  const dataDir = process.env.DATA_DIR ?? '';
  // realpath both sides: on macOS os.tmpdir() is a symlink into /private, and
  // a guard that compared the two spellings would refuse a perfectly good
  // temp directory.
  const real = (p: string) => {
    try {
      return fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };
  const tmp = real(os.tmpdir());
  if (!dataDir || !(real(dataDir) + path.sep).startsWith(tmp + path.sep)) {
    throw new Error(
      `Tests must run against a throwaway DATA_DIR under the system temp dir; got ${dataDir || '<unset>'}. ` +
        `Run them with \`npm test\` so tests/register.mjs sets it up.`
    );
  }
  return getDb();
}

// ---------------- Organizers ----------------

let seq = 0;
/** Unique-per-process suffix, so fixtures never collide on a UNIQUE column. */
function uniq(prefix: string): string {
  seq += 1;
  return `${prefix}-${process.pid}-${seq}`;
}

export function makeOrganizer(
  overrides: { email?: string; name?: string; planPaidUntil?: string | null; notes?: string } = {}
): OrganizerRow {
  // The real constructor: it is what mints the id, hashes the initial
  // password and sets must_change_password.
  const { organizer } = createOrganizer({
    email: overrides.email ?? `${uniq('organizer')}@example.test`,
    name: overrides.name ?? 'Test Organizer',
    planPaidUntil: overrides.planPaidUntil,
    notes: overrides.notes,
  });
  return organizer;
}

// ---------------- Events and tiers ----------------

export interface TierSpec {
  tierKey?: string;
  name?: string;
  priceCents?: number;
  /** Units of this tier on sale. Ignored when `unlimited`. */
  cap?: number;
  unlimited?: boolean;
  seatsPerUnit?: number;
  status?: TierStatus;
  studentOnly?: boolean;
  description?: string;
  details?: string;
}

export interface PayoutSpec {
  bankAccountHolder?: string;
  bankIban?: string;
  bankBic?: string;
  bankName?: string;
  paypalAccount?: string;
}

export interface EventSpec {
  organizerId?: string;
  kind?: EventKind;
  name?: string;
  slug?: string;
  status?: 'draft' | 'published' | 'archived';
  currency?: string;
  totalCapacity?: number;
  salesOpen?: boolean;
  maxPerOrder?: number;
  payWithinDays?: number;
  eventDate?: string | null;
  payout?: PayoutSpec;
  tiers?: TierSpec[];
}

/**
 * RAW SQL, deliberately: there is no createEvent() in src/lib — the portal's
 * POST /api/portal/events writes this row inline. The column list and the
 * draft defaults are copied from there so a fixture event is the same shape a
 * real one is born with. The row is read back with getEventById(), so the
 * EventRow a test sees is the app's own mapping, not this file's.
 */
export function makeEvent(spec: EventSpec = {}): EventRow {
  const organizerId = spec.organizerId ?? makeOrganizer().id;
  const id = crypto.randomUUID();
  const name = spec.name ?? 'Test Listing';

  db()
    .prepare(
      `INSERT INTO events (id, organizer_id, slug, status, kind, name, currency, total_capacity, sales_open,
         max_per_order, pay_within_days, event_date,
         bank_account_holder, bank_iban, bank_bic, bank_name, paypal_account)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      organizerId,
      spec.slug ?? uniq('test-listing'),
      spec.status ?? 'published',
      spec.kind ?? 'event',
      name,
      spec.currency ?? 'EUR',
      spec.totalCapacity ?? 100,
      spec.salesOpen === false ? 0 : 1,
      spec.maxPerOrder ?? 8,
      spec.payWithinDays ?? 5,
      spec.eventDate ?? null,
      spec.payout?.bankAccountHolder ?? 'Test Organizer',
      spec.payout?.bankIban ?? 'DE02120300000000202051',
      spec.payout?.bankBic ?? 'BYLADEM1001',
      spec.payout?.bankName ?? 'Test Bank',
      spec.payout?.paypalAccount ?? ''
    );

  for (const [i, tier] of (spec.tiers ?? []).entries()) {
    makeTier(id, tier, i);
  }

  return getEventById(id)!;
}

/**
 * RAW SQL for the same reason as makeEvent: tiers are written inline by
 * PATCH /api/portal/events/[id]. Column list mirrored from there.
 */
export function makeTier(eventId: string, spec: TierSpec = {}, sort = 0): EventTierRow {
  const tierKey = spec.tierKey ?? uniq('tier');
  db()
    .prepare(
      `INSERT INTO event_tiers (id, event_id, tier_key, name, price_cents, cap, unlimited, status,
         student_only, description, details, media_id, sort, seats_per_unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    )
    .run(
      crypto.randomUUID(),
      eventId,
      tierKey,
      spec.name ?? 'Standard',
      spec.priceCents ?? 1000,
      spec.cap ?? 50,
      spec.unlimited ? 1 : 0,
      spec.status ?? 'on-sale',
      spec.studentOnly ? 1 : 0,
      spec.description ?? '',
      spec.details ?? '',
      sort,
      spec.seatsPerUnit ?? 1
    );
  return getEventTier(eventId, tierKey)!;
}

/** Convenience: an event with one ordinary tier, and that tier. */
export function makeEventWithTier(
  spec: EventSpec = {},
  tier: TierSpec = {}
): { event: EventRow; tier: EventTierRow } {
  const event = makeEvent({ ...spec, tiers: [tier] });
  return { event, tier: getEventTiers(event.id)[0] };
}

// ---------------- Orders ----------------

export interface OrderSpec {
  eventId: string;
  items: { tierId: string; quantity: number }[];
  buyerName?: string;
  buyerEmail?: string;
  payerName?: string;
  referredBy?: string;
  /** A promo code or referral voucher; validated and claimed by createOrder. */
  voucherCode?: string;
  paymentMode?: PaymentMethod;
}

/** A pending order, straight through the real createOrder(). */
export function makeOrder(spec: OrderSpec): OrderRow {
  return createOrder({
    eventId: spec.eventId,
    buyerName: spec.buyerName ?? 'Test Buyer',
    buyerEmail: spec.buyerEmail ?? `${uniq('buyer')}@example.test`,
    payerName: spec.payerName,
    referredBy: spec.referredBy,
    voucherCode: spec.voucherCode,
    items: spec.items,
    paymentMode: spec.paymentMode ?? 'transfer',
  });
}

/**
 * The whole happy path a real sale takes: create -> reserve the seats ->
 * settle. Going through all three is the point — an order poked to 'paid' with
 * an UPDATE has no tickets, has consumed no inventory, and would let a broken
 * finalizePaidOrder() pass every test that used it.
 */
export function makePaidOrder(spec: OrderSpec): { order: OrderRow; tickets: TicketRow[] } {
  const created = makeOrder(spec);
  claimInventory(created.id);
  const tickets = finalizePaidOrder(created.id, null);
  return { order: getOrder(created.id)!, tickets };
}

// ---------------- Discount codes ----------------

/** The organizer's own promo code, through the real createPromoCode(). */
export function makePromo(organizerId: string, input: Partial<PromoInput> = {}): PromoRow {
  return createPromoCode(organizerId, {
    code: input.code ?? uniq('PROMO').toUpperCase().replace(/[^A-Z0-9-]/g, ''),
    kind: input.kind ?? 'percent',
    amountCents: input.amountCents ?? 0,
    percent: input.percent ?? 10,
    eventId: input.eventId ?? '',
    maxRedemptions: input.maxRedemptions ?? 0,
    expiresOn: input.expiresOn ?? '',
  });
}
