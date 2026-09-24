// Server-only: payment-mode/base-URL helpers plus LEGACY single-event shims.
//
// The platform's source of truth for events is now the database (lib/events).
// The get*Config()/getTier() functions below are thin compatibility shims over
// the PRIMARY (oldest) event so not-yet-migrated pages keep compiling and
// rendering; new code must use lib/events directly.
// Do NOT import this from 'use client' components.
import { getEventTiers, getPrimaryEvent, type EventRow } from './events';

export interface TierConfig {
  id: string;
  name: string;
  priceCents: number;
  cap: number;
  studentOnly: boolean;
  description: string;
}

export interface BankTransferConfig {
  accountHolder: string;
  iban: string;
  bic: string; // optional, '' when unused
  bankName: string; // optional, '' when unused
  /** Days the buyer is asked to pay within; reservations expire a bit later. */
  payWithinDays: number;
}

export interface EventConfig {
  eventName: string;
  artist: string;
  description: string;
  dateDisplay: string;
  venue: string;
  currency: string;
  totalCapacity: number;
  salesOpen: boolean;
  maxTicketsPerOrder: number;
  tiers: TierConfig[];
  bankTransfer?: BankTransferConfig;
}

// Subset of the config that is safe to send to the browser.
export interface PublicTier {
  id: string;
  name: string;
  priceCents: number;
  studentOnly: boolean;
  description: string;
}

export interface PublicEventConfig {
  eventName: string;
  artist: string;
  description: string;
  dateDisplay: string;
  venue: string;
  currency: string;
  salesOpen: boolean;
  maxTicketsPerOrder: number;
  tiers: PublicTier[];
}

/** One-line venue string for legacy templates ("Venue, City"). */
function venueDisplay(event: EventRow): string {
  return [event.venueName, event.city].filter(Boolean).join(', ');
}

/**
 * @deprecated legacy shim — use lib/events (getEventById/getEventBySlug +
 * getEventTiers). Maps the primary event onto the old event.config.json shape.
 */
export function getEventConfig(): EventConfig {
  const event = getPrimaryEvent();
  if (!event) throw new Error('No event exists yet — create one in the portal first.');
  const tiers = getEventTiers(event.id);
  return {
    eventName: event.name,
    artist: event.artist,
    description: event.description,
    dateDisplay: event.dateDisplay,
    venue: venueDisplay(event),
    currency: event.currency,
    totalCapacity: event.totalCapacity,
    salesOpen: event.salesOpen,
    maxTicketsPerOrder: event.maxPerOrder,
    tiers: tiers.map((t) => ({
      id: t.tierKey,
      name: t.name,
      priceCents: t.priceCents,
      cap: t.cap,
      studentOnly: t.studentOnly,
      description: t.description,
    })),
    bankTransfer: {
      accountHolder: event.bankAccountHolder,
      iban: event.bankIban,
      bic: event.bankBic,
      bankName: event.bankName,
      payWithinDays: event.payWithinDays,
    },
  };
}

/** @deprecated legacy shim — use lib/events getEventTier(eventId, tierKey). */
export function getTier(tierId: string): TierConfig | null {
  const event = getPrimaryEvent();
  if (!event) return null;
  const t = getEventTiers(event.id).find((tier) => tier.tierKey === tierId);
  if (!t) return null;
  return {
    id: t.tierKey,
    name: t.name,
    priceCents: t.priceCents,
    cap: t.cap,
    studentOnly: t.studentOnly,
    description: t.description,
  };
}

/** @deprecated legacy shim — use lib/events + a per-event public shape. */
export function getPublicConfig(): PublicEventConfig {
  const c = getEventConfig();
  return {
    eventName: c.eventName,
    artist: c.artist,
    description: c.description,
    dateDisplay: c.dateDisplay,
    venue: c.venue,
    currency: c.currency,
    salesOpen: c.salesOpen,
    maxTicketsPerOrder: c.maxTicketsPerOrder,
    tiers: c.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      priceCents: t.priceCents,
      studentOnly: t.studentOnly,
      description: t.description,
    })),
  };
}

/**
 * The platform-wide payment mode.
 *
 *   transfer — the real thing. Buyers pay the SELLER: by bank transfer or
 *              PayPal.Me (seller confirms by hand), or instantly through the
 *              seller's own PayPal / Stripe account (lib/paymentConnections).
 *   mock     — dev only: a simulated payment that finalizes at once.
 *
 * There is no platform-credential 'paypal' mode any more. The old
 * PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENV variables are ignored:
 * every PayPal call is made with a seller's own app, so the platform never
 * receives a buyer's money (see PLATFORM.md). PAYMENT_MODE=paypal is read as
 * 'transfer' for the same reason.
 */
export type PaymentMode = 'mock' | 'transfer';

/** @deprecated the platform no longer holds PayPal credentials; always false. */
export function hasPaypalCredentials(): boolean {
  return false;
}

/**
 * @deprecated legacy shim — read the event's bank* fields via lib/events.
 * Bank details buyers transfer to (primary event). Null until filled in.
 */
export function getBankTransferConfig(): BankTransferConfig | null {
  const event = getPrimaryEvent();
  if (!event || !event.bankIban.trim() || !event.bankAccountHolder.trim()) return null;
  return {
    accountHolder: event.bankAccountHolder,
    iban: event.bankIban,
    bic: event.bankBic,
    bankName: event.bankName,
    payWithinDays: event.payWithinDays,
  };
}

/** @deprecated legacy shim — check the event's bank* fields via lib/events. */
export function isTransferConfigured(): boolean {
  return getBankTransferConfig() !== null;
}

export function getPaymentMode(): PaymentMode {
  const explicit = (process.env.PAYMENT_MODE || 'auto').toLowerCase();
  if (explicit !== 'mock') return 'transfer';
  // Mock was asked for. It is a dev convenience and nothing else: never on a
  // live PayPal environment (the historical "this is the live site" signal),
  // and in a production build only with the explicit second switch — a deploy
  // whose env vars failed to load must never silently hand out free tickets.
  if (process.env.PAYPAL_ENV === 'live') return 'transfer';
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PAYMENTS !== 'true') return 'transfer';
  return 'mock';
}

export function getBaseUrl(): string {
  const url = (process.env.NEXT_PUBLIC_BASE_URL || '').trim();
  if (url) {
    // A stray comma in the deployment setting previously produced links like
    // `https://martnepali.com,/order/...`; browsers then look up the invalid
    // hostname `martnepali.com,` and report a DNS failure. Be forgiving of
    // punctuation accidentally copied after the origin.
    const normalized = url.replace(/[\s,;]+$/, '').replace(/\/$/, '');

    // The apex currently redirects to www. Email clients and link scanners can
    // be stricter about redirects than browsers, so send buyers straight to
    // the canonical host that serves the application with a 200 response.
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname === 'martnepali.com') {
        parsed.hostname = 'www.martnepali.com';
        return parsed.toString().replace(/\/$/, '');
      }
    } catch {
      // Keep the configured value below so a malformed deployment setting is
      // visible instead of silently replacing an unrelated preview origin.
    }

    return normalized;
  }
  // The localhost fallback is a dev convenience that must never travel: this
  // value is baked into ticket emails, WhatsApp share links and the sitemap,
  // and every one of those shipped with a dead localhost URL would fail in a
  // stranger's hands, silently. Loud in production, quiet in dev — not a
  // throw, because `next build` also runs with NODE_ENV=production and a
  // build machine without the env set should still build.
  if (process.env.NODE_ENV === 'production') {
    console.error(
      'NEXT_PUBLIC_BASE_URL is not set — outbound links are falling back to https://www.martnepali.com. Set it explicitly in the deployment environment.'
    );
    return 'https://www.martnepali.com';
  }
  return 'http://localhost:3000';
}
