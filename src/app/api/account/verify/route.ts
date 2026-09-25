import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import {
  CUSTOMER_COOKIE_NAME,
  createCustomerSessionToken,
  customerCookieOptions,
  normaliseEmail,
  upsertCustomer,
  verifyCustomerLoginCode,
} from '@/lib/customers';
import { fromThisSite, readJsonLimited } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/ratelimit';

const MESSAGES: Record<string, string> = {
  wrong: 'That code is not right — check the email and try again.',
  expired: 'That code has expired — ask for a new one.',
  too_many: 'Too many wrong tries — ask for a new code.',
};

/** Check the emailed code; on success the account exists and the visitor is signed in. */
export async function POST(req: Request) {
  if (!fromThisSite(req, getBaseUrl())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!rateLimit(`account:verify:${clientIp(req)}`, 30, 15 * 60_000)) {
    return NextResponse.json({ error: 'Too many tries — please wait a few minutes.' }, { status: 429 });
  }
  const body = (await readJsonLimited(req).catch(() => null)) as { email?: unknown; code?: unknown } | null;
  const email = normaliseEmail(body?.email);
  const code = typeof body?.code === 'string' ? body.code : '';
  if (!email || !code) return NextResponse.json({ error: 'Enter the code from the email.' }, { status: 400 });
  const verdict = verifyCustomerLoginCode(email, code);
  if (verdict !== 'ok') return NextResponse.json({ error: MESSAGES[verdict] }, { status: 400 });
  const customer = upsertCustomer(email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_COOKIE_NAME, createCustomerSessionToken(customer.id), customerCookieOptions);
  return res;
}
