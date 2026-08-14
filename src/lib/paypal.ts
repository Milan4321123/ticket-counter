// Server-only: minimal PayPal REST client (plain fetch, no SDK).
// Never import from 'use client' components.

function apiBase(): string {
  return process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/**
 * Thrown when PayPal rejects a capture with INSTRUMENT_DECLINED (the buyer's
 * funding source was declined). The route should tell the buyer to retry with
 * a different payment method — the local order can stay retryable.
 */
export class InstrumentDeclinedError extends Error {
  constructor() {
    super('PayPal declined the payment instrument');
    this.name = 'InstrumentDeclinedError';
  }
}

// ---------------- OAuth token (cached per process) ----------------

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now) return tokenCache.token;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are missing (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)');
  }

  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`PayPal OAuth failed (HTTP ${res.status}):`, text);
    if (text.includes('invalid_client')) {
      const idHint = clientId.startsWith('A')
        ? 'Check that PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET come from the SAME app and the SAME environment (Sandbox vs Live) on developer.paypal.com -> Apps & Credentials.'
        : `PAYPAL_CLIENT_ID starts with "${clientId.slice(0, 4)}…" but REST Client IDs start with "A". Copy the "Client ID" field from developer.paypal.com -> Apps & Credentials (Sandbox tab) -> your app.`;
      console.error(`PayPal rejected the API credentials. ${idHint}`);
    }
    throw new Error(`PayPal authentication failed (HTTP ${res.status})`);
  }

  let data: { access_token?: string; expires_in?: number };
  try {
    data = JSON.parse(text);
  } catch {
    console.error('PayPal OAuth returned non-JSON body:', text);
    throw new Error('PayPal authentication returned an unexpected response');
  }
  if (!data.access_token) {
    console.error('PayPal OAuth response had no access_token:', text);
    throw new Error('PayPal authentication returned no token');
  }

  const ttlSeconds = typeof data.expires_in === 'number' ? data.expires_in : 300;
  // Refresh 60s before the token actually expires.
  tokenCache = { token: data.access_token, expiresAt: now + Math.max(ttlSeconds - 60, 30) * 1000 };
  return data.access_token;
}

// ---------------- Create order ----------------

export async function createPaypalOrder(params: {
  totalCents: number;
  currency: string;
  referenceId: string;
  description: string;
}): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Idempotency: a retried create with the same key returns the original
      // order instead of creating a duplicate.
      'PayPal-Request-Id': `create-${params.referenceId}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.referenceId,
          description: params.description,
          amount: {
            currency_code: params.currency,
            value: (params.totalCents / 100).toFixed(2),
          },
        },
      ],
    }),
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`PayPal create order failed (HTTP ${res.status}):`, text);
    throw new Error(`PayPal create order failed (HTTP ${res.status})`);
  }

  let data: { id?: string };
  try {
    data = JSON.parse(text);
  } catch {
    console.error('PayPal create order returned non-JSON body:', text);
    throw new Error('PayPal create order returned an unexpected response');
  }
  if (!data.id) {
    console.error('PayPal create order response had no id:', text);
    throw new Error('PayPal create order returned no order id');
  }
  return data.id;
}

// ---------------- Capture order ----------------

export interface PaypalCaptureResponse {
  id?: string;
  status?: string;
  purchase_units?: {
    reference_id?: string;
    payments?: {
      captures?: {
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }[];
    };
  }[];
}

/**
 * Capture an approved PayPal order. Throws InstrumentDeclinedError when the
 * buyer's payment method was declined (retryable), or a generic Error for
 * anything else. Full PayPal bodies are logged server-side only.
 */
export async function capturePaypalOrder(paypalOrderId: string): Promise<PaypalCaptureResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Idempotency: a duplicate/retried capture with the same key returns the
      // original capture result instead of ORDER_ALREADY_CAPTURED.
      'PayPal-Request-Id': `capture-${paypalOrderId}`,
    },
    body: '{}',
    cache: 'no-store',
  });
  const text = await res.text();

  if (!res.ok) {
    console.error(`PayPal capture failed for ${paypalOrderId} (HTTP ${res.status}):`, text);
    if (res.status === 422) {
      try {
        const body = JSON.parse(text) as { details?: { issue?: string }[] };
        if (body.details?.[0]?.issue === 'INSTRUMENT_DECLINED') {
          throw new InstrumentDeclinedError();
        }
      } catch (e) {
        if (e instanceof InstrumentDeclinedError) throw e;
        // fall through: non-JSON 422 body, treat as generic failure
      }
    }
    throw new Error(`PayPal capture failed (HTTP ${res.status})`);
  }

  try {
    return JSON.parse(text) as PaypalCaptureResponse;
  } catch {
    console.error(`PayPal capture for ${paypalOrderId} returned non-JSON body:`, text);
    throw new Error('PayPal capture returned an unexpected response');
  }
}

// ---------------- Get order (reconciliation) ----------------

/**
 * Fetch the current state of a PayPal order. Used to reconcile ambiguous
 * outcomes: after a capture error we ask PayPal what actually happened before
 * deciding whether the buyer was charged. The response has the same shape as
 * a capture response; `status` at the top level is the ORDER status
 * (CREATED | SAVED | APPROVED | VOIDED | COMPLETED | PAYER_ACTION_REQUIRED).
 */
export async function getPaypalOrder(paypalOrderId: string): Promise<PaypalCaptureResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`PayPal get order failed for ${paypalOrderId} (HTTP ${res.status}):`, text);
    throw new Error(`PayPal get order failed (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text) as PaypalCaptureResponse;
  } catch {
    console.error(`PayPal get order for ${paypalOrderId} returned non-JSON body:`, text);
    throw new Error('PayPal get order returned an unexpected response');
  }
}

// ---------------- Capture response helper ----------------

export interface CaptureDetails {
  status: string | null; // capture status, e.g. 'COMPLETED'
  captureId: string | null;
  amountValue: string | null; // e.g. "25.00"
  currencyCode: string | null; // e.g. "USD"
}

/** Pull the interesting fields out of purchase_units[0].payments.captures[0]. */
export function extractCaptureDetails(response: PaypalCaptureResponse): CaptureDetails {
  const capture = response.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    status: capture?.status ?? response.status ?? null,
    captureId: capture?.id ?? null,
    amountValue: capture?.amount?.value ?? null,
    currencyCode: capture?.amount?.currency_code ?? null,
  };
}
