// Server-only: the seller's OWN instant-payment accounts, and which ways to
// pay each listing offers its buyers.
//
// Two ideas, kept together because one is meaningless without the other:
//
//   1. A CONNECTION is a seller's own PayPal REST app (client id + secret) or
//      their own Stripe API key, stored encrypted (lib/secretBox), one per
//      provider per seller. Every API call the platform makes with it creates
//      a charge ON THE SELLER'S ACCOUNT: the buyer's money lands with the
//      seller and nowhere else. This is the whole reason the design is
//      "bring your own account" rather than a platform PayPal or Stripe
//      Connect: the platform may not receive or hold buyers' money
//      (PLATFORM.md), and with the seller's credentials it structurally
//      cannot.
//
//   2. The listing's OFFER — pay_transfer / pay_paypal / pay_stripe on the
//      event row — says which of the routes the seller wants buyers to see on
//      THIS listing. A tick without a working connection behind it offers
//      nothing; paymentOptionsFor() is the single reader that combines the
//      two, and every place that decides what a buyer may do reads it.
//
// The checkout page, the orders API, the publish checklist and the portal
// editor all ask this module. None of them read the columns directly.
import crypto from 'crypto';
import { getDb } from './db';
import type { EventRow } from './events';
import { paypalPayee } from './events';
import { effectivePayout } from './payout';
import type { PaypalCredentials } from './paypal';
import type { StripeCredentials } from './stripe';
import { openSecret, sealSecret } from './secretBox';
import { getPaymentMode } from './config';

export type InstantProvider = 'paypal' | 'stripe';

export function isInstantProvider(value: unknown): value is InstantProvider {
  return value === 'paypal' || value === 'stripe';
}

/** A connection as the portal may see it — NEVER carries the secret. */
export interface PaymentConnection {
  id: string;
  organizerId: string;
  provider: InstantProvider;
  /** PayPal client id; '' for Stripe (its key is the only credential). */
  publicId: string;
  /** What the provider said the account is: a PayPal app's environment, a Stripe business name. */
  accountLabel: string;
  /** PayPal sandbox app or Stripe test key — no real money moves. */
  sandbox: boolean;
  createdAt: string;
  updatedAt: string;
}

const CONN_COLS = `
  id,
  organizer_id AS organizerId,
  provider,
  public_id AS publicId,
  account_label AS accountLabel,
  sandbox,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

function rowToConnection(row: Record<string, unknown> | undefined): PaymentConnection | null {
  if (!row) return null;
  return {
    id: String(row.id),
    organizerId: String(row.organizerId),
    provider: row.provider as InstantProvider,
    publicId: String(row.publicId ?? ''),
    accountLabel: String(row.accountLabel ?? ''),
    sandbox: Boolean(row.sandbox),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export function listConnections(organizerId: string): PaymentConnection[] {
  const rows = getDb()
    .prepare(`SELECT ${CONN_COLS} FROM organizer_payment_connections WHERE organizer_id = ? ORDER BY provider`)
    .all(organizerId) as Record<string, unknown>[];
  return rows.map((r) => rowToConnection(r)!);
}

export function getConnection(organizerId: string, provider: InstantProvider): PaymentConnection | null {
  return rowToConnection(
    getDb()
      .prepare(`SELECT ${CONN_COLS} FROM organizer_payment_connections WHERE organizer_id = ? AND provider = ?`)
      .get(organizerId, provider) as Record<string, unknown> | undefined
  );
}

export function getConnectionById(id: string): PaymentConnection | null {
  return rowToConnection(
    getDb().prepare(`SELECT ${CONN_COLS} FROM organizer_payment_connections WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined
  );
}

/**
 * Store (or replace) a seller's connection. The caller has ALREADY verified
 * the credentials against the provider (lib/paypal verifyPaypalCredentials /
 * lib/stripe verifyStripeKey) — this function only keeps them.
 *
 * Replacing gets a NEW id on purpose: an order captured later looks its
 * connection up by id, so an order started under the old app can never be
 * settled against the new one by accident (it fails loudly instead).
 */
export function upsertConnection(input: {
  organizerId: string;
  provider: InstantProvider;
  publicId: string;
  secret: string;
  accountLabel: string;
  sandbox: boolean;
}): PaymentConnection {
  const id = crypto.randomUUID();
  const db = getDb();
  db.transaction(() => {
    db.prepare(`DELETE FROM organizer_payment_connections WHERE organizer_id = ? AND provider = ?`).run(
      input.organizerId,
      input.provider
    );
    db.prepare(
      `INSERT INTO organizer_payment_connections (id, organizer_id, provider, public_id, secret_enc, account_label, sandbox)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.organizerId,
      input.provider,
      input.publicId,
      sealSecret(input.secret),
      input.accountLabel.slice(0, 200),
      input.sandbox ? 1 : 0
    );
  })();
  return getConnectionById(id)!;
}

export function removeConnection(organizerId: string, provider: InstantProvider): boolean {
  return (
    getDb()
      .prepare(`DELETE FROM organizer_payment_connections WHERE organizer_id = ? AND provider = ?`)
      .run(organizerId, provider).changes > 0
  );
}

function secretOf(connectionId: string): string | null {
  const row = getDb()
    .prepare(`SELECT secret_enc AS secretEnc FROM organizer_payment_connections WHERE id = ?`)
    .get(connectionId) as { secretEnc: string } | undefined;
  return row ? openSecret(row.secretEnc) : null;
}

/**
 * The live credentials behind a connection, or null when the stored secret
 * can no longer be opened (APP_SECRET rotated) — in which case the connection
 * is dead and the seller has to paste the credentials in again.
 */
export function paypalCredentialsFor(conn: PaymentConnection): PaypalCredentials | null {
  if (conn.provider !== 'paypal') return null;
  const secret = secretOf(conn.id);
  if (!secret) return null;
  return { clientId: conn.publicId, clientSecret: secret, sandbox: conn.sandbox };
}

export function stripeCredentialsFor(conn: PaymentConnection): StripeCredentials | null {
  if (conn.provider !== 'stripe') return null;
  const secret = secretOf(conn.id);
  if (!secret) return null;
  return { secretKey: secret };
}

// ---------------- What a buyer of THIS listing may do ----------------

export interface PaymentOptions {
  /**
   * Bank transfer / PayPal.Me: reserve now, the seller confirms by hand. On
   * only when the listing offers it AND a bank account or PayPal.Me route is
   * actually set — a tick with nothing behind it is not a route.
   */
  transfer: boolean;
  /** The transfer route includes a PayPal.Me link/address beside the IBAN. */
  paypalMe: boolean;
  /** A bank account (holder + IBAN) is part of the transfer route. */
  bank: boolean;
  /** PayPal Checkout through the seller's own app, or null. */
  paypal: { connectionId: string; clientId: string; sandbox: boolean } | null;
  /** Card payment through the seller's own Stripe account, or null. */
  stripe: { connectionId: string; sandbox: boolean } | null;
  /** Dev-only simulated payment (PAYMENT_MODE=mock). Never on in production. */
  mock: boolean;
}

/** The single answer to "how can somebody pay for this listing right now?". */
export function paymentOptionsFor(event: EventRow): PaymentOptions {
  const payout = effectivePayout(event);
  const bank = Boolean(payout.iban.trim() && payout.holder.trim());
  const paypalMe = paypalPayee({ paypalAccount: payout.paypal }) !== null;
  const transfer = event.payTransfer && (bank || paypalMe);

  let paypal: PaymentOptions['paypal'] = null;
  if (event.payPaypal) {
    const conn = getConnection(event.organizerId, 'paypal');
    if (conn) paypal = { connectionId: conn.id, clientId: conn.publicId, sandbox: conn.sandbox };
  }
  let stripe: PaymentOptions['stripe'] = null;
  if (event.payStripe) {
    const conn = getConnection(event.organizerId, 'stripe');
    if (conn) stripe = { connectionId: conn.id, sandbox: conn.sandbox };
  }

  return { transfer, paypalMe: transfer && paypalMe, bank: transfer && bank, paypal, stripe, mock: getPaymentMode() === 'mock' };
}

/** True when a paid order can be placed on this listing at all. */
export function anyPaymentRoute(options: PaymentOptions): boolean {
  return options.transfer || options.paypal !== null || options.stripe !== null || options.mock;
}

/**
 * Which route a checkout asked for, or the one sensible default when it did
 * not say: the instant routes first (they are why a seller switched them on),
 * transfer last. Null when nothing at all is offered.
 */
export type InstantOrTransfer = 'transfer' | 'paypal' | 'stripe' | 'mock';

export function resolvePaymentRoute(options: PaymentOptions, requested: unknown): InstantOrTransfer | null {
  if (requested === 'paypal' && options.paypal) return 'paypal';
  if (requested === 'stripe' && options.stripe) return 'stripe';
  if (requested === 'transfer' && options.transfer) return 'transfer';
  if (requested === 'mock' && options.mock) return 'mock';
  if (typeof requested === 'string' && requested !== '') return null; // asked for something not offered
  if (options.transfer) return 'transfer';
  if (options.paypal) return 'paypal';
  if (options.stripe) return 'stripe';
  if (options.mock) return 'mock';
  return null;
}
