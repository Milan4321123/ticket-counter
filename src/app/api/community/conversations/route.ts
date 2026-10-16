import { NextResponse } from 'next/server';
import { memberCall, jsonError } from '@/lib/communityApi';
import { startConversation } from '@/lib/conversations';

export const dynamic = 'force-dynamic';

/** Start (or reopen) a private conversation about a post or a profile: POST {topic, topicId}. */
export async function POST(req: Request) {
  const call = await memberCall(req, 'conv-start', 15);
  if (call instanceof NextResponse) return call;
  const result = startConversation(call.member, call.body.topic, call.body.topicId);
  if (!result.ok) return jsonError(result.error, 400);
  return NextResponse.json({ ok: true, id: result.id });
}
