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
