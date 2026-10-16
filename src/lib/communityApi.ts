// Server-only: the door every community API route goes through.
//
// Same-site check, a signed-in member (not merely a customer: they must have
// joined and not been banned), a per-member rate limit, and a capped JSON
// body. Routes get back the member and the body, or a response to return.
import { NextResponse } from 'next/server';
import { getMember, type Member } from './community';
import { getBaseUrl } from './config';
import { currentCustomer } from './customers';
import { BodyTooLargeError, fromThisSite, readJsonLimited } from './http';
import { rateLimit } from './ratelimit';

export interface MemberCall {
  member: Member;
  body: Record<string, unknown>;
}

export function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

/**
 * Guard a community route. `bucket` names the rate limit; `perMinute` is how
 * many calls one member gets in a minute. Pass `readBody: false` for a GET.
 */
export async function memberCall(
  req: Request,
  bucket: string,
  perMinute: number,
  opts: { readBody?: boolean } = {}
): Promise<MemberCall | NextResponse> {
  if (req.method !== 'GET' && !fromThisSite(req, getBaseUrl())) return jsonError('Forbidden', 403);
  const customer = await currentCustomer();
  if (!customer) return jsonError('Sign in first.', 401);
  const member = getMember(customer.id);
  if (!member) return jsonError('Join the community first.', 403);
  if (!rateLimit(`community:${bucket}:${member.id}`, perMinute, 60_000)) {
    return jsonError('That was a lot at once — wait a minute and try again.', 429);
  }
  if (opts.readBody === false) return { member, body: {} };
  try {
    const parsed = await readJsonLimited(req, 32 * 1024);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return jsonError('Bad request.', 400);
    return { member, body: parsed as Record<string, unknown> };
  } catch (e) {
    return jsonError(e instanceof BodyTooLargeError ? 'That is too long.' : 'Bad request.', e instanceof BodyTooLargeError ? 413 : 400);
  }
}

/** Read a raw request body (an uploaded photo), aborting once it passes `maxBytes`. */
export async function readBytesLimited(req: Request, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(req.headers.get('content-length') || '');
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return total ? Buffer.concat(chunks) : null;
}
