import { NextResponse } from 'next/server';
import {
  bumpAdminSessionEpoch,
  COOKIE_NAME,
  isAdminRequest,
  isPreauthRequest,
  PREAUTH_COOKIE_NAME,
  SCAN_COOKIE_NAME,
} from '@/lib/auth';

export async function POST() {
  // Bumping the epoch invalidates EVERY outstanding admin session at once, which
  // is what makes "log out" mean log out everywhere — including a token copied
  // off this machine.
  //
  // It is also, for exactly that reason, a weapon if anyone can pull it. This
  // route took no Request, read no cookie, and bumped the epoch as its first
  // statement, so an anonymous
  //
  //     while true; do curl -X POST https://…/api/admin/logout; done
  //
  // signed the owner out of their own platform on a loop and kept them out —
  // they could enter the password and the emailed code correctly and still find
  // the session dead before the next page loaded, with no way to tell why. On
  // event day that is the door scanner and the orders page gone at once.
  //
  // So the server-side revocation now needs a caller who is actually signed in
  // (or halfway through signing in). Clearing the caller's OWN cookies stays
  // unconditional: it touches nothing but the browser making the request, and
  // keeping it that way means a stale tab can still tidy itself up.
  const authorised = (await isAdminRequest()) || (await isPreauthRequest());
  if (authorised) {
    try {
      bumpAdminSessionEpoch();
    } catch (e) {
      console.error('logout: failed to bump admin session epoch', e);
    }
  }

  // Always 200, whether or not anything was revoked. An unauthenticated caller
  // learns nothing about whether a session existed, and the browser gets the
  // same clean result either way.
  const res = NextResponse.json({ ok: true });
  const expire = { httpOnly: true as const, sameSite: 'lax' as const, path: '/', maxAge: 0 };
  // Clear every admin-related cookie: full session, the pre-OTP session, and any
  // door-scanner cookie held in this browser.
  res.cookies.set(COOKIE_NAME, '', expire);
  res.cookies.set(PREAUTH_COOKIE_NAME, '', expire);
  res.cookies.set(SCAN_COOKIE_NAME, '', expire);
  return res;
}
