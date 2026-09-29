import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import { CUSTOMER_COOKIE_NAME } from '@/lib/customers';
import { fromThisSite } from '@/lib/http';

export async function POST(req: Request) {
  if (!fromThisSite(req, getBaseUrl())) return new NextResponse('Forbidden', { status: 403 });
  const res = NextResponse.redirect(`${getBaseUrl()}/account`, 303);
  res.cookies.set(CUSTOMER_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  // Pages this browser kept for the buyer go with the session. "cache" only —
  // "storage" would also wipe the cookie-banner choice and the basket. The
  // service worker's own copies (offline tickets) are deleted by the worker
  // itself when it sees this POST (public/sw.js).
  res.headers.set('Clear-Site-Data', '"cache"');
  return res;
}
