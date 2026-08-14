// Server-only: loads and validates event.config.json.
// Do NOT import this from 'use client' components (it uses fs).
import fs from 'fs';
import path from 'path';

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

let cached: EventConfig | null = null;

function fail(msg: string): never {
  throw new Error(`event.config.json: ${msg}`);
}

function validate(raw: unknown): EventConfig {
  const c = raw as EventConfig;
  if (!c || typeof c !== 'object') fail('file must contain a JSON object');
  if (!c.eventName || typeof c.eventName !== 'string') fail('"eventName" is required');
  if (typeof c.currency !== 'string' || c.currency.length !== 3) fail('"currency" must be a 3-letter code like "USD"');
  if (!Number.isInteger(c.totalCapacity) || c.totalCapacity < 1) fail('"totalCapacity" must be a positive integer');
  if (!Number.isInteger(c.maxTicketsPerOrder) || c.maxTicketsPerOrder < 1) fail('"maxTicketsPerOrder" must be a positive integer');
  if (!Array.isArray(c.tiers) || c.tiers.length === 0) fail('"tiers" must be a non-empty array');
  const seen = new Set<string>();
  for (const t of c.tiers) {
    if (!t.id || !/^[a-z0-9-]+$/.test(t.id)) fail(`tier id "${t.id}" must be lowercase letters/numbers/dashes`);
    if (seen.has(t.id)) fail(`duplicate tier id "${t.id}"`);
    seen.add(t.id);
    if (!t.name || typeof t.name !== 'string') fail(`tier "${t.id}" needs a "name"`);
    if (!Number.isInteger(t.priceCents) || t.priceCents < 0) fail(`tier "${t.id}": "priceCents" must be a non-negative integer (2500 = $25.00)`);
    if (!Number.isInteger(t.cap) || t.cap < 0) fail(`tier "${t.id}": "cap" must be a non-negative integer`);
  }
  if (c.bankTransfer !== undefined) {
    const b = c.bankTransfer as Partial<BankTransferConfig>;
    if (!b || typeof b !== 'object') fail('"bankTransfer" must be an object');
    for (const key of ['accountHolder', 'iban', 'bic', 'bankName'] as const) {
      if (typeof b[key] !== 'string') fail(`"bankTransfer.${key}" must be a string ("" if unused)`);
    }
    const compactIban = (b.iban as string).replace(/\s+/g, '').toUpperCase();
    if (compactIban !== '' && !/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(compactIban)) {
      fail('"bankTransfer.iban" does not look like a valid IBAN (e.g. "DE89 3704 0044 0532 0130 00")');
    }
    if (!Number.isInteger(b.payWithinDays) || (b.payWithinDays as number) < 1 || (b.payWithinDays as number) > 30) {
      fail('"bankTransfer.payWithinDays" must be an integer between 1 and 30');
    }
  }
  return c;
}

export function getEventConfig(): EventConfig {
  // Cache in production; re-read on every call in dev so edits show up live.
  if (cached && process.env.NODE_ENV === 'production') return cached;
  const file = path.join(process.cwd(), 'event.config.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  cached = validate(raw);
  return cached;
}

export function getTier(tierId: string): TierConfig | null {
  return getEventConfig().tiers.find((t) => t.id === tierId) ?? null;
}

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

/** Bank details buyers transfer to. Null until filled in event.config.json. */
export function getBankTransferConfig(): BankTransferConfig | null {
  const b = getEventConfig().bankTransfer;
  if (!b || !b.iban.trim() || !b.accountHolder.trim()) return null;
  return b;
}

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
