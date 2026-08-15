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
  return res;
}
