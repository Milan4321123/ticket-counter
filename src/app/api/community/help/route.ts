import { NextResponse } from 'next/server';
import { memberCall, jsonError } from '@/lib/communityApi';
import { createHelpPost } from '@/lib/helpBoard';

export const dynamic = 'force-dynamic';

/** Put a post on the Sahayog board: POST {kind, category, city, title, body, whenDate?}. */
export async function POST(req: Request) {
  const call = await memberCall(req, 'help-create', 6);
  if (call instanceof NextResponse) return call;
  const result = createHelpPost(call.member, call.body);
  if (!result.ok) return jsonError(result.error, 400);
  return NextResponse.json({ ok: true, id: result.id });
}
