'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/money';
import type { ApiErrorResponse, CaptureOrderResponse, CreateOrderResponse } from '@/lib/types';
import styles from './checkout.module.css';

declare global {
  interface Window {
    paypal?: any;
  }
}

// Local prop shapes (structurally identical to the server-side event/tier and
// Availability types — redeclared here so this client component never imports
// a server-only module).
export interface CheckoutTier {
  id: string; // tier_key — what the orders API expects as items[].tierId
  name: string;
  priceCents: number;
  studentOnly: boolean;
  description: string;
}

export interface CheckoutConfig {
  eventName: string;
  artist: string;
  dateDisplay: string;
  venue: string;
  currency: string;
  maxTicketsPerOrder: number;
  tiers: CheckoutTier[];
}

export interface CheckoutTierAvailability {
  tierId: string;
  cap: number;
  sold: number;
  remaining: number;
}

export interface CheckoutAvailability {
  totalCap: number;
  totalSold: number;
  totalRemaining: number;
  tiers: Record<string, CheckoutTierAvailability>;
}

interface Props {
  eventId: string;
  config: CheckoutConfig;
  availability: CheckoutAvailability;
  mode: 'paypal' | 'mock' | 'transfer';
  paypalClientId: string | null;
  transferConfigured: boolean;
}

/** POST /api/orders body — matches the platform orders API contract. */
interface CreateOrderBody {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  items: { tierId: string; quantity: number }[];
}

type ApiCode = NonNullable<ApiErrorResponse['code']>;

class ApiError extends Error {
  code: ApiCode | undefined;
  status: number;

  constructor(message: string, code: ApiCode | undefined, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const GENERIC_ERROR = 'Something went wrong. Please try again.';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError(
      'We could not reach the server. Please check your connection and try again.',
      undefined,
      0
    );
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null; // non-JSON response — handled below
  }
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiErrorResponse>;
    const message = typeof err.error === 'string' && err.error ? err.error : GENERIC_ERROR;
    throw new ApiError(message, err.code, res.status);
  }
  if (data === null) {
    throw new ApiError(GENERIC_ERROR, undefined, res.status);
  }
  return data as T;
}

function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'SOLD_OUT':
        return 'Some of those tickets just sold out. Please lower your quantities and try again.';
      case 'SALES_CLOSED':
        return 'Ticket sales are currently closed.';
      case 'PAYMENT_FAILED':
        return 'The payment could not be completed and you have not been charged. Please try again.';
      case 'NOT_FOUND':
        return 'We could not find that order. Please start again.';
      case 'VALIDATION':
        return e.message; // server validation messages are written to be buyer-safe
      default:
        return e.message || GENERIC_ERROR;
    }
  }
  return GENERIC_ERROR;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Touched {
  name?: boolean;
  email?: boolean;
  student?: boolean;
}

interface InlineMessage {
  kind: 'error' | 'warn';
  text: string;
}

export default function CheckoutClient({
  eventId,
  config,
  availability,
  mode,
  paypalClientId,
  transferConfigured,
}: Props) {
  const router = useRouter();

  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(config.tiers.map((t) => [t.id, 0]))
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studentAck, setStudentAck] = useState(false);
  const [touched, setTouched] = useState<Touched>({});
  const [message, setMessage] = useState<InlineMessage | null>(null);
  const [busy, setBusy] = useState(false); // mock payment in flight
  const [capturing, setCapturing] = useState(false); // PayPal capture in flight
  const [sdkState, setSdkState] = useState<'loading' | 'ready' | 'error'>('loading');

  const overallMax = Math.min(config.maxTicketsPerOrder, availability.totalRemaining);
  const tierMax = (tierId: string) =>
    Math.min(availability.tiers[tierId]?.remaining ?? 0, config.maxTicketsPerOrder);

  const totalQty = config.tiers.reduce((sum, t) => sum + (qty[t.id] ?? 0), 0);
  const totalCents = config.tiers.reduce((sum, t) => sum + (qty[t.id] ?? 0) * t.priceCents, 0);

  const needsStudentAck = config.tiers.some((t) => t.studentOnly && (qty[t.id] ?? 0) > 0);
  const nameOk = name.trim().length >= 2;
  const emailOk = EMAIL_RE.test(email.trim());
  const ackOk = !needsStudentAck || studentAck;
  const formReady = totalQty > 0 && nameOk && emailOk && ackOk;

  const working = busy || capturing;

  // Latest state snapshot for PayPal callbacks (they are registered once and
  // would otherwise close over stale state).
  const latestRef = useRef({ qty, name, email, formReady, totalQty });
  latestRef.current = { qty, name, email, formReady, totalQty };

  const localOrderIdRef = useRef<string | null>(null);
  const suppressPaypalErrorRef = useRef(false);
  const buttonsRenderedRef = useRef(false);
  const paypalBoxRef = useRef<HTMLDivElement | null>(null);

  function changeQty(tierId: string, delta: number) {
    setQty((prev) => {
      const current = prev[tierId] ?? 0;
      const othersTotal = config.tiers.reduce(
        (sum, t) => (t.id === tierId ? sum : sum + (prev[t.id] ?? 0)),
        0
      );
      let next = Math.max(0, Math.min(current + delta, tierMax(tierId)));
      next = Math.min(next, Math.max(0, overallMax - othersTotal));
      if (next === current) return prev;
      return { ...prev, [tierId]: next };
    });
    setMessage(null);
  }

  function buildItems(quantities: Record<string, number>): CreateOrderBody['items'] {
    return config.tiers
      .filter((t) => (quantities[t.id] ?? 0) > 0)
      .map((t) => ({ tierId: t.id, quantity: quantities[t.id] ?? 0 }));
  }

  function markAllTouched() {
    setTouched({ name: true, email: true, student: true });
  }

  // ---------------- Mock payment flow ----------------

  async function handleMockPay() {
    markAllTouched();
    if (!formReady || busy) {
      setMessage({
        kind: 'error',
        text: 'Please choose at least one ticket and fill in your details above.',
      });
      return;
    }
    setMessage(null);
    setBusy(true);
    try {
      const req: CreateOrderBody = {
        eventId,
        buyerName: name.trim(),
        buyerEmail: email.trim(),
        items: buildItems(qty),
      };
      const created = await postJson<CreateOrderResponse>('/api/orders', req);
      await postJson<CaptureOrderResponse>(`/api/orders/${created.orderId}/capture`, {});
      router.replace(`/order/${created.orderId}`);
      // Keep the button disabled while the redirect happens.
    } catch (e) {
      setMessage({ kind: 'error', text: friendlyError(e) });
      setBusy(false);
    }
  }

  // ---------------- Bank-transfer flow ----------------

  async function handleTransferReserve() {
    markAllTouched();
    if (!formReady || busy) {
      setMessage({
        kind: 'error',
        text: 'Please choose at least one ticket and fill in your details above.',
      });
      return;
    }
    setMessage(null);
    setBusy(true);
    try {
      const req: CreateOrderBody = {
        eventId,
        buyerName: name.trim(),
        buyerEmail: email.trim(),
        items: buildItems(qty),
      };
      const created = await postJson<CreateOrderResponse>('/api/orders', req);
      // The order page shows the bank details, amount, and reference.
      router.replace(`/order/${created.orderId}`);
      // Keep the button disabled while the redirect happens.
    } catch (e) {
      setMessage({ kind: 'error', text: friendlyError(e) });
      setBusy(false);
    }
  }

  // ---------------- PayPal flow ----------------

  // Load the PayPal JS SDK once.
  useEffect(() => {
    if (mode !== 'paypal' || !paypalClientId) return;
    if (window.paypal) {
      setSdkState('ready');
      return;
    }
    const scriptId = 'paypal-sdk-script';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      const onLoad = () => setSdkState('ready');
      const onError = () => setSdkState('error');
      existing.addEventListener('load', onLoad);
      existing.addEventListener('error', onError);
      if (window.paypal) setSdkState('ready');
      return () => {
        existing.removeEventListener('load', onLoad);
        existing.removeEventListener('error', onError);
      };
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src =
      'https://www.paypal.com/sdk/js?client-id=' +
      encodeURIComponent(paypalClientId) +
      '&currency=' +
      encodeURIComponent(config.currency) +
      '&intent=capture';
    script.async = true;
    script.onload = () => setSdkState('ready');
    script.onerror = () => setSdkState('error');
    document.body.appendChild(script);
  }, [mode, paypalClientId, config.currency]);

  // Render the PayPal buttons once the SDK is ready.
  useEffect(() => {
    if (mode !== 'paypal' || sdkState !== 'ready') return;
    if (buttonsRenderedRef.current || !paypalBoxRef.current) return;
    if (!window.paypal?.Buttons) {
      setSdkState('error');
      return;
    }
    buttonsRenderedRef.current = true;

    window.paypal
      .Buttons({
        createOrder: async () => {
          const s = latestRef.current;
          markAllTouched();
          if (!s.formReady) {
            suppressPaypalErrorRef.current = true;
            setMessage({
              kind: 'error',
              text: 'Please choose at least one ticket and fill in your details above.',
            });
            throw new Error('form incomplete');
          }
          setMessage(null);
          try {
            const req: CreateOrderBody = {
              eventId,
              buyerName: s.name.trim(),
              buyerEmail: s.email.trim(),
              items: buildItems(s.qty),
            };
            const created = await postJson<CreateOrderResponse>('/api/orders', req);
            localOrderIdRef.current = created.orderId;
            if (!created.paypalOrderId) {
              throw new ApiError(GENERIC_ERROR, undefined, 500);
            }
            return created.paypalOrderId;
          } catch (e) {
            suppressPaypalErrorRef.current = true;
            setMessage({ kind: 'error', text: friendlyError(e) });
            throw e;
          }
        },
        onApprove: async (_data: any, actions: any) => {
          const orderId = localOrderIdRef.current;
          if (!orderId) {
            setMessage({ kind: 'error', text: GENERIC_ERROR });
            return;
          }
          setCapturing(true);
          try {
            await postJson<CaptureOrderResponse>(`/api/orders/${orderId}/capture`, {});
            router.replace(`/order/${orderId}`);
          } catch (e) {
            setCapturing(false);
            if (e instanceof ApiError && e.code === 'PAYMENT_FAILED' && e.status === 402) {
              setMessage({
                kind: 'warn',
                text: 'That payment did not go through and you have not been charged. Please try again.',
              });
              return actions.restart();
            }
            setMessage({ kind: 'error', text: friendlyError(e) });
          }
        },
        onCancel: () => {
          setMessage({
            kind: 'warn',
            text: 'Payment cancelled — you have not been charged. You can try again whenever you are ready.',
          });
        },
        onError: () => {
          if (suppressPaypalErrorRef.current) {
            suppressPaypalErrorRef.current = false;
            return;
          }
          setMessage({
            kind: 'error',
            text: 'Something went wrong with the payment. You have not been charged — please try again.',
          });
        },
      })
      .render(paypalBoxRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sdkState]);

  // ---------------- Render ----------------

  const selectedTiers = config.tiers.filter((t) => (qty[t.id] ?? 0) > 0);
  const eventSummary = [config.eventName, config.dateDisplay, config.venue]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="container container-narrow">
      <h1 className="page-title anim-fade-up" style={{ marginBottom: 8 }}>
        Checkout
      </h1>
      <p className="muted anim-fade-up" style={{ margin: '0 0 20px' }}>
        {eventSummary}
      </p>

      <div className="card anim-fade-up anim-d1">
        <h2 className="card-title">Your tickets</h2>
        <div className={styles.qtyList}>
          {config.tiers.map((tier) => {
            const remaining = availability.tiers[tier.id]?.remaining ?? 0;
            const q = qty[tier.id] ?? 0;
            const canAdd = !working && q < tierMax(tier.id) && totalQty < overallMax;
            return (
              <div className="qty-row" key={tier.id}>
                <div>
                  <div className="tier-name">
                    {tier.name}{' '}
                    {remaining === 0 ? (
                      <span className="badge badge-red">Sold out</span>
                    ) : remaining <= 25 ? (
                      <span className="badge badge-amber">Only {remaining} left</span>
                    ) : null}
                  </div>
                  <div className="muted small">
                    {formatMoney(tier.priceCents, config.currency)} each
                    {tier.studentOnly ? ' · student ID required at the entrance' : ''}
                  </div>
                </div>
                <div className="qty-stepper">
                  <button
                    type="button"
                    aria-label={`Remove one ${tier.name} ticket`}
                    onClick={() => changeQty(tier.id, -1)}
                    disabled={working || q === 0}
                  >
                    −
                  </button>
                  <span className="qty-value">{q}</span>
                  <button
                    type="button"
                    aria-label={`Add one ${tier.name} ticket`}
                    onClick={() => changeQty(tier.id, 1)}
                    disabled={!canAdd}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className={`muted small ${styles.hint}`}>
          Up to {config.maxTicketsPerOrder} tickets per order.
        </p>

        <div className={styles.summaryBlock}>
          {totalQty === 0 ? (
            <p className="muted small">No tickets selected yet.</p>
          ) : (
            <>
              {selectedTiers.map((tier) => (
                <div className="summary-row" key={tier.id}>
                  <span>
                    {qty[tier.id]}× {tier.name}
                  </span>
                  <span>{formatMoney((qty[tier.id] ?? 0) * tier.priceCents, config.currency)}</span>
                </div>
              ))}
              <div className="summary-row total">
                <span>Total</span>
                <span>{formatMoney(totalCents, config.currency)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card anim-fade-up anim-d2">
        <h2 className="card-title">Your details</h2>
        <div className="field">
          <label htmlFor="buyer-name">Full name</label>
          <input
            id="buyer-name"
            className="input"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            disabled={working}
          />
          {touched.name && !nameOk && (
            <p className={styles.fieldError}>Please enter your full name.</p>
          )}
        </div>
        <div className="field">
          <label htmlFor="buyer-email">Email address</label>
          <input
            id="buyer-email"
            type="email"
            className="input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            disabled={working}
          />
          {touched.email && !emailOk && (
            <p className={styles.fieldError}>Please enter a valid email address.</p>
          )}
          <p className={`muted small ${styles.hint}`}>
            Your QR-code tickets will be emailed to this address.
          </p>
        </div>
        {needsStudentAck && (
          <>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={studentAck}
                onChange={(e) => {
                  setStudentAck(e.target.checked);
                  setTouched((t) => ({ ...t, student: true }));
                }}
                disabled={working}
              />
              <span>
                I understand each Student ticket requires a valid student ID at the entrance.
              </span>
            </label>
            {touched.student && !ackOk && (
              <p className={styles.fieldError}>
                Please confirm the student ID requirement to continue.
              </p>
            )}
          </>
        )}
      </div>

      <div className="card anim-fade-up anim-d3">
        <h2 className="card-title">Payment</h2>

        {message && (
          <div
            className={`notice ${message.kind === 'error' ? 'notice-error' : 'notice-warn'}`}
            role="alert"
          >
            {message.text}
          </div>
        )}

        {mode === 'transfer' ? (
          !transferConfigured ? (
            <div className="notice notice-error">
              Payment is not set up yet, so orders cannot be placed right now. Please check back
              soon or contact the organizer.
            </div>
          ) : (
            <>
              <p className="muted small" style={{ marginTop: 0 }}>
                Pay by regular bank transfer (Überweisung). Reserving takes one click — your
                seats are held for you straight away.
              </p>
              <ul className={styles.perkList}>
                <li>No fees, no account needed — pay from any bank app</li>
                <li>
                  On the next page you&rsquo;ll get the organizer&rsquo;s bank details and your
                  personal payment reference (also sent to you by email)
                </li>
                <li>
                  Your QR-code tickets are emailed as soon as your transfer arrives — usually
                  within 1–2 business days
                </li>
                <li>
                  You&rsquo;ll have a few days to pay — the exact deadline is shown on the next
                  page, and unpaid reservations are simply released again
                </li>
              </ul>
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                onClick={handleTransferReserve}
                disabled={!formReady || busy}
              >
                {busy ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Reserving…
                  </>
                ) : (
                  'Reserve tickets — pay by bank transfer'
                )}
              </button>
              {!formReady && !busy && (
                <p className={`muted small ${styles.hint}`}>
                  Choose at least one ticket and fill in your details to continue.
                </p>
              )}
            </>
          )
        ) : mode === 'mock' ? (
          <>
            <div className="notice notice-warn">
              TEST MODE — payments are simulated; no real money moves.
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={handleMockPay}
              disabled={!formReady || busy}
            >
              {busy ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Processing…
                </>
              ) : (
                'Complete test payment'
              )}
            </button>
            {!formReady && !busy && (
              <p className={`muted small ${styles.hint}`}>
                Choose at least one ticket and fill in your details to continue.
              </p>
            )}
          </>
        ) : !paypalClientId ? (
          <div className="notice notice-error">
            Payment is not set up yet, so orders cannot be placed right now. Please check back
            soon or contact the organizer.
          </div>
        ) : sdkState === 'error' ? (
          <div className="notice notice-error">
            We could not load the payment form. Please refresh the page and try again.
          </div>
        ) : (
          <>
            {sdkState === 'loading' && (
              <p className={`muted small ${styles.loadingRow}`}>
                <span className="spinner" aria-hidden="true" /> Loading secure payment…
              </p>
            )}
            {capturing && (
              <p className={`muted small ${styles.loadingRow}`}>
                <span className="spinner" aria-hidden="true" /> Finalizing your order…
              </p>
            )}
            <div
              className={!formReady || capturing ? styles.payDisabled : undefined}
              aria-disabled={!formReady || capturing}
            >
              <div ref={paypalBoxRef} className={styles.paypalBox} />
            </div>
            {!formReady && (
              <p className={`muted small ${styles.hint}`}>
                Choose at least one ticket and fill in your details to enable payment.
              </p>
            )}
            <p className={`muted small ${styles.hint}`}>
              Pay securely with PayPal or a debit/credit card. You are only charged once you
              approve the payment.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
