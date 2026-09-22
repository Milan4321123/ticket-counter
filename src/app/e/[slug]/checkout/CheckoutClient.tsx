'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { discountCentsFor, formatMoney } from '@/lib/money';
import type {
  ApiErrorResponse,
  CaptureOrderResponse,
  CreateOrderResponse,
  EventKind,
  ReferralCheckResponse,
  VoucherCheckResponse,
} from '@/lib/types';
import { vocabFor, type Vocab } from '@/lib/vocab';
import OtherCityNotice, { type OtherShow } from '@/components/OtherCityNotice';
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
  /**
   * Seats one booking covers — a "Table of 8" is one booking, eight seats,
   * eight QR tickets. The stepper counts BOOKINGS; everything compared against
   * the room's remaining is weighted by this.
   */
  seatsPerUnit: number;
}

export interface CheckoutConfig {
  eventName: string;
  artist: string;
  dateDisplay: string;
  venue: string;
  /**
   * The city on its own, without the postcode — the word a buyer is checking
   * this page against. Separate from `venue` because the venue line is an
   * address, and an address is read, not scanned.
   */
  city: string;
  /** "Sat 10 Oct", built from the machine date only. '' when there is none. */
  whenLabel: string;
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
   * The organizer's display name, for the OPTIONAL "keep me posted" box — the
   * consent is per-organizer, so the box has to say whose announcements it is
   * about. '' when the account has no usable name; the copy falls back to
   * "this organizer".
   */
  organizerName: string;
  /**
   * The referral code from the ?ref= the buyer arrived with (already
   * shape-checked by the server page), or null. Included in the create-order
   * POST as-is — the orders API decides whether it counts.
   */
  refCode: string | null;
  /**
   * The ticket type the buyer tapped on the event page, already validated by the
   * server as one that is on sale with stock left. Starts at 1 so someone who
   * picked "Standard" does not land on a page of zeroes and have to pick it
   * again — the tap WAS the choice.
   */
  preselectTier?: string | null;
  /**
   * Other published shows by the same act, in other cities. Almost always
   * empty; when it is not, this page is the last place the mistake can still
   * be caught for free. See lib/sameAct.ts.
   */
  otherCities: OtherShow[];
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
  /** True ONLY when the buyer ticked the optional "keep me posted" box. */
  marketingOptIn: boolean;
  /**
   * The referral code crediting whoever sent this buyer — the one they arrived
   * with in ?ref=, or the one they typed in by hand. '' when there is none.
   * Takes nothing off this order; it credits the person who shared it.
   */
  ref: string;
  /** A discount code the buyer applied, '' when they did not. */
  voucherCode: string;
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

/**
 * A discount code the server has confirmed for THIS seller: the seller's own
 * discount on the seller's own price, whether it is a thank-you voucher their
 * referral rewards issued or a code they minted and handed out themselves.
 * Held in state only so the summary can show what it takes off before the
 * buyer commits — the order route re-checks and claims it, so nothing here
 * decides anything about money.
 */
interface AppliedCode {
  code: string;
  /** Which kind it turned out to be — for the wording, never the arithmetic. */
  source: 'voucher' | 'promo';
  kind: 'fixed' | 'percent';
  amountCents: number;
  percent: number;
  /** Who is giving it — the copy has to name them, never "us". */
  sellerName: string;
}

/**
 * A referral code the server has confirmed names somebody who can be credited.
 *
 * A COMPLETELY DIFFERENT THING from the discount code above, and the checkout
 * keeps the two apart on purpose: this one credits the person who sent the
 * buyer here and takes nothing off the buyer's own price.
 */
interface CheckedReferral {
  code: string;
  sellerName: string;
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
  organizerName,
  refCode,
  preselectTier = null,
  otherCities,
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
  // The SEPARATE, optional "keep me posted" consent. Also never pre-ticked —
  // and unlike the privacy tick above it gates nothing: checkout works exactly
  // the same whether this is on or off.
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [touched, setTouched] = useState<Touched>({});
  const [message, setMessage] = useState<InlineMessage | null>(null);
  const [busy, setBusy] = useState(false); // mock payment in flight
  const [capturing, setCapturing] = useState(false); // PayPal capture in flight
  const [sdkState, setSdkState] = useState<'loading' | 'ready' | 'error'>('loading');

  const tierMax = (tierId: string) =>
    Math.min(availability.tiers[tierId]?.remaining ?? 0, config.maxTicketsPerOrder);

  // The stepper counts BOOKINGS; the room counts SEATS. A bundled tier (a
  // "Table of 8") is one booking against maxTicketsPerOrder but eight seats
  // against the room, so the two ceilings are tracked separately.
  const totalQty = config.tiers.reduce((sum, t) => sum + (qty[t.id] ?? 0), 0);
  const totalSeats = config.tiers.reduce((sum, t) => sum + (qty[t.id] ?? 0) * t.seatsPerUnit, 0);
  const hasBundle = config.tiers.some((t) => t.seatsPerUnit > 1 && (qty[t.id] ?? 0) > 0);
  const totalCents = config.tiers.reduce((sum, t) => sum + (qty[t.id] ?? 0) * t.priceCents, 0);

  /**
   * A discount code, if the buyer applied one — a thank-you voucher they
   * earned or one of the seller's own codes; they do not have to know which,
   * so there is ONE box for both. Collapsed behind a link exactly like the
   * payer-name field above: most buyers hold no code at all, and a box
   * everyone has to read past is a worse checkout for all of them.
   *
   * Applying it asks the server, so the discount and the new total are on
   * screen BEFORE anything is committed — and so a code that does not work
   * says so here, out loud, instead of quietly costing the buyer full price.
   * The server checks it again while it writes the order; this is a preview.
   */
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [applied, setApplied] = useState<AppliedCode | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  /** Said out loud when a second code replaced the first — see applyCode. */
  const [codeNotice, setCodeNotice] = useState<string | null>(null);

  /**
   * The referral code crediting whoever sent this buyer here.
   *
   * Pre-filled when they arrived through somebody's share link (?ref=), and
   * editable, because in real life a code travels by word of mouth, a
   * screenshot or a WhatsApp message and has to be typeable. Checked against
   * the server so a mistyped one is refused while it can still be fixed —
   * the refusal is deliberately harmless, because a code that matches nobody
   * costs this buyer nothing at all.
   */
  const [referralOpen, setReferralOpen] = useState(Boolean(refCode));
  const [referralInput, setReferralInput] = useState(refCode ?? '');
  const [referral, setReferral] = useState<CheckedReferral | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  /** The last value asked about, so blurring an unchanged box asks nothing. */
  const referralCheckedRef = useRef('');

  /**
   * A discount code only applies to a basket that COSTS something. On a mixed
   * listing the buyer can apply one and then select nothing but free tiers —
   * and sending it anyway would spend a whole reward for 0.00 off (on an order
   * that finalizes as paid the same second and can never hand it back), or
   * burn one of a limited code's redemptions for nothing. So it stays applied
   * on screen (they can see it and remove it), but it is not counted here and
   * not sent with the order; the server refuses the same case in the same
   * words if anything sends it regardless.
   */
  const codeApplies = Boolean(applied) && totalCents > 0;
  // The SAME function the server discounts with: never more than the basket is
  // worth, and a percentage rounded in the buyer's favour. One implementation,
  // so this page can never promise a number the order then contradicts.
  const discountCents = codeApplies ? discountCentsFor(applied!, totalCents) : 0;
  const payableCents = Math.max(0, totalCents - discountCents);
  /** What actually goes to the server with this order — '' when it does not apply. */
  const sentCode = codeApplies ? applied!.code : '';
  /** The referral code that goes with the order; the server validates it again. */
  const sentRefCode = referralInput.trim().toUpperCase();

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
  // A code that covers the whole basket lands here too: there is nothing
  // left to pay, so the order finalizes as an RSVP rather than asking anybody
  // to transfer 0.00 — the server reaches the same conclusion the same way.
  const isFreeOrder = allTiersFree || (totalQty > 0 && payableCents === 0);

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
  const latestRef = useRef({ qty, name, email, payerName, marketingOptIn, formReady, totalQty, applied, sentRefCode });
  latestRef.current = { qty, name, email, payerName, marketingOptIn, formReady, totalQty, applied, sentRefCode };

  const localOrderIdRef = useRef<string | null>(null);
  const suppressPaypalErrorRef = useRef(false);
  const buttonsRenderedRef = useRef(false);
  const paypalBoxRef = useRef<HTMLDivElement | null>(null);

  function changeQty(tierId: string, delta: number) {
    setQty((prev) => {
      const current = prev[tierId] ?? 0;
      const spu = config.tiers.find((t) => t.id === tierId)?.seatsPerUnit ?? 1;
      const othersTotal = config.tiers.reduce(
        (sum, t) => (t.id === tierId ? sum : sum + (prev[t.id] ?? 0)),
        0
      );
      const othersSeats = config.tiers.reduce(
        (sum, t) => (t.id === tierId ? sum : sum + (prev[t.id] ?? 0) * t.seatsPerUnit),
        0
      );
      let next = Math.max(0, Math.min(current + delta, tierMax(tierId)));
      // Bookings against the per-order limit, SEATS against the room: a table
      // must not be addable when only part of it would still fit.
      next = Math.min(next, Math.max(0, config.maxTicketsPerOrder - othersTotal));
      next = Math.min(next, Math.floor(Math.max(0, availability.totalRemaining - othersSeats) / spu));
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

  // ---------------- Discount code (voucher or the seller's own) ----------------

  async function applyCode() {
    const typed = codeInput.trim();
    if (codeBusy || working) return;
    if (!typed) {
      setCodeError('Please type the code first.');
      return;
    }
    setCodeBusy(true);
    setCodeError(null);
    setCodeNotice(null);
    try {
      const checked = await postJson<VoucherCheckResponse>('/api/orders/voucher', {
        eventId,
        code: typed,
      });
      // ONE CODE PER ORDER. The new one takes the place of the old one rather
      // than being added to it, and the swap is said out loud: a buyer who
      // typed a second code and saw the first quietly vanish would reasonably
      // believe both were counted, and only find out at the total.
      const previous = applied;
      if (previous && previous.code !== checked.code) {
        setCodeNotice(
          `${checked.code} replaced ${previous.code} — only one code counts per order. ` +
            `${previous.source === 'voucher' ? 'Your voucher has not been used and is still yours.' : ''}`.trim()
        );
      }
      setApplied({
        code: checked.code,
        source: checked.source,
        kind: checked.kind,
        amountCents: checked.amountCents,
        percent: checked.percent,
        sellerName: checked.sellerName,
      });
      setCodeInput(checked.code);
    } catch (e) {
      // Never a silent ignore: a code that did not apply has to say so here,
      // while the buyer can still decide what to do about it. The code that
      // was already applied stays applied — a typo must not cost somebody the
      // discount they had a moment ago.
      setCodeError(e instanceof ApiError ? e.message : GENERIC_ERROR);
    } finally {
      setCodeBusy(false);
    }
  }

  function removeCode() {
    setApplied(null);
    setCodeError(null);
    setCodeNotice(null);
    setCodeInput('');
  }

  // ---------------- Referral code (credits somebody else) ----------------

  /**
   * Ask whether this code names somebody who can be credited.
   *
   * Nothing about the order depends on the answer — the code is sent either
   * way and the server has the last word — so this exists purely so a typo is
   * refused while the buyer can still fix it, in wording that makes clear
   * nothing of theirs is at stake.
   */
  async function checkReferral(raw: string, { unprompted = false }: { unprompted?: boolean } = {}) {
    const typed = raw.trim().toUpperCase();
    if (referralBusy) return;
    referralCheckedRef.current = typed;
    if (!typed) {
      setReferral(null);
      setReferralError(null);
      return;
    }
    setReferralBusy(true);
    setReferralError(null);
    try {
      const checked = await postJson<ReferralCheckResponse>('/api/orders/referral', {
        eventId,
        code: typed,
      });
      setReferral({ code: checked.code, sellerName: checked.sellerName });
    } catch (e) {
      setReferral(null);
      // A check NOBODY ASKED FOR may only ever report the one thing the buyer
      // could act on: that this particular code credits nobody (a 400, the
      // deliberately harmless NOT_CREDITABLE wording). "Too many code
      // attempts", a server error or a dropped connection are about the site,
      // not about them — and thirteen buyers behind one office address in a
      // minute would otherwise leave the thirteenth staring at a rate-limit
      // refusal in a box they never touched. So those are swallowed, and the
      // box is left as if it had not been asked yet: referralCheckedRef is
      // rolled back so blurring the same value later really does re-ask.
      const actionable = e instanceof ApiError && e.status === 400;
      if (unprompted && !actionable) {
        referralCheckedRef.current = '';
      } else {
        setReferralError(e instanceof ApiError ? e.message : GENERIC_ERROR);
      }
    } finally {
      setReferralBusy(false);
    }
  }

  // A code the buyer ARRIVED with is checked once, unprompted: they did not
  // type it, so the first thing they should learn about it is that it works
  // (or harmlessly does not), not nothing at all. It costs one request per
  // checkout view carrying ?ref=, which is why the failure half above refuses
  // to spend the buyer's attention on anything they did not cause.
  useEffect(() => {
    if (refCode) void checkReferral(refCode, { unprompted: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refCode]);

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
        marketingOptIn,
        ref: sentRefCode,
        voucherCode: sentCode,
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
        marketingOptIn,
        ref: sentRefCode,
        voucherCode: sentCode,
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
            // From the SNAPSHOT's quantities, not the closure's — this callback
            // outlives renders, and the guard must state what the buyer is
            // looking at now.
            const snapshotTotalCents = config.tiers.reduce(
              (sum, t) => sum + (s.qty[t.id] ?? 0) * t.priceCents,
              0
            );
            const req: CreateOrderBody = {
              eventId,
              buyerName: s.name.trim(),
              buyerEmail: s.email.trim(),
              payerName: s.payerName.trim(),
              items: buildItems(s.qty),
              expectedTotalCents: snapshotTotalCents,
              marketingOptIn: s.marketingOptIn,
              ref: s.sentRefCode,
              // Same rule as the rest of the page, read off the snapshot: a
              // code is never spent on a basket that costs nothing.
              voucherCode: snapshotTotalCents > 0 ? (s.applied?.code ?? '') : '',
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
        onCancel: async () => {
          // The local order was written before PayPal ever opened, and if a
          // code was applied it is claimed on that order. Nothing else in the
          // system will ever touch it — so say so here, and wait for the
          // answer before inviting a retry: the next attempt writes a NEW
          // order, and it can only re-apply the code once this one has let go
          // of it. The server refuses to release anything PayPal says may
          // still take money, so this is safe to call unconditionally.
          const orderId = localOrderIdRef.current;
          localOrderIdRef.current = null;
          if (orderId) {
            try {
              await postJson<{ ok: true }>(`/api/orders/${orderId}/abandon`, {});
            } catch {
              // Best effort: reconciliation releases it later. Never turn a
              // cancelled payment into an error the buyer has to read.
            }
          }
          setMessage({
            kind: 'warn',
            text: latestRef.current.applied
              ? 'Payment cancelled — you have not been charged, and your code has not been used. You can try again whenever you are ready.'
              : 'Payment cancelled — you have not been charged. You can try again whenever you are ready.',
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
  /**
   * Where and when, as the buyer will have to remember it.
   *
   * This used to be one grey line — "Name · Saturday, 10 October 2026 · Venue,
   * 69126 Heidelberg" — set in the same muted type as every other caption on
   * the page. That is fine until one act is booked into two countries inside
   * ten days with the same poster on both listings, which is exactly what
   * happened: the only thing separating a ticket you can use from one you
   * cannot was a word in the middle of a grey sentence.
   */
  const placeLine = [config.city, config.whenLabel].filter(Boolean).join(' · ');

  return (
    <div className="container container-narrow">
      <h1 className="page-title anim-fade-up" style={{ marginBottom: 8 }}>
        Checkout
      </h1>
      <div className="checkout-for anim-fade-up">
        <div className="checkout-for-name">{config.eventName}</div>
        {placeLine ? <div className="checkout-for-place">{placeLine}</div> : null}
        <div className="muted small">
          {[config.dateDisplay, config.venue].filter(Boolean).join(' · ')}
        </div>
      </div>
      <OtherCityNotice city={config.city} shows={otherCities} variant="checkout" />

      <div className="card anim-fade-up anim-d1">
        <h2 className="card-title">{isShop ? 'Your order' : 'Your tickets'}</h2>
        <div className={styles.qtyList}>
          {config.tiers.map((tier) => {
            const remaining = availability.tiers[tier.id]?.remaining ?? 0;
            const q = qty[tier.id] ?? 0;
            const canAdd =
              !working &&
              q < tierMax(tier.id) &&
              totalQty < config.maxTicketsPerOrder &&
              // One more booking of THIS tier has to fit in the room whole.
              totalSeats + tier.seatsPerUnit <= availability.totalRemaining;
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
                  {/* A bundled booking has to say what one of it IS before
                      anyone steps the counter: the stepper counts bookings,
                      and "1" of a table is eight people. */}
                  {tier.seatsPerUnit > 1 && (
                    <div className="muted small">
                      Includes {tier.seatsPerUnit} {isShop ? v.units : 'seats'} — you get{' '}
                      {tier.seatsPerUnit} QR {v.codes} per booking.
                    </div>
                  )}
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
          {/* The limit counts BOOKINGS. Saying "tickets" is right until a
              bundled tier exists — then one booking is several tickets and the
              honest word changes. */}
          Up to {config.maxTicketsPerOrder}{' '}
          {config.tiers.some((t) => t.seatsPerUnit > 1) ? 'bookings' : v.units} per order.
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
              {/* The discount and the new total, shown BEFORE the buyer
                  commits — nobody should discover what a code was worth after
                  they have already agreed to pay. */}
              {discountCents > 0 && (
                <div className="summary-row">
                  <span>
                    {applied?.source === 'promo' ? 'Code' : 'Voucher'}{' '}
                    <span className="mono small">{applied?.code}</span>
                    {applied?.kind === 'percent' ? ` (${applied.percent}%)` : ''}
                  </span>
                  <span>−{formatMoney(discountCents, config.currency)}</span>
                </div>
              )}
              <div className="summary-row total">
                <span>Total</span>
                <span>{payableCents === 0 ? 'Free' : formatMoney(payableCents, config.currency)}</span>
              </div>
              {discountCents > 0 && (
                <p className="muted small" style={{ margin: '8px 0 0' }}>
                  {applied?.sellerName || 'The seller'} is taking{' '}
                  {formatMoney(discountCents, config.currency)} off their own price — you simply pay
                  them less.
                  {applied && applied.kind === 'fixed' && applied.amountCents > discountCents
                    ? ' This order is worth less than the code, and the difference is not carried over.'
                    : ''}
                </p>
              )}
              {/* Only when a bundle is in the cart — for ordinary tickets the
                  quantities above already ARE the ticket count, and repeating
                  it would read as a second, mysterious number. */}
              {hasBundle && (
                <p className="muted small" style={{ margin: '8px 0 0' }}>
                  You will receive {totalSeats} QR {totalSeats === 1 ? v.code : v.codes} in total.
                </p>
              )}
            </>
          )}

          {/* "Have a discount code?" — collapsed behind a link like the payer
              name above, and hidden entirely when nothing here costs money.
              Most buyers hold no code; those who do go looking for it. ONE
              box for both kinds: a buyer holds a code, not a taxonomy. */}
          {!allTiersFree && (
            <div style={{ marginTop: 12 }}>
              {codeError && (
                <p className={styles.fieldError} role="alert">
                  {codeError}
                </p>
              )}
              {codeNotice && (
                <p className="muted small" role="status" style={{ margin: '0 0 6px' }}>
                  {codeNotice}
                </p>
              )}
              {applied ? (
                <p className="muted small" style={{ margin: 0 }}>
                  {applied.source === 'promo' ? 'Code' : 'Voucher'}{' '}
                  <span className="mono">{applied.code}</span> {codeApplies ? 'applied' : 'saved for later'} —{' '}
                  {applied.kind === 'percent'
                    ? `${applied.percent}% off`
                    : `${formatMoney(applied.amountCents, config.currency)} off`}
                  , from {applied.sellerName || 'the seller'}.{' '}
                  {/* Nothing selected costs anything, so there is nothing to
                      take off. Said out loud rather than spent for 0.00: the
                      code stays theirs for an order that costs money. */}
                  {!codeApplies && (
                    <>
                      Nothing you have picked costs anything yet, so it stays unused.{' '}
                    </>
                  )}
                  {/* One code per order, said before they go looking for a
                      second box that does not exist. */}
                  Only one code counts per order.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      removeCode();
                      setCodeOpen(true);
                    }}
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
                    Use a different code
                  </button>{' '}
                  ·{' '}
                  <button
                    type="button"
                    onClick={removeCode}
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
                    Remove
                  </button>
                </p>
              ) : codeOpen ? (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="discount-code">Discount code</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      id="discount-code"
                      className="input"
                      autoComplete="off"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="e.g. DASHAIN10"
                      maxLength={24}
                      disabled={codeBusy || working}
                      style={{ flex: '1 1 180px' }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={applyCode}
                      disabled={codeBusy || working}
                    >
                      {codeBusy ? <span className="spinner" aria-hidden /> : null}
                      {codeBusy ? 'Checking…' : 'Apply'}
                    </button>
                  </div>
                  <p className={`muted small ${styles.hint}`}>
                    A code the seller handed out, or a thank-you code they sent you for bringing
                    friends. Either way it is their discount on their own price — it comes straight
                    off what you transfer to them. One code per order.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  className="link-button small"
                  onClick={() => setCodeOpen(true)}
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
                  Have a discount code? →
                </button>
              )}
            </div>
          )}

          {/* A SEPARATE field, and separate on purpose: this one credits the
              person who sent the buyer here and takes nothing off the buyer's
              own price. Sharing a box with the discount code would promise
              money that is not coming.
              Shown even on a listing where everything is free, unlike the
              discount box above: a free reservation somebody's link brought in
              is a real referral, and the person who brought it should be
              credited for it. */}
          <div style={{ marginTop: 12 }}>
            {referralOpen ? (
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="referral-code">Referral code</label>
                <input
                  id="referral-code"
                  className="input"
                  autoComplete="off"
                  value={referralInput}
                  onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                  onBlur={(e) => {
                    const typed = e.target.value.trim().toUpperCase();
                    if (typed !== referralCheckedRef.current) void checkReferral(typed);
                  }}
                  placeholder="XXXXXXXX"
                  maxLength={8}
                  disabled={referralBusy || working}
                />
                {referralError ? (
                  // Harmless by construction, and worded that way: nobody
                  // is credited, and that is the whole of the loss.
                  <p className="muted small" role="status" style={{ margin: '6px 0 0' }}>
                    {referralError}
                  </p>
                ) : referral ? (
                  <p className="muted small" style={{ margin: '6px 0 0' }}>
                    Thanks — {referral.sellerName || 'the seller'} will see that{' '}
                    <span className="mono">{referral.code}</span> sent you. Your price is exactly
                    the same either way.
                  </p>
                ) : (
                  <p className={`muted small ${styles.hint}`}>
                    The code a friend shared with you. It credits <em>them</em> with the seller —
                    it takes nothing off your own total, and it is never needed to buy.
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="link-button small"
                onClick={() => setReferralOpen(true)}
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
                Someone referred you? Enter their code →
              </button>
            )}
          </div>
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

        {/* The OPTIONAL "keep me posted" box — deliberately quieter than the
            required privacy tick above (muted, smaller, no border), because
            visual parity would read as "also required". Never pre-ticked, and
            nothing on this page waits for it. */}
        <div className="muted small" style={{ marginTop: 14 }}>
          <label className="checkbox-row" style={{ fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              disabled={working}
            />
            <span>
              Keep me posted when {organizerName || 'this organizer'} announces something new — at
              most one email per new listing, unsubscribe any time.
            </span>
          </label>
          <p className="small" style={{ margin: '6px 0 0' }}>
            Optional. If you tick it, you first get one email asking you to confirm — nothing is
            sent until you press the button in it. Once confirmed, we keep your email for{' '}
            {organizerName || 'this organizer'}&rsquo;s announcements only — it is not erased after{' '}
            {isShop ? 'collection' : 'the event'} like the rest of your details, because you asked to
            hear more. Every email carries an unsubscribe link, and unsubscribing ends it for good.
            Leave it unticked and nothing changes.
          </p>
        </div>
      </div>

      <div className="card anim-fade-up anim-d3">
        <h2 className="card-title">{isFreeOrder ? 'Reserve your spot' : 'Payment'}</h2>

        {/* The one fact worth repeating directly above the button: a buyer who
            has scrolled this far has not seen the top of the page for several
            screens, and what they are about to commit to is a night in a
            particular city. Shown for every listing, not only the ones with a
            twin — the twin is what taught us to say it, not the only case
            where somebody buys for the wrong weekend. */}
        {placeLine ? (
          <p className="checkout-place-confirm">
            {isShop ? 'Collect in' : `These ${v.units} are for`}{' '}
            <strong>{config.city}</strong>
            {config.whenLabel ? <> · {config.whenLabel}</> : null}
          </p>
        ) : null}

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
                : discountCents > 0
                  ? `Your code covers the whole order — there is nothing to pay and nothing to transfer. Your QR ${v.codes} appear on the next page and are emailed to you right away.`
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
                discountCents > 0 && !allTiersFree
                  ? `Reserve ${v.units} — nothing to pay`
                  : `Reserve ${v.units} — free`
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
            /* Say what is true about THIS LISTING and stop there.
               The old wording — "please check back soon or contact the
               organizer" — made two promises this component cannot keep. It
               promised the listing is about to start working, when nothing
               here knows whether anyone will ever add a payout account; and it
               sent the buyer after a person, when the reason there is no
               payout account may be that there is nobody behind the page at
               all (an abandoned draft that got published, a listing kept up as
               an example). A buyer chasing a seller who does not exist is a
               worse outcome than a buyer who simply knows this one cannot be
               ordered from. The seller's own "ask a question" box is still on
               the listing page for anyone who does want to reach them. */
            <div className="notice notice-error">
              This {v.listing} has no payment details, so an order cannot be placed on it.
              Nothing has been reserved and nothing can be charged.
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
                  {/* Not "as soon as your transfer arrives": nothing here can see
                      the organizer's bank account — THEY confirm the payment, and
                      that confirmation is what sends the tickets. */}
                  Your QR-code {v.codes} are emailed the moment the organizer confirms your
                  transfer — it usually lands within 1–2 business days
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
