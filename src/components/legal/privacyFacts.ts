// Server-only: every fact the Datenschutzerklärung states, gathered in one
// place and read from the code that makes it true.
//
// /privacy is written twice — German (binding) and English — and two copies
// of a number are two chances to drift. So neither copy types a period, a
// cookie lifetime or a provider: both render from this object, and this object
// reads the retention constants the erasure sweep uses, the session lifetimes
// the login routes use, and the processor list the AVV uses.
import { PREAUTH_TTL_MS, SESSION_TTL_MS } from '@/lib/auth';
import { getBaseUrl } from '@/lib/config';
import { CUSTOMER_SESSION_TTL_MS, googleSignInConfigured } from '@/lib/customers';
import {
  LEGAL_TERMS_VERSION,
  OFFLINE_TICKET_CACHE_DAYS,
  SUPERVISORY_AUTHORITY,
  TERMINATION_DELETION_DAYS,
  dataProcessors,
  hostingInEU,
  hostingRegion,
  operatorAddressLines,
  operatorEmail,
  operatorName,
  operatorPhone,
  type LegalProcessor,
} from '@/lib/legal';
import { ORGANIZER_SESSION_TTL_MS } from '@/lib/organizers';
import { STEP_UP_TTL_MS } from '@/lib/payoutStepUp';
import { platformName } from '@/lib/platform';
import {
  BACKUP_RETENTION_DAYS,
  BUYER_RETENTION_DAYS,
  CONTACT_REQUEST_RETENTION_DAYS,
  CUSTOMER_INACTIVE_DAYS,
  REFERRAL_VOUCHER_RETENTION_DAYS,
  SHOP_UNCOLLECTED_LONG_STOP_DAYS,
  SUBSCRIPTION_ENDED_RETENTION_DAYS,
  UNDATED_ORDER_RETENTION_DAYS,
  WAITLIST_NOTIFIED_RETENTION_DAYS,
  WAITLIST_SHOP_MAX_DAYS,
} from '@/lib/retention';

const DAY_MS = 24 * 60 * 60 * 1000;

export type PrivacyFacts = {
  platform: string;
  base: string;
  operator: { name: string; addressLines: string[]; email: string; phone: string };
  authority: typeof SUPERVISORY_AUTHORITY;
  region: string;
  inEU: boolean;
  processors: LegalProcessor[];
  googleSignIn: boolean;
  version: string;
  days: {
    buyer: number;
    shopLongStop: number;
    undated: number;
    waitlistNotified: number;
    waitlistShopMax: number;
    customerInactive: number;
    subscriptionEnded: number;
    contact: number;
    referral: number;
    backup: number;
    termination: number;
    offlineTicket: number;
  };
  sessions: {
    organizerDays: number;
    customerDays: number;
    adminHours: number;
    preauthMinutes: number;
    stepUpMinutes: number;
  };
};

export function privacyFacts(): PrivacyFacts {
  const region = hostingRegion();
  return {
    platform: platformName(),
    base: getBaseUrl(),
    operator: {
      name: operatorName(),
      addressLines: operatorAddressLines(),
      email: operatorEmail(),
      phone: operatorPhone(),
    },
    authority: SUPERVISORY_AUTHORITY,
    region,
    inEU: hostingInEU(region),
    processors: dataProcessors(),
    googleSignIn: googleSignInConfigured(),
    version: LEGAL_TERMS_VERSION,
    days: {
      buyer: BUYER_RETENTION_DAYS,
      shopLongStop: SHOP_UNCOLLECTED_LONG_STOP_DAYS,
      undated: UNDATED_ORDER_RETENTION_DAYS,
      waitlistNotified: WAITLIST_NOTIFIED_RETENTION_DAYS,
      waitlistShopMax: WAITLIST_SHOP_MAX_DAYS,
      customerInactive: CUSTOMER_INACTIVE_DAYS,
      subscriptionEnded: SUBSCRIPTION_ENDED_RETENTION_DAYS,
      contact: CONTACT_REQUEST_RETENTION_DAYS,
      referral: REFERRAL_VOUCHER_RETENTION_DAYS,
      backup: BACKUP_RETENTION_DAYS,
      termination: TERMINATION_DELETION_DAYS,
      offlineTicket: OFFLINE_TICKET_CACHE_DAYS,
    },
    sessions: {
      organizerDays: Math.round(ORGANIZER_SESSION_TTL_MS / DAY_MS),
      customerDays: Math.round(CUSTOMER_SESSION_TTL_MS / DAY_MS),
      adminHours: Math.round(SESSION_TTL_MS / (60 * 60 * 1000)),
      preauthMinutes: Math.round(PREAUTH_TTL_MS / 60_000),
      stepUpMinutes: Math.round(STEP_UP_TTL_MS / 60_000),
    },
  };
}
