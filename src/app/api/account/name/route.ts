import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import { currentCustomer, setCustomerName } from '@/lib/customers';
import { fromThisSite } from '@/lib/http';

/** Save the name the checkout fills in for this customer. Plain form POST. */
export async function POST(req: Request) {
  if (!fromThisSite(req, getBaseUrl())) return new NextResponse('Forbidden', { status: 403 });
  const customer = await currentCustomer();
  if (!customer) return NextResponse.redirect(`${getBaseUrl()}/account`, 303);
  const form = await req.formData().catch(() => null);
  setCustomerName(customer.id, String(form?.get('name') ?? ''));
  return NextResponse.redirect(`${getBaseUrl()}/account?saved=1`, 303);
}
