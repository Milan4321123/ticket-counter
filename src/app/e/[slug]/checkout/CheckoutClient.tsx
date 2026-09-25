'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { discountCentsFor, formatMoney, subscribeDiscountCents } from '@/lib/money';
import { getBasket, removeListing, replaceListing, type BasketLine } from '@/components/basket/basketStore';
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
import SeatMapView, { type SeatMapData } from '@/components/SeatMapView';
import { WishPanel } from '@/components/WishButton';
import { translator, type Lang } from '@/lib/i18n';

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
  /** The item's photo (shops), for the "add more" grid. */
  image?: string | null;
}

export interface CheckoutConfig {
  eventName: string;
  /** The listing's address, for "back to the shop". */
  slug?: string;
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
  /** One of the site's own example shops: never takes an order, offers the wish list instead. */
  example?: boolean;
  /** The listing can be wished for (published and not a try-it demo). */
  wishable?: boolean;
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

/**
 * Which ways to pay THIS listing offers — resolved on the server by
 * lib/paymentConnections from the seller's own settings. Only booleans and a
 * PayPal client id cross to the browser; the seller's bank details stay on
 * the order page, after somebody has actually reserved.
 */
export interface CheckoutPayment {
  /** Reserve now, pay the seller directly, seller confirms by hand. */
  transfer: boolean;
  /** The transfer route includes the seller's bank account. */
  bank: boolean;
  /** The transfer route includes a PayPal.Me link / address. */
  paypalMe: boolean;
  /** PayPal Checkout on the SELLER'S own PayPal app — pays instantly. */
  paypal: { clientId: string; sandbox: boolean } | null;
  /** Card payment on the SELLER'S own Stripe account — pays instantly. */
  stripe: boolean;
  /** Dev-only simulated payment. */
  mock: boolean;
}

export type PayMethod = 'paypal' | 'stripe' | 'transfer' | 'mock';

/** Instant routes first — they are why a seller switched them on. */
export function availableMethods(p: CheckoutPayment): PayMethod[] {
  const out: PayMethod[] = [];
  if (p.paypal) out.push('paypal');
  if (p.stripe) out.push('stripe');
  if (p.transfer) out.push('transfer');
  if (p.mock) out.push('mock');
  return out;
}

interface Props {
  eventId: string;
  config: CheckoutConfig;
  availability: CheckoutAvailability;
  payment: CheckoutPayment;
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
  /**
   * The restaurant pack (lib/kitchen), for shops only: collection time slots,
   * the table from an order-from-the-table QR code, and each item's free
   * choices. Null for events and for shops that use none of it.
   */
  kitchen?: CheckoutKitchen | null;
  /**
   * Reserved seating (lib/seats): the hall, and which seats are already taken.
   * Null for unreserved events. Seated ticket types are bought by picking seats.
   */
  seating?: { map: SeatMapData; taken: Record<string, 'held' | 'sold'> } | null;
  /** Which language the page's headings and buttons are in (lib/i18n). */
  lang?: Lang;
  /** Subscribe & save (lib/subscriptions): the shop's repeat discount, or null when it offers none. */
  subscribe?: { pct: number } | null;
  /** The signed-in customer, to pre-fill name and email. */
  customer?: { name: string; email: string } | null;
  /**
   * tierKey → its basket line, for the items that can live in the
   * cross-seller basket (lib/basket). Picks of these are mirrored there.
   */
  basketLines?: Record<string, Omit<BasketLine, 'qty'>> | null;
}

export interface CheckoutSlot {
  value: string;
  time: string;
  open: boolean;
}

export interface CheckoutKitchen {
  /** What the times are for — picking up an order, or an appointment. */
  purpose?: 'collection' | 'appointment';
  /** Bookable days, empty when the shop has no slots. */
  slots: { date: string; label: string; slots: CheckoutSlot[] }[];
  /** '' unless the buyer came from a table's QR code. */
  table: string;
  /** tierKey -> the item's choice groups. */
  choices: Record<string, { name: string; options: string[] }[]>;
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
  /** Which of the listing's offered routes this order pays by. */
  payVia: PayMethod;
  pickupSlot?: string;
  table?: string;
  choices?: Record<string, Record<string, string>>;
  note?: string;
  seats?: string[];
  subscribeEvery?: number;
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
  payment,
  retentionDays,
  organizerName,
  refCode,
  preselectTier = null,
  otherCities,
  kitchen = null,
  seating = null,
  lang = 'en',
  subscribe = null,
  customer = null,
  basketLines = null,
}: Props) {
  const tr = translator(lang);
  const router = useRouter();
  // Identical checkout either way — same stepper, same reservation, same
  // transfer. Only the nouns change: seats and tickets, or items to collect.
  const v = vocabFor(config.kind);
  const isShop = config.kind === 'shop';

  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      config.tiers.map((t) => [
        t.id,
        // A seated type is bought by picking seats on the map, never preset.
        t.id === preselectTier && !seating?.map.sections.some((sec) => sec.tierKey === t.id) ? 1 : 0,
      ])
    )
  );
  // A signed-in customer (lib/customers) starts with their own details filled in.
  const [name, setName] = useState(customer?.name ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');

  // ---- Remembering the picks ----
  // Picks are kept while the buyer goes elsewhere: basket-able items in the
  // cross-seller basket (and so on their account when signed in), the rest in
  // this tab's session. Opening the checkout again brings them back.
  const memoryKey = `mn_co_${eventId}`;
  const restoredPicks = useRef(false);
  useEffect(() => {
    const remembered: Record<string, number> = {};
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(memoryKey) ?? '{}') as Record<string, number>;
      for (const [k, n] of Object.entries(saved)) if (Number.isInteger(n) && n > 0) remembered[k] = n;
    } catch {
      /* nothing saved */
    }
    for (const l of getBasket()) if (l.eventId === eventId) remembered[l.tierKey] = l.qty;
    if (Object.keys(remembered).length > 0) {
      setQty((prev) => {
        const next = { ...prev };
        for (const t of config.tiers) {
          if (seating?.map.sections.some((sec) => sec.tierKey === t.id)) continue;
          const want = remembered[t.id];
          if (want) next[t.id] = Math.max(prev[t.id] ?? 0, Math.min(want, config.maxTicketsPerOrder));
        }
        return next;
      });
    }
    restoredPicks.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ---- Restaurant pack: slot, choices, note (shops only) ----
  const slotsRequired = Boolean(kitchen && kitchen.slots.length > 0 && !kitchen.table);
  const firstOpenDay = kitchen?.slots.find((d) => d.slots.some((sl) => sl.open))?.date ?? kitchen?.slots[0]?.date ?? '';
  const [slotDay, setSlotDay] = useState(firstOpenDay);
  const [pickupSlot, setPickupSlot] = useState('');
  const [picks, setPicks] = useState<Record<string, Record<string, string>>>({});
  const [orderNote, setOrderNote] = useState('');
  // ---- Reserved seating ----
  const seatedTiers = new Set((seating?.map.sections ?? []).map((sec) => sec.tierKey));
  const [seats, setSeats] = useState<string[]>([]);
  const [seatMsg, setSeatMsg] = useState<string | null>(null);
  const tierOfSeat = (id: string) =>
    seating?.map.sections.find((sec) => id.startsWith(`${sec.id}-`))?.tierKey ?? '';
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
  const [busy, setBusy] = useState(false); // mock / transfer / stripe request in flight
  const [capturing, setCapturing] = useState(false); // PayPal capture in flight
  const [sdkState, setSdkState] = useState<'loading' | 'ready' | 'error'>('loading');

  /**
   * Which way the buyer is paying. The listing's routes, instant ones first,
   * and the first of them pre-selected: a seller who connected PayPal or
   * Stripe did it so buyers pay on the spot, and a buyer who would rather
   * transfer is one tap away. Nothing is charged until they act on the panel
   * the choice reveals.
   */
  const methods = availableMethods(payment);
  const [method, setMethod] = useState<PayMethod | null>(methods[0] ?? null);
  const paypalClientId = payment.paypal?.clientId ?? null;

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
  /** Subscribe & save: 0 = a one-off order, else repeat every N days. */
  const [subscribeEvery, setSubscribeEvery] = useState(0);
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
  // Subscribe & save replaces a code: only one discount may part-pay an order.
  const subscribing = Boolean(subscribe) && subscribeEvery > 0 && totalCents > 0;
  const codeApplies = Boolean(applied) && totalCents > 0 && !subscribing;
  // The SAME function the server discounts with: never more than the basket is
  // worth, and a percentage rounded in the buyer's favour. One implementation,
  // so this page can never promise a number the order then contradicts.
  const discountCents = subscribing
    ? subscribeDiscountCents(subscribe!.pct, totalCents)
    : codeApplies
      ? discountCentsFor(applied!, totalCents)
      : 0;
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
  // Every choice of every selected item made, and a slot when one is required.
  const choicesMissing = config.tiers.find(
    (t) => (qty[t.id] ?? 0) > 0 && (kitchen?.choices[t.id] ?? []).some((g) => !picks[t.id]?.[g.name])
  );
  const slotMissing = slotsRequired && !pickupSlot;
  const formReady =
    totalQty > 0 && nameOk && emailOk && ackOk && privacyAck && !choicesMissing && !slotMissing;
  /** The restaurant fields every order request carries (ignored by the server for events). */
  const kitchenFields = () => ({
    pickupSlot: slotsRequired ? pickupSlot : undefined,
    table: kitchen?.table || undefined,
    choices: Object.fromEntries(
      Object.entries(picks).filter(([k]) => (latestRef.current.qty[k] ?? 0) > 0)
    ),
    note: orderNote.trim() || undefined,
    seats: seats.length ? seats : undefined,
    subscribeEvery: subscribing ? subscribeEvery : undefined,
  });

  /**
   * WHY the pay buttons are off, in the buyer's words. One flat "fill in your
   * details" line was honest while details were the only thing that could be
   * missing; with a consent tick in the mix it sends someone back to re-read
   * fields they already filled, hunting for a mistake that is not there.
   */
  const blockedReason =
    totalQty === 0
      ? `Choose at least one ${v.unit} to continue.`
      : choicesMissing
        ? `Choose the options for “${choicesMissing.name}” to continue.`
        : slotMissing
          ? kitchen?.purpose === 'appointment'
            ? 'Pick an appointment time to continue.'
            : 'Pick a collection time to continue.'
      : !nameOk || !emailOk
        ? 'Fill in your name and email to continue.'
        : !ackOk
          ? 'Confirm the student ID requirement to continue.'
          : !privacyAck
            ? 'Tick the privacy box above to continue — we cannot take your details without it.'
            : null;

  const working = busy || capturing;

  /** The one line every route's panel starts with: whom the money goes to. */
  const sellerWord = isShop ? 'the seller' : 'the organizer';

  // Latest state snapshot for PayPal callbacks (they are registered once and
  // would otherwise close over stale state).
  const latestRef = useRef({ qty, name, email, payerName, marketingOptIn, formReady, totalQty, applied, sentRefCode, kitchenFields });
  latestRef.current = { qty, name, email, payerName, marketingOptIn, formReady, totalQty, applied, sentRefCode, kitchenFields };

  const localOrderIdRef = useRef<string | null>(null);
  const suppressPaypalErrorRef = useRef(false);
  const buttonsRenderedRef = useRef(false);
  const paypalBoxRef = useRef<HTMLDivElement | null>(null);

  /** Pick or drop a seat on the map. The seated types' quantities follow the picks (effect below). */
  function toggleSeat(id: string, tierKey: string) {
    setSeatMsg(null);
    setMessage(null);
    setSeats((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const unseated = config.tiers.reduce((n, t) => (seatedTiers.has(t.id) ? n : n + (qty[t.id] ?? 0)), 0);
      if (prev.length + unseated >= config.maxTicketsPerOrder) {
        setSeatMsg(`Up to ${config.maxTicketsPerOrder} tickets per order.`);
        return prev;
      }
      if (prev.filter((x) => tierOfSeat(x) === tierKey).length >= (availability.tiers[tierKey]?.remaining ?? 0)) {
        setSeatMsg('No more of these seats are available.');
        return prev;
      }
      return [...prev, id];
    });
  }

  // The count of each seated type IS the number of its seats picked — derived,
  // never tracked separately, so the two can never drift apart.
  useEffect(() => {
    if (!seating) return;
    setQty((prev) => {
      const next = { ...prev };
      for (const key of seatedTiers) next[key] = seats.filter((x) => tierOfSeat(x) === key).length;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats]);

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
        payVia: 'mock',
        ...kitchenFields(),
      };
      const created = await postJson<CreateOrderResponse>('/api/orders', req);
      forgetPicks();
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
        // A free order pays by no route; the server ignores this for it.
        payVia: 'transfer',
        ...kitchenFields(),
      };
      const created = await postJson<CreateOrderResponse>('/api/orders', req);
      forgetPicks();
      // The order page shows the bank details, amount, and reference.
      router.replace(`/order/${created.orderId}`);
      // Keep the button disabled while the redirect happens.
    } catch (e) {
      setMessage({ kind: 'error', text: friendlyError(e, v) });
      setBusy(false);
    }
  }

  // ---------------- Card (Stripe) flow ----------------

  /**
   * Write the order, then hand the browser to Stripe's hosted page on the
   * SELLER'S account. The seats are held from this moment; the order page
   * (which Stripe returns the buyer to) settles the outcome. No card field
   * ever exists on this site.
   */
  async function handleStripePay() {
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
        payVia: 'stripe',
        ...kitchenFields(),
      };
      const created = await postJson<CreateOrderResponse>('/api/orders', req);
      forgetPicks();
      if (!created.redirectUrl) throw new ApiError(GENERIC_ERROR, undefined, 500);
      window.location.assign(created.redirectUrl);
      // Keep the button disabled while the browser leaves.
    } catch (e) {
      setMessage({ kind: 'error', text: friendlyError(e, v) });
      setBusy(false);
    }
  }

  // ---------------- PayPal flow ----------------

  // Load the PayPal JS SDK once — as soon as the listing offers PayPal, not
  // only once it is chosen, so the buttons are ready the moment it is.
  useEffect(() => {
    if (!paypalClientId) return;
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
  }, [paypalClientId, config.currency]);

  // Render the PayPal buttons once the SDK is ready — and re-render them
  // whenever the free/paid boundary is crossed. The RSVP branch unmounts the
  // container (destroying any buttons in it), so isFreeOrder MUST be a
  // dependency here: without it, a buyer who lands on a preselected free tier
  // and then adds a paid one would face a silently empty payment box, and one
  // who toggled free→paid→free→paid would lose the buttons on the way back.
  // The cleanup below is what makes the re-render possible.
  // `method` is a dependency for the same reason: choosing bank transfer
  // unmounts the PayPal box, and choosing PayPal again needs fresh buttons.
  useEffect(() => {
    if (method !== 'paypal' || !paypalClientId || sdkState !== 'ready' || isFreeOrder) return;
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
              payVia: 'paypal',
              ...s.kitchenFields(),
            };
            const created = await postJson<CreateOrderResponse>('/api/orders', req);
      forgetPicks();
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
  }, [method, paypalClientId, sdkState, isFreeOrder]);

  // Every change to the picks is remembered (after the first restore).
  useEffect(() => {
    if (!restoredPicks.current) return;
    const picked = Object.fromEntries(Object.entries(qty).filter(([, n]) => n > 0));
    try {
      if (Object.keys(picked).length) window.sessionStorage.setItem(memoryKey, JSON.stringify(picked));
      else window.sessionStorage.removeItem(memoryKey);
    } catch {
      /* private mode */
    }
    if (basketLines) {
      replaceListing(
        eventId,
        Object.entries(picked)
          .filter(([k]) => basketLines[k])
          .map(([k, n]) => ({ ...basketLines[k], qty: n }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qty]);

  /** Once the order exists, its picks leave the basket and the memory. */
  const forgetPicks = () => {
    removeListing(eventId);
    try {
      window.sessionStorage.removeItem(memoryKey);
    } catch {
      /* private mode */
    }
  };

  // ---------------- Render ----------------

  const selectedTiers = config.tiers.filter((t) => (qty[t.id] ?? 0) > 0);
  // A shop's checkout is a basket: what was picked, with steppers — and the
  // rest of the shop underneath, one "Add" away. Items leave the basket for
  // the grid when stepped down to zero, and come back when added.
  const basket = isShop ? selectedTiers : config.tiers;
  const others = isShop ? config.tiers.filter((t) => (qty[t.id] ?? 0) === 0) : [];
  const canAddOne = (tier: CheckoutTier) =>
    !working &&
    (qty[tier.id] ?? 0) < tierMax(tier.id) &&
    totalQty < config.maxTicketsPerOrder &&
    totalSeats + tier.seatsPerUnit <= availability.totalRemaining &&
    (availability.tiers[tier.id]?.remaining ?? 0) > 0;
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
        {tr('co.title')}
      </h1>
      <div className="checkout-for anim-fade-up">
        <div className="checkout-for-name">{config.eventName}</div>
        {placeLine ? <div className="checkout-for-place">{placeLine}</div> : null}
        <div className="muted small">
          {[config.dateDisplay, config.venue].filter(Boolean).join(' · ')}
        </div>
      </div>
      <OtherCityNotice city={config.city} shows={otherCities} variant="checkout" />

      {seating && (
        <div className="card anim-fade-up">
          <h2 className="card-title">{tr('co.seats')}</h2>
          <p className="muted small" style={{ marginTop: 0 }}>
            {tr('co.seatsHint')}
          </p>
          <SeatMapView
            map={seating.map}
            taken={seating.taken}
            selected={new Set(seats)}
            mode="pick"
            onToggle={toggleSeat}
            disabled={working}
            legend={Object.fromEntries(
              config.tiers
                .filter((t) => seatedTiers.has(t.id))
                .map((t) => [t.id, { label: t.name, price: t.priceCents === 0 ? 'Free' : formatMoney(t.priceCents, config.currency) }])
            )}
          />
          {seatMsg && (
            <p className={styles.fieldError} role="alert" style={{ marginTop: 8 }}>
              {seatMsg}
            </p>
          )}
          {seats.length > 0 && (
            <p className="small" style={{ margin: '10px 0 0' }}>
              <strong>Your seats:</strong>{' '}
              {[...seats]
                .map((id) => id.split('-').slice(-2))
                .sort((a, b) => a[0].localeCompare(b[0]) || Number(a[1]) - Number(b[1]))
                .map(([row, n]) => `${row}${n}`)
                .join(', ')}{' '}
              <button
                type="button"
                className="link-button small"
                style={{ background: 'none', border: 0, padding: 0, color: 'var(--brand-text)', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setSeats([])}
              >
                Clear
              </button>
            </p>
          )}
        </div>
      )}

      <div className="card anim-fade-up anim-d1">
        <h2 className="card-title">{isShop ? tr('co.yourOrder') : tr('co.yourTickets')}</h2>
        {isShop && config.slug && (
          <p className={styles.basketBack}>
            <a href={`/e/${config.slug}`}>← Back to the shop</a>
            <a href={`/market?shop=${encodeURIComponent(config.slug)}`}>Browse in the bazaar</a>
          </p>
        )}
        {basketLines && Object.keys(basketLines).length > 0 && totalQty > 0 && (
          <p className={styles.basketSaved}>
            ✓ Saved in your <a href="/basket">basket</a> — keep shopping at other sellers and pay for everything together.
          </p>
        )}
        {isShop && basket.length === 0 && (
          <p className={`muted ${styles.basketEmpty}`}>Your basket is empty — add something from the shop below.</p>
        )}
        <div className={styles.qtyList}>
          {basket.map((tier) => {
            const remaining = availability.tiers[tier.id]?.remaining ?? 0;
            const q = qty[tier.id] ?? 0;
            const canAdd =
              !working &&
              q < tierMax(tier.id) &&
              totalQty < config.maxTicketsPerOrder &&
              // One more booking of THIS tier has to fit in the room whole.
              totalSeats + tier.seatsPerUnit <= availability.totalRemaining;
            return (
              <div className={`qty-row${isShop ? ` ${styles.basketRow}` : ''}`} key={tier.id}>
                {isShop && tier.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.basketThumb} src={tier.image} alt="" />
                ) : null}
                <div className={isShop ? styles.basketInfo : undefined}>
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
                {seatedTiers.has(tier.id) ? (
                  <span className="badge badge-accent" style={{ whiteSpace: 'nowrap' }}>
                    {q} {q === 1 ? 'seat' : 'seats'} picked
                  </span>
                ) : (
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
                )}
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

        {/* ---- The rest of the shop, one tap from the basket ---- */}
        {others.length > 0 && (
          <div className={styles.addMore}>
            <div className={styles.addMoreHead}>＋ Add more from this shop</div>
            <div className={styles.addGrid}>
              {others.map((t) => {
                const ok = canAddOne(t);
                return (
                  <button
                    type="button"
                    key={t.id}
                    className={styles.addTile}
                    onClick={() => changeQty(t.id, 1)}
                    disabled={!ok}
                    aria-label={`Add ${t.name}, ${t.priceCents === 0 ? 'free' : formatMoney(t.priceCents, config.currency)}`}
                  >
                    {t.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.image} alt="" loading="lazy" />
                    ) : (
                      <span className={styles.addBlank}>{t.name.charAt(0)}</span>
                    )}
                    <span className={styles.addName}>{t.name}</span>
                    <span className={styles.addFoot}>
                      <span>{t.priceCents === 0 ? 'Free' : formatMoney(t.priceCents, config.currency)}</span>
                      <span className={styles.addBtn}>
                        {(availability.tiers[t.id]?.remaining ?? 0) === 0 ? 'Sold out' : '+ Add'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- Item choices (restaurant pack) ---- */}
        {kitchen &&
          config.tiers
            .filter((t) => (qty[t.id] ?? 0) > 0 && (kitchen.choices[t.id] ?? []).length > 0)
            .map((t) => (
              <div key={t.id} className={styles.choiceBlock}>
                <div className="tier-name">{t.name}</div>
                {kitchen.choices[t.id].map((g) => (
                  <div key={g.name} className={styles.choiceRow} role="radiogroup" aria-label={`${g.name} for ${t.name}`}>
                    <span className={styles.choiceName}>{g.name}</span>
                    <div className={styles.choiceOptions}>
                      {g.options.map((o) => {
                        const on = picks[t.id]?.[g.name] === o;
                        return (
                          <button
                            type="button"
                            key={o}
                            role="radio"
                            aria-checked={on}
                            className={`${styles.choiceChip}${on ? ` ${styles.choiceChipOn}` : ''}`}
                            onClick={() =>
                              setPicks((prev) => ({ ...prev, [t.id]: { ...(prev[t.id] ?? {}), [g.name]: o } }))
                            }
                            disabled={working}
                          >
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {(qty[t.id] ?? 0) > 1 && (
                  <p className="muted small" style={{ margin: '4px 0 0' }}>
                    Applies to all {qty[t.id]} — want them different? Say so in the note below.
                  </p>
                )}
              </div>
            ))}

        {/* ---- Collection time, or the table (restaurant pack) ---- */}
        {kitchen?.table ? (
          <div className={styles.tableNotice}>
            <strong>Table {kitchen.table}</strong>
            <span>Your order goes straight to the kitchen and is brought to your table.</span>
          </div>
        ) : slotsRequired && kitchen ? (
          <div className={styles.slotBlock}>
            <div className="tier-name">
              {kitchen.purpose === 'appointment' ? 'Choose your appointment time' : tr('co.when')}
            </div>
            <div className={styles.slotDays} role="tablist" aria-label="Collection day">
              {kitchen.slots.map((d) => (
                <button
                  type="button"
                  key={d.date}
                  role="tab"
                  aria-selected={slotDay === d.date}
                  className={`${styles.slotDay}${slotDay === d.date ? ` ${styles.slotDayOn}` : ''}`}
                  onClick={() => setSlotDay(d.date)}
                  disabled={working}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className={styles.slotGrid}>
              {(kitchen.slots.find((d) => d.date === slotDay)?.slots ?? []).map((sl) => (
                <button
                  type="button"
                  key={sl.value}
                  className={`${styles.slot}${pickupSlot === sl.value ? ` ${styles.slotOn}` : ''}`}
                  onClick={() => setPickupSlot(sl.value)}
                  disabled={!sl.open || working}
                  aria-pressed={pickupSlot === sl.value}
                  title={sl.open ? `Collect at ${sl.time}` : 'Full'}
                >
                  {sl.time}
                  {!sl.open && <small>full</small>}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {kitchen && (
          <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
            <label htmlFor="order-note">Note for the {kitchen.table ? 'kitchen' : 'seller'} (optional)</label>
            <textarea
              id="order-note"
              className="input"
              rows={2}
              maxLength={300}
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder={kitchen.table ? 'e.g. one without onion, please' : 'e.g. I will be 10 minutes late'}
              disabled={working}
            />
          </div>
        )}

        <div className={styles.summaryBlock}>
          {totalQty === 0 ? (
            <p className="muted small">{tr('co.nothing')}</p>
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
              {discountCents > 0 && subscribing && (
                <div className="summary-row">
                  <span>Subscribe &amp; save ({subscribe!.pct}%)</span>
                  <span>−{formatMoney(discountCents, config.currency)}</span>
                </div>
              )}
              {discountCents > 0 && !subscribing && (
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
                <span>{tr('co.total')}</span>
                <span>{payableCents === 0 ? 'Free' : formatMoney(payableCents, config.currency)}</span>
              </div>
              {discountCents > 0 && !subscribing && (
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

          {/* Subscribe & save: one tap to make this a standing order. */}
          {subscribe && totalCents > 0 && (
            <div className={styles.subscribeBox}>
              <label className={styles.subscribeToggle}>
                <input
                  type="checkbox"
                  checked={subscribeEvery > 0}
                  onChange={(e) => setSubscribeEvery(e.target.checked ? 14 : 0)}
                />
                <span>
                  <strong>Subscribe &amp; save {subscribe.pct}%</strong>
                  <span className="muted small"> — repeat this order and pay less every time</span>
                </span>
              </label>
              {subscribeEvery > 0 && (
                <>
                  <div className={styles.subscribeEvery} role="radiogroup" aria-label="How often">
                    {[7, 14, 28].map((d) => (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={subscribeEvery === d}
                        className={subscribeEvery === d ? styles.subscribeOn : undefined}
                        onClick={() => setSubscribeEvery(d)}
                      >
                        {d === 7 ? 'Every week' : d === 14 ? 'Every 2 weeks' : 'Every 4 weeks'}
                      </button>
                    ))}
                  </div>
                  <p className="muted small" style={{ margin: '6px 0 0' }}>
                    Each repeat holds your items and emails you the seller&rsquo;s payment details — nothing is
                    charged automatically. Skip, pause or cancel any time from the link in the email.
                    {applied ? ' Your discount code is not used on a subscription.' : ''}
                  </p>
                </>
              )}
            </div>
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
        <h2 className="card-title">{tr('co.details')}</h2>
        <div className="field">
          <label htmlFor="buyer-name">{tr('co.fullName')}</label>
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
          <label htmlFor="buyer-email">{tr('co.email')}</label>
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
              : method === 'paypal'
                ? ` Your payment goes straight into their own PayPal account — the money never passes through us, and your ${v.codes} are issued the moment PayPal confirms it.`
                : method === 'stripe'
                  ? ` Your card is charged by Stripe on their own account — the money never passes through us, and your ${v.codes} are issued the moment the payment goes through.`
                  : payment.paypalMe
                    ? ` Your payment goes straight to them — to their own bank account or their own PayPal, so the money never passes through us, and the reference on it is how they match it to your ${v.codes}.`
                    : ` Your payment goes straight to their bank account, so the money never passes through us, and the reference on your transfer is how they match it to your ${v.codes}.`}{' '}
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
        <h2 className="card-title">{isFreeOrder ? tr('co.reserveSpot') : tr('co.payment')}</h2>

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
        ) : methods.length === 0 ? (
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
          config.wishable ? (
            /* Not a dead end: what was picked goes on the wish list, so the
               seller — and for an example shop, we — learn that somebody
               wanted it (lib/wishes). */
            <WishPanel
              eventId={eventId}
              example={Boolean(config.example)}
              unit={v.unit}
              items={config.tiers.filter((t) => (qty[t.id] ?? 0) > 0).map((t) => ({ tierKey: t.id, name: t.name }))}
            />
          ) : (
            <div className="notice notice-error">
              This {v.listing} has no payment details, so an order cannot be placed on it.
              Nothing has been reserved and nothing can be charged.
            </div>
          )
        ) : (
          <>
            {/* The choice, only when there IS one. Each row says the one
                thing that separates it from the others — pays now, or
                reserve and transfer — and whose account the money lands in,
                which is always the seller's. */}
            {methods.length > 1 && (
              <div className={styles.payMethods} role="radiogroup" aria-label="How would you like to pay?">
                {methods.map((m) => {
                  const on = method === m;
                  const label =
                    m === 'paypal'
                      ? 'PayPal'
                      : m === 'stripe'
                        ? 'Card (Visa, Mastercard, …)'
                        : m === 'transfer'
                          ? payment.paypalMe && payment.bank
                            ? 'Bank transfer or PayPal.Me'
                            : payment.paypalMe
                              ? 'PayPal.Me'
                              : 'Bank transfer (Überweisung)'
                          : 'Test payment';
                  const line =
                    m === 'paypal' || m === 'stripe'
                      ? `Pay now — your ${v.codes} arrive straight away`
                      : m === 'transfer'
                        ? `Reserve now, send the money yourself — ${sellerWord} confirms it`
                        : 'Simulated — no money moves';
                  return (
                    <label key={m} className={`${styles.payMethod}${on ? ` ${styles.payMethodOn}` : ''}`}>
                      <input
                        type="radio"
                        name="pay-method"
                        value={m}
                        checked={on}
                        onChange={() => {
                          setMethod(m);
                          setMessage(null);
                        }}
                        disabled={working}
                      />
                      <span>
                        <strong>{label}</strong>
                        {(m === 'paypal' || m === 'stripe') && <span className={styles.payMethodTag}>Instant</span>}
                        <span className={styles.payMethodLine}>{line}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {method === 'transfer' ? (
              <>
                <p className="muted small" style={{ marginTop: 0 }}>
                  {payment.paypalMe
                    ? `Reserve in one click — your ${v.units} are held for you straight away — then send the money by PayPal or bank transfer (Überweisung).`
                    : `Reserve in one click — your ${v.units} are held for you straight away — then send a regular bank transfer (Überweisung).`}
                </p>
                <ul className={styles.perkList}>
                  {payment.paypalMe && (
                    <li>
                      <strong>PayPal arrives in seconds</strong> — bank transfers take 1–2 business days
                    </li>
                  )}
                  <li>
                    {payment.paypalMe
                      ? 'No fees, no account needed — pay with PayPal, or from any bank app'
                      : 'No fees, no account needed — pay from any bank app'}
                  </li>
                  <li>
                    On the next page you&rsquo;ll get {sellerWord}&rsquo;s{' '}
                    {payment.paypalMe && payment.bank ? 'bank and PayPal details' : payment.paypalMe ? 'PayPal details' : 'bank details'} and your
                    personal payment reference (also sent to you by email)
                  </li>
                  <li>
                    {/* Not "as soon as your transfer arrives": nothing here can see
                        the organizer's bank account — THEY confirm the payment, and
                        that confirmation is what sends the tickets. */}
                    Your QR-code {v.codes} are emailed the moment {sellerWord} confirms your
                    payment — it usually lands within 1–2 business days
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
                    /* Name the routes the buyer actually has — a button that
                       says only "bank transfer" when PayPal.Me was promised
                       reads like PayPal was withdrawn at the last moment. */
                    `Reserve ${v.units} — ${
                      payment.paypalMe && payment.bank
                        ? 'pay by PayPal or bank transfer'
                        : payment.paypalMe
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
            ) : method === 'stripe' ? (
              <>
                <p className="muted small" style={{ marginTop: 0 }}>
                  You&rsquo;ll be taken to a secure card page run by Stripe for {sellerWord}. Pay there, and you
                  come straight back here with your QR {v.codes} — they are emailed to you at the same moment.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block"
                  onClick={handleStripePay}
                  disabled={!formReady || busy}
                >
                  {busy ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> Opening secure payment…
                    </>
                  ) : (
                    `Pay ${formatMoney(payableCents, config.currency)} by card →`
                  )}
                </button>
                {!formReady && !busy && (
                  <p className={`muted small ${styles.hint}`}>
                    {blockedReason}
                  </p>
                )}
                <p className={`muted small ${styles.hint}`}>
                  Your card details go to Stripe only — never to this site. You are charged once, when you confirm
                  on the Stripe page.
                </p>
              </>
            ) : method === 'mock' ? (
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
            ) : sdkState === 'error' ? (
              <div className="notice notice-error">
                We could not load the PayPal buttons. Please refresh the page and try again
                {methods.length > 1 ? ', or choose another way to pay above' : ''}.
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
                  Pay securely with PayPal or a debit/credit card, into {sellerWord}&rsquo;s own PayPal account.
                  You are only charged once you approve the payment
                  {payment.paypal?.sandbox ? ' — this listing is in PayPal sandbox (test) mode, no real money moves' : ''}.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
