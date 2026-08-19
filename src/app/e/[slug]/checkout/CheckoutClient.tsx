'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/money';
import type { ApiErrorResponse, CaptureOrderResponse, CreateOrderResponse, EventKind } from '@/lib/types';
import { vocabFor, type Vocab } from '@/lib/vocab';
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
  /** Event or shop — decides every noun on this page. See lib/vocab. */
  kind: EventKind;
  tiers: CheckoutTier[];
}

export interface CheckoutTierAvailability {
  tierId: string;
  cap: number;
  sold: number;
  remaining: number;
  unlimited: boolean;
}

export interface CheckoutAvailability {
  totalCap: number;
  totalSold: number;
  totalRemaining: number;
  unlimited: boolean;
  showRemaining: boolean;
  tiers: Record<string, CheckoutTierAvailability>;
}

interface Props {
  eventId: string;
  config: CheckoutConfig;
  availability: CheckoutAvailability;
  mode: 'paypal' | 'mock' | 'transfer';
  paypalClientId: string | null;
  transferConfigured: boolean;
  /** This organizer also takes PayPal — the address itself is on the order page. */
  paypalOffered: boolean;
  /**
   * How many days after the event the buyer's name and email are erased. Passed
   * down from the server rather than imported, because the one constant that
   * governs it lives with the sweep that does the erasing (lib/retention.ts) —
   * this promise and that behaviour must never be two separate numbers.
   */
  retentionDays: number;
  /**
   * The ticket type the buyer tapped on the event page, already validated by the
   * server as one that is on sale with stock left. Starts at 1 so someone who
   * picked "Standard" does not land on a page of zeroes and have to pick it
   * again — the tap WAS the choice.
   */
  preselectTier?: string | null;
}

/** POST /api/orders body — matches the platform orders API contract. */
interface CreateOrderBody {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  /** '' unless the buyer said the money comes from someone else's account. */
  payerName: string;
  items: { tierId: string; quantity: number }[];
  /** What this page showed as the total — the server 409s if prices moved. */
  expectedTotalCents: number;
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

function friendlyError(e: unknown, v: Vocab): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'SOLD_OUT':
        return `Some of those ${v.units} just sold out. Please lower your quantities and try again.`;
      case 'SALES_CLOSED':
        // The server picks between "sales are closed" and "not on sale yet"
        // from the organizer's own setting. Hardcoding one of them here told a
        // buyer sales had CLOSED on an event whose every other surface said
        // the tickets were still to come.
        return e.message || `${v.Sales} are currently closed.`;
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
  privacy?: boolean;
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
  paypalOffered,
  retentionDays,
  preselectTier = null,
}: Props) {
  const router = useRouter();
  // Identical checkout either way — same stepper, same reservation, same
  // transfer. Only the nouns change: seats and tickets, or items to collect.
  const v = vocabFor(config.kind);
  const isShop = config.kind === 'shop';

  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(config.tiers.map((t) => [t.id, t.id === preselectTier ? 1 : 0]))
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  // Whose name the money will arrive under. Optional, and collapsed behind a
  // link by default: the great majority pay from an account in their own name,
  // and a field everybody has to read past is a worse checkout for all of them
  // than a line of text is for the few who need it.
  const [payerOpen, setPayerOpen] = useState(false);
  const [payerName, setPayerName] = useState('');
  const [studentAck, setStudentAck] = useState(false);
  // Consent is an ACTION, not a notice. Nobody may hand us a name and an email
  // without having ticked this themselves — it starts false, it is never
  // pre-ticked, and no payment button works until it is on.
  const [privacyAck, setPrivacyAck] = useState(false);
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

  /**
   * A zero-total order is an RSVP: the server finalizes it in the same request
   * and the buyer lands on their codes, so no payment UI should ever appear.
   *
   * Two flavours on purpose. An event whose EVERY tier is free shows the RSVP
   * flow before anything is selected — its visitors should never glimpse bank
   * copy at all. A mixed event (free + paid tiers) decides by the current
   * selection, because "which flow" genuinely depends on what is in the cart.
   */
  const allTiersFree = config.tiers.every((t) => t.priceCents === 0);
  const isFreeOrder = allTiersFree || (totalQty > 0 && totalCents === 0);

  const needsStudentAck = config.tiers.some((t) => t.studentOnly && (qty[t.id] ?? 0) > 0);
  const nameOk = name.trim().length >= 2;
  const emailOk = EMAIL_RE.test(email.trim());
  const ackOk = !needsStudentAck || studentAck;
  const formReady = totalQty > 0 && nameOk && emailOk && ackOk && privacyAck;

  /**
   * WHY the pay buttons are off, in the buyer's words. One flat "fill in your
   * details" line was honest while details were the only thing that could be
   * missing; with a consent tick in the mix it sends someone back to re-read
   * fields they already filled, hunting for a mistake that is not there.
   */
  const blockedReason =
    totalQty === 0
      ? `Choose at least one ${v.unit} to continue.`
      : !nameOk || !emailOk
        ? 'Fill in your name and email to continue.'
        : !ackOk
          ? 'Confirm the student ID requirement to continue.'
          : !privacyAck
            ? 'Tick the privacy box above to continue — we cannot take your details without it.'
            : null;

  const working = busy || capturing;

  // Latest state snapshot for PayPal callbacks (they are registered once and
  // would otherwise close over stale state).
  const latestRef = useRef({ qty, name, email, payerName, formReady, totalQty });
  latestRef.current = { qty, name, email, payerName, formReady, totalQty };

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
    setTouched({ name: true, email: true, student: true, privacy: true });
  }

  // ---------------- Mock payment flow ----------------

  async function handleMockPay() {
    markAllTouched();
    if (!formReady || busy) {
      setMessage({
        kind: 'error',
        text: `Please choose at least one ${v.unit} and fill in your details above.`,
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
        payerName: payerName.trim(),
        items: buildItems(qty),
        expectedTotalCents: totalCents,
      };
      const created = await postJson<CreateOrderResponse>('/api/orders', req);
      await postJson<CaptureOrderResponse>(`/api/orders/${created.orderId}/capture`, {});
      router.replace(`/order/${created.orderId}`);
      // Keep the button disabled while the redirect happens.
    } catch (e) {
      setMessage({ kind: 'error', text: friendlyError(e, v) });
      setBusy(false);
    }
  }

  // ---------------- Bank-transfer flow ----------------

  async function handleTransferReserve() {
    markAllTouched();
    if (!formReady || busy) {
      setMessage({
        kind: 'error',
        text: `Please choose at least one ${v.unit} and fill in your details above.`,
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
        payerName: payerName.trim(),
        items: buildItems(qty),
        expectedTotalCents: totalCents,
      };
      const created = await postJson<CreateOrderResponse>('/api/orders', req);
      // The order page shows the bank details, amount, and reference.
      router.replace(`/order/${created.orderId}`);
      // Keep the button disabled while the redirect happens.
    } catch (e) {
      setMessage({ kind: 'error', text: friendlyError(e, v) });
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

  // Render the PayPal buttons once the SDK is ready — and re-render them
  // whenever the free/paid boundary is crossed. The RSVP branch unmounts the
  // container (destroying any buttons in it), so isFreeOrder MUST be a
  // dependency here: without it, a buyer who lands on a preselected free tier
  // and then adds a paid one would face a silently empty payment box, and one
  // who toggled free→paid→free→paid would lose the buttons on the way back.
  // The cleanup below is what makes the re-render possible.
  useEffect(() => {
    if (mode !== 'paypal' || sdkState !== 'ready' || isFreeOrder) return;
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
              text: `Please choose at least one ${v.unit} and fill in your details above.`,
            });
            throw new Error('form incomplete');
          }
          setMessage(null);
          try {
            const req: CreateOrderBody = {
              eventId,
              buyerName: s.name.trim(),
              buyerEmail: s.email.trim(),
              payerName: s.payerName.trim(),
              items: buildItems(s.qty),
              // From the SNAPSHOT's quantities, not the closure's — this
              // callback outlives renders, and the guard must state what the
              // buyer is looking at now.
              expectedTotalCents: config.tiers.reduce(
                (sum, t) => sum + (s.qty[t.id] ?? 0) * t.priceCents,
                0
              ),
            };
            const created = await postJson<CreateOrderResponse>('/api/orders', req);
            localOrderIdRef.current = created.orderId;
            if (!created.paypalOrderId) {
              throw new ApiError(GENERIC_ERROR, undefined, 500);
            }
            return created.paypalOrderId;
          } catch (e) {
            suppressPaypalErrorRef.current = true;
            setMessage({ kind: 'error', text: friendlyError(e, v) });
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
            setMessage({ kind: 'error', text: friendlyError(e, v) });
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
    return () => {
      // The container is about to unmount (or the deps changed): forget that
      // buttons were ever rendered, so the next mount gets fresh ones instead
      // of an empty box guarded by a stale flag.
      buttonsRenderedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sdkState, isFreeOrder]);

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
        <h2 className="card-title">{isShop ? 'Your order' : 'Your tickets'}</h2>
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
                    {/* Sold out is shown FIRST and regardless of the countdown
                        setting. This used to render nothing at all when the
                        organizer hid the count, so an exhausted ticket type
                        looked perfectly buyable — a stepper that silently
                        refused to go above zero. */}
                    {remaining === 0 ? (
                      <span className="badge badge-red">Sold out</span>
                    ) : availability.showRemaining && remaining <= 25 ? (
                      <span className="badge badge-amber">Only {remaining} left</span>
                    ) : null}
                  </div>
                  <div className="muted small">
                    {tier.priceCents === 0 ? 'Free' : `${formatMoney(tier.priceCents, config.currency)} each`}
                    {tier.studentOnly ? ' · student ID required at the entrance' : ''}
                  </div>
                </div>
                <div className="qty-stepper">
                  <button
                    type="button"
                    aria-label={`Remove one ${tier.name}`}
                    onClick={() => changeQty(tier.id, -1)}
                    disabled={working || q === 0}
                  >
                    −
                  </button>
                  <span className="qty-value">{q}</span>
                  <button
                    type="button"
                    aria-label={`Add one ${tier.name}`}
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
          Up to {config.maxTicketsPerOrder} {v.units} per order.
        </p>

        <div className={styles.summaryBlock}>
          {totalQty === 0 ? (
            <p className="muted small">Nothing selected yet.</p>
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
                <span>{totalCents === 0 ? 'Free' : formatMoney(totalCents, config.currency)}</span>
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
            Your QR-code {v.codes} will be emailed to this address.
          </p>
        </div>
        {/* The seller matches your payment by its reference. A bank transfer
            carries that reference for you; PayPal often does not — so when the
            money turns up under a name they have never seen, there is nothing
            left to match it to and somebody has to go hunting. One optional
            line here saves that conversation. Hidden entirely for a free
            order: there is no payment for anyone's name to arrive under. */}
        <div className="field" style={isFreeOrder ? { display: 'none' } : undefined}>
          {payerOpen ? (
            <>
              <label htmlFor="payer-name">Whose name will the payment come from?</label>
              <input
                id="payer-name"
                className="input"
                autoComplete="off"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Name on the account the money is sent from"
                maxLength={120}
                disabled={working}
              />
              <p className={`muted small ${styles.hint}`}>
                Only if it is not <strong>{name.trim() || 'your own name'}</strong> — paying from a
                partner&rsquo;s, a parent&rsquo;s or a shared account is completely fine, the seller
                just needs to know whose name to look for.
              </p>
            </>
          ) : (
            <button
              type="button"
              className="link-button small"
              onClick={() => setPayerOpen(true)}
              disabled={working}
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                cursor: 'pointer',
                color: 'var(--brand-text)',
                fontWeight: 600,
              }}
            >
              Paying from someone else&rsquo;s account? Tell them whose name to look for →
            </button>
          )}
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

        {/* Sits at the foot of the details card on purpose: it is the last thing
            read after typing a name and an email, and it comes BEFORE every
            payment button in all three modes. Only claims that hold in this
            codebase — the money sentence is limited to bank transfer, which is
            the only mode where the account is provably the organizer's own. */}
        <div className={styles.privacyNote}>
          <p style={{ margin: 0 }}>
            <strong>Your name and email go to the {isShop ? 'seller' : 'organizer of this event'}</strong> —
            they are who your {v.code} is issued by, and how you get a new copy if it goes missing.
            {isFreeOrder
              ? ' Nothing is charged and no payment details exist here at all.'
              : mode === 'transfer'
                ? paypalOffered
                  ? ` Your payment goes straight to them — to their own bank account or their own PayPal, so the money never passes through us, and the reference on it is how they match it to your ${v.codes}.`
                  : ` Your payment goes straight to their bank account, so the money never passes through us, and the reference on your transfer is how they match it to your ${v.codes}.`
                : ` The reference on your order is how your payment is matched to your ${v.codes}.`}{' '}
            We never ask for a card number or your bank details here. {retentionDays} days after
            {isShop ? ' you collect' : ' the event'}, your name and email are erased from our system
            for good — {isShop ? 'the seller' : 'the organizer'} keeps their sales count, but not you.
          </p>
          <p style={{ margin: '6px 0 0' }}>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener"
              className="small"
              style={{ color: 'var(--brand-text)', fontWeight: 600 }}
            >
              Read the full privacy note →
            </a>{' '}
            <span className="small">(opens in a new tab, so you keep your selection)</span>
          </p>

          {/* The consent itself. Reading the note is not agreeing to it, so the
              tick lives INSIDE the note rather than below it — you cannot reach
              it without scrolling past what you are agreeing to. */}
          <label className={`checkbox-row ${styles.privacyConsent}`}>
            <input
              type="checkbox"
              checked={privacyAck}
              onChange={(e) => {
                setPrivacyAck(e.target.checked);
                setTouched((t) => ({ ...t, privacy: true }));
              }}
              disabled={working}
            />
            <span>
              <strong>I agree</strong> that my name and email may be passed to the{' '}
              {isShop ? 'seller' : 'organizer'} of this {v.listing} so my {v.codes} can be issued, and
              I have read the privacy note (Datenschutz).
            </span>
          </label>
          {touched.privacy && !privacyAck && (
            <p className={styles.fieldError} style={{ marginTop: 6 }}>
              Please tick the box above to continue — we cannot take your details without it.
            </p>
          )}
        </div>
      </div>

      <div className="card anim-fade-up anim-d3">
        <h2 className="card-title">{isFreeOrder ? 'Reserve your spot' : 'Payment'}</h2>

        {message && (
          <div
            className={`notice ${message.kind === 'error' ? 'notice-error' : 'notice-warn'}`}
            role="alert"
          >
            {message.text}
          </div>
        )}

        {isFreeOrder ? (
          /* The RSVP flow: same endpoint, same redirect, no money. The server
             prices the order from its tiers and finalizes a zero total on the
             spot, so the next page already shows the QR codes. */
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              {allTiersFree
                ? `This ${v.listing} is free — no payment, just a reservation. Your QR ${v.codes} appear on the next page and are emailed to you right away.`
                : `Everything you picked is free — no payment needed. Your QR ${v.codes} appear on the next page and are emailed to you right away.`}
            </p>
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
                `Reserve ${v.units} — free`
              )}
            </button>
            {!formReady && !busy && (
              <p className={`muted small ${styles.hint}`}>
                {blockedReason}
              </p>
            )}
          </>
        ) : mode === 'transfer' ? (
          /* Blocked ONLY when there is genuinely no way to pay. This used to
             test the bank details alone, so an organizer who had set up PayPal
             and left the IBAN half-filled got a checkout that refused every
             buyer — with a message telling those buyers to contact the very
             person whose page it was. PayPal is a complete route on its own. */
          !transferConfigured && !paypalOffered ? (
            <div className="notice notice-error">
              Payment is not set up yet, so orders cannot be placed right now. Please check back
              soon or contact the organizer.
            </div>
          ) : (
            <>
              {/* PayPal first and in green when it is on offer: it clears in
                  seconds while a transfer takes days, so the tickets arrive the
                  same evening rather than midweek. Recommending the faster route
                  is not decoration — it is the difference between a buyer
                  getting their QR code tonight and waiting for a bank. */}
              {paypalOffered && (
                <div className={styles.payPreferred}>
                  <strong>PayPal — fastest</strong>
                  <span>
                    Arrives in seconds, so they can confirm it and send your QR {v.codes}
                    straight away. Recommended.
                  </span>
                </div>
              )}
              <p className="muted small" style={{ marginTop: paypalOffered ? 12 : 0 }}>
                {paypalOffered
                  ? `Pay by PayPal today, or by bank transfer (Überweisung) if you prefer. Reserving takes one click — your ${v.units} are held for you straight away.`
                  : `Pay by regular bank transfer (Überweisung). Reserving takes one click — your ${v.units} are held for you straight away.`}
              </p>
              <ul className={styles.perkList}>
                {paypalOffered && (
                  <li>
                    <strong>PayPal arrives in seconds</strong> — bank transfers take 1–2 business
                    days
                  </li>
                )}
                <li>
                  {paypalOffered
                    ? 'No fees, no account needed — pay with PayPal, or from any bank app'
                    : 'No fees, no account needed — pay from any bank app'}
                </li>
                <li>
                  On the next page you&rsquo;ll get the organizer&rsquo;s{' '}
                  {paypalOffered ? 'bank and PayPal details' : 'bank details'} and your personal
                  payment reference (also sent to you by email)
                </li>
                <li>
                  Your QR-code {v.codes} are emailed as soon as your transfer arrives — usually
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
                  /* Name the routes the buyer actually has — the copy above
                     already promised PayPal when it is offered, and a button
                     that then says only "bank transfer" reads like PayPal was
                     withdrawn at the last moment. */
                  `Reserve ${v.units} — ${
                    paypalOffered && transferConfigured
                      ? 'pay by PayPal or bank transfer'
                      : paypalOffered
                        ? 'pay by PayPal'
                        : 'pay by bank transfer'
                  }`
                )}
              </button>
              {!formReady && !busy && (
                <p className={`muted small ${styles.hint}`}>
                  {blockedReason}
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
                {blockedReason}
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
                {blockedReason}
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
