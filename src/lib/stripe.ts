// Server-only: minimal Stripe REST client (plain fetch, form-encoded, no SDK).
// Never import from 'use client' components.
//
// Every call is made with the SELLER'S OWN secret key (lib/paymentConnections),
// so the charge is created on the seller's Stripe account and the money is
// theirs from the first second — the platform is only the software that asks
// Stripe to open a Checkout page. No platform key exists and none is needed.
//
// Stripe Checkout (hosted page) rather than Elements: it needs no publishable
// key on our page, no card fields under our branding, and it is the one
// integration a seller can switch on with a single restricted key.

const API = 'https://api.stripe.com';

export interface StripeCredentials {
  secretKey: string;
}

export class StripeError extends Error {
  status: number;
  code: string | null;
  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'StripeError';
    this.status = status;
    this.code = code;
  }
}

/** Flatten a nested object into Stripe's bracketed form encoding. */
function encodeForm(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object') encodeForm(item as Record<string, unknown>, `${name}[${i}]`, out);
        else out.append(`${name}[${i}]`, String(item));
      });
    } else if (typeof v === 'object') {
      encodeForm(v as Record<string, unknown>, name, out);
    } else {
      out.append(name, String(v));
    }
  }
  return out;
}

async function stripeFetch<T>(
  creds: StripeCredentials,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.secretKey}`,
    'Stripe-Version': '2024-06-20',
  };
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? encodeForm(body).toString() : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    // handled below
  }
  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string } } | null)?.error;
    // Full bodies stay server-side; the message is Stripe's own developer text.
    console.error(`Stripe ${method} ${path} failed (HTTP ${res.status}):`, text.slice(0, 2000));
    throw new StripeError(err?.message ?? `Stripe request failed (HTTP ${res.status})`, res.status, err?.code ?? null);
  }
  if (data === null) {
    console.error(`Stripe ${method} ${path} returned non-JSON body:`, text.slice(0, 500));
    throw new StripeError('Stripe returned an unexpected response', res.status);
  }
  return data as T;
}

// ---------------- Verify a key (connection setup) ----------------

export interface StripeAccountInfo {
  id: string;
  /** Business or account display name, '' when Stripe has none. */
  label: string;
  /** True for an sk_test_/rk_test_ key — no real money can move. */
  test: boolean;
  chargesEnabled: boolean;
}

/**
 * Prove the key works and belongs to a real account, and say which one. Used
 * once, when the seller pastes it in — a key that cannot answer this is not
 * stored.
 */
export async function verifyStripeKey(creds: StripeCredentials): Promise<StripeAccountInfo> {
  const acct = await stripeFetch<{
    id?: string;
    business_profile?: { name?: string | null } | null;
    settings?: { dashboard?: { display_name?: string | null } | null } | null;
    email?: string | null;
    charges_enabled?: boolean;
  }>(creds, 'GET', '/v1/account');
  if (!acct.id) throw new StripeError('Stripe did not return an account', 502);
  return {
    id: acct.id,
    label:
      acct.business_profile?.name?.trim() ||
      acct.settings?.dashboard?.display_name?.trim() ||
      acct.email?.trim() ||
      acct.id,
    test: /^(sk|rk)_test_/.test(creds.secretKey),
    chargesEnabled: Boolean(acct.charges_enabled),
  };
}

// ---------------- Checkout Sessions ----------------

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
  status: 'open' | 'complete' | 'expired' | string;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required' | string;
  amount_total: number | null;
  currency: string | null;
  payment_intent: string | null;
  client_reference_id: string | null;
  expires_at?: number;
}

/** How long a Checkout page stays payable. Stripe's floor is 30 minutes. */
export const STRIPE_SESSION_TTL_S = 30 * 60;

/**
 * Open a hosted Checkout page for one local order. The line item names the
 * listing and the seller so the buyer's card statement and receipt say who
 * they paid — the seller, never the platform.
 */
export async function createStripeCheckoutSession(
  creds: StripeCredentials,
  params: {
    orderId: string;
    totalCents: number;
    currency: string;
    itemName: string;
    itemDescription: string;
    buyerEmail: string;
    successUrl: string;
    cancelUrl: string;
    paymentReference: string;
  }
): Promise<StripeCheckoutSession> {
  const session = await stripeFetch<StripeCheckoutSession>(
    creds,
    'POST',
    '/v1/checkout/sessions',
    {
      mode: 'payment',
      client_reference_id: params.orderId,
      customer_email: params.buyerEmail,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + STRIPE_SESSION_TTL_S,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: params.currency.toLowerCase(),
            unit_amount: params.totalCents,
            product_data: {
              name: params.itemName.slice(0, 250),
              description: params.itemDescription.slice(0, 500) || undefined,
            },
          },
        },
      ],
      payment_intent_data: {
        description: `${params.paymentReference} — ${params.itemName}`.slice(0, 1000),
        metadata: { order_id: params.orderId, reference: params.paymentReference },
      },
      metadata: { order_id: params.orderId, reference: params.paymentReference },
    },
    // One session per local order, however often the request is retried.
    `checkout-${params.orderId}`
  );
  if (!session.id) throw new StripeError('Stripe returned no session id', 502);
  return session;
}

export async function getStripeCheckoutSession(creds: StripeCredentials, sessionId: string): Promise<StripeCheckoutSession> {
  return stripeFetch<StripeCheckoutSession>(creds, 'GET', `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

/**
 * Ask Stripe to close an open session so the buyer cannot pay against an order
 * that has been cancelled locally. Best effort: an already-complete or expired
 * session throws, and callers ignore that.
 */
export async function expireStripeCheckoutSession(creds: StripeCredentials, sessionId: string): Promise<void> {
  await stripeFetch(creds, 'POST', `/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, {});
}

/** The session says the exact expected money has been paid. */
export function stripeSessionLooksPaid(session: StripeCheckoutSession, totalCents: number, currency: string): boolean {
  return (
    session.payment_status === 'paid' &&
    session.amount_total === totalCents &&
    (session.currency ?? '').toLowerCase() === currency.toLowerCase()
  );
}
