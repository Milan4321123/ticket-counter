import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import { CUSTOMER_COOKIE_NAME } from '@/lib/customers';
import { fromThisSite } from '@/lib/http';

export async function POST(req: Request) {
  if (!fromThisSite(req, getBaseUrl())) return new NextResponse('Forbidden', { status: 403 });
  const res = NextResponse.redirect(`${getBaseUrl()}/account`, 303);
  res.cookies.set(CUSTOMER_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return res;
}
