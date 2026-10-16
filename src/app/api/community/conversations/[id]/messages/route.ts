import { NextResponse } from 'next/server';
import { memberCall, jsonError } from '@/lib/communityApi';
import { deleteConversationMessage, listConversationMessages, sendConversationMessage } from '@/lib/conversations';

export const dynamic = 'force-dynamic';

/**
 * A private conversation's messages. GET ?after=<id> returns newer ones (the
 * page polls); POST {body} sends; POST {deleteId} deletes one of your own.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await memberCall(req, 'conv-read', 40, { readBody: false });
  if (call instanceof NextResponse) return call;
  const after = Number(new URL(req.url).searchParams.get('after') ?? '0');
  const messages = listConversationMessages(call.member, id, Number.isFinite(after) && after > 0 ? Math.floor(after) : 0);
  if (!messages) return jsonError('Conversation not found.', 404);
  return NextResponse.json({ messages }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await memberCall(req, 'conv-write', 20);
  if (call instanceof NextResponse) return call;
  const { member, body } = call;
  if (typeof body.deleteId === 'number') {
    return deleteConversationMessage(member, body.deleteId) ? NextResponse.json({ ok: true }) : jsonError('Not yours to delete.', 403);
  }
  const result = sendConversationMessage(member, id, body.body);
  if (!result.ok) return jsonError(result.error, 400);
  return NextResponse.json({ ok: true, message: result.message });
}
