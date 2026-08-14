// Server-only: reconciliation of orders whose payment outcome is unresolved.
//
// Two situations need fixing without hand-editing the database:
//  1. Orders stuck in 'claimed'/'capturing' (crash or network failure while
//     money was moving). We ask PayPal what actually happened: finalize if the
//     buyer was charged, release the seats if PayPal proves no money moved,
//     leave alone if unknown.
//  2. PayPal orders still 'pending' where the buyer approved the payment but
//     their browser died before our capture ran. We capture and recover the
//     sale.
//
// Money-safety rules, in order of precedence:
//  - An order is only finalized when the CAPTURE ITSELF is COMPLETED or
//    PENDING with the exact expected amount — an order-level COMPLETED with a
//    DECLINED or REFUNDED capture must never mint tickets.
//  - Seats are only released when PayPal positively confirms no capture can
//    exist (CREATED / SAVED / VOIDED / PAYER_ACTION_REQUIRED). Anything
//    ambiguous stays in 'capturing' (seat held) for the next pass or a human.
//  - All per-order work is serialized through an in-process lock so an admin
//    run can never race a buyer's retry on the same order.
//
// Runs from the admin dashboard ("Fix stuck orders") and opportunistically
// from the capture route when a buyer retries a stale 'capturing' order.
import {
  cleanupOldPendingOrders,
  finalizePaidOrder,
  getOrder,
  getStalePendingPaypalOrders,
  getStuckOrders,
  type OrderRow,
} from './orders';
import { beginCapture, claimInventory, releaseClaim, SoldOutError } from './inventory';
import { hasPaypalCredentials } from './config';
import {
  capturePaypalOrder,
  extractCaptureDetails,
  getPaypalOrder,
  InstrumentDeclinedError,
  type CaptureDetails,
} from './paypal';
import { sendTicketEmail } from './email';

export interface ReconcileResult {
  finalized: string[]; // confirmed paid at PayPal; tickets minted
  recovered: string[]; // approved-but-uncaptured sales we captured now
  released: string[]; // stuck seats returned to sale
  needsAttention: string[]; // could not determine — left untouched
  cleanedPending: number; // abandoned no-payment pending orders deleted
}

type Bucket = keyof Omit<ReconcileResult, 'cleanedPending'>;

/** PayPal order statuses that prove no capture exists or ever will. */
const NO_MONEY_ORDER_STATUSES = new Set(['CREATED', 'SAVED', 'VOIDED', 'PAYER_ACTION_REQUIRED']);

function amountMatches(order: OrderRow, amountValue: string | null, currencyCode: string | null): boolean {
  return amountValue === (order.totalCents / 100).toFixed(2) && currencyCode === order.currency;
}

/** The capture itself moved (or will settle) the exact expected money. */
function captureLooksPaid(order: OrderRow, c: CaptureDetails): boolean {
  return (
    Boolean(c.captureId) &&
    (c.status === 'COMPLETED' || c.status === 'PENDING') &&
    amountMatches(order, c.amountValue, c.currencyCode)
  );
}

async function emailBestEffort(orderId: string): Promise<void> {
  try {
    await sendTicketEmail(orderId);
  } catch {
    // Email must never break reconciliation.
  }
}

// ---------------- Per-order serialization ----------------

const orderLocks = new Map<string, Promise<void>>();

async function withOrderLock<T>(orderId: string, fn: () => Promise<T>): Promise<T> {
  const prev = orderLocks.get(orderId) ?? Promise.resolve();
  let done!: () => void;
  const current = new Promise<void>((resolve) => (done = resolve));
  const chained = prev.then(() => current);
  orderLocks.set(orderId, chained);
  await prev;
  try {
    return await fn();
  } finally {
    done();
    if (orderLocks.get(orderId) === chained) orderLocks.delete(orderId);
  }
}

// ---------------- Stuck claimed/capturing orders ----------------

/**
 * Resolve a single order stuck in 'claimed'/'capturing' by asking PayPal.
 * Returns the bucket the order landed in.
 */
export function reconcileStuckOrder(order: OrderRow): Promise<Bucket> {
  return withOrderLock(order.id, () => reconcileStuckOrderLocked(order.id));
}

async function reconcileStuckOrderLocked(orderId: string): Promise<Bucket> {
  const fresh = getOrder(orderId);
  if (!fresh || (fresh.status !== 'claimed' && fresh.status !== 'capturing')) {
    return 'needsAttention'; // state changed under us; leave alone
  }

  if (fresh.paymentMode === 'transfer') {
    // Not stuck: a transfer reservation waits days for the buyer's money by
    // design. getStuckOrders() already excludes these; this is defense in
    // depth so no caller can ever release seats a buyer may be paying for.
    return 'needsAttention';
  }

  if (fresh.paymentMode === 'mock' || !fresh.paypalOrderId) {
    // No real money can be involved — safe to release.
    releaseClaim(fresh.id, 'failed');
    return 'released';
  }

  // Own the capture step: for a 'claimed' order another request may be about
  // to start a live capture — the atomic transition decides who acts.
  if (fresh.status === 'claimed' && !beginCapture(fresh.id)) {
    return 'needsAttention';
  }

  let paypalOrder;
  try {
    paypalOrder = await getPaypalOrder(fresh.paypalOrderId);
  } catch (e) {
    console.error(`Reconcile: could not fetch PayPal order for ${fresh.id}:`, e);
    return 'needsAttention'; // PayPal unreachable — do NOT guess
  }

  const capture = extractCaptureDetails(paypalOrder);
  if (paypalOrder.status === 'COMPLETED') {
    if (captureLooksPaid(fresh, capture)) {
      finalizePaidOrder(fresh.id, capture.captureId);
      await emailBestEffort(fresh.id);
      return 'finalized';
    }
    // Order completed but the capture is DECLINED/REFUNDED/missing/mismatched:
    // never mint tickets for money that didn't arrive — human decision.
    console.error(
      `Reconcile: order ${fresh.id} is COMPLETED at PayPal but its capture is not cleanly paid ` +
        `(status=${capture.status} id=${capture.captureId} amount=${capture.amountValue} ${capture.currencyCode}) — leaving for manual review`
    );
    return 'needsAttention';
  }

  if (paypalOrder.status === 'APPROVED') {
    // Buyer approved but no capture committed yet — capture it now. The
    // PayPal-Request-Id makes this idempotent with any earlier attempt.
    try {
      const captureResponse = await capturePaypalOrder(fresh.paypalOrderId);
      const details = extractCaptureDetails(captureResponse);
      if (captureLooksPaid(fresh, details)) {
        finalizePaidOrder(fresh.id, details.captureId);
        await emailBestEffort(fresh.id);
        return 'recovered';
      }
      // A 2xx capture with odd details may still have moved money — hold.
      console.error(`Reconcile: capture of approved order ${fresh.id} returned unexpected details`, details);
      return 'needsAttention';
    } catch (e) {
      if (e instanceof InstrumentDeclinedError) {
        releaseClaim(fresh.id, 'failed');
        return 'released';
      }
      console.error(`Reconcile: capture of approved order ${fresh.id} failed:`, e);
      return 'needsAttention';
    }
  }

  if (NO_MONEY_ORDER_STATUSES.has(paypalOrder.status ?? '')) {
    // PayPal confirms no capture exists or can land — safe to release.
    releaseClaim(fresh.id, 'failed');
    return 'released';
  }

  console.error(`Reconcile: order ${fresh.id} has unrecognized PayPal status ${paypalOrder.status} — leaving alone`);
  return 'needsAttention';
}

// ---------------- Approved-but-abandoned pending orders ----------------

/** Recover a 'pending' PayPal order the buyer approved but never captured. */
function reconcilePendingOrder(order: OrderRow): Promise<Bucket | null> {
  return withOrderLock(order.id, () => reconcilePendingOrderLocked(order.id));
}

async function reconcilePendingOrderLocked(orderId: string): Promise<Bucket | null> {
  const order = getOrder(orderId);
  if (!order || order.status !== 'pending' || !order.paypalOrderId) return null;

  let paypalOrder;
  try {
    paypalOrder = await getPaypalOrder(order.paypalOrderId);
  } catch {
    return null; // can't tell; PayPal-backed pending orders are never deleted
  }

  if (paypalOrder.status !== 'APPROVED' && paypalOrder.status !== 'COMPLETED') {
    return null; // buyer never approved — nothing to recover
  }

  try {
    claimInventory(order.id);
  } catch (e) {
    if (e instanceof SoldOutError) {
      console.error(
        `Reconcile: order ${order.id} was approved/captured at PayPal but the event sold out — needs manual refund`
      );
      return 'needsAttention';
    }
    return null;
  }
  if (!beginCapture(order.id)) return null;

  if (paypalOrder.status === 'COMPLETED') {
    const capture = extractCaptureDetails(paypalOrder);
    if (captureLooksPaid(order, capture)) {
      finalizePaidOrder(order.id, capture.captureId);
      await emailBestEffort(order.id);
      return 'finalized';
    }
    // Completed order, unclean capture: hold the seat for a human.
    console.error(`Reconcile: pending order ${order.id} is COMPLETED at PayPal with an unclean capture — holding`);
    return 'needsAttention';
  }

  try {
    const captureResponse = await capturePaypalOrder(order.paypalOrderId);
    const details = extractCaptureDetails(captureResponse);
    if (captureLooksPaid(order, details)) {
      finalizePaidOrder(order.id, details.captureId);
      await emailBestEffort(order.id);
      return 'recovered';
    }
    // A 2xx capture with unverifiable details may have moved money — hold the
    // seat in 'capturing' for the stuck-order pass / a human.
    console.error(`Reconcile: recovery capture for order ${order.id} returned unexpected details`, details);
    return 'needsAttention';
  } catch (e) {
    if (e instanceof InstrumentDeclinedError) {
      releaseClaim(order.id, 'pending');
      return null;
    }
    // Ambiguous — leave in 'capturing'; the stuck-order pass resolves it.
    console.error(`Reconcile: recovery capture for order ${order.id} failed:`, e);
    return 'needsAttention';
  }
}

// ---------------- Full pass ----------------

/**
 * Full reconciliation pass. Safe to run repeatedly and concurrently; every
 * step is guarded by per-order locks, atomic status transitions, and
 * idempotent finalization.
 */
export async function reconcileOrders(): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    finalized: [],
    recovered: [],
    released: [],
    needsAttention: [],
    cleanedPending: 0,
  };

  // 1. Orders stuck holding seats for >10 minutes.
  for (const order of getStuckOrders(10)) {
    try {
      const bucket = await reconcileStuckOrder(order);
      result[bucket].push(order.id);
    } catch (e) {
      console.error(`Reconcile: unexpected error on stuck order ${order.id}:`, e);
      result.needsAttention.push(order.id);
    }
  }

  // 2. Approved-but-abandoned PayPal sales (>30 minutes old). Only possible
  //    when PayPal credentials are configured.
  if (hasPaypalCredentials()) {
    for (const order of getStalePendingPaypalOrders(30)) {
      try {
        const bucket = await reconcilePendingOrder(order);
        if (bucket) result[bucket].push(order.id);
      } catch (e) {
        console.error(`Reconcile: unexpected error on pending order ${order.id}:`, e);
      }
    }
  }

  // 3. Delete abandoned pending orders older than 24h. Only orders that can
  //    provably involve no money (mock, or no PayPal order ever created) are
  //    deleted — see cleanupOldPendingOrders.
  try {
    result.cleanedPending = cleanupOldPendingOrders(24);
  } catch (e) {
    console.error('Reconcile: pending-order cleanup failed:', e);
  }

  return result;
}
