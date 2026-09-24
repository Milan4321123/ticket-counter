// Server-only: settling a Stripe order against Stripe, and the sweep that
// does it for buyers who never came back.
//
// A Stripe order is paid OUT OF OUR SIGHT, on Stripe's hosted page. We learn
// the outcome only by asking: when the buyer returns (the success URL), when
// they press "check again" on the order page, or — for the buyer who paid and
// then closed the tab — from the sweep below. There is deliberately NO
// webhook: a webhook would need a signing secret per seller, set up inside
// each seller's own Stripe dashboard, which is exactly the step most sellers
// would get wrong. Asking Stripe directly with the seller's key answers the
// same question with nothing to configure.
//
// Money rules, same as the PayPal side (lib/reconcile):
//   - finalize ONLY when the session says paid, for the exact amount and
//     currency this order expects;
//   - release seats ONLY when Stripe says the session has expired (nobody can
//     pay it any more);
//   - anything else keeps the seats and waits for the next look.
import { beginCapture, endCapture, releaseClaim } from './inventory';
import { finalizePaidOrder, getOpenStripeOrders, getOrder } from './orders';
import { getConnectionById, stripeCredentialsFor } from './paymentConnections';
import { getStripeCheckoutSession, stripeSessionLooksPaid } from './stripe';
import { awardReferralVouchers } from './referrals';
import { sendTicketEmail } from './email';

export type StripeSettleOutcome =
  | 'paid' // finalized (now or earlier): codes exist
  | 'unpaid' // session still open, buyer has not paid yet
  | 'expired' // Stripe closed the session unpaid; seats released
  | 'unclear' // could not ask, or the answer did not add up; seats kept
  | 'not-stripe'; // not a live Stripe order at all

// Per-order serialization, same shape as lib/reconcile: a sweep and a
// buyer's "check again" on the same order run one after the other.
const locks = new Map<string, Promise<void>>();

async function withLock<T>(orderId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(orderId) ?? Promise.resolve();
  let done!: () => void;
  const current = new Promise<void>((resolve) => (done = resolve));
  const chained = prev.then(() => current);
  locks.set(orderId, chained);
  await prev;
  try {
    return await fn();
  } finally {
    done();
    if (locks.get(orderId) === chained) locks.delete(orderId);
  }
}

/** Ask Stripe what happened to this order and act on it. Safe to call repeatedly. */
export function settleStripeOrder(orderId: string): Promise<StripeSettleOutcome> {
  return withLock(orderId, () => settleLocked(orderId));
}

async function settleLocked(orderId: string): Promise<StripeSettleOutcome> {
  const order = getOrder(orderId);
  if (!order || order.paymentMode !== 'stripe') return 'not-stripe';
  if (order.status === 'paid') return 'paid';
  if (order.status !== 'claimed' && order.status !== 'capturing') return 'expired';

  if (!order.stripeSessionId) {
    // Created, never sent to Stripe (the session call failed and the order
    // was not cleaned up) — nothing can have been paid.
    releaseClaim(order.id, 'failed');
    return 'expired';
  }

  const conn = order.paymentConnectionId ? getConnectionById(order.paymentConnectionId) : null;
  const creds = conn ? stripeCredentialsFor(conn) : null;
  if (!creds) {
    // The seller removed or replaced their key since this order began. We
    // cannot ask Stripe, and the buyer may have paid — hold for a human.
    console.error(`Stripe order ${order.id}: connection ${order.paymentConnectionId} is gone; holding`);
    return 'unclear';
  }

  // Own the settle step: a sweep and a buyer's "check again" must not both act.
  if (order.status === 'claimed' && !beginCapture(order.id)) return 'unclear';

  let session;
  try {
    session = await getStripeCheckoutSession(creds, order.stripeSessionId);
  } catch (e) {
    console.error(`Stripe order ${order.id}: could not fetch session:`, e);
    endCapture(order.id);
    return 'unclear';
  }

  if (session.payment_status === 'paid') {
    if (stripeSessionLooksPaid(session, order.totalCents, order.currency)) {
      finalizePaidOrder(order.id, session.payment_intent ?? session.id);
      awardReferralVouchers(order.id);
      try {
        const emailResult = await sendTicketEmail(order.id);
        console.log(`Ticket email for Stripe order ${order.id}:`, emailResult);
      } catch (e) {
        console.error(`Ticket email for Stripe order ${order.id} threw unexpectedly:`, e);
      }
      return 'paid';
    }
    // Paid, but not what this order expects — never mint for money that does
    // not match; keep the seats and say so loudly.
    console.error(
      `Stripe order ${order.id}: session paid ${session.amount_total} ${session.currency} but order expects ` +
        `${order.totalCents} ${order.currency}; holding for manual review`
    );
    return 'unclear';
  }

  if (session.status === 'expired') {
    releaseClaim(order.id, 'cancelled');
    return 'expired';
  }

  // Still open: the buyer may be typing their card number right now.
  endCapture(order.id);
  return 'unpaid';
}

// ---------------- The sweep ----------------

/** Sessions younger than this are almost certainly still on the buyer's screen. */
const SWEEP_MIN_AGE_MIN = 2;
const SWEEP_INTERVAL_MS = 5 * 60_000;
const SWEEP_THROTTLE_MS = 60_000;

declare global {
  // eslint-disable-next-line no-var
  var __stripeSweepInterval: ReturnType<typeof setInterval> | undefined;
}

let lastSweepAt = 0;
let sweeping = false;

/**
 * Settle every open Stripe order older than a couple of minutes. Cheap when
 * there is nothing to do (one indexed SELECT), and throttled so a burst of
 * page views does not turn into a burst of Stripe calls.
 */
export async function sweepStripeOrders(force = false): Promise<{ paid: number; expired: number; unclear: number }> {
  const result = { paid: 0, expired: 0, unclear: 0 };
  const now = Date.now();
  if (sweeping || (!force && now - lastSweepAt < SWEEP_THROTTLE_MS)) return result;
  sweeping = true;
  lastSweepAt = now;
  try {
    for (const order of getOpenStripeOrders(SWEEP_MIN_AGE_MIN)) {
      try {
        const outcome = await settleStripeOrder(order.id);
        if (outcome === 'paid') result.paid++;
        else if (outcome === 'expired') result.expired++;
        else if (outcome === 'unclear') result.unclear++;
      } catch (e) {
        console.error(`Stripe sweep: order ${order.id} threw:`, e);
        result.unclear++;
      }
    }
  } finally {
    sweeping = false;
  }
  return result;
}

/**
 * Arm the recurring sweep once per server process. Called whenever a Stripe
 * order is created or looked at — the same lazy pattern lib/reminders uses,
 * because an instrumentation hook would drag SQLite into the Edge bundle.
 */
export function armStripeSweep(): void {
  if (global.__stripeSweepInterval) return;
  global.__stripeSweepInterval = setInterval(() => {
    sweepStripeOrders().catch((e) => console.error('Stripe sweep failed:', e));
  }, SWEEP_INTERVAL_MS);
  if (typeof global.__stripeSweepInterval.unref === 'function') global.__stripeSweepInterval.unref();
}
