import { NextResponse } from 'next/server';
import { joinCommunity } from '@/lib/community';
import { jsonError } from '@/lib/communityApi';
import { getBaseUrl } from '@/lib/config';
import { currentCustomer } from '@/lib/customers';
import { fromThisSite, readJsonLimited } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

/**
 * Join the community: POST {name, city, age: true, rules: true}. The caller
 * is a signed-in customer who is not a member yet (or whose accepted rules
 * are out of date). Both confirmations must be literally `true` — a ticked
 * box, never a default.
 */
export async function POST(req: Request) {
  if (!fromThisSite(req, getBaseUrl())) return jsonError('Forbidden', 403);
  const customer = await currentCustomer();
  if (!customer) return jsonError('Sign in first.', 401);
  if (!rateLimit(`community:join:${customer.id}`, 10, 60_000)) return jsonError('Too many tries — wait a minute.', 429);
  const body = (await readJsonLimited(req, 4096).catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError('Bad request.', 400);
  const result = joinCommunity(customer.id, { name: body.name, city: body.city, age: body.age, rules: body.rules });
  if (!result.ok) return jsonError(result.error, 400);
  return NextResponse.json({ ok: true, name: result.member.name, city: result.member.city });
}
