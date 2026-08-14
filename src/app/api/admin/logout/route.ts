import { NextResponse } from 'next/server';
import { bumpAdminSessionEpoch, COOKIE_NAME, PREAUTH_COOKIE_NAME, SCAN_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  // Invalidate ALL outstanding admin sessions server-side, not just this
  // browser's cookie — so "log out" genuinely ends access everywhere, even for
  // a session token that was copied off this machine.
  try {
    bumpAdminSessionEpoch();
  } catch (e) {
    console.error('logout: failed to bump admin session epoch', e);
  }

  const res = NextResponse.json({ ok: true });
  const expire = { httpOnly: true as const, sameSite: 'lax' as const, path: '/', maxAge: 0 };
  // Clear every admin-related cookie: full session, the pre-OTP session, and any
  // door-scanner cookie held in this browser.
  res.cookies.set(COOKIE_NAME, '', expire);
  res.cookies.set(PREAUTH_COOKIE_NAME, '', expire);
  res.cookies.set(SCAN_COOKIE_NAME, '', expire);
  return res;
}
