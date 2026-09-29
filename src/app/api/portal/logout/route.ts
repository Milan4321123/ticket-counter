import { NextResponse } from 'next/server';
import { ORGANIZER_COOKIE_NAME } from '@/lib/organizers';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ORGANIZER_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  // Drop cached copies of the hub's pages with the session. Not "storage": that
  // would also wipe the cookie-banner choice and the basket.
  res.headers.set('Clear-Site-Data', '"cache"');
  return res;
}
