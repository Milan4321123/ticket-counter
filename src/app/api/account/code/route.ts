import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import { createCustomerLoginCode, normaliseEmail } from '@/lib/customers';
import { sendCustomerLoginCodeEmail } from '@/lib/email';
import { fromThisSite, readJsonLimited } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/ratelimit';

/**
 * Email a six-digit sign-in code (lib/customers). Always answers the same way
 * whether or not an account exists, so this cannot be used to learn who shops
 * here. Rate-limited per address and per IP — it sends mail.
 */
export async function POST(req: Request) {
  if (!fromThisSite(req, getBaseUrl())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await readJsonLimited(req).catch(() => null)) as { email?: unknown } | null;
  const email = normaliseEmail(body?.email);
  if (!email) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  if (email.endsWith('.invalid')) return NextResponse.json({ error: 'That address cannot receive email.' }, { status: 400 });
  if (!rateLimit(`account:code:ip:${clientIp(req)}`, 10, 15 * 60_000) || !rateLimit(`account:code:${email}`, 3, 15 * 60_000)) {
    return NextResponse.json({ error: 'Several codes were just sent — please wait a few minutes.' }, { status: 429 });
  }
  const code = createCustomerLoginCode(email);
  const sent = await sendCustomerLoginCodeEmail(email, code);
  if (!sent.sent) {
    console.log(`Customer sign-in code for ${email.replace(/(.).*@/, '$1…@')} not sent: ${sent.reason}`);
    if (sent.reason === 'email-not-configured') {
      return NextResponse.json({ error: 'Email is not set up on this site yet — please try Google instead.' }, { status: 503 });
    }
  }
  return NextResponse.json({ ok: true });
}
