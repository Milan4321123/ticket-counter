// Server-only: where an event's ticket money actually goes, and the record of
// every time that moved.
//
// Three ideas live here, and they are deliberately separate from the step-up
// check in lib/payoutStepUp.ts. That one asks "is it still you?" at the moment
// of the change. These exist because the honest answer is that any factor can
// in principle be taken, so the rest of the defence must not depend on the
// answer being right:
//
//   1. THE EFFECTIVE ACCOUNT. A change to an event that has ever been able to
//      take money does not apply at once. It is parked, the old account keeps
//      being quoted, and it becomes real a day later.
//   2. WHAT AN ORDER WAS TOLD. An order carries its own frozen copy, so a later
//      change cannot rewrite the instructions a buyer already has.
//   3. THE RECORD. Every move is written down in full, because after an
//      incident somebody has to be able to say what the account used to be.
//
// Together those remove what an attacker actually needs — speed, silence, and
// reach over money already promised — rather than adding a fourth thing for an
// honest organizer to prove.
import crypto from 'crypto';
import { getDb } from './db';

/**
 * How long a payout change waits on an event that has sold.
 *
 * A day: long enough that an organizer asleep, at work, or at the venue still
 * gets a real chance to see the alarm and stop it, and short enough that a
 * legitimate correction is not a week-long ordeal. Organizers change this field
 * once or twice in an event's life, and never urgently — the asymmetry is what
 * makes the delay nearly free to them and expensive to an attacker.
 */
export const PAYOUT_DELAY_MS = 24 * 60 * 60 * 1000;

export interface PayoutAccount {
  holder: string;
  iban: string;
  bic: string;
  bankName: string;
  paypal: string;
}

// ---------------- Is this actually an IBAN? ----------------

/**
 * Expected total length per country. An IBAN's length is fixed by its country,
 * so this catches a whole class of mistake the checksum alone can miss — a
 * digit dropped or doubled often still produces a self-consistent number.
 *
 * SEPA plus the handful of neighbours a German-based organizer realistically
 * banks with. An unlisted country is NOT rejected: the checksum still has to
 * pass, and refusing an IBAN outright because this table has not heard of the
 * country would be a worse failure than accepting a rare valid one.
 */
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
  EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28,
  IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31,
  NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27,
  TR: 26,
};

/** Basic shape: two letters, two check digits, then alphanumerics. */
const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/;

/**
 * A real IBAN check — shape, country length, and the ISO 7064 mod-97 checksum.
 *
 * The shape test alone used to be the whole validation, which meant
 * "DE00 0000 0000 0000 0000 00" saved happily. That is not a pedantic gap: the
 * two check digits exist precisely so a mistyped account number is caught
 * before anybody sends money to it, and without verifying them a transposed
 * pair of digits is stored, printed on the order page, emailed to every buyer,
 * and only discovered when the transfers start bouncing — or worse, when they
 * do not, because the wrong-but-valid account belongs to somebody real.
 *
 * Empty is accepted here; whether a payout account is REQUIRED is a separate
 * question the publish checklist asks.
 */
export function isValidIban(raw: string): boolean {
  const compact = (raw || '').replace(/\s+/g, '').toUpperCase();
  if (compact === '') return true;
  if (!IBAN_SHAPE.test(compact)) return false;

  const expected = IBAN_LENGTHS[compact.slice(0, 2)];
  if (expected !== undefined && compact.length !== expected) return false;

  // Move the first four characters to the end, turn letters into numbers
  // (A=10 … Z=35), and the whole thing read as one integer must be 1 mod 97.
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const part = code >= 65 ? String(code - 55) : ch; // 'A'.charCodeAt(0) === 65
    for (const digit of part) {
      remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
    }
  }
  return remainder === 1;
}

// ---------------- Does the account belong to who we approved? ----------------

/** Lowercase, unaccented, punctuation-free words. */
function nameTokens(value: string): string[] {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // combining accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Does the payout account holder plausibly name the organizer we approved?
 *
 * The strongest control available at this scale, and the one real platforms
 * lean on hardest: the platform owner approves a named person or company, and
 * the account the money goes to has to answer to that same name. An attacker
 * who redirects the IBAN to a mule account has to put a stranger's name on it,
 * and that is visible.
 *
 * Deliberately GENEROUS, because the honest variations are endless — "M.
 * Adhikari", "Adhikari Milan", "Milan Adhikari Events UG" are all the same
 * party, and an organizer blocked at midnight by a strict string compare will
 * simply be an organizer who cannot get paid. A match needs either one name to
 * contain the other, or half the shorter name's words to appear in the longer
 * one including at least one real word. Everything else is reported, never
 * refused — see the owner's copy of the payout-change alarm.
 */
export function payoutNameMatchesOrganizer(organizerName: string, accountHolder: string): boolean {
  const a = nameTokens(organizerName);
  const b = nameTokens(accountHolder);
  if (a.length === 0 || b.length === 0) return true; // nothing to compare against

  const joinedA = a.join(' ');
  const joinedB = b.join(' ');
  if (joinedA === joinedB || joinedA.includes(joinedB) || joinedB.includes(joinedA)) return true;

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const longerSet = new Set(longer);
  const shared = shorter.filter((t) => longerSet.has(t));
  // An initial matching an initial ("m" vs "m") is not evidence of anything, so
  // at least one shared word has to be long enough to actually be a name.
  return shared.length * 2 >= shorter.length && shared.some((t) => t.length >= 3);
}

/** The columns this module reads. EventRow satisfies it structurally. */
export interface EventPayoutColumns {
  bankAccountHolder: string;
  bankIban: string;
  bankBic: string;
  bankName: string;
  paypalAccount: string;
  pendingBankAccountHolder: string | null;
  pendingBankIban: string | null;
  pendingBankBic: string | null;
  pendingBankName: string | null;
  pendingPaypalAccount: string | null;
  pendingPayoutEffectiveAt: number | null;
  payoutLocked: number;
}

/** What the event's own columns say today. */
export function livePayout(event: EventPayoutColumns): PayoutAccount {
  return {
    holder: event.bankAccountHolder,
    iban: event.bankIban,
    bic: event.bankBic,
    bankName: event.bankName,
    paypal: event.paypalAccount,
  };
}

export interface PendingPayout extends PayoutAccount {
  /** Unix ms at which this becomes the account buyers are given. */
  effectiveAt: number;
}

/** The parked change, whether or not its time has come. Null when none. */
export function parkedPayout(event: EventPayoutColumns): PendingPayout | null {
  const at = event.pendingPayoutEffectiveAt;
  if (!at) return null;
  return {
    holder: event.pendingBankAccountHolder ?? '',
    iban: event.pendingBankIban ?? '',
    bic: event.pendingBankBic ?? '',
    bankName: event.pendingBankName ?? '',
    paypal: event.pendingPaypalAccount ?? '',
    effectiveAt: at,
  };
}

/**
 * THE ONE ANSWER to "where does money go right now".
 *
 * Everything that quotes an account to a buyer must come through here. Note
 * that maturity is decided by comparing times, NOT by a job having run: the
 * parked account simply becomes the effective one the moment its time passes.
 * Correctness therefore never depends on a cron, a deploy, or anybody
 * remembering to call settleDuePayout() — that function only tidies the rows
 * afterwards, and skipping it changes nothing a buyer would see.
 */
export function effectivePayout(event: EventPayoutColumns): PayoutAccount {
  const parked = parkedPayout(event);
  if (parked && parked.effectiveAt <= Date.now()) {
    const { effectiveAt: _ignored, ...account } = parked;
    return account;
  }
  return livePayout(event);
}

/** A change that is queued but has NOT taken effect yet — what to warn about. */
export function queuedPayoutChange(event: EventPayoutColumns): PendingPayout | null {
  const parked = parkedPayout(event);
  return parked && parked.effectiveAt > Date.now() ? parked : null;
}

/**
 * True when a change to this event's payout account has to wait.
 *
 * Reads the monotonic flag rather than the status: an event that is unpublished
 * is still an event that has taken money, and letting status decide would have
 * made "unpublish, change, republish" a way around the whole mechanism.
 */
export function payoutChangeIsDelayed(event: EventPayoutColumns): boolean {
  return event.payoutLocked === 1;
}

/** Mark an event as having been able to take money. Never reversed. */
export function lockPayoutChanges(eventId: string): void {
  getDb().prepare(`UPDATE events SET payout_locked = 1 WHERE id = ?`).run(eventId);
}

/** Park a change; `effectiveAt` is when buyers start being given it. */
export function queuePayoutChange(eventId: string, next: PayoutAccount, effectiveAt: number): void {
  getDb()
    .prepare(
      `UPDATE events SET
         pending_bank_account_holder = ?, pending_bank_iban = ?, pending_bank_bic = ?,
         pending_bank_name = ?, pending_paypal_account = ?, pending_payout_effective_at = ?
       WHERE id = ?`
    )
    .run(next.holder, next.iban, next.bic, next.bankName, next.paypal, effectiveAt, eventId);
}

/** Throw away a parked change — the "no, that was not me" button. */
export function cancelQueuedPayoutChange(eventId: string): void {
  getDb()
    .prepare(
      `UPDATE events SET
         pending_bank_account_holder = NULL, pending_bank_iban = NULL, pending_bank_bic = NULL,
         pending_bank_name = NULL, pending_paypal_account = NULL, pending_payout_effective_at = NULL
       WHERE id = ?`
    )
    .run(eventId);
}

/**
 * Fold a matured parked change into the live columns.
 *
 * Housekeeping only — effectivePayout() already treats a matured change as the
 * answer, so this changes nothing anyone can observe. It exists so the row
 * eventually says plainly what is true, instead of every future reader having
 * to work it out from two places.
 */
export function settleDuePayout(eventId: string): void {
  getDb()
    .prepare(
      `UPDATE events SET
         bank_account_holder = COALESCE(pending_bank_account_holder, bank_account_holder),
         bank_iban           = COALESCE(pending_bank_iban, bank_iban),
         bank_bic            = COALESCE(pending_bank_bic, bank_bic),
         bank_name           = COALESCE(pending_bank_name, bank_name),
         paypal_account      = COALESCE(pending_paypal_account, paypal_account),
         pending_bank_account_holder = NULL, pending_bank_iban = NULL, pending_bank_bic = NULL,
         pending_bank_name = NULL, pending_paypal_account = NULL, pending_payout_effective_at = NULL
       WHERE id = ? AND pending_payout_effective_at IS NOT NULL AND pending_payout_effective_at <= ?`
    )
    .run(eventId, Date.now());
}

/** IBANs compared the way a bank would: spaces and case do not count. */
function sameIban(a: string, b: string): boolean {
  return (a || '').replace(/\s+/g, '').toUpperCase() === (b || '').replace(/\s+/g, '').toUpperCase();
}

/**
 * True when a queued change leaves the money going exactly where it goes now —
 * same IBAN, same PayPal — and only corrects how the account is described
 * (holder spelling, BIC, bank name).
 *
 * That is the only kind of change the platform owner may approve early. The day
 * of waiting exists to stop money being redirected; a typo fix in the holder
 * name redirects nothing, and with Verification of Payee every buyer's bank now
 * warns "name does not match" until it is fixed. Anything that touches where
 * the money lands still waits the full day, owner or not.
 */
export function queuedChangeKeepsDestination(event: EventPayoutColumns): boolean {
  const queued = queuedPayoutChange(event);
  if (!queued) return false;
  const live = livePayout(event);
  return sameIban(queued.iban, live.iban) && queued.paypal.trim() === live.paypal.trim();
}

/**
 * The owner applies a queued description-only change now instead of tomorrow.
 *
 * Also corrects the holder/BIC/bank name on this event's still-unpaid orders
 * that point at the same IBAN, so buyers who already have instructions pay a
 * name their bank will accept. Paid and cancelled orders keep what they were
 * told. Recorded in payout_changes as the owner's act.
 */
export function applyQueuedPayoutNow(eventId: string, event: EventPayoutColumns, organizerId: string): number {
  const queued = queuedPayoutChange(event);
  if (!queued || !queuedChangeKeepsDestination(event)) {
    throw new Error('Only a queued change that keeps the same IBAN and PayPal can be applied early.');
  }
  const db = getDb();
  const now = Date.now();
  let ordersUpdated = 0;
  db.transaction(() => {
    db.prepare(`UPDATE events SET pending_payout_effective_at = ? WHERE id = ?`).run(now, eventId);
    settleDuePayout(eventId);
    const orders = db
      .prepare(`SELECT id, payout_iban AS iban FROM orders WHERE event_id = ? AND status IN ('pending', 'claimed')`)
      .all(eventId) as { id: string; iban: string }[];
    const fix = db.prepare(
      `UPDATE orders SET payout_holder = ?, payout_bic = ?, payout_bank_name = ? WHERE id = ?`
    );
    for (const o of orders) {
      if (o.iban && sameIban(o.iban, queued.iban)) {
        fix.run(queued.holder, queued.bic, queued.bankName, o.id);
        ordersUpdated++;
      }
    }
    recordPayoutChange({
      eventId,
      organizerId,
      field: 'appliedEarly',
      oldValue: new Date(queued.effectiveAt).toISOString(),
      newValue: new Date(now).toISOString(),
      factor: 'none',
      actor: 'owner',
      effectiveAt: null,
    });
  })();
  return ordersUpdated;
}

// ---------------- What an order was told ----------------

/** The payout columns frozen onto an order at the moment it was created. */
export interface OrderPayoutColumns {
  payoutHolder: string;
  payoutIban: string;
  payoutBic: string;
  payoutBankName: string;
  payoutPaypal: string;
}

/**
 * The account THIS order was told to pay, which is the only one it may ever be
 * shown.
 *
 * Falls back to the event exclusively for orders written before the snapshot
 * columns existed: those genuinely have no record of what they were told, and
 * the event's current details are the best available guess. A snapshot that
 * names any destination at all is used as-is — including a holder with no IBAN,
 * because that is still what the buyer saw.
 */
export function orderPayout(order: OrderPayoutColumns, event: EventPayoutColumns | null): PayoutAccount {
  const snapshot: PayoutAccount = {
    holder: order.payoutHolder,
    iban: order.payoutIban,
    bic: order.payoutBic,
    bankName: order.payoutBankName,
    paypal: order.payoutPaypal,
  };
  const hasSnapshot = Boolean(
    snapshot.holder.trim() || snapshot.iban.trim() || snapshot.paypal.trim()
  );
  if (hasSnapshot) return snapshot;
  return event ? effectivePayout(event) : snapshot;
}

// ---------------- The record ----------------

export type PayoutFactor = 'authenticator' | 'password' | 'none';

export interface PayoutChangeRow {
  id: string;
  eventId: string;
  organizerId: string;
  field: string;
  oldValue: string;
  newValue: string;
  factor: string;
  actor: string;
  effectiveAt: number | null;
  cancelledAt: string | null;
  createdAt: string;
}

/**
 * Write one field's move to the append-only record.
 *
 * Values are stored IN FULL. This table is the forensic answer to "what was the
 * account before, and when did it move" — a masked copy would be useless for
 * the only job it has. It is never read by anything buyer-facing.
 */
export function recordPayoutChange(entry: {
  eventId: string;
  organizerId: string;
  field: string;
  oldValue: string;
  newValue: string;
  factor: PayoutFactor;
  actor?: string;
  effectiveAt?: number | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO payout_changes (id, event_id, organizer_id, field, old_value, new_value, factor, actor, effective_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      crypto.randomUUID(),
      entry.eventId,
      entry.organizerId,
      entry.field,
      entry.oldValue,
      entry.newValue,
      entry.factor,
      entry.actor ?? 'organizer',
      entry.effectiveAt ?? null
    );
}

/** Stamp the queued entries for an event as cancelled (newest first wins). */
export function markPayoutChangesCancelled(eventId: string): void {
  getDb()
    .prepare(
      `UPDATE payout_changes SET cancelled_at = datetime('now')
        WHERE event_id = ? AND cancelled_at IS NULL AND effective_at IS NOT NULL AND effective_at > ?`
    )
    .run(eventId, Date.now());
}

/** Newest first. Admin-facing only. */
export function listPayoutChanges(eventId: string, limit = 50): PayoutChangeRow[] {
  return getDb()
    .prepare(
      `SELECT id, event_id AS eventId, organizer_id AS organizerId, field,
              old_value AS oldValue, new_value AS newValue, factor, actor,
              effective_at AS effectiveAt, cancelled_at AS cancelledAt, created_at AS createdAt
         FROM payout_changes WHERE event_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(eventId, limit) as PayoutChangeRow[];
}
