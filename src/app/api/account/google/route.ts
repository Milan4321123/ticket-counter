import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import { googleSignInConfigured } from '@/lib/customers';

const STATE_COOKIE = 'google_oauth_state';

/**
 * Start "Continue with Google" (OpenID Connect, authorization-code flow).
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, with
 * <base>/api/account/google/callback registered as a redirect URI.
 */
export async function GET(req: Request) {
  if (!googleSignInConfigured()) return NextResponse.redirect(`${getBaseUrl()}/account?error=google-off`, 303);
  const state = crypto.randomBytes(24).toString('base64url');
  const back = new URL(req.url).searchParams.get('back') ?? '';
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: `${getBaseUrl()}/api/account/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 303);
  // Only same-site paths may be returned to (no open redirect).
  const safeBack = back.startsWith('/') && !back.startsWith('//') ? back : '/account';
  res.cookies.set(STATE_COOKIE, `${state}|${safeBack}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/api/account/google',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
  });
  return res;
}
