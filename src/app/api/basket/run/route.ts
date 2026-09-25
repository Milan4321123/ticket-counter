import { NextResponse } from 'next/server';
import { createBasketRun } from '@/lib/basket';
import { getBaseUrl } from '@/lib/config';
import { fromThisSite } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/ratelimit';

/** Start one checkout of the basket (lib/basket): returns the run id the orders join. */
export async function POST(req: Request) {
  if (!fromThisSite(req, getBaseUrl())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!rateLimit(`basket:run:${clientIp(req)}`, 20, 60 * 60_000)) {
    return NextResponse.json({ error: 'Too many checkouts — please wait a little.' }, { status: 429 });
  }
  return NextResponse.json({ runId: createBasketRun() });
}
