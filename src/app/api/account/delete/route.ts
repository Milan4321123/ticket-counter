import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import { CUSTOMER_COOKIE_NAME, currentCustomer, deleteCustomer } from '@/lib/customers';
import { fromThisSite } from '@/lib/http';

/**
 * The customer deletes their own account (Art. 17 GDPR). Plain form POST from
 * /account, which asks them to type DELETE first — the same word is checked
 * here, so a stray click or a replayed form cannot do it.
 *
 * What goes: the account, its saved basket, any sign-in code waiting for the
 * address — and the session, which ends because the account it names no
 * longer exists (the cookie is cleared as well). What stays: orders. Each is
 * the SELLER's record of a sale; it is erased on its own clock
 * (lib/retention.ts), and earlier on request — /account says both.
 */
export async function POST(req: Request) {
  if (!fromThisSite(req, getBaseUrl())) return new NextResponse('Forbidden', { status: 403 });
  const customer = await currentCustomer();
  if (!customer) return NextResponse.redirect(`${getBaseUrl()}/account`, 303);
  const form = await req.formData().catch(() => null);
  const confirm = String(form?.get('confirm') ?? '').trim().toUpperCase();
  if (confirm !== 'DELETE') {
    return NextResponse.redirect(`${getBaseUrl()}/account?delete=confirm#delete`, 303);
  }
  deleteCustomer(customer.id);
  const res = NextResponse.redirect(`${getBaseUrl()}/account?deleted=1`, 303);
  res.cookies.set(CUSTOMER_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  // Same as signing out: pages this browser kept for the account go too.
  res.headers.set('Clear-Site-Data', '"cache"');
  return res;
}
