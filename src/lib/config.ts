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

export type PaymentMode = 'paypal' | 'mock' | 'transfer';

export function hasPaypalCredentials(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
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
  const explicitMode = (process.env.PAYMENT_MODE || 'auto').toLowerCase();
  // Bank transfer moves real money, so unlike mock it is allowed everywhere —
  // including PAYPAL_ENV=live (that guard exists only to keep mock out).
  if (explicitMode === 'transfer') return 'transfer';
  // Live environment never allows mock payments.
  if (process.env.PAYPAL_ENV === 'live') return 'paypal';
  const explicit = explicitMode;
  const isProd = process.env.NODE_ENV === 'production';
  // Fail closed: in a production build, mock (test) payments require BOTH
  // PAYMENT_MODE=mock and ALLOW_MOCK_PAYMENTS=true. A production deploy whose
  // env vars failed to load must never silently hand out free tickets.
  const mockAllowed = !isProd || process.env.ALLOW_MOCK_PAYMENTS === 'true';
  if (explicit === 'mock') return mockAllowed ? 'mock' : 'paypal';
  if (explicit === 'paypal') return 'paypal';
  if (hasPaypalCredentials()) return 'paypal';
  // auto + no credentials: mock is a dev convenience only. In production this
  // returns 'paypal', which surfaces a clear "payment not configured" error.
  return isProd ? 'paypal' : 'mock';
}

export function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}
