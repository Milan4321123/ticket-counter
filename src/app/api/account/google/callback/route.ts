import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getBaseUrl } from '@/lib/config';
import {
  CUSTOMER_COOKIE_NAME,
  createCustomerSessionToken,
  customerCookieOptions,
  googleSignInConfigured,
  normaliseEmail,
  upsertCustomer,
} from '@/lib/customers';

const STATE_COOKIE = 'google_oauth_state';

function fail(reason: string) {
  const res = NextResponse.redirect(`${getBaseUrl()}/account?error=${reason}`, 303);
  res.cookies.set(STATE_COOKIE, '', { path: '/api/account/google', maxAge: 0 });
  return res;
}

/**
 * Google sends the visitor back here with a one-time code. We check the state
 * against the cookie set when they left, swap the code for an ID token
 * directly with Google (server to server, over TLS, with our client secret —
 * which is what makes the token trustworthy without re-checking its
 * signature), and accept only a VERIFIED email address.
 */
export async function GET(req: Request) {
  if (!googleSignInConfigured()) return fail('google-off');
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = (await cookies()).get(STATE_COOKIE)?.value ?? '';
  const [savedState, back = '/account'] = saved.split('|');
  if (!code || !state || !savedState || state.length !== savedState.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(savedState))) {
    return fail('google-state');
  }

  let idToken: string;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: `${getBaseUrl()}/api/account/google/callback`,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await r.json()) as { id_token?: string };
    if (!r.ok || !data.id_token) return fail('google-token');
    idToken = data.id_token;
  } catch {
    return fail('google-token');
  }

  let claims: { iss?: string; aud?: string; exp?: number; email?: string; email_verified?: boolean; sub?: string; name?: string };
  try {
    claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return fail('google-token');
  }
  const issOk = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  if (!issOk || claims.aud !== process.env.GOOGLE_CLIENT_ID!.trim() || !claims.exp || claims.exp * 1000 < Date.now()) {
    return fail('google-token');
  }
  const email = normaliseEmail(claims.email);
  if (!email || claims.email_verified !== true || !claims.sub) return fail('google-email');

  const customer = upsertCustomer(email, { name: claims.name, googleSub: claims.sub });
  const res = NextResponse.redirect(`${getBaseUrl()}${back}`, 303);
  res.cookies.set(CUSTOMER_COOKIE_NAME, createCustomerSessionToken(customer.id), customerCookieOptions);
  res.cookies.set(STATE_COOKIE, '', { path: '/api/account/google', maxAge: 0 });
  return res;
}
