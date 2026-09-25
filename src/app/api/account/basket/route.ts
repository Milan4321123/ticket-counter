import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import { currentCustomer, getCustomerBasket, setCustomerBasket } from '@/lib/customers';
import { fromThisSite, readJsonLimited } from '@/lib/http';

/** The signed-in customer's basket (components/basket). 401 when signed out. */
export async function GET() {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  return NextResponse.json({ lines: getCustomerBasket(customer.id) });
}

export async function PUT(req: Request) {
  if (!fromThisSite(req, getBaseUrl())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const body = (await readJsonLimited(req, 32 * 1024).catch(() => null)) as { lines?: unknown } | null;
  const lines = Array.isArray(body?.lines) ? body!.lines.slice(0, 60) : null;
  if (!lines) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
  setCustomerBasket(customer.id, lines);
  return NextResponse.json({ ok: true });
}
